import { getPlaceDetails } from '../../services/googleClient.js';
import { ValidationError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';

/**
 * @fileoverview Tool implementation: `places_details`.
 * Fetches additional information about a restaurant or place by its `placeId`.
 */

/**
 * Retrieves enriched place details using the Google Places API v1.
 *
 * @param {Object} [params={}] - Parameters object.
 * @param {string} params.placeId - The Place ID to look up. Must be a non-empty string.
 * @returns {Promise<{ place: import('../../models/place.js').Place }>} A promise resolving to an object with the normalized place details.
 * @throws {ValidationError} If `placeId` is missing or invalid.
 */
export async function details(params = {}) {
  const { placeId } = params;

  if (!placeId || typeof placeId !== 'string' || !placeId.trim()) {
    throw new ValidationError('details: parámetro "placeId" (string) es requerido');
  }

  logger.info('tool.details.start', { placeId });

  const place = await getPlaceDetails(placeId.trim());

  logger.info('tool.details.ok', { placeId, hasWebsite: Boolean(place.website) });
  return { place };
}

export default { details };