import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LogOut, Settings } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/lib/store/auth-store";
import { InboxFilter } from "@/components/email/InboxFilter";
import { useFilteredSlice } from "@/hooks/useFilteredSlice";

function ActionCountBadge() {
  // Per-slice reads via useFilteredSlice so the header badge respects the
  // inbox dropdown the same way the tab badges and view tables do.
  const spamCount = useFilteredSlice("spam").length;
  const adsCount = useFilteredSlice("ads").length;
  const urgentCount = useFilteredSlice("urgent").length;
  const otherCount = useFilteredSlice("other").length;
  const escalationsCount = useFilteredSlice("escalations").length;
  const failedUnsubscribesCount = useFilteredSlice("unsubscribes").filter(
    (u) => u.status === "nicht erfolgreich",
  ).length;
  const count =
    spamCount +
    adsCount +
    urgentCount +
    otherCount +
    escalationsCount +
    failedUnsubscribesCount;

  if (count === 0) return null;

  return (
    <Badge variant="default" className="text-sm px-2.5 py-0.5">
      {count}
    </Badge>
  );
}

type DashboardHeaderProps = {
  readonly children?: ReactNode;
  readonly isSyncing?: boolean;
};

export function DashboardHeader({ children, isSyncing }: DashboardHeaderProps) {
  const navigate = useNavigate();

  async function handleLogout() {
    await useAuthStore.getState().logout();
    navigate("/login", { replace: true });
  }

  return (
    <header className="border-b border-border bg-background">
      <div className="container mx-auto flex items-center justify-between px-4 py-4 md:px-6">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-lg font-bold lowercase leading-tight text-foreground">
              siteware
            </h1>
            <p className="text-xs text-muted-foreground">E-Mail Automation</p>
          </div>
          {isSyncing && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="size-1.5 animate-pulse rounded-full bg-current" />
              Postfach wird synchronisiert…
            </div>
          )}
        </div>
        {children}
        <div className="flex items-center gap-3">
          <InboxFilter />
          <span className="text-sm text-muted-foreground">Offene Aktionen</span>
          <ActionCountBadge />
          <Link
            to="/settings"
            className="cursor-pointer rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground"
            title="Einstellungen"
          >
            <Settings className="size-5" />
          </Link>
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="cursor-pointer rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground"
            title="Abmelden"
          >
            <LogOut className="size-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
