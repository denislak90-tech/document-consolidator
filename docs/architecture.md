# Architecture

The CLI parses options, resolves the output destination, scans selected roots, then writes reports. The scanner does not import a network client or accept credentials.

## Pipeline

1. Validate real source directories and deduplicate overlapping roots.
2. Traverse regular files, excluding symlinks, hidden files and dependency directories by default.
3. Stream bytes into SHA-256 and check file metadata before and after reading.
4. Group equal sizes and hashes as duplicates.
5. Group filename families with different hashes for human review.
6. Write JSON, CSV and an offline HTML report.

## Data model

Each file contains an ID, anonymous source label, relative path, filename, size, modified timestamp, SHA-256 and filename-family hint. Groups reference file IDs. Reports include errors and skipped links so an incomplete scan is visible.

Schema version 1 is a prototype schema, not a stable public API. Source labels depend on input order. File IDs and timestamps are not persistent identifiers across runs.

## Boundaries

Byte equality establishes duplicates; it does not establish retention policy. Filename similarity is a conservative heuristic, not document understanding. Related documents in different formats may be missed; similarly named unrelated documents may be grouped.

Output paths are excluded from scanning and cannot contain a source root. Existing report files in the output directory are overwritten. Partial report writes are possible on disk or permission failure.

Metadata checks reduce inconsistent results when files change during a scan, but do not provide a filesystem snapshot or defend against all concurrent path-replacement races. Scan stable, trusted directories. Do not run as an administrator.

HTML escapes all data and uses no scripts or external resources. CSV cells neutralise leading formula markers. POSIX report writes request mode 0600; Windows permissions and pre-existing file permissions require the user's own controls.
