# Print-file acceptance

Require a supplier_template_ref and exact width_px/height_px for this product,
placement and provider. Do not impose a universal 4500x5400 or DPI label. Metadata
DPI alone cannot prove sufficient pixel resolution for a physical print size.

The bundled parser checks PNG signature, chunk CRC, structure, dimensions, actual
alpha values and nonempty content. Supported: noninterlaced 8-bit RGB/RGBA. Other
PNG encodings, indexed transparency and animated PNG are held for conversion/review.
Limits: 80 MiB compressed input and 30 million pixels. Large legitimate supplier
files need a separately reviewed tooling route, not disabling these caps silently.

Transparent mode requires meaningful zero-alpha area and at least 90% transparent
border. Default area threshold is 1%; this is an explicit quality heuristic, not a
universal supplier rule. Fully blank images fail. A generated checkerboard does not
pass as transparency. The tool does not detect all visual defects or infringements.

Solid fallback requires generator_supports_transparency=false and
supplier_approves_solid=true. Unknown support is not false. Choose background and
artwork colors for the actual garment and provider, never a white rectangle by habit.

Manual gates: exact text/spelling, visual placement/crop, contrast on each garment,
rights/source provenance and mockup consistency. Approval records include status,
reviewed_by, reviewed_at and evidence_ref; the program cannot authenticate a person.
