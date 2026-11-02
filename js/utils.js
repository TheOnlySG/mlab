(function () {
  'use strict';

  var PH = window.PracticalHub = window.PracticalHub || {};

  var KEYS = {
    completed: 'ph:completed',
    recent: 'ph:recent',
    quick: 'ph:quick-mode'
  };

  function readStorage(key, fallback) {
    try {
      var value = window.localStorage.getItem(key);
      return value === null ? fallback : value;
    } catch (error) {
      return fallback;
    }
  }

  function writeStorage(key, value) {
    try {
      window.localStorage.setItem(key, value);
      return true;
    } catch (error) {
      return false;
    }
  }

  PH.storageKeys = KEYS;

  PH.escapeHtml = function (value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (character) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[character];
    });
  };

  PH.isEditableTarget = function (target) {
    if (!target || !target.tagName) return false;
    var tag = target.tagName.toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable === true;
  };

  PH.isSearchOpen = function () {
    var modal = document.getElementById('search-modal');
    return !!modal && !modal.hidden;
  };

  PH.isDialogOpen = function () {
    var dialog = document.getElementById('shortcuts-dialog');
    return !!dialog && dialog.open;
  };

  /* ---------------------------------------------------------------- storage */

  PH.getCompleted = function () {
    var raw = readStorage(KEYS.completed, '{}');
    try {
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch (error) {
      return {};
    }
  };

  PH.isCompleted = function (id) {
    return PH.getCompleted()[id] === true;
  };

  PH.setCompleted = function (id, completed) {
    var map = PH.getCompleted();
    if (completed) {
      map[id] = true;
    } else {
      delete map[id];
    }
    writeStorage(KEYS.completed, JSON.stringify(map));
    return map;
  };

  PH.countCompleted = function () {
    var map = PH.getCompleted();
    return Object.keys(map).filter(function (key) { return map[key] === true; }).length;
  };

  PH.getRecent = function () {
    var raw = readStorage(KEYS.recent, '[]');
    try {
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter(function (item) { return typeof item === 'string'; }).slice(0, 8) : [];
    } catch (error) {
      return [];
    }
  };

  PH.pushRecent = function (id) {
    if (!id) return;
    var recent = PH.getRecent().filter(function (item) { return item !== id; });
    recent.unshift(id);
    writeStorage(KEYS.recent, JSON.stringify(recent.slice(0, 8)));
  };

  PH.getQuickMode = function () {
    return readStorage(KEYS.quick, '0') === '1';
  };

  PH.setQuickMode = function (enabled) {
    writeStorage(KEYS.quick, enabled ? '1' : '0');
  };

  PH.applyQuickMode = function (enabled) {
    var root = document.documentElement;
    if (enabled) {
      root.dataset.quick = '1';
    } else {
      root.dataset.quick = '0';
    }
    document.querySelectorAll('[data-quick-toggle]').forEach(function (button) {
      button.setAttribute('aria-pressed', enabled ? 'true' : 'false');
      button.title = enabled ? 'Quick Mode is on (Q)' : 'Toggle Quick Mode (Q)';
    });
  };

  PH.toggleQuickMode = function () {
    var next = !PH.getQuickMode();
    PH.setQuickMode(next);
    PH.applyQuickMode(next);
    PH.showToast(next ? 'Quick Mode on — code first, theory hidden' : 'Quick Mode off', 'info');
  };

  /* ------------------------------------------------------------------ toast */

  var toastTimer = null;

  PH.showToast = function (message, type) {
    var toast = document.getElementById('toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'toast';
      toast.className = 'toast';
      toast.setAttribute('role', 'status');
      toast.setAttribute('aria-live', 'polite');
      document.body.appendChild(toast);
    }
    toast.className = 'toast toast--' + (type || 'success');
    toast.textContent = message;
    window.clearTimeout(toastTimer);
    window.requestAnimationFrame(function () {
      toast.classList.add('is-visible');
    });
    toastTimer = window.setTimeout(function () {
      toast.classList.remove('is-visible');
    }, 2600);
  };

  /* ------------------------------------------------------------------- copy */

  PH.copyText = async function (text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (error) {
      /* fall through to the legacy path */
    }

    try {
      var textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.top = '-1000px';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      var ok = document.execCommand('copy');
      textarea.remove();
      return ok;
    } catch (error) {
      return false;
    }
  };

  /* -------------------------------------------------------------- downloads */

  PH.downloadBlob = function (filename, blob) {
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
  };

  PH.downloadText = function (filename, text, mime) {
    PH.downloadBlob(filename, new Blob([text], { type: (mime || 'text/plain') + ';charset=utf-8' }));
  };

  PH.loadScript = function (src) {
    var cache = PH._scriptCache || (PH._scriptCache = {});
    if (cache[src]) return cache[src];
    cache[src] = new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = function () { resolve(true); };
      script.onerror = function () {
        delete cache[src];
        reject(new Error('Could not load ' + src));
      };
      document.head.appendChild(script);
    });
    return cache[src];
  };

  /* ------------------------------------------------------------ notebook ops */

  PH.combineCode = function (cells) {
    return (cells || [])
      .filter(function (cell) {
        return cell && cell.type === 'code' && typeof cell.source === 'string' && cell.source.trim() !== '';
      })
      .map(function (cell) { return cell.source; })
      .join('\n\n');
  };

  PH.firstLine = function (source, limit) {
    var lines = String(source || '').split(/\r?\n/);
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (line) return line.slice(0, limit || 90);
    }
    return '';
  };

  /* ---------------------------------------------------------------- markdown */

  function safeUrlAttr(url) {
    var value = String(url || '').trim();
    if (!value) return null;
    if (/^\s*(javascript|vbscript|data):/i.test(value)) return null;
    if (/^(https?:|mailto:|#|\.{0,2}\/|\/)/i.test(value)) return value;
    if (/^[\w.~-]+(?:[\/?#][\w.~=\-&%#?\/]*)?$/.test(value)) return value;
    return null;
  }

  function inlineFormat(raw) {
    var codeSpans = [];
    var text = String(raw == null ? '' : raw);

    text = text.replace(/`([^`]+)`/g, function (match, code) {
      codeSpans.push(code);
      return '\u0000CODE' + (codeSpans.length - 1) + '\u0000';
    });

    text = PH.escapeHtml(text);

    var links = [];
    text = text.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (match, label, url) {
      var safe = safeUrlAttr(url);
      if (!safe) return label;
      var external = /^https?:/i.test(safe);
      links.push('<a href="' + safe + '"' + (external ? ' target="_blank" rel="noopener noreferrer"' : '') + '>' + label + '</a>');
      return '\u0001LINK' + (links.length - 1) + '\u0001';
    });

    text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/__([^_]+)__/g, '<strong>$1</strong>');
    text = text.replace(/(^|[^*\w])\*([^*\n]+)\*/g, '$1<em>$2</em>');
    text = text.replace(/(^|[^\w])_([^_\n]+)_/g, '$1<em>$2</em>');

    text = text.replace(/\u0001LINK(\d+)\u0001/g, function (match, index) {
      return links[Number(index)] || '';
    });
    text = text.replace(/\u0000CODE(\d+)\u0000/g, function (match, index) {
      return '<code>' + PH.escapeHtml(codeSpans[Number(index)] || '') + '</code>';
    });

    return text;
  }
  PH.inlineFormat = inlineFormat;

  function isTableSeparator(line) {
    return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
  }

  function splitTableRow(line) {
    var value = line.trim();
    if (value.charAt(0) === '|') value = value.slice(1);
    if (value.charAt(value.length - 1) === '|') value = value.slice(0, -1);
    return value.split('|').map(function (cell) { return cell.trim(); });
  }

  PH.renderMarkdown = function (source, idPrefix) {
    var lines = String(source || '').replace(/\r\n?/g, '\n').split('\n');
    var html = [];
    var headingCount = 0;
    var prefix = idPrefix || 'md';
    var i = 0;

    while (i < lines.length) {
      var line = lines[i];

      if (line.trim() === '') {
        i++;
        continue;
      }

      var fence = line.match(/^\s*```([\w+-]*)\s*$/);
      if (fence) {
        var code = [];
        i++;
        while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) {
          code.push(lines[i]);
          i++;
        }
        if (i < lines.length) i++;
        var language = fence[1] ? ' class="language-' + PH.escapeHtml(fence[1]) + '"' : '';
        html.push('<pre class="md-code"><code' + language + '>' + PH.escapeHtml(code.join('\n')) + '</code></pre>');
        continue;
      }

      var heading = line.match(/^(#{1,6})\s+(.*)$/);
      if (heading) {
        headingCount++;
        var level = heading[1].length;
        var id = prefix + '-heading-' + headingCount;
        html.push('<h' + level + ' id="' + id + '">' + inlineFormat(heading[2].trim()) + '</h' + level + '>');
        i++;
        continue;
      }

      if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
        html.push('<hr>');
        i++;
        continue;
      }

      if (/^\s*>\s?/.test(line)) {
        var quote = [];
        while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
          quote.push(lines[i].replace(/^\s*>\s?/, ''));
          i++;
        }
        html.push('<blockquote>' + inlineFormat(quote.join(' ')) + '</blockquote>');
        continue;
      }

      if (/^\s*([-*+]|\d+\.)\s+/.test(line)) {
        var ordered = /^\s*\d+\./.test(line);
        var items = [];
        while (i < lines.length) {
          var itemMatch = lines[i].match(/^\s*([-*+]|\d+\.)\s+(.*)$/);
          if (!itemMatch) break;
          var itemText = [itemMatch[2]];
          i++;
          while (
            i < lines.length &&
            lines[i].trim() !== '' &&
            !/^\s*([-*+]|\d+\.)\s+/.test(lines[i]) &&
            !/^#{1,6}\s+/.test(lines[i]) &&
            !/^\s*```/.test(lines[i]) &&
            !/^\s*>\s?/.test(lines[i])
          ) {
            itemText.push(lines[i].trim());
            i++;
          }
          items.push('<li>' + inlineFormat(itemText.join(' ')) + '</li>');
          if (i < lines.length && lines[i].trim() === '') break;
        }
        html.push('<' + (ordered ? 'ol' : 'ul') + '>' + items.join('') + '</' + (ordered ? 'ol' : 'ul') + '>');
        continue;
      }

      if (line.indexOf('|') !== -1 && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
        var headers = splitTableRow(line);
        i += 2;
        var rows = [];
        while (i < lines.length && lines[i].trim() !== '' && lines[i].indexOf('|') !== -1) {
          rows.push(splitTableRow(lines[i]));
          i++;
        }
        var headHtml = headers.map(function (cell) { return '<th>' + inlineFormat(cell) + '</th>'; }).join('');
        var bodyHtml = rows.map(function (row) {
          return '<tr>' + row.map(function (cell) { return '<td>' + inlineFormat(cell) + '</td>'; }).join('') + '</tr>';
        }).join('');
        html.push('<div class="md-table-wrap"><table><thead><tr>' + headHtml + '</tr></thead><tbody>' + bodyHtml + '</tbody></table></div>');
        continue;
      }

      var paragraph = [line];
      i++;
      while (
        i < lines.length &&
        lines[i].trim() !== '' &&
        !/^#{1,6}\s+/.test(lines[i]) &&
        !/^\s*([-*+]|\d+\.)\s+/.test(lines[i]) &&
        !/^\s*```/.test(lines[i]) &&
        !/^\s*>\s?/.test(lines[i])
      ) {
        paragraph.push(lines[i]);
        i++;
      }
      html.push('<p>' + inlineFormat(paragraph.join(' ').trim()) + '</p>');
    }

    return html.join('\n');
  };

  function plainInline(value) {
    return String(value || '')
      .replace(/`([^`]*)`/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/_([^_]+)_/g, '$1')
      .trim();
  }

  PH.extractHeadings = function (source, idPrefix) {
    var lines = String(source || '').replace(/\r\n?/g, '\n').split('\n');
    var headings = [];
    var count = 0;
    var inFence = false;
    var prefix = idPrefix || 'md';

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (/^\s*```/.test(line)) {
        inFence = !inFence;
        continue;
      }
      if (inFence) continue;
      var match = line.match(/^(#{1,6})\s+(.*)$/);
      if (match) {
        count++;
        headings.push({
          level: match[1].length,
          text: plainInline(match[2]),
          id: prefix + '-heading-' + count
        });
      }
    }

    return headings;
  };

  /* --------------------------------------------------------------- sanitizer */

  PH.sanitizeTableHtml = function (html) {
    var template = document.createElement('template');
    template.innerHTML = String(html || '');
    template.content
      .querySelectorAll('script,style,link,meta,iframe,object,embed,form,input,button,textarea,select')
      .forEach(function (node) { node.remove(); });

    template.content.querySelectorAll('*').forEach(function (element) {
      Array.prototype.slice.call(element.attributes).forEach(function (attribute) {
        var name = attribute.name.toLowerCase();
        if (name.indexOf('on') === 0 || name === 'src' || name === 'href' || name === 'srcdoc' || name === 'formaction') {
          element.removeAttribute(attribute.name);
          return;
        }
        if (['class', 'colspan', 'rowspan', 'scope', 'title', 'aria-label'].indexOf(name) === -1) {
          element.removeAttribute(attribute.name);
        }
      });
    });

    return template.innerHTML;
  };

  /* ------------------------------------------------------------ shared setup */

  var commonInitialized = false;

  function initShortcutsDialog() {
    var dialog = document.getElementById('shortcuts-dialog');
    if (!dialog) return;

    document.querySelectorAll('[data-open-shortcuts]').forEach(function (button) {
      button.addEventListener('click', function () {
        if (typeof dialog.showModal === 'function' && !dialog.open) dialog.showModal();
      });
    });

    document.querySelectorAll('[data-close-shortcuts]').forEach(function (button) {
      button.addEventListener('click', function () { dialog.close(); });
    });

    dialog.addEventListener('click', function (event) {
      if (event.target === dialog) dialog.close();
    });
  }

  function handleGlobalShortcut(event) {
    if (event.defaultPrevented) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (PH.isEditableTarget(event.target)) return;
    if (PH.isSearchOpen()) return;

    var key = event.key.toLowerCase();

    if (key === 'q') {
      event.preventDefault();
      PH.toggleQuickMode();
      return;
    }

    if (event.key === '?') {
      var dialog = document.getElementById('shortcuts-dialog');
      if (!dialog || dialog.open) return;
      event.preventDefault();
      if (typeof dialog.showModal === 'function') dialog.showModal();
    }
  }

  PH.initCommon = function () {
    if (commonInitialized) return;
    commonInitialized = true;

    PH.applyQuickMode(PH.getQuickMode());

    document.querySelectorAll('[data-quick-toggle]').forEach(function (button) {
      button.addEventListener('click', function () { PH.toggleQuickMode(); });
    });

    initShortcutsDialog();
    document.addEventListener('keydown', handleGlobalShortcut);
  };
})();
