import { RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

/**
 * Single-table design. On-demand billing: sin costo cuando nadie usa el bot,
 * y dentro del free tier "always free" de DynamoDB (25 GB) a este volumen.
 */
export class DataStack extends Stack {
  public readonly table: dynamodb.Table;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    this.table = new dynamodb.Table(this, 'Table', {
      tableName: 'calorie-companion-table',
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: false },
      // Proyecto personal de 2 usuarios: se prioriza costo $0 sobre protección
      // de datos. Si esto deja de ser un juguete, cambiar a RETAIN.
      removalPolicy: RemovalPolicy.DESTROY,
    });
  }
}
