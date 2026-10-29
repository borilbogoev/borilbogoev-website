import { RenderBlock } from "@/modules/landing/components/blocks";
import type { LandingBlock, LandingBlockType } from "@/modules/landing/lib/blocks";
import type { RichBlock } from "../lib/rich";
import "@/modules/landing/components/landing.css";

/** A rich post's blocks, drawn by the same renderer as a landing page (so a block looks identical in both). */
export function RichBody({ blocks }: { blocks: RichBlock[] }) {
  const list = blocks.map((b, i): LandingBlock => ({ id: i + 1, type: b.type as LandingBlockType, settings: b.settings as LandingBlock["settings"] }));
  return (
    <div className="lp lp--post">
      {list.map((b, i) => (
        <RenderBlock key={b.id} block={b} first={i === 0} />
      ))}
    </div>
  );
}
