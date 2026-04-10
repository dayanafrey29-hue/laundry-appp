# Учёт белья — Laundry Tracker

A Russian-language laundry tracking app with real-time cross-device synchronization.

## Stack

- **Frontend**: React 18 + Vite (port 5000)
- **Backend**: Express.js (port 3001) — REST API + SSE for real-time sync
- **Database**: Replit PostgreSQL — persistent storage via `laundry_store` table
- **Offline fallback**: localStorage cache when server is unavailable

## Features

- **Log tab**: Select apartment → enter date, maid, linen quantities, photos, consumables needed, notes
- **History tab**: Browse, search and filter past records; expand for details; delete entries
- **Settings tab**: Password-protected (code: `2026`); draft-based editor for apartments, maids, linen types; explicit save button
- **Real-time sync**: Changes on any device appear instantly on all others via Server-Sent Events
- **Offline mode**: Falls back to localStorage if server is unreachable

## Running

Two workflows must run together:
```bash
node server.js       # API Server (port 3001)
npm run dev          # Frontend (port 5000)
```

## Architecture

```
src/
  App.jsx    # Full React SPA
  main.jsx   # Entry point
server.js    # Express API + SSE broadcast server
index.html
vite.config.js   # Proxies /api/* → localhost:3001
package.json
```

## Database

Table: `laundry_store (key TEXT PRIMARY KEY, value TEXT, updated_at TIMESTAMP)`

Keys: `records`, `apts`, `maids`, `linen`
