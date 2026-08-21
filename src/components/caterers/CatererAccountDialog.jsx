/**
 * src/components/caterers/CatererAccountDialog.jsx
 *
 * Issues a caterer their way in.
 *
 * The password is shown once, here, and never again — nothing stores it where
 * this screen could read it back. So the dialog says that plainly and offers to
 * copy it while it is still on the glass. A credential that can be looked up
 * later is a credential held by everyone with console access.
 */

import { useEffect, useState } from 'react';
import {
  X, Key, Copy, CheckCircle, WarningCircle, ArrowsClockwise,
  Envelope, LinkBreak, Eye, EyeSlash,
} from '@phosphor-icons/react';
import {
  createCatererAccount, findCatererAccount, unlinkCatererAccount,
  suggestPassword, isEmail,
} from '../../lib/catererAccounts.js';
import { IconTile } from '../ui/index.jsx';

const tint = (c, pct) => `color-mix(in srgb, ${c} ${pct}%, #fff)`;

const NAVY  = 'rgb(var(--c-primary))';
const CLAY  = '#B4674E';
const GREEN = '#15803D';

export default function CatererAccountDialog({ caterer, onClose, onChanged }) {
  const [existing, setExisting] = useState(undefined);   // undefined = still loading
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState(() => suggestPassword());
  const [show, setShow] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(null);
  const [copied, setCopied] = useState('');
  const [confirmUnlink, setConfirmUnlink] = useState(false);

  useEffect(() => {
    let alive = true;
    findCatererAccount(caterer.id)
      .then(r => { if (alive) { setExisting(r); setEmail(r?.email || caterer.email || ''); } })
      .catch(() => alive && setExisting(null));
    return () => { alive = false; };
  }, [caterer]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const copy = async (text, what) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(''), 1600);
    } catch { /* clipboard blocked — the value is on screen to read */ }
  };

  const create = async () => {
    setBusy(true); setErr('');
    try {
      const res = await createCatererAccount({ caterer, email, password });
      setDone(res);
      onChanged?.();
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const unlink = async () => {
    setBusy(true); setErr('');
    try {
      await unlinkCatererAccount(existing.uid);
      setExisting(null); setConfirmUnlink(false);
      onChanged?.();
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[75] flex items-end sm:items-center justify-center" dir="rtl">
      <button className="absolute inset-0 bg-ink/45 backdrop-blur-[2px]" onClick={onClose} aria-label="إغلاق" />
      <div className="relative w-full sm:max-w-md bg-white rounded-t-[18px] sm:rounded-[18px] border border-line overflow-hidden
                      shadow-[0_0_40px_-8px_rgb(0_0_0/0.45)] max-h-[92vh] flex flex-col">

        <header className="px-5 py-3.5 border-b flex items-center gap-3 flex-shrink-0"
          style={{ background: tint(NAVY, 12), borderColor: tint(NAVY, 28) }}>
          <IconTile Icon={Key} color={NAVY} size="md" />
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-bold leading-tight" style={{ color: NAVY }}>حساب دخول المتعهد</p>
            <p className="text-[11.5px] font-medium text-muted mt-1 truncate">{caterer.name}</p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-[10px] border border-line bg-white flex items-center justify-center flex-shrink-0 text-muted hover:text-ink transition-colors">
            <X size={14} weight="bold" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">

          {existing === undefined && (
            <div className="py-8 flex justify-center">
              <div className="w-7 h-7 border-2 border-primary/25 border-t-primary rounded-full animate-spin" />
            </div>
          )}

          {/* ── just created ── */}
          {done && (
            <>
              <div className="rounded-[11px] border p-3 flex gap-2"
                style={{ background: tint(GREEN, 12), borderColor: tint(GREEN, 28) }}>
                <CheckCircle size={16} weight="fill" className="flex-shrink-0 mt-0.5" style={{ color: GREEN }} />
              </div>

              <Cred label="البريد" value={done.email}
                onCopy={() => copy(done.email, 'email')} copied={copied === 'email'} />
              <Cred label="كلمة المرور" value={password} mono
                onCopy={() => copy(password, 'pw')} copied={copied === 'pw'} />

              {done.needsConfirmation && (
                <div className="rounded-[11px] border p-3 flex gap-2"
                  style={{ background: tint(CLAY, 12), borderColor: tint(CLAY, 28) }}>
                  <WarningCircle size={15} weight="bold" style={{ color: CLAY }} className="flex-shrink-0 mt-0.5" />
                  <p className="text-[11.5px] text-ink leading-relaxed">
                    المشروع يطلب تأكيد البريد، فلن يستطيع الدخول قبل تأكيده.
                    عطّل <b>Confirm email</b> من إعدادات المصادقة في Supabase،
                    أو أكّد العنوان يدوياً من لوحة المستخدمين.
                  </p>
                </div>
              )}
            </>
          )}

          {/* ── already has one ── */}
          {!done && existing && (
            <>
              <div className="rounded-[11px] border border-line bg-[rgb(var(--c-bg))] p-3">
                <p className="text-[10.5px] font-bold text-muted tracking-[0.14em] mb-1.5">الحساب المرتبط</p>
                <p className="text-[12.5px] font-bold text-ink flex items-center gap-1.5">
                  <Envelope size={13} weight="bold" className="text-primary" />
                  {existing.email || '— بلا بريد —'}
                </p>
                <p className="text-[11px] font-medium text-muted mt-1.5">
                  {existing.authUid
                    ? 'مرتبط بحساب مصادقة'
                    : 'غير مرتبط بمصادقة — لا يستطيع الدخول'}
                </p>
              </div>

              {!confirmUnlink ? (
                <button onClick={() => setConfirmUnlink(true)} disabled={busy}
                  className="w-full h-9 rounded-[10px] border border-line bg-white text-[12px] font-bold text-error/80
                             hover:text-error hover:border-error/30 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-40">
                  <LinkBreak size={13} weight="bold" />
                  فكّ الربط بهذا المتعهد
                </button>
              ) : (
                <div className="rounded-[11px] border p-3"
                  style={{ background: tint(CLAY, 12), borderColor: tint(CLAY, 28) }}>
                  <div className="flex gap-2">
                    <button onClick={unlink} disabled={busy}
                      className="h-8 px-3 rounded-[10px] bg-error border border-error text-white text-[11.5px] font-bold hover:opacity-90 transition-opacity disabled:opacity-40">
                      نعم، فكّ الربط
                    </button>
                    <button onClick={() => setConfirmUnlink(false)}
                      className="h-8 px-3 text-[11.5px] font-bold text-muted hover:text-ink transition-colors">تراجع</button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── create one ── */}
          {!done && existing === null && (
            <>
              <label className="block">
                <span className="text-[11.5px] font-bold text-muted block mb-1.5">البريد الإلكتروني</span>
                <input value={email} onChange={e => setEmail(e.target.value)} dir="ltr"
                  placeholder="caterer@example.com" autoComplete="off"
                  className="w-full h-9 px-3 rounded-[10px] border border-line bg-[rgb(var(--c-bg))] text-[12.5px] text-ink
                             transition-colors focus:outline-none focus:border-primary/50 focus:bg-white" />
                {email && !isEmail(email) && (
                  <span className="text-[10.5px] font-bold text-error mt-1.5 block">صيغة البريد غير صحيحة</span>
                )}
              </label>

              <label className="block">
                <span className="text-[11.5px] font-bold text-muted block mb-1.5">كلمة المرور</span>
                <div className="flex gap-1.5">
                  <input value={password} onChange={e => setPassword(e.target.value)} dir="ltr"
                    type={show ? 'text' : 'password'} autoComplete="new-password"
                    className="flex-1 h-9 px-3 rounded-[10px] border border-line bg-[rgb(var(--c-bg))] text-[12.5px] font-mono
                               text-ink transition-colors focus:outline-none focus:border-primary/50 focus:bg-white" />
                  <button type="button" onClick={() => setShow(s => !s)} title={show ? 'إخفاء' : 'إظهار'}
                    className="w-9 h-9 rounded-[10px] border border-line bg-white flex items-center justify-center text-muted hover:text-ink transition-colors">
                    {show ? <EyeSlash size={14} weight="bold" /> : <Eye size={14} weight="bold" />}
                  </button>
                  <button type="button" onClick={() => setPassword(suggestPassword())} title="توليد كلمة أخرى"
                    className="w-9 h-9 rounded-[10px] border border-line bg-white flex items-center justify-center text-muted hover:text-ink transition-colors">
                    <ArrowsClockwise size={14} weight="bold" />
                  </button>
                </div>
              </label>

            </>
          )}

          {err && (
            <div className="rounded-[11px] border p-3 flex gap-2"
              style={{ background: tint(CLAY, 12), borderColor: tint(CLAY, 28) }}>
              <WarningCircle size={15} weight="bold" style={{ color: CLAY }} className="flex-shrink-0 mt-0.5" />
              <p className="text-[11.5px] text-ink leading-relaxed">{err}</p>
            </div>
          )}
        </div>

        <footer className="px-5 py-3 border-t border-line flex items-center gap-2 flex-shrink-0">
          <button onClick={onClose}
            className="h-9 px-4 rounded-[10px] border border-line bg-white text-[12px] font-bold text-muted hover:text-ink hover:bg-[rgb(var(--c-bg))] transition-colors">
            {done ? 'تم' : 'إغلاق'}
          </button>
          {!done && existing === null && (
            <button onClick={create} disabled={busy || !isEmail(email) || password.length < 8}
              className="ms-auto h-9 px-5 rounded-[10px] bg-primary border border-primary text-white text-[12px] font-bold
                         flex items-center gap-1.5 hover:opacity-90 transition-opacity disabled:opacity-50">
              <Key size={13} weight="bold" />
              {busy ? 'جارٍ الإنشاء…' : 'إنشاء الحساب'}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}

function Cred({ label, value, mono, onCopy, copied }) {
  return (
    <div className="rounded-[11px] border border-line bg-[rgb(var(--c-bg))] p-3">
      <p className="text-[10.5px] font-bold text-muted tracking-[0.14em] mb-1.5">{label}</p>
      <div className="flex items-center gap-2">
        <code dir="ltr" className={`flex-1 text-[12.5px] font-bold text-ink break-all ${mono ? 'font-mono' : ''}`}>
          {value}
        </code>
        <button onClick={onCopy}
          className="w-8 h-8 rounded-[10px] border border-line bg-white flex items-center justify-center flex-shrink-0
                     text-muted hover:text-ink transition-colors">
          {copied ? <CheckCircle size={14} weight="fill" style={{ color: GREEN }} />
                  : <Copy size={13} weight="bold" />}
        </button>
      </div>
    </div>
  );
}
