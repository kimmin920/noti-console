import { createDefaultNhnKakaoBizmessageWebhookReceiver } from '@/server/nhn/kakaoBizmessageWebhookReceiver.js';

export const runtime = 'nodejs';

export async function POST(request) {
  return createDefaultNhnKakaoBizmessageWebhookReceiver().handleRequest(request);
}
