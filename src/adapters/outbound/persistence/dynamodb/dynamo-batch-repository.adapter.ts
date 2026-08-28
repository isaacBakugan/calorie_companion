import type { Batch } from '../../../../domain/entities/batch';
import type { BatchRepositoryPort } from '../../../../application/ports/batch-repository.port';
import type { ElectroService } from './electrodb-schema';

export class DynamoBatchRepository implements BatchRepositoryPort {
  constructor(private readonly entity: ElectroService['entities']['batch']) {}

  async findById(userId: string, batchId: string): Promise<Batch | null> {
    const result = await this.entity.get({ userId, id: batchId }).go();
    return result.data;
  }

  async save(batch: Batch): Promise<void> {
    await this.entity.put(batch).go();
  }
}
