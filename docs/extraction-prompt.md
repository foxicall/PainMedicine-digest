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

The current plan screens **155 abstracts** with `gpt-6-luna` and considers **10
selected full texts** for `gpt-6.1-sol`. This count is based on source availability,
not a claim that all 155 papers are eligible PHN treatment trials. Full-text
upgrades require a source-validated first-stage result identifying established
PHN treatment, PHN prevention, a separable mixed PHN population, or guideline
context. Acute-zoster/prevention work remains explicitly distinguished from
treatment of established PHN. Papers failing screening or quote validation are
never silently promoted.

After verifying model access and the configured API credential's permission to
reach `https://api.openai.com`, execution is an explicit separate operation:

```sh
python scripts/extract_phn_pilot.py --execute --budget-usd 10
```

Execution reads `OPENAI_API_KEY` from the environment. Never include that key in
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
155/10 plan estimates a maximum **$1.9435**. A deliberately pessimistic input-byte
reservation raises the request budget reserve to **$2.6761**. These are **estimates,
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
