import React from 'react';
import { NodeNetworkConfig, NetworkNode, NetworkEdge, StepDef } from '../../types/visualization';

interface Props {
  config: NodeNetworkConfig;
  parameterValues: Record<string, any>;
  activeStep?: number;
  progress?: number;
  globalProgress?: number;
  highlightElementIds?: string[];
  currentStepDef?: StepDef;
  nextStepDef?: StepDef;
  onSelectElement?: (element: { id: string; label: string; description?: string }) => void;
}

export const NodeNetworkRenderer: React.FC<Props> = ({
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
  const { nodes = [], edges = [], clusters = [] } = config;

  const width = 800;
  const height = 480;

  // Node position resolution helper
  const getNodePos = (node: NetworkNode) => {
    const px = (node.x / 100) * (width - 160) + 80;
    const py = (node.y / 100) * (height - 120) + 60;
    return { x: px, y: py };
  };

  const nodeMap = new Map<string, { node: NetworkNode; pos: { x: number; y: number } }>();
  nodes.forEach((n) => {
    nodeMap.set(n.id, { node: n, pos: getNodePos(n) });
  });

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center p-2 select-none">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto max-h-[520px] bg-white rounded-xl shadow-xs border border-smoke-200"
      >
        <defs>
          <marker
            id="network-arrow"
            markerWidth="8"
            markerHeight="6"
            refX="7"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 8 3, 0 6" fill="#738276" />
          </marker>
          <marker
            id="network-arrow-active"
            markerWidth="8"
            markerHeight="6"
            refX="7"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 8 3, 0 6" fill="#0284c7" />
          </marker>
        </defs>

        {/* Cluster / Grouping background hulls */}
        {clusters.map((cluster) => {
          const clusterNodes = cluster.node_ids
            .map((id) => nodeMap.get(id))
            .filter(Boolean) as Array<{ node: NetworkNode; pos: { x: number; y: number } }>;

          if (clusterNodes.length === 0) return null;

          const minX = Math.min(...clusterNodes.map((cn) => cn.pos.x)) - 35;
          const maxX = Math.max(...clusterNodes.map((cn) => cn.pos.x)) + 35;
          const minY = Math.min(...clusterNodes.map((cn) => cn.pos.y)) - 25;
          const maxY = Math.max(...clusterNodes.map((cn) => cn.pos.y)) + 25;

          return (
            <g key={cluster.id}>
              <rect
                x={minX}
                y={minY}
                width={maxX - minX}
                height={maxY - minY}
                rx="14"
                fill={cluster.color || '#f6f7f6'}
                stroke="#e2e8e3"
                strokeWidth="1"
                strokeDasharray="4,4"
              />
              <text
                x={minX + 10}
                y={minY + 14}
                className="text-[10px] font-semibold uppercase tracking-wider fill-smoke-500 font-mono"
              >
                {cluster.label}
              </text>
            </g>
          );
        })}

        {/* Edges */}
        {edges.map((edge) => {
          const source = nodeMap.get(edge.source);
          const target = nodeMap.get(edge.target);
          if (!source || !target) return null;

          const isStepActive = edge.active_in_steps ? edge.active_in_steps.includes(activeStep) : true;
          const isHighlighted = highlightElementIds.includes(edge.id) || (isStepActive && edges.length <= 4);

          const dx = target.pos.x - source.pos.x;
          const dy = target.pos.y - source.pos.y;
          const angle = Math.atan2(dy, dx);

          // Offset edge ends from node boundaries
          const offset = 32;
          const startX = source.pos.x + Math.cos(angle) * offset;
          const startY = source.pos.y + Math.sin(angle) * offset;
          const endX = target.pos.x - Math.cos(angle) * offset;
          const endY = target.pos.y - Math.sin(angle) * offset;

          const midX = (startX + endX) / 2;
          const midY = (startY + endY) / 2;

          // Continuous packet position calculated from progress
          const packetX = startX + (endX - startX) * progress;
          const packetY = startY + (endY - startY) * progress;

          return (
            <g
              key={edge.id}
              className="cursor-pointer group"
              onClick={() => onSelectElement?.({ id: edge.id, label: edge.label || 'Connection', description: `Flow from ${source.node.label} to ${target.node.label}` })}
            >
              <line
                x1={startX}
                y1={startY}
                x2={endX}
                y2={endY}
                stroke={isHighlighted ? '#0284c7' : (edge.color || '#bac4bc')}
                strokeWidth={isHighlighted ? 2.5 : 1.5}
                strokeDasharray={edge.style === 'dashed' ? '5,5' : 'none'}
                markerEnd={isHighlighted ? 'url(#network-arrow-active)' : 'url(#network-arrow)'}
                className="transition-colors duration-150"
              />

              {/* Smooth Animated Packet / Pulse traveling along active edge */}
              {isHighlighted && (
                <g transform={`translate(${packetX}, ${packetY})`}>
                  <circle r="7" fill="#0284c7" opacity="0.3" className="animate-ping" />
                  <circle r="5" fill="#0284c7" stroke="#ffffff" strokeWidth="1.5" />
                  {(edge.packet_label || edge.label) && (
                    <g transform="translate(0, -12)">
                      <rect x="-24" y="-8" width="48" height="15" rx="3" fill="#0284c7" />
                      <text x="0" y="3" textAnchor="middle" className="text-[8px] font-bold fill-white">
                        {edge.packet_label || edge.label}
                      </text>
                    </g>
                  )}
                </g>
              )}

              {/* Static edge label */}
              {edge.label && !isHighlighted && (
                <g transform={`translate(${midX}, ${midY - 8})`}>
                  <rect
                    x="-24"
                    y="-10"
                    width="48"
                    height="16"
                    rx="4"
                    fill="#ffffff"
                    stroke="#e2e8e3"
                    strokeWidth="0.75"
                  />
                  <text
                    x="0"
                    y="2"
                    textAnchor="middle"
                    className="text-[9px] font-medium fill-smoke-700 select-none"
                  >
                    {edge.label}
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {/* Nodes */}
        {nodes.map((node) => {
          const item = nodeMap.get(node.id);
          if (!item) return null;
          const { pos } = item;

          const isStepHighlighted = highlightElementIds.includes(node.id) || currentStepDef?.node_statuses?.[node.id] === 'active';
          const isNodeActive = node.status === 'active' || isStepHighlighted;

          return (
            <g
              key={node.id}
              transform={`translate(${pos.x}, ${pos.y})`}
              className="cursor-pointer group"
              onClick={() => onSelectElement?.({ id: node.id, label: node.label, description: node.subtitle || node.tooltip })}
            >
              {/* Active Halo */}
              {isNodeActive && (
                <circle
                  r="34"
                  fill="#738276"
                  opacity="0.25"
                  className="animate-pulse"
                />
              )}

              {/* Node Main Shape */}
              {node.shape === 'circle' ? (
                <circle
                  r="26"
                  fill="#ffffff"
                  stroke={isNodeActive ? '#0284c7' : (node.color || '#738276')}
                  strokeWidth={isNodeActive ? 2.5 : 1.5}
                  className="transition-all duration-150 group-hover:stroke-smoke-900 shadow-xs"
                />
              ) : (
                <rect
                  x="-42"
                  y="-22"
                  width="84"
                  height="44"
                  rx={node.shape === 'pill' ? 22 : 8}
                  fill="#ffffff"
                  stroke={isNodeActive ? '#0284c7' : (node.color || '#738276')}
                  strokeWidth={isNodeActive ? 2.5 : 1.5}
                  className="transition-all duration-150 group-hover:stroke-smoke-900 shadow-xs"
                />
              )}

              {/* Badge if present */}
              {node.badge && (
                <g transform="translate(24, -20)">
                  <rect x="-10" y="-7" width="20" height="14" rx="3" fill="#0284c7" />
                  <text x="0" y="3" textAnchor="middle" className="text-[8px] font-bold fill-white">
                    {node.badge}
                  </text>
                </g>
              )}

              {/* Main Label */}
              <text
                x="0"
                y={node.subtitle ? -2 : 4}
                textAnchor="middle"
                className="text-[11px] font-semibold fill-smoke-900 group-hover:fill-black pointer-events-none"
              >
                {node.label}
              </text>

              {/* Subtitle */}
              {node.subtitle && (
                <text
                  x="0"
                  y={12}
                  textAnchor="middle"
                  className="text-[9px] fill-smoke-500 font-mono pointer-events-none"
                >
                  {node.subtitle}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
};
