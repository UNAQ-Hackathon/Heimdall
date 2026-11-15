export const PUBLISHED_FLEX_QUERY = {
  fuel: 'Methanol', pressure_mmhg: 765, o2_fraction: 0.21, n2_fraction: 0.79,
  co2_fraction: 0, he_fraction: 0, diameter_mm: 1.8,
};

export const PREDICTION_REASONS = {
  respaldado: 'Conditions have experimental support.',
  fuera_de_rango_o_mezcla_sin_datos: 'Outside the observed ranges, or no data for this fuel and mixture.',
  grupos_insuficientes: 'Not enough independent experimental groups for this mixture.',
  sin_vecino_cercano_de_la_misma_mezcla: 'No sufficiently close trial with the same fuel and gas mixture.',
};

export const initialPredictionState = {
  form: PUBLISHED_FLEX_QUERY, phase: 'idle', response: null, error: '', requestId: 0,
};

export function predictionReducer(state, action) {
  if (action.type === 'edit' || action.type === 'example') {
    return {
      ...initialPredictionState,
      form: action.type === 'example' ? { ...PUBLISHED_FLEX_QUERY } : { ...state.form, ...action.patch },
      requestId: state.requestId + 1,
    };
  }
  if (action.type === 'start') {
    return { ...state, phase: 'running', response: null, error: '', requestId: action.requestId };
  }
  if (action.requestId !== state.requestId || state.phase !== 'running') return state;
  if (action.type === 'success') {
    return { ...state, phase: 'complete', response: action.response, error: '' };
  }
  if (action.type === 'error') {
    return { ...state, phase: 'error', response: null, error: action.error };
  }
  return state;
}

export function parsePredictionConditions(form) {
  return Object.fromEntries(Object.entries(form).map(([key, value]) => {
    if (key === 'fuel') return [key, value];
    if (String(value).trim() === '' || !Number.isFinite(Number(value))) {
      throw new Error('Enter a finite number in every experimental condition field.');
    }
    return [key, Number(value)];
  }));
}
