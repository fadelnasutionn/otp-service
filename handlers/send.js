import { generateCode, generateHash } from '../lib/crypto.js';
import { getOtpTtlMinutes } from '../lib/config.js';
import { verifyTurnstile } from '../lib/turnstile.js';

export async function handleSendOtp(req, env) {
  let body;

  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ success: false, message: 'Invalid JSON body' }), { status: 400 });
  }

  const { channel, mobile_number, email, turnstile_token } = body;
  const clientType = req.headers.get('X-Client-Type') || 'web';

  if (!channel || (!mobile_number && !email)) {
    return new Response(JSON.stringify({ success: false, message: 'Missing required fields' }), { status: 400 });
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
  const code = generateCode();
  const hashedCode = await generateHash(code);
  const now = new Date();
  const ttlMinutes = await getOtpTtlMinutes(env);
  const expiredAt = new Date(now.getTime() + ttlMinutes * 60_000).toISOString();

  const copywriting = `Please send this message unchanged! Enter the code you received directly on the verification screen.\n\n${code}`;

  try {
    const data = await env.DB.prepare(`
      SELECT id, link, expiredAt FROM otp_service
      WHERE mobile_number = ? AND status IN ('created')
      ORDER BY createdAt DESC
      LIMIT 1
    `).bind(mobile_number ?? null).first();

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
  if (channel === 'whatsapp' && mobile_number) {
    link = `https://wa.me/6285155330089?text=${encodeURIComponent(copywriting)}`;
  } else if (channel === 'telegram' && mobile_number) {
    const botName = env.TELEGRAM_BOT_NAME || 'ritterlanze_bot';
    link = `https://t.me/${botName}?text=${encodeURIComponent(copywriting)}`;
  }

  try {
    await env.DB.prepare(`
      INSERT INTO otp_service (
        id, channel, mobile_number, email, code, otp, link,
        status, createdAt, updatedAt, expiredAt
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      channel,
      mobile_number ?? null,
      email ?? null,
      hashedCode,
      null,
      link,
      'created',
      now.toISOString(),
      now.toISOString(),
      expiredAt
    ).run();

    return new Response(JSON.stringify({
      success: true,
      data: {
        id,
        code,
        link,
        expiredAt
      }
    }), { status: 200 });

  } catch (err) {
    return new Response(JSON.stringify({ success: false, message: 'DB error', error: err.message }), { status: 500 });
  }
}