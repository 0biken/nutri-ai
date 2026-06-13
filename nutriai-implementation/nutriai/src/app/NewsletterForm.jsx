"use client";
import { useState } from "react";

export default function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle"); // idle | submitting | ok | error
  const [message, setMessage] = useState("");

  async function submit(e) {
    e.preventDefault();
    if (!email.includes("@")) {
      setStatus("error");
      setMessage("Enter a valid email.");
      return;
    }
    setStatus("submitting");
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error("Failed");
      setStatus("ok");
      setMessage("You're subscribed. Welcome aboard.");
      setEmail("");
    } catch {
      setStatus("error");
      setMessage("Something went wrong. Try again.");
    }
  }

  return (
    <>
      <form className="newsletter-form" onSubmit={submit}>
        <input
          type="email"
          className="newsletter-input"
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={status === "submitting" || status === "ok"}
          required
        />
        <button className="newsletter-btn" type="submit" disabled={status === "submitting" || status === "ok"}>
          {status === "ok" ? "Subscribed ✓" : status === "submitting" ? "Sending…" : "Subscribe"}
        </button>
      </form>
      {message && (
        <p className="cta-note" style={{ color: status === "error" ? "#ffb38a" : undefined, marginBottom: 8 }}>
          {message}
        </p>
      )}
    </>
  );
}
