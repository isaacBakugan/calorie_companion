import { describe, expect, it } from 'vitest';
import { normalizeBatchName } from '@domain/services/batch-matcher';

describe('normalizeBatchName', () => {
  it('pasa a minúsculas y separa por guiones', () => {
    expect(normalizeBatchName('Arroz con Pollo')).toBe('arroz-con-pollo');
  });

  it('quita acentos', () => {
    expect(normalizeBatchName('Lentejas al Jamón')).toBe('lentejas-al-jamon');
  });

  it('quita espacios extra y puntuación', () => {
    expect(normalizeBatchName('  Pollo  al horno!! ')).toBe('pollo-al-horno');
  });

  it('produce la misma key para variaciones equivalentes', () => {
    expect(normalizeBatchName('Arroz Con Pollo')).toBe(normalizeBatchName('arroz con pollo'));
  });
});
