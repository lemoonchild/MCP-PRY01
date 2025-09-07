import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";

import { geocode } from "./tools/geocode.js";
import { findNearby, findByText } from "./tools/places.js";
import { details } from "./tools/details.js";
import { rank } from "./tools/ranking.js";

/**
 * @fileoverview MCP Server setup using STDIO transport.
 * Registers and exposes tools related to food recommendations using Google APIs.
 */

/**
 * List of all tools exposed by this MCP server, including:
 * - geocoding
 * - nearby search
 * - text search
 * - place details
 * - ranking engine
 *
 * Each tool is defined with a JSON Schema describing its expected input.
 * Used to respond to `tools/list` requests from clients.
 *
 * @type {Array<Object>}
 */
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

/**
 * Map of tool names to their corresponding handler functions.
 * Used to dynamically dispatch calls via `tools/call`.
 *
 * @type {Record<string, Function>}
 */
const handlerMap = {
  "geocode": geocode,
  "places_findNearby": findNearby,
  "places_findByText": findByText,
  "places_details": details,
  "ranking_rank": rank,
};

/**
 * Starts the MCP server using STDIO transport.
 * Registers handlers for:
 * - `tools/list`: returns the list of available tools and their schemas.
 * - `tools/call`: executes the corresponding tool handler.
 *
 * If a tool is not found, an error is thrown.
 *
 * @returns {Promise<void>}
 */
export async function runStdioServer() {
  const server = new Server(
    { name: "mcp-food-recommender", version: "1.0.0" },
    { capabilities: { tools: {} } }
  );

  // Handle "tools/list" requests from the client
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: toolDefs }));

  // Handle "tools/call" requests from the client
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

// Run the server and handle errors
runStdioServer().catch((err) => {
  console.error("Error al iniciar food server:", err);
  process.exit(1);
});