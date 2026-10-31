import React from 'react';
import { DiscreteBlocksConfig, DiscreteBlock, BlockPointer, StepDef } from '../../types/visualization';
import { safeEvaluateMath } from '../../utils/mathEvaluator';
import { interpolateNumber } from '../../utils/animationResolver';

interface Props {
  config: DiscreteBlocksConfig;
  parameterValues: Record<string, any>;
  activeStep?: number;
  progress?: number;
  globalProgress?: number;
  highlightElementIds?: string[];
  currentStepDef?: StepDef;
  nextStepDef?: StepDef;
  onSelectElement?: (element: { id: string; label: string; description?: string }) => void;
}

export const DiscreteBlocksRenderer: React.FC<Props> = ({
  config,
  parameterValues,
  activeStep = 1,
  progress = 0,
  globalProgress = 0,
  highlightElementIds = [],
  currentStepDef,
  nextStepDef,
  onSelectElement,
}) => {
  const { kind = 'array', blocks = [], pointers = [], title, comparison_indicator } = config;

  const width = 800;
  const height = 440;

  const blockCount = Math.max(blocks.length, 1);
  const blockWidth = Math.min(68, (width - 120) / blockCount);
  const blockHeight = 64;
  const gap = 8;
  const totalWidth = blockCount * blockWidth + (blockCount - 1) * gap;
  const startX = (width - totalWidth) / 2;
  const startY = (height - blockHeight) / 2;

  // Resolve dynamic block state from parameters or step definitions
  const getDynamicBlockState = (block: DiscreteBlock, idx: number): string => {
    // Check direct step overrides
    if (currentStepDef?.block_states?.[block.id]) {
      return currentStepDef.block_states[block.id];
    }
    if (currentStepDef?.block_states?.[String(idx)]) {
      return currentStepDef.block_states[String(idx)];
    }

    // Check low/high or start/end search bounds if defined in parameters
    const low = parameterValues.low !== undefined
      ? Number(parameterValues.low)
      : parameterValues.start !== undefined
      ? Number(parameterValues.start)
      : undefined;
    const high = parameterValues.high !== undefined
      ? Number(parameterValues.high)
      : parameterValues.end !== undefined
      ? Number(parameterValues.end)
      : undefined;
    const mid = parameterValues.mid !== undefined
      ? Math.round(Number(parameterValues.mid))
      : parameterValues.pivot !== undefined
      ? Math.round(Number(parameterValues.pivot))
      : undefined;

    if (low !== undefined && high !== undefined) {
      if (idx < low || idx > high) {
        return 'eliminated';
      }
      if (mid !== undefined && idx === mid) {
        return 'active';
      }
    }

    // Check step highlight
    if (highlightElementIds.includes(block.id) || highlightElementIds.includes(String(idx))) {
      return 'active';
    }

    return block.state || 'default';
  };

  const getBlockColor = (state: string, isHighlighted: boolean) => {
    if (isHighlighted || state === 'active' || state === 'current') {
      return { bg: '#e0f2fe', border: '#0284c7', text: '#0369a1' };
    }
    switch (state) {
      case 'matched':
      case 'sorted':
        return { bg: '#ecfdf5', border: '#059669', text: '#047857' };
      case 'eliminated':
        return { bg: '#f3f4f6', border: '#d1d5db', text: '#9ca3af' };
      case 'comparing':
        return { bg: '#fef3c7', border: '#d97706', text: '#b45309' };
      default:
        return { bg: '#ffffff', border: '#bac4bc', text: '#292f2b' };
    }
  };

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center p-2 select-none">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto max-h-[520px] bg-white rounded-xl shadow-xs border border-smoke-200"
      >
        {/* Title */}
        {title && (
          <text
            x={width / 2}
            y="42"
            textAnchor="middle"
            className="text-[14px] font-semibold fill-smoke-800"
          >
            {title}
          </text>
        )}

        {/* Comparison Indicator from config or currentStepDef */}
        {(() => {
          const comp = currentStepDef?.comparison_detail || comparison_indicator;
          if (!comp) return null;

          if ('left_label' in comp) {
            return (
              <g transform={`translate(${width / 2}, 68)`}>
                <rect x="-180" y="-14" width="360" height="28" rx="8" fill="#fef3c7" stroke="#f59e0b" strokeWidth="1" />
                <text x="0" y="4" textAnchor="middle" className="text-[11px] font-bold fill-amber-950 font-mono">
                  {comp.left_label} ({comp.left_value}) {comp.operator} {comp.right_label} ({comp.right_value}) → {comp.decision}
                </text>
              </g>
            );
          }

          if ('index_a' in comp && 'index_b' in comp) {
            return (
              <g
                transform={`translate(${
                  startX +
                  ((comp.index_a + comp.index_b) / 2) *
                    (blockWidth + gap) +
                  blockWidth / 2
                }, ${startY - 50})`}
              >
                <rect x="-35" y="-12" width="70" height="24" rx="6" fill="#fef3c7" stroke="#f59e0b" strokeWidth="1" />
                <text x="0" y="4" textAnchor="middle" className="text-[12px] font-bold fill-amber-900 font-mono">
                  {comp.symbol} {comp.label ? `(${comp.label})` : ''}
                </text>
              </g>
            );
          }

          return null;
        })()}

        {/* Blocks (Array cells / Pipeline slots) */}
        {blocks.map((block, idx) => {
          const bx = startX + idx * (blockWidth + gap);
          const by = startY;
          const isHighlighted = highlightElementIds.includes(block.id);
          const blockState = getDynamicBlockState(block, idx);
          const colors = getBlockColor(blockState, isHighlighted);

          return (
            <g
              key={block.id || idx}
              transform={`translate(${bx}, ${by})`}
              className="cursor-pointer group transition-transform duration-200"
              onClick={() => onSelectElement?.({ id: block.id, label: block.label || `Cell [${idx}]`, description: `Value: ${block.value} | State: ${blockState}` })}
            >
              {/* Index label above or below */}
              <text
                x={blockWidth / 2}
                y="-8"
                textAnchor="middle"
                className="text-[10px] font-mono fill-smoke-500 tabular-nums"
              >
                {block.index_label || `[${idx}]`}
              </text>

              {/* Block Rectangle */}
              <rect
                x="0"
                y="0"
                width={blockWidth}
                height={blockHeight}
                rx="8"
                fill={colors.bg}
                stroke={colors.border}
                strokeWidth={isHighlighted || blockState === 'active' ? 2.5 : 1.5}
                className="transition-all duration-200 group-hover:stroke-smoke-900 shadow-xs"
              />

              {/* Value Text */}
              <text
                x={blockWidth / 2}
                y={block.subtext ? blockHeight / 2 - 4 : blockHeight / 2 + 5}
                textAnchor="middle"
                className="text-[14px] font-bold font-mono tabular-nums"
                fill={colors.text}
              >
                {String(block.value)}
              </text>

              {/* Subtext / State tag */}
              {block.subtext && (
                <text
                  x={blockWidth / 2}
                  y={blockHeight / 2 + 14}
                  textAnchor="middle"
                  className="text-[9px] font-medium fill-smoke-600 truncate"
                >
                  {block.subtext}
                </text>
              )}
            </g>
          );
        })}

        {/* Pointers / Cursors (e.g. low, mid, high pointers) */}
        {pointers.map((ptr) => {
          // Check if pointer label exists in parameters (e.g. low, mid, high, ptr)
          let targetIdx = ptr.target_index;

          // 1. Live parameter-dependent expressions supersede stale static positions
          if (ptr.target_index_expr) {
            targetIdx = safeEvaluateMath(ptr.target_index_expr, parameterValues);
          } else if (parameterValues[ptr.label] !== undefined && typeof parameterValues[ptr.label] === 'number') {
            targetIdx = Number(parameterValues[ptr.label]);
          } else if (parameterValues[ptr.id] !== undefined && typeof parameterValues[ptr.id] === 'number') {
            targetIdx = Number(parameterValues[ptr.id]);
          } else if (currentStepDef?.pointer_positions?.[ptr.id] !== undefined) {
            // Explicit animation-step position preserved when no live expression/parameter dependency exists
            targetIdx = currentStepDef.pointer_positions[ptr.id];
            if (nextStepDef?.pointer_positions?.[ptr.id] !== undefined && progress > 0) {
              targetIdx = interpolateNumber(targetIdx, nextStepDef.pointer_positions[ptr.id], progress);
            }
          } else if (currentStepDef?.pointer_positions?.[ptr.label] !== undefined) {
            // Explicit animation-step position preserved by label
            targetIdx = currentStepDef.pointer_positions[ptr.label];
            if (nextStepDef?.pointer_positions?.[ptr.label] !== undefined && progress > 0) {
              targetIdx = interpolateNumber(targetIdx, nextStepDef.pointer_positions[ptr.label], progress);
            }
          }

          const clampedIdx = Math.max(0, Math.min(blocks.length - 1, targetIdx));
          const px = startX + clampedIdx * (blockWidth + gap) + blockWidth / 2;
          const isTop = ptr.position === 'top';
          const py = isTop ? startY - 20 : startY + blockHeight + 20;

          return (
            <g key={ptr.id} transform={`translate(${px}, ${py})`} className="transition-transform duration-100">
              <polygon
                points={isTop ? '0,8 -5,-2 5,-2' : '0,-8 -5,2 5,2'}
                fill={ptr.color || '#0284c7'}
              />
              <text
                x="0"
                y={isTop ? -10 : 20}
                textAnchor="middle"
                className="text-[11px] font-semibold font-mono tabular-nums fill-smoke-900"
              >
                {ptr.label}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Visual Legend for Complete Beginners */}
      <div className="mt-2.5 flex flex-wrap items-center justify-center gap-3 text-[11px] text-smoke-600 bg-white/90 px-3 py-1.5 rounded-lg border border-smoke-200 shadow-2xs">
        <span className="font-semibold text-smoke-800 uppercase tracking-wider font-mono text-[10px]">Legend:</span>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-xs border border-smoke-300 bg-white inline-block" />
          <span>Candidate</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-xs border border-[#0284c7] bg-[#e0f2fe] inline-block" />
          <span className="font-medium text-[#0369a1]">Active / Mid</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-xs border border-[#d97706] bg-[#fef3c7] inline-block" />
          <span className="font-medium text-[#b45309]">Comparing</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-xs border border-[#059669] bg-[#ecfdf5] inline-block" />
          <span className="font-medium text-[#047857]">Found / Matched</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-xs border border-smoke-300 bg-smoke-100 inline-block opacity-60" />
          <span className="text-smoke-400">Eliminated / Discarded</span>
        </div>
      </div>
    </div>
  );
};
