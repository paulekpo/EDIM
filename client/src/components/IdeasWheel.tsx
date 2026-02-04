import { motion, AnimatePresence } from "framer-motion";
import { useMemo, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Upload, Eye, Sparkles } from "lucide-react";

interface IdeaItem {
  id: string;
  title: string;
  status: "unstarted" | "in_progress" | "skipped" | "completed";
}

interface IdeasWheelProps {
  ideas: IdeaItem[];
  onSpin?: () => void;
  onSelectIdea?: (id: string) => void;
  onUpload?: () => void;
  disabled?: boolean;
}

const STATUS_COLORS = {
  unstarted: "hsl(var(--status-unstarted))",
  in_progress: "hsl(var(--status-in-progress))",
  skipped: "hsl(var(--status-skipped))",
  completed: "hsl(var(--status-completed))",
};

const STATUS_STROKE_COLORS = {
  unstarted: "hsl(var(--foreground) / 0.2)",
  in_progress: "hsl(var(--status-in-progress))",
  skipped: "hsl(var(--status-skipped))",
  completed: "hsl(var(--status-completed))",
};

function truncateTitle(title: string, maxLength = 30): string {
  if (title.length <= maxLength) return title;
  return title.slice(0, maxLength - 3) + "...";
}

function polarToCartesian(
  cx: number,
  cy: number,
  radius: number,
  angleInDegrees: number
) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
  return {
    x: cx + radius * Math.cos(angleInRadians),
    y: cy + radius * Math.sin(angleInRadians),
  };
}

function describeArc(
  x: number,
  y: number,
  radius: number,
  startAngle: number,
  endAngle: number
) {
  const start = polarToCartesian(x, y, radius, endAngle);
  const end = polarToCartesian(x, y, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  return [
    "M",
    start.x,
    start.y,
    "A",
    radius,
    radius,
    0,
    largeArcFlag,
    0,
    end.x,
    end.y,
    "L",
    x,
    y,
    "Z",
  ].join(" ");
}

export function IdeasWheel({
  ideas,
  onSpin,
  onSelectIdea,
  onUpload,
  disabled = false,
}: IdeasWheelProps) {
  const [rotation, setRotation] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);

  const visibleIdeas = useMemo(() => ideas.slice(0, 10), [ideas]);
  const segmentCount = visibleIdeas.length;
  const segmentAngle = segmentCount > 0 ? 360 / segmentCount : 360;

  const handleSpin = useCallback(() => {
    if (disabled || isSpinning || segmentCount < 2) return;

    setIsSpinning(true);
    const spins = 3 + Math.random() * 3;
    const extraDegrees = Math.random() * 360;
    const newRotation = rotation + spins * 360 + extraDegrees;

    setRotation(newRotation);

    setTimeout(() => {
      setIsSpinning(false);
      onSpin?.();
      
      const normalizedRotation = newRotation % 360;
      const selectedIndex = Math.floor(
        ((360 - normalizedRotation + segmentAngle / 2) % 360) / segmentAngle
      );
      const selectedIdea = visibleIdeas[selectedIndex % segmentCount];
      if (selectedIdea) {
        onSelectIdea?.(selectedIdea.id);
      }
    }, 3000);
  }, [
    disabled,
    isSpinning,
    rotation,
    segmentCount,
    segmentAngle,
    visibleIdeas,
    onSpin,
    onSelectIdea,
  ]);

  if (ideas.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center p-8 text-center"
        data-testid="ideas-wheel-empty"
      >
        <div className="w-48 h-48 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center mb-6">
          <Upload className="w-12 h-12 text-muted-foreground/50" />
        </div>
        <h3 className="text-lg font-semibold mb-2">No content ideas yet!</h3>
        <p className="text-muted-foreground mb-4 max-w-xs">
          Upload your TikTok analytics to get personalized video ideas
        </p>
        <Button
          onClick={onUpload}
          disabled={disabled}
          data-testid="upload-analytics-button"
        >
          <Upload className="w-4 h-4 mr-2" />
          Upload Analytics
        </Button>
      </motion.div>
    );
  }

  if (ideas.length === 1) {
    const idea = ideas[0];
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center p-8 text-center"
        data-testid="ideas-wheel-single"
      >
        <div
          className="w-48 h-48 rounded-full flex items-center justify-center mb-6 p-4"
          style={{ backgroundColor: STATUS_COLORS[idea.status] }}
        >
          <span className="text-sm font-medium text-center leading-tight">
            {truncateTitle(idea.title)}
          </span>
        </div>
        <Button
          onClick={() => onSelectIdea?.(idea.id)}
          disabled={disabled}
          data-testid="view-idea-button"
        >
          <Eye className="w-4 h-4 mr-2" />
          View Idea
        </Button>
      </motion.div>
    );
  }

  const cx = 150;
  const cy = 150;
  const radius = 140;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center"
      data-testid="ideas-wheel"
    >
      <div className="relative">
        <svg
          width="300"
          height="300"
          viewBox="0 0 300 300"
          className="drop-shadow-lg"
        >
          <motion.g
            animate={{ rotate: rotation }}
            transition={{
              duration: 3,
              ease: [0.2, 0.8, 0.2, 1],
            }}
            style={{ transformOrigin: `${cx}px ${cy}px` }}
          >
            {visibleIdeas.map((idea, index) => {
              const startAngle = index * segmentAngle;
              const endAngle = (index + 1) * segmentAngle;
              const midAngle = startAngle + segmentAngle / 2;

              const textRadius = radius * 0.6;
              const textPos = polarToCartesian(cx, cy, textRadius, midAngle);
              const textRotation = midAngle - 90;

              return (
                <g key={idea.id} data-testid={`wheel-segment-${idea.id}`}>
                  <path
                    d={describeArc(cx, cy, radius, startAngle, endAngle)}
                    fill={STATUS_COLORS[idea.status]}
                    stroke={STATUS_STROKE_COLORS[idea.status]}
                    strokeWidth="2"
                    className="cursor-pointer transition-opacity hover:opacity-80"
                    onClick={() => !isSpinning && onSelectIdea?.(idea.id)}
                  />
                  <text
                    x={textPos.x}
                    y={textPos.y}
                    transform={`rotate(${textRotation}, ${textPos.x}, ${textPos.y})`}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="text-[10px] font-medium fill-foreground pointer-events-none"
                    style={{ fontSize: segmentCount > 6 ? "8px" : "10px" }}
                  >
                    {truncateTitle(idea.title, segmentCount > 6 ? 15 : 20)}
                  </text>
                </g>
              );
            })}
          </motion.g>

          <circle
            cx={cx}
            cy={cy}
            r="20"
            fill="hsl(var(--background))"
            stroke="hsl(var(--border))"
            strokeWidth="2"
          />

          <polygon
            points="150,20 145,35 155,35"
            fill="hsl(var(--primary))"
            stroke="hsl(var(--primary-foreground))"
            strokeWidth="1"
          />
        </svg>

        <AnimatePresence>
          {isSpinning && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <Sparkles className="w-8 h-8 text-primary animate-pulse" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Button
        onClick={handleSpin}
        disabled={disabled || isSpinning}
        className="mt-6"
        size="lg"
        data-testid="spin-wheel-button"
      >
        <Sparkles className="w-4 h-4 mr-2" />
        {isSpinning ? "Spinning..." : "Spin for Next Video!"}
      </Button>
    </motion.div>
  );
}
