import { getFile } from "@/modules/forms/lib/storage";

export const runtime = "nodejs";

const IMAGES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

// Pictures used by Image blocks. They live in the private blob store under images/ and are public by design.
export async function GET(_request: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const pathname = path.join("/");
  if (!pathname.startsWith("images/") || pathname.includes("..")) return new Response("Not found", { status: 404 });
  try {
    const result = await getFile(pathname);
    if (!result || result.statusCode !== 200) return new Response("Not found", { status: 404 });
    const type = result.blob.contentType ?? "";
    if (!IMAGES.has(type)) return new Response("Not found", { status: 404 });
    return new Response(result.stream, {
      headers: { "Content-Type": type, "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "sandbox" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
