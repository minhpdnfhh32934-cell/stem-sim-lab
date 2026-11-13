export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const RANK: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export type LogSink = (level: LogLevel, channel: string, message: string, data?: unknown) => void;

export const consoleSink: LogSink = (level, channel, message, data) => {
  const line = `[${channel}] ${message}`;
  // eslint-disable-next-line no-console -- this sink is the one place that writes to the console
  if (data === undefined) console[level](line);
  // eslint-disable-next-line no-console
  else console[level](line, data);
};

interface LoggerOptions {
  level: LogLevel;
  sink: LogSink;
}

/**
 * Leveled, channel-tagged logger. Children share the parent's options object, so changing the
 * level at runtime (e.g. from a debug setting) applies to every system at once.
 */
export class Logger {
  private constructor(
    private readonly options: LoggerOptions,
    readonly channel: string,
  ) {}

  static create(level: LogLevel, sink: LogSink = consoleSink, channel = 'SIMLAB'): Logger {
    return new Logger({ level, sink }, channel);
  }

  child(channel: string): Logger {
    return new Logger(this.options, channel);
  }

  get level(): LogLevel {
    return this.options.level;
  }

  setLevel(level: LogLevel): void {
    this.options.level = level;
  }

  isEnabled(level: LogLevel): boolean {
    return RANK[level] >= RANK[this.options.level];
  }

  debug(message: string, data?: unknown): void {
    this.write('debug', message, data);
  }
  info(message: string, data?: unknown): void {
    this.write('info', message, data);
  }
  warn(message: string, data?: unknown): void {
    this.write('warn', message, data);
  }
  error(message: string, data?: unknown): void {
    this.write('error', message, data);
  }

  private write(level: LogLevel, message: string, data: unknown): void {
    if (this.isEnabled(level)) this.options.sink(level, this.channel, message, data);
  }
}
