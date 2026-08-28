export interface BaseTriggerConfig {
  /** Usado para el nombre del Lambda y como id del construct (se pasa a PascalCase). */
  readonly functionName: string;
  readonly memorySize?: number;
  readonly timeoutSeconds?: number;
  /**
   * Si este Lambda necesita leer el parámetro SSM de test-api-key para
   * autenticar pruebas manuales (ver src/shared/auth/test-api-key.ts).
   * Declarativo a propósito: así infra/ no tiene que conocer nombres de
   * función para decidir a quién dárselo.
   */
  readonly requiresTestApiKey?: boolean;
  /**
   * Si este Lambda necesita leer la whitelist de IDs de Telegram autorizados
   * (ver isAllowedTelegramUserId en telegram-auth.middleware.ts). Solo lo
   * necesita telegram-webhook.
   */
  readonly requiresTelegramUserWhitelist?: boolean;
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
