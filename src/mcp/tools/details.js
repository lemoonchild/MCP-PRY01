import { getPlaceDetails } from '../../services/googleClient.js';
import { ValidationError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';

// Enriquece un restaurante por placeId
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