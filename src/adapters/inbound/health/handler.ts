import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { getConfig } from '@shared/config/env';

/**
 * Sin dependencias de secretos ni llamadas a AWS: solo confirma que el
 * Lambda está desplegado, enrutado por API Gateway y con los env vars
 * de CDK inyectados. `getConfig()` ya falla fuerte si TABLE_NAME/BUCKET_NAME
 * no llegaron — eso alcanza para detectar un problema de wiring de infra.
 */
export const handler: APIGatewayProxyHandlerV2 = async () => {
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
