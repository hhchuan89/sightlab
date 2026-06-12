/**
 * Blocking <head> script: reads localStorage.theme (falls back to the OS
 * preference) and applies the `.dark` class BEFORE first paint, so toggling or
 * reloading never flashes the wrong theme (PLAN §4.4). Must run synchronously,
 * hence dangerouslySetInnerHTML rather than a normal client component.
 */
const script = `(function(){try{var t=localStorage.getItem("theme");var d=t?t==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;var e=document.documentElement;if(d){e.classList.add("dark")}else{e.classList.remove("dark")}e.style.colorScheme=d?"dark":"light"}catch(_){}})();`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
