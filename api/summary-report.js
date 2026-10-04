import { sql } from '../lib/db.js';
import { checkAuth } from '../lib/auth.js';
import { handlePreflight } from '../lib/cors.js';
import { formatEntry } from '../lib/format.js';

// GET /api/summary-report?month=YYYY-MM
// Returns every log entry (pending AND completed) submitted in that
// month, compared in Asia/Kuala_Lumpur time to match how dates are
// shown everywhere else in the app.
export default async function handler(req, res) {
  if (handlePreflight(req, res)) return;
  if (!checkAuth(req, res)) return;

  try {
    const month = (req.query && req.query.month) || '';
    if (!/^\d{4}-\d{2}$/.test(month)) {
      res.status(400).json({ status: 'error', message: 'Missing or invalid month (expected YYYY-MM)' });
      return;
    }

    const rows = await sql`
      SELECT * FROM log_entries
      WHERE to_char(created_at AT TIME ZONE 'Asia/Kuala_Lumpur', 'YYYY-MM') = ${month}
      ORDER BY created_at ASC
    `;

    const entries = rows.map(formatEntry).map(e => ({
      ...e,
      status: e.materialNumber ? 'Completed' : 'Pending'
    }));

    const completedCount = entries.filter(e => e.status === 'Completed').length;

    res.status(200).json({
      status: 'success',
      month,
      entries,
      totalCount: entries.length,
      completedCount,
      pendingCount: entries.length - completedCount
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: err.message });
  }
}
