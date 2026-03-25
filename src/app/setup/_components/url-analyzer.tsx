"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { ChevronRight, RotateCw } from "lucide-react";

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
          <Input
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
            className="h-11 bg-card"
          />
        ))}
      </div>
      {urls.length < 5 && (
        <Button
          onClick={onAddUrl}
          disabled={analyzing}
          variant="ghost"
          size="sm"
          className="mb-3 px-0 text-primary hover:text-primary"
          type="button"
        >
          + Add another URL
        </Button>
      )}
      {error && <p className="text-red-400 text-xs mb-3">{error}</p>}
      <Button
        onClick={onAnalyze}
        disabled={analyzing}
        className="h-11 w-full"
        type="button"
      >
        {analyzing
          ? (
            <div className="flex items-center justify-center gap-2">
              <RotateCw className="animate-spin" size={16} />
              Analyzing…
            </div>
          )
          : buttonLabel}
      </Button>
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
  const [isOpen, setIsOpen] = useState(false);

  return (
    <section>
      <h2 className="text-xl font-bold mb-1">
        {isEdit ? "Edit your AI front desk" : "Set up your AI front desk"}
      </h2>
      <p className="text-muted-foreground text-sm mb-4">
        {isEdit
          ? "Refine your AI or analyze new URLs to update it."
          : "Paste your business URL and we'll build your AI from it."}
      </p>
      {isEdit
        ? (
          <Collapsible className="mb-2" open={isOpen} onOpenChange={setIsOpen}>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="mb-3 px-0 text-xs text-primary hover:text-primary"
              >
                <ChevronRight
                  className={`mr-1 h-3.5 w-3.5 transition-transform ${
                    isOpen ? "rotate-90" : ""
                  }`}
                />
                Re-analyze from URLs
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3">
              <UrlFields
                urls={urls}
                onUrlChange={onUrlChange}
                onAddUrl={onAddUrl}
                onAnalyze={onAnalyze}
                analyzing={analyzing}
                error={error}
                buttonLabel="Re-analyze"
              />
            </CollapsibleContent>
          </Collapsible>
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
