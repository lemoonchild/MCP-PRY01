# MCP Food Recommender

Servidor **Model Context Protocol (MCP)** para recomendaciones de comida basado en **Google Maps Platform** (Geocoding + Places API v1) y un **motor de ranking** configurable.

---

## ¿Qué es este proyecto?

Un servidor MCP que expone *tools* por **STDIO** para que un cliente (por ejemplo, un CLI o un Chat LLM con soporte MCP) pueda:

1. **Geocodificar** direcciones → coordenadas `{ lat, lng }`.
2. **Buscar restaurantes** por cercanía o texto/antojo.
3. **Obtener detalles** de un lugar por `placeId` (website, teléfono, etc.).
4. **Rankear** candidatos con preferencias del usuario (keywords, precio, rating mínimo, distancia, abierto ahora, y presupuesto heurístico).

---

## Componentes principales

* **`src/mcp/server.js`**: servidor MCP con `@modelcontextprotocol/sdk` que registra y resuelve las tools.
* **`src/mcp/tools/*.js`**: implementación de tools (geocode, places, details, ranking).
* **`src/services/googleClient.js`**: integración con Google (Axios, FieldMasks, normalización de Place).
* **`src/services/scoring.js`**: motor de ranking/explicación.
* **`src/models/*.js`**: normalizadores (perfil, lugar, etc.).
* **`src/utils/*.js`**: logger, errores, helpers.
* **`src/scripts/*.js`**: pruebas de conexión a geocoding y places API v1. 

> **Nota FieldMask (Places v1)**: para `searchNearby`/`searchText` usa `X-Goog-FieldMask` con prefijo `places.*`. Para `GET /places/{id}` (details), el FieldMask debe **omitir** el prefijo `places.` (porque la respuesta es un `Place`, no `places[]`).

---

## Tools expuestas (MCP)

### 1) `geocode`

Convierte dirección a coordenadas.

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

Busca restaurantes cerca de un punto.

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

Busca restaurantes por texto/antojos con sesgo de ubicación.

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

Detalles de un lugar por `placeId`.

```jsonc
{
  "name": "places_details",
  "input": { "placeId": "string (requerido)" },
  "returns": { "place": { /* Place normalizado */ } }
}
```

### 5) `ranking_rank`

Rankea candidatos según el perfil y el origen del usuario.

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

## ¿Qué preguntas y filtros admite?

### Búsqueda (Google)

* **Tipo**: `restaurant` (fijo).
* **Radio**: metros (`radiusMeters`).
* **Ubicación**: `{ lat, lng }`.
* **Abierto ahora**: `openNow:true` (solo en Nearby; en Text no existe, se compensa en ranking con `requireOpen`).
* **Texto/Antojos**: `query` en Text Search.

### Ranking (preferencias del usuario)

* **Keywords (30%)**: coincide con nombre/tipos/summary/primaryType.
* **Precio (15%)**: `priceLevels` (0..4) y **presupuesto** `maxBudget` → niveles estimados por heurística.
* **Calidad (30%)**: rating ponderado por volumen de reseñas (log).
* **Distancia (15%)**: Haversine con caída lineal hasta `maxDistanceKm`.
* **Abierto (10%)**: si `requireOpen:true`, favorece `openNow===true`.
* **`minRating`**: penalización suave (0.6×) si el lugar tiene rating < mínimo.

> **Presupuesto `Ej. menor a Q60`**: no hay precios reales en Places; se usa una **heurística** que mapea presupuesto → niveles `priceLevel`. Puedes optar por **filtro duro** (excluir niveles altos) antes de rankear.

---

## Ejemplos de consultas del usuario

* “Estoy en *\[dirección]*, quiero **tacos** abiertos ahora, **a menos de 1.5 km**, **baratos** y con **mínimo 4.2**, dame el **top 5**.”
* “Quiero **ramen vegano** **menor a Q60**, cerca de mí y **abierto ahora**.”
* “Solo **\$ y \$\$**, **mínimo 4.0**, **a menos de 2 km**, **pizza**.”

> El cliente MCP convierte estas frases en llamadas a `geocode` → `places_*` → `ranking_rank` con los parámetros correspondientes.

---

## Instalación

### Requisitos

* Node.js 18+
* Una **Google API Key** con acceso a **Geocoding API** y **Places API v1**.

### Dependencias

```bash
npm install
```

### Variables de entorno (servidor)

Crea un `.env` en la carpeta del MCP:

```
GOOGLE_API_KEY=tu_api_key_google
```

---

## Build & ejecución del MCP

> El cliente MCP leerá `MCP_FOOD_ARGS` apuntando a **`dist/src/index.js`**. Por eso hay que generar un build.

### 1) Instalar dependencias

```bash
npm i
```

### 2) Script de build

```bash
npm run build
```

---

## Conectar el MCP al cliente (CLI)

Configura el **cliente MCP** con estas variables (por ejemplo, en `.env` del cliente):

```
# MCP Local
GOOGLE_API_KEY=tu_api_key_google
MCP_FOOD_COMMAND=node
MCP_FOOD_ARGS=/home/usr/MCP-PRY01/dist/src/index.js 
```

> **Importante**: `MCP_FOOD_ARGS` debe apuntar al **archivo build**. Asegúrate de correr `npm run build` en el proyecto MCP antes de iniciar el CLI. Y recuerda que debe de apuntar al index.js de la carpeta dist
---

## Flujo típico end-to-end

1. `geocode({ address: "6a Avenida 12-34 Zona 1" })` → `{ lat,lng }`.
2. `places_findByText({ query: "tacos", location:{lat,lng}, radiusMeters:1500, maxResults:20 })`.
3. `ranking_rank({ candidates, origin:{lat,lng}, profile:{ keywords:["tacos"], priceLevels:[0,1], minRating:4.2, requireOpen:true, maxDistanceKm:1.5 }, topK:5 })`.
4. (Opcional) `places_details({ placeId })` para website/teléfono.

---

## Notas de diseño

* **Máximo resultados**: 20 (sugerido por Places v1).
* **Ranking explicable**: campo `why` agrega precio `$…`, rating+reseñas, distancia y match de gustos.
* **Presupuesto**: `maxBudget` es heurístico; si quieres “filtro duro”, aplícalo antes de rankear.