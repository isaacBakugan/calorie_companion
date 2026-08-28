import { getSecret, TELEGRAM_WEBHOOK_SECRET_ENV_VAR, TEST_API_KEY_ENV_VAR } from '@shared/config/env';

export type AuthSource = 'telegram' | 'test';

export interface AuthResult {
  readonly authenticated: boolean;
  readonly source: AuthSource | null;
}

/**
 * Dos vías de acceso válidas al webhook, sin WAF ni Lambda Authorizer:
 * - `x-telegram-bot-api-secret-token`: el secret_token configurado en
 *   `setWebhook`, reutiliza el mismo parámetro SSM que ya existía
 *   (`telegram-webhook-secret`) — no tiene sentido un segundo parámetro
 *   para el mismo propósito.
 * - `x-api-key`: para probar el endpoint a mano con curl/Postman, sin
 *   pasar por Telegram.
 * Ninguno de los dos matchea -> no autenticado. El caller decide qué hacer
 * (401 antes de tocar Dynamo/OpenAI).
 */
export async function authenticateTelegramRequest(
  headers: Record<string, string | undefined>,
): Promise<AuthResult> {
  const telegramSecretToken = await getSecret(TELEGRAM_WEBHOOK_SECRET_ENV_VAR);
  if (headers['x-telegram-bot-api-secret-token'] === telegramSecretToken) {
    return { authenticated: true, source: 'telegram' };
  }

  const testApiKey = await getSecret(TEST_API_KEY_ENV_VAR);
  if (headers['x-api-key'] === testApiKey) {
    return { authenticated: true, source: 'test' };
  }

  return { authenticated: false, source: null };
}
