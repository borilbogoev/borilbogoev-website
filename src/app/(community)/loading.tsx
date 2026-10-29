import { t } from "@/modules/community/strings";

export default function CommunityLoading() {
  return (
    <div className="cm-page" aria-busy="true" aria-label={t.state.loading}>
      <div className="cm-skeleton" style={{ height: 40, width: "50%", marginBottom: 20 }} />
      <div className="cm-skeleton cm-skeleton--card" />
      <div className="cm-skeleton cm-skeleton--card" />
      <div className="cm-skeleton cm-skeleton--card" />
    </div>
  );
}
