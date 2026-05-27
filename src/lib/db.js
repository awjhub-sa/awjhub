// Supabase abstraction: per-table CRUD + realtime + storage helpers
import { supabase, STORAGE_BUCKETS } from '../config/supabase.js';
import { isDemoActive, DEMO_TABLES } from './demoData.js';

/* Split on every lowercase|digit → uppercase boundary so:
     scoreOutOf10 → score_out_of10
     phase1Photo  → phase1_photo
     phase1       → phase1
     mealId       → meal_id  */
const toCamel = s => s.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
const toSnake = s => s.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();

class Timestamp {
  constructor(date) { this._date = date instanceof Date ? date : new Date(date); }
  toMillis() { return this._date.getTime(); }
  toDate()   { return this._date; }
  get seconds()     { return Math.floor(this._date.getTime() / 1000); }
  get nanoseconds() { return (this._date.getTime() % 1000) * 1e6; }
  toJSON()   { return this._date.toISOString(); }
  toString() { return this._date.toISOString(); }
}

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

function wrapTimestamps(value) {
  if (typeof value === 'string' && ISO_RE.test(value)) {
    const d = new Date(value);
    return isNaN(d.getTime()) ? value : new Timestamp(d);
  }
  return value;
}

/* Client-side "now" — used wherever Firebase code called serverTimestamp().
   Returning a real Date keeps optimistic UI updates valid (StatusTimeline
   etc. read .toMillis()) and serialises to ISO when sent to Supabase. */
export const serverTimestamp = () => new Date();

export function rowFromDb(row) {
  if (!row || typeof row !== 'object') return row;
  if (Array.isArray(row)) return row.map(rowFromDb);
  const out = {};
  for (const k in row) out[toCamel(k)] = wrapTimestamps(row[k]);
  return out;
}

export function rowToDb(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const out = {};
  for (const k in obj) {
    const v = obj[k];
    if (v instanceof Date) {
      out[toSnake(k)] = v.toISOString();
    } else if (v && typeof v === 'object' && typeof v.toMillis === 'function') {
      out[toSnake(k)] = v.toDate().toISOString();
    } else {
      out[toSnake(k)] = v;
    }
  }
  return out;
}

function logErr(op, error) {
  if (error) console.error(`[db.${op}]`, error.message || error);
}

/* Demo-mode interception: when isDemoActive(), reads return hardcoded data
 * from DEMO_TABLES and writes are no-op'd to keep real DB untouched. */
function applyFilter(rows, filter) {
  if (!filter) return rows;
  return rows.filter(r =>
    Object.entries(filter).every(([k, v]) => r[toSnake(k)] === v)
  );
}
function applyOrder(rows, orderBy, ascending) {
  if (!orderBy) return rows;
  const key = toSnake(orderBy);
  const sorted = [...rows].sort((a, b) => {
    const va = a[key], vb = b[key];
    if (va === vb) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    return va < vb ? -1 : 1;
  });
  return ascending === false ? sorted.reverse() : sorted;
}
function demoListSync(table, options = {}) {
  const rows = (DEMO_TABLES[table] || []).slice();
  return applyOrder(applyFilter(rows, options.filter), options.orderBy, options.ascending);
}

function createTableApi(table, { pk = 'id' } = {}) {
  return {
    async list(options = {}) {
      if (isDemoActive()) {
        return demoListSync(table, options).map(rowFromDb);
      }
      let q = supabase.from(table).select('*');
      if (options.filter) {
        for (const [k, v] of Object.entries(options.filter)) {
          q = q.eq(toSnake(k), v);
        }
      }
      if (options.orderBy) {
        q = q.order(toSnake(options.orderBy), { ascending: options.ascending !== false });
      }
      const { data, error } = await q;
      logErr(`${table}.list`, error);
      return (data || []).map(rowFromDb);
    },

    async get(id) {
      if (isDemoActive()) {
        const row = (DEMO_TABLES[table] || []).find(r => r[pk] === id);
        return row ? rowFromDb(row) : null;
      }
      const { data, error } = await supabase.from(table).select('*').eq(pk, id).maybeSingle();
      logErr(`${table}.get`, error);
      return data ? rowFromDb(data) : null;
    },

    async findBy(column, value) {
      if (isDemoActive()) {
        const row = (DEMO_TABLES[table] || []).find(r => r[toSnake(column)] === value);
        return row ? rowFromDb(row) : null;
      }
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .eq(toSnake(column), value)
        .maybeSingle();
      logErr(`${table}.findBy`, error);
      return data ? rowFromDb(data) : null;
    },

    async insert(row) {
      if (isDemoActive()) {
        const fake = { ...row, [pk]: row[pk] || `demo-${Date.now()}-${Math.random().toString(36).slice(2,8)}` };
        return rowFromDb(rowToDb(fake));
      }
      const { data, error } = await supabase
        .from(table)
        .insert(rowToDb(row))
        .select()
        .single();
      logErr(`${table}.insert`, error);
      if (error) throw error;
      return rowFromDb(data);
    },

    async upsert(row, { onConflict = pk } = {}) {
      if (isDemoActive()) {
        return rowFromDb(rowToDb(row));
      }
      const { data, error } = await supabase
        .from(table)
        .upsert(rowToDb(row), { onConflict })
        .select()
        .single();
      logErr(`${table}.upsert`, error);
      if (error) throw error;
      return rowFromDb(data);
    },

    async update(id, patch) {
      if (isDemoActive()) {
        return rowFromDb(rowToDb({ ...patch, [pk]: id }));
      }
      const { data, error } = await supabase
        .from(table)
        .update(rowToDb(patch))
        .eq(pk, id)
        .select()
        .single();
      logErr(`${table}.update`, error);
      if (error) throw error;
      return rowFromDb(data);
    },

    async delete(id) {
      if (isDemoActive()) return;
      const { error } = await supabase.from(table).delete().eq(pk, id);
      logErr(`${table}.delete`, error);
      if (error) throw error;
    },

    async deleteMany(ids) {
      if (isDemoActive()) return;
      if (!ids?.length) return;
      const { error } = await supabase.from(table).delete().in(pk, ids);
      logErr(`${table}.deleteMany`, error);
      if (error) throw error;
    },

    subscribe(callback, options = {}) {
      if (isDemoActive()) {
        const rows = demoListSync(table, options).map(rowFromDb);
        Promise.resolve().then(() => callback(rows));
        return () => {};
      }
      let cache = [];
      let mounted = true;
      const pkKey = toCamel(pk);

      this.list(options).then(rows => {
        if (!mounted) return;
        cache = rows;
        callback(cache.slice());
      }).catch(err => console.error(`[db.${table}.subscribe initial]`, err));

      const channelName = `${table}-${Math.random().toString(36).slice(2, 8)}`;
      const channel = supabase
        .channel(channelName)
        .on('postgres_changes',
          { event: '*', schema: 'public', table },
          (payload) => {
            if (!mounted) return;
            const newRow = payload.new ? rowFromDb(payload.new) : null;
            const oldRow = payload.old ? rowFromDb(payload.old) : null;
            if (payload.eventType === 'INSERT' && newRow) {
              if (!cache.some(r => r[pkKey] === newRow[pkKey])) cache.unshift(newRow);
            } else if (payload.eventType === 'UPDATE' && newRow) {
              const idx = cache.findIndex(r => r[pkKey] === newRow[pkKey]);
              if (idx >= 0) cache[idx] = newRow;
              else cache.unshift(newRow);
            } else if (payload.eventType === 'DELETE' && oldRow) {
              cache = cache.filter(r => r[pkKey] !== oldRow[pkKey]);
            }
            callback(cache.slice());
          })
        .subscribe();

      return () => {
        mounted = false;
        supabase.removeChannel(channel);
      };
    },
  };
}

export const db = {
  users:              createTableApi('users', { pk: 'uid' }),
  reports:            createTableApi('reports'),
  logistics_requests: createTableApi('logistics_requests'),
  meal_evaluations:   createTableApi('meal_evaluations'),
  mina_readiness:     createTableApi('mina_readiness'),
  arafat_readiness:   createTableApi('arafat_readiness'),
  meal_phases:        createTableApi('meal_phases'),
  assigned_tasks:     createTableApi('assigned_tasks'),
  task_completions:   createTableApi('task_completions'),
};

export { supabase } from '../config/supabase.js';

/* Supabase Storage rejects keys with non-ASCII chars, spaces, or special
   chars. Strip the path down to ASCII alnum + a few safe separators. */
export function sanitizeStoragePath(s) {
  return String(s ?? '')
    .replace(/[^\w./-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export async function uploadFile(bucket, path, file, options = {}) {
  path = sanitizeStoragePath(path);
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: '3600',
    upsert: true,
    contentType: file.type || options.contentType || 'application/octet-stream',
    ...options,
  });
  if (error) {
    console.error('[uploadFile]', error.message);
    throw error;
  }
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

export function getPublicUrl(bucket, path) {
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

export async function deleteFile(bucket, path) {
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) console.error('[deleteFile]', error.message);
}

/* Re-export bucket names for convenience */
export { STORAGE_BUCKETS };
