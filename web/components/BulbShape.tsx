/**
 * Lume's bulb: a soft, glowing orb in a bulb silhouette, drawn in a 100 × 140 box.
 * No hard outlines; the glass edge is feathered with a little noise so it reads as
 * light rather than an icon. Used by the splash, the theme toggle and the mascot.
 *
 * Both states are always drawn. `.rb-on` layers (lit orb and bloom) sit over the
 * unlit orb and CSS fades them in, so callers switch it with a class.
 * `id` must be unique on the page; it namespaces the gradients and filters.
 */
export const ORB = "M50 11 C71 11 88 28 88 49 C88 63 81 73 72 81 C67 85.5 64 89.5 63.5 97 L36.5 97 C36 89.5 33 85.5 28 81 C19 73 12 63 12 49 C12 28 29 11 50 11 Z";

/**
 * `small` is for icon sizes (the theme toggle): the noisy edge turns ragged when tiny,
 * so it gets a smooth feathered edge and a tight halo instead.
 */
export function BulbShape({ id, glow = true, small = false }: { id: string; glow?: boolean; small?: boolean }) {
  const edge = small ? `url(#${id}-feather)` : `url(#${id}-soft)`;
  return (
    <g>
      <defs>
        <radialGradient id={`${id}-off`} cx="0.42" cy="0.36" r="0.7">
          <stop offset="0" stopColor="var(--orb-off-1)" />
          <stop offset="0.7" stopColor="var(--orb-off-2)" />
          <stop offset="1" stopColor="var(--orb-off-3)" />
        </radialGradient>
        <radialGradient id={`${id}-on`} cx="0.44" cy="0.36" r="0.72">
          <stop offset="0" stopColor="#FFF6CF" />
          <stop offset="0.3" stopColor="#FFD86B" />
          <stop offset="0.68" stopColor="#FFB02E" />
          <stop offset="1" stopColor="#F28A12" />
        </radialGradient>
        <radialGradient id={`${id}-bloom`}>
          <stop offset="0" stopColor="#FFC94D" stopOpacity="0.75" />
          <stop offset="0.45" stopColor="#FFB02E" stopOpacity="0.28" />
          <stop offset="1" stopColor="#FFB02E" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-cap`} x1="0" x2="1">
          <stop offset="0" stopColor="var(--orb-cap-2)" />
          <stop offset="0.45" stopColor="var(--orb-cap-1)" />
          <stop offset="1" stopColor="var(--orb-cap-2)" />
        </linearGradient>
        {/* Feathered edge: a little fractal noise nudges the outline, then a soft blur. */}
        <filter id={`${id}-soft`} x="-15%" y="-15%" width="130%" height="130%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="3.2" xChannelSelector="R" yChannelSelector="G" result="fuzz" />
          <feGaussianBlur in="fuzz" stdDeviation="0.55" />
        </filter>
        <filter id={`${id}-feather`} x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="0.9" />
        </filter>
        <radialGradient id={`${id}-halo`} cx="50" cy="49" r="50" gradientUnits="userSpaceOnUse">
          <stop offset="0.6" stopColor="#FFC94D" stopOpacity="0.55" />
          <stop offset="1" stopColor="#FFC94D" stopOpacity="0" />
        </radialGradient>
        <filter id={`${id}-smooth`}>
          <feGaussianBlur stdDeviation="0.35" />
        </filter>
        <filter id={`${id}-haze`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="3.5" />
        </filter>
      </defs>

      {glow && <circle className="rb-on rb-glow" cx="50" cy="50" r="70" fill={`url(#${id}-bloom)`} />}
      {small && <circle className="rb-on" cx="50" cy="49" r="50" fill={`url(#${id}-halo)`} />}

      {/* Base: soft rounded bands, no outlines */}
      <g filter={`url(#${id}-smooth)`}>
        <rect x="36" y="95" width="28" height="9" rx="4.5" fill={`url(#${id}-cap)`} />
        <rect x="37.5" y="103" width="25" height="8" rx="4" fill={`url(#${id}-cap)`} opacity="0.92" />
        <rect x="39.5" y="110" width="21" height="7" rx="3.5" fill={`url(#${id}-cap)`} opacity="0.85" />
        <rect x="44" y="116" width="12" height="6" rx="3" fill="var(--orb-cap-2)" opacity="0.9" />
      </g>

      {/* Unlit orb */}
      <path d={ORB} fill={`url(#${id}-off)`} filter={edge} />

      {/* Lit orb: warm haze behind, bright body, hot core */}
      <g className="rb-on">
        <path d={ORB} fill="#FFB02E" opacity="0.55" filter={`url(#${id}-haze)`} />
        <path d={ORB} fill={`url(#${id}-on)`} filter={edge} />
        <ellipse cx="50" cy="56" rx="17" ry="15" fill="#FFF8DC" opacity="0.45" filter={`url(#${id}-haze)`} />
      </g>

      {/* A soft sheen, like light on frosted glass */}
      <ellipse cx="35" cy="30" rx="10" ry="6.5" transform="rotate(-35 35 30)" fill="#FFFFFF" opacity="0.38" filter={`url(#${id}-haze)`} />
    </g>
  );
}
