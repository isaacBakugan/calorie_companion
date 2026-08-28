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
 * El único permiso que necesita este rol es `sts:AssumeRole` sobre los roles del
 * bootstrap de CDK (`deploy-role`, `file-publishing-role`, `lookup-role`). Con el
 * "new style stack synthesis" (activado en cdk.json), `cdk deploy` asume el
 * `deploy-role` y ES ESE rol el que llama a CloudFormation; la creación real de
 * recursos la hace CloudFormation con el `cfn-exec-role` del bootstrap (permisos
 * amplios por diseño del bootstrap estándar de CDK). Agregar permisos de
 * CloudFormation/Lambda/DynamoDB/etc. directamente acá sería una lista paralela
 * que hay que mantener sincronizada a mano con lo que la app realmente despliega
 * — exactamente el tipo de deuda que se quiere evitar.
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
    });

    const deployRole = new iam.Role(this, 'GithubActionsDeployRole', {
      roleName: 'calorie-companion-github-actions-deploy',
      description: `Rol asumido por GitHub Actions vía OIDC para desplegar ${props.githubRepo}`,
      assumedBy: new iam.WebIdentityPrincipal(githubProvider.openIdConnectProviderArn, {
        StringEquals: {
          'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
        },
        StringLike: {
          'token.actions.githubusercontent.com:sub': props.allowedBranches.map(
            (branch) => `repo:${props.githubOrg}/${props.githubRepo}:ref:refs/heads/${branch}`,
          ),
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

    new CfnOutput(this, 'GithubActionsDeployRoleArn', {
      value: deployRole.roleArn,
      description:
        'Copiar como variable de repo AWS_DEPLOY_ROLE_ARN en GitHub (Settings > Secrets and variables > Actions > Variables) — no es un secreto.',
    });
  }
}
