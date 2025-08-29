// Haversine (distancia en km)
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

// Mapea PRICE_LEVEL_* a símbolo y a un entero
export const PriceMap = {
  PRICE_LEVEL_FREE: { symbol: '$', level: 0 },
  PRICE_LEVEL_INEXPENSIVE: { symbol: '$', level: 1 },
  PRICE_LEVEL_MODERATE: { symbol: '$$', level: 2 },
  PRICE_LEVEL_EXPENSIVE: { symbol: '$$$', level: 3 },
  PRICE_LEVEL_VERY_EXPENSIVE: { symbol: '$$$$', level: 4 },
};

export function priceToLevel(priceLevel) {
  if (!priceLevel) return null;
  return PriceMap[priceLevel]?.level ?? null;
}

export function priceToSymbol(priceLevel) {
  if (!priceLevel) return '–';
  return PriceMap[priceLevel]?.symbol ?? '–';
}

/**
 * Funciones de matching
 */

// Coincidencia por keywords simples en name/types/summary
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

function priceMatch(place, allowedLevels = []) {
  if (!allowedLevels?.length) return 1; // si no hay preferencia de precio, no penaliza
  const lvl = priceToLevel(place.priceLevel);
  if (lvl === null || lvl === undefined) return 0.5; // sin dato, score intermedio
  return allowedLevels.includes(lvl) ? 1 : 0;
}

function qualityScore(rating, reviews) {
  if (!rating) return 0;
  const r = Math.min(Math.max(rating, 0), 5); 
  // confianza por volumen de reseñas: usa log para evitar favorecer masivo extremo
  const conf = Math.log10((reviews || 0) + 1) / 3; 
  return (r / 5) * Math.min(conf, 1);
}

function openScore(openNow, requireOpen) {
  if (!requireOpen) return 1;
  if (openNow === true) return 1;
  if (openNow === false) return 0;
  return 0.6; // sin dato: score medio-bajo
}

function distanceScore(km, maxKm = 3) {
  if (km == null) return 0.6; // sin dato
  if (km <= 0.25) return 1;
  if (km >= maxKm) return 0.1;
  // decaimiento lineal simple
  return 1 - (km / maxKm) * 0.9; 
}

/**
 * Calcula score y explicación para un lugar dado un perfil y origen
 * @param {Object} place  (normalizado por googleClient)
 * @param {Object} profile { keywords, priceLevels, minRating, requireOpen }
 *   - keywords: array de strings (cuisines/diets/antojos)
 *   - priceLevels: array de niveles numéricos aceptados (0..4)
 *   - minRating: número, ej. 4.2
 *   - requireOpen: boolean
 * @param {Object} origin { lat, lng } punto del usuario (para distancia)
 */
export function scorePlace(place, profile = {}, origin = null) {
  const {
    keywords = [],
    priceLevels = [],
    minRating = 0,
    requireOpen = false,
    maxDistanceKm = 3,
  } = profile;

  const km = origin && place.location ? haversineKm(origin, place.location) : null;

  // Sub-scores
  const sKeyword = keywordMatch(place, keywords); // 0..1
  const sPrice = priceMatch(place, priceLevels); // 0..1
  const sQual = qualityScore(place.rating, place.userRatingCount); // 0..1
  const sOpen = openScore(place.openNow, requireOpen); // 0..1
  const sDist = distanceScore(km, maxDistanceKm); // 0..1

  // pesos 
  const w = {
    keyword: 0.30,
    price: 0.15,
    quality: 0.30,
    distance: 0.15,
    open: 0.10,
  };

  // rating mínimo hard filter suave: si rating < minRating y existe rating, castigamos
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

  // Construye explicación corta y clara
  return bits.filter(Boolean).join(' · ');
}

/**
 * Rankea una lista de candidatos y devuelve topK con explicación
 * @param {Array} candidates  lugares normalizados
 * @param {Object} profile    preferencias (ver scorePlace)
 * @param {Object} origin     {lat,lng}
 * @param {number} topK
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