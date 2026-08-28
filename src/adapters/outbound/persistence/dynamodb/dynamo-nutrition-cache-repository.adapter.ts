import type { NutritionAnalysisCachePort } from '../../../../application/ports/nutrition-analysis-cache.port';
import type { NutritionAnalysisResult } from '../../../../application/ports/nutrition-analyzer.port';
import type { ElectroService } from './electrodb-schema';

export class DynamoNutritionCacheRepository implements NutritionAnalysisCachePort {
  constructor(private readonly entity: ElectroService['entities']['nutritionCache']) {}

  async get(normalizedName: string): Promise<NutritionAnalysisResult | null> {
    const result = await this.entity.get({ normalizedName }).go();
    if (!result.data) return null;
    const { totalGrams, totalMacros } = result.data;
    return { totalGrams, totalMacros };
  }

  async set(normalizedName: string, result: NutritionAnalysisResult): Promise<void> {
    await this.entity.put({ normalizedName, ...result }).go();
  }
}
