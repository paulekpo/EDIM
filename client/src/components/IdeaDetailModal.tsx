import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Confetti } from "./Confetti";
import { 
  SkipForward, 
  Plus, 
  Lightbulb, 
  Play, 
  PartyPopper, 
  X,
  TrendingUp,
  Search,
  CheckSquare,
  Trash2
} from "lucide-react";

interface ChecklistItemData {
  id: string;
  text: string;
  isChecked: boolean;
}

interface AnalyticsData {
  searchQueries: string[];
  trafficSources: Record<string, number>;
}

interface IdeaData {
  id: string;
  title: string;
  rationale?: string | null;
  status: string;
  checklistItems: ChecklistItemData[];
  analyticsData?: AnalyticsData | null;
}

interface IdeaDetailModalProps {
  idea: IdeaData | null;
  open: boolean;
  onClose: () => void;
  onSkip: (ideaId: string) => void;
  onStartTask: (ideaId: string) => void;
  onComplete: (ideaId: string) => void;
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
  onComplete,
  onChecklistUpdate,
}: IdeaDetailModalProps) {
  const [localItems, setLocalItems] = useState<ChecklistItemData[]>([]);
  const [showConfetti, setShowConfetti] = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (idea) {
      setLocalItems(idea.checklistItems);
      setJustCompleted(false);
      setEditingId(null);
    }
  }, [idea]);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

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

  const handleDelete = (id: string) => {
    if (localItems.length <= 1) return;
    const updated = localItems.filter((item) => item.id !== id);
    setLocalItems(updated);
    if (idea) {
      onChecklistUpdate(idea.id, updated);
    }
  };

  const handleDoubleClick = (item: ChecklistItemData) => {
    setEditingId(item.id);
    setEditText(item.text);
  };

  const handleEditSave = () => {
    if (!editingId || !editText.trim()) {
      setEditingId(null);
      return;
    }
    const updated = localItems.map((item) =>
      item.id === editingId ? { ...item, text: editText.trim() } : item
    );
    setLocalItems(updated);
    if (idea) {
      onChecklistUpdate(idea.id, updated);
    }
    setEditingId(null);
  };

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleEditSave();
    } else if (e.key === "Escape") {
      setEditingId(null);
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

  const handleComplete = () => {
    if (idea) {
      onComplete(idea.id);
      onClose();
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
            data-testid="idea-detail-modal"
          >
            <Confetti
              trigger={showConfetti}
              duration={3000}
              onComplete={handleConfettiComplete}
            />
              <div className="sticky top-0 z-10 flex justify-end p-3 bg-background">
                <button
                  onClick={onClose}
                  className="p-2 rounded-full bg-muted"
                  data-testid="close-modal-button"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="px-6 pb-8">
                <div className="flex flex-col items-center text-center mb-6">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center mb-4">
                    <Lightbulb className="w-8 h-8 text-purple-500" />
                  </div>
                  <h2 className="text-xl font-bold mb-2" data-testid="idea-modal-title">
                    {idea.title}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Double-tap items to edit · Check to complete
                  </p>
                </div>

                {(idea.rationale || idea.analyticsData) && (
                  <div className="mb-6 p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center gap-2 mb-3">
                      <TrendingUp className="w-4 h-4 text-blue-600" />
                      <span className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                        Based on your analytics
                      </span>
                    </div>
                    
                    {idea.analyticsData && idea.analyticsData.trafficSources && Object.keys(idea.analyticsData.trafficSources).length > 0 && (
                      <div className="mb-3">
                        <div className="flex items-center gap-2 text-sm text-foreground mb-1">
                          <TrendingUp className="w-3 h-3 text-green-500" />
                          <span className="font-medium">Top Traffic Source:</span>
                          <span>
                            {Object.entries(idea.analyticsData.trafficSources)
                              .sort(([,a], [,b]) => (b as number) - (a as number))[0]?.[0] || "For You Page"}
                          </span>
                        </div>
                      </div>
                    )}
                    
                    {idea.analyticsData && idea.analyticsData.searchQueries && idea.analyticsData.searchQueries.length > 0 && (
                      <div className="mb-3">
                        <div className="flex items-center gap-2 text-sm text-foreground mb-2">
                          <Search className="w-3 h-3 text-purple-500" />
                          <span className="font-medium">Search queries that brought users:</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {idea.analyticsData.searchQueries.slice(0, 5).map((query, idx) => (
                            <span 
                              key={idx}
                              className="text-xs px-2 py-1 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300"
                            >
                              {query}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {idea.rationale && (
                      <p className="text-sm text-foreground" data-testid="idea-modal-rationale">
                        {idea.rationale}
                      </p>
                    )}
                  </div>
                )}

                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-4">
                    <CheckSquare className="w-5 h-5 text-green-500" />
                    <h3 className="font-semibold">Project Checklist</h3>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {localItems.filter((i) => i.isChecked).length}/{localItems.length}
                    </span>
                  </div>

                  <div className="space-y-3" data-testid="idea-checklist">
                    {localItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 border border-transparent hover:border-muted-foreground/20"
                      >
                        <Checkbox
                          checked={item.isChecked}
                          onCheckedChange={(checked) =>
                            handleToggle(item.id, checked as boolean)
                          }
                          data-testid={`checklist-item-${item.id}`}
                        />
                        {editingId === item.id ? (
                          <Input
                            ref={inputRef}
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            onBlur={handleEditSave}
                            onKeyDown={handleEditKeyDown}
                            className="flex-1 text-sm h-8"
                            data-testid={`edit-input-${item.id}`}
                          />
                        ) : (
                          <span
                            className={`text-sm flex-1 cursor-pointer ${
                              item.isChecked ? "line-through text-muted-foreground" : ""
                            }`}
                            onDoubleClick={() => handleDoubleClick(item)}
                            data-testid={`checklist-text-${item.id}`}
                          >
                            {item.text}
                          </span>
                        )}
                        {localItems.length > 1 && editingId !== item.id && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDelete(item.id)}
                            className="shrink-0"
                            data-testid={`delete-checklist-item-${item.id}`}
                          >
                            <Trash2 className="w-4 h-4 mr-1" />
                            Delete
                          </Button>
                        )}
                      </div>
                    ))}
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

                <div className="space-y-3">
                  {idea.status === "unstarted" && (
                    <Button
                      onClick={() => onStartTask(idea.id)}
                      className="w-full h-12 text-base bg-green-600"
                      data-testid="start-task-button"
                    >
                      <Play className="w-5 h-5 mr-2" />
                      Start Task
                    </Button>
                  )}

                  {allChecked && (
                    <Button
                      onClick={handleComplete}
                      className="w-full h-12 text-base bg-primary"
                      data-testid="complete-idea-button"
                    >
                      <PartyPopper className="w-5 h-5 mr-2" />
                      Done!
                    </Button>
                  )}

                  <Button
                    variant="outline"
                    onClick={handleSkip}
                    className="w-full h-12 text-base"
                    data-testid="skip-idea-button"
                  >
                    <SkipForward className="w-5 h-5 mr-2" />
                    Skip
                  </Button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
  );
}
