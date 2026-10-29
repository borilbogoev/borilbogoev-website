"use client";

import { useEffect, useId, useRef, useState } from "react";
import { get } from "../lib/client";
import { toStored, type Pick } from "../lib/text";
import { t } from "../strings";

type Suggestion = { id: string; name: string; username: string; avatarUrl: string };

export type MentionValue = { text: string; picks: Pick[] };

/**
 * A plain textarea that shows @Name. When the writer picks a suggestion the person is remembered beside the text;
 * `stored(value)` turns it into the stored form (@[Name](user:id)) on submit. No contenteditable, no dependency.
 * Typing @ opens an accessible list: Arrow keys move, Enter or Tab picks, Escape closes. Requests wait 200 ms.
 */
export function MentionTextarea({
  value,
  onChange,
  communityId,
  label,
  placeholder,
  maxLength,
  rows = 3,
  disabled,
  onSubmitShortcut,
  autoFocus,
}: {
  value: MentionValue;
  onChange: (v: MentionValue) => void;
  communityId?: number;
  label: string;
  placeholder?: string;
  maxLength: number;
  rows?: number;
  disabled?: boolean;
  onSubmitShortcut?: () => void;
  autoFocus?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const listId = useId();
  const [open, setOpen] = useState<{ start: number; q: string } | null>(null);
  const [items, setItems] = useState<Suggestion[]>([]);
  const [active, setActive] = useState(0);
  const [fetched, setFetched] = useState<string | null>(null);

  const query = open?.q ?? null;
  useEffect(() => {
    if (query === null) return;
    const ctl = new AbortController();
    const timer = setTimeout(() => {
      const p = new URLSearchParams({ q: query });
      if (communityId) p.set("communityId", String(communityId));
      get<{ items: Suggestion[] }>(`/api/community/mentions/suggest?${p}`, ctl.signal)
        .then((r) => {
          setItems(r.items);
          setActive(0);
          setFetched(query);
        })
        .catch(() => {});
    }, 200);
    return () => {
      clearTimeout(timer);
      ctl.abort();
    };
  }, [query, communityId]);

  function detect(text: string, caret: number) {
    const before = text.slice(0, caret);
    const m = /(^|[\s(])@([^\s@]{0,30})$/.exec(before);
    setOpen(m ? { start: caret - m[2].length - 1, q: m[2] } : null);
    if (!m) setItems([]);
  }

  function pick(s: Suggestion) {
    if (!open || !ref.current) return;
    const caret = ref.current.selectionStart;
    const text = value.text.slice(0, open.start) + `@${s.name} ` + value.text.slice(caret);
    onChange({ text, picks: [...value.picks.filter((p) => p.userId !== s.id), { name: s.name, userId: s.id }] });
    setOpen(null);
    setItems([]);
    const pos = open.start + s.name.length + 2;
    requestAnimationFrame(() => {
      ref.current?.focus();
      ref.current?.setSelectionRange(pos, pos);
    });
  }

  const showList = !!open && fetched === open.q;
  return (
    <div className="cm-mentionbox">
      <label className="cm-sr" htmlFor={`${listId}-ta`}>
        {label}
      </label>
      <textarea
        id={`${listId}-ta`}
        ref={ref}
        className="cm-textarea"
        rows={rows}
        value={value.text}
        maxLength={maxLength}
        placeholder={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
        role="combobox"
        aria-expanded={showList}
        aria-controls={showList ? listId : undefined}
        aria-autocomplete="list"
        aria-activedescendant={showList && items[active] ? `${listId}-${active}` : undefined}
        onChange={(e) => {
          onChange({ text: e.target.value, picks: value.picks });
          detect(e.target.value, e.target.selectionStart);
        }}
        onClick={(e) => detect(value.text, e.currentTarget.selectionStart)}
        onKeyDown={(e) => {
          if (showList && items.length) {
            if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => (a + 1) % items.length); return; }
            if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => (a - 1 + items.length) % items.length); return; }
            if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); pick(items[active]); return; }
          }
          if (open && e.key === "Escape") { e.preventDefault(); setOpen(null); return; }
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && onSubmitShortcut) { e.preventDefault(); onSubmitShortcut(); }
        }}
        onBlur={() => setTimeout(() => setOpen(null), 150)}
      />
      {showList ? (
        <ul id={listId} role="listbox" aria-label={t.mention.listLabel} className="cm-suggest">
          {items.length ? (
            items.map((s, i) => (
              <li key={s.id} id={`${listId}-${i}`} role="option" aria-selected={i === active} className={i === active ? "is-active" : undefined} onMouseDown={(e) => { e.preventDefault(); pick(s); }}>
                <strong>{s.name}</strong>
                {s.username ? <span>@{s.username}</span> : null}
              </li>
            ))
          ) : (
            <li role="option" aria-selected="false" aria-disabled="true" className="cm-suggest__none">
              {t.mention.none}
            </li>
          )}
        </ul>
      ) : null}
    </div>
  );
}

export const emptyMention = (): MentionValue => ({ text: "", picks: [] });
export const stored = (v: MentionValue) => toStored(v.text, v.picks);
