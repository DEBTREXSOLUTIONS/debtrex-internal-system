export default function DebtrexBanner({ subtitle }: { subtitle?: string }) {
  return (
    <div className="relative overflow-hidden rounded-lg mb-4 bg-gradient-to-r from-brand-ink via-brand-blue-dark to-brand-blue shadow-sm">
      <div
        className="absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 15% 80%, white 1px, transparent 1px), radial-gradient(circle at 85% 20%, white 1px, transparent 1px)',
          backgroundSize: '34px 34px',
        }}
      />
      <div className="relative flex items-center gap-4 px-5 sm:px-7 py-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/debtrex-icon.svg"
          alt="DEBTREX Solutions"
          className="w-14 h-14 sm:w-16 sm:h-16 flex-shrink-0 drop-shadow-md"
        />
        <div className="min-w-0">
          <div className="font-condensed font-black leading-none tracking-tight text-white">
            <span className="text-2xl sm:text-3xl">
              DEBT<span className="text-brand-blue-light">REX</span>
            </span>
            <span className="ml-2 align-middle text-xs sm:text-sm font-bold tracking-[0.3em] text-white/70">
              SOLUTIONS
            </span>
          </div>
          <div className="mt-1.5 text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.22em] text-brand-blue-light/90">
            Relife &middot; Freedom &middot; A Fresh Start
          </div>
        </div>
        {subtitle && (
          <div className="ml-auto hidden sm:block text-right flex-shrink-0">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">
              Customer Relations
            </div>
            <div className="font-condensed text-xl font-black uppercase text-white leading-tight">
              {subtitle}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
