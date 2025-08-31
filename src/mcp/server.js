import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";

import { geocode } from "./tools/geocode.js";
import { findNearby, findByText } from "./tools/places.js";
import { details } from "./tools/details.js";
import { rank } from "./tools/ranking.js";

const toolDefs = [
    {
        name: "geocode",
        description: "Convierte dirección a coordenadas (lat/lng) usando Google Geocoding",
        inputSchema: {   
            type: "object",
            properties: { address: { type: "string" } },
            required: ["address"]
        }
    },
    {
        name: "places_findNearby",
        description: "Busca restaurantes cerca de un punto",
        inputSchema: {   
        type: "object",
        properties: {
            location: {
                type: "object",
                properties: {
                    lat: { type: "number" },
                    lng: { type: "number" }
                },
                required: ["lat", "lng"]
            },
            openNow: { type: "boolean" },
            radiusMeters: { type: "number" },
            maxResults: { type: "number" }
        },
        required: ["location"]
        }
    },
    {
        name: "places_findByText",
        description: "Busca restaurantes por texto (antojos)",
        inputSchema: {
        type: "object",
        properties: {
            query: { type: "string" },
            location: {
                type: "object",
                properties: {
                    lat: { type: "number" },
                    lng: { type: "number" }
                }
            },
            radiusMeters: { type: "number" },
            maxResults: { type: "number" }
        },
        required: ["query"]
        }
    },
    {
        name: "places_details",
        description: "Devuelve información de un lugar por placeId",
        inputSchema: {
            type: "object",
            properties: { placeId: { type: "string" } },
            required: ["placeId"]
        }
    },
    {
        name: "ranking_rank",
        description: "Rankea candidatos según perfil/origen",
        inputSchema: {
        type: "object",
        properties: {
            candidates: { type: "array" },
            profile: { type: "object" },
            origin: {
                type: "object",
                properties: {
                    lat: { type: "number" },
                    lng: { type: "number" }
                }
            },
            topK: { type: "number" }
        },
        required: ["candidates", "profile"]
        }
    }
];

const handlerMap = {
  "geocode": geocode,
  "places_findNearby": findNearby,
  "places_findByText": findByText,
  "places_details": details,
  "ranking_rank": rank,
};

export async function runStdioServer() {
  const server = new Server(
    { name: "mcp-food-recommender", version: "1.0.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: toolDefs }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args } = req.params;
    const handler = handlerMap[name];
    if (!handler) throw new Error(`Unknown tool: ${name}`);
    const result = await handler(args);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

runStdioServer().catch((err) => {
  console.error("Error al iniciar food server:", err);
  process.exit(1);
});