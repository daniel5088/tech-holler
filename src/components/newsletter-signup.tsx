"use client";

import { useId, useState, type FormEvent } from "react";

type SignupState = "idle" | "loading" | "success" | "error";

export function NewsletterSignup({ variant = "footer" }: { variant?: "footer" | "page" }) {
  const fieldId = useId();
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [state, setState] = useState<SignupState>("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state === "loading") return;
    setState("loading");
    setMessage("");
    try {
      const response = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, website }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        setState("success");
        setMessage(data.message ?? "You're in. Watch your inbox for the next holler.");
        setEmail("");
      } else {
        setState("error");
        setMessage(data.error ?? "Something went sideways. Try again shortly.");
      }
    } catch {
      setState("error");
      setMessage("Network hiccup — give it another go.");
    }
  }

  return (
    <form className={`newsletter-signup ${variant}`} onSubmit={handleSubmit} noValidate>
      <label className="newsletter-label" htmlFor={`${fieldId}-email`}>
        Get the holler in your inbox
      </label>
      <p className="newsletter-sub">A short digest of the latest tech stories. No spam, unsubscribe anytime.</p>
      <div className="newsletter-row">
        <input
          id={`${fieldId}-email`}
          type="email"
          name="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={state === "loading"}
        />
        <input
          type="text"
          name="website"
          className="newsletter-hp"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          value={website}
          onChange={(event) => setWebsite(event.target.value)}
        />
        <button type="submit" disabled={state === "loading"}>
          {state === "loading" ? "Signing up…" : "Subscribe"}
        </button>
      </div>
      {message && (
        <p className={`newsletter-message ${state}`} role="status">
          {message}
        </p>
      )}
    </form>
  );
}
