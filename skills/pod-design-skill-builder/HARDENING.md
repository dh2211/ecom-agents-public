# Boundary hardening candidate (schema 3.2 / generator 3.2.0)

This is a reversible review candidate, not an in-place release upgrade. Generator and schema identifiers stay unchanged for valid 3.2 consumers. Identity is the candidate content hash, not a new published version.

## Changes
- Transparency resolver validates nonblank string identities, capability/evidence/alpha enums, and finite numeric `attempt` values (int/float, excluding bool, NaN, infinity, strings and null). The attempt is preserved without rounding; only the two configured attempt limits require strict integers. Invalid input raises ValueError before route decisions.
- Brief resolver passes runtime values without string coercion; errors remain BriefError / CLI exit 2.
- Builder validator and JSON Schema reject whitespace in root and market locales; no silent trimming. Valid existing tags, including `und`, remain accepted.
- Teacher and pet fixtures use the existing schema-3.2 sensitivity refusal mechanism for illustrative licensed-character/brand copy. No ontology or dependency added.
- Original release tests remain byte-identical. The prior added test incorrectly rejecting `2.0` was corrected to the existing Rust finite-number contract. Added focused RED/GREEN boundary regressions and a generated-package verification harness.

## Usage on this Windows host
Use `python` instead of `python3` in existing portable examples. From the builder folder:

```
python -m unittest discover -s tests -v
python scripts/create_pod_design_skill.py --niche-slug teacher --data-json references/teacher-example-data.json --output <new-output> --zip --allow-internal-validator
```

`--allow-internal-validator` is only appropriate when the optional platform validator is genuinely unavailable. This host did not discover one; no platform-validation pass is claimed.

## Limits and operator duties
- Curated fixtures are hypotheses, not current marketplace demand. Source reference validity does not establish truth; review content, dates, and legal status independently.
- The IP keyword rules are illustrative and conservative, not comprehensive: spelling variants, unseen trademarks, visual likeness and copyright need human review. A `clear` sensitivity status means no configured trigger matched; it is not IP clearance.
- `alpha_qa` is the caller's QA attestation. Supply `pass` only after `verify_png_alpha.py` succeeds on the materialized final file. A resolver receipt is not a file-bound alpha proof.
- Production measurements are baseline contracts, not printer-template certification or final-image evaluation.
- Generated core and runtime remain schema-3.2 compatible for valid original requests; Rust engine and fixtures were not edited. Read-only Rust EXE parity probes are recorded in `audit/compatibility.json`; independent parent acceptance remains required.

## Reproducible review
Run `python audit/verify_candidate.py <candidate-root> <fresh-output-dir>` from any working directory with jsonschema available. It requires real schema validation, runs all tests without skips, rebuilds both targets twice, verifies ZIP/manifest integrity, and executes positive and negative generated CLIs. It does not need image-generation credits.

Acceptance remains pending the parent's independent audit of the frozen candidate. Grok output, if obtainable, is additional evidence, not a substitute.
