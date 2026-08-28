import { subtractMacros, ZERO_MACROS, addMacros, type Macros } from '../../domain/value-objects/macros';
import type { LogRepositoryPort } from '../ports/log-repository.port';
import type { UserRepositoryPort } from '../ports/user-repository.port';

export interface DailySummary {
  readonly consumed: Macros;
  readonly remaining: Macros;
}

export class GetDailySummaryUseCase {
  constructor(
    private readonly users: UserRepositoryPort,
    private readonly logs: LogRepositoryPort,
  ) {}

  async execute(userId: string, isoDate: string): Promise<DailySummary> {
    const [profile, todayLogs] = await Promise.all([
      this.users.findById(userId),
      this.logs.listForDay(userId, isoDate),
    ]);

    if (!profile) throw new Error(`Perfil de usuario no encontrado: ${userId}`);

    const consumed = todayLogs.reduce((sum, log) => addMacros(sum, log.consumedMacros), ZERO_MACROS);
    return { consumed, remaining: subtractMacros(profile.dailyTargetMacros, consumed) };
  }
}
