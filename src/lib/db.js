// Supabase abstraction: per-table CRUD + realtime + storage helpers
import { supabase, STORAGE_BUCKETS } from '../config/supabase.js';

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

function createTableApi(table, { pk = 'id' } = {}) {
  return {
    async list(options = {}) {
      /* `columns` narrows the select. Used by the caterer portal, which must
         never request the office's internal notes — discarding them in the
         browser would be too late, they would already have been sent. */
      const projection = options.columns
        ? options.columns.map(toSnake).join(',')
        : '*';
      let q = supabase.from(table).select(projection);
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

    /* Does this table exist and can we read it?
       list() deliberately swallows errors and returns [] so a blip never blanks
       a screen — which also means a caller cannot tell "no rows" from "no
       table". A screen that needs to say which one it is asks here. */
    async probe() {
      const { error } = await supabase.from(table).select(pk).limit(1);
      return { ok: !error, code: error?.code || null, message: error?.message || null };
    },

    async get(id) {
      const { data, error } = await supabase.from(table).select('*').eq(pk, id).maybeSingle();
      logErr(`${table}.get`, error);
      return data ? rowFromDb(data) : null;
    },

    async findBy(column, value) {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .eq(toSnake(column), value)
        .maybeSingle();
      logErr(`${table}.findBy`, error);
      return data ? rowFromDb(data) : null;
    },

    async insert(row) {
      const { data, error } = await supabase
        .from(table)
        .insert(rowToDb(row))
        .select()
        .single();
      logErr(`${table}.insert`, error);
      if (error) throw error;
      return rowFromDb(data);
    },

    /* One round trip for a batch. Bulk-assigning a form to fifty caterers as
       fifty inserts would be fifty requests, and a failure halfway would leave
       the batch half-applied. */
    async insertMany(rows) {
      if (!rows?.length) return [];
      const { data, error } = await supabase
        .from(table)
        .insert(rows.map(rowToDb))
        .select();
      logErr(`${table}.insertMany`, error);
      if (error) throw error;
      return (data || []).map(rowFromDb);
    },

    async upsert(row, { onConflict = pk } = {}) {
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
      const { error } = await supabase.from(table).delete().eq(pk, id);
      logErr(`${table}.delete`, error);
      if (error) throw error;
    },

    /* Deletes by column match rather than by primary key. A join table has no
       id of its own — its key is the pair of columns — so removing one link
       has to be expressed as a where clause. */
    async deleteWhere(filter) {
      if (!filter || !Object.keys(filter).length) {
        throw new Error(`db.${table}.deleteWhere needs a filter`);
      }
      let q = supabase.from(table).delete();
      for (const [k, v] of Object.entries(filter)) q = q.eq(toSnake(k), v);
      const { error } = await q;
      logErr(`${table}.deleteWhere`, error);
      if (error) throw error;
    },

    async deleteMany(ids) {
      if (!ids?.length) return;
      const { error } = await supabase.from(table).delete().in(pk, ids);
      logErr(`${table}.deleteMany`, error);
      if (error) throw error;
    },

    subscribe(callback, options = {}) {
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
  /* Tenant identity — one row, id = 1. See docs/ROADMAP.md and 005. */
  org_settings:       createTableApi('org_settings'),
  seasons:            createTableApi('seasons'),
  caterers:           createTableApi('caterers'),
  /* A center belongs to one season. Its `code` is the Arabic label
     ('مركز 5') that every other table already stores in `center text`, so the
     same label in two seasons is two different rows — which is the point. */
  centers:            createTableApi('centers'),
  center_officials:   createTableApi('center_officials'),
  reports:            createTableApi('reports'),
  logistics_requests: createTableApi('logistics_requests'),
  meal_evaluations:   createTableApi('meal_evaluations'),
  mina_readiness:     createTableApi('mina_readiness'),
  arafat_readiness:   createTableApi('arafat_readiness'),
  meal_phases:        createTableApi('meal_phases'),
  assigned_tasks:     createTableApi('assigned_tasks'),
  task_completions:   createTableApi('task_completions'),
  /* One row per nationality × day × meal. See 008_menus.sql — the menu used
     to be compiled in, which only works for one customer. */
  menus:              createTableApi('menus'),
  /* The season's pilgrim groups, and which centres feed each. See
     009_nationalities.sql — centre 26 serves two, so the link is its own row. */
  nationalities:        createTableApi('nationalities'),
  center_nationalities: createTableApi('center_nationalities'),
  /* Season-long scorecard per caterer. See 010_caterer_evaluations.sql. */
  caterer_evaluations:  createTableApi('caterer_evaluations'),
  /* Forms are three layers: what a form is, who owes it, and what happened.
     See docs/FORMS_MODULE.md. */
  form_templates:     createTableApi('form_templates'),
  form_assignments:   createTableApi('form_assignments'),
  form_events:        createTableApi('form_events'),
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

/**
 * Turns a public storage URL into one the browser saves rather than displays.
 *
 * The `download` attribute on an anchor is ignored across origins, and storage
 * is a different origin from the app — so a PDF opened from a form navigated
 * away to the file instead of landing in the downloads folder. Supabase reads
 * a `download` query parameter and answers with Content-Disposition, which is
 * the only thing a cross-origin link will obey.
 *
 * @param {string} url       the public URL
 * @param {string} filename  what it should be called once saved
 */
export function asDownload(url, filename) {
  if (!url) return url;
  try {
    const u = new URL(url);
    u.searchParams.set('download', filename || '');
    return u.toString();
  } catch {
    return url;
  }
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
