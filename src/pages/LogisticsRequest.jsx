import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Send, Truck, Building2, User, Package } from 'lucide-react';
import { db } from '../config/db.js';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

const OBSERVER_NAME   = 'عمر الرفاعي';
const OBSERVER_CENTER = 'مركز ٤٥';

const SUPPORT_TYPES = [
  { value: 'internal', label: 'داخلي' },
  { value: 'external', label: 'خارجي' },
  { value: 'both',     label: 'داخلي وخارجي' },
];

export default function LogisticsRequest() {
  const navigate = useNavigate();

  const [supportType, setSupportType]     = useState('');
  const [qtyInternal, setQtyInternal]     = useState('');
  const [qtyExternal, setQtyExternal]     = useState('');
  const [notes, setNotes]                 = useState('');
  const [loading, setLoading]             = useState(false);

  const showInternal = supportType === 'internal' || supportType === 'both';
  const showExternal = supportType === 'external' || supportType === 'both';

  const handleSubmit = async () => {
    if (!supportType) { alert('الرجاء اختيار نوع الإسناد'); return; }
    if (showInternal && !qtyInternal) { alert('الرجاء إدخال الكمية الداخلية'); return; }
    if (showExternal && !qtyExternal) { alert('الرجاء إدخال الكمية الخارجية'); return; }

    setLoading(true);
    try {
      await addDoc(collection(db, 'logistics_requests'), {
        observer: OBSERVER_NAME,
        center: OBSERVER_CENTER,
        supportType,
        ...(showInternal && { qtyInternal: Number(qtyInternal) }),
        ...(showExternal && { qtyExternal: Number(qtyExternal) }),
        notes,
        timestamp: serverTimestamp(),
        status: 'pending',
      });
      alert('تم إرسال طلب الإسناد بنجاح');
      navigate('/home');
    } catch (e) {
      console.error(e);
      alert('حدث خطأ أثناء الإرسال');
    }
    setLoading(false);
  };

  return (
    <div dir="rtl" className="min-h-screen bg-[#FDFCFB] pb-28 font-arabic">

      {/* Header */}
      <div className="bg-white sticky top-0 z-50 px-4 py-4 border-b border-[#D1C4B9] flex items-center justify-between shadow-sm">
        <button onClick={() => navigate('/home')} className="p-2 hover:bg-gray-100 rounded-full transition">
          <ChevronRight className="text-[#A98159]" />
        </button>
        <h1 className="text-base font-bold text-[#2D2926]">رفع طلب إسناد</h1>
        <div className="w-10" />
      </div>

      <div className="p-4 max-w-md mx-auto space-y-4">

        {/* Info card */}
        <div className="rounded-3xl p-5 text-white"
          style={{ background: 'linear-gradient(135deg, #3D3330 0%, #2D2926 100%)' }}>
          <div className="flex items-center gap-3">
            <div className="bg-[#A98159]/20 p-3 rounded-2xl">
              <Truck className="text-[#A98159]" size={26} />
            </div>
            <div>
              <p className="text-[#A98159] text-xs font-bold">طلب دعم ميداني</p>
              <h2 className="text-base font-bold">رفع طلب إسناد لوجستي</h2>
            </div>
          </div>
        </div>

        {/* Auto-filled info */}
        <div className="bg-white rounded-2xl border border-[#D1C4B9] shadow-card overflow-hidden">
          <div className="px-4 py-3 border-b border-[#D1C4B9] bg-[#FDF8F0]">
            <p className="text-xs font-bold text-[#A98159]">بيانات المراقب</p>
          </div>

          <div className="p-4 space-y-3">
            {/* Observer name */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-[#6D6E71] mb-1.5">
                <User size={13} className="text-[#A98159]" /> اسم المراقب
              </label>
              <div className="w-full px-4 py-3 bg-[#F5F5F5] border border-[#D1C4B9] rounded-xl text-sm font-bold text-[#2D2926]">
                {OBSERVER_NAME}
              </div>
            </div>

            {/* Center */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-[#6D6E71] mb-1.5">
                <Building2 size={13} className="text-[#A98159]" /> المركز / المسكن
              </label>
              <div className="w-full px-4 py-3 bg-[#F5F5F5] border border-[#D1C4B9] rounded-xl text-sm font-bold text-[#2D2926]">
                {OBSERVER_CENTER}
              </div>
            </div>
          </div>
        </div>

        {/* Support type */}
        <div className="bg-white rounded-2xl border border-[#D1C4B9] shadow-card overflow-hidden">
          <div className="px-4 py-3 border-b border-[#D1C4B9] bg-[#FDF8F0]">
            <p className="text-xs font-bold text-[#A98159]">تفاصيل الطلب</p>
          </div>

          <div className="p-4 space-y-4">
            {/* Type selector */}
            <div>
              <label className="text-xs font-medium text-[#6D6E71] mb-2 block">نوع الإسناد</label>
              <div className="grid grid-cols-3 gap-2">
                {SUPPORT_TYPES.map(t => (
                  <button
                    key={t.value}
                    onClick={() => { setSupportType(t.value); setQtyInternal(''); setQtyExternal(''); }}
                    className={`py-3 rounded-xl text-sm font-bold transition-all ${
                      supportType === t.value
                        ? 'bg-[#A98159] text-white shadow-md'
                        : 'bg-gray-50 text-[#6D6E71] border border-gray-200'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Internal quantity */}
            {showInternal && (
              <div style={{ animation: 'fadeSlideUp 0.25s ease forwards' }}>
                <label className="flex items-center gap-1.5 text-xs font-medium text-[#6D6E71] mb-1.5">
                  <Package size={13} className="text-[#A98159]" />
                  {supportType === 'both' ? 'الكمية الداخلية' : 'الكمية'}
                </label>
                <input
                  type="number"
                  min="1"
                  value={qtyInternal}
                  onChange={e => setQtyInternal(e.target.value)}
                  placeholder="أدخل الكمية"
                  className="w-full px-4 py-3 border border-[#D1C4B9] rounded-xl text-sm text-[#2D2926] outline-none focus:border-[#A98159] transition"
                />
              </div>
            )}

            {/* External quantity */}
            {showExternal && (
              <div style={{ animation: 'fadeSlideUp 0.25s ease forwards' }}>
                <label className="flex items-center gap-1.5 text-xs font-medium text-[#6D6E71] mb-1.5">
                  <Package size={13} className="text-[#A98159]" />
                  {supportType === 'both' ? 'الكمية الخارجية' : 'الكمية'}
                </label>
                <input
                  type="number"
                  min="1"
                  value={qtyExternal}
                  onChange={e => setQtyExternal(e.target.value)}
                  placeholder="أدخل الكمية"
                  className="w-full px-4 py-3 border border-[#D1C4B9] rounded-xl text-sm text-[#2D2926] outline-none focus:border-[#A98159] transition"
                />
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="text-xs font-medium text-[#6D6E71] mb-1.5 block">ملاحظات (اختياري)</label>
              <textarea
                rows={3}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="أي تفاصيل إضافية..."
                className="w-full px-4 py-3 border border-[#D1C4B9] rounded-xl text-sm text-[#2D2926] outline-none focus:border-[#A98159] transition resize-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Floating submit */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 backdrop-blur-md border-t border-[#D1C4B9]">
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full max-w-md mx-auto bg-[#A98159] text-white py-4 rounded-2xl font-bold text-base shadow-gold-lg flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
        >
          {loading ? 'جاري الإرسال...' : (
            <><Send size={18} /> إرسال الطلب</>
          )}
        </button>
      </div>

      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
