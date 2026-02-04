import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChecklistItem } from "./ChecklistItem";
import { Confetti } from "./Confetti";
import { SkipForward, Plus, Lightbulb, Play, PartyPopper } from "lucide-react";

interface ChecklistItemData {
  id: string;
  text: string;
  isChecked: boolean;
}

interface IdeaData {
  id: string;
  title: string;
  rationale?: string | null;
  status: string;
  checklistItems: ChecklistItemData[];
}

interface IdeaDetailModalProps {
  idea: IdeaData | null;
  open: boolean;
  onClose: () => void;
  onSkip: (ideaId: string) => void;
  onStartTask: (ideaId: string) => void;
  onChecklistUpdate: (
    ideaId: string,
    items: ChecklistItemData[]
  ) => void;
}

export function IdeaDetailModal({
  idea,
  open,
  onClose,
  onSkip,
  onStartTask,
  onChecklistUpdate,
}: IdeaDetailModalProps) {
  const [localItems, setLocalItems] = useState<ChecklistItemData[]>([]);
  const [showConfetti, setShowConfetti] = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);

  useEffect(() => {
    if (idea) {
      setLocalItems(idea.checklistItems);
      setJustCompleted(false);
    }
  }, [idea]);

  const allChecked =
    localItems.length > 0 && localItems.every((item) => item.isChecked);

  useEffect(() => {
    if (allChecked && !justCompleted && localItems.length > 0) {
      setShowConfetti(true);
      setJustCompleted(true);
    }
  }, [allChecked, justCompleted, localItems.length]);

  const handleToggle = (id: string, checked: boolean) => {
    const updated = localItems.map((item) =>
      item.id === id ? { ...item, isChecked: checked } : item
    );
    setLocalItems(updated);
    if (idea) {
      onChecklistUpdate(idea.id, updated);
    }
  };

  const handleEdit = (id: string, text: string) => {
    const updated = localItems.map((item) =>
      item.id === id ? { ...item, text } : item
    );
    setLocalItems(updated);
    if (idea) {
      onChecklistUpdate(idea.id, updated);
    }
  };

  const handleDelete = (id: string) => {
    if (localItems.length <= 1) return;
    const updated = localItems.filter((item) => item.id !== id);
    setLocalItems(updated);
    if (idea) {
      onChecklistUpdate(idea.id, updated);
    }
  };

  const handleAddItem = () => {
    const newItem: ChecklistItemData = {
      id: `new-${Date.now()}`,
      text: "New task",
      isChecked: false,
    };
    const updated = [...localItems, newItem];
    setLocalItems(updated);
    if (idea) {
      onChecklistUpdate(idea.id, updated);
    }
  };

  const handleSkip = () => {
    if (idea) {
      onSkip(idea.id);
      onClose();
    }
  };

  const handleConfettiComplete = () => {
    setShowConfetti(false);
  };

  if (!idea) return null;

  return (
    <>
      <Confetti
        trigger={showConfetti}
        duration={3000}
        onComplete={handleConfettiComplete}
      />

      <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
        <DialogContent
          className="max-w-md"
          data-testid="idea-detail-modal"
        >
          <DialogHeader>
            <DialogTitle
              className="flex items-start gap-2"
              data-testid="idea-modal-title"
            >
              <Lightbulb className="w-5 h-5 text-primary mt-0.5 shrink-0" />
              <span>{idea.title}</span>
            </DialogTitle>
            {idea.rationale && (
              <DialogDescription data-testid="idea-modal-rationale">
                {idea.rationale}
              </DialogDescription>
            )}
          </DialogHeader>

          <div className="py-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium">
                Your creation checklist
              </h4>
              <span className="text-xs text-muted-foreground">
                {localItems.filter((i) => i.isChecked).length}/{localItems.length} done
              </span>
            </div>

            <div
              className="space-y-1 max-h-64 overflow-y-auto"
              data-testid="idea-checklist"
            >
              <AnimatePresence mode="popLayout">
                {localItems.map((item, index) => (
                  <ChecklistItem
                    key={item.id}
                    item={item}
                    onToggle={handleToggle}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    isLast={localItems.length === 1}
                  />
                ))}
              </AnimatePresence>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleAddItem}
              className="mt-3 w-full"
              data-testid="add-checklist-item-button"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add step
            </Button>
          </div>

          <DialogFooter className="flex-row justify-between gap-2 sm:justify-between flex-wrap">
            <Button
              variant="outline"
              onClick={handleSkip}
              data-testid="skip-idea-button"
            >
              <SkipForward className="w-4 h-4 mr-2" />
              Skip
            </Button>

            <AnimatePresence mode="wait">
              {idea.status === "unstarted" && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  key="start"
                >
                  <Button
                    onClick={() => onStartTask(idea.id)}
                    className="bg-green-600"
                    data-testid="start-task-button"
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Start Task
                  </Button>
                </motion.div>
              )}
              {allChecked && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  key="done"
                >
                  <Button
                    onClick={onClose}
                    className="bg-primary"
                    data-testid="complete-idea-button"
                  >
                    <PartyPopper className="w-4 h-4 mr-2" />
                    Done!
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
