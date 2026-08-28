import type { Macros } from '../value-objects/macros';

export interface UserProfile {
  readonly userId: string;
  readonly displayName: string;
  readonly dailyTargetMacros: Macros;
}
