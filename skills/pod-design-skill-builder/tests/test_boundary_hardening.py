"""Boundary regressions: malformed JSON must never become route evidence."""
import copy
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'assets' / 'target-scripts'))
sys.path.insert(0, str(ROOT / 'scripts'))
from resolve_transparency_route import resolve
from resolve_design_brief import resolve_request, BriefError
from pod_builder.validation import validate_data
from test_v32_contracts import request_from_brief, load_teacher


class BoundaryHardeningTests(unittest.TestCase):
    def test_alpha_route_rejects_malformed_input_types(self):
        valid = ['provider', 'model', 'unknown', 'unverified', 'fail', 2, 3, 2]
        cases = {0: [None, 5, {}, ' '], 1: [None, [], True, ' '],
                 2: [None, [], 'bogus'], 3: [None, [], 'bogus'],
                 4: [None, True, [], 'PASS', 'bogus'],
                 5: [None, True, '2', float('nan'), float('inf'), -float('inf'), [], -1],
                 6: [True, 3.0, '3'], 7: [True, 2.0, '2']}
        for index, values in cases.items():
            for value in values:
                args = copy.deepcopy(valid)
                args[index] = value
                with self.subTest(index=index, value=value):
                    with self.assertRaises(ValueError):
                        resolve(*args)

    def test_finite_numeric_attempt_preserves_value_and_state(self):
        for capability, evidence, threshold in (('supported', 'native-control', 3), ('unknown', 'unverified', 2)):
            for attempt in (0.0, 0.5, 1.999, 2.0, 2.5, 2.999, 3.0, 3.5):
                with self.subTest(capability=capability, attempt=attempt):
                    result = resolve('provider', 'model', capability, evidence, 'fail', attempt, 3, 2)
                    expected = ('rerender-transparent' if attempt < threshold else 'hard-fail-transparent-required') if capability == 'supported' else ('probe-transparent' if attempt < threshold else 'use-solid-fallback')
                    self.assertEqual(result['decision'], expected)
                    self.assertEqual(result['attempt'], attempt)
                    self.assertIs(type(result['attempt']), float)

    def test_brief_runtime_does_not_coerce_nonstring_identity(self):
        data = load_teacher()
        for field in ('provider', 'model'):
            for value in (None, 123, True, [], {}):
                request = request_from_brief(data)
                request['market_context_id'] = data['market_contexts'][0]['id']
                request['image_runtime'][field] = value
                with self.subTest(field=field, value=value):
                    with self.assertRaisesRegex(BriefError, 'invalid alpha route'):
                        resolve_request(data, request)

    def test_locale_length_contract_matches_schema(self):
        from jsonschema import Draft202012Validator
        schema = json.loads((ROOT / 'references' / 'niche-data.schema.json').read_text(encoding='utf-8'))
        for domain in ('root', 'market'):
            for length in (35, 36, 72):
                data = load_teacher()
                record = data if domain == 'root' else data['market_contexts'][0]
                record['locale'] = 'a' * length
                with self.subTest(domain=domain, length=length):
                    errors = [e for e in validate_data(data, 'teacher').errors if 'locale' in e]
                    schema_errors = [e for e in Draft202012Validator(schema).iter_errors(data) if 'locale' in list(e.path)]
                    self.assertEqual(bool(errors), length > 35)
                    self.assertEqual(bool(schema_errors), length > 35)

    def test_locale_padding_is_rejected_without_normalization(self):
        from jsonschema import Draft202012Validator
        schema = json.loads((ROOT / 'references' / 'niche-data.schema.json').read_text(encoding='utf-8'))
        for domain in ('root', 'market'):
            for locale in (' en-US ', 'en-US\n', 'en\tUS', '\u00a0en-US'):
                data = load_teacher()
                record = data if domain == 'root' else data['market_contexts'][0]
                record['locale'] = locale
                with self.subTest(domain=domain, locale=locale):
                    self.assertTrue(any('locale' in e for e in validate_data(data, 'teacher').errors))
                    self.assertTrue(list(Draft202012Validator(schema).iter_errors(data)))

    def test_golden_ip_copy_refuses_named_licensed_characters(self):
        for slug, phrase in (('teacher', 'Mickey Mouse Teacher'), ('pet-memorial', 'Snoopy Memorial')):
            data = json.loads((ROOT / 'references' / f'{slug}-example-data.json').read_text(encoding='utf-8'))
            if slug == 'teacher':
                request = request_from_brief(data)
            else:
                request = request_from_brief(data, idea_archetype_id='personalized-name-memorial', hook_pattern_id='dates-and-paw', style_variant_ids=['botanical-keepsake', 'night-sky-memorial'])
            request['market_context_id'] = data['market_contexts'][0]['id']
            # Prove that the unmodified request is valid before isolating IP copy.
            resolve_request(data, request)
            request['copy']['text'] = phrase
            with self.subTest(niche=slug):
                with self.assertRaisesRegex(BriefError, 'ip-licensed-character-copy'):
                    resolve_request(data, request)


if __name__ == '__main__':
    unittest.main()
