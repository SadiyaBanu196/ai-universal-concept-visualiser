import React from 'react';
import { ParameterDef } from '../../types/visualization';
import { Play, Pause, SkipBack, SkipForward, RotateCcw, Sliders } from 'lucide-react';

interface Props {
  parameters: ParameterDef[];
  parameterValues: Record<string, any>;
  onParameterChange: (id: string, value: any) => void;
  onResetParameters: () => void;
  currentStep: number;
  totalSteps: number;
  progress?: number;
  globalProgress?: number;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onNextStep: () => void;
  onPrevStep: () => void;
  onSelectStep: (stepIndex: number) => void;
  onScrub?: (globalProgress: number) => void;
  speed: number;
  onSpeedChange: (speed: number) => void;
}

export const ControlDeck: React.FC<Props> = ({
  parameters,
  parameterValues,
  onParameterChange,
  onResetParameters,
  currentStep,
  totalSteps,
  progress = 0,
  globalProgress = 0,
  isPlaying,
  onTogglePlay,
  onNextStep,
  onPrevStep,
  onSelectStep,
  onScrub,
  speed,
  onSpeedChange,
}) => {
  return (
    <div className="w-full bg-white rounded-xl border border-smoke-200 p-4 shadow-xs space-y-4">
      {/* Top row: Playback & Timeline Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-smoke-100 pb-3">
        {/* Step Indicator & Timeline Navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={onPrevStep}
            disabled={currentStep <= 1}
            className="p-1.5 rounded-lg border border-smoke-200 text-smoke-700 hover:bg-smoke-50 disabled:opacity-35 disabled:cursor-not-allowed transition-colors cursor-pointer"
            title="Previous Step"
          >
            <SkipBack className="w-4 h-4" />
          </button>
          <button
            onClick={onTogglePlay}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-smoke-800 text-white hover:bg-smoke-900 transition-colors text-xs font-medium cursor-pointer"
            title={isPlaying ? 'Pause Simulation' : 'Play Timeline'}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isPlaying ? 'Pause' : 'Play'}</span>
          </button>
          <button
            onClick={onNextStep}
            disabled={currentStep >= totalSteps}
            className="p-1.5 rounded-lg border border-smoke-200 text-smoke-700 hover:bg-smoke-50 disabled:opacity-35 disabled:cursor-not-allowed transition-colors cursor-pointer"
            title="Next Step"
          >
            <SkipForward className="w-4 h-4" />
          </button>

          <div className="h-4 w-px bg-smoke-200 mx-1" />

          {/* Timeline Step Dots */}
          <div className="flex items-center gap-1">
            {Array.from({ length: totalSteps }, (_, i) => i + 1).map((stepNum) => (
              <button
                key={stepNum}
                onClick={() => onSelectStep(stepNum)}
                className={`w-6 h-6 rounded-md text-[11px] font-mono font-medium transition-all cursor-pointer ${
                  currentStep === stepNum
                    ? 'bg-smoke-700 text-white shadow-xs'
                    : 'bg-smoke-50 text-smoke-600 hover:bg-smoke-100'
                }`}
              >
                {stepNum}
              </button>
            ))}
          </div>
        </div>

        {/* Speed & Reset */}
        <div className="flex items-center gap-2">
          {/* Speed Selector */}
          <div className="flex items-center gap-1 bg-smoke-100 p-0.5 rounded-lg text-xs font-mono">
            {[0.5, 1, 2].map((s) => (
              <button
                key={s}
                onClick={() => onSpeedChange(s)}
                className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors cursor-pointer ${
                  speed === s ? 'bg-white text-smoke-900 shadow-xs' : 'text-smoke-600 hover:text-smoke-900'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>

          <button
            onClick={onResetParameters}
            className="flex items-center gap-1 text-xs text-smoke-600 hover:text-smoke-900 px-2 py-1 rounded-md hover:bg-smoke-50 transition-colors cursor-pointer"
            title="Reset All Parameters to Defaults"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Middle row: Continuous Timeline Scrubber Bar */}
      {totalSteps > 1 && (
        <div className="space-y-1 pt-0.5">
          <div className="flex items-center justify-between text-[11px] font-mono text-smoke-600">
            <span className="flex items-center gap-1.5">
              <span>Progress: {Math.round(globalProgress * 100)}%</span>
              {currentStep === totalSteps && (
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded-xs border border-emerald-200">
                  Walkthrough Complete
                </span>
              )}
            </span>
            <span className="font-semibold text-smoke-900">Step {currentStep} of {totalSteps}</span>
          </div>
          <div className="relative flex items-center">
            <input
              type="range"
              min={0}
              max={1}
              step={0.005}
              value={globalProgress}
              onChange={(e) => onScrub?.(parseFloat(e.target.value))}
              className="w-full h-2 bg-smoke-100 rounded-lg appearance-none cursor-pointer accent-smoke-800"
            />
          </div>
        </div>
      )}

      {/* Dynamic Parameter Sliders & Toggles */}
      {parameters.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
          {parameters.map((param) => {
            const currentVal = parameterValues[param.id] ?? param.default;

            if (param.type === 'boolean') {
              return (
                <div key={param.id} className="flex items-center justify-between bg-smoke-50/70 p-2.5 rounded-lg border border-smoke-100">
                  <div>
                    <label className="text-xs font-medium text-smoke-900 block">{param.name}</label>
                    {param.description && <span className="text-[10px] text-smoke-500 block truncate max-w-[160px]">{param.description}</span>}
                  </div>
                  <button
                    onClick={() => onParameterChange(param.id, !currentVal)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                      currentVal ? 'bg-smoke-700' : 'bg-smoke-300'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                        currentVal ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              );
            }

            if (param.type === 'select' && param.options) {
              return (
                <div key={param.id} className="bg-smoke-50/70 p-2.5 rounded-lg border border-smoke-100 space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-smoke-900">{param.name}</label>
                  </div>
                  <select
                    value={String(currentVal)}
                    onChange={(e) => onParameterChange(param.id, e.target.value)}
                    className="w-full text-xs bg-white border border-smoke-200 rounded-md px-2 py-1 text-smoke-800 focus:outline-hidden focus:border-smoke-500"
                  >
                    {param.options.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
              );
            }

            // Numeric Slider
            const min = param.min ?? 0;
            const max = param.max ?? 100;
            const step = param.step ?? 1;

            return (
              <div key={param.id} className="bg-smoke-50/70 p-2.5 rounded-lg border border-smoke-100 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-smoke-900 truncate pr-2">{param.name}</span>
                  <span className="font-mono text-[11px] font-semibold text-smoke-700 tabular-nums shrink-0">
                    {Number(currentVal).toFixed(step < 1 ? 2 : 0)} {param.unit || ''}
                  </span>
                </div>
                <input
                  type="range"
                  min={min}
                  max={max}
                  step={step}
                  value={Number(currentVal)}
                  onChange={(e) => onParameterChange(param.id, parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-smoke-200 rounded-lg appearance-none cursor-pointer accent-smoke-700"
                />
                <div className="flex justify-between text-[10px] text-smoke-400 font-mono">
                  <span>{min}</span>
                  <span>{max}</span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex items-center gap-2 text-xs text-smoke-500 py-1">
          <Sliders className="w-3.5 h-3.5 text-smoke-400" />
          <span>This concept runs primarily via discrete timeline progression. Use the step controllers above.</span>
        </div>
      )}
    </div>
  );
};
