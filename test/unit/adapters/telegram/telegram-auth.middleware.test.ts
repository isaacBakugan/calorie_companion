import { describe, expect, it, vi } from 'vitest';
import {
  authenticateTelegramRequest,
  isAllowedTelegramUserId,
} from '@adapters/inbound/telegram/telegram-auth.middleware';

vi.mock('@shared/config/env', () => ({
  TELEGRAM_WEBHOOK_SECRET_ENV_VAR: 'TELEGRAM_WEBHOOK_SECRET_PARAM_NAME',
  TEST_API_KEY_ENV_VAR: 'TEST_API_KEY_PARAM_NAME',
  ALLOWED_TELEGRAM_USER_IDS_ENV_VAR: 'ALLOWED_TELEGRAM_USER_IDS_PARAM_NAME',
  getSecret: vi.fn(async (envVarName: string) => {
    if (envVarName === 'TELEGRAM_WEBHOOK_SECRET_PARAM_NAME') return 'telegram-secret-value';
    if (envVarName === 'TEST_API_KEY_PARAM_NAME') return 'test-api-key-value';
    if (envVarName === 'ALLOWED_TELEGRAM_USER_IDS_PARAM_NAME') return '111111, 222222';
    throw new Error(`env var inesperado: ${envVarName}`);
  }),
}));

describe('authenticateTelegramRequest', () => {
  it('autentica por el header de Telegram cuando matchea el secret_token', async () => {
    const result = await authenticateTelegramRequest({
      'x-telegram-bot-api-secret-token': 'telegram-secret-value',
    });
    expect(result).toEqual({ authenticated: true, source: 'telegram' });
  });

  it('autentica por el header de test cuando matchea el api key', async () => {
    const result = await authenticateTelegramRequest({ 'x-api-key': 'test-api-key-value' });
    expect(result).toEqual({ authenticated: true, source: 'test' });
  });

  it('rechaza cuando no viene ninguno de los dos headers', async () => {
    const result = await authenticateTelegramRequest({});
    expect(result).toEqual({ authenticated: false, source: null });
  });

  it('rechaza cuando los headers vienen con valores incorrectos', async () => {
    const result = await authenticateTelegramRequest({
      'x-telegram-bot-api-secret-token': 'valor-incorrecto',
      'x-api-key': 'otro-valor-incorrecto',
    });
    expect(result).toEqual({ authenticated: false, source: null });
  });
});

describe('isAllowedTelegramUserId', () => {
  it('permite un ID que está en la whitelist', async () => {
    expect(await isAllowedTelegramUserId('111111')).toBe(true);
  });

  it('permite un ID con espacios alrededor en el parámetro de SSM', async () => {
    expect(await isAllowedTelegramUserId('222222')).toBe(true);
  });

  it('rechaza un ID que no está en la whitelist', async () => {
    expect(await isAllowedTelegramUserId('999999')).toBe(false);
  });
});
