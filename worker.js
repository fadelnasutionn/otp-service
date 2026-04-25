import { handleSendOtp } from './handlers/send.js';
import { handleVerifyOtp } from './handlers/verify.js';
import { handleConfigs } from './handlers/configs.js';
import { verifyAuth } from './lib/auth.js';



function getCorsHeaders(origin, env) {
  const allowedOrigins = env.ALLOWED_ORIGINS.split(',').map(o => o.trim());
  const allowed = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}


function withCors(response, origin, env) {
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: {
      ...Object.fromEntries(response.headers),
      ...getCorsHeaders(origin, env),
    },
  });
}

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method;
    const origin = req.headers.get('Origin') || '';

    if (method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: getCorsHeaders(origin, env),
      });
    }

    try {
      const authError = verifyAuth(req, env);
      if (authError) return withCors(authError, origin, env);

      let response;
      if (method === 'POST' && path === '/otp/send') {
        response = await handleSendOtp(req, env);
      } else if (method === 'POST' && path === '/otp/verify') {
        response = await handleVerifyOtp(req, env);
      } else if (path.startsWith('/configs')) {
        response = await handleConfigs(req, env);
      } else {
        response = Response.json(
          { success: false, message: 'Not found' },
          { status: 404 }
        );
      }

      return withCors(response, origin, env);
    } catch (err) {
      const response = Response.json({
        success: false,
        message: 'Internal Server Error',
        error: err.message,
      }, { status: 500 });

      return withCors(response, origin, env);
    }
  }
};