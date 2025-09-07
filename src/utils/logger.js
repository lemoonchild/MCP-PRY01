/**
 * @fileoverview Simple structured logger with redaction and timing support.
 * Supports log levels: debug, info, warn, error.
 * Includes automatic redaction for sensitive keys like API keys or tokens.
 */

const LEVELS = ['debug', 'info', 'warn', 'error'];

/**
 * Returns the current timestamp in ISO 8601 format.
 * @returns {string} ISO timestamp
 */
function ts() {
  return new Date().toISOString();
}

/**
 * Redacts sensitive values (API keys, tokens) from an object before logging.
 *
 * @param {any} obj - The object to sanitize
 * @returns {any} A copy of the object with sensitive fields redacted
 */
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

/**
 * Internal log formatter and dispatcher.
 *
 * @param {string} level - Log level ("debug", "info", "warn", "error")
 * @param {string} msg - Log message
 * @param {Object} [meta] - Optional metadata to include
 */
function log(level, msg, meta) {
  if (!LEVELS.includes(level)) level = 'info';
  const base = { t: ts(), level, msg };
  const payload = meta ? { ...base, ...redact(meta) } : base;
  if (level === 'error') console.error(JSON.stringify(payload));
  else if (level === 'warn') console.warn(JSON.stringify(payload));
  else console.log(JSON.stringify(payload));
}

/**
 * Logger utility with level-based methods.
 * Example:
 * ```js
 * logger.info("Process started", { user: "madeline" });
 * logger.error("Failed to fetch", { err });
 * ```
 */
export const logger = {
  /**
   * Log a debug-level message.
   * @param {string} msg
   * @param {Object} [meta]
   */
  debug: (msg, meta) => log('debug', msg, meta),
  /**
   * Log an info-level message.
   * @param {string} msg
   * @param {Object} [meta]
   */
  info:  (msg, meta) => log('info',  msg, meta),
  /**
   * Log a warning.
   * @param {string} msg
   * @param {Object} [meta]
   */
  warn:  (msg, meta) => log('warn',  msg, meta),
  /**
   * Log an error.
   * @param {string} msg
   * @param {Object} [meta]
   */
  error: (msg, meta) => log('error', msg, meta),
};

/**
 * Wraps an async function with timing and automatic logging.
 *
 * @template T
 * @param {string} label - A label to include in logs
 * @param {() => Promise<T>} fn - The async function to time
 * @returns {Promise<T>} The result of the function
 *
 * @example
 * const data = await withTiming("fetch.user", async () => fetchUser(id));
 */
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