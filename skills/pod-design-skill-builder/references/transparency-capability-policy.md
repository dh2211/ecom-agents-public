# Transparency Capability and Retry Policy

## Contents

- [Final-output invariant](#final-output-invariant)
- [Capability evidence](#capability-evidence)
- [Mandatory state machine](#mandatory-state-machine)
- [Provider examples](#provider-examples)
- [Strict alpha QA](#strict-alpha-qa)
- [Fallback eligibility](#fallback-eligibility)

## Final-output invariant

The production POD design must be a materialized PNG with meaningful real alpha. A gray, black, white, or checkerboard preview is not evidence of success or failure because interfaces often composite transparent pixels over a preview background. Inspect the actual file.

A temporary solid-color generation canvas is permitted only to create an alpha result when native transparency is unavailable. Never deliver that solid-source file as the final POD asset.

## Capability evidence

Classify the exact provider, model/tool, endpoint, and interface version for the current run:

| Capability | Accepted evidence | Route |
|---|---|---|
| `supported` | `native-control`, `provider-metadata`, or `prior-alpha-pass` from the same runtime | Transparent generation is mandatory. Failed QA rerenders transparent; no solid fallback. |
| `unknown` | `unverified` | Probe transparent generation and inspect the materialized file. |
| `unsupported` | `explicit-provider-limitation`, `transparent-option-rejected`, or `failed-probes` | Use a safe solid canvas temporarily, remove it, then require final alpha QA. |

Do not infer support from:

- a model family name alone;
- a `.png` extension alone;
- an image caption claiming “transparent background”;
- the visual appearance of a UI preview;
- a prompt request without file-level verification.

## Mandatory state machine

Use the generated helper before and after each attempt:

```bash
python scripts/resolve_transparency_route.py \
  --provider "OpenAI" \
  --model "ChatGPT Images 2.0" \
  --capability supported \
  --evidence native-control \
  --alpha-qa fail \
  --attempt 1
```

Rules:

1. `supported` + `not-run` -> generate with the native transparency control and transparent prompt.
2. `supported` + failed alpha QA -> rerender transparent.
3. `supported` + final failed attempt -> hard-fail without fallback or production-ready claim.
4. `unknown` -> probe transparent output for the configured number of attempts.
5. `unknown` + passing alpha QA -> promote that exact runtime to `supported`.
6. `unknown` + exhausted failed probes -> classify the current runtime as unavailable and allow temporary solid fallback.
7. `unsupported` -> allow temporary solid fallback immediately when its evidence is valid.
8. Any final output, including a post-removal fallback result, must pass the same strict alpha QA.

Never convert a supported runtime to fallback merely because one or more transparent renders were poor. The failure may be prompt adherence, interface behavior, or generation variance; the required response is transparent rerender until the configured limit, then a hard failure.

## Provider examples

Treat these as examples, not an eternal name-based registry:

- A GPT Image / ChatGPT Images runtime is `supported` when the tool exposes a native setting such as `background=transparent`, `transparent_background=true`, or a provider-equivalent control. Set it explicitly and request PNG.
- A Seedream 5.x runtime is `supported` only when that specific API, host, or interface documents alpha/transparent output or when its materialized file has passed strict alpha QA. PNG availability by itself is not enough.
- A Grok Imagine runtime is handled the same way: use positive provider/runtime evidence or a strict prior alpha pass. Do not assume transparency from the model label.
- Apply the same rule to any future image model. Capability evidence outranks brand or version name.

Cache a prior alpha pass only for the same provider, exact model/tool alias, endpoint/interface, output settings, and relevant version fingerprint. Re-probe after meaningful provider or interface changes.

## Strict alpha QA

Run the generated verifier on the materialized PNG:

```bash
python scripts/verify_png_alpha.py output.png \
  --minimum-fully-transparent-ratio 0.01 \
  --minimum-transparent-border-ratio 0.99 \
  --minimum-visible-ratio 0.001 \
  --maximum-significant-visible-ratio 0.90 \
  --maximum-significant-bbox-fill-ratio 0.92 \
  --minimum-significant-margin-ratio 0.005 \
  --significant-alpha-threshold 8
```

A passing result requires:

- a real alpha channel or indexed transparency;
- enough fully transparent pixels to prove actual empty canvas;
- enough visible pixels to reject an empty all-transparent file;
- visible coverage low enough to reject a nearly full-canvas opaque backdrop;
- an alpha-mask bounding-box fill ratio low enough to reject an inset solid panel;
- a nearly fully transparent outer border;
- significant artwork clear of all canvas edges;
- no painted checkerboard or opaque rectangle masquerading as transparency.

Record the verifier JSON per variant. If the file cannot be materialized, record `unverified` and do not call the image production-ready.

## Fallback eligibility

Fallback is eligible only when:

- provider/tool documentation or runtime metadata explicitly says transparency is unsupported;
- the native transparent control is rejected or unavailable in that exact runtime; or
- an `unknown` runtime fails all configured transparent probes.

Fallback is not eligible when:

- a supported runtime produces an opaque image;
- a preview looks nontransparent;
- the prompt is ignored once;
- the output has the wrong alpha coverage but the runtime supports alpha;
- the file was not inspected.

The fallback palette, color-distance selection, no-shadow rules, edge-connected removal, and product-surface contrast requirements are defined in `background-and-contrast.md`.
