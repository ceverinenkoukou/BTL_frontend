"use client";

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#105062] text-white px-6">
      <div className="flex flex-col items-center gap-6 max-w-sm text-center">
        <img
          src="/LOGO-MHEDIA-01.svg"
          alt="MHédia BTL"
          className="h-16 w-auto"
          style={{ filter: "brightness(0) invert(1)" }}
        />

        <div className="w-20 h-20 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center">
          <svg
            className="w-10 h-10 text-white/70"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
            />
          </svg>
        </div>

        <div>
          <h1 className="text-2xl font-bold tracking-tight mb-2">Hors ligne</h1>
          <p className="text-white/65 text-sm leading-relaxed">
            Vous n&apos;êtes pas connecté à internet. Vérifiez votre connexion et réessayez.
          </p>
        </div>

        <button
          onClick={() => window.location.reload()}
          className="mt-2 px-6 py-3 rounded-xl bg-[#00FFFF] text-[#105062] font-semibold text-sm hover:bg-[#00FFFF]/90 transition-colors"
        >
          Réessayer
        </button>
      </div>
    </div>
  );
}
