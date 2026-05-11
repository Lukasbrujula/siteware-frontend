import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useUiStore } from "@/lib/store/ui-store";
import { useFilteredSlice } from "@/hooks/useFilteredSlice";
import type { CategorySlice, UnsubscribeStatus } from "@/types/email";
import { SpamView } from "@/views/SpamView";
import { AdView } from "@/views/AdView";
import { UrgentView } from "@/views/UrgentView";
import { OtherView } from "@/views/OtherView";
import { EscalationView } from "@/views/EscalationView";
import { UnsubscribeView } from "@/views/UnsubscribeView";
import { SentView } from "@/views/SentView";

type TabConfig = {
  readonly key: CategorySlice;
  readonly label: string;
};

const TAB_CONFIG: readonly TabConfig[] = [
  { key: "spam", label: "Spam" },
  { key: "ads", label: "Werbung" },
  { key: "urgent", label: "Dringend" },
  { key: "other", label: "Sonstige" },
  { key: "escalations", label: "Eskalation" },
  { key: "unsubscribes", label: "Abmeldungen" },
  { key: "sent", label: "Gesendet" },
] as const;

function useSliceCount(slice: CategorySlice): number {
  // Read through useFilteredSlice so badge counts respect the inbox dropdown.
  // When no inbox is selected, the hook returns the full slice unchanged.
  const filtered = useFilteredSlice(slice);
  switch (slice) {
    case "spam":
    case "ads":
    case "urgent":
    case "other":
    case "escalations":
      return filtered.length;
    case "unsubscribes":
      return (filtered as readonly UnsubscribeStatus[]).filter(
        (u) => u.status === "nicht erfolgreich",
      ).length;
    case "sent":
      return 0;
    default: {
      const _exhaustive: never = slice;
      void _exhaustive;
      return 0;
    }
  }
}

function TabBadge({ slice }: { readonly slice: CategorySlice }) {
  const count = useSliceCount(slice);

  if (count === 0) return null;

  return (
    <Badge
      variant="default"
      className="ml-1.5 px-1.5 py-0 text-[10px] leading-4"
    >
      {count}
    </Badge>
  );
}

function CategoryTabContent({ slice }: { readonly slice: CategorySlice }) {
  switch (slice) {
    case "spam":
      return <SpamView />;
    case "ads":
      return <AdView />;
    case "urgent":
      return <UrgentView />;
    case "other":
      return <OtherView />;
    case "escalations":
      return <EscalationView />;
    case "unsubscribes":
      return <UnsubscribeView />;
    case "sent":
      return <SentView />;
    default: {
      const _exhaustive: never = slice;
      void _exhaustive;
      return null;
    }
  }
}

export function CategoryTabs() {
  const activeTab = useUiStore((state) => state.activeTab);
  const setActiveTab = useUiStore((state) => state.setActiveTab);

  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => setActiveTab(value as CategorySlice)}
      className="flex-1"
    >
      <div className="border-b border-border bg-background px-4 md:px-6">
        <TabsList variant="line" className="h-10 w-full justify-start gap-0">
          {TAB_CONFIG.map((tab) => (
            <TabsTrigger
              key={tab.key}
              value={tab.key}
              className="px-3 py-2 text-sm"
            >
              {tab.label}
              <TabBadge slice={tab.key} />
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      <div className="flex-1 p-4 md:p-6">
        {TAB_CONFIG.map((tab) => (
          <TabsContent key={tab.key} value={tab.key}>
            <CategoryTabContent slice={tab.key} />
          </TabsContent>
        ))}
      </div>
    </Tabs>
  );
}
