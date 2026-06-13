import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

/**
 * Prototype-only: appends signups to a local JSON file.
 * Replace with a real mailing list provider (Resend/Mailchimp/ConvertKit) before launch.
 */
const FILE = path.join(process.cwd(), "data", "newsletter.json");

async function load() {
  try {
    return JSON.parse(await fs.readFile(FILE, "utf8"));
  } catch {
    return [];
  }
}

export async function POST(request) {
  try {
    const { email } = await request.json();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Valid email required" }, { status: 400 });
    }
    await fs.mkdir(path.dirname(FILE), { recursive: true });
    const list = await load();
    if (!list.some(e => e.email === email)) {
      list.push({ email, subscribedAt: new Date().toISOString() });
      await fs.writeFile(FILE, JSON.stringify(list, null, 2));
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("newsletter error", err);
    return NextResponse.json({ error: "Subscribe failed" }, { status: 500 });
  }
}
