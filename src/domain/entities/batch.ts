import type { Macros } from '../value-objects/macros';

export interface Batch {
  readonly id: string;
  readonly userId: string;
  readonly name: string;
  readonly normalizedName: string;
  readonly totalGrams: number;
  readonly totalMacros: Macros;
  readonly createdAt: string; // ISO 8601
}
