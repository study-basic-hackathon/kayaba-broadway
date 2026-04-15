DROP TABLE IF EXISTS Users;
CREATE TABLE IF NOT EXISTS Users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  password_hash TEXT,
  display_name TEXT,
  icon_url TEXT,
  created_at INTEGER
);

INSERT INTO Users (id, email, password_hash, display_name, icon_url, created_at)
VALUES
  ('1', 'alice@example.com', 'hash1', 'Alice', NULL, 1700000000),
  ('2', 'bob@example.com', 'hash2', 'Bob', NULL, 1700000001),
  ('3', 'carol@example.com', 'hash3', 'Carol', NULL, 1700000002),
  ('4', 'dave@example.com', 'hash4', 'Dave', NULL, 1700000003),
  ('5', 'eve@example.com', 'hash5', 'Eve', NULL, 1700000004);