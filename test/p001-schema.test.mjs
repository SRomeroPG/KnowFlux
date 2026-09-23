import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import YAML from 'yaml';
import { loadSchemas } from '../scripts/check-schemas.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixture = path.join(root, 'framework', 'conformance', 'acme-formulation');
const specExamples = path.join(root, 'framework', 'conformance', 'spec-examples');
const schemaBase = 'https://knowflux.dev/schemas/';

// This manifest is an assertion about the §55 P001 corpus, not schema discovery.
const examples = [
  ['knowledge/capabilities/CAP-0001/capability.yaml', 'capability'],
  ['knowledge/outcomes/OUT-0001/outcome.yaml', 'outcome'],
  ['knowledge/processes/BP-0001/process.yaml', 'business-process'],
  ['knowledge/processes/BP-0001/observed/legacy-app.yaml', 'business-process-observed'],
  ['knowledge/business-rules/BR-0001/rule.yaml', 'business-rule'],
  ['knowledge/business-rules/BR-0001/observed/legacy-app.yaml', 'business-rule-observed'],
  ['knowledge/business-rules/BR-0002/rule.yaml', 'business-rule'],
  ['knowledge/data/DE-0001/entity.yaml', 'data-entity'],
  ['knowledge/data/DE-0001/observed/legacy-app.yaml', 'data-entity-observed'],
  ['knowledge/data/DE-0002/entity.yaml', 'data-entity'],
  ['knowledge/data/DE-0002/observed/legacy-app.yaml', 'data-entity-observed'],
  ['knowledge/scenarios/SC-0001/scenario.yaml', 'scenario'],
  ['knowledge/scenarios/SC-0002/scenario.yaml', 'scenario'],
  ['knowledge/evidence/EV-0001/evidence.yaml', 'evidence'],
  ['knowledge/evidence/EV-0002/evidence.yaml', 'evidence'],
  ['knowledge/unknowns/UNK-0001/unknown.yaml', 'unknown'],
  ['knowledge/disputes/DSP-0001/dispute.yaml', 'dispute'],
  ['changes/CHG-0001.yaml', 'change'],
];

const invalidExamples = [
  ['wrong-schema-version.yaml', 'capability', '/schema_version'],
  ['inverse-executed-by.yaml', 'business-rule', '@executed_by'],
  ['versioned-observed.yaml', 'business-process-observed', '@version'],
  ['bare-faceted-support.yaml', 'evidence', '/supports'],
  ['change-affects-observed.yaml', 'change', '/affects/0/facet'],
];

const { ajv, files } = await loadSchemas();
const validators = new Map();
for (const [, name] of examples) validators.set(name, ajv.getSchema(`${schemaBase}${name}.schema.json`));
validators.set('divergence', ajv.getSchema(`${schemaBase}divergence.schema.json`));

async function parseExample(relative) {
  return parseYAML(path.join(fixture, relative), relative);
}

async function parseYAML(file, label) {
  const source = await readFile(file, 'utf8');
  const documents = YAML.parseAllDocuments(source, { uniqueKeys: true });
  assert.equal(documents.length, 1, `${label}: exactly one YAML document`);
  assert.equal(documents[0].errors.length, 0, `${label}: ${documents[0].errors}`);
  return documents[0].toJS();
}

async function parseSpecExample(relative) {
  return parseYAML(path.join(specExamples, relative), relative);
}

function validate(name, value) {
  const validator = validators.get(name);
  assert.ok(validator, `known schema ${name}`);
  const valid = validator(value);
  const diagnostics = (validator.errors ?? []).map(({ instancePath, keyword, params }) => ({
    instancePath, keyword, params,
  }));
  return { valid, diagnostics };
}

function hasExpectedDiagnostic(diagnostics, expectation) {
  if (expectation.startsWith('@')) {
    const property = expectation.slice(1);
    return diagnostics.some(({ params }) =>
      ['propertyName', 'additionalProperty', 'unevaluatedProperty', 'missingProperty']
        .some((key) => params[key] === property));
  }
  return diagnostics.some(({ instancePath }) => instancePath.startsWith(expectation));
}

function negative(label, schema, base, mutate, expectedPath) {
  test(label, async () => {
    const original = await parseExample(base);
    const changed = JSON.parse(JSON.stringify(original));
    mutate(changed);
    const first = validate(schema, changed);
    assert.equal(first.valid, false, `${label} unexpectedly accepted`);
    assert.ok(hasExpectedDiagnostic(first.diagnostics, expectedPath),
      `${label}: expected diagnostic at ${expectedPath}, got ${JSON.stringify(first.diagnostics)}`);
    const second = validate(schema, changed);
    assert.deepEqual(second, first, `${label}: nondeterministic diagnostics`);
  });
}

function expectInvalidAt(label, schema, changed, location, property) {
  const first = validate(schema, changed);
  assert.equal(first.valid, false, `${label} unexpectedly accepted`);
  assert.ok(first.diagnostics.some(({ instancePath, params }) =>
    instancePath.startsWith(location) && (!property ||
      ['propertyName', 'additionalProperty', 'unevaluatedProperty', 'missingProperty']
        .some((key) => params[key] === property))),
  `${label}: expected ${property ?? 'error'} at ${location}, got ${JSON.stringify(first.diagnostics)}`);
  assert.deepEqual(validate(schema, changed), first, `${label}: nondeterministic diagnostics`);
}

function nestedNegative(label, schema, base, mutate, location, property) {
  test(label, async () => {
    const changed = JSON.parse(JSON.stringify(await parseExample(base)));
    mutate(changed);
    expectInvalidAt(label, schema, changed, location, property);
  });
}

test('§§4, 42.1: eleven core schemas and six separate facet schemas compile', () => {
  const names = files.map((file) => path.basename(file));
  for (const name of [
    'capability', 'business-process', 'business-rule', 'data-entity', 'outcome',
    'scenario', 'evidence', 'unknown', 'change', 'divergence', 'dispute',
    'business-process-specified', 'business-process-observed',
    'business-rule-specified', 'business-rule-observed',
    'data-entity-specified', 'data-entity-observed',
  ]) assert.ok(names.includes(`${name}.schema.json`), `missing ${name}`);
  for (const absent of ['decision.schema.json', 'constraint.schema.json']) {
    assert.ok(!names.includes(absent), `§4.3 forbids ${absent} core type`);
  }
});

for (const [relative, schema] of examples) {
  test(`P001 authored YAML: ${relative}`, async () => {
    const value = await parseExample(relative);
    assert.equal(value.schema_version, 2.1);
    const result = validate(schema, value);
    assert.equal(result.valid, true, `${relative}: ${JSON.stringify(result.diagnostics)}`);
    assert.deepEqual(validate(schema, value), result, 'repeat validation must be deterministic');
  });
}

for (const [relative, schema, expectedPath] of invalidExamples) {
  test(`P001 invalid YAML: ${relative}`, async () => {
    const source = await readFile(path.join(root, 'framework', 'conformance', 'invalid', 'p001', relative), 'utf8');
    const documents = YAML.parseAllDocuments(source, { uniqueKeys: true });
    assert.equal(documents.length, 1);
    assert.equal(documents[0].errors.length, 0, String(documents[0].errors));
    const value = documents[0].toJS();
    const result = validate(schema, value);
    assert.equal(result.valid, false, `${relative} unexpectedly accepted`);
    assert.ok(hasExpectedDiagnostic(result.diagnostics, expectedPath),
      `${relative}: ${JSON.stringify(result.diagnostics)}`);
    assert.deepEqual(validate(schema, value), result);
  });
}

test('§§10.5, 31, 40: discovered DE identity has observed facet but no specified facet', async () => {
  const identity = await parseExample('knowledge/data/DE-0002/entity.yaml');
  const observed = await parseExample('knowledge/data/DE-0002/observed/legacy-app.yaml');
  assert.equal(Object.hasOwn(identity, 'specified'), false);
  assert.equal(observed.entity, identity.id);
  assert.equal(validate('data-entity', identity).valid, true);
  assert.equal(validate('data-entity-observed', observed).valid, true);
});

test('§55: no DIV record manually populates the fixture', async () => {
  const entries = await readdir(fixture);
  assert.ok(!entries.includes('divergences'));
});

function specDiv() {
  return {
    schema_version: 2.1, id: 'DIV-0001',
    detected: {
      key: '7f21a9', entity: 'BR-0001',
      comparison: { specified: 'BR-0001#specified@v1', observed: 'BR-0001#observed:legacy-app' },
      difference: { path: 'logic.rules[r1].then.max_concentration', specified: '4.2', observed: '4.5' },
      classification: 'structural-difference', proof: { mechanism: 'path-diff' }, state: 'present',
    },
    disposition: { status: 'open' },
  };
}

test('§23.3: schema recognizes an engine-derived DIV without duplicate statement', () => {
  const derived = specDiv();
  assert.equal(validate('divergence', derived).valid, true);
  const duplicate = validate('divergence', { ...derived, statement: 'legacy is wrong' });
  assert.equal(duplicate.valid, false);
  assert.ok(hasExpectedDiagnostic(duplicate.diagnostics, '@statement'), JSON.stringify(duplicate.diagnostics));
});

for (const [property, value] of [
  ['observed_backend', 'BR-0001#observed:backend'],
  ['note', 'free text claim'],
]) {
  test(`§§23.2–23.3 DIV comparison rejects extra ${property}`, () => {
    const derived = specDiv();
    assert.equal(validate('divergence', derived).valid, true);
    derived.detected.comparison[property] = value;
    expectInvalidAt(`extra comparison ${property}`, 'divergence', derived,
      '/detected/comparison', property);
  });
}

for (const [section, file, schema, observedAt] of [
  ['§10.3', '10.3-greenfield-rule.yaml', 'business-rule', null],
  ['§16.3', '16.3-source-code-evidence.yaml', 'evidence', '2026-10-14T09:12:00Z'],
  ['§16.6', '16.6-sme-evidence.yaml', 'evidence', '2026-10-14'],
]) {
  test(`${section} frozen example validates: ${file}`, async () => {
    const value = await parseSpecExample(file);
    assert.equal(value.schema_version, 2.1);
    if (observedAt) assert.equal(value.observed.at, observedAt);
    else assert.equal(value.specified.verification.last_verified_at, '2026-10-14');
    const result = validate(schema, value);
    assert.equal(result.valid, true, JSON.stringify(result.diagnostics));
    assert.deepEqual(validate(schema, value), result);
  });
}

test('§23.3 frozen DIV structure validates only in memory', () => {
  const value = specDiv();
  value.id = 'DIV-0007';
  value.detected.classification = 'behavioral-divergence';
  value.detected.proof = { mechanism: 'scenario-differential', failing_scenarios: ['SC-0041', 'SC-0078'] };
  value.detected.first_detected = '2026-11-02';
  value.detected.last_confirmed = '2027-01-15';
  value.disposition = {
    status: 'accepted', reason: 'Known divergence',
    owner: { type: 'human', role: 'product-owner' }, expires: '2027-09-30',
    resolution: { kind: 'work-item', ref: 'BUG-9182' },
  };
  const result = validate('divergence', value);
  assert.equal(result.valid, true, JSON.stringify(result.diagnostics));
  assert.deepEqual(validate('divergence', value), result);
});

const bp = 'knowledge/processes/BP-0001/process.yaml';
const bpo = 'knowledge/processes/BP-0001/observed/legacy-app.yaml';
const br = 'knowledge/business-rules/BR-0001/rule.yaml';
const bro = 'knowledge/business-rules/BR-0001/observed/legacy-app.yaml';
const narrative = 'knowledge/business-rules/BR-0002/rule.yaml';
const de = 'knowledge/data/DE-0001/entity.yaml';
const deo = 'knowledge/data/DE-0001/observed/legacy-app.yaml';
const cap = 'knowledge/capabilities/CAP-0001/capability.yaml';
const out = 'knowledge/outcomes/OUT-0001/outcome.yaml';
const sc = 'knowledge/scenarios/SC-0002/scenario.yaml';
const ev = 'knowledge/evidence/EV-0001/evidence.yaml';
const chg = 'changes/CHG-0001.yaml';
const dsp = 'knowledge/disputes/DSP-0001/dispute.yaml';

test('§10.3 last_verified_at accepts a date but rejects an invalid calendar date', async () => {
  const value = await parseSpecExample('10.3-greenfield-rule.yaml');
  value.specified.verification.last_verified_at = '2026-02-30';
  expectInvalidAt('invalid last_verified_at', 'business-rule', value,
    '/specified/verification/last_verified_at');
});

for (const file of ['16.3-source-code-evidence.yaml', '16.6-sme-evidence.yaml']) {
  test(`§§16.3, 16.6 observed.at rejects malformed date in ${file}`, async () => {
    const value = await parseSpecExample(file);
    value.observed.at = '2026-10-14T25:12:00Z';
    expectInvalidAt('malformed observed.at', 'evidence', value, '/observed/at');
  });
}

for (const [name, value] of [
  ['executes', ['BR-0001']], ['reads', ['DE-0001']], ['writes', ['DE-0001']],
  ['produces', ['OUT-0001']], ['calls', ['INT-0001']], ['triggered_by', ['EVT-0001']],
  ['performed_by', ['ACT-0001']], ['transitions', ['ST-0001']],
  ['part_of', 'CAP-0002'], ['steps', [{ id: 's9', name: 'Other', executes: ['BR-0009'] }]],
  ['version', 3], ['epistemic', { computed_confidence: 'confirmed' }],
  ['verification', { state: 'fresh' }], ['scope', { business_unit: ['B'] }],
  ['validity', { effective_from: '2026-10-01' }],
  ['authority', { type: 'human', role: 'editor' }],
  ['logic', { kind: 'narrative', unstructured_reason: 'Other' }],
]) {
  nestedNegative(`§§7.1–7.2, 10.5 BP identity cannot own ${name}`,
    'business-process', bp, x => { x.identity = { [name]: value }; }, '/identity', name);
}

for (const [name, value] of [
  ['contains', ['DE-0021']], ['fields', { shadow: { type: 'string' } }],
  ['persistence', { kind: 'relational', table: 'shadow' }],
  ['version', 3], ['epistemic', { computed_confidence: 'confirmed' }],
  ['verification', { state: 'fresh' }], ['scope', { business_unit: ['B'] }],
  ['validity', { effective_from: '2026-10-01' }],
  ['authority', { type: 'human', role: 'editor' }],
]) {
  nestedNegative(`§§7.1–7.2, 10.5 DE identity cannot own ${name}`,
    'data-entity', de, x => { x.identity = { [name]: value }; }, '/identity', name);
}

for (const [schema, base] of [['capability', cap], ['outcome', out]]) {
  for (const [name, value] of [
    ['computed_confidence', 'confirmed'], ['effective_confidence', 'confirmed'],
    ['epistemic', { computed_confidence: 'confirmed' }], ['version', 4],
    ['verification', { state: 'fresh' }],
    ['steps', [{ id: 's1', executes: ['BR-0001'] }]],
    ['fields', { concentration: { type: 'quantity' } }],
    ['identity', { executes: ['BR-0001'] }],
    ['relationships', { contains: ['BP-0001'] }],
    ['meta', { created_at: '2026-10-01', updated_at: '2026-10-02' }],
    ['totally_bogus_field', true],
  ]) {
    nestedNegative(`§§10.5, 10.8, 19.1 ${schema} cannot carry ${name}`,
      schema, base, x => { x[name] = value; }, '', name);
  }
}

for (const [location, property, mutate] of [
  ['/disposition', 'statement', x => { x.disposition.statement = 'duplicate'; }],
  ['/disposition/resolution', 'statement', x => {
    x.disposition.resolution = { kind: 'change', ref: 'CHG-0001', statement: 'duplicate' };
  }],
  ['/disposition/owner', 'statement', x => {
    x.disposition.owner = { type: 'human', role: 'product-owner', statement: 'duplicate' };
  }],
  ['/detected/proof', 'statement', x => { x.detected.proof.statement = 'duplicate'; }],
  ['/disposition', 'created_at', x => { x.disposition.created_at = '2026-10-01'; }],
  ['/disposition', 'updated_at', x => { x.disposition.updated_at = '2026-10-01'; }],
  ['/detected', 'created_at', x => { x.detected.created_at = '2026-10-01'; }],
  ['/detected/proof', 'updated_at', x => { x.detected.proof.updated_at = '2026-10-01'; }],
  ['/disposition/resolution', 'updated_at', x => {
    x.disposition.resolution = { kind: 'change', ref: 'CHG-0001', updated_at: '2026-10-01' };
  }],
  ['/disposition/owner', 'created_at', x => {
    x.disposition.owner = { type: 'human', role: 'product-owner', created_at: '2026-10-01' };
  }],
]) {
  test(`§§23.3, 19.1 DIV ${location} rejects ${property}`, () => {
    const value = specDiv();
    mutate(value);
    expectInvalidAt(`${location}.${property}`, 'divergence', value, location, property);
  });
}

for (const proof of [{}, { mechanism: 'path-diff' },
  { mechanism: 'scenario-differential' },
  { mechanism: 'scenario-differential', failing_scenarios: [] }]) {
  test(`§23.1 behavioral DIV requires a failing scenario: ${JSON.stringify(proof)}`, () => {
    const value = specDiv();
    value.detected.classification = 'behavioral-divergence';
    value.detected.proof = proof;
    expectInvalidAt('unproven behavioral DIV', 'divergence', value, '/detected');
  });
}

negative('§42.1 wrong schema_version', 'business-rule', br, x => { x.schema_version = 2.0; }, '/schema_version');
negative('§4.3 DEC is not a core type', 'business-rule', br, x => { x.type = 'decision'; }, '/type');
negative('§5.1 determination is singular', 'business-rule', br, x => { x.identity.determination = ['a', 'b']; }, '/identity/determination');
negative('§7.3 R2 governs is nonempty', 'business-rule', br, x => { x.identity.governs = []; }, '/identity/governs');
negative('§7.1 BP has exactly one capability parent', 'business-process', bp, x => { delete x.part_of; }, '@part_of');
negative('§7.2 inverse executed_by forbidden', 'business-rule', br, x => { x.executed_by = ['BP-0001']; }, '@executed_by');
negative('§7.2 inverse evidence forbidden on BR', 'business-rule', br, x => { x.evidence = ['EV-0001']; }, '@evidence');
negative('§7.2 inverse contains forbidden on CAP', 'capability', cap, x => { x.contains = ['BP-0001']; }, '@contains');
negative('§7.1 CAP cannot own a BP execution edge', 'capability', cap, x => { x.executes = ['BR-0001']; }, '@executes');
negative('§7.1 OUT cannot own a DE containment edge', 'outcome', out, x => { x.contains = ['DE-0001']; }, '@contains');
negative('§7.2 inverse supported_by forbidden', 'business-rule', br, x => { x.supported_by = ['EV-0001']; }, '@supported_by');
negative('§7.1 BP execution edge belongs to facet', 'business-process', bp, x => { x.executes = ['BR-0001']; }, '@executes');
negative('§10 identity belongs to entity, not specified facet', 'business-rule', br, x => { x.specified[0].identity = x.identity; }, '/specified');
negative('§10.3 observed is in separate file', 'business-rule', br, x => { x.observed = []; }, '@observed');
negative('§10.4 observed facet has no version', 'business-rule-observed', bro, x => { x.version = 1; }, '@version');
negative('§10.5 BP specified facet has no logic', 'business-process', bp, x => { x.specified.logic = { kind: 'narrative', unstructured_reason: 'n/a' }; }, '/specified');
negative('§10.5 BP observed facet has no logic', 'business-process-observed', bpo, x => { x.logic = { kind: 'narrative', unstructured_reason: 'n/a' }; }, '@logic');
negative('§10.5 BP specified facet has steps', 'business-process', bp, x => { delete x.specified.steps; }, '/specified');
negative('§10.5 BP observed facet has steps', 'business-process-observed', bpo, x => { delete x.steps; }, '@steps');
negative('§10.5 BR specified facet has logic', 'business-rule', br, x => { delete x.specified[0].logic; }, '/specified');
negative('§10.5 BR observed facet has logic', 'business-rule-observed', bro, x => { delete x.logic; }, '@logic');
negative('§10.5 DE specified facet has fields', 'data-entity', de, x => { delete x.specified.fields; }, '/specified');
negative('§10.5 DE specified facet has persistence', 'data-entity', de, x => { delete x.specified.persistence; }, '/specified');
negative('§10.5 DE observed facet has fields', 'data-entity-observed', deo, x => { delete x.fields; }, '@fields');
negative('§10.5 DE observed facet has persistence', 'data-entity-observed', deo, x => { delete x.persistence; }, '@persistence');
negative('§10.5 nonfaceted CAP cannot have specified', 'capability', cap, x => { x.specified = {}; }, '@specified');
negative('§10.5 nonfaceted SC cannot have observed', 'scenario', sc, x => { x.observed = {}; }, '@observed');
negative('§14 lifecycle status is closed', 'business-rule', br, x => { x.lifecycle.status = 'disputed'; }, '/lifecycle/status');
negative('§15 confidence never uses deprecated', 'business-rule-observed', bro, x => { x.epistemic = { computed_confidence: 'deprecated' }; }, '/epistemic');
negative('§20 approved is not a truth state', 'business-rule', br, x => { x.approved = true; }, '@approved');
negative('§10.8 created_at is not authored YAML', 'business-rule', br, x => { x.created_at = '2026-10-01'; }, '@created_at');
negative('§10.8 updated_at is not authored YAML', 'business-rule-observed', bro, x => { x.updated_at = '2026-10-01'; }, '@updated_at');
negative('§12.4 narrative requires reason', 'business-rule', narrative, x => { delete x.specified.logic.unstructured_reason; }, '/specified');
negative('§12.4 narrative requires verification mode', 'business-rule', narrative, x => { delete x.specified.verification.mode; }, '/specified');
negative('§16.2 EV requires assertion_kind', 'evidence', ev, x => { delete x.assertion_kind; }, '@assertion_kind');
negative('§16.3 EV cannot support bare faceted entity', 'evidence', ev, x => { x.supports = ['BR-0001']; }, '/supports');
negative('§16.1 observational EV cannot elevate specified', 'evidence', ev, x => { x.supports = ['BR-0001#specified']; }, '/supports');
negative('§16.1 specifying EV cannot elevate observed', 'evidence', 'knowledge/evidence/EV-0002/evidence.yaml', x => { x.supports = ['BR-0001#observed:legacy-app']; }, '/supports');
negative('§26 observed SC requires target', 'scenario', sc, x => { delete x.asserts.target; }, '/asserts');
negative('§26 specified SC cannot select observed target', 'scenario', sc, x => { x.asserts = { facet: 'specified', target: 'legacy-app' }; }, '/asserts');
negative('§22 CHG affects specified only', 'change', chg, x => { x.affects[0].facet = 'BR-0001#observed:legacy-app'; }, '/affects/0/facet');
negative('§18.2 DSP cannot address nonfaceted facet', 'dispute', dsp, x => { x.disputes = { entity: 'CAP-0001', facet: 'specified' }; }, '/disputes');
negative('§12.1 decision table rejects unrecognized predicate', 'business-rule', br, x => { x.specified[0].logic.rules[0].when = { concentration: { at_least: '4.2' } }; }, '/specified');
negative('§12.1 enum input must declare domain', 'business-rule', br, x => { x.specified[0].logic.inputs = [{ ref: 'DE-0001.material_type', type: 'enum' }]; }, '/specified');
negative('§12.2 rounding mode is closed', 'business-rule', br, x => { x.specified[0].logic = { kind: 'formula', output: { ref: 'DE-0001.concentration', unit: 'percent_mass' }, expression: { const: '4.2' }, rounding: { mode: 'arbitrary', decimals: 2 } }; }, '/specified');

test('§7.2 every derived inverse is rejected at authored document roots', async () => {
  const inverseNames = [
    'executed_by', 'supported_by', 'exercised_by', 'covered_by', 'governed_by', 'produced_by',
    'read_by', 'written_by', 'called_by', 'overridden_by', 'blocked_by',
    'affected_by', 'is_disputed', 'part_of_entity', 'triggers', 'performs',
    'transitioned_by',
  ];
  for (const [relative, schema] of examples) {
    const original = await parseExample(relative);
    for (const inverse of inverseNames) {
      const changed = { ...original, [inverse]: [] };
      const result = validate(schema, changed);
      assert.equal(result.valid, false, `${relative} accepted authored ${inverse}`);
    }
  }
});

test('§12 BR logic has four structurally recognized kinds and no fifth kind', async () => {
  const original = await parseExample(narrative);
  const variants = [
    original.specified.logic,
    { kind: 'decision-table', hit_policy: 'first', exhaustive: false, inputs: [], rules: [{ id: 'r1', when: 'default', then: {} }] },
    { kind: 'formula', output: { ref: 'DE-0001.concentration', unit: 'percent_mass' }, expression: { const: '4.2' } },
    { kind: 'state-machine', entity: 'DE-0001', state_field: 'status', states: ['draft', 'approved'], initial: 'draft', terminal: ['approved'], completeness: 'partial', transitions: [{ id: 't1', from: 'draft', to: 'approved', trigger: 'EVT-0001' }] },
  ];
  for (const logic of variants) {
    const entity = { ...original, specified: { ...original.specified, logic } };
    assert.equal(validate('business-rule', entity).valid, true, `${logic.kind} rejected`);
  }
  const invalid = { ...original, specified: { ...original.specified, logic: { kind: 'script', source: 'return true' } } };
  assert.equal(validate('business-rule', invalid).valid, false);
});
