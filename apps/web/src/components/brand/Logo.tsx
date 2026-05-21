/**
 * Roya brand logo.
 *
 * Renders the Roya mark — a rounded-square tile carrying the Roya-Blue
 * gradient (the brand guide's `--gradient-brand`) — optionally beside the
 * "رؤية" wordmark. The gradient tile stays constant across light/dark
 * themes (per the brand guide: the mark's background does not change with
 * the theme).
 *
 * NOTE: this is a clean, on-identity placeholder mark. When the official
 * icon PNG package (`roya-logo-original.png` + `logo-png/16→1024`) is
 * available, drop `roya-icon.png` into `/public/brand/` and pass
 * `src="/brand/roya-icon.png"` to render the official artwork instead of
 * the gradient tile — the layout/sizing here already accommodates it.
 */

import Image from 'next/image';

interface LogoProps {
  /** Tile size in px. Default 40. */
  size?: number;
  /** Show the "رؤية" wordmark beside the mark. Default true. */
  withWordmark?: boolean;
  /** Optional path to the official icon PNG once available. */
  src?: string;
  className?: string;
}

export function Logo({ size = 40, withWordmark = true, src, className }: LogoProps) {
  const radius = Math.round(size * 0.28);

  return (
    <div className={`flex items-center gap-3 ${className ?? ''}`} dir="rtl">
      <div
        className="relative shrink-0 overflow-hidden grid place-items-center shadow-md"
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          // The official icon already carries its own Roya-blue gradient,
          // so only paint the gradient tile for the fallback glyph.
          backgroundImage: src ? undefined : 'var(--gradient-brand)',
        }}
        aria-hidden={withWordmark}
      >
        {src ? (
          <Image
            src={src}
            alt="رؤية"
            width={size}
            height={size}
            priority
            className="w-full h-full object-cover"
          />
        ) : (
          // Gradient tile + subtle "ر" glyph until the official PNG lands.
          <span
            className="font-bold text-white/95 leading-none select-none"
            style={{ fontSize: Math.round(size * 0.5) }}
          >
            ر
          </span>
        )}
      </div>
      {withWordmark && (
        <div className="leading-tight">
          <span className="block text-lg font-bold text-fg" style={{ color: 'var(--color-text-primary)' }}>
            رؤية
          </span>
          <span className="block text-[10px] tracking-[0.3em] text-gray-500">ROYA</span>
        </div>
      )}
    </div>
  );
}
