import type { ExtractedBusinessData } from "@/src/types";

interface ExtractedDataCardProps {
  extracted: ExtractedBusinessData;
}

export function ExtractedDataCard({ extracted }: ExtractedDataCardProps) {
  return (
    <section>
      <details className="bg-(--surface) border border-(--border-strong) rounded-xl overflow-hidden">
        <summary className="flex items-center justify-between px-4 py-3 cursor-pointer select-none">
          <span className="font-medium text-sm">
            {extracted.businessName || "Business info"}
          </span>
          <span className="text-xs bg-brand/20 text-brand px-2 py-0.5 rounded-full">
            Extracted
          </span>
        </summary>
        <div className="px-4 pb-4 text-sm space-y-1.5 text-(--text-secondary)">
          {extracted.businessType && (
            <p>
              <span className="text-(--text)">Type:</span>{" "}
              {extracted.businessType}
            </p>
          )}
          {extracted.services?.length > 0 && (
            <p>
              <span className="text-(--text)">Services:</span>{" "}
              {extracted.services
                .map((s) => `${s.name}${s.price ? ` — ${s.price}` : ""}`)
                .join(", ")}
            </p>
          )}
          {extracted.hours && (
            <p>
              <span className="text-(--text)">Hours:</span> {extracted.hours}
            </p>
          )}
          {extracted.phone && (
            <p>
              <span className="text-(--text)">Phone:</span> {extracted.phone}
            </p>
          )}
          {extracted.location && (
            <p>
              <span className="text-(--text)">Location:</span>{" "}
              {extracted.location}
            </p>
          )}
          {extracted.tone && (
            <p>
              <span className="text-(--text)">Tone:</span> {extracted.tone}
            </p>
          )}
        </div>
      </details>
    </section>
  );
}
