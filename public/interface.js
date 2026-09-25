// Shared interface behavior; the audio engine and patch state are unchanged.
export function setupInterface(){
  for(const input of document.querySelectorAll('input[type="file"]')){
    const label=input.closest('label')||document.querySelector(`label[for="${input.id}"]`);
    if(!label)continue;
    const button=document.createElement('button');
    button.type='button';button.className=label.className;button.textContent=label.textContent.trim();button.dataset.fileFor=input.id;
    button.onclick=()=>input.click();input.hidden=true;
    label.replaceWith(button);button.after(input);
  }
  const nav=document.querySelector('.rack-nav');if(!nav)return;
  const links=[...nav.querySelectorAll('a[href^="#"]')].map(link=>({link,section:document.querySelector(link.hash)})).filter(item=>item.section);
  let current=null,scheduled=false;
  const mark=item=>{current=item;for(const entry of links){if(entry===item)entry.link.setAttribute('aria-current','location');else entry.link.removeAttribute('aria-current');}};
  const update=()=>{
    scheduled=false;const boundary=nav.getBoundingClientRect().bottom+36;
    // A final short section cannot always scroll up to the navigation bar.
    const currentTop=current?.section.getBoundingClientRect().top;
    if(scrollY+innerHeight>=document.documentElement.scrollHeight-4&&currentTop>boundary&&currentTop<innerHeight-80)return;
    const visible=links.map(item=>({...item,rect:item.section.getBoundingClientRect()})).filter(item=>item.rect.top<=boundary&&item.rect.bottom>boundary);
    if(!visible.length){mark(null);return;}
    const top=Math.max(...visible.map(item=>item.rect.top)),row=visible.filter(item=>Math.abs(item.rect.top-top)<4);
    const selected=row.find(item=>item.link===current?.link)||row[0];mark(links.find(item=>item.link===selected.link));
  };
  const schedule=()=>{if(!scheduled){scheduled=true;requestAnimationFrame(update);}};
  for(const item of links)item.link.addEventListener('click',()=>mark(item));
  new ResizeObserver(()=>{document.documentElement.style.setProperty('--rack-nav-height',nav.offsetHeight+'px');schedule();}).observe(nav);
  window.addEventListener('scroll',schedule,{passive:true});window.addEventListener('resize',schedule,{passive:true});schedule();
}
