(function () {
  'use strict';

  var PH = window.PracticalHub;
  if (!PH) return;

  var content = document.getElementById('practical-content');
  var navEl = document.getElementById('practical-nav');
  var tocEl = document.getElementById('toc');
  var sidebar = document.getElementById('sidebar');
  var sidebarScrim = document.getElementById('sidebar-scrim');
  var menuToggle = document.getElementById('menu-toggle');
  var sidebarClose = document.getElementById('sidebar-close');

  var state = {
    practical: null,
    practicals: [],
    codeByNumber: {},
    pageNumber: 1
  };

  var scrollObserver = null;

  function pad(number) {
    return String(number).padStart(2, '0');
  }

  function icon(name, classes) {
    return '<svg class="icon' + (classes ? ' ' + classes : '') + '" aria-hidden="true"><use href="#' + name + '"></use></svg>';
  }

  function getPageNumber() {
    var raw = new URLSearchParams(window.location.search).get('p');
    if (raw === null) return 1;
    var number = Number(raw);
    return Number.isInteger(number) && number >= 1 && number <= 10 ? number : null;
  }

  function hrefFor(number) {
    return 'practical.html?p=' + number;
  }

  function practicalPyName() {
    if (!state.practical) return 'practical.py';
    return String(state.practical.originalFile || 'practical.ipynb').replace(/\.ipynb$/i, '') + '.py';
  }

  function renderPracticalNav() {
    if (!navEl || !state.practicals.length || !state.practical) return;
    var currentId = state.practical.id;

    navEl.innerHTML = state.practicals.map(function (practical) {
      var current = practical.id === currentId;
      var done = PH.isCompleted(practical.id);
      return '<a href="' + hrefFor(practical.number) + '"' + (current ? ' class="is-current" aria-current="page"' : '') + ' data-practical-id="' + PH.escapeHtml(practical.id) + '">' +
        '<span class="nav-num">' + pad(practical.number) + '</span>' +
        '<span class="nav-title">' + PH.escapeHtml(practical.shortTitle) + '</span>' +
        (done ? '<svg class="icon nav-check" aria-label="Completed"><use href="#i-check"></use></svg>' : '') +
      '</a>';
    }).join('');
  }

  function tocItems() {
    var items = [
      { id: 'overview', label: 'Overview', level: 0 },
      { id: 'notebook', label: 'Notebook cells', level: 0 }
    ];

    state.practical.cells.forEach(function (cell) {
      if (cell.type === 'markdown') {
        PH.extractHeadings(cell.source, 'cell-' + cell.number).forEach(function (heading) {
          items.push({ id: heading.id, label: heading.text, level: heading.level, heading: true });
        });
      } else if (cell.source.trim()) {
        var first = PH.firstLine(cell.source, 44);
        items.push({ id: 'cell-' + cell.number, label: 'Cell ' + cell.number + (first ? ' · ' + first : ''), level: 0 });
      }
    });

    return items;
  }

  function renderToc() {
    if (!tocEl) return;
    var items = tocItems();

    tocEl.innerHTML = items.map(function (item) {
      var levelClass = item.heading ? ' toc-level-' + Math.min(item.level, 3) : '';
      return '<a class="toc-link' + levelClass + '" href="#' + PH.escapeHtml(item.id) + '" data-toc-target="' + PH.escapeHtml(item.id) + '">' +
        PH.escapeHtml(item.label) +
      '</a>';
    }).join('');
  }

  function setActiveToc(id) {
    if (!tocEl) return;
    Array.prototype.forEach.call(tocEl.querySelectorAll('.toc-link'), function (link) {
      var active = link.getAttribute('data-toc-target') === id;
      link.classList.toggle('is-active', active);
      if (active && typeof link.scrollIntoView === 'function') {
        link.scrollIntoView({ block: 'nearest' });
      }
    });
  }

  function setupScrollSpy() {
    if (scrollObserver) scrollObserver.disconnect();
    if (!('IntersectionObserver' in window) || !tocEl) return;

    var targets = Array.prototype.map.call(tocEl.querySelectorAll('.toc-link'), function (link) {
      var target = document.getElementById(link.getAttribute('data-toc-target'));
      return target;
    }).filter(Boolean);

    if (!targets.length) return;

    scrollObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) setActiveToc(entry.target.id);
      });
    }, {
      rootMargin: '-88px 0px -62% 0px',
      threshold: 0
    });

    targets.forEach(function (target) { scrollObserver.observe(target); });
  }

  function renderOutput(output, cellNumber) {
    var text = output.text || '';
    var body = '';
    var label = 'Output';

    if (output.type === 'stream') {
      label = output.name === 'stderr' ? 'stderr' : 'stdout';
    } else if (output.type === 'execute_result') {
      label = 'Result';
    } else if (output.type === 'display_data') {
      label = output.image ? 'Figure' : 'Display output';
    } else if (output.type === 'error') {
      label = 'Error';
    }

    if (output.type === 'error') {
      body = '<div class="output-error"><strong>' + PH.escapeHtml(output.ename || 'Error') + ':</strong> ' + PH.escapeHtml(output.evalue || '') + '</div>';
      if (output.traceback) {
        body += '<details class="output-disclosure"><summary>Show traceback</summary><pre class="output-text">' + PH.escapeHtml(output.traceback) + '</pre></details>';
      }
    } else if (output.image) {
      var dimensions = '';
      if (output.imageWidth && output.imageHeight) {
        dimensions = ' width="' + output.imageWidth + '" height="' + output.imageHeight + '"';
      }
      body = '<figure class="output-image">' +
        '<img src="' + output.image + '" alt="Recorded figure output for Cell ' + cellNumber + '" loading="lazy" decoding="async"' + dimensions + '>' +
        (text ? '<figcaption>' + PH.escapeHtml(text) + '</figcaption>' : '') +
      '</figure>';
    } else if (output.html && output.htmlIsDataframe) {
      var table = '<div class="output-table-wrap">' + PH.sanitizeTableHtml(output.html) + '</div>';
      if (Number(output.rowCount) > 20) {
        body = '<details class="output-disclosure"><summary>Show table output · ' + output.rowCount + ' rows</summary>' + table + '</details>';
        label += ' · table';
      } else {
        body = table;
        label += ' · table';
      }
    } else if (text) {
      body = '<pre class="output-text">' + PH.escapeHtml(text) + '</pre>';
    } else {
      return '';
    }

    return '<div class="output output--' + PH.escapeHtml(output.type || 'output') + '">' +
      '<div class="output-label">' + PH.escapeHtml(label) + '</div>' +
      body +
    '</div>';
  }

  function renderOutputs(cell) {
    if (!cell.outputs || !cell.outputs.length) return '';
    return '<div class="outputs">' + cell.outputs.map(function (output) {
      return renderOutput(output, cell.number);
    }).join('') + '</div>';
  }

  function renderCell(cell) {
    var number = cell.number;
    var anchor = '<a class="cell-anchor" href="#cell-' + number + '" title="Direct link to Cell ' + number + '" aria-label="Direct link to Cell ' + number + '">' + icon('i-link') + '</a>';

    if (cell.type === 'markdown') {
      var markdown = cell.source.trim()
        ? PH.renderMarkdown(cell.source, 'cell-' + number)
        : '<p class="empty-cell-note">This markdown cell is empty in the original notebook.</p>';

      return '<section class="cell cell--markdown" id="cell-' + number + '" data-cell-number="' + number + '">' +
        '<div class="cell-head">' +
          '<div class="cell-label">' +
            '<span class="cell-type">Markdown</span>' +
            '<span class="cell-number">Cell ' + number + '</span>' +
            anchor +
          '</div>' +
        '</div>' +
        '<div class="markdown-body">' + markdown + '</div>' +
      '</section>';
    }

    var hasSource = cell.source.length > 0;
    var code = hasSource
      ? '<div class="code-wrap"><pre><code class="language-python">' + PH.escapeHtml(cell.source) + '</code></pre></div>'
      : '<div class="empty-code-note">This code cell is empty in the original notebook.</div>';

    return '<section class="cell cell--code" id="cell-' + number + '" data-cell-number="' + number + '">' +
      '<div class="cell-head">' +
        '<div class="cell-label">' +
          '<span class="cell-type">Code</span>' +
          '<span class="cell-number">Cell ' + number + '</span>' +
          anchor +
        '</div>' +
        (hasSource ? '<div class="cell-actions">' +
          '<button class="btn btn-xs btn-copy" type="button" data-action="copy-cell" data-cell-number="' + number + '">' + icon('i-copy') + 'Copy</button>' +
          '<button class="btn btn-xs" type="button" data-action="download-cell" data-cell-number="' + number + '">' + icon('i-download') + '.py</button>' +
        '</div>' : '') +
      '</div>' +
      code +
      renderOutputs(cell) +
    '</section>';
  }

  function libraryChips() {
    return state.practical.libraries.map(function (library) {
      return '<span class="chip chip-static">' + PH.escapeHtml(library) + '</span>';
    }).join('');
  }

  function algorithmChips() {
    return state.practical.algorithms.map(function (algorithm) {
      return '<span class="chip chip-static">' + PH.escapeHtml(algorithm) + '</span>';
    }).join('');
  }

  function pagerHtml() {
    var previous = state.practicals.find(function (practical) { return practical.number === state.pageNumber - 1; });
    var next = state.practicals.find(function (practical) { return practical.number === state.pageNumber + 1; });

    var previousHtml = previous
      ? '<a class="pager-link pager-prev" href="' + hrefFor(previous.number) + '">' +
          '<span class="pager-kicker">' + icon('i-arrow-left') + 'Previous</span>' +
          '<strong>' + pad(previous.number) + ' · ' + PH.escapeHtml(previous.shortTitle) + '</strong>' +
        '</a>'
      : '<span class="pager-link pager-prev is-disabled"><span class="pager-kicker">' + icon('i-arrow-left') + 'Previous</span><strong>Start of the set</strong></span>';

    var nextHtml = next
      ? '<a class="pager-link pager-next" href="' + hrefFor(next.number) + '">' +
          '<span class="pager-kicker">Next' + icon('i-arrow-right') + '</span>' +
          '<strong>' + pad(next.number) + ' · ' + PH.escapeHtml(next.shortTitle) + '</strong>' +
        '</a>'
      : '<span class="pager-link pager-next is-disabled"><span class="pager-kicker">Next' + icon('i-arrow-right') + '</span><strong>End of the set</strong></span>';

    return '<nav class="practical-pager" aria-label="Previous and next practical">' + previousHtml + nextHtml + '</nav>';
  }

  function renderPage() {
    var practical = state.practical;

    document.title = practical.title + ' · Practical ' + practical.number + ' · PracticalHub';
    var metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) metaDescription.setAttribute('content', practical.description);

    content.innerHTML =
      '<div class="print-only print-header"><span>PracticalHub</span><strong>Practical ' + pad(practical.number) + ' — ' + PH.escapeHtml(practical.title) + '</strong></div>' +
      '<nav class="breadcrumbs" aria-label="Breadcrumb">' +
        '<a href="index.html">Dashboard</a>' +
        icon('i-arrow-right') +
        '<span>Practical ' + practical.number + '</span>' +
      '</nav>' +

      '<header class="page-head" id="overview">' +
        '<div class="page-kicker">' +
          '<span class="practical-number">' + pad(practical.number) + '</span>' +
          '<span class="topic-badge">' + PH.escapeHtml(practical.topic) + '</span>' +
          '<span class="source-badge">' + icon('i-book') + 'Original · ' + PH.escapeHtml(practical.originalFile) + '</span>' +
        '</div>' +
        '<h1>' + PH.escapeHtml(practical.title) + '</h1>' +
        '<p class="page-description">' + PH.escapeHtml(practical.description) + '</p>' +
        '<div class="page-meta">' +
          '<span class="meta-pill">' + practical.codeCells + ' code cells</span>' +
          '<span class="meta-pill">' + practical.markdownCells + ' markdown cells</span>' +
          '<span class="meta-pill">' + practical.cellCount + ' original cells</span>' +
          '<span class="meta-pill">' + PH.escapeHtml(practical.dataset) + '</span>' +
        '</div>' +
        '<div class="page-actions">' +
          '<button class="btn btn-primary btn-copy-all" type="button" data-action="copy-all">' +
            icon('i-copy') +
            '<span>Copy All Code</span>' +
            '<kbd>Ctrl Shift C</kbd>' +
          '</button>' +
          '<button class="btn" type="button" data-action="download-py">' + icon('i-download') + 'Download .py</button>' +
          '<a class="btn" href="' + practical.notebookPath + '" download="' + PH.escapeHtml(practical.originalFile) + '">' + icon('i-download') + 'Download Notebook</a>' +
          '<button class="btn" type="button" data-action="print">' + icon('i-print') + 'Print Practical</button>' +
          '<button class="btn complete-page-btn" type="button" data-action="complete" aria-pressed="false">' + icon('i-check') + '<span>Mark complete</span></button>' +
        '</div>' +
      '</header>' +

      '<section class="study-note" aria-labelledby="study-guide-heading">' +
        '<div class="study-note-head">' +
          '<span class="badge badge-study">' + icon('i-spark') + 'Study guide</span>' +
          '<h2 id="study-guide-heading">What this practical covers</h2>' +
          '<p class="study-note-disclaimer">Auto-generated summary from the notebook contents. This is additional reference material, not original notebook content. Everything in the notebook section below is reproduced from <code>' + PH.escapeHtml(practical.originalFile) + '</code>.</p>' +
        '</div>' +
        '<div class="study-grid">' +
          '<div class="study-item study-item-aim">' +
            '<h3>Aim / objective</h3>' +
            '<p>' + PH.escapeHtml(practical.aim) + '</p>' +
          '</div>' +
          '<div class="study-item">' +
            '<h3>Required libraries</h3>' +
            '<div class="chip-list">' + libraryChips() + '</div>' +
          '</div>' +
          '<div class="study-item">' +
            '<h3>Key techniques</h3>' +
            '<div class="chip-list">' + algorithmChips() + '</div>' +
          '</div>' +
          '<div class="study-item">' +
            '<h3>Dataset</h3>' +
            '<p>' + PH.escapeHtml(practical.dataset) + '</p>' +
          '</div>' +
        '</div>' +
      '</section>' +

      '<section class="notebook-section" id="notebook" aria-labelledby="notebook-heading">' +
        '<div class="section-head notebook-head">' +
          '<div>' +
            '<div class="section-kicker">Source of truth</div>' +
            '<h2 id="notebook-heading">Original notebook</h2>' +
            '<p class="notebook-intro">Every cell appears in its original order. Code, markdown and whitespace are unchanged. Saved outputs are shown where the notebook recorded them.</p>' +
          '</div>' +
          '<div class="notebook-actions">' +
            '<button class="btn btn-sm" type="button" data-action="copy-all">' + icon('i-copy') + 'Copy all</button>' +
            '<a class="btn btn-sm" href="' + practical.notebookPath + '" download="' + PH.escapeHtml(practical.originalFile) + '">' + icon('i-download') + PH.escapeHtml(practical.originalFile) + '</a>' +
          '</div>' +
        '</div>' +
        '<div class="cell-list" id="cell-list">' + practical.cells.map(renderCell).join('') + '</div>' +
      '</section>' +

      pagerHtml();

    content.setAttribute('aria-busy', 'false');

    state.codeByNumber = {};
    practical.cells.forEach(function (cell) {
      if (cell.type === 'code') state.codeByNumber[cell.number] = cell.source;
    });

    renderPracticalNav();
    renderToc();
    updateCompletionUi();
    setupScrollSpy();
    highlightCode();
    scrollToInitial();
  }

  function highlightCode() {
    if (window.Prism && typeof window.Prism.highlightAllUnder === 'function') {
      try {
        window.Prism.highlightAllUnder(content);
      } catch (error) {
        /* plain code remains readable if Prism fails */
      }
    }
  }

  function updateCompletionUi() {
    if (!state.practical) return;
    var completed = PH.isCompleted(state.practical.id);
    var button = content.querySelector('[data-action="complete"]');
    if (button) {
      button.classList.toggle('is-complete', completed);
      button.setAttribute('aria-pressed', completed ? 'true' : 'false');
      button.innerHTML = icon('i-check') + '<span>' + (completed ? 'Completed' : 'Mark complete') + '</span>';
    }
  }

  function togglePageCompletion() {
    if (!state.practical) return;
    var next = !PH.isCompleted(state.practical.id);
    PH.setCompleted(state.practical.id, next);
    updateCompletionUi();
    renderPracticalNav();
    PH.showToast(
      next ? 'Practical ' + state.practical.number + ' marked complete' : 'Practical ' + state.practical.number + ' marked incomplete',
      next ? 'success' : 'info'
    );
  }

  async function copyCell(number) {
    var source = state.codeByNumber[number];
    if (typeof source !== 'string') return;
    var ok = await PH.copyText(source);
    PH.showToast(ok ? 'Copied Cell ' + number + ' exactly as written' : 'Could not copy Cell ' + number, ok ? 'success' : 'error');
  }

  function downloadCell(number) {
    var source = state.codeByNumber[number];
    if (typeof source !== 'string') return;
    PH.downloadText(state.practical.id + '-cell-' + number + '.py', source, 'text/x-python');
    PH.showToast('Downloaded Cell ' + number + ' as a .py file', 'info');
  }

  async function copyAllCode() {
    if (!state.practical) return;
    var code = PH.combineCode(state.practical.cells);
    if (!code) {
      PH.showToast('This practical has no non-empty code cells', 'info');
      return;
    }
    var ok = await PH.copyText(code);
    PH.showToast(
      ok ? 'Copied all code from ' + state.practical.codeCells + ' code cells' : 'Could not copy all code',
      ok ? 'success' : 'error'
    );
  }

  function downloadPracticalPy() {
    if (!state.practical) return;
    var code = PH.combineCode(state.practical.cells);
    if (!code) {
      PH.showToast('This practical has no non-empty code cells', 'info');
      return;
    }
    PH.downloadText(practicalPyName(), code, 'text/x-python');
    PH.showToast('Downloaded the practical code as ' + practicalPyName(), 'info');
  }

  function goToPractical(number) {
    if (number < 1 || number > 10) return;
    window.location.href = hrefFor(number);
  }

  function handleContentClick(event) {
    var button = event.target.closest('[data-action]');
    if (!button) return;
    var action = button.getAttribute('data-action');

    if (action === 'copy-all') {
      copyAllCode();
    } else if (action === 'download-py') {
      downloadPracticalPy();
    } else if (action === 'print') {
      window.print();
    } else if (action === 'complete') {
      togglePageCompletion();
    } else if (action === 'copy-cell') {
      copyCell(Number(button.getAttribute('data-cell-number')));
    } else if (action === 'download-cell') {
      downloadCell(Number(button.getAttribute('data-cell-number')));
    }
  }

  function scrollToInitial() {
    var params = new URLSearchParams(window.location.search);
    var cellParam = params.get('cell');
    var hash = window.location.hash ? decodeURIComponent(window.location.hash.slice(1)) : '';
    var targetId = cellParam && /^\d+$/.test(cellParam) ? 'cell-' + cellParam : hash;

    if (!targetId) return;

    window.setTimeout(function () {
      var target = document.getElementById(targetId);
      if (!target) return;
      target.scrollIntoView({ block: 'start' });
      var cell = target.closest ? target.closest('.cell') : null;
      if (cell) {
        cell.classList.add('cell--target');
        window.setTimeout(function () { cell.classList.remove('cell--target'); }, 2600);
      }
    }, 80);
  }

  function openSidebar() {
    if (!sidebar || !menuToggle) return;
    sidebar.classList.add('is-open');
    if (sidebarScrim) sidebarScrim.hidden = false;
    document.body.classList.add('sidebar-open');
    menuToggle.setAttribute('aria-expanded', 'true');
    if (sidebarClose) sidebarClose.focus();
  }

  function closeSidebar() {
    if (!sidebar || !menuToggle) return;
    if (!sidebar.classList.contains('is-open')) return;
    sidebar.classList.remove('is-open');
    if (sidebarScrim) sidebarScrim.hidden = true;
    document.body.classList.remove('sidebar-open');
    menuToggle.setAttribute('aria-expanded', 'false');
    menuToggle.focus();
  }

  function setupMobileNav() {
    if (menuToggle) menuToggle.addEventListener('click', openSidebar);
    if (sidebarClose) sidebarClose.addEventListener('click', closeSidebar);
    if (sidebarScrim) sidebarScrim.addEventListener('click', closeSidebar);

    if (sidebar) {
      sidebar.addEventListener('click', function (event) {
        if (event.target.closest('a')) closeSidebar();
      });
    }

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && sidebar && sidebar.classList.contains('is-open')) {
        closeSidebar();
      }
    });

    window.addEventListener('resize', function () {
      if (window.innerWidth > 900) closeSidebar();
    });
  }

  function setupShortcuts() {
    document.addEventListener('keydown', function (event) {
      var typing = PH.isEditableTarget(event.target);
      var searchOpen = PH.isSearchOpen();
      var dialogOpen = PH.isDialogOpen();

      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'c') {
        if (typing || searchOpen || dialogOpen) return;
        event.preventDefault();
        copyAllCode();
        return;
      }

      if (event.altKey && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
        if (typing || searchOpen || dialogOpen || event.ctrlKey || event.metaKey) return;
        event.preventDefault();
        goToPractical(state.pageNumber + (event.key === 'ArrowRight' ? 1 : -1));
      }
    });

    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) updateCompletionUi();
    });

    window.addEventListener('storage', function (event) {
      if (event.key === PH.storageKeys.completed) {
        updateCompletionUi();
        renderPracticalNav();
      }
    });
  }

  function renderError(title, message) {
    if (content) {
      content.setAttribute('aria-busy', 'false');
      content.innerHTML = '<div class="load-error">' +
        '<div class="section-kicker">PracticalHub</div>' +
        '<h1>' + PH.escapeHtml(title) + '</h1>' +
        '<p>' + PH.escapeHtml(message) + '</p>' +
        '<p>If you opened this file directly, serve the folder with any static web server, or use the deployed GitHub Pages site.</p>' +
        '<div class="load-error-actions"><a class="btn btn-primary" href="index.html">Back to dashboard</a><a class="btn" href="notebooks/">Open notebooks folder</a></div>' +
      '</div>';
    }
    document.title = 'Practical not found · PracticalHub';
  }

  async function loadPractical() {
    var pageNumber = getPageNumber();
    if (!pageNumber) {
      renderError('That practical does not exist', 'Choose a practical number from 1 to 10.');
      return;
    }

    state.pageNumber = pageNumber;

    try {
      var responses = await Promise.all([
        fetch('data/practicals.json', { cache: 'default' }),
        fetch('data/practical-' + pad(pageNumber) + '.json', { cache: 'default' })
      ]);

      if (!responses[0].ok || !responses[1].ok) throw new Error('Practical data request failed');

      var index = await responses[0].json();
      var practical = await responses[1].json();

      state.practicals = Array.isArray(index.practicals) ? index.practicals : [];
      state.practical = practical;

      renderPage();
      PH.pushRecent(practical.id);
    } catch (error) {
      renderError('The practical could not be loaded', 'The notebook data files are missing or could not be fetched.');
      if (window.console && console.error) console.error(error);
    }
  }

  function init() {
    PH.initCommon();
    if (content) content.addEventListener('click', handleContentClick);
    setupMobileNav();
    setupShortcuts();
    loadPractical();
  }

  init();
})();
