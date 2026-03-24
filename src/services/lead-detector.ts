import type { Business, LeadDetectionResult } from '../types/index.js';

// Signals in the AI's own response that indicate it is handing off to the owner.
const AI_HANDOFF_PATTERNS = [
  /let me connect you with/i,
  /i('ll| will) have (our|the) (owner|team|staff)/i,
  /i('ll| will) (pass|transfer) you/i,
  /our owner (will|can)/i,
  /speak with (our|the) owner/i,
  /get you in touch with/i,
  /connect you with jing/i,
];

const LEAD_THRESHOLD = 3;

export function detectLead(
  customerMessage: string,
  aiResponse: string,
  business: Business,
): LeadDetectionResult {
  const signals: string[] = [];
  let leadScore = 0;

  // 1. Keyword matching on the customer's message
  let keywords: string[] = [];
  try {
    keywords = JSON.parse(business.handoff_keywords) as string[];
  } catch {
    keywords = ['book', 'schedule', 'appointment', 'price quote', 'how much', 'availability'];
  }

  const lowerMessage = customerMessage.toLowerCase();
  for (const kw of keywords) {
    if (lowerMessage.includes(kw.toLowerCase())) {
      leadScore += 2;
      signals.push(`customer said: "${kw}"`);
    }
  }

  // 2. AI handoff signal detection
  for (const pattern of AI_HANDOFF_PATTERNS) {
    if (pattern.test(aiResponse)) {
      leadScore += 5;
      signals.push('AI response signals owner handoff');
      break; // one AI-signal is enough
    }
  }

  const isLead = leadScore >= LEAD_THRESHOLD;
  const triggerReason = signals.length > 0
    ? signals.join('; ')
    : 'no strong signals detected';

  return { isLead, leadScore, triggerReason, signals };
}
