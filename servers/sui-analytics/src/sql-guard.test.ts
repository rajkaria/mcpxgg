import { test } from 'node:test';
import assert from 'node:assert/strict';
import { guardSql, UnsafeSqlError, MAX_LIMIT } from './sql-guard.js';

test('accepts a clean bounded SELECT', () => {
  const { sql, limit } = guardSql(
    "SELECT digest, amount_usd FROM transfers WHERE amount_usd >= 1000 ORDER BY ts DESC LIMIT 50",
  );
  assert.match(sql, /^SELECT/);
  assert.equal(limit, 50);
});

test('accepts a WITH (CTE) read-only statement', () => {
  const { limit } = guardSql(
    "WITH t AS (SELECT * FROM transfers) SELECT digest FROM t LIMIT 10",
  );
  assert.equal(limit, 10);
});

test('rejects INSERT', () => {
  assert.throws(
    () => guardSql("INSERT INTO transfers VALUES (1) LIMIT 1"),
    (e: unknown) => e instanceof UnsafeSqlError && /SELECT\/WITH/.test((e as Error).message),
  );
});

test('rejects DROP hidden after a SELECT keyword', () => {
  assert.throws(
    () => guardSql("SELECT 1 FROM transfers WHERE 1=1 DROP TABLE transfers LIMIT 1"),
    (e: unknown) => e instanceof UnsafeSqlError && /forbidden keyword: DROP/.test((e as Error).message),
  );
});

test('rejects DELETE', () => {
  assert.throws(
    () => guardSql("SELECT 1 FROM transfers; DELETE FROM transfers LIMIT 1"),
    UnsafeSqlError,
  );
});

test('rejects stacked / multi-statement via semicolon', () => {
  assert.throws(
    () => guardSql("SELECT * FROM transfers LIMIT 5; SELECT 1"),
    (e: unknown) => e instanceof UnsafeSqlError && /semicolon/.test((e as Error).message),
  );
});

test('rejects SQL comments (guard-bypass vector)', () => {
  assert.throws(
    () => guardSql("SELECT * FROM transfers -- DROP TABLE x\n LIMIT 5"),
    (e: unknown) => e instanceof UnsafeSqlError && /comment/.test((e as Error).message),
  );
});

test('rejects a SELECT with no LIMIT', () => {
  assert.throws(
    () => guardSql("SELECT * FROM transfers ORDER BY ts DESC"),
    (e: unknown) => e instanceof UnsafeSqlError && /LIMIT clause is required/.test((e as Error).message),
  );
});

test('rejects an out-of-range LIMIT', () => {
  assert.throws(
    () => guardSql(`SELECT * FROM transfers LIMIT ${MAX_LIMIT + 1}`),
    (e: unknown) => e instanceof UnsafeSqlError && /LIMIT must be an integer/.test((e as Error).message),
  );
});

test('does not trip on column names containing forbidden substrings', () => {
  // `created_at` contains "CREATE", `updated_at` contains "UPDATE" — must pass.
  const { limit } = guardSql(
    "SELECT created_at, updated_at FROM transfers ORDER BY created_at DESC LIMIT 25",
  );
  assert.equal(limit, 25);
});

test('rejects empty input', () => {
  assert.throws(() => guardSql("   "), UnsafeSqlError);
});
