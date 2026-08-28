import { describe, expect, it } from 'vitest';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { createElectroEntities } from '@adapters/outbound/persistence/dynamodb/electrodb-schema';

// .params() formatea sincrónicamente los comandos de DynamoDB sin hacer red:
// alcanza para validar que el schema arma las Key esperadas, sin necesitar
// una tabla real.
const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'us-east-1' }));
const electro = createElectroEntities(client, 'test-table');

describe('electrodb-schema', () => {
  it('arma la Key de batch a partir de userId + id', () => {
    const params = electro.entities.batch.get({ userId: 'u1', id: 'b1' }).params();
    expect(params.TableName).toBe('test-table');
    expect(params.Key.PK).toContain('u1');
    expect(params.Key.SK).toContain('b1');
  });

  it('arma la Key de userProfile a partir solo de userId (sk constante)', () => {
    const params = electro.entities.userProfile.get({ userId: 'u1' }).params();
    expect(params.Key.PK).toContain('u1');
    expect(params.Key.SK).toBe('$userprofile_1');
  });

  it('arma la Key de nutritionCache a partir del nombre normalizado (cache global)', () => {
    const params = electro.entities.nutritionCache.get({ normalizedName: 'arroz-con-pollo' }).params();
    expect(params.Key.PK).toContain('arroz-con-pollo');
    expect(params.Key.SK).toBe('$nutritioncache_1');
  });

  it('listForDay usa begins_with sobre SK sin escanear toda la tabla', () => {
    const params = electro.entities.consumptionLog.query
      .primary({ userId: 'u1' })
      .begins({ timestamp: '2026-08-27' })
      .params();
    expect(params.KeyConditionExpression).toContain('begins_with');
    expect(params.ExpressionAttributeValues[':pk']).toContain('u1');
    expect(params.ExpressionAttributeValues[':sk1']).toContain('2026-08-27');
  });
});
