import { format } from "date-fns";
import { Clock, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

export type DeadlineState =
  | { kind: "none" }
  | { kind: "far"; date: Date; days: number }
  | { kind: "amber"; date: Date; days: number }
  | { kind: "orange"; date: Date; days: number }
  | { kind: "red"; date: Date; days: number }
  | { kind: "overdue"; date: Date; days: number }
  | { kind: "submitted"; date: Date; days: number };

const SUBMITTED_STATUSES = new Set(["Applied", "Screening", "Interview", "Offer", "Rejected"]);

/**
 * Compute deadline state once based on current date at page load.
 */
export function computeDeadlineState(
  deadline: string | null | undefined,
  status: string,
  now: Date = new Date(),
): DeadlineState {
  if (!deadline) return { kind: "none" };
  const d = new Date(deadline + "T00:00:00");
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (days < 0) {
    if (SUBMITTED_STATUSES.has(status)) return { kind: "submitted", date: d, days };
    return { kind: "overdue", date: d, days };
  }
  if (days <= 2) return { kind: "red", date: d, days };
  if (days <= 7) return { kind: "orange", date: d, days };
  if (days <= 14) return { kind: "amber", date: d, days };
  return { kind: "far", date: d, days };
}

interface DeadlineBadgeProps {
  state: DeadlineState;
  size?: "sm" | "md";
  onEdit?: () => void;
  className?: string;
}

/**
 * Compact badge for the tracker table.
 */
export const DeadlineBadge = ({ state, size = "sm", onEdit, className }: DeadlineBadgeProps) => {
  const txtSize = size === "sm" ? "text-xs" : "text-sm";
  const padding = size === "sm" ? "px-2 py-0.5" : "px-2.5 py-1";

  if (state.kind === "none") {
    return (
      <span className={cn("inline-flex items-center gap-1 text-muted-foreground", txtSize, className)}>
        <span>–</span>
        {onEdit && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="hover:text-primary transition-colors"
            aria-label="Set deadline"
          >
            <Pencil className="h-3 w-3" />
          </button>
        )}
      </span>
    );
  }

  if (state.kind === "far") {
    return (
      <span className={cn("text-muted-foreground whitespace-nowrap", txtSize, className)}>
        {format(state.date, "MMM d")}
      </span>
    );
  }

  if (state.kind === "amber") {
    return (
      <span className={cn("inline-flex items-center rounded-full font-medium bg-amber-100 text-amber-700 whitespace-nowrap", padding, txtSize, className)}>
        {state.days} days
      </span>
    );
  }

  if (state.kind === "orange") {
    return (
      <span className={cn("inline-flex items-center gap-1 rounded-full font-medium bg-orange-100 text-orange-700 whitespace-nowrap", padding, txtSize, className)}>
        <Clock className="h-3 w-3" />
        {state.days} days
      </span>
    );
  }

  if (state.kind === "red") {
    return (
      <span
        className={cn("inline-flex items-center rounded-full font-bold text-white animate-pulse whitespace-nowrap", padding, txtSize, className)}
        style={{ backgroundColor: "#950606" }}
      >
        {state.days === 0 ? "Today!" : `${state.days} day${state.days === 1 ? "" : "s"}!`}
      </span>
    );
  }

  if (state.kind === "overdue") {
    return (
      <span className={cn("inline-flex items-center gap-1.5 rounded-full font-semibold whitespace-nowrap text-white", padding, txtSize, className)} style={{ backgroundColor: "#7a0505" }}>
        <span>Overdue</span>
        <span className="line-through opacity-80 font-normal">{format(state.date, "MMM d")}</span>
      </span>
    );
  }

  // submitted
  return (
    <span className={cn("text-muted-foreground whitespace-nowrap", txtSize, className)}>
      Submitted
    </span>
  );
};
