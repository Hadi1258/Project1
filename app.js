/* app.js
   Allo Recharge – interactions:
   - Header shrink-to-logo on scroll (≤960px)
   - Mobile Categories behavior (tap to expand parent)
   - Predictive Search (autocomplete suggestions)
*/

/* =========================
   Utilities
========================= */
const MOBILE_MEDIA = '(max-width: 960px)';
const isMobile = () => window.matchMedia(MOBILE_MEDIA).matches;

const qs  = (sel, root = document) => root.querySelector(sel);
const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
function debounce(fn, wait = 160) {
  let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
}
function norm(s) { return (s || '').toLowerCase(); }
function escapeHTML(s){ return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c])); }

/* Limit dropdown width on mobile to avoid horizontal scroll */
function trapWithinViewport(el) {
  if (!el) return;
  el.style.maxWidth = '96vw';
}

/* =========================
   Header: shrink on scroll
========================= */
(function headerShrink() {
  const header = qs('.site-header');
  if (!header) return;

  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      if (isMobile()) {
        const y = window.scrollY || 0;
        if (y > 20) header.classList.add('shrink');
        else header.classList.remove('shrink');
      } else {
        header.classList.remove('shrink');
      }
      ticking = false;
    });
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  onScroll();
})();

/* =========================================
   Menus: Categories + branch submenus
   - Desktop: CSS hover/focus handles it
   - Mobile: JS toggles; prevent redirects on first tap
========================================= */
(function menus() {
  const nav = qs('.site-nav');
  if (!nav) return;

  const rootItem     = qs('.menu-item.nav-categories', nav);
  const toggleButton = qs('.menu-item.nav-categories > .submenu-toggle', nav);
  const rootSubmenu  = qs('.menu-item.nav-categories > .submenu', nav);

  trapWithinViewport(rootSubmenu);

  function toggleRoot() {
    if (!rootItem) return;
    rootItem.classList.toggle('open');
    const isOpen = rootItem.classList.contains('open');
    if (toggleButton) toggleButton.setAttribute('aria-expanded', String(isOpen));
  }

  if (toggleButton) {
    toggleButton.addEventListener('click', (e) => {
      e.preventDefault();
      toggleRoot();
    });
  }

  // Branch submenu behavior
  function wireBranchToggles() {
    qsa('.submenu .has-submenu > a', rootItem).forEach(link => {
      if (link.__boundBranch) return;
      link.__boundBranch = true;

      link.addEventListener('click', (e) => {
        const li = link.parentElement;
        const hasSub = !!qs(':scope > .subsubmenu', li);
        if (!hasSub) return;

        if (isMobile()) {
          const isExpanded = li.classList.contains('expanded');
          if (!isExpanded) {
            e.preventDefault();             // no redirect on first tap
            // close siblings
            qsa(':scope > .has-submenu', li.parentElement).forEach(sib => {
              if (sib !== li) {
                sib.classList.remove('expanded');
                const a = qs(':scope > a', sib);
                if (a) a.setAttribute('aria-expanded', 'false');
              }
            });
            li.classList.add('expanded');
            link.setAttribute('aria-expanded', 'true');
            trapWithinViewport(qs(':scope > .subsubmenu', li));
          } // second tap navigates
        }
      });
    });
  }
  wireBranchToggles();

  // Outside click closes Categories
  function closeRoot() {
    if (!rootItem) return;
    rootItem.classList.remove('open');
    toggleButton && toggleButton.setAttribute('aria-expanded', 'false');
    qsa('.submenu .has-submenu.expanded', rootItem).forEach(li => {
      li.classList.remove('expanded');
      const a = qs(':scope > a', li);
      if (a) a.setAttribute('aria-expanded', 'false');
    });
  }
  document.addEventListener('click', (e) => {
    if (!rootItem) return;
    if (!rootItem.contains(e.target) && e.target !== toggleButton) closeRoot();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeRoot(); });

  window.addEventListener('resize', () => {
    trapWithinViewport(rootSubmenu);
    qsa('.subsubmenu', rootItem).forEach(trapWithinViewport);
  }, { passive:true });
})();

/* =========================================
   Predictive Search
   - Builds an index from the page (and optional /search-index.json)
   - Fuzzy-ish scoring, highlighted matches
   - Keyboard nav (↑/↓/Enter/Esc), mouse, outside-click
========================================= */
(function predictiveSearch(){
  const input = qs('#site-search');
  const list  = qs('#search-suggestions');
  const form  = input?.closest('form');

  if (!input || !list || !form) return;

  /* ---------- Build a search index ---------- */
  const localIndex = [];

  // 1) Category tiles on homepage
  qsa('.category-tile').forEach(a => {
    const title = a.querySelector('.title')?.textContent?.trim();
    if (!title) return;
    localIndex.push({
      title,
      url: a.getAttribute('href') || '#',
      type: 'Category',
      keywords: [title, 'category']
    });
  });

  // 2) Menu categories + subcategories
  qsa('.menu .submenu a').forEach(a => {
    const title = a.textContent.trim();
    localIndex.push({
      title,
      url: a.getAttribute('href') || '#',
      type: a.closest('.subsubmenu') ? 'Subcategory' : 'Category',
      keywords: [title]
    });
  });

  // 3) Products/services displayed on this page
  qsa('.card.product .title').forEach(t => {
    const card = t.closest('.card.product');
    const action = card?.querySelector('.actions a[href]');
    const url = action?.getAttribute('href') || '#';
    const title = t.textContent.trim();
    localIndex.push({
      title,
      url,
      type: card?.classList.contains('service') ? 'Service' : 'Product',
      keywords: [title]
    });
  });

  // Optional remote index: /search-index.json (if you add it later)
  // Structure [{title, url, type, keywords: []}, ...]
  let remoteIndex = [];
  fetch('/search-index.json', { method:'GET' })
    .then(r => r.ok ? r.json() : [])
    .then(data => { if (Array.isArray(data)) remoteIndex = data; })
    .catch(() => { /* no external index; fine */ });

  function getIndex(){
    // Combine remote+local; remote first so you can override
    return [...remoteIndex, ...localIndex];
  }

  /* ---------- Scoring + matching ---------- */
  function scoreItem(item, q) {
    const query = norm(q);
    if (!query) return 0;

    const t = norm(item.title);
    const kws = (item.keywords || []).map(norm);

    // base: contains
    let score = 0;
    if (t === query) score += 100;
    else if (t.startsWith(query)) score += 65;
    else if (t.includes(query)) score += 40;

    // keywords boost
    for (const k of kws) {
      if (k === query) { score += 35; break; }
      if (k.startsWith(query)) { score += 22; break; }
      if (k.includes(query)) { score += 10; }
    }

    // Type weighting (you can tune this)
    const typeBoost = { 'Category': 16, 'Subcategory': 14, 'Product': 12, 'Service': 10 };
    score += (typeBoost[item.type] || 0);

    // micro fuzzy: allow single missing char
    if (!t.includes(query)) {
      let miss = 0, i = 0, j = 0;
      while (i < query.length && j < t.length && miss <= 1) {
        if (query[i] === t[j]) { i++; j++; }
        else { miss++; j++; }
      }
      if (i === query.length && miss <= 1) score += 8;
    }

    return score;
  }

  function highlight(label, q){
    if (!q) return escapeHTML(label);
    const L = label;
    const i = norm(L).indexOf(norm(q));
    if (i === -1) return escapeHTML(L);
    const a = escapeHTML(L.slice(0, i));
    const b = escapeHTML(L.slice(i, i + q.length));
    const c = escapeHTML(L.slice(i + q.length));
    return `${a}<mark>${b}</mark>${c}`;
  }

  /* ---------- Render suggestions ---------- */
  let activeIndex = -1;
  let currentItems = [];

  function renderSuggestions(items, q){
    currentItems = items.slice(0, 8);
    list.innerHTML = '';

    if (!currentItems.length) {
      list.hidden = true;
      input.setAttribute('aria-expanded','false');
      return;
    }

    currentItems.forEach((it, idx) => {
      const li = document.createElement('li');
      li.role = 'option';
      li.id = `sugg-${idx}`;
      li.dataset.url = it.url;
      li.dataset.index = String(idx);
      li.innerHTML = `
        <span class="sugg-title">${highlight(it.title, q)}</span>
        <span class="sugg-type">${escapeHTML(it.type)}</span>
      `;
      li.addEventListener('mousedown', (e) => {
        // mousedown so it fires before input loses focus
        e.preventDefault();
        navigateTo(it.url);
      });
      list.appendChild(li);
    });

    list.hidden = false;
    input.setAttribute('aria-expanded','true');
    activeIndex = -1;
  }

  function updateActive(newIndex){
    const items = qsa('li', list);
    activeIndex = clamp(newIndex, -1, items.length - 1);
    items.forEach((el, i) => {
      el.setAttribute('aria-selected', String(i === activeIndex));
    });
    if (activeIndex >= 0) {
      const el = items[activeIndex];
      el.scrollIntoView({ block:'nearest' });
    }
  }

  function navigateTo(url){
    if (!url || url === '#') return;
    window.location.href = url;
  }

  /* ---------- Query handling ---------- */
  const doSearch = debounce(() => {
    const q = input.value.trim();
    if (!q) {
      list.hidden = true;
      input.setAttribute('aria-expanded','false');
      return;
    }

    const index = getIndex();
    const withScores = index
      .map(it => ({ it, s: scoreItem(it, q) }))
      .filter(x => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .map(x => x.it);

    renderSuggestions(withScores, q);
  }, 110);

  input.addEventListener('input', doSearch);

  // Submit: if a suggestion is active, go there; else try the best match
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = input.value.trim();
    if (!q) return;

    const items = qsa('li', list);
    if (activeIndex >= 0 && items[activeIndex]) {
      navigateTo(items[activeIndex].dataset.url);
      return;
    }
    // fallback: first suggestion if any
    if (items[0]) {
      navigateTo(items[0].dataset.url);
    } else {
      // no suggestions — do nothing or route to a generic search page if you add one
    }
  });

  // Keyboard navigation
  input.addEventListener('keydown', (e) => {
    const items = qsa('li', list);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      updateActive(activeIndex + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      updateActive(activeIndex - 1);
    } else if (e.key === 'Enter') {
      if (!list.hidden) {
        e.preventDefault();
        if (activeIndex >= 0 && items[activeIndex]) {
          navigateTo(items[activeIndex].dataset.url);
        }
      }
    } else if (e.key === 'Escape') {
      list.hidden = true;
      input.setAttribute('aria-expanded','false');
      activeIndex = -1;
    }
  });

  // Close on outside click or blur
  document.addEventListener('click', (e) => {
    if (!list.hidden && !form.contains(e.target)) {
      list.hidden = true;
      input.setAttribute('aria-expanded','false');
      activeIndex = -1;
    }
  });

  input.addEventListener('blur', () => {
    // small delay so mousedown on a suggestion can run first
    setTimeout(() => {
      list.hidden = true;
      input.setAttribute('aria-expanded','false');
      activeIndex = -1;
    }, 120);
  });

})();

