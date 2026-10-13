# Background and Product-Contrast Standard

## Contents

- [Two independent color problems](#two-independent-color-problems)
- [Capability-gated transparent route](#capability-gated-transparent-route)
- [Safe flat fallback](#safe-flat-fallback)
- [Product-surface contrast](#product-surface-contrast)
- [Automated removal](#automated-removal)
- [Validation and failure rules](#validation-and-failure-rules)

Read `transparency-capability-policy.md` first. It determines whether the runtime must continue rendering transparent or is eligible for a temporary solid canvas.

## Two independent color problems

Keep these separate:

1. **Product surface**: the shirt, mug, tote, or other product color. Select foreground colors for visibility on this surface.
2. **Generation canvas**: real transparent alpha whenever the active runtime supports it; otherwise one temporary removable solid color.

A generation canvas can contrast perfectly with the artwork while the artwork remains unreadable on the product. Validate both relationships independently.

## Capability-gated transparent route

For a runtime classified as `supported`:

1. Set the provider's native transparent-background control when exposed.
2. Request PNG and isolated artwork only.
3. Prohibit painted checkerboards, mockups, scenes, walls, floors, canvas shadows, lighting, glow, haze, halos, and vignettes.
4. Materialize the actual file and run `verify_png_alpha.py`.
5. When alpha QA fails, rerender with the transparent route until the configured attempt limit.
6. After the last failed attempt, hard-fail. Do not switch a supported runtime to a solid canvas.

For `unknown`, run the configured transparent probes. A passing materialized PNG promotes the exact runtime to `supported`; only exhausted failed probes permit fallback.

The final production deliverable must always be transparent, including outputs created through the fallback/removal route.

## Safe flat fallback

Use fallback only when the exact runtime is explicitly `unsupported` or failed all configured transparent probes.

Allow exactly five temporary canvas colors:

- black `#000000`;
- white `#FFFFFF`;
- neutral gray `#808080`;
- dark gray `#3A3A3A`;
- silver `#C0C0C0`.

Never use green chroma key, neon key colors, or a custom fallback outside this set.

### Selection algorithm

1. Finalize foreground colors for the product surface.
2. Convert each foreground color and safe candidate to CIE Lab.
3. Calculate Delta E 76 from each candidate to every foreground color.
4. Rank each candidate by its minimum distance to any foreground color.
5. Use average distance and contrast ratio only as tie-breakers.
6. Reject a fallback that appears as a connected edge color inside the artwork.

Require this exact prompt sentence:

> MANDATORY FLAT SOLID COLOR. NO SHADOWS.

Also prohibit gradient, texture, glow, haze, vignette, lighting, horizon, floor, wall, object shadow, semitransparent spill, and fake transparency.

The solid image is an intermediate artifact. Remove its edge-connected background, run strict alpha QA, and deliver only the post-removal transparent PNG.

## Product-surface contrast

| Product surface | Artwork palette direction | Avoid |
|---|---|---|
| Dark, such as black apparel | High-luminance colors: white, cream, pale yellow, light cyan, light pink, or other niche-appropriate light colors | Large dark fills without a light outline |
| Light, such as white apparel | Low-luminance colors: black, charcoal, navy, deep burgundy, or other niche-appropriate dark colors | Pale text without a dark outline |
| Mid-tone | A light/dark pair, robust outline, or knockout | Similar-luminance single-color art |
| Unknown | Obtain the product color when material; otherwise use dual-tone protection and state the assumption | Pretending contrast was verified |

Target at least 4.5:1 for important text and shapes when exact colors are known. Treat this as a visibility heuristic; print process, ink, substrate, distressing, and halftones may require more.

Do not remove dark details merely because the product is dark when those details are enclosed by a sufficiently light outline or knockout. Judge the visible composition at print scale, not individual colors in isolation.

## Automated removal

Generated target skills include:

- `resolve_transparency_route.py`: enforce the capability/evidence/retry state machine;
- `select_background.py`: choose the safest temporary fallback and evaluate product contrast;
- `remove_flat_background.py`: remove only flat, edge-connected background pixels;
- `verify_png_alpha.py`: confirm meaningful alpha, transparent borders, visible artwork, and safe margins.

Flood-filling from the edges reduces the chance that an interior foreground color is erased. Safe-palette separation reduces it further.

## Validation and failure rules

Fail, rerender, or reprocess when:

- no real alpha exists;
- the file is empty and fully transparent;
- a checkerboard or solid rectangle is painted into RGB pixels;
- the transparent border threshold fails;
- meaningful content touches the canvas edge;
- a supported runtime fails alpha QA and still has retry attempts;
- a supported runtime exhausts retries, in which case the route hard-fails rather than falling back;
- fallback is selected without valid unsupported evidence or exhausted probes;
- the fallback contains shadows or tonal variation;
- edge samples do not match one approved color;
- color spill remains after removal;
- foreground contrast fails on the product surface;
- removal damages fine details.

Do not promise a universal 99% success rate. This process is designed to maximize repeatability while preserving the invariant that the final delivered asset has verified alpha.
