import { normalizeBatchName } from '../../../domain/services/batch-matcher';
import type { NutritionAnalysisCachePort } from '../../../application/ports/nutrition-analysis-cache.port';
import type {
  NutritionAnalysisInput,
  NutritionAnalysisResult,
  NutritionAnalyzerPort,
} from '../../../application/ports/nutrition-analyzer.port';

/**
 * Decorator "infinite craft": implementa el mismo puerto que el adapter
 * real. El caso de uso nunca sabe si la respuesta vino de cache o de
 * OpenAI — mismo patrón que un circuit breaker, aplicado al presupuesto
 * de IA en vez de a disponibilidad.
 */
export class CachedNutritionAnalyzer implements NutritionAnalyzerPort {
  constructor(
    private readonly inner: NutritionAnalyzerPort,
    private readonly cache: NutritionAnalysisCachePort,
  ) {}

  async analyze(input: NutritionAnalysisInput): Promise<NutritionAnalysisResult> {
    const cacheKey = normalizeBatchName(input.name);

    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const result = await this.inner.analyze(input);
    await this.cache.set(cacheKey, result);
    return result;
  }
}
