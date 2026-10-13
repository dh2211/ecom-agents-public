# UGC video production

## Three distinct modes

**Creator:** a real creator receives the actual variant, tries it, and records an honest
experience. Obtain paid-media, editing, territory, term, likeness and voice permissions.
If the creator has not tried the product, do not script a first-person testimonial.
A paid actor can demonstrate facts in an advertisement but must not impersonate a customer.

**AI presenter:** an explicitly synthetic host explains sourced product facts. Label the
AI involvement and commercial nature appropriately. Do not say "I bought this", invent a
family story or claim an improvement that never happened. Never use an unauthorized
celebrity/customer likeness. An AI label does not make a false claim acceptable.

**Product demo:** real product-first footage with factual narration/text. Prefer this when
synthetic hands, scale, mechanisms, packaging or product geometry are unreliable.
A concept scene is not evidence that the product performed that way.

## Creative architecture

Start from buyer problem -> one angle -> one verifiable promise -> one visual demonstration.
Working durations 15, 30 and 45 seconds are editorial presets, not platform limits.
A starting 30-second structure: 0-3 hook; 3-7 context; 7-19 demonstration; 19-25 objection/proof;
25-30 CTA. Adapt based on footage and readability, not a claim that this is universally optimal.

Build three hook hypotheses with one body and one CTA held fixed. Example categories:
problem recognition, unusual but true demonstration, and answering a real buying objection.
Use one test variable per batch. Do not multiply hooks x offers x actors x audiences and
then claim to know which change caused a lift. Keep product, offer and disclosure consistent.

## Creator production pack

Write: audience, exact product/variant, what is in the box, approved claims with source ids,
forbidden claims, shot list, spoken lines, B-roll, demonstration instructions, sound/caption
requirements, usage rights, compensation disclosure and review deadline. Keep delivery
promises in the script consistent with the destination-specific shipping lane.

Request clean footage and separate voice tracks when available. Verify the license permits
paid advertisements and edits, not just organic reposting. Spark Ads/partnership ads require
separate account authorization; the kit never grants or configures it.

## AI generation request

Give the tool the exact licensed product references, aspect ratio, scene duration, camera,
lighting, motion, language, voice permission, background and negative constraints. Negative
constraints include no changed logo, no extra product parts, no exaggerated effects, no
invented customer endorsement and no undocumented text. Keep typography as editable layers
when the generator corrupts spelling. Inspect every returned frame sequence, not just its cover.

Probe image.generate, video.generate, voice.generate, media.download, media.probe and
media.edit separately. A model subscription alone does not prove any of them is connected.
The repository ships local editing helpers, NOT a cloud generation SDK or API credentials.
Never silently buy credits or switch to a paid provider. If authorization is absent, stop
at the ready-to-render production pack and name the missing capability.

## Local editing helper

Timeline schema:

```json
{"target_seconds":30,"shots":[{"file":"raw/demo.mp4","start_s":0,"duration_s":30}],"voiceover_file":"raw/voice.wav"}
```

Each referenced file must exist under ASSET_ROOT and be listed in brief.assets with the
same SHA256 and recorded rights. Paths in JSON use `/` on every operating system.
The outer directory can be a native Windows path with spaces or Vietnamese characters.
Files are resolved with native path utilities, not URL.pathname.

The helper cuts and normalizes local MP4/MOV footage to 1080x1920 at 30 fps, pads rather than
silently crops the product, joins segments, optionally adds an approved voiceover and probes
the result. Total shot duration must equal the target. It creates a NEW directory only.
Original clip audio is deliberately removed. Background music is not mixed automatically.
Without a supplied voiceover the draft is silent and cannot pass final video audit.

Captions and disclosures are NOT burned in by this first release. Open the draft in a video
editor, add them visibly and audibly as appropriate, verify safe zones and export a new
final file. Hash the final export; a review of the earlier draft does not cover that new file.
No claimed final ad readiness before that human review.

## Final export record

Use store_id, product_id, variant_id, market and exports[]. Each export has file, sha256,
kind (video or image), width, height, duration_s for video, source_asset_hashes, and human_review.
The audit measures the actual container and codec. An image must be a measured PNG or JPEG
with no nonzero duration and no audio; a video must be a measured video container with duration
and audio. A filename extension is not evidence of media identity.
The review has status, reviewer, reviewed_at, asset_sha256 and true/false checks for
product_fidelity, claims, rights, disclosures, safe_zone and landing_match.
The tool validates declared records and actual media metadata; it cannot authenticate a
reviewer or judge whether a claim is true. All outputs retain remote_mutation_allowed:false.

## Sources

FTC: https://www.ftc.gov/business-guidance/resources/consumer-reviews-testimonials-rule-questions-answers
Disclosures: https://www.ftc.gov/business-guidance/resources/disclosures-101-social-media-influencers
TikTok: https://ads.tiktok.com/help/article/tiktok-ads-policy-misleading-and-false-content
Review the current rules for the target jurisdiction and actual placement before publication.
