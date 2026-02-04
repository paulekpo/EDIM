import { motion } from "framer-motion";
import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChecklistItemData {
  id: string;
  text: string;
  isChecked: boolean;
}

interface ChecklistItemProps {
  item: ChecklistItemData;
  onToggle: (id: string, checked: boolean) => void;
  onEdit: (id: string, text: string) => void;
  onDelete: (id: string) => void;
  isLast?: boolean;
}

export function ChecklistItem({
  item,
  onToggle,
  onEdit,
  onDelete,
  isLast = false,
}: ChecklistItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(item.text);
  const [isHovered, setIsHovered] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    setEditText(item.text);
  }, [item.text]);

  const handleSave = () => {
    const trimmed = editText.trim();
    if (trimmed && trimmed !== item.text) {
      onEdit(item.id, trimmed);
    } else {
      setEditText(item.text);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditText(item.text);
    setIsEditing(false);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleCancel();
    }
  };

  const handleTextClick = () => {
    if (!item.isChecked) {
      setIsEditing(true);
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className={cn(
        "group flex items-center gap-3 py-2 px-3 rounded-md transition-colors",
        isHovered && "bg-muted/50"
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      data-testid={`checklist-item-${item.id}`}
    >
      <motion.div
        whileTap={{ scale: 0.9 }}
        transition={{ type: "spring", stiffness: 400, damping: 17 }}
      >
        <Checkbox
          checked={item.isChecked}
          onCheckedChange={(checked) => onToggle(item.id, checked === true)}
          data-testid={`checklist-checkbox-${item.id}`}
          aria-label={`Mark "${item.text}" as ${item.isChecked ? "incomplete" : "complete"}`}
        />
      </motion.div>

      <div className="flex-1 min-w-0">
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            className="w-full bg-transparent border-b border-primary outline-none text-sm py-0.5"
            data-testid={`checklist-input-${item.id}`}
            aria-label="Edit checklist item"
          />
        ) : (
          <span
            onClick={handleTextClick}
            className={cn(
              "block text-sm cursor-pointer truncate",
              item.isChecked && "line-through text-muted-foreground"
            )}
            data-testid={`checklist-text-${item.id}`}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && handleTextClick()}
          >
            {item.text}
          </span>
        )}
      </div>

      <button
        onClick={() => onDelete(item.id)}
        disabled={isLast}
        className={cn(
          "p-1 rounded transition-all",
          isHovered ? "opacity-100" : "opacity-0",
          isLast
            ? "text-muted-foreground/30 cursor-not-allowed"
            : "text-muted-foreground hover:text-destructive hover:bg-destructive/10"
        )}
        style={{ visibility: isHovered ? "visible" : "hidden" }}
        data-testid={`checklist-delete-${item.id}`}
        aria-label={isLast ? "Cannot delete last item" : `Delete "${item.text}"`}
        title={isLast ? "Can't delete the last item" : "Delete item"}
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </motion.div>
  );
}
