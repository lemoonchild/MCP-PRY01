import 'dotenv/config';
import axios from 'axios';

/**
 * @fileoverview Simple test script for Google Geocoding API.
 * Converts a sample address into coordinates and logs the result.
 * Requires `GOOGLE_API_KEY` to be defined in a `.env` file.
 */

// Load API key from environment
const { GOOGLE_API_KEY } = process.env;
if (!GOOGLE_API_KEY) {
  console.error('Falta GOOGLE_API_KEY en .env');
  process.exit(1);
}

/**
 * Makes a request to the Google Geocoding API for a hardcoded address,
 * logs the formatted address and geographic coordinates to the console.
 *
 * @async
 * @function main
 * @returns {Promise<void>}
 */
async function main() {
  const address = 'Antigua Guatemala'; 
  const url = 'https://maps.googleapis.com/maps/api/geocode/json';

  const { data } = await axios.get(url, {
    params: { address, key: GOOGLE_API_KEY }
  });

  if (data.status !== 'OK') {
    console.error('Geocoding error:', data.status, data.error_message);
    process.exit(1);
  }

  const first = data.results[0];
  console.log('Formatted address:', first.formatted_address);
  console.log('Location:', first.geometry.location); 
}

// Execute and handle top-level errors
main().catch(err => {
  console.error('Request failed:', err.response?.data || err.message);
});