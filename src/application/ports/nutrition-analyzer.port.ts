import type { Macros } from '../../domain/value-objects/macros';

export interface NutritionAnalysisInput {
  /** Nombre del platillo. Es la cache key (normalizada) — ver batch-matcher. */
  readonly name: string;
  readonly description: string;
  readonly imageBase64?: string;
}

export interface NutritionAnalysisResult {
  readonly totalGrams: number;
  readonly totalMacros: Macros;
}

/** El puerto de IA. Un adapter real (OpenAI) y un decorator de cache lo implementan por igual. */
export interface NutritionAnalyzerPort {
  analyze(input: NutritionAnalysisInput): Promise<NutritionAnalysisResult>;
}
