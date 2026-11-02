(function () {
  'use strict';

  var PH = window.PracticalHub;
  if (!PH) return;

  var FUSE_URL = 'https://cdn.jsdelivr.net/npm/fuse.js@7.0.0/dist/fuse.min.js';
  var SUGGESTED_QUERIES = [
    'silhouette score',
    'StandardScaler',
    'PCA',
    'confusion matrix',
    'r2_score',
    'GradientBoosting',
    'DBSCAN',
    'OneHotEncoder'
  ];

  var modal = document.getElementById('search-modal');
  var input = document.getElementById('search-input');
  var resultsEl = document.getElementById('search-results');
  var statusEl = document.getElementById('search-status');
  var countEl = document.getElementById('search-count');
  var panel = modal ? modal.querySelector('.search-panel') : null;

  if (!modal || !input || !resultsEl || !panel) return;

  var indexData = null;
  var fuse = null;
  var dataPromise = null;
  var fusePromise = null;
  var results = [];
  var activeIndex = -1;
  var lastFocused = null;

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function getTerms(query) {
    var seen = {};
    return String(query || '')
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(function (term) {
        if (!term || seen[term]) return false;
        seen[term] = true;
        return true;
      });
  }

  function highlightHtml(text, terms) {
    var safeTerms = terms
      .filter(Boolean)
      .sort(function (a, b) { return b.length - a.length; })
      .map(escapeRegExp);

    if (!safeTerms.length) return PH.escapeHtml(text);

    var matcher = new RegExp('(' + safeTerms.join('|') + ')', 'gi');
    var parts = String(text || '').split(matcher);

    return parts.map(function (part, index) {
      return index % 2 === 1 ? '<mark>' + PH.escapeHtml(part) + '</mark>' : PH.escapeHtml(part);
    }).join('');
  }

  function makeSnippet(text, terms) {
    var flat = String(text || '').replace(/\s+/g, ' ').trim();
    if (!flat) return '';

    var lower = flat.toLowerCase();
    var matchIndex = -1;

    for (var i = 0; i < terms.length; i++) {
      var index = lower.indexOf(terms[i]);
      if (index !== -1 && (matchIndex === -1 || index < matchIndex)) matchIndex = index;
    }

    var start = matchIndex > 55 ? matchIndex - 55 : 0;
    var end = Math.min(flat.length, start + 190);
    var snippet = flat.slice(start, end);

    if (start > 0) snippet = '…' + snippet;
    if (end < flat.length) snippet = snippet + '…';

    return highlightHtml(snippet, terms);
  }

  function setStatus(text) {
    if (statusEl) statusEl.textContent = text;
  }

  function setCount(text) {
    if (countEl) countEl.textContent = text || '';
  }

  function docKey(doc) {
    return doc.p + ':' + doc.kind + ':' + doc.cell;
  }

  function practicalHref(doc) {
    if (doc.kind === 'practical') return 'practical.html?p=' + doc.p;
    return 'practical.html?p=' + doc.p + '&cell=' + doc.cell + '#cell-' + doc.cell;
  }

  function renderLoading() {
    setStatus('Loading search index…');
    setCount('');
    resultsEl.innerHTML = [0, 1, 2, 3].map(function () {
      return '<div class="search-skeleton" aria-hidden="true"></div>';
    }).join('');
    results = [];
    activeIndex = -1;
  }

  function renderError() {
    setStatus('Search index could not be loaded');
    setCount('');
    results = [];
    activeIndex = -1;
    resultsEl.innerHTML =
      '<div class="search-empty">' +
        '<div class="search-empty-title">Search is unavailable right now</div>' +
        '<p>The index could not be fetched. If you opened this file directly, serve the folder with any static web server, or open the deployed GitHub Pages site.</p>' +
        '<p class="search-empty-hint">The practicals and notebook downloads still work.</p>' +
      '</div>';
  }

  function suggestionChips() {
    return '<div class="search-suggestions">' + SUGGESTED_QUERIES.map(function (query) {
      return '<button class="chip" type="button" data-search-query="' + PH.escapeHtml(query) + '">' +
        PH.escapeHtml(query) + '</button>';
    }).join('') + '</div>';
  }

  function renderInitial() {
    if (!indexData) {
      renderLoading();
      return;
    }

    var practicals = indexData.practicals.slice().sort(function (a, b) { return a.p - b.p; });
    var byId = {};
    practicals.forEach(function (practical) { byId[practical.id] = practical; });

    var recent = PH.getRecent()
      .map(function (id) { return byId[id]; })
      .filter(Boolean)
      .slice(0, 4);

    var recentHtml = '';
    if (recent.length) {
      recentHtml =
        '<div class="search-group">' +
          '<div class="search-group-title">Recently opened</div>' +
          '<div class="search-recent-list">' +
            recent.map(function (practical) {
              return '<a class="search-jump-row" href="practical.html?p=' + practical.p + '">' +
                '<span class="search-jump-num">' + String(practical.p).padStart(2, '0') + '</span>' +
                '<span class="search-jump-copy"><strong>' + PH.escapeHtml(practical.shortTitle) + '</strong>' +
                '<small>' + PH.escapeHtml(practical.topic) + '</small></span>' +
                '<svg class="icon" aria-hidden="true"><use href="#i-arrow-right"></use></svg>' +
              '</a>';
            }).join('') +
          '</div>' +
        '</div>';
    }

    var jumpHtml =
      '<div class="search-group">' +
        '<div class="search-group-title">Jump to a practical</div>' +
        '<div class="search-jump-grid">' +
          practicals.map(function (practical) {
            var complete = PH.isCompleted(practical.id);
            return '<a class="search-jump" href="practical.html?p=' + practical.p + '">' +
              '<span class="search-jump-num">' + String(practical.p).padStart(2, '0') + '</span>' +
              '<span>' + PH.escapeHtml(practical.shortTitle) + '</span>' +
              (complete ? '<svg class="icon icon-tick" aria-label="Completed"><use href="#i-check"></use></svg>' : '') +
            '</a>';
          }).join('') +
        '</div>' +
      '</div>';

    resultsEl.innerHTML =
      recentHtml +
      jumpHtml +
      '<div class="search-group">' +
        '<div class="search-group-title">Try a search</div>' +
        suggestionChips() +
      '</div>';

    results = [];
    activeIndex = -1;
    setStatus(indexData.docs.length + ' searchable cells across 10 practicals');
    setCount('');
  }

  function renderNoResults(query) {
    setStatus('No matches for “' + query + '”');
    setCount('0 matches');
    results = [];
    activeIndex = -1;
    resultsEl.innerHTML =
      '<div class="search-empty">' +
        '<div class="search-empty-title">No matches for <span>“' + PH.escapeHtml(query) + '”</span></div>' +
        '<p>Try a shorter term, a function name like <code>StandardScaler</code>, or a concept like <code>silhouette</code>.</p>' +
        suggestionChips() +
      '</div>';
  }

  function searchDocs(query) {
    var raw = String(query || '').trim();
    var lower = raw.toLowerCase();
    var normalized = lower.replace(/\s+/g, ' ');
    var terms = getTerms(raw);
    var combined = new Map();

    if (fuse) {
      try {
        fuse.search(raw, { limit: 80 }).forEach(function (entry) {
          combined.set(docKey(entry.item), { doc: entry.item, score: entry.score });
        });
      } catch (error) {
        /* the exact scan below keeps search working */
      }
    }

    indexData.docs.forEach(function (doc) {
      var haystack = (doc.title + ' ' + doc.label + ' ' + doc.keywords + ' ' + doc.text).toLowerCase();
      var normalizedHaystack = haystack.replace(/\s+/g, ' ');
      var key = docKey(doc);

      if (normalizedHaystack.indexOf(normalized) !== -1) {
        var score = 0.04;
        var titleLower = String(doc.title || '').toLowerCase();
        var labelLower = String(doc.label || '').toLowerCase();
        if (titleLower.indexOf(lower) !== -1) {
          score = 0.005;
        } else if (labelLower.indexOf(lower) !== -1) {
          score = 0.015;
        } else if (doc.kind === 'practical') {
          score = 0.02;
        } else {
          var position = String(doc.text || '').toLowerCase().indexOf(lower);
          score = 0.035 + (position > 0 ? Math.min(0.04, position / Math.max(1, doc.text.length) * 0.04) : 0);
        }
        var current = combined.get(key);
        if (!current || score < current.score) combined.set(key, { doc: doc, score: score });
        return;
      }

      if (terms.length > 1 && terms.every(function (term) { return haystack.indexOf(term) !== -1; })) {
        if (!combined.has(key)) combined.set(key, { doc: doc, score: 0.24 });
      }
    });

    return Array.from(combined.values())
      .sort(function (a, b) {
        if (a.score === b.score) return a.doc.p - b.doc.p || a.doc.cell - b.doc.cell;
        return a.score - b.score;
      })
      .slice(0, 48);
  }

  function renderResults(query) {
    if (!indexData) {
      renderLoading();
      return;
    }

    var raw = String(query || '').trim();
    if (!raw) {
      renderInitial();
      return;
    }

    var terms = getTerms(raw);
    results = searchDocs(raw);
    activeIndex = -1;

    if (!results.length) {
      renderNoResults(raw);
      return;
    }

    resultsEl.innerHTML = results.map(function (entry, index) {
      var doc = entry.doc;
      var cellLabel = doc.kind === 'practical'
        ? 'Overview'
        : 'Cell ' + doc.cell + ' · ' + (doc.kind === 'code' ? 'Code' : 'Markdown');

      return '<a class="search-result" role="option" id="search-option-' + index + '" aria-selected="false" data-result-index="' + index + '" href="' + practicalHref(doc) + '">' +
        '<span class="search-result-top">' +
          '<span class="search-result-practical">Practical ' + doc.p + ' · <span class="search-result-title">' + highlightHtml(doc.title, terms) + '</span></span>' +
          '<span class="search-result-cell">' + cellLabel + '</span>' +
        '</span>' +
        '<span class="search-result-snippet">' + makeSnippet(doc.text, terms) + '</span>' +
      '</a>';
    }).join('');

    setStatus('Results for “' + raw + '”');
    setCount(results.length === 48 ? 'Top 48 matches' : results.length + (results.length === 1 ? ' match' : ' matches'));
  }

  function setActive(index) {
    if (!results.length) return;

    if (index < 0) index = results.length - 1;
    if (index >= results.length) index = 0;

    activeIndex = index;

    Array.prototype.forEach.call(resultsEl.querySelectorAll('.search-result'), function (element, elementIndex) {
      var selected = elementIndex === index;
      element.classList.toggle('is-active', selected);
      element.setAttribute('aria-selected', selected ? 'true' : 'false');
      if (selected) element.scrollIntoView({ block: 'nearest' });
    });

    input.setAttribute('aria-activedescendant', 'search-option-' + index);
  }

  function clearActive() {
    activeIndex = -1;
    input.removeAttribute('aria-activedescendant');
    Array.prototype.forEach.call(resultsEl.querySelectorAll('.search-result'), function (element) {
      element.classList.remove('is-active');
      element.setAttribute('aria-selected', 'false');
    });
  }

  function openResult(index) {
    if (!results.length) return;
    var chosen = index >= 0 && index < results.length ? results[index] : results[0];
    if (!chosen) return;
    window.location.assign(practicalHref(chosen.doc));
  }

  function loadData() {
    if (indexData) return Promise.resolve(indexData);
    if (dataPromise) return dataPromise;

    dataPromise = fetch('data/search-index.json', { cache: 'default' })
      .then(function (response) {
        if (!response.ok) throw new Error('Search index request failed');
        return response.json();
      })
      .then(function (data) {
        indexData = data;
        return data;
      })
      .catch(function (error) {
        dataPromise = null;
        throw error;
      });

    return dataPromise;
  }

  function ensureFuse() {
    if (window.Fuse) return Promise.resolve(true);
    if (fusePromise) return fusePromise;

    fusePromise = PH.loadScript(FUSE_URL)
      .then(function () { return !!window.Fuse; })
      .catch(function () { return false; });

    return fusePromise;
  }

  function createFuse() {
    if (!window.Fuse || !indexData) return;
    fuse = new window.Fuse(indexData.docs, {
      includeScore: true,
      threshold: 0.36,
      ignoreLocation: true,
      minMatchCharLength: 2,
      ignoreDiacritics: true,
      keys: [
        { name: 'title', weight: 0.3 },
        { name: 'keywords', weight: 0.15 },
        { name: 'label', weight: 0.1 },
        { name: 'text', weight: 0.45 }
      ]
    });
  }

  function openSearch() {
    if (!modal.hidden) {
      input.focus();
      input.select();
      return;
    }

    lastFocused = document.activeElement;
    modal.hidden = false;
    document.body.classList.add('search-open');
    input.value = '';
    input.focus();
    renderLoading();

    loadData()
      .then(function () {
        if (modal.hidden) return;
        if (!fuse) createFuse();
        if (input.value.trim()) renderResults(input.value);
        else renderInitial();
        setStatus(indexData.docs.length + ' searchable cells across 10 practicals');
      })
      .catch(function () {
        if (!modal.hidden) renderError();
      });

    ensureFuse().then(function (available) {
      if (!available || modal.hidden || !indexData) return;
      createFuse();
      if (input.value.trim()) renderResults(input.value);
    });
  }

  function closeSearch(clear) {
    if (modal.hidden) return;
    modal.hidden = true;
    document.body.classList.remove('search-open');
    clearActive();

    if (clear !== false) {
      input.value = '';
      results = [];
      resultsEl.innerHTML = '';
      setStatus('Type to search across all practicals');
      setCount('');
    }

    if (lastFocused && typeof lastFocused.focus === 'function') {
      lastFocused.focus();
    }
  }

  function trapFocus(event) {
    var focusables = Array.prototype.slice.call(
      panel.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])')
    ).filter(function (element) { return element.offsetParent !== null; });

    if (!focusables.length) return;
    var first = focusables[0];
    var last = focusables[focusables.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  modal.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      if (input.value) {
        input.value = '';
        renderResults('');
        input.focus();
      } else {
        closeSearch(true);
      }
      return;
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (!results.length) return;
      event.preventDefault();
      setActive(activeIndex + (event.key === 'ArrowDown' ? 1 : -1));
      return;
    }

    if (event.key === 'Enter' && document.activeElement === input) {
      if (!results.length) return;
      event.preventDefault();
      openResult(activeIndex);
      return;
    }

    if (event.key === 'Tab') trapFocus(event);
  });

  input.addEventListener('input', function () {
    if (!indexData) {
      renderLoading();
      return;
    }
    renderResults(input.value);
  });

  resultsEl.addEventListener('click', function (event) {
    var chip = event.target.closest('[data-search-query]');
    if (chip) {
      input.value = chip.getAttribute('data-search-query') || '';
      input.focus();
      renderResults(input.value);
      return;
    }

    var result = event.target.closest('.search-result');
    if (result) closeSearch(false);
  });

  document.querySelectorAll('[data-search-close]').forEach(function (button) {
    button.addEventListener('click', function () { closeSearch(true); });
  });

  document.querySelectorAll('[data-search-open]').forEach(function (button) {
    button.addEventListener('click', openSearch);
  });

  document.addEventListener('keydown', function (event) {
    if (PH.isDialogOpen()) return;

    if (event.key.toLowerCase() === 'k' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      openSearch();
      return;
    }

    if (event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey && !PH.isEditableTarget(event.target)) {
      event.preventDefault();
      openSearch();
    }
  });
})();
