import { guarded } from "@/modules/auth/guard";
import { getFile } from "@/modules/forms/lib/storage";

export const runtime = "nodejs";

// Files that visitors uploaded through a form. Only signed-in users who may view forms can open them.
const INLINE = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"]);

export async function GET(request: Request, ctx: { params: Promise<{ path: string[] }> }) {
  return guarded(request, "forms.view", async () => {
    const pathname = (await ctx.params).path.join("/");
    if (!pathname.startsWith("uploads/") || pathname.includes("..")) return new Response("Not found", { status: 404 });
    const result = await getFile(pathname);
    if (!result || result.statusCode !== 200) return new Response("Not found", { status: 404 });
    const type = result.blob.contentType || "application/octet-stream";
    const name = encodeURIComponent(pathname.split("/").pop() ?? "file");
    return new Response(result.stream, {
      headers: {
        "Content-Type": type,
        "Content-Disposition": `${INLINE.has(type) ? "inline" : "attachment"}; filename*=UTF-8''${name}`,
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "sandbox",
      },
    });
  });
}
