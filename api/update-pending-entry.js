import { sql } from '../lib/db.js';
import { checkAuth } from '../lib/auth.js';
import { handlePreflight } from '../lib/cors.js';

// Admin tab edit. Atomic optimistic-concurrency check folded into the
// WHERE clause: only updates if the row is still pending and still
// matches what the client last saw.
export default async function handler(req, res) {
  if (handlePreflight(req, res)) return;
  if (!checkAuth(req, res)) return;
  if (req.method !== 'POST') {
    res.status(405).json({ status: 'error', message: 'Method not allowed' });
    return;
  }

  try {
    const { id, expectedProductCode, updates } = req.body;
    if (!id || !updates) {
      res.status(400).json({ status: 'error', message: 'Missing id or updates' });
      return;
    }

    const result = await sql`
      UPDATE log_entries
      SET
        product_code = ${updates.productCode},
        description = ${updates.description},
        quantity = ${updates.quantity},
        uom = ${updates.uom},
        plant = ${updates.plant},
        sloc = ${updates.sloc},
        cost_center = ${updates.costCenter},
        gl_code = ${updates.glCode},
        claim_department = ${updates.claimForDepartment},
        claim_by = ${updates.claimBy},
        submitted_by = ${updates.submittedBy}
      WHERE id = ${id}
        AND material_number IS NULL
        AND product_code = ${expectedProductCode}
      RETURNING id
    `;

    if (result.length === 0) {
      res.status(409).json({
        status: 'error',
        message: 'This entry was changed or removed by someone else. Please refresh and try again.'
      });
      return;
    }

    res.status(200).json({ status: 'success', message: 'Entry updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: err.message });
  }
}
