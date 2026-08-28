import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';

// Nombres de los env vars que CDK inyecta con el path real del parámetro SSM
// (ver infra/lib/constructs/discovered-lambda.ts) — no el path en sí, que
// varía por stage. Se pasan a getSecret().
export const TELEGRAM_WEBHOOK_SECRET_ENV_VAR = 'TELEGRAM_WEBHOOK_SECRET_PARAM_NAME';
export const TEST_API_KEY_ENV_VAR = 'TEST_API_KEY_PARAM_NAME';

/** Config no sensible: la inyecta CDK como env var del Lambda. Segura de loguear. */
export function getConfig() {
  return {
    awsRegion: requireEnv('AWS_REGION'),
    tableName: requireEnv('TABLE_NAME'),
    bucketName: requireEnv('BUCKET_NAME'),
  };
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Falta la variable de entorno ${name}`);
  return value;
}

const ssmClient = new SSMClient({});

// Cache en memoria del contenedor Lambda: un solo GetParameter por cold
// start, no en cada invocación (SSM GetParameter free tier es generoso,
// pero no hay razón para gastarlo).
const secretCache = new Map<string, string>();

/**
 * Lee un secreto desde SSM Parameter Store (SecureString). El parámetro se
 * crea a mano fuera de CDK — ver CLAUDE.md → "Manejo de secretos".
 */
export async function getSecret(parameterNameEnvVar: string): Promise<string> {
  const parameterName = requireEnv(parameterNameEnvVar);

  const cached = secretCache.get(parameterName);
  if (cached) return cached;

  const response = await ssmClient.send(
    new GetParameterCommand({ Name: parameterName, WithDecryption: true }),
  );
  const value = response.Parameter?.Value;
  if (!value) throw new Error(`Parámetro SSM vacío o inexistente: ${parameterName}`);

  secretCache.set(parameterName, value);
  return value;
}
