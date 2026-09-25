// Apply the saved appearance before the page paints, and follow system changes when selected.
(()=>{
  const root=document.documentElement;
  const system=window.matchMedia('(prefers-color-scheme: dark)');
  const valid=value=>['light','dark','system'].includes(value)?value:'system';
  let preference='system';
  try{preference=valid(localStorage.getItem('ting-theme'))}catch{}
  function apply(){
    const theme=preference==='system'?(system.matches?'dark':'light'):preference;
    root.dataset.theme=theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content',theme==='dark'?'#000000':'#ffffff');
    document.querySelectorAll('[data-theme-select]').forEach(select=>{select.value=preference});
  }
  apply();
  system.addEventListener('change',()=>{if(preference==='system')apply()});
  window.addEventListener('storage',event=>{if(event.key==='ting-theme'){preference=valid(event.newValue);apply()}});
  document.addEventListener('DOMContentLoaded',()=>{
    apply();
    document.querySelectorAll('[data-theme-select]').forEach(select=>select.addEventListener('change',()=>{
      preference=valid(select.value);try{localStorage.setItem('ting-theme',preference)}catch{}apply();
    }));
  },{once:true});
})();
