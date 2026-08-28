import { getSecret, TEST_API_KEY_ENV_VAR } from '@shared/config/env';

/**
 * Autenticación mínima para pegarle a un endpoint a mano (curl/Postman) sin
 * pasar por Telegram. Un solo secreto compartido por todos los endpoints que
 * lo necesiten (ver `requiresTestApiKey` en trigger-config.ts) — a esta
 * escala no hay razón para uno distinto por función.
 */
export async function isValidTestApiKey(headers: Record<string, string | undefined>): Promise<boolean> {
  const testApiKey = await getSecret(TEST_API_KEY_ENV_VAR);
  return headers['x-api-key'] === testApiKey;
}
