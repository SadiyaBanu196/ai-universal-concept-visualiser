import React, { useState } from 'react';
import { VisualizationPlan } from '../../types/visualization';
import { GenericVisualizationEngine } from '../visualization/GenericVisualizationEngine';
import { ExplanationPanel } from './ExplanationPanel';
import { ArrowLeft } from 'lucide-react';

interface Props {
  plan: VisualizationPlan;
  onBack: () => void;
}

export const VisualizationWorkspace: React.FC<Props> = ({ plan, onBack }) => {
  const [currentStep, setCurrentStep] = useState<number>(1);

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Workspace Header Strip */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-smoke-200 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <button
              onClick={onBack}
              className="p-1 rounded-lg text-smoke-500 hover:text-smoke-900 hover:bg-smoke-100 transition-colors mr-1 cursor-pointer"
              title="Return to Home Prompt"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-smoke-950 font-display">
              {plan.title}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-smoke-500 pl-7">
            <span className="capitalize font-mono font-medium text-smoke-700">{plan.concept_type}</span>
            <span aria-hidden="true">·</span>
            <span>{plan.learning_objective}</span>
          </div>
        </div>

        {/* Action tags */}
        <div className="flex items-center gap-2">
          {plan.tags && plan.tags.length > 0 && (
            <div className="hidden lg:flex items-center gap-1.5 text-xs text-smoke-500">
              {plan.tags.slice(0, 3).map((tag, idx) => (
                <span key={idx} className="text-smoke-600 font-mono text-[11px]">
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Two-Zone Sandbox Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Zone: Interactive Stage + Control Deck (60-65% width on desktop) */}
        <div className="lg:col-span-7 xl:col-span-7 space-y-4">
          <GenericVisualizationEngine
            plan={plan}
            currentStep={currentStep}
            onStepChange={setCurrentStep}
          />
        </div>

        {/* Right Zone: Deep Explanation Deck & AI Tutor (35-40% width on desktop) */}
        <div className="lg:col-span-5 xl:col-span-5 h-[620px]">
          <ExplanationPanel
            plan={plan}
            currentStep={currentStep}
            onSelectStep={setCurrentStep}
          />
        </div>
      </div>
    </div>
  );
};
