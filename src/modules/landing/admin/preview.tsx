"use client";

import { useState } from "react";
import "./landing-admin.css";

const DEVICES = [
  ["Desktop", "100%"],
  ["Tablet", "820px"],
  ["Phone", "390px"],
] as const;

/** The page exactly as visitors get it, at the width of a desktop, a tablet or a phone. Statistics are off. */
export function PreviewFrame({ src, publicUrl, live }: { src: string; publicUrl: string; live: boolean }) {
  const [width, setWidth] = useState<string>("100%");
  const [nonce, setNonce] = useState(0);
  return (
    <div>
      <div className="bbfa-previewbar">
        <div className="bbfa-devices">
          {DEVICES.map(([label, w]) => (
            <button key={label} type="button" className={`bbfa-btn bbfa-btn--ghost bbfa-btn--sm${width === w ? " is-on" : ""}`} onClick={() => setWidth(w)}>
              {label}
            </button>
          ))}
        </div>
        <button type="button" className="bbfa-btn bbfa-btn--ghost bbfa-btn--sm" onClick={() => setNonce((n) => n + 1)}>
          Reload
        </button>
        <span className="bbfa-spacer" />
        <span className="bbfa-muted">{live ? "Live at " : "Not public yet. Address: "}<code>{publicUrl}</code></span>
        <a className="bbfa-btn bbfa-btn--ghost bbfa-btn--sm" href={src} target="_blank" rel="noopener noreferrer">
          Open full size ↗
        </a>
      </div>
      <div className="bbfa-frame-wrap">
        <iframe key={nonce} className="bbfa-frame" style={{ width }} src={src} title="Page preview" />
      </div>
    </div>
  );
}
