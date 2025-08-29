import {
  searchNearbyRestaurants,
  searchTextRestaurants,
} from '../../services/googleClient.js';
import { ValidationError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';

// Validación coordenadas
function assertLatLng(obj) {
  if (!obj || typeof obj.lat !== 'number' || typeof obj.lng !== 'number') {
    throw new ValidationError('Se requiere "location" con { lat:number, lng:number }');
  }
}

// Normaliza y valida radius/maxResults
function normalizeSearchOpts({ radiusMeters, maxResults }) {
  const out = {};
  out.radiusMeters = typeof radiusMeters === 'number' && radiusMeters > 0 ? radiusMeters : 1500;
  out.maxResults = typeof maxResults === 'number' && maxResults > 0 ? maxResults : 20;
  // Places v1 sugiere 20 como tope razonable
  if (out.maxResults > 20) out.maxResults = 20;
  return out;
}

export async function findNearby(params = {}) {
  const { location, openNow = false } = params;
  assertLatLng(location);
  const { radiusMeters, maxResults } = normalizeSearchOpts(params);

  logger.info('tool.places.findNearby.start', {
    lat: location.lat,
    lng: location.lng,
    radiusMeters,
    openNow,
    maxResults,
  });

  const results = await searchNearbyRestaurants({
    lat: location.lat,
    lng: location.lng,
    radius: radiusMeters,
    openNow,
    maxResults,
  });

  logger.info('tool.places.findNearby.ok', { count: results.length });
  return { candidates: results };
}

export async function findByText(params = {}) {
  const {
    query, // ej: "vegan ramen restaurant"
    location,
  } = params;

  if (!query || typeof query !== 'string' || !query.trim()) {
    throw new ValidationError('findByText: parámetro "query" (string) es requerido');
  }

  const { radiusMeters, maxResults } = normalizeSearchOpts(params);

  // location es opcional, pero si viene debe ser válido
  if (location) assertLatLng(location);

  logger.info('tool.places.findByText.start', {
    query: query.trim(),
    hasLocation: Boolean(location),
    radiusMeters,
    maxResults,
  });

  const results = await searchTextRestaurants({
    query: query.trim(),
    lat: location?.lat,
    lng: location?.lng,
    radius: radiusMeters,
    maxResults,
  });

  logger.info('tool.places.findByText.ok', { count: results.length });
  return { candidates: results };
}

export default { findNearby, findByText };