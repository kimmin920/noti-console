import { createDefaultNhnSmsWebhookReceiver } from '@/server/nhn/smsWebhookReceiver.js';

export const runtime = 'nodejs';

export async function POST(request) {
  return createDefaultNhnSmsWebhookReceiver().handleRequest(request);
}
