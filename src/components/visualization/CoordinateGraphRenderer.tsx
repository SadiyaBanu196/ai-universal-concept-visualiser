import React, { useMemo, useState } from 'react';
import { CoordinateGraphConfig, GraphCurve, GraphMarker, GraphVector, StepDef } from '../../types/visualization';
import { sampleCurvePoints, safeEvaluateMath } from '../../utils/mathEvaluator';
import { interpolateNumber } from '../../utils/animationResolver';

interface Props {
  config: CoordinateGraphConfig;
  parameterValues: Record<string, any>;
  activeStep?: number;
  progress?: number;
  globalProgress?: number;
  highlightElementIds?: string[];
  currentStepDef?: StepDef;
  nextStepDef?: StepDef;
  onSelectElement?: (element: { id: string; label: string; description?: string }) => void;
}

export const CoordinateGraphRenderer: React.FC<Props> = ({
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
  const [hoveredPoint, setHoveredPoint] = useState<{ x: number; y: number; label: string } | null>(null);

  // Canvas bounds & margins
  const width = 800;
  const height = 480;
  const padding = { top: 40, right: 40, bottom: 55, left: 65 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const { x_axis, y_axis, curves = [], markers = [], vectors = [], show_grid = true } = config;

  // Domain & Range mapping to SVG pixels with dynamic parameter evaluation & curve auto-fit
  const minX = useMemo(() => {
    return Number.isFinite(x_axis.min) ? x_axis.min : 0;
  }, [x_axis.min]);

  const minY = useMemo(() => {
    return Number.isFinite(y_axis.min) ? y_axis.min : 0;
  }, [y_axis.min]);

  // Preliminary raw max bound for curve sampling: check if parameters, markers, or vectors imply an extended domain
  const rawMaxX = useMemo(() => {
    let base = Number.isFinite(x_axis.max) && x_axis.max > minX ? x_axis.max : minX + 100;
    for (const m of markers) {
      if (m.x_expr) {
        const val = safeEvaluateMath(m.x_expr, parameterValues);
        if (Number.isFinite(val) && val > base) {
          base = Math.ceil(val * 1.15);
        }
      } else if (typeof m.x === 'number' && m.x > base) {
        base = Math.ceil(m.x * 1.15);
      }
    }
    for (const v of vectors) {
      if (v.start_x_expr) {
        const sx = safeEvaluateMath(v.start_x_expr, parameterValues);
        const dx = v.dx_expr ? safeEvaluateMath(v.dx_expr, parameterValues) : 0;
        if (Number.isFinite(sx + dx) && sx + dx > base) {
          base = Math.ceil((sx + dx) * 1.15);
        }
      }
    }
    return base;
  }, [x_axis.max, minX, markers, vectors, parameterValues]);

  // Evaluate curves with live parameters
  const computedCurves = useMemo(() => {
    return curves.map((curve) => {
      let points: Array<{ x: number; y: number }> = [];

      if (curve.expression) {
        points = sampleCurvePoints(curve.expression, minX, rawMaxX, parameterValues, 140);
      } else if (curve.points && curve.points.length > 0) {
        points = curve.points;
      }

      return {
        ...curve,
        points,
      };
    });
  }, [curves, minX, rawMaxX, parameterValues]);

  // Stable reference frame preserving the plan's intended x_axis.max, with safe auto-expansion if curves or markers exceed it
  const maxX = useMemo(() => {
    const hasValidPlanX = Number.isFinite(x_axis.max) && x_axis.max > minX;
    let computedMaxX = hasValidPlanX ? x_axis.max : minX + 1;

    // Check if curves have points exceeding computedMaxX or if auto-fit is needed
    if (computedCurves.length > 0) {
      const positiveXWithPositiveY = computedCurves.flatMap((c) =>
        (c.points || []).filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y) && p.y >= minY && p.x > minX)
      );
      if (positiveXWithPositiveY.length > 3) {
        const maxXInCurve = Math.max(...positiveXWithPositiveY.map((p) => p.x));
        if (!hasValidPlanX) {
          computedMaxX = Math.max(minX + 1, Math.ceil(maxXInCurve * 1.15));
        } else if (maxXInCurve > x_axis.max) {
          // Curve exceeds the plan's reference frame; expand safely to fit
          computedMaxX = Math.ceil(maxXInCurve * 1.15);
        }
      } else if (!hasValidPlanX) {
        const allX = computedCurves.flatMap((c) => (c.points || []).map((p) => p.x).filter(Number.isFinite));
        if (allX.length > 0) {
          computedMaxX = Math.max(minX + 1, Math.ceil(Math.max(...allX) * 1.15));
        }
      }
    }

    // Also check markers so they don't render off-canvas
    for (const m of markers) {
      const mx = m.x_expr ? safeEvaluateMath(m.x_expr, parameterValues) : m.x;
      if (Number.isFinite(mx) && mx! > computedMaxX) {
        computedMaxX = Math.ceil(mx! * 1.12);
      }
    }

    return computedMaxX;
  }, [computedCurves, minX, minY, x_axis.max, markers, parameterValues]);

  // Stable reference frame preserving the plan's intended y_axis.max, with safe auto-expansion if peaks or markers exceed it
  const maxY = useMemo(() => {
    const hasValidPlanY = Number.isFinite(y_axis.max) && y_axis.max > minY;
    let computedMaxY = hasValidPlanY ? y_axis.max : minY + 1;

    if (computedCurves.length > 0) {
      const validPointsInRange = computedCurves.flatMap((c) =>
        (c.points || []).filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= minX && p.x <= maxX)
      );
      if (validPointsInRange.length > 3) {
        const maxYInCurve = Math.max(...validPointsInRange.map((p) => p.y));
        if (!hasValidPlanY) {
          computedMaxY = Math.max(minY + 1, Math.ceil(maxYInCurve * 1.2));
        } else if (maxYInCurve > y_axis.max) {
          // Peak exceeds plan's Y axis; expand safely
          computedMaxY = Math.ceil(maxYInCurve * 1.15);
        }
      }
    }

    // Also check markers in Y
    for (const m of markers) {
      const my = m.y_expr ? safeEvaluateMath(m.y_expr, parameterValues) : m.y;
      if (Number.isFinite(my) && my! > computedMaxY) {
        computedMaxY = Math.ceil(my! * 1.15);
      }
    }

    return computedMaxY;
  }, [computedCurves, minX, maxX, minY, y_axis.max, markers, parameterValues]);

  const toSvgX = (x: number) => {
    return padding.left + ((x - minX) / (maxX - minX)) * plotWidth;
  };

  const toSvgY = (y: number) => {
    return padding.top + (1 - (y - minY) / (maxY - minY)) * plotHeight;
  };

  // Re-sample curves across final [minX, maxX] domain with live parameters and build SVG paths
  const finalizedCurves = useMemo(() => {
    return curves.map((curve) => {
      let points: Array<{ x: number; y: number }> = [];

      if (curve.expression) {
        points = sampleCurvePoints(curve.expression, minX, maxX, parameterValues, 140);
      } else if (curve.points && curve.points.length > 0) {
        points = curve.points;
      }

      const validPoints = points.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
      if (validPoints.length === 0) return { ...curve, pathData: '', validPoints: [] };

      const pathData = validPoints.reduce((acc, pt, idx) => {
        const sx = toSvgX(pt.x);
        const sy = toSvgY(pt.y);
        const clampedY = Math.max(padding.top - 10, Math.min(height - padding.bottom + 10, sy));
        return idx === 0 ? `M ${sx} ${clampedY}` : `${acc} L ${sx} ${clampedY}`;
      }, '');

      return {
        ...curve,
        pathData,
        validPoints,
      };
    });
  }, [curves, minX, maxX, parameterValues, minY, maxY]);

  // Primary curve for continuous trajectory tracking
  const primaryCurve = finalizedCurves[0];

  // Evaluate markers with live parameters and progress interpolation
  const computedMarkers = useMemo(() => {
    const hasTimeExpr = (expr?: string) =>
      Boolean(expr && /\b(t|time|step|progress|globalProgress)\b/.test(expr));

    const resolvedMarkers = markers.map((m) => {
      let x = m.x ?? 0;
      let y = m.y ?? 0;

      const currentPos = currentStepDef?.marker_positions?.[m.id];
      const nextPos = nextStepDef?.marker_positions?.[m.id];

      // 1. Live parameter-dependent expressions supersede stale static positions
      const hasLiveXExpr = Boolean(currentPos?.x_expr || m.x_expr);
      const hasLiveYExpr = Boolean(currentPos?.y_expr || m.y_expr);

      if (hasLiveXExpr) {
        const activeXExpr = currentPos?.x_expr || m.x_expr;
        x = safeEvaluateMath(activeXExpr!, parameterValues);
      } else if (currentPos?.x !== undefined) {
        // Explicit animation-step position preserved when no live expression dependency exists
        x = currentPos.x;
      } else if (typeof m.x === 'number') {
        x = m.x;
      }

      if (hasLiveYExpr) {
        const activeYExpr = currentPos?.y_expr || m.y_expr;
        y = safeEvaluateMath(activeYExpr!, parameterValues);
      } else if (currentPos?.y !== undefined) {
        // Explicit animation-step position preserved when no live expression dependency exists
        y = currentPos.y;
      } else if (typeof m.y === 'number') {
        y = m.y;
      }

      // 2. Step interpolation when moving between steps
      if (currentPos && nextPos && progress > 0) {
        let nx = x;
        let ny = y;
        if (nextPos.x_expr) {
          nx = safeEvaluateMath(nextPos.x_expr, parameterValues);
        } else if (hasLiveXExpr) {
          nx = x;
        } else if (typeof nextPos.x === 'number') {
          nx = nextPos.x;
        }

        if (nextPos.y_expr) {
          ny = safeEvaluateMath(nextPos.y_expr, parameterValues);
        } else if (hasLiveYExpr) {
          ny = y;
        } else if (typeof nextPos.y === 'number') {
          ny = nextPos.y;
        }

        x = interpolateNumber(x, nx, progress);
        y = interpolateNumber(y, ny, progress);
      }

      // 3. Check landmark / moving status
      const idLower = m.id.toLowerCase();
      const labelLower = (m.label || '').toLowerCase();
      const isStaticLandmark =
        idLower.includes('apex') ||
        idLower.includes('peak') ||
        idLower.includes('min') ||
        idLower.includes('max') ||
        idLower.includes('origin') ||
        labelLower.includes('apex') ||
        labelLower.includes('minimum') ||
        labelLower.includes('maximum');

      const isMovingMarker =
        !isStaticLandmark &&
        (idLower.includes('current') ||
          idLower.includes('body') ||
          idLower.includes('point') ||
          idLower.includes('obj') ||
          idLower.includes('particle') ||
          idLower.includes('ball') ||
          idLower.includes('state') ||
          idLower.includes('tracer') ||
          markers.length === 1);

      // 4. If marker is an animated tracer without explicit step override or time-varying expr,
      // animate it dynamically across the primary curve according to timeline progress
      if (!currentPos && !hasTimeExpr(m.x_expr) && !hasTimeExpr(m.y_expr) && isMovingMarker && primaryCurve && primaryCurve.validPoints.length > 1) {
        if (!m.x_expr) {
          const validPts = primaryCurve.validPoints.filter((p) => p.y >= minY);
          const pts = validPts.length > 1 ? validPts : primaryCurve.validPoints;
          const exactIdx = Math.max(0, Math.min(pts.length - 1, globalProgress * (pts.length - 1)));
          const idx0 = Math.floor(exactIdx);
          const idx1 = Math.min(pts.length - 1, idx0 + 1);
          const frac = exactIdx - idx0;
          x = interpolateNumber(pts[idx0].x, pts[idx1].x, frac);
          y = interpolateNumber(pts[idx0].y, pts[idx1].y, frac);
        }
      }

      return {
        ...m,
        isStaticLandmark,
        computedX: x,
        computedY: y,
        svgX: toSvgX(x),
        svgY: toSvgY(y),
      };
    });

    // 5. If all markers in the plan are static landmarks, synthesize a live moving tracer along the primary curve
    const hasMovingMarker = resolvedMarkers.some((m) => !m.isStaticLandmark);
    if (!hasMovingMarker && primaryCurve && primaryCurve.validPoints.length > 1) {
      const validPts = primaryCurve.validPoints.filter((p) => p.y >= minY);
      const pts = validPts.length > 1 ? validPts : primaryCurve.validPoints;
      const exactIdx = Math.max(0, Math.min(pts.length - 1, globalProgress * (pts.length - 1)));
      const idx0 = Math.floor(exactIdx);
      const idx1 = Math.min(pts.length - 1, idx0 + 1);
      const frac = exactIdx - idx0;
      const tx = interpolateNumber(pts[idx0].x, pts[idx1].x, frac);
      const ty = interpolateNumber(pts[idx0].y, pts[idx1].y, frac);

      resolvedMarkers.unshift({
        id: 'dynamic_tracer',
        label: `t = ${Math.round(globalProgress * 100)}%`,
        color: '#0284c7',
        shape: 'circle',
        isStaticLandmark: false,
        computedX: tx,
        computedY: ty,
        svgX: toSvgX(tx),
        svgY: toSvgY(ty),
      });
    }

    return resolvedMarkers;
  }, [markers, parameterValues, currentStepDef, nextStepDef, progress, globalProgress, primaryCurve, minX, maxX, minY, maxY]);

  // Primary moving marker for vector attachment
  const primaryMarker = computedMarkers.find((m) => !m.isStaticLandmark) || computedMarkers[0];

  // Evaluate vectors with live parameters and marker binding
  const computedVectors = useMemo(() => {
    return vectors.map((v) => {
      // If vector starts from moving marker (or origin "0")
      const isZeroStart = v.start_x_expr === '0' && v.start_y_expr === '0';
      const sx = (!v.start_x_expr || isZeroStart) && primaryMarker
        ? primaryMarker.computedX
        : (v.start_x_expr ? safeEvaluateMath(v.start_x_expr, parameterValues) : 0);
      const sy = (!v.start_y_expr || isZeroStart) && primaryMarker
        ? primaryMarker.computedY
        : (v.start_y_expr ? safeEvaluateMath(v.start_y_expr, parameterValues) : 0);
      const dx = v.dx_expr ? safeEvaluateMath(v.dx_expr, parameterValues) : 10;
      const dy = v.dy_expr ? safeEvaluateMath(v.dy_expr, parameterValues) : 10;

      return {
        ...v,
        x1: toSvgX(sx),
        y1: toSvgY(sy),
        x2: toSvgX(sx + dx),
        y2: toSvgY(sy + dy),
      };
    });
  }, [vectors, parameterValues, primaryMarker, primaryCurve, globalProgress, minX, maxX, minY, maxY]);

  // Grid tick lines
  const xTicks = useMemo(() => {
    const steps = Math.max(x_axis.grid_steps || 5, 2);
    const stepVal = (maxX - minX) / steps;
    return Array.from({ length: steps + 1 }, (_, i) => {
      const val = minX + i * stepVal;
      return { val, svgX: toSvgX(val) };
    });
  }, [minX, maxX, x_axis.grid_steps]);

  const yTicks = useMemo(() => {
    const steps = Math.max(y_axis.grid_steps || 5, 2);
    const stepVal = (maxY - minY) / steps;
    return Array.from({ length: steps + 1 }, (_, i) => {
      const val = minY + i * stepVal;
      return { val, svgY: toSvgY(val) };
    });
  }, [minY, maxY, y_axis.grid_steps]);

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center p-2 select-none">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto max-h-[520px] bg-white rounded-xl shadow-xs border border-smoke-200"
      >
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="#5b685e" />
          </marker>
          <marker
            id="vector-arrow"
            markerWidth="8"
            markerHeight="6"
            refX="7"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 8 3, 0 6" fill="#0284c7" />
          </marker>
          <pattern id="grid-pattern" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#f0f3f1" strokeWidth="1" />
          </pattern>
        </defs>

        {/* Grid Background */}
        {show_grid && (
          <rect
            x={padding.left}
            y={padding.top}
            width={plotWidth}
            height={plotHeight}
            fill="url(#grid-pattern)"
          />
        )}

        {/* X Grid Lines & Ticks */}
        {xTicks.map((tick, idx) => (
          <g key={`xtick-${idx}`}>
            <line
              x1={tick.svgX}
              y1={padding.top}
              x2={tick.svgX}
              y2={height - padding.bottom}
              stroke="#e6ebe7"
              strokeWidth="1"
              strokeDasharray={idx === 0 || idx === xTicks.length - 1 ? 'none' : '3,3'}
            />
            <text
              x={tick.svgX}
              y={height - padding.bottom + 18}
              textAnchor="middle"
              className="text-[11px] fill-smoke-600 font-mono tabular-nums"
            >
              {Number(tick.val.toFixed(2))}
            </text>
          </g>
        ))}

        {/* Y Grid Lines & Ticks */}
        {yTicks.map((tick, idx) => (
          <g key={`ytick-${idx}`}>
            <line
              x1={padding.left}
              y1={tick.svgY}
              x2={width - padding.right}
              y2={tick.svgY}
              stroke="#e6ebe7"
              strokeWidth="1"
              strokeDasharray={idx === 0 || idx === yTicks.length - 1 ? 'none' : '3,3'}
            />
            <text
              x={padding.left - 10}
              y={tick.svgY + 4}
              textAnchor="end"
              className="text-[11px] fill-smoke-600 font-mono tabular-nums"
            >
              {Number(tick.val.toFixed(2))}
            </text>
          </g>
        ))}

        {/* Main Axes */}
        <line
          x1={padding.left}
          y1={height - padding.bottom}
          x2={width - padding.right}
          y2={height - padding.bottom}
          stroke="#5b685e"
          strokeWidth="1.5"
        />
        <line
          x1={padding.left}
          y1={height - padding.bottom}
          x2={padding.left}
          y2={padding.top}
          stroke="#5b685e"
          strokeWidth="1.5"
        />

        {/* Axis Labels */}
        <text
          x={width - padding.right}
          y={height - padding.bottom + 38}
          textAnchor="end"
          className="text-[12px] font-semibold fill-smoke-800"
        >
          {x_axis.label} {x_axis.unit ? `(${x_axis.unit})` : ''}
        </text>
        <text
          x={padding.left}
          y={padding.top - 15}
          textAnchor="start"
          className="text-[12px] font-semibold fill-smoke-800"
        >
          {y_axis.label} {y_axis.unit ? `(${y_axis.unit})` : ''}
        </text>

        {/* Curves */}
        {finalizedCurves.map((curve) => {
          const isHighlighted = highlightElementIds.includes(curve.id);
          return (
            <g key={curve.id} className="cursor-pointer" onClick={() => onSelectElement?.({ id: curve.id, label: curve.label })}>
              {curve.is_fill_under && curve.pathData && (
                <path
                  d={`${curve.pathData} L ${toSvgX(maxX)} ${height - padding.bottom} L ${toSvgX(minX)} ${height - padding.bottom} Z`}
                  fill={curve.fill_color || '#73827618'}
                />
              )}
              <path
                d={curve.pathData}
                fill="none"
                stroke={curve.color || '#738276'}
                strokeWidth={isHighlighted ? 4 : 2.5}
                strokeDasharray={curve.style === 'dashed' ? '6,4' : curve.style === 'dotted' ? '2,3' : 'none'}
                className="transition-all duration-150 hover:stroke-width-4"
              />
            </g>
          );
        })}

        {/* Vector Arrows */}
        {computedVectors.map((v) => {
          const isHighlighted = highlightElementIds.includes(v.id);
          return (
            <g key={v.id} onClick={() => onSelectElement?.({ id: v.id, label: v.label })}>
              <line
                x1={v.x1}
                y1={v.y1}
                x2={v.x2}
                y2={v.y2}
                stroke={isHighlighted ? '#0284c7' : (v.color || '#2563eb')}
                strokeWidth={isHighlighted ? 3 : 2}
                markerEnd="url(#vector-arrow)"
                className="transition-all duration-75"
              />
              <text
                x={(v.x1 + v.x2) / 2 + 5}
                y={(v.y1 + v.y2) / 2 - 5}
                className="text-[11px] font-medium fill-smoke-800 font-mono"
              >
                {v.label}
              </text>
            </g>
          );
        })}

        {/* Markers / Key Points */}
        {computedMarkers.map((m) => {
          const isHighlighted = highlightElementIds.includes(m.id);
          return (
            <g
              key={m.id}
              className="cursor-pointer group"
              onClick={() => onSelectElement?.({ id: m.id, label: m.label, description: m.annotation })}
              onMouseEnter={() => setHoveredPoint({ x: m.computedX, y: m.computedY, label: m.label })}
              onMouseLeave={() => setHoveredPoint(null)}
            >
              {/* Highlight halo */}
              {isHighlighted && (
                <circle
                  cx={m.svgX}
                  cy={m.svgY}
                  r="14"
                  fill="#738276"
                  opacity="0.3"
                  className="animate-pulse"
                />
              )}
              {/* Marker shape */}
              <circle
                cx={m.svgX}
                cy={m.svgY}
                r={isHighlighted ? 8 : 6}
                fill={m.color || '#dc2626'}
                stroke="#ffffff"
                strokeWidth="2"
                className="transition-all duration-75 group-hover:r-8 shadow-xs"
              />
              {/* Marker Label */}
              <text
                x={m.svgX}
                y={m.svgY - 12}
                textAnchor="middle"
                className="text-[11px] font-semibold fill-smoke-900 bg-white"
              >
                {m.label}
              </text>
              {m.annotation && (
                <text
                  x={m.svgX}
                  y={m.svgY + 18}
                  textAnchor="middle"
                  className="text-[10px] fill-smoke-600 font-mono"
                >
                  {m.annotation}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Dynamic Curve Legends */}
      {curves.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center justify-center gap-4 text-xs text-smoke-700">
          {curves.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-1.5 cursor-pointer hover:text-smoke-900 transition-colors"
              onClick={() => onSelectElement?.({ id: c.id, label: c.label })}
            >
              <span
                className="w-3.5 h-1 rounded-full inline-block"
                style={{ backgroundColor: c.color || '#738276' }}
              />
              <span className="font-medium">{c.label}</span>
              {c.expression && (
                <span className="text-smoke-400 font-mono text-[11px]">f(x)</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
