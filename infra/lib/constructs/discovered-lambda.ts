import * as path from 'node:path';
import { Duration, Stack } from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNode from 'aws-cdk-lib/aws-lambda-nodejs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import type { DiscoveredLambda } from '../discover-lambdas';

export const SSM_PARAM_PREFIX = '/calorie-companion';

export interface DiscoveredLambdaFunctionProps {
  readonly discovered: DiscoveredLambda;
  readonly table: dynamodb.Table;
  readonly mediaBucket: s3.Bucket;
}

/**
 * Wrapper genérico para cualquier Lambda descubierto en
 * src/adapters/inbound/. Los 3 secretos (token de Telegram, API key de
 * OpenAI, secret del webhook) se crean a mano en SSM fuera de CDK
 * (CloudFormation no soporta SecureString) — ver CLAUDE.md → "Manejo de
 * secretos". Mismo permiso de lectura para todos los Lambdas del proyecto;
 * a esta escala no vale la pena granular por función.
 */
export class DiscoveredLambdaFunction extends Construct {
  public readonly handler: lambdaNode.NodejsFunction;

  constructor(scope: Construct, id: string, props: DiscoveredLambdaFunctionProps) {
    super(scope, id);

    const stack = Stack.of(this);
    const { discovered, table, mediaBucket } = props;

    this.handler = new lambdaNode.NodejsFunction(this, 'Handler', {
      functionName: `calorie-companion-${discovered.triggerConfig.functionName}`,
      runtime: lambda.Runtime.NODEJS_22_X,
      memorySize: discovered.triggerConfig.memorySize ?? 256,
      timeout: Duration.seconds(discovered.triggerConfig.timeoutSeconds ?? 30),
      entry: discovered.handlerEntry,
      handler: 'handler',
      bundling: {
        minify: true,
        sourceMap: false,
        // El SDK v3 ya viene en el runtime de Lambda: no lo empaquetamos.
        externalModules: ['@aws-sdk/*'],
        tsconfig: path.join(__dirname, '../../../tsconfig.json'),
      },
      environment: {
        TABLE_NAME: table.tableName,
        BUCKET_NAME: mediaBucket.bucketName,
        TELEGRAM_TOKEN_PARAM_NAME: `${SSM_PARAM_PREFIX}/telegram-bot-token`,
        OPENAI_API_KEY_PARAM_NAME: `${SSM_PARAM_PREFIX}/openai-api-key`,
        TELEGRAM_WEBHOOK_SECRET_PARAM_NAME: `${SSM_PARAM_PREFIX}/telegram-webhook-secret`,
      },
    });

    table.grantReadWriteData(this.handler);
    mediaBucket.grantReadWrite(this.handler);

    this.handler.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['ssm:GetParameter'],
        resources: [
          `arn:aws:ssm:${stack.region}:${stack.account}:parameter${SSM_PARAM_PREFIX}/telegram-bot-token`,
          `arn:aws:ssm:${stack.region}:${stack.account}:parameter${SSM_PARAM_PREFIX}/openai-api-key`,
          `arn:aws:ssm:${stack.region}:${stack.account}:parameter${SSM_PARAM_PREFIX}/telegram-webhook-secret`,
        ],
      }),
    );
  }
}
