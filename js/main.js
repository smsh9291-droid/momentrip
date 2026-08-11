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
// swipe gesture itself. Shared by every .page-section that has a .card-grid
// + .card-carousel-controls pair (HOT, 주변 인기 장소, ...); each call is
// scoped to its own section root so sections never see each other's track.
function initCardCarousel(section) {
  var track = section.querySelector('.card-grid');
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

document.querySelectorAll('.hot-section, .popular-section').forEach(initCardCarousel);
