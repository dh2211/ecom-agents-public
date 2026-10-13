# Builder Release Checklist

## Source data

- [ ] Schema is `3.2`, or schema `3.1`/`3.0`/legacy `2.0` was migrated and the generated scaffolds were reviewed.
- [ ] `niche_slug` is explicit ASCII hyphen-case; `niche_display` preserves native text.
- [ ] Scope-derived minima fit the niche; broad-niche counts are not manufactured for a focused niche.
- [ ] Structured duplicate personas and near-identical style-axis signatures are absent.
- [ ] Evidence status, legal status, and sensitivity behavior remain separate.
- [ ] Every source has an ID; every evidence and market-context reference resolves.
- [ ] `review_by` dates are current or stale claims are explicitly downgraded to hypotheses.
- [ ] Market contexts record locale, region, units, restricted claims, output notes, and review date.
- [ ] Every product binds exactly one production method and one output profile.
- [ ] Production methods include positive numeric stroke, gap, and text-height limits plus color, substrate, ink, template, and uncertainty fields.
- [ ] Idea archetypes, creative variation axes, anti-generic phrases, combination rules, and sensitivity rules validate.
- [ ] Dates, HEX colors, numbers, booleans, IDs, and arrays pass strict validation.
- [ ] Every semantic foreign key resolves.
- [ ] Output profiles contain their assigned products.
- [ ] Sample copy modes, products, production methods, output profiles, surfaces, and personalization are consistent.
- [ ] Transparency fields use the mandatory capability-gated values.

## Executable target behavior

- [ ] Target uses progressive loading and record selection.
- [ ] Combined always-loaded references are at most 7,000 bytes.
- [ ] `resolve_design_brief.py` emits a binding receipt for a valid request.
- [ ] Receipt includes data/request hashes and closes market, buyer system, archetype, product, method, profile, copy, sensitivity, variants, and alpha policy.
- [ ] Unknown IDs, method/profile mismatches, anti-generic phrases, and forbidden combinations fail closed.
- [ ] `refuse`, `constrain`, and `human-review` sensitivity actions change behavior.
- [ ] Variants differ on at least the configured creative axes.
- [ ] Concept fit remains a 25-point heuristic with confidence and evidence basis.
- [ ] IP remains a separate blocking gate, not a legal score.
- [ ] Copy supports `exact`, `proposed`, and `none`.
- [ ] Marketplace dimensions and provider constraints are not invented.

## Transparency, background, and contrast

- [ ] Final production output is a materialized transparent PNG that passes alpha QA.
- [ ] Provider, exact runtime, capability, and capability evidence appear in the receipt.
- [ ] A supported runtime uses its native transparency control when available.
- [ ] Failed supported output rerenders transparent and never switches to solid fallback.
- [ ] Exhausted supported retries hard-fail without an opaque substitute.
- [ ] Unknown runtime is probed before fallback becomes eligible.
- [ ] Fallback requires explicit unsupported evidence or exhausted failed probes.
- [ ] Temporary fallback uses only black, white, neutral gray, dark gray, or silver.
- [ ] Green chroma key, neon, gradients, texture, shadow, glow, haze, lighting, vignette, and fake transparency are prohibited.
- [ ] Fallback is selected after the artwork palette by maximum color distance.
- [ ] Prompt contains `MANDATORY FLAT SOLID COLOR. NO SHADOWS.`
- [ ] Removal operates only on edge-connected background pixels.
- [ ] Post-removal result passes the same strict alpha QA.
- [ ] Alpha QA rejects opacity, empty transparency, edge-touching artwork, and inset background panels.
- [ ] Foreground contrast is evaluated against the actual product surface.
- [ ] UI preview appearance is never used as alpha evidence.

## Files and code

- [ ] Six target helper scripts are present and executable.
- [ ] `design-brief.schema.json` and all five new v3.2 domain/contract references are generated.
- [ ] `transparency-capability-policy.md` is generated.
- [ ] Manifest identifies builder, schema, niche, data hash, timestamp, and every content hash.
- [ ] Full unit suite passes.
- [ ] Broad teacher and focused pet-memorial goldens pass validation and generation.
- [ ] Pet-memorial negative case proves sensitivity refusal.
- [ ] Special characters such as `Teacher: Pro` do not break frontmatter.
- [ ] Failed builds preserve the previous target.
- [ ] Replacement refuses folders without a matching manifest.
- [ ] State-machine tests prove `supported` can never return solid fallback.
- [ ] Alpha tests reject opaque, empty, edge-touching, and panel-like outputs and accept a valid alpha design.

## Package

- [ ] `skill.zip` contains exactly one root.
- [ ] `SKILL.md`, `agents/openai.yaml`, and `manifest.json` are present.
- [ ] No `__pycache__`, `.pyc`, `.DS_Store`, temporary, backup, or unsafe path is included.
- [ ] Manifest hashes match every packaged non-manifest file.
- [ ] A modified target file causes packaging to fail.
- [ ] Two builds with identical input and `SOURCE_DATE_EPOCH` are byte-identical.
- [ ] ZIP CRC passes.
- [ ] Archive is at most 25 MiB.
- [ ] Output filename is exactly `skill.zip`.
