import React from 'react';

const formatTime = (d) =>
  new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

const fmtMin = (m) => {
  if (!m || m === 0) return '—';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem > 0 ? `${h}h ${rem}m` : `${h}h`;
};

export default function ScheduleList({ schedule, totalTravelTime, totalVisitTime }) {
  if (!schedule || schedule.length === 0) return null;

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-3">
        <SummaryCard label="Stops" value={schedule.length} icon="📍" />
        <SummaryCard label="Travel" value={fmtMin(totalTravelTime)} icon="🚗" />
        <SummaryCard label="Visits" value={fmtMin(totalVisitTime)} icon="⏱️" />
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-primary-100" />

        <div className="space-y-3">
          {schedule.map((stop, i) => (
            <div key={i} className="relative flex gap-4 pl-12">
              {/* Circle marker */}
              <div className="absolute left-3 top-3 w-5 h-5 rounded-full bg-primary-700 border-2 border-white shadow-sm flex items-center justify-center">
                <span className="text-[9px] font-bold text-white">{i + 1}</span>
              </div>

              {/* Card */}
              <div className="flex-1 card !p-4 animate-slide-up" style={{ animationDelay: `${i * 60}ms` }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-gray-900 text-sm leading-tight">
                      {stop.place?.name}
                    </h4>
                    {stop.place?.address && (
                      <p className="text-xs text-gray-400 mt-0.5 truncate">{stop.place.address}</p>
                    )}
                  </div>

                  {/* Time badge */}
                  <div className="flex-shrink-0 text-right">
                    <p className="text-sm font-semibold text-primary-700">
                      {formatTime(stop.arrivalTime)}
                    </p>
                    <p className="text-xs text-gray-400">
                      until {formatTime(stop.departureTime)}
                    </p>
                  </div>
                </div>

                {/* Travel + visit stats */}
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-500">
                  {i > 0 && stop.travelTimeFromPrev > 0 && (
                    <span className="flex items-center gap-1">
                      <span>🚗</span> {fmtMin(stop.travelTimeFromPrev)} drive
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <span>⏱️</span> {fmtMin(stop.place?.visitDuration)} visit
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const SummaryCard = ({ label, value, icon }) => (
  <div className="card !p-3 text-center">
    <div className="text-xl mb-0.5">{icon}</div>
    <div className="text-base font-bold text-gray-900">{value}</div>
    <div className="text-xs text-gray-400">{label}</div>
  </div>
);
