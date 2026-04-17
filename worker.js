import { handleSendOtp } from './handlers/send.js';
import { handleVerifyOtp } from './handlers/verify.js';
import { handleConfigs } from './handlers/configs.js';
import { verifyAuth } from './lib/auth.js';

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method;

    try {
      
      const authError = verifyAuth(req, env);
      if (authError) return authError;

      if (method === 'POST' && path === '/otp/send') {
        return handleSendOtp(req, env);
      }

      if (method === 'POST' && path === '/otp/verify') {
        return handleVerifyOtp(req, env);
      }

      if (path.startsWith('/configs')) {
        return handleConfigs(req, env);
      }

      return Response.json({ success: false, message: 'Not found' }, { status: 404 });

    } catch (err) {
      return Response.json({
        success: false,
        message: 'Internal Server Error',
        error: err.message
       }, { status: 500});
    }

  }
};