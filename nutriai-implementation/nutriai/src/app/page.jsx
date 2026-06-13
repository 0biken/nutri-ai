import { SignedIn, SignedOut, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import NewsletterForm from "./NewsletterForm";

export default function HomePage() {
  return (
    <>
      <nav className="nav">
        <div className="nav-inner">
          <Link href="/" className="logo">
            <span className="logo-mark">N</span>
            <span>NutriAI</span>
          </Link>
          <div className="nav-actions">
            <SignedOut>
              <SignInButton mode="modal">
                <button className="btn">Sign in</button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button className="btn btn-primary">Get started</button>
              </SignUpButton>
            </SignedOut>
            <SignedIn>
              <Link href="/dashboard" className="btn">Dashboard</Link>
              <UserButton afterSignOutUrl="/" />
            </SignedIn>
          </div>
        </div>
      </nav>

      <header className="hero">
        <h1>
          Your body deserves better than a <span className="accent">kale salad.</span>
        </h1>
        <p>
          NutriAI is Nigeria's first clinically intelligent nutrition platform — built around the food you actually eat.
          Snap your meals, get a weekly plan tuned to your conditions and budget, and chat with an AI nutritionist in your language.
        </p>
      </header>

      <section className="section">
        <div className="container">
          <h2>Four ways NutriAI helps</h2>
          <p className="sub">Vision, planning, conversation, and substitution — all grounded in Nigerian foods.</p>
          <div className="feature-grid">
            <div className="feature-card">
              <h3>Snap &amp; Scan</h3>
              <p>Photograph your plate. Get the dish identified, macros calculated, and clinical flags for your conditions.</p>
            </div>
            <div className="feature-card">
              <h3>Meal Planner</h3>
              <p>A 7-day plan respecting your weekly Naira budget, clinical needs, and cycle phase. Shopping list included.</p>
            </div>
            <div className="feature-card">
              <h3>Nourish Chat</h3>
              <p>Ask anything in English, Pidgin, Yoruba, Igbo, or Hausa. Grounded in clinical protocols and Nigerian food data.</p>
            </div>
            <div className="feature-card">
              <h3>Smart Substitutes</h3>
              <p>Can't find or afford an ingredient? Get a clinically equivalent swap, with the price-and-nutrition logic explained.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="final-cta">
        <h2>
          Built for Nigerian bodies. <span className="accent">Priced for Nigerian budgets.</span>
        </h2>
        <p>Subscribe to the NutriAI newsletter for product updates, food intelligence, and early access invites.</p>
        <NewsletterForm />
        <p className="newsletter-note">No spam. Unsubscribe any time.</p>
      </section>

      <footer>
        Built for Nigerian bodies. Priced for Nigerian budgets. Powered by OPay.
      </footer>
    </>
  );
}
