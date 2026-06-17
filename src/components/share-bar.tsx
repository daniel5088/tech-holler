"use client";

import { useState } from "react";
import { Check, Link2, Mail, Share2 } from "lucide-react";

type ShareBarProps = {
  url: string;
  title: string;
};

type GtagWindow = Window & {
  gtag?: (...args: unknown[]) => void;
};

function trackShare(method: string, url: string) {
  if (typeof window === "undefined") return;
  const { gtag } = window as GtagWindow;
  gtag?.("event", "share", { method, item_id: url });
}

// lucide-react@1.18 has no brand glyphs, so the platform marks are inline SVGs.
function XMark() {
  return (
    <svg viewBox="0 0 24 24" width={17} height={17} fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117Z" />
    </svg>
  );
}

function BlueskyMark() {
  return (
    <svg viewBox="0 0 24 24" width={17} height={17} fill="currentColor" aria-hidden="true">
      <path d="M12 10.8c-1.087-2.114-4.046-6.053-6.798-7.995C2.566.944 1.561 1.266.902 1.565.139 1.908 0 3.08 0 3.768c0 .69.378 5.65.624 6.479.815 2.736 3.713 3.66 6.383 3.364.136-.02.275-.039.415-.056-.138.022-.276.04-.415.056-3.912.58-7.387 2.005-2.83 7.078 5.013 5.19 6.87-1.113 7.823-4.308.953 3.195 2.05 9.271 7.733 4.308 4.267-4.308 1.172-6.498-2.74-7.078a8.741 8.741 0 0 1-.415-.056c.14.017.279.036.415.056 2.67.297 5.568-.628 6.383-3.364.246-.828.624-5.79.624-6.479 0-.689-.139-1.86-.902-2.203-.659-.299-1.664-.621-4.3 1.24C16.046 4.748 13.087 8.687 12 10.8Z" />
    </svg>
  );
}

function FacebookMark() {
  return (
    <svg viewBox="0 0 24 24" width={17} height={17} fill="currentColor" aria-hidden="true">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073Z" />
    </svg>
  );
}

export function ShareBar({ url, title }: ShareBarProps) {
  const [copied, setCopied] = useState(false);

  const canNativeShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);

  const handleNativeShare = async () => {
    try {
      await navigator.share({ title, url });
      trackShare("web_share", url);
    } catch {
      // User dismissed the share sheet, or it failed — nothing to do.
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      trackShare("copy_link", url);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable (e.g. insecure context) — leave state untouched.
    }
  };

  return (
    <div className="share-bar" role="group" aria-label="Share this story">
      {canNativeShare && (
        <button type="button" className="share-button" onClick={handleNativeShare}>
          <Share2 size={17} aria-hidden="true" />
          <span>Share</span>
        </button>
      )}

      <button
        type="button"
        className="share-button"
        onClick={handleCopy}
        aria-live="polite"
      >
        {copied ? <Check size={17} aria-hidden="true" /> : <Link2 size={17} aria-hidden="true" />}
        <span>{copied ? "Copied" : "Copy link"}</span>
      </button>

      <a
        className="share-button"
        href={`https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => trackShare("x", url)}
        aria-label="Share on X"
      >
        <XMark />
        <span>X</span>
      </a>

      <a
        className="share-button"
        href={`https://bsky.app/intent/compose?text=${encodedTitle}%20${encodedUrl}`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => trackShare("bluesky", url)}
        aria-label="Share on Bluesky"
      >
        <BlueskyMark />
        <span>Bluesky</span>
      </a>

      <a
        className="share-button"
        href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => trackShare("facebook", url)}
        aria-label="Share on Facebook"
      >
        <FacebookMark />
        <span>Facebook</span>
      </a>

      <a
        className="share-button"
        href={`mailto:?subject=${encodedTitle}&body=${encodedUrl}`}
        onClick={() => trackShare("email", url)}
        aria-label="Share by email"
      >
        <Mail size={17} aria-hidden="true" />
        <span>Email</span>
      </a>
    </div>
  );
}
