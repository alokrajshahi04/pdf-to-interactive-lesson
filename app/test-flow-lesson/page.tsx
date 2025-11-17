'use client';

import { useState, useEffect } from 'react';
import { FlowDiagram } from '../components/flow-diagram';
import type { FlowDiagramLesson } from '@/lib/types';

export default function TestFlowLesson() {
  const [lesson, setLesson] = useState<FlowDiagramLesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userAnswer, setUserAnswer] = useState<number[]>([]);

  useEffect(() => {
    fetch('/api/test-flow-lesson')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setLesson(data.lesson);
        } else {
          setError(data.message || 'Failed to load lesson');
        }
      })
      .catch((err) => {
        setError(err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-neutral-600 dark:text-neutral-400">Generating flow diagram lesson...</p>
        </div>
      </div>
    );
  }

  if (error || !lesson) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-lg p-6 max-w-md">
          <h1 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-2">Error</h1>
          <p className="text-neutral-600 dark:text-neutral-400">{error || 'No lesson data'}</p>
        </div>
      </div>
    );
  }

  const handleSlotClick = (slotIndex: number, choiceIndex: number) => {
    const newAnswer = [...userAnswer];
    newAnswer[slotIndex] = choiceIndex;
    setUserAnswer(newAnswer);
  };

  const checkAnswer = () => {
    if (userAnswer.length !== lesson.answer.length) {
      alert('Please fill all slots!');
      return;
    }
    
    const isCorrect = userAnswer.every((val, idx) => val === lesson.answer[idx]);
    if (isCorrect) {
      alert('✅ Correct! Well done!');
    } else {
      alert('❌ Not quite right. Try again!');
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">
            Flow Diagram Test
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400">
            Testing flow diagram lesson generation and rendering
          </p>
        </div>

        {/* Lesson Card */}
        <div className="bg-white dark:bg-neutral-800 rounded-2xl border border-neutral-200 dark:border-neutral-700 shadow-sm overflow-hidden mb-6">
          {/* Lesson Title */}
          <div className="p-6 border-b border-neutral-200 dark:border-neutral-700">
            <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">{lesson.title}</h2>
          </div>

          {/* Lesson Content */}
          <div className="p-6 border-b border-neutral-200 dark:border-neutral-700">
            <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed mb-4">{lesson.content}</p>
            <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 p-4 rounded">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-200">💡 {lesson.info}</p>
            </div>
          </div>

          {/* Flow Diagram */}
          <div className="p-6 border-b border-neutral-200 dark:border-neutral-700">
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Process Flow</h3>
            <div className="h-[500px] border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden">
              <FlowDiagram config={lesson.flowConfig} />
            </div>
          </div>

          {/* Question */}
          <div className="p-6">
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-4">{lesson.question}</h3>
            
            {/* Choices */}
            <div className="mb-6">
              <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Available Choices:</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {lesson.choices.map((choice, index) => (
                  <div
                    key={index}
                    className="p-3 bg-neutral-100 dark:bg-neutral-800 rounded-lg border border-neutral-300 dark:border-neutral-600 text-neutral-900 dark:text-neutral-100"
                  >
                    <span className="font-medium">{index}:</span> {choice}
                  </div>
                ))}
              </div>
            </div>

            {/* Slots */}
            <div className="mb-6">
              <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Arrange in Order:</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {lesson.slots.map((slot, slotIndex) => (
                  <div key={slotIndex} className="space-y-2">
                    <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400">{slot}</p>
                    <select
                      className="w-full p-3 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                      value={userAnswer[slotIndex] ?? ''}
                      onChange={(e) => handleSlotClick(slotIndex, parseInt(e.target.value))}
                    >
                      <option value="">Select...</option>
                      {lesson.choices.map((choice, choiceIndex) => (
                        <option key={choiceIndex} value={choiceIndex}>
                          {choiceIndex}: {choice}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            {/* Submit Button */}
            <button
              onClick={checkAnswer}
              className="w-full md:w-auto px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              Check Answer
            </button>
          </div>
        </div>

        {/* Debug Info */}
        <div className="bg-neutral-100 dark:bg-neutral-800 rounded-lg p-4">
          <details>
            <summary className="cursor-pointer font-medium text-neutral-700 dark:text-neutral-300">
              Debug Info
            </summary>
            <pre className="mt-4 text-xs overflow-auto bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 p-4 rounded">
              {JSON.stringify(lesson, null, 2)}
            </pre>
          </details>
        </div>
      </div>
    </div>
  );
}

