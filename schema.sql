CREATE TABLE IF NOT EXISTS configs_service (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  description TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS otp_service (
  id TEXT PRIMARY KEY,
  channel TEXT NOT NULL Check (
    channel IN ('whatsapp', 'telegram','email')
  ),
  value TEXT NOT NULL,
  code TEXT,
  otp TEXT,
  link TEXT,
  status TEXT NOT NULL CHECK(
    status IN ('created', 'otp_sent', 'verified')
  ),
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  expiredAt TEXT NOT NULL
);