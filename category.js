/* category.js — lean: tint only, no product injection */
(function(){
  const TINTS = {
    telecom:        ['#3ac0f0','#6ae38b'],
    subscriptions:  ['#6ae38b','#3ac0f0'],
    'social-media': ['#3ac0f0','#6ae38b'],
    'steam-keys':   ['#6ae38b','#3ac0f0'],
    'steam-games':  ['#3ac0f0','#6ae38b'],
    services:       ['#6ae38b','#3ac0f0'],
  };
  const slug = document.body?.dataset?.cat || '';
  const [a,b] = TINTS[slug] || ['#3ac0f0','#6ae38b'];
  const root = document.documentElement;
  root.style.setProperty('--cat-a', a);
  root.style.setProperty('--cat-b', b);
})();
