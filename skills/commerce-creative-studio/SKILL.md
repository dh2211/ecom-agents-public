---
name: commerce-creative-studio
metadata:
  version: "1.0.1"
description: Produce ecommerce creative briefs, UGC scripts, storyboards, creator shot lists, AI-presenter production plans, ad-banner layouts, local video draft assemblies and creative test plans for POD or dropshipping products. Use for UGC video, product demo, ad banner, creative batching, hook testing or creative QA. Preserve exact product fidelity, usage rights and truthful claims. Distinguish production plans from rendered files; never publish or change spend.
---

# Commerce Creative Studio

## Route the request

Read the product/variant dossier, business_model, target market, language, offer, audience,
licensed reference assets and planned placement. Consult `references/UGC.md` for video,
`references/BANNERS.md` for images, and `references/TESTING.md` for experiments.
Use `references/brief.example.json` as a schema example, not as sourced business evidence.
Use `references/production.example.json` for asset rights, timeline and final export records.
This skill can also be used with the existing POD workbench without changing a POD profile.
An ad image or mockup is never the POD production print master.

## Production sequence

1. Validate the brief and claims against dated evidence. Ask for missing facts only when
   they prevent a useful draft; otherwise mark blockers and prepare what can be done safely.
2. Select one mode: creator (real experience), ai-presenter (clearly synthetic presenter),
   or product-demo (product-first footage). Do not turn the second into a fake testimonial.
3. Run `node scripts/creative.mjs plan BRIEF.json NEW_OUTPUT_FOLDER` to create a real
   plan.json, storyboard.md, banner-brief.md and review checklist. This produces NO video.
4. Probe the actual image/video/voice tools in the host. Choose only tools that demonstrably
   exist and are authorized. No vendor is hard-coded here. Record provider, model/version,
   job id, source asset hashes, prompt and actual returned file path for each generation.
   An asynchronous job is pending until polled and the result is downloaded and inspected.
   If a tool is missing, deliver the prompts, shot list and editor instructions with
   blocked-media-tool. Do not fabricate a video URL or claim a storyboard is a video.
5. For UGC, follow the human-creator or synthetic-presenter procedure in UGC.md. Generate
   only one pilot first, inspect product fidelity, then expand approved hooks. Use real
   product footage for demonstrations AI cannot reproduce faithfully.
6. With licensed local clips, run `node scripts/creative.mjs assemble BRIEF.json TIMELINE.json ASSET_ROOT NEW_OUTPUT_FOLDER`.
   This creates an actual draft.mp4 using separately installed FFmpeg/ffprobe. The helper
   requires protocol_whitelist support to keep decoding local. An incompatible executable
   is a blocker, and the error names the file PATH selected. Do not remove the protection
   or retry without it. The assembly preserves the entire product frame, removes source
   audio and uses only the optional approved voiceover. It does NOT synthesize a presenter,
   voice, captions or disclosures.
   Add and verify captions/disclosures in an editor before final review.
7. For local image layouts, run `node scripts/creative.mjs banners BRIEF.json ASSET_ROOT NEW_OUTPUT_FOLDER`.
   Supply a licensed product PNG/JPEG. The helper embeds the exact image and creates three
   SVG working layouts. For generative lifestyle scenes, use the host's image tool and
   inspect that product geometry, contents, scale and variant did not change.
8. Export accepted PNG/JPEG/MP4 formats for the actual placement. Keep raw input assets and
   final exports separate. Audit with `node scripts/creative.mjs audit BRIEF.json EXPORT.json ASSET_ROOT`.
   FFprobe is required for measured final-file QA. A missing probe is a blocker, not a pass.
9. Deliver the files, per-export hash, source lineage, disclosure checklist, rights record,
   human-review checklist and a controlled test matrix. Explain what is still pending.

## Fixed boundaries

Keep outbound actions held: no upload, post, scheduling, ad activation, spend or account edit.
A human-review JSON is a declaration, not authentication or permission to publish.
Never fabricate experiences, reviews, testimonials, scarcity, results or before/after proof.
Require permission for a real person's likeness/voice and the requested paid-ad territory,
term and editing use; AI derivatives require explicit permission. Never clone a person by default.
Do not remove attribution marks or repurpose a competitor's video without rights.
Retain credentials only in the host's secret store, never in prompts or output packs.
Within an Agent, respect its existing guard, profile and single-writer boundaries.
