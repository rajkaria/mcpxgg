/**
 * Raw-key tx signer. The ONLY key-holding path in the chain layer — used by
 * `npx mcpxgg publish` when a developer signs their own publish locally.
 * Web/gateway/facilitator never call this; they build PTBs and sign via the
 * user's wallet (see tx-builder.ts). @mysten/sui is the chain package's dep,
 * so callers (e.g. the CLI) go through here instead of importing it directly.
 */

export interface SignAndExecuteParams {
  /** Base64 BCS-serialized TransactionData from a BuiltTx. */
  txBytesB64: string;
  /** `suiprivkey1...` bech32 or 0x/hex 32-byte ed25519 secret. */
  privateKey: string;
  rpcUrl: string;
}

export interface CreatedObject {
  objectType: string;
  objectId: string;
}

export interface SignAndExecuteResult {
  digest: string;
  created: CreatedObject[];
}

async function keypairFromPrivateKey(
  privateKey: string,
): Promise<import('@mysten/sui/keypairs/ed25519').Ed25519Keypair> {
  const [{ Ed25519Keypair }, { decodeSuiPrivateKey }] = await Promise.all([
    import('@mysten/sui/keypairs/ed25519'),
    import('@mysten/sui/cryptography'),
  ]);
  if (privateKey.startsWith('suiprivkey')) {
    const { secretKey } = decodeSuiPrivateKey(privateKey);
    return Ed25519Keypair.fromSecretKey(secretKey);
  }
  const hex = privateKey.replace(/^0x/, '');
  return Ed25519Keypair.fromSecretKey(Uint8Array.from(Buffer.from(hex, 'hex')));
}

/**
 * Derive the Sui address for a raw private key. Used by the quality oracle
 * (S6-T18) to set the attest PTB sender without importing @mysten/sui.
 */
export async function addressFromPrivateKey(privateKey: string): Promise<string> {
  const keypair = await keypairFromPrivateKey(privateKey);
  return keypair.getPublicKey().toSuiAddress();
}

export async function signAndExecuteBase64Tx(
  params: SignAndExecuteParams,
): Promise<SignAndExecuteResult> {
  const { SuiClient } = await import('@mysten/sui/client');

  const client = new SuiClient({ url: params.rpcUrl });

  const keypair = await keypairFromPrivateKey(params.privateKey);

  const txBytes = Uint8Array.from(Buffer.from(params.txBytesB64, 'base64'));
  const res = await client.signAndExecuteTransaction({
    signer: keypair,
    transaction: txBytes,
    options: { showEffects: true, showObjectChanges: true },
  });

  if (res.effects?.status?.status !== 'success') {
    throw new Error(
      `tx ${res.digest} failed: ${res.effects?.status?.error ?? 'unknown'}`,
    );
  }

  const created: CreatedObject[] = [];
  for (const change of res.objectChanges ?? []) {
    if (change.type === 'created' && 'objectType' in change) {
      created.push({
        objectType: change.objectType,
        objectId: change.objectId,
      });
    }
  }
  return { digest: res.digest, created };
}
