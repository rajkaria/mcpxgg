/**
 * sui-analytics MCP server (S5-T04/T05). Tools per spec §10.3:
 *   query           — natural-language analytics over indexed Sui state
 *   address_history  — tx/transfer history for an address
 *   object_history   — version/owner history for an object
 *   whale_alert      — large transfers above a USD threshold
 *
 * The store and the NL->SQL translator are injected so tests are hermetic and
 * prod can swap in Postgres/ClickHouse + Claude Haiku without touching tool
 * logic. The default factory boots fully offline (in-memory store + heuristic
 * NL->SQL) so it is demoable with zero config.
 *
 * Security: `query` runs SQL produced from attacker-controllable input. Every
 * generated statement passes guardSql (SELECT-only, single-statement, no
 * DDL/DML, bounded LIMIT, no comments) before it reaches the store.
 */

import { createMCPXServer, type MCPXServer } from '@mcpxgg/server';
import { ANALYTICS_SCHEMA, sqlLlmFromEnv, type SqlLlm } from './llm.js';
import { createInMemoryAnalyticsStore, type AnalyticsStore } from './store.js';
import { guardSql, MAX_LIMIT, UnsafeSqlError } from './sql-guard.js';

export interface SuiAnalyticsDeps {
  store?: AnalyticsStore;
  llm?: SqlLlm;
}

function toObjects(columns: string[], rows: unknown[][]): Record<string, unknown>[] {
  return rows.map((r) => {
    const o: Record<string, unknown> = {};
    columns.forEach((c, i) => {
      o[c] = r[i];
    });
    return o;
  });
}

function clampLimit(v: unknown, def: number, max = MAX_LIMIT): number {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.max(1, Math.min(max, Math.floor(n)));
}

export function createSuiAnalyticsServer(deps: SuiAnalyticsDeps = {}): MCPXServer {
  const store = deps.store ?? createInMemoryAnalyticsStore();
  const llm = deps.llm ?? sqlLlmFromEnv();

  const server = createMCPXServer({
    namespace: 'sui-analytics',
    description: 'Natural-language analytics over indexed Sui state.',
  });

  server.tool('query', {
    description:
      'Ask an analytics question in natural language. The question is translated to a ' +
      'read-only SQL SELECT, validated by an allowlist guard, and run over indexed Sui state.',
    inputSchema: {
      type: 'object',
      properties: {
        question: { type: 'string', description: 'Natural-language analytics question' },
        maxRows: { type: 'number', description: `Row cap (1..${MAX_LIMIT}), default 100` },
      },
      required: ['question'],
    },
    pricing: { perCallAtomic: 8_000n, freeTierCallsPerUser: 1 },
    timeoutSeconds: 30,
    handler: async (args) => {
      const question = String(args.question ?? '').trim();
      if (!question) throw new Error('question is required');
      const maxRows = clampLimit(args.maxRows, 100);

      const rawSql = await llm.toSql(question, ANALYTICS_SCHEMA);
      let sql: string;
      try {
        ({ sql } = guardSql(rawSql, maxRows));
      } catch (e) {
        if (e instanceof UnsafeSqlError) {
          // Surface as a clear tool error — never execute unguarded SQL.
          throw new Error(
            `generated query was rejected by the SQL safety guard (${e.message}). ` +
              'Rephrase your question.',
          );
        }
        throw e;
      }

      const { columns, rows } = await store.runSql(sql);
      const truncated = rows.length >= maxRows;
      return {
        question,
        sql,
        columns,
        rows: toObjects(columns, rows),
        rowCount: rows.length,
        truncated,
      };
    },
  });

  server.tool('address_history', {
    description: 'Transaction / transfer history for a Sui address, newest first.',
    inputSchema: {
      type: 'object',
      properties: {
        address: { type: 'string', description: 'Sui address (0x…)' },
        limit: { type: 'number', description: `Max rows (1..${MAX_LIMIT}), default 50` },
      },
      required: ['address'],
    },
    pricing: { perCallAtomic: 3_000n },
    handler: async (args) => {
      const address = String(args.address ?? '').trim();
      if (!address) throw new Error('address is required');
      const limit = clampLimit(args.limit, 50);
      const { columns, rows } = await store.addressHistory(address, limit);
      return {
        address,
        columns,
        rows: toObjects(columns, rows),
        rowCount: rows.length,
        truncated: rows.length >= limit,
      };
    },
  });

  server.tool('object_history', {
    description: 'Version / owner history for a Sui object, newest version first.',
    inputSchema: {
      type: 'object',
      properties: {
        objectId: { type: 'string', description: 'Sui object id (0x…)' },
        limit: { type: 'number', description: `Max rows (1..${MAX_LIMIT}), default 50` },
      },
      required: ['objectId'],
    },
    pricing: { perCallAtomic: 3_000n },
    handler: async (args) => {
      const objectId = String(args.objectId ?? '').trim();
      if (!objectId) throw new Error('objectId is required');
      const limit = clampLimit(args.limit, 50);
      const { columns, rows } = await store.objectHistory(objectId, limit);
      return {
        objectId,
        columns,
        rows: toObjects(columns, rows),
        rowCount: rows.length,
        truncated: rows.length >= limit,
      };
    },
  });

  server.tool('whale_alert', {
    description: 'Large transfers at or above a USD threshold within a trailing time window.',
    inputSchema: {
      type: 'object',
      properties: {
        minUsd: { type: 'number', description: 'Min transfer size in USD, default 100000' },
        windowHours: { type: 'number', description: 'Trailing window in hours, default 24' },
      },
      required: [],
    },
    pricing: { perCallAtomic: 2_000n },
    handler: async (args) => {
      const minUsd =
        Number.isFinite(args.minUsd) && Number(args.minUsd) > 0 ? Number(args.minUsd) : 100_000;
      const windowHours =
        Number.isFinite(args.windowHours) && Number(args.windowHours) > 0
          ? Number(args.windowHours)
          : 24;
      const { columns, rows } = await store.whaleTransfers(minUsd, windowHours);
      return {
        minUsd,
        windowHours,
        columns,
        rows: toObjects(columns, rows),
        rowCount: rows.length,
      };
    },
  });

  return server;
}
