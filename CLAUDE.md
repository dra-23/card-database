# sleevd — Claude Code Project Brief

## What This Is
**sleevd** is a sports card collection PWA. Users sign in with Google, manage a card collection organized by player, track graded cards, and get AI-powered card identification and pricing via Cardsight AI.

**Stack:** Vite 5 + Vanilla JS (ES modules) + Firebase (Firestore + Storage + Auth + Hosting) + Cloud Run functions (`functions/`) for the Cardsight and PSA proxies  
**Branches:** `main` is production. Work on a feature branch and open a PR into `main`; merging deploys.  
**Run:** `npm run dev`  
**Deploy:** pushing to `main` builds and publishes to Firebase Hosting via `.github/workflows/deploy.yml` (needs the `FIREBASE_SERVICE_ACCOUNT` repo secret: a service account key with Firebase Hosting Admin, Cloud Run Viewer, API Keys Viewer and Service Usage Consumer). Manual fallback: `npm run build && firebase deploy --only hosting`.

---

## Architecture

### Pages (bottom nav / rail nav)
| Page | Slot | File |
|------|------|------|
| Players | `slot-players` | `src/pages/players.js` |
| Collection | `slot-collection` | `src/pages/collection.js` |
| Graded | `slot-graded` | `src/pages/graded.js` |
| Profile/Stats | `slot-stats` | `src/pages/stats.js` |

### Navigation Model
- **Mobile (< 768px):** horizontal page-track swipe + bottom nav bar with FAB pill
- **Tablet / fold (768–1279px):** nav rail + two-pane layout at 840px+
- **Desktop (≥ 1280px):** three-pane layout

`src/layout.js` owns `switchPage()`, `_commitPageSwitch()`, breakpoint media queries (`_wideQuery` 768px, `_foldQuery` 840px, `_threePaneQuery` 1280px). `switchPage` emits `page:changed` so pages re-render.

History API pattern:
- `pushState` for new navigation layers (player detail, settings, card detail)
- `replaceState` for in-place swaps (set-preview card taps within card detail)
- `popstate` handler in `main.js` dismisses overlays top-down

### State
`src/state.js` — Firestore subscriptions, `ALL_CARDS`, `ALL_PLAYERS`, `selectedPlayer`, `currentPage`, search queries, filter flags, card sequences for swipe navigation.

### Shell / DOM
`src/shell.js` — renders the entire app HTML into `#app` on startup. All sheets, nav, pages are static HTML; pages populate their content divs dynamically.

---

## Key Files

```
src/
  main.js              — app startup, all event wiring, popstate, FAB actions
  shell.js             — full app HTML (all sheets, nav rail, pages)
  style.css            — all styles (Material Design 3 Expressive tokens)
  layout.js            — page switching, breakpoints, two/three-pane logic
  state.js             — Firestore subscriptions, global state
  cardsight.js         — Cardsight client: calls /api/cardsight (key held server-side)
  theme.js             — light/dark/system theme, localStorage persist
  gestures.js          — sheet drag-to-dismiss, card swipe navigation, long-press
  utils.js             — isOwned()/isSold()/isWanted(), matchesSearch(), getCleanImg(), escapeAttr(), confirmDialog()

  pages/
    players.js         — player tile grid, openDetail, renderDetail
    collection.js      — card list with AND-token search, sort chips
    graded.js          — graded tile grid grouped by player
    stats.js           — profile/stats page

  components/
    card-detail.js     — renderCardPanelInto(), handleCardTap(), same-set preview
    card-form.js       — add/edit card form, AI photo identification, prefill
    card-search.js     — Cardsight text search + scan-to-identify sheet
    badge-picker.js    — long-press badge quick-picker sheet
    overflow-menu.js   — card row context menu
    player-forms.js    — add/edit player forms
    psa-sheet.js       — registry sheet: company, cert, pop (pop via Cardsight)
    lightbox.js        — image lightbox
    price-prompt.js    — price entry prompt
    notes-prompt.js    — notes entry prompt
    sold-prompt.js     — Mark as Sold prompt + markCardSold()/unmarkCardSold()
    undo-bar.js        — showUndo(message, onUndo) snackbar
    cardsight-link.js  — match a card to a Cardsight catalog entry
    cardsight-usage.js — monthly Cardsight call budget

  services/
    market-value.js    — Cardsight pricing → saved MarketValue on cards; resolveParallel()
    population.js      — lookupPopulation(card): pop + pop higher from Cardsight

functions/index.js     — Cloud Run: `cardsight` (/api/cardsight/**); `psalookup` (/api/psa) is unused since PSA ended its free API
```

---

## CSS / Design System

**Tokens:** `--md-primary`, `--md-surface`, `--md-surface-1`, `--md-surface-2`, `--md-on-surface`, `--md-on-surface-variant`, `--md-outline`

**Dark mode:** `[data-theme="dark"]` on `<html>`. Toggled via `src/theme.js`. Pref stored in `localStorage` as `'light'`, `'dark'`, or `'system'`.

**Material 3 Expressive elevation (player tiles, graded tiles):**
```css
box-shadow: 0 2px 4px rgba(0,0,0,0.12), 0 6px 20px rgba(0,0,0,0.09);
transition: box-shadow 0.25s cubic-bezier(0.2,0,0,1), transform 0.25s cubic-bezier(0.2,0,0,1);
/* :active */ transform: scale(0.95); box-shadow: 0 1px 2px rgba(0,0,0,0.10);
/* dark */ box-shadow: 0 2px 6px rgba(0,0,0,0.5), 0 8px 24px rgba(0,0,0,0.4);
```

**Card thumbnails:** `border-radius: 0` (no rounding — preserves full card corners)

**Player tiles:** `aspect-ratio: 3/4`, `object-fit: cover` — always fills the tile edge-to-edge (cropping top/bottom for portrait images, left/right for landscape) so every tile image matches the nameplate's width.

---

## Cardsight AI Integration

**Client:** `src/cardsight.js` mirrors the subset of the `cardsightai` SDK the app uses (same `{ data, error }` shape) but sends every call to `/api/cardsight/...` with the user's Firebase ID token. The Cloud Run function in `functions/index.js` checks the path against an allowlist and adds the API key from the `CARDSIGHT_API_KEY` secret. Never put the key in a `VITE_` env var: those are baked into the public bundle.
**MCP server:** configured in `.claude/settings.json` for Claude Code sessions

### Current integrations
| Feature | Where | How |
|---------|-------|-----|
| Card pricing | `card-detail.js` | `CardsightId` field → `cardsight.pricing.get()` |
| Text search | `card-search.js` | `cardsight.catalog.search()` |
| Photo identify | `card-search.js` + `card-form.js` | `cardsight.identify.card(file)` |
| Card image fetch | `card-search.js` | `cardsight.images.getCard(id, { format: 'json' })` |
| Population (pop report) | `psa-sheet.js` → `services/population.js` | `cardsight.population.card(id)`, picks base/parallel via `resolveParallel`, then company → Standard type → grade |

### AI photo identification in card form
When adding a new card and selecting a photo, `card-form.js` automatically calls `cardsight.identify.card(file)`. On match: fills year, set, number, manufacturer, sport, player (if in collection), grading company/grade, numbered flag, and stores `CardsightId`. Button shows "🔍 Identifying…" → "✓ AI matched".

---

## Important Patterns

### Window hook pattern (avoiding circular imports)
`gestures.js` calls `window._openBadgePicker`, `window._openRowMenu`, etc. These are set in `main.js` after importing the actual functions. Same pattern for `window._navigateCard`, `window._openLightbox`, `window._openCardForm`.

### Card navigation context
`handleCardTap(cardId, ctx, replace = false)` — `ctx` is `'player'`, `'collection'`, or `'graded'`. Pass `replace = true` for in-place swaps (set preview). Each ctx has its own sheet (`cardDetailSheet`, `collectionCardSheet`, `gradedCardSheet`).

### Search
`matchesSearch(card, query, players)` in `utils.js`, used by Collection, Graded and player detail. AND-token matching: the query splits on spaces and every token must appear in the card's text: year, set, manufacturer, sport, team, player name and id, number (with or without `#`), parallel, serial, and grading company + grade. Player ids are the name at creation, so a renamed player is only found by name via the `players` lookup.

### Settings page
Full-screen push page (`#settings-page`), not a sheet. Uses `history.pushState({ v: 'settings' })`, slides in from right with CSS `translateX(100%) → translateX(0)`.

### Badge picker
Long-press on any card row calls `window._openBadgePicker(cardId)`. Sheet (`#badgePickerSheet`) shows Sleevd/Favorite/RC/AUTO/MEM/#'d toggles. Saves to Firestore immediately on tap via `setDoc` merge. Sleevd follows `isOwned()`, so turning it on for a sold card clears the sale.

### Undo bar
`showUndo(message, onUndo)` from `components/undo-bar.js` after reversible changes: mark sold / edit sale / remove sale (restores the previous sale fields) and delete card (re-creates the document from the copy in `state.ALL_CARDS`). Removing a sale has no confirm dialog because the undo bar covers it.

### Same-set preview in card detail
Bottom of card detail shows other cards from same Year + Set + Sport. Tapping uses `handleCardTap(id, ctx, true)` (replaceState) + `panelEl.scrollTop = 0`.

### Dark mode toggle (nav rail)
`#railThemeToggle` button in `#nav-rail`. Toggles `'dark'` ↔ `'light'` (not system, so it always visually changes). `_syncRailThemeBtn()` syncs icon and active state. Kept in sync with Settings page theme picker.

---

## Firestore Schema

**Collection: `Cards`**
```
Player (ref id), Year, Set, Number, Manufacturer, Sport, Team,
Grading Company, Grade, Price, Card Information (URL), App Image (URL),
RC (bool), Auto (bool), Mem (bool), Numbered (bool), Owned (bool),
CardsightId (string), PSACert, PSAPop,
Sold (bool), SoldPrice (string), SoldDate (YYYY-MM-DD),
PSAPopHigher (number), PSAPopAt (ms timestamp), PSAGrade/PSAImage/PSAImageBack (legacy, from the old PSA lookup)
```
Pop fields keep their `PSA` prefix but hold whichever company's pop (from Cardsight). PSA's free cert API was discontinued in Oct 2026 (paid tiers from $179/yr), so the app no longer calls it; the cert is checked on the grader's website via `registryUrl()` in `utils.js`.

Adding a Cardsight endpoint means adding it to `CARDSIGHT_ALLOWED` in `functions/index.js` **and deploying functions** (`firebase deploy --only functions:cardsight`); the GitHub workflow deploys hosting only.
A sold card keeps its `Owned` flag; `isOwned()` returns false while `Sold` is set, and `isWanted()` (unsleevd) excludes sold cards. Sale prompt + helpers live in `src/components/sold-prompt.js`.

**Collection: `Players`** (document id = player name at creation; renaming changes `Player`, not the id)
```
Player (name), Sport, Main Image (URL), Banner_Image (URL)
```

---

## MCP Tools Available (new sessions)
The Cardsight MCP server (`https://mcp.cardsight.ai`) is configured in `.claude/settings.json`. Available tools include: `search_cards`, `search_catalog`, `get_card`, `get_card_pricing`, `get_card_pricing_bulk`, `get_card_marketplace`, `get_card_population`, `get_card_image`, `search_sets`, `search_releases`, `search_parallels`, `identify_card`.
