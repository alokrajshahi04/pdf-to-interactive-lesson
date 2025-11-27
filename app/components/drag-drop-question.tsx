"use client";

import { useState, useEffect, useCallback, useRef } from "react";

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
  
  // Track what's being dragged
  const [draggedItem, setDraggedItem] = useState<{ type: 'choice' | 'slot', index: number } | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<number | null>(null);
  
  // Ref to store the cloned drag image element for cleanup
  const dragImageRef = useRef<HTMLElement | null>(null);
  
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
    
    setSlotAssignments(newAssignments);
    setHistory([newAssignments]);
    setHistoryIndex(0);
    historyIndexRef.current = 0;
  }, [userAnswer]);

  // Add to history when user makes a change
  const addToHistory = useCallback((newAssignments: number[]) => {
    const currentIndex = historyIndexRef.current;
    
    setHistory((prevHistory) => {
      const currentState = prevHistory[currentIndex];
      if (currentState && 
          currentState.length === newAssignments.length &&
          currentState.every((val, idx) => val === newAssignments[idx])) {
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
  const handleSlotChange = useCallback((newAssignments: number[], skipHistory = false) => {
    setSlotAssignments(newAssignments);
    
    if (!skipHistory && !showResult) {
      addToHistory(newAssignments);
    }
    
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
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      else if ((e.ctrlKey || e.metaKey) && ((e.key === 'z' || e.key === 'Z') && e.shiftKey || e.key === 'y')) {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showResult, handleUndo, handleRedo]);

  // Cleanup drag image on unmount
  useEffect(() => {
    return () => {
      if (dragImageRef.current && dragImageRef.current.parentNode) {
        document.body.removeChild(dragImageRef.current);
      }
    };
  }, []);

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, type: 'choice' | 'slot', index: number) => {
    if (showResult) return;
    
    setDraggedItem({ type, index });
    e.dataTransfer.effectAllowed = 'move';
    
    // Create custom drag image from the actual element
    if (e.dataTransfer.setDragImage) {
      const originalElement = e.currentTarget as HTMLElement;
      const clonedElement = originalElement.cloneNode(true) as HTMLElement;
      
      // Style the cloned element
      clonedElement.style.position = 'absolute';
      clonedElement.style.top = '-9999px';
      clonedElement.style.left = '-9999px';
      clonedElement.style.width = `${originalElement.offsetWidth}px`;
      clonedElement.style.height = `${originalElement.offsetHeight}px`;
      clonedElement.style.opacity = '0.8';
      clonedElement.style.pointerEvents = 'none';
      
      // Add to DOM
      document.body.appendChild(clonedElement);
      dragImageRef.current = clonedElement;
      
      // Set as drag image (offset to center it on cursor)
      const rect = originalElement.getBoundingClientRect();
      e.dataTransfer.setDragImage(clonedElement, rect.width / 2, rect.height / 2);
      
      // Clean up after a short delay to ensure browser has captured the image
      setTimeout(() => {
        if (clonedElement.parentNode) {
          document.body.removeChild(clonedElement);
        }
      }, 0);
    }
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragOverSlot(null);
    
    // Clean up drag image if it still exists
    if (dragImageRef.current && dragImageRef.current.parentNode) {
      document.body.removeChild(dragImageRef.current);
    }
    dragImageRef.current = null;
  };

  const handleDragOver = (e: React.DragEvent, slotIndex: number) => {
    e.preventDefault();
    if (!showResult) {
      setDragOverSlot(slotIndex);
    }
  };

  const handleDragLeave = () => {
    setDragOverSlot(null);
  };

  const handleDrop = (e: React.DragEvent, slotIndex: number) => {
    e.preventDefault();
    if (showResult || !draggedItem) return;

    const newAssignments = [...slotAssignments];

    if (draggedItem.type === 'choice') {
      // Dragging from available choices
      newAssignments[slotIndex] = draggedItem.index;
    } else if (draggedItem.type === 'slot') {
      // Dragging from one slot to another
      const choiceIndex = slotAssignments[draggedItem.index];
      if (choiceIndex !== -1) {
        newAssignments[draggedItem.index] = -1;
        newAssignments[slotIndex] = choiceIndex;
      }
    }

    handleSlotChange(newAssignments, false);
    setDraggedItem(null);
    setDragOverSlot(null);
  };

  // Get available choices (not yet assigned to slots)
  const availableChoices = choices
    .map((choice, index) => ({
      id: `choice-${index}`,
      text: choice,
      index,
    }))
    .filter((choice) => !slotAssignments.includes(choice.index));

  return (
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
            {availableChoices.map((choice) => {
              const colors = CHOICE_COLORS[choice.index % CHOICE_COLORS.length];
              const isDragging = draggedItem?.type === 'choice' && draggedItem.index === choice.index;
              
              return (
                <div
                  key={choice.id}
                  draggable={!showResult}
                  onDragStart={(e) => handleDragStart(e, 'choice', choice.index)}
                  onDragEnd={handleDragEnd}
                  className={`w-full h-[120px] p-4 rounded-2xl flex flex-col justify-center items-center transition-opacity ${
                    showResult
                      ? "opacity-50 cursor-not-allowed"
                      : isDragging
                      ? "opacity-40 cursor-grabbing"
                      : "cursor-grab hover:opacity-90"
                  }`}
                  style={{
                    backgroundColor: colors.bg,
                    borderColor: colors.border,
                    borderWidth: "0.7px",
                    borderStyle: "solid",
                  }}
                >
                  <span className="text-neutral-800 font-medium text-center text-sm leading-relaxed line-clamp-3">
                    {choice.text}
                  </span>
                </div>
              );
            })}
          </div>
          
          {/* Divider - Full Height */}
          <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-neutral-300 -translate-x-1/2"></div>
          
          {/* Right Column - Slots */}
          <div className="relative">
            <div className="absolute inset-0 bg-neutral-50 -mr-6 -mb-6 -mt-6 rounded-r-xl"></div>
            <div className="relative space-y-5 px-6 py-5">
              {slots.map((slotLabel, slotIndex) => {
                const assignedChoiceIndex = slotAssignments[slotIndex];
                const assignedChoice = assignedChoiceIndex !== -1 ? choices[assignedChoiceIndex] : null;
                const isCorrect = showResult && assignedChoiceIndex === correctAnswer[slotIndex];
                const isIncorrect = showResult && assignedChoiceIndex !== -1 && assignedChoiceIndex !== correctAnswer[slotIndex];
                const isDragOver = dragOverSlot === slotIndex && !showResult;
                const isDragging = draggedItem?.type === 'slot' && draggedItem.index === slotIndex;
                
                const assignedChoiceColors = assignedChoiceIndex !== -1 
                  ? CHOICE_COLORS[assignedChoiceIndex % CHOICE_COLORS.length]
                  : null;

                const correctChoiceIndex = showResult ? correctAnswer[slotIndex] : -1;
                const correctChoice = showResult ? choices[correctAnswer[slotIndex]] : null;

                const isEmpty = assignedChoiceIndex === -1;
                const isEmptyWhenShowingResult = showResult && isEmpty;

                const borderColor = 
                  isDragOver
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
                  isDragOver
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

                const borderStyle = assignedChoice || isEmptyWhenShowingResult ? "solid" : "dashed";
                const borderWidth = showResult 
                  ? "2px" 
                  : assignedChoice 
                  ? "0.7px" 
                  : "1.5px";

                return (
                  <div
                    key={`slot-${slotIndex}`}
                    onDragOver={(e) => handleDragOver(e, slotIndex)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, slotIndex)}
                    style={{
                      borderColor,
                      borderWidth,
                      borderStyle,
                      backgroundColor,
                    }}
                    className={`w-full p-4 rounded-2xl flex flex-col items-center transition-all relative ${
                      showResult 
                        ? "h-[140px]" 
                        : "h-[120px]"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <p className={`text-sm font-semibold ${
                        showResult && isCorrect ? "text-green-700" : 
                        showResult && isIncorrect ? "text-red-700" : 
                        isEmptyWhenShowingResult ? "text-amber-700" :
                        "text-neutral-700"
                      }`}>
                        {slotIndex + 1}
                      </p>
                      {showResult && isIncorrect && (
                        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-red-100">
                          <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        </div>
                      )}
                      {showResult && isCorrect && (
                        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-green-100">
                          <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                      {isEmptyWhenShowingResult && (
                        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-100">
                          <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 flex items-center justify-center w-full min-h-0">
                      {assignedChoice ? (
                        <div
                          draggable={!showResult}
                          onDragStart={(e) => handleDragStart(e, 'slot', slotIndex)}
                          onDragEnd={handleDragEnd}
                          className={`text-neutral-800 font-medium text-center text-sm leading-relaxed line-clamp-3 transition-opacity ${
                            showResult 
                              ? isCorrect 
                                ? "text-green-900" 
                                : isIncorrect 
                                ? "text-red-900" 
                                : ""
                              : isDragging 
                              ? "opacity-40 cursor-grabbing" 
                              : "cursor-grab hover:opacity-80"
                          }`}
                        >
                          {assignedChoice}
                        </div>
                      ) : showResult ? (
                        <p className="text-amber-600 text-sm text-center w-full">Not answered</p>
                      ) : (
                        <p className="text-neutral-400 text-sm text-center w-full">Drop a choice here</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
