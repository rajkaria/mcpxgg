/**
 * Embeddings. The default is a dependency-free, deterministic local embedder
 * (hashed token bag → fixed-dim L2-normalised vector). It is good enough for
 * the anchor demo and keeps CI hermetic. An OpenAI-backed embedder is the
 * drop-in upgrade (set OPENAI_API_KEY); the `Embedder` seam is the only
 * contract the vector store depends on.
 */

export interface Embedder {
  readonly dim: number;
  embed(text: string): Promise<number[]>;
}

const DIM = 256;

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 0);
}

// FNV-1a — stable across processes (Math.random/hashCode would not be).
function hash(token: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < token.length; i++) {
    h ^= token.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function createLocalEmbedder(dim = DIM): Embedder {
  return {
    dim,
    async embed(text: string): Promise<number[]> {
      const v = new Array<number>(dim).fill(0);
      for (const tok of tokenize(text)) {
        const idx = hash(tok) % dim;
        const sign = (hash(tok + '#') & 1) === 0 ? 1 : -1;
        v[idx] = (v[idx] ?? 0) + sign;
      }
      let norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
      if (norm === 0) norm = 1;
      return v.map((x) => x / norm);
    },
  };
}

/** OpenAI embeddings (text-embedding-3-small). Lazy — only loaded if used. */
export function createOpenAIEmbedder(apiKey: string, model = 'text-embedding-3-small'): Embedder {
  return {
    dim: 1536,
    async embed(text: string): Promise<number[]> {
      const res = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ input: text, model }),
      });
      if (!res.ok) throw new Error(`openai embeddings http ${res.status}`);
      const body = (await res.json()) as { data: Array<{ embedding: number[] }> };
      const e = body.data[0]?.embedding;
      if (!e) throw new Error('openai embeddings returned no vector');
      return e;
    },
  };
}

export function embedderFromEnv(env: NodeJS.ProcessEnv = process.env): Embedder {
  if (env.OPENAI_API_KEY) return createOpenAIEmbedder(env.OPENAI_API_KEY);
  return createLocalEmbedder();
}
