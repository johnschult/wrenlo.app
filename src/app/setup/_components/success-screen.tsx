import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export interface SuccessData {
  businessId: string;
  widgetUrl: string;
  dashboardUrl: string;
}

interface SuccessScreenProps {
  success: SuccessData;
  isEdit: boolean;
}

export function SuccessScreen({ success, isEdit }: SuccessScreenProps) {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <Card className="w-full max-w-md border border-border/70 bg-card p-4 text-center shadow-none">
        <CardHeader className="gap-2 pb-2">
          <div className="text-4xl">🎉</div>
          <CardTitle className="text-2xl font-bold">
            {isEdit ? "Changes saved!" : "You're live!"}
          </CardTitle>
          <p className="text-muted-foreground">
            Your AI front desk is ready. Share the widget link or embed it on
            your site.
          </p>
        </CardHeader>
        <CardContent className="space-y-6 text-left">
          <div className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Widget URL</p>
              <a
                href={success.widgetUrl}
                target="_blank"
                rel="noreferrer"
                className="text-primary text-sm break-all"
              >
                {`${window.location.origin}${success.widgetUrl}`}
              </a>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Dashboard</p>
              <Link
                href={success.dashboardUrl}
                className="text-primary text-sm"
              >
                {`${window.location.origin}${success.dashboardUrl}`}
              </Link>
            </div>
          </div>
          <Button asChild className="h-11 w-full">
            <Link href={success.dashboardUrl}>Go to Dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
