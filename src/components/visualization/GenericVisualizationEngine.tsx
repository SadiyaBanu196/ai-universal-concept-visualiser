import React, { useState, useEffect, useMemo, useRef } from 'react';
import { VisualizationPlan } from '../../types/visualization';
import { CoordinateGraphRenderer } from './CoordinateGraphRenderer';
import { NodeNetworkRenderer } from './NodeNetworkRenderer';
import { DiscreteBlocksRenderer } from './DiscreteBlocksRenderer';
import { ParticleSystemRenderer } from './ParticleSystemRenderer';
import { ControlDeck } from './ControlDeck';
import { buildRuntimeState } from '../../utils/animationResolver';
import { Info, HelpCircle } from 'lucide-react';

interface Props {
  plan: VisualizationPlan;
  currentStep?: number;
  onStepChange?: (step: number) => void;
  onSelectElement?: (element: { id: string; label: string; description?: string }) => void;
}

export const GenericVisualizationEngine: React.FC<Props> = ({
  plan,
  currentStep = 1,
  onStepChange,
  onSelectElement,
}) => {
  // Initialize parameter values from plan defaults
  const [parameterValues, setParameterValues] = useState<Record<string, any>>(() => {
    const init: Record<string, any> = {};
    plan.parameters.forEach((p) => {
      init[p.id] = p.default;
    });
    return init;
  });

  // Animation timeline state
  const [progress, setProgress] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [speed, setSpeed] = useState<number>(1);
  const [selectedElement, setSelectedElement] = useState<{ id: string; label: string; description?: string } | null>(null);

  const totalSteps = Math.max(plan.steps.length, 1);

  // Keep references for animation loop without causing render-phase state conflicts
  const currentStepRef = useRef<number>(currentStep);
  const currentProgressRef = useRef<number>(0);
  const totalStepsRef = useRef<number>(totalSteps);
  const onStepChangeRef = useRef(onStepChange);

  useEffect(() => {
    currentStepRef.current = currentStep;
  }, [currentStep]);

  useEffect(() => {
    totalStepsRef.current = totalSteps;
  }, [totalSteps]);

  useEffect(() => {
    onStepChangeRef.current = onStepChange;
  }, [onStepChange]);

  // Reset parameters and state when plan changes
  useEffect(() => {
    const init: Record<string, any> = {};
    plan.parameters.forEach((p) => {
      init[p.id] = p.default;
    });
    setParameterValues(init);
    setProgress(0);
    currentProgressRef.current = 0;
    setIsPlaying(false);
    setSelectedElement(null);

    if (currentStep !== 1) {
      onStepChangeRef.current?.(1);
    }
  }, [plan.id]);

  // Step definitions
  const stepIdx = Math.max(0, Math.min(totalSteps - 1, currentStep - 1));
  const activeStepObj = useMemo(() => {
    return plan.steps[stepIdx] || plan.steps[0];
  }, [plan.steps, stepIdx]);

  const nextStepObj = useMemo(() => {
    return plan.steps[Math.min(totalSteps - 1, stepIdx + 1)] || activeStepObj;
  }, [plan.steps, stepIdx, totalSteps, activeStepObj]);

  // Derive full runtime state with interpolated parameters
  const runtimeState = useMemo(() => {
    return buildRuntimeState(plan, currentStep, progress, isPlaying, speed, parameterValues);
  }, [plan, currentStep, progress, isPlaying, speed, parameterValues]);

  // Continuous animation loop using requestAnimationFrame
  const animFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isPlaying) {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      lastTimeRef.current = null;
      return;
    }

    const stepDurationMs = 2400 / speed;

    const tick = (now: number) => {
      if (lastTimeRef.current === null) {
        lastTimeRef.current = now;
      }

      const delta = now - lastTimeRef.current;
      lastTimeRef.current = now;

      const increment = delta / stepDurationMs;
      const nextProgress = currentProgressRef.current + increment;

      if (nextProgress >= 1) {
        currentProgressRef.current = 0;
        setProgress(0);

        const current = currentStepRef.current;
        const total = totalStepsRef.current;
        if (current >= total) {
          // Reached the end of the walkthrough: pause so learner can inspect the final result
          setIsPlaying(false);
          return;
        }

        const nextStep = current + 1;
        currentStepRef.current = nextStep;
        onStepChangeRef.current?.(nextStep);
      } else {
        currentProgressRef.current = nextProgress;
        setProgress(nextProgress);
      }

      animFrameRef.current = requestAnimationFrame(tick);
    };

    animFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      lastTimeRef.current = null;
    };
  }, [isPlaying, speed]);

  const handleParameterChange = (id: string, val: any) => {
    setParameterValues((prev) => ({
      ...prev,
      [id]: val,
    }));
  };

  const handleResetParameters = () => {
    const init: Record<string, any> = {};
    plan.parameters.forEach((p) => {
      init[p.id] = p.default;
    });
    setParameterValues(init);
    currentProgressRef.current = 0;
    setProgress(0);
    currentStepRef.current = 1;
    onStepChange?.(1);
  };

  const handleSelectStep = (stepNum: number) => {
    const clamped = Math.max(1, Math.min(totalSteps, stepNum));
    currentProgressRef.current = 0;
    setProgress(0);
    currentStepRef.current = clamped;
    onStepChange?.(clamped);
  };

  const handleScrub = (targetGlobalProgress: number) => {
    const clampedGlobal = Math.max(0, Math.min(1, targetGlobalProgress));
    if (totalSteps <= 1) {
      currentProgressRef.current = clampedGlobal;
      setProgress(clampedGlobal);
      onStepChange?.(1);
      return;
    }

    const rawStepVal = clampedGlobal * (totalSteps - 1);
    const targetStep = Math.min(totalSteps, Math.floor(rawStepVal) + 1);
    const targetStepProgress = rawStepVal - Math.floor(rawStepVal);

    currentProgressRef.current = targetStepProgress;
    setProgress(targetStepProgress);
    currentStepRef.current = targetStep;
    onStepChange?.(targetStep);
  };

  const handleNextStep = () => {
    const next = Math.min(totalSteps, currentStepRef.current + 1);
    currentProgressRef.current = 0;
    setProgress(0);
    currentStepRef.current = next;
    onStepChange?.(next);
  };

  const handlePrevStep = () => {
    const prev = Math.max(1, currentStepRef.current - 1);
    currentProgressRef.current = 0;
    setProgress(0);
    currentStepRef.current = prev;
    onStepChange?.(prev);
  };

  const handleElementClick = (elem: { id: string; label: string; description?: string }) => {
    setSelectedElement(elem);
    onSelectElement?.(elem);
  };

  const { visualization } = plan;

  return (
    <div className="w-full flex flex-col space-y-4">
      {/* Interactive Canvas / Stage Container */}
      <div className="relative w-full rounded-2xl bg-smoke-100/60 border border-smoke-200 p-4 shadow-xs flex flex-col min-h-[460px]">
        {/* Stage Header Info */}
        <div className="flex items-center justify-between mb-2 px-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-smoke-600 font-mono">
              Stage {currentStep}/{totalSteps}: {activeStepObj?.title || `Step ${currentStep}`}
            </span>
            {activeStepObj?.is_final_step && (
              <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-700 text-white shadow-2xs">
                Walkthrough Complete
              </span>
            )}
            {activeStepObj?.result_badge && (
              <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-md bg-smoke-200 text-smoke-800">
                {activeStepObj.result_badge}
              </span>
            )}
          </div>

          {activeStepObj?.annotation && (
            <div className="flex items-center gap-1 text-xs text-smoke-600 bg-white/80 px-2 py-0.5 rounded-md border border-smoke-200">
              <Info className="w-3.5 h-3.5 text-smoke-500" />
              <span>{activeStepObj.annotation}</span>
            </div>
          )}
        </div>

        {/* Dynamic Generic Visualization Dispatcher */}
        <div className="flex-1 flex items-center justify-center w-full">
          {visualization.type === 'coordinate_graph' && visualization.coordinate_graph && (
            <CoordinateGraphRenderer
              config={visualization.coordinate_graph}
              parameterValues={runtimeState.parameters}
              activeStep={currentStep}
              progress={progress}
              globalProgress={runtimeState.globalProgress}
              highlightElementIds={runtimeState.highlightElementIds}
              currentStepDef={activeStepObj}
              nextStepDef={nextStepObj}
              onSelectElement={handleElementClick}
            />
          )}

          {visualization.type === 'node_network' && visualization.node_network && (
            <NodeNetworkRenderer
              config={visualization.node_network}
              parameterValues={runtimeState.parameters}
              activeStep={currentStep}
              progress={progress}
              globalProgress={runtimeState.globalProgress}
              highlightElementIds={runtimeState.highlightElementIds}
              currentStepDef={activeStepObj}
              nextStepDef={nextStepObj}
              onSelectElement={handleElementClick}
            />
          )}

          {visualization.type === 'discrete_blocks' && visualization.discrete_blocks && (
            <DiscreteBlocksRenderer
              config={visualization.discrete_blocks}
              parameterValues={runtimeState.parameters}
              activeStep={currentStep}
              progress={progress}
              globalProgress={runtimeState.globalProgress}
              highlightElementIds={runtimeState.highlightElementIds}
              currentStepDef={activeStepObj}
              nextStepDef={nextStepObj}
              onSelectElement={handleElementClick}
            />
          )}

          {visualization.type === 'particle_system' && visualization.particle_system && (
            <ParticleSystemRenderer
              config={visualization.particle_system}
              parameterValues={runtimeState.parameters}
              activeStep={currentStep}
              progress={progress}
              globalProgress={runtimeState.globalProgress}
              isPlaying={isPlaying}
              speed={speed}
              highlightElementIds={runtimeState.highlightElementIds}
              currentStepDef={activeStepObj}
              onSelectElement={handleElementClick}
            />
          )}

          {/* Fallback if config is missing */}
          {!visualization.coordinate_graph &&
            !visualization.node_network &&
            !visualization.discrete_blocks &&
            !visualization.particle_system && (
              <div className="text-center p-8 text-smoke-500">
                <HelpCircle className="w-8 h-8 mx-auto mb-2 text-smoke-400" />
                <p className="text-sm font-medium">Standard declarative model rendered from parameters.</p>
              </div>
            )}
        </div>

        {/* Selected Element Quick Inspector Banner */}
        {selectedElement && (
          <div className="mt-2 bg-white/95 border border-smoke-200 rounded-xl p-3 flex items-start justify-between shadow-xs transition-all">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-smoke-900">{selectedElement.label}</span>
                <span className="text-[10px] text-smoke-500 font-mono">ID: {selectedElement.id}</span>
              </div>
              {selectedElement.description && (
                <p className="text-xs text-smoke-600">{selectedElement.description}</p>
              )}
            </div>
            <button
              onClick={() => setSelectedElement(null)}
              className="text-smoke-400 hover:text-smoke-700 text-xs px-1.5 py-0.5 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Control Deck (Sliders, Play/Pause, Step controllers, Scrubber) */}
      <ControlDeck
        parameters={plan.parameters}
        parameterValues={parameterValues}
        onParameterChange={handleParameterChange}
        onResetParameters={handleResetParameters}
        currentStep={currentStep}
        totalSteps={totalSteps}
        progress={progress}
        globalProgress={runtimeState.globalProgress}
        isPlaying={isPlaying}
        onTogglePlay={() => setIsPlaying(!isPlaying)}
        onNextStep={handleNextStep}
        onPrevStep={handlePrevStep}
        onSelectStep={handleSelectStep}
        onScrub={handleScrub}
        speed={speed}
        onSpeedChange={(s) => setSpeed(s)}
      />
    </div>
  );
};
