import { describe, expect, it } from 'vitest';
import {
  calculateServingForRemainingKcal,
  macrosPerGram,
} from '@domain/services/serving-calculator';

const batch = {
  totalGrams: 1000,
  totalMacros: { kcal: 2000, proteinG: 150, carbsG: 200, fatG: 60 },
};

describe('macrosPerGram', () => {
  it('calcula la densidad de macros por gramo', () => {
    const perGram = macrosPerGram(batch.totalMacros, batch.totalGrams);
    expect(perGram.kcal).toBeCloseTo(2);
    expect(perGram.proteinG).toBeCloseTo(0.15);
  });

  it('rechaza un batch sin gramos', () => {
    expect(() => macrosPerGram(batch.totalMacros, 0)).toThrow();
  });
});

describe('calculateServingForRemainingKcal', () => {
  it('devuelve 0 gramos si no quedan kcal en el día', () => {
    const serving = calculateServingForRemainingKcal(batch, 0);
    expect(serving.grams).toBe(0);
    expect(serving.macros.kcal).toBe(0);
  });

  it('calcula gramos proporcional a las kcal restantes', () => {
    const serving = calculateServingForRemainingKcal(batch, 500);
    expect(serving.grams).toBeCloseTo(250);
    expect(serving.macros.proteinG).toBeCloseTo(37.5);
  });

  it('rechaza un batch sin calorías registradas', () => {
    const emptyBatch = { totalGrams: 100, totalMacros: { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 } };
    expect(() => calculateServingForRemainingKcal(emptyBatch, 500)).toThrow();
  });
});
