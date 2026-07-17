const isStaging = import.meta.env.VITE_APP_ENV === 'staging';

export function StagingBanner() {
  if (!isStaging) return null;

  return (
    <div
      role="status"
      className="sticky top-0 z-[100] w-full bg-amber-500 text-black text-center text-sm font-semibold tracking-wide py-1.5 px-3"
    >
      STAGING ENVIRONMENT — NOT FOR FINANCIAL USE
    </div>
  );
}

export function logStagingWarningOnce() {
  if (!isStaging || typeof window === 'undefined') return;
  const key = '__ev_staging_warned';
  if ((window as unknown as Record<string, boolean>)[key]) return;
  (window as unknown as Record<string, boolean>)[key] = true;
  console.warn(
    '[EV] STAGING ENVIRONMENT — connected to non-production Supabase. Do not use for live financial decisions.'
  );
}
