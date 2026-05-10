import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendVerificationCode } from "@/lib/twilio/verify";

const E164_REGEX = /^\+[1-9]\d{1,14}$/;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { phoneNumber } = body;

  if (!phoneNumber || !E164_REGEX.test(phoneNumber)) {
    return NextResponse.json(
      { error: "Invalid phone number. Use E.164 format (e.g., +14155551234)" },
      { status: 400 }
    );
  }

  try {
    await sendVerificationCode(phoneNumber);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to send code";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
