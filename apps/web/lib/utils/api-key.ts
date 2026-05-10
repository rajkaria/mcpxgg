import { randomBytes } from "crypto";

export function generateApiKey(): string {
  return `mcpx_sk_${randomBytes(24).toString("hex")}`;
}
