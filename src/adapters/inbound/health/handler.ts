import type { APIGatewayProxyEventV2, APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { getConfig } from '@shared/config/env';
import { isValidTestApiKey } from '@shared/auth/test-api-key';

/**
 * Ningún endpoint queda expuesto sin auth, ni siquiera este: exige el mismo
 * `x-api-key` de prueba que el resto (ver requiresTestApiKey en
 * trigger.config.ts). `getConfig()` ya falla fuerte si TABLE_NAME/BUCKET_NAME
 * no llegaron — eso alcanza para detectar un problema de wiring de infra.
 */
export const handler: APIGatewayProxyHandlerV2 = async (event: APIGatewayProxyEventV2) => {
  if (!(await isValidTestApiKey(event.headers ?? {}))) {
    return { statusCode: 401, body: '' };
  }

  const config = getConfig();

  return {
    statusCode: 200,
    body: JSON.stringify({
      status: 'ok',
      tableName: config.tableName,
      bucketName: config.bucketName,
    }),
  };
};
