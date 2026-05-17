/**
 * NL->SQL seam (S5-T05).
 *
 * Production uses Claude Haiku to translate a natural-language question into
 * SQL against the analytics schema. CI/offline has no key, so the default is
 * a deterministic heuristic translator that maps known question shapes to
 * safe bounded SELECTs. Either way the output is run through the allowlist
 * guard (src/sql-guard.ts) before it ever touches the store — the LLM is an
 * untrusted, attacker-influenced component.
 */

export interface SqlLlm {
  /** Translate a question into a single SELECT. Output is still guard-checked. */
  toSql(question: string, schema: string): Promise<string>;
}

/** The schema we describe to the model / encode in the heuristic. */
export const ANALYTICS_SCHEMA = `
-- indexed Sui state (mirror of on-chain events; prod = Postgres + ClickHouse)
TABLE transfers (
  digest TEXT, sender TEXT, recipient TEXT,
  amount_usd NUMERIC, coin_type TEXT, ts TIMESTAMP
)
TABLE object_versions (
  object_id TEXT, version INT, owner TEXT, change_type TEXT, ts TIMESTAMP
)
`.trim();

function lc(s: string): string {
  return s.toLowerCase();
}

function clampLimit(n: number | undefined, def: number, max = 1000): number {
  if (n === undefined || !Number.isFinite(n)) return def;
  return Math.max(1, Math.min(max, Math.floor(n)));
}

const ADDR_RE = /0x[0-9a-f]{2,64}/i;

/**
 * Deterministic rule-based NL->SQL. Recognises the demo question families and
 * emits canned, guard-passing SELECTs. Anything unrecognised falls back to a
 * safe "recent transfers" query so the tool degrades gracefully rather than
 * emitting something that might trip the guard or leak intent.
 */
export function createHeuristicSqlLlm(maxRows = 100): SqlLlm {
  return {
    async toSql(question: string): Promise<string> {
      const q = lc(question);
      const limit = clampLimit(maxRows, 100);
      const addr = question.match(ADDR_RE)?.[0];

      // whale / large transfers
      if (/\b(whale|large|big|huge)\b/.test(q) && q.includes('transfer')) {
        const usdMatch = q.match(/\$?\s*([\d,]+)\s*(k|m)?/i);
        let minUsd = 100000;
        if (usdMatch?.[1]) {
          let v = Number.parseFloat(usdMatch[1].replace(/,/g, ''));
          const suffix = usdMatch[2]?.toLowerCase();
          if (suffix === 'k') v *= 1_000;
          if (suffix === 'm') v *= 1_000_000;
          if (Number.isFinite(v) && v > 0) minUsd = v;
        }
        return (
          `SELECT digest, sender, recipient, amount_usd, coin_type, ts FROM transfers ` +
          `WHERE amount_usd >= ${minUsd} AND ts >= NOW() - INTERVAL '24 hour' ` +
          `ORDER BY ts DESC LIMIT ${limit}`
        );
      }

      // address history
      if (addr && (q.includes('address') || q.includes('history') || q.includes('activity') || q.includes('wallet'))) {
        return (
          `SELECT digest, sender, recipient, amount_usd, coin_type, ts FROM transfers ` +
          `WHERE sender = '${addr.toLowerCase()}' OR recipient = '${addr.toLowerCase()}' ` +
          `ORDER BY ts DESC LIMIT ${limit}`
        );
      }

      // object history
      if (addr && q.includes('object')) {
        return (
          `SELECT object_id, version, owner, change_type, ts FROM object_versions ` +
          `WHERE object_id = '${addr.toLowerCase()}' ORDER BY version DESC LIMIT ${limit}`
        );
      }

      // counts / volume
      if (q.includes('how many') && q.includes('transfer')) {
        return `SELECT COUNT(*) AS transfer_count FROM transfers LIMIT 1`;
      }
      if ((q.includes('total') || q.includes('volume')) && q.includes('transfer')) {
        return `SELECT SUM(amount_usd) AS total_volume_usd FROM transfers LIMIT 1`;
      }

      // top transfers
      if (q.includes('top') || q.includes('largest') || q.includes('biggest')) {
        return (
          `SELECT digest, sender, recipient, amount_usd, coin_type, ts FROM transfers ` +
          `ORDER BY amount_usd DESC LIMIT ${limit}`
        );
      }

      // default: recent transfers
      return (
        `SELECT digest, sender, recipient, amount_usd, coin_type, ts FROM transfers ` +
        `ORDER BY ts DESC LIMIT ${limit}`
      );
    },
  };
}

/**
 * Claude Haiku NL->SQL. Thin wrapper over the Messages API. Only constructed
 * when ANTHROPIC_API_KEY is present; otherwise sqlLlmFromEnv falls back to the
 * heuristic. The model is instructed to emit a single bounded SELECT, but the
 * output is STILL passed through guardSql by the server — never trusted here.
 */
export function createAnthropicSqlLlm(
  apiKey: string,
  model = 'claude-haiku-4-5-20251001',
  fallback: SqlLlm = createHeuristicSqlLlm(),
): SqlLlm {
  return {
    async toSql(question: string, schema: string): Promise<string> {
      const system =
        'You translate a natural-language analytics question into ONE read-only ' +
        'SQL SELECT for the given schema. Rules: SELECT only; single statement; ' +
        'no semicolons; no comments; always include an explicit LIMIT <= 1000. ' +
        'Return ONLY the SQL, no prose, no code fences.';
      try {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model,
            max_tokens: 512,
            system,
            messages: [
              {
                role: 'user',
                content: `Schema:\n${schema}\n\nQuestion: ${question}\n\nSQL:`,
              },
            ],
          }),
        });
        if (!res.ok) throw new Error(`anthropic http ${res.status}`);
        const body = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
        const text = body.content?.find((b) => b.type === 'text')?.text?.trim();
        if (!text) throw new Error('anthropic returned no text');
        // Strip code fences if the model wrapped the SQL anyway.
        return text.replace(/^```(?:sql)?\s*/i, '').replace(/\s*```$/, '').trim();
      } catch {
        // Network / key / parse failure: degrade to the deterministic path
        // rather than failing the tool call outright.
        return fallback.toSql(question, schema);
      }
    },
  };
}

export function sqlLlmFromEnv(env: NodeJS.ProcessEnv = process.env): SqlLlm {
  if (env.ANTHROPIC_API_KEY) return createAnthropicSqlLlm(env.ANTHROPIC_API_KEY);
  return createHeuristicSqlLlm();
}
