// 게시판 1차 핵심 CRUD (작성/목록 반영/상세/수정/삭제) + 카테고리 탭 필터 -- localStorage 기반.
// 댓글/좋아요/검색/페이지네이션은 포함하지 않는다. 로그인 여부 판단/회원가입/로그아웃 자체는
// js/auth.js가 전담하며, 이 파일은 글쓰기 진입 제한과 작성자 닉네임 연동을 위해
// window.MomentripAuth.getCurrentUser()만 읽는다. main.js는 Hero/지역/검색/
// favorite/carousel/Mobile GNB 등 메인 전용 로직으로 이미 크기가 커서, 관심사가 완전히
// 다른 게시판 CRUD는 별도 파일로 분리했다 (js/map.js를 index 전용으로 분리해 둔 선례와 동일한
// 방향). board-list.html/board-view.html/board-write.html에서만 로드한다.
(function () {
  var STORAGE_KEY = 'momentrip-board-posts';

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

  function savePosts(posts) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(posts));
    } catch (e) {
      // localStorage unavailable (private mode, quota) -- 저장은 실패해도
      // 페이지 전체 JS가 멈추지 않도록 조용히 무시한다.
    }
  }

  // 단일 브라우저 localStorage 데모 환경이므로 Date.now() 기반으로 충분하다.
  function generateId() {
    return 'post-' + Date.now();
  }

  // 프로젝트 기존 게시판 static sample과 동일한 "YYYY.MM.DD" 형식.
  function formatDate(isoString) {
    var date = new Date(isoString);
    if (isNaN(date.getTime())) return '';
    var y = date.getFullYear();
    var m = String(date.getMonth() + 1).padStart(2, '0');
    var d = String(date.getDate()).padStart(2, '0');
    return y + '.' + m + '.' + d;
  }

  // 목록 카드용 짧은 요약: 줄바꿈/연속 공백은 한 칸으로, 90자 초과 시 말줄임.
  function buildExcerpt(content) {
    var EXCERPT_LENGTH = 90;
    var normalized = content.replace(/\s+/g, ' ').trim();
    if (normalized.length <= EXCERPT_LENGTH) return normalized;
    return normalized.slice(0, EXCERPT_LENGTH).trim() + '...';
  }

  // 글쓰기 3단계 지역 select용 데이터. 전국 행정구역을 전부 담지 않고,
  // 이 프로젝트가 실제로 쓰고 있는 지역명(main.js REGION_OPTIONS, 정적 게시글
  // 샘플, 이전 board-write 지역 select)을 그대로 반영한 최소 범위 + 이번
  // 요구사항의 "경기 고양시 일산동구/일산서구"를 더했다. 시/군/구 아래 더
  // 세분화된 구가 없는 곳(성동구 등)은 빈 배열 -- 이 경우 3단계(세부 구)
  // select는 비활성 처리한다.
  var REGION_DATA = {
    '서울': {
      '성동구': [],
      '마포구': [],
      '용산구': [],
      '광진구': [],
      '강남구': []
    },
    '경기': {
      '고양시': ['일산동구', '일산서구'],
      '파주시': [],
      '김포시': [],
      '의정부시': []
    }
  };

  // post.region은 이번 작업 전까지 단순 문자열("서울 성동구")이었다. 새/수정
  // 게시글부터는 { province, city, district } 객체로 저장하되 필드명은
  // 그대로 region을 재사용한다 -- 기존 문자열 게시글도 그대로 표시되도록
  // 두 형태를 모두 처리한다.
  function formatRegion(region) {
    if (!region) return '';
    if (typeof region === 'string') return region;
    return [region.province, region.city, region.district].filter(Boolean).join(' ');
  }

  // 카테고리 radio는 value 속성이 없으므로(기존 마크업 변경 없이 그대로 재사용),
  // 체크된 input의 .category-chip 안 .chip-title 텍스트를 카테고리 값으로 사용한다.
  function getCheckedCategory(form) {
    var checked = form.querySelector('input[name="category"]:checked');
    if (!checked) return '';
    var chip = checked.closest('.category-chip');
    var titleEl = chip ? chip.querySelector('.chip-title') : null;
    return titleEl ? titleEl.textContent.trim() : '';
  }

  function setCheckedCategory(form, category) {
    var radios = form.querySelectorAll('input[name="category"]');
    for (var i = 0; i < radios.length; i++) {
      var chip = radios[i].closest('.category-chip');
      var titleEl = chip ? chip.querySelector('.chip-title') : null;
      if (titleEl && titleEl.textContent.trim() === category) {
        radios[i].checked = true;
        return;
      }
    }
  }

  // ------------------------------------------------------------------------
  // board-list.html: localStorage 사용자 작성글만 static sample 카드 위에 추가.
  // static 8개는 절대 건드리지 않는다 (요소 자체를 읽지도, 옮기지도 않음).
  // ------------------------------------------------------------------------
  (function initBoardList() {
    var feed = document.querySelector('.post-feed');
    if (!feed) return;

    var posts = readPosts().slice().sort(function (a, b) {
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
    if (!posts.length) return;

    function buildStat(iconClass, text) {
      var stat = document.createElement('span');
      stat.className = 'stat';
      var icon = document.createElement('i');
      icon.className = 'fa-solid ' + iconClass;
      icon.setAttribute('aria-hidden', 'true');
      stat.appendChild(icon);
      stat.appendChild(document.createTextNode(text));
      return stat;
    }

    // 카드별로 만든 Blob URL을 모아뒀다가 페이지를 벗어날 때 정리한다
    // (복잡한 lifecycle 관리 없이 unload 시점 일괄 revoke면 충분하다).
    var thumbnailObjectUrls = [];
    window.addEventListener('beforeunload', function () {
      thumbnailObjectUrls.forEach(function (url) { URL.revokeObjectURL(url); });
    });

    // 첨부 이미지 중 "첫 번째 image 타입"을 목록 카드 썸네일로 쓴다(동영상이
    // 먼저 첨부됐어도 건너뛴다). 기존 정적 카드가 쓰는 .ph-box.ratio-4-3
    // .post-card-thumb 구조를 그대로 재사용해 community PNG 카드와 동일하게
    // 보이도록 한다 -- 새 thumbnail 컴포넌트를 만들지 않는다.
    function attachThumbnailIfAvailable(post, anchorEl) {
      if (!window.MomentripAttachments) return;

      window.MomentripAttachments.get(post.id).then(function (records) {
        var firstImage = null;
        for (var k = 0; k < records.length; k++) {
          if (records[k].type === 'image') {
            firstImage = records[k];
            break;
          }
        }
        if (!firstImage) return;

        var url = URL.createObjectURL(firstImage.blob);
        thumbnailObjectUrls.push(url);

        var thumbWrap = document.createElement('div');
        thumbWrap.className = 'ph-box ratio-4-3 post-card-thumb';
        var img = document.createElement('img');
        img.src = url;
        img.alt = post.title;
        thumbWrap.appendChild(img);

        anchorEl.insertBefore(thumbWrap, anchorEl.firstChild);
      });
    }

    var fragment = document.createDocumentFragment();

    posts.forEach(function (post) {
      var li = document.createElement('li');
      li.dataset.category = post.category;
      var a = document.createElement('a');
      a.href = 'board-view.html?id=' + encodeURIComponent(post.id);
      a.className = 'post-card';

      var body = document.createElement('div');
      body.className = 'post-card-body';

      var top = document.createElement('div');
      top.className = 'post-card-top';

      var badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = post.category;

      var regionTag = document.createElement('span');
      regionTag.className = 'region-tag';
      var locationIcon = document.createElement('i');
      locationIcon.className = 'fa-solid fa-location-dot';
      locationIcon.setAttribute('aria-hidden', 'true');
      regionTag.appendChild(locationIcon);
      regionTag.appendChild(document.createTextNode(formatRegion(post.region)));

      top.appendChild(badge);
      top.appendChild(regionTag);

      var title = document.createElement('h3');
      title.className = 'post-card-title';
      title.textContent = post.title;

      var excerpt = document.createElement('p');
      excerpt.className = 'post-card-excerpt';
      excerpt.textContent = buildExcerpt(post.content);

      var bottom = document.createElement('div');
      bottom.className = 'post-card-bottom';

      var authorWrap = document.createElement('div');
      authorWrap.className = 'post-card-author';
      var userIcon = document.createElement('i');
      userIcon.className = 'fa-solid fa-user';
      userIcon.setAttribute('aria-hidden', 'true');
      var authorSpan = document.createElement('span');
      authorSpan.textContent = post.author;
      var divider = document.createElement('span');
      divider.className = 'divider';
      var dateSpan = document.createElement('span');
      dateSpan.textContent = formatDate(post.createdAt);
      authorWrap.appendChild(userIcon);
      authorWrap.appendChild(authorSpan);
      authorWrap.appendChild(divider);
      authorWrap.appendChild(dateSpan);

      var statsWrap = document.createElement('div');
      statsWrap.className = 'post-card-stats';
      statsWrap.appendChild(buildStat('fa-eye', '조회 ' + post.views));
      statsWrap.appendChild(buildStat('fa-comment', '댓글 0'));
      statsWrap.appendChild(buildStat('fa-heart', '좋아요 0'));

      bottom.appendChild(authorWrap);
      bottom.appendChild(statsWrap);

      body.appendChild(top);
      body.appendChild(title);
      body.appendChild(excerpt);
      body.appendChild(bottom);

      a.appendChild(body);
      li.appendChild(a);
      fragment.appendChild(li);

      attachThumbnailIfAvailable(post, a);
    });

    feed.insertBefore(fragment, feed.firstChild);
  })();

  // ------------------------------------------------------------------------
  // board-list.html: 카테고리 탭 필터. static sample 8개 + localStorage 글
  // 모두 initBoardList()가 li[data-category]로 이미 통일해뒀으므로, 이 함수는
  // 그 data-category만 보고 hidden 토글한다 (badge 텍스트 파싱 없음).
  // ------------------------------------------------------------------------
  (function initBoardCategoryTabs() {
    var tabList = document.querySelector('.tab-list');
    var feed = document.querySelector('.post-feed');
    if (!tabList || !feed) return;

    var tabs = tabList.querySelectorAll('.tab-item');
    var emptyState = feed.querySelector('.board-empty-state');

    function applyFilter(category) {
      var visibleCount = 0;
      var items = feed.querySelectorAll('li[data-category]');
      for (var i = 0; i < items.length; i++) {
        var match = category === '전체' || items[i].dataset.category.trim() === category;
        items[i].hidden = !match;
        if (match) visibleCount++;
      }
      if (emptyState) emptyState.hidden = visibleCount !== 0;
    }

    tabList.addEventListener('click', function (event) {
      var tab = event.target.closest('.tab-item');
      if (!tab || !tabList.contains(tab)) return;

      for (var i = 0; i < tabs.length; i++) {
        tabs[i].classList.remove('is-active');
        tabs[i].setAttribute('aria-selected', 'false');
      }
      tab.classList.add('is-active');
      tab.setAttribute('aria-selected', 'true');

      applyFilter(tab.textContent.trim());
    });
  })();

  // ------------------------------------------------------------------------
  // board-write.html: id 쿼리 없음 = 신규 작성, id 있음 = 수정(해당 post prefill).
  // ------------------------------------------------------------------------
  (function initBoardWrite() {
    var form = document.getElementById('board-write-form');
    if (!form) return;

    // 로그인하지 않은 사용자는 글쓰기/수정 화면에 진입할 수 없다. 원래 목적지(신규
    // 작성이면 board-write.html, 수정이면 ?id=... 포함)로 로그인 후 되돌아오도록
    // next 쿼리에 담아 board-login.html로 보낸다.
    var currentUser = window.MomentripAuth ? window.MomentripAuth.getCurrentUser() : null;
    if (!currentUser) {
      window.location.href = 'board-login.html?next=' + encodeURIComponent('board-write.html' + window.location.search);
      return;
    }

    var titleInput = document.getElementById('board-post-title');
    var contentInput = document.getElementById('board-post-content');
    var submitBtn = document.getElementById('board-write-submit');

    // ---- 3단계 지역 select ----
    var provinceSelect = document.getElementById('board-post-region-province');
    var citySelect = document.getElementById('board-post-region-city');
    var districtSelect = document.getElementById('board-post-region-district');

    function fillSelect(select, options, placeholder) {
      select.innerHTML = '';
      var placeholderOption = document.createElement('option');
      placeholderOption.value = '';
      placeholderOption.textContent = placeholder;
      select.appendChild(placeholderOption);
      options.forEach(function (name) {
        var option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        select.appendChild(option);
      });
    }

    // 상위 select가 바뀌면 하위 select는 항상 초기화한다 -- 잘못된 조합(예:
    // "경기"를 골랐는데 하위는 예전 "성동구"가 남아있는 상태)이 저장되지 않게.
    function handleProvinceChange() {
      var province = provinceSelect.value;
      citySelect.disabled = !province;
      fillSelect(citySelect, province ? Object.keys(REGION_DATA[province]) : [], '시/군/구');
      districtSelect.disabled = true;
      fillSelect(districtSelect, [], '세부 구');
    }

    function handleCityChange() {
      var province = provinceSelect.value;
      var city = citySelect.value;
      var districts = (province && city && REGION_DATA[province][city]) || [];
      districtSelect.disabled = districts.length === 0;
      fillSelect(districtSelect, districts, '세부 구');
    }

    fillSelect(provinceSelect, Object.keys(REGION_DATA), '시/도');
    citySelect.disabled = true;
    districtSelect.disabled = true;
    provinceSelect.addEventListener('change', handleProvinceChange);
    citySelect.addEventListener('change', handleCityChange);

    // ---- 장소 검색(네이버 지도 Geocoder 재사용 -- index.html과 동일한
    // 스크립트/Client ID, 새 지도 SDK 아님) ----
    var placeSearchInput = document.getElementById('board-post-place-search');
    var placeSearchBtn = document.getElementById('board-post-place-search-btn');
    var placeResultsEl = document.getElementById('place-search-results');
    var placeSelectedCard = document.getElementById('place-selected-card');
    var placeSelectedName = document.getElementById('place-selected-name');
    var placeSelectedAddress = document.getElementById('place-selected-address');
    var placeSelectedRemove = document.getElementById('place-selected-remove');

    var selectedPlace = null;

    function clearPlaceResults() {
      placeResultsEl.innerHTML = '';
      placeResultsEl.hidden = true;
    }

    function showSelectedPlace(place) {
      selectedPlace = place;
      placeSelectedName.textContent = place.name;
      placeSelectedAddress.textContent = place.address;
      placeSelectedCard.hidden = false;
      clearPlaceResults();
      placeSearchInput.value = '';
    }

    function clearSelectedPlace() {
      selectedPlace = null;
      placeSelectedCard.hidden = true;
      placeSelectedName.textContent = '';
      placeSelectedAddress.textContent = '';
    }

    // "입력한 장소명을 그대로 선택" fallback 옵션. Geocoder가 정상이든
    // 아니든(결과 0건/API 사용 불가) 항상 마지막에 붙여서, 검색이 아예
    // 막힌 경우에도 글쓰기 자체가 막히지 않게 한다. address/lat/lng을
    // 모르면 기존 place schema를 그대로 두고 빈 값/null로 채운다.
    function appendManualPlaceOption(query) {
      var li = document.createElement('li');
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'place-search-result place-search-manual';
      button.textContent = '"' + query + '"을(를) 장소로 사용';
      button.addEventListener('click', function () {
        showSelectedPlace({ name: query, address: '', lat: null, lng: null });
      });
      li.appendChild(button);
      placeResultsEl.appendChild(li);
    }

    function renderPlaceResults(query, geocodeResults) {
      clearPlaceResults();

      geocodeResults.forEach(function (item) {
        var address = item.roadAddress || item.jibunAddress || item.englishAddress || '';
        var li = document.createElement('li');
        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'place-search-result';
        button.textContent = address;
        button.addEventListener('click', function () {
          showSelectedPlace({
            name: query,
            address: address,
            lat: item.y ? parseFloat(item.y) : null,
            lng: item.x ? parseFloat(item.x) : null
          });
        });
        li.appendChild(button);
        placeResultsEl.appendChild(li);
      });
      appendManualPlaceOption(query);
      placeResultsEl.hidden = false;
    }

    // Geocoder API 자체는 정상 응답했지만(요청이 거부되지 않음) 주소와
    // 일치하는 결과가 0건인, "진짜 검색 결과 없음" 상태.
    function renderPlaceEmpty(query) {
      clearPlaceResults();
      var emptyItem = document.createElement('li');
      emptyItem.className = 'place-search-empty';
      emptyItem.textContent = '검색 결과가 없습니다.';
      placeResultsEl.appendChild(emptyItem);
      appendManualPlaceOption(query);
      placeResultsEl.hidden = false;
    }

    // 요청 자체가 실패한 상태(HTTP 403 등 -- Naver Cloud Console에서 이
    // 프로젝트가 호출 중인 도메인이 Maps 애플리케이션의 "Web 서비스 URL"에
    // 등록되어 있지 않거나 Geocoding 서비스가 활성화되지 않은 경우 흔히
    // 발생한다). "결과 없음"과 구분되는 문구로 안내하고, 장소명 직접 등록
    // fallback을 제공해 검색 API 설정 여부와 무관하게 글쓰기가 막히지
    // 않도록 한다.
    function renderPlaceUnavailable(query) {
      clearPlaceResults();
      var emptyItem = document.createElement('li');
      emptyItem.className = 'place-search-empty';
      emptyItem.textContent = '현재 주소 검색을 사용할 수 없습니다. 입력한 장소명을 직접 등록할 수 있어요.';
      placeResultsEl.appendChild(emptyItem);
      appendManualPlaceOption(query);
      placeResultsEl.hidden = false;
    }

    // Naver Local(장소명) 검색 API는 서버 사이드 전용(X-Naver-Client-Id/Secret
    // 헤더 필요, 브라우저 직접 호출 불가·CORS 미지원)이라 이 프론트엔드
    // 단독 프로젝트에서는 쓸 수 없다. 대신 index.html에서 이미 쓰고 있는
    // Geocoder(주소 검색) submodule을 그대로 재사용한다 -- 존재하지 않는
    // API를 새로 만들지 않는다. status가 OK가 아니거나(예: 403으로 요청
    // 자체가 거절) 콜백이 일정 시간 안에 오지 않으면(네트워크 문제/차단)
    // "검색 결과 없음"이 아니라 "API 사용 불가"로 명확히 구분해서 안내한다.
    var GEOCODE_TIMEOUT_MS = 5000;

    function searchPlace() {
      var query = placeSearchInput.value.trim();
      if (!query) return;

      if (!window.naver || !naver.maps || !naver.maps.Service) {
        renderPlaceUnavailable(query);
        return;
      }

      var settled = false;
      var timeoutId = setTimeout(function () {
        if (settled) return;
        settled = true;
        renderPlaceUnavailable(query);
      }, GEOCODE_TIMEOUT_MS);

      try {
        naver.maps.Service.geocode({ query: query }, function (status, response) {
          if (settled) return;
          settled = true;
          clearTimeout(timeoutId);

          if (status !== naver.maps.Service.Status.OK) {
            renderPlaceUnavailable(query);
            return;
          }

          var results = (response && response.v2 && response.v2.addresses) || [];
          if (!results.length) {
            renderPlaceEmpty(query);
            return;
          }
          renderPlaceResults(query, results);
        });
      } catch (e) {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        renderPlaceUnavailable(query);
      }
    }

    placeSearchBtn.addEventListener('click', searchPlace);
    placeSearchInput.addEventListener('keydown', function (event) {
      if (event.key !== 'Enter') return;
      event.preventDefault(); // 게시글 submit이 아니라 장소 검색만 실행한다.
      searchPlace();
    });
    placeSelectedRemove.addEventListener('click', clearSelectedPlace);

    // ---- 태그 (Enter -> chip, submit 아님) ----
    var tagInput = document.getElementById('board-post-tags');
    var tagListEl = document.getElementById('tag-chip-list');
    var tags = [];

    function renderTags() {
      tagListEl.innerHTML = '';
      tags.forEach(function (tag, index) {
        var li = document.createElement('li');
        li.className = 'tag-chip';

        var text = document.createElement('span');
        text.textContent = '#' + tag;

        var removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.setAttribute('aria-label', tag + ' 태그 삭제');
        removeBtn.textContent = '×';
        removeBtn.addEventListener('click', function () {
          tags.splice(index, 1);
          renderTags();
        });

        li.appendChild(text);
        li.appendChild(removeBtn);
        tagListEl.appendChild(li);
      });
    }

    // 앞뒤 공백/사용자가 직접 붙인 #은 제거하고 저장은 실제 문자열만 -- 화면
    // 표시(#접두) 단계에서만 붙이므로 "##태그"가 만들어지지 않는다. 중복은
    // 대소문자 구분 없이 비교(영문 태그 대비)하되 실제 저장 값은 사용자가
    // 처음 입력한 표기를 그대로 남긴다.
    function addTag(rawValue) {
      var value = rawValue.trim().replace(/^#+/, '').trim();
      if (!value) return;
      var exists = tags.some(function (tag) { return tag.toLowerCase() === value.toLowerCase(); });
      if (exists) return;
      tags.push(value);
      renderTags();
    }

    tagInput.addEventListener('keydown', function (event) {
      if (event.key !== 'Enter') return;
      event.preventDefault(); // 게시글 submit이 아니라 태그 등록만 실행한다.
      addTag(tagInput.value);
      tagInput.value = '';
    });

    // ---- 이미지/동영상 첨부 (선택 즉시 미리보기, binary는 IndexedDB로) ----
    var attachmentInput = document.getElementById('board-post-attachments');
    var attachmentPreviewList = document.getElementById('attachment-preview-list');
    var attachmentEntries = [];

    function renderAttachmentPreview(entry) {
      var item = document.createElement('div');
      item.className = 'attachment-preview-item';

      if (entry.type === 'image') {
        var wrap = document.createElement('div');
        wrap.className = 'ph-box ratio-1-1 attachment-preview-media';
        var img = document.createElement('img');
        img.src = entry.url;
        img.alt = entry.file.name || '첨부 이미지';
        wrap.appendChild(img);
        item.appendChild(wrap);
      } else {
        var video = document.createElement('video');
        video.className = 'attachment-preview-video';
        video.src = entry.url;
        video.controls = true;
        item.appendChild(video);
      }

      var removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'attachment-preview-remove';
      removeBtn.setAttribute('aria-label', '첨부 삭제');
      removeBtn.textContent = '×';
      removeBtn.addEventListener('click', function () {
        URL.revokeObjectURL(entry.url);
        var idx = attachmentEntries.indexOf(entry);
        if (idx !== -1) attachmentEntries.splice(idx, 1);
        item.remove();
      });

      item.appendChild(removeBtn);
      attachmentPreviewList.appendChild(item);
    }

    attachmentInput.addEventListener('change', function () {
      var files = Array.prototype.slice.call(attachmentInput.files);
      files.forEach(function (file) {
        var isImage = file.type.indexOf('image/') === 0;
        var isVideo = file.type.indexOf('video/') === 0;
        if (!isImage && !isVideo) return;

        var entry = { type: isImage ? 'image' : 'video', file: file, url: URL.createObjectURL(file) };
        attachmentEntries.push(entry);
        renderAttachmentPreview(entry);
      });
      // 같은 파일을 다시 골라도 change가 또 발생하도록 매번 비운다.
      attachmentInput.value = '';
    });

    // ---- 수정 모드 데이터 복원 ----
    var editId = new URLSearchParams(window.location.search).get('id');
    var editingPost = null;

    if (editId) {
      var existingPosts = readPosts();
      for (var i = 0; i < existingPosts.length; i++) {
        if (existingPosts[i].id === editId) {
          editingPost = existingPosts[i];
          break;
        }
      }
      if (editingPost) {
        setCheckedCategory(form, editingPost.category);
        if (titleInput) titleInput.value = editingPost.title;
        if (contentInput) contentInput.value = editingPost.content;
        if (submitBtn) submitBtn.textContent = '수정 완료';

        // region: 새 형식({province,city,district})일 때만 복원한다. 예전
        // 문자열 지역("서울 성동구" 등)은 새 3단계 데이터와 매핑할 근거가
        // 없어 억지로 끼워맞추지 않고 미선택 상태로 남긴다(에러 없이).
        var savedRegion = editingPost.region;
        if (savedRegion && typeof savedRegion === 'object' && REGION_DATA[savedRegion.province]) {
          provinceSelect.value = savedRegion.province;
          handleProvinceChange();
          if (savedRegion.city && REGION_DATA[savedRegion.province][savedRegion.city]) {
            citySelect.value = savedRegion.city;
            handleCityChange();
            if (savedRegion.district) {
              districtSelect.value = savedRegion.district;
            }
          }
        }

        if (editingPost.place) {
          showSelectedPlace(editingPost.place);
        }

        if (Array.isArray(editingPost.tags)) {
          tags = editingPost.tags.slice();
          renderTags();
        }

        if (window.MomentripAttachments) {
          window.MomentripAttachments.get(editingPost.id).then(function (existingAttachments) {
            existingAttachments.forEach(function (record) {
              var entry = { type: record.type, file: record.blob, url: URL.createObjectURL(record.blob) };
              attachmentEntries.push(entry);
              renderAttachmentPreview(entry);
            });
          });
        }
      }
      // editingPost를 못 찾은 경우(잘못된 id) 에러 없이 그냥 신규 작성 폼으로 동작.
    }

    form.addEventListener('submit', function (event) {
      event.preventDefault();

      var category = getCheckedCategory(form);
      var province = provinceSelect.value;
      var city = citySelect.value;
      var district = districtSelect.disabled ? '' : districtSelect.value;
      var title = titleInput ? titleInput.value.trim() : '';
      var content = contentInput ? contentInput.value.trim() : '';

      // district select가 활성 상태(해당 city에 하위 구가 있음)인데 아직
      // 고르지 않았다면 지역이 완전하지 않은 것으로 본다. 하위 구가 아예
      // 없는 city(성동구 등)는 district 없이도 완전한 지역으로 인정한다.
      var districtRequired = !districtSelect.disabled;
      var regionComplete = !!(province && city && (!districtRequired || district));

      // 기존 필수 검증(카테고리/제목/내용)은 그대로 유지한다. 장소/태그/첨부는
      // optional -- required로 만들지 않는다.
      if (!category || !regionComplete || !title || !content) return;

      var region = { province: province, city: city, district: district || null };
      var place = selectedPlace;
      var tagsToSave = tags.slice();
      var fileEntries = attachmentEntries.map(function (entry) {
        return { type: entry.type, file: entry.file };
      });

      var posts = readPosts();

      function saveAttachmentsThenGo(postId, redirectUrl) {
        if (!window.MomentripAttachments) {
          window.location.href = redirectUrl;
          return;
        }
        window.MomentripAttachments.replace(postId, fileEntries).then(function () {
          window.location.href = redirectUrl;
        }).catch(function () {
          // IndexedDB 저장이 실패해도(구형 브라우저 등) 게시글 text는 이미
          // 저장됐으므로 페이지 이동은 그대로 진행한다.
          window.location.href = redirectUrl;
        });
      }

      if (editingPost) {
        for (var j = 0; j < posts.length; j++) {
          if (posts[j].id === editingPost.id) {
            posts[j].category = category;
            posts[j].region = region;
            posts[j].place = place;
            posts[j].tags = tagsToSave;
            posts[j].title = title;
            posts[j].content = content;
            posts[j].updatedAt = new Date().toISOString();
            break;
          }
        }
        savePosts(posts);
        saveAttachmentsThenGo(editingPost.id, 'board-view.html?id=' + encodeURIComponent(editingPost.id));
        return;
      }

      var newPost = {
        id: generateId(),
        category: category,
        region: region,
        place: place,
        tags: tagsToSave,
        title: title,
        content: content,
        author: currentUser.nickname,
        createdAt: new Date().toISOString(),
        updatedAt: null,
        views: 0
      };

      posts.push(newPost);
      savePosts(posts);
      saveAttachmentsThenGo(newPost.id, 'board-view.html?id=' + encodeURIComponent(newPost.id));
    });
  })();

  // ------------------------------------------------------------------------
  // board-view.html: id 쿼리 없으면 기존 static sample 그대로(아무 것도 하지 않음).
  // id 있고 localStorage에 있으면 동적 렌더, id 있는데 없으면 목록으로 안전 이동.
  // ------------------------------------------------------------------------
  (function initBoardView() {
    var titleEl = document.getElementById('board-view-title');
    if (!titleEl) return;

    var id = new URLSearchParams(window.location.search).get('id');
    if (!id) return;

    var posts = readPosts();
    var post = null;
    for (var i = 0; i < posts.length; i++) {
      if (posts[i].id === id) {
        post = posts[i];
        break;
      }
    }

    if (!post) {
      window.location.href = 'board-list.html';
      return;
    }

    // 사용자 입력값이므로 innerHTML이 아닌 textContent로만 반영 (XSS 방지).
    titleEl.textContent = post.title;

    var categoryEl = document.getElementById('board-view-category');
    if (categoryEl) categoryEl.textContent = post.category;

    var regionEl = document.getElementById('board-view-region');
    if (regionEl) regionEl.textContent = formatRegion(post.region);

    // PLACE INFO 카드는 정적 샘플 게시글("소소한 카페" 등) 전용으로 이미
    // HTML에 하드코딩돼 있다. CRUD 게시글에는 그 가짜 내용이 그대로 보이면
    // 안 되므로, place가 있으면 실제 데이터로 다시 채우고 없으면 카드
    // 전체를 숨긴다(운영시간/주차 등 우리가 모르는 값은 지어내지 않는다).
    var placeColumnEl = document.querySelector('.place-info-column');
    if (placeColumnEl) {
      // address가 빈 문자열인 fallback 직접 등록 장소("명가원설농탕" 등)도
      // 정상적인 장소로 취급한다 -- address 유무가 아니라 name 유무로
      // "장소가 있다"를 판단한다.
      if (post.place && post.place.name) {
        var placeNameEl = placeColumnEl.querySelector('.place-info-name');
        if (placeNameEl) placeNameEl.textContent = post.place.name;

        var placeListEl = placeColumnEl.querySelector('.place-info-list');
        if (placeListEl) {
          placeListEl.innerHTML = '';
          [['지역', formatRegion(post.region)], ['주소', post.place.address]].forEach(function (pair) {
            if (!pair[1]) return;
            var li = document.createElement('li');
            var labelSpan = document.createElement('span');
            labelSpan.className = 'label';
            labelSpan.textContent = pair[0];
            var valueSpan = document.createElement('span');
            valueSpan.className = 'value';
            valueSpan.textContent = pair[1];
            li.appendChild(labelSpan);
            li.appendChild(valueSpan);
            placeListEl.appendChild(li);
          });
        }
      } else {
        placeColumnEl.hidden = true;
      }
    }

    // 태그: 필드가 없거나 빈 배열이면 아무 것도 렌더링하지 않는다(기존
    // 게시글/place·tags 없는 글에서 빈 UI가 노출되지 않도록).
    var tagsEl = document.getElementById('board-view-tags');
    if (tagsEl && Array.isArray(post.tags) && post.tags.length) {
      post.tags.forEach(function (tag) {
        var li = document.createElement('li');
        li.className = 'tag-chip';
        li.textContent = '#' + tag;
        tagsEl.appendChild(li);
      });
    }

    // 첨부 이미지/동영상: IndexedDB 조회가 비동기라 나머지 렌더링을
    // 기다리게 하지 않고 준비되는 대로 붙인다. 첨부가 없으면 컨테이너가
    // 빈 채로 남아 자연스럽게 자리를 차지하지 않는다.
    var attachmentsEl = document.getElementById('board-view-attachments');
    if (attachmentsEl && window.MomentripAttachments) {
      window.MomentripAttachments.get(post.id).then(function (records) {
        records.forEach(function (record) {
          var url = URL.createObjectURL(record.blob);
          var figure = document.createElement('figure');
          figure.className = 'post-attachment-item';

          if (record.type === 'image') {
            var img = document.createElement('img');
            img.src = url;
            img.alt = record.name || '첨부 이미지';
            figure.appendChild(img);
          } else {
            var video = document.createElement('video');
            video.src = url;
            video.controls = true;
            figure.appendChild(video);
          }

          attachmentsEl.appendChild(figure);
        });
      });
    }

    var authorEl = document.getElementById('board-view-author');
    if (authorEl) authorEl.textContent = post.author;

    var dateEl = document.getElementById('board-view-date');
    if (dateEl) dateEl.textContent = formatDate(post.createdAt);

    var viewsEl = document.getElementById('board-view-views');
    if (viewsEl) viewsEl.textContent = '조회 ' + post.views;

    // 댓글 기능은 아직 없다(comments 배열/storage 자체가 없음). "댓글 12"는
    // 정적 샘플용 와이어프레임 예시 값이라 CRUD 게시글에서는 항상 0으로
    // 덮어쓴다 -- 추후 실제 댓글 기능이 생기면 이 두 selector에 실제
    // count만 연결하면 된다.
    var commentCountEl = document.getElementById('board-view-comment-count');
    if (commentCountEl) commentCountEl.textContent = '댓글 0';

    var commentHeadingEl = document.getElementById('board-view-comment-heading');
    if (commentHeadingEl) commentHeadingEl.textContent = '댓글 0';

    // 댓글 기능 자체는 아직 없다(댓글 CRUD 미구현). 정적 샘플용으로
    // 하드코딩된 댓글 목록(작성자01/동네주민 등 가짜 댓글)이 CRUD
    // 게시글에서 그대로 보이면 "댓글 0"이라는 위 숫자와 모순되므로,
    // 그 목록은 숨기고 빈 상태 문구만 보여준다.
    var commentListEl = document.getElementById('board-view-comment-list');
    if (commentListEl) commentListEl.hidden = true;

    var commentEmptyEl = document.getElementById('board-view-comment-empty');
    if (commentEmptyEl) commentEmptyEl.hidden = false;

    // 줄바꿈은 CSS white-space:pre-line(#board-view-content)로 유지 -- innerHTML+<br> 변환 없음.
    var contentEl = document.getElementById('board-view-content');
    if (contentEl) contentEl.textContent = post.content;

    var editLink = document.getElementById('board-edit-link');
    if (editLink) editLink.href = 'board-write.html?id=' + encodeURIComponent(post.id);

    var deleteBtn = document.getElementById('board-delete-button');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', function () {
        if (!window.confirm('게시글을 삭제하시겠습니까?')) return;
        var remaining = readPosts().filter(function (p) { return p.id !== post.id; });
        savePosts(remaining);
        // 게시글 text 삭제는 즉시 반영하고, 첨부(IndexedDB) 정리는 굳이
        // 이동을 기다리지 않는다 -- 실패해도 게시글 자체는 이미 삭제됐다.
        if (window.MomentripAttachments) window.MomentripAttachments.remove(post.id);
        window.location.href = 'board-list.html';
      });
    }
  })();

  // ------------------------------------------------------------------------
  // board-mypage.html: 로그인 게이트 + 프로필(닉네임/아이디) + 내가 쓴 글.
  // 기존 게시글 schema(author = 로그인 당시 nickname)를 그대로 이용해 필터링할
  // 뿐, 새 필드/새 storage는 추가하지 않는다.
  // ------------------------------------------------------------------------
  (function initBoardMypage() {
    var nicknameEl = document.getElementById('mypage-nickname');
    if (!nicknameEl) return;

    var currentUser = window.MomentripAuth ? window.MomentripAuth.getCurrentUser() : null;
    if (!currentUser) {
      window.location.href = 'board-login.html?next=' + encodeURIComponent('board-mypage.html');
      return;
    }

    nicknameEl.textContent = currentUser.nickname;

    var idEl = document.getElementById('mypage-id');
    if (idEl) idEl.textContent = '@' + currentUser.id;

    var listEl = document.getElementById('mypage-posts-list');
    var emptyEl = document.getElementById('mypage-posts-empty');

    // 정적 샘플 게시글은 author가 "작성자01" 식 고정 텍스트라 현재 로그인
    // 사용자의 nickname과 일치할 수 없으므로 자연스럽게 제외되고, CRUD로
    // 작성한 글(author = 작성 당시 nickname)만 남는다.
    var myPosts = readPosts()
      .filter(function (post) { return post.author === currentUser.nickname; })
      .sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });

    if (!myPosts.length) {
      if (emptyEl) emptyEl.hidden = false;
    } else {
      if (emptyEl) emptyEl.hidden = true;

      if (listEl) {
        var fragment = document.createDocumentFragment();

        myPosts.forEach(function (post) {
          var li = document.createElement('li');
          li.className = 'mypage-post-item';

          var badge = document.createElement('span');
          badge.className = 'badge';
          badge.textContent = post.category;

          var titleLink = document.createElement('a');
          titleLink.href = 'board-view.html?id=' + encodeURIComponent(post.id);
          titleLink.className = 'mypage-post-title';
          titleLink.textContent = post.title;

          var dateEl = document.createElement('span');
          dateEl.className = 'mypage-post-date';
          dateEl.textContent = formatDate(post.createdAt);

          li.appendChild(badge);
          li.appendChild(titleLink);
          li.appendChild(dateEl);
          fragment.appendChild(li);
        });

        listEl.appendChild(fragment);
      }
    }

    // Header/Drawer 로그아웃과 동일한 confirm+reload 로직을 재사용 --
    // 이 페이지 전용 로그아웃 코드를 새로 만들지 않는다.
    var logoutBtn = document.getElementById('mypage-logout-button');
    if (logoutBtn && window.MomentripAuth) {
      logoutBtn.addEventListener('click', window.MomentripAuth.performLogout);
    }
  })();
})();
