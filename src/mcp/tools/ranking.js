import { rankAndExplain } from '../../services/scoring.js';
import { normalizeProfile as normalizeProfileModel } from '../../models/profile.js';
import { ValidationError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';

/**
 * @fileoverview Tool implementation: `ranking_rank`.
 * Ranks a list of candidate places using user preferences and location.
 */

/**
 * Ensures that the `candidates` parameter is a valid array of places.
 *
 * @param {*} candidates - The list of candidate places to rank.
 * @throws {ValidationError} If not a valid array.
 */
function assertCandidates(candidates) {
  if (!Array.isArray(candidates)) {
    throw new ValidationError('"candidates" debe ser un array de lugares normalizados');
  }
}

/**
 * Normalizes and validates the origin object, if provided.
 *
 * @param {Object} origin
 * @param {number} origin.lat
 * @param {number} origin.lng
 * @returns {{ lat: number, lng: number } | null}
 * @throws {ValidationError} If the origin is invalid.
 */
function normalizeOrigin(origin) {
  if (!origin) return null;
  const { lat, lng } = origin;
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    throw new ValidationError('"origin" debe tener { lat:number, lng:number }');
  }
  return { lat, lng };
}

/**
 * Tool: `ranking_rank`
 *
 * Ranks a list of restaurant/place candidates based on a user profile and optional origin.
 *
 * @param {Object} [params={}] - Parameters object.
 * @param {Array<import('../../models/place.js').Place>} params.candidates - List of places to rank.
 * @param {import('../../models/profile.js').UserProfile} [params.profile] - User preferences for scoring.
 * @param {{ lat: number, lng: number }} [params.origin] - Optional location to calculate distance.
 * @param {number} [params.topK=10] - Maximum number of ranked items to return.
 * @returns {Promise<{
 *   total: number,
 *   returned: number,
 *   items: Array<{
 *     placeId: string,
 *     name: string,
 *     rating: number,
 *     userRatingCount: number,
 *     priceLevel: string,
 *     location: { lat: number, lng: number },
 *     openNow: boolean | null,
 *     score: number,
 *     why: string,
 *     website: string | null,
 *     phone: string | null,
 *     types: string[],
 *     primaryType: string | null
 *   }>
 * }>} Ranked list of places with explanations.
 * @throws {ValidationError} If inputs are invalid.
 */
export async function rank(params = {}) {
  const { candidates, profile, origin, topK = 10 } = params;

  assertCandidates(candidates);
  const normProfile = normalizeProfileModel(profile || {});
  const normOrigin = origin ? normalizeOrigin(origin) : null;

  if (typeof topK !== 'number' || topK <= 0) {
    throw new ValidationError('"topK" debe ser un número positivo');
  }

  logger.info('tool.ranking.start', {
    totalCandidates: candidates.length,
    topK,
    profile: {
      keywords: normProfile.keywords,
      priceLevels: normProfile.priceLevels,
      minRating: normProfile.minRating,
      requireOpen: normProfile.requireOpen,
      maxDistanceKm: normProfile.maxDistanceKm,
    },
    hasOrigin: Boolean(normOrigin),
  });

  const ranked = rankAndExplain(candidates, normProfile, normOrigin, topK);

  logger.info('tool.ranking.ok', { returned: ranked.length });

  return {
    total: candidates.length,
    returned: ranked.length,
    items: ranked.map((p) => ({
      placeId: p.placeId,
      name: p.name,
      rating: p.rating,
      userRatingCount: p.userRatingCount,
      priceLevel: p.priceLevel,
      location: p.location,
      openNow: p.openNow,
      score: Number(p.score.toFixed(4)),
      why: p.why,
      website: p.website ?? null,
      phone: p.phone ?? null,
      types: p.types ?? [],
      primaryType: p.primaryType ?? null,
    })),
  };
}

export default { rank };