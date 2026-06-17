import { ImageResponse } from "next/og";
import { SITE_DESCRIPTION, SITE_NAME } from "@/data/site";

export const alt = `${SITE_NAME} | Technology news told loud`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Default social card for the homepage and any page without its own image.
export default function Image() {
  const accent = "#f45d2d";
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
              fontSize: 72,
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: "-0.03em",
            }}
          >
            Technology news told loud.
          </div>
          <div style={{ display: "flex", fontSize: 30, color: "#a8a29b", lineHeight: 1.3 }}>
            {SITE_DESCRIPTION}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 26,
            color: accent,
            fontWeight: 700,
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
