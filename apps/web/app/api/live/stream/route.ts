import { NextResponse } from "next/server";

/**
 * S6-T15. Server-Sent Events feed for the /live page. Subscribes to the
 * indexer's Upstash Redis pub/sub channel (`mcpx:live`, see
 * apps/indexer/src/handlers/dispatch.ts) and relays each published event to
 * the browser EventSource.
 *
 * Upstash's REST client cannot hold a long-lived SUBSCRIBE connection, so we
 * poll a capped Redis list the indexer also writes (`mcpx:live:log`) — and if
 * Redis is unconfigured we degrade to an empty keep-alive stream rather than
 * crashing (Redis env is a BLOCKED.md item).
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CHANNEL_LOG_KEY = "mcpx:live:log";

export async function GET() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => {
        if (closed) return;
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(data)}\n\n`),
        );
      };

      send({ type: "hello", ts: Date.now() });

      if (!url || !token) {
        // No Redis — keep the connection alive with heartbeats so the client
        // EventSource doesn't error-loop. Live events simply won't arrive.
        const hb = setInterval(() => {
          if (closed) return clearInterval(hb);
          controller.enqueue(encoder.encode(`: keep-alive\n\n`));
        }, 15000);
        return;
      }

      const { Redis } = await import("@upstash/redis");
      const redis = new Redis({ url, token });

      let lastLen = 0;
      try {
        lastLen = await redis.llen(CHANNEL_LOG_KEY);
      } catch {
        lastLen = 0;
      }

      const poll = setInterval(async () => {
        if (closed) return clearInterval(poll);
        try {
          const len = await redis.llen(CHANNEL_LOG_KEY);
          if (len > lastLen) {
            const fresh = await redis.lrange(
              CHANNEL_LOG_KEY,
              0,
              len - lastLen - 1,
            );
            for (const item of fresh.reverse()) {
              const parsed =
                typeof item === "string" ? safeParse(item) : item;
              if (parsed) send(parsed);
            }
            lastLen = len;
          } else {
            controller.enqueue(encoder.encode(`: keep-alive\n\n`));
          }
        } catch {
          /* transient Redis error — next tick retries */
        }
      }, 2000);
    },
    cancel() {
      closed = true;
    },
  });

  return new NextResponse(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
