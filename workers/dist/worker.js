// index.js
import { Router } from "itty-router";

// src/utils/cors.js
var allowedOrigins = [
  "https://ptcg-sim-meta.pages.dev",
  "https://ptcg-sim-meta-dev.pages.dev",
  "http://localhost:3000",
  "http://localhost:4000"
];
var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  // Replace with specific origins in production
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400"
  // 24 hours
};
function handleOptions(request) {
  const origin = request.headers.get("Origin");
  const headers = new Headers(corsHeaders);
  if (origin && allowedOrigins.includes(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
  }
  return new Response(null, {
    status: 204,
    headers
  });
}

// src/utils/logging.js
var debugMode = false;
function log(message, level = "info") {
  const timestamp = (/* @__PURE__ */ new Date()).toISOString();
  if (level === "debug" && !debugMode) {
    return;
  }
  let formattedMessage;
  switch (level) {
    case "error":
      formattedMessage = `[${timestamp}] ERROR: ${message}`;
      console.error(formattedMessage);
      break;
    case "warn":
      formattedMessage = `[${timestamp}] WARNING: ${message}`;
      console.warn(formattedMessage);
      break;
    case "debug":
      formattedMessage = `[${timestamp}] DEBUG: ${message}`;
      console.debug(formattedMessage);
      break;
    case "success":
      formattedMessage = `[${timestamp}] SUCCESS: ${message}`;
      console.log(formattedMessage);
      break;
    default:
      formattedMessage = `[${timestamp}] INFO: ${message}`;
      console.log(formattedMessage);
  }
}

// src/utils/key-generator.js
function generateRandomKey(length = 4) {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let key = "";
  const getRandomValue = () => {
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
      const array = new Uint32Array(1);
      crypto.getRandomValues(array);
      return array[0] / (4294967295 + 1);
    } else {
      return Math.random();
    }
  };
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(getRandomValue() * characters.length);
    key += characters.charAt(randomIndex);
  }
  return key;
}
function isValidKey(key, length = 4) {
  if (typeof key !== "string") {
    return false;
  }
  if (key.length !== length) {
    return false;
  }
  const alphanumericRegex = /^[a-zA-Z0-9]+$/;
  return alphanumericRegex.test(key);
}

// src/db/client.js
import { Pool } from "@neondatabase/serverless";
function createPool(connectionString) {
  if (!connectionString) {
    log("No database connection string provided", "error");
    throw new Error("Database connection string is required");
  }
  const redactedUrl = connectionString.replace(
    /postgresql:\/\/([^:]+):([^@]+)@/,
    "postgresql://$1:***@"
  );
  log(`Connecting to Neon PostgreSQL: ${redactedUrl}`, "debug");
  return new Pool({
    connectionString,
    ssl: true
  });
}
function getDbClient(env) {
  const connectionString = env.DATABASE_URL;
  return createPool(connectionString);
}

// src/db/game-state.js
async function getGameStateByKey(env, key) {
  const pool = getDbClient(env);
  try {
    const result = await pool.query(
      "SELECT value, created_at, accessed_at, size_bytes, metadata FROM key_value_pairs WHERE key = $1",
      [key]
    );
    if (result.rows.length === 0) {
      return { found: false };
    }
    await updateAccessTimestamp(env, key);
    return {
      found: true,
      value: result.rows[0].value,
      created_at: result.rows[0].created_at,
      accessed_at: result.rows[0].accessed_at,
      size_bytes: result.rows[0].size_bytes,
      metadata: result.rows[0].metadata
    };
  } catch (error) {
    log(`Error retrieving game state: ${error.message}`, "error");
    throw error;
  }
}
async function storeGameState(env, key, value, metadata = {}) {
  const pool = getDbClient(env);
  try {
    const sizeBytes = new TextEncoder().encode(value).length;
    await pool.query(
      `INSERT INTO key_value_pairs (key, value, created_at, accessed_at, size_bytes, metadata) 
       VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, $3, $4) 
       ON CONFLICT (key) DO UPDATE 
       SET value = $2, accessed_at = CURRENT_TIMESTAMP, size_bytes = $3, metadata = $4`,
      [key, value, sizeBytes, JSON.stringify(metadata)]
    );
    log(`Stored game state with key ${key} (${sizeBytes} bytes)`, "info");
    return {
      success: true,
      key,
      size_bytes: sizeBytes
    };
  } catch (error) {
    log(`Error storing game state: ${error.message}`, "error");
    throw error;
  }
}
async function deleteGameState(env, key) {
  const pool = getDbClient(env);
  try {
    const result = await pool.query(
      "DELETE FROM key_value_pairs WHERE key = $1",
      [key]
    );
    return {
      success: true,
      deleted: result.rowCount > 0
    };
  } catch (error) {
    log(`Error deleting game state: ${error.message}`, "error");
    throw error;
  }
}
async function updateAccessTimestamp(env, key) {
  const pool = getDbClient(env);
  try {
    await pool.query(
      "UPDATE key_value_pairs SET accessed_at = CURRENT_TIMESTAMP WHERE key = $1",
      [key]
    );
    log(`Updated access timestamp for key ${key}`, "debug");
  } catch (error) {
    log(`Error updating access timestamp: ${error.message}`, "warn");
  }
}
async function getDatabaseStats(env) {
  const pool = getDbClient(env);
  try {
    const countResult = await pool.query("SELECT COUNT(*) FROM key_value_pairs");
    const sizeResult = await pool.query("SELECT SUM(size_bytes) FROM key_value_pairs");
    const oldestResult = await pool.query("SELECT MIN(created_at) FROM key_value_pairs");
    const newestResult = await pool.query("SELECT MAX(created_at) FROM key_value_pairs");
    const recentResult = await pool.query(
      `SELECT COUNT(*) FROM key_value_pairs WHERE accessed_at > CURRENT_TIMESTAMP - INTERVAL '1 day'`
    );
    return {
      success: true,
      stats: {
        totalRecords: parseInt(countResult.rows[0].count, 10),
        totalSizeBytes: parseInt(sizeResult.rows[0].sum || "0", 10),
        oldestRecord: oldestResult.rows[0].min,
        newestRecord: newestResult.rows[0].max,
        recentlyAccessed: parseInt(recentResult.rows[0].count, 10)
      }
    };
  } catch (error) {
    log(`Error getting database stats: ${error.message}`, "error");
    throw error;
  }
}

// src/api/game-state.js
async function getGameState(request) {
  const url = new URL(request.url);
  const key = url.searchParams.get("key");
  const headers = { "Content-Type": "application/json" };
  if (!key) {
    log("Request missing key parameter", "warn");
    return new Response(
      JSON.stringify({
        success: false,
        error: "Key parameter is missing"
      }),
      { status: 400, headers }
    );
  }
  if (!isValidKey(key)) {
    log(`Invalid key format: ${key}`, "warn");
    return new Response(
      JSON.stringify({
        success: false,
        error: "Invalid key format"
      }),
      { status: 400, headers }
    );
  }
  try {
    const result = await getGameStateByKey(request.env, key);
    if (!result.found) {
      log(`Game state with key ${key} not found`, "warn");
      return new Response(
        JSON.stringify({
          success: false,
          error: "Game state not found"
        }),
        { status: 404, headers }
      );
    }
    try {
      const jsonData = JSON.parse(result.value);
      return new Response(
        result.value,
        { status: 200, headers }
      );
    } catch (parseError) {
      log(`Error parsing JSON data: ${parseError.message}`, "error");
      return new Response(
        JSON.stringify({
          success: false,
          error: "Error parsing game state data",
          details: parseError.message
        }),
        { status: 500, headers }
      );
    }
  } catch (error) {
    log(`Error retrieving game state: ${error.message}`, "error");
    return new Response(
      JSON.stringify({
        success: false,
        error: "Database error",
        details: error.message
      }),
      { status: 500, headers }
    );
  }
}
async function storeGameState2(request) {
  const headers = { "Content-Type": "application/json" };
  try {
    const body = await request.json();
    if (!body || !body.gameState && !body.exportData) {
      log("Request missing gameState in body", "warn");
      return new Response(
        JSON.stringify({
          success: false,
          error: "Game state data is missing"
        }),
        { status: 400, headers }
      );
    }
    const gameStateData = body.gameState || body.exportData;
    const key = body.key || generateRandomKey(4);
    if (body.key && !isValidKey(body.key)) {
      log(`Invalid custom key format: ${body.key}`, "warn");
      return new Response(
        JSON.stringify({
          success: false,
          error: "Invalid key format"
        }),
        { status: 400, headers }
      );
    }
    const gameStateStr = typeof gameStateData === "string" ? gameStateData : JSON.stringify(gameStateData);
    const sizeBytes = new TextEncoder().encode(gameStateStr).length;
    const sizeMB = sizeBytes / (1024 * 1024);
    const maxSizeMB = 50;
    if (sizeMB > maxSizeMB) {
      log(`Game state too large: ${sizeMB.toFixed(2)}MB > ${maxSizeMB}MB`, "warn");
      return new Response(
        JSON.stringify({
          success: false,
          error: `Game state too large (${sizeMB.toFixed(2)}MB > ${maxSizeMB}MB limit)`
        }),
        { status: 413, headers }
      );
    }
    const metadata = {
      ...body.metadata || {},
      userAgent: request.headers.get("User-Agent"),
      contentType: request.headers.get("Content-Type"),
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      origin: request.headers.get("Origin")
    };
    const result = await storeGameState(
      request.env,
      key,
      gameStateStr,
      metadata
    );
    if (body.exportData) {
      return new Response(
        JSON.stringify({
          success: true,
          key,
          size: {
            bytes: result.size_bytes,
            megabytes: (result.size_bytes / (1024 * 1024)).toFixed(2)
          }
        }),
        { status: 201, headers }
      );
    } else {
      return new Response(
        JSON.stringify({
          success: true,
          key,
          size: {
            bytes: result.size_bytes,
            megabytes: (result.size_bytes / (1024 * 1024)).toFixed(2)
          }
        }),
        { status: 201, headers }
      );
    }
  } catch (error) {
    log(`Error storing game state: ${error.message}`, "error");
    return new Response(
      JSON.stringify({
        success: false,
        error: "Error storing game state in database",
        details: error.message
      }),
      { status: 500, headers }
    );
  }
}
async function deleteGameState2(request) {
  const headers = { "Content-Type": "application/json" };
  const { params } = request;
  const key = params.key;
  if (!isValidKey(key)) {
    log(`Invalid key format for deletion: ${key}`, "warn");
    return new Response(
      JSON.stringify({
        success: false,
        error: "Invalid key format"
      }),
      { status: 400, headers }
    );
  }
  try {
    const result = await deleteGameState(request.env, key);
    if (result.deleted) {
      log(`Deleted game state ${key} from database`, "success");
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers }
      );
    } else {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Game state not found"
        }),
        { status: 404, headers }
      );
    }
  } catch (error) {
    log(`Error deleting game state: ${error.message}`, "error");
    return new Response(
      JSON.stringify({
        success: false,
        error: "Database error",
        details: error.message
      }),
      { status: 500, headers }
    );
  }
}
async function getStats(request) {
  const headers = { "Content-Type": "application/json" };
  try {
    const stats = await getDatabaseStats(request.env);
    return new Response(
      JSON.stringify(stats),
      { status: 200, headers }
    );
  } catch (error) {
    log(`Error getting database stats: ${error.message}`, "error");
    return new Response(
      JSON.stringify({
        success: false,
        error: "Error retrieving database statistics",
        details: error.message
      }),
      { status: 500, headers }
    );
  }
}

// src/api/health.js
async function getHealth(request) {
  const headers = { "Content-Type": "application/json" };
  try {
    const healthData = {
      status: "ok",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      worker: {
        status: "ok",
        environment: request.env.ENVIRONMENT || "unknown"
      },
      database: {
        status: "unknown"
      }
    };
    try {
      const pool = getDbClient(request.env);
      const result = await pool.query("SELECT NOW() as time");
      healthData.database = {
        status: "ok",
        time: result.rows[0].time
      };
    } catch (dbError) {
      log(`Database health check failed: ${dbError.message}`, "error");
      healthData.status = "degraded";
      healthData.database = {
        status: "error",
        error: dbError.message
      };
    }
    return new Response(
      JSON.stringify(healthData),
      {
        status: healthData.status === "ok" ? 200 : 503,
        headers
      }
    );
  } catch (error) {
    log(`Error in health check: ${error.message}`, "error");
    return new Response(
      JSON.stringify({
        status: "error",
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        error: error.message
      }),
      { status: 500, headers }
    );
  }
}

// index.js
var router = Router();
router.options("*", handleOptions);
router.get("/health", getHealth);
router.get("/api/health", getHealth);
router.get("/api/importData", getGameState);
router.post("/api/storeGameState", storeGameState2);
router.delete("/api/gameState/:key", deleteGameState2);
router.get("/api/stats", getStats);
router.all("*", () => new Response("Not Found", { status: 404 }));
var index_default = {
  async fetch(request, env, ctx) {
    try {
      request.env = env;
      log(`${request.method} ${new URL(request.url).pathname}`, "info");
      const response = await router.handle(request);
      Object.entries(corsHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return response;
    } catch (error) {
      log(`Error handling request: ${error.message}`, "error");
      log(`Stack trace: ${error.stack}`, "debug");
      const errorResponse = new Response(
        JSON.stringify({
          success: false,
          error: "Internal Server Error",
          message: error.message
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders
          }
        }
      );
      return errorResponse;
    }
  }
};
export {
  index_default as default
};
