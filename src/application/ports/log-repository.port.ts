import type { ConsumptionLog } from '../../domain/entities/consumption-log';

export interface LogRepositoryPort {
  append(log: ConsumptionLog): Promise<void>;
  /** @param isoDate formato YYYY-MM-DD */
  listForDay(userId: string, isoDate: string): Promise<ConsumptionLog[]>;
}
