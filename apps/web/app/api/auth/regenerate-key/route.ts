import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateApiKey } from "@/lib/utils/api-key";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const newKey = generateApiKey();
  const admin = createAdminClient();

  const { error } = await admin
    .from("users")
    .update({ api_key: newKey })
    .eq("id", user.id);

  if (error) {
    return NextResponse.json({ error: "Failed to regenerate key" }, { status: 500 });
  }

  return NextResponse.json({ api_key: newKey });
}
