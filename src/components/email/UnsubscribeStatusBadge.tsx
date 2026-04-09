import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { UnsubscribeStatus } from "@/types/email";

type UnsubscribeStatusBadgeProps = {
  readonly status: UnsubscribeStatus["status"];
};

const STATUS_CONFIG = {
  erfolgreich: {
    label: "Erfolgreich",
    className: "bg-green-100 text-green-800 border-green-200",
  },
  "nicht erfolgreich": {
    label: "Fehlgeschlagen",
    className: "bg-red-100 text-red-800 border-red-200",
  },
} as const satisfies Record<
  UnsubscribeStatus["status"],
  { label: string; className: string }
>;

export function UnsubscribeStatusBadge({
  status,
}: UnsubscribeStatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  return (
    <Badge variant="outline" className={cn(config.className)}>
      {config.label}
    </Badge>
  );
}
