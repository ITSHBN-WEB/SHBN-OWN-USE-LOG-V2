import { sql } from '../lib/db.js';
import { checkAuth } from '../lib/auth.js';
import { handlePreflight } from '../lib/cors.js';

// POST /api/masterlist-import { rows: [{material, description, uom, ean}, ...], dryRun?: boolean }
//
// Matches existing rows by EAN/UPC (the real-world barcode, and the
// only reliable natural key here - a Material can have several EAN/UPC
// rows for different pack units). For each uploaded row:
//   - EAN not found yet            -> INSERT (added)
//   - EAN found, Material or
//     Description differs          -> UPDATE that row in place (changed)
//   - EAN found, nothing differs   -> leave alone (skipped, duplicate)
//
// dryRun: true  -> classify only, write NOTHING. Used by the "Preview Import"
//   step in Update Masterlist. Also returns `statuses` ({ean: 'new'|'changed'|
//   'duplicate'}) so the preview table can label rows. A dry run with an empty
//   rows array is a capability probe: the client calls it first so that an
//   OLD deployment of this file (which would really import) can never be hit
//   by a preview.
//
// The Excel file itself is parsed client-side (Index.html) and posted
// here as already-structured rows, since Vercel functions don't handle
// multipart file uploads out of the box. The client splits large files
// into batches before calling this endpoint, and this handler processes a
// whole batch with a FIXED NUMBER of SQL round-trips (3) rather than one
// round-trip per row, so it does not hit Vercel's execution time limit.
export default async function handler(req, res) {
  if (handlePreflight(req, res)) return;
  if (!checkAuth(req, res)) return;
  if (req.method !== 'POST') {
    res.status(405).json({ status: 'error', message: 'Method not allowed' });
    return;
  }

  try {
    const { rows, dryRun } = req.body;

    // Capability probe (see header comment).
    if (dryRun === true && Array.isArray(rows) && rows.length === 0) {
      res.status(200).json({ status: 'success', dryRun: true, probe: true });
      return;
    }

    if (!Array.isArray(rows) || rows.length === 0) {
      res.status(400).json({ status: 'error', message: 'No rows provided' });
      return;
    }

    // Normalize and de-dupe within this batch by EAN (last occurrence of
    // a given EAN wins, matching what a sequential row-by-row import would
    // have ended up doing anyway).
    const byEan = new Map();
    let skipped = 0;
    for (const row of rows) {
      const ean = String(row.ean || '').trim();
      if (!ean) {
        skipped++;
        continue;
      }
      byEan.set(ean, {
        ean,
        material: String(row.material || '').trim(),
        description: String(row.description || '').trim(),
        uom: String(row.uom || '').trim(),
      });
    }

    const uniqueRows = Array.from(byEan.values());
    if (uniqueRows.length === 0) {
      res.status(200).json({ status: 'success', dryRun: dryRun === true, added: 0, changed: 0, skipped, total: rows.length, statuses: {} });
      return;
    }

    const eans = uniqueRows.map((r) => r.ean);

    // Round-trip 1: fetch every existing row that matches any EAN in this
    // batch, in one query.
    const existingRows = await sql`
      SELECT id, ean, material, description FROM master_list
      WHERE ean = ANY(${eans})
    `;
    // If an EAN has several existing rows, compare against the first (lowest id),
    // which is also the row an update would touch.
    const existingByEan = new Map();
    for (const r of existingRows.slice().sort((a, b) => a.id - b.id)) {
      if (!existingByEan.has(r.ean)) existingByEan.set(r.ean, r);
    }

    const toInsert = [];
    const toUpdate = [];
    const statuses = {};

    for (const row of uniqueRows) {
      const existing = existingByEan.get(row.ean);
      if (!existing) {
        toInsert.push(row);
        statuses[row.ean] = 'new';
        continue;
      }
      const materialChanged = (existing.material || '') !== row.material;
      const descriptionChanged = (existing.description || '') !== row.description;
      if (materialChanged || descriptionChanged) {
        toUpdate.push({ id: existing.id, ...row });
        statuses[row.ean] = 'changed';
      } else {
        skipped++;
        statuses[row.ean] = 'duplicate';
      }
    }

    if (dryRun === true) {
      res.status(200).json({
        status: 'success',
        dryRun: true,
        added: toInsert.length,
        changed: toUpdate.length,
        skipped,
        total: rows.length,
        statuses,
      });
      return;
    }

    // Round-trip 2: bulk insert every new EAN in one statement via unnest.
    if (toInsert.length > 0) {
      await sql`
        INSERT INTO master_list (material, description, uom, ean)
        SELECT * FROM unnest(
          ${toInsert.map((r) => r.material)}::text[],
          ${toInsert.map((r) => r.description)}::text[],
          ${toInsert.map((r) => r.uom)}::text[],
          ${toInsert.map((r) => r.ean)}::text[]
        )
      `;
    }

    // Round-trip 3: bulk update every changed row in one statement via unnest.
    if (toUpdate.length > 0) {
      await sql`
        UPDATE master_list AS m
        SET material = u.material, description = u.description, uom = u.uom
        FROM unnest(
          ${toUpdate.map((r) => r.id)}::int[],
          ${toUpdate.map((r) => r.material)}::text[],
          ${toUpdate.map((r) => r.description)}::text[],
          ${toUpdate.map((r) => r.uom)}::text[]
        ) AS u(id, material, description, uom)
        WHERE m.id = u.id
      `;
    }

    res.status(200).json({
      status: 'success',
      added: toInsert.length,
      changed: toUpdate.length,
      skipped,
      total: rows.length,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: err.message });
  }
}
