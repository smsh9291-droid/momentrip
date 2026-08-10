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
