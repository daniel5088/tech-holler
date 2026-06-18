import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { SITE_NAME } from "@/data/site";

export const alt = `${SITE_NAME} | Technology news told loud`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Default social card for the homepage and any page without its own image.
// Renders the brand lockup centered on its own dark teal background so the
// surrounding margins blend seamlessly into a full-bleed card.
export default async function Image() {
  const logo = await readFile(join(process.cwd(), "public/og-logo.jpg"));
  const logoSrc = `data:image/jpeg;base64,${logo.toString("base64")}`;
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          background: "#021623",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Rendered by satori inside ImageResponse, where next/image is unavailable. */}
        <img src={logoSrc} width={856} height={592} alt={alt} />
      </div>
    ),
    { ...size },
  );
}
