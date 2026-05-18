# sleevd — Claude Code Project Brief

## What This Is
**sleevd** is a sports card collection PWA. Users sign in with Google, manage a card collection organized by player, track graded cards, and get AI-powered card identification and pricing via Cardsight AI.

**Stack:** Vite 5 + Vanilla JS (ES modules) + Firebase (Firestore + Storage + Auth) + `cardsightai` npm package  
**Dev branch:** `claude/move-to-projects-y7djP`  
**Run:** `npm run dev`

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
  cardsight.js         — `new CardSightAI({ apiKey })` singleton
  theme.js             — light/dark/system theme, localStorage persist
  gestures.js          — sheet drag-to-dismiss, card swipe navigation, long-press
  utils.js             — isOwned(), getCleanImg(), escapeAttr()

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
    psa-sheet.js       — PSA/grading registry sheet
    lightbox.js        — image lightbox
    price-prompt.js    — price entry prompt

  services/
    psa.js             — PSA registry API calls
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

**Player tiles:** `aspect-ratio: 3/4`, `object-fit: contain` by default; JS switches to `object-fit: cover` for landscape images after load.

---

## Cardsight AI Integration

**SDK:** `cardsightai` npm package, singleton in `src/cardsight.js`  
**API key env var:** `VITE_CARDSIGHT_API_KEY`  
**MCP server:** configured in `.claude/settings.json` for Claude Code sessions

### Current integrations
| Feature | Where | How |
|---------|-------|-----|
| Card pricing | `card-detail.js` | `CardsightId` field → `cardsight.pricing.get()` |
| Text search | `card-search.js` | `cardsight.catalog.search()` |
| Photo identify | `card-search.js` + `card-form.js` | `cardsight.identify.card(file)` |
| Card image fetch | `card-search.js` | `cardsight.images.getCard(id, { format: 'json' })` |

### AI photo identification in card form
When adding a new card and selecting a photo, `card-form.js` automatically calls `cardsight.identify.card(file)`. On match: fills year, set, number, manufacturer, sport, player (if in collection), grading company/grade, numbered flag, and stores `CardsightId`. Button shows "🔍 Identifying…" → "✓ AI matched".

---

## Important Patterns

### Window hook pattern (avoiding circular imports)
`gestures.js` calls `window._openBadgePicker`, `window._openRowMenu`, etc. These are set in `main.js` after importing the actual functions. Same pattern for `window._navigateCard`, `window._openLightbox`, `window._openCardForm`.

### Card navigation context
`handleCardTap(cardId, ctx, replace = false)` — `ctx` is `'player'`, `'collection'`, or `'graded'`. Pass `replace = true` for in-place swaps (set preview). Each ctx has its own sheet (`cardDetailSheet`, `collectionCardSheet`, `gradedCardSheet`).

### Collection search
AND-token matching: query splits on spaces, all tokens must match against joined haystack of `Year + Set + Manufacturer + Player`.

### Settings page
Full-screen push page (`#settings-page`), not a sheet. Uses `history.pushState({ v: 'settings' })`, slides in from right with CSS `translateX(100%) → translateX(0)`.

### Badge picker
Long-press on any card row calls `window._openBadgePicker(cardId)`. Sheet (`#badgePickerSheet`) shows RC/AUTO/MEM/#'d toggles. Saves to Firestore immediately on tap via `setDoc` merge.

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
CardsightId (string), PSACert, PSAPop
```

**Collection: `Players`**
```
Player (name), Sport, Image (URL), BannerImage (URL)
```

---

## MCP Tools Available (new sessions)
The Cardsight MCP server (`https://mcp.cardsight.ai`) is configured in `.claude/settings.json`. Available tools include: `search_cards`, `search_catalog`, `get_card`, `get_card_pricing`, `get_card_pricing_bulk`, `get_card_marketplace`, `get_card_population`, `get_card_image`, `search_sets`, `search_releases`, `search_parallels`, `identify_card`.
