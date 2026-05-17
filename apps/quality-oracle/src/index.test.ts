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
      return {
        digest: `0x${calls.length}`,
        // Deterministic per-server attestation id so the slash pass can prove
        // the breach. Keyed by server so distinct servers get distinct ids.
        attestationObjectId: `0xatt-${i.serverObjectId}`,
      };
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
    const r = await runOnce({ store, chain }, NOW, NOOP_LOGGER);
    assert.equal(r.endMs, EXPECTED_END);
    assert.equal(chain.calls.length, 1);
    assert.equal(chain.calls[0]?.serverObjectId, '0xs');
    assert.equal(chain.calls[0]?.windowStartMs, 8 * WINDOW_MS);
    assert.equal(chain.calls[0]?.windowEndMs, EXPECTED_END);
  });

  it('runs the SLA-slash pass against the same window samples', async () => {
    // 0xs committed 99% (9900) but delivered 0% → breach. Two consecutive
    // runs cross the ≥2 threshold and a slash is submitted.
    const store = fixtureStore([
      { serverObjectId: '0xs', status: 'error', latencyMs: 10 },
      { serverObjectId: '0xs', status: 'error', latencyMs: 10 },
    ]);
    const chain = recordingChain();
    const slashed: {
      stakeObjectId: string;
      amountAtomic: bigint;
      attestationObjectId: string;
    }[] = [];
    const slashChain = {
      async slash(i: {
        stakeObjectId: string;
        amountAtomic: bigint;
        attestationObjectId: string;
      }) {
        slashed.push(i);
        return { digest: '0xslash' };
      },
    };
    const streaks = new Map<string, number>();
    const streakStore = {
      async getStreak(id: string) {
        return streaks.get(id) ?? 0;
      },
      async setStreak(id: string, n: number) {
        streaks.set(id, n);
      },
    };
    const stakeStore = {
      async listActiveStakes() {
        return [
          {
            stakeObjectId: '0xstake',
            serverObjectId: '0xs',
            slaUptimeX100: 9900,
            remainingStakeAtomic: 1_000_000n,
          },
        ];
      },
    };
    const deps = { store, chain, stakeStore, streakStore, slashChain };

    await runOnce(deps, NOW, NOOP_LOGGER);
    assert.equal(slashed.length, 0); // 1st breach window — streak = 1.
    await runOnce(deps, NOW, NOOP_LOGGER);
    assert.equal(slashed.length, 1); // 2nd consecutive → slash.
    assert.equal(slashed[0]?.stakeObjectId, '0xstake');
    // 0% vs 9900 committed → shortfall = 1 → whole remaining stake.
    assert.equal(slashed[0]?.amountAtomic, 1_000_000n);
    // The slash references the SAME-tick attestation the quality pass created
    // for this server (security hardening: slash aborts without it).
    assert.equal(slashed[0]?.attestationObjectId, '0xatt-0xs');
  });

  it('skips the slash and preserves the streak when the attest pass produced no attestation for that server', async () => {
    const store = fixtureStore([
      { serverObjectId: '0xs', status: 'error', latencyMs: 10 },
    ]);
    // Attest pass succeeds at the call but the chain created no attestation
    // object (e.g. the shared-object change wasn't surfaced) → no proof.
    const chain: QualityChainClient & { calls: AttestInput[] } = {
      calls: [],
      async attest(i) {
        this.calls.push(i);
        return { digest: '0xd', attestationObjectId: null };
      },
    };
    const slashed: { stakeObjectId: string }[] = [];
    const slashChain = {
      async slash(i: { stakeObjectId: string }) {
        slashed.push(i);
        return { digest: '0xslash' };
      },
    };
    const streaks = new Map<string, number>([['0xstake', 1]]); // already 1
    const streakStore = {
      async getStreak(id: string) {
        return streaks.get(id) ?? 0;
      },
      async setStreak(id: string, n: number) {
        streaks.set(id, n);
      },
    };
    const stakeStore = {
      async listActiveStakes() {
        return [
          {
            stakeObjectId: '0xstake',
            serverObjectId: '0xs',
            slaUptimeX100: 9900,
            remainingStakeAtomic: 1_000_000n,
          },
        ];
      },
    };
    const deps = { store, chain, stakeStore, streakStore, slashChain };

    await runOnce(deps, NOW, NOOP_LOGGER);
    // 2nd consecutive breach WOULD slash, but there is no attestation proof
    // this tick → slash skipped, streak kept at 2 so it retries next window.
    assert.equal(slashed.length, 0);
    assert.equal(streaks.get('0xstake'), 2);
  });
});

describe('loopTick', () => {
  it('attests once per closed window then is a no-op until the next', async () => {
    const store = fixtureStore([
      { serverObjectId: '0xs', status: 'success', latencyMs: 10 },
    ]);
    const chain = recordingChain();

    const first = await loopTick({ store, chain }, 0, NOW, NOOP_LOGGER);
    assert.ok(first);
    assert.equal(first?.attestedBoundaryMs, EXPECTED_END);
    assert.equal(chain.calls.length, 1);

    // Same window again → skipped.
    const second = await loopTick(
      { store, chain },
      first.attestedBoundaryMs,
      NOW,
      NOOP_LOGGER,
    );
    assert.equal(second, null);
    assert.equal(chain.calls.length, 1);

    // Next window opens → attests again.
    const third = await loopTick(
      { store, chain },
      first.attestedBoundaryMs,
      NOW + WINDOW_MS,
      NOOP_LOGGER,
    );
    assert.ok(third);
    assert.equal(chain.calls.length, 2);
  });
});
