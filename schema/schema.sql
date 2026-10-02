-- SHBN Own Use Log - Neon schema
--
-- Run this once against your Neon database, e.g.:
--   psql "$DATABASE_URL" -f schema/schema.sql

CREATE TABLE IF NOT EXISTS master_list (
  id          SERIAL PRIMARY KEY,
  material    TEXT NOT NULL,
  description TEXT NOT NULL,
  uom         TEXT NOT NULL DEFAULT '',
  ean         TEXT NOT NULL UNIQUE
);

CREATE INDEX IF NOT EXISTS idx_master_list_ean ON master_list (ean);

CREATE TABLE IF NOT EXISTS log_entries (
  id                    SERIAL PRIMARY KEY,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  product_code          TEXT NOT NULL,
  description           TEXT NOT NULL DEFAULT '',
  material              TEXT NOT NULL DEFAULT '',
  quantity              NUMERIC,
  uom                   TEXT NOT NULL DEFAULT '',
  plant                 TEXT NOT NULL DEFAULT '1008',
  sloc                  TEXT NOT NULL DEFAULT '1000',
  cost_center           TEXT NOT NULL DEFAULT '10100800',
  gl_code               TEXT NOT NULL DEFAULT '',
  claim_department      TEXT NOT NULL DEFAULT '',
  claim_by              TEXT NOT NULL DEFAULT '',
  submitted_by          TEXT NOT NULL DEFAULT '',
  matched               BOOLEAN NOT NULL DEFAULT true, -- false = product code had no Master List match at entry time (old "red highlight")
  material_number       TEXT,                          -- NULL = still pending a Material Document
  material_doc_keyed_by TEXT,
  material_doc_date     TIMESTAMPTZ
);

-- Speeds up the "pending" query: material filled, material_number blank.
-- This single indexed WHERE clause replaces the old full-sheet-scan +
-- 5-minute cache entirely.
CREATE INDEX IF NOT EXISTS idx_log_entries_pending
  ON log_entries (created_at)
  WHERE material <> '' AND material_number IS NULL;

CREATE INDEX IF NOT EXISTS idx_log_entries_created_at
  ON log_entries (created_at);
