import 'dotenv/config';
import express from 'express';
import morgan from 'morgan';

import { geocode } from './tools/geocode.js';
import { findNearby, findByText } from './tools/places.js';
import { details } from './tools/details.js';
import { rank } from './tools/ranking.js';

import { logger } from '../utils/logger.js';
import { toJsonRpcError } from '../utils/errors.js';

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

app.use(express.json({ limit: '1mb' }));
app.use(morgan('tiny'));

app.get('/health', (_req, res) => {
  logger.info('healthcheck');
  res.status(200).json({ ok: true, service: 'mcp-food-recommender', time: new Date().toISOString() });
});

const methods = new Map([
  ['geocode', geocode],
  ['places.findNearby', findNearby],
  ['places.findByText', findByText],
  ['places.details', details],
  ['ranking.rank', rank],
]);

function isObject(x) {
  return x !== null && typeof x === 'object' && !Array.isArray(x);
}

// Solo para errores de protocolo JSON-RPC 
function makeError(id, code, message, data) {
  const err = { jsonrpc: '2.0', error: { code, message } };
  if (id !== undefined) err.id = id;
  if (data !== undefined) err.error.data = data;
  return err;
}

async function handleRpcCall(payload) {
  // Validación mínima JSON-RPC 2.0
  if (!isObject(payload) || payload.jsonrpc !== '2.0') {
    return makeError(undefined, -32600, 'Invalid Request');
  }
  const { id, method, params } = payload;

  if (typeof method !== 'string' || !methods.has(method)) {
    return makeError(id, -32601, 'Method not found', { method });
  }

  const fn = methods.get(method);
  const started = Date.now();
  logger.info('rpc.call', { id, method, params });

  try {
    const result = await fn(params ?? {});
    const ms = Date.now() - started;
    logger.info('rpc.result', { id, method, ms });
    return { jsonrpc: '2.0', id, result };
  } catch (err) {
    const ms = Date.now() - started;
    // Log del error sin exponer datos sensibles
    logger.error('rpc.error', { id, method, ms, err: err?.message });
    // Mapear el error de app a JSON-RPC (-32602, -3200x, etc.) 
    return toJsonRpcError(id, err);
  }
}

app.post('/rpc', async (req, res) => {
  const body = req.body;

  try {
    if (Array.isArray(body)) {
      if (body.length === 0) {
        logger.warn('rpc.batch.empty');
        return res.status(400).json([makeError(undefined, -32600, 'Invalid Request')]);
      }
      logger.info('rpc.batch.start', { count: body.length });
      const results = await Promise.all(body.map(handleRpcCall));
      logger.info('rpc.batch.end', { count: results.length });
      return res.status(200).json(results);
    } else {
      const result = await handleRpcCall(body);
      const httpStatus = result?.error ? 400 : 200;
      return res.status(httpStatus).json(result);
    }
  } catch (e) {
    logger.error('rpc.internal', { err: e?.message });
    return res
      .status(500)
      .json(makeError(undefined, -32603, 'Internal error', { message: e?.message || String(e) }));
  }
});

export function startServer() {
  app.listen(PORT, () => {
    logger.info('server.start', { url: `http://localhost:${PORT}`, rpc: `/rpc` });
  });
}