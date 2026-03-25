"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { ExtractedBusinessData } from "@/types";

interface ExtractedDataCardProps {
  extracted: ExtractedBusinessData;
}

export function ExtractedDataCard({ extracted }: ExtractedDataCardProps) {
  return (
    <section>
      <Collapsible defaultOpen>
        <Card className="gap-0 border border-border/70 bg-card shadow-none">
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer select-none">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-sm">
                  {extracted.businessName || "Business info"}
                </CardTitle>
                <Badge variant="secondary">Extracted</Badge>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-1.5 pb-4 text-sm text-muted-foreground">
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
