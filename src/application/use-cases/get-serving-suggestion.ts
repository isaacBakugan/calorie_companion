import { calculateServingForRemainingKcal } from '../../domain/services/serving-calculator';
import type { Serving } from '../../domain/value-objects/serving';
import type { BatchRepositoryPort } from '../ports/batch-repository.port';
import type { LogRepositoryPort } from '../ports/log-repository.port';
import type { UserRepositoryPort } from '../ports/user-repository.port';

export interface GetServingSuggestionInput {
  readonly userId: string;
  readonly batchId: string;
  readonly todayIsoDate: string; // YYYY-MM-DD
}

export class GetServingSuggestionUseCase {
  constructor(
    private readonly batches: BatchRepositoryPort,
    private readonly users: UserRepositoryPort,
    private readonly logs: LogRepositoryPort,
  ) {}

  async execute(input: GetServingSuggestionInput): Promise<Serving> {
    const [batch, profile, todayLogs] = await Promise.all([
      this.batches.findById(input.userId, input.batchId),
      this.users.findById(input.userId),
      this.logs.listForDay(input.userId, input.todayIsoDate),
    ]);

    if (!batch) throw new Error(`Batch no encontrado: ${input.batchId}`);
    if (!profile) throw new Error(`Perfil de usuario no encontrado: ${input.userId}`);

    const consumedKcalToday = todayLogs.reduce((sum, log) => sum + log.consumedMacros.kcal, 0);
    const remainingKcal = profile.dailyTargetMacros.kcal - consumedKcalToday;

    return calculateServingForRemainingKcal(batch, remainingKcal);
  }
}
