import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { loopTick, runOnce } from './index.js';
import { NOOP_LOGGER } from './logger.js';
import { WINDOW_MS, type AttestInput, type CallSample, type QualityChainClient, type QualityStore } from './oracle.js';

const NOW = 9 * WINDOW_MS + 42; // priorClosedWindow → [8·W, 9·W)
const EXPECTED_END = 9 * WINDOW_MS;

function fixtureStore(samples: CallSample[]): QualityStore {
  return { async getCallSamples() { return samples; } };
}

function recordingChain(): QualityChainClient & { calls: AttestInput[] } {
  const calls: AttestInput[] = [];
  return {
    calls,
    async attest(i) {
      calls.push(i);
      return { digest: `0x${calls.length}` };
    },
  };
}

describe('runOnce', () => {
  it('attests the prior closed window for each measured server', async () => {
    const store = fixtureStore([
      { serverObjectId: '0xs', status: 'success', latencyMs: 10 },
      { serverObjectId: '0xs', status: 'success', latencyMs: 10 },
    ]);
    const chain = recordingChain();
    const r = await runOnce(store, chain, NOW, NOOP_LOGGER);
    assert.equal(r.endMs, EXPECTED_END);
    assert.equal(chain.calls.length, 1);
    assert.equal(chain.calls[0]?.serverObjectId, '0xs');
    assert.equal(chain.calls[0]?.windowStartMs, 8 * WINDOW_MS);
    assert.equal(chain.calls[0]?.windowEndMs, EXPECTED_END);
  });
});

describe('loopTick', () => {
  it('attests once per closed window then is a no-op until the next', async () => {
    const store = fixtureStore([
      { serverObjectId: '0xs', status: 'success', latencyMs: 10 },
    ]);
    const chain = recordingChain();

    const first = await loopTick(store, chain, 0, NOW, NOOP_LOGGER);
    assert.ok(first);
    assert.equal(first?.attestedBoundaryMs, EXPECTED_END);
    assert.equal(chain.calls.length, 1);

    // Same window again → skipped.
    const second = await loopTick(store, chain, first.attestedBoundaryMs, NOW, NOOP_LOGGER);
    assert.equal(second, null);
    assert.equal(chain.calls.length, 1);

    // Next window opens → attests again.
    const third = await loopTick(
      store,
      chain,
      first.attestedBoundaryMs,
      NOW + WINDOW_MS,
      NOOP_LOGGER,
    );
    assert.ok(third);
    assert.equal(chain.calls.length, 2);
  });
});
