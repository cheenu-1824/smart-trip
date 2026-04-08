import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="sticky top-0 z-40 bg-white/80 backdrop-blur-sm border-b border-gray-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 font-bold text-lg text-primary-800">
            <svg className="h-6 w-6 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            SmartTrip
          </Link>

          {/* Desktop nav */}
          <div className="hidden sm:flex items-center gap-1">
            {user ? (
              <>
                <Link
                  to="/dashboard"
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive('/dashboard')
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  My Trips
                </Link>
                <Link
                  to="/plan"
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive('/plan')
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  Plan Trip
                </Link>
                <div className="ml-2 flex items-center gap-2">
                  <span className="text-sm text-gray-500">Hi, {user.name.split(' ')[0]}</span>
                  <button onClick={handleLogout} className="btn-secondary text-xs py-1.5 px-3">
                    Sign Out
                  </button>
                </div>
              </>
            ) : (
              <>
                <Link to="/login" className="btn-ghost">Sign In</Link>
                <Link to="/signup" className="btn-primary">Get Started</Link>
              </>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            className="sm:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {menuOpen
                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />}
            </svg>
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="sm:hidden pb-4 flex flex-col gap-1 animate-fade-in">
            {user ? (
              <>
                <Link to="/dashboard" className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50" onClick={() => setMenuOpen(false)}>My Trips</Link>
                <Link to="/plan" className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50" onClick={() => setMenuOpen(false)}>Plan Trip</Link>
                <button onClick={handleLogout} className="text-left px-4 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50">Sign Out</button>
              </>
            ) : (
              <>
                <Link to="/login" className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50" onClick={() => setMenuOpen(false)}>Sign In</Link>
                <Link to="/signup" className="px-4 py-2 rounded-lg text-sm font-medium text-primary-700 hover:bg-primary-50" onClick={() => setMenuOpen(false)}>Get Started</Link>
              </>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
