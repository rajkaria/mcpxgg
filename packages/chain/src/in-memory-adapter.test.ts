import { test } from 'node:test';
import assert from 'node:assert/strict';
import { InMemorySuiAdapter } from './in-memory-adapter';
import { normalizeSuiAddress, isSuiAddress } from './sui/address';

test('address normalize pads to 32 bytes; validates', () => {
  assert.equal(normalizeSuiAddress('0x1'), `0x${'0'.repeat(63)}1`);
  assert.equal(isSuiAddress('0xabc'), true);
  assert.equal(isSuiAddress('nope'), false);
  assert.throws(() => normalizeSuiAddress('nope'));
});

test('deriveAddress: wallet subject passes through normalized', async () => {
  const a = new InMemorySuiAdapter();
  const addr = await a.deriveAddress({ provider: 'wallet', subject: '0xABC' });
  assert.equal(addr, `0x${'0'.repeat(61)}abc`);
});

test('deriveAddress: social login is deterministic', async () => {
  const a = new InMemorySuiAdapter();
  const x = await a.deriveAddress({ provider: 'google', subject: 'u@x.com' });
  const y = await a.deriveAddress({ provider: 'google', subject: 'u@x.com' });
  assert.equal(x, y);
  assert.equal(isSuiAddress(x), true);
});

test('session lifecycle: create → deposit → withdraw', async () => {
  const a = new InMemorySuiAdapter();
  const { session, tx } = await a.createSession({
    ownerAddress: '0xa11ce',
    initialDepositAtomic: 1_000_000n,
    perCallCapAtomic: 50_000n,
  });
  assert.equal(tx.effectsStatus, 'success');
  assert.equal(session.balanceAtomic, 1_000_000n);
  assert.equal(session.perCallCapAtomic, 50_000n);

  await a.depositToSession(session.sessionObjectId, 500_000n);
  assert.equal(a.getSession(session.sessionObjectId)?.balanceAtomic, 1_500_000n);

  const w = await a.withdrawFromSession(session.sessionObjectId, 2_000_000n);
  assert.equal(w.effectsStatus, 'failure'); // insufficient
  const ok = await a.withdrawFromSession(session.sessionObjectId, 500_000n);
  assert.equal(ok.effectsStatus, 'success');
  assert.equal(a.getSession(session.sessionObjectId)?.balanceAtomic, 1_000_000n);
});

test('explorer urls', () => {
  const a = new InMemorySuiAdapter();
  assert.match(a.txExplorerUrl('0xd'), /suiscan\.xyz\/testnet\/tx\/0xd/);
  assert.match(a.objectExplorerUrl('0xo'), /object\/0xo/);
});
