import { Duration, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

/**
 * Bucket para fotos de comidas. Lifecycle corto: las fotos solo sirven de
 * input para el análisis de IA, no hay razón para pagar storage indefinido.
 */
export class StorageStack extends Stack {
  public readonly mediaBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    this.mediaBucket = new s3.Bucket(this, 'MediaBucket', {
      bucketName: undefined, // dejar que CDK genere el nombre; evita choques globales de S3
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      lifecycleRules: [
        {
          expiration: Duration.days(45),
        },
      ],
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });
  }
}
