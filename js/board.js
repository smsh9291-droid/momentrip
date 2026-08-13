// 게시판 1차 핵심 CRUD (작성/목록 반영/상세/수정/삭제) + 카테고리 탭 필터 + 댓글 -- localStorage 기반.
// 좋아요(카운트 표시 제외)/검색/페이지네이션은 포함하지 않는다. 로그인 여부 판단/회원가입/로그아웃 자체는
// js/auth.js가 전담하며, 이 파일은 글쓰기 진입 제한과 작성자 닉네임 연동을 위해
// window.MomentripAuth.getCurrentUser()만 읽는다. main.js는 Hero/지역/검색/
// favorite/carousel/Mobile GNB 등 메인 전용 로직으로 이미 크기가 커서, 관심사가 완전히
// 다른 게시판 CRUD는 별도 파일로 분리했다 (js/map.js를 index 전용으로 분리해 둔 선례와 동일한
// 방향). board-list.html/board-view.html/board-write.html에서만 로드한다.
(function () {
  var STORAGE_KEY = 'momentrip-board-posts';

  // ------------------------------------------------------------------------
  // 실제 사용자 게시글처럼 보이는 샘플 데이터 (와이어프레임 더미 대체).
  // board-list/board-view 양쪽이 이 배열 하나만 읽는다 -- 목록용 HTML과
  // 상세용 HTML을 따로 손으로 맞추지 않는다(단일 source). id는 CRUD의
  // "post-" 접두사와 겹치지 않도록 "sample-" 접두사를 쓴다.
  //
  // - thumbnail: contentBlocks의 첫 image block에서 자동으로 뽑는다(아래
  //   IIFE). board-list 썸네일과 상세 첫 이미지가 항상 같은 파일이 되도록
  //   보장하기 위해 수동으로 따로 지정하지 않는다.
  // - place: 실제로 알 수 없는 운영시간/주차 등은 절대 지어내지 않고
  //   name/address(모르면 '')만 채운다. 질문 등 장소 정보가 필요 없는
  //   글은 place 자체를 생략한다.
  // - address/lat/lng을 모르는 경우 그대로 비워/null로 둔다 -- 길찾기는
  //   기존 fallback(장소명+지역 검색)으로 자연스럽게 처리된다.
  var SAMPLE_POSTS = [
    {
      id: 'sample-1',
      category: '후기',
      region: '서울 성동구',
      title: '성수동 소소한 카페, 대기 없이 다녀왔어요',
      author: '카페수집가',
      createdAt: '2026-08-12T10:00:00.000Z',
      views: 186,
      likes: 34,
      tags: ['성수', '카페', '디저트'],
      place: { name: '카페 멜로우', address: '', lat: null, lng: null },
      content: '평일 오전에 방문했더니 대기 없이 바로 자리를 잡을 수 있었어요. 벽돌 인테리어에 책도 많고 조용한 분위기라 오래 앉아있기 좋았습니다.',
      contentBlocks: [
        { type: 'text', value: '평일 오전에 방문했더니 대기 없이 바로 자리를 잡을 수 있었어요. 벽돌 인테리어에 책도 많고 조용한 분위기라 오래 앉아있기 좋았습니다.' },
        { type: 'image', src: 'assets/images/community/community-01.png', width: '100%', alt: '카페 멜로우 실내에서 디저트와 커피를 즐기는 모습' },
        { type: 'text', value: '브라우니랑 시나몬 크럼블 케이크를 같이 시켰는데 둘 다 달지 않고 맛있었어요. 아이스 아메리카노도 산미 없이 깔끔했습니다.' }
      ],
      sampleComments: [
        { author: '주말산책러', content: '여기 저도 가봤는데 평일 오전이 진짜 한산해요.', createdAt: '2026-08-12T12:30:00.000Z' },
        { author: '퇴근후서울', content: '브라우니 진짜 맛있죠 저도 인정!', createdAt: '2026-08-12T19:10:00.000Z' }
      ]
    },
    {
      id: 'sample-2',
      category: '동행모집',
      region: '서울 광진구',
      title: '이번 주말 한강 카약 같이 타실 분 구해요',
      author: '여행좋아',
      createdAt: '2026-08-10T09:00:00.000Z',
      views: 154,
      likes: 18,
      tags: ['한강', '카약', '동행', '주말'],
      place: { name: '한강 카약 대여소', address: '', lat: null, lng: null },
      content: '토요일 오후에 카약 체험 예약했는데 인원이 부족해서 같이 하실 분 찾습니다. 초보도 안전요원분들이 잘 챙겨주셔서 괜찮아요.',
      contentBlocks: [
        { type: 'text', value: '토요일 오후에 카약 체험 예약했는데 인원이 부족해서 같이 하실 분 찾습니다. 초보도 안전요원분들이 잘 챙겨주셔서 괜찮아요.' },
        { type: 'image', src: 'assets/images/community/community-02.png', width: '100%', alt: '한강에서 카약을 타며 인증샷을 찍는 사람들' },
        { type: 'text', value: '다만 주말이라 대기가 좀 있는 편이에요. 미리 예약하고 가시는 걸 추천드려요.' },
        { type: 'image', src: 'assets/images/community/community-02_1.png', width: '100%', alt: '한강 카약 대여소 앞에 늘어선 대기줄' }
      ],
      sampleComments: [
        { author: '주말산책러', content: '저 토요일 오후 가능해요!', createdAt: '2026-08-10T10:20:00.000Z' },
        { author: '동네탐험중', content: '몇 시쯤 만나나요?', createdAt: '2026-08-10T11:05:00.000Z' },
        { author: '아이랑어디가지', content: '인원 다 찼을까요ㅠㅠ', createdAt: '2026-08-10T14:40:00.000Z' }
      ]
    },
    {
      id: 'sample-3',
      category: '행사후기',
      region: '서울 성동구',
      title: '성수 리버사이드 마켓 다녀온 후기, 사진 많아요',
      author: '주말산책러',
      createdAt: '2026-07-30T09:00:00.000Z',
      views: 320,
      likes: 56,
      tags: ['성수', '플리마켓', '주말나들이'],
      place: { name: '성수 리버사이드 마켓', address: '', lat: null, lng: null },
      content: '생각보다 볼거리도 많고 먹거리도 다양해서 하루 종일 있었어요. 핸드메이드 소품 부스가 특히 많았습니다.',
      contentBlocks: [
        { type: 'text', value: '생각보다 볼거리도 많고 먹거리도 다양해서 하루 종일 있었어요. 핸드메이드 소품 부스가 특히 많았습니다.' },
        { type: 'image', src: 'assets/images/community/community-03.png', width: '100%', alt: '성수 리버사이드 마켓 현장, 플리마켓 부스와 방문객들' },
        { type: 'text', value: '길거리 음식 부스도 줄서서 먹었는데 떡볶이랑 오뎅이 인기 많더라구요.' },
        { type: 'image', src: 'assets/images/community/community-10_3.png', width: '75%', alt: '리버사이드 마켓 길거리 음식 부스, 떡볶이와 오뎅' },
        { type: 'text', value: '한강 뷰 보면서 걷기도 좋아서 다음에 또 열리면 꼭 가려구요.' },
        { type: 'image', src: 'assets/images/community/community-10.png', width: '100%', alt: '리버사이드 마켓 전경과 한강, 도심 스카이라인' }
      ],
      sampleComments: []
    },
    {
      id: 'sample-4',
      category: '정보공유',
      region: '서울 성동구',
      title: '리버사이드 마켓에서 그릇 득템했어요, 부스 정보 공유',
      author: '동네탐험중',
      createdAt: '2026-08-05T09:00:00.000Z',
      views: 143,
      likes: 21,
      tags: ['성수', '마켓', '득템', '그릇'],
      place: { name: '성수 리버사이드 마켓', address: '', lat: null, lng: null },
      content: '핸드메이드 도자기 부스에서 그릇이랑 나무 숟가락을 샀어요. 가격도 생각보다 합리적이었습니다.',
      contentBlocks: [
        { type: 'text', value: '핸드메이드 도자기 부스에서 그릇이랑 나무 숟가락을 샀어요. 가격도 생각보다 합리적이었습니다.' },
        { type: 'image', src: 'assets/images/community/community-10_1.png', width: '100%', alt: '리버사이드 마켓에서 산 그릇과 나무 숟가락을 들고 있는 커플' },
        { type: 'text', value: '결제는 카드도 다 되니까 현금 안 챙겨가셔도 돼요.' },
        { type: 'image', src: 'assets/images/community/community-10_2.png', width: '75%', alt: '도자기 부스에서 카드로 결제하는 모습' },
        { type: 'text', value: '나오는 길에 꿀호떡도 하나 먹었는데 진짜 맛있었어요, 강추합니다.' },
        { type: 'image', src: 'assets/images/community/community-10_4.png', width: '50%', alt: '리버사이드 마켓 꿀호떡' }
      ],
      sampleComments: [
        { author: '카페수집가', content: '저도 이 그릇 봤는데 진짜 예쁘더라구요!', createdAt: '2026-08-05T13:00:00.000Z' },
        { author: '퇴근후서울', content: '호떡 저도 먹어봐야겠어요 ㅎㅎ', createdAt: '2026-08-05T20:15:00.000Z' }
      ]
    },
    {
      id: 'sample-5',
      category: '후기',
      region: '서울 용산구',
      title: '루프탑 브런치 카페, 뷰 진짜 좋아요',
      author: '퇴근후서울',
      createdAt: '2026-07-27T09:00:00.000Z',
      views: 178,
      likes: 29,
      tags: ['용산', '루프탑', '브런치', '카페뷰'],
      place: { name: '더 데일리 베이크', address: '', lat: null, lng: null },
      content: '노을 질 때쯤 방문했는데 뷰가 정말 예뻤어요. 아보카도 토스트랑 포치드에그가 특히 맛있었습니다.',
      contentBlocks: [
        { type: 'text', value: '노을 질 때쯤 방문했는데 뷰가 정말 예뻤어요. 아보카도 토스트랑 포치드에그가 특히 맛있었습니다.' },
        { type: 'image', src: 'assets/images/community/community-04.png', width: '100%', alt: '루프탑 카페에서 바라본 서울 전망과 브런치 플레이트' },
        { type: 'text', value: '친구들이랑 다 같이 가서 브런치 세트도 시켰는데 양도 넉넉하고 좋았어요. 다만 웨이팅은 좀 있는 편이에요.' },
        { type: 'image', src: 'assets/images/community/community-04_1.png', width: '100%', alt: '루프탑 브런치 카페에서 친구들과 식사하는 모습' }
      ],
      sampleComments: [
        { author: '여행좋아', content: '여기 뷰 인생샷 스팟이죠 ㅎㅎ', createdAt: '2026-07-27T18:00:00.000Z' }
      ]
    },
    {
      id: 'sample-6',
      category: '정보공유',
      region: '서울 마포구',
      title: '요즘 웨이팅 있는 신상 카페, 오픈 시간 팁 공유해요',
      author: '카페수집가',
      createdAt: '2026-08-07T09:00:00.000Z',
      views: 210,
      likes: 27,
      tags: ['마포', '신상카페', '웨이팅'],
      place: { name: '더 모닝 브루', address: '', lat: null, lng: null },
      content: '요즘 골목에 새로 생긴 카페인데 아침 8시부터 문을 열어요. 오픈런하면 대기 없이 바로 들어갈 수 있습니다.',
      contentBlocks: [
        { type: 'text', value: '요즘 골목에 새로 생긴 카페인데 아침 8시부터 문을 열어요. 오픈런하면 대기 없이 바로 들어갈 수 있습니다.' },
        { type: 'image', src: 'assets/images/community/community-06.png', width: '100%', alt: '더 모닝 브루 카페 외관, 골목 안 벽돌 건물' },
        { type: 'text', value: '10시쯤 가니까 벌써 줄이 길게 생겼더라구요. 여유롭게 즐기고 싶으면 오픈 시간에 맞춰 가는 걸 추천해요.' },
        { type: 'image', src: 'assets/images/community/community-06_1.png', width: '100%', alt: '더 모닝 브루 카페 앞에 늘어선 대기줄' }
      ],
      sampleComments: [
        { author: '아이랑어디가지', content: '저도 다음에 오픈런 해봐야겠어요!', createdAt: '2026-08-07T21:00:00.000Z' }
      ]
    },
    {
      id: 'sample-7',
      category: '정보공유',
      region: '서울 강남구',
      title: '원두 직접 로스팅하는 카페, 향이 정말 좋아요',
      author: '동네탐험중',
      createdAt: '2026-07-24T09:00:00.000Z',
      views: 96,
      likes: 14,
      tags: ['강남', '원두', '로스팅', '커피'],
      place: { name: '카페 드 코리아', address: '', lat: null, lng: null },
      content: '매장 안에 로스팅 기계가 있어서 원두를 직접 볶아서 파는 곳이에요. 오늘의 원두가 매일 바뀌는 것도 재밌었습니다.',
      contentBlocks: [
        { type: 'text', value: '매장 안에 로스팅 기계가 있어서 원두를 직접 볶아서 파는 곳이에요. 오늘의 원두가 매일 바뀌는 것도 재밌었습니다.' },
        { type: 'image', src: 'assets/images/community/community-06_2.png', width: '100%', alt: '카페 드 코리아에서 원두를 직접 로스팅하는 바리스타' },
        { type: 'text', value: '산미 있는 원두를 좋아하시면 에티오피아 예가체프 추천드려요.' }
      ],
      sampleComments: []
    },
    {
      id: 'sample-8',
      category: '후기',
      region: '서울 종로구',
      title: '광장시장 노포 맛집 투어, 배 터지게 먹었어요',
      author: '여행좋아',
      createdAt: '2026-08-03T09:00:00.000Z',
      views: 254,
      likes: 38,
      tags: ['광장시장', '전통시장', '맛집투어'],
      place: { name: '광장시장', address: '', lat: null, lng: null },
      content: '육회비빔밥, 빈대떡, 마약김밥 코스로 돌면서 먹었는데 하나같이 다 맛있었어요. 사람이 많아서 살짝 정신없긴 했습니다.',
      contentBlocks: [
        { type: 'text', value: '육회비빔밥, 빈대떡, 마약김밥 코스로 돌면서 먹었는데 하나같이 다 맛있었어요. 사람이 많아서 살짝 정신없긴 했습니다.' },
        { type: 'image', src: 'assets/images/community/community-05.png', width: '100%', alt: '광장시장 맛집에서 비빔밥, 김치찌개, 전 등을 차려놓은 상' }
      ],
      sampleComments: [
        { author: '퇴근후서울', content: '빈대떡집 이름 알 수 있을까요?', createdAt: '2026-08-03T13:00:00.000Z' },
        { author: '주말산책러', content: '광장시장은 언제 가도 맛있죠 ㅎㅎ', createdAt: '2026-08-03T15:30:00.000Z' }
      ]
    },
    {
      id: 'sample-9',
      category: '질문',
      region: '서울 마포구',
      title: '마포구에서 아이랑 갈만한 실내 데이트 코스 있을까요?',
      author: '아이랑어디가지',
      createdAt: '2026-08-09T09:00:00.000Z',
      views: 97,
      likes: 5,
      tags: ['마포', '아이와함께', '실내놀이'],
      content: '이번 주말에 아이와 함께 갈만한 실내 위주 코스 찾고 있어요. 지난번엔 근처 키즈카페를 다녀왔는데(사진 첨부) 비슷한 곳이나 다른 추천도 좋아요.',
      contentBlocks: [
        { type: 'text', value: '이번 주말에 아이와 함께 갈만한 실내 위주 코스 찾고 있어요. 지난번엔 근처 키즈카페를 다녀왔는데(사진 첨부) 비슷한 곳이나 다른 추천도 좋아요.' },
        { type: 'image', src: 'assets/images/community/community-09.png', width: '75%', alt: '실내 키즈카페 놀이터, 미끄럼틀과 볼풀' },
        { type: 'image', src: 'assets/images/community/community-09_1.png', width: '75%', alt: '키즈카페 플레이그라운드에서 아이와 노는 모습' }
      ],
      sampleComments: [
        { author: '카페수집가', content: '저번주에 갔는데 주차는 2시간 무료였어요.', createdAt: '2026-08-09T10:40:00.000Z' },
        { author: '동네탐험중', content: '홍대 쪽에도 비슷한 곳 있어요, 나중에 후기 올릴게요!', createdAt: '2026-08-09T11:20:00.000Z' },
        { author: '퇴근후서울', content: '저희 애도 데려가봐야겠네요 감사합니다', createdAt: '2026-08-09T22:05:00.000Z' }
      ]
    }
  ];

  // 목록 썸네일 = 상세 첫 이미지(#39). 손으로 따로 지정하지 않고 contentBlocks에서
  // 그대로 뽑아, 목록/상세가 서로 다른 파일을 가리키는 실수 자체가 불가능하게 한다.
  // isSample 플래그로 CRUD 게시글과 렌더링 경로(IndexedDB 첨부 유무)를 구분한다.
  SAMPLE_POSTS.forEach(function (post) {
    post.isSample = true;
    var firstImage = null;
    for (var i = 0; i < post.contentBlocks.length; i++) {
      if (post.contentBlocks[i].type === 'image') {
        firstImage = post.contentBlocks[i];
        break;
      }
    }
    post.thumbnail = firstImage ? firstImage.src : null;
    post.thumbnailAlt = firstImage ? firstImage.alt : post.title;
  });

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

  // contentBlocks의 image/video는 저장 전까지 실제 attachment id를 알 수
  // 없다(js/attachments.js의 save()가 매번 새 timestamp로 id를 새로 발급하기
  // 때문). 대신 "이 post의 첨부 중 몇 번째로 저장됐는가"(mediaIndex, 0부터)를
  // contentBlocks에 저장해두고, attachments.js의 기존 id 포맷
  // `postId-timestamp-index`가 항상 그 index를 마지막 '-' 뒤에 그대로 담고
  // 있다는 점을 이용해 다시 매핑한다 -- attachments.js의 schema/저장 로직은
  // 전혀 건드리지 않는다.
  function buildMediaIndexMap(records) {
    var map = {};
    records.forEach(function (record) {
      var parts = String(record.id).split('-');
      var index = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(index)) map[index] = record;
    });
    return map;
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

  // ------------------------------------------------------------------------
  // PLACE INFO 카드(길찾기/저장). 정적 샘플 게시글과 CRUD 게시글(post.place)
  // 양쪽 모두 initBoardView 안에서 이 함수 하나만 호출해 재사용한다. 좋아요/
  // 저장/공유/신고(post-actions) 등 게시글 자체의 action과는 완전히 별개의
  // localStorage key를 쓴다.
  // ------------------------------------------------------------------------
  var PLACE_SAVE_KEY = 'momentrip-saved-places';

  function readSavedPlacesStore() {
    try {
      var raw = window.localStorage.getItem(PLACE_SAVE_KEY);
      var parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (e) {
      return {};
    }
  }

  function writeSavedPlacesStore(store) {
    try {
      window.localStorage.setItem(PLACE_SAVE_KEY, JSON.stringify(store));
    } catch (e) {
      // localStorage 사용 불가 -- savePosts()와 동일하게 조용히 무시.
    }
  }

  function findSavedPlaceIndex(list, postId) {
    for (var i = 0; i < list.length; i++) {
      if (list[i].postId === postId) return i;
    }
    return -1;
  }

  // 사용자별로 store[userId]에 배열을 따로 두어, A가 저장한 장소가 B
  // 로그인 시 보이지 않도록 분리한다.
  function isPlaceSavedByUser(userId, postId) {
    var list = readSavedPlacesStore()[userId] || [];
    return findSavedPlaceIndex(list, postId) !== -1;
  }

  function toggleSavedPlace(userId, postId, place, region) {
    var store = readSavedPlacesStore();
    var list = store[userId] || [];
    var idx = findSavedPlaceIndex(list, postId);
    var nowSaved;

    if (idx === -1) {
      list.push({
        postId: postId,
        name: place && place.name ? place.name : '',
        address: place && place.address ? place.address : '',
        region: region || '',
        lat: place && typeof place.lat === 'number' ? place.lat : null,
        lng: place && typeof place.lng === 'number' ? place.lng : null,
        savedAt: new Date().toISOString()
      });
      nowSaved = true;
    } else {
      list.splice(idx, 1);
      nowSaved = false;
    }

    store[userId] = list;
    writeSavedPlacesStore(store);
    return nowSaved;
  }

  // 마이페이지 "저장한 장소" 목록 전용 -- 저장 당시 함께 보관한 address/region이
  // 서로 겹치는 경우(예: address가 region으로 시작하는 전체 주소) 같은 지역명이
  // 두 번 반복되지 않도록 정리한다. 이미 저장된 값만 조합할 뿐 새 데이터를
  // 만들지 않는다.
  function formatPlaceSecondaryText(place) {
    var address = (place && place.address) || '';
    var region = (place && place.region) || '';

    if (!address) return region;
    if (!region) return address;

    if (address.indexOf(region) === 0) {
      var rest = address.slice(region.length).replace(/^[\s,·]+/, '').trim();
      return rest ? region + ' · ' + rest : region;
    }

    return address;
  }

  // 저장 당시의 postId가 지금도 유효한 이동 대상인지 확인한다. CRUD
  // 게시글은 실제로 아직 존재할 때만, SAMPLE_POSTS는 해당 sample-N id가
  // 지금도 SAMPLE_POSTS 안에 있을 때만 ?id=로 연결한다. board-view.html은
  // 이제 항상 ?id=가 있어야 하므로(없으면 목록으로 리다이렉트), 옛
  // "static-sample"(샘플이 여러 개로 나뉘기 전 단일 정적 페이지) 저장
  // 기록은 더 이상 유효한 대상이 없다 -- null을 돌려줘 호출부가 링크
  // 없는 항목(게시글이 삭제된 경우와 동일한 안전한 fallback)으로 표시한다.
  function getSavedPlaceLinkHref(postId) {
    if (postId === 'static-sample') return null;
    var existsInPosts = readPosts().some(function (post) { return post.id === postId; });
    var existsInSamples = SAMPLE_POSTS.some(function (post) { return post.id === postId; });
    return (existsInPosts || existsInSamples) ? 'board-view.html?id=' + encodeURIComponent(postId) : null;
  }

  // 저장된 상태의 버튼 문구는 "현재 상태 설명"(저장됨)이 아니라 "다음에
  // 누르면 무슨 일이 일어나는지"(저장취소)를 보여준다. 저장취소는 데이터를
  // 되돌릴 수 없이 삭제하는 파괴적 action이 아니므로 danger 색 대신, 바로
  // 옆 길찾기 버튼과 같은 기존 중립 .btn 스타일(새 CSS 없음)로만 저장 전
  // mint(.btn-fill)와 구분한다.
  function setPlaceSaveButtonState(btn, isSaved) {
    btn.textContent = isSaved ? '저장취소' : '저장';
    btn.classList.toggle('btn-fill', !isSaved);
    btn.setAttribute('aria-pressed', isSaved ? 'true' : 'false');
  }

  // PLACE INFO 하단 안내문구(.place-info-hint)를 재사용하는 일회성 피드백
  // (현재는 저장취소 전용). 새 toast/모달 없이 잠깐 메시지를 보여준 뒤
  // 항상 기본 안내문구로 되돌아간다. 저장 성공 상태는 더 이상 이 timer를
  // 쓰지 않고(아래 setPlaceInfoSavedState) "저장 여부"라는 상태값을 기준으로
  // 영구적으로 렌더링한다 -- 시간이 지나도 사라지지 않아야 하기 때문이다.
  var placeInfoFeedbackTimer = null;

  function showPlaceInfoFeedback(hintEl, message) {
    if (!hintEl) return;
    if (hintEl.dataset.defaultText === undefined) {
      hintEl.dataset.defaultText = hintEl.textContent;
    }
    hintEl.textContent = message;
    if (placeInfoFeedbackTimer) window.clearTimeout(placeInfoFeedbackTimer);
    placeInfoFeedbackTimer = window.setTimeout(function () {
      hintEl.textContent = hintEl.dataset.defaultText;
      placeInfoFeedbackTimer = null;
    }, 2500);
  }

  // 저장 여부에 따라 .place-info-hint를 영구적으로 렌더링한다(페이지 로드
  // 시 초기 상태 복원, 저장/저장취소 클릭 직후 모두 이 함수 하나로 처리).
  // 저장 중에는 완료 안내 + 마이페이지 링크가 계속 보이고, 저장취소하는
  // 순간 즉시(타이머 없이) 사라진다.
  function setPlaceInfoSavedState(hintEl, isSaved) {
    if (!hintEl) return;
    if (hintEl.dataset.defaultText === undefined) {
      hintEl.dataset.defaultText = hintEl.textContent;
    }
    // 직전에 걸려 있던 일회성 feedback timer(예: 방금 저장취소)가 나중에
    // 끼어들어 이 영구 상태를 되돌리지 않도록 정리한다.
    if (placeInfoFeedbackTimer) {
      window.clearTimeout(placeInfoFeedbackTimer);
      placeInfoFeedbackTimer = null;
    }

    hintEl.textContent = '';

    if (!isSaved) {
      hintEl.appendChild(document.createTextNode(hintEl.dataset.defaultText));
      return;
    }

    // 문구는 breakpoint와 무관하게 항상 같은 걸 한 번만 만든다 -- Desktop/
    // Tablet은 짧게 "장소가 저장되었습니다."만, Mobile은 이어지는 문장까지
    // 보이는 차이는 아래 두 span의 CSS display 토글(css/wireframe.css
    // .place-info-feedback-extra/.place-info-mypage-extra)만으로 처리하고,
    // 여기서 breakpoint를 분기하는 JS는 두지 않는다.
    hintEl.appendChild(document.createTextNode('장소가 저장되었습니다.'));

    var feedbackExtra = document.createElement('span');
    feedbackExtra.className = 'place-info-feedback-extra';
    feedbackExtra.textContent = ' 마이페이지에서 확인할 수 있습니다.';
    hintEl.appendChild(feedbackExtra);

    var mypageLink = document.createElement('a');
    mypageLink.href = 'board-mypage.html';
    mypageLink.className = 'place-info-mypage-link';
    mypageLink.appendChild(document.createTextNode('마이페이지'));

    var mypageExtra = document.createElement('span');
    mypageExtra.className = 'place-info-mypage-extra';
    mypageExtra.textContent = '에서 확인';
    mypageLink.appendChild(mypageExtra);

    mypageLink.appendChild(document.createTextNode(' >'));
    hintEl.appendChild(mypageLink);
  }

  // 네이버지도 좌표 기반 웹 URL(map.naver.com/?lng=..&lat=..&title=..)을
  // 우선 사용한다 -- 공식 URL Scheme 문서(nmap://)는 앱 전용이라 새 탭으로
  // 열 웹 URL은 별도이며, 좌표만으로 지도를 여는 이 형식은 Naver Cloud
  // Platform 포럼에서 안내된 실제 동작 형식이다. 좌표가 없으면(과거 게시글 등)
  // 임의로 좌표를 만들지 않고 장소명+주소/지역 문자열 검색으로만 연결한다.
  function openNaverMapDirections(place, region) {
    var name = place && place.name ? place.name : '';
    var hasCoords = place && typeof place.lat === 'number' && typeof place.lng === 'number';

    if (hasCoords) {
      var url = 'https://map.naver.com/?lng=' + place.lng + '&lat=' + place.lat + '&title=' + encodeURIComponent(name);
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }

    var locationText = (place && place.address) || region || '';
    var query = [name, locationText].filter(Boolean).join(' ').trim();
    if (!query) {
      window.alert('길찾기에 사용할 장소 정보가 없습니다.');
      return;
    }
    window.open('https://map.naver.com/p/search/' + encodeURIComponent(query), '_blank', 'noopener,noreferrer');
  }

  function wirePlaceInfoActions(postId, place, region) {
    var actionsEl = document.querySelector('.place-info-actions');
    if (!actionsEl) return;

    var hintEl = document.querySelector('.place-info-hint');

    var directionsBtn = document.getElementById('place-directions-btn');
    if (directionsBtn) {
      directionsBtn.addEventListener('click', function () {
        openNaverMapDirections(place, region);
      });
    }

    var saveBtn = document.getElementById('place-save-btn');
    if (!saveBtn) return;

    var initialUser = window.MomentripAuth ? window.MomentripAuth.getCurrentUser() : null;
    var initiallySaved = initialUser ? isPlaceSavedByUser(initialUser.id, postId) : false;
    setPlaceSaveButtonState(saveBtn, initiallySaved);
    setPlaceInfoSavedState(hintEl, initiallySaved);

    saveBtn.addEventListener('click', function () {
      var currentUser = window.MomentripAuth ? window.MomentripAuth.getCurrentUser() : null;
      if (!currentUser) {
        window.alert('로그인이 필요합니다.');
        window.location.href = 'board-login.html?next=' + encodeURIComponent('board-view.html' + window.location.search);
        return;
      }
      var nowSaved = toggleSavedPlace(currentUser.id, postId, place, region);
      setPlaceSaveButtonState(saveBtn, nowSaved);
      if (nowSaved) {
        setPlaceInfoSavedState(hintEl, true);
      } else {
        showPlaceInfoFeedback(hintEl, '저장이 취소되었습니다.');
      }
    });
  }

  // ------------------------------------------------------------------------
  // 댓글. postId(CRUD의 post.id 또는 SAMPLE_POSTS의 sample-N id)별로 완전히
  // 분리된 배열 하나만 진실의 기준으로 삼는다 -- 화면 DOM 개수를 세지 않고
  // 항상 이 데이터 배열의 length로 count를 계산한다. 정적 sample 댓글은
  // SAMPLE_POSTS.sampleComments에 저장돼 있다가, 이 storage에 아직 해당
  // postId 항목이 없을 때만 초기값으로 쓰인다 -- 즉 sample 게시글에 처음
  // 댓글을 달기 전까지는 seed만 보여주고, 한 번이라도 달리면 그 순간부터는
  // (seed+새 댓글이 합쳐진) 이 storage가 유일한 진실이 된다. CRUD 게시글은
  // seedComments가 없으므로 항상 빈 배열에서 시작한다.
  var COMMENTS_STORAGE_KEY = 'momentrip-board-comments';

  function readCommentsStore() {
    try {
      var raw = window.localStorage.getItem(COMMENTS_STORAGE_KEY);
      var parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (e) {
      return {};
    }
  }

  function writeCommentsStore(store) {
    try {
      window.localStorage.setItem(COMMENTS_STORAGE_KEY, JSON.stringify(store));
    } catch (e) {
      // localStorage 사용 불가 -- savePosts()와 동일하게 조용히 무시.
    }
  }

  function readCommentsForPost(postId, seedComments) {
    var store = readCommentsStore();
    if (store[postId]) return store[postId];
    return Array.isArray(seedComments) ? seedComments.slice() : [];
  }

  function addCommentForPost(postId, seedComments, comment) {
    var list = readCommentsForPost(postId, seedComments).slice();
    list.push(comment);
    var store = readCommentsStore();
    store[postId] = list;
    writeCommentsStore(store);
    return list;
  }

  // 기본 프로필 아이콘: 프로필 이미지를 등록하는 기능 자체가 아직 없으므로
  // (js/auth.js의 사용자 schema에 이미지 필드 없음), 모든 댓글이 이 기본
  // avatar를 쓴다. 기존 .icon-circle(연한 gray 배경)을 그대로 재사용하고
  // 사람 아이콘 색상만 mint로 오버라이드한다(css/wireframe.css).
  function buildCommentAvatarEl() {
    var avatar = document.createElement('span');
    avatar.className = 'icon-circle md comment-avatar';
    var icon = document.createElement('i');
    icon.className = 'fa-solid fa-user';
    icon.setAttribute('aria-hidden', 'true');
    avatar.appendChild(icon);
    return avatar;
  }

  function buildCommentItemEl(comment) {
    var li = document.createElement('li');
    li.className = 'comment-item';
    li.appendChild(buildCommentAvatarEl());

    var body = document.createElement('div');
    body.className = 'comment-body';

    var meta = document.createElement('div');
    meta.className = 'comment-meta';
    var authorSpan = document.createElement('span');
    authorSpan.textContent = comment.author;
    var dateSpan = document.createElement('span');
    dateSpan.textContent = formatDate(comment.createdAt);
    meta.appendChild(authorSpan);
    meta.appendChild(dateSpan);

    var text = document.createElement('p');
    text.className = 'comment-text';
    text.textContent = comment.content;

    var actions = document.createElement('div');
    actions.className = 'comment-actions';
    ['답글', '신고'].forEach(function (label) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = label;
      actions.appendChild(btn);
    });

    body.appendChild(meta);
    body.appendChild(text);
    body.appendChild(actions);
    li.appendChild(body);
    return li;
  }

  // 댓글 수/목록을 실제 데이터(readCommentsForPost) 하나만 기준으로 다시
  // 그린다 -- 새로고침 없이 등록/게시글 전환 시마다 이 함수 한 번으로
  // 헤더 카운트/상단 메타 카운트/목록/empty state가 전부 동기화된다.
  function renderComments(postId, seedComments) {
    var listEl = document.getElementById('board-view-comment-list');
    if (!listEl) return;

    var comments = readCommentsForPost(postId, seedComments);

    listEl.innerHTML = '';
    comments.forEach(function (comment) {
      listEl.appendChild(buildCommentItemEl(comment));
    });
    listEl.hidden = comments.length === 0;

    var emptyEl = document.getElementById('board-view-comment-empty');
    if (emptyEl) emptyEl.hidden = comments.length !== 0;

    var headingEl = document.getElementById('board-view-comment-heading');
    if (headingEl) headingEl.textContent = '댓글 ' + comments.length;

    var countEl = document.getElementById('board-view-comment-count');
    if (countEl) countEl.textContent = '댓글 ' + comments.length;
  }

  function wireCommentForm(postId, seedComments) {
    var form = document.querySelector('.comment-form');
    if (!form) return;
    var textarea = form.querySelector('.input-textarea');

    // preventDefault가 핵심이다 -- 이게 없으면 기본 GET 폼 제출이 발생해
    // board-view.html?id=... 의 쿼리(id)가 통째로 사라진 채 페이지가
    // 새로고침되고, 그 결과 다시 목록의 첫 sample 글로 빠지면서 "댓글 등록
    // 직후 다른 글의 sample 댓글/카운트가 나타나는" 것처럼 보이는 버그가
    // 발생했다.
    form.addEventListener('submit', function (event) {
      event.preventDefault();

      var value = textarea ? textarea.value.trim() : '';
      if (!value) return;

      var currentUser = window.MomentripAuth ? window.MomentripAuth.getCurrentUser() : null;
      if (!currentUser) {
        window.alert('로그인이 필요합니다.');
        window.location.href = 'board-login.html?next=' + encodeURIComponent('board-view.html' + window.location.search);
        return;
      }

      addCommentForPost(postId, seedComments, {
        author: currentUser.nickname,
        content: value,
        createdAt: new Date().toISOString()
      });

      if (textarea) textarea.value = '';
      renderComments(postId, seedComments);
    });
  }

  // 이전글/다음글: SAMPLE_POSTS+CRUD를 합친 동일한 최신순 목록(initBoardList와
  // 같은 정렬 기준)에서 현재 글의 앞뒤를 찾는다. "다음글"은 더 최신 글(배열의
  // 한 칸 앞), "이전글"은 더 오래된 글(배열의 한 칸 뒤)이다. 글 목록 맨 앞/뒤에
  // 있으면 해당 행 자체를 숨긴다 -- 디자인/CSS는 그대로 두고 href/텍스트만 채움.
  function wirePostNav(currentPost) {
    var allPosts = SAMPLE_POSTS.concat(readPosts()).sort(function (a, b) {
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    var index = -1;
    for (var i = 0; i < allPosts.length; i++) {
      if (allPosts[i].id === currentPost.id) {
        index = i;
        break;
      }
    }
    if (index === -1) return;

    var olderPost = index + 1 < allPosts.length ? allPosts[index + 1] : null;
    var newerPost = index > 0 ? allPosts[index - 1] : null;

    var prevRow = document.getElementById('board-view-prev-row');
    var prevLink = document.getElementById('board-view-prev-link');
    if (prevRow && prevLink) {
      if (olderPost) {
        prevLink.href = 'board-view.html?id=' + encodeURIComponent(olderPost.id);
        prevLink.textContent = olderPost.title;
        prevRow.hidden = false;
      } else {
        prevRow.hidden = true;
      }
    }

    var nextRow = document.getElementById('board-view-next-row');
    var nextLink = document.getElementById('board-view-next-link');
    if (nextRow && nextLink) {
      if (newerPost) {
        nextLink.href = 'board-view.html?id=' + encodeURIComponent(newerPost.id);
        nextLink.textContent = newerPost.title;
        nextRow.hidden = false;
      } else {
        nextRow.hidden = true;
      }
    }
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
  // board-list.html: SAMPLE_POSTS(실제 사용자 게시글처럼 구성한 샘플, 17장의
  // community 이미지를 활용)와 CRUD 게시글(momentrip-board-posts)을 합쳐
  // 최신순으로 렌더링한다. 더 이상 손으로 쓴 정적 카드는 없다 -- 목록/상세가
  // 항상 SAMPLE_POSTS/readPosts()라는 같은 데이터를 가리키게 하기 위함.
  // ------------------------------------------------------------------------
  (function initBoardList() {
    var feed = document.querySelector('.post-feed');
    if (!feed) return;

    var posts = SAMPLE_POSTS.concat(readPosts()).sort(function (a, b) {
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
      // SAMPLE_POSTS는 IndexedDB가 아니라 실제 정적 파일 경로(post.thumbnail)를
      // 쓰므로 비동기 조회 없이 바로 붙인다 -- board-write.html 이미지
      // width preset 로직이나 attachments.js는 전혀 건드리지 않는다.
      if (post.isSample) {
        if (!post.thumbnail) return;
        var sampleThumbWrap = document.createElement('div');
        sampleThumbWrap.className = 'ph-box ratio-4-3 post-card-thumb';
        var sampleImg = document.createElement('img');
        sampleImg.src = post.thumbnail;
        sampleImg.alt = post.thumbnailAlt || post.title;
        sampleThumbWrap.appendChild(sampleImg);
        anchorEl.insertBefore(sampleThumbWrap, anchorEl.firstChild);
        return;
      }

      if (!window.MomentripAttachments) return;

      window.MomentripAttachments.get(post.id).then(function (records) {
        var firstImage = null;

        if (Array.isArray(post.contentBlocks) && post.contentBlocks.length) {
          // inline editor로 작성된 게시글: 실제 작성 순서(contentBlocks)
          // 기준으로 첫 image block을 찾는다 -- 동영상은 대상에서 제외.
          var mediaMap = buildMediaIndexMap(records);
          for (var b = 0; b < post.contentBlocks.length; b++) {
            var block = post.contentBlocks[b];
            if (block.type === 'image' && mediaMap[block.mediaIndex]) {
              firstImage = mediaMap[block.mediaIndex];
              break;
            }
          }
        } else {
          // 기존(레거시) 게시글: 기존 그대로 IndexedDB 반환 순서 기준.
          for (var k = 0; k < records.length; k++) {
            if (records[k].type === 'image') {
              firstImage = records[k];
              break;
            }
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

      // 댓글 수는 화면 DOM 개수가 아니라 항상 readCommentsForPost()의 실제
      // 데이터 배열 length 기준이다 -- sample/CRUD 모두 동일한 단일 기준.
      var commentCount = readCommentsForPost(post.id, post.sampleComments).length;

      var statsWrap = document.createElement('div');
      statsWrap.className = 'post-card-stats';
      statsWrap.appendChild(buildStat('fa-eye', '조회 ' + post.views));
      statsWrap.appendChild(buildStat('fa-comment', '댓글 ' + commentCount));
      statsWrap.appendChild(buildStat('fa-heart', '좋아요 ' + (typeof post.likes === 'number' ? post.likes : 0)));

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

    // ---- 본문 인라인 에디터 (네이버 카페형 단일 surface) ----
    // editorBlocks가 유일한 진실 소스: 화면에 보이는 순서 = 저장될 순서.
    // { type:'text', el } | { type:'image'|'video', el, file, url, width }
    // text block은 여러 개의 독립된 input box가 아니라 border/background
    // 없는 contenteditable div로, editor 전체가 하나의 문서처럼 보이도록 한다.
    var contentEditorEl = document.getElementById('content-editor');
    var attachmentInput = document.getElementById('board-post-attachments');
    var editorBlocks = [];
    var activeTextBlock = null; // 가장 최근에 focus된 text block -- media 삽입 위치 기준
    var selectedMediaBlock = null; // 현재 선택된(mint outline) media block

    var MEDIA_WIDTHS = ['50%', '75%', '100%'];
    var DEFAULT_MEDIA_WIDTH = '100%';

    // 상단 단일 toolbar: block마다 반복되던 "+ 추가" 버튼을 이걸로 대체한다.
    var toolbarEl = document.createElement('div');
    toolbarEl.className = 'editor-toolbar';
    var addMediaBtn = document.createElement('button');
    addMediaBtn.type = 'button';
    addMediaBtn.className = 'editor-toolbar-btn';
    var addMediaIcon = document.createElement('i');
    addMediaIcon.className = 'fa-solid fa-image';
    addMediaIcon.setAttribute('aria-hidden', 'true');
    addMediaBtn.appendChild(addMediaIcon);
    addMediaBtn.appendChild(document.createTextNode(' 이미지·동영상 추가'));
    toolbarEl.appendChild(addMediaBtn);
    contentEditorEl.appendChild(toolbarEl);

    function deselectMediaBlock() {
      if (!selectedMediaBlock) return;
      selectedMediaBlock.el.classList.remove('is-selected');
      selectedMediaBlock = null;
    }

    function selectMediaBlock(block) {
      if (selectedMediaBlock === block) return;
      deselectMediaBlock();
      selectedMediaBlock = block;
      block.el.classList.add('is-selected');
    }

    // 에디터 바깥(제목 등) 또는 다른 block을 클릭하면 선택 해제한다.
    document.addEventListener('click', function (event) {
      if (selectedMediaBlock && !selectedMediaBlock.el.contains(event.target)) {
        deselectMediaBlock();
      }
    });

    function isTextBlockEmpty(block) {
      return block.el.innerText === '';
    }

    function updateTextBlockEmptyState(block) {
      block.el.classList.toggle('is-empty', isTextBlockEmpty(block));
    }

    function createTextBlock(initialValue, placeholder) {
      var el = document.createElement('div');
      el.className = 'content-block-text';
      el.contentEditable = 'true';
      if (placeholder) el.setAttribute('data-placeholder', placeholder);
      el.textContent = initialValue || '';

      var block = { type: 'text', el: el };
      updateTextBlockEmptyState(block);

      el.addEventListener('focus', function () {
        activeTextBlock = block;
      });

      el.addEventListener('input', function () {
        updateTextBlockEmptyState(block);
      });

      // Enter는 줄바꿈만 하도록 고정한다(브라우저마다 다른 <div>/<p> 분리
      // 대신 항상 <br> 삽입 -- 값을 읽을 때(.innerText) 줄바꿈이 일관되게
      // 반영되고, form submit으로 이어지는 요소가 애초에 없다).
      el.addEventListener('keydown', function (event) {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        document.execCommand('insertLineBreak');
      });

      return block;
    }

    // file은 신규 첨부면 File, 수정 모드에서 기존 첨부를 복원한 경우는
    // IndexedDB record.blob(Blob) -- attachments.js의 save()는 둘 다
    // 그대로 받아들이므로 구분 없이 동일하게 다룬다.
    function createMediaBlock(type, file, url, width) {
      var el = document.createElement('div');
      el.className = 'content-block-media post-attachment-item';
      el.style.width = width || DEFAULT_MEDIA_WIDTH;

      var mediaEl;
      if (type === 'image') {
        mediaEl = document.createElement('img');
        mediaEl.src = url;
        mediaEl.alt = (file && file.name) || '첨부 이미지';
      } else {
        mediaEl = document.createElement('video');
        mediaEl.src = url;
        mediaEl.controls = true;
      }
      el.appendChild(mediaEl);

      var block = { type: type, el: el, file: file, url: url, width: width || DEFAULT_MEDIA_WIDTH };

      // 선택(mint outline) 시에만 드러나는 media용 mini toolbar: width
      // preset(이미지/동영상 공통) + 이 media 바로 뒤에 text block 삽입(이미지
      // 사이에 글을 쓰고 싶을 때 쓰는 명시적 삽입 지점) + 삭제.
      var toolbar = document.createElement('div');
      toolbar.className = 'content-block-media-toolbar';

      MEDIA_WIDTHS.forEach(function (widthOption) {
        var widthBtn = document.createElement('button');
        widthBtn.type = 'button';
        widthBtn.className = 'media-toolbar-btn media-width-btn';
        widthBtn.textContent = widthOption;
        widthBtn.classList.toggle('is-active', block.width === widthOption);
        widthBtn.addEventListener('click', function (event) {
          event.stopPropagation();
          block.width = widthOption;
          el.style.width = widthOption;
          toolbar.querySelectorAll('.media-width-btn').forEach(function (btn) {
            btn.classList.toggle('is-active', btn === widthBtn);
          });
        });
        toolbar.appendChild(widthBtn);
      });

      var addTextBtn = document.createElement('button');
      addTextBtn.type = 'button';
      addTextBtn.className = 'media-toolbar-btn';
      addTextBtn.textContent = '텍스트 추가';
      addTextBtn.addEventListener('click', function (event) {
        event.stopPropagation();
        var newTextBlock = createTextBlock('');
        insertBlockAfter(block, newTextBlock);
        newTextBlock.el.focus();
      });
      toolbar.appendChild(addTextBtn);

      var removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'media-toolbar-btn media-toolbar-remove-btn';
      removeBtn.setAttribute('aria-label', '첨부 삭제');
      removeBtn.textContent = '삭제';
      removeBtn.addEventListener('click', function (event) {
        event.stopPropagation();
        URL.revokeObjectURL(block.url);
        var idx = editorBlocks.indexOf(block);
        if (idx !== -1) editorBlocks.splice(idx, 1);
        if (selectedMediaBlock === block) selectedMediaBlock = null;
        block.el.remove();
      });
      toolbar.appendChild(removeBtn);

      el.appendChild(toolbar);

      el.addEventListener('click', function (event) {
        if (event.target.closest('button')) return;
        selectMediaBlock(block);
      });

      return block;
    }

    function appendBlock(block) {
      editorBlocks.push(block);
      contentEditorEl.appendChild(block.el);
    }

    // afterBlock이 null이면 맨 앞에 삽입(현재는 항상 실제 block 뒤에만
    // 삽입하므로 실질적으로는 방어적 분기) -- array/DOM 삽입 위치가 항상
    // 같은 기준(0 = 맨 앞)을 쓰도록 통일한다. toolbarEl은 editorBlocks에
    // 들어있지 않으므로 항상 맨 앞에 그대로 남는다.
    function insertBlockAfter(afterBlock, block) {
      var idx = editorBlocks.indexOf(afterBlock);
      var insertIndex = idx === -1 ? 0 : idx + 1;
      editorBlocks.splice(insertIndex, 0, block);

      var refNode = afterBlock ? afterBlock.el.nextSibling : toolbarEl.nextSibling;
      contentEditorEl.insertBefore(block.el, refNode);
    }

    function clearEditorBlocks() {
      editorBlocks.forEach(function (block) { block.el.remove(); });
      editorBlocks = [];
      activeTextBlock = null;
      selectedMediaBlock = null;
    }

    // 최초 진입 기본 상태: 빈 text block 1개(수정 모드면 아래에서 다시 채움).
    // placeholder는 이 최초 block에만 붙여, media 삽입 뒤 자동 생성되는
    // 빈 block들에는 "이야기를..." 문구가 반복되지 않게 한다.
    appendBlock(createTextBlock('', '이야기를 자유롭게 남겨주세요'));

    addMediaBtn.addEventListener('click', function () {
      attachmentInput.click();
    });

    attachmentInput.addEventListener('change', function () {
      var files = Array.prototype.slice.call(attachmentInput.files);
      // 삽입 기준점: 가장 최근에 focus됐던 text block, 없으면(=아직 본문을
      // 한 번도 클릭하지 않은 상태) 에디터의 마지막 block 뒤에 삽입한다.
      var anchor = activeTextBlock || editorBlocks[editorBlocks.length - 1];

      var lastInserted = anchor;
      files.forEach(function (file) {
        var isImage = file.type.indexOf('image/') === 0;
        var isVideo = file.type.indexOf('video/') === 0;
        if (!isImage && !isVideo) return;

        var mediaBlock = createMediaBlock(isImage ? 'image' : 'video', file, URL.createObjectURL(file));
        insertBlockAfter(lastInserted, mediaBlock);
        lastInserted = mediaBlock;
      });

      // media 삽입 뒤 바로 이어 쓸 수 있도록 새 text block을 자동으로 추가한다.
      if (lastInserted !== anchor) {
        var trailingTextBlock = createTextBlock('');
        insertBlockAfter(lastInserted, trailingTextBlock);
        activeTextBlock = trailingTextBlock;
      }

      // 같은 파일을 다시 골라도 change가 또 발생하도록 매번 비운다.
      attachmentInput.value = '';
    });

    // submit 시 editorBlocks를 화면 순서 그대로 저장용 contentBlocks +
    // IndexedDB에 넘길 fileEntries로 직렬화한다. 완전히 비어있는(사용자가
    // 손대지 않은) text block만 제거하고, 공백/줄바꿈을 실제로 입력한
    // 경우는 그대로 보존한다.
    function serializeContentBlocks() {
      var contentBlocks = [];
      var fileEntries = [];

      editorBlocks.forEach(function (block) {
        if (block.type === 'text') {
          if (isTextBlockEmpty(block)) return;
          contentBlocks.push({ type: 'text', value: block.el.innerText });
        } else {
          contentBlocks.push({ type: block.type, mediaIndex: fileEntries.length, width: block.width });
          fileEntries.push({ type: block.type, file: block.file });
        }
      });

      return { contentBlocks: contentBlocks, fileEntries: fileEntries };
    }

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

        // ---- 본문 인라인 에디터 복원 ----
        // 최초 진입 시 만들어둔 기본 빈 text block을 지우고, 실제 저장된
        // 순서대로 다시 채운다.
        if (window.MomentripAttachments) {
          window.MomentripAttachments.get(editingPost.id).then(function (existingAttachments) {
            clearEditorBlocks();

            if (Array.isArray(editingPost.contentBlocks) && editingPost.contentBlocks.length) {
              var mediaMap = buildMediaIndexMap(existingAttachments);
              editingPost.contentBlocks.forEach(function (savedBlock) {
                if (savedBlock.type === 'text') {
                  appendBlock(createTextBlock(savedBlock.value));
                  return;
                }
                var record = mediaMap[savedBlock.mediaIndex];
                if (!record) return; // 참조하는 첨부가 사라진 경우 방어적으로 건너뜀
                appendBlock(createMediaBlock(record.type, record.blob, URL.createObjectURL(record.blob), savedBlock.width));
              });
              if (!editorBlocks.length) appendBlock(createTextBlock(''));
            } else {
              // contentBlocks가 없는 기존(레거시) 게시글: 문자열 content를
              // text block 1개로 불러오고, 기존 첨부가 있다면(순서 정보가
              // 없으므로) DB가 반환한 순서 그대로 뒤에 이어붙인다 -- 기존
              // 데이터를 잃지 않는 것이 우선.
              appendBlock(createTextBlock(editingPost.content || ''));
              existingAttachments.forEach(function (record) {
                appendBlock(createMediaBlock(record.type, record.blob, URL.createObjectURL(record.blob)));
              });
            }
          });
        } else {
          // MomentripAttachments 자체를 쓸 수 없는 극단적 환경: 텍스트만이라도 복원.
          clearEditorBlocks();
          appendBlock(createTextBlock(editingPost.content || ''));
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
      var serialized = serializeContentBlocks();
      var contentBlocksToSave = serialized.contentBlocks;
      var fileEntries = serialized.fileEntries;
      // 레거시 content 필드(board-list 카드 요약 등 기존 소비처와의 호환)는
      // block 순서대로 이어붙인 text만으로 그대로 채운다.
      var content = contentBlocksToSave
        .filter(function (block) { return block.type === 'text'; })
        .map(function (block) { return block.value; })
        .join('\n')
        .trim();

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
            posts[j].contentBlocks = contentBlocksToSave;
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
        contentBlocks: contentBlocksToSave,
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
    if (!id) {
      window.location.href = 'board-list.html';
      return;
    }

    // CRUD 게시글을 먼저 찾고, 없으면 SAMPLE_POSTS(sample-N id)에서 찾는다.
    // 이 파일 안에서는 이 하나의 post 변수가 이후 렌더링(제목/본문/PLACE
    // INFO/태그/댓글/이전글·다음글/좋아요) 전체의 유일한 데이터 기준이다 --
    // sample과 CRUD를 갈라서 따로 렌더링하는 코드 경로를 만들지 않는다.
    var posts = readPosts();
    var post = null;
    for (var i = 0; i < posts.length; i++) {
      if (posts[i].id === id) {
        post = posts[i];
        break;
      }
    }
    if (!post) {
      for (var s = 0; s < SAMPLE_POSTS.length; s++) {
        if (SAMPLE_POSTS[s].id === id) {
          post = SAMPLE_POSTS[s];
          break;
        }
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

        wirePlaceInfoActions(post.id, post.place, formatRegion(post.region));
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

    // 본문 + 첨부 이미지/동영상: IndexedDB 조회가 비동기라 나머지 렌더링을
    // 기다리게 하지 않고 준비되는 대로 붙인다.
    // - contentBlocks가 있는(inline editor로 작성된) 게시글: #board-view-content
    //   안에 text(<p>)/image·video(.post-attachment-item)를 작성 순서 그대로
    //   섞어 렌더링한다. #board-view-attachments는 쓰지 않는다(미디어가 이미
    //   본문 안에 있으므로 별도 갤러리로 중복 표시하지 않음).
    // - contentBlocks가 없는 기존 게시글: 기존 그대로 #board-view-content에
    //   문자열 content만, 첨부는 #board-view-attachments에 순서 없이 모아
    //   보여준다 -- 동작을 바꾸지 않는다.
    var contentEl = document.getElementById('board-view-content');
    var attachmentsEl = document.getElementById('board-view-attachments');
    var hasContentBlocks = Array.isArray(post.contentBlocks) && post.contentBlocks.length > 0;

    if (post.isSample) {
      // SAMPLE_POSTS의 이미지는 IndexedDB 블롭이 아니라 assets/images/community의
      // 실제 정적 파일 경로(block.src)라 비동기 조회 없이 바로 렌더링한다.
      // 그 외 구조(text는 <p>, image는 .post-attachment-item + width 반영)는
      // 아래 CRUD contentBlocks 분기와 동일하게 맞춘다.
      if (contentEl) {
        contentEl.innerHTML = '';
        post.contentBlocks.forEach(function (block) {
          if (block.type === 'text') {
            if (!block.value) return;
            var sampleP = document.createElement('p');
            sampleP.textContent = block.value;
            contentEl.appendChild(sampleP);
            return;
          }

          var sampleFigure = document.createElement('figure');
          sampleFigure.className = 'post-attachment-item';
          sampleFigure.style.width = block.width || '100%';
          sampleFigure.style.maxWidth = '100%';
          sampleFigure.style.marginLeft = 'auto';
          sampleFigure.style.marginRight = 'auto';

          var sampleImg = document.createElement('img');
          sampleImg.src = block.src;
          sampleImg.alt = block.alt || post.title;
          sampleFigure.appendChild(sampleImg);

          contentEl.appendChild(sampleFigure);
        });
      }
    } else if (hasContentBlocks) {
      if (window.MomentripAttachments) {
        window.MomentripAttachments.get(post.id).then(function (records) {
          var mediaMap = buildMediaIndexMap(records);

          // static sample용 하드코딩 <p>/<figure>를 비우고 시작한다 -- 지우지
          // 않으면 CRUD 블록 콘텐츠가 그 뒤에 그냥 이어붙는다. 빈 문자열
          // 대입이라 sanitize 대상 없음(사용자 입력을 넣는 게 아니라 기존
          // 자식만 제거).
          if (contentEl) contentEl.innerHTML = '';

          post.contentBlocks.forEach(function (block) {
            if (block.type === 'text') {
              if (!contentEl || !block.value) return;
              var p = document.createElement('p');
              p.textContent = block.value;
              contentEl.appendChild(p);
              return;
            }

            var record = mediaMap[block.mediaIndex];
            if (!record || !contentEl) return;

            var url = URL.createObjectURL(record.blob);
            var figure = document.createElement('figure');
            figure.className = 'post-attachment-item';
            // 작성 화면에서 고른 width(50/75/100%)를 그대로 반영한다.
            // .post-attachment-item img/video가 이미 width:100%이므로,
            // 이 figure 자체의 폭만 좁히면 이미지가 그 비율로 줄어든다 --
            // 퍼센트 기준이 항상 반응형 부모(.post-body, min(100%,760px))라
            // Tablet/Mobile에서도 별도 처리 없이 자동으로 좁아진다.
            figure.style.width = block.width || '100%';
            figure.style.maxWidth = '100%';
            figure.style.marginLeft = 'auto';
            figure.style.marginRight = 'auto';

            if (block.type === 'image') {
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

            contentEl.appendChild(figure);
          });
        });
      }
    } else {
      // 줄바꿈은 CSS white-space:pre-line(#board-view-content)로 유지 -- innerHTML+<br> 변환 없음.
      if (contentEl) contentEl.textContent = post.content;

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
    }

    var authorEl = document.getElementById('board-view-author');
    if (authorEl) authorEl.textContent = post.author;

    var dateEl = document.getElementById('board-view-date');
    if (dateEl) dateEl.textContent = formatDate(post.createdAt);

    var viewsEl = document.getElementById('board-view-views');
    if (viewsEl) viewsEl.textContent = '조회 ' + post.views;

    // 좋아요는 이번 작업 범위 밖(카운트 표시만) -- CRUD 글은 필드 자체가
    // 없으므로 기존과 동일하게 0으로 표시되고, 실제 좋아요 클릭/토글
    // 기능(post-actions의 하트 버튼)은 건드리지 않는다.
    var likesEl = document.getElementById('board-view-likes');
    if (likesEl) likesEl.textContent = '좋아요 ' + (typeof post.likes === 'number' ? post.likes : 0);

    // 댓글은 실제 데이터(readCommentsForPost) 하나만 기준으로 렌더링한다 --
    // sample 게시글의 seedComments도 여기서 함께 전달해 첫 진입 시 자연스럽게
    // 보이게 하고, CRUD 게시글은 seedComments가 없으니 항상 실제 저장된
    // 댓글만(없으면 0개) 반영한다.
    renderComments(post.id, post.sampleComments);
    wireCommentForm(post.id, post.sampleComments);

    wirePostNav(post);

    // SAMPLE_POSTS는 CRUD가 아니므로 수정/삭제 대상이 아니다 -- 작성자 전용
    // 관리 버튼 영역 자체를 숨긴다.
    var ownerActionsEl = document.querySelector('.post-owner-actions');
    if (post.isSample) {
      if (ownerActionsEl) ownerActionsEl.hidden = true;
    } else {
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

    // 저장한 장소(PLACE INFO의 momentrip-saved-places, 사용자별 분리).
    // 저장취소 클릭 시 목록을 통째로 다시 그려서(re-render) 항목 제거/빈
    // 상태 전환을 새로고침 없이 반영한다 -- toggleSavedPlace는 이미 정상
    // 동작 중인 PLACE INFO 저장취소와 완전히 동일한 함수를 그대로 쓴다.
    var placesListEl = document.getElementById('mypage-places-list');
    var placesEmptyEl = document.getElementById('mypage-places-empty');

    function renderSavedPlacesList() {
      if (!placesListEl) return;

      // 원본 배열을 정렬용으로 mutate하지 않도록 복사본에서만 정렬한다.
      var places = (readSavedPlacesStore()[currentUser.id] || [])
        .slice()
        .sort(function (a, b) { return new Date(b.savedAt) - new Date(a.savedAt); });

      placesListEl.innerHTML = '';

      if (!places.length) {
        if (placesEmptyEl) placesEmptyEl.hidden = false;
        return;
      }
      if (placesEmptyEl) placesEmptyEl.hidden = true;

      var fragment = document.createDocumentFragment();

      places.forEach(function (place) {
        var li = document.createElement('li');
        li.className = 'mypage-place-item';

        // 저장 당시 게시글이 이후 삭제됐을 수도 있으므로, 지금도 유효한
        // 이동 대상일 때만 <a>로 만든다 -- 없으면 <div>(비활성, 클릭 없음)
        // 로 대체해 깨진 링크를 만들지 않는다.
        var href = getSavedPlaceLinkHref(place.postId);
        var linkEl = document.createElement(href ? 'a' : 'div');
        linkEl.className = 'mypage-place-link';
        if (href) linkEl.href = href;

        var nameEl = document.createElement('span');
        nameEl.className = 'mypage-place-name';
        nameEl.textContent = place.name;
        linkEl.appendChild(nameEl);

        var secondaryText = formatPlaceSecondaryText(place);
        if (secondaryText) {
          var locationEl = document.createElement('span');
          locationEl.className = 'mypage-place-location';
          locationEl.textContent = secondaryText;
          linkEl.appendChild(locationEl);
        }

        var cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'btn mypage-place-cancel';
        cancelBtn.textContent = '저장취소';
        cancelBtn.addEventListener('click', function () {
          // 삭제 전용 호출 -- 이 목록에 있는 postId는 항상 이미 저장된
          // 상태이므로 toggleSavedPlace는 항상 splice(제거) 분기만 탄다.
          toggleSavedPlace(currentUser.id, place.postId, null, null);
          renderSavedPlacesList();
        });

        li.appendChild(linkEl);
        li.appendChild(cancelBtn);
        fragment.appendChild(li);
      });

      placesListEl.appendChild(fragment);
    }

    renderSavedPlacesList();

    // Header/Drawer 로그아웃과 동일한 confirm+reload 로직을 재사용 --
    // 이 페이지 전용 로그아웃 코드를 새로 만들지 않는다.
    var logoutBtn = document.getElementById('mypage-logout-button');
    if (logoutBtn && window.MomentripAuth) {
      logoutBtn.addEventListener('click', window.MomentripAuth.performLogout);
    }
  })();
})();
