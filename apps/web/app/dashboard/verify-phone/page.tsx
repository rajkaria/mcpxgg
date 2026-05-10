import { Card, CardTitle, CardDescription } from "@/components/ui/card";
import { PhoneVerifyForm } from "@/components/auth/phone-verify-form";

export default function VerifyPhonePage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-[var(--text)]">Phone Verification</h1>
      <p className="mt-1 text-sm text-[var(--text-secondary)]">
        Verify your phone number to use MCP tools
      </p>

      <Card className="mt-6 max-w-md">
        <CardTitle>Verify your phone</CardTitle>
        <CardDescription>
          Phone verification is required before you can make tool calls through the MCP gateway.
        </CardDescription>
        <div className="mt-4">
          <PhoneVerifyForm />
        </div>
      </Card>
    </div>
  );
}
