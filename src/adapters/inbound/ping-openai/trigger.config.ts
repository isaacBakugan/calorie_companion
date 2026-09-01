import type { TriggerConfig } from '@shared/types/trigger-config';

export const triggerConfig = {
  functionName: 'ping-openai',
  memorySize: 256,
  timeoutSeconds: 30,
  trigger: 'http',
  method: 'GET',
  path: '/ping/openai',
} satisfies TriggerConfig;
