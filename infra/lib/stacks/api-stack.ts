import { Stack, StackProps } from 'aws-cdk-lib';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { TelegramWebhookLambda } from '../constructs/telegram-webhook-lambda';

export interface ApiStackProps extends StackProps {
  readonly table: dynamodb.Table;
  readonly mediaBucket: s3.Bucket;
}

/**
 * HTTP API (no REST API): mismo resultado para este caso de uso, más barato
 * por millón de requests y sin costo fijo mensual.
 */
export class ApiStack extends Stack {
  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const webhookLambda = new TelegramWebhookLambda(this, 'TelegramWebhook', {
      table: props.table,
      mediaBucket: props.mediaBucket,
    });

    const httpApi = new apigwv2.HttpApi(this, 'HttpApi', {
      apiName: 'calorie-companion-api',
    });

    httpApi.addRoutes({
      path: '/telegram/webhook',
      methods: [apigwv2.HttpMethod.POST],
      integration: new integrations.HttpLambdaIntegration(
        'TelegramWebhookIntegration',
        webhookLambda.handler,
      ),
    });
  }
}
