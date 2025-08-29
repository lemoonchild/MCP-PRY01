const LEVELS = ['debug', 'info', 'warn', 'error'];

function ts() {
  return new Date().toISOString();
}

// Redacta posibles secretos en objetos (clave API, tokens, etc.)
function redact(obj) {
  try {
    const json = JSON.stringify(obj, (k, v) => {
      const key = String(k).toLowerCase();
      if (key.includes('api_key') || key.includes('apikey') || key.includes('authorization') || key.includes('token')) {
        return '[REDACTED]';
      }
      return v;
    });
    return JSON.parse(json);
  } catch {
    return obj;
  }
}

function log(level, msg, meta) {
  if (!LEVELS.includes(level)) level = 'info';
  const base = { t: ts(), level, msg };
  const payload = meta ? { ...base, ...redact(meta) } : base;
  if (level === 'error') console.error(JSON.stringify(payload));
  else if (level === 'warn') console.warn(JSON.stringify(payload));
  else console.log(JSON.stringify(payload));
}

export const logger = {
  debug: (msg, meta) => log('debug', msg, meta),
  info:  (msg, meta) => log('info',  msg, meta),
  warn:  (msg, meta) => log('warn',  msg, meta),
  error: (msg, meta) => log('error', msg, meta),
};

export async function withTiming(label, fn) {
  const start = Date.now();
  try {
    const result = await fn();
    logger.debug(`${label}: ok`, { ms: Date.now() - start });
    return result;
  } catch (e) {
    logger.error(`${label}: fail`, { ms: Date.now() - start, err: e?.message });
    throw e;
  }
}