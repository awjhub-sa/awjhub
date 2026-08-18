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
      <div className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl overflow-hidden
                      shadow-[0_20px_70px_rgb(var(--c-ink)/0.35)] max-h-[92vh] flex flex-col">

        <header className="px-5 py-4 border-b border-line flex items-center gap-3 flex-shrink-0">
          <span className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg,rgb(var(--c-primary-400)),rgb(var(--c-primary)))' }}>
            <Key size={17} weight="bold" className="text-white" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-black text-ink">حساب دخول المتعهد</p>
            <p className="text-[10.5px] font-bold text-muted mt-0.5 truncate">{caterer.name}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg border border-line flex items-center justify-center flex-shrink-0">
            <X size={15} weight="bold" className="text-muted" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">

          {existing === undefined && (
            <div className="py-8 flex justify-center">
              <div className="w-7 h-7 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          )}

          {/* ── just created ── */}
          {done && (
            <>
              <div className="rounded-xl border p-3 flex gap-2"
                style={{ borderColor: '#BBE7C8', background: 'color-mix(in srgb, #16A34A 7%, #fff)' }}>
                <CheckCircle size={16} weight="fill" className="text-success flex-shrink-0 mt-0.5" />
                <p className="text-[11.5px] text-ink leading-relaxed">
                  أُنشئ الحساب ورُبط بالمتعهد. سلّمه البيانات التالية —
                  <b> كلمة المرور لن تظهر مرة أخرى.</b>
                </p>
              </div>

              <Cred label="البريد" value={done.email}
                onCopy={() => copy(done.email, 'email')} copied={copied === 'email'} />
              <Cred label="كلمة المرور" value={password} mono
                onCopy={() => copy(password, 'pw')} copied={copied === 'pw'} />

              {done.needsConfirmation && (
                <div className="rounded-xl border p-3 flex gap-2"
                  style={{ borderColor: '#EBCFC3', background: 'color-mix(in srgb, #B4674E 7%, #fff)' }}>
                  <WarningCircle size={15} weight="bold" style={{ color: '#B4674E' }} className="flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] text-ink leading-relaxed">
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
              <div className="rounded-xl border border-line bg-background p-3">
                <p className="text-[10px] font-black text-muted/70 tracking-widest mb-1">الحساب المرتبط</p>
                <p className="text-[12.5px] font-bold text-ink flex items-center gap-1.5">
                  <Envelope size={13} weight="bold" className="text-primary" />
                  {existing.email || '— بلا بريد —'}
                </p>
                <p className="text-[10.5px] font-bold text-muted mt-1">
                  {existing.authUid
                    ? 'مرتبط بحساب مصادقة'
                    : 'غير مرتبط بمصادقة — لا يستطيع الدخول'}
                </p>
              </div>

              <p className="text-[11px] text-muted leading-relaxed">
                لتغيير كلمة المرور استخدم «إعادة تعيين» من لوحة مستخدمي Supabase —
                المتصفح لا يملك مفتاحاً يسمح بتغيير كلمة مرور حساب آخر.
              </p>

              {!confirmUnlink ? (
                <button onClick={() => setConfirmUnlink(true)} disabled={busy}
                  className="w-full h-9 rounded-lg border border-line text-[12px] font-bold text-error/80
                             hover:text-error flex items-center justify-center gap-1.5 disabled:opacity-40">
                  <LinkBreak size={13} weight="bold" />
                  فكّ الربط بهذا المتعهد
                </button>
              ) : (
                <div className="rounded-xl border p-3"
                  style={{ borderColor: '#EBCFC3', background: 'color-mix(in srgb, #B4674E 7%, #fff)' }}>
                  <p className="text-[11px] text-ink leading-relaxed mb-2">
                    يُحذف الربط فقط. حساب المصادقة نفسه يبقى في Supabase —
                    المتصفح لا يملك صلاحية حذفه.
                  </p>
                  <div className="flex gap-2">
                    <button onClick={unlink} disabled={busy}
                      className="h-8 px-3 rounded-lg bg-error text-white text-[11px] font-black disabled:opacity-40">
                      نعم، فكّ الربط
                    </button>
                    <button onClick={() => setConfirmUnlink(false)}
                      className="h-8 px-3 text-[11px] font-bold text-muted">تراجع</button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── create one ── */}
          {!done && existing === null && (
            <>
              <label className="block">
                <span className="text-[10px] font-black text-muted/70 tracking-widest block mb-1.5">البريد الإلكتروني</span>
                <input value={email} onChange={e => setEmail(e.target.value)} dir="ltr"
                  placeholder="caterer@example.com" autoComplete="off"
                  className="w-full h-9 px-3 rounded-lg border border-line bg-background text-[12.5px] text-ink
                             focus:outline-none focus:border-primary/50 focus:bg-white" />
                {email && !isEmail(email) && (
                  <span className="text-[10px] font-bold text-error mt-1 block">صيغة البريد غير صحيحة</span>
                )}
              </label>

              <label className="block">
                <span className="text-[10px] font-black text-muted/70 tracking-widest block mb-1.5">كلمة المرور</span>
                <div className="flex gap-1.5">
                  <input value={password} onChange={e => setPassword(e.target.value)} dir="ltr"
                    type={show ? 'text' : 'password'} autoComplete="new-password"
                    className="flex-1 h-9 px-3 rounded-lg border border-line bg-background text-[12.5px] font-mono
                               text-ink focus:outline-none focus:border-primary/50 focus:bg-white" />
                  <button type="button" onClick={() => setShow(s => !s)} title={show ? 'إخفاء' : 'إظهار'}
                    className="w-9 h-9 rounded-lg border border-line flex items-center justify-center text-muted hover:text-ink">
                    {show ? <EyeSlash size={14} weight="bold" /> : <Eye size={14} weight="bold" />}
                  </button>
                  <button type="button" onClick={() => setPassword(suggestPassword())} title="توليد كلمة أخرى"
                    className="w-9 h-9 rounded-lg border border-line flex items-center justify-center text-muted hover:text-ink">
                    <ArrowsClockwise size={14} weight="bold" />
                  </button>
                </div>
                <span className="text-[10px] font-bold text-muted mt-1 block">
                  مولَّدة عشوائياً — عدّلها إن شئت. لن تُعرض بعد الإنشاء.
                </span>
              </label>

              <p className="text-[11px] text-muted leading-relaxed">
                يُنشأ حساب مصادقة ويُربط بـ<b className="text-ink">{caterer.name}</b>،
                فيدخل على بوابة المتعهد ويرى بلاغات مراكزه ونماذجه فقط.
              </p>
            </>
          )}

          {err && (
            <div className="rounded-xl border p-3 flex gap-2"
              style={{ borderColor: '#EBCFC3', background: 'color-mix(in srgb, #B4674E 8%, #fff)' }}>
              <WarningCircle size={15} weight="bold" style={{ color: '#B4674E' }} className="flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-ink leading-relaxed">{err}</p>
            </div>
          )}
        </div>

        <footer className="px-5 py-3 border-t border-line flex items-center gap-2 flex-shrink-0">
          <button onClick={onClose}
            className="h-9 px-4 rounded-lg border border-line text-[12px] font-bold text-muted hover:text-ink">
            {done ? 'تم' : 'إغلاق'}
          </button>
          {!done && existing === null && (
            <button onClick={create} disabled={busy || !isEmail(email) || password.length < 8}
              className="mr-auto h-9 px-5 rounded-lg text-white text-[12px] font-black flex items-center gap-1.5 disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg,rgb(var(--c-primary-400)),rgb(var(--c-primary)))' }}>
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
    <div className="rounded-xl border border-line bg-background p-3">
      <p className="text-[10px] font-black text-muted/70 tracking-widest mb-1.5">{label}</p>
      <div className="flex items-center gap-2">
        <code dir="ltr" className={`flex-1 text-[12.5px] text-ink break-all ${mono ? 'font-mono' : ''}`}>
          {value}
        </code>
        <button onClick={onCopy}
          className="w-8 h-8 rounded-lg border border-line bg-white flex items-center justify-center flex-shrink-0
                     text-muted hover:text-ink">
          {copied ? <CheckCircle size={14} weight="fill" className="text-success" />
                  : <Copy size={13} weight="bold" />}
        </button>
      </div>
    </div>
  );
}
