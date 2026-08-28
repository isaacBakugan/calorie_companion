#!/usr/bin/env node
import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';
import { LambdaClient, UpdateFunctionCodeCommand } from '@aws-sdk/client-lambda';
import AdmZip from 'adm-zip';
import { stackSuffix } from '../lib/stage';

interface CfnTemplate {
  Resources: Record<string, { Type: string; Properties: Record<string, unknown> }>;
}

/**
 * Pipeline "rápido": actualiza SOLO el código de los Lambdas que ya existen,
 * llamando UpdateFunctionCode directo — sin pasar por CloudFormation. No
 * puede tocar env vars, permisos IAM ni rutas nuevas (para eso está
 * `infra:prod:deploy`, manual). Si tu cambio de código depende de un env var
 * o permiso nuevo, corré `infra:prod:deploy` primero — si no, el Lambda va a
 * fallar con "Falta la variable de entorno" o AccessDenied.
 *
 * Reutiliza el bundle que ya arma `cdk synth` (NodejsFunction/esbuild) en vez
 * de reimplementar el bundling acá: una sola fuente de verdad para cómo se
 * empaqueta el código, evita que este script y discovered-lambda.ts se
 * desincronicen.
 */
function parseStageArg(): string {
  const arg = process.argv.find((entry) => entry.startsWith('--stage='));
  return arg?.split('=')[1] ?? 'prod';
}

async function main(): Promise<void> {
  const stage = parseStageArg();
  const stackName = `CalorieCompanion-${stackSuffix(stage)}-Api`;
  const infraDir = path.join(__dirname, '..');
  const cdkOutDir = path.join(infraDir, 'cdk.out');

  console.log(`Sintetizando ${stackName} para extraer el código ya bundleado...`);
  execSync(`npx cdk synth ${stackName} -c stage=${stage}`, { cwd: infraDir, stdio: 'inherit' });

  const templatePath = path.join(cdkOutDir, `${stackName}.template.json`);
  const template = JSON.parse(fs.readFileSync(templatePath, 'utf-8')) as CfnTemplate;

  const lambdaResources = Object.values(template.Resources).filter(
    (resource) => resource.Type === 'AWS::Lambda::Function',
  );
  if (lambdaResources.length === 0) {
    throw new Error(`No se encontró ningún AWS::Lambda::Function en ${templatePath}`);
  }

  const client = new LambdaClient({});

  for (const resource of lambdaResources) {
    const functionName = resource.Properties.FunctionName as string;
    const { S3Key } = resource.Properties.Code as { S3Key: string };
    const assetDir = path.join(cdkOutDir, `asset.${S3Key.replace(/\.zip$/, '')}`);

    if (!fs.existsSync(assetDir)) {
      throw new Error(`No se encontró el asset de ${functionName} en ${assetDir}`);
    }

    const zip = new AdmZip();
    zip.addLocalFolder(assetDir);
    const zipBuffer = zip.toBuffer();

    console.log(`Actualizando código de ${functionName} (${(zipBuffer.length / 1024).toFixed(1)} KB)...`);
    const response = await client.send(
      new UpdateFunctionCodeCommand({ FunctionName: functionName, ZipFile: zipBuffer }),
    );
    console.log(`  -> ${functionName}: ${response.LastUpdateStatus ?? 'sin estado'}`);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
