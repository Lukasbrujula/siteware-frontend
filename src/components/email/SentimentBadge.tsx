import { cn } from "@/lib/utils";
import {
  getSentimentColor,
  getSentimentTextColor,
  getSentimentLabel,
  clampPercent,
} from "@/lib/sentiment-helpers";

type SentimentBadgeProps = {
  readonly score: number;
};

export function SentimentBadge({ score }: SentimentBadgeProps) {
  const percent = clampPercent(score);
  const barColor = getSentimentColor(score);
  const textColor = getSentimentTextColor(score);
  const label = getSentimentLabel(score);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">Stimmung</span>
        <span className={cn("text-xs font-medium", textColor)}>
          {score.toFixed(1)} &mdash; {label}
        </span>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-muted"
        role="meter"
        aria-valuenow={score}
        aria-valuemin={-1}
        aria-valuemax={1}
        aria-label={`Stimmungswert: ${score.toFixed(1)}`}
      >
        <div
          className={cn("h-full rounded-full transition-all", barColor)}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
