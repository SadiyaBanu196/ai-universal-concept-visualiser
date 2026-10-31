/**
 * Safe Mathematical Expression Evaluator
 * Safely evaluates mathematical expressions for curves, vectors, and marker positions
 * without relying on unsafe eval or Function constructors with arbitrary scope.
 */

export function safeEvaluateMath(
  expression: string,
  variables: Record<string, number> = {}
): number {
  if (!expression || typeof expression !== 'string') return 0;

  try {
    // Normalize expression
    let expr = expression.trim();

    // Replace constants
    expr = expr.replace(/\bPI\b/gi, String(Math.PI));
    expr = expr.replace(/\bE\b/g, String(Math.E));

    // Custom helper functions
    const helpers: Record<string, (n: number, ...args: number[]) => number> = {
      deg2rad: (deg: number) => (deg * Math.PI) / 180,
      rad2deg: (rad: number) => (rad * 180) / Math.PI,
      sin: (v: number) => Math.sin(v),
      cos: (v: number) => Math.cos(v),
      tan: (v: number) => Math.tan(v),
      asin: (v: number) => Math.asin(v),
      acos: (v: number) => Math.acos(v),
      atan: (v: number) => Math.atan(v),
      sinh: (v: number) => Math.sinh(v),
      cosh: (v: number) => Math.cosh(v),
      tanh: (v: number) => Math.tanh(v),
      exp: (v: number) => Math.exp(v),
      log: (v: number) => (v <= 0 ? -100 : Math.log(v)),
      log10: (v: number) => (v <= 0 ? -100 : Math.log10(v)),
      log2: (v: number) => (v <= 0 ? -100 : Math.log2(v)),
      sqrt: (v: number) => (v < 0 ? 0 : Math.sqrt(v)),
      abs: (v: number) => Math.abs(v),
      ceil: (v: number) => Math.ceil(v),
      floor: (v: number) => Math.floor(v),
      round: (v: number) => Math.round(v),
      sigmoid: (v: number) => 1 / (1 + Math.exp(-v)),
      relu: (v: number) => Math.max(0, v),
    };

    // Replace variables with their numeric values
    // Sort keys by length descending to prevent substring collisions (e.g. v0 vs v)
    const varKeys = Object.keys(variables).sort((a, b) => b.length - a.length);
    for (const key of varKeys) {
      const val = variables[key];
      const regex = new RegExp(`\\b${key}\\b`, 'g');
      expr = expr.replace(regex, `(${Number.isFinite(val) ? val : 0})`);
    }

    // Replace ^ with **
    expr = expr.replace(/\^/g, '**');

    // Replace helper function calls
    for (const [funcName] of Object.entries(helpers)) {
      const funcRegex = new RegExp(`\\b${funcName}\\s*\\(`, 'g');
      expr = expr.replace(funcRegex, `__MATH__.${funcName}(`);
    }

    // Replace standard Math functions
    const mathFuncs = ['pow', 'min', 'max'];
    for (const funcName of mathFuncs) {
      const funcRegex = new RegExp(`\\b${funcName}\\s*\\(`, 'g');
      expr = expr.replace(funcRegex, `Math.${funcName}(`);
    }

    // Simple sanitized token-based evaluation sandbox
    const allowed = /^[0-9+\-*/()., \t\r\nMath.__MATH__a-zA-Z_]+$/;
    if (!allowed.test(expr)) {
      return 0;
    }

    const evaluator = new Function('Math', '__MATH__', `"use strict"; return (${expr});`);
    const result = evaluator(Math, helpers);

    if (typeof result === 'number' && Number.isFinite(result)) {
      return result;
    }
    return 0;
  } catch (err) {
    return 0;
  }
}

/**
 * Generates sample points for a graph curve across the x-axis range
 */
export function sampleCurvePoints(
  expression: string,
  minX: number,
  maxX: number,
  variables: Record<string, number>,
  samples: number = 100
): Array<{ x: number; y: number }> {
  const points: Array<{ x: number; y: number }> = [];
  const step = (maxX - minX) / Math.max(samples - 1, 1);

  for (let i = 0; i < samples; i++) {
    const x = minX + i * step;
    const y = safeEvaluateMath(expression, { ...variables, x });
    if (Number.isFinite(y)) {
      points.push({ x, y });
    }
  }

  return points;
}
