// Hero "현재 지역" text: shows, in priority order, (1) a region the user
// picked manually from the region-select dialog, persisted in
// localStorage, (2) the user's real administrative region via Geolocation
// -> NAVER reverse geocoding when its reported accuracy is within
// ACCURACY_THRESHOLD_METERS, or (3) the static "서울 성동구" fallback.
// Purely a text label -- never touches map.js's map instance, center,
// zoom, or markers. Any failure (no geolocation support, permission
// denied, timeout, geocode miss, low accuracy) just leaves the fallback
// text in #current-region-text untouched; no alerts, no thrown errors.
// Coordinates are used in-memory only for this one lookup and are never
// logged, stored, or sent anywhere -- only the resolved region name is
// ever persisted (for manual picks).
(function () {
  var STORAGE_KEY = 'momentrip-selected-region';

  // Desktop/laptop geolocation (no GPS) can be tens of km off, which would
  // show a wrong region as if it were the user's real location -- worse
  // than the static fallback. Only trust the fix when its reported
  // accuracy radius is within this bound; otherwise keep the fallback.
  var ACCURACY_THRESHOLD_METERS = 5000;

  // Demo list for the manual region picker. Plain names for now; swap for
  // richer objects (code/lat/lng/etc.) if the picker grows beyond a flat
  // list without touching the render/select wiring below.
  var REGION_OPTIONS = [
    '서울 성동구',
    '서울 마포구',
    '서울 강남구',
    '경기 고양시 일산동구',
    '경기 고양시 일산서구',
    '경기 파주시',
    '경기 김포시',
    '경기 의정부시'
  ];

  var regionTextEl = document.getElementById('current-region-text');
  if (!regionTextEl) {
    return;
  }

  var fallbackRegionText = regionTextEl.textContent;

  var triggerEl = document.getElementById('current-region-trigger');
  var backdropEl = document.getElementById('region-select-backdrop');
  var dialogEl = document.getElementById('region-select-dialog');
  var closeEl = document.getElementById('region-select-close');
  var cancelEl = document.getElementById('region-select-cancel');
  var useCurrentEl = document.getElementById('region-use-current');
  var listEl = document.getElementById('region-option-list');

  function readManualRegionName() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      return (parsed && parsed.name) || null;
    } catch (e) {
      return null;
    }
  }

  function saveManualRegionName(name) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ name: name, source: 'manual' }));
    } catch (e) {
      // localStorage unavailable (private mode, quota) -- the in-memory
      // text update below still applies, it just won't survive reload.
    }
  }

  function clearManualRegionName() {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
  }

  function applyDisplayedRegion(name) {
    regionTextEl.textContent = name;
    updateOptionActiveState();
  }

  // NAVER reverse geocoding's admcode area1/area2 already come back as one
  // combined string for cities that have their own gu (area2: "고양시
  // 일산동구", "성남시 분당구", ...), so area1 + area2 alone covers both the
  // plain "시/도 + 시/군/구" case (서울 성동구) and the nested case without
  // any extra branching. Abbreviations are the only formatting applied.
  var SIDO_ABBREVIATIONS = {
    '서울특별시': '서울',
    '부산광역시': '부산',
    '대구광역시': '대구',
    '인천광역시': '인천',
    '광주광역시': '광주',
    '대전광역시': '대전',
    '울산광역시': '울산',
    '세종특별자치시': '세종',
    '경기도': '경기',
    '강원도': '강원',
    '강원특별자치도': '강원',
    '충청북도': '충북',
    '충청남도': '충남',
    '전북특별자치도': '전북',
    '전라북도': '전북',
    '전라남도': '전남',
    '경상북도': '경북',
    '경상남도': '경남',
    '제주특별자치도': '제주'
  };

  function formatRegionName(area1Name, area2Name) {
    if (!area1Name || !area2Name) return null;
    var sido = SIDO_ABBREVIATIONS[area1Name] || area1Name;
    return sido + ' ' + area2Name;
  }

  function handleReverseGeocodeResult(status, response) {
    if (status !== naver.maps.Service.Status.OK) {
      return;
    }

    var hasV2 = !!(response && response.v2);
    var results = hasV2 && response.v2.results;

    var region = results && results[0] && results[0].region;
    if (!region) {
      return;
    }

    var regionName = formatRegionName(
      region.area1 && region.area1.name,
      region.area2 && region.area2.name
    );
    if (!regionName) {
      return;
    }

    applyDisplayedRegion(regionName);
  }

  function handleGeolocationSuccess(position) {
    if (position.coords.accuracy > ACCURACY_THRESHOLD_METERS) {
      return;
    }

    var latlng = new naver.maps.LatLng(
      position.coords.latitude,
      position.coords.longitude
    );

    naver.maps.Service.reverseGeocode(
      { coords: latlng, orders: 'admcode' },
      handleReverseGeocodeResult
    );
  }

  function handleGeolocationError(error) {
    // Denied / unavailable / timeout -- fallback text stays as-is.
  }

  function requestAutoRegion() {
    if (!('geolocation' in navigator)) {
      return;
    }

    if (!window.naver || !naver.maps || !naver.maps.Service) {
      return;
    }

    navigator.geolocation.getCurrentPosition(handleGeolocationSuccess, handleGeolocationError, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0
    });
  }

  // ---- Priority: manual selection > accurate geolocation > fallback ----
  var manualRegionName = readManualRegionName();
  if (manualRegionName) {
    regionTextEl.textContent = manualRegionName;
  } else {
    requestAutoRegion();
  }

  // ---- Manual region-select dialog ----
  var dialogReady = triggerEl && backdropEl && dialogEl && closeEl && cancelEl && useCurrentEl && listEl;
  if (!dialogReady) {
    return;
  }

  function updateOptionActiveState() {
    var current = regionTextEl.textContent;
    var options = listEl.querySelectorAll('.region-option');
    for (var i = 0; i < options.length; i++) {
      var isActive = options[i].textContent === current;
      options[i].classList.toggle('is-active', isActive);
      options[i].setAttribute('aria-current', isActive ? 'true' : 'false');
    }
  }

  function renderOptionList() {
    listEl.innerHTML = '';
    REGION_OPTIONS.forEach(function (name) {
      var item = document.createElement('li');
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'region-option';
      button.textContent = name;
      button.addEventListener('click', function () {
        saveManualRegionName(name);
        applyDisplayedRegion(name);
        closeDialog();
      });
      item.appendChild(button);
      listEl.appendChild(item);
    });
    updateOptionActiveState();
  }

  function handleDialogKeydown(event) {
    if (event.key === 'Escape') {
      closeDialog();
    }
  }

  function openDialog() {
    backdropEl.hidden = false;
    dialogEl.hidden = false;
    triggerEl.setAttribute('aria-expanded', 'true');
    updateOptionActiveState();
    document.addEventListener('keydown', handleDialogKeydown);
    useCurrentEl.focus();
  }

  function closeDialog() {
    backdropEl.hidden = true;
    dialogEl.hidden = true;
    triggerEl.setAttribute('aria-expanded', 'false');
    document.removeEventListener('keydown', handleDialogKeydown);
    triggerEl.focus();
  }

  renderOptionList();

  triggerEl.addEventListener('click', openDialog);
  closeEl.addEventListener('click', closeDialog);
  cancelEl.addEventListener('click', closeDialog);
  backdropEl.addEventListener('click', closeDialog);

  useCurrentEl.addEventListener('click', function () {
    clearManualRegionName();
    applyDisplayedRegion(fallbackRegionText);
    closeDialog();
    requestAutoRegion();
  });
})();

// Mobile Header hamburger menu: Off-canvas Navigation Drawer. Reuses the
// existing Desktop <nav class="gnb"> as-is (same 4 links, no duplicated
// nav markup) -- CSS (Mobile breakpoint) turns that same <nav> into the
// slide-in drawer panel itself. The drawer's own "chrome" (logo/close-button
// head row + the backdrop) isn't hand-authored in every HTML file; this one
// script builds it once at runtime and is loaded identically on index.html
// and every board-*.html page, so all pages get the same Drawer from the
// same code path instead of five copies of the same markup.
(function () {
  var toggleEl = document.querySelector('.gnb-toggle');
  var gnbEl = document.querySelector('.gnb');
  if (!toggleEl || !gnbEl) return;

  var iconEl = toggleEl.querySelector('i');

  gnbEl.setAttribute('aria-label', '모바일 메뉴');

  var drawerHead = document.createElement('div');
  drawerHead.className = 'gnb-drawer-head';
  drawerHead.innerHTML =
    '<span class="gnb-drawer-title">MOMENTRIP</span>' +
    '<button type="button" class="gnb-drawer-close" aria-label="메뉴 닫기">' +
    '<i class="fa-solid fa-xmark" aria-hidden="true"></i></button>';
  gnbEl.insertBefore(drawerHead, gnbEl.firstChild);
  var closeBtn = drawerHead.querySelector('.gnb-drawer-close');

  var backdropEl = document.createElement('div');
  backdropEl.className = 'gnb-drawer-backdrop';
  backdropEl.hidden = true;
  document.body.appendChild(backdropEl);

  // Backdrop opacity 전환(0.2s, CSS의 var(--transition))이 실제로 재생되도록
  // hidden 해제와 is-visible 부여 사이에 한 프레임을 둔다 -- 동시에 주면
  // 브라우저가 두 스타일 변경을 한 번에 합쳐 transition 없이 바로 나타난다.
  var BACKDROP_TRANSITION_MS = 200;
  var hideBackdropTimer = null;

  function isOpen() {
    return gnbEl.classList.contains('is-mobile-open');
  }

  function handleMenuKeydown(event) {
    if (event.key === 'Escape') {
      closeMenu();
    }
  }

  function lockScroll() {
    document.documentElement.classList.add('gnb-scroll-lock');
    document.body.classList.add('gnb-scroll-lock');
  }

  function unlockScroll() {
    document.documentElement.classList.remove('gnb-scroll-lock');
    document.body.classList.remove('gnb-scroll-lock');
  }

  function openMenu() {
    if (hideBackdropTimer) {
      clearTimeout(hideBackdropTimer);
      hideBackdropTimer = null;
    }
    gnbEl.classList.add('is-mobile-open');
    backdropEl.hidden = false;
    requestAnimationFrame(function () {
      backdropEl.classList.add('is-visible');
    });
    toggleEl.setAttribute('aria-expanded', 'true');
    toggleEl.setAttribute('aria-label', '메뉴 닫기');
    if (iconEl) {
      iconEl.classList.remove('fa-bars');
      iconEl.classList.add('fa-xmark');
    }
    lockScroll();
    document.addEventListener('keydown', handleMenuKeydown);
  }

  function closeMenu() {
    if (!isOpen()) return;
    gnbEl.classList.remove('is-mobile-open');
    backdropEl.classList.remove('is-visible');
    hideBackdropTimer = setTimeout(function () {
      backdropEl.hidden = true;
      hideBackdropTimer = null;
    }, BACKDROP_TRANSITION_MS);
    toggleEl.setAttribute('aria-expanded', 'false');
    toggleEl.setAttribute('aria-label', '메뉴 열기');
    if (iconEl) {
      iconEl.classList.remove('fa-xmark');
      iconEl.classList.add('fa-bars');
    }
    unlockScroll();
    document.removeEventListener('keydown', handleMenuKeydown);
    toggleEl.focus();
  }

  toggleEl.addEventListener('click', function () {
    if (isOpen()) {
      closeMenu();
    } else {
      openMenu();
    }
  });

  closeBtn.addEventListener('click', closeMenu);
  backdropEl.addEventListener('click', closeMenu);

  // 메뉴 항목 클릭 시 닫기 -- 실제 이동은 각 링크의 기본 동작(page nav)에
  // 맡기고, 여기서는 열림 상태/아이콘만 정리한다.
  gnbEl.querySelectorAll('a').forEach(function (link) {
    link.addEventListener('click', closeMenu);
  });

  // Desktop breakpoint로 되돌아가면 Drawer/backdrop/scroll-lock이 남아있지
  // 않도록 정리한다. .gnb-toggle 자체가 Desktop에서 display:none이라 실제로
  // 안 보이지만, 다시 Mobile로 좁아졌을 때 이전 상태가 남아있지 않게 확실히
  // 리셋해 둔다. matchMedia change를 기본으로 쓰되, 디바운스된 resize도
  // 함께 둔다(카드 캐러셀의 기존 resize 패턴과 동일) -- 두 리스너 모두
  // closeMenu()만 호출하고 closeMenu는 이미 열려있지 않으면 즉시 반환하므로
  // 중복 호출되어도 안전하며, 다른 resize 리스너와 충돌하지 않는다.
  var desktopMql = window.matchMedia('(min-width: 768px)');
  function handleBreakpointChange(event) {
    if (event.matches) closeMenu();
  }
  if (desktopMql.addEventListener) {
    desktopMql.addEventListener('change', handleBreakpointChange);
  } else if (desktopMql.addListener) {
    desktopMql.addListener(handleBreakpointChange);
  }

  var resizeCloseTimer = null;
  window.addEventListener('resize', function () {
    if (resizeCloseTimer) clearTimeout(resizeCloseTimer);
    resizeCloseTimer = setTimeout(function () {
      if (window.innerWidth >= 768) closeMenu();
    }, 150);
  });
})();

// Populated later by initCardCarousel() for .moment-pick-section/.hot-section/
// .popular-section/.event-section -- { section, refresh } pairs the filter below calls into
// after changing which cards are hidden. Declared up here (shared top-level
// scope, no ES modules in this project) so the filter IIFE can close over
// it despite running before the carousels are actually initialized further
// down the file; by the time a user can click anything, both have finished
// running once at page load.
var carouselControllers = [];

// Hero search + Quick Chip content filter: keyword (search) and Chip act as
// one combined filter over the 4 content sections that have real listable
// items (MOMENTRIP PICK / 이번 주 HOT / 주변 인기 장소 / 지역 행사). 카테고리
// 탐색/커뮤니티 and the Hero map's own "오늘 인기 Spot" list are intentionally
// out of scope. Cards are never removed or rebuilt -- only their `hidden`
// attribute is toggled, so favorite state/listeners and each carousel's
// live DOM stay untouched.
(function () {
  var heroSearchForm = document.querySelector('.hero-bottom .search-box');
  if (!heroSearchForm) return;

  var searchInput = heroSearchForm.querySelector('.input-text');
  if (!searchInput) return;

  var statusEl = document.getElementById('search-result-status');
  var statusTextEl = document.getElementById('search-result-status-text');
  var resetBtn = document.getElementById('search-result-reset');

  var FILTER_TARGETS = [
    { section: document.querySelector('.moment-pick-section'), itemSelector: '.course-card' },
    { section: document.querySelector('.hot-section'), itemSelector: '.card.overlay-card' },
    { section: document.querySelector('.popular-section'), itemSelector: '.card.overlay-card' },
    { section: document.querySelector('.event-section'), itemSelector: '.event-timeline-item' }
  ];

  var originalPlaceholder = searchInput.placeholder;
  var restorePlaceholderTimer = null;

  function promptEmptyKeyword() {
    if (document.activeElement !== searchInput) {
      searchInput.focus();
    }

    searchInput.placeholder = '검색어를 입력해주세요';

    if (restorePlaceholderTimer) {
      clearTimeout(restorePlaceholderTimer);
    }
    restorePlaceholderTimer = setTimeout(function () {
      searchInput.placeholder = originalPlaceholder;
      restorePlaceholderTimer = null;
    }, 1800);
  }

  // trim + collapse internal whitespace + lowercase. No stemming/typo
  // correction/초성 검색 -- current content is a couple dozen static Korean
  // cards, plain substring matching already covers every real case.
  function normalize(text) {
    return text.trim().replace(/\s+/g, ' ').toLowerCase();
  }

  function itemMatchesTag(item, tag) {
    var tags = (item.dataset.tags || '').split(/\s+/).filter(Boolean);
    return tags.indexOf(tag) !== -1;
  }

  function refreshCarouselFor(section) {
    for (var i = 0; i < carouselControllers.length; i++) {
      if (carouselControllers[i].section === section) {
        carouselControllers[i].refresh();
        return;
      }
    }
  }

  function updateStatus(hasFilter, resultCount) {
    if (!statusEl || !statusTextEl) return;

    if (!hasFilter) {
      statusEl.hidden = true;
      return;
    }

    statusTextEl.textContent = resultCount > 0
      ? '총 ' + resultCount + '개의 결과를 찾았습니다.'
      : '조건에 맞는 결과가 없습니다.';
    statusEl.hidden = false;
  }

  function applyFilters() {
    var keyword = normalize(searchInput.value);
    var activeChip = document.querySelector('.hero-quick-category .chip.is-active');
    var tag = activeChip ? activeChip.textContent.trim() : null;
    var hasFilter = !!keyword || !!tag;
    var totalVisible = 0;

    FILTER_TARGETS.forEach(function (target) {
      if (!target.section) return;

      var items = target.section.querySelectorAll(target.itemSelector);
      var visibleCount = 0;

      items.forEach(function (item) {
        var matchesKeyword = !keyword || normalize(item.textContent).indexOf(keyword) !== -1;
        var matchesTag = !tag || itemMatchesTag(item, tag);
        var visible = matchesKeyword && matchesTag;
        item.hidden = !visible;
        if (visible) visibleCount += 1;
      });

      target.section.hidden = hasFilter && visibleCount === 0;
      totalVisible += visibleCount;
      refreshCarouselFor(target.section);
    });

    updateStatus(hasFilter, totalVisible);
  }

  function resetFilters() {
    searchInput.value = '';
    document.querySelectorAll('.hero-quick-category .chip.is-active').forEach(function (chip) {
      chip.classList.remove('is-active');
      chip.setAttribute('aria-pressed', 'false');
    });
    applyFilters();
  }

  function handleHeroSearch() {
    var keyword = normalize(searchInput.value);
    var activeChip = document.querySelector('.hero-quick-category .chip.is-active');

    if (!keyword && !activeChip) {
      promptEmptyKeyword();
      return;
    }

    applyFilters();
  }

  heroSearchForm.addEventListener('submit', function (event) {
    event.preventDefault();
    handleHeroSearch();
  });

  // Not live/real-time search -- only reacts to the input being cleared
  // back to empty, to restore whatever the active Chip (or nothing) implies.
  // Actual search execution stays Submit-driven (form submit above).
  searchInput.addEventListener('input', function () {
    if (searchInput.value.trim() !== '') return;
    applyFilters();
  });

  if (resetBtn) {
    resetBtn.addEventListener('click', resetFilters);
  }

  // Quick category chips: single-select, click active chip again to clear.
  // Re-applies the filter immediately on every click -- search input itself
  // is left untouched, so keyword + Chip combine as described in applyFilters().
  document.querySelectorAll('.hero-quick-category .chip').forEach(function (chip) {
    chip.addEventListener('click', function () {
      var wasActive = chip.classList.contains('is-active');

      document.querySelectorAll('.hero-quick-category .chip.is-active').forEach(function (activeChip) {
        activeChip.classList.remove('is-active');
        activeChip.setAttribute('aria-pressed', 'false');
      });

      if (!wasActive) {
        chip.classList.add('is-active');
        chip.setAttribute('aria-pressed', 'true');
      }

      applyFilters();
    });
  });
})();

// Mobile #search-result-status placement: Desktop's DOM position (sibling
// right after .hero-section, before MOMENTRIP PICK) stays untouched -- this
// only relocates the SAME node (never duplicated/no second id) to right
// after .hero-quick-category, inside .hero-bottom, while the Mobile
// breakpoint is active, so filter feedback shows in the same viewport as the
// Chip row instead of scrolled below the MAP/Spot card. Reparenting via
// insertBefore/appendChild preserves the element's attributes and the
// search-filter IIFE's existing id-based references above, so
// hidden/aria-live/updateStatus() keep working unchanged regardless of
// which parent currently holds it.
(function () {
  var statusEl = document.getElementById('search-result-status');
  var heroQuickCategory = document.querySelector('.hero-quick-category');
  if (!statusEl || !heroQuickCategory || !heroQuickCategory.parentNode) return;

  var desktopParent = statusEl.parentNode;
  var desktopNextSibling = statusEl.nextSibling;
  var heroBottom = heroQuickCategory.parentNode;

  function placeForMobile() {
    if (statusEl.parentNode !== heroBottom) {
      heroBottom.insertBefore(statusEl, heroQuickCategory.nextSibling);
    }
  }

  function placeForDesktop() {
    if (statusEl.parentNode !== desktopParent) {
      desktopParent.insertBefore(statusEl, desktopNextSibling);
    }
  }

  var mobileMql = window.matchMedia('(max-width: 767px)');

  function applyLayout(isMobile) {
    if (isMobile) {
      placeForMobile();
    } else {
      placeForDesktop();
    }
  }

  applyLayout(mobileMql.matches);

  function handleChange(event) {
    applyLayout(event.matches);
  }

  if (mobileMql.addEventListener) {
    mobileMql.addEventListener('change', handleChange);
  } else if (mobileMql.addListener) {
    mobileMql.addListener(handleChange);
  }
})();

// Favorite (찜) toggle: persists which cards are favorited across reloads.
// A card's identity is its own data-favorite-id (on the .card article, not
// the button) -- content-based, not section-based, so the same place/class
// keeps one shared favorite state even if it's ever shown in more than one
// section. Only the id list is stored; everything else (title/image/badge)
// already lives in the DOM, so there's nothing else worth persisting.
(function () {
  var STORAGE_KEY = 'momentrip-favorites';

  function readFavorites() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function saveFavorites(favorites) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
    } catch (e) {
      // localStorage unavailable (private mode, quota) -- the UI toggle
      // above still applies for this session, it just won't survive reload.
    }
  }

  function updateFavoriteButton(button, isActive) {
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    button.setAttribute('aria-label', isActive ? '찜 해제' : '찜하기');
  }

  function getFavoriteId(button) {
    var card = button.closest('[data-favorite-id]');
    return card ? card.getAttribute('data-favorite-id') : null;
  }

  var initialFavorites = readFavorites();

  document.querySelectorAll('.favorite-toggle').forEach(function (button) {
    var id = getFavoriteId(button);
    updateFavoriteButton(button, !!id && initialFavorites.indexOf(id) !== -1);

    button.addEventListener('click', function (event) {
      event.stopPropagation();

      var isActive = !button.classList.contains('is-active');
      var currentId = getFavoriteId(button);

      if (!currentId) {
        updateFavoriteButton(button, isActive);
        return;
      }

      var favorites = readFavorites();
      var index = favorites.indexOf(currentId);
      if (isActive && index === -1) {
        favorites.push(currentId);
      } else if (!isActive && index !== -1) {
        favorites.splice(index, 1);
      }
      saveFavorites(favorites);

      // Same content can appear as more than one card (e.g. featured in both
      // HOT and 지역 행사) -- keep every button sharing this id in sync, not
      // just the one that was clicked.
      document.querySelectorAll('[data-favorite-id="' + currentId + '"] .favorite-toggle').forEach(function (sibling) {
        updateFavoriteButton(sibling, isActive);
      });
    });
  });
})();

// Hero title typing effect: types/deletes the existing 2-line title
// ("오늘은 어떤 하루를" / "보내고 싶나요?") one character at a time, reusing
// the line break already present in index.html's <h1> markup instead of
// hardcoding the copy here.
(function () {
  var titleEl = document.querySelector('.hero-content h1');
  if (!titleEl) return;

  var prefersReducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches;
  if (prefersReducedMotion) return;

  var lines = titleEl.innerHTML.split('<br>').map(function (line) {
    var parser = document.createElement('div');
    parser.innerHTML = line;
    return parser.textContent.trim();
  });
  if (lines.length !== 2 || !lines[0] || !lines[1]) return;

  var fullTextForA11y = lines[0] + ' ' + lines[1];
  var totalLength = lines[0].length + lines[1].length;

  var TYPE_DELAY = 140; // ms per character while typing (80~110ms range)
  var DELETE_DELAY = 60; // ms per character while deleting (50~70ms range)
  var HOLD_AFTER_TYPE = 2000; // ms pause once the full title is shown
  var HOLD_AFTER_DELETE = 500; // ms pause once fully deleted, before retyping

  titleEl.textContent = '';
  titleEl.setAttribute('aria-label', fullTextForA11y);

  var typingWrap = document.createElement('span');
  typingWrap.setAttribute('aria-hidden', 'true');

  var line1El = document.createElement('span');
  var line2El = document.createElement('span');
  var caretEl = document.createElement('span');
  caretEl.className = 'hero-typing-caret';

  typingWrap.appendChild(line1El);
  typingWrap.appendChild(document.createElement('br'));
  typingWrap.appendChild(line2El);
  titleEl.appendChild(typingWrap);

  function render(charCount) {
    if (charCount <= lines[0].length) {
      line1El.textContent = lines[0].slice(0, charCount);
      line2El.textContent = '';
      line1El.appendChild(caretEl);
    } else {
      line1El.textContent = lines[0];
      line2El.textContent = lines[1].slice(0, charCount - lines[0].length);
      line2El.appendChild(caretEl);
    }
  }

  var phase = 'typing';
  var count = 0;

  function step() {
    if (phase === 'typing') {
      count += 1;
      render(count);
      if (count >= totalLength) {
        phase = 'holdFull';
        setTimeout(step, HOLD_AFTER_TYPE);
      } else {
        setTimeout(step, TYPE_DELAY);
      }
    } else if (phase === 'holdFull') {
      phase = 'deleting';
      setTimeout(step, DELETE_DELAY);
    } else if (phase === 'deleting') {
      count -= 1;
      render(count);
      if (count <= 0) {
        phase = 'holdEmpty';
        setTimeout(step, HOLD_AFTER_DELETE);
      } else {
        setTimeout(step, DELETE_DELAY);
      }
    } else if (phase === 'holdEmpty') {
      phase = 'typing';
      setTimeout(step, TYPE_DELAY);
    }
  }

  render(0);
  setTimeout(step, TYPE_DELAY);
})();

// Card carousel controller: prev/next buttons only -- native touch scroll
// and CSS scroll-snap (see wireframe.css Mobile breakpoint) still own the
// swipe gesture itself. Shared by every .page-section that has a track +
// .card-carousel-controls pair (HOT, 주변 인기 장소, 지역 행사, ...); each
// call is scoped to its own section root so sections never see each
// other's track. trackSelector defaults to '.card-grid' (HOT/popular);
// pass '.event-timeline' for 지역 행사, whose items are .event-timeline-item
// rather than .card -- everything past this line reads the track's own
// children generically, so no other branching is needed per section type.
function initCardCarousel(section, trackSelector) {
  var track = section.querySelector(trackSelector || '.card-grid');
  if (!track) return;

  var prevBtn = section.querySelector('.card-carousel-arrow[data-direction="prev"]');
  var nextBtn = section.querySelector('.card-carousel-arrow[data-direction="next"]');
  if (!prevBtn || !nextBtn) return;

  var SCROLL_TOLERANCE = 4; // px slack for snap/rounding drift

  // The Hero search/Chip filter can hide/show cards after this runs (see
  // the filter IIFE above), so every card-list lookup re-derives "currently
  // visible" from the live DOM instead of caching a fixed array at init.
  function getVisibleCards() {
    return Array.prototype.slice.call(track.children).filter(function (card) {
      return !card.hidden;
    });
  }

  // Position of a card's left edge in the track's own scroll coordinates,
  // derived from live layout (getBoundingClientRect) rather than offsetLeft --
  // works regardless of .card-grid's positioning context and stays correct
  // as card width changes across breakpoints.
  function cardScrollLeft(card) {
    return track.scrollLeft + (card.getBoundingClientRect().left - track.getBoundingClientRect().left);
  }

  function currentCardIndex(cards) {
    var closestIndex = 0;
    var closestDistance = Infinity;
    cards.forEach(function (card, index) {
      var distance = Math.abs(cardScrollLeft(card) - track.scrollLeft);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    });
    return closestIndex;
  }

  function scrollToCard(cards, index) {
    var target = cards[index];
    if (!target) return;
    track.scrollTo({ left: cardScrollLeft(target), behavior: 'smooth' });
  }

  function updateButtonState() {
    var maxScrollLeft = track.scrollWidth - track.clientWidth;
    var hasVisibleCards = getVisibleCards().length > 0;
    prevBtn.disabled = !hasVisibleCards || track.scrollLeft <= SCROLL_TOLERANCE;
    nextBtn.disabled = !hasVisibleCards || track.scrollLeft >= maxScrollLeft - SCROLL_TOLERANCE;
  }

  prevBtn.addEventListener('click', function () {
    var cards = getVisibleCards();
    if (!cards.length) return;
    scrollToCard(cards, Math.max(0, currentCardIndex(cards) - 1));
  });

  nextBtn.addEventListener('click', function () {
    var cards = getVisibleCards();
    if (!cards.length) return;
    scrollToCard(cards, Math.min(cards.length - 1, currentCardIndex(cards) + 1));
  });

  // Keep disabled state in sync with finger/trackpad-driven scrolling too.
  // rAF coalesces this to at most once per frame during a scroll gesture.
  var scrollTicking = false;
  track.addEventListener('scroll', function () {
    if (scrollTicking) return;
    scrollTicking = true;
    requestAnimationFrame(function () {
      updateButtonState();
      scrollTicking = false;
    });
  });

  // Debounced resize (same pattern as js/map.js's handleMapResize): recompute
  // once layout settles, whether that's a breakpoint change or just a window
  // drag. maxScrollLeft is 0 outside Mobile, so both buttons naturally end up
  // disabled there without any extra breakpoint branching.
  var resizeTimer = null;
  window.addEventListener('resize', function () {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(updateButtonState, 250);
  });

  updateButtonState();

  // Called by the Hero search/Chip filter after it changes which cards in
  // this section are hidden -- resets scroll position (previous position
  // may no longer make sense with a different set of visible cards) and
  // recomputes prev/next disabled state.
  function refresh() {
    track.scrollLeft = 0;
    updateButtonState();
  }

  return { refresh: refresh };
}

// MOMENTRIP PICK's track is .course-grid/.course-card, not the default
// .card-grid/.card -- same reason this needs its own call (not the
// .hot-section/.popular-section forEach below) as 지역 행사's .event-timeline.
var momentPickSection = document.querySelector('.moment-pick-section');
if (momentPickSection) {
  var momentPickCarouselController = initCardCarousel(momentPickSection, '.course-grid');
  if (momentPickCarouselController) {
    carouselControllers.push({ section: momentPickSection, refresh: momentPickCarouselController.refresh });
  }
}

// Array.prototype.forEach calls its callback with (item, index, array) --
// initCardCarousel's new trackSelector parameter would otherwise receive
// that index (1 for the second matched section), so this wraps the call
// down to the single argument each of these sections actually needs.
document.querySelectorAll('.hot-section, .popular-section').forEach(function (section) {
  var controller = initCardCarousel(section);
  if (controller) carouselControllers.push({ section: section, refresh: controller.refresh });
});

var eventSection = document.querySelector('.event-section');
if (eventSection) {
  var eventCarouselController = initCardCarousel(eventSection, '.event-timeline');
  if (eventCarouselController) {
    carouselControllers.push({ section: eventSection, refresh: eventCarouselController.refresh });
  }
}
