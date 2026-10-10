import Image from "next/image";

const WORD_SIZE = {
  sm: "text-base",
  md: "text-lg",
  lg: "text-xl",
  xl: "text-2xl",
} as const;

/** Mark heights; the mark (bulb and halo) is 100 × 125, so widths follow. */
const MARK_HEIGHT = { sm: 28, md: 32, lg: 36, xl: 46 } as const;

/** The Lume wordmark followed by the bulb mark. Decorative: wrap it in a labelled link. */
export function LumeLogo({ size = "md", markOnly = false }: { size?: keyof typeof WORD_SIZE; markOnly?: boolean }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {!markOnly && (
        <span className={`font-display font-extrabold tracking-tight text-[var(--text-primary)] ${WORD_SIZE[size]}`}>Lume</span>
      )}
      <Image
        src="/lume-mark.svg"
        alt=""
        width={Math.round((MARK_HEIGHT[size] * 100) / 125)}
        height={MARK_HEIGHT[size]}
        priority
      />
    </span>
  );
}
