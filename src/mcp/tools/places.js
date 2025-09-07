import {
  searchNearbyRestaurants,
  searchTextRestaurants,
} from '../../services/googleClient.js';
import { ValidationError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';

/**
 * @fileoverview Tool implementation: `places_findNearby` and `places_findByText`.
 * Provides search functionality for restaurants using Google Places API v1,
 * either by proximity (lat/lng) or by text query (e.g., craving or keyword).
 */

/**
 * Validates that the provided object is a valid lat/lng location.
 * 
 * @param {Object} obj - Object expected to contain `lat` and `lng` properties.
 * @throws {ValidationError} If lat/lng are missing or invalid.
 */
function assertLatLng(obj) {
  if (!obj || typeof obj.lat !== 'number' || typeof obj.lng !== 'number') {
    throw new ValidationError('Se requiere "location" con { lat:number, lng:number }');
  }
}

/**
 * Normalizes and validates optional radius and result limit.
 *
 * @param {Object} opts
 * @param {number} [opts.radiusMeters]
 * @param {number} [opts.maxResults]
 * @returns {{ radiusMeters: number, maxResults: number }} Normalized options.
 */
function normalizeSearchOpts({ radiusMeters, maxResults }) {
  const out = {};
  out.radiusMeters = typeof radiusMeters === 'number' && radiusMeters > 0 ? radiusMeters : 1500;
  out.maxResults = typeof maxResults === 'number' && maxResults > 0 ? maxResults : 20;
  if (out.maxResults > 20) out.maxResults = 20;
  return out;
}

/**
 * Tool: `places_findNearby`
 *
 * Searches for restaurants near a given location using the Google Places API.
 *
 * @param {Object} [params={}]
 * @param {{ lat: number, lng: number }} params.location - Required lat/lng object.
 * @param {boolean} [params.openNow=false] - Optional filter to only return places currently open.
 * @param {number} [params.radiusMeters] - Optional radius in meters (default 1500).
 * @param {number} [params.maxResults] - Optional max number of results (1–20).
 * @returns {Promise<{ candidates: import('../../models/place.js').Place[] }>} A list of nearby restaurant candidates.
 * @throws {ValidationError} If location is missing or invalid.
 */
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

/**
 * Tool: `places_findByText`
 *
 * Searches for restaurants by text query (e.g., craving or keyword), optionally biased by location.
 *
 * @param {Object} [params={}]
 * @param {string} params.query - Search text (e.g., "vegan ramen").
 * @param {{ lat: number, lng: number }} [params.location] - Optional location for biasing results.
 * @param {number} [params.radiusMeters] - Optional search radius in meters.
 * @param {number} [params.maxResults] - Optional max number of results (1–20).
 * @returns {Promise<{ candidates: import('../../models/place.js').Place[] }>} A list of matching restaurant candidates.
 * @throws {ValidationError} If `query` is missing or invalid.
 */
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