import { motion } from "framer-motion";
import { useMemo } from "react";

type Tier = "amateur" | "professional" | "expert";

interface AchievementWheelProps {
  progress: number;
  tier: Tier;
  videosCompleted: number;
  videosRequired: number;
}

const TIER_COLORS: Record<Tier, { start: string; end: string; name: string }> = {
  amateur: {
    start: "hsl(var(--tier-amateur))",
    end: "hsl(30 65% 35%)",
    name: "Amateur Creator",
  },
  professional: {
    start: "hsl(var(--tier-professional))",
    end: "hsl(0 0% 55%)",
    name: "Pro Creator",
  },
  expert: {
    start: "hsl(var(--tier-expert))",
    end: "hsl(45 93% 35%)",
    name: "Expert Creator",
  },
};

export function AchievementWheel({
  progress,
  tier,
  videosCompleted,
  videosRequired,
}: AchievementWheelProps) {
  const clampedProgress = Math.min(100, Math.max(0, progress));
  const tierConfig = TIER_COLORS[tier];
  
  const { circumference, strokeDashoffset } = useMemo(() => {
    const radius = 80;
    const circ = 2 * Math.PI * radius;
    const offset = circ - (clampedProgress / 100) * circ;
    return { circumference: circ, strokeDashoffset: offset };
  }, [clampedProgress]);

  const gradientId = `tier-gradient-${tier}`;

  return (
    <div
      className="flex flex-col items-center"
      data-testid="achievement-wheel"
    >
      <div className="relative">
        <svg
          width="200"
          height="200"
          viewBox="0 0 200 200"
          className="transform -rotate-90"
        >
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={tierConfig.start} />
              <stop offset="100%" stopColor={tierConfig.end} />
            </linearGradient>
          </defs>

          <circle
            cx="100"
            cy="100"
            r="80"
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth="12"
            data-testid="achievement-track"
          />

          <motion.circle
            cx="100"
            cy="100"
            r="80"
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{
              duration: 1.5,
              ease: "easeOut",
            }}
            data-testid="achievement-progress"
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center transform rotate-0">
          <motion.span
            className="text-3xl font-bold"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5 }}
            data-testid="achievement-percentage"
          >
            {Math.round(clampedProgress)}%
          </motion.span>
          <motion.span
            className="text-sm font-medium text-muted-foreground"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            data-testid="achievement-tier"
          >
            {tierConfig.name}
          </motion.span>
          <motion.span
            className="text-xs text-muted-foreground mt-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9 }}
            data-testid="achievement-videos"
          >
            {videosCompleted}/{videosRequired} videos
          </motion.span>
        </div>
      </div>

      <motion.div
        className="mt-4 text-center"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1 }}
      >
        <p className="text-sm text-muted-foreground">
          {videosRequired - videosCompleted > 0
            ? `${videosRequired - videosCompleted} more to level up!`
            : "Ready to level up!"}
        </p>
      </motion.div>
    </div>
  );
}
