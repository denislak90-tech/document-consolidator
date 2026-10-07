# Document Consolidator

A local-first, read-only tool for discovering exact duplicate documents and organising possible versions into a review queue.

**Status: working local CLI prototype.** No cloud connectors, AI classification, source mutation or authoritative-version selection are implemented in this release.

## Try it

Requires Node.js 22 or later. No runtime dependencies, account, model API or installation step.

```sh
git clone https://github.com/denislak90-tech/document-consolidator.git
cd document-consolidator
npm test
npm run demo
```

Open `reports/demo/review.html` in your browser. All bundled examples are synthetic.

Scan your own folders locally:

```sh
node bin/document-consolidator.js "./documents" "./archive" --out "./reports/my-review"
```

Generated files:

| File | Purpose |
| --- | --- |
| `inventory.json` | Structured inventory, SHA-256 hashes, duplicate groups and review hints |
| `inventory.csv` | Spreadsheet-friendly inventory with formula-injection protection |
| `review.html` | Offline review page with inventory and evidence for each group |

The tool does not move, rename, modify or delete source files. It writes three reports to your selected output folder, replacing previous reports with the same names.

## How decisions are made

- **Exact duplicates:** same byte size and SHA-256 hash. Renamed files can still match.
- **Possible versions:** similar normalised filenames but different hashes. Suffixes such as `v2`, `copy` and `final` are only review hints.
- **Authority:** no file is automatically declared current, approved or legally governing. Timestamps and “final” filenames do not establish authority.
- **Potential redundancy:** redundant bytes describe duplicate copies, not a promise that deletion is appropriate.

A PDF and a DOCX with the same text will not match as exact duplicates. Metadata changes within office files can also change their bytes. This release does not extract document text, OCR images or compare semantic meaning.

## Privacy

No network requests, telemetry, cloud credentials or model calls are present in the scanner. Files are read locally; only hashes and metadata are put in reports.

**Reports are sensitive:** filenames, relative paths, modification times and hashes can disclose information. Source roots are labelled `source-1`, `source-2` instead of writing absolute source paths. This is not anonymisation of filenames or nested folders.

Generated reports are ignored by Git by default. Do not commit real datasets, reports, credentials, personal documents or production exports. An explicitly chosen output folder outside `reports/` is not automatically covered by that ignore rule.

See [privacy](docs/privacy.md) and [security](SECURITY.md).

## Options and behaviour

```text
--out <folder>       Output directory; defaults to reports/latest
--include-hidden     Include hidden files; .git and dependency folders stay excluded
--all-files          Hash all regular files, not just common document extensions
--help               Display usage
```

Symlinks are skipped; overlapping roots are counted once. Read errors are recorded using relative paths. Files that change while being hashed are excluded from duplicate decisions. Files are streamed, but the metadata inventory remains in memory.

Exit codes: `0` complete scan, `1` invalid input or report-writing failure, `2` partial scan with read errors.

## Project documentation

- [Architecture](docs/architecture.md)
- [Synthetic walkthrough](docs/walkthrough.md)
- [Privacy and publishing rules](docs/privacy.md)
- [Roadmap](docs/roadmap.md)
- [Contributing](CONTRIBUTING.md)
- [Changes](CHANGELOG.md)

## Roadmap

Read-only Drive integration, better filename review, explicit human decisions and reversible change plans are planned. AI-assisted comparisons would be opt-in and require separate disclosure of which data leaves the machine.

This repository is an independent prototype. It contains no customer data, employer documents, private conversation exports or claims of production deployment.

## License

MIT. See [LICENSE](LICENSE).
