// Default field values used server-side when inserting a New Entry -
// the client no longer sends plant/sloc/cost_center (see Index.html's
// "autofill-note"), so submit-entries.js fills these in itself.
export const DEFAULTS = {
  plant: '1008',
  sloc: '1000',
  costCenter: '10100800'
};

// GL Code dropdown options. Index.html expects an ARRAY of
// { code, desc, details } - "code - desc" is shown in the dropdown row,
// "details" is shown in the (?) tooltip.
export const GL_CODES = [
  { code: '77001000', desc: 'Cleaning Expenses', details: 'CLEANING SERVICE, PURCHASE OF DETERGENT (CLEANING MATERIALS), GARBAGE BAG & ETC' },
  { code: '77004000', desc: 'Computer & IT Expenses', details: 'EXPENSES FOR REPLACE PARTS, SERVER, SYSTEM MAINTENANCE & ETC' },
  { code: '77007000', desc: 'Repair & Maintenance', details: 'REPAIR & MAINTENANCE SERVICES TO MAINTAIN OPTIMAL PERFORMANCE OF ASSETS AT OUTLETS WIRE, CABLE, BULB & ETC' },
  { code: '88006100', desc: 'Printing Stationery', details: 'STATIONERIES, PHOTOCOPY CHARGES INCURRED BY ACCOUNT/ADMIN DEPARTMENT, OUTLET/WAREHOUSE' },
  { code: '88008000', desc: 'Sundry Expenses', details: 'INSIGNIFICANT OPERATION EXPENSES, MISC EXPENSES AND RARE EXPENSES: LION DANCE, KEY DUPLICATION FEE, PRAY ITEM JOSS STICK, BATTERY & MISC CLAIM' },
  { code: '75001100', desc: 'Internal Consumption - Inventory', details: 'MATERIAL ISSUED ONLY FOR OWN USED. CAN PUT IN THIS CODE IF UNSURE THE ITEM. ACCOUNT WILL NEED TO RECLASSIFY TO CORRECT TRANSACTION CODE ACCORDING TO THE USAGE' },
  { code: '73002100', desc: 'Packing Materials - Outlet', details: 'POLYNET BAG RED, HAMPER TRAY, RIBBON, HAMPER PACKAGING, LOOP LOCK & TAGGING PIN, WRAPPING PAPER, PLASTIC PAPER, PACKING TRAY, CLING WRAP, SEAL TAPE, PLASTIC BAG & ETC' },
  { code: '73002200', desc: 'Packing Materials - Cashier', details: 'SERVAY LOGO SHOPPING BAG' },
  { code: '73002900', desc: 'Packing Materials - Others', details: 'HOT FOOD CORNER CHOPSTICKS, UTENSILS, CONTAINER, PLASTIC CUP & ETC' },
  { code: '71601500', desc: 'Staff Welfare (OPR) - Uniform & Name Tag', details: 'FOR OPERATION STAFF UNIFORM AND NAME TAG PROVIDED TO STAFF' },
  { code: '71601109', desc: 'Staff welfare (OPR) - Refreshment', details: 'FOR OPERATION STAFF - FOOD & BEVERAGES, STAFF BIRTHDAY CAKES & ETC' },
  { code: '73001000', desc: 'Thermal Labels, Stickers', details: 'PRICE LABELS, DATA STRIP, THERMAL PAPER ROLLS & ETC' },
  { code: '76601300', desc: 'Promotion - Outlets Deco', details: 'PROMOTION EXPENSES FOR OUTLET DECORATIONS, FOR FESTIVE DECORATION' }
];
