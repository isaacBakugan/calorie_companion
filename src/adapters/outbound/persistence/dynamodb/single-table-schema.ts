/**
 * Fuente única de verdad para el shape de PK/SK. Ningún adapter debería
 * construir estas strings a mano — así un cambio de esquema se hace en un
 * solo lugar y no rompe silenciosamente un adapter que quedó desalineado.
 */
export const keys = {
  userProfile: (userId: string) => ({ PK: `USER#${userId}`, SK: 'PROFILE' }),
  batch: (userId: string, batchId: string) => ({ PK: `USER#${userId}`, SK: `BATCH#${batchId}` }),
  log: (userId: string, timestamp: string) => ({ PK: `USER#${userId}`, SK: `LOG#${timestamp}` }),
  logsForDayPrefix: (isoDate: string) => `LOG#${isoDate}`,
  nutritionCache: (normalizedName: string) => ({
    PK: `DISH#${normalizedName}`,
    SK: 'ANALYSIS',
  }),
};
