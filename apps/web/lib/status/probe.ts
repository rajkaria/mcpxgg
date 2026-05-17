/**
 * S8-T10. Lightweight, honest service health probing for the public status
 * page (stands in for status.mcpx.gg). We do NOT invent monitoring infra:
 * each service base URL is env-configurable, we do a single GET to its
 * health endpoint with a short timeout, and anything we can't reach cheaply
 * is reported as "unknown" rather than guessed.
 */

import "server-only";

export type ServiceState = "up" | "down" | "unknown";

export interface ServiceHealth {
  key: string;
  name: string;
  description: string;
  state: ServiceState;
  /** Round-trip latency in ms when up, else null. */
  latencyMs: number | null;
  /** ISO timestamp of this probe. */
  checkedAt: string;
  /** Whether a base URL was even configured for this service. */
  configured: boolean;
}

interface ServiceDef {
  key: string;
  name: string;
  description: string;
  /** Env var holding the service base URL. */
  envVar: string;
  /** Health path appended to the base URL. */
  healthPath: string;
}

const SERVICES: readonly ServiceDef[] = [
  {
    key: "web",
    name: "Web app",
    description: "mcpx.gg — marketplace, dashboard, marketing site.",
    envVar: "NEXT_PUBLIC_SITE_URL",
    healthPath: "/api/healthz",
  },
  {
    key: "gateway",
    name: "Gateway",
    description: "Routes MCP tool calls to servers and meters every call.",
    envVar: "NEXT_PUBLIC_GATEWAY_URL",
    healthPath: "/healthz",
  },
  {
    key: "facilitator",
    name: "x402 Facilitator",
    description: "Builds and submits the atomic on-chain settlement PTB.",
    envVar: "NEXT_PUBLIC_FACILITATOR_URL",
    healthPath: "/healthz",
  },
  {
    key: "indexer",
    name: "Indexer",
    description: "Mirrors Sui chain events into the read-fast Postgres cache.",
    envVar: "NEXT_PUBLIC_INDEXER_URL",
    healthPath: "/healthz",
  },
  {
    key: "quality-oracle",
    name: "Quality Oracle",
    description: "Attests rolling per-server uptime, latency, and error rate.",
    envVar: "NEXT_PUBLIC_QUALITY_ORACLE_URL",
    healthPath: "/healthz",
  },
] as const;

async function probe(def: ServiceDef): Promise<ServiceHealth> {
  const checkedAt = new Date().toISOString();
  const base = process.env[def.envVar];
  if (!base) {
    return {
      key: def.key,
      name: def.name,
      description: def.description,
      state: "unknown",
      latencyMs: null,
      checkedAt,
      configured: false,
    };
  }

  const url = `${base.replace(/\/+$/, "")}${def.healthPath}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  const started = Date.now();
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      cache: "no-store",
      // A health endpoint should answer to a HEAD-ish GET; keep it cheap.
      headers: { accept: "application/json,text/plain,*/*" },
    });
    const latencyMs = Date.now() - started;
    return {
      key: def.key,
      name: def.name,
      description: def.description,
      state: res.ok ? "up" : "down",
      latencyMs: res.ok ? latencyMs : null,
      checkedAt,
      configured: true,
    };
  } catch {
    return {
      key: def.key,
      name: def.name,
      description: def.description,
      state: "down",
      latencyMs: null,
      checkedAt,
      configured: true,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function probeAllServices(): Promise<ServiceHealth[]> {
  return Promise.all(SERVICES.map(probe));
}
