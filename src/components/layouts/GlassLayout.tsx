import { ReactNode, useEffect, useState } from 'react';
import { PoweredByZenno } from '../PoweredByZenno';
import { useTenant } from '../../lib/tenantContext';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../lib/themeContext';
import { withAlpha } from '../../lib/color';

interface GlassLayoutProps {
  children: ReactNode;
  imageUrl?: string;
  imageMobile?: string;
  imageTablet?: string;
  imageDesktop?: string;
  imageAlt?: string;
}

/**
 * Glassmorphism booking layout: the step photo fills the screen (softly blurred and
 * tinted with the shop's background colour) and the booking flow sits on one
 * frosted panel. Only the panel uses backdrop-filter; nested cards get a flat,
 * translucent treatment via the `.booking-glass` rules in index.css, so the page
 * stays smooth on older phones.
 */
export default function GlassLayout({
  children,
  imageUrl,
  imageMobile,
  imageTablet,
  imageDesktop,
  imageAlt = 'Business',
}: GlassLayoutProps) {
  const { businessId, businessName } = useTenant();
  const { colors } = useTheme();
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  const primary = colors.primary || '#1A1714';
  const secondary = colors.secondary || '#A09990';
  const canvas = colors.background || '#F7F5F2';
  const hasImage = Boolean(imageUrl || imageMobile || imageTablet || imageDesktop);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoaded(true), 60);
    if (!businessId) return () => clearTimeout(timer);

    supabase
      .from('businesses')
      .select('custom_logo_url')
      .eq('id', businessId)
      .maybeSingle()
      .then(({ data }) => {
        const url = (data as { custom_logo_url?: string | null } | null)?.custom_logo_url;
        // The platform default logo is not the shop's brand, so it is not shown here.
        setLogoUrl(url && !url.includes('buuklogo') && !url.includes('zenno-logo') ? url : null);
      });

    return () => clearTimeout(timer);
  }, [businessId]);

  return (
    <div className="booking-glass relative min-h-screen overflow-hidden" style={{ backgroundColor: canvas }}>
      {/* Backdrop: photo or brand aurora */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        {hasImage ? (
          <picture>
            {imageMobile && <source media="(max-width: 639px)" srcSet={imageMobile} />}
            {imageTablet && <source media="(min-width: 640px) and (max-width: 1023px)" srcSet={imageTablet} />}
            {imageDesktop && <source media="(min-width: 1024px)" srcSet={imageDesktop} />}
            <img
              src={imageDesktop || imageTablet || imageMobile || imageUrl}
              alt={imageAlt}
              className={`h-full w-full scale-110 object-cover transition-opacity duration-700 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
              style={{ filter: 'blur(6px) saturate(115%)' }}
            />
          </picture>
        ) : (
          <div
            className="h-full w-full"
            style={{
              background: `
                radial-gradient(60% 50% at 15% 20%, ${withAlpha(primary, 0.28)} 0%, transparent 70%),
                radial-gradient(50% 45% at 85% 15%, ${withAlpha(secondary, 0.35)} 0%, transparent 70%),
                radial-gradient(55% 60% at 70% 90%, ${withAlpha(primary, 0.18)} 0%, transparent 70%),
                radial-gradient(45% 50% at 10% 85%, ${withAlpha(secondary, 0.25)} 0%, transparent 70%)
              `,
            }}
          />
        )}
        {/* Tint keeps text contrast predictable over any photo */}
        <div
          className="absolute inset-0"
          style={{ background: `linear-gradient(160deg, ${withAlpha(canvas, 0.35)} 0%, ${withAlpha(canvas, 0.15)} 45%, ${withAlpha(primary, 0.25)} 100%)` }}
        />
      </div>

      {/* Frosted panel */}
      <main className="relative z-10 flex min-h-screen items-start justify-center px-3 py-4 sm:items-center sm:px-6 sm:py-10">
        <div
          className={`booking-glass-panel flex max-h-[calc(100dvh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-[28px] sm:max-h-[min(880px,calc(100dvh-5rem))] transition-all duration-700 ease-out ${
            isLoaded ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'
          }`}
          style={
            {
              '--glass-fill': withAlpha(canvas, 0.8),
              '--glass-fill-solid': withAlpha(canvas, 0.96),
              '--glass-card': withAlpha('#FFFFFF', 0.5),
              '--glass-edge': withAlpha('#FFFFFF', 0.55),
              boxShadow: `0 30px 80px -20px ${withAlpha(primary, 0.35)}, inset 0 1px 0 ${withAlpha('#FFFFFF', 0.6)}`,

            } as React.CSSProperties
          }
        >
          {(logoUrl || businessName) && (
            <header className="flex flex-shrink-0 items-center gap-3 px-6 pt-6 sm:px-10 sm:pt-8">
              {logoUrl ? (
                <img src={logoUrl} alt={businessName || imageAlt} className="h-10 w-auto max-w-[180px] object-contain sm:h-12" />
              ) : (
                <span className="text-lg font-semibold tracking-tight" style={{ color: colors.textPrimary }}>
                  {businessName}
                </span>
              )}
            </header>
          )}
          <div className="booking-glass-content flex min-h-0 flex-1 flex-col overflow-y-auto px-6 pb-6 pt-5 sm:px-10 sm:pb-10 sm:pt-6">{children}</div>
        </div>
      </main>
      <PoweredByZenno />
    </div>
  );
}
