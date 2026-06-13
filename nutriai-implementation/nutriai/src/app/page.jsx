import { SignedIn, SignedOut, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import NewsletterForm from "./NewsletterForm";
import LandingScripts from "./LandingScripts";

const TICKER_FOODS = [
  "Egusi soup","Jollof rice","Pounded yam","Suya","Moi moi","Banga soup","Ofada rice","Efo riro",
  "Akara","Ogi / Pap","Ogbono soup","Abacha","Boli","Eba","Amala","Tuwo shinkafa","Zobo","Kunu","Chin chin","Kilishi",
];

const CLOUD_FOODS = [
  "Egusi soup","Jollof rice","Pounded yam","Suya","Moi moi","Banga soup","Ofada rice","Efo riro","Akara","Ogi",
  "Ogbono","Abacha","Boli","Eba","Amala","Tuwo","Zobo","Kunu","Catfish pepper soup","Oha soup",
  "Edikaikong","Afang soup","Buka stew","Fried plantain","Beans porridge","Yam porridge","Agidi","Ogi baba",
  "Kilishi","Smoked titus","Nkwobi","Ofe onugbu","White soup","Okra soup","Groundnut soup","Vegetable soup",
  "Ugu soup","Millet pap","Semo","Starch",
];

const Check = () => (
  <svg viewBox="0 0 12 12" fill="none" strokeWidth="2" strokeLinecap="round">
    <polyline points="2,6 5,9 10,3" />
  </svg>
);

export default function HomePage() {
  return (
    <>
      <nav className="landing-nav" id="main-nav">
        <Link className="nav-logo" href="/">
          <div className="nav-logo-mark">N</div>
          <span className="nav-logo-name">NutriAI</span>
        </Link>
        <ul className="nav-links">
          <li><a href="#snap">How it works</a></li>
          <li><a href="#personas">For you</a></li>
          <li><a href="#pricing">Pricing</a></li>
        </ul>
        <div className="nav-right">
          <SignedOut>
            <SignInButton mode="modal">
              <button className="nav-ghost">Sign in</button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button className="nav-cta">Get started</button>
            </SignUpButton>
          </SignedOut>
          <SignedIn>
            <Link href="/dashboard" className="nav-ghost">Dashboard</Link>
            <UserButton afterSignOutUrl="/" />
          </SignedIn>
        </div>
      </nav>

      {/* HERO */}
      <section id="hero">
        <div className="hero-inner">
          <div className="hero-left">
            <div className="hero-eyebrow"><span /> Nigeria's first AI nutrition partner</div>
            <h1 className="hero-headline">
              Eat well.<br />
              <span className="accent">Actually</span> eat well.
            </h1>
            <p className="hero-sub">
              NutriAI knows egusi soup, not kale salads. Clinically intelligent nutrition built for Nigerian bodies, budgets, and hormones.
            </p>
            <div className="hero-actions">
              <SignedOut>
                <SignUpButton mode="modal">
                  <button className="btn-primary">Get started free</button>
                </SignUpButton>
              </SignedOut>
              <SignedIn>
                <Link href="/dashboard" className="btn-primary">Open dashboard</Link>
              </SignedIn>
              <a href="#snap" className="btn-ghost">See how it works</a>
            </div>
            <div className="ticker-wrap">
              <div className="ticker">
                {[...TICKER_FOODS, ...TICKER_FOODS, ...TICKER_FOODS, ...TICKER_FOODS].map((f, i) => (
                  <span className="ticker-item" key={i}>{f}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="hero-phone-wrap">
            <div className="phone-frame">
              <div className="phone-notch" />
              <div className="phone-screen">
                <div className="phone-glow" />
                <div className="phone-screen-header">
                  <span className="ps-title">Today's plan</span>
                  <span className="ps-date">Thursday</span>
                </div>
                <div className="macro-row">
                  <div className="macro-pill"><div className="macro-val">1,840</div><div className="macro-label">Calories</div></div>
                  <div className="macro-pill"><div className="macro-val">94g</div><div className="macro-label">Protein</div></div>
                  <div className="macro-pill"><div className="macro-val">₦1,200</div><div className="macro-label">Cost</div></div>
                </div>
                <div className="meal-list">
                  <div className="meal-item"><div className="meal-dot" style={{ background: "#A8E063" }} /><span className="meal-name">Pap with akara</span><span className="meal-kcal">380 kcal</span></div>
                  <div className="meal-item"><div className="meal-dot" style={{ background: "#E8651A" }} /><span className="meal-name">Egusi soup + eba</span><span className="meal-kcal">620 kcal</span></div>
                  <div className="meal-item"><div className="meal-dot" style={{ background: "#A8E063" }} /><span className="meal-name">Grilled titus + rice</span><span className="meal-kcal">540 kcal</span></div>
                  <div className="meal-item"><div className="meal-dot" style={{ background: "#6B7E67" }} /><span className="meal-name">Zobo + groundnuts</span><span className="meal-kcal">300 kcal</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* STATS */}
      <section id="stats">
        <div className="stats-inner">
          <div className="stat-block reveal">
            <div className="stat-num"><span className="stat-accent" data-target="38">0</span>%</div>
            <div className="stat-desc">of Nigerian adults live with hypertension. No Nigerian app addresses it.</div>
          </div>
          <div className="stat-block reveal reveal-delay-1">
            <div className="stat-num"><span style={{ color: "var(--suya)" }}>&lt;</span><span data-target="50">0</span></div>
            <div className="stat-desc">Nigerian foods in MyFitnessPal. NutriAI has over 2,000.</div>
          </div>
          <div className="stat-block reveal reveal-delay-2">
            <div className="stat-num"><span className="stat-accent" data-target="67">0</span>%</div>
            <div className="stat-desc">of pregnant Nigerian women have anemia. Nutrition is the intervention.</div>
          </div>
        </div>
      </section>

      {/* FEATURE 1: SNAP & SCAN */}
      <section className="feature-section" id="snap">
        <div className="feature-inner">
          <div className="reveal">
            <div className="feature-tag">Snap &amp; Scan</div>
            <h2 className="feature-headline">Point. Shoot.<br />Logged.</h2>
            <p className="feature-body">Photograph any Nigerian dish and NutriAI identifies it instantly — full macros, micros, glycemic index. No more approximating jollof rice as "tomato rice."</p>
            <div className="feature-points">
              <div className="fp"><div className="fp-dot"><Check /></div><span className="fp-text">Trained on 200+ Nigerian dish categories — Buka portions vs home-cooked</span></div>
              <div className="fp"><div className="fp-dot"><Check /></div><span className="fp-text">Logs in under 3 seconds. No manual entry, no database searching</span></div>
              <div className="fp"><div className="fp-dot"><Check /></div><span className="fp-text">Powered by Gemini Vision with Nigerian food grounding</span></div>
            </div>
          </div>
          <div className="reveal reveal-delay-1" style={{ display: "flex", justifyContent: "center" }}>
            <div className="feat-phone">
              <div className="feat-notch" />
              <div className="feat-screen">
                <div className="scan-viewfinder">
                  <div className="scan-corner sc-tl" /><div className="scan-corner sc-tr" />
                  <div className="scan-corner sc-bl" /><div className="scan-corner sc-br" />
                  <div className="scan-line" />
                  <span className="scan-label-inner">Scanning dish…</span>
                </div>
                <div className="scan-result">
                  <div className="scan-dish">Egusi soup + pounded yam</div>
                  <div className="scan-macros">
                    <span className="scan-macro">Cal: <span>687</span></span>
                    <span className="scan-macro">Carbs: <span>82g</span></span>
                    <span className="scan-macro">Protein: <span>24g</span></span>
                    <span className="scan-macro">Fat: <span>28g</span></span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURE 2: CYCLE SYNC */}
      <section className="feature-section light" id="cycle">
        <div className="feature-inner reverse">
          <div className="reveal">
            <div className="feature-tag">Cycle sync</div>
            <h2 className="feature-headline">Your hormones<br />change. Your meals<br />should too.</h2>
            <p className="feature-body">The first African nutrition app to adapt your meal plan to your menstrual cycle — four phases, four nutrition strategies, all built around Nigerian food.</p>
            <div className="feature-points">
              <div className="fp"><div className="fp-dot"><Check /></div><span className="fp-text">Menstrual phase: iron-rich ugu soup and zobo to combat blood loss</span></div>
              <div className="fp"><div className="fp-dot"><Check /></div><span className="fp-text">Luteal phase: magnesium-rich plantain and groundnut soup for PMS</span></div>
              <div className="fp"><div className="fp-dot"><Check /></div><span className="fp-text">PCOS-specific protocol targeting insulin sensitivity throughout the month</span></div>
            </div>
          </div>
          <div className="reveal reveal-delay-1" style={{ display: "flex", justifyContent: "center" }}>
            <div className="feat-phone">
              <div className="feat-notch" />
              <div className="feat-screen" style={{ background: "#f9f5ec" }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#2C3A2A", marginBottom: 10 }}>Cycle nutrition · Day 18</div>
                <div className="cycle-phases">
                  <div className="phase-pill inactive">Mens.</div>
                  <div className="phase-pill inactive">Follic.</div>
                  <div className="phase-pill inactive">Ovul.</div>
                  <div className="phase-pill active" style={{ background: "#0D1F0F", color: "#A8E063" }}>Luteal</div>
                </div>
                <div style={{ fontSize: 10, color: "#6B7E67", marginBottom: 10 }}>Focus: magnesium · complex carbs · mood</div>
                <div className="cycle-rec">
                  <div className="cycle-food" style={{ background: "#e8e2d8", borderColor: "rgba(44,58,42,0.12)" }}>
                    <span className="cf-icon">🍌</span>
                    <div className="cf-text">
                      <div className="cf-name" style={{ color: "#0D1F0F" }}>Ripe plantain</div>
                      <div className="cf-reason">Magnesium for PMS relief</div>
                    </div>
                    <span className="cf-badge" style={{ background: "rgba(13,31,15,0.08)", color: "#3B6D11" }}>+Mg</span>
                  </div>
                  <div className="cycle-food" style={{ background: "#e8e2d8", borderColor: "rgba(44,58,42,0.12)" }}>
                    <span className="cf-icon">🥜</span>
                    <div className="cf-text">
                      <div className="cf-name" style={{ color: "#0D1F0F" }}>Groundnut soup</div>
                      <div className="cf-reason">B-vitamins for mood support</div>
                    </div>
                    <span className="cf-badge" style={{ background: "rgba(13,31,15,0.08)", color: "#3B6D11" }}>+B6</span>
                  </div>
                  <div className="cycle-food" style={{ background: "#e8e2d8", borderColor: "rgba(44,58,42,0.12)" }}>
                    <span className="cf-icon">🌾</span>
                    <div className="cf-text">
                      <div className="cf-name" style={{ color: "#0D1F0F" }}>Pap with milk</div>
                      <div className="cf-reason">Tryptophan → serotonin</div>
                    </div>
                    <span className="cf-badge" style={{ background: "rgba(13,31,15,0.08)", color: "#3B6D11" }}>+Mood</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURE 3: BUDGET */}
      <section className="feature-section" id="budget">
        <div className="feature-inner">
          <div className="reveal">
            <div className="feature-tag">Budget intelligence</div>
            <h2 className="feature-headline">₦15,000 a month.<br />Still eating well.</h2>
            <p className="feature-body">NutriAI treats your budget as a clinical input, not an afterthought. Every meal plan is costed in real-time. If something is out of reach, a clinically equivalent substitute appears automatically.</p>
            <div className="feature-points">
              <div className="fp"><div className="fp-dot"><Check /></div><span className="fp-text">Real-time pricing via market data — not guesswork</span></div>
              <div className="fp"><div className="fp-dot"><Check /></div><span className="fp-text">Smart substitutes maintain clinical targets within any budget</span></div>
              <div className="fp"><div className="fp-dot"><Check /></div><span className="fp-text">Family planner for up to 12 — one shopping list, multiple health profiles</span></div>
            </div>
          </div>
          <div className="reveal reveal-delay-1" style={{ display: "flex", justifyContent: "center" }}>
            <div className="feat-phone">
              <div className="feat-notch" />
              <div className="feat-screen">
                <div className="budget-header">
                  <div className="budget-label">Weekly food budget</div>
                  <div className="budget-val">₦3,500</div>
                </div>
                <div className="budget-bar-wrap"><div className="budget-bar-fill" /></div>
                <div style={{ fontSize: 9, color: "var(--muted)", marginBottom: 12 }}>₦2,180 spent · ₦1,320 remaining</div>
                <div className="budget-meals">
                  <div className="budget-meal"><span className="bm-name">Akara + ogi (breakfast)</span><span className="bm-cost">₦280</span></div>
                  <div className="budget-meal"><span className="bm-name">Beans + plantain</span><span className="bm-cost">₦420</span></div>
                  <div className="budget-meal"><span className="bm-name">Ofada rice + stew</span><span className="bm-cost">₦650</span></div>
                  <div className="budget-meal" style={{ borderColor: "rgba(168,224,99,0.35)" }}>
                    <span className="bm-name" style={{ color: "var(--vitality)" }}>↳ Substitute available</span>
                    <span className="bm-cost" style={{ color: "var(--muted)" }}>−₦180</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PERSONAS */}
      <section id="personas">
        <div className="personas-inner">
          <div className="section-eyebrow reveal">Built for everyone</div>
          <h2 className="section-title reveal reveal-delay-1">One app. Every Nigerian body.</h2>
          <div className="persona-grid">
            <div className="persona-card reveal"><div className="persona-avatar">👩‍🎓</div><div className="persona-name">The student</div><div className="persona-need">₦15,000/month budget</div><span className="persona-tag">Budget optimizer</span></div>
            <div className="persona-card reveal reveal-delay-1"><div className="persona-avatar">🌸</div><div className="persona-name">PCOS management</div><div className="persona-need">Insulin sensitivity</div><span className="persona-tag">Cycle + clinical</span></div>
            <div className="persona-card reveal reveal-delay-2"><div className="persona-avatar">🤰</div><div className="persona-name">Expecting mother</div><div className="persona-need">Folate, iron, DHA</div><span className="persona-tag">Trimester plans</span></div>
            <div className="persona-card reveal reveal-delay-1"><div className="persona-avatar">❤️‍🩹</div><div className="persona-name">Hypertension</div><div className="persona-need">Sodium control</div><span className="persona-tag">DASH adapted</span></div>
            <div className="persona-card reveal reveal-delay-2"><div className="persona-avatar">💪</div><div className="persona-name">The athlete</div><div className="persona-need">Protein surplus</div><span className="persona-tag">Local protein</span></div>
          </div>
        </div>
      </section>

      {/* FOOD DB */}
      <section id="fooddb">
        <div className="fooddb-inner">
          <div className="fooddb-eyebrow reveal">The database</div>
          <h2 className="fooddb-title reveal reveal-delay-1">
            <span className="num" data-target="2000" data-suffix="+">0</span> Nigerian foods.<br />Zero approximations.
          </h2>
          <p className="fooddb-sub reveal reveal-delay-2">Every macro, micro, glycemic load, and preparation variant — boiled, fried, smoked, fermented. If Nigerians eat it, we know it.</p>
          <div className="food-cloud reveal reveal-delay-2" id="food-cloud">
            {CLOUD_FOODS.map((f, i) => (
              <span className="food-tag" key={i}>{f}</span>
            ))}
          </div>
        </div>
      </section>

      {/* CLINICAL */}
      <section id="clinical">
        <div className="clinical-inner">
          <div className="clinical-label reveal">Clinically validated</div>
          <div className="partners-row reveal reveal-delay-1">
            <div className="partner-badge">SOGON</div>
            <div className="partner-badge">Diabetes Association of Nigeria</div>
            <div className="partner-badge">Nigerian Hypertension Society</div>
            <div className="partner-badge">NPHCDA</div>
            <div className="partner-badge">RDN — Registered Dietitians Nigeria</div>
          </div>
          <p className="pullquote reveal reveal-delay-2">"For the first time, a nutrition tool speaks to my patients in food they actually cook. This is what clinical dietary support should look like in Nigeria."</p>
          <p className="pullquote-attr reveal reveal-delay-2">— Registered Dietitian, University College Hospital, Ibadan</p>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing">
        <div className="pricing-inner">
          <h2 className="pricing-title reveal">Simple, honest pricing.</h2>
          <div className="pricing-grid">
            <div className="price-card reveal">
              <div className="price-tier">Free</div>
              <div className="price-amount">₦0</div>
              <div className="price-period">forever</div>
              <ul className="price-features">
                <li>Nigerian food tracker (2,000+ foods)</li>
                <li>Basic meal logging</li>
                <li>Daily calorie + macro view</li>
                <li>7-day meal plan (standard)</li>
                <li>Snap &amp; Scan (5 per day)</li>
              </ul>
              <SignedOut>
                <SignUpButton mode="modal">
                  <button className="price-btn free">Get started free</button>
                </SignUpButton>
              </SignedOut>
              <SignedIn>
                <Link href="/dashboard" className="price-btn free" style={{ textAlign: "center", display: "block", textDecoration: "none" }}>Open dashboard</Link>
              </SignedIn>
            </div>
            <div className="price-card premium reveal reveal-delay-1">
              <div className="price-tier">Premium</div>
              <div className="price-amount">₦1,500</div>
              <div className="price-period">per month · via OPay</div>
              <ul className="price-features">
                <li>Everything in Free</li>
                <li>Unlimited Snap &amp; Scan</li>
                <li>Cycle-synced nutrition</li>
                <li>Clinical protocols (PCOS, diabetes, hypertension)</li>
                <li>Budget optimizer + smart substitutes</li>
                <li>Family household planner (up to 12)</li>
                <li>AI nutritionist chat (Pidgin, Yoruba, Igbo, Hausa)</li>
                <li>NutriRewards — earn back 15% monthly</li>
              </ul>
              <button className="price-btn paid">Start premium</button>
            </div>
          </div>
          <div className="opay-note reveal">
            <span>Payments processed seamlessly through</span>
            <span className="opay-badge">OPay</span>
            <span>— no card friction</span>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section id="final-cta">
        <div className="cta-inner">
          <h2 className="cta-headline reveal">Your body deserves better than a <span className="accent">kale salad.</span></h2>
          <p className="cta-sub reveal reveal-delay-1">Join the newsletter. Be among the first Nigerians to eat with genuine clinical intelligence — built around the food you actually eat.</p>
          <div className="reveal reveal-delay-2">
            <NewsletterForm />
          </div>
          <p className="cta-note reveal reveal-delay-2">No spam. We'll notify you when NutriAI launches.</p>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="landing-footer">
        <div className="footer-inner">
          <Link className="footer-logo" href="/">
            <div className="footer-logo-mark">N</div>
            <span className="footer-logo-name">NutriAI</span>
          </Link>
          <span className="footer-tagline">Built for Nigerian bodies. Priced for Nigerian budgets. Powered by OPay.</span>
          <ul className="footer-links">
            <li><a href="#">Privacy</a></li>
            <li><a href="#">Terms</a></li>
            <li><a href="#">Contact</a></li>
          </ul>
        </div>
      </footer>

      <LandingScripts />
    </>
  );
}
