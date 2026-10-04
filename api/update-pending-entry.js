import { sql } from '../lib/db.js';
import { checkAuth } from '../lib/auth.js';
import { handlePreflight } from '../lib/cors.js';

// Admin tab edit. Index.html posts { id, fields: {...}, expected: {material} }.
// The WHERE clause folds the optimistic-concurrency check in directly:
// only updates if the row is still pending and its SAP material code
// still matches what the client last saw.
export default async function handler(req, res) {
  if (handlePreflight(req, res)) return;
  if (!checkAuth(req, res)) return;
  if (req.method !== 'POST') {
    res.status(405).json({ status: 'error', message: 'Method not allowed' });
    return;
  }

  try {
    const { id, fields, expected } = req.body;
    if (!id || !fields || !expected) {
      res.status(400).json({ status: 'error', message: 'Missing id, fields, or expected' });
      return;
    }

    const result = await sql`
      UPDATE log_entries
      SET
        product_code = ${fields.productCode},
        description = ${fields.description},
        material = ${fields.material || null},
        quantity = ${fields.quantity === '' || fields.quantity == null ? null : Number(fields.quantity)},
        uom = ${fields.uom},
        gl_code = ${fields.glCode},
        claim_department = ${fields.claimForDepartment},
        claim_by = ${fields.claimBy},
        submitted_by = ${fields.submittedBy}
      WHERE id = ${id}
        AND material_number IS NULL
        AND material = ${expected.material}
      RETURNING id
    `;

    if (result.length === 0) {
      res.status(409).json({
        status: 'error',
        message: 'This entry was changed or removed by someone else. Please refresh and try again.'
      });
      return;
    }

    res.status(200).json({ status: 'success' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: err.message });
  }
}
