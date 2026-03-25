"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslations } from "next-intl";

interface GoLiveFormProps {
  bizName: string;
  onBizNameChange: (value: string) => void;
  ownerName: string;
  onOwnerNameChange: (value: string) => void;
  ownerEmail: string;
  onOwnerEmailChange: (value: string) => void;
  onGoLive: () => void;
  goingLive: boolean;
  analyzing: boolean;
  isEdit: boolean;
}

export function GoLiveForm({
  bizName,
  onBizNameChange,
  ownerName,
  onOwnerNameChange,
  ownerEmail,
  onOwnerEmailChange,
  onGoLive,
  goingLive,
  analyzing,
  isEdit,
}: GoLiveFormProps) {
  const t = useTranslations("setup.goLive");
  return (
    <section className="border-t border-border pt-6">
      <h3 className="font-semibold mb-3">
        {isEdit ? t("saveChangesTitle") : t("goLiveTitle")}
      </h3>
      <div className="space-y-3">
        <div>
          <Label
            htmlFor="bizName"
            className="mb-1 text-xs text-muted-foreground"
          >
            {t("businessName")}
          </Label>
          <Input
            id="bizName"
            type="text"
            value={bizName}
            onChange={(e) => onBizNameChange(e.target.value)}
            placeholder={t("businessNamePlaceholder")}
            disabled={analyzing}
            className="h-11 bg-card"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label
              htmlFor="ownerName"
              className="mb-1 text-xs text-muted-foreground"
            >
              {t("yourName")}
            </Label>
            <Input
              id="ownerName"
              type="text"
              value={ownerName}
              onChange={(e) => onOwnerNameChange(e.target.value)}
              placeholder={t("optional")}
              disabled={analyzing}
              className="h-11 bg-card"
            />
          </div>
          <div>
            <Label
              htmlFor="ownerEmail"
              className="mb-1 text-xs text-muted-foreground"
            >
              {t("email")}
            </Label>
            <Input
              id="ownerEmail"
              type="email"
              value={ownerEmail}
              onChange={(e) => onOwnerEmailChange(e.target.value)}
              placeholder={t("optional")}
              disabled={analyzing}
              className="h-11 bg-card"
            />
          </div>
        </div>
        <Button
          onClick={onGoLive}
          disabled={analyzing || goingLive}
          className="h-11 w-full"
          type="button"
        >
          {goingLive
            ? isEdit ? t("saving") : t("goingLive")
            : isEdit
            ? t("saveChanges")
            : t("goLive")}
        </Button>
      </div>
    </section>
  );
}
