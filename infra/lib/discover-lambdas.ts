import * as fs from 'node:fs';
import * as path from 'node:path';
import type { TriggerConfig } from '../../src/shared/types/trigger-config';

export interface DiscoveredLambda {
  readonly triggerConfig: TriggerConfig;
  /** Ruta absoluta al handler.ts, para pasarle a NodejsFunction.entry directo. */
  readonly handlerEntry: string;
  /** PascalCase del nombre de carpeta, para usar como construct id. */
  readonly id: string;
}

const INBOUND_DIR = path.join(__dirname, '../../src/adapters/inbound');

/**
 * Convención de auto-discovery: cada subcarpeta de src/adapters/inbound/
 * que tenga un trigger.config.ts se despliega como un Lambda. Agregar un
 * trigger nuevo = agregar handler.ts + trigger.config.ts ahí — cero
 * cambios en infra/.
 */
export function discoverLambdas(): DiscoveredLambda[] {
  return fs
    .readdirSync(INBOUND_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .filter((entry) => fs.existsSync(path.join(INBOUND_DIR, entry.name, 'trigger.config.ts')))
    .map((entry) => {
      const dir = path.join(INBOUND_DIR, entry.name);
      // Import dinámico por carpeta descubierta: el path no se conoce hasta
      // runtime de synth, no se puede usar `import` estático acá.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const configModule = require(path.join(dir, 'trigger.config')) as {
        triggerConfig: TriggerConfig;
      };

      return {
        triggerConfig: configModule.triggerConfig,
        handlerEntry: path.join(dir, 'handler.ts'),
        id: toPascalCase(entry.name),
      };
    });
}

function toPascalCase(kebabCase: string): string {
  return kebabCase
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}
