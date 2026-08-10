var map = new naver.maps.Map('map', {
  center: new naver.maps.LatLng(37.5443, 127.0374),
  zoom: 15
});

var mapEl = document.getElementById('map');

function resizeMap() {
  if (!map || !mapEl) return;

  map.setSize(
    new naver.maps.Size(mapEl.clientWidth, mapEl.clientHeight)
  );
}

window.addEventListener('resize', resizeMap);
