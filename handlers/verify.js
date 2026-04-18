import { generateOtp, generateHash } from '../lib/crypto.js';

export async function handleVerifyOtp(req, env) {
  let body;

  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ success: false, message: 'Invalid JSON body' }), { status: 400 });
  }


  const action = body.action;

  if (!action) { return new Response(JSON.stringify({ success: false, message: 'Missing action' }), { status: 400 });}

  switch (action) {
    case 'verifyCode':
      return await verifyCode(body, env);

    case 'verifyOtp':
      return await verifyOtp(body, env);

    default:
      return new Response(JSON.stringify({ success: false, message: 'Invalid action' }), { status: 400 });
  }
}



async function verifyCode(body, env) {

  const { value, code } = body;

  if (!code || !value) {
    return new Response(JSON.stringify({ success: false, message: 'Missing required fields' }), { status: 400 });
  }

  const hashedCode = await generateHash(code);
  const now = new Date().toISOString();

  try {
    const result = await env.DB.prepare(`
      SELECT id, status, otp, expiredAt FROM otp_service
      WHERE value = ? AND code = ?
      LIMIT 1
    `).bind(value, hashedCode).first();

    if (!result) {
      return new Response(JSON.stringify({ success: false, message: 'Invalid value or code' }), { status: 404 });
    }

    if (result.status === 'verified') {
      return new Response(JSON.stringify({ success: false, message: 'Code has already been verified' }), { status: 409 });
    }

    if (new Date(result.expiredAt) < new Date()) {
      return new Response(JSON.stringify({ success: false, message: 'Code has expired. Please request a new one' }), { status: 410 });
    }

    if (result.status === 'otp_sent') {
      return new Response(JSON.stringify({ success: false, message: 'OTP has already been sent. Please check your WhatsApp' }), { status: 409 });
    }

    if (result.status === 'created') {
      const otp = generateOtp();
      const hashedOtp = await generateHash(otp); 

      await env.DB.prepare(`
        UPDATE otp_service
        SET otp = ?, status = 'otp_sent', updatedAt = ?
        WHERE id = ?
      `).bind(hashedOtp, now, result.id).run();

      return new Response(JSON.stringify({
        success: true,
        message: 'OTP has been generated. Please enter the OTP to proceed',
        data: { otp } 
      }), { status: 200 });
    }

    return new Response(JSON.stringify({ success: false, message: 'Unexpected status' }), { status: 400 });

  } catch (err) { 
    return new Response(JSON.stringify({ success: false, message: 'Verification failed', error: err.message }), { status: 500 });
  }

}


async function verifyOtp(body, env) {

  const { value, code, otp } = body;

  if (!code || !value || !otp) {
    return new Response(JSON.stringify({ success: false, message: 'Missing required fields' }), { status: 400 });
  }

  const hashedCode = await generateHash(code);
  const hashedOtp = await generateHash(otp);
  const now = new Date().toISOString();

  try {
    const result = await env.DB.prepare(`
      SELECT id, status, expiredAt FROM otp_service
      WHERE value = ? AND code = ? AND otp = ?
      LIMIT 1
    `).bind(value, hashedCode, hashedOtp).first();

    if (!result) {
      return new Response(JSON.stringify({ success: false, message: 'Invalid value, code, or OTP' }), { status: 404 });
    }

    if (result.status === 'verified') {
      return new Response(JSON.stringify({ success: false, message: 'OTP has already been verified' }), { status: 409 });
    }

    if (new Date(result.expiredAt) < new Date()) {
      return new Response(JSON.stringify({ success: false, message: 'OTP has expired. Please request a new one' }), { status: 410 });
    }

    if (result.status !== 'otp_sent') {
      return new Response(JSON.stringify({ success: false, message: 'OTP is not ready for verification' }), { status: 400 });
    }

    await env.DB.prepare(`
      UPDATE otp_service
      SET status = 'verified', updatedAt = ?
      WHERE id = ?
    `).bind(now, result.id).run();

    return new Response(JSON.stringify({
      success: true,
      message: 'OTP verified successfully'
    }), { status: 200 });

  } catch (err) {
    return new Response(JSON.stringify({ success: false, message: 'Verification failed', error: err.message }), { status: 500 });
  }

}