import { useEffect } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/**
 * Master GSAP scroll animation hook.
 * Call once at the App level — registers all ScrollTriggers globally.
 *
 * Architecture:
 *  - Hero: staggered entrance + food ticker
 *  - Feature sections: scroll-pinned with phone screen state machine
 *  - Stats bar: count-up on entry
 *  - Persona / food cloud: staggered fade-in
 *  - Food tags: random glow loop
 */
export function useScrollAnimations() {
  useEffect(() => {
    // Small delay so DOM is fully painted before GSAP measures
    const ctx = gsap.context(() => {
      // ── 1. HERO entrance ──────────────────────────────────────────
      const heroTl = gsap.timeline({ delay: 0.1 });
      heroTl
        .from(".hero-eyebrow", {
          opacity: 0, y: 20, duration: 0.7, ease: "power3.out",
        })
        .from(".hero-headline", {
          opacity: 0, y: 30, duration: 0.8, ease: "power3.out",
        }, "-=0.4")
        .from(".hero-sub", {
          opacity: 0, y: 20, duration: 0.7, ease: "power3.out",
        }, "-=0.5")
        .from(".hero-actions", {
          opacity: 0, y: 16, duration: 0.6, ease: "power3.out",
        }, "-=0.4")
        .from(".phone-frame", {
          opacity: 0, y: 40, scale: 0.96, duration: 1, ease: "power3.out",
        }, "-=0.6");

      // ── 2. STATS bar — count-up ───────────────────────────────────
      ScrollTrigger.create({
        trigger: "#stats",
        start: "top 75%",
        once: true,
        onEnter: () => {
          document.querySelectorAll("[data-count-target]").forEach((el) => {
            const target = parseInt(el.dataset.countTarget, 10);
            const suffix = el.dataset.countSuffix || "";
            gsap.to({ val: 0 }, {
              val: target,
              duration: 1.6,
              ease: "power2.out",
              onUpdate() {
                el.textContent = Math.round(this.targets()[0].val).toLocaleString() + suffix;
              },
            });
          });
          // Reveal stat blocks
          gsap.from(".stat-block", {
            opacity: 0, y: 24, stagger: 0.15, duration: 0.7, ease: "power3.out",
          });
        },
      });

      // ── 3. FEATURE SECTIONS — scroll-pinned ──────────────────────
      // Each .feature-section gets pinned for 150vh of scroll distance.
      // Inside the pin, a timeline handles:
      //   a) left copy fade-in
      //   b) phone screen state transition
      //   c) feature points stagger
      document.querySelectorAll(".feature-section").forEach((section) => {
        const copy       = section.querySelector(".feature-copy");
        const phoneWrap  = section.querySelector(".feature-phone-wrap");
        const points     = section.querySelectorAll(".fp");
        const screenOut  = section.querySelector(".phone-screen-state-out");
        const screenIn   = section.querySelector(".phone-screen-state-in");

        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: section,
            start: "top top",
            end: "+=150%",
            pin: true,
            scrub: 0.8,
            anticipatePin: 1,
          },
        });

        // Copy entrance
        tl.from(copy, { opacity: 0, x: -40, duration: 0.4, ease: "power3.out" }, 0)
          // Phone entrance
          .from(phoneWrap, { opacity: 0, y: 30, scale: 0.97, duration: 0.4, ease: "power3.out" }, 0.05)
          // Screen cross-dissolve (out → in)
          .to(screenOut,  { opacity: 0, duration: 0.15, ease: "none" }, 0.2)
          .from(screenIn, { opacity: 0, duration: 0.2, ease: "none" }, 0.3)
          // Feature points stagger in
          .from(points,   { opacity: 0, x: -16, stagger: 0.08, duration: 0.25, ease: "power2.out" }, 0.35);
      });

      // ── 4. WHO IT'S FOR — persona cards ──────────────────────────
      ScrollTrigger.create({
        trigger: "#personas",
        start: "top 70%",
        once: true,
        onEnter: () => {
          gsap.from(".persona-card", {
            opacity: 0, y: 32, scale: 0.97,
            stagger: 0.08, duration: 0.6, ease: "power3.out",
          });
        },
      });

      // ── 5. FOOD DATABASE — tag cloud stagger ─────────────────────
      ScrollTrigger.create({
        trigger: "#fooddb",
        start: "top 65%",
        once: true,
        onEnter: () => {
          gsap.from(".food-tag", {
            opacity: 0, scale: 0.85,
            stagger: { amount: 1.2, from: "random" },
            duration: 0.45, ease: "back.out(1.4)",
          });
          // Count-up for "2,000+" headline
          const numEl = document.querySelector("[data-count-target='2000']");
          if (numEl) {
            gsap.to({ val: 0 }, {
              val: 2000,
              duration: 1.8,
              ease: "power2.out",
              onUpdate() {
                numEl.textContent = Math.round(this.targets()[0].val).toLocaleString() + "+";
              },
            });
          }
        },
      });

      // ── 6. RANDOM FOOD TAG glow loop ─────────────────────────────
      const foodTags = document.querySelectorAll(".food-tag");
      if (foodTags.length) {
        function litLoop() {
          foodTags.forEach((t) => t.classList.remove("lit"));
          const picks = [...foodTags].sort(() => Math.random() - 0.5).slice(0, 6);
          picks.forEach((p) => p.classList.add("lit"));
          gsap.delayedCall(1.8, litLoop);
        }
        ScrollTrigger.create({
          trigger: "#fooddb",
          start: "top 80%",
          once: true,
          onEnter: litLoop,
        });
      }

      // ── 7. GENERIC reveal for sections without custom logic ───────
      gsap.utils.toArray(".reveal-on-scroll").forEach((el) => {
        gsap.from(el, {
          opacity: 0, y: 28, duration: 0.7, ease: "power3.out",
          scrollTrigger: {
            trigger: el,
            start: "top 80%",
            once: true,
          },
        });
      });

      // ── 8. NAV — transparent → filled on scroll ───────────────────
      ScrollTrigger.create({
        start: "top -40",
        onUpdate: (self) => {
          const nav = document.getElementById("main-nav");
          if (nav) nav.classList.toggle("scrolled", self.scroll() > 40);
        },
      });

      // ── 9. FINAL CTA — headline split entrance ────────────────────
      ScrollTrigger.create({
        trigger: "#final-cta",
        start: "top 70%",
        once: true,
        onEnter: () => {
          gsap.from(".cta-headline", {
            opacity: 0, y: 32, duration: 0.8, ease: "power3.out",
          });
          gsap.from(".cta-sub, .waitlist-form, .cta-note", {
            opacity: 0, y: 20, stagger: 0.12, duration: 0.6, ease: "power3.out", delay: 0.2,
          });
        },
      });
    });

    return () => {
      ctx.revert(); // Kills all ScrollTriggers and tweens on unmount
    };
  }, []);
}
