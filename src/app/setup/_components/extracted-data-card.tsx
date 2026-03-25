"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { ExtractedBusinessData } from "@/types";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

interface ExtractedDataCardProps {
  extracted: ExtractedBusinessData;
}

export function ExtractedDataCard({ extracted }: ExtractedDataCardProps) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <section>
      <Collapsible defaultOpen onOpenChange={setIsOpen}>
        <Card className="gap-0 border border-border/70 bg-card shadow-none">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 px-4 text-left transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
            >
              <div className="min-w-0">
                <CardTitle className="text-sm">
                  {extracted.businessName || "Business info"}
                </CardTitle>
              </div>
              <div className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                <Badge variant="secondary">Extracted</Badge>
                <span>{isOpen ? "Hide details" : "Show details"}</span>
                <ChevronDown
                  aria-hidden="true"
                  className={`size-4 transition-transform ${
                    isOpen ? "rotate-180" : "rotate-0"
                  }`}
                />
              </div>
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="max-h-64 space-y-1.5 overflow-y-auto pb-4 pt-3 pr-1 text-sm text-muted-foreground">
              {extracted.businessType && (
                <p>
                  <span className="text-foreground">Type:</span>{" "}
                  {extracted.businessType}
                </p>
              )}
              {extracted.services?.length > 0 && (
                <p>
                  <span className="text-foreground">Services:</span>{" "}
                  {extracted.services
                    .map((s) => `${s.name}${s.price ? ` — ${s.price}` : ""}`)
                    .join(", ")}
                </p>
              )}
              {extracted.hours && (
                <p>
                  <span className="text-foreground">Hours:</span>{" "}
                  {extracted.hours}
                </p>
              )}
              {extracted.phone && (
                <p>
                  <span className="text-foreground">Phone:</span>{" "}
                  {extracted.phone}
                </p>
              )}
              {extracted.location && (
                <p>
                  <span className="text-foreground">Location:</span>{" "}
                  {extracted.location}
                </p>
              )}
              {extracted.tone && (
                <p>
                  <span className="text-foreground">Tone:</span>{" "}
                  {extracted.tone}
                </p>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </section>
  );
}
