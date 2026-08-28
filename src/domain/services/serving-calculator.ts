import { ZERO_MACROS, scaleMacros, type Macros } from '../value-objects/macros';
import type { Serving } from '../value-objects/serving';

export function macrosPerGram(totalMacros: Macros, totalGrams: number): Macros {
  if (totalGrams <= 0) {
    throw new Error('totalGrams debe ser positivo para calcular densidad de macros');
  }
  return scaleMacros(totalMacros, 1 / totalGrams);
}

/**
 * Matemática pura, cero IA: cuánto servirse de un batch para cubrir las
 * kcal que le quedan al usuario en el día, asumiendo densidad homogénea
 * de macros por gramo dentro del batch.
 */
export function calculateServingForRemainingKcal(
  batch: { readonly totalGrams: number; readonly totalMacros: Macros },
  remainingKcal: number,
): Serving {
  if (remainingKcal <= 0) {
    return { grams: 0, macros: ZERO_MACROS };
  }

  const perGram = macrosPerGram(batch.totalMacros, batch.totalGrams);
  if (perGram.kcal <= 0) {
    throw new Error('El batch no tiene calorías registradas, no se puede calcular una porción');
  }

  const grams = remainingKcal / perGram.kcal;
  return { grams, macros: scaleMacros(perGram, grams) };
}
