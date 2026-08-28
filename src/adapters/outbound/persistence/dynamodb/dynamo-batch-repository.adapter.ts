import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import type { Batch } from '../../../../domain/entities/batch';
import type { BatchRepositoryPort } from '../../../../application/ports/batch-repository.port';
import { keys } from './single-table-schema';

export class DynamoBatchRepository implements BatchRepositoryPort {
  constructor(
    private readonly doc: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  static fromTableName(tableName: string): DynamoBatchRepository {
    return new DynamoBatchRepository(DynamoDBDocumentClient.from(new DynamoDBClient({})), tableName);
  }

  async findById(userId: string, batchId: string): Promise<Batch | null> {
    const result = await this.doc.send(
      new GetCommand({ TableName: this.tableName, Key: keys.batch(userId, batchId) }),
    );
    return (result.Item as Batch | undefined) ?? null;
  }

  async save(batch: Batch): Promise<void> {
    await this.doc.send(
      new PutCommand({
        TableName: this.tableName,
        Item: { ...keys.batch(batch.userId, batch.id), ...batch },
      }),
    );
  }
}
