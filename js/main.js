document.querySelectorAll('.favorite-toggle').forEach(function (button) {
  button.addEventListener('click', function (event) {
    event.stopPropagation();

    var isActive = button.classList.toggle('is-active');
    button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
});
