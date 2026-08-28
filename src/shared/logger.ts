type LogLevel = 'debug' | 'info' | 'warn' | 'error';

function log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
  // JSON a stdout: CloudWatch Logs lo indexa tal cual, sin necesidad de un
  // servicio de logging aparte (fuera de presupuesto para este proyecto).
  console.log(JSON.stringify({ level, message, ts: new Date().toISOString(), ...meta }));
}

export const logger = {
  debug: (message: string, meta?: Record<string, unknown>) => log('debug', message, meta),
  info: (message: string, meta?: Record<string, unknown>) => log('info', message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => log('warn', message, meta),
  error: (message: string, meta?: Record<string, unknown>) => log('error', message, meta),
};
