import { priceToLevel } from '../services/scoring.js';

/**
 * Modelo de perfil de usuario.
 * Ejemplo:
 * {
 *   keywords: ["vegan", "ramen"],
 *   priceLevels: [1, 2],   // acepta INEXPENSIVE y MODERATE
 *   minRating: 4.2,
 *   requireOpen: true,
 *   maxDistanceKm: 3.0
 * }
 */

/**
 * Normaliza el perfil recibido.
 * - Convierte priceLevels de string ("PRICE_LEVEL_MODERATE") a número.
 * - Aplica valores por defecto si faltan campos.
 */
export function normalizeProfile(profile = {}) {
  const out = {};

  out.keywords = Array.isArray(profile.keywords)
    ? profile.keywords.map(String)
    : [];

  if (Array.isArray(profile.priceLevels)) {
    out.priceLevels = profile.priceLevels
      .map((lv) => {
        if (typeof lv === 'number') return lv;
        if (typeof lv === 'string') return priceToLevel(lv);
        return null;
      })
      .filter((x) => x !== null);
  } else {
    out.priceLevels = [];
  }

  out.minRating = typeof profile.minRating === 'number' ? profile.minRating : 0;

  out.requireOpen = Boolean(profile.requireOpen);

  out.maxDistanceKm = typeof profile.maxDistanceKm === 'number' ? profile.maxDistanceKm : 3;

  return out;
}

/**
 * Valida si un perfil tiene al menos una preferencia útil.
 */
export function isProfileValid(profile = {}) {
  return (
    (profile.keywords?.length || 0) > 0 ||
    (profile.priceLevels?.length || 0) > 0 ||
    profile.minRating > 0
  );
}