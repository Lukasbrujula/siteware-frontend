import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type RiskFlagsProps = {
  readonly complaintRisk: boolean;
  readonly legalThreat: boolean;
  readonly churnRisk: "low" | "medium" | "high";
};

const CHURN_CONFIG = {
  low: {
    label: "Abwanderung: Gering",
    className: "border-yellow-300 bg-yellow-50 text-yellow-800",
  },
  medium: {
    label: "Abwanderung: Mittel",
    className: "border-orange-300 bg-orange-50 text-orange-800",
  },
  high: {
    label: "Abwanderung: Hoch",
    className: "border-red-300 bg-red-50 text-red-800",
  },
} as const;

export function RiskFlags({
  complaintRisk,
  legalThreat,
  churnRisk,
}: RiskFlagsProps) {
  const flags: readonly {
    readonly key: string;
    readonly label: string;
    readonly className: string;
  }[] = [
    ...(legalThreat
      ? [
          {
            key: "legal",
            label: "Rechtliche Drohung",
            className: "border-red-400 bg-red-100 text-red-900",
          },
        ]
      : []),
    ...(complaintRisk
      ? [
          {
            key: "complaint",
            label: "Beschwerde",
            className: "border-orange-300 bg-orange-50 text-orange-800",
          },
        ]
      : []),
    {
      key: "churn",
      label: CHURN_CONFIG[churnRisk].label,
      className: CHURN_CONFIG[churnRisk].className,
    },
  ];

  return (
    <div className="flex flex-wrap gap-1.5">
      {flags.map((flag) => (
        <Badge
          key={flag.key}
          variant="outline"
          className={cn("text-[11px]", flag.className)}
        >
          {flag.label}
        </Badge>
      ))}
    </div>
  );
}
