(function () {
  'use strict';

  var PH = window.PracticalHub;
  if (!PH) return;

  var JSZIP_URL = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';

  var state = {
    practicals: [],
    byId: {}
  };

  var grid = document.getElementById('practical-grid');
  var recentList = document.getElementById('recent-list');
  var progressLabel = document.getElementById('progress-label');
  var progressTrack = document.getElementById('progress-track');
  var progressFill = document.getElementById('progress-fill');
  var statPracticals = document.getElementById('stat-practicals');
  var statCodeCells = document.getElementById('stat-code-cells');
  var statCompleted = document.getElementById('stat-completed');
  var countLabel = document.getElementById('practical-count-label');

  function pad(number) {
    return String(number).padStart(2, '0');
  }

  function hrefFor(practical) {
    return 'practical.html?p=' + practical.number;
  }

  function icon(name, classes) {
    return '<svg class="icon' + (classes ? ' ' + classes : '') + '" aria-hidden="true"><use href="#' + name + '"></use></svg>';
  }

  function updateStats() {
    var total = state.practicals.length || 10;
    var completed = PH.countCompleted();
    var codeCells = state.practicals.reduce(function (sum, practical) {
      return sum + (practical.codeCells || 0);
    }, 0);

    if (statPracticals) statPracticals.textContent = String(total);
    if (statCodeCells) statCodeCells.textContent = codeCells ? String(codeCells) : '—';
    if (statCompleted) statCompleted.textContent = completed + ' / ' + total;

    if (progressLabel) {
      progressLabel.textContent = completed + ' of ' + total + ' practicals completed';
    }
    if (progressTrack) {
      progressTrack.setAttribute('aria-valuenow', String(completed));
      progressTrack.setAttribute('aria-valuemax', String(total));
    }
    if (progressFill) {
      progressFill.style.width = (total ? (completed / total) * 100 : 0) + '%';
    }
    if (countLabel && state.practicals.length) {
      countLabel.textContent = total + ' practicals · ' + codeCells + ' code cells';
    }
  }

  function renderCard(practical) {
    var completed = PH.isCompleted(practical.id);
    var libraries = practical.libraries.slice(0, 2).join(' · ');
    if (practical.libraries.length > 2) libraries += ' +' + (practical.libraries.length - 2);

    return '<article class="practical-card' + (completed ? ' is-completed' : '') + '" data-practical-id="' + PH.escapeHtml(practical.id) + '">' +
      '<a class="card-body" href="' + hrefFor(practical) + '" aria-label="Open Practical ' + practical.number + ': ' + PH.escapeHtml(practical.title) + '">' +
        '<div class="card-top">' +
          '<span class="practical-number">' + pad(practical.number) + '</span>' +
          '<span class="topic-badge">' + PH.escapeHtml(practical.topic) + '</span>' +
        '</div>' +
        '<h3 class="card-title">' + PH.escapeHtml(practical.title) + '</h3>' +
        '<p class="card-description">' + PH.escapeHtml(practical.description) + '</p>' +
        '<div class="card-meta">' +
          '<span>' + icon('i-code') + practical.codeCells + ' code cells</span>' +
          '<span>' + practical.markdownCells + ' notes</span>' +
          '<span class="card-meta-libs">' + PH.escapeHtml(libraries) + '</span>' +
        '</div>' +
      '</a>' +
      '<div class="card-footer">' +
        '<label class="complete-toggle" title="Mark this practical complete">' +
          '<input type="checkbox" data-complete="' + PH.escapeHtml(practical.id) + '"' + (completed ? ' checked' : '') + ' aria-label="Mark Practical ' + practical.number + ' complete">' +
          '<span class="checkbox-ui" aria-hidden="true">' + icon('i-check') + '</span>' +
          '<span class="complete-label">' + (completed ? 'Completed' : 'Mark complete') + '</span>' +
        '</label>' +
        '<div class="card-actions">' +
          '<a class="icon-btn" href="' + practical.notebookPath + '" download="' + PH.escapeHtml(practical.originalFile) + '" title="Download original notebook ' + PH.escapeHtml(practical.originalFile) + '" aria-label="Download original notebook for Practical ' + practical.number + '">' + icon('i-download') + '</a>' +
          '<a class="icon-btn" href="' + hrefFor(practical) + '" title="Open practical" aria-label="Open Practical ' + practical.number + '">' + icon('i-arrow-right') + '</a>' +
        '</div>' +
      '</div>' +
    '</article>';
  }

  function renderGrid() {
    if (!grid) return;
    grid.innerHTML = state.practicals.map(renderCard).join('');
    grid.setAttribute('aria-busy', 'false');
  }

  function renderRecent() {
    if (!recentList) return;

    var recent = PH.getRecent()
      .map(function (id) { return state.byId[id]; })
      .filter(Boolean)
      .slice(0, 4);

    if (!recent.length) {
      recentList.innerHTML = '<p class="empty-inline">No recent practicals yet. Open one from the list below and it will appear here.</p>';
      return;
    }

    recentList.innerHTML = recent.map(function (practical) {
      return '<a class="recent-card" href="' + hrefFor(practical) + '">' +
        '<span class="recent-number">' + pad(practical.number) + '</span>' +
        '<span class="recent-copy">' +
          '<strong>' + PH.escapeHtml(practical.shortTitle) + '</strong>' +
          '<small>' + PH.escapeHtml(practical.topic) + ' · ' + practical.codeCells + ' code cells</small>' +
        '</span>' +
        icon('i-arrow-right') +
      '</a>';
    }).join('');
  }

  function syncCheckboxes() {
    if (!grid) return;
    Array.prototype.forEach.call(grid.querySelectorAll('input[data-complete]'), function (input) {
      var id = input.getAttribute('data-complete');
      var completed = PH.isCompleted(id);
      input.checked = completed;
      var card = input.closest('.practical-card');
      if (card) card.classList.toggle('is-completed', completed);
      var label = input.closest('.complete-toggle');
      if (label) {
        var text = label.querySelector('.complete-label');
        if (text) text.textContent = completed ? 'Completed' : 'Mark complete';
      }
    });
  }

  function handleCompletionChange(event) {
    var input = event.target.closest('input[data-complete]');
    if (!input) return;
    var id = input.getAttribute('data-complete');
    var completed = input.checked;
    PH.setCompleted(id, completed);

    var card = input.closest('.practical-card');
    if (card) card.classList.toggle('is-completed', completed);
    var label = input.closest('.complete-toggle');
    if (label) {
      var text = label.querySelector('.complete-label');
      if (text) text.textContent = completed ? 'Completed' : 'Mark complete';
    }

    updateStats();
    var practical = state.byId[id];
    PH.showToast(
      completed
        ? 'Practical ' + (practical ? practical.number : '') + ' marked complete'
        : 'Practical ' + (practical ? practical.number : '') + ' marked incomplete',
      completed ? 'success' : 'info'
    );
  }

  function setDownloadButtonsBusy(busy, label) {
    document.querySelectorAll('[data-download-all]').forEach(function (button) {
      button.disabled = busy;
      if (busy) {
        if (!button.dataset.originalHtml) button.dataset.originalHtml = button.innerHTML;
        button.innerHTML = '<span class="btn-spinner" aria-hidden="true"></span><span>' + label + '</span>';
      } else if (button.dataset.originalHtml) {
        button.innerHTML = button.dataset.originalHtml;
        delete button.dataset.originalHtml;
      }
    });
  }

  async function downloadAllNotebooks() {
    if (!state.practicals.length) {
      PH.showToast('The practical index is still loading. Try again in a moment.', 'info');
      return;
    }

    setDownloadButtonsBusy(true, 'Preparing ZIP…');

    try {
      if (!window.JSZip) await PH.loadScript(JSZIP_URL);
      if (!window.JSZip) throw new Error('JSZip is unavailable');

      var notebooks = await Promise.all(state.practicals.map(async function (practical) {
        var response = await fetch(practical.notebookPath);
        if (!response.ok) throw new Error('Could not fetch ' + practical.originalFile);
        return {
          name: practical.originalFile,
          buffer: await response.arrayBuffer()
        };
      }));

      var zip = new window.JSZip();
      notebooks.forEach(function (notebook) {
        zip.file(notebook.name, notebook.buffer);
      });

      var blob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      });

      PH.downloadBlob('PracticalHub-notebooks.zip', blob);
      PH.showToast('Downloaded all 10 original notebooks as a ZIP', 'success');
    } catch (error) {
      PH.showToast('Could not prepare the ZIP. Check your connection and try again.', 'error');
      if (window.console && console.error) console.error(error);
    } finally {
      setDownloadButtonsBusy(false);
    }
  }

  async function loadIndex() {
    try {
      var response = await fetch('data/practicals.json', { cache: 'default' });
      if (!response.ok) throw new Error('Could not load practicals.json');
      var data = await response.json();
      state.practicals = Array.isArray(data.practicals) ? data.practicals : [];
      state.byId = {};
      state.practicals.forEach(function (practical) { state.byId[practical.id] = practical; });

      renderGrid();
      renderRecent();
      updateStats();
    } catch (error) {
      if (grid) {
        grid.setAttribute('aria-busy', 'false');
        grid.innerHTML =
          '<div class="load-error">' +
            '<h3>The practical index could not be loaded</h3>' +
            '<p>If you opened this file directly, serve the project folder with any static web server, or use the deployed GitHub Pages site. The original notebooks are still in <a href="notebooks/">notebooks/</a>.</p>' +
          '</div>';
      }
      if (window.console && console.error) console.error(error);
    }
  }

  function init() {
    PH.initCommon();

    if (grid) grid.addEventListener('change', handleCompletionChange);
    document.querySelectorAll('[data-download-all]').forEach(function (button) {
      button.addEventListener('click', downloadAllNotebooks);
    });

    window.addEventListener('storage', function (event) {
      if (event.key === PH.storageKeys.completed) {
        syncCheckboxes();
        updateStats();
      }
    });

    loadIndex();
  }

  init();
})();
