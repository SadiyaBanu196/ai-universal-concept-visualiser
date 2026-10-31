/**
 * Plan Validation and Graceful Normalization
 * Ensures any AI-generated visualization plan strictly conforms to types
 * and handles missing or partial fields gracefully.
 */

import { VisualizationPlan, VisualizationPayload, StepDef } from '../types/visualization';

export function validateAndNormalizePlan(raw: any): { plan: VisualizationPlan | null; error?: string } {
  if (!raw || typeof raw !== 'object') {
    return { plan: null, error: 'Received empty or non-object plan from AI.' };
  }

  try {
    const id = typeof raw.id === 'string' && raw.id.length > 0 ? raw.id : `plan_${Date.now()}`;
    const title = typeof raw.title === 'string' ? raw.title : 'Concept Visualization';
    const summary = typeof raw.summary === 'string' ? raw.summary : 'Interactive visual exploration of the concept.';
    const concept_type = [
      'physics',
      'mathematics',
      'computer_science',
      'machine_learning',
      'system_process',
      'chemistry',
      'engineering',
      'general',
    ].includes(raw.concept_type)
      ? raw.concept_type
      : 'general';

    const learning_objective = typeof raw.learning_objective === 'string'
      ? raw.learning_objective
      : 'Understand the underlying relationships and mechanisms.';

    const tags = Array.isArray(raw.tags) ? raw.tags.map((t: any) => String(t)) : [];

    // Normalize parameters
    const parameters = Array.isArray(raw.parameters)
      ? raw.parameters.map((p: any, idx: number) => ({
          id: p.id ? String(p.id) : `param_${idx}`,
          name: p.name ? String(p.name) : `Parameter ${idx + 1}`,
          description: p.description ? String(p.description) : '',
          type: (['number', 'boolean', 'select'].includes(p.type) ? p.type : 'number') as any,
          min: typeof p.min === 'number' ? p.min : 0,
          max: typeof p.max === 'number' ? p.max : 100,
          step: typeof p.step === 'number' ? p.step : 1,
          default: p.default !== undefined ? p.default : (typeof p.min === 'number' ? p.min : 10),
          unit: p.unit ? String(p.unit) : '',
          options: Array.isArray(p.options) ? p.options.map(String) : undefined,
        }))
      : [];

    // Normalize equations
    const equations = Array.isArray(raw.equations)
      ? raw.equations.map((eq: any, idx: number) => ({
          id: eq.id ? String(eq.id) : `eq_${idx}`,
          name: eq.name ? String(eq.name) : `Equation ${idx + 1}`,
          latex: eq.latex ? String(eq.latex) : (eq.formula_text || ''),
          formula_text: eq.formula_text ? String(eq.formula_text) : (eq.latex || ''),
          description: eq.description ? String(eq.description) : '',
          variables: Array.isArray(eq.variables)
            ? eq.variables.map((v: any) => ({
                symbol: String(v.symbol || ''),
                meaning: String(v.meaning || ''),
                unit: v.unit ? String(v.unit) : undefined,
              }))
            : [],
        }))
      : [];

    // Normalize entities
    const entities = Array.isArray(raw.entities)
      ? raw.entities.map((ent: any, idx: number) => ({
          id: ent.id ? String(ent.id) : `ent_${idx}`,
          name: ent.name ? String(ent.name) : `Entity ${idx + 1}`,
          type: ent.type ? String(ent.type) : 'Component',
          role: ent.role ? String(ent.role) : '',
          description: ent.description ? String(ent.description) : '',
          color: ent.color ? String(ent.color) : '#738276',
        }))
      : [];

    // Normalize relationships
    const relationships = Array.isArray(raw.relationships)
      ? raw.relationships.map((rel: any) => ({
          source: String(rel.source || ''),
          target: String(rel.target || ''),
          relation: String(rel.relation || 'connects to'),
          description: String(rel.description || ''),
        }))
      : [];

    // Normalize steps
    const rawStepsList = Array.isArray(raw.steps) && raw.steps.length > 0 ? raw.steps : [];
    const steps: StepDef[] = rawStepsList.length > 0
      ? rawStepsList.map((st: any, idx: number) => {
          const isFirst = idx === 0;
          const isLast = idx === rawStepsList.length - 1;
          const rawGuidance = st.guidance || {};

          // Resolve what changed
          let derivedWhatChanged = rawGuidance.what_changed ? String(rawGuidance.what_changed) : undefined;
          if (!derivedWhatChanged) {
            if (isFirst) {
              derivedWhatChanged = 'Initial baseline parameters and boundary positions established.';
            } else if (st.comparison_detail) {
              derivedWhatChanged = `Comparison made: ${st.comparison_detail.left_label} (${st.comparison_detail.left_value}) ${st.comparison_detail.operator} ${st.comparison_detail.right_label} (${st.comparison_detail.right_value}) → ${st.comparison_detail.decision}`;
            } else if (st.parameter_overrides && Object.keys(st.parameter_overrides).length > 0) {
              const entries = Object.entries(st.parameter_overrides).map(([k, v]) => `${k} = ${v}`).join(', ');
              derivedWhatChanged = `Parameters adjusted: ${entries}`;
            } else if (st.block_states && Object.keys(st.block_states).length > 0) {
              derivedWhatChanged = `Block states updated: ${Object.keys(st.block_states).length} element(s) updated.`;
            } else if (st.pointer_positions && Object.keys(st.pointer_positions).length > 0) {
              const ptrList = Object.entries(st.pointer_positions).map(([k, v]) => `${k} → [${v}]`).join(', ');
              derivedWhatChanged = `Pointers repositioned: ${ptrList}`;
            } else {
              derivedWhatChanged = `Transitioned from step ${idx} to step ${idx + 1}.`;
            }
          }

          // Resolve what to notice
          let derivedWhatToNotice = rawGuidance.what_to_notice ? String(rawGuidance.what_to_notice) : undefined;
          if (!derivedWhatToNotice) {
            if (st.annotation) {
              derivedWhatToNotice = String(st.annotation);
            } else if (st.comparison_detail) {
              derivedWhatToNotice = `Notice the comparison outcome (${st.comparison_detail.operator}) and how it directs the next operation.`;
            } else if (Array.isArray(st.highlight_element_ids) && st.highlight_element_ids.length > 0) {
              derivedWhatToNotice = `Focus on the active highlighted items: ${st.highlight_element_ids.join(', ')}.`;
            } else {
              derivedWhatToNotice = 'Observe the updated canvas elements and active indicator positions.';
            }
          }

          // Resolve what next
          let derivedWhatNext = rawGuidance.what_next ? String(rawGuidance.what_next) : undefined;
          if (!derivedWhatNext) {
            if (isLast) {
              derivedWhatNext = 'Walkthrough complete. Final outcome and answer obtained.';
            } else {
              const nextStepTitle = rawStepsList[idx + 1]?.title;
              derivedWhatNext = nextStepTitle ? `Advance to: ${nextStepTitle}.` : `Advance to step ${idx + 2}.`;
            }
          }

          const guidance = {
            what_is_happening: String(rawGuidance.what_is_happening || st.description || st.title || `Executing Step ${idx + 1}`),
            why_it_happens: String(rawGuidance.why_it_happens || (isFirst ? 'Starting baseline must be established before execution.' : isLast ? 'Final state reached under governing rules.' : 'Progressing according to governing equations or algorithmic logic.')),
            what_changed: derivedWhatChanged,
            what_to_notice: derivedWhatToNotice,
            what_next: derivedWhatNext,
          };

          return {
            step_number: idx + 1,
            title: st.title ? String(st.title) : `Step ${idx + 1}`,
            description: st.description ? String(st.description) : '',
            highlight_element_ids: Array.isArray(st.highlight_element_ids)
              ? st.highlight_element_ids.map(String)
              : [],
            parameter_overrides: typeof st.parameter_overrides === 'object' ? st.parameter_overrides : undefined,
            annotation: st.annotation ? String(st.annotation) : undefined,
            state: typeof st.state === 'object' ? st.state : undefined,
            block_states: typeof st.block_states === 'object' ? st.block_states : undefined,
            pointer_positions: typeof st.pointer_positions === 'object' ? st.pointer_positions : undefined,
            marker_positions: typeof st.marker_positions === 'object' ? st.marker_positions : undefined,
            node_statuses: typeof st.node_statuses === 'object' ? st.node_statuses : undefined,
            guidance,
            comparison_detail: st.comparison_detail
              ? {
                  left_label: String(st.comparison_detail.left_label || ''),
                  left_value: st.comparison_detail.left_value,
                  operator: st.comparison_detail.operator || '==',
                  right_label: String(st.comparison_detail.right_label || ''),
                  right_value: st.comparison_detail.right_value,
                  decision: String(st.comparison_detail.decision || ''),
                }
              : undefined,
            is_final_step: isLast,
            result_badge: st.result_badge ? String(st.result_badge) : undefined,
          };
        })
      : [
          {
            step_number: 1,
            title: 'Initial State & Baseline',
            description: 'The baseline system state prior to transformation or interaction.',
            highlight_element_ids: [],
            guidance: {
              what_is_happening: 'Initial baseline setup.',
              why_it_happens: 'Starting conditions must be defined first.',
              what_changed: 'Initial baseline established.',
              what_to_notice: 'Observe starting parameters and canvas state.',
              what_next: 'Process is complete.',
            },
            is_final_step: true,
          },
        ];

    // Normalize visualization payload
    const vizRaw = raw.visualization || {};
    let vizType = vizRaw.type;
    if (!['coordinate_graph', 'node_network', 'discrete_blocks', 'particle_system'].includes(vizType)) {
      if (vizRaw.coordinate_graph) vizType = 'coordinate_graph';
      else if (vizRaw.discrete_blocks) vizType = 'discrete_blocks';
      else if (vizRaw.particle_system) vizType = 'particle_system';
      else vizType = 'node_network';
    }

    const visualization: VisualizationPayload = {
      type: vizType,
      coordinate_graph: vizRaw.coordinate_graph
        ? {
            x_axis: {
              label: vizRaw.coordinate_graph.x_axis?.label || 'X Axis',
              min: typeof vizRaw.coordinate_graph.x_axis?.min === 'number' ? vizRaw.coordinate_graph.x_axis.min : 0,
              max: typeof vizRaw.coordinate_graph.x_axis?.max === 'number' ? vizRaw.coordinate_graph.x_axis.max : 100,
              unit: vizRaw.coordinate_graph.x_axis?.unit || '',
              grid_steps: vizRaw.coordinate_graph.x_axis?.grid_steps || 5,
            },
            y_axis: {
              label: vizRaw.coordinate_graph.y_axis?.label || 'Y Axis',
              min: typeof vizRaw.coordinate_graph.y_axis?.min === 'number' ? vizRaw.coordinate_graph.y_axis.min : 0,
              max: typeof vizRaw.coordinate_graph.y_axis?.max === 'number' ? vizRaw.coordinate_graph.y_axis.max : 100,
              unit: vizRaw.coordinate_graph.y_axis?.unit || '',
              grid_steps: vizRaw.coordinate_graph.y_axis?.grid_steps || 5,
            },
            curves: Array.isArray(vizRaw.coordinate_graph.curves)
              ? vizRaw.coordinate_graph.curves.map((c: any, idx: number) => ({
                  id: c.id ? String(c.id) : `curve_${idx}`,
                  label: c.label ? String(c.label) : `Curve ${idx + 1}`,
                  color: c.color ? String(c.color) : '#738276',
                  expression: c.expression ? String(c.expression) : undefined,
                  points: Array.isArray(c.points) ? c.points : undefined,
                  style: c.style || 'solid',
                  is_fill_under: Boolean(c.is_fill_under),
                  fill_color: c.fill_color || undefined,
                }))
              : [],
            markers: Array.isArray(vizRaw.coordinate_graph.markers)
              ? vizRaw.coordinate_graph.markers.map((m: any, idx: number) => ({
                  id: m.id ? String(m.id) : `marker_${idx}`,
                  label: m.label ? String(m.label) : `Point ${idx + 1}`,
                  x_expr: m.x_expr ? String(m.x_expr) : undefined,
                  y_expr: m.y_expr ? String(m.y_expr) : undefined,
                  x: typeof m.x === 'number' ? m.x : undefined,
                  y: typeof m.y === 'number' ? m.y : undefined,
                  color: m.color ? String(m.color) : '#dc2626',
                  shape: m.shape || 'circle',
                  annotation: m.annotation ? String(m.annotation) : undefined,
                }))
              : [],
            vectors: Array.isArray(vizRaw.coordinate_graph.vectors)
              ? vizRaw.coordinate_graph.vectors.map((v: any, idx: number) => ({
                  id: v.id ? String(v.id) : `vec_${idx}`,
                  label: v.label ? String(v.label) : `Vector ${idx + 1}`,
                  start_x_expr: v.start_x_expr ? String(v.start_x_expr) : undefined,
                  start_y_expr: v.start_y_expr ? String(v.start_y_expr) : undefined,
                  dx_expr: v.dx_expr ? String(v.dx_expr) : undefined,
                  dy_expr: v.dy_expr ? String(v.dy_expr) : undefined,
                  color: v.color ? String(v.color) : '#2563eb',
                }))
              : [],
            show_grid: vizRaw.coordinate_graph.show_grid !== false,
            show_origin: vizRaw.coordinate_graph.show_origin !== false,
          }
        : undefined,

      node_network: vizRaw.node_network
        ? {
            layout: vizRaw.node_network.layout || 'horizontal',
            nodes: Array.isArray(vizRaw.node_network.nodes)
              ? vizRaw.node_network.nodes.map((n: any, idx: number) => ({
                  id: n.id ? String(n.id) : `node_${idx}`,
                  label: n.label ? String(n.label) : `Node ${idx + 1}`,
                  subtitle: n.subtitle ? String(n.subtitle) : undefined,
                  x: typeof n.x === 'number' ? n.x : (idx % 4) * 25 + 12,
                  y: typeof n.y === 'number' ? n.y : Math.floor(idx / 4) * 35 + 20,
                  shape: n.shape || 'rounded_rect',
                  color: n.color ? String(n.color) : '#738276',
                  status: n.status || 'idle',
                  layer: typeof n.layer === 'number' ? n.layer : undefined,
                  badge: n.badge ? String(n.badge) : undefined,
                  tooltip: n.tooltip ? String(n.tooltip) : undefined,
                  metrics: typeof n.metrics === 'object' ? n.metrics : undefined,
                }))
              : [],
            edges: Array.isArray(vizRaw.node_network.edges)
              ? vizRaw.node_network.edges.map((e: any, idx: number) => ({
                  id: e.id ? String(e.id) : `edge_${idx}`,
                  source: String(e.source || ''),
                  target: String(e.target || ''),
                  label: e.label ? String(e.label) : undefined,
                  style: e.style || 'solid',
                  color: e.color ? String(e.color) : '#95a398',
                  packet_label: e.packet_label ? String(e.packet_label) : undefined,
                  active_in_steps: Array.isArray(e.active_in_steps) ? e.active_in_steps : undefined,
                }))
              : [],
          }
        : undefined,

      discrete_blocks: vizRaw.discrete_blocks
        ? {
            kind: vizRaw.discrete_blocks.kind || 'array',
            title: vizRaw.discrete_blocks.title ? String(vizRaw.discrete_blocks.title) : undefined,
            blocks: Array.isArray(vizRaw.discrete_blocks.blocks)
              ? vizRaw.discrete_blocks.blocks.map((b: any, idx: number) => ({
                  id: b.id ? String(b.id) : `block_${idx}`,
                  label: b.label ? String(b.label) : undefined,
                  value: b.value !== undefined ? b.value : idx,
                  state: b.state || 'default',
                  color: b.color ? String(b.color) : undefined,
                  index_label: b.index_label ? String(b.index_label) : `[${idx}]`,
                  subtext: b.subtext ? String(b.subtext) : undefined,
                }))
              : [],
            pointers: Array.isArray(vizRaw.discrete_blocks.pointers)
              ? vizRaw.discrete_blocks.pointers.map((p: any, idx: number) => ({
                  id: p.id ? String(p.id) : `ptr_${idx}`,
                  label: p.label ? String(p.label) : `P${idx}`,
                  target_index: typeof p.target_index === 'number' ? p.target_index : 0,
                  target_index_expr: p.target_index_expr ? String(p.target_index_expr) : undefined,
                  color: p.color ? String(p.color) : '#0284c7',
                  position: p.position || 'top',
                }))
              : [],
          }
        : undefined,

      particle_system: vizRaw.particle_system
        ? {
            motion_type: vizRaw.particle_system.motion_type || 'linear_drift',
            groups: Array.isArray(vizRaw.particle_system.groups)
              ? vizRaw.particle_system.groups.map((g: any, idx: number) => ({
                  id: g.id ? String(g.id) : `grp_${idx}`,
                  label: g.label ? String(g.label) : `Group ${idx + 1}`,
                  color: g.color ? String(g.color) : '#738276',
                  size: typeof g.size === 'number' ? g.size : 6,
                  count: typeof g.count === 'number' ? g.count : 24,
                  charge_or_type: g.charge_or_type ? String(g.charge_or_type) : undefined,
                  speed_factor: typeof g.speed_factor === 'number' ? g.speed_factor : 1,
                }))
              : [{ id: 'grp_1', label: 'Particles', color: '#738276', size: 6, count: 20 }],
            forces: Array.isArray(vizRaw.particle_system.forces) ? vizRaw.particle_system.forces : [],
          }
        : undefined,

      interactive_tips: Array.isArray(vizRaw.interactive_tips)
        ? vizRaw.interactive_tips.map(String)
        : ['Adjust parameter sliders above to observe live state transformations.'],
    };

    // Normalize explanation
    const expRaw = raw.explanation || {};
    const rawStepByStepList = Array.isArray(expRaw.step_by_step) ? expRaw.step_by_step : [];
    
    // Authoritative step mapping: Ensure every step in steps has a matching entry in explanation.step_by_step
    const explanationStepByStep = steps.map((s, idx) => {
      // Find matching item by step number or index
      const matched = rawStepByStepList.find((item: any) => item && (item.step === s.step_number || item.step === idx + 1)) || rawStepByStepList[idx];
      return {
        step: s.step_number,
        title: matched?.title ? String(matched.title) : s.title,
        explanation: matched?.explanation ? String(matched.explanation) : s.description,
        takeaway: matched?.takeaway ? String(matched.takeaway) : undefined,
        guidance: matched?.guidance || s.guidance,
      };
    });

    const explanation = {
      overview: expRaw.overview ? String(expRaw.overview) : summary,
      step_by_step: explanationStepByStep,
      key_points: Array.isArray(expRaw.key_points) ? expRaw.key_points.map(String) : [],
      real_world_example: expRaw.real_world_example ? String(expRaw.real_world_example) : 'Applicable in foundational STEM and system design analysis.',
      common_misconceptions: Array.isArray(expRaw.common_misconceptions) ? expRaw.common_misconceptions.map(String) : undefined,
      final_result: (() => {
        const totalStepsCount = steps.length;
        const comparisonStepsCount = steps.filter(
          (s) => Boolean(s.comparison_detail) ||
                 (s.title && s.title.toLowerCase().includes('compar')) ||
                 (s.description && s.description.toLowerCase().includes('compar'))
        ).length;

        if (!expRaw.final_result) {
          const lastStep = steps[steps.length - 1];
          return {
            summary: lastStep.result_badge || `Walkthrough successfully completed across ${totalStepsCount} step(s).`,
            final_answer: lastStep.result_badge || (lastStep.title.toLowerCase().includes('found') ? lastStep.title : undefined),
            conclusion: `Completed execution in ${totalStepsCount} step(s)${comparisonStepsCount > 0 ? ` with ${comparisonStepsCount} comparison(s)` : ''}.`,
          };
        }

        let summaryStr = String(expRaw.final_result.summary || '');
        let conclusionStr = String(expRaw.final_result.conclusion || '');

        // Reconcile comparison count mentions if comparisons are present
        if (comparisonStepsCount > 0) {
          summaryStr = summaryStr.replace(/\b(\d+)\s+comparisons?\b/gi, () => {
            return `${comparisonStepsCount} comparison${comparisonStepsCount === 1 ? '' : 's'}`;
          });
          conclusionStr = conclusionStr.replace(/\b(\d+)\s+comparisons?\b/gi, () => {
            return `${comparisonStepsCount} comparison${comparisonStepsCount === 1 ? '' : 's'}`;
          });
        }

        // Reconcile step count mentions
        summaryStr = summaryStr.replace(/\b(\d+)\s+steps?\b/gi, () => {
          return `${totalStepsCount} step${totalStepsCount === 1 ? '' : 's'}`;
        });
        conclusionStr = conclusionStr.replace(/\b(\d+)\s+steps?\b/gi, () => {
          return `${totalStepsCount} step${totalStepsCount === 1 ? '' : 's'}`;
        });

        return {
          summary: summaryStr,
          final_answer: expRaw.final_result.final_answer ? String(expRaw.final_result.final_answer) : undefined,
          conclusion: conclusionStr,
        };
      })(),
    };

    // Normalize quiz
    const quiz = Array.isArray(raw.quiz)
      ? raw.quiz.map((q: any, idx: number) => ({
          id: q.id ? String(q.id) : `quiz_${idx}`,
          question: String(q.question || `Question ${idx + 1}`),
          type: (['multiple_choice', 'true_false', 'conceptual'].includes(q.type) ? q.type : 'multiple_choice') as any,
          options: Array.isArray(q.options) ? q.options.map(String) : ['Option A', 'Option B', 'Option C', 'Option D'],
          correct_index: typeof q.correct_index === 'number' ? q.correct_index : 0,
          explanation: String(q.explanation || 'Review the visualization state.'),
        }))
      : undefined;

    const normalizedPlan: VisualizationPlan = {
      id,
      title,
      summary,
      concept_type,
      learning_objective,
      tags,
      parameters,
      equations,
      entities,
      relationships,
      steps,
      visualization,
      explanation,
      quiz,
      created_at: raw.created_at || new Date().toISOString(),
    };

    return { plan: normalizedPlan };
  } catch (err: any) {
    return { plan: null, error: `Plan validation error: ${err.message || 'Unknown structure error'}` };
  }
}

export interface PlanConsistencyReport {
  isValid: boolean;
  issues: string[];
  metrics: {
    totalSteps: number;
    comparisonSteps: number;
    hasInitialBaseline: boolean;
    hasFinalStepMarked: boolean;
    guidanceCoverage: number; // 0.0 to 1.0 (fraction of steps with all 5 beginner questions)
    hasConsistentCounts: boolean;
    preservedInputsMatched: boolean;
  };
}

export function validatePlanConsistency(
  plan: VisualizationPlan,
  expectedInputs?: {
    requiredParams?: Record<string, any>;
    expectedTarget?: any;
    expectedArrayLength?: number;
  }
): PlanConsistencyReport {
  const issues: string[] = [];

  const totalSteps = plan.steps.length;
  if (totalSteps < 1) {
    issues.push('Plan contains no execution steps.');
  }

  // 1. Monotonic sequential numbering check
  plan.steps.forEach((st, idx) => {
    if (st.step_number !== idx + 1) {
      issues.push(`Step at index ${idx} has step_number ${st.step_number}, expected ${idx + 1}.`);
    }
  });

  // 2. Terminal state check
  const lastStep = plan.steps[totalSteps - 1];
  const hasFinalStepMarked = Boolean(lastStep?.is_final_step);
  if (!hasFinalStepMarked) {
    issues.push('Terminal step is not marked with is_final_step: true.');
  }

  const hasInitialBaseline = plan.steps.length > 0 && (
    plan.steps[0].title.toLowerCase().includes('init') ||
    plan.steps[0].title.toLowerCase().includes('setup') ||
    plan.steps[0].title.toLowerCase().includes('baseline') ||
    plan.steps[0].title.toLowerCase().includes('start') ||
    plan.steps[0].step_number === 1
  );

  // 3. Beginner 5-question guidance coverage
  let fullGuidanceCount = 0;
  plan.steps.forEach((st, idx) => {
    const g = st.guidance;
    if (
      g &&
      g.what_is_happening &&
      g.why_it_happens &&
      g.what_changed &&
      g.what_to_notice &&
      g.what_next
    ) {
      fullGuidanceCount++;
    } else {
      issues.push(`Step ${idx + 1} is missing complete 5-question beginner guidance.`);
    }
  });

  const guidanceCoverage = totalSteps > 0 ? fullGuidanceCount / totalSteps : 0;

  // 4. Comparison and step count consistency in final_result
  const comparisonSteps = plan.steps.filter(
    (s) => Boolean(s.comparison_detail) ||
           (s.title && s.title.toLowerCase().includes('compar')) ||
           (s.description && s.description.toLowerCase().includes('compar'))
  ).length;

  let hasConsistentCounts = true;
  if (plan.explanation.final_result) {
    const combinedText = `${plan.explanation.final_result.summary} ${plan.explanation.final_result.conclusion}`;
    const compMatch = combinedText.match(/\b(\d+)\s+comparisons?\b/i);
    if (compMatch && parseInt(compMatch[1], 10) !== comparisonSteps) {
      issues.push(`Final summary claims ${compMatch[1]} comparisons, but plan actually contains ${comparisonSteps}.`);
      hasConsistentCounts = false;
    }
    const stepMatch = combinedText.match(/\b(\d+)\s+steps?\b/i);
    if (stepMatch && parseInt(stepMatch[1], 10) !== totalSteps) {
      issues.push(`Final summary claims ${stepMatch[1]} steps, but plan actually contains ${totalSteps}.`);
      hasConsistentCounts = false;
    }
  }

  // 5. Input preservation check
  let preservedInputsMatched = true;
  if (expectedInputs) {
    if (expectedInputs.requiredParams) {
      for (const [key, val] of Object.entries(expectedInputs.requiredParams)) {
        const foundParam = plan.parameters.find((p) => p.id === key);
        if (!foundParam) {
          issues.push(`Required parameter '${key}' missing from plan.`);
          preservedInputsMatched = false;
        } else if (typeof val === 'number' && foundParam.default !== val) {
          issues.push(`Parameter '${key}' default is ${foundParam.default}, expected ${val}.`);
          preservedInputsMatched = false;
        }
      }
    }

    if (expectedInputs.expectedArrayLength !== undefined && plan.visualization.discrete_blocks) {
      const actualLen = plan.visualization.discrete_blocks.blocks.length;
      if (actualLen !== expectedInputs.expectedArrayLength) {
        issues.push(`Discrete blocks array length is ${actualLen}, expected ${expectedInputs.expectedArrayLength}.`);
        preservedInputsMatched = false;
      }
    }

    if (expectedInputs.expectedTarget !== undefined && plan.visualization.discrete_blocks) {
      const hasTargetInParamOrTitle =
        plan.parameters.some((p) => p.default === expectedInputs.expectedTarget) ||
        (plan.title || '').includes(String(expectedInputs.expectedTarget)) ||
        (plan.summary || '').includes(String(expectedInputs.expectedTarget)) ||
        (plan.explanation.final_result?.final_answer || '').includes(String(expectedInputs.expectedTarget));

      if (!hasTargetInParamOrTitle) {
        issues.push(`Target value ${expectedInputs.expectedTarget} was not preserved in parameters or explanation.`);
        preservedInputsMatched = false;
      }
    }
  }

  // 6. Generic visualizer bounds checking
  if (plan.visualization.discrete_blocks) {
    const blockCount = plan.visualization.discrete_blocks.blocks.length;
    (plan.visualization.discrete_blocks.pointers || []).forEach((ptr) => {
      if (ptr.target_index < 0 || ptr.target_index >= blockCount) {
        issues.push(`Pointer '${ptr.label}' index ${ptr.target_index} out of array bounds [0, ${blockCount - 1}].`);
      }
    });
  }

  return {
    isValid: issues.length === 0,
    issues,
    metrics: {
      totalSteps,
      comparisonSteps,
      hasInitialBaseline,
      hasFinalStepMarked,
      guidanceCoverage,
      hasConsistentCounts,
      preservedInputsMatched,
    },
  };
}
