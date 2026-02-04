import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Lightbulb, Play, Circle, CheckCircle2, X } from "lucide-react";

interface IdeaData {
  id: string;
  title: string;
  status: string;
}

interface ActiveProjectsListProps {
  ideas: IdeaData[];
  open: boolean;
  onClose: () => void;
  onSelectIdea: (id: string) => void;
}

export function ActiveProjectsList({
  ideas,
  open,
  onClose,
  onSelectIdea,
}: ActiveProjectsListProps) {
  const handleSelect = (id: string) => {
    onSelectIdea(id);
    onClose();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "in_progress":
        return <Play className="w-4 h-4 text-green-500" />;
      case "completed":
        return <CheckCircle2 className="w-4 h-4 text-blue-500" />;
      default:
        return <Circle className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "in_progress":
        return "In Progress";
      case "completed":
        return "Completed";
      case "skipped":
        return "Skipped";
      default:
        return "Not Started";
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: "100%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 z-50 max-h-[90vh] overflow-y-auto rounded-t-3xl bg-background"
            data-testid="active-projects-modal"
          >
            <div className="sticky top-0 z-10 flex justify-end p-3 bg-background">
              <button
                onClick={onClose}
                className="p-2 rounded-full bg-muted"
                data-testid="close-projects-modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 pb-8">
              <div className="flex flex-col items-center text-center mb-6">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center mb-4">
                  <Lightbulb className="w-8 h-8 text-blue-500" />
                </div>
                <h2 className="text-xl font-bold mb-2">All Active Projects</h2>
                <p className="text-sm text-muted-foreground">
                  {ideas.length} project{ideas.length !== 1 ? "s" : ""} in your queue
                </p>
              </div>

              <div className="space-y-3">
                {ideas.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No active projects yet. Generate some ideas to get started!
                  </p>
                ) : (
                  ideas.map((idea) => (
                    <Button
                      key={idea.id}
                      variant="outline"
                      className="w-full justify-start text-left h-auto py-4 px-4 whitespace-normal rounded-xl"
                      onClick={() => handleSelect(idea.id)}
                      data-testid={`project-item-${idea.id}`}
                    >
                      <div className="flex items-start gap-3 w-full">
                        <div className="shrink-0 mt-0.5">
                          {getStatusIcon(idea.status)}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-wrap break-words">{idea.title}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {getStatusLabel(idea.status)}
                          </p>
                        </div>
                      </div>
                    </Button>
                  ))
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
