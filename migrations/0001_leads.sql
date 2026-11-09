-- Registro de contactos del formulario (Cloudflare D1).
CREATE TABLE IF NOT EXISTS leads (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  nombre     TEXT NOT NULL,
  email      TEXT NOT NULL,
  empresa    TEXT NOT NULL,
  interes    TEXT NOT NULL,
  plan       TEXT NOT NULL,
  reto       TEXT NOT NULL,
  pagina     TEXT NOT NULL DEFAULT '/'
);
CREATE INDEX IF NOT EXISTS leads_created_at ON leads (created_at);
