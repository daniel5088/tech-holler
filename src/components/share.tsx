"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
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

function useCopyLink() {
  const [copied, setCopied] = useState(false);
  async function copy(url: string) {
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
  return { copied, copy };
}

async function nativeShare(data: { title: string; text?: string; url: string }) {
  try {
    await navigator.share(data);
  } catch {
    // The user dismissed the share sheet, or sharing was unavailable.
  }
}

const X_PATH =
  "M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z";
const BLUESKY_PATH =
  "M5.732 4.077C8.27 5.98 11 9.84 12 11.913c1-2.073 3.73-5.933 6.268-7.836C20.092 2.715 23 1.605 23 4.972c0 .673-.386 5.654-.612 6.463-.787 2.813-3.655 3.53-6.206 3.095 4.457.76 5.59 3.273 3.14 5.786-4.65 4.773-6.683-1.198-7.205-2.728-.096-.28-.141-.41-.142-.299-.001-.111-.046.019-.142.299-.522 1.53-2.555 7.501-7.205 2.728-2.45-2.513-1.317-5.026 3.14-5.786-2.551.435-5.419-.282-6.206-3.095C1.386 10.626 1 5.645 1 4.972c0-3.367 2.908-2.257 4.732-.895Z";
const FACEBOOK_PATH =
  "M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073Z";
const LINKEDIN_PATH =
  "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z";
const REDDIT_PATH =
  "M24 11.779c0-1.459-1.192-2.645-2.657-2.645-.715 0-1.363.286-1.84.746-1.81-1.191-4.259-1.948-6.971-2.046l1.483-4.669 4.016.941-.006.058c0 1.193.974 2.163 2.172 2.163 1.198 0 2.172-.97 2.172-2.163s-.974-2.164-2.172-2.164c-.92 0-1.704.574-2.021 1.379l-4.329-1.015a.314.314 0 0 0-.378.226l-1.65 5.184c-2.746.076-5.222.832-7.052 2.04-.477-.464-1.131-.752-1.853-.752C1.192 9.134 0 10.32 0 11.779c0 .974.533 1.823 1.32 2.282-.038.241-.062.484-.062.732 0 3.728 4.349 6.756 9.702 6.756 5.354 0 9.703-3.028 9.703-6.756 0-.247-.023-.49-.061-.729.787-.459 1.32-1.308 1.32-2.282zm-17.945 1.706c0-.948.776-1.721 1.729-1.721.952 0 1.726.773 1.726 1.721 0 .949-.774 1.722-1.726 1.722-.953 0-1.729-.773-1.729-1.722zm9.937 4.392c-1.213 1.214-3.535 1.312-4.214 1.312-.679 0-3.001-.098-4.214-1.312a.464.464 0 0 1 0-.656.464.464 0 0 1 .656 0c.781.781 2.448.967 3.558.967 1.11 0 2.777-.186 3.558-.967a.464.464 0 0 1 .656 0c.181.181.181.475 0 .656zm-.131-2.671c-.952 0-1.726-.773-1.726-1.722 0-.948.774-1.721 1.726-1.721.952 0 1.729.773 1.729 1.721 0 .949-.777 1.722-1.729 1.722z";
const HACKERNEWS_PATH =
  "M0 24V0h24v24H0zM6.951 5.896l4.112 7.708v5.064h1.583v-5.226l4.069-7.546h-1.74l-2.59 5.066c-.291.55-.488.94-.612 1.18-.069.13-.122.23-.16.297-.04-.078-.094-.18-.164-.307-.124-.24-.32-.63-.612-1.18l-2.555-5.066H6.951z";

function BrandIcon({ path }: { path: string }) {
  return (
    <svg viewBox="0 0 24 24" width={17} height={17} fill="currentColor" aria-hidden="true">
      <path d={path} />
    </svg>
  );
}

type ShareTarget = { name: string; href: string; icon: React.ReactNode };

function buildTargets(url: string, title: string, summary?: string): ShareTarget[] {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(title);
  const s = encodeURIComponent(summary ?? "");
  return [
    { name: "X", href: `https://twitter.com/intent/tweet?text=${t}&url=${u}`, icon: <BrandIcon path={X_PATH} /> },
    { name: "Bluesky", href: `https://bsky.app/intent/compose?text=${encodeURIComponent(`${title} ${url}`)}`, icon: <BrandIcon path={BLUESKY_PATH} /> },
    { name: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${u}`, icon: <BrandIcon path={FACEBOOK_PATH} /> },
    { name: "LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${u}`, icon: <BrandIcon path={LINKEDIN_PATH} /> },
    { name: "Reddit", href: `https://www.reddit.com/submit?url=${u}&title=${t}`, icon: <BrandIcon path={REDDIT_PATH} /> },
    { name: "Hacker News", href: `https://news.ycombinator.com/submitlink?u=${u}&t=${t}`, icon: <BrandIcon path={HACKERNEWS_PATH} /> },
    { name: "Email", href: `mailto:?subject=${t}&body=${s}%0A%0A${u}`, icon: <Mail size={17} aria-hidden="true" /> },
  ];
}

type ShareProps = {
  url: string;
  title: string;
  summary?: string;
};

// Full row used under the article byline.
export function ShareBar({ url, title, summary }: ShareProps) {
  const canNativeShare = useCanNativeShare();
  const { copied, copy } = useCopyLink();
  const targets = buildTargets(url, title, summary);

  return (
    <div className="article-share">
      <span className="article-share-label">Holler it out</span>
      <div className="article-share-buttons">
        {canNativeShare && (
          <button
            type="button"
            className="share-button share-button-text"
            onClick={() => nativeShare({ title, text: summary, url })}
          >
            <Share2 size={16} aria-hidden="true" />
            Share
          </button>
        )}
        <button
          type="button"
          className={`share-button share-button-text${copied ? " copied" : ""}`}
          onClick={() => copy(url)}
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

// Compact popover used on article cards.
export function ShareMenu({ url, title, summary }: ShareProps) {
  const canNativeShare = useCanNativeShare();
  const { copied, copy } = useCopyLink();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const targets = buildTargets(url, title, summary);

  return (
    <div className="share-menu" ref={containerRef}>
      <button
        type="button"
        className="share-menu-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Share "${title}"`}
        onClick={() => setOpen((value) => !value)}
      >
        <Share2 size={14} aria-hidden="true" />
        <span>Share</span>
      </button>
      {open && (
        <div className="share-menu-popover" role="menu">
          {canNativeShare && (
            <button
              type="button"
              role="menuitem"
              className="share-menu-item"
              onClick={() => {
                nativeShare({ title, text: summary, url });
                setOpen(false);
              }}
            >
              <Share2 size={16} aria-hidden="true" />
              Share…
            </button>
          )}
          <button type="button" role="menuitem" className="share-menu-item" onClick={() => copy(url)} aria-live="polite">
            {copied ? <Check size={16} aria-hidden="true" /> : <Link2 size={16} aria-hidden="true" />}
            {copied ? "Copied" : "Copy link"}
          </button>
          {targets.map((target) => (
            <a
              key={target.name}
              role="menuitem"
              className="share-menu-item"
              href={target.href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
            >
              {target.icon}
              {target.name}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
