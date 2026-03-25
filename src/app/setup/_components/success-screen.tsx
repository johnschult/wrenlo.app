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
      <div className="bg-(--surface) border border-(--border-strong) rounded-2xl p-8 max-w-md w-full text-center">
        <div className="text-4xl mb-4">🎉</div>
        <h2 className="text-2xl font-bold mb-2">
          {isEdit ? "Changes saved!" : "You're live!"}
        </h2>
        <p className="text-(--text-secondary) mb-6">
          Your AI front desk is ready. Share the widget link or embed it on your
          site.
        </p>
        <div className="space-y-3 text-left mb-6">
          <div>
            <p className="text-xs text-(--text-secondary) mb-1">Widget URL</p>
            <a
              href={success.widgetUrl}
              target="_blank"
              rel="noreferrer"
              className="text-brand text-sm break-all"
            >
              {`${window.location.origin}${success.widgetUrl}`}
            </a>
          </div>
          <div>
            <p className="text-xs text-(--text-secondary) mb-1">Dashboard</p>
            <Link href={success.dashboardUrl} className="text-brand text-sm">
              {`${window.location.origin}${success.dashboardUrl}`}
            </Link>
          </div>
        </div>
        <Link
          href={success.dashboardUrl}
          className="block w-full bg-brand hover:bg-brand-hover text-white font-semibold py-3 rounded-xl transition-colors text-center"
        >
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}
