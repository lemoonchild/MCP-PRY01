// Códigos estándar JSON-RPC 2.0
export const JSON_RPC_ERRORS = {
  PARSE_ERROR:        { code: -32700, message: 'Parse error' },
  INVALID_REQUEST:    { code: -32600, message: 'Invalid request' },
  METHOD_NOT_FOUND:   { code: -32601, message: 'Method not found' },
  INVALID_PARAMS:     { code: -32602, message: 'Invalid params' },
  INTERNAL_ERROR:     { code: -32603, message: 'Internal error' },
  SERVER_ERROR:       { code: -32000, message: 'Server error' },
};

// Base para errores de app
export class AppError extends Error {
  constructor(message, { code = 'APP_ERROR', httpStatus = 400, cause, extra } = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.httpStatus = httpStatus;
    if (cause) this.cause = cause;
    if (extra) this.extra = extra;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

// Errores de validación de parámetros
export class ValidationError extends AppError {
  constructor(message, extra) {
    super(message, { code: 'VALIDATION_ERROR', httpStatus: 400, extra });
  }
}

// Errores de configuración (p.ej. falta API key)
export class ConfigError extends AppError {
  constructor(message, extra) {
    super(message, { code: 'CONFIG_ERROR', httpStatus: 500, extra });
  }
}

// Errores del proveedor (Google APIs)
export class ProviderError extends AppError {
  constructor(message, extra) {
    super(message, { code: 'PROVIDER_ERROR', httpStatus: 502, extra });
  }
}

// Rate limiting / cuotas agotadas
export class RateLimitError extends AppError {
  constructor(message, extra) {
    super(message, { code: 'RATE_LIMIT', httpStatus: 429, extra });
  }
}

// Transforma un AppError a objeto JSON-RPC error
export function toJsonRpcError(id, err) {
  // Por defecto, -32000 Server error
  const base = { ...JSON_RPC_ERRORS.SERVER_ERROR };
  const data = {
    appCode: err.code || 'APP_ERROR',
    message: err.message,
  };

  if (err.extra) data.extra = err.extra;

  // Afinar códigos para casos comunes
  if (err instanceof ValidationError) {
    return { jsonrpc: '2.0', id, error: { ...JSON_RPC_ERRORS.INVALID_PARAMS, data } };
  }
  if (err instanceof ConfigError) {
    return { jsonrpc: '2.0', id, error: { ...JSON_RPC_ERRORS.INTERNAL_ERROR, data } };
  }
  if (err instanceof RateLimitError) {
    return { jsonrpc: '2.0', id, error: { code: -32001, message: 'Rate limit', data } };
  }
  if (err instanceof ProviderError) {
    return { jsonrpc: '2.0', id, error: { code: -32002, message: 'Upstream provider error', data } };
  }

  return { jsonrpc: '2.0', id, error: { ...base, data } };
}