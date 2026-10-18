# Pain Medicine Trial Digest

A responsive pain medicine reading workspace with a **daily rolling ten-year clinical-trial index**, international guidance sources, a **three-calendar-month JIF >10 literature feed**, and 12 structured landmark digests (2016–2026). Built with **Vite + React 19 + TypeScript**, Tailwind CSS 4, Lucide, Radix UI, TanStack Query, Fuse.js, and Zustand.

## Run locally

Node.js **22.12+** (Node 24 also works) and npm are required.

```bash
npm ci
npm run dev
```

Open the local URL printed by Vite. No API key, account, or environment variables are needed. The 12-trial seed library works without calling a remote API; fonts are bundled locally. Initial asset delivery still requires the app server. This is not an installed offline PWA.

```bash
npm test        # UI, filtering, exports, PubMed parsing, and persistence
npm run test:pipeline # collection, exact date windows, ISSNs and failure retention
npm run build  # strict TypeScript check and production build
npm run preview
```

## Codex or standalone HTML preview

The source `index.html` points to TypeScript, and `dist/index.html` loads separate compiled assets. Opening either as an isolated HTML preview can leave the application unmounted. Use the dev-server URL when it is reachable from your browser, or build a portable preview:

```bash
npm run build:preview
```

Open the generated **`preview.html`** in Codex's HTML viewer or a browser. Production builds also pre-render real evidence into the HTML: a viewer that blocks JavaScript displays a clearly labeled read-only preview, not an endless loading message. Use [the deployed website](https://foxicall.github.io/PainMedicine-digest/) for interactive reading. It embeds the complete application, CSS, fonts, and favicon; it needs no server or companion asset directory. JavaScript must be permitted for search, filters, notes, comparison and updates. The 12-trial seed works without network access; Explore PubMed still requires a connection. A sandboxed viewer may block clipboard access or LocalStorage; exports remain available for notes.

Every CI run also uploads this file as the **`pain-medicine-preview`** artifact. In GitHub, open **Actions → Validate application → a successful run → Artifacts**, download the ZIP, and open its `preview.html`. This is a downloadable preview, not a public website deployment. Generated previews are ignored by Git; regenerate after source changes.

A dev server running inside a remote cloud workspace is not automatically reachable at your computer's `localhost`. If Codex does not provide port forwarding, use the standalone preview or a deployed URL instead.

## Project structure

```text
PainMedicine-digest/
├── app/
│   ├── main.tsx                 # React entry, Query provider, error boundary
│   ├── page.tsx                 # Main dashboard (Vite component, not Next routing)
│   └── globals.css              # Tailwind + responsive clinical design system
├── components/
│   ├── EvidenceWatch.tsx      # Three feeds, dates, provenance and pagination
│   ├── TrialCard.tsx            # PICO, takeaway, outcome, safety, source actions
│   ├── TrialDetailModal.tsx     # Full digest, methods, notes, source citation
│   ├── FilterSidebar.tsx        # Specialty, years, N, intervention, journals
│   ├── CompareModal.tsx         # Descriptive comparison of 2–3 trials
│   ├── EvidenceDialogs.tsx     # PubMed, evidence questions, methodology
│   └── ui.tsx                  # Radix modal and reusable primitives
├── types/evidence.ts           # Indexed publications, feeds, sources and JIFs
├── scripts/update_evidence.py  # Python stdlib collector, no credentials required
├── public/data/evidence.json   # Complete last successful feed snapshots
├── data/evidence-preview.json # Small bundled offline/SSR preview
├── data/journal-metrics.json   # Official JIF values, years and verification
├── data/guideline-sources.json # Official country sources
├── types/trial.ts               # ClinicalTrialSummary, TrialFilters, enums
├── data/
│   ├── seed-trials.ts           # 12 typed, paraphrased clinical summaries
│   └── pubmed-metadata.json     # NCBI-sourced bibliographic metadata
├── lib/
│   ├── pubmed.ts               # ESearch → EFetch, throttling, parsing, eligibility
│   ├── trials.ts               # Fuzzy search, filters, deduplication
│   ├── store.ts                # LocalStorage bookmarks, notes, retained imports
│   └── export.ts               # Vancouver citation, CSV, BibTeX
├── tests/                      # Vitest + JSDOM + Testing Library
├── public/favicon.svg
├── .github/workflows/
│   ├── update-evidence.yml     # Daily collection, snapshot commit, explicit deploy
│   ├── ci.yml                  # Tests + build on PRs/main
│   └── pages.yml               # Main pushes, manual and reusable Pages deployment
├── index.html
├── vite.config.ts
├── vercel.json
├── tsconfig.json
├── package.json
└── package-lock.json
```

## Features

- Reading design: neutral white surfaces, slate text and muted indigo accents; digest cards follow clinical takeaway → PICO → outcome statistics → safety → methods / risk of bias.
- Evidence updates: searchable, paginated ten-year clinical trials (optional RCT-only filter), country guidance directory plus newly published PubMed guidelines, and pain-related publications in the preceding three calendar months from verified JIF >10 journals.
- Bibliographic imports are labeled **Awaiting appraisal**. No unreported PICO details, effect sizes, sample sizes, guideline endorsement or clinical recommendations are generated automatically.

- Fuzzy search by trial, condition, molecule, journal, author, or PMID. `Ctrl/Cmd+K` focuses search.
- Specialty OR matching with AND-combined year, N, intervention, and journal filters. Unknown sample sizes are excluded when a minimum N is selected.
- Grid/list views; newest, oldest, sample-size, or relevance sorting.
- Structured PICO, takeaway, effect statistics, safety, methods, and source links.
- Focus-trapped, keyboard-dismissable dialogs and keyboard-operable year sliders.
- Two- or three-study comparisons, including timepoints and limitations.
- Saved library and personal notes in LocalStorage. Saved or annotated live imports survive reload. Unsaved live searches last for the session / React Query cache.
- Export **the currently visible filtered selection** to CSV (including notes) or BibTeX. Switch to Saved to export bookmarks. CSV cells neutralize formula injection.
- Vancouver citation copying with a selectable citation fallback.
- “Ask the evidence” retrieves relevant existing summaries locally. It is deterministic keyword retrieval, **not a generative clinical Q&A model**.

## Clinical data and provenance

The **12 curated digests** are an abstract-based demonstration library. They remain separate from the automatically maintained PubMed index, which covers all retrievable IDs matching its search and date rules. Neither is a systematic review or a clinical guideline. Bibliographies and abstracts were fetched from NCBI EFetch on **2026-10-18**. Summaries are paraphrases; the seed does not redistribute full abstracts. Open each study's source tab for its original report.

| Trial                 | Publication          | PMID                                                  |
| --------------------- | -------------------- | ----------------------------------------------------- |
| OPTION-DM             | Lancet, 2022         | [36007534](https://pubmed.ncbi.nlm.nih.gov/36007534/) |
| SENZA-PDN             | JAMA Neurology, 2021 | [33818600](https://pubmed.ncbi.nlm.nih.gov/33818600/) |
| PROMISE-2             | Neurology, 2020      | [32209650](https://pubmed.ncbi.nlm.nih.gov/32209650/) |
| EVOLVE-1              | JAMA Neurology, 2018 | [29813147](https://pubmed.ncbi.nlm.nih.gov/29813147/) |
| EVOLVE-2              | Cephalalgia, 2018    | [29848108](https://pubmed.ncbi.nlm.nih.gov/29848108/) |
| SPACE                 | JAMA, 2018           | [29509867](https://pubmed.ncbi.nlm.nih.gov/29509867/) |
| STRIVE                | NEJM, 2017           | [29171821](https://pubmed.ncbi.nlm.nih.gov/29171821/) |
| HALO-CM               | NEJM, 2017           | [29171818](https://pubmed.ncbi.nlm.nih.gov/29171818/) |
| PRECISE               | NEJM, 2017           | [28328324](https://pubmed.ncbi.nlm.nih.gov/28328324/) |
| MINT                  | JAMA, 2017           | [28672319](https://pubmed.ncbi.nlm.nih.gov/28672319/) |
| SENZA 24-month report | Neurosurgery, 2016   | [27584814](https://pubmed.ncbi.nlm.nih.gov/27584814/) |
| MBSR/CBT              | JAMA, 2016           | [27002445](https://pubmed.ncbi.nlm.nih.gov/27002445/) |

Sample-size bases are explicit (randomized, treated, ITT, or combined cohorts). The overview sums report-level N values; it is not a unique participant count. The 24-month SENZA result is secondary. MINT contains three cohorts, not one pooled effect.

Missing statistics, discontinuation rates, and methods remain **not extracted**. NNT is calculated only for identified binary outcomes and timepoints, with the formula shown; NNH is not fabricated. Last named personal author populates the requested senior-author field; authorship roles are not independently confirmed. All trials have **“Not formally assessed”** risk of bias. Clinical production use requires full-text verification and outcome-level RoB 2 appraisal by qualified reviewers.

“Editorial journals” is a fixed editorial journal filter (PAIN, Lancet-family, JAMA-family, NEJM, Cephalalgia, Anesthesiology), not an impact factor or quality rating. Cross-trial comparisons do not establish direct comparative efficacy.

## PubMed pipeline

`lib/pubmed.ts` uses the requested expression:

```text
("Pain"[Mesh] OR "Pain Management"[Mesh] OR "Neuropathic Pain" OR "Chronic Pain" OR "Migraine Disorders"[Mesh])
AND ("randomized controlled trial"[pt] OR "RCT")
AND ("2016/01/01"[Date - Publication] : "3000"[Date - Publication])
```

It adds an upper date bound of today or **2026-12-31**, whichever is earlier, plus the optional user query. ESearch retrieves the latest **30** matches. EFetch XML is parsed as text with DOMParser, never injected as HTML. Records require a 2016–2026 publication year and an explicit `Randomized Controlled Trial` type. The UI separately reports broad matches, fetched records, and eligible records. Newly indexed or incompletely tagged trials may be missed; retrieval is not exhaustive.

Live records are **Awaiting appraisal**. The importer does not guess N, dose, effects, safety, or bias from free text. Specialty tags are preliminary keyword assignments. Seed summaries win during PMID deduplication.

Requests are serialized at ≥420 ms intervals (≤2.5 requests/sec per browser), with 15-second timeouts, cancellation, bounded 429/5xx retries, and visible errors. The seed remains usable on API failure. TanStack Query keeps searches fresh for 15 minutes without focus refetching.

For many concurrent users, move calls behind a **shared server-side queue and cache** to enforce NCBI's aggregate per-IP rate limit. Add an operator contact email and server-side NCBI key as appropriate under [NCBI guidance](https://www.ncbi.nlm.nih.gov/books/NBK25497/). Never put secrets in `VITE_*` variables; these are public browser code. No OpenAI key is used.

## Automatic evidence updates

`scripts/update_evidence.py` uses Python's standard library and NCBI ESearch/ESummary. No API key or paid service is needed. Run `npm run update:evidence` to regenerate the full index and bundled preview. Every identifier is fetched: date partitions split when a query exceeds PubMed's 9,999-result limit, with PMID deduplication and complete-batch checks. Requests are serialized with a 420 ms minimum interval and bounded retries.

- **Trials:** clinical-trial publication types, rolling ten calendar years; includes non-randomized trials. The UI offers an RCT-only filter. The search extends the original MeSH expression with pain/migraine/headache/neuralgia title/abstract terms to catch records awaiting MeSH indexing.
- **Guidelines:** no age cutoff, because older guidelines can remain in force. PubMed guideline/practice-guideline records are sorted newest first. Official sources cover WHO, the UK, US, Australia, Japan and Germany. Country comes from the named issuing organization, never an author affiliation or journal country. Official source pages are checked daily and same-site pain-related links are discovered; these links are **not automatically certified as current guidelines**. Draft, expired and superseded status still requires source review. This is not exhaustive worldwide coverage.
- **Recent literature:** preceding three calendar months, ending today, with exact ISSN matching to `data/journal-metrics.json`. All article types can qualify. Only verified official annual JIF values **strictly greater than 10** qualify. Each value has its data year, source URL and verification date; CiteScore and five-year IF are not used. Unverified journals are explicitly excluded. Values expire after 365 days or when their metric year is more than two years old. Annual metric changes require a source-backed edit to the registry; the collector does not invent new JIF values.

Electronic publication dates take precedence over print issue dates. A date reported only to month/year precision qualifies only when its entire possible interval is inside the window. Future publications, unresolved dates and ambiguous boundary records are excluded and counted. A recent print issue does not make an older online article “new”. The UI also reapplies the current date window and metric validity to a retained stale snapshot.

`public/data/evidence.json` contains full feed snapshots and source status. `data/evidence-preview.json` bundles up to 12 records per feed so initial rendering and offline preview remain fast. The browser checks the full snapshot on load and every 15 minutes; **Check for updates** retrieves the latest published snapshot, rather than starting a server collection job. The index displays publication metadata; complete clinical summaries require human appraisal.

`.github/workflows/update-evidence.yml` schedules collection at **00:17 UTC / 08:17 Asia/Taipei daily** and supports **Run workflow**. It commits only generated snapshot files, then explicitly calls the Pages deployment workflow (GitHub-token commits do not trigger another push workflow). Each feed is replaced only after its entire retrieval succeeds. Failed feeds retain their last successful data and timestamp, show errors in the UI, and cause the overall Actions run to fail after publishing the available snapshot. Official website check failures are recorded per source. Main-branch protection must permit the bot's snapshot commits; otherwise the push fails visibly and no new deployment is reported as successful.

GitHub scheduled runs can be delayed and may be disabled after prolonged repository inactivity. Check Actions for execution history; enable notifications for failed runs in your GitHub settings. The UI flags a feed older than 48 hours. This is not a guaranteed-time scheduler.

## Push to GitHub

The existing `origin` is `https://github.com/foxicall/PainMedicine-digest.git`. Review and push with your authenticated Git credentials:

```bash
git status
git switch -c feat/pain-trial-digest
git add .
git commit -m "Build Pain Medicine Trial Digest"
git push -u origin feat/pain-trial-digest
```

Open a pull request to `main`, review CI, and merge when ready. These source files alone do not push or publish anything.

For a fresh repository, create an empty GitHub repository, then:

```bash
git init
git branch -M main
git remote add origin https://github.com/YOUR_ACCOUNT/YOUR_REPOSITORY.git
git add .
git commit -m "Build Pain Medicine Trial Digest"
git push -u origin main
```

## Deploy to Vercel

1. [Import the GitHub repository into Vercel](https://vercel.com/new).
2. Select **Vite**, root directory **repository root**, build **`npm run build`**, output **`dist`**, and Node **22.x or 24.x**.
3. Leave environment variables empty. `vercel.json` supplies build settings and SPA fallback.
4. Deploy. Subsequent pull requests receive preview deployments; the configured production branch deploys to production.

CLI alternative, after signing in with your own account:

```bash
npx vercel
npx vercel --prod
```

## Deploy to GitHub Pages

1. Merge the app and workflows into the default branch.
2. **Settings → Pages → Build and deployment → Source → GitHub Actions**.
3. **Actions → Deploy GitHub Pages → Run workflow**, or push/merge to `main`. Main-branch pushes now deploy automatically.
4. The workflow installs, tests, builds with the repository subpath, and deploys `dist`.
5. The expected current-repository URL after success is `https://foxicall.github.io/PainMedicine-digest/`; the deployment job returns the actual URL. It is **not live until the workflow succeeds**.

The workflow uses `VITE_BASE_PATH=/<repository-name>/`. For an account root site (`ACCOUNT.github.io`) or custom domain, change it to `/`.

```bash
VITE_BASE_PATH=/PainMedicine-digest/ npm run build
```

Only static hosting is needed. Scheduled collection runs in GitHub Actions; readers load the generated JSON. The optional manual PubMed search still calls NCBI from the browser.

## Privacy and persistence

LocalStorage key: `pain-digest-library-v1`. Notes and bookmarks do not synchronize across devices. Clearing site data removes them; export CSV for backup. Storage failures appear in the interface. Avoid patient-identifying information in notes. PubMed receives terms submitted to its search; local evidence questions stay in the browser.

## Deployment status

The live site is [Pain Medicine Trial Digest](https://foxicall.github.io/PainMedicine-digest/). Check the Pages deployment run for the revision currently published. Scheduled workflows run only from the default branch; a feature branch alone does not activate daily refreshes.
