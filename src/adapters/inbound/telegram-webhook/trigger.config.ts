import type { TriggerConfig } from '@shared/types/trigger-config';

export const triggerConfig = {
  functionName: 'telegram-webhook',
  memorySize: 256,
  timeoutSeconds: 30,
  trigger: 'http',
  method: 'POST',
  path: '/telegram/webhook',
  requiresTestApiKey: true,
} satisfies TriggerConfig;
