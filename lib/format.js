const TZ = 'Asia/Kuala_Lumpur';

// Matches the old formatTimestamp() in Code.gs, e.g. "5.9.2026 3.52PM"
export function formatDate(date) {
  const dt = new Date(date);
  const day = Number(dt.toLocaleString('en-GB', { timeZone: TZ, day: 'numeric' }));
  const month = Number(dt.toLocaleString('en-GB', { timeZone: TZ, month: 'numeric' }));
  const year = Number(dt.toLocaleString('en-GB', { timeZone: TZ, year: 'numeric' }));
  const hour24 = Number(dt.toLocaleString('en-GB', { timeZone: TZ, hour: 'numeric', hour12: false }));
  const minute = dt.toLocaleString('en-GB', { timeZone: TZ, minute: '2-digit' }).padStart(2, '0');
  const hour12 = ((hour24 + 11) % 12) + 1;
  const ampm = hour24 < 12 ? 'AM' : 'PM';
  return `${day}.${month}.${year} ${hour12}.${minute}${ampm}`;
}

// Matches the old getMonthSheetName() label, e.g. "September 2026" - kept
// purely for the "Submitted N entries to '<label>'" confirmation message,
// there is no longer an actual separate sheet per month.
export function formatMonthLabel(date) {
  const dt = new Date(date);
  return dt.toLocaleString('en-US', { timeZone: TZ, month: 'long', year: 'numeric' });
}

// Converts a log_entries row into the same shape the old Apps Script
// getPendingEntries() returned, so the client needs minimal changes.
export function formatEntry(r) {
  return {
    id: r.id,
    date: formatDate(r.created_at),
    productCode: r.product_code,
    description: r.description,
    material: r.material,
    quantity: r.quantity,
    uom: r.uom,
    plant: r.plant,
    sloc: r.sloc,
    costCenter: r.cost_center,
    glCode: r.gl_code,
    claimForDepartment: r.claim_department,
    claimBy: r.claim_by,
    submittedBy: r.submitted_by
  };
}
