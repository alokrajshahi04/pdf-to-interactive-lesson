"use client";

import { useState, useEffect } from "react";
import {
  getStoredCourses,
  deleteCourse,
  getCompletionPercentage,
  type StoredCourse,
} from "@/lib/storage";

interface DashboardProps {
  onSelectCourse: (courseId: string) => void;
  onUploadNew: () => void;
}

function Dashboard({ onSelectCourse, onUploadNew }: DashboardProps) {
  const [courses, setCourses] = useState<StoredCourse[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    setCourses(getStoredCourses());
  }, []);

  const handleDelete = (courseId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Delete this course?")) {
      deleteCourse(courseId);
      setCourses(getStoredCourses());
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    // Trigger upload
    onUploadNew();
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Left Sidebar */}
      <aside className="w-96 bg-white border-r border-gray-200 p-8 flex flex-col">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome back!
          </h1>
          <p className="text-gray-600">
            Pick up right where you left off or start a fresh course from any
            PDF.
          </p>
        </div>

        {/* Upload Area */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`flex-1 border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center transition-colors ${
            isDragging
              ? "border-blue-500 bg-blue-50"
              : "border-gray-300 bg-gray-50"
          }`}
        >
          <button
            onClick={onUploadNew}
            className="px-6 py-3 bg-gray-900 text-white rounded-full font-medium hover:bg-gray-800 transition-colors mb-3"
          >
            Upload a PDF
          </button>
          <p className="text-sm text-gray-500">Or drag-and-drop here</p>
        </div>

        {/* Footer */}
        <div className="mt-8 text-xs text-gray-500 flex items-center gap-2">
          <span>Powered by</span>
          <span className="font-semibold">together.ai</span>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-12">
        <div className="max-w-7xl mx-auto">
          {courses.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-gray-500 text-lg">
                No courses yet. Upload a PDF to get started!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {courses.map((stored) => {
                const completion = getCompletionPercentage(stored);
                const isComplete = completion === 100;
                const { currentModuleIndex, totalModules } = stored.progress;

                return (
                  <div
                    key={stored.id}
                    onClick={() => onSelectCourse(stored.id)}
                    className={`relative p-6 rounded-2xl border-2 text-left transition-all hover:shadow-lg cursor-pointer ${
                      isComplete
                        ? "bg-green-50 border-green-200"
                        : "bg-white border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    {/* Delete Button */}
                    <button
                      onClick={(e) => handleDelete(stored.id, e)}
                      className="absolute top-4 right-4 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors z-10"
                      title="Delete course"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>

                    {/* Course Title */}
                    <h3 className="text-xl font-bold text-gray-900 mb-2 pr-8">
                      {stored.course.title}
                    </h3>

                    {/* Progress */}
                    <p className="text-sm text-gray-600 mb-1">
                      {isComplete ? (
                        <span className="text-green-600 font-medium">
                          100% Complete
                        </span>
                      ) : (
                        <>
                          <span className="font-medium">
                            {completion}% Complete
                          </span>
                          {" - "}
                          <span className="text-gray-500">
                            [Module {currentModuleIndex + 1}/{totalModules}]
                          </span>
                        </>
                      )}
                    </p>

                    {/* Timestamp */}
                    <p className="text-xs text-gray-400 mt-3">
                      Last accessed:{" "}
                      {new Date(stored.lastAccessedAt).toLocaleDateString()}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export { Dashboard };
