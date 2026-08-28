import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import type { UserProfile } from '../../../../domain/entities/user-profile';
import type { UserRepositoryPort } from '../../../../application/ports/user-repository.port';
import { keys } from './single-table-schema';

export class DynamoUserRepository implements UserRepositoryPort {
  constructor(
    private readonly doc: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  static fromTableName(tableName: string): DynamoUserRepository {
    return new DynamoUserRepository(DynamoDBDocumentClient.from(new DynamoDBClient({})), tableName);
  }

  async findById(userId: string): Promise<UserProfile | null> {
    const result = await this.doc.send(
      new GetCommand({ TableName: this.tableName, Key: keys.userProfile(userId) }),
    );
    return (result.Item as UserProfile | undefined) ?? null;
  }

  async save(profile: UserProfile): Promise<void> {
    await this.doc.send(
      new PutCommand({
        TableName: this.tableName,
        Item: { ...keys.userProfile(profile.userId), ...profile },
      }),
    );
  }
}
