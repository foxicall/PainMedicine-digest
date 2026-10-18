#!/usr/bin/env python3
"""Validate source-assisted PHN drafts and publish a small, traceable pilot cache.

This command makes no model calls. Raw full texts remain in the local source
cache; only structured fields, short evidence excerpts and citations are shipped.
"""
import argparse
import csv
from datetime import datetime, timezone
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
CONTEXTS = {'treatment', 'prevention', 'mixed', 'other', 'unclear'}


def normalize(value):
    return re.sub(r'\s+', ' ', value).strip()


def read_json(path):
    return json.loads(Path(path).read_text())


def records_list(value):
    if isinstance(value, list):
        return value
    return value.get('records', value.get('trials', value.get('drafts', [])))


def publication_date(source):
    interval = source.get('sourceDateInterval')
    if interval:
        width = {'year': 4, 'month': 7, 'day': 10}[interval['precision']]
        return interval['from'][:width]
    return source.get('publicationDate', source.get('sourcePublicationDate', ''))


def validate_draft(draft, source, full):
    pmid = source['pmid']
    if draft['pmid'] != pmid or full['pmid'] != pmid:
        raise ValueError(f'{pmid}: source identity mismatch')
    if source.get('integrityFlags'):
        raise ValueError(f'{pmid}: integrity flag requires review')
    if source.get('withinPublicationWindow') is False:
        raise ValueError(f'{pmid}: earliest publication outside pilot window')
    if draft['methodology']['riskOfBias'] != 'Not formally assessed':
        raise ValueError(f'{pmid}: pilot cannot declare a formal RoB rating')
    if draft['outcome'].get('nnt') is not None or draft['outcome'].get('nnh') is not None:
        raise ValueError(f'{pmid}: derived NNT/NNH is outside this pilot')
    extraction = draft['extraction']
    if extraction['method'] != 'source-assisted' or extraction.get('model') is not None:
        raise ValueError(f'{pmid}: this builder only publishes source-assisted drafts')
    if extraction['clinicalContext'] not in CONTEXTS:
        raise ValueError(f'{pmid}: invalid clinical context')
    if extraction['reviewStatus'] != 'Draft — needs clinical review':
        raise ValueError(f'{pmid}: missing draft review status')
    text = normalize(full.get('bodyText', '') + '\n' + full.get('abstract', '') + '\n' + source.get('abstract', ''))
    evidence = extraction['evidence']
    if len(evidence) < 8:
        raise ValueError(f'{pmid}: insufficient source evidence')
    for item in evidence:
        quote = normalize(item['quote'])
        if len(quote) < 12 or quote not in text:
            raise ValueError(f'{pmid}: evidence quote not in primary source: {item["field"]}: {quote[:110]}')
        if len(quote) > 900:
            raise ValueError(f'{pmid}: shorten evidence excerpt for {item["field"]}')
        if item['sourceUrl'] not in [full['sourceUrl'], source['abstractSourceUrl']]:
            raise ValueError(f'{pmid}: evidence URL does not match source identity')
        if not item['location'].strip():
            raise ValueError(f'{pmid}: evidence location is missing')
    protocol = draft['treatmentProtocol']
    sources = {item['id']: item for item in protocol['sources']}
    for arm in protocol['arms']:
        if not arm.get('sourceIds') or any(key not in sources for key in arm['sourceIds']):
            raise ValueError(f'{pmid}: intervention arm lacks source references')
    return len(evidence)


def build(args):
    corpus = read_json(args.sources)
    sources = {item['pmid']: item for item in corpus['records']}
    screening_value = read_json(args.screening)
    screening = {item['pmid']: item for item in records_list(screening_value)}
    if set(screening) != set(sources):
        raise ValueError('Every candidate must have one screening decision, including exclusions')
    drafts = []
    for path in args.drafts:
        value = read_json(path)
        drafts.extend(value['trials'] if isinstance(value, dict) and 'trials' in value else records_list(value))
    if len({item['pmid'] for item in drafts}) != len(drafts):
        raise ValueError('Duplicate detailed draft PMID')
    fulls = {path.stem: read_json(path) for path in Path(args.fulltext_dir).glob('*.json')}
    trials = []
    quotes = 0
    for draft in drafts:
        source = sources[draft['pmid']]
        full = fulls[draft['pmid']]
        quotes += validate_draft(draft, source, full)
        trial = dict(draft)
        if trial['outcome'].get('pValue'):
            trial['outcome'] = {**trial['outcome'], 'pValue': re.sub(r'^[Pp]\s*(?=[<>=])', '', trial['outcome']['pValue']).strip()}
        trial.update({
            'id': source['pmid'], 'pmid': source['pmid'], 'title': source['title'],
            'authors': source['authors'], 'leadAuthor': source['authors'][0] if source['authors'] else 'Not listed',
            'seniorAuthor': source['authors'][-1] if source['authors'] else 'Not listed',
            'journal': source['journal'], 'journalAbbreviation': source['journalAbbreviation'],
            'year': int(publication_date(source)[:4]),
            'volume': source.get('volume', ''), 'issue': source.get('issue', ''), 'pages': source.get('pages', ''),
            'doi': source.get('doi'), 'highImpact': False,
            'specialties': ['Neuropathic Pain', 'Pharmacotherapy' if draft['interventionType'] == 'Drug' else 'Interventional Pain'],
            'abstract': source['abstract'],
            'provenance': {'source': 'pubmed-live', 'reviewedOn': None, 'status': 'Extraction draft', 'sourceUrl': source['abstractSourceUrl']},
        })
        trials.append(trial)
    trial_ids = {item['pmid'] for item in trials}
    records = []
    for pmid, source in sources.items():
        decision = screening[pmid]
        context = decision['category']
        if context not in CONTEXTS:
            raise ValueError(f'{pmid}: invalid screening category')
        reason = decision['reason']
        if source.get('withinPublicationWindow') is False:
            context = 'other'
            reason = 'Outside the publication window based on the earliest reported publication date. ' + reason
        records.append({
            'pmid': pmid, 'title': source['title'],
            'publicationDate': publication_date(source),
            'journal': source['journal'], 'publicationTypes': source['publicationTypes'],
            'sourceUrl': source['abstractSourceUrl'],
            'fullTextUrl': fulls[pmid]['sourceUrl'] if pmid in fulls else None,
            'category': context, 'reason': reason,
            'abstractAvailable': bool(source.get('abstract')), 'fullTextAvailable': pmid in fulls,
            'hasDetailed': pmid in trial_ids,
        })
    records.sort(key=lambda item: (item['publicationDate'], item['pmid']), reverse=True)
    trials.sort(key=lambda item: item['year'], reverse=True)
    result = {
        'schemaVersion': 1, 'topic': 'Postherpetic neuralgia',
        'generatedAt': datetime.now(timezone.utc).isoformat(),
        'scope': {'from': corpus['window']['from'], 'to': corpus['window']['to'], 'query': corpus['query']},
        'execution': {
            'mode': 'source-assisted', 'externalApiStatus': 'not-run',
            'note': 'These published drafts use source-assisted screening and full-text extraction. No successful external model extraction or API token usage is included in this snapshot. Source excerpts are traceable; this is not formal clinical appraisal.',
            'models': {'screening': None, 'fullText': None}, 'requests': 0, 'inputTokens': 0, 'outputTokens': 0, 'costUsd': 0,
        },
        'counts': {'candidates': len(records), 'abstracts': sum(item['abstractAvailable'] for item in records), 'fullTexts': len(fulls), 'detailed': len(trials)},
        'records': records, 'trials': trials,
    }
    if args.api_plan:
        plan = read_json(args.api_plan)
        if plan.get('apiCallsThisInvocation', 0) or plan.get('cumulativeActualCostUSD', 0):
            raise ValueError('A source-assisted cache cannot claim a paid execution did not run')
        result['execution'].update({
            'plannedMaxCostUsd': plan['conservativeReservedMaximumCostUSD'],
            'budgetCapUsd': plan['budgetCapUSD'],
        })
        if 'targetFulltextCount' in plan:
            result['execution']['plannedWorkflow'] = {
                'candidateCount': plan['candidateCount'], 'abstractCount': plan['abstractCount'],
                'targetFulltextCount': plan['targetFulltextCount'],
                'fulltextRatio': plan['fulltextSelection']['ratio'],
                'abstractModel': plan['models']['abstract'], 'fulltextModel': plan['models']['fulltext'],
            }
    Path(args.output).write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    if args.csv:
        with Path(args.csv).open('w', newline='') as handle:
            fields = ['pmid', 'title', 'publicationDate', 'journal', 'category', 'reason', 'abstractAvailable', 'fullTextAvailable', 'hasDetailed', 'sourceUrl', 'fullTextUrl']
            writer = csv.DictWriter(handle, fieldnames=fields, extrasaction='ignore')
            writer.writeheader()
            writer.writerows(records)
    print(json.dumps({'counts': result['counts'], 'validatedSourceExcerpts': quotes, 'output': args.output, 'externalModelCalls': 0}))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--sources', required=True)
    parser.add_argument('--screening', required=True)
    parser.add_argument('--drafts', nargs='+', required=True)
    parser.add_argument('--fulltext-dir', required=True)
    parser.add_argument('--output', default=str(ROOT / 'data/phn-pilot.json'))
    parser.add_argument('--csv')
    parser.add_argument('--api-plan', help='Optional zero-call dry-run usage report; estimates only')
    build(parser.parse_args())


if __name__ == '__main__':
    main()
