import type { ConsumptionLog } from '../../../../domain/entities/consumption-log';
import type { LogRepositoryPort } from '../../../../application/ports/log-repository.port';
import type { ElectroService } from './electrodb-schema';

export class DynamoLogRepository implements LogRepositoryPort {
  constructor(private readonly entity: ElectroService['entities']['consumptionLog']) {}

  async append(log: ConsumptionLog): Promise<void> {
    await this.entity.put(log).go();
  }

  async listForDay(userId: string, isoDate: string): Promise<ConsumptionLog[]> {
    const result = await this.entity.query.primary({ userId }).begins({ timestamp: isoDate }).go();
    return result.data;
  }
}
