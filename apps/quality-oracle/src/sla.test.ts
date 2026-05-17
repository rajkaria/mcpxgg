import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import {
  BREACH_WINDOWS_TO_SLASH,
  evaluateSla,
  nextBreachStreak,
  slashAmountAtomic,
  slashReason,
  type StakedServer,
} from './sla.js';
import {
  runSlaSlashing,
  type BreachStreakStore,
  type CallSample,
  type SlashChainClient,
  type SlashInput,
  type StakeStore,
} from './oracle.js';
import { WINDOW_MS } from './oracle.js';

function stake(over: Partial<StakedServer> = {}): StakedServer {
  return {
    stakeObjectId: '0xstake',
    serverObjectId: '0xsrv',
    slaUptimeX100: 9900,
    remainingStakeAtomic: 1_000_000n,
    ...over,
  };
}

describe('evaluateSla', () => {
  it('no calls → no signal (not in breach, shortfall 0, null uptime)', () => {
    const e = evaluateSla(stake(), 0, 0);
    assert.equal(e.actualUptimeX100, null);
    assert.equal(e.inBreach, false);
    assert.equal(e.shortfallFraction, 0);
  });

  it('meets SLA exactly → not in breach', () => {
    const e = evaluateSla(stake({ slaUptimeX100: 9900 }), 9900, 100);
    assert.equal(e.inBreach, false);
    assert.equal(e.shortfallFraction, 0);
  });

  it('above SLA → not in breach', () => {
    const e = evaluateSla(stake({ slaUptimeX100: 9500 }), 9999, 100);
    assert.equal(e.inBreach, false);
  });

  it('below SLA → in breach with shortfall normalised by committed tier', () => {
    // committed 9900, actual 9500 → (9900-9500)/9900 ≈ 0.0404
    const e = evaluateSla(stake({ slaUptimeX100: 9900 }), 9500, 100);
    assert.equal(e.inBreach, true);
    assert.ok(Math.abs(e.shortfallFraction - 400 / 9900) < 1e-9);
  });

  it('total outage → shortfall = 1', () => {
    const e = evaluateSla(stake({ slaUptimeX100: 9900 }), 0, 100);
    assert.equal(e.inBreach, true);
    assert.equal(e.shortfallFraction, 1);
  });
});

describe('slashAmountAtomic', () => {
  it('0 when not in breach', () => {
    const e = evaluateSla(stake(), 9999, 100);
    assert.equal(slashAmountAtomic(e, 1_000_000n), 0n);
  });

  it('0 when nothing remains', () => {
    const e = evaluateSla(stake(), 0, 100);
    assert.equal(slashAmountAtomic(e, 0n), 0n);
  });

  it('proportional to shortfall, capped at remaining', () => {
    // committed 9900, actual 9500 → frac 400/9900 ≈ 0.040404
    const e = evaluateSla(stake({ slaUptimeX100: 9900 }), 9500, 100);
    const got = slashAmountAtomic(e, 1_000_000n);
    // round(1_000_000 * 0.040404) ≈ 40404
    assert.ok(got >= 40_000n && got <= 40_500n, `got ${got}`);
  });

  it('full outage drains the whole remaining stake', () => {
    const e = evaluateSla(stake(), 0, 100);
    assert.equal(slashAmountAtomic(e, 777_777n), 777_777n);
  });
});

describe('nextBreachStreak', () => {
  it('breach increments the streak', () => {
    const e = evaluateSla(stake(), 0, 100);
    assert.deepEqual(nextBreachStreak(0, e), {
      consecutiveBreaches: 1,
      shouldSlash: false,
    });
  });

  it('reaches the threshold on the 2nd consecutive breach', () => {
    const e = evaluateSla(stake(), 0, 100);
    assert.deepEqual(nextBreachStreak(1, e), {
      consecutiveBreaches: BREACH_WINDOWS_TO_SLASH,
      shouldSlash: true,
    });
  });

  it('a compliant window resets the streak', () => {
    const e = evaluateSla(stake(), 9999, 100);
    assert.deepEqual(nextBreachStreak(5, e), {
      consecutiveBreaches: 0,
      shouldSlash: false,
    });
  });

  it('a no-signal window leaves the streak unchanged', () => {
    const e = evaluateSla(stake(), 0, 0);
    assert.deepEqual(nextBreachStreak(1, e), {
      consecutiveBreaches: 1,
      shouldSlash: false,
    });
  });
});

describe('slashReason', () => {
  it('embeds committed/measured uptime and window count', () => {
    const e = evaluateSla(stake({ slaUptimeX100: 9900 }), 5000, 100);
    const r = slashReason(e, 2, WINDOW_MS);
    assert.match(r, /committed 99\.00%/);
    assert.match(r, /measured 50\.00%/);
    assert.match(r, /2 consecutive/);
  });
});

// ─── runSlaSlashing orchestration ────────────────────────────────────────

function recordingSlashChain(): SlashChainClient & { calls: SlashInput[] } {
  const calls: SlashInput[] = [];
  return {
    calls,
    async slash(i) {
      calls.push(i);
      return { digest: `0x${calls.length}` };
    },
  };
}

function memStreakStore(): BreachStreakStore & { map: Map<string, number> } {
  const map = new Map<string, number>();
  return {
    map,
    async getStreak(id) {
      return map.get(id) ?? 0;
    },
    async setStreak(id, n) {
      map.set(id, n);
    },
  };
}

function fixedStakeStore(stakes: StakedServer[]): StakeStore {
  return { async listActiveStakes() { return stakes; } };
}

/** A fresh-attestation map proving the breach for '0xsrv' (the default stake). */
function attMap(
  entries: Record<string, string> = { '0xsrv': '0xatt-0xsrv' },
): Map<string, string> {
  return new Map(Object.entries(entries));
}

const W0 = 0;
const W1 = WINDOW_MS;

describe('runSlaSlashing', () => {
  it('does not slash on a single breached window (hysteresis)', async () => {
    const samples: CallSample[] = [
      { serverObjectId: '0xsrv', status: 'error', latencyMs: 5 },
      { serverObjectId: '0xsrv', status: 'error', latencyMs: 5 },
    ];
    const chain = recordingSlashChain();
    const streaks = memStreakStore();
    const r = await runSlaSlashing(
      fixedStakeStore([stake()]),
      streaks,
      chain,
      samples,
      W0,
      W1,
      attMap(),
    );
    assert.equal(r.inBreach, 1);
    assert.equal(r.slashesSubmitted, 0);
    assert.equal(streaks.map.get('0xstake'), 1);
  });

  it('slashes on the 2nd consecutive breached window', async () => {
    const samples: CallSample[] = [
      { serverObjectId: '0xsrv', status: 'error', latencyMs: 5 },
    ];
    const chain = recordingSlashChain();
    const streaks = memStreakStore();
    streaks.map.set('0xstake', 1); // already 1 breach behind us

    const r = await runSlaSlashing(
      fixedStakeStore([stake({ remainingStakeAtomic: 500_000n })]),
      streaks,
      chain,
      samples,
      W0,
      W1,
      attMap(),
    );
    assert.equal(r.slashesSubmitted, 1);
    assert.equal(chain.calls[0]?.stakeObjectId, '0xstake');
    // full outage vs 9900 → shortfall 1 → entire remaining 500_000.
    assert.equal(chain.calls[0]?.amountAtomic, 500_000n);
    // The proving attestation id is threaded into the slash PTB.
    assert.equal(chain.calls[0]?.attestationObjectId, '0xatt-0xsrv');
    assert.equal(r.slashedAtomicTotal, 500_000n);
  });

  it('a compliant window between breaches resets the streak', async () => {
    const chain = recordingSlashChain();
    const streaks = memStreakStore();
    const stakes = fixedStakeStore([stake()]);

    // window 1: breach
    await runSlaSlashing(
      stakes,
      streaks,
      chain,
      [{ serverObjectId: '0xsrv', status: 'error', latencyMs: 5 }],
      W0,
      W1,
      attMap(),
    );
    assert.equal(streaks.map.get('0xstake'), 1);

    // window 2: fully compliant → reset
    await runSlaSlashing(
      stakes,
      streaks,
      chain,
      [{ serverObjectId: '0xsrv', status: 'success', latencyMs: 5 }],
      W1,
      W1 + WINDOW_MS,
      attMap(),
    );
    assert.equal(streaks.map.get('0xstake'), 0);
    assert.equal(chain.calls.length, 0);
  });

  it('a no-signal window does not reset an existing streak', async () => {
    const chain = recordingSlashChain();
    const streaks = memStreakStore();
    streaks.map.set('0xstake', 1);
    await runSlaSlashing(
      fixedStakeStore([stake()]),
      streaks,
      chain,
      [], // no calls for this server this window
      W0,
      W1,
      attMap(),
    );
    assert.equal(streaks.map.get('0xstake'), 1);
    assert.equal(chain.calls.length, 0);
  });

  it('a failed slash is collected and the streak is NOT advanced (retry next window)', async () => {
    const failingChain: SlashChainClient = {
      async slash() {
        throw new Error('tx reverted');
      },
    };
    const streaks = memStreakStore();
    streaks.map.set('0xstake', 1);
    const r = await runSlaSlashing(
      fixedStakeStore([stake()]),
      streaks,
      failingChain,
      [{ serverObjectId: '0xsrv', status: 'error', latencyMs: 5 }],
      W0,
      W1,
      attMap(),
    );
    assert.equal(r.slashesSubmitted, 0);
    assert.equal(r.failures.length, 1);
    assert.match(r.failures[0]!.error, /tx reverted/);
    // streak stays at 1 (set inside the try, after the throw) → retried.
    assert.equal(streaks.map.get('0xstake'), 1);
  });

  it('does not slash a stake with nothing left but keeps the streak', async () => {
    const chain = recordingSlashChain();
    const streaks = memStreakStore();
    streaks.map.set('0xstake', 1);
    const r = await runSlaSlashing(
      fixedStakeStore([stake({ remainingStakeAtomic: 0n })]),
      streaks,
      chain,
      [{ serverObjectId: '0xsrv', status: 'error', latencyMs: 5 }],
      W0,
      W1,
      attMap(),
    );
    // 0n remaining stakes are filtered by the store in prod; here we pass one
    // explicitly and assert the orchestrator is still safe.
    assert.equal(r.slashesSubmitted, 0);
    assert.equal(chain.calls.length, 0);
  });

  it('skips the slash and preserves the streak when no fresh attestation proves the breach', async () => {
    const chain = recordingSlashChain();
    const streaks = memStreakStore();
    streaks.map.set('0xstake', 1); // 2nd consecutive breach this window
    const r = await runSlaSlashing(
      fixedStakeStore([stake()]),
      streaks,
      chain,
      [{ serverObjectId: '0xsrv', status: 'error', latencyMs: 5 }],
      W0,
      W1,
      // No attestation for '0xsrv' this tick (attest failed/absent).
      new Map<string, string>(),
    );
    assert.equal(r.slashesSubmitted, 0);
    assert.equal(r.skippedNoAttestation, 1);
    assert.equal(chain.calls.length, 0);
    assert.equal(r.failures.length, 1);
    assert.match(r.failures[0]!.error, /no fresh QualityAttestation/);
    // Streak preserved at the slash threshold so it retries next window once
    // an attestation exists (mirrors failed-slash semantics).
    assert.equal(streaks.map.get('0xstake'), 2);
  });

  it('slashes with the right attestation id when the proof IS present', async () => {
    const chain = recordingSlashChain();
    const streaks = memStreakStore();
    streaks.map.set('0xstake', 1);
    const r = await runSlaSlashing(
      fixedStakeStore([stake({ remainingStakeAtomic: 750_000n })]),
      streaks,
      chain,
      [{ serverObjectId: '0xsrv', status: 'error', latencyMs: 5 }],
      W0,
      W1,
      attMap({ '0xsrv': '0xPROOF' }),
    );
    assert.equal(r.slashesSubmitted, 1);
    assert.equal(r.skippedNoAttestation, 0);
    assert.equal(chain.calls[0]?.attestationObjectId, '0xPROOF');
    assert.equal(chain.calls[0]?.amountAtomic, 750_000n);
  });
});
