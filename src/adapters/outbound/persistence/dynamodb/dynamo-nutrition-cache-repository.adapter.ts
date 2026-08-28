import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import type {
  NutritionAnalysisCachePort,
} from '../../../../application/ports/nutrition-analysis-cache.port';
import type { NutritionAnalysisResult } from '../../../../application/ports/nutrition-analyzer.port';
import { keys } from './single-table-schema';

export class DynamoNutritionCacheRepository implements NutritionAnalysisCachePort {
  constructor(
    private readonly doc: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  static fromTableName(tableName: string): DynamoNutritionCacheRepository {
    return new DynamoNutritionCacheRepository(
      DynamoDBDocumentClient.from(new DynamoDBClient({})),
      tableName,
    );
  }

  async get(normalizedName: string): Promise<NutritionAnalysisResult | null> {
    const result = await this.doc.send(
      new GetCommand({ TableName: this.tableName, Key: keys.nutritionCache(normalizedName) }),
    );
    if (!result.Item) return null;
    const { totalGrams, totalMacros } = result.Item as NutritionAnalysisResult;
    return { totalGrams, totalMacros };
  }

  async set(normalizedName: string, result: NutritionAnalysisResult): Promise<void> {
    await this.doc.send(
      new PutCommand({
        TableName: this.tableName,
        Item: { ...keys.nutritionCache(normalizedName), ...result },
      }),
    );
  }
}
