# Target Skill Blueprint

## Purpose

Generate one niche-specific POD design agent that turns ideas, copy, personalization, and reference images into original, product-aware artwork. The target keeps canonical data machine-readable, resolves every production request into an executable binding receipt, and loads only the domain needed for the task.

## Structure

```text
<niche>-pod-design-agent/
|-- SKILL.md
|-- manifest.json
|-- agents/openai.yaml
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

## Progressive loading

Always load only:

- `master-data-index.md`;
- `idea-engine-workflow.md`.

Load the other domain references conditionally. Before any production prompt or image call, read `design-brief-contract.md` and run `resolve_design_brief.py`. Prefer the selector and resolver over loading the full canonical JSON into context.

Keep the combined always-loaded references at or below 7,000 bytes. New market, production, evidence, archetype, and sensitivity detail must stay behind conditional routes.

## Executable request closure

The request resolver must bind all of these before generation:

- market context;
- persona;
- buyer-recipient pair;
- occasion;
- emotion;
- idea archetype;
- hook;
- 1-4 style variants;
- copy mode and text;
- personalization keys;
- product and product surface;
- exactly one production method;
- exactly one output profile;
- exact image provider/model/interface and alpha-capability evidence.

A successful receipt records master-data SHA-256 and request SHA-256, resolved IDs, numeric production limits, sensitivity result, variant distinctness, and the alpha route. Any dangling ID, incompatible combination, production mismatch, anti-generic phrase, refusal rule, or invalid capability evidence fails closed.

## Required workflow

1. Parse the request and identify missing decisions that materially change buyer logic, production, safety, or contrast.
2. Create a request JSON and run `scripts/resolve_design_brief.py`.
3. Stop on a resolver error. Do not bypass the receipt with prose reasoning.
4. Run concept-fit scoring with confidence and evidence basis.
5. Run IP blockers separately from sensitivity behavior and commercial fit.
6. Respect the receipt's production method, minimum stroke/gap/text height, color limit, template requirement, and sensitivity constraints.
7. Select foreground colors for the actual product surface.
8. Follow the alpha route embedded in the receipt.
9. Generate only the requested 1-4 variants while meeting the required distinct creative axes.
10. Run copy, composition, print, contrast, sensitivity, IP, and materialized alpha QA.
11. Deliver only a transparent PNG that passes alpha QA.

## Market and evidence behavior

- `hypothesis` is not demand validation.
- `supported` or `validated` claims require source references.
- Expired `review_by` dates make the claim stale; the target must not call it current or demand-backed.
- Market contexts constrain language, restricted claims, units, and output assumptions; unknown marketplace details remain explicit uncertainty.

## Production contract

Every product references exactly one production method and one output profile. Production methods carry numeric baseline constraints, substrate/ink notes, template requirements, and uncertainty. Provider templates may tighten the baseline but never silently weaken it.

## Creative and sensitivity gates

- Idea archetypes encode purchase logic and compatible records.
- Variants must differ on at least the configured number of creative axes.
- Anti-generic phrases and forbidden combinations execute in the resolver.
- Sensitivity actions are behavioral:
  - `refuse` stops the request;
  - `constrain` adds mandatory production constraints;
  - `human-review` blocks production-ready labeling.

## Transparency state machine

The receipt delegates to `resolve_transparency_route.py` with provider, exact runtime, capability status, compatible evidence, alpha-QA result, and completed attempt count.

- `supported`: native transparent option, PNG, strict alpha QA; failure rerenders transparent and never uses solid fallback.
- `unknown`: probe transparent output; fallback becomes eligible only after every configured probe fails.
- `unsupported`: one approved temporary flat canvas may be used, then edge-connected removal and the same final alpha QA are mandatory.

The helper must never return `allow_solid_fallback=true` for `supported`. Every route ends at `transparent-png-alpha-qa-pass` or a typed failure.

## Background and contrast

Temporary fallback colors are exactly:

- `#000000`;
- `#FFFFFF`;
- `#808080`;
- `#3A3A3A`;
- `#C0C0C0`.

Never use green chroma key, neon colors, gradients, canvas shadows, texture, lighting, glow, haze, vignette, checkerboards, or fake transparency. Keep product contrast independent from the temporary removal canvas.

## Packaging and replacement

Generate into a temporary directory, validate, then install atomically. The manifest records generator/schema versions, niche, canonical data hash, generated time, and SHA-256 for every non-manifest file.

With `SOURCE_DATE_EPOCH` fixed, identical input must produce a byte-identical ZIP. Refuse replacement without a matching builder manifest. Refuse packaging when content hashes differ, validation fails, the archive has unsafe/cache paths, or it exceeds 25 MiB.
