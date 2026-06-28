/**
 * Expense Tracker AI — OAuth token proxy (Cloudflare Worker)
 *
 * Exchanges an OAuth authorization code for an access token on behalf of the
 * browser SPA. This keeps GOOGLE_CLIENT_SECRET server-side (stored as a
 * Cloudflare Worker secret) and out of the client bundle entirely.
 *
 * Endpoint: POST /token
 * Body (JSON): { code: string, code_verifier: string, redirect_uri: string }
 * Response (JSON): { access_token, expires_in, token_type, scope }
 *
 * Security:
 *   - CORS is restricted to ALLOWED_ORIGINS (your GitHub Pages domain).
 *   - Only POST /token is accepted; everything else returns 404.
 *   - PKCE code_verifier is forwarded to Google — the worker never stores it.
 *   - The worker never logs or stores credentials.
 */

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

// Origins allowed to call this worker. Add http://localhost:4200 for local dev.
const ALLOWED_ORIGINS = [
  'https://beligh-hamdi.github.io',
  'http://localhost:4200',
];

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') ?? '';

    // ── CORS preflight ──────────────────────────────────────────────────────
    if (request.method === 'OPTIONS') {
      return corsResponse(null, 204, origin);
    }

    // ── Route: POST /token ──────────────────────────────────────────────────
    const url = new URL(request.url);
    if (request.method === 'POST' && url.pathname === '/token') {
      return handleToken(request, env, origin);
    }

    return new Response('Not found', { status: 404 });
  },
};

async function handleToken(request, env, origin) {
  // Validate origin
  if (!ALLOWED_ORIGINS.includes(origin)) {
    return corsResponse({ error: 'forbidden' }, 403, origin);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return corsResponse({ error: 'invalid_request', error_description: 'Body must be JSON' }, 400, origin);
  }

  const { code, code_verifier, redirect_uri } = body;

  if (!code || !code_verifier || !redirect_uri) {
    return corsResponse(
      { error: 'invalid_request', error_description: 'Missing code, code_verifier, or redirect_uri' },
      400,
      origin
    );
  }

  // Exchange the code with Google — clientSecret stays here, never in the browser
  const params = new URLSearchParams({
    grant_type:    'authorization_code',
    code,
    code_verifier,
    redirect_uri,
    client_id:     env.GOOGLE_CLIENT_ID,
    client_secret: env.GOOGLE_CLIENT_SECRET,
  });

  const googleResponse = await fetch(GOOGLE_TOKEN_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    params.toString(),
  });

  const data = await googleResponse.json();

  // Forward Google's response (success or error) with CORS headers
  return corsResponse(data, googleResponse.status, origin);
}

function corsResponse(body, status, origin) {
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  const headers = {
    'Access-Control-Allow-Origin':  allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };
  return new Response(body !== null ? JSON.stringify(body) : null, { status, headers });
}
