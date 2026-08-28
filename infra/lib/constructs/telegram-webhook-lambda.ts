import * as path from 'node:path';
import { Duration, Stack } from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambdaNode from 'aws-cdk-lib/aws-lambda-nodejs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export const SSM_PARAM_PREFIX = '/calorie-companion';

export interface TelegramWebhookLambdaProps {
  readonly table: dynamodb.Table;
  readonly mediaBucket: s3.Bucket;
}

/**
 * Lambda único que atiende el webhook de Telegram. Los secretos (token de
 * Telegram, API key de OpenAI, secret del webhook) NO se crean acá: viven en
 * SSM Parameter Store como SecureString, creados a mano una sola vez fuera
 * de CDK (CloudFormation no soporta crear SecureString). Este construct solo
 * referencia sus nombres y otorga permiso de lectura mínimo (ssm:GetParameter
 * sobre esos 3 ARN puntuales, nada más). Ver CLAUDE.md → "Manejo de secretos".
 */
export class TelegramWebhookLambda extends Construct {
  public readonly handler: lambdaNode.NodejsFunction;

  constructor(scope: Construct, id: string, props: TelegramWebhookLambdaProps) {
    super(scope, id);

    const stack = Stack.of(this);

    this.handler = new lambdaNode.NodejsFunction(this, 'Handler', {
      runtime: lambda.Runtime.NODEJS_22_X,
      memorySize: 256,
      timeout: Duration.seconds(30),
      entry: path.join(
        __dirname,
        '../../../src/adapters/inbound/telegram/telegram-webhook-handler.ts',
      ),
      handler: 'handler',
      bundling: {
        minify: true,
        sourceMap: false,
        // El SDK v3 ya viene incluido en el runtime de Lambda: no lo empaquetamos.
        externalModules: ['@aws-sdk/*'],
        tsconfig: path.join(__dirname, '../../../tsconfig.json'),
      },
      environment: {
        TABLE_NAME: props.table.tableName,
        BUCKET_NAME: props.mediaBucket.bucketName,
        TELEGRAM_TOKEN_PARAM_NAME: `${SSM_PARAM_PREFIX}/telegram-bot-token`,
        OPENAI_API_KEY_PARAM_NAME: `${SSM_PARAM_PREFIX}/openai-api-key`,
        TELEGRAM_WEBHOOK_SECRET_PARAM_NAME: `${SSM_PARAM_PREFIX}/telegram-webhook-secret`,
      },
    });

    props.table.grantReadWriteData(this.handler);
    props.mediaBucket.grantReadWrite(this.handler);

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
