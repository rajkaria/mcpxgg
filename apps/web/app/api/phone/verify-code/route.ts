import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkVerificationCode } from "@/lib/twilio/verify";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { phoneNumber, code } = body;

  if (!phoneNumber || !code) {
    return NextResponse.json(
      { error: "Phone number and code are required" },
      { status: 400 }
    );
  }

  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json(
      { error: "Code must be 6 digits" },
      { status: 400 }
    );
  }

  try {
    const verification = await checkVerificationCode(phoneNumber, code);

    if (verification.status !== "approved") {
      return NextResponse.json(
        { error: "Invalid verification code" },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    await admin
      .from("users")
      .update({
        phone_number: phoneNumber,
        phone_verified: true,
        phone_verified_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Verification failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
