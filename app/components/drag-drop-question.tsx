"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  DragEndEvent,
  DragStartEvent,
  DragOverEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";

const CHOICE_COLORS = [
  { bg: "#FDE0FF", border: "#550059" },
  { bg: "#E0F7FF", border: "#004259" },
  { bg: "#FFF2E0", border: "#593400" },
];

export interface DragDropQuestionProps {
  choices: string[];
  slots: string[];
  correctAnswer: number[];
  userAnswer: number[] | null;
  showResult: boolean;
  onAnswerChange: (answer: number[]) => void;
}

export function DragDropQuestion({
  choices,
  slots,
  correctAnswer,
  userAnswer,
  showResult,
  onAnswerChange,
}: DragDropQuestionProps) {
  // Initialize slots with user answer or empty (-1 means empty)
  const initialAssignments = (() => {
    if (userAnswer && userAnswer.length === 3) {
      return [...userAnswer];
    }
    return [-1, -1, -1]; // -1 means empty slot
  })();

  const [slotAssignments, setSlotAssignments] = useState<number[]>(initialAssignments);
  
  // History for undo/redo
  const [history, setHistory] = useState<number[][]>([initialAssignments]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const historyIndexRef = useRef(0);
  
  // Keep ref in sync with state
  useEffect(() => {
    historyIndexRef.current = historyIndex;
  }, [historyIndex]);

  // Sync userAnswer prop changes to state (e.g., when navigating between questions)
  useEffect(() => {
    const newAssignments = (() => {
      if (userAnswer && userAnswer.length === 3) {
        return [...userAnswer];
      }
      return [-1, -1, -1];
    })();
    
    setSlotAssignments(newAssignments);
    // Reset history when question changes
    setHistory([newAssignments]);
    setHistoryIndex(0);
    historyIndexRef.current = 0;
  }, [userAnswer]);

  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px of movement before drag starts
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Add to history when user makes a change
  const addToHistory = useCallback((newAssignments: number[]) => {
    const currentIndex = historyIndexRef.current;
    
    setHistory((prevHistory) => {
      const currentState = prevHistory[currentIndex];
      // Don't add if state hasn't changed
      if (currentState && 
          currentState.length === newAssignments.length &&
          currentState.every((val, idx) => val === newAssignments[idx])) {
        return prevHistory;
      }
      
      // Remove any future history if we're not at the end
      const newHistory = prevHistory.slice(0, currentIndex + 1);
      newHistory.push([...newAssignments]);
      
      // Update index to point to the new entry
      const newIndex = newHistory.length - 1;
      setHistoryIndex(newIndex);
      historyIndexRef.current = newIndex;
      
      return newHistory;
    });
  }, []);

  // Update parent when slot assignments change
  const handleSlotChange = useCallback((newAssignments: number[], skipHistory = false) => {
    setSlotAssignments(newAssignments);
    
    // Add to history unless this is an undo/redo operation
    if (!skipHistory && !showResult) {
      addToHistory(newAssignments);
    }
    
    // Only call onAnswerChange if all slots are filled
    if (newAssignments.every((val) => val !== -1)) {
      onAnswerChange(newAssignments);
    }
  }, [showResult, onAnswerChange, addToHistory]);

  // Undo function
  const handleUndo = useCallback(() => {
    if (showResult || historyIndex === 0) return;
    
    const newIndex = historyIndex - 1;
    const previousState = history[newIndex];
    
    if (previousState) {
      setHistoryIndex(newIndex);
      handleSlotChange([...previousState], true);
    }
  }, [showResult, historyIndex, history, handleSlotChange]);

  // Redo function
  const handleRedo = useCallback(() => {
    if (showResult || historyIndex >= history.length - 1) return;
    
    const newIndex = historyIndex + 1;
    const nextState = history[newIndex];
    
    if (nextState) {
      setHistoryIndex(newIndex);
      handleSlotChange([...nextState], true);
    }
  }, [showResult, historyIndex, history, handleSlotChange]);

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    if (showResult) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if user is typing in an input field
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      // Undo: Ctrl+Z (Windows/Linux) or Cmd+Z (Mac)
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      // Redo: Ctrl+Shift+Z or Ctrl+Y (Windows/Linux) or Cmd+Shift+Z (Mac)
      else if ((e.ctrlKey || e.metaKey) && ((e.key === 'z' || e.key === 'Z') && e.shiftKey || e.key === 'y')) {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showResult, handleUndo, handleRedo]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) {
      return;
    }

    const activeIdStr = String(active.id);
    const overIdStr = String(over.id);

    // If dragging a choice to a slot
    if (activeIdStr.startsWith("choice-") && overIdStr.startsWith("slot-")) {
      const choiceIndex = parseInt(activeIdStr.replace("choice-", ""), 10);
      const slotIndex = parseInt(overIdStr.replace("slot-", ""), 10);

      const newAssignments = [...slotAssignments];
      newAssignments[slotIndex] = choiceIndex;
      handleSlotChange(newAssignments, false);
    }
    // If dragging from one slot to another
    else if (
      activeIdStr.startsWith("slot-") &&
      overIdStr.startsWith("slot-")
    ) {
      const fromSlotIndex = parseInt(activeIdStr.replace("slot-", ""), 10);
      const toSlotIndex = parseInt(overIdStr.replace("slot-", ""), 10);

      const newAssignments = [...slotAssignments];
      const choiceIndex = slotAssignments[fromSlotIndex];
      if (choiceIndex !== -1) {
        newAssignments[fromSlotIndex] = -1;
        newAssignments[toSlotIndex] = choiceIndex;
        handleSlotChange(newAssignments, false);
      }
    }
  };

  // Get available choices (not yet assigned to slots)
  const availableChoices = choices
    .map((choice, index) => ({
      id: `choice-${index}`,
      text: choice,
      index,
    }))
    .filter((choice) => !slotAssignments.includes(choice.index));

  const handleDragOver = (event: DragOverEvent) => {
    // This helps with visual feedback but doesn't affect the drop logic
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
    >
      <div className="rounded-xl overflow-hidden bg-white" style={{ border: "1px solid #d4d4d8" }}>
        <div className="bg-white px-4 py-5" style={{ borderBottom: "1px solid #d4d4d8" }}>
          <div className="flex items-center justify-between">
            <h3 className="text-base font-medium text-neutral-900">
              Drag and drop the colored pills to their correct spot
            </h3>
            {!showResult && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleUndo}
                  disabled={historyIndex === 0}
                  className={`p-2 rounded-lg transition-colors ${
                    historyIndex === 0
                      ? "text-neutral-300 cursor-not-allowed"
                      : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
                  }`}
                  title="Undo (Ctrl+Z / ⌘+Z)"
                  aria-label="Undo last action"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
                    />
                  </svg>
                </button>
                <button
                  onClick={handleRedo}
                  disabled={historyIndex >= history.length - 1}
                  className={`p-2 rounded-lg transition-colors ${
                    historyIndex >= history.length - 1
                      ? "text-neutral-300 cursor-not-allowed"
                      : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
                  }`}
                  title="Redo (Ctrl+Shift+Z / ⌘+Shift+Z or Ctrl+Y / ⌘+Y)"
                  aria-label="Redo last undone action"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6"
                    />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="p-6 relative">
          <div className="grid grid-cols-2 gap-0">
            {/* Left Column - Choices */}
            <div className="space-y-5 px-6 py-5">
              {availableChoices.map((choice, idx) => (
                <DraggableChoice
                  key={choice.id}
                  id={choice.id}
                  text={choice.text}
                  disabled={showResult}
                  index={choice.index}
                />
              ))}
            </div>
            
            {/* Divider - Full Height */}
            <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-neutral-300 -translate-x-1/2"></div>
            
            {/* Right Column - Slots */}
            <div className="relative">
              {/* Background that extends to edges */}
              <div className="absolute inset-0 bg-neutral-50 -mr-6 -mb-6 -mt-6 rounded-r-xl"></div>
              {/* Content with consistent padding */}
              <div className="relative space-y-5 px-6 py-5">
                {slots.map((slotLabel, slotIndex) => {
                  const assignedChoiceIndex = slotAssignments[slotIndex];
                  const assignedChoice =
                    assignedChoiceIndex !== -1
                      ? choices[assignedChoiceIndex]
                      : null;
                  const isCorrect =
                    showResult &&
                    assignedChoiceIndex === correctAnswer[slotIndex];
                  const isIncorrect =
                    showResult &&
                    assignedChoiceIndex !== -1 &&
                    assignedChoiceIndex !== correctAnswer[slotIndex];

                  return (
                    <DroppableSlot
                      key={`slot-${slotIndex}`}
                      id={`slot-${slotIndex}`}
                      label={(slotIndex + 1).toString()}
                      assignedChoice={assignedChoice}
                      assignedChoiceIndex={assignedChoiceIndex}
                      isCorrect={isCorrect}
                      isIncorrect={isIncorrect}
                      showResult={showResult}
                      correctChoice={
                        showResult ? choices[correctAnswer[slotIndex]] : null
                      }
                      correctChoiceIndex={showResult ? correctAnswer[slotIndex] : -1}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      <DragOverlay>
        {activeId ? (
          activeId.startsWith("choice-") ? (() => {
            const choiceIndex = parseInt(activeId.replace("choice-", ""), 10);
            const colors = CHOICE_COLORS[choiceIndex % CHOICE_COLORS.length];
            return (
              <div
                className="h-[100px] p-4 rounded-2xl flex flex-col justify-center items-center shadow-lg"
                style={{
                  width: "320px", // Matches typical w-full width in 2-column grid (approx half of 800px container minus padding)
                  backgroundColor: colors.bg,
                  borderColor: colors.border,
                  borderWidth: "0.7px",
                }}
              >
                <span className="text-neutral-800 font-medium text-center">
                  {choices[choiceIndex]}
                </span>
              </div>
            );
          })() : activeId.startsWith("slot-") ? (
            <div
              className="h-[100px] p-4 rounded-2xl flex flex-col justify-center items-center shadow-lg"
              style={{
                width: "320px", // Matches typical w-full width in 2-column grid (approx half of 800px container minus padding)
                borderColor: "#a3a3a3", // neutral-400 (darker)
                borderWidth: "1.5px",
                borderStyle: "dashed",
                backgroundColor: "#ffffff", // white
              }}
            >
              <span className="text-neutral-800 font-medium text-center">
                {slotAssignments[parseInt(activeId.replace("slot-", ""), 10)] !==
                -1
                  ? choices[
                      slotAssignments[
                        parseInt(activeId.replace("slot-", ""), 10)
                      ]
                    ]
                  : ""}
              </span>
            </div>
          ) : null
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

// Draggable Choice Component
interface DraggableChoiceProps {
  id: string;
  text: string;
  disabled: boolean;
  index: number;
}

function DraggableChoice({ id, text, disabled, index }: DraggableChoiceProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id,
    disabled,
  });

  const colors = CHOICE_COLORS[index % CHOICE_COLORS.length];

  const style = {
    ...(transform
      ? {
          transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
          opacity: isDragging ? 0.5 : 1,
        }
      : {}),
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderWidth: "0.7px",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`w-full h-[100px] p-4 rounded-2xl flex flex-col justify-center items-center ${
        disabled
          ? "opacity-50 cursor-not-allowed"
          : "cursor-grab active:cursor-grabbing transition-opacity"
      }`}
    >
      <span className="text-neutral-800 font-medium text-center">{text}</span>
    </div>
  );
}

// Droppable Slot Component
interface DroppableSlotProps {
  id: string;
  label: string;
  assignedChoice: string | null;
  assignedChoiceIndex: number;
  isCorrect: boolean;
  isIncorrect: boolean;
  showResult: boolean;
  correctChoice: string | null;
  correctChoiceIndex: number;
}

function DroppableSlot({
  id,
  label,
  assignedChoice,
  assignedChoiceIndex,
  isCorrect,
  isIncorrect,
  showResult,
  correctChoice,
  correctChoiceIndex,
}: DroppableSlotProps) {
  // Always use droppable for the drop zone
  const { setNodeRef, isOver } = useDroppable({
    id,
    disabled: showResult,
  });

  // Get colors for the assigned choice
  const assignedChoiceColors = assignedChoiceIndex !== -1 
    ? CHOICE_COLORS[assignedChoiceIndex % CHOICE_COLORS.length]
    : null;

  // Get colors for the correct choice (when showing result)
  const correctChoiceColors = correctChoiceIndex !== -1
    ? CHOICE_COLORS[correctChoiceIndex % CHOICE_COLORS.length]
    : null;

  // Determine border color - preserve choice color when assigned
  const borderColor = 
    isOver && !showResult
      ? "#d4d4d8" // neutral-300
      : assignedChoiceColors && !showResult
      ? assignedChoiceColors.border // preserve choice border color
      : isCorrect && assignedChoiceColors
      ? assignedChoiceColors.border // preserve choice border color even when correct
      : isIncorrect && assignedChoiceColors
      ? assignedChoiceColors.border // preserve choice border color even when incorrect
      : "#a3a3a3"; // neutral-400 (darker) - default dashed border

  // Determine background color - preserve choice color when assigned
  const backgroundColor =
    isOver && !showResult
      ? "#dbeafe" // blue-100
      : assignedChoiceColors && !showResult
      ? assignedChoiceColors.bg // preserve choice background color
      : isCorrect && assignedChoiceColors
      ? assignedChoiceColors.bg // preserve choice background color even when correct
      : isIncorrect && assignedChoiceColors
      ? assignedChoiceColors.bg // preserve choice background color even when incorrect
      : "#ffffff"; // white

  // Use solid border when choice is assigned, dashed when empty
  const borderStyle = assignedChoice ? "solid" : "dashed";
  const borderWidth = assignedChoice ? "0.7px" : "1.5px";

  return (
    <div
      ref={setNodeRef}
      style={{
        borderColor,
        borderWidth,
        borderStyle,
        borderImage: "none",
        backgroundColor,
      }}
      className={`w-full p-4 rounded-2xl flex flex-col items-center transition-all ${
        showResult && isIncorrect && correctChoice ? "min-h-[140px]" : "h-[100px]"
      }`}
    >
      <p className="text-sm font-semibold text-neutral-700 mb-2">{label}</p>
      <div className="flex-1 flex items-center justify-center w-full min-h-0">
        {assignedChoice ? (
          <DraggableSlotContent
            id={id}
            text={assignedChoice}
            disabled={showResult}
            choiceIndex={assignedChoiceIndex}
          />
        ) : (
          <p className="text-neutral-400 text-sm text-center">Drop a choice here</p>
        )}
      </div>
      {showResult && isIncorrect && correctChoice && (
        <div className="mt-3 pt-2 border-t border-neutral-300 w-full">
          <p className="text-xs text-green-700 font-semibold mb-1 text-center">Correct:</p>
          <div 
            className="text-xs text-center leading-relaxed px-2 py-1 rounded-lg inline-block"
            style={{
              backgroundColor: correctChoiceColors?.bg || "#f0fdf4",
              borderColor: correctChoiceColors?.border || "#d4d4d8",
              borderWidth: "0.7px",
            }}
          >
            <p className="text-neutral-800">{correctChoice}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// Draggable content inside a slot
function DraggableSlotContent({
  id,
  text,
  disabled,
  choiceIndex,
}: {
  id: string;
  text: string;
  disabled: boolean;
  choiceIndex: number;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id,
    disabled,
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        opacity: isDragging ? 0.5 : 1,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`text-neutral-800 font-medium text-center ${
        disabled ? "" : "cursor-grab active:cursor-grabbing"
      }`}
    >
      {text}
    </div>
  );
}


