"use client";

import { useEffect, useRef } from "react";

/**
 * ProtectedReader (PLAN §9, §14-C10).
 *
 * A light copy-discouragement wrapper for the public methodology paper:
 *   • `user-select: none` + `draggable=false` on the subtree
 *   • prevents `copy` / `cut` / `contextmenu` / `dragstart`
 *
 * HONEST LIMITS (documented in-page, §9 / §14-C10):
 *   • This is DISCOURAGEMENT, not DRM. Screenshots cannot be blocked.
 *   • We deliberately do NOT use `@media print { body { display:none } }` — it
 *     punishes honest offline readers and stops nothing. The REAL protection is
 *     keeping proprietary thresholds / weights / formulas OFF the page entirely
 *     (see the paper draft).
 *
 * Listeners are scoped to this subtree (not `document`) so the rest of the app —
 * nav, toggles, footer — stays fully interactive.
 */
export function ProtectedReader({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const block = (e: Event) => e.preventDefault();
    const events = ["copy", "cut", "contextmenu", "dragstart"] as const;
    for (const type of events) node.addEventListener(type, block);

    return () => {
      for (const type of events) node.removeEventListener(type, block);
    };
  }, []);

  return (
    <div
      ref={ref}
      // user-select:none discourages drag-select; draggable=false stops image/text drag.
      // NOTE: no print-blocking CSS here (§14-C10) — honest readers can still print.
      style={{ userSelect: "none", WebkitUserSelect: "none" }}
      draggable={false}
      data-protected-reader
    >
      {children}
    </div>
  );
}
