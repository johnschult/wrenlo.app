import type { Business, LeadDetectionResult } from '../types';

const AI_HANDOFF_PATTERNS = [
  /let me connect you with/i,
  /i('ll| will) have (our|the) (owner|team|staff)/i,
  /i('ll| will) (pass|transfer) you/i,
  /our owner (will|can)/i,
  /speak with (our|the) owner/i,
  /get you in touch with/i,
];

const LEAD_THRESHOLD = 3;

export function detectLead(
  customerMessage: string,
  aiResponse: string,
  business: Business
): LeadDetectionResult {
  const signals: string[] = [];
  let leadScore = 0;

  let keywords: string[] = [];
  try {
    keywords = JSON.parse(business.handoffKeywords) as string[];
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

  for (const pattern of AI_HANDOFF_PATTERNS) {
    if (pattern.test(aiResponse)) {
      leadScore += 5;
      signals.push('AI response signals owner handoff');
      break;
    }
  }

  return {
    isLead: leadScore >= LEAD_THRESHOLD,
    leadScore,
    triggerReason: signals.length > 0 ? signals.join('; ') : 'no strong signals detected',
    signals,
  };
}
