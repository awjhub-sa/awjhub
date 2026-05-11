import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Send, Truck, Package, Utensils, Droplets, User } from 'lucide-react';
import { db } from '../config/db.js';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext.jsx';
import { getCaterer } from '../config/centers.js';

const CATEGORY_TYPES = [
  { id: 'meals', label: 'إسناد وجبات', icon: Utensils },
  { id: 'water', label: 'إسناد مياه', icon: Droplets },
];

const SUPPORT_TYPES = [
  { value: 'internal', label: 'داخلي' },
  { value: 'external', label: 'خارجي' },
  { value: 'both',     label: 'داخلي وخارجي' },
];

export default function LogisticsRequest() {
  const navigate = useNavigate();
  const { profile } = useAuth();

  const [category, setCategory] = useState('');
  const [supportType, setSupportType] = useState('');
  const [qtyInternal, setQtyInternal] = useState('');
  const [qtyExternal, setQtyExternal] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [isFormValid, setIsFormValid] = useState(false);

  const showInternal = supportType === 'internal' || supportType === 'both';
  const showExternal = supportType === 'external' || supportType === 'both';

  const sanitizeNumber = (value) => {
    const arabicNumbers = [/٠/g, /١/g, /٢/g, /٣/g, /٤/g, /٥/g, /٦/g, /٧/g, /٨/g, /٩/g];
    let sanitized = value;
    for (let i = 0; i < 10; i++) {
      sanitized = sanitized.replace(arabicNumbers[i], i);
    }
    return sanitized.replace(/[^\d]/g, '');
  };

  useEffect(() => {
    const checkValidity = () => {
      if (!category || !supportType) return false;
      const intQty = parseInt(qtyInternal) || 0;
      const extQty = parseInt(qtyExternal) || 0;
      if (supportType === 'internal') return intQty >= 1;
      if (supportType === 'external') return extQty >= 1;
      if (supportType === 'both') return intQty >= 1 && extQty >= 1;
      return false;
    };
    setIsFormValid(checkValidity());
  }, [category, supportType, qtyInternal, qtyExternal]);

  const handleSubmit = async () => {
    if (!isFormValid || loading) return;
    
    setLoading(true);
    try {
      await addDoc(collection(db, 'logistics_requests'), {
        uid: profile?.uid,
        observer: profile?.nameAr || profile?.name || '—',
        center: profile?.center || '—',
        caterer: profile?.caterer || getCaterer(profile?.center) || '—',
        category,
        supportType,
        qtyInternal: showInternal ? parseInt(qtyInternal) : null,
        qtyExternal: showExternal ? parseInt(qtyExternal) : null,
        notes,
        timestamp: serverTimestamp(),
        status: 'pending'
      });
      alert('تم إرسال طلب الإسناد بنجاح');
      navigate('/home');
    } catch (e) { 
      alert('خطأ في الإرسال'); 
    }
    setLoading(false);
  };

  return (
    <div dir="rtl" className="min-h-screen bg-[#FDFCFB] pb-28 font-arabic px-0">
      <header className="sticky top-0 z-50 bg-[#FDFCFB]/95 backdrop-blur-sm border-b border-[#D1C4B9] w-full px-4 md:px-8 py-3 mb-6 shadow-sm">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <button onClick={() => navigate('/home')} className="p-2 hover:bg-gray-100 rounded-xl transition shrink-0 border border-transparent active:border-[#A98159]/20">
            <ChevronRight className="text-[#A98159]" size={22} strokeWidth={2.5} />
          </button>
          <h1 className="text-base font-bold text-[#2D2926] absolute left-1/2 -translate-x-1/2 whitespace-nowrap">طلب إسناد</h1>
          <div className="w-10 shrink-0" />
        </div>
      </header>

      <div className="px-4">
        {/* Header Card with Observer Info */}
        <div className="rounded-[2.5rem] p-6 my-6 text-white shadow-lg relative overflow-hidden" 
             style={{ background: '#2D2926' }}>
          <Truck className="absolute -left-4 -bottom-4 text-white/5 w-32 h-32 rotate-12" />
          
          <div className="flex justify-between items-center mb-8 relative z-10">
            <div className="flex items-center gap-4">
              <div className="bg-[#A98159] p-3 rounded-2xl shadow-lg">
                <Truck className="text-white" size={24} />
              </div>
              <div>
                <p className="text-[#A98159] text-[10px] font-black uppercase tracking-widest">منظومة الخدمات اللوجستية</p>
                <h2 className="text-xl font-bold">رفع طلب إسناد</h2>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-2 relative z-10 w-full">
            {/* مربع المراقب - الجديد */}
            <div className="bg-white/5 rounded-2xl px-3 py-3 flex-1 min-w-[100px] border border-white/10 backdrop-blur-sm flex flex-col items-center">
              <span className="text-white/40 text-[10px] block mb-1">المراقب</span>
              <span className="text-white font-bold text-[11px] truncate w-full text-center">
                {profile?.nameAr || profile?.name || '—'}
              </span>
            </div>

            {/* مربع المركز */}
            <div className="bg-white/5 rounded-2xl px-3 py-3 flex-1 min-w-[80px] border border-white/10 backdrop-blur-sm flex flex-col items-center">
              <span className="text-white/40 text-[10px] block mb-1">المركز</span>
              <span className="text-[#A98159] font-bold text-sm">{profile?.center || '—'}</span>
            </div>

            {/* مربع المتعهد */}
            <div className="bg-white/5 rounded-2xl px-3 py-3 flex-1 min-w-[100px] border border-white/10 backdrop-blur-sm flex flex-col items-center">
              <span className="text-white/40 text-[10px] block mb-1">المتعهد</span>
              <span className="text-white font-bold text-[11px] truncate w-full text-center">
                {profile?.caterer || getCaterer(profile?.center) || '—'}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[2rem] p-6 border border-[#D1C4B9] shadow-sm space-y-8">
          {/* ... باقي الكود كما هو دون تغيير ... */}
          <div>
            <label className="text-xs font-bold text-[#A98159] mb-4 block text-center uppercase tracking-wide">تصنيف الإسناد</label>
            <div className="grid grid-cols-2 gap-4">
              {CATEGORY_TYPES.map(type => (
                <button key={type.id} 
                  onClick={() => { setCategory(type.id); setSupportType(''); setQtyInternal(''); setQtyExternal(''); }}
                  className={`py-6 rounded-3xl flex flex-col items-center gap-3 transition-all duration-300 border-2 ${category === type.id ? 'border-[#A98159] bg-[#A98159]/5 text-[#2D2926]' : 'border-transparent bg-[#F9F7F5] text-[#6D6E71]'}`}>
                  <type.icon size={32} className={category === type.id ? 'text-[#A98159]' : 'text-[#D1C4B9]'} />
                  <span className="font-bold text-sm">{type.label}</span>
                </button>
              ))}
            </div>
          </div>

          {category && (
            <div className="animate-in fade-in slide-in-from-top-4 duration-500 space-y-8">
              <div className="h-px bg-[#E5DDD5] w-full" />
              <div>
                <label className="text-xs font-bold text-[#A98159] mb-4 block text-center tracking-wider">نطاق الإسناد</label>
                <div className="grid grid-cols-3 gap-3">
                  {SUPPORT_TYPES.map(type => (
                    <button key={type.value} 
                      onClick={() => { setSupportType(type.value); setQtyInternal(''); setQtyExternal(''); }}
                      className={`py-4 rounded-2xl text-[11px] font-bold transition-all ${supportType === type.value ? 'bg-[#2D2926] text-white shadow-lg' : 'bg-[#F9F7F5] text-[#6D6E71] border border-[#E5DDD5]'}`}>
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {showInternal && (
                  <div className="animate-in zoom-in-95 duration-300">
                    <label className="flex items-center gap-2 text-xs font-bold text-[#2D2926] mb-2 px-1">
                      <Package size={14} className="text-[#A98159]" /> 
                      {category === 'water' ? 'عدد العبوات (داخلي)' : 'عدد الوجبات (داخلي)'}
                    </label>
                    <input type="text" inputMode="numeric" value={qtyInternal} 
                      onChange={e => setQtyInternal(sanitizeNumber(e.target.value))} placeholder="0"
                      className="w-full px-5 py-4 bg-[#FDFCFB] border-2 border-[#E5DDD5] rounded-2xl outline-none focus:border-[#A98159] font-bold text-lg" />
                  </div>
                )}
                {showExternal && (
                  <div className="animate-in zoom-in-95 duration-300">
                    <label className="flex items-center gap-2 text-xs font-bold text-[#2D2926] mb-2 px-1">
                      <Package size={14} className="text-[#A98159]" />
                      {category === 'water' ? 'عدد العبوات (خارجي)' : 'عدد الوجبات (خارجي)'}
                    </label>
                    <input type="text" inputMode="numeric" value={qtyExternal} 
                      onChange={e => setQtyExternal(sanitizeNumber(e.target.value))} placeholder="0"
                      className="w-full px-5 py-4 bg-[#FDFCFB] border-2 border-[#E5DDD5] rounded-2xl outline-none focus:border-[#A98159] font-bold text-lg" />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-lg border-t border-[#D1C4B9] z-50 text-center">
        <button onClick={handleSubmit} disabled={!isFormValid || loading}
          className={`w-full max-w-md mx-auto py-4 rounded-2xl font-bold text-lg shadow-xl flex items-center justify-center gap-3 transition-all duration-300 ${!isFormValid || loading ? 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-70 shadow-none' : 'bg-[#1A73E8] text-white hover:bg-[#1557B0] active:scale-95'}`}>
          {loading ? 'جاري الإرسال...' : <><Send size={20} /> <span>إرسال طلب الإسناد</span></>}
        </button>
        {!isFormValid && category && supportType && (
          <p className="text-[10px] text-red-400 mt-2 font-bold animate-pulse tracking-wide">يجب إدخال كمية (1) أو أكثر لإتمام الطلب</p>
        )}
      </div>
    </div>
  );
}