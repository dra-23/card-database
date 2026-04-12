/** Renders the full app HTML into #app */
export function renderShell() {
  document.getElementById('app').innerHTML = authScreenHTML() + appShellHTML()
}

function authScreenHTML() {
  return `
<div id="auth-screen" style="display:none; position:fixed; inset:0; background:var(--md-surface-1); z-index:9999; align-items:center; justify-content:center; flex-direction:column; gap:0;">
  <div style="display:flex; flex-direction:column; align-items:center; gap:24px; padding:48px 32px; background:#fff; border-radius:32px; box-shadow:0 8px 40px rgba(0,0,0,0.12); max-width:360px; width:calc(100% - 48px);">
    <img src="/logo.png" style="width:72px; height:72px; border-radius:20px;" onerror="this.style.display='none'">
    <div style="text-align:center;">
      <div style="font-family:'Google Sans Display'; font-size:36px; font-weight:700; line-height:1;">sleevd</div>
      <div style="font-size:15px; color:var(--md-on-surface-variant); margin-top:6px;">Your sports card collection</div>
    </div>
    <button id="signInBtn" style="display:flex; align-items:center; gap:12px; width:100%; height:52px; border-radius:26px; border:1.5px solid #dadce0; background:#fff; font-family:'Google Sans',sans-serif; font-size:15px; font-weight:600; color:#3c4043; cursor:pointer; padding:0 20px; justify-content:center; transition:background 0.15s; box-shadow:0 2px 8px rgba(0,0,0,0.06);">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="20" height="20"><path fill="#4285F4" d="M46.1 24.6c0-1.6-.1-3.1-.4-4.6H24v8.7h12.4c-.5 2.9-2.1 5.3-4.5 6.9v5.7h7.3c4.3-4 6.9-9.8 6.9-16.7z"/><path fill="#34A853" d="M24 47c6.2 0 11.4-2 15.2-5.5l-7.3-5.7c-2.1 1.4-4.7 2.2-7.9 2.2-6 0-11.1-4.1-13-9.6H3.5v5.9C7.3 41.8 15 47 24 47z"/><path fill="#FBBC05" d="M11 28.4c-.5-1.4-.7-2.9-.7-4.4s.3-3 .7-4.4v-5.9H3.5C1.3 17.3 0 20.5 0 24s1.3 6.7 3.5 9.3l7.5-5.9z"/><path fill="#EA4335" d="M24 9.5c3.4 0 6.4 1.2 8.8 3.4l6.6-6.6C35.4 2.5 30.1 0 24 0 15 0 7.3 5.2 3.5 12.8l7.5 5.9c1.9-5.5 7-9.2 13-9.2z"/></svg>
      Sign in with Google
    </button>
  </div>
</div>`
}

function appShellHTML() {
  return `
<div id="status-bar-fill" style="position:fixed;top:0;left:0;right:0;height:env(safe-area-inset-top);background:var(--md-surface-1);z-index:9999;pointer-events:none;"></div>

<div id="app-shell" style="display:none;">

  <!-- NAVIGATION RAIL (tablet/desktop ≥768px) -->
  <nav id="nav-rail">
    <div class="rail-brand">sleevd</div>
    <button class="rail-item active" id="rail-players"    data-page="players">
      <span class="material-symbols-outlined">cards_stack</span>
      <span class="rail-label">Players</span>
    </button>
    <button class="rail-item" id="rail-collection" data-page="collection">
      <span class="material-symbols-outlined">inventory_2</span>
      <span class="rail-label">Collection</span>
    </button>
    <button class="rail-item" id="rail-graded"    data-page="graded">
      <span class="material-symbols-outlined">g_mobiledata_badge</span>
      <span class="rail-label">Graded</span>
    </button>
    <button class="rail-item" id="rail-stats"     data-page="stats">
      <span class="material-symbols-outlined">bar_chart</span>
      <span class="rail-label">Stats</span>
    </button>
    <div style="flex:1;"></div>
    <button id="signOutBtn" class="rail-item" title="Sign out" style="margin-top:auto; opacity:0.6;">
      <span class="material-symbols-outlined">logout</span>
      <span class="rail-label">Sign Out</span>
    </button>
  </nav>

  <!-- RIGHT COLUMN -->
  <div id="right-column">

    <!-- GLOBAL TOP BAR (desktop only) -->
    <div id="top-bar-global">
      <span id="topBarTitle" class="brand" style="font-size:22px; flex:1;">sleevd</span>
      <div class="total-count-pill" id="totalOwnedCounterGlobal">0</div>
    </div>

    <!-- PAGE CONTAINER -->
    <div id="page-container">
      <div id="page-track">

        <!-- SLOT 0: Players -->
        <div class="page-slot" id="slot-players">
          <div class="view" id="gallery-view">
            <div class="collapsible-header-wrap" id="galleryHeaderWrap">
              <div class="collapsible-header">
                <div class="top-bar">
                  <span class="brand">Players</span>
                  <div class="total-count-pill" id="totalOwnedCounter">0</div>
                  <button class="top-bar-icon-btn" data-page="stats" aria-label="Stats">
                    <span class="material-symbols-outlined">bar_chart</span>
                  </button>
                </div>
              </div>
            </div>
            <div class="scroll-body" id="galleryScrollBody">
              <div class="player-grid" id="playerGrid"></div>
            </div>
            <button class="wide-fab" id="addPlayerFab" title="Add player">
              <span class="material-symbols-outlined" style="font-size:26px;">person_add</span>
            </button>
          </div>
        </div>

        <!-- SLOT 1: Collection -->
        <div class="page-slot" id="slot-collection">
          <div class="view" id="collection-view">
            <div class="master-col" style="height:100%;">
              <div class="collapsible-header-wrap" id="collectionHeaderWrap">
                <div class="collapsible-header">
                  <div class="top-bar">
                    <span class="brand">Collection</span>
                    <div class="total-count-pill" id="collectionOwnedCounter">0</div>
                    <button class="top-bar-icon-btn" data-page="stats" aria-label="Stats">
                      <span class="material-symbols-outlined">bar_chart</span>
                    </button>
                  </div>
                  <div class="search-filter-row">
                    <div class="search-wrap">
                      <input type="text" id="collSearchInput" class="search-input-expressive" placeholder="Search year, set...">
                      <button class="search-clear-btn" tabindex="-1" id="collSearchClear">
                        <span class="material-symbols-outlined" style="font-size:18px;">close</span>
                      </button>
                    </div>
                    <div id="chipCollWishlist" class="filter-chip" data-chip="collWishlist">Wishlist</div>
                    <div id="chipCollGraded"   class="filter-chip" data-chip="collGraded">Graded</div>
                  </div>
                  <div class="sort-chips-row">
                    <span class="sort-label">Sort:</span>
                    <div id="sortYear"   class="sort-chip active" data-sort="year">Year</div>
                    <div id="sortSport"  class="sort-chip" data-sort="sport">Sport</div>
                    <div id="sortSet"    class="sort-chip" data-sort="set">Set</div>
                    <div id="sortNumber" class="sort-chip" data-sort="number">Number</div>
                  </div>
                </div>
              </div>
              <div class="scroll-body" id="collectionScrollBody">
                <div id="collectionList"></div>
              </div>
              <div class="fast-scroll-bar" id="collFastScroll"><div class="fast-scroll-thumb"></div></div>
              <button class="wide-fab" id="addCardCollFab" title="Add card">
                <span class="material-symbols-outlined" style="font-size:26px;">add</span>
              </button>
            </div>
            <div id="twoPane-collectionDetail">
              <div class="tp-empty" id="twoPane-coll-empty">
                <svg viewBox="0 0 24 24" width="48" height="48" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zm-7-2c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5z"/></svg>
                <p>Select a card to view details</p>
              </div>
              <div id="twoPane-coll-panel" style="display:none;"></div>
            </div>
          </div>
        </div>

        <!-- SLOT 2: Graded -->
        <div class="page-slot" id="slot-graded">
          <div class="view" id="graded-view">
            <div class="master-col" style="height:100%;">
              <div class="collapsible-header-wrap" id="gradedHeaderWrap">
                <div class="collapsible-header">
                  <div class="top-bar">
                    <span class="brand">Graded</span>
                    <div class="total-count-pill" id="gradedCounter">0</div>
                    <button class="top-bar-icon-btn" data-page="stats" aria-label="Stats">
                      <span class="material-symbols-outlined">bar_chart</span>
                    </button>
                  </div>
                  <div class="search-filter-row">
                    <div class="search-wrap">
                      <input type="text" id="gradedSearchInput" class="search-input-expressive" placeholder="Search player, set...">
                      <button class="search-clear-btn" tabindex="-1" id="gradedSearchClear">
                        <span class="material-symbols-outlined" style="font-size:18px;">close</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <div class="scroll-body" id="gradedScrollBody">
                <div class="graded-grid" id="gradedList"></div>
              </div>
            </div>
            <div id="twoPane-gradedDetail">
              <div class="tp-empty" id="twoPane-grad-empty">
                <svg viewBox="0 0 24 24" width="48" height="48" fill="currentColor"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/></svg>
                <p>Select a card to view details</p>
              </div>
              <div id="twoPane-grad-panel" style="display:none;"></div>
            </div>
          </div>
        </div>

        <!-- SLOT 3: Stats -->
        <div class="page-slot" id="slot-stats">
          <div class="view" id="stats-view">
            <div class="collapsible-header-wrap" id="statsHeaderWrap">
              <div class="collapsible-header">
                <div class="top-bar">
                  <span class="brand">Stats</span>
                </div>
              </div>
            </div>
            <div class="scroll-body" id="statsScrollBody">
              <div id="statsContent"></div>
            </div>
          </div>
        </div>

      </div><!-- /page-track -->

      <!-- Detail view (player cards) -->
      <div class="view" id="detail-view" style="display:none; z-index:50;">
        <div class="master-col">
          <div id="detail-view-empty">
            <svg viewBox="0 0 24 24" width="52" height="52" fill="currentColor"><path d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
            <p>Select a player to browse their cards</p>
          </div>
          <div class="collapsible-header-wrap" id="detailHeaderWrap">
            <div class="collapsible-header">
              <div style="height:160px; position:relative; flex-shrink:0; background:var(--md-surface-1);">
                <img id="playerBanner" style="width:100%; height:100%; object-fit:cover;">
                <div style="position:absolute; inset:0; background:linear-gradient(transparent, var(--md-surface));"></div>
                <button class="back-btn" id="backBtn">
                  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                </button>
                <button class="top-bar-icon-btn" data-page="stats" aria-label="Stats" style="position:absolute; top:calc(env(safe-area-inset-top) + 12px); right:12px; background:rgba(0,0,0,0.28); color:#fff; backdrop-filter:blur(8px); -webkit-backdrop-filter:blur(8px);">
                  <span class="material-symbols-outlined">bar_chart</span>
                </button>
              </div>
              <div style="margin-top:-50px; padding:0 20px; position:relative; display:flex; align-items:flex-end; gap:16px; z-index:15;">
                <img id="playerThumb" style="width:80px; height:110px; border-radius:16px; border:4px solid var(--md-surface); object-fit:cover; background:#eee; box-shadow:0 4px 12px rgba(0,0,0,0.1);">
                <div style="padding-bottom:8px;">
                  <h2 id="playerName" style="font-size:24px; font-family:'Google Sans Display';"></h2>
                  <div id="playerDetailCount" style="font-size:13px; font-weight:700; opacity:0.7;"></div>
                </div>
              </div>
              <div class="search-filter-row">
                <div class="search-wrap">
                  <input type="text" id="cardSearchInput" class="search-input-expressive" placeholder="Search cards...">
                  <button class="search-clear-btn" tabindex="-1" id="cardSearchClear">
                    <span class="material-symbols-outlined" style="font-size:18px;">close</span>
                  </button>
                </div>
                <div id="chipWishlist" class="filter-chip" data-chip="wishlist">Wishlist</div>
                <div id="chipGraded"   class="filter-chip" data-chip="graded">Graded</div>
              </div>
            </div>
          </div>
          <div class="scroll-body" id="detailScrollBody"><div id="cardList"></div></div>
          <div class="fast-scroll-bar" id="detailFastScroll"><div class="fast-scroll-thumb"></div></div>
          <button class="wide-fab" id="addCardDetailFab" title="Add card">
            <span class="material-symbols-outlined" style="font-size:26px;">add</span>
          </button>
        </div>
        <div id="twoPane-cardDetail">
          <div class="tp-empty" id="twoPane-empty">
            <svg viewBox="0 0 24 24" width="48" height="48" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
            <p>Select a card to view details</p>
          </div>
          <div id="twoPane-panel" style="display:none;"></div>
        </div>
      </div>

    </div><!-- /page-container -->
  </div><!-- /right-column -->
</div><!-- /app-shell -->

<!-- MOBILE NAV BAR (3 pages + inline FAB) -->
<nav id="nav-bar">
  <div id="nav-indicator"></div>
  <button class="nav-item active" id="nav-players"    data-page="players">
    <span class="material-symbols-outlined">cards_stack</span>
  </button>
  <button class="nav-item" id="nav-collection" data-page="collection">
    <span class="material-symbols-outlined">inventory_2</span>
  </button>
  <button class="nav-item" id="nav-graded"    data-page="graded">
    <span class="material-symbols-outlined">g_mobiledata_badge</span>
  </button>
  <div id="nav-fab-sep"></div>
  <button id="floating-fab">
    <span class="material-symbols-outlined" style="font-size:24px;">add</span>
  </button>
</nav>

<!-- SCRIM -->
<div class="scrim" id="globalScrim"></div>

<!-- CARD DETAIL SHEETS -->
<div class="sheet" id="cardDetailSheet">
  <div class="sheet-handle"></div>
  <div id="swipeHint">← prev</div>
  <div id="swipeHintRight">next →</div>
  <div id="cardDetailPanel"></div>
</div>
<div class="sheet" id="collectionCardSheet">
  <div class="sheet-handle"></div>
  <div id="swipeHintColl"      class="swipe-hint swipe-hint-left">← prev</div>
  <div id="swipeHintCollRight" class="swipe-hint swipe-hint-right">next →</div>
  <div id="collectionCardPanel"></div>
</div>
<div class="sheet" id="gradedCardSheet">
  <div class="sheet-handle"></div>
  <div id="swipeHintGrad"      class="swipe-hint swipe-hint-left">← prev</div>
  <div id="swipeHintGradRight" class="swipe-hint swipe-hint-right">next →</div>
  <div id="gradedCardPanel"></div>
</div>

<!-- CARD FORM SHEET -->
<div class="sheet" id="cardFormSheet">
  <div class="sheet-handle"></div>
  <div class="sheet-body">
    <h2 id="cardFormTitle" style="margin-bottom:20px; font-family:'Google Sans Display';">Add Card</h2>
    <input type="hidden" id="f_cardId">
    <div style="display:flex; flex-direction:column; gap:16px;">
      <div style="display:flex; gap:12px; align-items:stretch;">
        <div id="imagePreviewContainer" style="width:90px; height:120px; flex-shrink:0; background:#F0F0F0; border-radius:10px; display:flex; align-items:center; justify-content:center; overflow:hidden; border:1px dashed var(--md-outline);">
          <span id="previewPlaceholder" style="font-size:10px; color:var(--md-outline); text-align:center; padding:4px;">No<br>Image</span>
          <img id="f_imagePreview" style="width:100%; height:100%; object-fit:cover; display:none;">
        </div>
        <div style="flex:1; display:flex; flex-direction:column; gap:10px; justify-content:center;">
          <input type="file" id="f_fileInput" accept="image/*" style="display:none;">
          <button class="expressive-btn" id="selectPhotoBtn" style="background:var(--md-surface-1); box-shadow:none; padding:12px; font-size:13px;">📷 Select Photo</button>
          <div class="m3-field" id="f_player_field" style="height:48px;">
            <label class="m3-label">Player</label>
            <select id="f_player" class="m3-select" style="font-size:14px; padding-top:20px;"></select>
          </div>
        </div>
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
        <div class="m3-field"><label class="m3-label">Year</label><input type="text" id="f_year" class="m3-input" placeholder="e.g. 1991-92"></div>
        <div class="m3-field"><label class="m3-label">Number</label><input type="text" id="f_number" class="m3-input" placeholder="e.g. MJ-23"></div>
      </div>
      <div class="m3-field"><label class="m3-label">Set</label><input type="text" id="f_set" class="m3-input"></div>
      <div class="m3-field"><label class="m3-label">Manufacturer</label><input type="text" id="f_manufacturer" class="m3-input"></div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
        <div class="m3-field"><label class="m3-label">Sport</label>
          <select id="f_sport" class="m3-select">
            <option value="">Select...</option>
            <option value="Baseball">Baseball ⚾</option>
            <option value="Basketball">Basketball 🏀</option>
            <option value="Football">Football 🏈</option>
            <option value="Hockey">Hockey 🏒</option>
            <option value="Golf">Golf ⛳</option>
            <option value="Soccer">Soccer ⚽</option>
          </select>
        </div>
        <div class="m3-field"><label class="m3-label">Team</label><select id="f_team" class="m3-select"></select></div>
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
        <div class="m3-field"><label class="m3-label">Grading Co.</label>
          <select id="f_grading" class="m3-select">
            <option value="Raw">Raw</option>
            <option value="PSA">PSA</option>
            <option value="BGS">BGS</option>
            <option value="SGC">SGC</option>
            <option value="CGC">CGC</option>
          </select>
        </div>
        <div class="m3-field"><label class="m3-label">Grade</label><select id="f_grade" class="m3-select"></select></div>
      </div>
      <div class="m3-field"><label class="m3-label">Purchase Price ($)</label><input type="text" id="f_price" class="m3-input"></div>
      <div class="m3-field"><label class="m3-label">Card Information (URL)</label><input type="text" id="f_url" class="m3-input"></div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
        <button type="button" id="f_rc_btn" style="height:56px; border-radius:12px; border:2px solid var(--md-outline); background:transparent; font-family:'Google Sans',sans-serif; font-size:14px; font-weight:700; cursor:pointer; transition:0.2s; display:flex; align-items:center; justify-content:center; gap:8px;">
          <span style="background:#E8192C; color:#fff; font-size:11px; font-weight:800; padding:3px 8px; border-radius:6px;">RC</span>Rookie Card
        </button>
        <button type="button" id="f_auto_btn" style="height:56px; border-radius:12px; border:2px solid var(--md-outline); background:transparent; font-family:'Google Sans',sans-serif; font-size:14px; font-weight:700; cursor:pointer; transition:0.2s; display:flex; align-items:center; justify-content:center; gap:8px;">
          <span style="background:#B8860B; color:#fff; font-size:11px; font-weight:800; padding:3px 8px; border-radius:6px;">AUTO</span>Autograph
        </button>
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
        <button type="button" id="f_mem_btn" style="height:56px; border-radius:12px; border:2px solid var(--md-outline); background:transparent; font-family:'Google Sans',sans-serif; font-size:14px; font-weight:700; cursor:pointer; transition:0.2s; display:flex; align-items:center; justify-content:center; gap:8px;">
          <span style="background:#1565C0; color:#fff; font-size:11px; font-weight:800; padding:3px 8px; border-radius:6px;">MEM</span>Memorabilia
        </button>
        <button type="button" id="f_numbered_btn" style="height:56px; border-radius:12px; border:2px solid var(--md-outline); background:transparent; font-family:'Google Sans',sans-serif; font-size:14px; font-weight:700; cursor:pointer; transition:0.2s; display:flex; align-items:center; justify-content:center; gap:8px;">
          <span style="background:#78909C; color:#fff; font-size:11px; font-weight:800; padding:3px 8px; border-radius:6px;">#'d</span>Numbered
        </button>
      </div>
      <input type="hidden" id="f_rc"       value="false">
      <input type="hidden" id="f_auto"     value="false">
      <input type="hidden" id="f_mem"      value="false">
      <input type="hidden" id="f_numbered" value="false">
      <div style="display:flex; gap:12px; margin-top:4px;">
        <button class="expressive-btn" id="cancelCardFormBtn" style="background:var(--md-surface-2); box-shadow:none; color:var(--md-on-surface); flex:0 0 auto; width:auto; padding:0 24px; height:56px; border-radius:28px;">Cancel</button>
        <button class="expressive-btn" id="btnSaveCard" style="background:var(--md-primary); color:white; flex:1; height:56px; border-radius:28px;">Save Card</button>
      </div>
    </div>
  </div>
</div>

<!-- PLAYER FORM SHEET -->
<div class="sheet" id="playerFormSheet">
  <div class="sheet-handle"></div>
  <div class="sheet-body">
    <h2 style="margin-bottom:20px; font-family:'Google Sans Display';">New Player</h2>
    <div style="display:flex; flex-direction:column; gap:16px;">
      <div class="m3-field"><label class="m3-label">Player Name</label><input type="text" id="pf_name" class="m3-input"></div>
      <div class="m3-field"><label class="m3-label">Default Sport</label>
        <select id="pf_sport" class="m3-select">
          <option value="Baseball">Baseball ⚾</option>
          <option value="Basketball">Basketball 🏀</option>
          <option value="Football">Football 🏈</option>
          <option value="Hockey">Hockey 🏒</option>
          <option value="Golf">Golf ⛳</option>
          <option value="Soccer">Soccer ⚽</option>
        </select>
      </div>
      <div class="m3-field"><label class="m3-label">Main Image URL</label><input type="text" id="pf_mainImg" class="m3-input"></div>
      <div class="m3-field"><label class="m3-label">Banner Image URL</label><input type="text" id="pf_bannerImg" class="m3-input"></div>
      <button class="expressive-btn" id="btnSavePlayer" style="background:var(--md-primary); color:white; margin-top:12px; height:56px; border-radius:28px;">Add Player</button>
    </div>
  </div>
</div>
`
}
