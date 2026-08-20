/**
 * src/lib/catererAccounts.js
 *
 * Creating a sign-in account for a caterer, from the admin console.
 *
 * The obvious call — supabase.auth.signUp — has a trap in it: the client that
 * makes it adopts the new account's session, so an administrator creating an
 * account for a caterer would find themselves signed in AS that caterer, with
 * their own console gone. It looks like the page crashed.
 *
 * So the sign-up goes through a second client that keeps no session at all.
 * It talks to the same project with the same key, creates the account, and
 * forgets it existed. The administrator's session is never touched because the
 * client holding it was never involved.
 *
 * (The clean way is auth.admin.createUser from a server, which needs the
 * service key. That key must never reach a browser, so until there is an edge
 * function to hold it, this is the correct browser-side approach.)
 */

import { createClient } from '@supabase/supabase-js';
import { db } from './db.js';

let isolated = null;
const isolatedClient = () => {
  if (!isolated) {
    isolated = createClient(
      import.meta.env.VITE_SUPABASE_URL,
      import.meta.env.VITE_SUPABASE_ANON_KEY,
      { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
    );
  }
  return isolated;
};

/** Readable, and long enough to be worth having. Avoids the character pairs
 *  that get misread when a password is copied off a screen by hand. */
export function suggestPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ' + 'abcdefghijkmnopqrstuvwxyz' + '23456789';
  const bytes = new Uint32Array(12);
  crypto.getRandomValues(bytes);
  return [...bytes].map(b => alphabet[b % alphabet.length]).join('');
}

export const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v || '').trim());

/**
 * Creates the auth account and the users row that ties it to this caterer.
 *
 * @returns {{ needsConfirmation: boolean, email: string, uid: string }}
 * @throws  {Error} with an Arabic message
 */
export async function createCatererAccount({ caterer, email, password }) {
  const mail = String(email || '').trim().toLowerCase();
  if (!isEmail(mail)) throw new Error('البريد الإلكتروني غير صحيح');
  if (!password || password.length < 8) throw new Error('كلمة المرور ٨ أحرف على الأقل');
  if (!caterer?.id) throw new Error('لم يُحدَّد المتعهد');

  /* Refuse before creating anything: an auth account with no users row behind
     it is an account that can sign in and then land nowhere. */
  const taken = await db.users.findBy('email', mail);
  if (taken) throw new Error('هذا البريد مستخدم لحساب آخر في النظام');

  const { data, error } = await isolatedClient().auth.signUp({
    email: mail,
    password,
  });

  if (error) {
    const m = String(error.message || '');
    if (/already registered|already exists/i.test(m)) {
      throw new Error('هذا البريد مسجّل مسبقاً في المصادقة — استخدم بريداً آخر');
    }
    if (/password/i.test(m)) throw new Error('كلمة المرور ضعيفة — استخدم كلمة أطول');
    throw new Error(m || 'تعذّر إنشاء الحساب');
  }

  const authUid = data?.user?.id || null;

  /* The row that makes the account mean something. Without it the caterer
     signs in and the portal has no idea whose data to show. */
  let row;
  try {
    row = await db.users.insert({
      nameAr: caterer.name,
      name: caterer.nameShort || caterer.name,
      email: mail,
      authUid,
      role: 'caterer',
      catererId: caterer.id,
      caterer: caterer.name,
    });
  } catch (e) {
    /* The auth account now exists and cannot be removed without the service
       key, so say so plainly rather than pretending nothing happened. */
    throw new Error(
      `أُنشئ حساب المصادقة لكن تعذّر ربطه: ${e.message}. ` +
      'أعد المحاولة ببريد آخر، أو احذف الحساب من لوحة Supabase.',
    );
  }

  return {
    /* signUp returns no session when the project requires the address to be
       confirmed. The account exists either way, but cannot sign in yet. */
    needsConfirmation: !data?.session,
    email: mail,
    uid: row.uid,
    authUid,
  };
}

/** The account currently tied to this caterer, if any. */
export async function findCatererAccount(catererId) {
  const rows = await db.users.list({ filter: { catererId } });
  return rows.find(r => r.role === 'caterer') || null;
}

/** Removes the link. The auth account itself needs the Supabase dashboard —
 *  the browser has no key that may delete one. */
export async function unlinkCatererAccount(uid) {
  await db.users.delete(uid);
}
