"use client";

interface HeaderProps {
  onBackClick?: () => void;
  showProgressBar?: boolean;
  moduleProgress?: Array<{ progress: number }>;
}

function Header({ onBackClick, showProgressBar, moduleProgress }: HeaderProps) {
  return (
    <div className="border-b border-gray-200">
      <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
        <button
          onClick={onBackClick}
          className="text-gray-600 hover:text-gray-900"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
        </button>
        <div className="text-sm text-gray-600">
          Credits left: <span className="font-semibold">12</span>
        </div>
        <div className="flex items-center gap-4">
          <button className="text-gray-600 hover:text-gray-900">
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
              />
            </svg>
          </button>
          <button className="text-gray-600 hover:text-gray-900">
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </button>
          <button className="w-8 h-8 rounded-full bg-gray-900 text-white flex items-center justify-center">
            i
          </button>
        </div>
      </div>
      {/* Progress bar */}
      {showProgressBar && moduleProgress && (
        <div className="h-2 bg-gray-100">
          <div className="flex h-full">
            {moduleProgress.map((mod, idx) => (
              <div
                key={idx}
                className="flex-1 bg-gray-100 relative overflow-hidden"
              >
                <div
                  className="h-full bg-green-500 transition-all duration-300"
                  style={{ width: `${mod.progress}%` }}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export { Header };
