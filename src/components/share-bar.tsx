"use client";

import { useState, useSyncExternalStore } from "react";
import { Check, Link2, Mail, Share2 } from "lucide-react";

const noopSubscribe = () => () => {};

// Read the client-only Web Share capability without a setState-in-effect:
// false on the server (and first paint), the real value after hydration.
function useCanNativeShare() {
  return useSyncExternalStore(
    noopSubscribe,
    () => typeof navigator !== "undefined" && typeof navigator.share === "function",
    () => false,
  );
}

type ShareBarProps = {
  url: string;
  title: string;
  summary?: string;
};

function BrandIcon({ path, label }: { path: string; label: string }) {
  return (
    <svg viewBox="0 0 24 24" width={17} height={17} fill="currentColor" role="img" aria-label={label}>
      <path d={path} />
    </svg>
  );
}

const X_PATH =
  "M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z";
const FACEBOOK_PATH =
  "M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073Z";
const LINKEDIN_PATH =
  "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z";

export function ShareBar({ url, title, summary }: ShareBarProps) {
  const canNativeShare = useCanNativeShare();
  const [copied, setCopied] = useState(false);

  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);
  const encodedSummary = encodeURIComponent(summary ?? "");

  const targets = [
    {
      name: "X",
      href: `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`,
      icon: <BrandIcon path={X_PATH} label="X" />,
    },
    {
      name: "Facebook",
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      icon: <BrandIcon path={FACEBOOK_PATH} label="Facebook" />,
    },
    {
      name: "LinkedIn",
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
      icon: <BrandIcon path={LINKEDIN_PATH} label="LinkedIn" />,
    },
    {
      name: "Email",
      href: `mailto:?subject=${encodedTitle}&body=${encodedSummary}%0A%0A${encodedUrl}`,
      icon: <Mail size={17} aria-hidden="true" />,
    },
  ];

  async function handleNativeShare() {
    try {
      await navigator.share({ title, text: summary, url });
    } catch {
      // The user dismissed the share sheet, or sharing was unavailable.
    }
  }

  async function handleCopy() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const field = document.createElement("textarea");
        field.value = url;
        field.setAttribute("readonly", "");
        field.style.position = "absolute";
        field.style.left = "-9999px";
        document.body.appendChild(field);
        field.select();
        document.execCommand("copy");
        document.body.removeChild(field);
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be blocked; fail quietly rather than alarm the reader.
    }
  }

  return (
    <div className="article-share">
      <span className="article-share-label">Holler it out</span>
      <div className="article-share-buttons">
        {canNativeShare && (
          <button type="button" className="share-button share-button-text" onClick={handleNativeShare}>
            <Share2 size={16} aria-hidden="true" />
            Share
          </button>
        )}
        <button
          type="button"
          className={`share-button share-button-text${copied ? " copied" : ""}`}
          onClick={handleCopy}
          aria-live="polite"
        >
          {copied ? <Check size={16} aria-hidden="true" /> : <Link2 size={16} aria-hidden="true" />}
          {copied ? "Copied" : "Copy link"}
        </button>
        {targets.map((target) => (
          <a
            key={target.name}
            className="share-button share-button-icon"
            href={target.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Share on ${target.name}`}
            title={`Share on ${target.name}`}
          >
            {target.icon}
          </a>
        ))}
      </div>
    </div>
  );
}
