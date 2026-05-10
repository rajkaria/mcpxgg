/**
 * SuiAdapter — Sprint 0 stub. Sprint 1 onward fills in real implementations.
 *
 * Every method throws `NotImplemented` until the relevant sprint wires it.
 * See `docs/SPRINTS.md` for the per-method sprint mapping:
 *   - createSession, depositToSession, withdrawFromSession  → S4
 *   - publishServer, updateServer                            → S5
 *   - settleCall                                             → S2 (via facilitator)
 *   - getDeveloperVault, claimPayout                         → S5
 *   - subscribeEvents                                        → S2
 *   - resolveIdentity, deriveAddress                         → S4 (Privy integration)
 */

import type {
  ChainAdapter,
  ChainId,
  TokenInfo,
  Identity,
  AuthIdentity,
  TxResult,
  CallReceipt,
  Session,
  DeveloperVault,
  CreateSessionParams,
  PublishServerParams,
  UpdateServerParams,
  SettleParams,
  EventHandler,
  EventSubscription,
  FacilitatorClient,
} from './types';

class NotImplemented extends Error {
  constructor(method: string, sprint: string) {
    super(`SuiAdapter.${method} — wired in Sprint ${sprint}, see docs/SPRINTS.md`);
    this.name = 'NotImplemented';
  }
}

export class SuiAdapter implements ChainAdapter {
  readonly chainId: ChainId = 'sui';
  readonly displayName = 'Sui';

  readonly settlementToken: TokenInfo = {
    symbol: 'USDsui',
    decimals: 6,
    typeTag: process.env.USDSUI_COIN_TYPE ?? '0x...::usdsui::USDSUI',
    displayName: 'USDsui',
  };

  readonly facilitator: FacilitatorClient = {
    baseUrl: process.env.NEXT_PUBLIC_FACILITATOR_URL ?? 'http://localhost:3002',
    verify: async () => {
      throw new NotImplemented('facilitator.verify', '2');
    },
    settle: async () => {
      throw new NotImplemented('facilitator.settle', '2');
    },
    supported: async () => {
      throw new NotImplemented('facilitator.supported', '2');
    },
  };

  async resolveIdentity(_authToken: string): Promise<Identity> {
    throw new NotImplemented('resolveIdentity', '4');
  }

  async deriveAddress(_authIdentity: AuthIdentity): Promise<string> {
    throw new NotImplemented('deriveAddress', '4');
  }

  async createSession(_params: CreateSessionParams): Promise<{ session: Session; tx: TxResult }> {
    throw new NotImplemented('createSession', '4');
  }

  async depositToSession(_sessionObjectId: string, _amountAtomic: bigint): Promise<TxResult> {
    throw new NotImplemented('depositToSession', '4');
  }

  async withdrawFromSession(_sessionObjectId: string, _amountAtomic: bigint): Promise<TxResult> {
    throw new NotImplemented('withdrawFromSession', '4');
  }

  async publishServer(
    _params: PublishServerParams,
  ): Promise<{ serverObjectId: string; ownerCapId: string; tx: TxResult }> {
    throw new NotImplemented('publishServer', '5');
  }

  async updateServer(_params: UpdateServerParams): Promise<TxResult> {
    throw new NotImplemented('updateServer', '5');
  }

  async settleCall(_params: SettleParams): Promise<CallReceipt> {
    throw new NotImplemented('settleCall', '2');
  }

  async getDeveloperVault(_ownerAddress: string): Promise<DeveloperVault | null> {
    throw new NotImplemented('getDeveloperVault', '5');
  }

  async claimPayout(_developerAddress: string): Promise<TxResult> {
    throw new NotImplemented('claimPayout', '5');
  }

  subscribeEvents(_handler: EventHandler): EventSubscription {
    throw new NotImplemented('subscribeEvents', '2');
  }

  txExplorerUrl(digest: string): string {
    const network = process.env.SUI_NETWORK ?? 'testnet';
    return network === 'mainnet'
      ? `https://suiscan.xyz/mainnet/tx/${digest}`
      : `https://suiscan.xyz/testnet/tx/${digest}`;
  }

  objectExplorerUrl(id: string): string {
    const network = process.env.SUI_NETWORK ?? 'testnet';
    return network === 'mainnet'
      ? `https://suiscan.xyz/mainnet/object/${id}`
      : `https://suiscan.xyz/testnet/object/${id}`;
  }
}
