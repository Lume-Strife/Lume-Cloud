import Image from "next/image";

const WORD_SIZE = {
  sm: "text-base",
  md: "text-lg",
  lg: "text-xl",
  xl: "text-2xl",
} as const;

const MARK_SIZE = { sm: 24, md: 28, lg: 32, xl: 40 } as const;

/** The Lume wordmark followed by the bulb mark. Decorative: wrap it in a labelled link. */
export function LumeLogo({ size = "md", markOnly = false }: { size?: keyof typeof WORD_SIZE; markOnly?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {!markOnly && (
        <span className={`font-display font-extrabold tracking-tight text-[var(--text-primary)] ${WORD_SIZE[size]}`}>Lume</span>
      )}
      <Image src="/lume-mark.svg" alt="" width={MARK_SIZE[size]} height={MARK_SIZE[size]} priority />
    </span>
  );
}
