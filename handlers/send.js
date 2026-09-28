import { generateCode, generateOtp, generateHash } from '../lib/crypto.js';
import { getOtpTtlMinutes } from '../lib/config.js';
import { verifyTurnstile } from '../lib/turnstile.js';
import { sendOtpEmail } from "../lib/mailgun.js";

export async function handleSendOtp(req, env) {
  let body;

  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ success: false, message: 'Invalid JSON body' }), { status: 400 });
  }

  const { channel, value, turnstile_token } = body;
  const clientType = req.headers.get('X-Client-Type') || 'web';

  if (!channel || !value) {
    return new Response(JSON.stringify({ success: false, message: 'Missing required fields' }), { status: 400 });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const phoneRegex = /^\+?[0-9]{8,15}$/;

  if (channel === 'email') {
    if (!emailRegex.test(value)) {
      return new Response(JSON.stringify({ success: false, message: 'Invalid email format' }), { status: 400 });
    }
  } else if (channel === 'whatsapp' || channel === 'telegram') {
    if (!phoneRegex.test(value)) {
      return new Response(JSON.stringify({ success: false, message: 'Invalid phone number format' }), { status: 400 });
    }
  } else {
    return new Response(JSON.stringify({ success: false, message: 'Invalid channel' }), { status: 400 });
  }

  if (clientType === 'web') {
    if (!turnstile_token) {
      return new Response(JSON.stringify({ success: false, message: 'Missing Turnstile token' }), { status: 400 });
    }

    const clientIP = req.headers.get('CF-Connecting-IP');
    const isValidCaptcha = await verifyTurnstile(turnstile_token, clientIP, env.TURNSTILE_SECRET_KEY);

    if (!isValidCaptcha) {
      return new Response(JSON.stringify({ success: false, message: 'Captcha verification failed' }), { status: 403 });
    }
  }

  const id = crypto.randomUUID();

  let code = null;
  let hashedCode = null;
  let otp = null;
  let hashedOtp = null;

  const now = new Date();
  const ttlMinutes = await getOtpTtlMinutes(env);
  const expiredAt = new Date(now.getTime() + ttlMinutes * 60_000).toISOString();

  if (channel === 'email') {
    otp = generateOtp();
    hashedOtp = await generateHash(otp);
  } else {
    code = generateCode();
    hashedCode = await generateHash(code);
  }

  const copywriting = code
    ? `Please send this message unchanged! Enter the code you received directly on the verification screen.\n\n${code}`
    : '';

  try {
    const data = await env.DB.prepare(`
      SELECT id, link, expiredAt FROM otp_service
      WHERE value = ?
        AND status = 'created'
      ORDER BY createdAt DESC
      LIMIT 1
    `).bind(value).first();

    if (data) {
      const expiredAt = new Date(data.expiredAt);
      if (!data.isRedeemed && expiredAt >= now) {
        return new Response(JSON.stringify({ success: false, message: 'Already requested. Please wait.', data }), { status: 409 });
      }
    }
  } catch (err) {
    return new Response(JSON.stringify({ success: false, message: 'Error checking existing OTP', error: err.message }), { status: 500 });
  }

  let link = '';
  const wabaNumber = env.WABA_NUMBER;
  const teleBotUsername = env.TELEGRAM_BOT;

  if (channel === 'whatsapp') {
    link = `https://wa.me/${wabaNumber}?text=${encodeURIComponent(copywriting)}`;
  } else if (channel === 'telegram') {
    link = `https://t.me/${teleBotUsername}?text=${encodeURIComponent(copywriting)}`;
  } else if (channel === 'email') {
    link = '';
  }

  try {
    await env.DB.prepare(`
      INSERT INTO otp_service (
        id, channel, value, code, otp, link,
        status, createdAt, updatedAt, expiredAt
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      channel,
      value,
      hashedCode,
      hashedOtp,
      link,
      'created',
      now.toISOString(),
      now.toISOString(),
      expiredAt
    ).run();

    if (channel === 'email') {
      try {
        await sendOtpEmail(env, value, otp, ttlMinutes);
      } catch (err) {
        await env.DB.prepare(`
          DELETE FROM otp_service
          WHERE id = ?
        `).bind(id).run();

        return new Response(JSON.stringify({
          success: false,
          message: 'Internal server error occurred while sending OTP!',
          error: err.message
        }), { status: 502 });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      data: {
        id,
        code: code ?? undefined,
        link,
        expiredAt
      }
    }), { status: 200 });

  } catch (err) {
    return new Response(JSON.stringify({ success: false, message: 'DB error', error: err.message }), { status: 500 });
  }
}