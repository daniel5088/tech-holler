import { NextResponse } from "next/server";
import { supabaseConfigured } from "@/lib/env";
import { normalizeEmail, subscribeEmail } from "@/lib/newsletter";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { email?: unknown; website?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  // Honeypot: a hidden field real readers never fill. Pretend success for bots.
  if (typeof body.website === "string" && body.website.trim() !== "") {
    return NextResponse.json({ status: "subscribed", message: "You're in." });
  }

  const email = typeof body.email === "string" ? normalizeEmail(body.email) : null;
  if (!email) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  if (!supabaseConfigured) {
    return NextResponse.json({ error: "The newsletter isn't switched on yet." }, { status: 503 });
  }

  try {
    const result = await subscribeEmail(email, "site");
    const message =
      result === "already-subscribed"
        ? "You're already on the list — much obliged."
        : "You're in. Watch your inbox for the next holler.";
    return NextResponse.json({ status: result, message });
  } catch (error) {
    console.error("Newsletter subscribe failed:", error);
    return NextResponse.json(
      { error: "Could not sign you up right now. Try again shortly." },
      { status: 500 },
    );
  }
}
