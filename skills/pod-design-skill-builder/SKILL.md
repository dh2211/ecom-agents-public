---
name: pod-design-skill-builder
description: Create, migrate, validate, safely regenerate, and package niche-specific print-on-demand design-agent skills from structured master data. Use when a user asks for a reusable POD artwork skill, niche design workflow, product-aware image-generation agent, reference-image redesign agent, or validated skill package for occupations, hobbies, recipients, occasions, memorial gifts, or communities. Generate target skills that require verified transparent PNG output whenever the active image runtime supports alpha, rerender on alpha-QA failure without downgrading supported runtimes, and use a removable safe solid canvas only after transparency is proven unavailable. Do not use for a one-off artwork request.
---

# POD Design Skill Builder

Build one reusable POD design agent for one clearly bounded niche. Create the target skill; do not create the user's final artwork from this builder.

## Inputs and deliverables

Require:

- an explicit lowercase ASCII `niche_slug`;
- a human-readable `niche_display` in the master data;
- schema 3.2 JSON, schema 3.1/3.0 JSON that can be migrated, or legacy schema 2.0 JSON that can be migrated;
- optional user evidence, sources, assets, marketplace templates, and proprietary rules.

Produce:

- a complete target skill folder;
- a validated `skill.zip` when requested;
- normalized schema 3.2 JSON when migration or review is useful;
- validation errors and warnings separated clearly.

## Load references progressively

- Read `references/master-data-authoring-guide.md` before creating or revising niche data.
- Read `references/niche-data-schema.md` while authoring or diagnosing schema errors.
- Consult `references/niche-data.schema.json` for machine-readable structure.
- Read `references/transparency-capability-policy.md` before changing transparency, retry, fallback, or alpha-QA behavior.
- Read `references/background-and-contrast.md` before changing generation-canvas or product-color rules.
- Read `references/target-skill-blueprint.md` before generating a target.
- Read `references/teacher-example-data.json` only when a complete example is useful.
- Read `references/pet-memorial-example-data.json` when validating a focused, grief-sensitive niche rather than a broad occupation.
- Read `references/generation-checklist.md` before packaging.

Use `scripts/create_pod_design_skill.py` after the master data is ready.

## Workflow

1. Define the niche boundary.
   - Require or derive a lowercase ASCII slug such as `giao-vien` separately from display text such as `Giáo viên`.
   - Identify audience, buyers, recipients, marketplaces, locale, and excluded adjacent segments.
   - Ask only when ambiguity changes the buyer, recipient, protected reference, product, or required proprietary evidence.

2. Build or migrate the master data.
   - Follow schema version `3.2`.
   - Migrate schema `3.1`, `3.0`, or `2.0` through the supplied normalizer before validation.
   - Use user evidence first.
   - Use fresh research only when the user requests market-backed data and research tools are available.
   - Otherwise mark `evidence_status` as `curated-draft` and never imply live demand validation.
   - Keep `legal_status` separate from evidence and schema status.
   - Add source IDs, market contexts, claim-level evidence links, and `review_by` dates; stale claims remain hypotheses.
   - Bind every product to exactly one production method with numeric baseline constraints and explicit provider-template uncertainty.
   - Add idea archetypes, executable variation axes, anti-generic phrases, combination rules, and sensitivity actions.
   - Make every record niche-specific; reject generic filler.

3. Validate before generation.

```bash
python3 scripts/create_pod_design_skill.py \
  --niche-slug <niche-slug> \
  --data-json <niche-data.json> \
  --validate-only
```

   - Fix all errors.
   - Review warnings instead of silently discarding them.
   - Use `--warnings-as-errors` for strict CI.
   - Use `--write-normalized-data <path>` to save migrated schema 3.2 data.

4. Generate atomically.

```bash
python3 scripts/create_pod_design_skill.py \
  --niche-slug <niche-slug> \
  --data-json <niche-data.json> \
  --output <output-dir> \
  --zip
```

   - Let the script auto-detect the skill-creator platform validator.
   - Pass `--platform-validator <path>` when auto-detection is unavailable.
   - Use `--allow-internal-validator` only where the platform validator is genuinely unavailable.
   - Use `--replace-generated` only to replace a folder whose manifest proves this builder created it.
   - Do not use destructive directory replacement for arbitrary folders.

5. Inspect the target behavior.
   - Confirm progressive loading and exact record selection with `scripts/select_records.py`.
   - Resolve a representative request with `scripts/resolve_design_brief.py`; require a binding receipt that closes market, persona, pair, occasion, emotion, archetype, product, production method, output profile, copy, sensitivity, and alpha policy.
   - Confirm anti-generic, forbidden-combination, production mismatch, and sensitivity-refusal cases fail for the documented reason.
   - Confirm copy mode supports `exact`, `proposed`, and `none`.
   - Confirm variant count supports 1-4 and defaults to the niche setting.
   - Confirm output profile selection is product-specific and marketplace dimensions are not invented.
   - Confirm concept-fit scoring is separate from IP blockers and includes confidence plus evidence status.

6. Inspect the mandatory transparency state machine.
   - Classify the exact provider/model/interface runtime as `supported`, `unknown`, or `unsupported`; never infer support from a marketing name or `.png` extension alone.
   - Record capability evidence: native transparency control, explicit provider metadata, prior alpha-QA pass, explicit limitation, rejected transparent option, or failed probes.
   - For `supported`, set the native transparent option, request PNG, materialize the output, and run strict alpha QA.
   - If a supported-runtime output fails alpha QA, rerender transparent. Never switch that runtime to a solid canvas. Hard-fail after the configured maximum attempts.
   - For `unknown`, probe transparent output for the configured attempts. Promote it to `supported` after a pass. Only failed probes make fallback eligible.
   - For `unsupported`, use one approved flat color only as a temporary removal canvas.
   - Deliver only a transparent PNG that passes alpha QA. A solid source image is never the final POD asset.

7. Inspect product contrast independently.
   - Dark product surface -> predominantly light foreground artwork.
   - Light product surface -> predominantly dark foreground artwork.
   - Mid-tone or unknown surface -> dual-tone protection, knockout, or robust outline.
   - Never choose foreground colors solely for contrast with the temporary removal canvas.

8. Test and package.
   - Run the unit tests.
   - Generate both the broad teacher target and focused pet-memorial target as dissimilar golden-path tests.
   - Run the platform validator on the generated target.
   - With `SOURCE_DATE_EPOCH` fixed, verify repeated builds are byte-identical and every manifest content hash matches.
   - Verify the ZIP has one root, no cache files, no unsafe paths, and is at most 25 MiB.
   - Return the fully repackaged source skill as `skill.zip` for builder updates.

## Non-negotiable target behavior

Every generated target skill must:

- Use schema-validated, provenance-labeled niche data.
- Bind explicit market context, persona, buyer-recipient pair, occasion, emotion, idea archetype, product, production method, output profile, hook, and style IDs through an executable receipt.
- Enforce structured distinctness instead of manufacturing broad-niche record counts for focused niches.
- Enforce numeric production baselines, anti-generic phrases, forbidden combinations, and sensitivity actions before generation.
- Treat commercial fit as a heuristic, not a sales forecast.
- Treat IP screening as risk reduction, not legal clearance.
- Generate directly for create, design, draw, render, visualize, or redesign requests when an image tool is available.
- Use prompt-only mode only when requested or image generation is unavailable.
- Require a materialized transparent PNG with meaningful alpha as the final design asset.
- Treat native transparent controls as mandatory whenever exposed by the active runtime.
- Rerender on failed alpha QA for a supported runtime and forbid fallback on that route.
- Use the approved five-color solid palette only after explicit unsupported evidence or completed failed probes.
- Remove any temporary solid canvas and run the same final alpha QA.
- Prohibit green chroma key, neon key colors, gradients, textures, canvas shadows, glow, haze, lighting, vignette, scenes, mockups, and fake transparency.
- Match foreground luminance to the actual product color.
- Support text-free artwork without forcing placeholder text.
- Preserve broad redesign intent while replacing distinctive composition, typography, marks, characters, and decorative treatment.

## Target structure

```text
<niche>-pod-design-agent/
|-- SKILL.md
|-- manifest.json
|-- agents/
|   `-- openai.yaml
|-- scripts/
|   |-- select_records.py
|   |-- resolve_design_brief.py
|   |-- resolve_transparency_route.py
|   |-- select_background.py
|   |-- remove_flat_background.py
|   `-- verify_png_alpha.py
`-- references/
    |-- <niche>-master-data.json
    |-- master-data-index.md
    |-- personas.md
    |-- occasions-products.md
    |-- visual-system.md
    |-- copy-personalization.md
    |-- market-evidence.md
    |-- idea-archetypes.md
    |-- production-sensitivity.md
    |-- design-brief-contract.md
    |-- design-brief.schema.json
    |-- idea-engine-workflow.md
    |-- concept-fit-and-ip-gate.md
    |-- transparency-capability-policy.md
    |-- background-and-contrast.md
    |-- generation-execution.md
    |-- prompt-templates.md
    `-- qa-checklist.md
```

## Failure handling

- Stop and report all validation errors together.
- Preserve the existing target when rendering or validation fails.
- Refuse replacement when the builder manifest is absent or mismatched.
- Refuse packaging when the platform validator fails, the archive exceeds 25 MiB, the ZIP contains caches or unsafe paths, or generated content no longer matches the manifest hashes.
- Treat missing access to the materialized image file as `alpha QA unverified`; do not label the output production-ready.
- Ask for a missing reference image instead of inventing it.
- Replace risky wording, marks, characters, lyrics, or copied layouts before production.
