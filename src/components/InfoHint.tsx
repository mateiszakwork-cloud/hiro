import { HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface InfoHintProps {
  label: string;
  size?: number;
  className?: string;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
}

/**
 * Subtle contextual help icon. Use sparingly next to labels, tabs, or
 * controls where the user may wonder what something does.
 */
export const InfoHint = ({ label, size = 13, className, side = "top", align = "center" }: InfoHintProps) => {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={(e) => e.stopPropagation()}
            aria-label={label}
            className={cn(
              "inline-flex items-center justify-center text-muted-foreground/60 hover:text-foreground transition-colors",
              className,
            )}
          >
            <HelpCircle style={{ width: size, height: size }} strokeWidth={1.75} />
          </button>
        </TooltipTrigger>
        <TooltipContent side={side} align={align} className="max-w-[260px] text-xs leading-snug">
          {label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default InfoHint;