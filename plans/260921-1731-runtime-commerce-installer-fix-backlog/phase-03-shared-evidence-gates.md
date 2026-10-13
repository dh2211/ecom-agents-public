---
title: "Phase 3: Shared evidence gates"
status: done
---

# Phase 3: Shared evidence gates

## Context Links

- skills/dropship-workbench/scripts/ops.mjs:60-102
- skills/dropship-workbench/references/OPERATIONS.md
- skills/dropship-workbench/references/examples.json
- skills/commerce-creative-studio/scripts/creative.mjs:87-107
- skills/commerce-creative-studio/scripts/media.mjs:22-27
- tests/dropship/dropship.test.mjs

## Overview

Priority is P2. The shared validators are deterministic safety gates used directly by the Commerce app. They must reject evidence that is attached to the wrong supplier or market and media that only has an image filename.

## Requirements

- Require each sample, safety and returns review to match variant_id, supplier_id and market in the product dossier.
- Update the synthetic schema example and operations text so a new supplier or destination requires a new applicable review, not only a new quote.
- For declared images, require measured image container and codec from probe, reject video streams, nonzero duration or audio, and retain exact dimensions, hash, lineage and human review checks.
- Keep video validation separate and require an actual video container, duration and audio as the existing contract states.
- Missing media tools must remain a hold, never a false pass.

## Architecture

Extend the review identity check in supplierReadiness and the example records. Extend audit to map kind image to an explicit measured allowlist such as PNG or JPEG codecs and matching containers. Do not infer media type from the filename. If the installed probe cannot supply the required fields, return a hold with the missing measurement.

## Related Code Files

Modify:

- skills/dropship-workbench/scripts/ops.mjs
- skills/dropship-workbench/references/OPERATIONS.md
- skills/dropship-workbench/references/examples.json
- skills/commerce-creative-studio/scripts/creative.mjs
- tests/dropship/dropship.test.mjs

Create only if the media fixture needs isolation:

- tests/dropship/fixtures/media.mjs

## Implementation Steps

1. Add supplier and market fields to the synthetic review fixture and require them in all three review checks.
2. Add tests for supplier substitution and destination substitution, each with otherwise fresh evidence.
3. Record the measured fields used for image classification and implement the allowlist with an explicit failure for video or audio masquerading as an image.
4. Add a generated video renamed to .png regression. Skip only when the probe tool is unavailable, and keep a no-tool hold test always enabled.
5. Verify Commerce supplier and media gates consume the stricter helper behavior without changing remote mutation policy.

## Todo

- [x] Define the measured codec and container allowlist for PNG and JPEG on supported FFmpeg versions.
- [x] Add supplier and market mismatch tests.
- [x] Add the renamed-video image test.
- [x] Update examples and operations documentation.
- [x] Run the local Dropship suite. The media assembly path now falls back for older local FFmpeg builds without `protocol_whitelist`.

## Success Criteria

- Supplier A reviews cannot satisfy supplier B or a different destination market.
- A real video copied to final.png returns hold with a measured media reason.
- Valid PNG and JPEG fixtures remain reviewable, and valid video fixtures retain their existing checks.
- The Dropship suite and Commerce media regression suite pass.

## Risk Assessment

Codec names differ between probe versions. Pin assertions to the semantic measured fields and test the supported CI toolchain, rather than accepting every codec string. Keep the fallback conservative when a field is absent.

## Security Considerations

This phase prevents stale approvals and mislabeled files from reaching a human review queue. It does not authenticate a supplier or human reviewer, and the returned limitation must continue to say so.

## Next Steps

The stricter gates are the baseline for the Commerce handoff tests.
