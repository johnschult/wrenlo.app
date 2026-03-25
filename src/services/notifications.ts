import type { Business, Conversation, OwnerNotification } from '../types';

interface NotificationChannel {
  send(notification: OwnerNotification): Promise<void>;
}

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

function buildCustomerSummary(conversation: Conversation, recentMessage: string): string {
  const lines: string[] = [];
  if (recentMessage) lines.push(`Latest message: "${recentMessage}"`);
  lines.push(`Channel: ${conversation.channel}`);
  lines.push(`Conversation started: ${conversation.startedAt}`);
  lines.push(`Lead score: ${conversation.leadScore}`);
  return lines.join(' | ');
}

function buildClaimUrl(businessId: string): string {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000';
  return `${base}/owner/${businessId}`;
}

export class NotificationService {
  private readonly channels: NotificationChannel[];

  constructor(business: Business) {
    this.channels = [new ConsoleChannel()];
    if (business.ownerNotificationWebhook) {
      this.channels.push(new WebhookChannel(business.ownerNotificationWebhook));
    }
  }

  async sendLeadAlert(
    business: Business,
    conversation: Conversation,
    triggerReason: string,
    recentCustomerMessage: string
  ): Promise<void> {
    const notification: OwnerNotification = {
      businessId: business.id,
      businessName: business.name,
      ownerName: business.ownerName,
      conversationId: conversation.id,
      customerSummary: buildCustomerSummary(conversation, recentCustomerMessage),
      triggerReason,
      claimUrl: buildClaimUrl(business.id),
      timestamp: new Date().toISOString(),
    };

    await Promise.allSettled(
      this.channels.map((ch) =>
        ch.send(notification).catch((err: unknown) => {
          console.error('[notifications] channel delivery error:', err);
        })
      )
    );
  }
}
