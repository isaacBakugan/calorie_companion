import type { Macros } from '../value-objects/macros';

export interface ConsumptionLog {
  readonly userId: string;
  readonly timestamp: string; // ISO 8601, usado como sort key
  readonly batchId: string;
  readonly servedGrams: number;
  readonly consumedMacros: Macros;
}
