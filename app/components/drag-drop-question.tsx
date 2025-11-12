"use client";

import { useState, useEffect } from "react";
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
  const [slotAssignments, setSlotAssignments] = useState<number[]>(() => {
    if (userAnswer && userAnswer.length === 3) {
      return [...userAnswer];
    }
    return [-1, -1, -1]; // -1 means empty slot
  });

  // Sync userAnswer prop changes to state (e.g., when navigating between questions)
  useEffect(() => {
    if (userAnswer && userAnswer.length === 3) {
      setSlotAssignments([...userAnswer]);
    } else {
      setSlotAssignments([-1, -1, -1]);
    }
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

  // Update parent when slot assignments change
  const handleSlotChange = (newAssignments: number[]) => {
    setSlotAssignments(newAssignments);
    // Only call onAnswerChange if all slots are filled
    if (newAssignments.every((val) => val !== -1)) {
      onAnswerChange(newAssignments);
    }
  };

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
      handleSlotChange(newAssignments);
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
        handleSlotChange(newAssignments);
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
          <h3 className="text-base font-medium text-gray-900">
            Drag and drop the colored pills to their correct spot
          </h3>
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
                <span className="text-gray-800 font-medium text-center">
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
              <span className="text-gray-800 font-medium text-center">
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
      <span className="text-gray-800 font-medium text-center">{text}</span>
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
}: DroppableSlotProps) {
  // Always use droppable for the drop zone
  const { setNodeRef, isOver } = useDroppable({
    id,
    disabled: showResult,
  });

  const borderColor = 
    isOver && !showResult
      ? "#d4d4d8" // neutral-300
      : isCorrect
      ? "#d4d4d8" // neutral-300
      : isIncorrect
      ? "#d4d4d8" // neutral-300
      : assignedChoice
      ? "#d4d4d8" // neutral-300
      : "#d4d4d8"; // neutral-300

  const backgroundColor =
    isOver && !showResult
      ? "#dbeafe" // blue-100
      : isCorrect
      ? "#f0fdf4" // green-50
      : isIncorrect
      ? "#fef2f2" // red-50
      : assignedChoice
      ? "#ffffff" // white
      : "#ffffff"; // white

  return (
    <div
      ref={setNodeRef}
      style={{
        borderColor: "#a3a3a3", // neutral-400 (darker)
        borderWidth: "1.5px",
        borderStyle: "dashed",
        borderImage: "none",
        backgroundColor,
      }}
      className={`w-full p-4 rounded-2xl flex flex-col items-center transition-all ${
        showResult && isIncorrect && correctChoice ? "min-h-[140px]" : "h-[100px]"
      }`}
    >
      <p className="text-sm font-semibold text-gray-700 mb-2">{label}</p>
      <div className="flex-1 flex items-center justify-center w-full min-h-0">
        {assignedChoice ? (
          <DraggableSlotContent
            id={id}
            text={assignedChoice}
            disabled={showResult}
          />
        ) : (
          <p className="text-gray-400 text-sm text-center">Drop a choice here</p>
        )}
      </div>
      {showResult && isIncorrect && correctChoice && (
        <div className="mt-3 pt-2 border-t border-neutral-300 w-full">
          <p className="text-xs text-green-700 font-semibold mb-1 text-center">Correct:</p>
          <p className="text-xs text-green-600 text-center leading-relaxed px-2">
            {correctChoice}
          </p>
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
}: {
  id: string;
  text: string;
  disabled: boolean;
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
      className={`text-gray-800 font-medium ${
        disabled ? "" : "cursor-grab active:cursor-grabbing"
      }`}
    >
      {text}
    </div>
  );
}


