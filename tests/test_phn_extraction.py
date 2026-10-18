"""No-network tests for extraction provenance, spend limits and resumability."""
from contextlib import redirect_stdout
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import Mock, patch
from urllib.error import HTTPError


spec = importlib.util.spec_from_file_location(
    'phn_extraction', Path(__file__).parents[1] / 'scripts/extract_phn_pilot.py')
pilot = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pilot)

RECORD = {
    'pmid': '1234', 'title': 'A randomized trial for postherpetic neuralgia.',
    'abstract': 'Forty patients with established PHN received drug 25 mg daily or placebo.',
    'publicationTypes': ['Randomized Controlled Trial'],
}
FULLTEXT = {
    'pmid': '1234', 'sourceUrl': 'https://pmc.ncbi.nlm.nih.gov/articles/PMC1234/',
    'sections': [{'title': 'Methods', 'paragraphs': ['Drug 25 mg daily was given for six weeks.'], 'tables': []}],
}


def blank(schema):
    types = schema['type']
    if isinstance(types, list) and 'null' in types:
        return None
    if types == 'object':
        return {key: blank(value) for key, value in schema['properties'].items()}
    if types == 'array':
        return []
    return (schema.get('enum') or ['placeholder'])[0]


def extraction(category='established-phn-treatment'):
    result = blank(pilot.EXTRACTION_SCHEMA)
    result.update(schemaVersion=pilot.SCHEMA_VERSION, pmid='1234')
    result['screening']['category'] = category
    result['screening']['reason'] = 'The source describes PHN patients.'
    result['interventionArms'] = [blank(pilot.ARM)]
    result['interventionArms'][0]['dose'] = '25 mg daily'
    result['missingFields'] = ['injected volume', 'random sequence generation']
    result['evidence'] = [
        {'field': '/screening/category', 'quote': 'patients with established PHN', 'sourceLocation': 'abstract'},
        {'field': '/screening/reason', 'quote': 'patients with established PHN', 'sourceLocation': 'abstract'},
        {'field': '/interventionArms/0/dose', 'quote': 'drug 25 mg daily', 'sourceLocation': 'abstract'},
    ]
    return result


def response(result=None, status='completed'):
    return {'id': 'resp_fixture', 'status': status,
            'usage': {'input_tokens': 1000, 'output_tokens': 200,
                      'output_tokens_details': {'reasoning_tokens': 50}},
            'output': [{'content': [{'type': 'output_text', 'text': json.dumps(result or extraction())}]}]}


class PHNExtractionTests(unittest.TestCase):
    def setUp(self):
        self.task = pilot.make_task(RECORD, 'gpt-6-luna')

    def test_exact_normalized_quote_and_required_clinical_evidence(self):
        result = extraction()
        result['evidence'][2]['quote'] = 'drug\u00a025 mg\n daily'
        self.assertIs(pilot.validate_extraction(result, self.task), result)
        result['sampleSize'] = 40
        with self.assertRaisesRegex(ValueError, 'lack source quotes: /sampleSize'):
            pilot.validate_extraction(result, self.task)

    def test_fabricated_spliced_or_wrong_location_quotes_rejected(self):
        for quote, location in [('drug 50 mg daily', 'abstract'),
                                ('patients ... drug 25 mg daily', 'abstract'),
                                ('drug 25 mg daily', 'invented-methods')]:
            with self.subTest(quote=quote, location=location):
                result = extraction()
                result['evidence'][2].update(quote=quote, sourceLocation=location)
                with self.assertRaises(ValueError):
                    pilot.validate_extraction(result, self.task)

    def test_schema_rejects_wrong_identity_and_invented_fields(self):
        result = extraction()
        result['pmid'] = '9999'
        with self.assertRaisesRegex(ValueError, 'PMID'):
            pilot.validate_extraction(result, self.task)
        result = extraction()
        result['formalRiskOfBias'] = 'low'
        with self.assertRaisesRegex(ValueError, 'extra fields'):
            pilot.validate_extraction(result, self.task)

    def test_fulltext_is_distinct_source_and_preserves_locations(self):
        full = pilot.make_task(RECORD, 'gpt-6.1-sol', FULLTEXT)
        self.assertNotEqual(self.task['sourceHash'], full['sourceHash'])
        self.assertEqual(full['units'][-1]['id'], 'sections/0/paragraphs/0')
        self.assertEqual(full['units'][-1]['url'], FULLTEXT['sourceUrl'])
        with self.assertRaisesRegex(ValueError, 'PMID'):
            pilot.make_task(RECORD, 'gpt-6.1-sol', {**FULLTEXT, 'pmid': '9999'})
        with self.assertRaisesRegex(ValueError, 'no body'):
            pilot.make_task(RECORD, 'gpt-6.1-sol', {'pmid': '1234'})

    def test_cache_invalidation_includes_source_model_and_prompt(self):
        same = pilot.make_task(dict(RECORD), 'gpt-6-luna')
        changed = pilot.make_task({**RECORD, 'abstract': RECORD['abstract'] + ' Updated.'}, 'gpt-6-luna')
        strong = pilot.make_task(RECORD, 'gpt-6.1-sol')
        with patch.object(pilot, 'PROMPT_VERSION', 'next-version'):
            updated_prompt = pilot.make_task(RECORD, 'gpt-6-luna')
        self.assertEqual(self.task['cacheKey'], same['cacheKey'])
        self.assertEqual(len({self.task['cacheKey'], changed['cacheKey'], strong['cacheKey'], updated_prompt['cacheKey']}), 4)

    def test_real_usage_counted_once_reasoning_already_in_output(self):
        usage = pilot.response_usage(response())
        self.assertEqual(usage['reasoningTokens'], 50)
        self.assertAlmostEqual(pilot.token_cost('gpt-6-luna', 1000, 200), 0.0002)
        self.assertAlmostEqual(pilot.token_cost('gpt-6.1-sol', 1000, 200), 0.004)
        requester = Mock(return_value=response())
        with tempfile.TemporaryDirectory() as directory:
            entry, spent = pilot.execute_task(self.task, 'fixture-not-a-key', directory, 10, 0, requester=requester)
            self.assertEqual(entry['status'], 'validated')
            self.assertAlmostEqual(entry['actualCostUSD'], 0.0002)
            self.assertAlmostEqual(spent, 0.0002)
            cached, again = pilot.execute_task(self.task, 'fixture-not-a-key', directory, 10, spent, requester=requester)
            self.assertTrue(cached['cacheHit'])
            self.assertEqual(again, spent)
            requester.assert_called_once()

    def test_preflight_budget_blocks_request_and_does_not_create_cache(self):
        requester = Mock()
        with tempfile.TemporaryDirectory() as directory:
            entry, spent = pilot.execute_task(self.task, 'fixture-not-a-key', directory, 0.000001, 0, requester=requester)
            self.assertEqual(entry['status'], 'budget-stopped')
            self.assertEqual(spent, 0)
            self.assertEqual(list(Path(directory).iterdir()), [])
        requester.assert_not_called()

    def test_uncertain_timeout_is_reserved_persisted_and_never_repeated(self):
        requester = Mock(side_effect=pilot.APIFailure('Timeout; unknown billing', ambiguous=True, retryable=True))
        with tempfile.TemporaryDirectory() as directory:
            entry, spent = pilot.execute_task(self.task, 'fixture-not-a-key', directory, 10, 0, retries=2, requester=requester)
            self.assertEqual(entry['status'], 'transport-error')
            self.assertEqual(spent, self.task['reservedMaximumCostUSD'])
            self.assertEqual(entry['uncertainReservedCostUSD'], spent)
            cached, _ = pilot.execute_task(self.task, 'fixture-not-a-key', directory, 10, spent, requester=requester)
            self.assertTrue(cached['cacheHit'])
            requester.assert_called_once()

    def test_rate_limit_retries_are_bounded_and_not_claimed_as_charges(self):
        requester = Mock(side_effect=pilot.APIFailure('OpenAI HTTP 429', retryable=True))
        with tempfile.TemporaryDirectory() as directory, patch.object(pilot.time, 'sleep'):
            entry, spent = pilot.execute_task(self.task, 'fixture-not-a-key', directory, 10, 0, retries=1, requester=requester)
            self.assertEqual(requester.call_count, 2)
            self.assertEqual(len(entry['attempts']), 2)
            self.assertEqual(spent, 0)
            self.assertEqual(entry['actualCostUSD'], 0)

    def test_http_error_body_and_secret_are_never_exposed(self):
        secret = 'fixture-sensitive-key-never-log'
        error = HTTPError(pilot.API_URL, 401, 'bad key ' + secret, {}, io.BytesIO(secret.encode()))
        opener = Mock(side_effect=error)
        with self.assertRaises(pilot.APIFailure) as caught:
            pilot.request_api(self.task, secret, opener)
        self.assertEqual(str(caught.exception), 'OpenAI HTTP 401; response body omitted')
        self.assertNotIn(secret, str(caught.exception))

    def test_incomplete_or_ungrounded_response_is_billed_but_not_upgraded(self):
        for bad_response in [response(status='incomplete'), response({**extraction(), 'sampleSize': 40})]:
            requester = Mock(return_value=bad_response)
            strong = pilot.make_task(RECORD, 'gpt-6.1-sol', FULLTEXT)
            report = pilot.new_report([self.task], [strong], 10)
            with tempfile.TemporaryDirectory() as directory:
                pilot.execute_plan(report, [self.task], [strong], directory, 'fixture-not-a-key', requester=requester)
            self.assertEqual(report['results'][0]['status'], 'rejected')
            self.assertEqual(report['results'][1]['status'], 'not-upgraded')
            self.assertAlmostEqual(report['cumulativeActualCostUSD'], 0.0002)
            requester.assert_called_once()

    def test_prevention_is_explicit_context_and_mixed_requires_separable_population(self):
        strong = pilot.make_task(RECORD, 'gpt-6.1-sol', FULLTEXT)
        for category, expected_calls in [('phn-prevention', 2), ('not-phn-treatment', 1), ('mixed-population', 1)]:
            requester = Mock(side_effect=[response(extraction(category)), response(extraction(category))])
            report = pilot.new_report([self.task], [strong], 10)
            with tempfile.TemporaryDirectory() as directory:
                pilot.execute_plan(report, [self.task], [strong], directory, 'fixture-not-a-key', requester=requester)
            self.assertEqual(requester.call_count, expected_calls)

    def test_resume_cap_counts_old_cache_cost(self):
        second = pilot.make_task({**RECORD, 'pmid': '5678'}, 'gpt-6-luna')
        requester = Mock(return_value=response())
        with tempfile.TemporaryDirectory() as directory:
            pilot.execute_task(self.task, 'fixture-not-a-key', directory, 10, 0, requester=requester)
            cap = self.task['reservedMaximumCostUSD']
            report = pilot.new_report([self.task, second], [], cap)
            pilot.execute_plan(report, [self.task, second], [], directory, 'fixture-not-a-key', requester=requester)
            self.assertEqual(report['status'], 'stopped')
            self.assertEqual(report['results'][-1]['status'], 'budget-stopped')
            requester.assert_called_once()

    def test_dry_run_does_not_read_credentials_or_call_api(self):
        with tempfile.TemporaryDirectory() as directory:
            folder = Path(directory)
            source = folder / 'source.json'
            output = folder / 'usage.json'
            source.write_text(json.dumps({'records': [RECORD]}))
            original_get = pilot.os.environ.get

            def environment_get(name, default=None):
                if name == 'OPENAI_API_KEY':
                    raise AssertionError('No credential access')
                return original_get(name, default)

            with patch.object(pilot, 'request_api') as network, patch.object(pilot.os.environ, 'get', side_effect=environment_get):
                with redirect_stdout(io.StringIO()):
                    code = pilot.main(['--input', str(source), '--fulltext-directory', directory, '--output', str(output)])
            self.assertEqual(code, 0)
            network.assert_not_called()
            report = json.loads(output.read_text())
            self.assertEqual(report['mode'], 'dry-run')
            self.assertEqual(report['apiCallsThisInvocation'], 0)
            self.assertEqual(report['actualCostThisInvocationUSD'], 0)
            self.assertTrue(report['estimatedOnly'])
            self.assertGreater(report['estimatedMaximumCostUSD'], 0)


if __name__ == '__main__':
    unittest.main()
