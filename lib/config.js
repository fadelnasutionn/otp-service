export async function getOtpTtlMinutes(env) {
  const result = await env.DB.prepare(`
    SELECT value FROM configs_service WHERE key = 'otp_expiration_minutes' LIMIT 1
  `).first();

  if (!result || typeof result.value !== 'string') {
    return 3; 
  }

  const minutes = parseInt(result.value, 10);
  return isNaN(minutes) ? 3 : minutes;
}