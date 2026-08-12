// 회원가입/로그인/로그인 상태 유지/로그아웃 -- 데모용 로컬 인증(서버/DB 없이 localStorage만 사용).
// board-list.html/board-view.html/board-write.html의 게시판 CRUD(js/board.js)와 관심사가
// 완전히 달라 별도 파일로 분리했다 (js/board.js를 main.js에서 분리해 둔 선례와 동일한 방향).
// index.html/board-list.html/board-view.html/board-write.html/board-login.html/
// board-signup.html 6개 페이지 모두에서 로드해 Header 로그인 상태를 동기화하고,
// board-login.html/board-signup.html에서는 각 폼 제출도 함께 처리한다.
//
// js/board.js가 로그인 여부·닉네임을 읽고 로그아웃을 재사용할 수 있도록
// window.MomentripAuth로 최소 인터페이스(getCurrentUser/logout/performLogout)만
// 노출한다 -- board.js는 이 인터페이스만 사용하고 storage key를 직접 건드리지 않는다.
(function () {
  var USERS_KEY = 'momentrip-users';
  var CURRENT_USER_KEY = 'momentrip-current-user';

  function readUsers() {
    try {
      var raw = window.localStorage.getItem(USERS_KEY);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function saveUsers(users) {
    try {
      window.localStorage.setItem(USERS_KEY, JSON.stringify(users));
    } catch (e) {
      // localStorage unavailable (private mode, quota) -- 조용히 무시(js/board.js의
      // savePosts()와 동일한 방어 방식).
    }
  }

  function findUserById(id) {
    var users = readUsers();
    for (var i = 0; i < users.length; i++) {
      if (users[i].id === id) return users[i];
    }
    return null;
  }

  function getCurrentUser() {
    try {
      var raw = window.localStorage.getItem(CURRENT_USER_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function setCurrentUser(user) {
    try {
      // 비밀번호는 절대 저장하지 않고 id/nickname만 남긴다.
      window.localStorage.setItem(CURRENT_USER_KEY, JSON.stringify({ id: user.id, nickname: user.nickname }));
    } catch (e) {
      // 무시 -- 저장 실패해도 로그인 자체 흐름은 막지 않는다.
    }
  }

  function logout() {
    try {
      window.localStorage.removeItem(CURRENT_USER_KEY);
    } catch (e) {}
  }

  function setFieldError(input, errorEl, message) {
    if (errorEl) errorEl.textContent = message || '';
    if (input) input.setAttribute('aria-invalid', message ? 'true' : 'false');
  }

  // Header 로그아웃 버튼 / Drawer 로그아웃 버튼 / board-mypage.html 로그아웃
  // 버튼이 전부 이 하나만 호출한다(중복 confirm/reload 코드 금지).
  // 로그아웃 후에는 항상 현재 페이지를 새로고침한다 -- board-write.html/
  // board-mypage.html처럼 로그인이 필요한 페이지라면 새로고침 시 각 페이지의
  // 기존 로그인 게이트가 알아서 board-login.html로 되돌려보낸다.
  function performLogout() {
    if (!window.confirm('로그아웃하시겠습니까?')) return;
    logout();
    window.location.reload();
  }

  // ------------------------------------------------------------------------
  // 공통 Header 계정 영역: 로그인 전에는 기존 .util-login(아이콘+"로그인",
  // board-login.html 링크)을 그대로 둔다 -- 이 함수는 로그인 상태일 때만
  // 개입해서 .util-login을 떼어내고 그 자리에 [아이콘+닉네임(마이페이지 링크)]
  // + [로그아웃 버튼]으로 구성된 .header-account를 붙인다. 로그아웃은 항상
  // 페이지를 새로고침하므로(performLogout) .util-login을 되살릴 필요가 없다.
  // ------------------------------------------------------------------------
  function buildHeaderAccountEl(user) {
    var wrap = document.createElement('div');
    wrap.className = 'header-account';

    var nicknameLink = document.createElement('a');
    nicknameLink.href = 'board-mypage.html';
    nicknameLink.className = 'header-account-nickname';

    var icon = document.createElement('i');
    icon.className = 'fa-solid fa-user';
    icon.setAttribute('aria-hidden', 'true');

    var nicknameText = document.createElement('span');
    nicknameText.className = 'header-account-nickname-text';
    nicknameText.textContent = user.nickname;

    nicknameLink.appendChild(icon);
    nicknameLink.appendChild(nicknameText);

    var logoutBtn = document.createElement('button');
    logoutBtn.type = 'button';
    logoutBtn.className = 'header-account-logout';
    logoutBtn.textContent = '로그아웃';
    logoutBtn.addEventListener('click', performLogout);

    wrap.appendChild(nicknameLink);
    wrap.appendChild(logoutBtn);
    return wrap;
  }

  function syncHeaderLoginState() {
    var headerUtils = document.querySelector('.header-utils');
    if (!headerUtils) return;

    var user = getCurrentUser();
    if (!user) return; // 로그아웃 상태 -- 기존 .util-login 그대로 둔다.

    var loginEl = headerUtils.querySelector('.util-login');
    if (loginEl) loginEl.remove();

    if (headerUtils.querySelector('.header-account')) return;
    headerUtils.appendChild(buildHeaderAccountEl(user));
  }

  // ------------------------------------------------------------------------
  // Mobile Drawer 계정 영역: js/main.js가 이미 만들어 둔 <nav class="gnb">
  // (Desktop GNB와 Mobile Drawer가 공유하는 그 요소) 맨 끝에, 로그인 상태일
  // 때만 닉네임/마이페이지/로그아웃 블록을 추가한다. js/main.js의 Drawer
  // open/close/backdrop/ESC/scroll-lock 로직은 전혀 건드리지 않는다.
  // ------------------------------------------------------------------------
  function buildDrawerAccountEl(user) {
    var section = document.createElement('div');
    section.className = 'gnb-account';

    var nickname = document.createElement('p');
    nickname.className = 'gnb-account-nickname';
    nickname.textContent = user.nickname;

    var mypageLink = document.createElement('a');
    mypageLink.href = 'board-mypage.html';
    mypageLink.className = 'gnb-account-link';
    mypageLink.textContent = '마이페이지';

    var logoutBtn = document.createElement('button');
    logoutBtn.type = 'button';
    logoutBtn.className = 'gnb-account-link gnb-account-logout';
    logoutBtn.textContent = '로그아웃';
    logoutBtn.addEventListener('click', performLogout);

    section.appendChild(nickname);
    section.appendChild(mypageLink);
    section.appendChild(logoutBtn);
    return section;
  }

  function syncDrawerAccountSection() {
    var gnbEl = document.querySelector('.gnb');
    if (!gnbEl) return;

    var user = getCurrentUser();
    if (!user) return; // 로그인 전에는 기존 Drawer(GNB 4개 메뉴)만 그대로 둔다.

    if (gnbEl.querySelector('.gnb-account')) return;
    gnbEl.appendChild(buildDrawerAccountEl(user));
  }

  syncHeaderLoginState();
  syncDrawerAccountSection();

  // ------------------------------------------------------------------------
  // board-signup.html 전용
  // ------------------------------------------------------------------------
  (function initSignupForm() {
    var form = document.getElementById('board-signup-form');
    if (!form) return;

    var idInput = document.getElementById('signup-id');
    var pwInput = document.getElementById('signup-password');
    var pwConfirmInput = document.getElementById('signup-password-confirm');
    var nicknameInput = document.getElementById('signup-nickname');

    var idError = document.getElementById('signup-id-error');
    var pwError = document.getElementById('signup-password-error');
    var pwConfirmError = document.getElementById('signup-password-confirm-error');
    var nicknameError = document.getElementById('signup-nickname-error');

    form.addEventListener('submit', function (event) {
      event.preventDefault();

      setFieldError(idInput, idError, '');
      setFieldError(pwInput, pwError, '');
      setFieldError(pwConfirmInput, pwConfirmError, '');
      setFieldError(nicknameInput, nicknameError, '');

      var id = idInput ? idInput.value.trim() : '';
      var password = pwInput ? pwInput.value : '';
      var passwordConfirm = pwConfirmInput ? pwConfirmInput.value : '';
      var nickname = nicknameInput ? nicknameInput.value.trim() : '';

      var hasError = false;

      if (!id) {
        setFieldError(idInput, idError, '아이디를 입력해주세요.');
        hasError = true;
      } else if (findUserById(id)) {
        setFieldError(idInput, idError, '이미 사용 중인 아이디입니다.');
        hasError = true;
      }

      if (!password || password.length < 6) {
        setFieldError(pwInput, pwError, '비밀번호는 6자 이상 입력해주세요.');
        hasError = true;
      }

      if (password !== passwordConfirm) {
        setFieldError(pwConfirmInput, pwConfirmError, '비밀번호가 일치하지 않습니다.');
        hasError = true;
      }

      if (!nickname) {
        setFieldError(nicknameInput, nicknameError, '닉네임을 입력해주세요.');
        hasError = true;
      }

      if (hasError) return;

      var users = readUsers();
      users.push({
        id: id,
        // 데모용 로컬 인증 -- 실서비스 저장 방식이 아니며 평문으로 저장된다.
        password: password,
        nickname: nickname,
        createdAt: new Date().toISOString()
      });
      saveUsers(users);

      window.location.href = 'board-login.html';
    });
  })();

  // ------------------------------------------------------------------------
  // board-login.html 전용
  // ------------------------------------------------------------------------
  (function initLoginForm() {
    var form = document.querySelector('.login-form');
    if (!form) return;

    var idInput = document.getElementById('login-id');
    var pwInput = document.getElementById('login-password');
    var formError = document.getElementById('login-form-error');

    form.addEventListener('submit', function (event) {
      event.preventDefault();

      if (formError) formError.textContent = '';

      var id = idInput ? idInput.value.trim() : '';
      var password = pwInput ? pwInput.value : '';

      var user = findUserById(id);
      if (!user || user.password !== password) {
        if (formError) formError.textContent = '아이디 또는 비밀번호가 올바르지 않습니다.';
        return;
      }

      setCurrentUser(user);

      var next = new URLSearchParams(window.location.search).get('next');
      window.location.href = next ? next : 'board-list.html';
    });
  })();

  window.MomentripAuth = {
    getCurrentUser: getCurrentUser,
    logout: logout,
    performLogout: performLogout
  };
})();
