import { PageHeader } from "@/app/admin/(panel)/header";
import { ADMIN_TABS, CommunityTabs, ToastHost } from "./frame";

/** The header of every control panel page: title, actions and the tabs. */
export function AdminHead({ title, actions }: { title: string; actions?: React.ReactNode }) {
  return (
    <>
      <PageHeader eyebrow="Communities" title={<>{title}<span className="bbfa-dot">.</span></>} actions={actions} />
      <CommunityTabs items={ADMIN_TABS} />
      <ToastHost />
    </>
  );
}
