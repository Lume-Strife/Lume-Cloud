export const SPLASH_KEY = "lume-splash-seen";

/** Runs before first paint so a repeat visit in the same tab never flashes the splash. */
export const SPLASH_GUARD = `try{if(sessionStorage.getItem("${SPLASH_KEY}")==="1")document.documentElement.dataset.splash="seen"}catch(e){}`;
