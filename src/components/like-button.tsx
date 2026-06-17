"use client";

import { useState } from "react";
import { Heart } from "lucide-react";

type LikeButtonProps = {
  slug: string;
  initialCount: number;
  initiallyLiked: boolean;
};

type GtagWindow = Window & {
  gtag?: (...args: unknown[]) => void;
};

function trackLike(event: "like" | "unlike", slug: string) {
  if (typeof window === "undefined") return;
  const { gtag } = window as GtagWindow;
  gtag?.("event", event, { item_id: slug });
}

export function LikeButton({ slug, initialCount, initiallyLiked }: LikeButtonProps) {
  const [count, setCount] = useState(initialCount);
  const [liked, setLiked] = useState(initiallyLiked);
  const [pending, setPending] = useState(false);

  const handleToggle = async () => {
    if (pending) return;
    setPending(true);

    // Optimistic update — reconciled with the server response below.
    const nextLiked = !liked;
    setLiked(nextLiked);
    setCount((current) => Math.max(0, current + (nextLiked ? 1 : -1)));

    try {
      const response = await fetch(
        `/api/articles/${encodeURIComponent(slug)}/like`,
        { method: "POST" },
      );
      if (!response.ok) throw new Error(`Like failed: ${response.status}`);
      const data = (await response.json()) as { likeCount: number; liked: boolean };
      setCount(data.likeCount);
      setLiked(data.liked);
      trackLike(data.liked ? "like" : "unlike", slug);
    } catch {
      // Roll the optimistic change back on failure.
      setLiked(liked);
      setCount((current) => Math.max(0, current + (nextLiked ? -1 : 1)));
    } finally {
      setPending(false);
    }
  };

  return (
    <button
      type="button"
      className="like-button"
      onClick={handleToggle}
      disabled={pending}
      aria-pressed={liked}
      aria-label={liked ? "Unlike this story" : "Like this story"}
    >
      <Heart
        size={17}
        aria-hidden="true"
        fill={liked ? "currentColor" : "none"}
      />
      <span>{count}</span>
    </button>
  );
}
