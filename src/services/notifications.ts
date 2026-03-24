import type { Business, Conversation, OwnerNotification } from '../types/index.js';

// ── Channel interface ──────────────────────────────────────────────────────────

interface NotificationChannel {
  send(notification: OwnerNotification): Promise<void>;
}

// ── Console channel (always active — good for dev/logging) ────────────────────

class ConsoleChannel implements NotificationChannel {
  async send(n: OwnerNotification): Promise<void> {
    const sep = '─'.repeat(60);
    console.log(`\n${sep}`);
    console.log(`🔔  LEAD ALERT — ${n.businessName}`);
    console.log(sep);
    console.log(`  Conversation : ${n.conversationId}`);
    console.log(`  Owner        : ${n.ownerName ?? 'N/A'}`);
    console.log(`  Trigger      : ${n.triggerReason}`);
    console.log(`  Summary      : ${n.customerSummary}`);
    console.log(`  Claim URL    : ${n.claimUrl}`);
    console.log(`  Time         : ${n.timestamp}`);
    console.log(`${sep}\n`);
  }
}

// ── Webhook channel ───────────────────────────────────────────────────────────

class WebhookChannel implements NotificationChannel {
  constructor(private readonly webhookUrl: string) {}

  async send(notification: OwnerNotification): Promise<void> {
    const response = await fetch(this.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(notification),
    });

    if (!response.ok) {
      throw new Error(`Webhook delivery failed: ${response.status} ${response.statusText}`);
    }
  }
}

// ── Future: SMS channel stub (Twilio) ─────────────────────────────────────────
//
// class SmsChannel implements NotificationChannel {
//   constructor(private readonly toPhone: string) {}
//   async send(n: OwnerNotification): Promise<void> {
//     const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
//     await client.messages.create({
//       body: `🔔 New lead at ${n.businessName}: ${n.customerSummary} — Claim: ${n.claimUrl}`,
//       from: process.env.TWILIO_FROM_NUMBER,
//       to: this.toPhone,
//     });
//   }
// }

// ── NotificationService ────────────────────────────────────────────────────────

function buildCustomerSummary(conversation: Conversation, recentMessage: string): string {
  const lines: string[] = [];
  if (recentMessage) lines.push(`Latest message: "${recentMessage}"`);
  lines.push(`Channel: ${conversation.channel}`);
  lines.push(`Conversation started: ${conversation.started_at}`);
  lines.push(`Lead score: ${conversation.lead_score}`);
  return lines.join(' | ');
}

function buildClaimUrl(conversationId: string): string {
  const base = process.env.BASE_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;
  return `${base}/conversations/${conversationId}/claim`;
}

export class NotificationService {
  private readonly channels: NotificationChannel[];

  constructor(business: Business) {
    // Console channel is always enabled (acts as audit log)
    this.channels = [new ConsoleChannel()];

    if (business.owner_notification_webhook) {
      this.channels.push(new WebhookChannel(business.owner_notification_webhook));
    }

    // Future: SMS channel would be added here when Twilio creds are present
  }

  async sendLeadAlert(
    business: Business,
    conversation: Conversation,
    triggerReason: string,
    recentCustomerMessage: string,
  ): Promise<void> {
    const notification: OwnerNotification = {
      businessId: business.id,
      businessName: business.name,
      ownerName: business.owner_name,
      conversationId: conversation.id,
      customerSummary: buildCustomerSummary(conversation, recentCustomerMessage),
      triggerReason,
      claimUrl: buildClaimUrl(conversation.id),
      timestamp: new Date().toISOString(),
    };

    await Promise.allSettled(
      this.channels.map((ch) =>
        ch.send(notification).catch((err: unknown) => {
          console.error(`[notifications] channel delivery error:`, err);
        }),
      ),
    );
  }
}
