import type { TriggerConfig } from '@shared/types/trigger-config';

export const triggerConfig = {
  functionName: 'health',
  memorySize: 128,
  timeoutSeconds: 5,
  trigger: 'http',
  method: 'GET',
  path: '/health',
  requiresTestApiKey: true,
} satisfies TriggerConfig;
