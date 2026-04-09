import { Badge } from "@/components/ui/badge";
import type { UnsubscribeStatus } from "@/types/email";

type UnsubscribeMethodBadgeProps = {
  readonly method: UnsubscribeStatus["unsubscribe_method"];
};

const METHOD_LABELS: Record<UnsubscribeStatus["unsubscribe_method"], string> = {
  "one-click": "One-Click",
  mailto: "Mailto",
  "not-found": "Nicht gefunden",
};

export function UnsubscribeMethodBadge({
  method,
}: UnsubscribeMethodBadgeProps) {
  return <Badge variant="secondary">{METHOD_LABELS[method]}</Badge>;
}
