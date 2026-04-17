export async function verifyTurnstile(token, ip, secretKey) {
    const url = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
  
    const formData = new URLSearchParams();
    formData.append('secret', secretKey);
    formData.append('response', token);
    if (ip) formData.append('remoteip', ip);
  
    const res = await fetch(url, {
      method: 'POST',
      body: formData
    });
  
    const data = await res.json();
    return data.success === true;
  }