import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { pushConfigured, sendToUser } from "@/lib/push-server";

export const dynamic = "force-dynamic";

/**
 * Sends a test notification to the caller's own devices. The caller is
 * identified by their Supabase access token; only then is the service-role
 * client used to read their subscriptions.
 */
export async function POST(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer /, "");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!url || !anon || !serviceKey) {
    return NextResponse.json({ error: "Supabase env not set" }, { status: 500 });
  }
  if (!pushConfigured()) {
    return NextResponse.json({ error: "VAPID keys not set" }, { status: 500 });
  }

  const { data, error } = await createClient(url, anon).auth.getUser(token);
  if (error || !data.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const r = await sendToUser(admin, data.user.id, {
    title: "Avisos activados",
    body: "Te avisaré cuando una posición llegue a su precio objetivo.",
    url: "/",
    tag: "test",
  });
  return NextResponse.json(r);
}
