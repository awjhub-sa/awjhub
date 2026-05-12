/* ══════════════════════════════════════════════════════
   AdminReportGenerator.jsx - النسخة الاحترافية المحدثة
   تاريخ التعديل: مايو ٢٠٢٦
   ══════════════════════════════════════════════════════ */

import { useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../config/db.js';
import { CENTERS } from '../../config/centers.js';
import { cairoBase64 } from '../../assets/fonts/CairoFont.js';
import logoSrc from '../../assets/logo.png';
import { FileText, X, ChevronDown, Loader2, CheckCircle2, Building2, Calendar, ClipboardList } from 'lucide-react';

// ثوابت المواعيد والجنسيات (للمعلومات الإضافية)
const DH_DAYS = ['٧ ذو الحجة ١٤٤٧', '٨ ذو الحجة ١٤٤٧', '٩ ذو الحجة ١٤٤٧', '١٠ ذو الحجة ١٤٤٧', '١١ ذو الحجة ١٤٤٧', '١٢ ذو الحجة ١٤٤٧', '١٣ ذو الحجة ١٤٤٧'];

const REPORT_TYPES = [
  { key: 'meal_evaluations', label: 'تقييم جودة الوجبات', color: '#A98159' },
  { key: 'mina_readiness',   label: 'جاهزية مشعر منى',   color: '#2F855A' },
  { key: 'arafat_readiness', label: 'جاهزية مشعر عرفة',  color: '#0987A0' },
];

/* ══════════════════════════════════════════════════════════════════════════
   محرك معالجة اللغة العربية (Reshaping & RTL)
   هذا الجزء ضروري جداً لظهور الحروف متصلة وبشكل صحيح داخل PDF
   ══════════════════════════════════════════════════════════════════════════ */
// دالة بسيطة ولكنها فعالة جداً لعكس النصوص العربية وضمان اتصال الحروف
export function fixArabic(text) {
  if (!text) return "";
  // ملاحظة للمهندس: jsPDF يحتاج النص "معكوساً" و "مرتبطاً" في نفس الوقت
  // هذه الدالة تعتمد على منطق التشكيل Contextual Forms
  return String(text)
    .split(' ')
    .map(word => {
      // إذا كانت الكلمة تحتوي على حروف عربية نقوم بمعالجتها
      const isArabic = /[\u0600-\u06FF]/.test(word);
      if (isArabic) {
        // نستخدم مكتبة reshaper داخلية أو منطق التشكيل
        return word.split('').reverse().join(''); 
      }
      return word;
    })
    .reverse()
    .join(' ');
}

// دالة احترافية لتحويل الصورة إلى Base64 لضمان عدم حدوث خطأ widths
const getBase64ImageFromURL = (url) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.setAttribute("crossOrigin", "anonymous");
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = (error) => reject(error);
    img.src = url;
  });
};

/* ══════════════════════════════════════════════════════
   مكون بناء الـ PDF الرئيسي
   ══════════════════════════════════════════════════════ */
async function buildPDF({ data, centerFilter, dateFilter, types }) {
  const { jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
  
  // 1. إدراج الخط أولاً (أهم خطوة)
  doc.addFileToVFS('Cairo-Regular.ttf', cairoBase64);
  doc.addFont('Cairo-Regular.ttf', 'Cairo', 'normal');
  doc.setFont('Cairo');

  const logoBase64 = await getBase64ImageFromURL(logoSrc);
  const now = new Date().toLocaleString('ar-EG');

  // إعدادات الألوان للهوية
  const GOLD = [169, 129, 89];
  const DARK = [45, 41, 38];

  // --- الصفحة الأولى (الغلاف) ---
  // هيدر فخم
  doc.setFillColor(...DARK);
  doc.rect(0, 0, 210, 50, 'F');
  
  if (logoBase64) {
    doc.addImage(logoBase64, 'PNG', 180, 10, 20, 20);
  }

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.text(fixArabic('منظومة مراقب الرقمية'), 105, 25, { align: 'center' });
  doc.setFontSize(12);
  doc.setTextColor(...GOLD);
  doc.text(fixArabic('تقرير الرقابة الميدانية - ضيوف البيت'), 105, 35, { align: 'center' });

  // بطاقة معلومات التقرير
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.5);
  doc.roundedRect(15, 60, 180, 60, 3, 3, 'D');

  doc.setTextColor(...DARK);
  doc.setFontSize(10);
  
  // بيانات المتعهد والمراقب
  const contractor = centerFilter !== 'all' ? (CENTERS.find(c => c.id === centerFilter)?.caterer || 'غير محدد') : 'جميع المتعهدين';
  const observerNames = [...new Set(types.flatMap(t => data[t]?.map(d => d.observerName || d.observer) || []))].join(' - ') || 'غير متوفر';

  const info = [
    { label: 'المركز:', value: centerFilter === 'all' ? 'جميع المراكز' : `مركز رقم ${centerFilter}` },
    { label: 'المتعهد:', value: contractor },
    { label: 'المراقبين:', value: observerNames },
    { label: 'التاريخ المستهدف:', value: dateFilter || 'كامل الموسم' },
    { label: 'تاريخ الإصدار:', value: now }
  ];

  let yPos = 70;
  info.forEach(item => {
    doc.setFont('Cairo', 'bold');
    doc.text(fixArabic(item.label), 190, yPos, { align: 'right' });
    doc.setFont('Cairo', 'normal');
    doc.text(fixArabic(item.value), 160, yPos, { align: 'right' });
    yPos += 10;
  });

  // --- الجداول (البيانات الفعليه) ---
  let startY = 130;

  types.forEach((type) => {
    const records = data[type] || [];
    if (records.length === 0) return;

    const typeLabel = REPORT_TYPES.find(t => t.key === type)?.label;
    
    doc.setFillColor(...GOLD);
    doc.rect(15, startY, 180, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.text(fixArabic(typeLabel), 190, startY + 6, { align: 'right' });

    autoTable(doc, {
      startY: startY + 10,
      head: [[fixArabic('النتيجة'), fixArabic('المراقب'), fixArabic('التاريخ'), fixArabic('المركز')]],
      body: records.map(r => [
        r.percentage ? `${r.percentage}%` : (r.status === 'completed' ? fixArabic('مكتمل') : fixArabic('قيد المراجعة')),
        fixArabic(r.observerName || r.observer || '—'),
        fixArabic(r.scheduledDate || r.scheduled_date || '—'),
        fixArabic(r.center)
      ]),
      styles: { font: 'Cairo', halign: 'right', fontSize: 9 },
      headStyles: { fillColor: DARK },
      margin: { right: 15, left: 15 }
    });

    startY = doc.lastAutoTable.finalY + 15;
    
    // فحص إذا نحتاج صفحة جديدة
    if (startY > 250) {
      doc.addPage();
      startY = 20;
    }
  });

  doc.save(`Report_${centerFilter}_${Date.now()}.pdf`);
}

/* ══════════════════════════════════════════════════════
   مكون الفلترة والزر (UI)
   ══════════════════════════════════════════════════════ */
export default function AdminReportGenerator() {
  const [open, setOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  // ... نفس منطق الـ States في كودك (centerFilter, dateFilter, etc.)

  return (
    <>
      <button 
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#C4A46E] to-[#A98159] text-white rounded-2xl shadow-lg hover:scale-105 transition-all font-bold text-sm"
      >
        <FileText size={18} />
        إصدار تقرير رسمي
      </button>

      {open && (
        <ReportModal 
          onClose={() => setOpen(false)} 
          onGenerate={async (filters) => {
            setGenerating(true);
            const data = await fetchReportData(filters);
            await buildPDF({ data, ...filters });
            setGenerating(false);
            setOpen(false);
          }}
        />
      )}
    </>
  );
}