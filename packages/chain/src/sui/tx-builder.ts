/**
 * Session PTB builders (S4-T07). These return base64 transaction bytes the
 * browser hands to Privy's embedded wallet to sign — the gateway/web never
 * holds the user's key. @mysten/sui is lazy-loaded so type-only consumers
 * and the test path don't need the SDK resolved.
 *
 * Move entry points (contracts/sources/session.move):
 *   mcpx::session::create_session<T>(registry, init_coin, per_call_cap,
 *                                    per_day_cap, clock, ctx)
 *   mcpx::session::deposit<T>(session, coin)
 *   mcpx::session::withdraw<T>(session, amount, ctx)
 */

export interface SuiTxConfig {
  packageId: string;
  /** USDsui coin type tag, e.g. 0x..::usdsui::USDSUI */
  coinType: string;
  /** NamespaceRegistry / session registry shared object id. */
  sessionRegistryId: string;
  rpcUrl: string;
}

export interface BuiltTx {
  /** Base64 BCS-serialized TransactionData, ready for wallet signing. */
  txBytesB64: string;
}

async function sui() {
  const [{ Transaction }, { SuiClient }] = await Promise.all([
    import('@mysten/sui/transactions'),
    import('@mysten/sui/client'),
  ]);
  return { Transaction, SuiClient };
}

/** Pick USDsui coins owned by `sender` summing ≥ amount; merge+split to exact. */
async function coinInput(
  tx: import('@mysten/sui/transactions').Transaction,
  client: import('@mysten/sui/client').SuiClient,
  sender: string,
  coinType: string,
  amountAtomic: bigint,
) {
  const { data } = await client.getCoins({ owner: sender, coinType });
  if (data.length === 0) throw new Error(`no ${coinType} coins for ${sender}`);
  const primary = tx.object(data[0]!.coinObjectId);
  if (data.length > 1) {
    tx.mergeCoins(
      primary,
      data.slice(1).map((c) => tx.object(c.coinObjectId)),
    );
  }
  const [exact] = tx.splitCoins(primary, [tx.pure.u64(amountAtomic)]);
  return exact;
}

export async function buildCreateSessionAndDepositTx(args: {
  cfg: SuiTxConfig;
  sender: string;
  initialDepositAtomic: bigint;
  perCallCapAtomic?: bigint;
  perDayCapAtomic?: bigint;
}): Promise<BuiltTx> {
  const { Transaction, SuiClient } = await sui();
  const client = new SuiClient({ url: args.cfg.rpcUrl });
  const tx = new Transaction();
  tx.setSender(args.sender);
  const coin = await coinInput(
    tx,
    client,
    args.sender,
    args.cfg.coinType,
    args.initialDepositAtomic,
  );
  tx.moveCall({
    target: `${args.cfg.packageId}::session::create_session`,
    typeArguments: [args.cfg.coinType],
    arguments: [
      tx.object(args.cfg.sessionRegistryId),
      coin,
      tx.pure.u64(args.perCallCapAtomic ?? BigInt(0)),
      tx.pure.u64(args.perDayCapAtomic ?? BigInt(0)),
      tx.object('0x6'), // Clock
    ],
  });
  const txBytes = await tx.build({ client });
  return { txBytesB64: Buffer.from(txBytes).toString('base64') };
}

export async function buildDepositTx(args: {
  cfg: SuiTxConfig;
  sender: string;
  sessionObjectId: string;
  amountAtomic: bigint;
}): Promise<BuiltTx> {
  const { Transaction, SuiClient } = await sui();
  const client = new SuiClient({ url: args.cfg.rpcUrl });
  const tx = new Transaction();
  tx.setSender(args.sender);
  const coin = await coinInput(
    tx,
    client,
    args.sender,
    args.cfg.coinType,
    args.amountAtomic,
  );
  tx.moveCall({
    target: `${args.cfg.packageId}::session::deposit`,
    typeArguments: [args.cfg.coinType],
    arguments: [tx.object(args.sessionObjectId), coin],
  });
  const txBytes = await tx.build({ client });
  return { txBytesB64: Buffer.from(txBytes).toString('base64') };
}

export async function buildWithdrawTx(args: {
  cfg: SuiTxConfig;
  sender: string;
  sessionObjectId: string;
  amountAtomic: bigint;
}): Promise<BuiltTx> {
  const { Transaction, SuiClient } = await sui();
  const client = new SuiClient({ url: args.cfg.rpcUrl });
  const tx = new Transaction();
  tx.setSender(args.sender);
  tx.moveCall({
    target: `${args.cfg.packageId}::session::withdraw`,
    typeArguments: [args.cfg.coinType],
    arguments: [
      tx.object(args.sessionObjectId),
      tx.pure.u64(args.amountAtomic),
    ],
  });
  const txBytes = await tx.build({ client });
  return { txBytesB64: Buffer.from(txBytes).toString('base64') };
}
