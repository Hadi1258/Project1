/* Renders the category page from the JSON block and tints the hero */
(function(){
  const C = {
    telecom:        { a:'#3ac0f0', b:'#6ae38b', fallbackTitle:'Telecom' },
    subscriptions:  { a:'#6ae38b', b:'#3ac0f0', fallbackTitle:'Subscriptions' },
    'social-media': { a:'#3ac0f0', b:'#6ae38b', fallbackTitle:'Social Media' },
    'steam-keys':   { a:'#6ae38b', b:'#3ac0f0', fallbackTitle:'Steam Keys' },
    'steam-games':  { a:'#3ac0f0', b:'#6ae38b', fallbackTitle:'Steam Games' },
    services:       { a:'#6ae38b', b:'#3ac0f0', fallbackTitle:'Services' },
  };

  const dataEl = document.getElementById('cat-data');
  if (!dataEl) return;
  const conf = JSON.parse(dataEl.textContent || '{}');

  const body = document.body;
  const slug = body.dataset.cat || conf.slug || '';
  const tint = C[slug] || {a:'#3ac0f0', b:'#6ae38b', fallbackTitle:conf.title||'Category'};

  // Tint hero
  const root = document.documentElement;
  root.style.setProperty('--cat-a', (conf.colors && conf.colors[0]) || tint.a);
  root.style.setProperty('--cat-b', (conf.colors && conf.colors[1]) || tint.b);

  // Hero title/subtitle
  const titleEl = document.querySelector('[data-cat-title]');
  const subEl   = document.querySelector('[data-cat-sub]');
  if (titleEl) titleEl.textContent = conf.title || tint.fallbackTitle;
  if (subEl)   subEl.textContent   = conf.subtitle || '';

  // Breadcrumb last segment
  const crumb = document.querySelector('[data-crumb]');
  if (crumb) crumb.textContent = conf.title || tint.fallbackTitle;

  // Subcategory chips (optional)
  const chipWrap = document.getElementById('subcats');
  if (chipWrap && Array.isArray(conf.subcategories) && conf.subcategories.length){
    conf.subcategories.forEach(sc=>{
      const a = document.createElement('a');
      a.className = 'chip';
      a.href = sc.href || '#';
      a.textContent = sc.label || 'Subcategory';
      chipWrap.appendChild(a);
    });
  } else if (chipWrap){
    chipWrap.remove();
  }

  // Products (3 placeholders now)
  const grid = document.getElementById('product-grid');
  const products = Array.isArray(conf.products) ? conf.products : [];
  const mkSvg = (idA='#3ac0f0', idB='#6ae38b') => `
    <svg class="cover" viewBox="0 0 1200 675" aria-hidden="true">
      <defs><linearGradient id="g-${slug}" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0" stop-color="${idA}"/><stop offset="1" stop-color="${idB}"/></linearGradient></defs>
      <rect width="1200" height="675" fill="#0e121a"/>
      <circle cx="220" cy="140" r="240" fill="url(#g-${slug})" opacity=".18"/>
      <circle cx="1000" cy="560" r="260" fill="url(#g-${slug})" opacity=".14"/>
    </svg>`;

  products.forEach((p,i)=>{
    const card = document.createElement('article');
    card.className = 'card product';
    card.innerHTML = `
      <div class="media">
        ${mkSvg(root.style.getPropertyValue('--cat-a')||tint.a, root.style.getPropertyValue('--cat-b')||tint.b)}
        ${p.badge ? `<span class="badge">${p.badge}</span>` : ''}
      </div>
      <div class="content">
        <h3>${p.title || `Item ${i+1}`}</h3>
        <p>${p.description || 'Short placeholder description.'}</p>
      </div>
      <div class="actions">
        <a class="btn" target="_blank" href="${p.url || 'https://wa.me/1234567890'}">${p.cta || 'Order on WhatsApp'}</a>
      </div>`;
    grid.appendChild(card);
  });
})();
