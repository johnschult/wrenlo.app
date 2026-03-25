import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("setup.success");
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <Card className="w-full max-w-md border border-border/70 bg-card p-4 text-center shadow-none">
        <CardHeader className="gap-2 pb-2">
          <div className="text-4xl">🎉</div>
          <CardTitle className="text-2xl font-bold">
            {isEdit ? t("savedTitle") : t("liveTitle")}
          </CardTitle>
          <p className="text-muted-foreground">
            {t("description")}
          </p>
        </CardHeader>
        <CardContent className="space-y-6 text-left">
          <div className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground mb-1">
                {t("widgetUrl")}
              </p>
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
              <p className="text-xs text-muted-foreground mb-1">
                {t("dashboard")}
              </p>
              <Link
                href={success.dashboardUrl}
                className="text-primary text-sm"
              >
                {`${window.location.origin}${success.dashboardUrl}`}
              </Link>
            </div>
          </div>
          <Button asChild className="h-11 w-full">
            <Link href={success.dashboardUrl}>{t("goToDashboard")}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
