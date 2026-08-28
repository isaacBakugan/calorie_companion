export interface BaseTriggerConfig {
  /** Usado para el nombre del Lambda y como id del construct (se pasa a PascalCase). */
  readonly functionName: string;
  readonly memorySize?: number;
  readonly timeoutSeconds?: number;
}

export interface HttpTriggerConfig extends BaseTriggerConfig {
  readonly trigger: 'http';
  readonly method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  readonly path: string;
}

export interface ScheduleTriggerConfig extends BaseTriggerConfig {
  readonly trigger: 'schedule';
  /** Expresión rate() o cron() de EventBridge. */
  readonly cronExpression: string;
}

/**
 * Contrato entre un adapter inbound y la infra. Cada carpeta en
 * src/adapters/inbound/<nombre>/ que exporte un `triggerConfig` que
 * satisfaga este tipo desde su trigger.config.ts se despliega como un
 * Lambda — sin tocar infra/. Agregar un tipo de trigger nuevo (sqs, s3,
 * etc.) es agregar una variante acá + su rama en el stack que arma los
 * triggers.
 */
export type TriggerConfig = HttpTriggerConfig | ScheduleTriggerConfig;
