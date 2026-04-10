# Учёт белья — Laundry Tracker

A Russian-language laundry tracking app for managing linen records across hotel/rental apartments.

## Stack

- React 18 + Vite (port 5000)
- No backend — all data stored in `localStorage`

## Features

- **Log tab**: Select apartment → enter date, maid, linen quantities, photos, consumables needed, notes
- **History tab**: Browse, search and filter past records; expand for details; delete entries
- **Settings tab**: Password-protected (code: `2026`); manage apartments, maids, and linen types

## Running

```bash
npm run dev
```

## Structure

```
src/
  App.jsx    # Full single-file React app
  main.jsx   # Entry point
index.html
vite.config.js
package.json
```
