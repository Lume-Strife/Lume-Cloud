"use client";

import { useLayoutEffect } from "react";

/**
 * Fades in every `.reveal` element as it scrolls into view.
 * Only elements still below the fold get hidden, and only once this runs,
 * so content is never missing if JavaScript is slow or off.
 */
export function ScrollReveal() {
  useLayoutEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.classList.remove("reveal-pending");
          io.unobserve(e.target);
        }
      },
      { rootMargin: "0px 0px -10% 0px" },
    );

    for (const el of document.querySelectorAll<HTMLElement>(".reveal")) {
      if (el.getBoundingClientRect().top < window.innerHeight * 0.9) continue;
      el.classList.add("reveal-pending");
      io.observe(el);
    }
    return () => io.disconnect();
  }, []);

  return null;
}
