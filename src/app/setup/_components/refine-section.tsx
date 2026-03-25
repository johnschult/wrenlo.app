"use client";

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
      <p className="text-(--text-secondary) text-xs mb-3">
        Chat with the preview, then tell it what to change.
      </p>
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {chips.map((c, i) => (
            <span
              key={`chip-${i}-${c}`}
              className="text-xs bg-(--surface) border border-(--border-strong) px-2.5 py-1 rounded-full text-(--text-secondary)"
            >
              {c}
            </span>
          ))}
        </div>
      )}
      {error && <p className="text-red-400 text-xs mb-2">{error}</p>}
      <div className="flex gap-2">
        <textarea
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
          className="flex-1 bg-(--surface) border border-(--border-strong) rounded-xl px-4 py-2.5 text-sm placeholder-(--text-muted) focus:outline-none focus:border-brand resize-none disabled:opacity-50"
        />
        <button
          onClick={onRefine}
          disabled={analyzing || refining || !feedback.trim()}
          className="bg-(--surface) hover:bg-(--surface-hover) border border-(--border-strong) disabled:opacity-40 text-sm px-4 rounded-xl transition-colors whitespace-nowrap"
          type="button"
        >
          {refining ? "…" : "Refine"}
        </button>
      </div>
    </section>
  );
}
