/**
 * @fileoverview Scoring utilities for restaurant candidates.
 * Includes Haversine distance, price mapping, keyword matching,
 * and ranking functions that return scored and explained results.
 */

/**
 * Calculates the distance in kilometers between two coordinates using the Haversine formula.
 *
 * @param {{ lat: number, lng: number }} a
 * @param {{ lat: number, lng: number }} b
 * @returns {number|null} Distance in kilometers, or null if missing data
 */
export function haversineKm(a, b) {
  if (!a || !b) return null;
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;

  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);

  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return R * c;
}

/**
 * Price level mapping from Google constants to symbols and integer levels.
 */
export const PriceMap = {
  PRICE_LEVEL_FREE: { symbol: '$', level: 0 },
  PRICE_LEVEL_INEXPENSIVE: { symbol: '$', level: 1 },
  PRICE_LEVEL_MODERATE: { symbol: '$$', level: 2 },
  PRICE_LEVEL_EXPENSIVE: { symbol: '$$$', level: 3 },
  PRICE_LEVEL_VERY_EXPENSIVE: { symbol: '$$$$', level: 4 },
};

/**
 * Converts Google price level string to numeric level (0–4).
 * @param {string} priceLevel
 * @returns {number|null}
 */
export function priceToLevel(priceLevel) {
  if (!priceLevel) return null;
  return PriceMap[priceLevel]?.level ?? null;
}

/**
 * Converts Google price level string to a symbol.
 * @param {string} priceLevel
 * @returns {string}
 */
export function priceToSymbol(priceLevel) {
  if (!priceLevel) return '–';
  return PriceMap[priceLevel]?.symbol ?? '–';
}


/**
 * Converts a monetary budget (e.g. in GTQ) into allowed price levels.
 *
 * @param {{ amount: number, currency?: string }} maxBudget
 * @returns {number[]|null} Array of accepted levels (0–4) or null
 */
function budgetToAllowedLevels(maxBudget) {
  if (!maxBudget?.amount || maxBudget.amount <= 0) return null;
  const amount = maxBudget.amount;
  const cur = (maxBudget.currency || 'GTQ').toUpperCase();

  const thresholdsGTQ = [
    { max: 50, levels: [0,1] },
    { max: 100, levels: [1,2] },
    { max: 200, levels: [2,3] },
    { max: Infinity, levels: [3,4] },
  ];

  const table = (cur === 'GTQ') ? thresholdsGTQ : thresholdsGTQ; 
  const row = table.find(r => amount <= r.max) || table[table.length - 1];
  return row.levels;
}

/**
 * Returns keyword match score [0–1] based on how many keywords appear in name/types/summary.
 * @param {Object} place
 * @param {string[]} keywords
 * @returns {number}
 */
function keywordMatch(place, keywords = []) {
  if (!keywords?.length) return 0;
  const bag = [
    place.name || '',
    ...(place.types || []),
    place.summary || '',
    place.primaryType || '',
  ]
    .join(' ')
    .toLowerCase();

  let hits = 0;
  for (const kw of keywords) {
    const k = String(kw || '').toLowerCase().trim();
    if (!k) continue;
    if (bag.includes(k)) hits += 1;
  }
  return hits / keywords.length; 
}

/**
 * Checks if price level is allowed based on preferences and budget.
 * @returns {number} Score between 0–1
 */
function priceMatch(place, allowedLevels = [], budgetLevels = null) {

  let effective = allowedLevels?.length ? new Set(allowedLevels) : null;
  if (budgetLevels?.length) {
    const byBudget = new Set(budgetLevels);
    if (effective) {
      effective = new Set([...effective].filter(x => byBudget.has(x)));
    } else {
      effective = byBudget;
    }
  }

  if (!effective || effective.size === 0) return 1;

  const lvl = priceToLevel(place.priceLevel);
  if (lvl === null || lvl === undefined) return 0.5; 
  return effective.has(lvl) ? 1 : 0;
}

/**
 * Computes quality score from rating and review count.
 * @returns {number}
 */
function qualityScore(rating, reviews) {
  if (!rating) return 0;
  const r = Math.min(Math.max(rating, 0), 5); 
  // confianza por volumen de reseñas: usa log para evitar favorecer masivo extremo
  const conf = Math.log10((reviews || 0) + 1) / 3; 
  return (r / 5) * Math.min(conf, 1);
}

/**
 * Computes openNow score based on user preference.
 * @returns {number}
 */
function openScore(openNow, requireOpen) {
  if (!requireOpen) return 1;
  if (openNow === true) return 1;
  if (openNow === false) return 0;
  return 0.6; 
}

/**
 * Computes distance score, penalizing farther places.
 * @returns {number}
 */
function distanceScore(km, maxKm = 3) {
  if (km == null) return 0.6; 
  if (km <= 0.25) return 1;
  if (km >= maxKm) return 0.1;
  return 1 - (km / maxKm) * 0.9; 
}

/**
 * Computes a weighted score and reason for a candidate place.
 *
 * @param {Object} place - A normalized place.
 * @param {Object} profile - Scoring preferences:
 *   keywords, priceLevels, minRating, requireOpen, maxDistanceKm, maxBudget
 * @param {{ lat: number, lng: number }|null} origin - User location for distance
 * @returns {{ score: number, why: string }}
 */
export function scorePlace(place, profile = {}, origin = null) {
  const {
    keywords = [],
    priceLevels = [],
    minRating = 0,
    requireOpen = false,
    maxDistanceKm = 3,
    maxBudget = null,
  } = profile;

  const km = origin && place.location ? haversineKm(origin, place.location) : null;

  const budgetLevels = budgetToAllowedLevels(maxBudget);

  const sKeyword = keywordMatch(place, keywords); 
  const sPrice = priceMatch(place, priceLevels, budgetLevels); 
  const sQual = qualityScore(place.rating, place.userRatingCount);
  const sOpen = openScore(place.openNow, requireOpen); 
  const sDist = distanceScore(km, maxDistanceKm); 

  const w = {
    keyword: 0.30,
    price: 0.15,
    quality: 0.30,
    distance: 0.15,
    open: 0.10,
  };

  const ratingPenalty =
    typeof place.rating === 'number' && place.rating < minRating ? 0.6 : 1;

  const score =
    (w.keyword * sKeyword +
      w.price * sPrice +
      w.quality * sQual +
      w.distance * sDist +
      w.open * sOpen) *
    ratingPenalty;

  const why = buildWhy(place, {
    km,
    sKeyword,
    sPrice,
    sQual,
    sDist,
    sOpen,
    minRating,
    keywords,
  });

  return { score, why };
}

/**
 * Builds a user-friendly explanation of why a place scored well.
 *
 * @param {Object} place
 * @param {Object} ctx
 * @returns {string}
 */
function buildWhy(place, ctx) {
  const bits = [];

  // nombre + precio
  const priceSym = priceToSymbol(place.priceLevel);
  if (priceSym && priceSym !== '–') bits.push(priceSym);

  if (typeof place.rating === 'number') {
    const reviews = place.userRatingCount ? ` (${place.userRatingCount} reseñas)` : '';
    bits.push(`${place.rating.toFixed(1)}★${reviews}`);
  }

  if (typeof ctx.km === 'number') {
    const distTxt = ctx.km < 1 ? `${Math.round(ctx.km * 1000)} m` : `${ctx.km.toFixed(1)} km`;
    bits.push(`a ${distTxt}`);
  }

  if (ctx.keywords?.length) {
    const kMatchPct = Math.round(ctx.sKeyword * 100);
    if (kMatchPct >= 50) {
      bits.push(`match gustos ${kMatchPct}% (${ctx.keywords.join(', ')})`);
    }
  }

  if (place.openNow === true) bits.push('abierto ahora');

  return bits.filter(Boolean).join(' · ');
}

/**
 * Ranks a list of normalized candidates using the user's profile and location.
 *
 * @param {Object[]} candidates - Array of normalized places.
 * @param {Object} profile - User preferences.
 * @param {{ lat: number, lng: number }|null} origin - Location of the user.
 * @param {number} topK - Max number of items to return.
 * @returns {Object[]} Ranked candidates with `score` and `why` fields added.
 */
export function rankAndExplain(candidates = [], profile = {}, origin = null, topK = 10) {
  const scored = candidates
    .map((p) => {
      const { score, why } = scorePlace(p, profile, origin);
      return { ...p, score, why };
    })
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, topK);
}

export default {
  haversineKm,
  priceToLevel,
  priceToSymbol,
  scorePlace,
  rankAndExplain,
};