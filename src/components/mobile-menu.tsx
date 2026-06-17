"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { categories } from "@/data/site";

export function MobileMenu() {
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

  return (
    <div className="mobile-menu" ref={containerRef}>
      <button
        type="button"
        className="icon-button mobile-menu-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="mobile-menu-panel"
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
      </button>
      {open && (
        <nav className="mobile-menu-panel" id="mobile-menu-panel" aria-label="Mobile navigation">
          <Link href="/latest" className="mobile-menu-item" onClick={() => setOpen(false)}>
            Latest
          </Link>
          {categories.map((category) => (
            <Link
              href={`/category/${category.slug}`}
              key={category.slug}
              className="mobile-menu-item"
              onClick={() => setOpen(false)}
            >
              <span
                className="mobile-menu-dot"
                style={{ backgroundColor: category.accent }}
                aria-hidden="true"
              />
              {category.name}
            </Link>
          ))}
          <Link href="/search" className="mobile-menu-item" onClick={() => setOpen(false)}>
            Search
          </Link>
        </nav>
      )}
    </div>
  );
}
