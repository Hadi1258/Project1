/* Light data layer that paints the hero and sets the title based on the page slug */
(function(){
  const MAP = {
    telecom:        { a:'#3ac0f0', b:'#6ae38b', title:'Telecom' },
    subscriptions:  { a:'#6ae38b', b:'#3ac0f0', title:'Subscriptions' },
    'social-media': { a:'#3ac0f0', b:'#6ae38b', title:'Social Media' },
    'steam-keys':   { a:'#6ae38b', b:'#3ac0f0', title:'Steam Keys' },
    'steam-games':  { a:'#3ac0f0', b:'#6ae38b', title:'Steam Games' },
    services:       { a:'#6ae38b', b:'#3ac0f0', title:'Services' },
  };

  const slug = document.body?.dataset?.cat;
  const conf = MAP[slug];
  if (!conf) return;

  const root = document.documentElement;
  root.style.setProperty('--cat-a', conf.a);
  root.style.setProperty('--cat-b', conf.b);

  const titleEl = document.querySelector('[data-cat-title]');
  if (titleEl) titleEl.textContent = conf.title;
})();
