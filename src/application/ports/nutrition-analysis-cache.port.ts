import type { NutritionAnalysisResult } from './nutrition-analyzer.port';

/**
 * Cache "infinite craft": cache global por nombre normalizado de platillo,
 * no por usuario. Los 2 usuarios comparten cache — más cache hits, menos
 * costo de OpenAI, y no hay problema de privacidad entre ellos.
 */
export interface NutritionAnalysisCachePort {
  get(normalizedName: string): Promise<NutritionAnalysisResult | null>;
  set(normalizedName: string, result: NutritionAnalysisResult): Promise<void>;
}
