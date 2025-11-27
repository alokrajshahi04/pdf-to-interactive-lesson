"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  DndContext,
  DragOverlay,
  useSensor,
  useSensors,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  DragStartEvent,
  DragEndEvent,
} from "@dnd-kit/core";

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

// Draggable choice pill component
function DraggableChoice({
  id,
  text,
  colorIndex,
  disabled,
  isDragging,
}: {
  id: string;
  text: string;
  colorIndex: number;
  disabled: boolean;
  isDragging: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id,
    disabled,
  });

  const colors = CHOICE_COLORS[colorIndex % CHOICE_COLORS.length];

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      data-choice-container
      style={{
        ...style,
        backgroundColor: colors.bg,
        borderColor: colors.border,
        borderWidth: "0.7px",
        borderStyle: "solid",
        touchAction: "none",
      }}
      className={`w-full h-[90px] md:h-[120px] p-3 md:p-4 rounded-2xl flex flex-col justify-center items-center ${
        disabled
          ? "opacity-50 cursor-not-allowed"
          : isDragging
          ? "opacity-0"
          : "cursor-grab hover:opacity-90 active:cursor-grabbing"
      }`}
      {...listeners}
      {...attributes}
    >
      <span className="text-neutral-800 font-medium text-center text-sm leading-relaxed line-clamp-3">
        {text}
      </span>
    </div>
  );
}


// Droppable slot component (also draggable when it has content)
function DroppableSlot({
  id,
  slotIndex,
  children,
  showResult,
  isCorrect,
  isIncorrect,
  isEmptyWhenShowingResult,
  assignedChoiceColors,
  hasAssignedChoice,
  isDragging,
}: {
  id: string;
  slotIndex: number;
  children: React.ReactNode;
  showResult: boolean;
  isCorrect: boolean;
  isIncorrect: boolean;
  isEmptyWhenShowingResult: boolean;
  assignedChoiceColors: { bg: string; border: string } | null;
  hasAssignedChoice: boolean;
  isDragging: boolean;
}) {
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({ id });
  const {
    attributes,
    listeners,
    setNodeRef: setDraggableRef,
  } = useDraggable({
    id: `slot-content-${slotIndex}`,
    disabled: showResult || !hasAssignedChoice,
  });

  // Combine refs for both droppable and draggable
  const setNodeRef = (node: HTMLElement | null) => {
    setDroppableRef(node);
    setDraggableRef(node);
  };

  const borderColor =
    isOver && !showResult
      ? "#3b82f6" // blue-500
      : showResult && isCorrect
      ? "#16a34a" // green-600
      : showResult && isIncorrect
      ? "#dc2626" // red-600
      : isEmptyWhenShowingResult
      ? "#f59e0b" // amber-500 for missing answer
      : assignedChoiceColors && !showResult
      ? assignedChoiceColors.border
      : "#a3a3a3"; // neutral-400

  const backgroundColor =
    isOver && !showResult
      ? "#dbeafe" // blue-100
      : showResult && isCorrect
      ? "#dcfce7" // green-100
      : showResult && isIncorrect
      ? "#fee2e2" // red-100
      : isEmptyWhenShowingResult
      ? "#fef3c7" // amber-100 for missing answer
      : assignedChoiceColors && !showResult
      ? assignedChoiceColors.bg
      : "#ffffff";

  const borderStyle = hasAssignedChoice || isEmptyWhenShowingResult ? "solid" : "dashed";
  const borderWidth = showResult ? "2px" : hasAssignedChoice ? "0.7px" : "1.5px";

  return (
    <div
      ref={setNodeRef}
      data-slot-container
      style={{
        borderColor,
        borderWidth,
        borderStyle,
        backgroundColor,
        touchAction: hasAssignedChoice && !showResult ? "none" : undefined,
      }}
      className={`w-full p-3 md:p-4 rounded-2xl flex flex-col items-center transition-all relative select-none ${
        showResult ? "h-[110px] md:h-[140px]" : "h-[90px] md:h-[120px]"
      } ${
        hasAssignedChoice && !showResult
          ? isDragging
            ? "opacity-0"
            : "cursor-grab active:cursor-grabbing"
          : ""
      }`}
      {...(hasAssignedChoice && !showResult ? listeners : {})}
      {...(hasAssignedChoice && !showResult ? attributes : {})}
    >
      <div className="flex items-center justify-between w-full mb-1">
        <p
          className={`text-sm font-semibold ${
            showResult && isCorrect
              ? "text-green-700"
              : showResult && isIncorrect
              ? "text-red-700"
              : isEmptyWhenShowingResult
              ? "text-amber-700"
              : "text-neutral-700"
          }`}
        >
          {slotIndex + 1}
        </p>
        {showResult && isIncorrect && (
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-red-100">
            <svg
              className="w-4 h-4 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
        )}
        {showResult && isCorrect && (
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-green-100">
            <svg
              className="w-4 h-4 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        )}
        {isEmptyWhenShowingResult && (
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-100">
            <svg
              className="w-4 h-4 text-amber-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
        )}
      </div>
      <div className="flex-1 flex items-center justify-center w-full min-h-0">
        {children}
      </div>
    </div>
  );
}

// Droppable zone for returning cards to the choice pool
function ReturnZone({
  children,
  showResult,
}: {
  children: React.ReactNode;
  showResult: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: "return-zone" });

  return (
    <div
      ref={setNodeRef}
      className={`space-y-3 md:space-y-5 px-2 md:px-6 py-3 md:py-5 min-h-full rounded-l-xl transition-colors ${
        isOver && !showResult ? "bg-blue-50" : ""
      }`}
    >
      {children}
    </div>
  );
}

// Overlay item that follows the cursor/finger during drag
function DragOverlayItem({
  text,
  colorIndex,
  width,
}: {
  text: string;
  colorIndex: number;
  width: number | null;
}) {
  const colors = CHOICE_COLORS[colorIndex % CHOICE_COLORS.length];

  return (
    <div
      style={{
        backgroundColor: colors.bg,
        borderColor: colors.border,
        borderWidth: "0.7px",
        borderStyle: "solid",
        width: width ? `${width}px` : "200px",
      }}
      className="h-[90px] md:h-[120px] p-3 md:p-4 rounded-2xl flex flex-col justify-center items-center opacity-90 shadow-lg"
    >
      <span className="text-neutral-800 font-medium text-center text-sm leading-relaxed line-clamp-3">
        {text}
      </span>
    </div>
  );
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

  const [slotAssignments, setSlotAssignments] =
    useState<number[]>(initialAssignments);

  // History for undo/redo
  const [history, setHistory] = useState<number[][]>([initialAssignments]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const historyIndexRef = useRef(0);

  // Track what's being dragged for DragOverlay
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeWidth, setActiveWidth] = useState<number | null>(null);

  // Configure sensors for mouse and touch
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 100,
        tolerance: 5,
      },
    })
  );

  // Keep ref in sync with state
  useEffect(() => {
    historyIndexRef.current = historyIndex;
  }, [historyIndex]);

  // Sync userAnswer prop changes to state
  useEffect(() => {
    const newAssignments = (() => {
      if (userAnswer && userAnswer.length === 3) {
        return [...userAnswer];
      }
      return [-1, -1, -1];
    })();

    const timeoutId = setTimeout(() => {
      setSlotAssignments(newAssignments);
      setHistory([newAssignments]);
      setHistoryIndex(0);
      historyIndexRef.current = 0;
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [userAnswer]);

  // Add to history when user makes a change
  const addToHistory = useCallback((newAssignments: number[]) => {
    const currentIndex = historyIndexRef.current;

    setHistory((prevHistory) => {
      const currentState = prevHistory[currentIndex];
      if (
        currentState &&
        currentState.length === newAssignments.length &&
        currentState.every((val, idx) => val === newAssignments[idx])
      ) {
        return prevHistory;
      }

      const newHistory = prevHistory.slice(0, currentIndex + 1);
      newHistory.push([...newAssignments]);

      const newIndex = newHistory.length - 1;
      setHistoryIndex(newIndex);
      historyIndexRef.current = newIndex;

      return newHistory;
    });
  }, []);

  // Update parent when slot assignments change
  const handleSlotChange = useCallback(
    (newAssignments: number[], skipHistory = false) => {
      setSlotAssignments(newAssignments);

      if (!skipHistory && !showResult) {
        addToHistory(newAssignments);
      }

      if (newAssignments.every((val) => val !== -1)) {
        onAnswerChange(newAssignments);
      }
    },
    [showResult, onAnswerChange, addToHistory]
  );

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
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if (
        (e.ctrlKey || e.metaKey) &&
        (((e.key === "z" || e.key === "Z") && e.shiftKey) || e.key === "y")
      ) {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showResult, handleUndo, handleRedo]);

  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    if (showResult) return;
    const activeIdStr = event.active.id as string;
    setActiveId(activeIdStr);
    
    // Capture the width of the dragged element from the activator event
    const target = event.activatorEvent.target as HTMLElement;
    if (target) {
      // For slot content, get the parent slot's width; for choices, get the element width
      const element = activeIdStr.startsWith("slot-content-")
        ? target.closest("[data-slot-container]")
        : target.closest("[data-choice-container]") || target;
      if (element) {
        setActiveWidth((element as HTMLElement).offsetWidth);
      }
    }
  };

  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setActiveWidth(null);

    if (showResult || !over) return;

    const activeIdStr = active.id as string;
    const overIdStr = over.id as string;

    // Handle dropping on the return zone (unassign from slot)
    if (overIdStr === "return-zone") {
      if (activeIdStr.startsWith("slot-content-")) {
        const sourceSlotIndex = parseInt(
          activeIdStr.replace("slot-content-", ""),
          10
        );
        const newAssignments = [...slotAssignments];
        newAssignments[sourceSlotIndex] = -1;
        handleSlotChange(newAssignments, false);
      }
      return;
    }

    // Only allow dropping on slots
    if (!overIdStr.startsWith("slot-")) return;

    const targetSlotIndex = parseInt(overIdStr.replace("slot-", ""), 10);
    const newAssignments = [...slotAssignments];

    if (activeIdStr.startsWith("choice-")) {
      // Dragging from available choices
      const choiceIndex = parseInt(activeIdStr.replace("choice-", ""), 10);
      newAssignments[targetSlotIndex] = choiceIndex;
    } else if (activeIdStr.startsWith("slot-content-")) {
      // Dragging from one slot to another
      const sourceSlotIndex = parseInt(
        activeIdStr.replace("slot-content-", ""),
        10
      );
      const choiceIndex = slotAssignments[sourceSlotIndex];
      if (choiceIndex !== -1) {
        newAssignments[sourceSlotIndex] = -1;
        newAssignments[targetSlotIndex] = choiceIndex;
      }
    }

    handleSlotChange(newAssignments, false);
  };

  // Get available choices (not yet assigned to slots)
  const availableChoices = choices
    .map((choice, index) => ({
      id: `choice-${index}`,
      text: choice,
      index,
    }))
    .filter((choice) => !slotAssignments.includes(choice.index));

  // Get active drag item info for overlay
  const getActiveItemInfo = () => {
    if (!activeId) return null;

    if (activeId.startsWith("choice-")) {
      const choiceIndex = parseInt(activeId.replace("choice-", ""), 10);
      return { text: choices[choiceIndex], colorIndex: choiceIndex };
    } else if (activeId.startsWith("slot-content-")) {
      const slotIndex = parseInt(activeId.replace("slot-content-", ""), 10);
      const choiceIndex = slotAssignments[slotIndex];
      if (choiceIndex !== -1) {
        return { text: choices[choiceIndex], colorIndex: choiceIndex };
      }
    }
    return null;
  };

  const activeItemInfo = getActiveItemInfo();

  return (
    <div
      className="rounded-xl overflow-hidden bg-white"
      style={{ border: "1px solid #d4d4d8" }}
    >
      <div
        className="bg-white px-4 py-5"
        style={{ borderBottom: "1px solid #d4d4d8" }}
      >
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
      <div className="p-3 md:p-6 relative">
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="grid grid-cols-2 gap-0">
            {/* Left Column - Choices (also a return zone) */}
            <ReturnZone showResult={showResult}>
              {availableChoices.map((choice) => (
                <DraggableChoice
                  key={choice.id}
                  id={choice.id}
                  text={choice.text}
                  colorIndex={choice.index}
                  disabled={showResult}
                  isDragging={activeId === choice.id}
                />
              ))}
            </ReturnZone>

            {/* Divider - Full Height */}
            <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-neutral-300 -translate-x-1/2"></div>

            {/* Right Column - Slots */}
            <div className="relative">
              <div className="absolute inset-0 bg-neutral-50 -mr-3 md:-mr-6 -mb-3 md:-mb-6 -mt-3 md:-mt-6 rounded-r-xl"></div>
              <div className="relative space-y-3 md:space-y-5 px-2 md:px-6 py-3 md:py-5">
                {slots.map((_, slotIndex) => {
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

                  const assignedChoiceColors =
                    assignedChoiceIndex !== -1
                      ? CHOICE_COLORS[assignedChoiceIndex % CHOICE_COLORS.length]
                      : null;

                  const isEmpty = assignedChoiceIndex === -1;
                  const isEmptyWhenShowingResult = showResult && isEmpty;

                  return (
                    <DroppableSlot
                      key={`slot-${slotIndex}`}
                      id={`slot-${slotIndex}`}
                      slotIndex={slotIndex}
                      showResult={showResult}
                      isCorrect={isCorrect}
                      isIncorrect={isIncorrect}
                      isEmptyWhenShowingResult={isEmptyWhenShowingResult}
                      assignedChoiceColors={assignedChoiceColors}
                      hasAssignedChoice={!!assignedChoice}
                      isDragging={activeId === `slot-content-${slotIndex}`}
                    >
                      {assignedChoice ? (
                        <span
                          className={`text-neutral-800 font-medium text-center text-sm leading-relaxed line-clamp-3 ${
                            showResult
                              ? isCorrect
                                ? "text-green-900"
                                : isIncorrect
                                ? "text-red-900"
                                : ""
                              : ""
                          }`}
                        >
                          {assignedChoice}
                        </span>
                      ) : showResult ? (
                        <p className="text-amber-600 text-sm text-center w-full">
                          Not answered
                        </p>
                      ) : (
                        <p className="text-neutral-400 text-sm text-center w-full">
                          Drop a choice here
                        </p>
                      )}
                    </DroppableSlot>
                  );
                })}
              </div>
            </div>
          </div>

          <DragOverlay dropAnimation={null}>
            {activeItemInfo && (
              <DragOverlayItem
                text={activeItemInfo.text}
                colorIndex={activeItemInfo.colorIndex}
                width={activeWidth}
              />
            )}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}
