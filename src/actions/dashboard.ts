'use server';

import { auth } from '@clerk/nextjs/server';
import {
  addMessage,
  claimConversation,
  releaseConversation,
  touchConversation,
} from '../services/business';

export async function claimConversationAction(
  conversationId: string,
  claimedBy = 'Owner'
) {
  await auth.protect();
  claimConversation(conversationId, claimedBy);
}

export async function releaseConversationAction(conversationId: string) {
  await auth.protect();
  releaseConversation(conversationId);
}

export async function sendOwnerMessageAction(
  conversationId: string,
  message: string,
  senderName = 'Owner'
) {
  await auth.protect();
  addMessage(conversationId, 'owner', `[${senderName}]: ${message}`);
  touchConversation(conversationId);
}
