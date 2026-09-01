import { CfnOutput, Stack, StackProps } from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface DevOpsStackProps extends StackProps {
  readonly githubOrg: string;
  readonly githubRepo: string;
  /** Ramas autorizadas a asumir el rol de deploy. Hoy solo `main` despliega. */
  readonly allowedBranches: string[];
}

/**
 * Rol de deploy para GitHub Actions vía OIDC. Se despliega a mano una sola vez
 * (`pnpm run devops:prod:deploy`) — nunca desde el propio pipeline de CI, porque
 * es el rol que ese pipeline necesita para existir antes de poder correr.
 *
 * Dos caminos de deploy, dos permisos distintos:
 * - `infra:prod:deploy` (cdk deploy, cambios de infra): solo necesita
 *   `sts:AssumeRole` sobre los roles del bootstrap de CDK (`deploy-role`,
 *   `file-publishing-role`, `lookup-role`). Con el "new style stack synthesis"
 *   (activado en cdk.json), `cdk deploy` asume el `deploy-role` y ES ESE rol
 *   el que llama a CloudFormation; la creación real de recursos la hace
 *   CloudFormation con el `cfn-exec-role` del bootstrap (permisos amplios por
 *   diseño del bootstrap estándar de CDK). Agregar permisos de
 *   CloudFormation/DynamoDB/etc. directamente acá sería una lista paralela
 *   que hay que mantener sincronizada a mano con lo que la app realmente
 *   despliega.
 * - `lambda:prod:deploy` (código de Lambda, sin CloudFormation): al saltarse
 *   CDK/CloudFormation por completo, este rol SÍ necesita `lambda:UpdateFunctionCode`
 *   directo — no hay `cfn-exec-role` de por medio que se lo dé.
 */
export class DevOpsStack extends Stack {
  constructor(scope: Construct, id: string, props: DevOpsStackProps) {
    super(scope, id, props);

    // El proveedor OIDC de GitHub es único por cuenta de AWS (falla si ya existe
    // uno con esta misma URL). Si esta cuenta ya tiene uno de otro proyecto,
    // reemplazar este bloque por
    // `iam.OpenIdConnectProvider.fromOpenIdConnectProviderArn(this, 'GithubOidcProvider',
    //   \`arn:aws:iam::${this.account}:oidc-provider/token.actions.githubusercontent.com\`)`
    const githubProvider = new iam.OpenIdConnectProvider(this, 'GithubOidcProvider', {
      url: 'https://token.actions.githubusercontent.com',
      clientIds: ['sts.amazonaws.com'],
      thumbprints: [
        '6938fd4d98bab03faadb97b34396831e3780aea1',
        '1c58760252c5c773b3e2b888448b7f3150e8a614',
        'ab9d0263244dd0326eb67015705a667e79cfe998',
      ],
    });

    const deployRole = new iam.Role(this, 'GithubActionsDeployRole', {
      roleName: 'calorie-companion-github-actions-deploy',
      description: `Rol asumido por GitHub Actions vía OIDC para desplegar ${props.githubRepo}`,
      assumedBy: new iam.WebIdentityPrincipal(githubProvider.openIdConnectProviderArn, {
        StringEquals: {
          'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
        },
        StringLike: {
          'token.actions.githubusercontent.com:sub': `repo:${props.githubOrg}/${props.githubRepo}:*`,
        },
      }),
    });

    deployRole.addToPolicy(
      new iam.PolicyStatement({
        sid: 'PermitirAsumirRolesDeBootstrapDeCdk',
        actions: ['sts:AssumeRole'],
        resources: [`arn:aws:iam::${this.account}:role/cdk-*-role-${this.account}-${this.region}`],
      }),
    );

    deployRole.addToPolicy(
      new iam.PolicyStatement({
        sid: 'PermitirActualizarCodigoDeLambdas',
        actions: ['lambda:UpdateFunctionCode'],
        resources: [`arn:aws:lambda:${this.region}:${this.account}:function:calorie-companion-*`],
      }),
    );

    new CfnOutput(this, 'GithubActionsDeployRoleArn', {
      value: deployRole.roleArn,
      description:
        'Copiar como variable de repo AWS_DEPLOY_ROLE_ARN en GitHub (Settings > Secrets and variables > Actions > Variables) — no es un secreto.',
    });
  }
}
