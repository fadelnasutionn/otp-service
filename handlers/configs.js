export async function handleConfigs(req, env) {
  const url = new URL(req.url);
  const method = req.method;


  const key = url.pathname.replace("/configs", "").replace("/", "").trim();

  switch (method) {
    case "GET":
      return key ? getConfigByKey(env, key) : getAllConfigs(env);

    case "POST":
      return createConfig(req, env);

    case "PUT":
      if (!key) return errorResponse("Key is required", 400);
      return updateConfig(req, env, key);

    case "DELETE":
      if (!key) return errorResponse("Key is required", 400);
      return deleteConfig(env, key);

    default:
      return errorResponse("Method not allowed", 405);
  }
}


async function getAllConfigs(env) {
  const { results } = await env.DB.prepare(`
    SELECT * FROM configs_service ORDER BY key DESC
  `).all();

  return Response.json({ success: true, data: results });
}


async function getConfigByKey(env, key) {
  const result = await env.DB.prepare(`
    SELECT * FROM configs_service WHERE key = ?
  `).bind(key).first();

  if (!result) return errorResponse(`Config '${key}' tidak ditemukan`, 404);

  return Response.json({ success: true, data: result });
}


async function createConfig(req, env) {
  const body = await req.json();
  const { key, value, description } = body;

  if (!key || !value) return errorResponse("key dan value wajib diisi", 400);

  
  const existing = await env.DB.prepare(`
    SELECT id FROM configs_service WHERE key = ?
  `).bind(key).first();

  if (existing) return errorResponse(`Config '${key}' sudah ada, gunakan PUT untuk update`, 409);

  const now = new Date().toISOString();

  await env.DB.prepare(`
    INSERT INTO configs_service (key, value, description, updatedAt, createdAt)
    VALUES (?, ?, ?, ?, ?)
  `).bind(key, String(value), description || null, now, now).run();

  return Response.json({
    success: true,
    message: `Config '${key}' berhasil dibuat`
  }, { status: 201 });
}


async function updateConfig(req, env, key) {
  const body = await req.json();
  const { value, description } = body;

  if (!value) return errorResponse("value wajib diisi", 400);

  const existing = await env.DB.prepare(`
    SELECT id FROM configs_service WHERE key = ?
  `).bind(key).first();

  if (!existing) return errorResponse(`Config '${key}' tidak ditemukan`, 404);

  const now = new Date().toISOString();

  await env.DB.prepare(`
    UPDATE configs_service
    SET value = ?, description = COALESCE(?, description), updatedAt = ?
    WHERE key = ?
  `).bind(String(value), description || null, now, key).run();

  return Response.json({
    success: true,
    message: `Config '${key}' berhasil diupdate`
  });
}


async function deleteConfig(env, key) {
  const existing = await env.DB.prepare(`
    SELECT id FROM configs_service WHERE key = ?
  `).bind(key).first();

  if (!existing) return errorResponse(`Config '${key}' tidak ditemukan`, 404);

  await env.DB.prepare(`
    DELETE FROM configs_service WHERE key = ?
  `).bind(key).run();

  return Response.json({
    success: true,
    message: `Config '${key}' berhasil dihapus`
  });
}


function errorResponse(message, status = 400) {
  return Response.json({ success: false, message }, { status });
}