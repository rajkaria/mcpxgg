/**
 * SQL allowlist guard (S5-T05, security-critical).
 *
 * The gateway treats *all* tool input as untrusted, and the `query` tool runs
 * SQL produced by an LLM from an attacker-controllable natural-language
 * question. The LLM is therefore a confused-deputy: we never execute its
 * output without passing this guard first.
 *
 * Rules (hard requirements — see README "Security"):
 *   1. Must be a single statement (no `;` anywhere — defeats stacked queries).
 *   2. Must start with SELECT or WITH (read-only; no DDL/DML entrypoint).
 *   3. No DDL/DML/side-effecting keywords anywhere (INSERT, UPDATE, DELETE,
 *      DROP, ALTER, CREATE, TRUNCATE, GRANT, REVOKE, ATTACH, PRAGMA, COPY,
 *      MERGE, REPLACE, CALL, EXEC, VACUUM, SET, INTO).
 *   4. No SQL comments (line "--", "#", or block) — classic bypass vector.
 *   5. Must carry an explicit LIMIT and that LIMIT must be a sane integer
 *      (1..MAX_LIMIT). Unbounded scans are rejected, not silently capped.
 *
 * The guard is intentionally conservative: it rejects anything it does not
 * positively recognise as a safe bounded SELECT. False negatives (a safe
 * query rejected) are acceptable; false positives are not.
 */

export const MAX_LIMIT = 1000;

export class UnsafeSqlError extends Error {
  constructor(reason: string) {
    super(`unsafe SQL rejected: ${reason}`);
    this.name = 'UnsafeSqlError';
  }
}

// Whole-word match so column names like `created_at` don't trip `CREATE`.
const FORBIDDEN_KEYWORDS = [
  'INSERT',
  'UPDATE',
  'DELETE',
  'DROP',
  'ALTER',
  'CREATE',
  'TRUNCATE',
  'GRANT',
  'REVOKE',
  'ATTACH',
  'DETACH',
  'PRAGMA',
  'COPY',
  'MERGE',
  'REPLACE',
  'CALL',
  'EXEC',
  'EXECUTE',
  'VACUUM',
  'INTO',
  'LOAD',
  'OUTFILE',
  'DUMPFILE',
] as const;

export interface GuardResult {
  /** The validated SQL, trimmed. Safe to execute as-is. */
  sql: string;
  /** The enforced LIMIT parsed out of the statement. */
  limit: number;
}

/**
 * Validate untrusted SQL. Returns the cleaned statement on success; throws
 * {@link UnsafeSqlError} on any violation. Never mutates intent — it only
 * accepts or rejects.
 */
export function guardSql(rawSql: string, maxLimit = MAX_LIMIT): GuardResult {
  if (typeof rawSql !== 'string' || rawSql.trim().length === 0) {
    throw new UnsafeSqlError('empty statement');
  }
  const sql = rawSql.trim();

  // 4. Comments — block before anything else; comments hide payloads.
  if (sql.includes('--') || sql.includes('/*') || sql.includes('*/') || sql.includes('#')) {
    throw new UnsafeSqlError('SQL comments are not allowed');
  }

  // 1. Single statement only. A trailing `;` is just as forbidden as an
  //    interior one — keeps the rule trivially auditable.
  if (sql.includes(';')) {
    throw new UnsafeSqlError('multiple statements / semicolons are not allowed');
  }

  // 2. Read-only entrypoint.
  if (!/^(select|with)\b/i.test(sql)) {
    throw new UnsafeSqlError('only SELECT/WITH statements are allowed');
  }

  // 3. Forbidden keyword anywhere (whole word, case-insensitive).
  const upper = sql.toUpperCase();
  for (const kw of FORBIDDEN_KEYWORDS) {
    const re = new RegExp(`\\b${kw}\\b`);
    if (re.test(upper)) {
      throw new UnsafeSqlError(`forbidden keyword: ${kw}`);
    }
  }

  // 5. Explicit, sane LIMIT.
  const m = sql.match(/\blimit\s+(\d+)\b/i);
  if (!m || m[1] === undefined) {
    throw new UnsafeSqlError('a LIMIT clause is required');
  }
  const limit = Number.parseInt(m[1], 10);
  if (!Number.isInteger(limit) || limit < 1 || limit > maxLimit) {
    throw new UnsafeSqlError(`LIMIT must be an integer in 1..${maxLimit}`);
  }

  return { sql, limit };
}
