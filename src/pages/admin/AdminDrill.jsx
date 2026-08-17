import PageHeader from '../../components/PageHeader.jsx';
import { COLORS } from '../../config/brand.js';
import { ClipboardText, Info } from '@phosphor-icons/react';

/**
 * فرضية الوزارة — reserved, deliberately empty.
 *
 * The section exists in the sidebar before its content does, so the structure
 * the customer asked for is visible and navigable now. An empty page that says
 * so is better than a nav item that 404s or silently lands on the dashboard.
 */
export default function AdminDrill() {
  return (
    <div className="space-y-5" dir="rtl">
      <PageHeader
        Icon={ClipboardText}
        title="فرضية الوزارة"
        subtitle="تمارين المحاكاة والفرضيات الميدانية"
        gradient={{ from: COLORS.primary400, to: COLORS.primary }}
      />

      <div className="bg-white rounded-2xl border border-line p-12 text-center">
        <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center"
          style={{ background: `linear-gradient(135deg, ${COLORS.primary400}, ${COLORS.primary})` }}>
          <ClipboardText size={24} className="text-white" weight="bold" />
        </div>
        <h3 className="font-bold text-ink text-sm mb-1.5">القسم قيد التجهيز</h3>
        <p className="text-muted text-xs max-w-md mx-auto leading-relaxed">
          خُصّص هذا القسم لفرضيات الوزارة وتمارين المحاكاة الميدانية.
          سيُبنى محتواه بعد تحديد نموذج الفرضية والمعايير المطلوبة.
        </p>

        <div className="mt-6 inline-flex items-start gap-2 text-right bg-background rounded-xl border border-line px-4 py-3 max-w-md">
          <Info size={14} className="text-primary mt-0.5 flex-shrink-0" />
          <p className="text-[11px] text-muted leading-relaxed">
            التقويم في المرحلة القادمة سيحمل مواعيد الفرضيات، ويربطها بهذا القسم تلقائياً.
          </p>
        </div>
      </div>
    </div>
  );
}
