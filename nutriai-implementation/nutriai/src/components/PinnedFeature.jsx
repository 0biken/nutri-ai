import { useRef, useEffect } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/**
 * PinnedFeature — alma.food-style scroll-pinned section.
 *
 * The section pins for `pinDuration` vh of scroll.
 * During that scroll distance, a GSAP timeline runs:
 *   0.0 – 0.3  : copy + phone enter
 *   0.3 – 0.55 : phone screen dissolves to active state
 *   0.55 – 0.85: feature points stagger in
 *   0.85 – 1.0 : hold, then unpin + section exits upward
 *
 * Props:
 *   tag         string   — e.g. "Snap & Scan"
 *   headline    string   — section headline
 *   body        string   — paragraph copy
 *   points      string[] — bullet points
 *   phoneIdle   ReactNode — phone screen before interaction
 *   phoneActive ReactNode — phone screen during/after interaction
 *   dark        bool     — dark bg (default) or light
 *   reverse     bool     — phone on left, copy on right
 *   pinDuration number   — scroll distance in vh (default 150)
 */
export function PinnedFeature({
  tag,
  headline,
  body,
  points = [],
  phoneIdle,
  phoneActive,
  dark = true,
  reverse = false,
  pinDuration = 150,
  id,
}) {
  const sectionRef  = useRef(null);
  const copyRef     = useRef(null);
  const phoneRef    = useRef(null);
  const idleRef     = useRef(null);
  const activeRef   = useRef(null);
  const pointsRef   = useRef(null);
  const tlRef       = useRef(null);

  useEffect(() => {
    const section  = sectionRef.current;
    const copy     = copyRef.current;
    const phone    = phoneRef.current;
    const idle     = idleRef.current;
    const active   = activeRef.current;
    const ptEls    = pointsRef.current?.querySelectorAll(".fp");

    // Set initial states
    gsap.set([copy, phone], { opacity: 0 });
    gsap.set(active, { opacity: 0 });
    if (ptEls) gsap.set(ptEls, { opacity: 0, x: -18 });

    tlRef.current = gsap.timeline({
      scrollTrigger: {
        trigger: section,
        start: "top top",
        end: `+=${pinDuration}%`,
        pin: true,
        scrub: 0.9,
        anticipatePin: 1,
        // Uncomment to debug scroll positions:
        // markers: process.env.NODE_ENV === "development",
      },
    });

    const tl = tlRef.current;

    // ── Phase 1: copy + phone enter ────────────────────────────────
    tl.to(copy,  { opacity: 1, x: 0, duration: 0.3, ease: "power3.out" }, 0)
      .fromTo(
        phone,
        { opacity: 0, y: 30, scale: 0.97 },
        { opacity: 1, y: 0,  scale: 1, duration: 0.35, ease: "power3.out" },
        0.05
      );

    // ── Phase 2: phone screen dissolve idle → active ───────────────
    tl.to(idle,   { opacity: 0, duration: 0.18 }, 0.3)
      .to(active, { opacity: 1, duration: 0.22 }, 0.38);

    // ── Phase 3: feature points stagger ───────────────────────────
    if (ptEls?.length) {
      tl.to(ptEls, {
        opacity: 1, x: 0,
        stagger: 0.07,
        duration: 0.2,
        ease: "power2.out",
      }, 0.55);
    }

    // ── Phase 4: hold at full state ────────────────────────────────
    tl.to({}, { duration: 0.3 }, 0.85);

    return () => {
      tl.scrollTrigger?.kill();
      tl.kill();
    };
  }, [pinDuration]);

  const bg  = dark ? "var(--forest)"     : "var(--warm-white)";
  const dir = reverse ? "row-reverse"    : "row";

  return (
    <section
      ref={sectionRef}
      id={id}
      style={{
        background: bg,
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        padding: "0 5%",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: dir,
          gap: 80,
          alignItems: "center",
          maxWidth: 1100,
          margin: "0 auto",
          width: "100%",
        }}
      >
        {/* ── Copy ──────────────────────────────────────────────── */}
        <div ref={copyRef} style={{ flex: 1 }}>
          <span className={`feature-tag ${dark ? "" : "feature-tag--light"}`}>
            {tag}
          </span>
          <h2 className={`feature-headline ${dark ? "" : "feature-headline--light"}`}>
            {headline}
          </h2>
          <p className={`feature-body ${dark ? "" : "feature-body--light"}`}>
            {body}
          </p>

          <div ref={pointsRef} className="feature-points">
            {points.map((pt, i) => (
              <div key={i} className="fp">
                <div className={`fp-dot ${dark ? "" : "fp-dot--light"}`}>
                  <CheckIcon />
                </div>
                <span className={`fp-text ${dark ? "" : "fp-text--light"}`}>
                  {pt}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Phone ─────────────────────────────────────────────── */}
        <div
          ref={phoneRef}
          className="feature-phone-wrap"
          style={{ flexShrink: 0, display: "flex", justifyContent: "center" }}
        >
          <div className={`feat-phone ${dark ? "" : "feat-phone--light"}`}>
            <div className={`feat-notch ${dark ? "" : "feat-notch--light"}`} />
            <div className={`feat-screen ${dark ? "" : "feat-screen--light"}`}>
              {/* Idle state (before scroll reaches this section) */}
              <div ref={idleRef} className="phone-screen-state">
                {phoneIdle}
              </div>
              {/* Active state (revealed during pin) */}
              <div
                ref={activeRef}
                className="phone-screen-state"
                style={{ position: "absolute", top: 0, left: 0, right: 0 }}
              >
                {phoneActive}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      width={10}
      height={10}
    >
      <polyline points="2,6 5,9 10,3" />
    </svg>
  );
}
