import { sql } from '../lib/db.js';
import { withCors } from '../lib/cors.js';
import { checkAuth, unauthorized } from '../lib/auth.js';

export default async function handler(req, res) {
  withCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();
  if (!checkAuth(req)) return unauthorized(res);

  try {
    const { id, fields, expected } = req.body;
    if (!id) throw new Error('Missing id.');
    if (!fields) throw new Error('No fields provided.');

    // The WHERE clause itself is the concurrency guard: if the row has
    // already been keyed in, or its material has changed since the client
    // loaded it, this matches zero rows and we report that cleanly - no
    // separate read-then-check step needed.
    const expectedMaterial = expected && expected.material !== undefined ? String(expected.material) : null;

    const rows = expectedMaterial !== null
      ? await sql`
          UPDATE log_entries
          SET product_code = ${fields.productCode || ''},
              description = ${fields.description || ''},
              material = ${fields.material || ''},
              quantity = ${fields.quantity || null},
              uom = ${fields.uom || ''},
              gl_code = ${fields.glCode || ''},
              claim_department = ${fields.claimForDepartment || ''},
              claim_by = ${fields.claimBy || ''},
              submitted_by = ${fields.submittedBy || ''}
          WHERE id = ${id} AND material_number IS NULL AND material = ${expectedMaterial}
          RETURNING id
        `
      : await sql`
          UPDATE log_entries
          SET product_code = ${fields.productCode || ''},
              description = ${fields.description || ''},
              material = ${fields.material || ''},
              quantity = ${fields.quantity || null},
              uom = ${fields.uom || ''},
              gl_code = ${fields.glCode || ''},
              claim_department = ${fields.claimForDepartment || ''},
              claim_by = ${fields.claimBy || ''},
              submitted_by = ${fields.submittedBy || ''}
          WHERE id = ${id} AND material_number IS NULL
          RETURNING id
        `;

    if (rows.length === 0) {
      throw new Error('That entry has changed since you loaded it, or was already processed. Please refresh and try again.');
    }

    res.status(200).json({ status: 'ok' });
  } catch (err) {
    res.status(200).json({ status: 'error', message: err.message });
  }
}
