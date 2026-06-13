import { auth, currentUser } from "@clerk/nextjs/server";
import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import Dashboard from "./Dashboard";

export default async function DashboardPage() {
  auth().protect();
  const user = await currentUser();
  const name = user?.firstName || user?.username || "there";

  return (
    <>
      <nav className="nav">
        <div className="nav-inner">
          <Link href="/" className="logo">
            <span className="logo-mark">N</span>
            <span>NutriAI</span>
          </Link>
          <div className="nav-actions">
            <UserButton afterSignOutUrl="/" />
          </div>
        </div>
      </nav>

      <div className="dash-wrap">
        <h1 style={{ fontSize: 32, fontWeight: 800 }}>Welcome, {name}.</h1>
        <p style={{ color: "var(--muted)", marginTop: 8 }}>
          Try the four NutriAI features below. Add <code>GEMINI_API_KEY</code> to <code>.env.local</code> to enable real responses.
        </p>
        <Dashboard defaultName={name} />
      </div>
    </>
  );
}
