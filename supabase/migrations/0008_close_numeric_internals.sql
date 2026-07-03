-- 0008_close_numeric_internals.sql — strip closed-formula numeric internals
-- from the PUBLIC projection (decision 2026-07-03, deep-review §三-A).
--
-- WHY: content is public (v3, PLAN §15.1) but the composite FORMULA is closed
-- (iron rule ③ — no weights, no thresholds, no raw score). The projection was
-- shipping numbers the UI never renders: the raw composite score + precise
-- variant, per-layer totals, the valuation-layer score, the block-vote
-- rescaled score/blocks, and the leading-sleeve score/components. Those are
-- information-free to a reader (dimensionless, closed scale) but a DAILY
-- CALIBRATION POINT for reverse-engineering the closed formula via the anon
-- RPC. Qualitative reads stay public: templeton stage, cycle_stage_num,
-- confidence, the block-vote IMPLIED-STAGE label, leading tilt, regime
-- persistence, probit, yield curve, dispersion.
--
-- The DB row keeps the full payload (producer/ingest unchanged) — a future
-- tier could re-expose — so this strips at the single public choke point that
-- get_latest_public() / get_dispatch_public() / the site all read through.
-- `#-` is a no-op on absent paths, so pre-cycle_extras rows project unchanged.
create or replace function public.project_dispatch_full(d public.dispatches)
  returns jsonb
  language sql immutable as $$
  select jsonb_build_object(
    'dispatch_date', d.dispatch_date, 'generated_at', d.generated_at,
    'kind', d.kind,
    'intro_en', d.intro_en, 'intro_zh', d.intro_zh,
    'at_a_glance_en', d.at_a_glance_en, 'at_a_glance_zh', d.at_a_glance_zh,
    'cycle_badge', d.cycle_badge,
    'flows_section6', d.flows_section6,
    'cycle_section7', d.cycle_section7
      #- '{composite,composite_score}'
      #- '{composite,composite_precise}'
      #- '{composite,layer_totals}'
      #- '{composite,valuation_a_score}'
      #- '{composite,confidence_breakdown}'
      #- '{composite,contrarian_overlay,score}'
      #- '{composite,contrarian_overlay,per_layer}'
      #- '{cycle_extras,composite_blockvote,rescaled}'
      #- '{cycle_extras,composite_blockvote,blocks}'
      #- '{cycle_extras,leading_sleeve,score}'
      #- '{cycle_extras,leading_sleeve,components}',
    'deepread_section', d.deepread_section,
    'is_locked', false);
$$;
