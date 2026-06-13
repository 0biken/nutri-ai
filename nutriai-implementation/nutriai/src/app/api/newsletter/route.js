import { NextResponse } from "next/server";

/**
 * Prototype-only: logs signups to the function log (Vercel/console).
 * Swap for a real mailing-list provider (Resend / Mailchimp / ConvertKit / Vercel KV) before launch.
 */
export async function POST(request) {
  try {
    const { email } = await request.json();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Valid email required" }, { status: 400 });
    }
    console.log(JSON.stringify({ event: "newsletter_signup", email, ts: new Date().toISOString() }));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("newsletter error", err);
    return NextResponse.json({ error: "Subscribe failed" }, { status: 500 });
  }
}
