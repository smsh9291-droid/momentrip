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

  // Word-boundary substring match instead of splitting on every space: some
  // Quick Category tags are themselves two words (e.g. "아이와 함께"), so
  // splitting data-tags on \s+ into single-word tokens would break those
  // tags apart and never match them. Padding both sides with a space keeps
  // single-word tags (e.g. "산책") matching exactly as before.
  function itemMatchesTag(item, tag) {
    var tags = ' ' + (item.dataset.tags || '').trim() + ' ';
    return tags.indexOf(' ' + tag + ' ') !== -1;
  }

  function refreshCarouselFor(section) {
    for (var i = 0; i < carouselControllers.length; i++) {
      if (carouselControllers[i].section === section) {
        carouselControllers[i].refresh();
        return;
      }
    }
  }

  // tag/keywordDisplay는 표시 전용 -- 매칭 계산(위 FILTER_TARGETS 루프)에는
  // 전혀 관여하지 않는다. "카페 · 총 3개의 결과를 찾았습니다."처럼 지금
  // 적용된 필터가 무엇 때문인지 결과 문구 자체에 보강해, chip 클릭 → 바로
  // 아래 결과 배너라는 기존 인접 배치를 텍스트로도 한 번 더 확인시켜준다.
  function updateStatus(hasFilter, resultCount, tag, keywordDisplay) {
    if (!statusEl || !statusTextEl) return;

    if (!hasFilter) {
      statusEl.hidden = true;
      return;
    }

    var labelParts = [];
    if (tag) labelParts.push(tag);
    if (keywordDisplay) labelParts.push('"' + keywordDisplay + '"');
    var prefix = labelParts.length ? labelParts.join(' · ') + ' · ' : '';

    statusTextEl.textContent = prefix + (resultCount > 0
      ? '총 ' + resultCount + '개의 결과를 찾았습니다.'
      : '조건에 맞는 결과가 없습니다.');
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

    updateStatus(hasFilter, totalVisible, tag, searchInput.value.trim());
  }

  function resetFilters() {
    searchInput.value = '';
    document.querySelectorAll('.hero-quick-category .chip.is-active').forEach(function (chip) {
      chip.classList.remove('is-active');
      chip.setAttribute('aria-pressed', 'false');
    });
    applyFilters();
  }

  // "전체보기"는 필터를 푸는 버튼이 아니라, 지금 선택된 카테고리/검색어를
  // 그대로 둔 채 그 결과가 시작되는 위치까지만 데려다주는 버튼이다 --
  // resetFilters()를 호출하지 않으므로 active chip/aria-pressed/검색어/필터
  // 결과는 전혀 건드리지 않는다. FILTER_TARGETS를 순서대로(MOMENTRIP PICK →
  // HOT → 주변 인기 장소 → 지역 행사) 훑어 hidden이 아닌(= applyFilters()가
  // 이 카테고리/검색어에 실제로 매치되는 카드를 남겨 둔) 첫 section으로
  // scrollIntoView한다 -- 무조건 첫 번째 대상(MOMENTRIP PICK)으로 이동하면,
  // 그 섹션 자체가 현재 필터에 맞는 카드가 하나도 없어 통째로
  // hidden(applyFilters()의 target.section.hidden = hasFilter &&
  // visibleCount === 0)인 경우 보이지도 않는 곳으로 스크롤을 시도하게 된다.
  // 새 anchor/id 없이 이미 있는 DOM 참조를 재사용. .site-header가
  // sticky/fixed가 아니라(box-shadow만 쓰는 정적 배치) block:'start'만으로
  // Header에 가려지지 않는다.
  function scrollToFilterResults() {
    for (var i = 0; i < FILTER_TARGETS.length; i++) {
      var section = FILTER_TARGETS[i].section;
      if (section && !section.hidden) {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
    }
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
    resetBtn.addEventListener('click', scrollToFilterResults);
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

// #search-result-status placement: Desktop's original DOM position (its own
// section right after .hero-section, before MOMENTRIP PICK) put filter
// feedback far below the Quick Category chips. It's now relocated once, on
// load, to right after .hero-quick-category inside .hero-bottom for every
// breakpoint -- Desktop/Tablet/Mobile each then position it purely via the
// .hero-bottom > #search-result-status `order` CSS rule (see
// wireframe.css), so no per-breakpoint reparenting is needed any more.
// Reparenting via insertBefore preserves the element's attributes and the
// search-filter IIFE's existing id-based references above, so
// hidden/aria-live/updateStatus() keep working unchanged.
(function () {
  var statusEl = document.getElementById('search-result-status');
  var heroQuickCategory = document.querySelector('.hero-quick-category');
  if (!statusEl || !heroQuickCategory || !heroQuickCategory.parentNode) return;

  heroQuickCategory.parentNode.insertBefore(statusEl, heroQuickCategory.nextSibling);
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

// HOT / 주변 인기 장소 card-wide selection hit area: .favorite-toggle is each
// card's only selection control, but it's a small icon button in the corner.
// Expand the click target to the whole card -- any click that doesn't land
// on an existing interactive element (the toggle itself, or any future
// a/button/input/select/textarea) re-dispatches a real click to the toggle
// button, so the listener above (with its own stopPropagation) stays the
// single source of truth for the toggle/state logic. No double-toggle: a
// direct click on the button is caught by closest() below and skipped here.
document.querySelectorAll('.overlay-card').forEach(function (card) {
  card.addEventListener('click', function (event) {
    if (event.target.closest('a, button, input, select, textarea')) return;

    var toggle = card.querySelector('.favorite-toggle');
    if (toggle) toggle.click();
  });
});

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

// Main "커뮤니티" preview <-> board data: reads the exact same localStorage
// key js/board.js uses (momentrip-board-posts) -- no separate main-page
// storage/copy. board.js itself isn't loaded on index.html (see its own
// file-separation comment), so this only re-implements the couple of lines
// it actually needs (read + the same "newest first" sort + the same
// "YYYY.MM.DD" date format), not the CRUD/category-tab logic that lives
// there. Runs on every page (main.js is shared), but .board-preview-table
// only exists on index.html, so this is a no-op everywhere else.
(function () {
  var STORAGE_KEY = 'momentrip-board-posts';

  var table = document.querySelector('.community-section .board-preview-table');
  if (!table) return;

  function readPosts() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  // Same "YYYY.MM.DD" format as js/board.js's formatDate and the existing
  // static sample rows.
  function formatDate(isoString) {
    var date = new Date(isoString);
    if (isNaN(date.getTime())) return '';
    var y = date.getFullYear();
    var m = String(date.getMonth() + 1).padStart(2, '0');
    var d = String(date.getDate()).padStart(2, '0');
    return y + '.' + m + '.' + d;
  }

  var posts = readPosts().slice().sort(function (a, b) {
    return new Date(b.createdAt) - new Date(a.createdAt);
  });
  if (!posts.length) return;

  // Preview row count comes from however many static sample rows the design
  // already has (currently 4) -- never hardcoded separately, so it can't
  // drift from the actual markup.
  var staticRows = table.querySelectorAll('.board-row:not(.head)');
  var previewCount = staticRows.length;

  posts.slice(0, previewCount).forEach(function (post, index) {
    var row = document.createElement('a');
    row.className = 'board-row';
    row.href = 'board-view.html?id=' + encodeURIComponent(post.id);

    var category = document.createElement('span');
    category.className = 'col-category';
    category.textContent = post.category || '';

    var title = document.createElement('span');
    title.className = 'col-title';
    title.textContent = post.title || '';

    var author = document.createElement('span');
    author.className = 'col-author';
    author.textContent = post.author || '';

    var date = document.createElement('span');
    date.className = 'col-date';
    date.textContent = formatDate(post.createdAt);

    row.appendChild(category);
    row.appendChild(title);
    row.appendChild(author);
    row.appendChild(date);

    // Replace the static sample row in the same slot with the real post
    // (newest CRUD posts fill from the top) -- any static rows left over
    // when there are fewer real posts than previewCount stay untouched, so
    // the total row count never changes and nothing is ever duplicated.
    var target = staticRows[index];
    if (target) {
      table.insertBefore(row, target);
      target.remove();
    } else {
      table.appendChild(row);
    }
  });
})();

// Header 검색(.util-search) 버튼: 모든 페이지(index.html + board-*.html)에서
// 동일하게 Header 바로 아래 #header-search-panel을 그 자리에서 열고 닫는다.
// 예전에는 Desktop/Tablet에서 Hero 검색 input으로 focus 이동만 시도하고,
// Hero가 없는 board-*.html에서는 이동할 곳이 없어 index.html로 강제 이동하는
// 문제가 있었다(Mobile도 동일 fallback을 타서 마찬가지였다) -- #header-search-panel
// 자체는 이제 모든 페이지 Header 마크업에 공통으로 존재하므로 그 fallback을
// 완전히 제거했다. main.js는 모든 페이지에 로드되므로 이 IIFE 하나로 전부
// 처리된다 -- 별도 검색 페이지/router 없음.
(function () {
  var panel = document.getElementById('header-search-panel');
  var form = document.getElementById('header-search-form');
  var input = document.getElementById('header-search-input');
  var closeBtn = document.querySelector('.header-search-close');
  var searchButtons = document.querySelectorAll('.util-search');
  if (!panel || !form || !input || !searchButtons.length) return;

  function isOpen() {
    return !panel.hidden;
  }

  function setButtonsExpanded(expanded) {
    searchButtons.forEach(function (button) {
      button.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    });
  }

  function openPanel() {
    panel.hidden = false;
    setButtonsExpanded(true);
    input.focus();
  }

  function closePanel() {
    panel.hidden = true;
    setButtonsExpanded(false);
  }

  function togglePanel() {
    if (isOpen()) {
      closePanel();
    } else {
      openPanel();
    }
  }

  searchButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      // Mobile Drawer가 열려 있었다면 검색 패널을 여는 김에 자연스럽게
      // 닫는다 -- Drawer 자체 코드는 건드리지 않고 기존 .gnb-toggle 클릭을
      // 그대로 재사용(같은 열림/닫힘 로직을 새로 만들지 않음).
      var gnbToggle = document.querySelector('.gnb-toggle');
      if (gnbToggle && gnbToggle.getAttribute('aria-expanded') === 'true') {
        gnbToggle.click();
      }
      togglePanel();
    });
  });

  if (closeBtn) {
    closeBtn.addEventListener('click', closePanel);
  }

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && isOpen()) {
      closePanel();
    }
  });

  function normalize(text) {
    return text.trim().replace(/\s+/g, ' ').toLowerCase();
  }

  function focusHeroSearch() {
    var heroInput = document.getElementById('hero-search-input');
    if (!heroInput) return;
    // focus() first: Chrome scrolls a newly-focused element into view on its
    // own (instant, block:'nearest'), which would otherwise fight/override a
    // smooth scrollIntoView called before it. Calling scrollIntoView after
    // focus() makes the smooth centered scroll the last word.
    heroInput.focus();
    heroInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // index.html: 새 검색 시스템을 만들지 않고 기존 Hero 검색 input/form
  // (#hero-search-input, keyword+Quick Category 필터 로직)을 그대로
  // 재사용한다. 값만 옮겨 담고 그 form의 기존 submit을 재실행한다
  // (requestSubmit은 버튼 클릭과 동일하게 기존 submit 리스너 -- 빈 검색어
  // 처리 포함 -- 를 그대로 태운다).
  function runHeroSearch(keyword) {
    var heroInput = document.getElementById('hero-search-input');
    var heroForm = heroInput ? heroInput.closest('form') : null;
    if (!heroInput || !heroForm) return false;

    heroInput.value = keyword;
    if (heroForm.requestSubmit) {
      heroForm.requestSubmit();
    } else {
      heroForm.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    }
    return true;
  }

  // board-list.html: 이미 렌더링된 게시글 카드(.post-feed li[data-category])의
  // 제목/지역/카테고리 텍스트를 대상으로 부분일치(substring) 필터링한다.
  // 카테고리 탭의 기존 필터 함수(js/board.js의 initBoardCategoryTabs)는 전혀
  // 건드리지 않고, 탭에서 이미 선택된 카테고리를 읽기만 해서(수정 아님)
  // 검색어와 함께 조합한다 -- Hero의 keyword+Quick Category 조합과 동일한
  // 패턴. 새 검색 결과 페이지/컴포넌트를 만들지 않고 이미 있는 카드 목록의
  // hidden만 토글한다.
  function runBoardListSearch(keyword) {
    var feed = document.querySelector('.post-feed');
    if (!feed) return false;

    var tabList = document.querySelector('.tab-list');
    var activeTab = tabList ? tabList.querySelector('.tab-item.is-active') : null;
    var category = activeTab ? activeTab.textContent.trim() : '전체';
    var emptyState = feed.querySelector('.board-empty-state');
    var items = feed.querySelectorAll('li[data-category]');
    var normalizedKeyword = normalize(keyword);
    var visibleCount = 0;

    items.forEach(function (item) {
      var matchesCategory = category === '전체' || item.dataset.category.trim() === category;
      var matchesKeyword = !normalizedKeyword || normalize(item.textContent).indexOf(normalizedKeyword) !== -1;
      var visible = matchesCategory && matchesKeyword;
      item.hidden = !visible;
      if (visible) visibleCount += 1;
    });

    if (emptyState) emptyState.hidden = visibleCount !== 0;
    return true;
  }

  // event.preventDefault()를 항상 가장 먼저 호출한다 -- 최근 댓글 버그(form
  // 기본 submit 때문에 board-view의 ?id가 사라졌던 문제)와 동일한 문제가
  // 검색 폼에서도 재발하지 않도록. 검색 버튼 클릭과 input Enter 입력은 이미
  // 둘 다 이 하나의 submit 이벤트로 귀결되므로 별도 핸들러가 필요 없다.
  form.addEventListener('submit', function (event) {
    event.preventDefault();
    var keyword = input.value;

    if (runHeroSearch(keyword)) {
      // Hero 섹션은 화면 아래에 있으므로, 검색을 실제로 실행한 뒤에만 그
      // 결과 영역으로 이동한다(아이콘을 눌러 패널을 여는 시점에는 이동하지
      // 않음 -- 그건 위 openPanel()).
      closePanel();
      focusHeroSearch();
      return;
    }

    // board-list.html은 결과 목록이 검색 패널 바로 아래에 있으므로 닫지
    // 않는다 -- 사용자가 검색어를 바로 이어서 수정할 수 있게 열어둔다.
    // 그 외 페이지(board-view/write/login/signup/mypage)는 필터링할 목록
    // 자체가 없으므로(있는 목록들은 모두 이번 작업에서 보호 대상 -- 댓글/
    // PLACE INFO/마이페이지 저장 장소) 여기서 새 필터를 만들지 않는다.
    runBoardListSearch(keyword);
  });
})();

// 메인 카드 ↔ 커뮤니티 SAMPLE_POSTS 연동: js/sample-posts.js가
// window.MomentripSamplePosts로 노출한, js/board.js와 완전히 동일한 9개
// 샘플 게시글(별도 사본 없음)을 읽어 MOMENTRIP PICK/HOT/주변 인기 장소/
// 지역 행사/커뮤니티 미리보기의 기존 카드 중 실제로 자연스럽게 맞는
// 카드에만 제목/썸네일/지역/카테고리를 채우고 board-view.html?id=sample-N
// 링크를 연결한다. board-*.html에는 이 섹션들 자체가 없어 아래 모든
// querySelector가 그냥 빈 결과로 조용히 no-op된다.
//
// 카드 DOM 구조/class/CSS는 전혀 만들거나 바꾸지 않는다 -- textContent/
// src/href/data-tags 속성만 갱신한다. HOT/주변 인기 장소(.overlay-card)는
// 이미 카드 전체 클릭이 찜 토글로 쓰이고 있어(위 "HOT / 주변 인기 장소
// card-wide selection hit area" 참고) 카드 전체를 링크로 바꾸지 않고
// 제목만 <a>로 감싼다 -- 그 부분 클릭만 상세로 이동하고, 나머지 영역
// 클릭은 기존 찜 토글 그대로 유지된다(그 클릭 핸들러가 이미
// event.target.closest('a, button, ...')를 만나면 스스로 건너뛰도록
// 되어 있다). 전역 `a { color:inherit; text-decoration:none; }` 리셋이
// 이미 있어 새 CSS 없이도 기존 타이포그래피 그대로 보인다.
//
// 자연스럽게 맞는 게시글이 없는 카드(HOT의 "도자기 원데이 클래스", 지역
// 행사의 "이태원 갤러리 나잇")는 그대로 둔다 -- 9개 샘플로 17장의 기존
// 카드를 전부 채울 수는 없어서, 실제로 내용이 맞는 카드만 연결한다.
(function () {
  var posts = window.MomentripSamplePosts;
  if (!posts || !posts.length) return;

  var byId = {};
  posts.forEach(function (post) { byId[post.id] = post; });

  // js/board.js의 formatDate와 동일한 "YYYY.MM.DD" 형식 -- 두 파일이 공유하는
  // 데이터(SAMPLE_POSTS)와 달리 이 포맷 함수 자체는 매우 짧고 board.js는
  // index.html에 로드되지 않으므로, 공유 모듈을 새로 만들기보다 여기 그대로
  // 다시 둔다.
  function formatDate(isoString) {
    var date = new Date(isoString);
    if (isNaN(date.getTime())) return '';
    var y = date.getFullYear();
    var m = String(date.getMonth() + 1).padStart(2, '0');
    var d = String(date.getDate()).padStart(2, '0');
    return y + '.' + m + '.' + d;
  }

  function detailUrl(id) {
    return 'board-view.html?id=' + encodeURIComponent(id);
  }

  // 카드 제목의 기존 텍스트 노드를 실제 <a>로 감싼다(텍스트 자체는
  // 그대로 유지 가능하도록 text 인자를 받는다 -- 지정하지 않으면 기존
  // textContent를 그대로 링크 안에 옮긴다).
  function linkifyTitle(titleEl, id, text) {
    if (!titleEl) return;
    var link = document.createElement('a');
    link.href = detailUrl(id);
    link.textContent = text != null ? text : titleEl.textContent;
    titleEl.textContent = '';
    titleEl.appendChild(link);
  }

  function addDataTag(el, tag) {
    var tags = (el.dataset.tags || '').trim();
    if (!tags) {
      el.dataset.tags = tag;
      return;
    }
    if ((' ' + tags + ' ').indexOf(' ' + tag + ' ') === -1) {
      el.dataset.tags = tags + ' ' + tag;
    }
  }

  // -- MOMENTRIP PICK: 코스형 카드(장소→식사→체험 3-STEP)라 개별 게시글
  // 하나로 완전히 대체할 수 없다 -- 기존 코스 제목/스텝/이미지/카피는
  // 전혀 건드리지 않고, 코스 제목만 가장 관련 있는 게시글로 링크
  // 연결한다. 카드1의 STEP1("소소한 카페")이 sample-1의 실제 장소와
  // 동일해 가장 자연스러운 연결이다. 카드2는 지역(마포구)과 "실내
  // 데이트"라는 문구가 sample-9와 그대로 일치해 연결하고, Quick
  // Category와 계속 맞도록 "아이와 함께" tag를 추가한다.
  (function () {
    var courseCards = document.querySelectorAll('.moment-pick-section .course-card');
    [
      { index: 0, id: 'sample-1' },
      { index: 1, id: 'sample-9', addTag: '아이와 함께' }
    ].forEach(function (entry) {
      var card = courseCards[entry.index];
      var post = byId[entry.id];
      if (!card || !post) return;
      linkifyTitle(card.querySelector('.course-title'), post.id);
      if (entry.addTag) addDataTag(card, entry.addTag);
    });
  })();

  // -- HOT / 주변 인기 장소: 기존 data-favorite-id로 카드를 정확히
  // 지목한다(찜 상태 storage와 동일한 값이라 이미 고유하다). 제목/썸네일/
  // 지역·작성일/badge(카테고리)를 실제 게시글 값으로 채운다. 별점(rating)
  // UI는 SAMPLE_POSTS에 대응하는 값이 없어(views/likes만 존재) 지어내지
  // 않고 그대로 둔다.
  [
    { favoriteId: 'seongsu-riverside-market', id: 'sample-3' },
    { favoriteId: 'han-river-kayak', id: 'sample-2' },
    { favoriteId: 'rooftop-brunch-cafe', id: 'sample-5' },
    { favoriteId: 'seongsu-brewing-lounge', id: 'sample-8', tags: '맛집 친구와' },
    { favoriteId: 'yeonnam-corner-books', id: 'sample-6', tags: '카페 데이트 친구와' },
    { favoriteId: 'hannam-riverside-walk', id: 'sample-7', tags: '카페 데이트 친구와' },
    { favoriteId: 'seoulforest-picnic-garden', id: 'sample-4' }
  ].forEach(function (entry) {
    var card = document.querySelector('.card.overlay-card[data-favorite-id="' + entry.favoriteId + '"]');
    var post = byId[entry.id];
    if (!card || !post) return;

    linkifyTitle(card.querySelector('.card-title'), post.id);

    var img = card.querySelector('.ph-box img');
    if (img && post.thumbnail) {
      img.src = post.thumbnail;
      img.alt = post.thumbnailAlt || post.title;
    }

    var badge = card.querySelector('.card-image-overlay .badge');
    if (badge) badge.textContent = post.category;

    var metaSpan = card.querySelector('.card-meta span');
    if (metaSpan) metaSpan.textContent = post.region + ' · ' + formatDate(post.createdAt);

    if (entry.tags) card.dataset.tags = entry.tags;
  });

  // -- 지역 행사: 날짜 마커(예정일)/badge/지역은 "행사 자체"의 정보라
  // 게시글의 작성일과는 의미가 달라 그대로 두고, 제목/썸네일만 실제
  // 후기 게시글로 연결한다. 첫 항목은 HOT의 "성수 리버사이드 마켓"과
  // 이미지(riverside-market.png)까지 동일한 원래 와이어프레임 설계를
  // 그대로 따라 같은 sample-3로 연결한다.
  (function () {
    var eventItems = document.querySelectorAll('.event-section .event-timeline-item');
    [
      { index: 0, id: 'sample-3' },
      { index: 1, id: 'sample-4' }
    ].forEach(function (entry) {
      var item = eventItems[entry.index];
      var post = byId[entry.id];
      if (!item || !post) return;

      linkifyTitle(item.querySelector('.card-title'), post.id);

      var img = item.querySelector('.ph-box img');
      if (img && post.thumbnail) {
        img.src = post.thumbnail;
        img.alt = post.thumbnailAlt || post.title;
      }
    });
  })();

  // -- 커뮤니티 미리보기: 기존 정적 4행의 제목 텍스트가 이미 SAMPLE_POSTS
  // 제목과 정확히 일치했다(애초에 이 4개를 염두에 두고 작성된 것으로
  // 보인다) -- category/title/author/date 네 컬럼 모두 실제 게시글
  // 값으로 교체한다. "전체보기"는 이미 board-list.html로 연결돼 있어
  // 그대로 둔다.
  (function () {
    var rows = document.querySelectorAll('.community-section .board-row:not(.head)');
    ['sample-5', 'sample-1', 'sample-9', 'sample-2'].forEach(function (id, index) {
      var row = rows[index];
      var post = byId[id];
      if (!row || !post) return;

      var categoryEl = row.querySelector('.col-category');
      var titleEl = row.querySelector('.col-title');
      var authorEl = row.querySelector('.col-author');
      var dateEl = row.querySelector('.col-date');

      if (categoryEl) categoryEl.textContent = post.category;
      if (titleEl) linkifyTitle(titleEl, post.id);
      if (authorEl) authorEl.textContent = post.author;
      if (dateEl) dateEl.textContent = formatDate(post.createdAt);
    });
  })();
})();
