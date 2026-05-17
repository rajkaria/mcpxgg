/**
 * ChainAdapter interface.
 *
 * Every chain operation in mcpxgg goes through this interface. Sui is the only
 * implementation today; Base, Solana, etc. plug in as additional adapters later
 * (post-hackathon). The web app, gateway, facilitator, indexer, and CLI all
 * consume this interface; none of them depend on `@mysten/sui` directly.
 *
 * See ARCHITECTURE.md for the layered view, DECISIONS.md ADR-001 for the rationale.
 */

export type ChainId = 'sui' | 'base' | 'solana';

export interface TokenInfo {
  symbol: string;
  decimals: number;
  typeTag: string;
  displayName: string;
}

export interface Identity {
  authProviderId: string;
  authIdentityToken: string;
}

export interface AuthIdentity {
  provider: 'google' | 'apple' | 'email' | 'twitter' | 'discord' | 'wallet';
  subject: string;
}

export interface TxResult {
  txDigest: string;
  effectsStatus: 'success' | 'failure';
  errorMessage?: string;
}

export interface CallReceipt {
  receiptObjectId: string;
  txDigest: string;
  amountAtomic: bigint;
  blobId: string;
  serverObjectId: string;
  toolName: string;
  success: boolean;
  timestampMs: number;
}

export interface Session {
  sessionObjectId: string;
  ownerAddress: string;
  balanceAtomic: bigint;
  perCallCapAtomic: bigint;
  perDayCapAtomic: bigint;
  scopedServerIds: string[];
  expiresAtMs: number | null;
}

export interface DeveloperVault {
  vaultObjectId: string;
  ownerAddress: string;
  accruedBalanceAtomic: bigint;
  lifetimeEarningsAtomic: bigint;
}

export interface BundleSummary {
  bundleObjectId: string;
  name: string;
  creatorAddress: string;
  serverObjectIds: string[];
  /** Multiplier × 100 (e.g. 90 = 0.9× = 10% discount). */
  priceMultiplierX100: number;
  active: boolean;
}

export interface CreateSessionParams {
  ownerAddress: string;
  initialDepositAtomic: bigint;
  perCallCapAtomic?: bigint;
  perDayCapAtomic?: bigint;
}

export interface PublishServerParams {
  ownerAddress: string;
  namespace: string;
  endpointUrl: string;
  metadataBlobId: string;
  tools: Array<{
    name: string;
    description: string;
    inputSchemaBlobId: string;
    priceAtomic: bigint;
    freeTierCallsPerUser: number;
    timeoutSeconds: number;
  }>;
  category: string;
}

export interface UpdateServerParams {
  serverObjectId: string;
  ownerCapId: string;
  newEndpointUrl?: string;
  newMetadataBlobId?: string;
  newTools?: PublishServerParams['tools'];
}

export interface SettleParams {
  sessionObjectId: string;
  serverObjectId: string;
  toolName: string;
  amountAtomic: bigint;
  logBlobId: string;
  success: boolean;
  intentId?: string;
}

export interface EventHandler {
  (event: ChainEvent): void | Promise<void>;
}

export interface EventSubscription {
  unsubscribe(): void;
}

export type ChainEvent =
  | { type: 'ServerPublished'; serverObjectId: string; namespace: string; ownerAddress: string }
  | { type: 'ServerUpdated'; serverObjectId: string; version: number }
  | { type: 'ServerDeactivated'; serverObjectId: string }
  | { type: 'SessionCreated'; sessionObjectId: string; ownerAddress: string; balanceAtomic: bigint }
  | { type: 'SessionDeposit'; sessionObjectId: string; amountAtomic: bigint }
  | { type: 'SessionWithdraw'; sessionObjectId: string; amountAtomic: bigint }
  | { type: 'CallSettled'; receipt: CallReceipt }
  | { type: 'RefundIssued'; originalReceiptId: string; amountAtomic: bigint }
  | { type: 'VaultClaimed'; vaultObjectId: string; amountAtomic: bigint }
  | { type: 'IntentCreated'; intentId: string; agentAddress: string; dailyCapAtomic: bigint }
  | { type: 'IntentRevoked'; intentId: string }
  | { type: 'StakeSlashed'; serverObjectId: string; amountAtomic: bigint }
  | { type: 'InsurancePaid'; toAddress: string; amountAtomic: bigint }
  | { type: 'BundleCreated'; bundleId: string; serverIds: string[] }
  | { type: 'QualityAttested'; serverObjectId: string; scoreX100: number }
  | { type: 'ReviewPosted'; reviewId: string; serverObjectId: string; rating: number };

export interface FacilitatorClient {
  baseUrl: string;
  verify(payload: unknown, details: unknown): Promise<{ isValid: boolean; invalidReason?: string }>;
  settle(payload: unknown, details: unknown): Promise<TxResult>;
  supported(): Promise<{ schemes: string[]; networks: string[] }>;
}

export interface ChainAdapter {
  // Identity
  chainId: ChainId;
  displayName: string;

  // Identity / address derivation
  resolveIdentity(authToken: string): Promise<Identity>;
  deriveAddress(authIdentity: AuthIdentity): Promise<string>;

  // Payment infrastructure
  facilitator: FacilitatorClient;
  settlementToken: TokenInfo;

  // Sessions / subscriptions
  createSession(params: CreateSessionParams): Promise<{ session: Session; tx: TxResult }>;
  depositToSession(sessionObjectId: string, amountAtomic: bigint): Promise<TxResult>;
  withdrawFromSession(sessionObjectId: string, amountAtomic: bigint): Promise<TxResult>;

  // Server registry
  publishServer(params: PublishServerParams): Promise<{ serverObjectId: string; ownerCapId: string; tx: TxResult }>;
  updateServer(params: UpdateServerParams): Promise<TxResult>;
  /** True if `namespace` is already registered on this chain. */
  isNamespaceTaken(namespace: string): Promise<boolean>;

  // Settlement
  settleCall(params: SettleParams): Promise<CallReceipt>;

  // Vault / payouts
  getDeveloperVault(ownerAddress: string): Promise<DeveloperVault | null>;
  claimPayout(developerAddress: string): Promise<TxResult>;

  // Composable bundles (S5)
  listBundles(): Promise<BundleSummary[]>;

  // Indexer
  subscribeEvents(handler: EventHandler): EventSubscription;

  // Explorer URLs
  txExplorerUrl(digest: string): string;
  objectExplorerUrl(id: string): string;
}
