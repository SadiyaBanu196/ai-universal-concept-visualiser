/**
 * AI Universal Concept Visualiser
 * Core Type Definitions for the Structured Visualization Plan and Generic Engine
 */

export type ConceptCategory = 
  | 'physics' 
  | 'mathematics' 
  | 'computer_science' 
  | 'machine_learning' 
  | 'system_process' 
  | 'chemistry' 
  | 'engineering' 
  | 'general';

export type VisualizationPlanType = 
  | 'coordinate_graph' 
  | 'node_network' 
  | 'discrete_blocks' 
  | 'particle_system' 
  | 'hybrid_composite';

export interface ParameterDef {
  id: string;
  name: string;
  description: string;
  type: 'number' | 'boolean' | 'select';
  min?: number;
  max?: number;
  step?: number;
  default: number | boolean | string;
  unit?: string;
  options?: string[];
}

export interface EquationDef {
  id: string;
  name: string;
  latex: string;
  formula_text: string;
  description: string;
  variables: Array<{
    symbol: string;
    meaning: string;
    unit?: string;
  }>;
}

export interface EntityDef {
  id: string;
  name: string;
  type: string;
  role: string;
  description: string;
  color?: string;
}

export interface RelationshipDef {
  source: string;
  target: string;
  relation: string;
  description: string;
}

export interface StepGuidance {
  what_is_happening: string;
  why_it_happens: string;
  what_changed?: string;
  what_to_notice?: string;
  what_next?: string;
}

export interface StepDef {
  step_number: number;
  title: string;
  description: string;
  highlight_element_ids?: string[];
  parameter_overrides?: Record<string, number | boolean | string>;
  annotation?: string;
  state?: Record<string, any>;
  block_states?: Record<string, 'default' | 'active' | 'matched' | 'eliminated' | 'sorted' | 'comparing' | 'current'>;
  pointer_positions?: Record<string, number>;
  marker_positions?: Record<string, { x?: number; y?: number; x_expr?: string; y_expr?: string }>;
  node_statuses?: Record<string, 'idle' | 'active' | 'completed' | 'warning' | 'highlighted'>;
  // Beginner-friendly structured step teaching dimensions
  guidance?: StepGuidance;
  comparison_detail?: {
    left_label: string;
    left_value: string | number;
    operator: '<' | '>' | '==' | '!=' | '<=' | '>=';
    right_label: string;
    right_value: string | number;
    decision: string;
  };
  is_final_step?: boolean;
  result_badge?: string;
}

export interface VisualizationRuntimeState {
  currentStepIndex: number; // 1-based index (1..totalSteps)
  progress: number; // 0.0 to 1.0 within current step
  globalProgress: number; // 0.0 to 1.0 across entire timeline
  isPlaying: boolean;
  speed: number;
  parameters: Record<string, number | string | boolean>;
  activeStep: StepDef;
  highlightElementIds: string[];
}

export interface GraphCurve {
  id: string;
  label: string;
  color: string;
  /** Mathematical expression in terms of x and parameter IDs e.g. "x * sin(k * x) + offset" */
  expression?: string;
  /** Explicit points fallback */
  points?: Array<{ x: number; y: number }>;
  style?: 'solid' | 'dashed' | 'dotted';
  is_fill_under?: boolean;
  fill_color?: string;
}

export interface GraphMarker {
  id: string;
  label: string;
  x_expr?: string;
  y_expr?: string;
  x?: number;
  y?: number;
  color?: string;
  shape?: 'circle' | 'square' | 'diamond' | 'cross';
  annotation?: string;
}

export interface GraphVector {
  id: string;
  label: string;
  start_x_expr?: string;
  start_y_expr?: string;
  dx_expr?: string;
  dy_expr?: string;
  color?: string;
}

export interface CoordinateGraphConfig {
  x_axis: {
    label: string;
    min: number;
    max: number;
    unit?: string;
    grid_steps?: number;
  };
  y_axis: {
    label: string;
    min: number;
    max: number;
    unit?: string;
    grid_steps?: number;
  };
  curves: GraphCurve[];
  markers?: GraphMarker[];
  vectors?: GraphVector[];
  show_grid?: boolean;
  show_origin?: boolean;
  time_parameter_id?: string;
}

export interface NetworkNode {
  id: string;
  label: string;
  subtitle?: string;
  x: number; // 0 - 100 percentage
  y: number; // 0 - 100 percentage
  shape?: 'circle' | 'rounded_rect' | 'pill' | 'diamond' | 'cylinder';
  color?: string;
  status?: 'idle' | 'active' | 'completed' | 'warning' | 'highlighted';
  layer?: number;
  badge?: string;
  tooltip?: string;
  metrics?: Record<string, string | number>;
}

export interface NetworkEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  style?: 'solid' | 'dashed' | 'animated_packet' | 'bidirectional';
  color?: string;
  packet_label?: string;
  active_in_steps?: number[];
}

export interface NodeNetworkConfig {
  layout: 'horizontal' | 'vertical' | 'radial' | 'layered' | 'free';
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  clusters?: Array<{
    id: string;
    label: string;
    node_ids: string[];
    color?: string;
  }>;
}

export interface DiscreteBlock {
  id: string;
  label?: string;
  value: string | number;
  state?: 'default' | 'active' | 'matched' | 'eliminated' | 'sorted' | 'comparing' | 'current';
  color?: string;
  index_label?: string;
  subtext?: string;
}

export interface BlockPointer {
  id: string;
  label: string;
  target_index: number;
  target_index_expr?: string;
  color?: string;
  position?: 'top' | 'bottom';
}

export interface DiscreteBlocksConfig {
  kind: 'array' | 'memory_slots' | 'pipeline_stages' | 'stack' | 'queue';
  blocks: DiscreteBlock[];
  pointers?: BlockPointer[];
  title?: string;
  comparison_indicator?: {
    index_a: number;
    index_b: number;
    symbol: '<' | '>' | '==' | '!=';
    label?: string;
  };
}

export interface ParticleGroup {
  id: string;
  label: string;
  color: string;
  size: number;
  count: number;
  charge_or_type?: string;
  speed_factor?: number;
}

export interface ParticleSystemConfig {
  motion_type: 'orbit' | 'linear_drift' | 'attraction_repulsion' | 'wave' | 'collision_bounce';
  groups: ParticleGroup[];
  container_shape?: 'box' | 'cylinder' | 'open_field';
  forces?: Array<{
    name: string;
    type: 'gravity' | 'electric' | 'friction' | 'flow';
    direction?: 'left' | 'right' | 'up' | 'down' | 'center';
    magnitude_param_id?: string;
  }>;
}

export interface VisualizationPayload {
  type: VisualizationPlanType;
  coordinate_graph?: CoordinateGraphConfig;
  node_network?: NodeNetworkConfig;
  discrete_blocks?: DiscreteBlocksConfig;
  particle_system?: ParticleSystemConfig;
  interactive_tips?: string[];
}

export interface ExplanationSection {
  overview: string;
  step_by_step: Array<{
    step: number;
    title: string;
    explanation: string;
    takeaway?: string;
    guidance?: StepGuidance;
  }>;
  key_points: string[];
  real_world_example: string;
  common_misconceptions?: string[];
  final_result?: {
    summary: string;
    final_answer?: string;
    conclusion: string;
  };
}

export interface QuizQuestion {
  id: string;
  question: string;
  type: 'multiple_choice' | 'true_false' | 'conceptual';
  options: string[];
  correct_index: number;
  explanation: string;
}

export interface VisualizationPlan {
  id: string;
  title: string;
  summary: string;
  concept_type: ConceptCategory;
  learning_objective: string;
  tags: string[];
  parameters: ParameterDef[];
  equations: EquationDef[];
  entities: EntityDef[];
  relationships: RelationshipDef[];
  steps: StepDef[];
  visualization: VisualizationPayload;
  explanation: ExplanationSection;
  quiz?: QuizQuestion[];
  created_at?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  referenced_step?: number;
}

export interface VisualizationSession {
  id: string;
  user_query: string;
  image_preview?: string;
  plan: VisualizationPlan;
  chat_history: ChatMessage[];
  created_at: string;
}
