import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

interface ConfettiProps {
  trigger: boolean;
  duration?: number;
  onComplete?: () => void;
}

interface Particle {
  id: number;
  x: number;
  color: string;
  size: number;
  rotation: number;
  delay: number;
}

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--status-in-progress))",
  "hsl(var(--tier-expert))",
  "hsl(340 70% 50%)",
  "hsl(200 70% 50%)",
  "hsl(280 70% 50%)",
];

const PARTICLE_COUNT = 50;

export function Confetti({
  trigger,
  duration = 3000,
  onComplete,
}: ConfettiProps) {
  const [isActive, setIsActive] = useState(false);

  const particles = useMemo<Particle[]>(() => {
    return Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      size: 6 + Math.random() * 8,
      rotation: Math.random() * 360,
      delay: Math.random() * 0.5,
    }));
  }, []);

  useEffect(() => {
    if (trigger) {
      setIsActive(true);
      const timer = setTimeout(() => {
        setIsActive(false);
        onComplete?.();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [trigger, duration, onComplete]);

  return (
    <AnimatePresence>
      {isActive && (
        <div
          className="fixed inset-0 pointer-events-none z-50 overflow-hidden"
          data-testid="confetti-container"
          aria-hidden="true"
        >
          {particles.map((particle) => (
            <motion.div
              key={particle.id}
              className="absolute"
              style={{
                left: `${particle.x}%`,
                top: -20,
                width: particle.size,
                height: particle.size,
                backgroundColor: particle.color,
                borderRadius: Math.random() > 0.5 ? "50%" : "2px",
              }}
              initial={{
                y: -20,
                rotate: particle.rotation,
                opacity: 1,
              }}
              animate={{
                y: window.innerHeight + 50,
                x: (Math.random() - 0.5) * 200,
                rotate: particle.rotation + 720,
                opacity: [1, 1, 0],
              }}
              transition={{
                duration: 2 + Math.random(),
                delay: particle.delay,
                ease: [0.25, 0.46, 0.45, 0.94],
              }}
              data-testid={`confetti-particle-${particle.id}`}
            />
          ))}
        </div>
      )}
    </AnimatePresence>
  );
}
