"use client";

import { RotateCw } from "lucide-react";

const INPUT_CLS =
  "w-full bg-(--surface) border border-(--border-strong) rounded-xl px-4 py-2.5 text-sm placeholder-(--text-muted) focus:outline-none focus:border-brand";

interface UrlEntry {
  id: string;
  value: string;
}

interface UrlFieldsProps {
  urls: UrlEntry[];
  onUrlChange: (index: number, value: string) => void;
  onAddUrl: () => void;
  onAnalyze: () => void;
  analyzing: boolean;
  error: string;
  buttonLabel: string;
}

function UrlFields({
  urls,
  onUrlChange,
  onAddUrl,
  onAnalyze,
  analyzing,
  error,
  buttonLabel,
}: UrlFieldsProps) {
  return (
    <>
      <div className="space-y-2 mb-3">
        {urls.map((entry, i) => (
          <input
            key={entry.id}
            type="url"
            value={entry.value}
            onChange={(e) => onUrlChange(i, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onAnalyze();
            }}
            placeholder={i === 0
              ? "https://yourbusiness.com"
              : "https://another-page.com"}
            disabled={analyzing}
            className={`${INPUT_CLS} disabled:opacity-50`}
          />
        ))}
      </div>
      {urls.length < 5 && (
        <button
          onClick={onAddUrl}
          disabled={analyzing}
          className="text-xs text-brand mb-3 hover:text-brand-light disabled:opacity-50"
          type="button"
        >
          + Add another URL
        </button>
      )}
      {error && <p className="text-red-400 text-xs mb-3">{error}</p>}
      <button
        onClick={onAnalyze}
        disabled={analyzing}
        className="w-full bg-brand  hover:bg-brand-hover disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors"
        type="button"
      >
        {analyzing
          ? (
            <div className="flex items-center justify-center gap-1">
              <RotateCw className="animate-spin mr-2" size={16} />
              Analyzing…
            </div>
          )
          : buttonLabel}
      </button>
    </>
  );
}

interface UrlAnalyzerProps {
  urls: UrlEntry[];
  onUrlChange: (index: number, value: string) => void;
  onAddUrl: () => void;
  onAnalyze: () => void;
  analyzing: boolean;
  error: string;
  isEdit: boolean;
}

export function UrlAnalyzer({
  urls,
  onUrlChange,
  onAddUrl,
  onAnalyze,
  analyzing,
  error,
  isEdit,
}: UrlAnalyzerProps) {
  return (
    <section>
      <h2 className="text-xl font-bold mb-1">
        {isEdit ? "Edit your AI front desk" : "Set up your AI front desk"}
      </h2>
      <p className="text-(--text-secondary) text-sm mb-4">
        {isEdit
          ? "Refine your AI or analyze new URLs to update it."
          : "Paste your business URL and we'll build your AI from it."}
      </p>
      {isEdit
        ? (
          <details className="mb-2">
            <summary className="text-xs text-brand cursor-pointer select-none hover:text-brand-light mb-3">
              Re-analyze from URLs
            </summary>
            <div className="mt-3">
              <UrlFields
                urls={urls}
                onUrlChange={onUrlChange}
                onAddUrl={onAddUrl}
                onAnalyze={onAnalyze}
                analyzing={analyzing}
                error={error}
                buttonLabel="Re-analyze"
              />
            </div>
          </details>
        )
        : (
          <UrlFields
            urls={urls}
            onUrlChange={onUrlChange}
            onAddUrl={onAddUrl}
            onAnalyze={onAnalyze}
            analyzing={analyzing}
            error={error}
            buttonLabel="Analyze My Business"
          />
        )}
    </section>
  );
}
