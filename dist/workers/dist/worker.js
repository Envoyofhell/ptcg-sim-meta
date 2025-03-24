// index.js
var corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Authorization, X-Requested-With',
};
function handleOptions(request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}
async function handleHealthCheck() {
  return new Response(
    JSON.stringify({
      status: 'ok',
      timestamp: /* @__PURE__ */ new Date().toISOString(),
      message: 'PTCG-Sim-Meta API is running',
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    }
  );
}
async function handleStoreGameState(request) {
  try {
    const data = await request.json();
    if (!data.gameState) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Game state data is missing',
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }
    const key = Array.from(
      { length: 4 },
      () =>
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'[
          Math.floor(Math.random() * 62)
        ]
    ).join('');
    return new Response(
      JSON.stringify({
        success: true,
        key,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Error processing request',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  }
}
async function handleGetGameState(request) {
  const url = new URL(request.url);
  const key = url.searchParams.get('key');
  if (!key) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Key parameter is missing',
      }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  }
  return new Response(
    JSON.stringify({
      success: false,
      error: 'Game state not found. This is a simplified implementation.',
    }),
    {
      status: 404,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    }
  );
}
async function handleSocketRequest(request) {
  return new Response(
    JSON.stringify({
      success: false,
      error:
        'Socket.IO implementation is not available in this simplified worker.',
    }),
    {
      status: 501,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    }
  );
}
var index_default = {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      const path = url.pathname;
      if (request.method === 'OPTIONS') {
        return handleOptions(request);
      }
      if (path === '/api/health' || path === '/health') {
        return handleHealthCheck();
      }
      if (path === '/api/storeGameState' && request.method === 'POST') {
        return handleStoreGameState(request);
      }
      if (path === '/api/importData' && request.method === 'GET') {
        return handleGetGameState(request);
      }
      if (path.startsWith('/socket.io/')) {
        return handleSocketRequest(request);
      }
      if (path.startsWith('/api/')) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Unknown API endpoint',
          }),
          {
            status: 404,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders,
            },
          }
        );
      }
      return new Response('Not Found', { status: 404 });
    } catch (error) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Internal Server Error',
          message: error.message,
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }
  },
};
export { index_default as default };
//# sourceMappingURL=worker.js.map
