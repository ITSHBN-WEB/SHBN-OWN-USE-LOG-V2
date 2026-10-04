import { sql } from '../lib/db.js';
import { checkAuth } from '../lib/auth.js';
import { handlePreflight } from '../lib/cors.js';
import { formatMonthLabel } from '../lib/format.js';

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

    for (const e of entries) {
      await sql`
        INSERT INTO log_entries (
          product_code, description, material, quantity, uom, plant, sloc,
          cost_center, gl_code, claim_department, claim_by, submitted_by
        ) VALUES (
          ${e.productCode}, ${e.description}, NULL, ${e.quantity}, ${e.uom},
          ${e.plant}, ${e.sloc}, ${e.costCenter}, ${e.glCode},
          ${e.claimForDepartment}, ${e.claimBy}, ${e.submittedBy}
        )
      `;
    }

    res.status(200).json({
      status: 'success',
      message: `Submitted ${entries.length} entries to '${formatMonthLabel(new Date())}'`
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: err.message });
  }
}
