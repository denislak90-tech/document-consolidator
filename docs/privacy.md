# Privacy and publishing rules

## Included in this repository

Original source code, tests, documentation and four explicitly synthetic fixture files. No source documents, user archives, conversation content, credentials, personal contact details or machine-specific paths are bundled.

## Local scans

The scanner reads selected documents and records metadata and SHA-256 hashes. It does not upload files or extracted contents. Absolute input-root paths are not recorded, but relative paths and names may still contain personal information.

Content hashes can reveal that a file matches a known file. Treat them as potentially sensitive. Reports also contain exact modification times.

Reports and logs must stay local. Do not upload a report to a public issue. If reporting a bug, create a minimal synthetic reproduction.

## Git exclusions

The default report directory, environment files, logs and dependency folders are ignored. This is a convenience, not a guarantee against accidentally publishing private content. Git ignores do not remove already tracked files.

Before publishing changes:
- Inspect staged filenames and their full contents.
- Use synthetic fixtures only.
- Remove actual names, account numbers, emails, addresses, tokens and private URLs.
- Keep customer, employer and personal datasets outside the checkout.

Any future Drive or AI feature requires its own permission boundaries and explicit documentation. Neither is implemented here.
