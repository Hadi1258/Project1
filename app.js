// Helpers (no :scope to maximize mobile compatibility)
const qs  = (s, r=document) => r.querySelector(s);
const qsa = (s, r=document) => Array.from(r.querySelectorAll(s));
const isDesktop = () => window.matchMedia('(min-width: 992px)').matches;

/* ===== MENU (Mobile: tap; Desktop: hover in CSS) ===== */
(function menus(){
  const toggleBtn = qs('.has-submenu .submenu-toggle');
  const root = toggleBtn ? toggleBtn.closest('.has-submenu') : null;
  const submenu = root ? root.querySelector('.submenu') : null;

  function closeAllBranches(scope){
    qsa('.branch', scope).forEach(b=>{
      b.classList.remove('open');
      const t = b.querySelector('.branch-toggle');
      if (t) t.setAttribute('aria-expanded', 'false');
    });
  }
  function closeRoot(){
    if (!root) return;
    root.classList.remove('open');
    toggleBtn.setAttribute('aria-expanded','false');
    closeAllBranches(root);
  }

  if (toggleBtn && root){
    toggleBtn.addEventListener('click', (e)=>{
      if (isDesktop()) return;
      e.preventDefault();
      const open = !root.classList.contains('open');
      root.classList.toggle('open', open);
      toggleBtn.setAttribute('aria-expanded', String(open));
      if (!open) closeAllBranches(root);
    });

    document.addEventListener('click', (e)=>{
      if (isDesktop()) return;
      if (root.contains(e.target) || e.target === toggleBtn) return;
      closeRoot();
    });

    window.addEventListener('resize', ()=>{
      if (isDesktop()){
        toggleBtn.setAttribute('aria-expanded','false');
        root.classList.remove('open');
        closeAllBranches(root);
      }
    }, {passive:true});
  }

  qsa('.branch .branch-toggle', submenu || document).forEach(btn=>{
    btn.addEventListener('click', (e)=>{
      if (isDesktop()) return; // desktop navigates
      const li = btn.closest('.branch');
      if (!li) return;
      const isOpen = li.classList.contains('open');
      const hasSub = li.querySelector('.subsubmenu');

      if (hasSub){
        e.preventDefault();
        Array.from(li.parentElement.children).forEach(sib=>{
          if (sib !== li && sib.classList.contains('branch')){
            sib.classList.remove('open');
            const t = sib.querySelector('.branch-toggle');
            if (t) t.setAttribute('aria-expanded','false');
          }
        });
        li.classList.toggle('open', !isOpen);
        btn.setAttribute('aria-expanded', String(!isOpen));
      }
    });
  });
})();

/* ===== COMPACT HEADER ON MOBILE SCROLL ===== */
(function compactHeader(){
  const header = qs('.site-header');
  if (!header) return;

  const THRESHOLD = 80;
  let last = null;

  function apply(shouldCompact){
    if (last === shouldCompact) return;
    last = shouldCompact;
    header.classList.toggle('compact', shouldCompact);
  }
  function onScrollOrResize(){
    if (isDesktop()) return apply(false);
    const y = window.pageYOffset || document.documentElement.scrollTop || 0;
    apply(y > THRESHOLD);
  }

  window.addEventListener('scroll', onScrollOrResize, {passive:true});
  window.addEventListener('touchmove', onScrollOrResize, {passive:true});
  window.addEventListener('resize', onScrollOrResize, {passive:true});
  document.addEventListener('DOMContentLoaded', onScrollOrResize);
  onScrollOrResize();
})();

/* ===== PREDICTIVE SEARCH (local) ===== */
(function predictiveSearch(){
  const input = qs('#site-search');
  const list  = qs('#search-suggestions');
  const form  = input ? input.closest('form') : null;
  if (!input || !list || !form) return;

  const escapeHTML = (s) => s.replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;' }[c]));
  const debounce = (fn, wait=140)=>{ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), wait); }; };

  const index = [];
  qsa('.category-tile').forEach(a=>{
    const h3 = a.querySelector('h3');
    const title = h3 ? h3.textContent.trim() : '';
    if (title) index.push({title, url:a.getAttribute('href')||'#', type:'Category'});
  });
  qsa('.submenu a').forEach(a=>{
    index.push({title:a.textContent.trim(), url:a.getAttribute('href')||'#', type:'Category'});
  });
  qsa('.card.product .content h3').forEach(h=>{
    const card = h.closest('.card');
    const action = card ? card.querySelector('.actions a[href]') : null;
    index.push({
      title:h.textContent.trim(),
      url:action ? action.getAttribute('href') : '#',
      type:card && card.classList.contains('service') ? 'Service' : 'Product'
    });
  });

  const score = (it,q)=>{
    const t=it.title.toLowerCase(), s=q.toLowerCase(); if(!s) return 0;
    let sc=0; if(t===s) sc+=100; else if(t.startsWith(s)) sc+=60; else if(t.includes(s)) sc+=40;
    if(!t.includes(s)){let i=0,j=0,miss=0; while(i<s.length&&j<t.length&&miss<=1){ if(s[i]===t[j]){i++;j++;} else {miss++;j++;} } if(i===s.length&&miss<=1) sc+=8;}
    sc += {Category:16,Product:12,Service:10}[it.type]||0; return sc;
  };

  const highlight=(L,Q)=>{
    const i=L.toLowerCase().indexOf(Q.toLowerCase());
    return i<0?escapeHTML(L):`${escapeHTML(L.slice(0,i))}<mark>${escapeHTML(L.slice(i,i+Q.length))}</mark>${escapeHTML(L.slice(i+Q.length))}`;
  };

  let active=-1;
  const render=(items,q)=>{
    list.innerHTML='';
    const cur=items.slice(0,8);
    if(!cur.length){ list.hidden=true; input.setAttribute('aria-expanded','false'); return; }
    cur.forEach((it,idx)=>{
      const li=document.createElement('li'); li.role='option'; li.id=`_sugg_${idx}`; li.dataset.url=it.url;
      li.innerHTML=`<span class="sugg-title">${highlight(it.title,q)}</span><span class="sugg-type">${it.type}</span>`;
      li.addEventListener('mousedown',e=>{
        e.preventDefault();
        if(it.url && it.url !== '#') window.location.href=it.url;
      });
      list.appendChild(li);
    });
    list.hidden=false; input.setAttribute('aria-expanded','true'); active=-1;
  };

  const doSearch = debounce(()=>{
    const q=input.value.trim();
    if(!q){ list.hidden=true; input.setAttribute('aria-expanded','false'); return; }
    const results=index.map(it=>({it,s:score(it,q)})).filter(x=>x.s>0).sort((a,b)=>b.s-a.s).map(x=>x.it);
    render(results,q);
  },110);

  input.addEventListener('input',doSearch);

  form.addEventListener('submit',e=>{
    const first = list.querySelector('li');
    if(first && !list.hidden){
      e.preventDefault();
      window.location.href = first.dataset.url;
    }
  });

  input.addEventListener('keydown',e=>{
    const items=[...list.querySelectorAll('li')];
    if(e.key==='ArrowDown'){e.preventDefault(); active=Math.min(active+1,items.length-1);}
    else if(e.key==='ArrowUp'){e.preventDefault(); active=Math.max(active-1,-1);}
    else if(e.key==='Enter'){
      if(!list.hidden && active>=0 && items[active]){
        e.preventDefault();
        window.location.href = items[active].dataset.url;
      }
    }
    else if(e.key==='Escape'){ list.hidden=true; input.setAttribute('aria-expanded','false'); active=-1; }
    items.forEach((el,i)=>el.setAttribute('aria-selected', String(i===active)));
    if(active>=0 && items[active]) items[active].scrollIntoView({block:'nearest'});
  });

  document.addEventListener('click',e=>{
    if(!list.hidden && !form.contains(e.target)){
      list.hidden=true; input.setAttribute('aria-expanded','false'); active=-1;
    }
  });

  input.addEventListener('blur',()=> {
    setTimeout(()=>{ list.hidden=true; input.setAttribute('aria-expanded','false'); active:-1; },120);
  });
})();

/* ===== IN-VIEW REVEAL ===== */
(function inView(){
  const els = Array.from(document.querySelectorAll('.reveal, .card, .section-head'));
  els.forEach(el => el.classList.add('reveal'));
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(en => {
      if (en.isIntersecting) {
        en.target.classList.add('is-visible');
        obs.unobserve(en.target);
      }
    });
  }, { threshold: 0.12 });
  els.forEach(el => obs.observe(el));
})();

/* ===== THEME TOGGLE ===== */
(function theme(){
  const btn = document.querySelector('.theme-toggle');
  if (!btn) return;
  const root = document.documentElement;
  const stored = localStorage.getItem('theme');
  if (stored) root.setAttribute('data-theme', stored);

  btn.addEventListener('click', ()=>{
    const cur = root.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    const next = cur === 'light' ? 'dark' : 'light';
    root.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
  });
})();

/* ===== CLOSE MENU ON ANCHOR NAV (mobile) ===== */
(function closeMenuOnAnchorNav(){
  const anchors = qsa('a[href^="#"]');
  const root = qs('.has-submenu');
  const toggleBtn = qs('.submenu-toggle');
  anchors.forEach(a=>{
    a.addEventListener('click', ()=>{
      if (!isDesktop() && root){
        root.classList.remove('open');
        if (toggleBtn) toggleBtn.setAttribute('aria-expanded','false');
      }
    });
  });
})();

/* ===== SERVICE WORKER (PWA) ===== */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const basePath = location.pathname.replace(/[^/]*$/, ''); // keeps trailing slash
    navigator.serviceWorker.register(basePath + 'sw.js').catch(console.error);
  });
}
