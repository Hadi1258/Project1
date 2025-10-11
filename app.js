// Mobile-only menu behavior; desktop uses hover via CSS.
const qs  = (s, r=document) => r.querySelector(s);
const qsa = (s, r=document) => Array.from(r.querySelectorAll(s));
const isDesktop = () => window.matchMedia('(min-width: 992px)').matches;

/* Categories dropdown + branch accordions */
(function menus(){
  const toggleBtn = qs('.has-submenu .submenu-toggle');
  const root = toggleBtn?.closest('.has-submenu');

  function closeRoot(){
    if (!root) return;
    root.classList.remove('open');
    toggleBtn.setAttribute('aria-expanded','false');
    qsa('.branch', root).forEach(b=>{
      b.classList.remove('open');
      b.querySelector('.branch-toggle')?.setAttribute('aria-expanded','false');
      const a = b.matches('.has-submenu') ? qs(':scope > a', b) : null;
      if (a) a.setAttribute('aria-expanded','false');
    });
  }

  if (toggleBtn && root){
    toggleBtn.addEventListener('click', (e)=>{
      if (isDesktop()) return;
      e.preventDefault();
      const open = root.classList.toggle('open');
      toggleBtn.setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('click', (e)=>{
      if (isDesktop()) return;
      if (!root.contains(e.target)) closeRoot();
    });
    window.addEventListener('resize', ()=>{ if (isDesktop()) closeRoot(); }, {passive:true});
  }

  qsa('.branch .branch-toggle').forEach(btn=>{
    btn.addEventListener('click', (e)=>{
      if (isDesktop()) return;
      e.preventDefault();
      const li = btn.closest('.branch');
      const open = li.classList.toggle('open');
      btn.setAttribute('aria-expanded', String(open));
      li.parentElement.querySelectorAll('.branch').forEach(sib=>{
        if (sib !== li){
          sib.classList.remove('open');
          sib.querySelector('.branch-toggle')?.setAttribute('aria-expanded','false');
          const a = sib.matches('.has-submenu') ? qs(':scope > a', sib) : null;
          if (a) a.setAttribute('aria-expanded','false');
        }
      });
    });
  });

  // anchor-based branch headers (tap to toggle; tap again to close)
  qsa('.submenu .has-submenu > a').forEach(link=>{
    link.addEventListener('click', (e)=>{
      if (isDesktop()) return;
      const li = link.parentElement;
      const sub = qs(':scope > .subsubmenu', li);
      if (!sub) return;
      e.preventDefault();
      const nowOpen = !li.classList.contains('open');
      li.parentElement.querySelectorAll('.has-submenu').forEach(sib=>{
        if (sib !== li){
          sib.classList.remove('open');
          const sb = qs(':scope > a', sib);
          if (sb) sb.setAttribute('aria-expanded','false');
          const bt = qs(':scope > .branch-toggle', sib);
          if (bt) bt.setAttribute('aria-expanded','false');
        }
      });
      li.classList.toggle('open', nowOpen);
      link.setAttribute('aria-expanded', String(nowOpen));
    });
  });
})();


/* Predictive search (local) */
(function predictiveSearch(){
  const input = qs('#site-search');
  const list  = qs('#search-suggestions');
  const form  = input?.closest('form');
  if (!input || !list || !form) return;

  const escapeHTML = (s) => s.replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;' }[c]));
  const debounce = (fn, wait=140)=>{ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), wait); }; };

  const index = [];
  document.querySelectorAll('.category-tile').forEach(a=>{
    const title = a.querySelector('h3')?.textContent?.trim();
    if (title) index.push({title, url:a.getAttribute('href')||'#', type:'Category'});
  });
  document.querySelectorAll('.submenu a').forEach(a=>{
    index.push({title:a.textContent.trim(), url:a.getAttribute('href')||'#', type:'Category'});
  });
  document.querySelectorAll('.card.product .content h3').forEach(h=>{
    const card = h.closest('.card');
    const action = card?.querySelector('.actions a[href]');
    index.push({title:h.textContent.trim(), url:action?.getAttribute('href')||'#', type:card?.classList.contains('service')?'Service':'Product'});
  });

  const score = (it,q)=>{
    const t=it.title.toLowerCase(), s=q.toLowerCase(); if(!s) return 0;
    let sc=0; if(t===s) sc+=100; else if(t.startsWith(s)) sc+=60; else if(t.includes(s)) sc+=40;
    if(!t.includes(s)){let i=0,j=0,miss=0; while(i<s.length&&j<t.length&&miss<=1){ if(s[i]===t[j]){i++;j++;} else {miss++;j++;} } if(i===s.length&&miss<=1) sc+=8;}
    sc += {Category:16,Product:12,Service:10}[it.type]||0; return sc;
  };

  const highlight=(L,Q)=>{const i=L.toLowerCase().indexOf(Q.toLowerCase()); return i<0?escapeHTML(L):`${escapeHTML(L.slice(0,i))}<mark>${escapeHTML(L.slice(i,i+Q.length))}</mark>${escapeHTML(L.slice(i+Q.length))}`;};

  let active=-1;
  const render=(items,q)=>{
    list.innerHTML='';
    const cur=items.slice(0,8);
    if(!cur.length){ list.hidden=true; input.setAttribute('aria-expanded','false'); return; }
    cur.forEach((it,idx)=>{
      const li=document.createElement('li'); li.role='option'; li.id=`_sugg_${idx}`; li.dataset.url=it.url;
      li.innerHTML=`<span class="sugg-title">${highlight(it.title,q)}</span><span class="sugg-type">${it.type}</span>`;
      li.addEventListener('mousedown',e=>{e.preventDefault(); if(it.url&&it.url!=='#') window.location.href=it.url;});
      list.appendChild(li);
    });
    list.hidden=false; input.setAttribute('aria-expanded','true'); active=-1;
  };

  const doSearch = debounce(()=>{
    const q=input.value.trim(); if(!q){ list.hidden=true; input.setAttribute('aria-expanded','false'); return; }
    const results=index.map(it=>({it,s:score(it,q)})).filter(x=>x.s>0).sort((a,b)=>b.s-a.s).map(x=>x.it);
    render(results,q);
  },110);

  input.addEventListener('input',doSearch);
  form.addEventListener('submit',e=>{e.preventDefault(); const first=list.querySelector('li'); if(first) window.location.href=first.dataset.url;});
  input.addEventListener('keydown',e=>{
    const items=[...list.querySelectorAll('li')];
    if(e.key==='ArrowDown'){e.preventDefault(); active=Math.min(active+1,items.length-1);}
    else if(e.key==='ArrowUp'){e.preventDefault(); active=Math.max(active-1,-1);}
    else if(e.key==='Enter'){ if(!list.hidden && active>=0 && items[active]){ e.preventDefault(); window.location.href = items[active].dataset.url; } }
    else if(e.key==='Escape'){ list.hidden=true; input.setAttribute('aria-expanded','false'); active=-1; }
    items.forEach((el,i)=>el.setAttribute('aria-selected', String(i===active)));
    if(active>=0 && items[active]) items[active].scrollIntoView({block:'nearest'});
  });
  document.addEventListener('click',e=>{ if(!list.hidden && !form.contains(e.target)){ list.hidden=true; input.setAttribute('aria-expanded','false'); active=-1; }});
  input.addEventListener('blur',()=> setTimeout(()=>{ list.hidden=true; input.setAttribute('aria-expanded','false'); active=-1; },120));
})();
