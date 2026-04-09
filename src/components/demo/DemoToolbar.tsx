import { useState } from "react";
import { apiHeaders } from "@/lib/api/headers";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useEmailStore } from "@/lib/store/email-store";

type DemoButton = {
  readonly label: string;
  readonly scenario: string;
};

const DEMO_BUTTONS: readonly DemoButton[] = [
  { label: "Send All", scenario: "all" },
  { label: "Send Spam", scenario: "spam" },
  { label: "Send Urgent", scenario: "urgent" },
  { label: "Send Escalation", scenario: "escalation" },
];

type TriggerResponse = {
  readonly success?: boolean;
  readonly count?: number;
  readonly error?: string;
  readonly emails?: readonly Record<string, unknown>[];
};

export function DemoToolbar() {
  const [loading, setLoading] = useState<string | null>(null);

  async function handleTrigger(scenario: string) {
    setLoading(scenario);

    try {
      const response = await fetch("/api/demo/trigger", {
        method: "POST",
        headers: apiHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ scenario }),
      });

      const data = (await response.json()) as TriggerResponse;

      if (data.success && data.emails) {
        const { addEmail } = useEmailStore.getState();

        for (const email of data.emails) {
          addEmail(email as Parameters<typeof addEmail>[0]);
        }

        toast.success(`Demo: ${data.count} E-Mail(s) gesendet`);
      } else {
        toast.error(data.error ?? "Demo-Trigger fehlgeschlagen");
      }
    } catch {
      toast.error("Server nicht erreichbar");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <span className="mr-2 text-xs font-medium text-muted-foreground">
        DEMO
      </span>
      {DEMO_BUTTONS.map(({ label, scenario }) => (
        <Button
          key={scenario}
          variant="outline"
          size="sm"
          disabled={loading !== null}
          onClick={() => void handleTrigger(scenario)}
        >
          {loading === scenario && (
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
          )}
          {label}
        </Button>
      ))}
    </div>
  );
}
