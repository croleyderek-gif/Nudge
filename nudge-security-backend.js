// NUDGE SECURITY GATEWAY
// Server-side safety layer for Nudge.
// AI is intentionally OFF until we configure a real provider.
//
// IMPORTANT:
// NEVER put an AI API key in the GitHub Pages application.

const CONFIG = {
  ALLOWED_ORIGINS: [
    "https://croleyderek-gif.github.io"
  ],

  // Deliberately OFF for now.
  AI_ENABLED: false,

  // Request limits
  MAX_BODY_BYTES: 16 * 1024,
  MAX_INPUT_CHARS: 8000,
  MAX_OUTPUT_TOKENS: 700,

  // Abuse protection
  MAX_REQUESTS_PER_MINUTE: 12,
  MAX_REQUESTS_PER_DAY: 100,

  // Approximate AI spending limits
  MAX_USER_DAILY_COST_USD: 0.25,
  MAX_GLOBAL_COST_USD: 10.00,

  // Maximum time allowed for an AI provider request
  PROVIDER_TIMEOUT_MS: 12000
};


// ------------------------------------------------------------
// INSTANCE-LEVEL USAGE TRACKING
// ------------------------------------------------------------

const users = new Map();

const globalState = {
  day: today(),
  estimatedCost: 0,
  requests: 0
};


function today() {
  return new Date().toISOString().slice(0, 10);
}


function resetDay() {
  const d = today();

  if (globalState.day !== d) {
    globalState.day = d;
    globalState.estimatedCost = 0;
    globalState.requests = 0;
    users.clear();
  }
}


function stateFor(userId) {
  resetDay();

  if (!users.has(userId)) {
    users.set(userId, {
      minuteStarted: Date.now(),
      minuteRequests: 0,
      dayRequests: 0,
      estimatedCost: 0
    });
  }

  const state = users.get(userId);

  // Reset minute counter
  if (Date.now() - state.minuteStarted >= 60000) {
    state.minuteStarted = Date.now();
    state.minuteRequests = 0;
  }

  return state;
}


// ------------------------------------------------------------
// BASIC INPUT VALIDATION
// ------------------------------------------------------------

function validUserId(raw) {
  const id = String(raw || "").trim();

  if (!/^[A-Za-z0-9_-]{8,128}$/.test(id)) {
    return null;
  }

  return id;
}


// ------------------------------------------------------------
// HTTP RESPONSE
// ------------------------------------------------------------

function response(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,

    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",

      "access-control-allow-origin":
        origin || "null",

      "access-control-allow-headers":
        "content-type, authorization, x-nudge-user",

      "access-control-allow-methods":
        "GET, POST, OPTIONS",

      "vary": "Origin"
    }
  });
}


function allowedOrigin(origin) {
  return CONFIG.ALLOWED_ORIGINS.includes(origin);
}


// ------------------------------------------------------------
// AI COST ESTIMATION
// ------------------------------------------------------------
//
// These are placeholders for the initial safety system.
// We will replace them with the actual selected provider/model
// pricing when we connect the real AI service.
//

function estimateCost(inputTokens, outputTokens) {

  const INPUT_PER_MILLION = 0.20;
  const OUTPUT_PER_MILLION = 1.20;

  return (
    (inputTokens / 1000000) * INPUT_PER_MILLION +
    (outputTokens / 1000000) * OUTPUT_PER_MILLION
  );
}


// ------------------------------------------------------------
// AI PROVIDER
// ------------------------------------------------------------
//
// This is deliberately not functional yet.
//
// The API key will eventually live in a server-side secret:
//
// AI_API_KEY
//
// It will NEVER be placed in the Nudge website.
//

async function callProvider(message, env) {

  if (!CONFIG.AI_ENABLED) {
    throw new Error("AI_DISABLED");
  }

  if (!env.AI_API_KEY) {
    throw new Error("AI_NOT_CONFIGURED");
  }

  /*
    Provider-specific API call will go here.

    The important architecture is:

        NUDGE APP
            |
            v
        SECURITY GATEWAY
            |
            |-- rate limit
            |-- daily limit
            |-- spending limit
            |-- input limit
            |-- output limit
            |-- timeout
            |-- emergency shutoff
            |
            v
        AI PROVIDER

    The AI API key never reaches the phone.
  */

  const controller = new AbortController();

  const timer = setTimeout(
    () => controller.abort(),
    CONFIG.PROVIDER_TIMEOUT_MS
  );

  try {

    const r = await fetch(
      "https://api.example-provider.invalid/v1/chat",
      {
        method: "POST",

        headers: {
          "content-type": "application/json",

          "authorization":
            `Bearer ${env.AI_API_KEY}`
        },

        body: JSON.stringify({

          model:
            env.NUDGE_MODEL || "SET_MODEL",

          input:
            message,

          max_output_tokens:
            CONFIG.MAX_OUTPUT_TOKENS
        }),

        signal:
          controller.signal
      }
    );

    if (!r.ok) {
      throw new Error(
        `UPSTREAM_${r.status}`
      );
    }

    return await r.json();

  } finally {

    clearTimeout(timer);

  }
}


// ------------------------------------------------------------
// CHAT ENDPOINT
// ------------------------------------------------------------

async function chat(request, env, origin) {

  resetDay();


  // Emergency global shutoff
  if (!CONFIG.AI_ENABLED) {

    return response(
      {
        ok: false,
        code: "AI_DISABLED"
      },

      503,

      origin
    );
  }


  // Global spending protection
  if (
    globalState.estimatedCost >=
    CONFIG.MAX_GLOBAL_COST_USD
  ) {

    return response(
      {
        ok: false,
        code: "GLOBAL_BUDGET_REACHED"
      },

      503,

      origin
    );
  }


  // Identify user
  const userId =
    validUserId(
      request.headers.get("X-Nudge-User")
    );


  if (!userId) {

    return response(
      {
        ok: false,
        code: "AUTH_REQUIRED"
      },

      401,

      origin
    );
  }


  const state =
    stateFor(userId);


  // Per-minute protection
  if (
    state.minuteRequests >=
    CONFIG.MAX_REQUESTS_PER_MINUTE
  ) {

    return response(
      {
        ok: false,
        code: "RATE_LIMITED",
        retryAfterSeconds: 60
      },

      429,

      origin
    );
  }


  // Daily request protection
  if (
    state.dayRequests >=
    CONFIG.MAX_REQUESTS_PER_DAY
  ) {

    return response(
      {
        ok: false,
        code: "DAILY_LIMIT"
      },

      429,

      origin
    );
  }


  // Per-user spending protection
  if (
    state.estimatedCost >=
    CONFIG.MAX_USER_DAILY_COST_USD
  ) {

    return response(
      {
        ok: false,
        code: "USER_BUDGET_REACHED"
      },

      429,

      origin
    );
  }


  // Request size protection
  const length =
    Number(
      request.headers.get(
        "Content-Length"
      ) || 0
    );


  if (
    length >
    CONFIG.MAX_BODY_BYTES
  ) {

    return response(
      {
        ok: false,
        code: "REQUEST_TOO_LARGE"
      },

      413,

      origin
    );
  }


  // Parse request
  let body;

  try {

    body =
      await request.json();

  } catch {

    return response(
      {
        ok: false,
        code: "INVALID_JSON"
      },

      400,

      origin
    );
  }


  const message =
    String(
      body?.message || ""
    ).trim();


  if (!message) {

    return response(
      {
        ok: false,
        code: "EMPTY_MESSAGE"
      },

      400,

      origin
    );
  }


  // Prevent giant prompts
  if (
    message.length >
    CONFIG.MAX_INPUT_CHARS
  ) {

    return response(
      {
        ok: false,
        code: "INPUT_TOO_LONG"
      },

      413,

      origin
    );
  }


  // Count BEFORE provider call.
  //
  // This prevents repeated retries from bypassing
  // the request budget.

  state.minuteRequests++;
  state.dayRequests++;

  globalState.requests++;


  try {

    const result =
      await callProvider(
        message,
        env
      );


    // Provider-specific usage parsing
    // will be finalized when we select
    // the actual provider.

    const inputTokens =
      Number(
        result?.usage?.input_tokens ||
        100
      );


    const outputTokens =
      Number(
        result?.usage?.output_tokens ||
        100
      );


    const cost =
      estimateCost(
        inputTokens,
        outputTokens
      );


    state.estimatedCost +=
      cost;


    globalState.estimatedCost +=
      cost;


    return response(

      {
        ok: true,

        result,

        safety: {

          remainingDailyRequests:
            CONFIG.MAX_REQUESTS_PER_DAY -
            state.dayRequests

        }
      },

      200,

      origin

    );


  } catch (error) {

    return response(

      {
        ok: false,

        code:
          error?.message ===
          "AI_DISABLED"

            ? "AI_DISABLED"

            : "UPSTREAM_ERROR"
      },

      502,

      origin

    );

  }

}


// ------------------------------------------------------------
// ADMIN STATUS
// ------------------------------------------------------------

async function adminStatus(
  request,
  env,
  origin
) {

  const auth =
    request.headers.get(
      "Authorization"
    ) || "";


  if (
    !env.NUDGE_ADMIN_KEY ||
    auth !==
      `Bearer ${env.NUDGE_ADMIN_KEY}`
  ) {

    return response(
      {
        ok: false,
        code: "FORBIDDEN"
      },

      403,

      origin
    );
  }


  resetDay();


  return response(

    {

      ok: true,

      aiEnabled:
        CONFIG.AI_ENABLED,

      day:
        globalState.day,

      requests:
        globalState.requests,

      estimatedGlobalCostUsd:
        Math.round(
          globalState.estimatedCost *
          10000
        ) / 10000,

      activeUsers:
        users.size,

      limits: {

        requestsPerMinute:
          CONFIG.MAX_REQUESTS_PER_MINUTE,

        requestsPerDay:
          CONFIG.MAX_REQUESTS_PER_DAY,

        userDailyCostUsd:
          CONFIG.MAX_USER_DAILY_COST_USD,

        globalCostUsd:
          CONFIG.MAX_GLOBAL_COST_USD

      }

    },

    200,

    origin

  );

}


// ------------------------------------------------------------
// MAIN CLOUDFLARE WORKER
// ------------------------------------------------------------

export default {

  async fetch(
    request,
    env
  ) {

    const origin =
      request.headers.get(
        "Origin"
      ) || "";


    // CORS preflight
    if (
      request.method ===
      "OPTIONS"
    ) {

      if (
        !allowedOrigin(origin)
      ) {

        return new Response(
          null,
          { status: 403 }
        );
      }


      return new Response(
        null,

        {

          status: 204,

          headers: {

            "access-control-allow-origin":
              origin,

            "access-control-allow-headers":
              "content-type, authorization, x-nudge-user",

            "access-control-allow-methods":
              "GET, POST, OPTIONS",

            "access-control-max-age":
              "86400"

          }

        }
      );
    }


    // Reject unknown web origins
    if (
      origin &&
      !allowedOrigin(origin)
    ) {

      return response(
        {
          ok: false,
          code: "ORIGIN_NOT_ALLOWED"
        },

        403,

        origin
      );
    }


    const url =
      new URL(
        request.url
      );


    // Health check
    if (
      url.pathname ===
      "/health" &&
      request.method ===
      "GET"
    ) {

      return response(

        {
          ok: true,

          service:
            "nudge-security-gateway",

          aiEnabled:
            CONFIG.AI_ENABLED
        },

        200,

        origin
      );
    }


    // Admin status
    if (
      url.pathname ===
      "/admin/status" &&
      request.method ===
      "GET"
    ) {

      return adminStatus(
        request,
        env,
        origin
      );
    }


    // AI endpoint
    if (
      url.pathname ===
      "/v1/chat" &&
      request.method ===
      "POST"
    ) {

      return chat(
        request,
        env,
        origin
      );
    }


    return response(

      {
        ok: false,
        code: "NOT_FOUND"
      },

      404,

      origin
    );
  }
};
