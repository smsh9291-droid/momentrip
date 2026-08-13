// 실제 사용자 게시글처럼 보이는 샘플 데이터 (와이어프레임 더미 대체).
// 원래 js/board.js 내부에만 있던 지역 변수였으나, index.html의 메인 카드
// (MOMENTRIP PICK/HOT/주변 인기 장소/지역 행사/커뮤니티 미리보기)도 동일한
// 데이터를 가리켜야 해서 이 파일로 분리했다 -- board.js와 main.js가 각자
// 다른 사본을 유지하지 않고 window.MomentripSamplePosts 하나만 공유한다.
// board-list.html/board-view.html/board-write.html/index.html 모두 이
// 파일을 로드한다(각 페이지의 js/main.js보다 먼저 -- index.html의 카드
// 연동 코드가 로드 시점에 바로 읽을 수 있어야 하기 때문).
//
// - thumbnail: contentBlocks의 첫 image block에서 자동으로 뽑는다(아래
//   IIFE). board-list 썸네일과 상세 첫 이미지가 항상 같은 파일이 되도록
//   보장하기 위해 수동으로 따로 지정하지 않는다.
// - place: 실제로 알 수 없는 운영시간/주차 등은 절대 지어내지 않고
//   name/address(모르면 '')만 채운다. 질문 등 장소 정보가 필요 없는
//   글은 place 자체를 생략한다.
// - address/lat/lng을 모르는 경우 그대로 비워/null로 둔다 -- 길찾기는
//   기존 fallback(장소명+지역 검색)으로 자연스럽게 처리된다.
(function () {
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

  // 목록 썸네일 = 상세 첫 이미지. 손으로 따로 지정하지 않고 contentBlocks에서
  // 그대로 뽑아, 목록/상세/메인이 서로 다른 파일을 가리키는 실수 자체가
  // 불가능하게 한다. isSample 플래그로 CRUD 게시글과 렌더링 경로(IndexedDB
  // 첨부 유무)를 구분한다.
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

  window.MomentripSamplePosts = SAMPLE_POSTS;
})();
