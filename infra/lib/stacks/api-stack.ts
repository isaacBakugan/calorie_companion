import { Stack, StackProps } from 'aws-cdk-lib';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as events from 'aws-cdk-lib/aws-events';
import * as eventsTargets from 'aws-cdk-lib/aws-events-targets';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { DiscoveredLambdaFunction } from '../constructs/discovered-lambda';
import { discoverLambdas } from '../discover-lambdas';

export interface ApiStackProps extends StackProps {
  readonly stage: string;
  readonly table: dynamodb.Table;
  readonly mediaBucket: s3.Bucket;
}

/**
 * Un Lambda por trigger externo descubierto en src/adapters/inbound/
 * (ver discover-lambdas.ts). Agregar un endpoint o un cron nuevo es
 * agregar la carpeta del lado de src/ — este archivo no cambia.
 *
 * HTTP API (no REST API): mismo resultado para este caso de uso, más
 * barato por millón de requests y sin costo fijo mensual.
 */
export class ApiStack extends Stack {
  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const httpApi = new apigwv2.HttpApi(this, 'HttpApi', {
      apiName: `calorie-companion-${props.stage}-api`,
    });

    for (const discovered of discoverLambdas()) {
      const fn = new DiscoveredLambdaFunction(this, discovered.id, {
        stage: props.stage,
        discovered,
        table: props.table,
        mediaBucket: props.mediaBucket,
      });

      const { triggerConfig } = discovered;
      switch (triggerConfig.trigger) {
        case 'http':
          httpApi.addRoutes({
            path: triggerConfig.path,
            methods: [apigwv2.HttpMethod[triggerConfig.method]],
            integration: new integrations.HttpLambdaIntegration(
              `${discovered.id}Integration`,
              fn.handler,
            ),
          });
          break;
        case 'schedule':
          new events.Rule(this, `${discovered.id}Schedule`, {
            schedule: events.Schedule.expression(triggerConfig.cronExpression),
            targets: [new eventsTargets.LambdaFunction(fn.handler)],
          });
          break;
      }
    }
  }
}
