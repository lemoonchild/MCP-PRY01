import { rankAndExplain } from '../../services/scoring.js';
import { normalizeProfile as normalizeProfileModel } from '../../models/profile.js';
import { ValidationError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';

function assertCandidates(candidates) {
  if (!Array.isArray(candidates)) {
    throw new ValidationError('"candidates" debe ser un array de lugares normalizados');
  }
}

function normalizeOrigin(origin) {
  if (!origin) return null;
  const { lat, lng } = origin;
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    throw new ValidationError('"origin" debe tener { lat:number, lng:number }');
  }
  return { lat, lng };
}

/**
 * rank: recibe candidatos + perfil + origen y devuelve topK con score y explicación
 * params:
 *  - candidates: [ { placeId, name, rating, userRatingCount, priceLevel, location:{lat,lng}, openNow, ... } ]
 *  - profile: { keywords, priceLevels, minRating, requireOpen, maxDistanceKm }
 *  - origin: { lat, lng }
 *  - topK: number (default 10)
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