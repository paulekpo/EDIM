import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Lightbulb, Play, Circle, CheckCircle2 } from "lucide-react";

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
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent data-testid="active-projects-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-blue-500" />
            All Active Projects
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-2 pr-4">
            {ideas.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No active projects yet. Generate some ideas to get started!
              </p>
            ) : (
              ideas.map((idea) => (
                <Button
                  key={idea.id}
                  variant="outline"
                  className="w-full justify-start text-left h-auto py-3 px-4 whitespace-normal"
                  onClick={() => handleSelect(idea.id)}
                  data-testid={`project-item-${idea.id}`}
                >
                  <div className="flex items-start gap-3 w-full">
                    <div className="shrink-0 mt-0.5">
                      {getStatusIcon(idea.status)}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-wrap break-words">{idea.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {getStatusLabel(idea.status)}
                      </p>
                    </div>
                  </div>
                </Button>
              ))
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
