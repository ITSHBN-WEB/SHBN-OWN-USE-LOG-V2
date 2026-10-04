import { sql } from '../lib/db.js';
import { checkAuth } from '../lib/auth.js';
import { handlePreflight } from '../lib/cors.js';
import { formatDate, formatMonthLabel } from '../lib/format.js';
import { DEFAULTS } from '../lib/constants.js';

export default async function handler(req, res) {
  if (handlePreflight(req, res)) return;
  if (!checkAuth(req, res)) return;
  if (req.method !== 'POST') {
    res.status(405).json({ status: 'error', message: 'Method not allowed' });
    return;
  }

  try {
    const { entries } = req.body;
    if (!Array.isArray(entries) || entries.length === 0) {
      res.status(400).json({ status: 'error', message: 'No entries provided' });
      return;
    }

    const now = new Date();

    for (const e of entries) {
      await sql`
        INSERT INTO log_entries (
          created_at, product_code, description, material, quantity, uom,
          plant, sloc, cost_center, gl_code, claim_department, claim_by,
          submitted_by, matched
        ) VALUES (
          ${now.toISOString()},
          ${e.productCode}, ${e.description}, ${e.material || null},
          ${e.quantity}, ${e.uom},
          ${DEFAULTS.plant}, ${DEFAULTS.sloc}, ${DEFAULTS.costCenter},
          ${e.glCode}, ${e.claimForDepartment}, ${e.claimBy}, ${e.submittedBy},
          ${!!e.matched}
        )
      `;
    }

    const pendingCountRows = await sql`
      SELECT COUNT(*)::int AS count FROM log_entries WHERE material_number IS NULL
    `;

    res.status(200).json({
      status: 'success',
      count: entries.length,
      sheet: formatMonthLabel(now),
      timestamp: formatDate(now),
      pendingGI: pendingCountRows[0].count
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: err.message });
  }
}
