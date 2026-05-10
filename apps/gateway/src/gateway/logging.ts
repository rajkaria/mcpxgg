import { createAdminClient } from "@/lib/supabase/admin";

export interface LogRequestParams {
  userId: string;
  serverId?: string;
  toolId?: string;
  toolName: string;
  namespace: string;
  creditCost: number;
  latencyMs: number;
  status: "success" | "error" | "timeout" | "refunded";
  errorMessage?: string;
  requestMeta?: Record<string, unknown>;
  responseMeta?: Record<string, unknown>;
}

/**
 * Inserts a record into the request_log table.
 * Non-blocking: fires and forgets. Errors are caught and logged to console.
 */
export function logRequest(params: LogRequestParams): void {
  // Fire and forget — don't await
  _insertLog(params).catch((err) => {
    console.error("[gateway/logging] Failed to log request:", err);
  });
}

async function _insertLog(params: LogRequestParams): Promise<void> {
  const supabase = createAdminClient();

  const { error } = await supabase.from("request_log").insert({
    user_id: params.userId,
    server_id: params.serverId || null,
    tool_id: params.toolId || null,
    tool_name: params.toolName,
    namespace: params.namespace,
    credit_cost: params.creditCost,
    latency_ms: params.latencyMs,
    status: params.status,
    error_message: params.errorMessage || null,
    request_meta: params.requestMeta || {},
    response_meta: params.responseMeta || {},
  } as any);

  if (error) {
    console.error("[gateway/logging] Supabase insert error:", error);
  }
}
