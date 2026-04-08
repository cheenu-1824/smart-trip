import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

/**
 * A draggable destination card used in the TripPlanner page.
 */
export default function DestinationCard({ destination, index, onRemove, onUpdate }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: destination.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`card !p-4 flex gap-3 items-start group transition-shadow ${
        isDragging ? 'shadow-lg ring-2 ring-primary-300' : ''
      }`}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="mt-1 text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing flex-shrink-0"
        aria-label="Drag to reorder"
      >
        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
          <path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm0 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm0 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm6-12a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm0 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm0 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />
        </svg>
      </button>

      <div className="flex-1 min-w-0">
        {/* Stop number + name */}
        <div className="flex items-center gap-2 mb-1">
          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center">
            {index + 1}
          </span>
          <p className="font-semibold text-gray-900 text-sm truncate">{destination.name}</p>
        </div>

        {destination.address && (
          <p className="text-xs text-gray-400 ml-8 truncate">{destination.address}</p>
        )}

        {/* Visit duration input */}
        <div className="mt-2 ml-8 flex items-center gap-2">
          <label className="text-xs text-gray-500">Visit time:</label>
          <input
            type="number"
            min="15"
            max="480"
            step="15"
            value={destination.visitDuration}
            onChange={(e) =>
              onUpdate(destination.id, { visitDuration: parseInt(e.target.value, 10) || 60 })
            }
            className="w-20 px-2 py-1 text-xs rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-300"
          />
          <span className="text-xs text-gray-400">min</span>
        </div>
      </div>

      {/* Remove button */}
      <button
        onClick={() => onRemove(destination.id)}
        className="flex-shrink-0 p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
        aria-label="Remove destination"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
