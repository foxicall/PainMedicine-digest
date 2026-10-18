#!/usr/bin/env python3
"""Reproducible, rate-limited PubMed index. No model-generated clinical claims.

Each feed is replaced only after every query partition and summary batch succeeds.
Failures keep its last successful records AND timestamp. Exact rolling windows use
the first publication date (electronic where available); incomplete dates are kept
only when the whole reported month/year lies inside the requested window.
"""
import argparse
import calendar
from datetime import date, datetime, timedelta, timezone
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import sys
import time
from urllib.error import HTTPError
from urllib.parse import urlencode, urljoin, urlsplit
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
PAIN = '("Pain"[Mesh] OR "Pain Management"[Mesh] OR "Neuropathic Pain" OR "Chronic Pain" OR "Migraine Disorders"[Mesh] OR pain[tiab] OR migraine[tiab] OR headache[tiab] OR neuralgia[tiab])'
TRIAL = '("clinical trial"[pt] OR "randomized controlled trial"[pt])'
GUIDELINE = '("guideline"[pt] OR "practice guideline"[pt])'
BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/'
MONTHS = {name.lower(): i for i, name in enumerate(calendar.month_abbr) if name}


def shift_months(day, months):
    year, month = divmod(day.year * 12 + day.month - 1 + months, 12)
    return date(year, month + 1, min(day.day, calendar.monthrange(year, month + 1)[1]))


def date_interval(raw):
    """Return a publication date's uncertainty interval without inventing a day."""
    match = re.match(r'^(\d{4})(?:[ /-]([A-Za-z]{3}|\d{1,2}))?(?:[ /-](\d{1,2}))?$', raw.strip())
    if not match:
        return None
    year, month, day = match.groups()
    year = int(year)
    try:
        if month is None:
            return date(year, 1, 1), date(year, 12, 31), 'year'
        month = MONTHS.get(month.lower(), int(month) if month.isdigit() else 0)
        if day is None:
            return date(year, month, 1), date(year, month, calendar.monthrange(year, month)[1]), 'month'
        value = date(year, month, int(day))
        return value, value, 'day'
    except ValueError:
        return None


def publication_interval(record):
    # Prefer explicit e-publication over a later print issue date. Do not use
    # indexing/Entrez dates as publication dates.
    for field in ('epubdate', 'pubdate'):
        interval = date_interval(record.get(field, ''))
        if interval:
            return (*interval, 'electronic' if field == 'epubdate' else 'journal issue')
    return None


def eligible_metric(metric, today):
    verified = metric.get('verifiedOn')
    return (metric.get('verification') == 'official' and isinstance(metric.get('value'), (int, float))
            and metric['value'] > 10 and isinstance(metric.get('year'), int)
            and today.year - 2 <= metric['year'] < today.year and bool(verified)
            and 0 <= (today - date.fromisoformat(verified)).days <= 365)


class Client:
    def __init__(self):
        self.last_request = 0

    def get(self, endpoint, **params):
        url = BASE + endpoint + '?' + urlencode({'db': 'pubmed', 'tool': 'pain_medicine_trial_digest', 'retmode': 'json', **params})
        for attempt in range(4):
            time.sleep(max(0, .42 - (time.monotonic() - self.last_request)))
            self.last_request = time.monotonic()
            try:
                with urlopen(Request(url, headers={'User-Agent': 'PainMedicineTrialDigest/1.0'}), timeout=45) as response:
                    value = json.load(response)
                if 'error' in value:
                    raise ValueError(str(value['error']))
                return value
            except (HTTPError, OSError, ValueError) as error:
                if isinstance(error, HTTPError) and error.code not in (429, 500, 502, 503, 504):
                    raise
                if attempt == 3:
                    raise
                time.sleep(2 ** attempt)

    def ids(self, term, start, end):
        # Recursive date partitions avoid PubMed's 9,999-result ESearch limit.
        query = f'({term}) AND ("{start.isoformat()}"[dp] : "{end.isoformat()}"[dp])'
        data = self.get('esearch.fcgi', term=query, retmax=9999)['esearchresult']
        if any(data.get('errorlist', {}).values()):
            raise ValueError(f'PubMed query error: {data["errorlist"]}')
        count = int(data['count'])
        if count > 9999:
            if start == end:
                raise ValueError('More than 9,999 records on one date; refusing a truncated feed')
            midpoint = start + (end - start) // 2
            return self.ids(term, start, midpoint) | self.ids(term, midpoint + timedelta(days=1), end)
        ids = data['idlist']
        if len(ids) != count:
            raise ValueError(f'Incomplete search: {len(ids)} of {count} IDs')
        return set(ids)

    def summaries(self, ids):
        ordered = sorted(ids, key=int)
        records = []
        for offset in range(0, len(ordered), 200):
            batch = ordered[offset:offset + 200]
            result = self.get('esummary.fcgi', id=','.join(batch))['result']
            if set(result.get('uids', [])) != set(batch):
                raise ValueError('Incomplete article summary batch')
            for uid in batch:
                record = result[uid]
                if record.get('error') or not (record.get('title') or record.get('booktitle')):
                    raise ValueError(f'Invalid article summary: {uid}')
                records.append(record)
            if offset % 2000 == 0:
                print(f'  retrieved {min(offset + 200, len(ordered))}/{len(ordered)}', flush=True)
        return records


class PlainText(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts = []

    def handle_data(self, data):
        self.parts.append(data)


def clean_title(value):
    parser = PlainText()
    parser.feed(value)
    return ''.join(parser.parts).strip()


def normalize(record, interval):
    start, _, precision, basis = interval
    return {
        'pmid': record['uid'], 'title': clean_title(record.get('title') or record.get('booktitle', '')),
        'authors': [author['name'] for author in record.get('authors', [])],
        'journal': record.get('fulljournalname') or record.get('publishername', ''), 'journalAbbreviation': record.get('source') or record.get('publishername', ''),
        'issns': sorted({v for v in (record.get('issn'), record.get('essn')) if v}),
        'publicationDate': start.isoformat(), 'datePrecision': precision, 'dateBasis': basis,
        'publicationTypes': record.get('pubtype', []),
        'doi': next((a['value'] for a in record.get('articleids', []) if a['idtype'] == 'doi'), None),
        'volume': record.get('volume', ''), 'issue': record.get('issue', ''), 'pages': record.get('pages', ''),
    }


def collect(client, term, start, end, timestamp, metrics=None):
    ids = client.ids(term, start, end)
    rows, excluded_dates, excluded_journal = [], 0, 0
    for raw in client.summaries(ids):
        interval = publication_interval(raw)
        if not interval or not (start <= interval[0] and interval[1] <= end):
            excluded_dates += 1
            continue
        row = normalize(raw, interval)
        if metrics is not None:
            match = next((m for m in metrics if set(m['issns']) & set(row['issns'])), None)
            if not match:
                excluded_journal += 1
                continue
            row['metricId'] = match['id']
        rows.append(row)
    rows.sort(key=lambda row: (row['publicationDate'], int(row['pmid'])), reverse=True)
    return {'records': rows, 'query': term, 'from': start.isoformat(), 'to': end.isoformat(),
            'matched': len(ids), 'excludedDates': excluded_dates, 'excludedJournal': excluded_journal,
            'lastSuccessAt': timestamp, 'status': 'ok'}


class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.href, self.parts, self.links = None, [], []

    def handle_starttag(self, tag, attrs):
        if tag == 'a':
            self.href, self.parts = dict(attrs).get('href'), []

    def handle_data(self, data):
        if self.href:
            self.parts.append(data)

    def handle_endtag(self, tag):
        if tag == 'a' and self.href:
            self.links.append((self.href, ' '.join(' '.join(self.parts).split())))
            self.href, self.parts = None, []


def check_source(source, previous, timestamp):
    result = {**source, 'checkedAt': timestamp}
    try:
        with urlopen(Request(source['url'], headers={'User-Agent': 'PainMedicineTrialDigest/1.0 (+https://github.com/foxicall/PainMedicine-digest)'}), timeout=20) as response:
            if 'html' not in response.headers.get('Content-Type', ''):
                raise ValueError('Expected an official HTML source page')
            body = response.read(4_000_000).decode('utf-8', errors='replace')
            final_url = response.url
        parser = Links()
        parser.feed(body)
        host = urlsplit(final_url).hostname
        links = {}
        for href, title in parser.links:
            url = urljoin(final_url, href).split('#')[0]
            if (urlsplit(url).scheme == 'https' and urlsplit(url).hostname == host and len(title) > 12
                    and re.search(r'pain|migraine|headache|schmerz|疼痛|痛み|頭痛|神経障害', title, re.I)):
                links[url] = {'title': title[:300], 'url': url}
        result.update(status='ok', lastSuccessAt=timestamp, links=list(links.values())[:30])
    except Exception as error:
        result.update(status='error', error=str(error)[:200], lastSuccessAt=previous.get('lastSuccessAt'), links=previous.get('links', []))
    return result


def atomic_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix('.tmp')
    temporary.write_text(json.dumps(value, ensure_ascii=False, separators=(',', ':')) + '\n')
    temporary.replace(path)


def update(today, output, preview_output, client=None, feeds=None):
    timestamp = datetime.now(timezone.utc).isoformat(timespec='seconds')
    previous = json.loads(output.read_text()) if output.exists() else {'feeds': {}, 'sources': []}
    metrics = json.loads((ROOT / 'data/journal-metrics.json').read_text())
    eligible = [m for m in metrics if eligible_metric(m, today)]
    journals = ' OR '.join(f'"{issn}"[jour]' for m in eligible for issn in m['issns'])
    definitions = {
        'trials': (f'{PAIN} AND {TRIAL}', shift_months(today, -120), None),
        # No age cutoff on guidelines: older guidance can remain current. This
        # discovers indexed guidance; it does not certify currency or endorsement.
        'guidelines': (f'{PAIN} AND {GUIDELINE}', date(1900, 1, 1), None),
        'recent': (f'{PAIN} AND ({journals})', shift_months(today, -3), eligible),
    }
    snapshot = {'schemaVersion': 1, 'attemptedAt': timestamp, 'preview': False, 'feeds': {}, 'metrics': metrics}
    failed = False
    client = client or Client()
    for name, (term, start, metric_filter) in definitions.items():
        if feeds is not None and name not in feeds:
            if name not in previous['feeds']:
                raise ValueError('A partial update requires an existing snapshot for other feeds')
            snapshot['feeds'][name] = previous['feeds'][name]
            continue
        print(f'Updating {name}: {start} to {today}', flush=True)
        try:
            if name == 'recent' and not eligible:
                raise ValueError('No verified, unexpired journal metrics qualify for JIF >10')
            feed = collect(client, term, start, today, timestamp, metric_filter)
        except Exception as error:
            failed = True
            feed = {**previous['feeds'].get(name, {'records': [], 'query': term, 'from': start.isoformat(), 'to': today.isoformat(), 'matched': 0, 'excludedDates': 0, 'excludedJournal': 0, 'lastSuccessAt': None}), 'status': 'error', 'error': str(error)[:300]}
            print(f'  ERROR: {feed["error"]}', file=sys.stderr, flush=True)
        snapshot['feeds'][name] = feed
        print(f'  {len(feed["records"])} eligible records; {feed["status"]}', flush=True)
    old_sources = {s['id']: s for s in previous.get('sources', [])}
    snapshot['sources'] = [check_source(s, old_sources.get(s['id'], {}), timestamp) for s in json.loads((ROOT / 'data/guideline-sources.json').read_text())]
    atomic_json(output, snapshot)
    preview = {**snapshot, 'preview': True, 'feeds': {key: {**feed, 'records': feed['records'][:12]} for key, feed in snapshot['feeds'].items()}}
    atomic_json(preview_output, preview)
    print(f'Wrote {output} ({output.stat().st_size / 1_000_000:.1f} MB)', flush=True)
    return 1 if failed else 0


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--today', type=date.fromisoformat, default=date.today())
    parser.add_argument('--output', type=Path, default=ROOT / 'public/data/evidence.json')
    parser.add_argument('--preview-output', type=Path, default=ROOT / 'data/evidence-preview.json')
    parser.add_argument('--feeds', nargs='+', choices=['trials', 'guidelines', 'recent'])
    args = parser.parse_args()
    sys.exit(update(args.today, args.output, args.preview_output, feeds=args.feeds))
