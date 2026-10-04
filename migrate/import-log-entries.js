// Imports monthly log exports (CSV/XLS/XLSX) into the Neon log_entries
// table.
//
// Usage:
//   node migrate/import-log-entries.js "path/to/folder"
//
// Scans the given folder for every file EXCEPT ones whose name contains
// "master" (that's the Master List, handled by import-master-list.js),
// and imports each one as a batch of log entries.

import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL environment variable is not set.');
  process.exit(1);
}
const sql = neon(process.env.DATABASE_URL);

function normalizeHeader(h) {
  return String(h || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Parses the old Apps Script timestamp format, e.g. "5.9.2026 3.52PM"
// (d.M.yyyy h.mmAM/PM). Falls back to native Date parsing if it doesn't match.
// Returns null (not "now") when there's nothing to parse, since the
// Material Doc Date column is legitimately blank for most rows.
function parseSheetDate(value, fallbackToNow) {
  if (!value || !String(value).trim()) return fallbackToNow ? new Date() : null;
  const str = String(value).trim();
  const re = /^(\d{1,2})\.(\d{1,2})\.(\d{4})\s+(\d{1,2})\.(\d{2})\s*(AM|PM)$/i;
  const m = str.match(re);
  if (m) {
    const [, d, mo, y, h, min, ampm] = m;
    let hour = parseInt(h, 10);
    if (/pm/i.test(ampm) && hour !== 12) hour += 12;
    if (/am/i.test(ampm) && hour === 12) hour = 0;
    return new Date(Number(y), Number(mo) - 1, Number(d), hour, Number(min));
  }
  const fallback = new Date(str);
  if (!isNaN(fallback.getTime())) return fallback;
  return fallbackToNow ? new Date() : null;
}

function getFilesToImport(folderPath) {
  const files = fs.readdirSync(folderPath);
  return files.filter(f => {
    const lower = f.toLowerCase();
    if (lower.includes('master')) return false;
    if (lower.startsWith('.') || lower.startsWith('~')) return false;
    return /\.(csv|xls|xlsx)$/i.test(lower);
  });
}

const headerMap = {
  date: ['date', 'timestamp'],
  productcode: ['productcode', 'product code', 'code'],
  description: ['description', 'desc'],
  // "Material" = the SAP Material code matched from the Master List.
  material: ['material'],
  quantity: ['quantity', 'qty'],
  uom: ['uom', 'unit', 'unitofmeasure'],
  plant: ['plant'],
  sloc: ['sloc', 'storagelocation'],
  costcenter: ['costcenter', 'cost center'],
  glcode: ['glcode', 'gl code'],
  claimdepartment: ['claimfordepartment', 'claimdepartment', 'department'],
  claimby: ['claimby', 'claim by'],
  submittedby: ['submittedby', 'submitted by'],
  // "Material Number" = the SAP Material Document number from the GI /
  // Copy-to-SAP step. NULL here means the row is still pending.
  materialnumber: ['materialnumber', 'material number'],
  // Only present on some months (added partway through), both optional.
  materialdockeyedby: ['materialdockeyedby', 'material doc keyed by', 'materialdockeyed'],
  materialdocdate: ['materialdocdate', 'material doc date']
};

function findKey(sampleRow, aliases) {
  const keys = Object.keys(sampleRow);
  const normKeys = keys.map(normalizeHeader);
  const idx = normKeys.findIndex(k => aliases.includes(k));
  return idx === -1 ? null : keys[idx];
}

async function importFile(filePath) {
  console.log(`Reading: ${filePath}`);
  const workbook = XLSX.readFile(filePath, { raw: false });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { raw: false, defval: '' });

  if (rows.length === 0) {
    console.log('  (no rows, skipping)');
    return { imported: 0, skipped: 0 };
  }

  const sample = rows[0];
  const keys = {
    date: findKey(sample, headerMap.date),
    productCode: findKey(sample, headerMap.productcode),
    description: findKey(sample, headerMap.description),
    material: findKey(sample, headerMap.material),
    quantity: findKey(sample, headerMap.quantity),
    uom: findKey(sample, headerMap.uom),
    plant: findKey(sample, headerMap.plant),
    sloc: findKey(sample, headerMap.sloc),
    costCenter: findKey(sample, headerMap.costcenter),
    glCode: findKey(sample, headerMap.glcode),
    claimDepartment: findKey(sample, headerMap.claimdepartment),
    claimBy: findKey(sample, headerMap.claimby),
    submittedBy: findKey(sample, headerMap.submittedby),
    materialNumber: findKey(sample, headerMap.materialnumber),
    materialDocKeyedBy: findKey(sample, headerMap.materialdockeyedby),
    materialDocDate: findKey(sample, headerMap.materialdocdate)
  };

  let imported = 0;
  let skipped = 0;

  for (const row of rows) {
    const productCode = keys.productCode ? String(row[keys.productCode] || '').trim() : '';
    if (!productCode) {
      skipped++;
      continue;
    }

    const createdAt = keys.date ? parseSheetDate(row[keys.date], true) : new Date();
    const material = keys.material ? String(row[keys.material] || '').trim() : '';
    const materialNumber = keys.materialNumber ? String(row[keys.materialNumber] || '').trim() : '';
    const materialDocKeyedBy = keys.materialDocKeyedBy ? String(row[keys.materialDocKeyedBy] || '').trim() : '';
    const materialDocDate = keys.materialDocDate ? parseSheetDate(row[keys.materialDocDate], false) : null;
    const quantityRaw = keys.quantity ? row[keys.quantity] : null;
    const quantity = quantityRaw === '' || quantityRaw == null ? null : Number(quantityRaw);
    // No "matched" column in the old sheets - infer it: a row that already
    // has a Master-List Material code was matched, blank means it wasn't.
    const matched = Boolean(material);

    await sql`
      INSERT INTO log_entries (
        created_at, product_code, description, material, quantity, uom,
        plant, sloc, cost_center, gl_code, claim_department, claim_by, submitted_by,
        matched, material_number, material_doc_keyed_by, material_doc_date
      ) VALUES (
        ${createdAt.toISOString()},
        ${productCode},
        ${keys.description ? String(row[keys.description] || '').trim() : ''},
        ${material || null},
        ${quantity},
        ${keys.uom ? String(row[keys.uom] || '').trim() : ''},
        ${keys.plant ? String(row[keys.plant] || '').trim() : ''},
        ${keys.sloc ? String(row[keys.sloc] || '').trim() : ''},
        ${keys.costCenter ? String(row[keys.costCenter] || '').trim() : ''},
        ${keys.glCode ? String(row[keys.glCode] || '').trim() : ''},
        ${keys.claimDepartment ? String(row[keys.claimDepartment] || '').trim() : ''},
        ${keys.claimBy ? String(row[keys.claimBy] || '').trim() : ''},
        ${keys.submittedBy ? String(row[keys.submittedBy] || '').trim() : ''},
        ${matched},
        ${materialNumber || null},
        ${materialDocKeyedBy || null},
        ${materialDocDate ? materialDocDate.toISOString() : null}
      )
    `;
    imported++;
  }

  console.log(`  Imported ${imported}, skipped ${skipped} (no product code).`);
  return { imported, skipped };
}

async function main() {
  const folderArg = process.argv[2];
  if (!folderArg) {
    console.error('Usage: node migrate/import-log-entries.js "path/to/folder"');
    process.exit(1);
  }

  const files = getFilesToImport(folderArg);
  if (files.length === 0) {
    console.log('No matching files found (excluding anything with "master" in the name).');
    return;
  }

  let totalImported = 0;
  let totalSkipped = 0;

  for (const file of files) {
    const fullPath = path.join(folderArg, file);
    const { imported, skipped } = await importFile(fullPath);
    totalImported += imported;
    totalSkipped += skipped;
  }

  console.log(`\nDone. Imported ${totalImported} total entries across ${files.length} file(s), skipped ${totalSkipped}.`);
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
