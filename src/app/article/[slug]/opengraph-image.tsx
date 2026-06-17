import { ImageResponse } from "next/og";
import { getCategory, SITE_NAME } from "@/data/site";
import { getArticleBySlug } from "@/lib/content";

export const alt = "The Tech Holler";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Generated per request from live article data (the DB fetch is uncached).
export const dynamic = "force-dynamic";

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);
  const title = article?.title ?? `${SITE_NAME} | Technology news told loud`;
  const category = article ? getCategory(article.category) : undefined;
  const accent = category?.accent ?? "#f45d2d";
  const kicker =
    article?.editorialMode === "talk-around-town"
      ? "TALK AROUND TOWN"
      : (category?.name ?? "Technology news").toUpperCase();
  const titleSize = title.length > 92 ? 50 : title.length > 60 ? 58 : 66;

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          background: "#0f1115",
          color: "#f7f4ee",
          padding: "64px",
          justifyContent: "space-between",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
          <div style={{ display: "flex", width: "18px", height: "52px", background: accent }} />
          <div style={{ display: "flex", fontSize: 38, fontWeight: 700, letterSpacing: "-0.02em" }}>
            {SITE_NAME}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
          <div
            style={{
              display: "flex",
              fontSize: 26,
              color: accent,
              fontWeight: 700,
              letterSpacing: "0.14em",
            }}
          >
            {kicker}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: titleSize,
              fontWeight: 800,
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
            }}
          >
            {title}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 26,
            color: "#a8a29b",
          }}
        >
          <div style={{ display: "flex" }}>thetechholler.com</div>
          <div style={{ display: "flex" }}>We show our homework.</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
