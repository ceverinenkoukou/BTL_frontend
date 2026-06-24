"use client";

import type { ReactNode } from "react";
import { contrastColor } from "@/lib/utils/branding";

// Palette MHédia par défaut — utilisée quand aucune couleur de marque client n'est fournie.
const MHEDIA_PRIMARY = "#00C9D4";
const MHEDIA_SECONDARY = "#0099A8";

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  ctaSlot?: ReactNode;
  /** Couleur de marque client — fournie uniquement sur les pages contextuelles à une entreprise/campagne. */
  brandColor?: string | null;
  brandSecondary?: string | null;
  logoUrl?: string | null;
}

export function PageHeader({
  title,
  description,
  icon,
  ctaSlot,
  brandColor,
  brandSecondary,
  logoUrl,
}: PageHeaderProps) {
  const primary = brandColor || MHEDIA_PRIMARY;
  const secondary = brandSecondary || MHEDIA_SECONDARY;
  const textColor = contrastColor(primary);
  const useWhiteOverlay = textColor === "#ffffff";

  return (
    <div
      className="relative overflow-hidden rounded-2xl p-6 md:p-7 shadow-lg"
      style={{
        background: `linear-gradient(135deg, ${primary} 0%, ${secondary} 100%)`,
        color: textColor,
      }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.15),transparent_60%)]" />
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          {logoUrl ? (
            <div className="w-12 h-12 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center shrink-0 overflow-hidden backdrop-blur-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoUrl} alt="" className="w-full h-full object-contain p-1.5" />
            </div>
          ) : icon ? (
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
              style={{ background: useWhiteOverlay ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.08)" }}
            >
              {icon}
            </div>
          ) : null}
          <div className="min-w-0">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight truncate">{title}</h1>
            {description && (
              <p className="mt-1 text-sm" style={{ opacity: 0.75 }}>{description}</p>
            )}
          </div>
        </div>
        {ctaSlot && <div className="shrink-0">{ctaSlot}</div>}
      </div>
    </div>
  );
}
