"use client";

import { useRouter } from "next/navigation";
import { t } from "../strings";

export function ProfileFilter({ base, section, value, options }: { base: string; section: string; value: number | null; options: { id: number; name: string }[] }) {
  const router = useRouter();
  return (
    <label className="cm-filter">
      <span>{t.profile.filter}</span>
      <select value={value ?? ""} onChange={(e) => router.push(`${base}?section=${section}${e.target.value ? `&community=${e.target.value}` : ""}`)}>
        <option value="">{t.profile.allCommunities}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </label>
  );
}
