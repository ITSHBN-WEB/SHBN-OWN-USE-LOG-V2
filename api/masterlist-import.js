import { sql } from '../lib/db.js';
import { checkAuth } from '../lib/auth.js';
import { handlePreflight } from '../lib/cors.js';

// POST /api/masterlist-import { rows: [{material, description, uom, ean}, ...] }
//
// Matches existing rows by EAN/UPC (the real-world barcode, and the
// only reliable natural key here - a Material can have several EAN/UPC
// rows for different pack units). For each uploaded row:
//   - EAN not found yet            -> INSERT (added)
//   - EAN found, Material or
//     Description differs          -> UPDATE that row in place (changed)
//   - EAN found, nothing differs   -> leave alone (skipped, duplicate)
//
// The Excel file itself is parsed client-side (Index.html) and posted
// here as already-structured rows, since Vercel functions don't handle
// multipart file uploads out of the box. The client also splits large
// files into batches before calling this endpoint (see Index.html), but
// this handler is written to process a whole batch with a FIXED NUMBER
// of SQL round-trips (3) rather than one round-trip per row, so it no
// longer times out even on a batch of several thousand rows - the old
// version did one SELECT + one INSERT/UPDATE per row sequentially,
// which blew past Vercel's function execution time limit partway
// through a large catalog export and showed up to the user as
// "Failed to fetch" with only a handful of rows actually saved.
export default async function handler(req, res) {
  if (handlePreflight(req, res)) return;
  if (!checkAuth(req, res)) return;
  if (req.method !== 'POST') {
    res.status(405).json({ status: 'error', message: 'Method not allowed' });
    return;
  }

  try {
    const { rows } = req.body;
    if (!Array.isArray(rows) || rows.length === 0) {
      res.status(400).json({ status: 'error', message: 'No rows provided' });
      return;
    }

    // Normalize and de-dupe within this batch by EAN (last occurrence of
    // a given EAN in the uploaded file wins, matching what a sequential
    // row-by-row import would have ended up doing anyway).
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
      res.status(200).json({ status: 'success', added: 0, changed: 0, skipped, total: rows.length });
      return;
    }

    const eans = uniqueRows.map((r) => r.ean);

    // Round-trip 1: fetch every existing row that matches any EAN in this
    // batch, in one query.
    const existingRows = await sql`
      SELECT id, ean, material, description FROM master_list
      WHERE ean = ANY(${eans})
    `;
    const existingByEan = new Map(existingRows.map((r) => [r.ean, r]));

    const toInsert = [];
    const toUpdate = [];

    for (const row of uniqueRows) {
      const existing = existingByEan.get(row.ean);
      if (!existing) {
        toInsert.push(row);
        continue;
      }
      const materialChanged = (existing.material || '') !== row.material;
      const descriptionChanged = (existing.description || '') !== row.description;
      if (materialChanged || descriptionChanged) {
        toUpdate.push({ id: existing.id, ...row });
      } else {
        skipped++;
      }
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
