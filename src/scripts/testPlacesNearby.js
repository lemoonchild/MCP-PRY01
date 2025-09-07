import 'dotenv/config';
import axios from 'axios';


/**
 * @fileoverview Test script for Google Places API v1 — Nearby Search.
 * Fetches restaurants near a fixed location and logs their details.
 * Requires a valid `GOOGLE_API_KEY` in the `.env` file.
 */

// Load API key from environment
const { GOOGLE_API_KEY } = process.env;
if (!GOOGLE_API_KEY) {
  console.error('Falta GOOGLE_API_KEY en .env');
  process.exit(1);
}

/**
 * Performs a nearby search using Google Places API v1.
 * Logs the first 5 restaurant results including name, rating, review count, and price level.
 *
 * @async
 * @function main
 * @returns {Promise<void>}
 */
async function main() {
  const center = { latitude: 14.5572969, longitude: -90.73322329999999 }; 
  const url = 'https://places.googleapis.com/v1/places:searchNearby';

  /** @type {Object} */
  const body = {
    includedTypes: ['restaurant'],
    maxResultCount: 10,
    openNow: true, 
    locationRestriction: {
      circle: { center, radius: 1500 }
    }
  };

  /** @type {Object} */
  const headers = {
    'X-Goog-Api-Key': GOOGLE_API_KEY,
    'X-Goog-FieldMask': [
      'places.id',
      'places.displayName',
      'places.location',
      'places.rating',
      'places.userRatingCount',
      'places.priceLevel',
      'places.currentOpeningHours'
    ].join(',')
  };

  const { data } = await axios.post(url, body, { headers });
  const results = data.places || [];
  console.log(`Encontrados: ${results.length}`);
  results.slice(0, 5).forEach((p, i) => {
    console.log(
      `${i + 1}. ${p.displayName?.text} — rating ${p.rating} (${p.userRatingCount}) — price ${p.priceLevel}`
    );
  });
}

// Execute with error handling
main().catch(err => {
  console.error('Request failed:', err.response?.data || err.message);
});