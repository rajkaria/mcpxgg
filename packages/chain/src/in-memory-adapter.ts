/**
 * InMemorySuiAdapter — deterministic ChainAdapter for tests and `pnpm dev`
 * without a live Sui node. Session lifecycle is fully modelled; sprint-5+
 * methods (publishServer, vault) are minimally modelled or throw.
 */

import type {
  AuthIdentity,
  CallReceipt,
  ChainAdapter,
  ChainId,
  CreateSessionParams,
  DeveloperVault,
  EventHandler,
  EventSubscription,
  FacilitatorClient,
  Identity,
  PublishServerParams,
  Session,
  SettleParams,
  TokenInfo,
  TxResult,
  UpdateServerParams,
} from './types';
import { isSuiAddress, normalizeSuiAddress } from './sui/address';

export class InMemorySuiAdapter implements ChainAdapter {
  readonly chainId: ChainId = 'sui';
  readonly displayName = 'Sui (in-memory)';
  readonly settlementToken: TokenInfo = {
    symbol: 'USDsui',
    decimals: 6,
    typeTag: '0xtest::usdsui::USDSUI',
    displayName: 'USDsui',
  };
  readonly facilitator: FacilitatorClient = {
    baseUrl: 'http://facilitator.test',
    verify: async () => ({ isValid: true }),
    settle: async () => ({ txDigest: this.nextDigest(), effectsStatus: 'success' }),
    supported: async () => ({ schemes: ['exact'], networks: ['sui-testnet'] }),
  };

  private sessions = new Map<string, Session>();
  private vaults = new Map<string, DeveloperVault>();
  private seq = 0;

  private nextDigest(): string {
    this.seq += 1;
    return `0xtx${this.seq.toString(16).padStart(8, '0')}`;
  }
  private nextId(prefix: string): string {
    this.seq += 1;
    return `0x${prefix}${this.seq.toString(16).padStart(60, '0')}`;
  }

  async resolveIdentity(authToken: string): Promise<Identity> {
    if (!authToken) throw new Error('empty auth token');
    return { authProviderId: 'privy-test', authIdentityToken: authToken };
  }

  async deriveAddress(authIdentity: AuthIdentity): Promise<string> {
    if (authIdentity.provider === 'wallet') {
      if (!isSuiAddress(authIdentity.subject)) {
        throw new Error(`wallet subject is not a sui address: ${authIdentity.subject}`);
      }
      return normalizeSuiAddress(authIdentity.subject);
    }
    // Deterministic pseudo-address for social logins (test only).
    let h = 2166136261;
    const s = `${authIdentity.provider}:${authIdentity.subject}`;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return normalizeSuiAddress(`0x${(h >>> 0).toString(16)}`);
  }

  async createSession(
    params: CreateSessionParams,
  ): Promise<{ session: Session; tx: TxResult }> {
    const owner = normalizeSuiAddress(params.ownerAddress);
    const session: Session = {
      sessionObjectId: this.nextId('5e55'),
      ownerAddress: owner,
      balanceAtomic: params.initialDepositAtomic,
      perCallCapAtomic: params.perCallCapAtomic ?? BigInt(0),
      perDayCapAtomic: params.perDayCapAtomic ?? BigInt(0),
      scopedServerIds: [],
      expiresAtMs: null,
    };
    this.sessions.set(session.sessionObjectId, session);
    return { session, tx: { txDigest: this.nextDigest(), effectsStatus: 'success' } };
  }

  async depositToSession(sessionObjectId: string, amountAtomic: bigint): Promise<TxResult> {
    const s = this.sessions.get(sessionObjectId);
    if (!s) return { txDigest: '', effectsStatus: 'failure', errorMessage: 'no session' };
    s.balanceAtomic += amountAtomic;
    return { txDigest: this.nextDigest(), effectsStatus: 'success' };
  }

  async withdrawFromSession(
    sessionObjectId: string,
    amountAtomic: bigint,
  ): Promise<TxResult> {
    const s = this.sessions.get(sessionObjectId);
    if (!s || s.balanceAtomic < amountAtomic) {
      return { txDigest: '', effectsStatus: 'failure', errorMessage: 'insufficient' };
    }
    s.balanceAtomic -= amountAtomic;
    return { txDigest: this.nextDigest(), effectsStatus: 'success' };
  }

  getSession(id: string): Session | null {
    return this.sessions.get(id) ?? null;
  }

  async getDeveloperVault(ownerAddress: string): Promise<DeveloperVault | null> {
    return this.vaults.get(normalizeSuiAddress(ownerAddress)) ?? null;
  }

  async claimPayout(developerAddress: string): Promise<TxResult> {
    const v = this.vaults.get(normalizeSuiAddress(developerAddress));
    if (!v) return { txDigest: '', effectsStatus: 'failure', errorMessage: 'no vault' };
    v.accruedBalanceAtomic = BigInt(0);
    return { txDigest: this.nextDigest(), effectsStatus: 'success' };
  }

  async publishServer(
    _params: PublishServerParams,
  ): Promise<{ serverObjectId: string; ownerCapId: string; tx: TxResult }> {
    return {
      serverObjectId: this.nextId('5e54'),
      ownerCapId: this.nextId('cap0'),
      tx: { txDigest: this.nextDigest(), effectsStatus: 'success' },
    };
  }

  async updateServer(_params: UpdateServerParams): Promise<TxResult> {
    return { txDigest: this.nextDigest(), effectsStatus: 'success' };
  }

  async settleCall(_params: SettleParams): Promise<CallReceipt> {
    throw new Error('settleCall goes through the facilitator, not the adapter');
  }

  subscribeEvents(_handler: EventHandler): EventSubscription {
    return { unsubscribe: () => undefined };
  }

  txExplorerUrl(d: string): string {
    return `https://suiscan.xyz/testnet/tx/${d}`;
  }
  objectExplorerUrl(id: string): string {
    return `https://suiscan.xyz/testnet/object/${id}`;
  }
}
