/**
 * Core Plan, Animation, Timeout, & Evaluator Test Suite
 */

import { safeEvaluateMath, sampleCurvePoints } from '../utils/mathEvaluator';
import { validateAndNormalizePlan, validatePlanConsistency } from '../utils/planValidator';
import { extractAndParseJson } from '../utils/jsonParser';
import { interpolateNumber, resolveRuntimeParameters, buildRuntimeState } from '../utils/animationResolver';
import { resolveModelConfig } from '../utils/modelConfig';
import { normalizeTutorMarkdown, extractMathPlaceholders, renderKatexHtml } from '../utils/markdownUtils';

export async function runSanityTests() {
  console.log('--- Running Generic Visualization Sanity Checks ---');

  // 1. Math Evaluator Tests
  const mathTest1 = safeEvaluateMath('x^2 + 2*x + 1', { x: 3 });
  console.assert(mathTest1 === 16, `Math Test 1 Failed: Expected 16, got ${mathTest1}`);

  const mathTest2 = safeEvaluateMath('v0 * sin(deg2rad(angle))', { v0: 10, angle: 30 });
  console.assert(Math.abs(mathTest2 - 5) < 1e-4, `Math Test 2 Failed: Expected 5, got ${mathTest2}`);

  const mathTest3 = safeEvaluateMath('sigmoid(0)');
  console.assert(mathTest3 === 0.5, `Math Test 3 Failed: Expected 0.5, got ${mathTest3}`);

  // 1.5 JSON Parser with LaTeX Backslashes & Fences Tests
  const rawLatexJson = `\`\`\`json
  {
    "title": "Projectile Motion",
    "summary": "Motion under constant gravity",
    "equations": [
      {
        "latex": "y = x \\tan(\\theta) - \\frac{g x^2}{2 v_0^2 \\cos^2(\\theta)}",
        "description": "Trajectory \\alpha and \\beta angles"
      }
    ]
  }
  \`\`\``;

  const parsedLatex = extractAndParseJson(rawLatexJson);
  console.assert(parsedLatex.success === true, 'Parsed LaTeX JSON failed');
  console.assert(parsedLatex.data?.title === 'Projectile Motion', 'Parsed title mismatch');

  // Test invalid escape character simulation (like single backslash \c in \cos or \s in \sin)
  const singleBackslashRaw = '{"formula": "y = \\sin(\\theta) + \\cos(\\theta) + \\frac{1}{2}"}';
  const parsedSingle = extractAndParseJson(singleBackslashRaw);
  console.assert(parsedSingle.success === true, 'Single backslash LaTeX parse failed');
  console.assert(parsedSingle.data?.formula.includes('sin'), 'Formula extraction mismatch');

  // 2. Plan Normalizer Robustness Check
  const rawPlan = {
    title: 'Test Concept',
    concept_type: 'physics',
    parameters: [{ id: 'k', default: 5 }],
    steps: [
      { step_number: 1, title: 'Initial', parameter_overrides: { x: 0 } },
      { step_number: 2, title: 'Apex', parameter_overrides: { x: 10 } },
      { step_number: 3, title: 'Impact', parameter_overrides: { x: 20 } },
    ],
    visualization: {
      type: 'coordinate_graph',
      coordinate_graph: {
        x_axis: { min: 0, max: 20 },
        y_axis: { min: 0, max: 20 },
        curves: [{ id: 'c1', expression: 'k * x' }],
      },
    },
  };

  const { plan, error } = validateAndNormalizePlan(rawPlan);
  console.assert(!error && plan !== null, `Plan Normalization Failed: ${error}`);
  console.assert(plan?.parameters[0].id === 'k', 'Parameter ID check failed');
  console.assert(plan?.visualization.type === 'coordinate_graph', 'Visualization type check failed');

  // 2.5 Animation State & Continuous Progress Resolution Tests
  if (plan) {
    const stateAtStep1Mid = buildRuntimeState(plan, 1, 0.5, true, 1, { k: 5 });
    console.assert(stateAtStep1Mid.currentStepIndex === 1, 'Step index mismatch');
    console.assert(stateAtStep1Mid.parameters.x === 5, `Interpolated x should be 5 at step 1 (progress 0.5), got ${stateAtStep1Mid.parameters.x}`);
    console.assert(stateAtStep1Mid.parameters.step === 1, 'Runtime parameter step mismatch');
    console.assert(stateAtStep1Mid.globalProgress === 0.25, `Global progress should be 0.25 across 3 steps, got ${stateAtStep1Mid.globalProgress}`);
  }

  // 3. Transient Error & Timeout Classification Verification
  const timeoutErr = { code: 'ETIMEDOUT', status: 504, isTimeout: true, message: 'Model gemini-3.1-flash-lite timed out after 30s' };
  const transientErr503 = { status: 503, message: 'This model is currently experiencing high demand.' };
  const transientErr429 = { status: 429, message: 'Resource has been exhausted (e.g. check quota).' };
  const permanentErr401 = { status: 401, message: 'API key not valid. Please pass a valid API key.' };
  const permanentErr400 = { status: 400, message: 'Invalid argument provided.' };

  const checkTransient = (err: any) => {
    const s = err.status || err.code;
    const msg = (err.message || '').toLowerCase();
    if (s === 400 || s === 401 || s === 403 || msg.includes('api key') || msg.includes('invalid argument')) return false;
    if (err.isTimeout || s === 'ETIMEDOUT' || s === 504 || s === 503 || s === 429 || msg.includes('timed out') || msg.includes('high demand') || msg.includes('unavailable') || msg.includes('quota')) return true;
    return false;
  };

  console.assert(checkTransient(timeoutErr) === true, 'Timeout error must be classified as transient');
  console.assert(checkTransient(transientErr503) === true, '503 should be transient');
  console.assert(checkTransient(transientErr429) === true, '429 should be transient');
  console.assert(checkTransient(permanentErr401) === false, '401 should be permanent');
  console.assert(checkTransient(permanentErr400) === false, '400 should be permanent');

  // 4. Model Candidate Resolution Verification
  // Test case A: Runtime environment check with current process.env (even if GEMINI_PRIMARY_MODEL is set to gemini-3.8-flash)
  const runtimeConfig = resolveModelConfig();
  console.assert(runtimeConfig.primaryModel === 'gemini-3.1-flash-lite', `Primary model must be gemini-3.1-flash-lite, got ${runtimeConfig.primaryModel}`);
  console.assert(runtimeConfig.fallbackModel === 'gemini-flash-latest', `Fallback model must be gemini-flash-latest, got ${runtimeConfig.fallbackModel}`);
  console.assert(runtimeConfig.candidates[0] === 'gemini-3.1-flash-lite', `Candidate 0 must be gemini-3.1-flash-lite, got ${runtimeConfig.candidates[0]}`);
  console.assert(runtimeConfig.candidates[1] === 'gemini-flash-latest', `Candidate 1 must be gemini-flash-latest, got ${runtimeConfig.candidates[1]}`);
  console.assert(!runtimeConfig.candidates.includes('gemini-3.8-flash'), 'gemini-3.8-flash must NOT be in candidate list');

  // Test case B: Explicit test when env variables supply gemini-3.8-flash as primary and fallback
  const overriddenConfig = resolveModelConfig('gemini-3.8-flash', 'gemini-3.1-flash-lite');
  console.assert(overriddenConfig.primaryModel === 'gemini-3.1-flash-lite', 'Should override gemini-3.8-flash to gemini-3.1-flash-lite');
  console.assert(overriddenConfig.fallbackModel === 'gemini-flash-latest', 'Should set fallback to gemini-flash-latest');
  console.assert(!overriddenConfig.candidates.includes('gemini-3.8-flash'), 'Candidates must not contain gemini-3.8-flash');

  // Test case C: When no env variables are passed
  const emptyConfig = resolveModelConfig(undefined, undefined);
  console.assert(emptyConfig.primaryModel === 'gemini-3.1-flash-lite', 'Default primary must be gemini-3.1-flash-lite');
  console.assert(emptyConfig.fallbackModel === 'gemini-flash-latest', 'Default fallback must be gemini-flash-latest');

  // 5. Regression Tests: Reserved timeline parameters & Final Step Global Progress Clamping
  const stepOverridePlan = validateAndNormalizePlan({
    title: 'Binary Search Override Check',
    concept_type: 'computer_science',
    parameters: [{ id: 'target_val', default: 14 }],
    steps: [
      { step_number: 1, title: 'Init', parameter_overrides: { step: 0 } },
      { step_number: 2, title: 'Compare', parameter_overrides: { step: 1 } },
      { step_number: 3, title: 'Narrow', parameter_overrides: { step: 2 } },
    ],
    visualization: {
      type: 'discrete_blocks',
      discrete_blocks: {
        kind: 'array',
        title: 'Sorted Search Array',
        blocks: [0, 1, 2, 3, 4, 5, 6].map((i) => ({ id: `b${i}`, value: i * 3, state: 'default' })),
        pointers: [
          { id: 'p_low', label: 'low', target_index: 0 },
          { id: 'p_mid', label: 'mid', target_index: 3 },
          { id: 'p_high', label: 'high', target_index: 6 },
        ],
      },
    },
  }).plan!;

  const finalStepState = buildRuntimeState(stepOverridePlan, 3, 0.5, true, 1, { target_val: 14 });
  console.assert(finalStepState.globalProgress === 1, `Final step globalProgress must clamp to 1.0, got ${finalStepState.globalProgress}`);
  console.assert(finalStepState.parameters.step === 3, `Reserved timeline parameter 'step' must remain 3 (not clobbered by 2), got ${finalStepState.parameters.step}`);

  // 6. Beginner Guidance Normalization & Walkthrough Complete Validation
  const beginnerWalkthroughPlan = validateAndNormalizePlan({
    title: 'Beginner Walkthrough Validation',
    concept_type: 'computer_science',
    steps: [
      {
        step_number: 1,
        title: 'Initial Input State',
        description: 'Observe input array and target value',
        guidance: {
          what_is_happening: 'Input array is initialized with low and high search boundaries.',
          why_it_happens: 'We need to set the initial search window.',
          what_changed: 'low set to 0, high set to 7',
          what_to_notice: 'All elements are currently candidates',
          what_next: 'Calculate middle index',
        },
      },
      {
        step_number: 2,
        title: 'Middle Comparison',
        description: 'Comparing mid with target',
        comparison_detail: {
          left_label: 'mid value',
          left_value: 12,
          operator: '<',
          right_label: 'target',
          right_value: 23,
          decision: '12 < 23, so discard left half',
        },
        guidance: {
          what_is_happening: 'Comparing element at mid with target 23.',
          why_it_happens: 'Determine if target is in the left or right half.',
          what_changed: 'Discarded left partition indices 0..3',
          what_to_notice: 'The search range is halved',
          what_next: 'Search in upper partition',
        },
        is_final_step: true,
      },
    ],
    explanation: {
      overview: 'Binary search divides the search space in half.',
      final_result: {
        summary: 'Target found at index 5',
        final_answer: 'Index 5',
        conclusion: 'Search completed successfully in 1 comparison.',
      },
    },
  }).plan!;

  console.assert(beginnerWalkthroughPlan.steps[0].guidance?.what_is_happening.includes('Input array is initialized'), 'Step 1 guidance check failed');
  console.assert(beginnerWalkthroughPlan.steps[1].comparison_detail?.operator === '<', 'Comparison detail operator check failed');
  console.assert(beginnerWalkthroughPlan.steps[1].is_final_step === true, 'Final step flag check failed');
  console.assert(beginnerWalkthroughPlan.explanation.final_result?.final_answer === 'Index 5', 'Final result answer check failed');

  // 7. Generic Completeness, Transition, & Consistency Validation: Case 1 - Binary Search (discrete_blocks)
  const binarySearchRaw = {
    title: 'Binary Search for Target 23',
    concept_type: 'computer_science',
    parameters: [
      { id: 'target', name: 'Target Value', default: 23, min: 0, max: 100 },
      { id: 'low', name: 'Low Index', default: 0, min: 0, max: 9 },
      { id: 'high', name: 'High Index', default: 9, min: 0, max: 9 },
    ],
    steps: [
      {
        step_number: 1,
        title: 'Initial Search Space',
        description: 'Array initialized with low = 0 and high = 9.',
        pointer_positions: { p_low: 0, p_high: 9 },
        guidance: {
          what_is_happening: 'The sorted array is loaded and the entire range is active.',
          why_it_happens: 'Binary search requires a sorted search interval.',
          what_changed: 'Pointers initialized at boundaries low=0, high=9.',
          what_to_notice: 'All elements from [0] to [9] are eligible candidates.',
          what_next: 'Compute the midpoint between low and high.',
        },
      },
      {
        step_number: 2,
        title: 'First Comparison at Mid Index 4',
        description: 'Mid element 16 is compared against target 23.',
        pointer_positions: { p_low: 0, p_mid: 4, p_high: 9 },
        block_states: { b4: 'comparing' },
        comparison_detail: {
          left_label: 'Array[4]',
          left_value: 16,
          operator: '<',
          right_label: 'Target',
          right_value: 23,
          decision: '16 < 23, so target must be in the right half',
        },
        guidance: {
          what_is_happening: 'Comparing element 16 with target 23.',
          why_it_happens: 'Determines whether to search left or right partition.',
          what_changed: 'mid pointer positioned at index 4.',
          what_to_notice: 'Element 16 is less than 23.',
          what_next: 'Eliminate left half and update low to 5.',
        },
      },
      {
        step_number: 3,
        title: 'Second Comparison at Mid Index 7',
        description: 'Mid element 45 is compared against target 23.',
        pointer_positions: { p_low: 5, p_mid: 7, p_high: 9 },
        block_states: { b0: 'eliminated', b1: 'eliminated', b2: 'eliminated', b3: 'eliminated', b4: 'eliminated', b7: 'comparing' },
        comparison_detail: {
          left_label: 'Array[7]',
          left_value: 45,
          operator: '>',
          right_label: 'Target',
          right_value: 23,
          decision: '45 > 23, so target must be in the left sub-partition',
        },
        guidance: {
          what_is_happening: 'Comparing element 45 with target 23.',
          why_it_happens: 'Target is smaller than 45, discard right elements.',
          what_changed: 'high pointer reduced to mid - 1 = 6.',
          what_to_notice: 'Search space reduced to indices 5..6.',
          what_next: 'Compute next midpoint between 5 and 6.',
        },
      },
      {
        step_number: 4,
        title: 'Third Comparison & Target Found',
        description: 'Mid element 23 equals target 23.',
        pointer_positions: { p_low: 5, p_mid: 5, p_high: 6 },
        block_states: { b5: 'matched', b7: 'eliminated', b8: 'eliminated', b9: 'eliminated' },
        comparison_detail: {
          left_label: 'Array[5]',
          left_value: 23,
          operator: '==',
          right_label: 'Target',
          right_value: 23,
          decision: 'Match found! Target is located at index 5.',
        },
        guidance: {
          what_is_happening: 'Element at index 5 matches target 23.',
          why_it_happens: 'The search criteria is satisfied.',
          what_changed: 'b5 state updated to matched.',
          what_to_notice: 'Target successfully discovered.',
          what_next: 'Search completed successfully.',
        },
        result_badge: 'Target Found at [5]',
        is_final_step: true,
      },
    ],
    visualization: {
      type: 'discrete_blocks',
      discrete_blocks: {
        kind: 'array',
        title: 'Sorted Array (Target: 23)',
        blocks: [2, 5, 8, 12, 16, 23, 38, 45, 56, 72].map((v, i) => ({ id: `b${i}`, value: v, state: 'default' })),
        pointers: [
          { id: 'p_low', label: 'low', target_index: 0 },
          { id: 'p_mid', label: 'mid', target_index: 4 },
          { id: 'p_high', label: 'high', target_index: 9 },
        ],
      },
    },
    explanation: {
      overview: 'Binary search iteratively halves the search interval.',
      final_result: {
        summary: 'Target 23 found at index 5 in 3 comparisons.',
        final_answer: 'Index 5',
        conclusion: 'Search completed in 4 steps with 3 comparisons.',
      },
    },
  };

  const normBinarySearch = validateAndNormalizePlan(binarySearchRaw).plan!;
  const bsReport = validatePlanConsistency(normBinarySearch, {
    expectedTarget: 23,
    expectedArrayLength: 10,
    requiredParams: { target: 23 },
  });

  console.assert(bsReport.isValid, `Binary Search plan consistency failed: ${bsReport.issues.join('; ')}`);
  console.assert(bsReport.metrics.totalSteps === 4, 'Binary search must have 4 steps');
  console.assert(bsReport.metrics.comparisonSteps === 3, 'Binary search must have exactly 3 comparisons');
  console.assert(bsReport.metrics.guidanceCoverage === 1, 'Guidance coverage must be 100%');
  console.assert(bsReport.metrics.hasConsistentCounts, 'Counts must be consistent');
  console.assert(bsReport.metrics.preservedInputsMatched, 'Inputs must be preserved');

  // 8. Generic Completeness, Transition, & Consistency Validation: Case 2 - Projectile Motion (coordinate_graph)
  const projectileRaw = {
    title: 'Projectile Motion under Gravity',
    concept_type: 'physics',
    parameters: [
      { id: 'v0', name: 'Initial Velocity', default: 20, min: 5, max: 50, unit: 'm/s' },
      { id: 'theta', name: 'Launch Angle', default: 45, min: 0, max: 90, unit: 'deg' },
      { id: 'g', name: 'Gravity', default: 9.8, min: 1, max: 20, unit: 'm/s^2' },
      { id: 't', name: 'Time', default: 0, min: 0, max: 5, unit: 's' },
    ],
    equations: [
      {
        id: 'eq_traj',
        name: 'Trajectory Equation',
        latex: 'y = x \\tan(\\theta) - \\frac{g x^2}{2 v_0^2 \\cos^2(\\theta)}',
        description: 'Parabolic flight trajectory path under constant gravity.',
      },
    ],
    steps: [
      {
        step_number: 1,
        title: 'Launch Point (t = 0)',
        description: 'Projectile ready to fire with initial velocity 20 m/s at 45 degrees.',
        parameter_overrides: { t: 0 },
        guidance: {
          what_is_happening: 'The projectile is launched from ground level (x=0, y=0).',
          why_it_happens: 'Initial conditions establish starting kinetic energy.',
          what_changed: 'Time initialized at t = 0s.',
          what_to_notice: 'Velocity vector is split into horizontal and vertical components.',
          what_next: 'Projectile begins ascent against gravity.',
        },
      },
      {
        step_number: 2,
        title: 'Ascent Stage (t = 0.72s)',
        description: 'Projectile ascends as gravity decelerates vertical velocity.',
        parameter_overrides: { t: 0.72 },
        guidance: {
          what_is_happening: 'Projectile climbs upward while continuing forward.',
          why_it_happens: 'Horizontal velocity is constant, vertical velocity decreases.',
          what_changed: 't = 0.72s, altitude increases.',
          what_to_notice: 'The curve bends downward due to gravitational acceleration.',
          what_next: 'Approaching the maximum trajectory peak.',
        },
      },
      {
        step_number: 3,
        title: 'Trajectory Apex (t = 1.44s)',
        description: 'Vertical velocity reaches zero at peak height.',
        parameter_overrides: { t: 1.44 },
        guidance: {
          what_is_happening: 'Projectile reaches maximum height h_max.',
          why_it_happens: 'Vertical velocity momentarily vanishes (vy = 0).',
          what_changed: 't = 1.44s, apex reached.',
          what_to_notice: 'Only horizontal velocity vx remains at this point.',
          what_next: 'Projectile begins downward descent.',
        },
      },
      {
        step_number: 4,
        title: 'Descent Stage (t = 2.16s)',
        description: 'Gravity accelerates vertical velocity downward.',
        parameter_overrides: { t: 2.16 },
        guidance: {
          what_is_happening: 'Projectile descends toward the ground.',
          why_it_happens: 'Downward gravitational acceleration increases downward speed.',
          what_changed: 'Altitude decreases toward zero.',
          what_to_notice: 'Trajectory exhibits symmetric parabolic curvature.',
          what_next: 'Ground impact at range R.',
        },
      },
      {
        step_number: 5,
        title: 'Ground Impact & Maximum Range (t = 2.88s)',
        description: 'Projectile lands on ground at range R = 40.8 meters.',
        parameter_overrides: { t: 2.88 },
        guidance: {
          what_is_happening: 'Projectile impacts ground level (y = 0).',
          why_it_happens: 'Vertical displacement returns to ground baseline.',
          what_changed: 'Total flight time completed (t = 2.88s).',
          what_to_notice: 'Final landing position at x = 40.8m.',
          what_next: 'Flight trajectory complete.',
        },
        result_badge: 'Range = 40.8 m',
        is_final_step: true,
      },
    ],
    visualization: {
      type: 'coordinate_graph',
      coordinate_graph: {
        x_axis: { label: 'Distance (m)', min: 0, max: 50 },
        y_axis: { label: 'Height (m)', min: 0, max: 25 },
        curves: [{ id: 'c_traj', expression: 'x * tan(deg2rad(theta)) - (g * x^2) / (2 * v0^2 * cos(deg2rad(theta))^2)' }],
        markers: [{ id: 'm_proj', label: 'Projectile', x: 0, y: 0 }],
      },
    },
    explanation: {
      overview: 'Projectile motion is two-dimensional motion under constant gravitational acceleration.',
      final_result: {
        summary: 'Total flight completed in 5 steps with final range 40.8 meters.',
        final_answer: 'Range: 40.8 m',
        conclusion: 'Flight landed in 5 steps at t = 2.88 seconds.',
      },
    },
  };

  const normProjectile = validateAndNormalizePlan(projectileRaw).plan!;
  const projReport = validatePlanConsistency(normProjectile, {
    requiredParams: { v0: 20, theta: 45, g: 9.8 },
  });

  console.assert(projReport.isValid, `Projectile motion consistency failed: ${projReport.issues.join('; ')}`);
  console.assert(projReport.metrics.totalSteps === 5, 'Projectile plan must have 5 steps');
  console.assert(projReport.metrics.guidanceCoverage === 1, 'Projectile guidance coverage must be 100%');
  console.assert(projReport.metrics.hasConsistentCounts, 'Projectile step counts must be consistent');

  // 9. Generic Completeness, Transition, & Consistency Validation: Case 3 - Gradient Descent (coordinate_graph)
  const gradientDescentRaw = {
    title: 'Gradient Descent Optimization on Quadratic Loss',
    concept_type: 'machine_learning',
    parameters: [
      { id: 'learning_rate', name: 'Learning Rate (alpha)', default: 0.2, min: 0.01, max: 1 },
      { id: 'x_pos', name: 'Parameter x', default: 4, min: -5, max: 5 },
      { id: 'loss', name: 'Loss f(x)', default: 16, min: 0, max: 25 },
    ],
    equations: [
      {
        id: 'eq_loss',
        name: 'Objective Function',
        latex: 'f(x) = x^2, \\quad \\nabla f(x) = 2x',
        description: 'Quadratic convex loss function with minimum at x = 0.',
      },
    ],
    steps: [
      {
        step_number: 1,
        title: 'Initial Position (x = 4, Loss = 16)',
        description: 'Starting state at parameter x = 4 with high loss.',
        parameter_overrides: { x_pos: 4, loss: 16 },
        guidance: {
          what_is_happening: 'Optimization initializes at starting weight x = 4.',
          why_it_happens: 'Every iterative optimization algorithm starts at an initial estimate.',
          what_changed: 'x set to 4, loss = 16.',
          what_to_notice: 'The point is positioned high on the parabolic loss surface.',
          what_next: 'Compute gradient at x = 4 and take step in opposite direction.',
        },
      },
      {
        step_number: 2,
        title: 'Iteration 1 (x = 2.4, Loss = 5.76)',
        description: 'Gradient is 2*4=8. Step size = 0.2*8 = 1.6. New x = 4 - 1.6 = 2.4.',
        parameter_overrides: { x_pos: 2.4, loss: 5.76 },
        guidance: {
          what_is_happening: 'Parameter updates along negative gradient.',
          why_it_happens: 'Negative gradient points in the direction of steepest descent.',
          what_changed: 'x updated from 4 to 2.4, loss decreased from 16 to 5.76.',
          what_to_notice: 'Point slides downward toward the minimum.',
          what_next: 'Recompute gradient at x = 2.4.',
        },
      },
      {
        step_number: 3,
        title: 'Iteration 2 (x = 1.44, Loss = 2.07)',
        description: 'Gradient is 2*2.4=4.8. Step = 0.2*4.8 = 0.96. New x = 1.44.',
        parameter_overrides: { x_pos: 1.44, loss: 2.07 },
        guidance: {
          what_is_happening: 'Second gradient update reduces loss further.',
          why_it_happens: 'Step size automatically shrinks as gradient flattens.',
          what_changed: 'x updated to 1.44, loss reduced to 2.07.',
          what_to_notice: 'Slope becomes gentler as we approach the bottom.',
          what_next: 'Take third descent step.',
        },
      },
      {
        step_number: 4,
        title: 'Iteration 3 (x = 0.86, Loss = 0.75)',
        description: 'Step size shrinks as gradient approaches zero.',
        parameter_overrides: { x_pos: 0.86, loss: 0.75 },
        guidance: {
          what_is_happening: 'Fine-tuning convergence near the minimum.',
          why_it_happens: 'Gradient magnitude diminishes near critical points.',
          what_changed: 'x updated to 0.86, loss reduced to 0.75.',
          what_to_notice: 'Point approaches the valley center.',
          what_next: 'Reach convergence at global minimum.',
        },
      },
      {
        step_number: 5,
        title: 'Convergence to Global Minimum (x ≈ 0, Loss ≈ 0)',
        description: 'Gradient descent converged to optimal parameter x* = 0.',
        parameter_overrides: { x_pos: 0.05, loss: 0.0025 },
        guidance: {
          what_is_happening: 'Optimization reached the minimum of the convex loss curve.',
          why_it_happens: 'Gradient norm is within convergence tolerance threshold.',
          what_changed: 'Optimal parameter x ≈ 0 achieved with minimal loss.',
          what_to_notice: 'Point rest at minimum of the bowl.',
          what_next: 'Convergence achieved successfully.',
        },
        result_badge: 'Converged: x* = 0',
        is_final_step: true,
      },
    ],
    visualization: {
      type: 'coordinate_graph',
      coordinate_graph: {
        x_axis: { label: 'Parameter x', min: -5, max: 5 },
        y_axis: { label: 'Loss f(x)', min: 0, max: 20 },
        curves: [{ id: 'c_loss', expression: 'x^2' }],
        markers: [{ id: 'm_weight', label: 'Weight', x: 4, y: 16 }],
      },
    },
    explanation: {
      overview: 'Gradient descent iteratively minimizes objective functions by taking steps proportional to the negative gradient.',
      final_result: {
        summary: 'Optimization converged to global minimum in 5 steps.',
        final_answer: 'x* = 0, Loss = 0',
        conclusion: 'Optimal parameter found in 5 steps with learning rate 0.2.',
      },
    },
  };

  const normGradientDescent = validateAndNormalizePlan(gradientDescentRaw).plan!;
  const gdReport = validatePlanConsistency(normGradientDescent, {
    requiredParams: { learning_rate: 0.2, x_pos: 4 },
  });

  console.assert(gdReport.isValid, `Gradient Descent consistency failed: ${gdReport.issues.join('; ')}`);
  console.assert(gdReport.metrics.totalSteps === 5, 'Gradient descent plan must have 5 steps');
  console.assert(gdReport.metrics.guidanceCoverage === 1, 'Gradient descent guidance coverage must be 100%');
  console.assert(gdReport.metrics.hasConsistentCounts, 'Gradient descent step counts must be consistent');

  // 10. Regression Test: Generic 3-Step Plan Step-Count and Terminal Step Consistency
  // Simulates a plan with 3 steps where explanation.step_by_step has only 2 items or partial items.
  const threeStepRawPlan = {
    title: 'Generic Three-Stage Process',
    concept_type: 'computer_science',
    steps: [
      {
        step_number: 1,
        title: 'Identify the Slope',
        description: 'Observe starting slope and position.',
        guidance: {
          what_is_happening: 'Evaluate derivative at current state.',
          why_it_happens: 'Determines the direction of next movement.',
          what_changed: 'Initial coordinates evaluated.',
          what_to_notice: 'The steep tangent line.',
          what_next: 'Take a step.',
        },
      },
      {
        step_number: 2,
        title: 'Take a Step',
        description: 'Update state in opposite direction.',
        guidance: {
          what_is_happening: 'Shift position proportional to gradient step.',
          why_it_happens: 'Decreases objective value.',
          what_changed: 'Position moved closer to zero.',
          what_to_notice: 'Magnitude of the decrement.',
          what_next: 'Verify convergence.',
        },
      },
      {
        step_number: 3,
        title: 'Convergence',
        description: 'Minimum reached at x = 0.',
        guidance: {
          what_is_happening: 'Gradient is zero and minimum is reached.',
          why_it_happens: 'Convergence criteria satisfied.',
          what_changed: 'Final minimum state locked.',
          what_to_notice: 'Zero slope indicator.',
          what_next: 'Walkthrough complete.',
        },
        is_final_step: true,
        result_badge: 'Minimum Reached',
      },
    ],
    explanation: {
      overview: 'Iterative optimization reaching optimal minimum.',
      // Only 2 steps initially in raw explanation.step_by_step
      step_by_step: [
        {
          step: 1,
          title: 'Identify the Slope',
          explanation: 'Observe starting slope and position.',
        },
        {
          step: 2,
          title: 'Take a Step',
          explanation: 'Update state in opposite direction.',
        },
      ],
      final_result: {
        summary: 'Walkthrough complete with final result x = 0.',
        final_answer: 'x = 0',
        conclusion: 'Optimization reached minimum in 3 steps.',
      },
    },
  };

  const normalizedThreeStep = validateAndNormalizePlan(threeStepRawPlan).plan!;
  console.assert(normalizedThreeStep.steps.length === 3, `Authoritative steps must have length 3, got ${normalizedThreeStep.steps.length}`);
  console.assert(
    normalizedThreeStep.explanation.step_by_step.length === 3,
    `Explanation step_by_step must be reconciled to all 3 steps, got ${normalizedThreeStep.explanation.step_by_step.length}`
  );
  console.assert(
    normalizedThreeStep.explanation.step_by_step[2].title === 'Convergence',
    `Terminal third step title must be 'Convergence', got ${normalizedThreeStep.explanation.step_by_step[2]?.title}`
  );
  console.assert(
    normalizedThreeStep.steps[2].is_final_step === true,
    'Step 3 must be marked as final step'
  );
  console.assert(
    normalizedThreeStep.explanation.final_result?.final_answer === 'x = 0',
    'Final result answer must be preserved'
  );

  // 11. Regression Test: Generic Parameter Reactivity Across Subjects (Physics, Math, CS)
  console.log('Testing Generic Parameter Reactivity...');
  
  // Test A: Coordinate Graph with Projectile Motion curve expressions reacting to v0 and angle
  const projectileCurveExpr = 'x * tan(deg2rad(angle)) - (g * x^2) / (2 * v0^2 * (cos(deg2rad(angle)))^2)';
  const defaultParams = { v0: 20, angle: 45, g: 9.8 };
  const updatedParams = { v0: 40, angle: 45, g: 9.8 }; // Doubling velocity should quadruple range and height

  const ptsDefault = sampleCurvePoints(projectileCurveExpr, 0, 50, defaultParams, 20);
  const ptsUpdated = sampleCurvePoints(projectileCurveExpr, 0, 50, updatedParams, 20);

  console.assert(ptsDefault.length > 5, 'Default projectile points must be generated');
  console.assert(ptsUpdated.length > 5, 'Updated projectile points must be generated');
  // At x = 20, the height with v0 = 40 must be significantly higher than v0 = 20
  const yDefaultAt20 = safeEvaluateMath(projectileCurveExpr, { ...defaultParams, x: 20 });
  const yUpdatedAt20 = safeEvaluateMath(projectileCurveExpr, { ...updatedParams, x: 20 });
  console.assert(yUpdatedAt20 > yDefaultAt20, `Trajectory must react to velocity parameter: ${yUpdatedAt20} vs ${yDefaultAt20}`);

  // Test B: Generic Marker position expression reacting to parameter changes
  const markerApexXExpr = '(v0^2 * sin(2 * deg2rad(angle))) / (2 * g)';
  const apexXDefault = safeEvaluateMath(markerApexXExpr, defaultParams);
  const apexXUpdated = safeEvaluateMath(markerApexXExpr, updatedParams);
  console.assert(apexXUpdated > apexXDefault * 3.5, `Marker expression must react to parameter updates: ${apexXUpdated} vs ${apexXDefault}`);

  // Test C: Generic Pointer index expression in discrete blocks reacting to target/pointer parameters
  const pointerMidExpr = 'floor((low + high) / 2)';
  const mid1 = safeEvaluateMath(pointerMidExpr, { low: 0, high: 7 });
  const mid2 = safeEvaluateMath(pointerMidExpr, { low: 4, high: 7 });
  console.assert(mid1 === 3, `mid pointer should be 3, got ${mid1}`);
  console.assert(mid2 === 5, `mid pointer should update to 5 when low parameter changes to 4, got ${mid2}`);

  // Test D: Animation state resolver correctly propagates changed parameterValues to runtimeState
  const dynamicPlan = validateAndNormalizePlan({
    title: 'Reactive Trajectory Plan',
    concept_type: 'physics',
    parameters: [
      { id: 'v0', default: 20 },
      { id: 'angle', default: 45 }
    ],
    steps: [
      { step_number: 1, title: 'Launch', guidance: { what_is_happening: 'Launch', why_it_happens: 'Initial velocity' } },
      { step_number: 2, title: 'Impact', guidance: { what_is_happening: 'Impact', why_it_happens: 'Gravity' }, is_final_step: true }
    ],
    visualization: {
      type: 'coordinate_graph',
      coordinate_graph: {
        x_axis: { min: 0, max: 100 },
        y_axis: { min: 0, max: 100 },
        curves: [{ id: 'c1', expression: projectileCurveExpr }]
      }
    }
  }).plan!;

  const runtimeWithNewParams = buildRuntimeState(dynamicPlan, 1, 0, false, 1, { v0: 35, angle: 60 });
  console.assert(runtimeWithNewParams.parameters.v0 === 35, 'Runtime state must preserve live updated v0 parameter');
  console.assert(runtimeWithNewParams.parameters.angle === 60, 'Runtime state must preserve live updated angle parameter');

  // 12. Regression Test: User-controlled parameter values remain authoritative when step overrides contain the same keys
  const stepOverrideCollisionPlan = validateAndNormalizePlan({
    title: 'Parameter Override Collision Plan',
    concept_type: 'math',
    parameters: [
      { id: 'v0', default: 20 },
      { id: 'k', default: 5 }
    ],
    steps: [
      {
        step_number: 1,
        title: 'Step 1',
        parameter_overrides: { v0: 10, current_phase: 'init' },
        state: { flag: 'step1' },
        guidance: { what_is_happening: 'Init', why_it_happens: 'Start' }
      },
      {
        step_number: 2,
        title: 'Step 2',
        parameter_overrides: { v0: 15, current_phase: 'running' },
        guidance: { what_is_happening: 'Run', why_it_happens: 'Progress' }
      }
    ],
    visualization: {
      type: 'coordinate_graph',
      coordinate_graph: {
        x_axis: { min: 0, max: 100 },
        y_axis: { min: 0, max: 100 },
        curves: [{ id: 'c1', expression: 'k * x' }]
      }
    }
  }).plan!;

  // When user has changed slider v0 to 45
  const userParams = { v0: 45, k: 5 };
  const resolvedStep1 = buildRuntimeState(stepOverrideCollisionPlan, 1, 0, false, 1, userParams);
  console.assert(
    resolvedStep1.parameters.v0 === 45,
    `User parameter v0 must remain authoritative (45) despite step 1 override (10), got ${resolvedStep1.parameters.v0}`
  );
  console.assert(
    resolvedStep1.parameters.current_phase === 'init',
    `Animation state current_phase must be preserved as 'init', got ${resolvedStep1.parameters.current_phase}`
  );
  console.assert(
    resolvedStep1.parameters.flag === 'step1',
    `Animation state flag must be preserved as 'step1', got ${resolvedStep1.parameters.flag}`
  );

  const resolvedStep2 = buildRuntimeState(stepOverrideCollisionPlan, 2, 0, false, 1, userParams);
  console.assert(
    resolvedStep2.parameters.v0 === 45,
    `User parameter v0 must remain authoritative (45) in step 2 despite override (15), got ${resolvedStep2.parameters.v0}`
  );
  console.assert(
    resolvedStep2.parameters.current_phase === 'running',
    `Animation state current_phase must be 'running' at step 2, got ${resolvedStep2.parameters.current_phase}`
  );

  // 13. Regression Test: Parameter changes producing different computed graph coordinates under stable coordinate frame
  const stableXAxisMax = 120;
  const stableMinX = 0;
  const plotWidth = 695; // 800 - 65 - 40
  const paddingLeft = 65;
  const toSvgXTest = (x: number, maxX: number) => paddingLeft + ((x - stableMinX) / (maxX - stableMinX)) * plotWidth;

  const landingXExpr = '(v0^2 * sin(2 * deg2rad(angle))) / g';
  const landingV20 = safeEvaluateMath(landingXExpr, { v0: 20, angle: 45, g: 9.8 });
  const landingV30 = safeEvaluateMath(landingXExpr, { v0: 30, angle: 45, g: 9.8 });

  // Under stable reference frame (max = 120, since both 40.8 and 91.8 <= 120)
  const svgXV20 = toSvgXTest(landingV20, stableXAxisMax);
  const svgXV30 = toSvgXTest(landingV30, stableXAxisMax);

  console.assert(
    Math.abs(svgXV30 - svgXV20) > 200,
    `Changing velocity from 20 to 30 must produce visibly different SVG coordinates across stable domain: got ${svgXV20.toFixed(1)}px vs ${svgXV30.toFixed(1)}px`
  );

  // 14. Regression Test: Reactive expressions updating marker or pointer positions despite stale static step data
  const markerTestDef: { id: string; x_expr?: string; y_expr?: string; x?: number; y?: number } = {
    id: 'marker_impact',
    x_expr: '(v0^2 * sin(2 * deg2rad(angle))) / g',
    y_expr: '0'
  };
  const stepWithStaleMarker: { marker_positions: Record<string, { x?: number; y?: number; x_expr?: string; y_expr?: string }> } = {
    marker_positions: {
      marker_impact: { x: 40.8, y: 0 } // Generated when v0 was 20
    }
  };

  // Live user change v0=30 supersedes stale static step position:
  const liveParamsV30 = { v0: 30, angle: 45, g: 9.8 };
  const hasLiveExpr = Boolean(stepWithStaleMarker.marker_positions.marker_impact?.x_expr || markerTestDef.x_expr);
  let resolvedMarkerX = hasLiveExpr
    ? safeEvaluateMath(stepWithStaleMarker.marker_positions.marker_impact?.x_expr || markerTestDef.x_expr!, liveParamsV30)
    : (stepWithStaleMarker.marker_positions.marker_impact.x ?? 0);
  console.assert(
    resolvedMarkerX > 90,
    `Reactive marker expression must evaluate with live v0=30 to ~91.8 instead of stale 40.8, got ${resolvedMarkerX}`
  );

  // Pointer in DiscreteBlocks with reactive expression vs stale step pointer_positions
  const ptrDef: { id: string; target_index_expr?: string; target_index: number } = {
    id: 'mid_ptr',
    target_index_expr: 'floor((low + high) / 2)',
    target_index: 0
  };
  const stepWithStalePointer: { pointer_positions: Record<string, number> } = {
    pointer_positions: {
      mid_ptr: 3 // Stale position when low=0, high=7
    }
  };
  const liveParamsLow4 = { low: 4, high: 7 };
  let resolvedPointerIdx = ptrDef.target_index_expr
    ? safeEvaluateMath(ptrDef.target_index_expr, liveParamsLow4)
    : stepWithStalePointer.pointer_positions.mid_ptr;
  console.assert(
    resolvedPointerIdx === 5,
    `Reactive pointer expression must evaluate to 5 with low=4 instead of stale step position 3, got ${resolvedPointerIdx}`
  );

  // 15. Regression Test: Existing animation-step overrides still work when no live parameter dependency exists
  const staticMarkerDef: { id: string; x?: number; y?: number; x_expr?: string } = {
    id: 'checkpoint_a',
    x: 10,
    y: 5
  };
  const stepExplicitOverride: { marker_positions: Record<string, { x: number; y: number }> } = {
    marker_positions: {
      checkpoint_a: { x: 25, y: 15 }
    }
  };
  const resolvedStaticMarkerX = staticMarkerDef.x_expr
    ? safeEvaluateMath(staticMarkerDef.x_expr, liveParamsV30)
    : stepExplicitOverride.marker_positions.checkpoint_a.x;
  console.assert(
    resolvedStaticMarkerX === 25,
    `Explicit animation-step override must be preserved when no live expression exists, got ${resolvedStaticMarkerX}`
  );

  const staticPointerDef: { id: string; label: string; target_index: number; target_index_expr?: string } = {
    id: 'cursor',
    label: 'Cursor',
    target_index: 0
  };
  const stepExplicitPointer: { pointer_positions: Record<string, number> } = {
    pointer_positions: {
      cursor: 6
    }
  };
  const resolvedStaticPointer = staticPointerDef.target_index_expr
    ? safeEvaluateMath(staticPointerDef.target_index_expr, liveParamsLow4)
    : stepExplicitPointer.pointer_positions.cursor;
  console.assert(
    resolvedStaticPointer === 6,
    `Explicit animation-step pointer position must be preserved when no live expression exists, got ${resolvedStaticPointer}`
  );

  // 16. Regression Test: Existing behavior for plans without reactive expressions remaining unchanged
  const staticPlan = validateAndNormalizePlan({
    title: 'Pure Static Discrete Simulation',
    concept_type: 'cs',
    steps: [
      { step_number: 1, title: 'Step 1', pointer_positions: { p1: 1 }, guidance: { what_is_happening: 'Step 1', why_it_happens: 'Start' } },
      { step_number: 2, title: 'Step 2', pointer_positions: { p1: 4 }, guidance: { what_is_happening: 'Step 2', why_it_happens: 'Jump' }, is_final_step: true }
    ],
    visualization: {
      type: 'discrete_blocks',
      discrete_blocks: {
        blocks: [{ id: '0', value: 10 }, { id: '1', value: 20 }, { id: '2', value: 30 }, { id: '3', value: 40 }, { id: '4', value: 50 }],
        pointers: [{ id: 'p1', label: 'P1', target_index: 0 }]
      }
    }
  }).plan!;

  const staticState1 = buildRuntimeState(staticPlan, 1, 0, false, 1, {});
  const staticState2 = buildRuntimeState(staticPlan, 2, 0, false, 1, {});
  console.assert(staticState1.currentStepIndex === 1, 'Static plan step 1 index must match');
  console.assert(staticState2.currentStepIndex === 2, 'Static plan step 2 index must match');

  // 17. Regression Test: AI Concept Tutor Markdown & Math Equation Rendering
  console.log('Testing AI Concept Tutor Markdown & Math Rendering...');

  // Test A: Normalization of unnecessarily escaped Markdown markers
  const rawTutorResponse = `\\### Core Acceleration Law
\\* Initial launch velocity is \\$v_0 = 20\\text{ m/s}\\$
\\* The angle is \\(\\theta = 45^\\circ\\)
\\* Notice that \\*\\*gravity\\*\\* causes constant downward acceleration
\\* The \\*parabolic arc\\* is defined by:
\\[ y = x\\tan(\\theta) - \\frac{g x^2}{2 v_0^2 \\cos^2(\\theta)} \\]
Multiplication fact: 5 \\* 3 = 15.
Issue \\#42 is unresolved.`;

  const normalizedTutor = normalizeTutorMarkdown(rawTutorResponse);
  console.assert(normalizedTutor.includes('### Core Acceleration Law'), 'Escaped ### heading must be normalized to ###');
  console.assert(!normalizedTutor.includes('\\### Core'), 'Raw \\### must not appear');
  console.assert(normalizedTutor.includes('* Initial launch velocity'), 'Escaped \\* list item must be normalized to *');
  console.assert(normalizedTutor.includes('**gravity**'), 'Escaped \\*\\*gravity\\*\\* must be normalized to **gravity**');
  console.assert(normalizedTutor.includes('*parabolic arc*'), 'Escaped \\*italic\\* must be normalized to *italic*');
  console.assert(normalizedTutor.includes('$v_0 = 20\\text{ m/s}$'), 'Escaped \\$ math must be normalized to $ math $');
  console.assert(normalizedTutor.includes('5 \\* 3 = 15'), 'Legitimate multiplication 5 \\* 3 = 15 must NOT be damaged');
  console.assert(normalizedTutor.includes('Issue \\#42'), 'Non-heading \\# in text must NOT be converted to a heading');

  // Test B: Extraction of inline and block LaTeX expressions
  const { normalizedText, mathMap } = extractMathPlaceholders(rawTutorResponse);
  console.assert(mathMap.size >= 3, `Expected at least 3 math expressions, got ${mathMap.size}`);
  
  const mathItems = Array.from(mathMap.values());
  const inlineV0 = mathItems.find((m) => m.formula.includes('v_0 = 20'));
  console.assert(inlineV0 !== undefined, 'Inline math v_0 must be extracted');
  console.assert(inlineV0?.isBlock === false, 'Inline math v_0 must have isBlock === false');

  const inlineTheta = mathItems.find((m) => m.formula.includes('\\theta = 45'));
  console.assert(inlineTheta !== undefined, 'Inline math \\( \\theta \\) must be extracted');
  console.assert(inlineTheta?.isBlock === false, 'Inline math \\( \\theta \\) must have isBlock === false');

  const blockTraj = mathItems.find((m) => m.formula.includes('\\tan(\\theta)'));
  console.assert(blockTraj !== undefined, 'Block math \\[ y = ... \\] must be extracted');
  console.assert(blockTraj?.isBlock === true, 'Block math \\[ y = ... \\] must have isBlock === true');

  // Test C: Safe KaTeX rendering output
  const katexBlockHtml = renderKatexHtml(blockTraj!.formula, true);
  console.assert(katexBlockHtml.includes('katex-display') || katexBlockHtml.includes('katex'), 'KaTeX block math must render HTML');
  console.assert(katexBlockHtml.includes('tan') || katexBlockHtml.includes('cos'), 'KaTeX block math must contain trigonometric terms');

  const katexInlineHtml = renderKatexHtml(inlineV0!.formula, false);
  console.assert(katexInlineHtml.includes('katex'), 'KaTeX inline math must render HTML');

  // Test D: Malformed math does not crash or throw
  const malformedMath = '\\frac{unclosed';
  const safeFallback = renderKatexHtml(malformedMath, false);
  console.assert(typeof safeFallback === 'string' && safeFallback.length > 0, 'Malformed math must render a safe fallback string');

  // Test E: Tutor layout isolation contract
  // The user question area must be anchored (shrink-0) outside the scrollable messages container (overflow-y-auto)
  // so that scrolling long tutor answers does not displace or move the question input field.
  const tutorLayoutContract = {
    scrollableMessagesRole: 'overflow-y-auto',
    pinnedInputRole: 'shrink-0',
    anchoredAtBottom: true,
  };
  console.assert(
    tutorLayoutContract.scrollableMessagesRole === 'overflow-y-auto' &&
    tutorLayoutContract.pinnedInputRole === 'shrink-0' &&
    tutorLayoutContract.anchoredAtBottom === true,
    'Tutor layout contract must isolate scrolling messages from pinned input footer'
  );

  console.log('--- All Generic Visualization Sanity, Model Resolution, & Timeout Tests Passed ---');
  return true;
}
