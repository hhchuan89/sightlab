import type { Metadata } from "next";
import { ProtectedReader } from "@/components/paper/ProtectedReader";
import { PaperDraft } from "@/components/paper/PaperDraft";

/**
 * /paper — public methodology paper (PLAN §9, §15.7).
 *
 * Public and CACHEABLE: the content is static (no per-user data, no session),
 * so this page is a default statically-rendered route — no `force-dynamic`.
 * The <ProtectedReader> wrapper applies copy-discouragement client-side; the
 * honest screenshot caveat and the deliberate absence of proprietary numbers
 * are the real boundary (§9, §14-C10).
 */
export const metadata: Metadata = {
  title: "Methodology",
  description:
    "How SightLab reads the cycle: §6 fund-flow accumulation/distribution, §7 Weinstein staging + the 30-week SMA + sector dispersion, and the confirmer-not-predictor framing. A draft.",
};

export default function PaperPage() {
  return (
    <ProtectedReader>
      <PaperDraft />
    </ProtectedReader>
  );
}
