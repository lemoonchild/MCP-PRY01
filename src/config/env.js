import 'dotenv/config';

/**
 * @fileoverview Loads and exports environment variables used by the application.
 * Uses dotenv to load variables from a `.env` file into process.env.
 */

/**
 * Google API key used for Geocoding and Places API access.
 * Must be set in the `.env` file as `GOOGLE_API_KEY`.
 *
 * @type {string | undefined}
 */
export const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;