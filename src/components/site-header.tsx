import Link from "next/link";
import { Menu, Radio, Search } from "lucide-react";
import { categories, SITE_NAME } from "@/data/site";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="breaking-bar">
        <span className="breaking-label">
          <Radio size={13} aria-hidden="true" />
          LIVE MONITOR
        </span>
        <span>Scanning public technology signals every 30 minutes</span>
      </div>
      <div className="masthead shell">
        <Link href="/" className="brand" aria-label={`${SITE_NAME} home`}>
          <span className="brand-mark">TH</span>
          <span>
            <strong>THE TECH HOLLER</strong>
            <small>Tomorrow&apos;s news, told loud</small>
          </span>
        </Link>
        <nav className="desktop-nav" aria-label="Primary navigation">
          <Link href="/latest">Latest</Link>
          {categories.slice(0, 4).map((category) => (
            <Link href={`/category/${category.slug}`} key={category.slug}>
              {category.shortName}
            </Link>
          ))}
        </nav>
        <div className="header-actions">
          <Link href="/search" className="icon-button" aria-label="Search">
            <Search size={19} />
          </Link>
          <Link href="/latest" className="icon-button mobile-menu" aria-label="Browse stories">
            <Menu size={20} />
          </Link>
        </div>
      </div>
      <nav className="category-strip shell" aria-label="Story categories">
        {categories.map((category) => (
          <Link href={`/category/${category.slug}`} key={category.slug}>
            <span style={{ backgroundColor: category.accent }} />
            {category.name}
          </Link>
        ))}
      </nav>
    </header>
  );
}
