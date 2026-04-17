export function verifyAuth(req, env) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ success: false, message: 'Unauthorized: Missing token' }), { status: 401 });
  }

  const token = authHeader.split(' ')[1];
  if (token !== env.API_TOKEN) {
    return new Response(JSON.stringify({ success: false, message: 'Unauthorized: Invalid token' }), { status: 403 });
  }

  return null;
}