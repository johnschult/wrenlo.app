"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface RefineSectionProps {
  chips: string[];
  feedback: string;
  onFeedbackChange: (value: string) => void;
  onRefine: () => void;
  refining: boolean;
  analyzing: boolean;
  error: string;
}

export function RefineSection({
  chips,
  feedback,
  onFeedbackChange,
  onRefine,
  refining,
  analyzing,
  error,
}: RefineSectionProps) {
  return (
    <section>
      <h3 className="font-semibold mb-1">Refine your AI</h3>
      <p className="text-muted-foreground text-xs mb-3">
        Chat with the preview, then tell it what to change.
      </p>
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {chips.map((c, i) => (
            <Badge
              key={`chip-${i}-${c}`}
              variant="outline"
              className="font-normal text-muted-foreground"
            >
              {c}
            </Badge>
          ))}
        </div>
      )}
      {error && <p className="text-red-400 text-xs mb-2">{error}</p>}
      <div className="flex flex-col gap-3">
        <Textarea
          value={feedback}
          onChange={(e) => onFeedbackChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onRefine();
            }
          }}
          placeholder="e.g., Make it more casual, add pricing, don't mention competitors…"
          rows={2}
          disabled={analyzing}
          className="min-h-20 flex-1 resize-none bg-card"
        />
        <Button
          onClick={onRefine}
          disabled={analyzing || refining || !feedback.trim()}
          variant="outline"
          className="self-stretch h-11"
          type="button"
        >
          {refining ? "…" : "Refine"}
        </Button>
      </div>
    </section>
  );
}
