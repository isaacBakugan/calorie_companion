#!/usr/bin/env node
import { App } from 'aws-cdk-lib';
import { ApiStack } from '../lib/stacks/api-stack';
import { DataStack } from '../lib/stacks/data-stack';
import { StorageStack } from '../lib/stacks/storage-stack';

// Proyecto personal de 2 usuarios: un solo ambiente, no dev/stg/prod separados.
// (Desvío consciente del estándar de 3 ambientes — ver CLAUDE.md.)
const app = new App();

const dataStack = new DataStack(app, 'CalorieCompanion-Data');
const storageStack = new StorageStack(app, 'CalorieCompanion-Storage');

new ApiStack(app, 'CalorieCompanion-Api', {
  table: dataStack.table,
  mediaBucket: storageStack.mediaBucket,
});
