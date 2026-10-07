# Synthetic walkthrough

Run `npm run demo`.

The four sample files model a simple review:
- Two supplier guides in different folders have identical bytes.
- A supplier guide marked v2 contains different bytes.
- An opening checklist is unrelated.

Expected results: 4 files, 1 exact duplicate group and 1 possible-version group.

The duplicate group links both locations. It does not pick which should be retained. The version group links the original, copy and revision for review; “v2” does not prove the latest approved version.

Open `reports/demo/review.html` to inspect the evidence. Open the CSV in a spreadsheet if needed. No source files change, and no external service receives the scan.

Try editing one synthetic copy and scanning again: it stops being an exact duplicate, while the similar filename keeps it in the version review group.
