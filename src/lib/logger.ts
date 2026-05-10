type Level = "debug" | "info" | "warn" | "error";

function emit(level: Level, scope: string, message: string, meta?: Record<string, unknown>) {
  const payload = {
    ts: new Date().toISOString(),
    level,
    scope,
    msg: message,
    ...(meta ?? {}),
  };
  const line = JSON.stringify(payload);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export function createLogger(scope: string) {
  return {
    debug: (msg: string, meta?: Record<string, unknown>) => emit("debug", scope, msg, meta),
    info: (msg: string, meta?: Record<string, unknown>) => emit("info", scope, msg, meta),
    warn: (msg: string, meta?: Record<string, unknown>) => emit("warn", scope, msg, meta),
    error: (msg: string, meta?: Record<string, unknown>) => emit("error", scope, msg, meta),
  };
}

export type Logger = ReturnType<typeof createLogger>;
