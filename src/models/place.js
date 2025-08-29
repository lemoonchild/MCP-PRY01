/**
 * Modelo de restaurante normalizado.
 * Viene desde services/googleClient.normalizePlace()
 *
 * Estructura esperada:
 * {
 *   placeId: string,
 *   name: string,
 *   rating: number | null,
 *   userRatingCount: number,
 *   priceLevel: string | null,    // ej. "PRICE_LEVEL_MODERATE"
 *   location: { lat: number, lng: number } | null,
 *   openNow: boolean | null,
 *   primaryType: string | null,
 *   types: string[],
 *   phone: string | null,
 *   website: string | null,
 *   summary: string | null
 * }
 */

/**
 * Valida y normaliza un objeto Place.
 * Si falta algún campo, se asegura de dar un valor por defecto.
 */
export function normalizePlace(raw = {}) {
  return {
    placeId: raw.placeId ?? null,
    name: raw.name ?? null,
    rating: typeof raw.rating === 'number' ? raw.rating : null,
    userRatingCount: typeof raw.userRatingCount === 'number' ? raw.userRatingCount : 0,
    priceLevel: raw.priceLevel ?? null,
    location: raw.location ?? null,
    openNow: typeof raw.openNow === 'boolean' ? raw.openNow : null,
    primaryType: raw.primaryType ?? null,
    types: Array.isArray(raw.types) ? raw.types : [],
    phone: raw.phone ?? null,
    website: raw.website ?? null,
    summary: raw.summary ?? null,
  };
}

/**
 * Chequea si un objeto parece ser un Place válido.
 */
export function isPlace(obj) {
  return obj && typeof obj === 'object' && typeof obj.placeId === 'string';
}