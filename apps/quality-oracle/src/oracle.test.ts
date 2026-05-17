import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import {
  computeAllServerQuality,
  computeServerQuality,
  LATENCY_CEILING_MS,
  p95,
  priorClosedWindow,
  runQualityOracle,
  WINDOW_MS,
  type AttestInput,
  type CallSample,
  type QualityChainClient,
  type QualityStore,
} from './oracle.js';

function sample(
  serverObjectId: string,
  status: CallSample['status'],
  latencyMs: number | null,
): CallSample {
  return { serverObjectId, status, latencyMs };
}

describe('p95', () => {
  it('is 0 for empty input', () => {
    assert.equal(p95([]), 0);
  });
  it('nearest-rank: p95 of 1..100 is 95', () => {
    const v = Array.from({ length: 100 }, (_, i) => i + 1);
    assert.equal(p95(v), 95);
  });
  it('single value', () => {
    assert.equal(p95([42]), 42);
  });
});

describe('computeServerQuality', () => {
  it('returns null with no samples (nothing to attest)', () => {
    assert.equal(computeServerQuality('0xs', []), null);
  });

  it('a perfect server scores 10000', () => {
    const q = computeServerQuality(
      '0xs',
      Array.from({ length: 50 }, () => sample('0xs', 'success', 0)),
    );
    assert.ok(q);
    assert.equal(q?.uptimeX100, 10_000);
    assert.equal(q?.errorRateX100, 0);
    assert.equal(q?.p95LatencyMs, 0);
    assert.equal(q?.scoreX100, 10_000);
  });

  it('all-error server: uptime 0, error 100%, score = 0.2·latency only', () => {
    // 10 errored calls, latency 0 → latency_score 1 → score = 0.2·1 = 0.20.
    const q = computeServerQuality(
      '0xs',
      Array.from({ length: 10 }, () => sample('0xs', 'error', 0)),
    );
    assert.ok(q);
    assert.equal(q?.uptimeX100, 0);
    assert.equal(q?.errorRateX100, 10_000);
    assert.equal(q?.scoreX100, 2_000);
  });

  it('latency at/above the ceiling zeroes the latency term', () => {
    const q = computeServerQuality(
      '0xs',
      Array.from({ length: 20 }, () => sample('0xs', 'success', LATENCY_CEILING_MS)),
    );
    assert.ok(q);
    // uptime 1, error 0, latency_score 0 → 0.5 + 0.3 + 0 = 0.80.
    assert.equal(q?.scoreX100, 8_000);
  });

  it('mixed window: 80% success, p95 latency, weighted score', () => {
    const samples: CallSample[] = [];
    for (let i = 0; i < 80; i++) samples.push(sample('0xs', 'success', 100));
    for (let i = 0; i < 20; i++) samples.push(sample('0xs', 'error', 100));
    const q = computeServerQuality('0xs', samples);
    assert.ok(q);
    assert.equal(q?.sampleCount, 100);
    assert.equal(q?.uptimeX100, 8_000);
    assert.equal(q?.errorRateX100, 2_000);
    assert.equal(q?.p95LatencyMs, 100);
    // 0.5·0.8 + 0.3·0.8 + 0.2·(1-100/2000) = 0.4 + 0.24 + 0.19 = 0.83.
    assert.equal(q?.scoreX100, 8_300);
  });

  it('rows with null latency are excluded from p95 but still counted', () => {
    const q = computeServerQuality('0xs', [
      sample('0xs', 'success', null),
      sample('0xs', 'success', 500),
    ]);
    assert.ok(q);
    assert.equal(q?.sampleCount, 2);
    assert.equal(q?.p95LatencyMs, 500);
  });
});

describe('computeAllServerQuality', () => {
  it('groups by server, omits empty, sorts deterministically', () => {
    const all = computeAllServerQuality([
      sample('0xb', 'success', 10),
      sample('0xa', 'success', 10),
      sample('0xa', 'error', 10),
    ]);
    assert.equal(all.length, 2);
    assert.equal(all[0]?.serverObjectId, '0xa');
    assert.equal(all[1]?.serverObjectId, '0xb');
    assert.equal(all[0]?.sampleCount, 2);
  });
});

describe('priorClosedWindow', () => {
  it('is the 6h block before the floor boundary', () => {
    const w = priorClosedWindow(7 * WINDOW_MS + 5);
    assert.equal(w.endMs, 7 * WINDOW_MS);
    assert.equal(w.startMs, 6 * WINDOW_MS);
  });
  it('deterministic within a window', () => {
    assert.deepEqual(
      priorClosedWindow(3 * WINDOW_MS + 1),
      priorClosedWindow(4 * WINDOW_MS - 1),
    );
  });
});

describe('runQualityOracle', () => {
  const W_START = 6 * WINDOW_MS;
  const W_END = 7 * WINDOW_MS;

  it('reads samples, attests each measured server, reports a summary', async () => {
    const calls: AttestInput[] = [];
    const store: QualityStore = {
      async getCallSamples(s, e) {
        assert.equal(s, W_START);
        assert.equal(e, W_END);
        return [
          sample('0xa', 'success', 50),
          sample('0xa', 'success', 50),
          sample('0xb', 'error', 50),
        ];
      },
    };
    const chain: QualityChainClient = {
      async attest(input) {
        calls.push(input);
        return {
          digest: `0xd${calls.length}`,
          attestationObjectId: `0xatt${calls.length}`,
        };
      },
    };
    const res = await runQualityOracle(store, chain, W_START, W_END);
    assert.equal(res.serversMeasured, 2);
    assert.equal(res.attestationsSubmitted, 2);
    assert.equal(res.failures.length, 0);
    assert.equal(calls.length, 2);
    assert.equal(calls[0]?.serverObjectId, '0xa');
    assert.equal(calls[0]?.windowStartMs, W_START);
    assert.equal(calls[0]?.uptimeX100, 10_000);
    // The created QualityAttestation ids are surfaced for the slash pass.
    assert.equal(res.attestationsByServer.get('0xa'), '0xatt1');
    assert.equal(res.attestationsByServer.get('0xb'), '0xatt2');
  });

  it('omits servers whose attest returned no created attestation id', async () => {
    const store: QualityStore = {
      async getCallSamples() {
        return [sample('0xa', 'success', 1), sample('0xb', 'success', 1)];
      },
    };
    const chain: QualityChainClient = {
      async attest(input) {
        return {
          digest: '0xd',
          attestationObjectId:
            input.serverObjectId === '0xa' ? '0xattA' : null,
        };
      },
    };
    const res = await runQualityOracle(store, chain, W_START, W_END);
    assert.equal(res.attestationsSubmitted, 2);
    assert.equal(res.attestationsByServer.get('0xa'), '0xattA');
    assert.equal(res.attestationsByServer.has('0xb'), false);
  });

  it('collects per-server attest failures without aborting the rest', async () => {
    const store: QualityStore = {
      async getCallSamples() {
        return [sample('0xbad', 'success', 1), sample('0xok', 'success', 1)];
      },
    };
    const chain: QualityChainClient = {
      async attest(input) {
        if (input.serverObjectId === '0xbad') throw new Error('rpc down');
        return { digest: '0xok', attestationObjectId: '0xok-att' };
      },
    };
    const res = await runQualityOracle(store, chain, W_START, W_END);
    assert.equal(res.attestationsSubmitted, 1);
    assert.equal(res.failures.length, 1);
    assert.equal(res.failures[0]?.serverObjectId, '0xbad');
  });

  it('no samples → nothing attested', async () => {
    const store: QualityStore = {
      async getCallSamples() {
        return [];
      },
    };
    let attested = false;
    const chain: QualityChainClient = {
      async attest() {
        attested = true;
        return { digest: '0x', attestationObjectId: '0xatt' };
      },
    };
    const res = await runQualityOracle(store, chain, W_START, W_END);
    assert.equal(res.serversMeasured, 0);
    assert.equal(attested, false);
  });
});
