interface LocationWarningModalProps {
  isOpen: boolean;
  storeName: string;
  distanceMeters: number;
  onContinue: () => void;
  onCancel: () => void;
}

function formatDistance(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)} km`;
  }
  return `${Math.round(meters)}m`;
}

export default function LocationWarningModal({
  isOpen,
  storeName,
  distanceMeters,
  onContinue,
  onCancel,
}: LocationWarningModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Card */}
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl ring-1 ring-gray-900/10">
        {/* Warning icon */}
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
          <svg
            className="h-7 w-7 text-amber-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01M10.29 3.86l-8.6 14.86A1.98 1.98 0 003.4 21h17.2a1.98 1.98 0 001.71-2.98L13.71 3.86a2 2 0 00-3.42 0z"
            />
          </svg>
        </div>

        {/* Title */}
        <h2 className="mt-4 text-center text-lg font-bold text-gray-900">
          Location Mismatch
        </h2>

        {/* Body */}
        <p className="mt-2 text-center text-sm text-gray-600 leading-relaxed">
          You appear to be{' '}
          <span className="font-semibold text-amber-700">
            {formatDistance(distanceMeters)}
          </span>{' '}
          from{' '}
          <span className="font-semibold text-gray-900">{storeName}</span>.
          This walk will be flagged as unverified in reports.
        </p>

        {/* Buttons */}
        <div className="mt-6 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onContinue}
            className="flex-1 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 transition-colors"
          >
            Continue Anyway
          </button>
        </div>
      </div>
    </div>
  );
}
