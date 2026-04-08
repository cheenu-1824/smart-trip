import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const features = [
  {
    icon: '🗺️',
    title: 'Smart Route Optimization',
    desc: 'Our engine orders your stops using real traffic data to minimize travel time.',
  },
  {
    icon: '🕐',
    title: 'Time-Aware Scheduling',
    desc: 'We check opening hours automatically so you never arrive at a closed venue.',
  },
  {
    icon: '🚦',
    title: 'Traffic-Aware Planning',
    desc: 'Live busyness scores help you dodge congestion and peak-hour delays.',
  },
  {
    icon: '💾',
    title: 'Save & Revisit',
    desc: 'All your trips are saved to your account so you can revisit or share them.',
  },
];

export default function Landing() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen">
      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary-900 via-primary-800 to-primary-700 text-white">
        {/* Decorative circles */}
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-primary-600/30 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 w-72 h-72 rounded-full bg-primary-500/20 blur-3xl" />

        <div className="relative max-w-5xl mx-auto px-6 py-28 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-sm font-medium mb-8">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            Powered by Google Maps Platform
          </div>

          <h1 className="text-5xl sm:text-6xl font-extrabold leading-tight mb-6 tracking-tight">
            Plan smarter trips,<br />
            <span className="text-primary-300">in seconds.</span>
          </h1>

          <p className="text-xl text-primary-200 max-w-2xl mx-auto mb-10 leading-relaxed">
            Add your destinations, set your time window, and SmartTrip builds the
            most efficient, traffic-aware route — automatically.
          </p>

          <div className="flex flex-wrap gap-4 justify-center">
            {user ? (
              <Link to="/plan" className="btn-primary bg-white text-primary-800 hover:bg-primary-50 text-base px-8 py-3 rounded-xl">
                Plan a New Trip →
              </Link>
            ) : (
              <>
                <Link to="/signup" className="btn-primary bg-white text-primary-800 hover:bg-primary-50 text-base px-8 py-3 rounded-xl">
                  Get Started — Free
                </Link>
                <Link to="/login" className="btn-secondary border-white/30 text-white hover:bg-white/10 text-base px-8 py-3 rounded-xl">
                  Sign In
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* ── How It Works ─────────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-6 py-24">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold text-gray-900 mb-3">How it works</h2>
          <p className="text-gray-500 max-w-xl mx-auto">Three steps to a perfectly planned day out.</p>
        </div>
        <div className="grid sm:grid-cols-3 gap-8">
          {[
            { step: '01', title: 'Add Destinations', desc: 'Search and pin the places you want to visit using Google Places autocomplete.' },
            { step: '02', title: 'Set Your Window', desc: 'Tell us when your day starts and ends — we handle the rest.' },
            { step: '03', title: 'Get Your Route', desc: 'Receive a time-ordered, traffic-optimized schedule with a live map.' },
          ].map((item) => (
            <div key={item.step} className="text-center group">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary-50 text-primary-700 font-bold text-lg mb-5 group-hover:bg-primary-100 transition-colors">
                {item.step}
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">{item.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ──────────────────────────────────────────────────────── */}
      <section className="bg-gray-50">
        <div className="max-w-5xl mx-auto px-6 py-24">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">Why SmartTrip?</h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-6">
            {features.map((f) => (
              <div key={f.title} className="card flex gap-4 hover:shadow-md transition-shadow">
                <span className="text-3xl flex-shrink-0">{f.icon}</span>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">{f.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────────────── */}
      <section className="max-w-3xl mx-auto px-6 py-24 text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">Ready to explore smarter?</h2>
        <p className="text-gray-500 mb-8">Create your free account and plan your first trip in under 2 minutes.</p>
        <Link to={user ? '/plan' : '/signup'} className="btn-primary text-base px-10 py-3 rounded-xl">
          {user ? 'Plan a Trip →' : 'Start for Free →'}
        </Link>
      </section>
    </div>
  );
}
