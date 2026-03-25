"use client";

const INPUT_CLS =
  "w-full bg-(--surface) border border-(--border-strong) rounded-xl px-4 py-2.5 text-sm placeholder-(--text-muted) focus:outline-none focus:border-brand";

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
  return (
    <section className="border-t border-(--border) pt-6">
      <h3 className="font-semibold mb-3">
        {isEdit ? "Save changes" : "Go live"}
      </h3>
      <div className="space-y-3">
        <div>
          <label
            htmlFor="bizName"
            className="text-xs text-(--text-secondary) mb-1 block"
          >
            Business name
          </label>
          <input
            id="bizName"
            type="text"
            value={bizName}
            onChange={(e) => onBizNameChange(e.target.value)}
            placeholder="Your Business Name"
            disabled={analyzing}
            className={`${INPUT_CLS} disabled:opacity-50`}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="ownerName"
              className="text-xs text-(--text-secondary) mb-1 block"
            >
              Your name
            </label>
            <input
              id="ownerName"
              type="text"
              value={ownerName}
              onChange={(e) => onOwnerNameChange(e.target.value)}
              placeholder="Optional"
              disabled={analyzing}
              className={`${INPUT_CLS} disabled:opacity-50`}
            />
          </div>
          <div>
            <label
              htmlFor="ownerEmail"
              className="text-xs text-(--text-secondary) mb-1 block"
            >
              Email
            </label>
            <input
              id="ownerEmail"
              type="email"
              value={ownerEmail}
              onChange={(e) => onOwnerEmailChange(e.target.value)}
              placeholder="Optional"
              disabled={analyzing}
              className={`${INPUT_CLS} disabled:opacity-50`}
            />
          </div>
        </div>
        <button
          onClick={onGoLive}
          disabled={analyzing || goingLive}
          className="w-full bg-brand hover:bg-brand-hover disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors"
          type="button"
        >
          {goingLive
            ? isEdit ? "Saving…" : "Going live…"
            : isEdit
            ? "Save Changes"
            : "Go Live"}
        </button>
      </div>
    </section>
  );
}
