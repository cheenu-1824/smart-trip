import React from 'react';
import { useNavigate } from 'react-router-dom';

const formatDate = (d) =>
  new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const formatTime = (d) =>
  new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

export default function TripCard({ trip, onDelete }) {
  const navigate = useNavigate();

  // View the optimized results for this saved trip
  const handleView = () => {
    navigate('/results', { state: { trip } });
  };

  // Pre-fill TripPlanner with this trip's data so the user can edit and re-optimise.
  // tripId is passed through so that saving after re-optimisation will PUT (update)
  // this trip rather than POST (create a duplicate).
  const handleEdit = () => {
    navigate('/plan', {
      state: {
        editData: {
          tripName:     trip.name,
          destinations: trip.destinations,
          startTime:    trip.startTime,
          endTime:      trip.endTime,
          tripId:       trip._id,
        },
      },
    });
  };

  const statusColors = {
    draft:     'bg-gray-100 text-gray-600',
    optimized: 'bg-green-100 text-green-700',
    completed: 'bg-blue-100 text-blue-700',
  };

  return (
    <div className="card hover:shadow-md transition-shadow animate-fade-in">
      <div className="flex items-start justify-between gap-4">

        {/* Trip info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-gray-900 truncate">{trip.name}</h3>
            <span className={`badge ${statusColors[trip.status] || statusColors.draft}`}>
              {trip.status}
            </span>
          </div>
          <p className="text-xs text-gray-400 mb-3">{formatDate(trip.startTime)}</p>

          <div className="flex flex-wrap gap-4 text-sm">
            <StatItem
              icon="📍"
              label={`${trip.destinations?.length ?? 0} stop${trip.destinations?.length !== 1 ? 's' : ''}`}
            />
            <StatItem
              icon="🕐"
              label={`${formatTime(trip.startTime)} – ${formatTime(trip.endTime)}`}
            />
            {trip.totalTravelTime > 0 && (
              <StatItem icon="🚗" label={`${trip.totalTravelTime} min driving`} />
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col gap-2 flex-shrink-0">
          <button onClick={handleView} className="btn-primary text-xs py-1.5 px-3">
            View
          </button>
          <button
            onClick={handleEdit}
            className="btn-secondary text-xs py-1.5 px-3"
          >
            Edit
          </button>
          <button
            onClick={() => onDelete(trip._id)}
            className="btn-secondary text-xs py-1.5 px-3 border-red-200 text-red-600 hover:bg-red-50"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Destination tags preview */}
      {trip.destinations?.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-50 flex flex-wrap gap-1">
          {trip.destinations.slice(0, 4).map((d, i) => (
            <span key={i} className="badge bg-primary-50 text-primary-700 text-xs">
              {d.name}
            </span>
          ))}
          {trip.destinations.length > 4 && (
            <span className="badge bg-gray-100 text-gray-500 text-xs">
              +{trip.destinations.length - 4} more
            </span>
          )}
        </div>
      )}
    </div>
  );
}

const StatItem = ({ icon, label }) => (
  <span className="flex items-center gap-1 text-gray-500">
    <span>{icon}</span>
    <span>{label}</span>
  </span>
);
