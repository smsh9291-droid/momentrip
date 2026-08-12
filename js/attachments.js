// 게시글 첨부(이미지/동영상) binary 저장소 -- IndexedDB, post.id로 조회/삭제.
// 데모 프로젝트지만 동영상 Blob/DataURL을 localStorage(momentrip-board-posts)에
// 직접 넣으면 용량 제한(보통 5~10MB) 때문에 게시판 텍스트 데이터까지 깨질 수
// 있어, binary만 별도로 IndexedDB에 둔다. 게시글 본문/메타(text)는 지금처럼
// js/board.js가 localStorage에 저장하고, 여기서는 postId 하나로만 서로 연결한다
// (게시글 schema 자체에 attachment 배열을 넣지 않음).
// board-write.html/board-view.html에서만 로드한다(board-list.html은 이번
// 작업에서 썸네일을 확장하지 않으므로 필요 없음).
(function () {
  var DB_NAME = 'momentrip-attachments-db';
  var DB_VERSION = 1;
  var STORE_NAME = 'attachments';

  var dbPromise = null;

  function openDB() {
    if (dbPromise) return dbPromise;

    dbPromise = new Promise(function (resolve, reject) {
      if (!window.indexedDB) {
        reject(new Error('IndexedDB unavailable'));
        return;
      }

      var request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = function () {
        var db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          var store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('postId', 'postId', { unique: false });
        }
      };

      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error); };
    });

    return dbPromise;
  }

  // fileEntries: [{ type: 'image'|'video', file: File }]
  function save(postId, fileEntries) {
    if (!fileEntries || !fileEntries.length) return Promise.resolve();

    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE_NAME, 'readwrite');
        var store = tx.objectStore(STORE_NAME);

        fileEntries.forEach(function (entry, index) {
          store.put({
            id: postId + '-' + Date.now() + '-' + index,
            postId: postId,
            type: entry.type,
            name: entry.file.name,
            blob: entry.file
          });
        });

        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error); };
      });
    });
  }

  function get(postId) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE_NAME, 'readonly');
        var index = tx.objectStore(STORE_NAME).index('postId');
        var request = index.getAll(postId);

        request.onsuccess = function () { resolve(request.result || []); };
        request.onerror = function () { reject(request.error); };
      });
    });
  }

  function remove(postId) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE_NAME, 'readwrite');
        var store = tx.objectStore(STORE_NAME);
        var index = store.index('postId');
        var keysRequest = index.getAllKeys(postId);

        keysRequest.onsuccess = function () {
          var keys = keysRequest.result || [];
          keys.forEach(function (key) { store.delete(key); });
        };

        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error); };
      });
    });
  }

  // 수정 모드 저장 전략: 기존 첨부를 전부 지우고 최종 목록(유지된 기존 파일 +
  // 새로 추가한 파일)을 다시 저장한다. 부분 diff보다 훨씬 단순하고 이
  // 프로젝트 규모(게시글당 첨부 소수)에서는 충분하다.
  function replace(postId, fileEntries) {
    return remove(postId).then(function () {
      return save(postId, fileEntries);
    });
  }

  window.MomentripAttachments = {
    save: save,
    get: get,
    remove: remove,
    replace: replace
  };
})();
