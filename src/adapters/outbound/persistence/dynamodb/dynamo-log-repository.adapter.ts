import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import type { ConsumptionLog } from '../../../../domain/entities/consumption-log';
import type { LogRepositoryPort } from '../../../../application/ports/log-repository.port';
import { keys } from './single-table-schema';

export class DynamoLogRepository implements LogRepositoryPort {
  constructor(
    private readonly doc: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  static fromTableName(tableName: string): DynamoLogRepository {
    return new DynamoLogRepository(DynamoDBDocumentClient.from(new DynamoDBClient({})), tableName);
  }

  async append(log: ConsumptionLog): Promise<void> {
    await this.doc.send(
      new PutCommand({
        TableName: this.tableName,
        Item: { ...keys.log(log.userId, log.timestamp), ...log },
      }),
    );
  }

  async listForDay(userId: string, isoDate: string): Promise<ConsumptionLog[]> {
    const result = await this.doc.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
        ExpressionAttributeValues: {
          ':pk': keys.userProfile(userId).PK,
          ':skPrefix': keys.logsForDayPrefix(isoDate),
        },
      }),
    );
    return (result.Items as ConsumptionLog[] | undefined) ?? [];
  }
}
