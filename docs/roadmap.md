# Roadmap

Only local inventory, byte-level duplicates, filename-based review and offline reports exist today.

## Next milestones

1. **Review decisions:** local sidecar decisions, chosen by a person and tied to a specific scan.
2. **Better review hints:** optional text extraction and transparent similarity evidence, with format-specific tests.
3. **Drive inventory:** read-only access, pagination, native-document handling and documented export limitations.
4. **Change planning:** preview-only plans, conflict detection and explicit approvals before any mutation.
5. **Reversible actions:** bounded operations, precondition checks and execution records. This requires a separate safety design.
6. **Optional AI:** explain supported differences using cited extracted passages; evaluate accuracy, cost and data exposure.

Do not advertise cloud access, AI interpretation, undo or production migrations as current capabilities.

## Evaluation

Measure duplicate correctness on synthetic cases, review false positives, behaviour on unreadable/changing files, runtime and memory on a reproducible generated corpus. Publish measured results only after running the benchmark.
