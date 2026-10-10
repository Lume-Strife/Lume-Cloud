export type Theme = "light" | "dark";

export const THEME_KEY = "lume-theme";
export const THEME_EVENT = "lume-theme-change";

/** Runs before first paint so a saved dark theme never flashes light. Light is the default. */
export const THEME_GUARD = `try{if(localStorage.getItem("${THEME_KEY}")==="dark")document.documentElement.dataset.theme="dark"}catch(e){}`;
