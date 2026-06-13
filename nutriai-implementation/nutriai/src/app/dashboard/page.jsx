import { auth, currentUser } from "@clerk/nextjs/server";
import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import Dashboard from "./Dashboard";

export default async function DashboardPage() {
  auth().protect();
  const user = await currentUser();
  const name = user?.firstName || user?.username || "there";

  return (
    <div className="dash-shell">
      <nav className="landing-nav scrolled" style={{ position: "sticky", background: "#fff", borderBottom: "1px solid rgba(13,31,15,0.08)" }}>
        <Link className="nav-logo" href="/">
          <div className="nav-logo-mark">N</div>
          <span className="nav-logo-name" style={{ color: "var(--forest)" }}>NutriAI</span>
        </Link>
        <div className="nav-right">
          <Link href="/" style={{ fontSize: 14, color: "var(--muted)", textDecoration: "none" }}>← Landing</Link>
          <UserButton afterSignOutUrl="/" />
        </div>
      </nav>

      <div className="dash-wrap">
        <h1 style={{ fontSize: 32, fontWeight: 600, letterSpacing: "-0.02em" }}>Welcome, {name}.</h1>
        <p style={{ color: "var(--muted)", marginTop: 8 }}>
          Try the four NutriAI features below. They use Gemini + the Nigerian food stub data.
        </p>
        <Dashboard defaultName={name} />
      </div>
    </div>
  );
}
