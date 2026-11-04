/* Small helpers for every page. */
(function () {
  // Plan page: filter places by category
  var filters = document.querySelector('.filters');
  if (filters) {
    filters.addEventListener('click', function (e) {
      var b = e.target.closest('[data-filter]'); if (!b) return;
      var f = b.dataset.filter;
      filters.querySelectorAll('[data-filter]').forEach(function (x) { x.classList.toggle('is-on', x === b); });
      document.querySelectorAll('.plan-group').forEach(function (g) { g.hidden = f !== 'all' && g.dataset.cat !== f; });
    });
  }

  // Home page: show map changes you haven't saved yet
  var stats = document.querySelector('[data-stats]');
  if (stats) {
    try {
      var d = JSON.parse(localStorage.getItem('sa-visited-pending') || 'null');
      var s = JSON.parse(localStorage.getItem('sa-visited-saved') || 'null');
      if (!d && s && Date.now() - s.at < 15 * 60 * 1000) d = s.data;
      if (d) {
        var cs = {};
        (d.regions || []).concat(d.capitals || []).forEach(function (x) { cs[x.c] = 1; });
        stats.querySelector('[data-stat="countries"]').textContent = Object.keys(cs).length;
        stats.querySelector('[data-stat="regions"]').textContent = (d.regions || []).length;
        stats.querySelector('[data-stat="capitals"]').textContent = (d.capitals || []).length;
      }
    } catch (e) {}
  }
})();
