var mapCenterPosition = new naver.maps.LatLng(37.5443, 127.0374);

var map = new naver.maps.Map('map', {
  center: mapCenterPosition,
  zoom: 15
});

var resizeTimer = null;

function handleMapResize() {
  naver.maps.Event.trigger(map, 'resize');
  map.setCenter(mapCenterPosition);
}

window.addEventListener('resize', function () {
  if (resizeTimer) clearTimeout(resizeTimer);
  resizeTimer = setTimeout(handleMapResize, 250);
});

/* Hero "오늘 인기 Spot" <-> MAP marker link. Temporary prototype coordinates
   near Seongsu/Seoul Forest, distinct enough from each other; map center/zoom
   above are untouched -- only markers are added to the existing map instance. */
var heroSpots = {
  cafe: new naver.maps.LatLng(37.5445, 127.0401),
  picnic: new naver.maps.LatLng(37.5387, 127.0356),
  gallery: new naver.maps.LatLng(37.5469, 127.0413)
};

Object.keys(heroSpots).forEach(function (spotId) {
  new naver.maps.Marker({
    position: heroSpots[spotId],
    map: map
  });
});

var heroSpotItems = document.querySelectorAll('.hero-spot-item');

function selectHeroSpot(item) {
  var spotId = item.getAttribute('data-spot-id');
  var position = heroSpots[spotId];
  if (!position) return;

  map.panTo(position);
  /* Keep the resize handler's re-centering in sync with the spot the user
     last selected, so a resize right after a click doesn't snap the map
     back to the original default center. */
  mapCenterPosition = position;

  heroSpotItems.forEach(function (el) {
    el.classList.remove('is-active');
  });
  item.classList.add('is-active');
}

heroSpotItems.forEach(function (item) {
  item.addEventListener('click', function () {
    selectHeroSpot(item);
  });

  item.addEventListener('keydown', function (event) {
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault();
      selectHeroSpot(item);
    }
  });
});
