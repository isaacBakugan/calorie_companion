import type { Batch } from '../../domain/entities/batch';

export interface BatchRepositoryPort {
  findById(userId: string, batchId: string): Promise<Batch | null>;
  save(batch: Batch): Promise<void>;
}
