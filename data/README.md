# data/ — Scientific data

Every data file here must follow these rules (MASTER_PROMPT §2.4):

1. **Source for every item** — a `source` field with a full citation (e.g. CODATA 2022 / NIST,
   IUPAC, Cordero et al. 2008, PubChem CID, NCBI translation table 1, SGK Hóa 11 …).
2. **`review_status: "pending" | "verified"`** — anything not yet checked by a teacher stays
   `pending` and the app shows the "Đang chờ giáo viên duyệt" badge.
3. **No invented values.** If a value is uncertain, leave a `TODO` and add it to
   `docs/DATA_REVIEW.md`.

Phase 0: no data files yet.
