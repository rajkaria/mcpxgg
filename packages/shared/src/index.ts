/**
 * @mcpxgg/shared — shared utilities across all apps.
 *
 * Stable subpath exports:
 *   import { ... } from '@mcpxgg/shared/types/database'
 *   import { validateConfig } from '@mcpxgg/shared/validation/config-schema'
 */

export const SHARED_VERSION = '0.1.0';

export type {
  ChainId,
  McpServerRow,
  McpToolRow,
  RequestLogRow,
  ChainBalanceRow,
  DeveloperVaultRow,
  PlatformStateRow,
  IndexerCheckpointRow,
  QualityAttestationRow,
  IntentRow,
  ServerStakeRow,
  AbuseFlagRow,
} from './types/database';

export { ALL_CHAIN_IDS, isChainId } from './types/database';

export type {
  ToolConfig,
  McpxConfig,
  ValidationResult,
} from './validation/config-schema';

export { validateConfig, VALIDATION_CONSTANTS } from './validation/config-schema';

export { initSentry } from './observability';

export {
  DEFAULT_TAKE_RATE_BPS,
  DEFAULT_INSURANCE_BPS,
  DEFAULT_TREASURY_BPS,
  devNetFraction,
} from './economics';
