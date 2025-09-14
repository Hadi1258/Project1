/* app.js – Allo Recharge (robust desktop/mobile detection)
   - Computes layout mode (mobile vs desktop) using width + input capability
   - Locks desktop layout on hover/fine-pointer devices even when narrow
   - Header shrink only on real mobile
   - Mobile categories: tap to expand submenus on real mobile
   - Predictive search (kept from your version, unchanged except for mode guard)
*/

/* =============== Device/Mode detection =============== */
const MODE_BREAKPOINT = 960;

function hasHoverFine() {
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
}
function isCoarse() {
  return window.matchMedia('(pointer: coarse)').matches;
}
function hasTouchPoints() {
  return (navigator.maxTouchPoints || 0) > 0 || 'ontouchstart' in window;
}

function computeMode() {
  const narrow = window.innerWidth <= MODE_BREAKPOINT;
  const touchy = isCoarse() || hasTouchPoints();
  // Mobile ONLY if narrow AND touch-like input AND not hover+fine
  return (narrow && touchy && !hasHoverFine()) ? 'mobile' : 'desktop';
}

function applyModeClass(mode) {
  const html = document.documentElement;
  html.classList.toggle('mode-mobile', mode === 'mobile');
  html.classList.toggle('mode-desktop', mode !== 'mobile');
}

/* Desktop safety net: force desktop nav when hover+fine exists (even at narrow widths) */
function injectDesktopSafetyCSS() {
  if (document.getElementById('desktop-safety-css')) return;
  const css = `
  @media (hover: hover) and (pointer: fine){
    .site-header{
      grid-template-columns: auto 1fr auto;
      grid-template-areas: none;
      padding: 14px 16px;
      background: rgba(15,17,23,.7);
    }
    .site-header .search{ display:flex !important; }
    .site-header .site-nav{ display:block !important; position: static; transform:none; }
    .menu{
      display:flex !important; flex-direction: row !important; gap: 12px;
      background: transparent; border: 0; border-radius: 0; padding: 0; max-width: none;
    }
    .menu > .menu-item{ display:inline-flex !important; }
    .desktop-only{ display:inline-flex !important; }
    .submenu{
      position:absolute; left:0; transform: translateY(12px); min-width: 250px;
      background: var(--panel); border:1px solid var(--line);
      border-radius: var(--radius); box-shadow: var(--shadow); padding:8px; display:none;
    }
    .menu-item.has-submenu:hover > .submenu,
    .menu-item.has-submenu:focus-within > .submenu{ display:block; }
    .subsubmenu{
      position:absolute; left: calc(100% + 8px); top: 0; display:none; min-width: 220px;
      background: var(--panel); border:1px solid var(--line);
      border-radius: var(--radius); box-shadow: var(--shadow); padding:8px;
    }
    .submenu .has-submenu:hover > .subsubmenu,
    .submenu .has-submenu:focus-within > .subsubmenu{ display:block; }
    /* Ensure shrink never hides nav on desktop */
    .site-header.shrink .search,
    .site-header.shrink .site-nav{ display:flex !important; }
  }`;
  const style = document.createElement('style');
  style.id = 'desktop-safety-css';
  style.textContent = css;
  document.head.appendChild(style);
}

(function bootstrapMode(){
  injectDesktopSafetyCSS();
  applyModeClass(computeMode());
  window.addEventListener('resize', () => applyModeClass(computeMode()), { passive:true });
  window.addEventListener('orientationchange', () => applyModeClass(computeMode()), { passive:true });
})();

/* =============== DOM helpers =============== */
const qs  = (sel, root = document) => root.querySelector(sel);
const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));
function clamp(n, min, max){ return Math.max(min, Math.min(max, n)); }
function debounce(fn, wait = 160){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), wait); }; }
function norm(s){ return (s||'').toLowerCase(); }
function escapeHTML(s){ return s.replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;' }[c])); }
function isMobileMode(){ return document.documentElement.classList.contains('mode-mobile'); }
function trapWithinViewport(el){ if (el) el.style.maxWidth = '96vw'; }

/* =============== Header: shrink on scroll (mobile only) =============== */
(function headerShrink(){
  const header = qs('.site-header');
  if (!header) return;

  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      if (isMobileMode()) {
        const y = window.scrollY || 0;
        if (y > 20) header.classList.add('shrink');
        else header.classList.remove('shrink');
      } else {
        header.classList.remove('shrink');
      }
      ticking = false;
    });
  };
  window.addEventListener('scroll', onScroll, { passive:true });
  window.addEventListener('resize', onScroll, { passive:true });
  onScroll();
})();

/* =============== Menus: mobile tap-to-expand =============== */
(function menus(){
  const nav = qs('.site-nav');
  if (!nav) return;

  const rootItem     = qs('.menu-item.nav-categories', nav);
  const toggleButton = qs('.menu-item.nav-categories > .submenu-toggle', nav);
  const rootSubmenu  = qs('.menu-item.nav-categories > .submenu', nav);
  trapWithinViewport(rootSubmenu);

  function toggleRoot(){
    if (!rootItem) return;
    rootItem.classList.toggle('open');
    const isOpen = rootItem.classList.contains('open');
    if (toggleButton) toggleButton.setAttribute('aria-expanded', String(isOpen));
  }

  if (toggleButton) {
    toggleButton.addEventListener('click', (e) => {
      e.preventDefault();
      if (!isMobileMode()) return; // on desktop, let CSS hover handle it
      toggleRoot();
    });
  }

  function wireBranchToggles(){
    qsa('.submenu .has-submenu > a', rootItem).forEach(link => {
      if (link.__boundBranch) return;
      link.__boundBranch = true;

      link.addEventListener('click', (e) => {
        const li = link.parentElement;
        const sub = qs(':scope > .subsubmenu', li);
        if (!sub) return;

        if (isMobileMode()) {
          const isExpanded = li.classList.contains('expanded');
          if (!isExpanded) {
            e.preventDefault();
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
            trapWithinViewport(sub);
          }
          // second click navigates
        } // desktop = normal link
      });
    });
  }
  wireBranchToggles();

  function closeRoot(){
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
    // If we switched to desktop, ensure mobile-open state is cleared
    if (!isMobileMode()) closeRoot();
  }, { passive:true });
})();

/* =============== Predictive Search (unchanged) =============== */
(function predictiveSearch(){
  const input = document.querySelector('#site-search');
  const list  = document.querySelector('#search-suggestions');
  const form  = input?.closest('form');
  if (!input || !list || !form) return;

  const localIndex = [];
  document.querySelectorAll('.category-tile').forEach(a => {
    const title = a.querySelector('.title')?.textContent?.trim();
    if (!title) return;
    localIndex.push({ title, url: a.getAttribute('href') || '#', type:'Category', keywords:[title,'category'] });
  });
  document.querySelectorAll('.menu .submenu a').forEach(a => {
    const title = a.textContent.trim();
    localIndex.push({ title, url: a.getAttribute('href') || '#', type: a.closest('.subsubmenu') ? 'Subcategory' : 'Category', keywords:[title] });
  });
  document.querySelectorAll('.card.product .title').forEach(t => {
    const card = t.closest('.card.product');
    const action = card?.querySelector('.actions a[href]');
    const url = action?.getAttribute('href') || '#';
    const title = t.textContent.trim();
    localIndex.push({ title, url, type: card?.classList.contains('service') ? 'Service' : 'Product', keywords:[title] });
  });

  let remoteIndex = [];
  fetch('/search-index.json', { method:'GET' })
    .then(r => r.ok ? r.json() : [])
    .then(data => { if (Array.isArray(data)) remoteIndex = data; })
    .catch(()=>{});

  const getIndex = () => [...remoteIndex, ...localIndex];

  const typeBoost = { Category:16, Subcategory:14, Product:12, Service:10 };
  const clamp2 = (v,a,b)=>Math.max(a,Math.min(b,v));
  const scoreItem = (item, q) => {
    const query = (q||'').toLowerCase(); if (!query) return 0;
    const t = (item.title||'').toLowerCase();
    const kws = (item.keywords||[]).map(s=>(s||'').toLowerCase());
    let s = 0;
    if (t === query) s += 100; else if (t.startsWith(query)) s += 65; else if (t.includes(query)) s += 40;
    for (const k of kws){ if (k===query){s+=35;break;} if (k.startsWith(query)){s+=22;break;} if (k.includes(query)){s+=10;} }
    s += (typeBoost[item.type]||0);
    if (!t.includes(query)){ let miss=0,i=0,j=0; while(i<query.length&&j<t.length&&miss<=1){ if(query[i]===t[j]){i++;j++;} else {miss++;j++;} } if(i===query.length&&miss<=1) s+=8; }
    return s;
  };

  const highlight = (label,q)=>{
    const L = label||'', Q=(q||'').toLowerCase();
    const i = L.toLowerCase().indexOf(Q);
    if (i === -1) return escapeHTML(L);
    return `${escapeHTML(L.slice(0,i))}<mark>${escapeHTML(L.slice(i,i+Q.length))}</mark>${escapeHTML(L.slice(i+Q.length))}`;
  };

  let activeIndex = -1; let current = [];
  const render = (items,q)=>{
    current = items.slice(0,8); list.innerHTML='';
    if (!current.length){ list.hidden=true; input.setAttribute('aria-expanded','false'); return; }
    current.forEach((it,idx)=>{
      const li = document.createElement('li');
      li.role='option'; li.id=`sugg-${idx}`; li.dataset.url=it.url; li.dataset.index=String(idx);
      li.innerHTML = `<span class="sugg-title">${highlight(it.title,q)}</span><span class="sugg-type">${escapeHTML(it.type)}</span>`;
      li.addEventListener('mousedown', (e)=>{ e.preventDefault(); if (it.url && it.url !== '#') window.location.href = it.url; });
      list.appendChild(li);
    });
    list.hidden=false; input.setAttribute('aria-expanded','true'); activeIndex=-1;
  };

  const doSearch = debounce(()=>{
    const q = input.value.trim(); if (!q){ list.hidden=true; input.setAttribute('aria-expanded','false'); return; }
    const withScores = getIndex().map(it=>({it,s:scoreItem(it,q)})).filter(x=>x.s>0).sort((a,b)=>b.s-a.s).map(x=>x.it);
    render(withScores,q);
  },110);

  input.addEventListener('input', doSearch);
  form.addEventListener('submit', (e)=>{
    e.preventDefault(); const q=input.value.trim(); if(!q) return;
    const items = Array.from(list.querySelectorAll('li'));
    if (activeIndex>=0 && items[activeIndex]) { const url = items[activeIndex].dataset.url; if (url && url !== '#') window.location.href = url; return; }
    if (items[0]) { const url = items[0].dataset.url; if (url && url !== '#') window.location.href = url; }
  });
  input.addEventListener('keydown', (e)=>{
    const items = Array.from(list.querySelectorAll('li'));
    if (e.key==='ArrowDown'){ e.preventDefault(); activeIndex = clamp2(activeIndex+1,-1,items.length-1); }
    else if (e.key==='ArrowUp'){ e.preventDefault(); activeIndex = clamp2(activeIndex-1,-1,items.length-1); }
    else if (e.key==='Enter'){ if(!list.hidden && activeIndex>=0 && items[activeIndex]){ e.preventDefault(); const url=items[activeIndex].dataset.url; if (url && url !== '#') window.location.href=url; } }
    else if (e.key==='Escape'){ list.hidden=true; input.setAttribute('aria-expanded','false'); activeIndex=-1; }
    items.forEach((el,i)=>el.setAttribute('aria-selected', String(i===activeIndex)));
    if (activeIndex>=0 && items[activeIndex]) items[activeIndex].scrollIntoView({block:'nearest'});
  });
  document.addEventListener('click', (e)=>{ if(!list.hidden && !form.contains(e.target)){ list.hidden=true; input.setAttribute('aria-expanded','false'); activeIndex=-1; } });
  input.addEventListener('blur', ()=>{ setTimeout(()=>{ list.hidden=true; input.setAttribute('aria-expanded','false'); activeIndex=-1; },120); });
})();


