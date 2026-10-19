// Tiny, safe Markdown renderer: HTML is escaped first, then a small syntax is applied.
// Supports headings, bold, italic, strikethrough, inline code, links, lists, blockquotes, rules and line breaks.
// Ported from class-bbf-markdown.php.

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function safeHref(raw: string): string {
  const url = raw.replace(/&amp;/g, "&").trim();
  if (url.startsWith("/") && !url.startsWith("//")) return url;
  if (url.startsWith("#")) return url;
  try {
    const u = new URL(url);
    return ["http:", "https:", "mailto:", "tel:"].includes(u.protocol) ? url : "";
  } catch {
    return "";
  }
}

export function renderInline(text: string): string {
  let s = escapeHtml(text);
  const codes: string[] = [];
  s = s.replace(/`([^`]+)`/g, (_m, c: string) => {
    codes.push(`<code>${c}</code>`);
    return `\u0001${codes.length - 1}\u0001`;
  });
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label: string, href: string) => {
    const url = safeHref(href);
    if (!url) return label;
    const external = /^https?:\/\//i.test(url);
    return `<a href="${escapeHtml(url)}"${external ? ' target="_blank" rel="noopener"' : ""}>${label}</a>`;
  });
  s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/__(.+?)__/g, "<strong>$1</strong>");
  s = s.replace(/(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?!\w)/g, "<em>$1</em>");
  s = s.replace(/(?<!\w)_(?!\s)(.+?)(?<!\s)_(?!\w)/g, "<em>$1</em>");
  s = s.replace(/~~(.+?)~~/g, "<del>$1</del>");
  return s.replace(/\u0001(\d+)\u0001/g, (_m, i: string) => codes[Number(i)]);
}

export function renderMarkdown(text: string): string {
  const lines = String(text ?? "").replace(/\r\n?/g, "\n").split("\n");
  let html = "";
  let para: string[] = [];
  let list: "ul" | "ol" | null = null;
  let quote: string[] = [];

  const flushPara = () => {
    if (para.length) {
      html += `<p>${para.map(renderInline).join("<br>")}</p>`;
      para = [];
    }
  };
  const flushList = () => {
    if (list) {
      html += `</${list}>`;
      list = null;
    }
  };
  const flushQuote = () => {
    if (quote.length) {
      html += `<blockquote>${renderMarkdown(quote.join("\n"))}</blockquote>`;
      quote = [];
    }
  };

  for (const line of lines) {
    const t = line.trim();
    if (t === "") {
      flushPara();
      flushList();
      flushQuote();
      continue;
    }
    const q = /^>\s?(.*)$/.exec(t);
    if (q) {
      flushPara();
      flushList();
      quote.push(q[1]);
      continue;
    }
    flushQuote();

    const h = /^(#{1,4})\s+(.+)$/.exec(t);
    if (h) {
      flushPara();
      flushList();
      const lvl = h[1].length + 1;
      html += `<h${lvl}>${renderInline(h[2])}</h${lvl}>`;
      continue;
    }
    if (/^(\*\s*\*\s*\*|-\s*-\s*-|_\s*_\s*_)[\s*_-]*$/.test(t)) {
      flushPara();
      flushList();
      html += "<hr>";
      continue;
    }
    let type: "ul" | "ol" | null = null;
    let item = "";
    const u = /^[-*+]\s+(.+)$/.exec(t);
    const o = /^\d+[.)]\s+(.+)$/.exec(t);
    if (u) {
      type = "ul";
      item = u[1];
    } else if (o) {
      type = "ol";
      item = o[1];
    }
    if (type) {
      flushPara();
      if (list !== type) {
        flushList();
        html += `<${type}>`;
        list = type;
      }
      html += `<li>${renderInline(item)}</li>`;
      continue;
    }
    flushList();
    para.push(t);
  }
  flushPara();
  flushList();
  flushQuote();
  return html;
}
