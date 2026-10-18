#!/usr/bin/env python3
"""Collect a reproducible PHN source corpus without calling a language model.

Uses free NCBI E-utilities and Europe PMC fullTextXML. Caches source responses;
does not request subscription content or send any API credential. Copyright and
license statements remain attached to retrieved full texts.
"""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import re
import time
from urllib.error import HTTPError
from urllib.parse import urlencode
from urllib.request import Request, urlopen
import xml.etree.ElementTree as ET

from update_evidence import date_interval
from extract_phn_pilot import fulltext_exclusion, fulltext_target, ranked_records

BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/'
QUERY = ('("Neuralgia, Postherpetic"[Mesh] OR postherpetic[tiab] OR "post-herpetic"[tiab]) '
         'AND ("clinical trial"[pt] OR "randomized controlled trial"[pt] '
         'OR "guideline"[pt] OR "practice guideline"[pt]) '
         'AND ("2016-10-18"[dp] : "2026-10-18"[dp])')


def text(element):
    return re.sub(r'\s+', ' ', ''.join(element.itertext())).strip() if element is not None else ''


class Client:
    def __init__(self, cache):
        self.cache = cache
        self.last = 0
        cache.mkdir(parents=True, exist_ok=True)

    def get(self, url, name):
        path = self.cache / name
        if path.exists():
            return path.read_bytes()
        for attempt in range(5):
            time.sleep(max(0, .42 - (time.monotonic() - self.last)))
            self.last = time.monotonic()
            try:
                with urlopen(Request(url, headers={'User-Agent': 'PainMedicineTrialDigest-PHNPilot/1.0'}), timeout=60) as response:
                    data = response.read()
                path.write_bytes(data)
                return data
            except (HTTPError, OSError) as error:
                if isinstance(error, HTTPError) and error.code not in (408, 429, 500, 502, 503, 504):
                    raise
                if attempt == 4:
                    raise
                time.sleep(2 ** attempt)

    def eutils(self, endpoint, name, **params):
        url = BASE + endpoint + '?' + urlencode({'tool': 'pain_medicine_trial_digest', **params})
        return self.get(url, name)


def article_record(article, previous=None):
    previous = previous or {}
    medline = article.find('MedlineCitation')
    source = medline.find('Article')
    pmid = text(medline.find('PMID'))
    ids = {item.get('IdType'): text(item) for item in article.findall('./PubmedData/ArticleIdList/ArticleId')}
    abstract = [{'label': item.get('Label', ''), 'category': item.get('NlmCategory', ''), 'text': text(item)}
                for item in source.findall('./Abstract/AbstractText')]
    comments = [{'type': item.get('RefType'), 'pmid': text(item.find('PMID')),
                 'source': text(item.find('RefSource')), 'note': text(item.find('Note'))}
                for item in medline.findall('./CommentsCorrectionsList/CommentsCorrections')]
    date_node = next(iter(source.findall('./ArticleDate[@DateType="Electronic"]')), None)
    if date_node is None:
        date_node = source.find('./Journal/JournalIssue/PubDate')
    parts = [text(date_node.find(tag)) for tag in ('Year', 'Month', 'Day')] if date_node is not None else []
    pubdate = '-'.join(part.zfill(2) if part.isdigit() and i else part for i, part in enumerate(parts) if part)
    interval = date_interval(pubdate)
    types = [text(item) for item in source.findall('./PublicationTypeList/PublicationType')]
    return {**previous, 'pmid': pmid, 'title': text(source.find('ArticleTitle')),
            'journal': text(source.find('./Journal/Title')),
            'journalAbbreviation': text(source.find('./Journal/ISOAbbreviation')),
            'authors': [text(a.find('CollectiveName')) or ' '.join(filter(None, [text(a.find('LastName')), text(a.find('Initials'))]))
                        for a in source.findall('./AuthorList/Author')],
            'doi': ids.get('doi', previous.get('doi')), 'pmcid': ids.get('pmc'),
            'publicationTypes': types, 'sourcePublicationDate': pubdate,
            'sourceDateInterval': {'from': interval[0].isoformat(), 'to': interval[1].isoformat(), 'precision': interval[2]} if interval else None,
            'withinPublicationWindow': bool(interval and '2016-10-18' <= interval[0].isoformat() and interval[1].isoformat() <= '2026-10-18'),
            'abstractSections': abstract, 'abstract': '\n\n'.join((section['label'] + ': ' if section['label'] else '') + section['text'] for section in abstract),
            'commentsCorrections': comments,
            'integrityFlags': [value for value in types if any(term in value.lower() for term in ('retract', 'expression of concern', 'corrected'))]
                              + [item['type'] for item in comments if any(term in item['type'].lower() for term in ('retract', 'expressionofconcern'))],
            'meshTerms': [text(item) for item in medline.findall('./MeshHeadingList/MeshHeading/DescriptorName')],
            'abstractSourceUrl': f'https://pubmed.ncbi.nlm.nih.gov/{pmid}/',
            'efetchSourceUrl': BASE + 'efetch.fcgi?' + urlencode({'db': 'pubmed', 'id': pmid, 'retmode': 'xml'}),
            'retrievedAt': datetime.now(timezone.utc).isoformat()}


def fulltext_record(xml, row, url):
    root = ET.fromstring(xml)
    article = root if root.tag == 'article' else root.find('.//article')
    if article is None or article.find('body') is None:
        raise ValueError('Response does not contain a full article body')
    sections = []
    for section in article.findall('./body//sec'):
        paragraphs = [text(p) for p in section.findall('./p')]
        tables = [text(table) for table in section.findall('./table-wrap')]
        if paragraphs or tables:
            sections.append({'id': section.get('id', ''), 'type': section.get('sec-type', ''),
                             'title': text(section.find('title')), 'paragraphs': paragraphs, 'tables': tables})
    numeric = []
    for section in sections:
        for paragraph in section['paragraphs'] + section['tables']:
            if re.search(r'\d', paragraph) and re.search(r'\b(?:mg|mcg|μg|µg|ml|mL|Hz|V|volt|puls|random|allocat|patient|dose|duration|min|second|electrod|catheter|dexamethasone|lidocaine|bupivacaine|ropivacaine)\b', paragraph, re.I):
                numeric.append({'section': section['title'], 'text': paragraph})
    return {'pmid': row['pmid'], 'pmcid': row['pmcid'], 'title': row['title'],
            'sourceUrl': f'https://pmc.ncbi.nlm.nih.gov/articles/{row["pmcid"]}/',
            'xmlSourceUrl': url, 'retrievedAt': datetime.now(timezone.utc).isoformat(),
            'license': [{'type': item.get('license-type', ''), 'url': item.get('{http://www.w3.org/1999/xlink}href', '') or next((link.get('{http://www.w3.org/1999/xlink}href', '') for link in item.findall('.//ext-link')), ''), 'text': text(item)}
                        for item in article.findall('.//permissions/license')],
            'copyright': [text(item) for item in article.findall('.//copyright-statement')],
            'abstract': text(article.find('./front/article-meta/abstract')),
            'sections': sections, 'numericParameterParagraphs': numeric,
            'bodyText': text(article.find('body'))}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--candidates', default=str(Path(__file__).resolve().parents[1] / 'data/phn-pilot.json'))
    parser.add_argument('--output', default='/tmp/pain-phn-source-records.json')
    parser.add_argument('--cache', default='/tmp/pain-phn-source-cache')
    parser.add_argument('--fulltext-directory', default='/tmp/pain-phn-fulltexts')
    parser.add_argument('--fulltext-target', type=int, help='Override ceil(10%% of candidates); collect more for screening replacements')
    args = parser.parse_args()
    client = Client(Path(args.cache))
    if args.fulltext_target is not None and args.fulltext_target < 0:
        parser.error('--fulltext-target must be nonnegative')
    candidates = json.loads(Path(args.candidates).read_text())
    existing = {str(row['pmid']): row for row in (candidates if isinstance(candidates, list) else candidates['records'])}
    search = json.loads(client.eutils('esearch.fcgi', 'phn-search.json', db='pubmed', term=QUERY, retmode='json', retmax=9999))['esearchresult']
    if len(search['idlist']) != int(search['count']):
        raise ValueError('Search response truncated')
    ids = sorted(set(existing) | set(search['idlist']), key=int)
    rows = []
    for offset in range(0, len(ids), 100):
        batch = ids[offset:offset + 100]
        xml = client.eutils('efetch.fcgi', f'pubmed-{offset:04d}-{len(batch)}.xml', db='pubmed', id=','.join(batch), retmode='xml')
        parsed = ET.fromstring(xml)
        returned = set()
        for article in parsed.findall('PubmedArticle'):
            pmid = text(article.find('./MedlineCitation/PMID'))
            returned.add(pmid)
            row = article_record(article, existing.get(pmid))
            row['candidateOrigin'] = 'existing-index-title-match' if pmid in existing else 'supplemental-PHN-specific-search'
            rows.append(row)
        if returned != set(batch):
            raise ValueError(f'Missing efetch records: {set(batch) - returned}')
        print(f'Retrieved abstracts {len(rows)}/{len(ids)}', flush=True)
    rows.sort(key=lambda row: (row.get('publicationDate', row['sourcePublicationDate']), int(row['pmid'])), reverse=True)
    fulltext_dir = Path(args.fulltext_directory)
    fulltext_dir.mkdir(parents=True, exist_ok=True)
    target = fulltext_target(len(rows), args.fulltext_target)
    fulltext_rows = ranked_records([row for row in rows if row.get('pmcid') and not fulltext_exclusion(row)])
    fulltext_count = 0
    for row in fulltext_rows:
        if fulltext_count >= target:
            break
        url = f'https://www.ebi.ac.uk/europepmc/webservices/rest/{row["pmcid"]}/fullTextXML'
        try:
            try:
                xml = client.get(url, f'{row["pmcid"]}.xml')
            except (HTTPError, OSError):
                # A second documented public API; neither requires a key or a
                # subscription. A failure on both leaves abstract-only coverage.
                url = BASE + 'efetch.fcgi?' + urlencode({'db': 'pmc', 'id': row['pmcid'], 'retmode': 'xml'})
                xml = client.get(url, f'{row["pmcid"]}-ncbi.xml')
            result = fulltext_record(xml, row, url)
            (fulltext_dir / f'{row["pmid"]}.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
            row['fulltextSource'] = {'url': result['sourceUrl'], 'xmlUrl': url, 'license': result['license'], 'localFile': str(fulltext_dir / f'{row["pmid"]}.json')}
            fulltext_count += 1
            print(f'Full text {fulltext_count}: {row["pmid"]} {row["title"]}', flush=True)
        except (HTTPError, OSError, ET.ParseError, ValueError) as error:
            row['fulltextRetrievalError'] = f'{type(error).__name__}: {error}'
            print(f'Full text unavailable {row["pmid"]}: {error}', flush=True)
    output = {'query': QUERY, 'window': {'from': '2016-10-18', 'to': '2026-10-18'},
              'searchCount': int(search['count']), 'initialCandidates': len(existing),
              'supplementalCandidates': len(set(search['idlist']) - set(existing)),
              'retrievedAt': datetime.now(timezone.utc).isoformat(), 'fulltextCount': fulltext_count,
              'fulltextTarget': target, 'fulltextShortfall': max(0, target - fulltext_count),
              'records': rows}
    Path(args.output).write_text(json.dumps(output, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({key: value for key, value in output.items() if key != 'records'}), flush=True)


if __name__ == '__main__':
    main()
