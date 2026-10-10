// P012 conformance helper: executes one case record through the PUBLIC API only (checkFormula, evaluateFormula).
// Shared by the conformance test and by the fresh-process determinism child, so both run exactly the same calls.
import { ALL_INPUTS, clone, deepFreeze } from './builders.mjs';

/** Build {unitRegistry, inputs, precision?} for a case (deep-frozen copies; the registry is built from YAML data). */
export function buildOptions(UN, registryData, c) {
  const options = {
    unitRegistry: UN.buildUnitRegistry(clone(registryData[c.registry ?? 'uf1'])),
    inputs: clone(c.inputs ?? ALL_INPUTS),
  };
  if (c.precision !== undefined) options.precision = c.precision;
  return deepFreeze(options);
}

const attempt = (fn) => {
  try {
    return { value: fn() };
  } catch (error) {
    return { thrown: error?.code ?? `${error?.name}: ${error?.message}`, instance: error };
  }
};

/** Run check and evaluate once on deep-frozen copies. Returns plain data (no error instances unless asked). */
export function execCase(F, UN, registryData, c) {
  const logic = deepFreeze(clone(c.logic));
  const values = deepFreeze(clone(c.values ?? {}));
  const options = buildOptions(UN, registryData, c);
  return {
    check: attempt(() => F.checkFormula(logic, options)),
    evaluate: attempt(() => F.evaluateFormula(logic, values, options)),
  };
}

/** JSON-able view of an exec result (for the determinism payload). */
export const plain = (r) => JSON.parse(JSON.stringify({
  check: r.check.thrown !== undefined ? { thrown: r.check.thrown } : { value: r.check.value },
  evaluate: r.evaluate.thrown !== undefined ? { thrown: r.evaluate.thrown } : { value: r.evaluate.value },
}));
