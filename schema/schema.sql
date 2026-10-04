-- SHBN Own Use Log - Neon/Postgres schema
-- Run this once in the Neon SQL editor before importing data.

-- No single column here is unique: a Material can have several EAN/UPC
-- rows (one per pack unit - EA, CAR, etc), so there's no natural primary
-- key besides the row id. The migration script does a full
-- delete+reinsert each run rather than an upsert.
CREATE TABLE IF NOT EXISTS master_list (
  id               SERIAL PRIMARY KEY,
  material         TEXT,
  description      TEXT,
  uom              TEXT,
  ean              TEXT
);

CREATE TABLE IF NOT EXISTS log_entries (
  id                      SERIAL PRIMARY KEY,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  product_code            TEXT,
  description             TEXT,
  material                TEXT,     -- SAP Material code, matched from Master List
  quantity                NUMERIC,
  uom                     TEXT,
  plant                   TEXT,
  sloc                    TEXT,
  cost_center             TEXT,
  gl_code                 TEXT,
  claim_department        TEXT,
  claim_by                TEXT,
  submitted_by            TEXT,
  matched                 BOOLEAN,   -- true if product_code auto-matched the Master List
  material_number         TEXT,      -- SAP Material Document number from GI/Copy-to-SAP; NULL = pending
  material_doc_keyed_by   TEXT,
  material_doc_date       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_master_list_ean ON master_list (ean);

-- Partial index: the Pending Entry / Admin tabs only ever query rows
-- where material_number is still NULL, so index just those.
CREATE INDEX IF NOT EXISTS idx_log_entries_pending ON log_entries (id) WHERE material_number IS NULL;

CREATE INDEX IF NOT EXISTS idx_log_entries_created_at ON log_entries (created_at);
