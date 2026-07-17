import React, { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';

/**
 * Phase F legacy-report retirement banner. Shown on financial views that still
 * source totals from calculated_cost / shifts.total_amount_jod / client-side
 * aggregation rather than the authoritative Reporting v2 RPCs. Gated by
 * legacy_report_retirement_enabled so it can be toggled off during soak.
 * See docs/PHASE_F_LEGACY_REPORT_RETIREMENT_MATRIX.md.
 */
export async function isLegacyReportRetirementEnabled(): Promise<boolean> {
  const { data } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'legacy_report_retirement_enabled')
    .maybeSingle();
  return (data?.value ?? 'false') === 'true';
}

interface LegacyReportBannerProps {
  onGoToReportingV2?: () => void;
}

export const LegacyReportBanner: React.FC<LegacyReportBannerProps> = ({ onGoToReportingV2 }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    isLegacyReportRetirementEnabled().then(setVisible).catch(() => setVisible(false));
  }, []);

  if (!visible) return null;

  return (
    <div className="mb-4 flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900">
      <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-500" />
      <div className="flex-1 text-sm">
        <p className="font-semibold">Legacy / Operational Only</p>
        <p>
          Financial totals on this screen are for day-to-day operations only and are not the
          reconciled figures of record. For authoritative revenue, payment, and handover
          totals, use Reporting v2.
        </p>
      </div>
      {onGoToReportingV2 && (
        <button
          onClick={onGoToReportingV2}
          className="whitespace-nowrap rounded-md border border-amber-400 bg-white px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100"
        >
          Open Reporting v2
        </button>
      )}
    </div>
  );
};

export default LegacyReportBanner;
