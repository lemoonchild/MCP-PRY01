import 'dotenv/config';
import axios from 'axios';
import { normalizePlace as normalizePlaceModel } from '../models/place.js';
import { logger, withTiming } from '../utils/logger.js';
import { ConfigError, ProviderError, RateLimitError } from '../utils/errors.js';

/**
 * @fileoverview Google Client — Integrates with Google Geocoding and Places API v1.
 * Provides wrappers for geocoding addresses, searching nearby or by text, and fetching place details.
 */

// Load and validate API key
const { GOOGLE_API_KEY } = process.env;
if (!GOOGLE_API_KEY) {
  throw new ConfigError('Falta GOOGLE_API_KEY en el entorno (.env)');
}

// Axios client for legacy Geocoding API
const httpLegacy = axios.create({
  baseURL: 'https://maps.googleapis.com',
  timeout: 15000,
});

// Axios client for Places API v1
const httpPlaces = axios.create({
  baseURL: 'https://places.googleapis.com/v1',
  timeout: 15000,
  headers: {
    'X-Goog-Api-Key': GOOGLE_API_KEY,
    'X-Goog-FieldMask': [
      'places.id',
      'places.displayName',
      'places.location',
      'places.rating',
      'places.userRatingCount',
      'places.priceLevel',
      'places.currentOpeningHours',
      'places.primaryType',
      'places.types',
      'places.nationalPhoneNumber',
      'places.websiteUri',
      'places.editorialSummary',
    ].join(','),
  },
});

/**
 * Converts an address string into geolocation data.
 *
 * @param {string} address - The textual address to geocode.
 * @returns {Promise<{ lat: number, lng: number, formattedAddress: string, raw: any }>}
 * @throws {ProviderError|RateLimitError}
 */
export async function geocodeAddress(address) {
  return withTiming('google.geocode', async () => {
    const url = '/maps/api/geocode/json';
    try {
      const { data, status } = await httpLegacy.get(url, {
        params: { address, key: GOOGLE_API_KEY },
      });

      if (data.status !== 'OK' || !data.results?.length) {
        logger.warn('google.geocode.no_results', { status, apiStatus: data.status, msg: data.error_message });
        throw new ProviderError(`Geocoding error: ${data.status || 'UNKNOWN'}`, { apiStatus: data.status });
      }

      const first = data.results[0];
      logger.info('google.geocode.ok', {
        status,
        formattedAddress: first.formatted_address,
      });

      return {
        lat: first.geometry?.location?.lat,
        lng: first.geometry?.location?.lng,
        formattedAddress: first.formatted_address,
        raw: first,
      };
    } catch (e) {
      const st = e.response?.status;
      logger.error('google.geocode.fail', { status: st, err: e?.message });
      if (st === 429) throw new RateLimitError('Geocoding: cuota excedida');
      throw new ProviderError('Geocoding request failed', { status: st });
    }
  });
}

/**
 * Searches for restaurants near a given point using Places Nearby Search.
 *
 * @param {Object} params
 * @param {number} params.lat - Latitude.
 * @param {number} params.lng - Longitude.
 * @param {number} [params.radius=1500] - Search radius in meters.
 * @param {boolean} [params.openNow=false] - Whether to filter by currently open places.
 * @param {number} [params.maxResults=20] - Maximum number of results (max 20).
 * @returns {Promise<Place[]>}
 * @throws {ProviderError|RateLimitError}
 */
export async function searchNearbyRestaurants({
  lat,
  lng,
  radius = 1500,
  openNow = false,
  maxResults = 20,
} = {}) {
  return withTiming('google.places.nearby', async () => {
    const body = {
      includedTypes: ['restaurant'],
      maxResultCount: Math.max(1, Math.min(maxResults, 20)),
      locationRestriction: {
        circle: { center: { latitude: lat, longitude: lng }, radius },
      },
      ...(openNow ? { openNow: true } : {}),
    };

    try {
      const { data, status } = await httpPlaces.post('/places:searchNearby', body);
      const places = Array.isArray(data.places) ? data.places : [];
      logger.info('google.places.nearby.ok', { status, count: places.length });
      return places.map(normalizePlaceModel);
    } catch (e) {
      const st = e.response?.status;
      logger.error('google.places.nearby.fail', { status: st, err: e?.message });
      if (st === 429) throw new RateLimitError('Google Places: cuota excedida');
      throw new ProviderError('Google Places nearby error', { status: st, hint: 'verifica FieldMask/quotas' });
    }
  });
}

/**
 * Performs a text search for restaurants using freeform queries (e.g. "vegan sushi").
 *
 * @param {Object} params
 * @param {string} params.query - The search text (required).
 * @param {number} [params.lat] - Optional latitude for biasing results.
 * @param {number} [params.lng] - Optional longitude for biasing results.
 * @param {number} [params.radius=2000] - Radius for location bias (meters).
 * @param {number} [params.maxResults=20] - Maximum results (max 20).
 * @returns {Promise<Place[]>}
 * @throws {ProviderError|RateLimitError}
 */
export async function searchTextRestaurants({
  query,
  lat,
  lng,
  radius = 2000,
  maxResults = 20,
} = {}) {
  return withTiming('google.places.textSearch', async () => {
    const body = {
      textQuery: query,
      maxResultCount: Math.max(1, Math.min(maxResults, 20)),
      ...(typeof lat === 'number' && typeof lng === 'number'
        ? { locationBias: { circle: { center: { latitude: lat, longitude: lng }, radius } } }
        : {}),
    };

    try {
      const { data, status } = await httpPlaces.post('/places:searchText', body);
      const places = Array.isArray(data.places) ? data.places : [];
      logger.info('google.places.textSearch.ok', { status, count: places.length, hasBias: Boolean(lat && lng) });
      return places.map(normalizePlaceModel);
    } catch (e) {
      const st = e.response?.status;
      logger.error('google.places.textSearch.fail', { status: st, err: e?.message });
      if (st === 429) throw new RateLimitError('Google Places Text Search: cuota excedida');
      throw new ProviderError('Google Places text search error', { status: st });
    }
  });
}

/**
 * Retrieves detailed information about a place using its `placeId`.
 *
 * @param {string} placeId - Unique identifier of the place.
 * @returns {Promise<Place>}
 * @throws {ProviderError|RateLimitError}
 */
export async function getPlaceDetails(placeId) {
  return withTiming('google.places.details', async () => {
    if (!placeId) throw new ProviderError('getPlaceDetails: placeId requerido');

    try {
      const fieldMask = [
        'id',
        'displayName',
        'location',
        'rating',
        'userRatingCount',
        'priceLevel',
        'currentOpeningHours',
        'primaryType',
        'types',
        'nationalPhoneNumber',
        'websiteUri',
        'editorialSummary'
      ].join(',');

      const { data, status } = await httpPlaces.get(`/places/${encodeURIComponent(placeId)}`, {
        params: {
          key: GOOGLE_API_KEY, 
          fields: fieldMask,  
        }
      });

      logger.info('google.places.details.ok', { status, placeId });
      return normalizePlaceModel(data);
    } catch (e) {
      const st = e.response?.status;
      logger.error('google.places.details.fail', { status: st, err: e?.message, placeId });
      if (st === 429) throw new RateLimitError('Google Places Details: cuota excedida');
      throw new ProviderError('Google Places details error', { status: st });
    }
  });
}

// Named export for structured import use
export default {
  geocodeAddress,
  searchNearbyRestaurants,
  searchTextRestaurants,
  getPlaceDetails
};