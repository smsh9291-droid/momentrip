// 게시판 1차 핵심 CRUD (작성/목록 반영/상세/수정/삭제) -- localStorage 기반.
// 로그인/댓글/좋아요/검색/필터/페이지네이션은 포함하지 않는다. main.js는 Hero/지역/검색/
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

    var fragment = document.createDocumentFragment();

    posts.forEach(function (post) {
      var li = document.createElement('li');
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
      regionTag.appendChild(document.createTextNode(post.region));

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
    });

    feed.insertBefore(fragment, feed.firstChild);
  })();

  // ------------------------------------------------------------------------
  // board-write.html: id 쿼리 없음 = 신규 작성, id 있음 = 수정(해당 post prefill).
  // ------------------------------------------------------------------------
  (function initBoardWrite() {
    var form = document.getElementById('board-write-form');
    if (!form) return;

    var titleInput = document.getElementById('board-post-title');
    var contentInput = document.getElementById('board-post-content');
    var regionSelect = document.getElementById('board-post-region');
    var submitBtn = document.getElementById('board-write-submit');

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
        if (regionSelect) regionSelect.value = editingPost.region;
        if (titleInput) titleInput.value = editingPost.title;
        if (contentInput) contentInput.value = editingPost.content;
        if (submitBtn) submitBtn.textContent = '수정 완료';
      }
      // editingPost를 못 찾은 경우(잘못된 id) 에러 없이 그냥 신규 작성 폼으로 동작.
    }

    form.addEventListener('submit', function (event) {
      event.preventDefault();

      var category = getCheckedCategory(form);
      var region = regionSelect ? regionSelect.value.trim() : '';
      var title = titleInput ? titleInput.value.trim() : '';
      var content = contentInput ? contentInput.value.trim() : '';

      // required 속성이 이미 native validation을 처리하므로, 여기서는 저장을
      // 막기 위한 마지막 방어선일 뿐 별도 alert는 띄우지 않는다.
      if (!category || !region || !title || !content) return;

      var posts = readPosts();

      if (editingPost) {
        for (var j = 0; j < posts.length; j++) {
          if (posts[j].id === editingPost.id) {
            posts[j].category = category;
            posts[j].region = region;
            posts[j].title = title;
            posts[j].content = content;
            posts[j].updatedAt = new Date().toISOString();
            break;
          }
        }
        savePosts(posts);
        window.location.href = 'board-view.html?id=' + encodeURIComponent(editingPost.id);
        return;
      }

      var newPost = {
        id: generateId(),
        category: category,
        region: region,
        title: title,
        content: content,
        author: '익명',
        createdAt: new Date().toISOString(),
        updatedAt: null,
        views: 0
      };

      posts.push(newPost);
      savePosts(posts);
      window.location.href = 'board-view.html?id=' + encodeURIComponent(newPost.id);
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
    if (regionEl) regionEl.textContent = post.region;

    var authorEl = document.getElementById('board-view-author');
    if (authorEl) authorEl.textContent = post.author;

    var dateEl = document.getElementById('board-view-date');
    if (dateEl) dateEl.textContent = formatDate(post.createdAt);

    var viewsEl = document.getElementById('board-view-views');
    if (viewsEl) viewsEl.textContent = '조회 ' + post.views;

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
        window.location.href = 'board-list.html';
      });
    }
  })();
})();
