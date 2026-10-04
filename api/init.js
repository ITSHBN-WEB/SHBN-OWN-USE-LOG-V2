import { sql } from '../lib/db.js';
import { checkAuth } from '../lib/auth.js';
import { handlePreflight } from '../lib/cors.js';
import { formatEntry } from '../lib/format.js';
import { DEFAULTS, GL_CODES } from '../lib/constants.js';

export default async function handler(req, res) {
  if (handlePreflight(req, res)) return;
  if (!checkAuth(req, res)) return;

  try {
    const masterRows = await sql`SELECT ean, material, description, uom FROM master_list`;
    const pendingRows = await sql`
      SELECT * FROM log_entries WHERE material_number IS NULL ORDER BY created_at ASC
    `;

    res.status(200).json({
      status: 'success',
      masterList: masterRows.map(r => ({
        ean: r.ean,
        // productCode is an alias of ean - Master List has no separate
        // product-code field, the scanned/typed code IS the EAN/UPC.
        productCode: r.ean,
        description: r.description,
        material: r.material,
        uom: r.uom
      })),
      pendingEntries: pendingRows.map(formatEntry),
      pendingCount: pendingRows.length,
      defaults: DEFAULTS,
      glCodes: GL_CODES
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: err.message });
  }
}
