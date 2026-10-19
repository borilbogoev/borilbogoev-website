import { ImageResponse } from "next/og";
import { site } from "@/content/site";

export const alt = `${site.fullName}: ${site.positioning}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#ffffff", padding: 80, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", fontSize: 96, fontWeight: 800, letterSpacing: -4, color: "#1a1a1a" }}>
          B<span style={{ color: "#c72c2c" }}>*</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 84, fontWeight: 800, letterSpacing: -3, color: "#1a1a1a", lineHeight: 1.05 }}>
            Boril Bogoev<span style={{ color: "#c72c2c" }}>.</span>
          </div>
          <div style={{ display: "flex", fontSize: 38, fontWeight: 300, color: "#6b6b6b", marginTop: 16 }}>{site.positioning}</div>
          <div style={{ display: "flex", fontSize: 24, fontWeight: 700, letterSpacing: 4, color: "#1a1a1a", marginTop: 32, textTransform: "uppercase" }}>
            AI and automation · Dubai
          </div>
        </div>
      </div>
    ),
    size,
  );
}
