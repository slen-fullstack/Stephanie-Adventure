/* My map: click provinces, states and capitals to mark where you've been. */
(function () {
  var el = document.getElementById('map');
  if (!el || !window.L || !window.topojson) return;

  var PENDING = 'sa-visited-pending';
  var SAVED = 'sa-visited-saved';
  var TOKEN = 'sa-github-token';
  var FILE = 'data/visited.json';
  var WORLD = 195;

  function store(key, val) {
    try { if (val === undefined) localStorage.removeItem(key); else localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  }
  function load(key) {
    try { var s = localStorage.getItem(key); return s ? JSON.parse(s) : null; } catch (e) { return null; }
  }

  // ---------- visited data ----------
  var siteData = JSON.parse(document.getElementById('visited-data').textContent || '{}');
  var data = siteData;
  var pending = load(PENDING);
  var saved = load(SAVED);
  if (pending) data = pending;
  else if (saved && Date.now() - saved.at < 15 * 60 * 1000) data = saved.data; // site is still rebuilding
  data.regions = data.regions || [];
  data.capitals = data.capitals || [];

  var regionsOn = new Set(data.regions.map(function (r) { return r.id; }));
  var capsOn = new Set(data.capitals.map(function (c) { return c.id; }));

  // ---------- map ----------
  var css = getComputedStyle(document.documentElement);
  function v(name) { return css.getPropertyValue(name).trim(); }
  var colors = { land: v('--map-land'), landEdge: v('--map-edge'), gold: v('--map-gold'), goldEdge: v('--map-gold-edge'), border: v('--map-border') };

  var map = L.map(el, {
    preferCanvas: true, worldCopyJump: true, minZoom: 2, maxZoom: 10, zoomSnap: 0.5,
    maxBounds: [[-75, -400], [85, 400]], maxBoundsViscosity: 0.8
  }).setView([20, 10], 2);
  map.attributionControl.setPrefix('').addAttribution('Map data: Natural Earth');
  map.createPane('borders').style.zIndex = 420;
  map.getPane('borders').style.pointerEvents = 'none';
  var canvas = L.canvas({ padding: 0.5, tolerance: 3 });
  var bordersCanvas = L.canvas({ padding: 0.5, pane: 'borders' });

  var regionLayer, regionById = {}, regionsByCountry = {}, countryName = {};
  var capByKey = {}, capMarkers = {}, minorCaps = L.layerGroup(), searchIndex = [];

  function regionStyle(f) {
    var on = regionsOn.has(f.properties.id);
    return { renderer: canvas, color: on ? colors.goldEdge : colors.landEdge, weight: 0.5, fillColor: on ? colors.gold : colors.land, fillOpacity: 1 };
  }

  function starIcon(on, big) {
    var s = on ? (big ? 24 : 16) : (big ? 15 : 10);
    return L.divIcon({
      className: 'cap-star' + (on ? ' is-been' : '') + (big ? ' is-national' : ''),
      html: '<svg viewBox="0 0 100 100"><use href="#spark"/></svg>', iconSize: [s, s], iconAnchor: [s / 2, s / 2]
    });
  }

  Promise.all([el.dataset.regions, el.dataset.countries, el.dataset.capitals].map(function (u) {
    return fetch(u).then(function (r) { if (!r.ok) throw new Error(u); return r.json(); });
  })).then(function (res) {
    el.querySelector('.map-loading') && el.querySelector('.map-loading').remove();
    var rTopo = res[0], cTopo = res[1], caps = res[2];
    var rGeo = topojson.feature(rTopo, rTopo.objects[Object.keys(rTopo.objects)[0]]);
    var cGeo = topojson.feature(cTopo, cTopo.objects[Object.keys(cTopo.objects)[0]]);

    regionLayer = L.geoJSON(rGeo, {
      style: regionStyle,
      onEachFeature: function (f, layer) {
        var p = f.properties;
        regionById[p.id] = layer;
        (regionsByCountry[p.c] = regionsByCountry[p.c] || []).push(p);
        countryName[p.c] = p.a;
        layer.bindTooltip(p.n + ', ' + p.a, { sticky: true, className: 'map-tip', direction: 'top' });
        layer.on('click', function () { openRegion(p); });
      }
    }).addTo(map);

    L.geoJSON(cGeo, { interactive: false, style: { renderer: bordersCanvas, color: colors.border, weight: 1, fill: false } }).addTo(map);
    cGeo.features.forEach(function (f) { if (!countryName[f.properties.id]) countryName[f.properties.id] = f.properties.n; });

    caps.forEach(function (c) {
      var cap = { id: c[0] + '|' + c[1], name: c[0], c: c[1], lat: c[2], lng: c[3], national: c[4] === 1, region: c[5] };
      capByKey[cap.id] = cap;
      var m;
      if (cap.national) {
        m = L.marker([cap.lat, cap.lng], { icon: starIcon(capsOn.has(cap.id), true), riseOnHover: true, keyboard: false }).addTo(map);
      } else {
        m = L.marker([cap.lat, cap.lng], { icon: starIcon(capsOn.has(cap.id), false), keyboard: false });
        minorCaps.addLayer(m);
      }
      m.bindTooltip('★ ' + cap.name + ' · capital of ' + (cap.national ? '' : (cap.region ? cap.region + ', ' : '')) + (countryName[cap.c] || cap.c), { className: 'map-tip', direction: 'top', offset: [0, -6] });
      m.on('click', function () { openCapital(cap); });
      capMarkers[cap.id] = m;
    });

    // Search list
    var opts = [];
    Object.keys(regionsByCountry).forEach(function (c) {
      searchIndex.push({ label: countryName[c], type: 'country', c: c });
      regionsByCountry[c].forEach(function (p) { searchIndex.push({ label: p.n + ', ' + p.a, type: 'region', p: p }); });
    });
    Object.keys(capByKey).forEach(function (k) {
      var cap = capByKey[k];
      searchIndex.push({ label: cap.name + ' (capital), ' + (countryName[cap.c] || cap.c), type: 'capital', cap: cap });
    });
    searchIndex.forEach(function (s) { opts.push('<option value="' + esc(s.label) + '">'); });
    document.getElementById('map-search-list').innerHTML = opts.join('');

    map.on('zoomend', toggleMinor);
    toggleMinor();
    render();
  }).catch(function () {
    el.innerHTML = '<p class="map-loading">Your map could not load. Check your connection and refresh.</p>';
  });

  function toggleMinor() {
    if (map.getZoom() >= 4.5) { if (!map.hasLayer(minorCaps)) map.addLayer(minorCaps); }
    else if (map.hasLayer(minorCaps)) map.removeLayer(minorCaps);
  }

  // ---------- panel ----------
  var panel = document.getElementById('place-panel');
  var actions = panel.querySelector('.panel-actions');
  panel.querySelector('[data-close]').onclick = function () { panel.hidden = true; };

  function button(label, cls, fn) {
    var b = document.createElement('button');
    b.className = 'btn ' + (cls || '');
    b.textContent = label;
    b.onclick = fn;
    actions.appendChild(b);
  }

  function openRegion(p) {
    var on = regionsOn.has(p.id);
    panel.querySelector('[data-kicker]').textContent = (p.t || 'Region') + ' · ' + p.a;
    panel.querySelector('[data-name]').textContent = p.n;
    actions.innerHTML = '';
    button(on ? '✓ You\'ve been here · Remove' : 'I\'ve been here ✨', on ? 'btn-ghost' : '', function () { setRegion(p, !on); openRegion(p); });
    var all = regionsByCountry[p.c] || [];
    var allOn = all.every(function (r) { return regionsOn.has(r.id); });
    if (all.length > 1) {
      button(allOn ? 'Unmark all of ' + p.a : 'Mark all of ' + p.a + ' (' + all.length + ')', 'btn-ghost', function () {
        all.forEach(function (r) { setRegion(r, !allOn, true); });
        changed(); openRegion(p);
      });
    }
    panel.hidden = false;
  }

  function openCapital(cap) {
    var on = capsOn.has(cap.id);
    panel.querySelector('[data-kicker]').textContent = (cap.national ? 'Capital of ' : 'Capital of ' + cap.region + ', ') + (countryName[cap.c] || cap.c);
    panel.querySelector('[data-name]').textContent = cap.name;
    actions.innerHTML = '';
    button(on ? '✓ You\'ve been here · Remove' : 'I\'ve been here ✨', on ? 'btn-ghost' : '', function () {
      setCapital(cap, !on);
      if (!on) { var r = regionOf(cap); if (r) setRegion(r, true, true); }
      changed(); openCapital(cap);
    });
    panel.hidden = false;
  }

  function regionOf(cap) {
    var list = regionsByCountry[cap.c] || [];
    var hit = list.filter(function (r) { return r.n === cap.region; })[0];
    if (hit) return hit;
    // fall back to the region whose shape holds the point
    var pt = L.latLng(cap.lat, cap.lng);
    for (var i = 0; i < list.length; i++) {
      var layer = regionById[list[i].id];
      if (layer && layer.getBounds().contains(pt) && contains(layer.feature.geometry, cap.lng, cap.lat)) return list[i];
    }
    return null;
  }
  function contains(g, x, y) {
    var polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
    return polys.some(function (rings) {
      var inside = false, ring = rings[0];
      for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        var xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
        if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
      }
      return inside;
    });
  }

  // ---------- changes ----------
  function setRegion(p, on, quiet) {
    if (on) regionsOn.add(p.id); else regionsOn.delete(p.id);
    var layer = regionById[p.id];
    if (layer) layer.setStyle(regionStyle(layer.feature));
    if (!quiet) changed();
  }
  function setCapital(cap, on) {
    if (on) capsOn.add(cap.id); else capsOn.delete(cap.id);
    var m = capMarkers[cap.id];
    if (m) m.setIcon(starIcon(on, cap.national));
  }

  function snapshot() {
    var regions = [], capitals = [];
    regionsOn.forEach(function (id) {
      var l = regionById[id]; if (!l) return;
      var p = l.feature.properties;
      regions.push({ id: id, name: p.n, country: p.a, c: p.c });
    });
    capsOn.forEach(function (id) {
      var cap = capByKey[id]; if (!cap) return;
      capitals.push({ id: id, name: cap.name, country: countryName[cap.c] || cap.c, c: cap.c });
    });
    var by = function (a, b) { return (a.country + a.name).localeCompare(b.country + b.name); };
    return { regions: regions.sort(by), capitals: capitals.sort(by) };
  }

  function changed() {
    var snap = snapshot();
    if (JSON.stringify(snap) === JSON.stringify(normal(siteData))) store(PENDING); else store(PENDING, snap);
    render();
  }
  function normal(d) {
    var by = function (a, b) { return (a.country + a.name).localeCompare(b.country + b.name); };
    return { regions: (d.regions || []).slice().sort(by), capitals: (d.capitals || []).slice().sort(by) };
  }

  // ---------- render stats, list, save bar ----------
  function render() {
    var snap = snapshot();
    var cs = new Set();
    snap.regions.forEach(function (r) { cs.add(r.c); });
    snap.capitals.forEach(function (c) { cs.add(c.c); });
    setStat('countries', cs.size);
    setStat('regions', snap.regions.length);
    setStat('capitals', snap.capitals.length);
    setStat('percent', Math.round(cs.size / WORLD * 100) + '%');

    var groups = {};
    snap.regions.forEach(function (r) { (groups[r.country] = groups[r.country] || { r: [], k: [] }).r.push(r); });
    snap.capitals.forEach(function (c) { (groups[c.country] = groups[c.country] || { r: [], k: [] }).k.push(c); });
    var names = Object.keys(groups).sort();
    var html = names.length ? names.map(function (n) {
      var g = groups[n];
      var total = (regionsByCountry[(g.r[0] || g.k[0]).c] || []).length;
      return '<div class="been-country"><h3>' + esc(n) + ' <span class="sub">' + g.r.length + (total ? ' of ' + total : '') + ' regions</span></h3><p>' +
        g.r.map(function (r) { return '<button class="chip is-on" data-region="' + esc(r.id) + '">' + esc(r.name) + ' <span aria-label="remove">×</span></button>'; }).join('') +
        g.k.map(function (c) { return '<button class="chip chip-cap" data-cap="' + esc(c.id) + '">★ ' + esc(c.name) + ' <span aria-label="remove">×</span></button>'; }).join('') +
        '</p></div>';
    }).join('') : '<p class="empty">Nothing marked yet. Tap a place on the map to start.</p>';
    document.getElementById('been').innerHTML = html;

    var bar = document.getElementById('save-bar');
    bar.hidden = !load(PENDING);
  }
  function setStat(k, val) { document.querySelectorAll('[data-stat="' + k + '"]').forEach(function (e) { e.textContent = val; }); }

  document.getElementById('been').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.dataset.region) { var l = regionById[b.dataset.region]; if (l) { setRegion(l.feature.properties, false); } }
    if (b.dataset.cap) { var cap = capByKey[b.dataset.cap]; if (cap) { setCapital(cap, false); changed(); } }
  });

  // ---------- search ----------
  var search = document.getElementById('map-search');
  search.addEventListener('change', function () {
    var q = search.value.trim().toLowerCase(); if (!q) return;
    var hit = searchIndex.filter(function (s) { return s.label.toLowerCase() === q; })[0] ||
      searchIndex.filter(function (s) { return s.label.toLowerCase().indexOf(q) === 0; })[0] ||
      searchIndex.filter(function (s) { return s.label.toLowerCase().indexOf(q) > -1; })[0];
    if (!hit) return;
    if (hit.type === 'region') { map.flyToBounds(regionById[hit.p.id].getBounds(), { maxZoom: 7, padding: [30, 30], duration: 1.2 }); openRegion(hit.p); }
    else if (hit.type === 'capital') { map.flyTo([hit.cap.lat, hit.cap.lng], 7, { duration: 1.2 }); openCapital(hit.cap); }
    else {
      var b = L.latLngBounds([]);
      (regionsByCountry[hit.c] || []).forEach(function (p) { b.extend(regionById[p.id].getBounds()); });
      if (b.isValid()) map.flyToBounds(b, { maxZoom: 6, padding: [30, 30], duration: 1.2 });
      openRegion(regionsByCountry[hit.c][0]);
    }
    search.value = '';
  });

  // ---------- save to GitHub ----------
  var msg = document.getElementById('save-msg');
  var dialog = document.getElementById('token-dialog');
  function askToken() {
    return new Promise(function (resolve) {
      var t = load(TOKEN); if (t) return resolve(t);
      if (!dialog.showModal) { resolve(prompt('Paste your GitHub token') || null); return; }
      dialog.returnValue = '';
      dialog.showModal();
      dialog.addEventListener('close', function once() {
        dialog.removeEventListener('close', once);
        var val = document.getElementById('token-input').value.trim();
        if (dialog.returnValue === 'ok' && val) { store(TOKEN, val); resolve(val); } else resolve(null);
      });
    });
  }
  function b64(s) { return btoa(unescape(encodeURIComponent(s))); }

  document.getElementById('save-btn').onclick = function () {
    var repo = el.dataset.repo;
    askToken().then(function (token) {
      if (!token) return;
      msg.textContent = 'Saving…';
      var url = 'https://api.github.com/repos/' + repo + '/contents/' + FILE;
      var headers = { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json' };
      var snap = snapshot();
      fetch(url + '?ref=main', { headers: headers, cache: 'no-store' })
        .then(function (r) { if (r.status === 401 || r.status === 403) throw new Error('auth'); return r.ok ? r.json() : {}; })
        .then(function (cur) {
          return fetch(url, {
            method: 'PUT', headers: headers,
            body: JSON.stringify({ message: 'Update places I\'ve been', content: b64(JSON.stringify(snap, null, 2) + '\n'), sha: cur.sha, branch: 'main' })
          });
        })
        .then(function (r) { if (r.status === 401 || r.status === 403) throw new Error('auth'); if (!r.ok) throw new Error('save'); })
        .then(function () {
          store(PENDING); store(SAVED, { at: Date.now(), data: snap });
          siteData = snap;
          render();
          document.getElementById('save-bar').hidden = false;
          msg.textContent = 'Saved ✨ Your site updates in about a minute.';
          setTimeout(function () { document.getElementById('save-bar').hidden = !load(PENDING); msg.textContent = ''; }, 6000);
        })
        .catch(function (e) {
          if (e.message === 'auth') { store(TOKEN); msg.textContent = 'That token didn\'t work. Check it has Contents: Read and write for this repo, then try again.'; }
          else msg.textContent = 'Could not save right now. Your changes are still on this device. Try again soon.';
        });
    });
  };

  document.getElementById('undo-btn').onclick = function () {
    if (!confirm('Undo the changes you made on this device?')) return;
    store(PENDING);
    location.reload();
  };

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
})();
