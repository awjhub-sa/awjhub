/**
 * Legacy import shim — kept temporarily for any stragglers still importing
 * from this path. All real DB access now goes through `src/lib/db.js` (Supabase).
 *
 * @deprecated  use:  import { db } from '../lib/db.js';
 */
export { db, supabase } from '../lib/db.js';
