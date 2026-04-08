import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import TripCard from '../components/TripCard';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
  const { user } = useAuth();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchTrips = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/trips');
      setTrips(data.trips);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrips();
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this trip? This cannot be undone.')) return;
    try {
      await api.delete(`/trips/${id}`);
      setTrips((prev) => prev.filter((t) => t._id !== id));
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Trips</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Welcome back, {user?.name?.split(' ')[0]}
          </p>
        </div>
        <Link to="/plan" className="btn-primary">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New Trip
        </Link>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-20">
          <LoadingSpinner size="lg" label="Loading your trips…" />
        </div>
      ) : error ? (
        <div className="card text-center py-10">
          <p className="text-red-600 text-sm">{error}</p>
          <button onClick={fetchTrips} className="btn-secondary mt-4">Try Again</button>
        </div>
      ) : trips.length === 0 ? (
        <div className="card text-center py-16 animate-fade-in">
          <div className="text-5xl mb-4">🗺️</div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">No trips yet</h2>
          <p className="text-sm text-gray-500 mb-6 max-w-xs mx-auto">
            Plan your first AI-optimized trip and it will appear here.
          </p>
          <Link to="/plan" className="btn-primary">Plan My First Trip</Link>
        </div>
      ) : (
        <div className="space-y-4">
          {trips.map((trip) => (
            <TripCard key={trip._id} trip={trip} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
