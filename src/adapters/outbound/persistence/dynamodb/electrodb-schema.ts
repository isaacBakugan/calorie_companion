import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { Entity, Service } from 'electrodb';

/**
 * Schema deliberadamente simple — un solo GSI implícito (la primary key de
 * cada entidad) y sin `collections` de ElectroDB todavía. Cuando aparezca
 * un patrón de acceso real que las necesite (p.ej. "todo lo de un usuario
 * en una sola query"), se agregan ahí. No se over-diseña esto hoy.
 */
const macrosAttribute = {
  type: 'map',
  required: true,
  properties: {
    kcal: { type: 'number', required: true },
    proteinG: { type: 'number', required: true },
    carbsG: { type: 'number', required: true },
    fatG: { type: 'number', required: true },
  },
} as const;

/**
 * Construye las 4 entidades del single-table y las agrupa en un Service.
 * Todas comparten tabla, client y los nombres de atributo de clave (PK/SK)
 * ya definidos en infra/lib/stacks/data-stack.ts.
 */
export function createElectroEntities(client: DynamoDBDocumentClient, table: string) {
  const options = { client, table };

  const batch = new Entity(
    {
      model: { entity: 'batch', version: '1', service: 'calorieCompanion' },
      attributes: {
        id: { type: 'string', required: true },
        userId: { type: 'string', required: true },
        name: { type: 'string', required: true },
        normalizedName: { type: 'string', required: true },
        totalGrams: { type: 'number', required: true },
        totalMacros: macrosAttribute,
        createdAt: { type: 'string', required: true },
      },
      indexes: {
        primary: {
          pk: { field: 'PK', composite: ['userId'] },
          sk: { field: 'SK', composite: ['id'] },
        },
      },
    },
    options,
  );

  const userProfile = new Entity(
    {
      model: { entity: 'userProfile', version: '1', service: 'calorieCompanion' },
      attributes: {
        userId: { type: 'string', required: true },
        displayName: { type: 'string', required: true },
        dailyTargetMacros: macrosAttribute,
      },
      indexes: {
        // Un solo perfil por usuario: sk sin composite (constante).
        primary: {
          pk: { field: 'PK', composite: ['userId'] },
          sk: { field: 'SK', composite: [] },
        },
      },
    },
    options,
  );

  const consumptionLog = new Entity(
    {
      model: { entity: 'consumptionLog', version: '1', service: 'calorieCompanion' },
      attributes: {
        userId: { type: 'string', required: true },
        timestamp: { type: 'string', required: true },
        batchId: { type: 'string', required: true },
        servedGrams: { type: 'number', required: true },
        consumedMacros: macrosAttribute,
      },
      indexes: {
        // timestamp es ISO 8601 (YYYY-MM-DD...): begins_with sobre el
        // prefijo de fecha alcanza para listForDay, sin GSI extra.
        primary: {
          pk: { field: 'PK', composite: ['userId'] },
          sk: { field: 'SK', composite: ['timestamp'] },
        },
      },
    },
    options,
  );

  const nutritionCache = new Entity(
    {
      model: { entity: 'nutritionCache', version: '1', service: 'calorieCompanion' },
      attributes: {
        normalizedName: { type: 'string', required: true },
        totalGrams: { type: 'number', required: true },
        totalMacros: macrosAttribute,
      },
      indexes: {
        // Cache global por platillo: sk sin composite (constante).
        primary: {
          pk: { field: 'PK', composite: ['normalizedName'] },
          sk: { field: 'SK', composite: [] },
        },
      },
    },
    options,
  );

  return new Service({ batch, userProfile, consumptionLog, nutritionCache });
}

export type ElectroService = ReturnType<typeof createElectroEntities>;
