export interface Macros {
  readonly kcal: number;
  readonly proteinG: number;
  readonly carbsG: number;
  readonly fatG: number;
}

export function scaleMacros(macros: Macros, factor: number): Macros {
  return {
    kcal: macros.kcal * factor,
    proteinG: macros.proteinG * factor,
    carbsG: macros.carbsG * factor,
    fatG: macros.fatG * factor,
  };
}

export function addMacros(a: Macros, b: Macros): Macros {
  return {
    kcal: a.kcal + b.kcal,
    proteinG: a.proteinG + b.proteinG,
    carbsG: a.carbsG + b.carbsG,
    fatG: a.fatG + b.fatG,
  };
}

export function subtractMacros(a: Macros, b: Macros): Macros {
  return {
    kcal: a.kcal - b.kcal,
    proteinG: a.proteinG - b.proteinG,
    carbsG: a.carbsG - b.carbsG,
    fatG: a.fatG - b.fatG,
  };
}

export const ZERO_MACROS: Macros = { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 };
