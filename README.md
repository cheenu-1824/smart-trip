# SmartTrip — AI-Powered Trip Planner

A full-stack web application that generates traffic-aware, time-optimized travel itineraries using the Google Maps Platform. Built for real-world constraints: opening hours, live traffic conditions, and fixed time windows are all accounted for automatically.

---

## Overview

Planning a multi-stop trip manually requires balancing travel distances, opening hours, and traffic conditions against a fixed time window — constraints that compound unpredictably. The result is typically a suboptimal route or a schedule that cannot realistically be completed.

SmartTrip solves this by combining a nearest-neighbor heuristic with 2-opt local search, traffic-aware travel times from the Google Maps Distance Matrix API, and a scheduling layer that validates every stop against real venue opening hours. Users receive a deterministic, constraint-valid itinerary with exact arrival and departure times at every stop.

---

## Application Preview

### Trip Planner Page
[Insert image here]

### Optimized Route View
[Insert image here]

### Dashboard / Saved Trips
[Insert image here]

---

## Key Features

**User Authentication and Trip Persistence**
JWT-based signup and login with bcrypt-hashed passwords. Every trip is scoped to the authenticated user and persisted to MongoDB, with full create, read, update, and delete support.

**Time-Aware Scheduling**
Before generating a route, the system fetches each venue's opening hours from the Google Places API and cross-references them against computed arrival times. Stops that cannot be reached while open, or cannot be fully visited before closing, are automatically excluded from the schedule.

**Busy-Aware Optimization**
Travel times are fetched from the Google Maps Distance Matrix API with a `departure_time` parameter, returning traffic-aware durations rather than free-flow estimates. An additional time-of-day penalty biases the optimizer away from known rush-hour windows.

**Route Optimization Engine**
The backend runs a two-phase optimization: a greedy nearest-neighbor pass with a backtrack penalty (discourages routing toward isolated stops), followed by a 2-opt local search that reverses route segments to reduce total driving time. Swaps are only committed when the resulting schedule still satisfies all time-window and opening-hours constraints.

**Feasibility Validation**
A pre-flight check computes whether the sum of visit durations plus a conservative haversine travel estimate fits within the selected time window. Invalid trips are rejected immediately — on the frontend before any API call, and on the backend before touching the Distance Matrix quota.

**Interactive Map Visualization**
The optimized route is rendered on a Google Map using the Maps JavaScript API DirectionsService, producing a real road-following polyline. Each stop is marked with a numbered SVG pin (green for first, red for last, blue for intermediate) that updates dynamically after every optimization.

**Editable Trips**
Users can re-open any saved or freshly optimized trip in the planner, modify destinations, reorder stops via drag-and-drop, adjust visit durations, and change the time window. Re-optimizing overwrites the existing trip record rather than creating a duplicate.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js + Express |
| Frontend | React 18 + Vite |
| Database | MongoDB + Mongoose |
| Auth | JWT + bcrypt |
| Maps | Google Maps Platform (Directions, Distance Matrix, Places) |
| Styling | Tailwind CSS |
| Drag and Drop | @dnd-kit |

---

## Project Structure

```
smart-trip-planner/
├── backend/
│   ├── server.js
│   ├── routes/           auth.js · trips.js · planner.js
│   ├── controllers/      authController.js · tripsController.js · plannerController.js
│   ├── services/         googleMapsService.js · routeOptimizer.js · timeScheduler.js
│   ├── models/           User.js · Trip.js
│   └── middleware/       auth.js
└── frontend/
    └── src/
        ├── pages/        Landing · Login · Signup · Dashboard · TripPlanner · MapResults
        ├── components/   Navbar · DestinationCard · TripCard · MapView · ScheduleList · LoadingSpinner
        ├── context/      AuthContext · GoogleMapsContext
        ├── services/     api.js
        └── hooks/        useAuth.js
```

---

## API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/signup` | No | Create account |
| POST | `/api/auth/login` | No | Login, receive JWT |
| GET | `/api/auth/me` | Yes | Get current user |
| GET | `/api/trips` | Yes | List all saved trips |
| POST | `/api/trips` | Yes | Save a new trip |
| GET | `/api/trips/:id` | Yes | Get trip by ID |
| PUT | `/api/trips/:id` | Yes | Update existing trip |
| DELETE | `/api/trips/:id` | Yes | Delete a trip |
| POST | `/api/plan-trip` | Yes | Optimize a route |

---

## Route Optimization — How It Works

1. **Enrich** — fetch opening hours for each destination via the Places API
2. **Validate** — reject the request early if total required time exceeds the available window
3. **Distance Matrix** — fetch all pairwise traffic-aware travel times
4. **Greedy pass** — nearest-neighbor ordering scored by travel time + rush-hour penalty + backtrack penalty
5. **2-opt improvement** — reverse route segments to reduce total driving time; only keep swaps that pass constraint validation
6. **Schedule** — compute exact arrival and departure times for every stop
7. **Fallback** — if the Maps API is unavailable, haversine straight-line estimates are used so the app always returns a result

---

## Setup

### Prerequisites

- Node.js 18+
- MongoDB (local or Atlas)
- Google Maps API key with the following APIs enabled:
  - Maps JavaScript API
  - Places API
  - Directions API
  - Distance Matrix API

### Install Dependencies

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### Environment Variables

**`backend/.env`**
```
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
GOOGLE_MAPS_API_KEY=your_google_maps_api_key
PORT=5000
CLIENT_URL=http://localhost:5173
```

**`frontend/.env`**
```
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
```

### Run

```bash
# Terminal 1 — Backend
cd backend
npm run dev

# Terminal 2 — Frontend
cd frontend
npm run dev
```

Visit **http://localhost:5173**
