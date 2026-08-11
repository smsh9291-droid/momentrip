// Hero "현재 지역" text: swaps the static "서울 성동구" fallback for the
// user's real administrative region (Geolocation -> NAVER reverse
// geocoding), once per page load. Purely a text label -- never touches
// map.js's map instance, center, zoom, or markers. Any failure (no
// geolocation support, permission denied, timeout, geocode miss) just
// leaves the static fallback text in #current-region-text untouched; no
// alerts, no thrown errors. Coordinates are used in-memory only for this
// one lookup and are never logged, stored, or sent anywhere.
//
// TEMPORARY diagnostics (console.log/warn only, no coordinates/addresses
// logged): traces which stage -- Geolocation, NAVER Service availability,
// reverse geocode, or DOM update -- the fallback is falling back from.
// Safe to strip once the real cause is found; every existing early-return
// still leaves the fallback text exactly as before, unchanged.
(function () {
  var regionTextEl = document.getElementById('current-region-text');
  if (!regionTextEl) {
    console.warn('[location] #current-region-text not found in DOM');
    return;
  }

  console.log('[location] isSecureContext:', window.isSecureContext);

  if (navigator.permissions && navigator.permissions.query) {
    navigator.permissions.query({ name: 'geolocation' }).then(
      function (result) {
        console.log('[location] permission state:', result.state);
      },
      function () {
        console.log('[location] permission query unsupported/failed');
      }
    );
  } else {
    console.log('[location] navigator.permissions.query unsupported');
  }

  if (!('geolocation' in navigator)) {
    console.warn('[location] navigator.geolocation unsupported');
    return;
  }

  console.log(
    '[location] naver.maps.Service typeof:',
    typeof (window.naver && naver.maps && naver.maps.Service)
  );

  if (!window.naver || !naver.maps || !naver.maps.Service) {
    console.warn('[location] naver.maps.Service unavailable (geocoder submodule not loaded)');
    return;
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
    console.log('[location] reverse geocode callback status:', status);

    if (status !== naver.maps.Service.Status.OK) {
      console.warn('[location] reverse geocode failed, keeping fallback text');
      return;
    }

    var hasV2 = !!(response && response.v2);
    var results = hasV2 && response.v2.results;
    console.log('[location] response.v2 exists:', hasV2, '| results length:', results ? results.length : 0);

    var region = results && results[0] && results[0].region;
    if (!region) {
      console.warn('[location] no region in first result, keeping fallback text');
      return;
    }

    console.log(
      '[location] area1 present:', !!(region.area1 && region.area1.name),
      '| area2 present:', !!(region.area2 && region.area2.name),
      '| area3 present:', !!(region.area3 && region.area3.name)
    );

    var regionName = formatRegionName(
      region.area1 && region.area1.name,
      region.area2 && region.area2.name
    );
    if (!regionName) {
      console.warn('[location] formatRegionName produced no result, keeping fallback text');
      return;
    }

    console.log('[location] updating #current-region-text');
    regionTextEl.textContent = regionName;
  }

  function handleGeolocationSuccess(position) {
    console.log('[location] geolocation success');

    var latlng = new naver.maps.LatLng(
      position.coords.latitude,
      position.coords.longitude
    );

    console.log('[location] reverse geocode started');
    naver.maps.Service.reverseGeocode(
      { coords: latlng, orders: 'admcode' },
      handleReverseGeocodeResult
    );
  }

  function handleGeolocationError(error) {
    // Denied / unavailable / timeout -- static fallback text stays as-is.
    console.warn('[location] geolocation failed', error.code, error.message);
  }

  console.log('[location] request started');
  navigator.geolocation.getCurrentPosition(handleGeolocationSuccess, handleGeolocationError, {
    enableHighAccuracy: false,
    timeout: 8000,
    maximumAge: 300000
  });
})();

// Hero quick category chips: single-select, click active chip again to clear.
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
  });
});

// Hero search box: search-box is a <form>, so button click (type="submit")
// and Enter both fire a single 'submit' event -- one listener covers both
// without double-triggering handleHeroSearch().
(function () {
  var heroSearchForm = document.querySelector('.hero-bottom .search-box');
  if (!heroSearchForm) return;

  var searchInput = heroSearchForm.querySelector('.input-text');
  if (!searchInput) return;

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

  function handleHeroSearch() {
    var keyword = searchInput.value.trim();

    if (!keyword) {
      promptEmptyKeyword();
      return;
    }

    var activeChip = document.querySelector('.hero-quick-category .chip.is-active');
    var category = activeChip ? activeChip.textContent.trim() : null;

    // TODO: replace this block with the real search request/navigation.
    console.log({ keyword: keyword, category: category });
  }

  heroSearchForm.addEventListener('submit', function (event) {
    event.preventDefault();
    handleHeroSearch();
  });
})();

document.querySelectorAll('.favorite-toggle').forEach(function (button) {
  button.addEventListener('click', function (event) {
    event.stopPropagation();

    var isActive = button.classList.toggle('is-active');
    button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
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

  var cards = Array.prototype.slice.call(track.children);
  var SCROLL_TOLERANCE = 4; // px slack for snap/rounding drift

  // Position of a card's left edge in the track's own scroll coordinates,
  // derived from live layout (getBoundingClientRect) rather than offsetLeft --
  // works regardless of .card-grid's positioning context and stays correct
  // as card width changes across breakpoints.
  function cardScrollLeft(card) {
    return track.scrollLeft + (card.getBoundingClientRect().left - track.getBoundingClientRect().left);
  }

  function currentCardIndex() {
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

  function scrollToCard(index) {
    var target = cards[index];
    if (!target) return;
    track.scrollTo({ left: cardScrollLeft(target), behavior: 'smooth' });
  }

  function updateButtonState() {
    var maxScrollLeft = track.scrollWidth - track.clientWidth;
    prevBtn.disabled = track.scrollLeft <= SCROLL_TOLERANCE;
    nextBtn.disabled = track.scrollLeft >= maxScrollLeft - SCROLL_TOLERANCE;
  }

  prevBtn.addEventListener('click', function () {
    scrollToCard(Math.max(0, currentCardIndex() - 1));
  });

  nextBtn.addEventListener('click', function () {
    scrollToCard(Math.min(cards.length - 1, currentCardIndex() + 1));
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
}

// Array.prototype.forEach calls its callback with (item, index, array) --
// initCardCarousel's new trackSelector parameter would otherwise receive
// that index (1 for the second matched section), so this wraps the call
// down to the single argument each of these sections actually needs.
document.querySelectorAll('.hot-section, .popular-section').forEach(function (section) {
  initCardCarousel(section);
});

var eventSection = document.querySelector('.event-section');
if (eventSection) {
  initCardCarousel(eventSection, '.event-timeline');
}
