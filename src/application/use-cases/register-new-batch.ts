import { randomUUID } from 'node:crypto';
import { normalizeBatchName } from '../../domain/services/batch-matcher';
import type { Batch } from '../../domain/entities/batch';
import type { BatchRepositoryPort } from '../ports/batch-repository.port';
import type { NutritionAnalyzerPort } from '../ports/nutrition-analyzer.port';

export interface RegisterNewBatchInput {
  readonly userId: string;
  readonly name: string;
  readonly description: string;
  readonly imageBase64?: string;
}

/**
 * Cada llamado crea un batch nuevo (misma receta cocinada de nuevo sigue
 * siendo una preparación distinta). El ahorro de costo de IA lo resuelve
 * el CachedNutritionAnalyzer por detrás del puerto, no este caso de uso.
 */
export class RegisterNewBatchUseCase {
  constructor(
    private readonly analyzer: NutritionAnalyzerPort,
    private readonly batches: BatchRepositoryPort,
  ) {}

  async execute(input: RegisterNewBatchInput): Promise<Batch> {
    const analysis = await this.analyzer.analyze({
      name: input.name,
      description: input.description,
      imageBase64: input.imageBase64,
    });

    const batch: Batch = {
      id: randomUUID(),
      userId: input.userId,
      name: input.name,
      normalizedName: normalizeBatchName(input.name),
      totalGrams: analysis.totalGrams,
      totalMacros: analysis.totalMacros,
      createdAt: new Date().toISOString(),
    };

    await this.batches.save(batch);
    return batch;
  }
}
