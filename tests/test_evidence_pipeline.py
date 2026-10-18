from datetime import date
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('collector', Path(__file__).parents[1] / 'scripts/update_evidence.py')
collector = importlib.util.module_from_spec(spec)
spec.loader.exec_module(collector)


class PipelineTests(unittest.TestCase):
    def test_calendar_windows_clamp_leap_days_and_month_ends(self):
        self.assertEqual(collector.shift_months(date(2024, 2, 29), -120), date(2014, 2, 28))
        self.assertEqual(collector.shift_months(date(2026, 5, 31), -3), date(2026, 2, 28))

    def test_publication_precision_does_not_invent_dates(self):
        self.assertEqual(collector.date_interval('2026 Oct'), (date(2026, 10, 1), date(2026, 10, 31), 'month'))
        self.assertIsNone(collector.date_interval('2026 Fall'))
        self.assertIsNone(collector.date_interval('2026 Feb 30'))
        self.assertEqual(collector.publication_interval({'epubdate': '2026 Jul 17', 'pubdate': '2026 Aug'})[0], date(2026, 7, 17))

    def test_jif_strict_threshold_year_verification_and_expiry(self):
        metric = dict(value=10.3, year=2025, verifiedOn='2026-10-18', verification='official')
        today = date(2026, 10, 18)
        self.assertTrue(collector.eligible_metric(metric, today))
        for invalid in [dict(value=10), dict(year=2023), dict(verification='unverified'), dict(verifiedOn='2025-01-01'), dict(verifiedOn='2026-12-01')]:
            self.assertFalse(collector.eligible_metric({**metric, **invalid}, today))

    def test_search_partitions_beyond_pubmed_limit_and_deduplicates(self):
        client = collector.Client()
        with patch.object(client, 'get', side_effect=[
            {'esearchresult': {'count': '10000', 'idlist': []}},
            {'esearchresult': {'count': '2', 'idlist': ['1', '2']}},
            {'esearchresult': {'count': '2', 'idlist': ['2', '3']}},
        ]):
            self.assertEqual(client.ids('pain', date(2026, 1, 1), date(2026, 1, 2)), {'1', '2', '3'})

    def test_incomplete_search_is_an_error(self):
        client = collector.Client()
        with patch.object(client, 'get', return_value={'esearchresult': {'count': '3', 'idlist': ['1']}}):
            with self.assertRaisesRegex(ValueError, 'Incomplete search'):
                client.ids('pain', date(2026, 1, 1), date(2026, 1, 2))

    def test_valid_zero_results_and_book_guidelines(self):
        client = collector.Client()
        with patch.object(client, 'get', return_value={'esearchresult': {'count': '0', 'idlist': [], 'errorlist': {'phrasesnotfound': [], 'fieldsnotfound': []}}}):
            self.assertEqual(client.ids('pain', date(2026, 1, 1), date(2026, 1, 2)), set())
        book = {'uid': '1', 'title': '', 'booktitle': 'Guideline title', 'publishername': 'Official publisher', 'pubdate': '2026 Jan'}
        normalized = collector.normalize(book, collector.publication_interval(book))
        self.assertEqual(normalized['title'], 'Guideline title')
        self.assertEqual(normalized['journal'], 'Official publisher')
        self.assertEqual(collector.clean_title('Pain <em>vs.</em> placebo &amp; care'), 'Pain vs. placebo & care')

    def test_first_publication_window_and_exact_issn(self):
        records = [
            {'uid': '1', 'title': 'Old electronic date', 'epubdate': '2026 Jul 17', 'pubdate': '2026 Aug', 'issn': '0001-0001'},
            {'uid': '2', 'title': 'Boundary included', 'epubdate': '2026 Jul 18', 'issn': '0001-0001'},
            {'uid': '3', 'title': 'Wrong journal', 'pubdate': '2026 Aug 1', 'issn': '9999-9999'},
            {'uid': '4', 'title': 'Month crosses boundary', 'pubdate': '2026 Oct', 'issn': '0001-0001'},
            {'uid': '5', 'title': 'Future paper', 'pubdate': '2026 Nov 1', 'issn': '0001-0001'},
        ]
        client = collector.Client()
        with patch.object(client, 'ids', return_value={str(i) for i in range(1, 6)}), patch.object(client, 'summaries', return_value=records):
            feed = collector.collect(client, 'pain', date(2026, 7, 18), date(2026, 10, 18), 'time', [{'id': 'exact', 'issns': ['0001-0001']}])
        self.assertEqual([r['pmid'] for r in feed['records']], ['2'])
        self.assertEqual(feed['excludedDates'], 3)
        self.assertEqual(feed['excludedJournal'], 1)

    def test_failed_refresh_preserves_records_and_success_timestamp(self):
        old_feed = dict(records=[{'pmid': '1', 'title': 'Keep me'}], lastSuccessAt='2026-10-17T00:00:00Z', status='ok', matched=1)
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'snapshot.json'
            path.write_text(json.dumps({'feeds': {name: old_feed for name in ['trials', 'guidelines', 'recent']}, 'sources': []}))
            with patch.object(collector, 'collect', side_effect=OSError('network unavailable')), patch.object(collector, 'check_source', side_effect=lambda s, p, t: s):
                code = collector.update(date(2026, 10, 18), path, Path(folder) / 'preview.json')
            updated = json.loads(path.read_text())
            self.assertEqual(code, 1)
            self.assertEqual(updated['feeds']['trials']['records'], old_feed['records'])
            self.assertEqual(updated['feeds']['trials']['lastSuccessAt'], old_feed['lastSuccessAt'])
            self.assertEqual(updated['feeds']['trials']['status'], 'error')


if __name__ == '__main__':
    unittest.main()
