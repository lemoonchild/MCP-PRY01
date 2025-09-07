import { geocodeAddress } from '../../services/googleClient.js';
import { ValidationError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';

/**
 * @fileoverview Tool implementation: `geocode`.
 * Converts a textual address into geographic coordinates using Google Geocoding API.
 */

/**
 * Converts an address to latitude and longitude using the `geocodeAddress` service.
 *
 * @param {Object} [params={}] - Parameters object.
 * @param {string} params.address - The address to geocode. Must be a non-empty string.
 * @returns {Promise<{ formattedAddress: string, location: { lat: number, lng: number } }>} 
 * A promise resolving to the formatted address and location coordinates.
 * @throws {ValidationError} If `address` is missing or invalid.
 */
export async function geocode(params = {}) {
  const { address } = params;

  if (!address || typeof address !== 'string' || !address.trim()) {
    throw new ValidationError('geocode: parámetro "address" (string) es requerido');
  }

  logger.info('tool.geocode.start', { address });

  const geo = await geocodeAddress(address.trim());

  logger.info('tool.geocode.ok', {
    formattedAddress: geo.formattedAddress,
    lat: geo.lat,
    lng: geo.lng,
  });

  return {
    formattedAddress: geo.formattedAddress,
    location: { lat: geo.lat, lng: geo.lng },
  };
}

export default { geocode };