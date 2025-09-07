# MCP Food Recommender

**Model Context Protocol (MCP)** server for food recommendations based on Google Maps Platform (Geocoding + Places API v1) and a configurable ranking engine.

---

## What is this project? 

An MCP server that exposes _tools_ via **STDIO** so a client (e.g., a CLI or an MCP-enabled Chat LLM) can:

1. **Geocode addresses** → coordinates { lat, lng }.
2. **Search** for restaurants by proximity or text/craving.
3. **Fetch details** of a place by placeId (website, phone, etc.).
4. **Rank** candidates using user preferences (keywords, price, minimum rating, distance, open now, and heuristic budget).

---

## Main Components

* **`src/mcp/server.js`**: MCP server using _@modelcontextprotocol/sdk_, registering and resolving tools.
* **`src/mcp/tools/*.js`**: Tool implementations (geocode, places, details, ranking).
* **`src/services/googleClient.js`**: Google integration (Axios, FieldMasks, Place normalization).
* **`src/services/scoring.js`**: Ranking and explanation engine.
* **`src/models/*.js`**: Normalizers (profile, place, etc.).
* **`src/utils/*.js`**: Logger, errors, helpers.
* **`src/scripts/*.js`**: Test scripts for Geocoding and Places API v1 connections.

---

## Exposed Tools (MCP)

### 1) `geocode`

Converts an address to coordinates.

```jsonc
{
  "name": "geocode",
  "input": { "address": "string (requerido)" },
  "returns": {
    "formattedAddress": "string",
    "location": { "lat": "number", "lng": "number" }
  }
}
```

### 2) `places_findNearby`

Finds restaurants near a given location.

```jsonc
{
  "name": "places_findNearby",
  "input": {
    "location": { "lat": "number", "lng": "number" },
    "openNow": "boolean (opcional)",
    "radiusMeters": "number (opcional, default 1500)",
    "maxResults": "number (opcional, <= 20)"
  },
  "returns": { "candidates": [ /* lugares normalizados */ ] }
}
```

### 3) `places_findByText`

Searches for restaurants by text/craving with location bias.

```jsonc
{
  "name": "places_findByText",
  "input": {
    "query": "string (requerido)",
    "location": { "lat": "number", "lng": "number" } (opcional),
    "radiusMeters": "number (opcional, default 2000)",
    "maxResults": "number (opcional, <= 20)"
  },
  "returns": { "candidates": [ /* lugares normalizados */ ] }
}
```

### 4) `places_details`

Fetches place details by `placeId`.

```jsonc
{
  "name": "places_details",
  "input": { "placeId": "string (requerido)" },
  "returns": { "place": { /* Place normalizado */ } }
}
```

### 5) `ranking_rank`

Ranks candidates based on the user's profile and origin.

```jsonc
{
  "name": "ranking_rank",
  "input": {
    "candidates": [ /* lugares normalizados */ ],
    "profile": {
      "keywords": ["string"],
      "priceLevels": [0,1,2,3,4],
      "minRating": "number",
      "requireOpen": "boolean",
      "maxDistanceKm": "number",
      "maxBudget": { "amount": "number", "currency": "string (GTQ, etc.)" }
    },
    "origin": { "lat": "number", "lng": "number" },
    "topK": "number (opcional, default 10)"
  },
  "returns": {
    "total": "number",
    "returned": "number",
    "items": [
      {
        "placeId": "string",
        "name": "string",
        "rating": "number",
        "userRatingCount": "number",
        "priceLevel": "PRICE_LEVEL_*",
        "location": { "lat": "number", "lng": "number" },
        "openNow": "boolean|null",
        "score": "number",
        "why": "string",
        "website": "string|null",
        "phone": "string|null",
        "types": ["string"],
        "primaryType": "string|null"
      }
    ]
  }
}
```

---

## What questions and filters are supported?

### Search (Google)

* **Type:** restaurant (fixed).
* **Radius:** meters (radiusMeters).
* **Location:** { lat, lng }.
* **Open now:** openNow:true (Nearby only; for Text Search this is handled in ranking with requireOpen).
* **Text/Craving:** query for Text Search.

### Ranking (User preferences)

* **Keywords (30%):** match name, types, summary, primaryType.
* **Price (15%):** priceLevels (0..4) and budget maxBudget → estimated price levels (heuristic).
* **Quality (30%):** rating weighted by review count (log scale).
* **Distance (15%):** Haversine with linear decay up to maxDistanceKm.
* **Open (10%):** if requireOpen:true, favors openNow===true.
* **minRating:** soft penalty (0.6×) if rating < minimum.

> **Budget (e.g., under Q60)**: Places doesn’t provide real prices; budget → priceLevel mapping is heuristic.

---

## Example user queries

* “I’m at _[address]_, want tacos that are open now, within 1.5 km, cheap, and at least 4.2 rating, give me top 5.”
* “Looking for vegan ramen under Q60, near me and open now.”
* “Only $ and $$, min rating 4.0, within 2 km, pizza.”

> The MCP client converts these phrases into calls: geocode → places_* → ranking_rank with appropriate parameters.

---

## Installation

### Requirements

* Node.js 18+
* A **Google API Key** with access to **Geocoding API** and **Places API v1.**

  * Generate one in [Google Cloud Console](https://cloud.google.com/).
  * **Important:** Creating an API key requires a credit/debit card. Google provides $300 in free credits for 90 days, after which charges will apply.

### Dependencies

```bash
npm install
```

### Environment variables (server)

Create a `.env` file in the MCP folder: 

```
GOOGLE_API_KEY=your_api_key
```

---

## Build & run the MCP

> The MCP client reads `MCP_FOOD_ARGS` pointing to `dist/src/index.js`, so a build is required.


### Build script

```bash
npm run build
```

---

## Connect MCP to client (CLI)

Configure your **MCP client** with these variables (e.g., in client `.env`):

```
# MCP Local
GOOGLE_API_KEY=your_google_api_key
MCP_FOOD_COMMAND=node
MCP_FOOD_ARGS=/home/usr/MCP-PRY01/dist/src/index.js 
```

> **Important:** MCP_FOOD_ARGS must point to the built file. Run the build script before starting the CLI, and make sure it points to `dist/index.js`.

---

## Typical end-to-end flow

1. `geocode({ address: "6a Avenida 12-34 Zona 1" })` → `{ lat,lng }`.
2. `places_findByText({ query: "tacos", location:{lat,lng}, radiusMeters:1500, maxResults:20 })`.
3. `ranking_rank({ candidates, origin:{lat,lng}, profile:{ keywords:["tacos"], priceLevels:[0,1], minRating:4.2, requireOpen:true, maxDistanceKm:1.5 }, topK:5 })`.
4. (Optional) `places_details({ placeId })` for website/phone.