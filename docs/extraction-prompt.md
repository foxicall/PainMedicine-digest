# PHN hybrid extraction pilot

`scripts/extract_phn_pilot.py` defaults to a **dry run**: it reads only collected
source files, estimates a cost ceiling, and makes no API calls or credential reads.
The checked-in prompt and strict extraction schema live in that script with
`PROMPT_VERSION = phn-extraction-1.0.0`.

```sh
python scripts/extract_phn_pilot.py
python -m unittest discover -s tests -p 'test_phn_extraction.py' -v
```

Default inputs are `/tmp/pain-phn-source-records.json` and legally available full
texts in `/tmp/pain-phn-fulltexts/<PMID>.json`, collected separately by
`scripts/collect_phn_sources.py`. Default output is
`/tmp/pain-phn-extraction-usage.json`; the private response cache is
`/tmp/pain-phn-extraction-cache/`. These `/tmp` files are not deployed to the site.

The default plan extracts **all available abstracts** with `gpt-6-luna` and targets
**ceil(10% of unique candidate records)** with `gpt-6.1-sol`: the current 155-record
corpus targets **16 full texts**, with 20 locally retrieved candidates available.
Missing abstracts are reported in `missingAbstractPmids` and do not trigger
title-only model requests. The denominator includes all deduplicated candidates,
not only eligible PHN trials or available full texts; an empty corpus targets zero.
`--fulltext-limit N` overrides the percentage (including zero to disable stage two).
The former fixed 10-text default and 20-text CLI ceiling no longer apply.

`--fulltext-pmids` gives preferred PMIDs, followed by the retained curated priority
list, guidelines, randomized trials and other reports. Newer publication dates
and numeric PMIDs break ties. This order is deterministic reading priority, not
a clinical evidence-quality rating. Explicit PMIDs are preferences, not an
allowlist; other available texts can replace screening exclusions. Sources with
integrity flags, dates outside the publication window or missing abstracts cannot
be upgraded. Full-text
upgrades require a source-validated first-stage result identifying established
PHN treatment, PHN prevention, a separable mixed PHN population, or guideline
context. Acute-zoster/prevention work remains explicitly distinguished from
treatment of established PHN. Papers failing screening or quote validation are
never silently promoted. All available abstracts run before any full-text call.
The runner walks the entire ranked local full-text pool after screening, replacing
ineligible candidates until the target is reached or the pool is exhausted.
Rejected full-text outputs still consume a selection slot and their token cost;
they are never silently retried to fill the quota. The spending cap can stop either
stage. `targetFulltextCount`, `availableFulltextCount`, `selectedFulltextPmids`,
`validatedFulltextCount` and `fulltextShortfall` distinguish intent from completion.
`status: completed` means the execution queue finished, not that every result passed.

After verifying model access and the configured API credential's permission to
reach `https://api.openai.com`, execution is an explicit separate operation:

```sh
python scripts/extract_phn_pilot.py --execute --budget-usd 10
# Use the environment's named secret binding, without exposing its value:
python scripts/extract_phn_pilot.py --execute --budget-usd 10 --api-key-env Painmedicine_KEY
```

Execution reads `OPENAI_API_KEY`, or the variable named by `--api-key-env`, from
the environment. Dry runs read neither credential. Never include that key in
source files, arguments, reports, client-side code, or GitHub Pages. The request
uses `store: false`; this parameter does not itself define every provider-level
data-retention policy. Neither the error body nor HTTP headers are logged, since
authentication errors can echo part of a credential.

## Cost accounting

The plan uses standard synchronous prices, not the discounted Batch estimates
used during earlier budget planning. Configured USD per million input/output
tokens are Luna **$0.10/$0.50** and Sol **$2.00/$10.00**; source:
<https://developers.openai.com/api/docs/pricing>, checked 2026-10-18. Recheck prices
and model availability before a production run. Cached-input discounts are not
assumed. Reasoning tokens are already included in output tokens and are not
added a second time.

With maximum 6,000 output tokens per abstract and 12,000 per full text, the
155/16 plan estimates a maximum **$2.8348**. A deliberately pessimistic input-byte
reservation raises the request budget reserve to **$4.0077**. Each estimate includes
all abstract tasks plus the most expensive possible 16 full texts from the current
20-candidate pool, so replacements cannot exceed the planned reservation simply
because their source is longer. These are **estimates,
not actual charges**. Each response records actual input, output and reasoning
usage and a price-based cost estimate. The provider's billing dashboard remains
the authoritative charge record.

Before every call, the runner reserves its worst-case request amount against a
hard pilot cap of at most $10. Earlier cache versions count against that same
cap. Non-billable rate-limit errors have bounded retries; a timeout or 5xx may
have been billed, so its full reserve remains recorded and it is not retried
automatically. Progress is written after every result and a pending reserve is
written before each request, preserving a conservative ledger after interruption.
An unresolved or failed cache entry requires deliberate inspection before retry.
Deleting the cache also deletes its historical ledger; retain it for this pilot.

Use `--public-plan public/data/phn-api-plan.json` on a dry run to export only
counts, routing, model names and estimates. Source units, payloads and extraction
results remain private. The full private plan lists both initial and reserve
candidates; its task costs should not all be added together, since at most the
target count can be selected. Rebuilding the source-assisted snapshot with
`--api-plan` copies planned coverage into the UI without changing the actual
model-use or review status of the published drafts.

## API connectivity check

`docs/phn-api-check.json` records the separate small API test. The model-list
endpoint succeeding does not prove the generation endpoint works. On an HTTP 401,
stop and correct the server-side credential binding; do not treat it as a model
result. After correcting authentication, a known 401 cache entry with zero actual
cost and zero uncertain reserve may be deliberately archived before retrying.
Never automatically remove pending or ambiguous entries, which may have been billed.

## Extraction and review

The schema captures screening category and reason, PHN definition, sample size,
population, trial design, randomization, blinding, ITT, each intervention and
comparator arm, drug/injection dose, route, concentration, volume, frequency,
duration, titration, procedural target, device settings and shared treatments.
It also captures outcomes, reported p-values/CIs/NNT/NNH and safety. Missing
scalars must be `null`; no customary dose, calculated NNT, or formal risk-of-bias
rating may be invented.

Every populated clinical leaf needs an evidence entry with an exact JSON pointer,
a quote, and a supplied source-unit location. The runner checks that the quote is
a continuous case-sensitive substring after Unicode/whitespace normalization.
Schema mismatch, unsupported fields, absent evidence, fabricated/spliced quotes,
wrong PMIDs and truncated model output are rejected. Those responses may still
have incurred token charges, which remain in the ledger and cache.

**Quote matching validates source provenance, not clinical correctness.** A quote
can be real while an interpretation is wrong. Source-validated results require
clinical review before being treated as a verified clinical digest. Copyright and
license limits still apply; do not republish full-text source caches or lengthy
quoted passages in the static site.
