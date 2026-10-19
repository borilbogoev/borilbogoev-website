"use client";

import type { ReactNode } from "react";
import { ConfirmProvider, TimeZoneProvider, ToastProvider } from "./ui";

/** Toasts, confirm dialogs and the forms time zone for everything under /admin. */
export function AdminProviders({ timeZone, children }: { timeZone: string; children: ReactNode }) {
  return (
    <TimeZoneProvider value={timeZone}>
      <ToastProvider>
        <ConfirmProvider>{children}</ConfirmProvider>
      </ToastProvider>
    </TimeZoneProvider>
  );
}
