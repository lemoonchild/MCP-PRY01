import { priceToLevel } from '../services/scoring.js';

/**
 * @fileoverview Defines and normalizes the structure of a user profile used for ranking.
 * Profiles include user preferences like keywords, price sensitivity, minimum rating,
 * distance tolerance, and open/closed status.
 */

/**
 * @typedef {Object} UserProfile
 * @property {string[]} keywords - Preferred food types, cravings, or dietary terms (e.g., ["vegan", "ramen"]).
 * @property {number[]} priceLevels - Accepted price levels (0 = free, 1 = inexpensive, ... 4 = very expensive).
 * @property {number} minRating - Minimum acceptable rating (e.g., 4.2).
 * @property {boolean} requireOpen - Whether the place must be currently open.
 * @property {number} maxDistanceKm - Maximum acceptable distance from origin (in kilometers).
 */

/**
 * Normalizes a user profile by:
 * - Ensuring all expected fields exist.
 * - Converting price levels from string to numeric (e.g., "PRICE_LEVEL_MODERATE" → 2).
 * - Applying default values where needed.
 *
 * @param {Object} [profile={}] - Raw profile object received from the user/tool call.
 * @returns {UserProfile} Normalized profile ready for scoring/ranking.
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
 * Validates whether a profile has at least one meaningful preference.
 * Used to avoid scoring/ranking when no constraints are provided.
 *
 * @param {UserProfile | Object} profile - Profile object to check.
 * @returns {boolean} `true` if the profile contains useful filters.
 */
export function isProfileValid(profile = {}) {
  return (
    (profile.keywords?.length || 0) > 0 ||
    (profile.priceLevels?.length || 0) > 0 ||
    profile.minRating > 0
  );
}