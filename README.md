# Pain Medicine Trial Digest

A responsive clinical reading workspace for pain medicine randomized trials published **2016–2026 inclusive**. Built with **Vite + React 19 + TypeScript**, Tailwind CSS 4, Lucide, Radix UI, TanStack Query, Fuse.js, and Zustand.

## Run locally

Node.js **22.12+** (Node 24 also works) and npm are required.

```bash
npm ci
npm run dev
```

Open the local URL printed by Vite. No API key, account, or environment variables are needed. The 12-trial seed library works without calling a remote API; fonts are bundled locally. Initial asset delivery still requires the app server. This is not an installed offline PWA.

```bash
npm test        # filtering, exports, PubMed parsing, and persistence workflows
npm run build  # strict TypeScript check and production build
npm run preview
```

## Project structure

```text
PainMedicine-digest/
├── app/
│   ├── main.tsx                 # React entry, Query provider, error boundary
│   ├── page.tsx                 # Main dashboard (Vite component, not Next routing)
│   └── globals.css              # Tailwind + responsive clinical design system
├── components/
│   ├── TrialCard.tsx            # PICO, takeaway, outcome, safety, source actions
│   ├── TrialDetailModal.tsx     # Full digest, methods, notes, source citation
│   ├── FilterSidebar.tsx        # Specialty, years, N, intervention, journals
│   ├── CompareModal.tsx         # Descriptive comparison of 2–3 trials
│   ├── EvidenceDialogs.tsx     # PubMed, evidence questions, methodology
│   └── ui.tsx                  # Radix modal and reusable primitives
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
│   ├── ci.yml                  # Tests + build on PRs/main
│   └── pages.yml               # Manually dispatched Pages deployment
├── index.html
├── vite.config.ts
├── vercel.json
├── tsconfig.json
├── package.json
└── package-lock.json
```

## Features

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

This is an **abstract-based demonstration library**, not a complete 2016–2026 index, systematic review, or guideline. Bibliographies and abstracts were fetched from NCBI EFetch on **2026-10-18**. Summaries are paraphrases; the seed does not redistribute full abstracts. Open each study's source tab for its original report.

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

“High impact” is a fixed editorial journal filter (PAIN, Lancet-family, JAMA-family, NEJM, Cephalalgia, Anesthesiology), not an impact factor or quality rating. Cross-trial comparisons do not establish direct comparative efficacy.

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
3. **Actions → Deploy GitHub Pages → Run workflow**. Deployment is manual so a code push alone does not publish the clinical demo.
4. The workflow installs, tests, builds with the repository subpath, and deploys `dist`.
5. The expected current-repository URL after success is `https://foxicall.github.io/PainMedicine-digest/`; the deployment job returns the actual URL. It is **not live until the workflow succeeds**.

The workflow uses `VITE_BASE_PATH=/<repository-name>/`. For an account root site (`ACCOUNT.github.io`) or custom domain, change it to `/`.

```bash
VITE_BASE_PATH=/PainMedicine-digest/ npm run build
```

Only static files are needed. Current API calls go directly to NCBI from the browser.

## Privacy and persistence

LocalStorage key: `pain-digest-library-v1`. Notes and bookmarks do not synchronize across devices. Clearing site data removes them; export CSV for backup. Storage failures appear in the interface. Avoid patient-identifying information in notes. PubMed receives terms submitted to its search; local evidence questions stay in the browser.

## Deployment status

The source includes deployment configuration for Vercel and GitHub Pages. Uploading it to GitHub does not publish the website; use one of the deployment workflows above to create a live site.
