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

export async function signAndExecuteBase64Tx(
  params: SignAndExecuteParams,
): Promise<SignAndExecuteResult> {
  const [{ SuiClient }, { Ed25519Keypair }, { decodeSuiPrivateKey }] =
    await Promise.all([
      import('@mysten/sui/client'),
      import('@mysten/sui/keypairs/ed25519'),
      import('@mysten/sui/cryptography'),
    ]);

  const client = new SuiClient({ url: params.rpcUrl });

  let keypair: import('@mysten/sui/keypairs/ed25519').Ed25519Keypair;
  if (params.privateKey.startsWith('suiprivkey')) {
    const { secretKey } = decodeSuiPrivateKey(params.privateKey);
    keypair = Ed25519Keypair.fromSecretKey(secretKey);
  } else {
    const hex = params.privateKey.replace(/^0x/, '');
    keypair = Ed25519Keypair.fromSecretKey(
      Uint8Array.from(Buffer.from(hex, 'hex')),
    );
  }

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
