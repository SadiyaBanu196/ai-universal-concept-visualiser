/**
 * Generic Animation & Timeline State Resolver
 * Pure declarative state resolution engine for all visualization types.
 * Derives current visual properties, interpolated parameters, and active element states
 * based on timeline position (step + continuous progress).
 */

import { VisualizationPlan, StepDef, VisualizationRuntimeState } from '../types/visualization';

export function interpolateNumber(a: number, b: number, t: number): number {
  if (!Number.isFinite(a)) return b;
  if (!Number.isFinite(b)) return a;
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

export function resolveRuntimeParameters(
  plan: VisualizationPlan,
  currentStepIndex: number,
  progress: number,
  userParameters: Record<string, any>
): Record<string, any> {
  const totalSteps = Math.max(plan.steps.length, 1);
  const clampedStep = Math.max(1, Math.min(totalSteps, currentStepIndex));
  const stepIdx = clampedStep - 1;

  const currentStep = plan.steps[stepIdx] || plan.steps[0];
  const nextStep = plan.steps[Math.min(totalSteps - 1, stepIdx + 1)] || currentStep;

  // Base parameters
  const resolved: Record<string, any> = { ...userParameters };

  // Calculate timeline variables
  const effectiveProgress = clampedStep >= totalSteps ? 0 : progress;
  const globalProgress = totalSteps > 1
    ? Math.max(0, Math.min(1, (clampedStep - 1 + effectiveProgress) / (totalSteps - 1)))
    : Math.max(0, Math.min(1, progress));

  resolved.step = clampedStep;
  resolved.progress = progress;
  resolved.globalProgress = globalProgress;
  resolved.t = globalProgress;
  resolved.time = globalProgress;

  // Identify user-controlled parameters defined in the plan or active in userParameters
  const userParamKeys = new Set([
    ...(plan.parameters?.map((p) => p.id) || []),
    ...Object.keys(userParameters || {}),
  ]);

  // Apply current step parameter overrides & state (preserving reserved timeline keys and user-controlled parameters)
  const currentOverrides = { ...(currentStep.parameter_overrides || {}), ...(currentStep.state || {}) };
  const nextOverrides = { ...(nextStep.parameter_overrides || {}), ...(nextStep.state || {}) };

  // Apply current overrides without clobbering reserved timeline variables or user-controlled parameters
  for (const [k, v] of Object.entries(currentOverrides)) {
    if (k !== 'step' && k !== 'progress' && k !== 'globalProgress' && k !== 't' && k !== 'time') {
      if (!userParamKeys.has(k)) {
        resolved[k] = v;
      }
    }
  }

  // Interpolate numerical overrides between currentStep and nextStep if progress > 0 (only for non-user parameters)
  if (progress > 0 && clampedStep < totalSteps) {
    for (const key of Object.keys(currentOverrides)) {
      if (userParamKeys.has(key)) continue;
      const valA = currentOverrides[key];
      const valB = nextOverrides[key];
      if (typeof valA === 'number' && typeof valB === 'number') {
        resolved[key] = interpolateNumber(valA, valB, progress);
      }
    }
    // Also interpolate any keys in nextOverrides that weren't in currentOverrides
    for (const key of Object.keys(nextOverrides)) {
      if (userParamKeys.has(key)) continue;
      if (currentOverrides[key] === undefined && typeof nextOverrides[key] === 'number') {
        const baseVal = resolved[key] ?? userParameters[key] ?? 0;
        resolved[key] = interpolateNumber(baseVal, nextOverrides[key], progress);
      }
    }
  }

  return resolved;
}

export function buildRuntimeState(
  plan: VisualizationPlan,
  currentStepIndex: number,
  progress: number,
  isPlaying: boolean,
  speed: number,
  userParameters: Record<string, any>
): VisualizationRuntimeState {
  const totalSteps = Math.max(plan.steps.length, 1);
  const clampedStep = Math.max(1, Math.min(totalSteps, currentStepIndex));
  const activeStep = plan.steps[clampedStep - 1] || plan.steps[0];

  const effectiveProgress = clampedStep >= totalSteps ? 0 : progress;
  const globalProgress = totalSteps > 1
    ? Math.max(0, Math.min(1, (clampedStep - 1 + effectiveProgress) / (totalSteps - 1)))
    : Math.max(0, Math.min(1, progress));

  const parameters = resolveRuntimeParameters(plan, clampedStep, progress, userParameters);
  const highlightElementIds = activeStep?.highlight_element_ids || [];

  return {
    currentStepIndex: clampedStep,
    progress,
    globalProgress,
    isPlaying,
    speed,
    parameters,
    activeStep,
    highlightElementIds,
  };
}
