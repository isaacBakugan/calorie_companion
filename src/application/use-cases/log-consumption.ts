import { scaleMacros } from '../../domain/value-objects/macros';
import type { ConsumptionLog } from '../../domain/entities/consumption-log';
import type { BatchRepositoryPort } from '../ports/batch-repository.port';
import type { LogRepositoryPort } from '../ports/log-repository.port';
import { macrosPerGram } from '../../domain/services/serving-calculator';

export interface LogConsumptionInput {
  readonly userId: string;
  readonly batchId: string;
  readonly servedGrams: number;
}

export class LogConsumptionUseCase {
  constructor(
    private readonly batches: BatchRepositoryPort,
    private readonly logs: LogRepositoryPort,
  ) {}

  async execute(input: LogConsumptionInput): Promise<ConsumptionLog> {
    const batch = await this.batches.findById(input.userId, input.batchId);
    if (!batch) throw new Error(`Batch no encontrado: ${input.batchId}`);

    const perGram = macrosPerGram(batch.totalMacros, batch.totalGrams);
    const log: ConsumptionLog = {
      userId: input.userId,
      timestamp: new Date().toISOString(),
      batchId: input.batchId,
      servedGrams: input.servedGrams,
      consumedMacros: scaleMacros(perGram, input.servedGrams),
    };

    await this.logs.append(log);
    return log;
  }
}
