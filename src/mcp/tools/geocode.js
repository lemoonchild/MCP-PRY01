import { geocodeAddress } from '../../services/googleClient.js';
import { ValidationError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';

// Convierte dirección a coordenadas (lat/lng) usando tu googleClient.
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