# TCA — Laundry Tracker

A Russian-language laundry tracking PWA with iOS-style design and Supabase backend.

## Stack

- **Frontend**: React 18 + Vite (port 5000)
- **Backend**: Supabase (PostgreSQL + Storage)
- **Font**: Inter (Google Fonts)
- **Deployment**: Vercel

## Features

- **Log tab**: Select apartment → enter date, maid, linen quantities, photos, consumables, notes
- **History tab**: Browse, search and filter past records; expand for details; delete entries
- **Settings tab**: Password-protected (code: `2026`); draft-based editor for apartments, maids, linen types; color & background themes
- **Photo upload**: Images compressed to JPEG (1200px max, quality 0.6), uploaded to Supabase Storage bucket `laundry`, stored as public URLs
- **Themes**: 5 pastel accent themes (Лаванда, Рожевий, М'ята, Персик, Фіалка) + 5 light background themes (Сніг, Крем, Небо, М'ята, Рум'яна)

## Design

- iOS-style: light backgrounds, subtle borders (`rgba(0,0,0,0.06)`), rounded corners (12-14px), Inter font, backdrop blur on header
- CSS variables: `--accent`, `--accent-dark`, `--accent-dim`, `--accent-grad`, `--bg`, `--bg2`, `--bg3`
- All themes saved to Supabase `laundry_store` table; legacy dark theme IDs auto-migrated to new defaults

## Architecture

```
src/
  App.jsx          # Full React SPA (single file)
  main.jsx         # Entry point
supabaseClient.js  # Supabase client init
index.html
vite.config.js
package.json
```

## Database (Supabase)

- `laundry_records`: id(uuid), apartment(text), maid(text), date(text), linen(jsonb), consumables(text), notes(text), photos(jsonb), created_at(timestamptz)
- `laundry_store`: key(text PK), value(jsonb) — keys: apts, maids, linen, theme, bg
- Storage bucket: `laundry` (public) — photo uploads

## Environment Variables

- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — Supabase anon key
