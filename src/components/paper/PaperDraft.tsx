/**
 * SightLab methodology paper — DRAFT (PLAN §9, §15.4, §15.7).
 *
 * Public, half-open methodology write-up. It explains the METHOD — the intuition
 * behind §6 fund-flow accumulation/distribution and §7 Weinstein staging + the
 * 30-week SMA + sector dispersion — and the "confirmer, not predictor" framing,
 * with its limitations stated up front.
 *
 * 🔒 DELIBERATELY ABSENT (PLAN §9, §15.4 LOCKED):
 *   • NO proprietary thresholds, weights, or exact layer formulas. We describe
 *     WHAT each signal measures and WHY, never the numbers that make it copyable.
 *   • NO holdings / portfolio content of any kind. Everything here is market-wide.
 *
 * Rendered inside <ProtectedReader>. English is the primary language.
 */

function Tag({ children }: { children: React.ReactNode }) {
  return <span className="article-tag">{`// ${children}`}</span>;
}

export function PaperDraft() {
  return (
    <article className="paper-prose prose-measure mx-auto px-5 pb-24">
      {/* ── masthead ── */}
      <div className="flex items-baseline justify-between gap-4 pt-10">
        <Tag>METHODOLOGY · DRAFT</Tag>
        <span className="label-mono text-muted">v0 · for review</span>
      </div>
      <hr className="rule-ink mt-3" />

      <h1 className="mt-8 text-4xl font-semibold text-text">How SightLab reads the cycle</h1>
      <p className="editorial-quote mt-5 text-xl">
        A working note on what the daily dispatch measures, why it measures it that way, and — just
        as important — what it cannot tell you. This is a draft, circulated for review.
      </p>

      <p className="mt-6 font-body text-base leading-relaxed text-text">
        SightLab publishes one market-wide read each day, built from two complementary lenses: where
        money is flowing across sectors (Section&nbsp;6, &ldquo;fund flows&rdquo;), and where the
        broad market sits in its cycle (Section&nbsp;7, &ldquo;cycle positioning&rdquo;). Neither
        lens is a crystal ball. Both are designed to do something narrower and more honest: confirm
        the regime the tape is already in, so you are not surprised by it. This note explains the
        intuition behind each lens and the single framing that governs how we read both.
      </p>

      {/* ── §6 ── */}
      <h2 className="mt-12 text-2xl font-semibold text-text">
        Section 6 — fund flows: accumulation vs. distribution
      </h2>
      <p className="mt-4 font-body text-base leading-relaxed text-text">
        The oldest idea in tape reading is that price and volume tell different parts of the same
        story. Price tells you where the market settled; volume tells you how much conviction it
        took to get there. When the two agree, a move is well-supported. When they disagree, the
        move is suspect. Section&nbsp;6 is a structured way of asking that question across every
        major sector at once.
      </p>
      <p className="mt-4 font-body text-base leading-relaxed text-text">
        We borrow two terms from classical Wyckoff-style analysis. <strong>Accumulation</strong>{" "}
        describes a phase where a sector is being bought persistently — often quietly, on rising
        volume into strength and lighter volume into weakness — as if larger hands are building
        positions and absorbing supply. <strong>Distribution</strong> is the mirror image: a sector
        being sold into, where rallies are met with supply and strength fails to hold, as if
        positions are being handed off. The labels are intuitions about who is in control of the
        tape, not predictions about tomorrow&rsquo;s close.
      </p>
      <p className="mt-4 font-body text-base leading-relaxed text-text">
        For each sector we look at the recent return alongside the behaviour of volume and turnover
        — is the money confirming the price move, or fading it? A sector that climbs on expanding
        participation reads as accumulation; one that drifts up on thinning volume, or slips while
        volume builds, reads as distribution. We summarise that into a direction (accumulation,
        distribution, or neutral) and a short, plain-language reading per sector. The point of the
        table is comparative: it is far more useful to see that technology is being accumulated{" "}
        <em>while</em> energy is being distributed than to stare at either in isolation. Rotation —
        money leaving one lane and entering another — is the signal that survives noise.
      </p>
      <p className="mt-4 font-body text-base leading-relaxed text-text">
        Two honest caveats belong right here. First, flow signals are descriptive, not causal: a
        sector can be under accumulation and still fall, because accumulation describes pressure,
        not a guarantee. Second, the labels lag — by the time a clean distribution signal forms, the
        easy part of the down-move may be behind you. That is by design. Section&nbsp;6 is built to
        tell you what is happening, not to front-run it.
      </p>

      {/* ── §7 ── */}
      <h2 className="mt-12 text-2xl font-semibold text-text">
        Section 7 — cycle positioning: Weinstein stages
      </h2>
      <p className="mt-4 font-body text-base leading-relaxed text-text">
        Section&nbsp;7 asks a different question: forget the day-to-day — where are we in the larger
        arc? For that we lean on Stan Weinstein&rsquo;s stage framework, one of the most durable
        mental models in trend analysis precisely because it is simple and visual.
      </p>
      <p className="mt-4 font-body text-base leading-relaxed text-text">
        Weinstein divides any instrument&rsquo;s life into four repeating stages.{" "}
        <strong>Stage&nbsp;1</strong> is a base — sideways, going nowhere, after a decline; supply
        and demand are reaching equilibrium. <strong>Stage&nbsp;2</strong> is the advance — a
        sustained uptrend where each pullback finds higher support. <strong>Stage&nbsp;3</strong> is
        the top — the trend stalls and rolls into a range, momentum fades, the easy gains are over.{" "}
        <strong>Stage&nbsp;4</strong> is the decline — a sustained downtrend, the mirror of
        Stage&nbsp;2. The cycle then returns to Stage&nbsp;1. The power of the model is that it
        forces a single question with a finite set of answers: which stage is this, and is it
        confirming or changing?
      </p>
      <p className="mt-4 font-body text-base leading-relaxed text-text">
        The anchor for staging is the <strong>30-week simple moving average</strong> — the average
        closing price over roughly the last seven months. A long moving average like this strips out
        weekly chop and draws the underlying trend as a single line. The relationship between price
        and that line, and the slope of the line itself, is what separates the stages: a rising
        30-week average with price above it is the signature of a Stage&nbsp;2 advance; a flattening
        average with price chopping across it suggests a Stage&nbsp;3 top; a falling average with
        price beneath it is Stage&nbsp;4. We read this stage for each major sector and for the
        market as a whole, and we look at volume to judge whether a stage transition is being
        confirmed by participation or is just a thin, suspect move.
      </p>

      <h3 className="mt-8 text-xl font-semibold text-text">Sector dispersion</h3>
      <p className="mt-4 font-body text-base leading-relaxed text-text">
        Knowing the average stage is not enough, because an &ldquo;average&rdquo; can hide two very
        different markets. A tape where every sector is marching together in Stage&nbsp;2 is healthy
        and broad. A tape where one or two sectors are still in Stage&nbsp;2 while the rest have
        rolled into Stage&nbsp;3 or 4 is narrow and fragile, even if the headline index looks fine —
        the leadership is carrying a thinning crowd. <strong>Dispersion</strong> is our measure of
        that spread: how far apart the sectors are in their stages and their trend strength.
      </p>
      <p className="mt-4 font-body text-base leading-relaxed text-text">
        Low dispersion means broad agreement — the cycle signal is more trustworthy. High dispersion
        is a yellow flag: it means the market&rsquo;s health depends on a few names, the classic
        late-expansion narrowing that often precedes a turn. We report dispersion as a
        market-structure observation — &ldquo;leadership is concentrating&rdquo; — never as advice
        about any specific position. The judgment we attach to each sector is the same kind of
        statement: &ldquo;technology in a confirmed Stage&nbsp;2 uptrend,&rdquo; &ldquo;energy
        distributing.&rdquo; It describes the structure of the market. It is not, and will never be,
        a comment on what to do with your holdings.
      </p>

      {/* ── framing ── */}
      <h2 className="mt-12 text-2xl font-semibold text-text">
        The framing: a confirmer, not a predictor
      </h2>
      <p className="mt-4 font-body text-base leading-relaxed text-text">
        Everything above is combined into a single qualitative read: a cycle stage and a confidence
        label. The most important thing to understand about that read is what it is&nbsp;
        <em>for</em>. SightLab is a <strong>confirmer of the regime already in place</strong>, not a
        predictor of the next one. It is built to answer &ldquo;where does the tape stand
        today?&rdquo; with discipline — and to refuse the question &ldquo;where does it turn
        next?&rdquo;, because that question has no reliable answer and pretending otherwise is how
        models lose money.
      </p>
      <p className="mt-4 font-body text-base leading-relaxed text-text">
        This is also why we publish a confidence label rather than a single hard number. A
        rule-based confidence read tells you how much the signals agree with each other. When the
        flow direction, the stage, and the dispersion all point the same way, confidence is high and
        the regime is unambiguous. When they conflict — flows accumulating into a fading
        Stage&nbsp;3, say — confidence drops, and the right response is to hold your conviction more
        loosely, not to invent precision the data does not support.
      </p>

      {/* ── limitations ── */}
      <h2 className="mt-12 text-2xl font-semibold text-text">Limitations, stated up front</h2>
      <p className="mt-4 font-body text-base leading-relaxed text-text">
        A method is only trustworthy if it owns its blind spots, so here are ours, plainly.
      </p>
      <ul className="mt-4 list-disc space-y-3 pl-6 font-body text-base leading-relaxed text-text">
        <li>
          <strong>It is strongest mid-trend and blind to exact tops and bottoms.</strong> A stage
          framework anchored to a long moving average confirms a trend that is already underway. By
          construction it is late at the turn. Do not read a high-confidence Stage&nbsp;2 as
          permission to chase, nor a Stage&nbsp;4 as a guarantee of more downside.
        </li>
        <li>
          <strong>It lags.</strong> Both the flow labels and the stage read describe the recent past
          projected onto the present. They are confirmation, not anticipation. If you need to be
          early, this is the wrong instrument.
        </li>
        <li>
          <strong>The numbers are deterministic; the words are interpretation.</strong> The
          measurements are computed the same way every day and do not drift with mood. But the
          plain-language reading that accompanies them is interpretation, and interpretation can be
          wrong, even when the underlying numbers are correct.
        </li>
        <li>
          <strong>It is market-wide only.</strong> SightLab reads sectors and the broad market. It
          says nothing about any individual security and nothing whatsoever about your portfolio.
          That is a deliberate boundary, not an omission.
        </li>
        <li>
          <strong>It is research, not investment advice.</strong> Nothing here is a recommendation
          to buy, sell, or hold anything. Size your own risk.
        </li>
      </ul>

      {/* ── honest screenshot caveat (§9 / §14-C10) ── */}
      <h2 className="mt-12 text-2xl font-semibold text-text">A note on this page</h2>
      <p className="mt-4 font-body text-base leading-relaxed text-text">
        This reader discourages casual copying — selection, right-click, and drag are disabled. We
        want to be honest about what that is: <strong>discouragement, not protection.</strong> A
        screenshot defeats it in a second, and we have not tried to stop screenshots, because the
        techniques that attempt to (blanking the page on print, fighting the browser) only punish
        honest readers and stop no one. The real reason this page is safe to publish is simpler: the{" "}
        <strong>
          exact thresholds, weights, and layer formulas that turn these ideas into a daily number
          are not on it.
        </strong>{" "}
        What you have read is the method and the intuition — deliberately, and that is the open part
        of an open lab. SightLab is free and open-source under AGPL-3.0; the methodology is meant to
        be read, discussed, and improved.
      </p>

      <hr className="rule-hair mt-12" />
      <p className="mt-6 font-body text-md leading-relaxed text-text-2">
        Draft — circulated for review. Corrections and challenges to the reasoning are welcome (see
        CONTRIBUTING). SightLab is research, not investment advice.
      </p>
    </article>
  );
}
