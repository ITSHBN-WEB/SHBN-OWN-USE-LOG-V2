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
// multipart file uploads out of the box.
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

    let added = 0;
    let changed = 0;
    let skipped = 0;

    for (const row of rows) {
      const ean = String(row.ean || '').trim();
      const material = String(row.material || '').trim();
      const description = String(row.description || '').trim();
      const uom = String(row.uom || '').trim();

      if (!ean) {
        skipped++;
        continue;
      }

      const existingRows = await sql`
        SELECT id, material, description FROM master_list
        WHERE ean = ${ean}
        ORDER BY id ASC
        LIMIT 1
      `;

      if (existingRows.length === 0) {
        await sql`
          INSERT INTO master_list (material, description, uom, ean)
          VALUES (${material}, ${description}, ${uom}, ${ean})
        `;
        added++;
        continue;
      }

      const existing = existingRows[0];
      const materialChanged = (existing.material || '') !== material;
      const descriptionChanged = (existing.description || '') !== description;

      if (materialChanged || descriptionChanged) {
        await sql`
          UPDATE master_list
          SET material = ${material}, description = ${description}, uom = ${uom}
          WHERE id = ${existing.id}
        `;
        changed++;
      } else {
        skipped++;
      }
    }

    res.status(200).json({ status: 'success', added, changed, skipped, total: rows.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: err.message });
  }
}
