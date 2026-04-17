export function generateCode() {
  function group() {
    const bytes = crypto.getRandomValues(new Uint8Array(4));
    return Array.from(bytes)
      .map(b => b.toString(36))
      .join('')
      .substring(0, 6)
      .padEnd(6, '0');
  }
  return `${group()}-${group()}-${group()}-${group()}`.substring(0, 27);
}


export function generateOtp() {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  const num = new DataView(bytes.buffer).getUint32(0);
  return String(num % 10000).padStart(4, "0");
}


export async function generateHash(value) {
  const encoder = new TextEncoder();
  const data = encoder.encode(value);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}