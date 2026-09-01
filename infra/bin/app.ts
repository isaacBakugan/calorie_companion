#!/usr/bin/env node
import { App, Tags } from 'aws-cdk-lib';
import { ApiStack } from '../lib/stacks/api-stack';
import { DataStack } from '../lib/stacks/data-stack';
import { DevOpsStack } from '../lib/stacks/devops-stack';
import { stackSuffix } from '../lib/stage';
import { StorageStack } from '../lib/stacks/storage-stack';

// Proyecto personal de 2 usuarios: hoy corre un solo stage (prod). El stage
// se parametriza vía CDK context (-c stage=xxx) para no tener que reestructurar
// nada cuando aparezca un segundo — ver CLAUDE.md.
const app = new App();
const stage = (app.node.tryGetContext('stage') as string | undefined) ?? 'prod';

Tags.of(app).add('project', 'calorie');
Tags.of(app).add('stage', stage);

const suffix = stackSuffix(stage);

const dataStack = new DataStack(app, `CalorieCompanion-${suffix}-Data`, { stage });
const storageStack = new StorageStack(app, `CalorieCompanion-${suffix}-Storage`);

new ApiStack(app, `CalorieCompanion-${suffix}-Api`, {
  stage,
  table: dataStack.table,
  mediaBucket: storageStack.mediaBucket,
});

// Stack de cuenta, no de stage: un solo proveedor OIDC y un solo rol de deploy
// para todos los stages. Se despliega a mano — ver devops-stack.ts.
new DevOpsStack(app, 'CalorieCompanion-DevOps', {
  githubOrg: 'isaacBakugan',
  githubRepo: 'calorie_companion',
  allowedBranches: ['main'],
});
