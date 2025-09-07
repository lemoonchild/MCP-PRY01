/**
 * @fileoverview Normalized model for a restaurant/place entity.
 * Used across the MCP Food Recommender to ensure consistent structure from Google Places API v1.
 */

/**
 * @typedef {Object} Place
 * @property {string|null} placeId - Unique identifier of the place (from Google).
 * @property {string|null} name - Display name of the place.
 * @property {number|null} rating - Average rating (0–5), or null if unavailable.
 * @property {number} userRatingCount - Total number of user ratings.
 * @property {string|null} priceLevel - Price category (e.g., "PRICE_LEVEL_MODERATE"), or null.
 * @property {{ lat: number, lng: number } | null} location - Geographic coordinates, or null.
 * @property {boolean|null} openNow - Whether the place is currently open. Can be null.
 * @property {string|null} primaryType - Main type of the place (e.g., "restaurant").
 * @property {string[]} types - List of place types (e.g., ["restaurant", "mexican"]).
 * @property {string|null} phone - National phone number.
 * @property {string|null} website - Website URL.
 * @property {string|null} summary - Short editorial summary (if available).
 */

/**
 * Normalizes raw place data from Google Places API into a standard structure.
 * Ensures all fields are present, even if null or defaulted.
 *
 * @param {Object} [raw={}] - Raw place object from the API.
 * @returns {Place} Normalized place object.
 */
export function normalizePlace(raw = {}) {
  return {
    placeId: raw.id ?? null,                       
    name: raw.displayName?.text ?? null,           
    rating: typeof raw.rating === 'number' ? raw.rating : null,
    userRatingCount: typeof raw.userRatingCount === 'number' ? raw.userRatingCount : 0,
    priceLevel: raw.priceLevel ?? null,
    location: raw.location
      ? { lat: raw.location.latitude, lng: raw.location.longitude }
      : null,                                      
    openNow: typeof raw.currentOpeningHours?.openNow === 'boolean'
      ? raw.currentOpeningHours.openNow
      : null,                                      
    primaryType: raw.primaryType ?? null,
    types: Array.isArray(raw.types) ? raw.types : [],
    phone: raw.nationalPhoneNumber ?? null,        
    website: raw.websiteUri ?? null,               
    summary: raw.editorialSummary?.text ?? null,   
  };
}

/**
 * Validates whether the given object conforms to a valid `Place` structure.
 *
 * @param {*} obj - Object to validate.
 * @returns {boolean} `true` if valid, `false` otherwise.
 */
export function isPlace(obj) {
  return obj && typeof obj === 'object' && typeof obj.placeId === 'string';
}