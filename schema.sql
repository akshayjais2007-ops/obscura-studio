-- Obscura Studio — Relational PostgreSQL Schema
-- Run with: psql "$DATABASE_URL" -f docs/schema.sql

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  pass_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  onboarded BOOLEAN NOT NULL DEFAULT FALSE,
  intent TEXT,
  suspended BOOLEAN NOT NULL DEFAULT FALSE,
  created_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'personal',
  parent_id TEXT REFERENCES workspaces(id) ON DELETE SET NULL,
  created_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS members (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  role TEXT NOT NULL,
  added_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  aspect TEXT NOT NULL DEFAULT '16:9',
  fps INTEGER NOT NULL DEFAULT 30,
  template TEXT NOT NULL DEFAULT 'blank',
  script TEXT NOT NULL DEFAULT '',
  scenes JSONB NOT NULL DEFAULT '[]'::jsonb,
  tracks JSONB NOT NULL DEFAULT '[]'::jsonb,
  brand_kit_id TEXT,
  style_id TEXT,
  stage TEXT NOT NULL DEFAULT 'idea',
  review TEXT NOT NULL DEFAULT 'draft',
  assignee TEXT,
  deadline TEXT,
  demo BOOLEAN DEFAULT FALSE,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  deleted_at BIGINT
);

CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  mime TEXT NOT NULL,
  size BIGINT NOT NULL,
  duration DOUBLE PRECISION NOT NULL DEFAULT 0,
  width INTEGER NOT NULL DEFAULT 0,
  height INTEGER NOT NULL DEFAULT 0,
  hash TEXT NOT NULL,
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  source TEXT NOT NULL,
  license TEXT NOT NULL DEFAULT '',
  attribution TEXT NOT NULL DEFAULT '',
  thumb TEXT,
  peaks JSONB,
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  demo BOOLEAN DEFAULT FALSE,
  created_at BIGINT NOT NULL,
  deleted_at BIGINT
);

CREATE TABLE IF NOT EXISTS render_jobs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  label TEXT NOT NULL,
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  params JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL,
  progress DOUBLE PRECISION NOT NULL DEFAULT 0,
  credits INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  result JSONB,
  output_asset_id TEXT,
  attempt INTEGER NOT NULL DEFAULT 1,
  created_at BIGINT NOT NULL,
  started_at BIGINT,
  finished_at BIGINT
);

CREATE TABLE IF NOT EXISTS credit_transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  kind TEXT NOT NULL,
  reason TEXT NOT NULL,
  job_id TEXT,
  balance_after INTEGER NOT NULL,
  at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS subscriptions (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL DEFAULT 'free',
  status TEXT NOT NULL DEFAULT 'active',
  period_start BIGINT NOT NULL,
  period_end BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  author TEXT NOT NULL,
  time DOUBLE PRECISION NOT NULL,
  text TEXT NOT NULL,
  resolved BOOLEAN NOT NULL DEFAULT FALSE,
  at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS approvals (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  decision TEXT NOT NULL,
  by_name TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS snapshots (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  at BIGINT NOT NULL,
  data JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  target TEXT NOT NULL,
  meta TEXT,
  at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_snapshots (
  id INTEGER PRIMARY KEY DEFAULT 1,
  payload JSONB NOT NULL,
  updated_at BIGINT NOT NULL
);
