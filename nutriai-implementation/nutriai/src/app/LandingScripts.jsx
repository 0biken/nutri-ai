"use client";
import { useEffect } from "react";

export default function LandingScripts() {
  useEffect(() => {
    // ── Nav scroll shadow ─────────────────────────────
    const nav = document.getElementById("main-nav");
    const onScroll = () => {
      if (!nav) return;
      nav.classList.toggle("scrolled", window.scrollY > 40);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    // ── Scroll reveal ─────────────────────────────────
    const reveals = document.querySelectorAll(".reveal");
    const revealObs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("visible");
            revealObs.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12 },
    );
    reveals.forEach((r) => revealObs.observe(r));

    // ── Count-up numbers ──────────────────────────────
    function countUp(el, target, suffix = "") {
      let current = 0;
      const step = Math.max(1, Math.ceil(target / 60));
      const timer = setInterval(() => {
        current = Math.min(current + step, target);
        el.textContent = current.toLocaleString() + suffix;
        if (current >= target) clearInterval(timer);
      }, 24);
    }
    const numObs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          e.target.querySelectorAll("[data-target]").forEach((t) => {
            const val = parseInt(t.getAttribute("data-target"), 10);
            const suffix = t.getAttribute("data-suffix") || "";
            countUp(t, val, suffix);
          });
          numObs.unobserve(e.target);
        });
      },
      { threshold: 0.3 },
    );
    const stats = document.getElementById("stats");
    const fooddb = document.getElementById("fooddb");
    if (stats) numObs.observe(stats);
    if (fooddb) numObs.observe(fooddb);

    // ── Food cloud lit cycle ──────────────────────────
    const cloud = document.getElementById("food-cloud");
    const tags = cloud ? cloud.querySelectorAll(".food-tag") : [];
    let litInterval;
    if (tags.length) {
      litInterval = setInterval(() => {
        tags.forEach((t) => t.classList.remove("lit"));
        const picks = Array.from(tags).sort(() => Math.random() - 0.5).slice(0, 5);
        picks.forEach((p) => p.classList.add("lit"));
      }, 1800);
    }

    return () => {
      window.removeEventListener("scroll", onScroll);
      revealObs.disconnect();
      numObs.disconnect();
      if (litInterval) clearInterval(litInterval);
    };
  }, []);

  return null;
}
