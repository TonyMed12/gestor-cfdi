import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";

export function AppShell({
  active,
  children,
}: {
  active: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen w-full flex-col md:flex-row">
      <Sidebar active={active} />
      <main className="flex min-w-0 flex-1 flex-col gap-6 p-6 md:p-10">
        {children}
      </main>
    </div>
  );
}
