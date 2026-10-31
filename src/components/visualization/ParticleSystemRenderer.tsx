import React, { useEffect, useRef } from 'react';
import { ParticleSystemConfig, StepDef } from '../../types/visualization';

interface Props {
  config: ParticleSystemConfig;
  parameterValues: Record<string, any>;
  activeStep?: number;
  progress?: number;
  globalProgress?: number;
  isPlaying?: boolean;
  speed?: number;
  highlightElementIds?: string[];
  currentStepDef?: StepDef;
  onSelectElement?: (element: { id: string; label: string; description?: string }) => void;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  group: string;
}

export const ParticleSystemRenderer: React.FC<Props> = ({
  config,
  parameterValues,
  activeStep = 1,
  progress = 0,
  globalProgress = 0,
  isPlaying = false,
  speed = 1,
  highlightElementIds = [],
  currentStepDef,
  onSelectElement,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const { motion_type = 'linear_drift', groups = [], forces = [] } = config;

  // Initialize particles once or when groups config changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const width = canvas.width;
    const height = canvas.height;

    const newParticles: Particle[] = [];
    groups.forEach((grp) => {
      const count = Math.min(grp.count || 24, 60);
      for (let i = 0; i < count; i++) {
        newParticles.push({
          x: Math.random() * (width - 80) + 40,
          y: Math.random() * (height - 80) + 40,
          vx: (Math.random() - 0.5) * 2.5 * (grp.speed_factor || 1),
          vy: (Math.random() - 0.5) * 2.5 * (grp.speed_factor || 1),
          radius: grp.size || 5,
          color: grp.color || '#738276',
          group: grp.id,
        });
      }
    });
    particlesRef.current = newParticles;
  }, [config.groups]);

  // Active rendering & physics loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    const width = canvas.width;
    const height = canvas.height;

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Draw container boundary
      ctx.strokeStyle = '#e2e8e3';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(30, 30, width - 60, height - 60);

      // Speed multiplier dynamically responsive to live parameter values (e.g. temperature, speed, velocity)
      const paramSpeedFactor = (() => {
        if (typeof parameterValues.temperature === 'number') {
          return Math.max(0.1, parameterValues.temperature / 50);
        }
        if (typeof parameterValues.speed === 'number') {
          return Math.max(0.1, parameterValues.speed / 10);
        }
        if (typeof parameterValues.velocity === 'number') {
          return Math.max(0.1, parameterValues.velocity / 15);
        }
        return 1;
      })();

      const effectiveSpeed = (isPlaying ? 1 : 0.15) * speed * paramSpeedFactor;

      const particles = particlesRef.current;
      particles.forEach((p) => {
        if (isPlaying || effectiveSpeed > 0) {
          // Apply motion type behavior
          if (motion_type === 'orbit') {
            const centerX = width / 2;
            const centerY = height / 2;
            const dx = centerX - p.x;
            const dy = centerY - p.y;
            const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 20);
            const force = 0.5 / dist;
            p.vx += ((-dy / dist) * 0.8 + (dx / dist) * force) * effectiveSpeed;
            p.vy += ((dx / dist) * 0.8 + (dy / dist) * force) * effectiveSpeed;
          } else if (motion_type === 'attraction_repulsion') {
            const centerX = width / 2;
            const centerY = height / 2;
            const dx = centerX - p.x;
            const dy = centerY - p.y;
            p.vx += dx * 0.0005 * effectiveSpeed;
            p.vy += dy * 0.0005 * effectiveSpeed;
          }

          p.x += p.vx * effectiveSpeed;
          p.y += p.vy * effectiveSpeed;

          // Container wall bounce
          if (p.x - p.radius < 30) {
            p.x = 30 + p.radius;
            p.vx *= -1;
          } else if (p.x + p.radius > width - 30) {
            p.x = width - 30 - p.radius;
            p.vx *= -1;
          }

          if (p.y - p.radius < 30) {
            p.y = 30 + p.radius;
            p.vy *= -1;
          } else if (p.y + p.radius > height - 30) {
            p.y = height - 30 - p.radius;
            p.vy *= -1;
          }
        }

        // Render Particle
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [motion_type, isPlaying, speed, parameterValues]);

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center p-2 select-none">
      <canvas
        ref={canvasRef}
        width={800}
        height={480}
        className="w-full h-auto max-h-[520px] bg-white rounded-xl shadow-xs border border-smoke-200"
      />
      {groups.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center justify-center gap-4 text-xs text-smoke-700">
          {groups.map((g) => (
            <div key={g.id} className="flex items-center gap-1.5">
              <span
                className="w-3 h-3 rounded-full inline-block"
                style={{ backgroundColor: g.color || '#738276' }}
              />
              <span className="font-medium">{g.label}</span>
              <span className="text-smoke-400 font-mono text-[11px]">({g.count || 24} units)</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
