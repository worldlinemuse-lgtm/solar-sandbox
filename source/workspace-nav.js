/* Solar Sandbox task navigation.
 * UI-only transformation: keeps existing element IDs, event handlers, math and state.
 * No code or styles are reused from the external example project.
 */
(function(){
  "use strict";
  const sim=document.getElementById("sim");
  if(!sim || sim.dataset.workspaceReady==="1") return;
  const nav=sim.querySelector(":scope > .tabs");
  const build=document.getElementById("pane-build");
  if(!nav || !build || !window.SIM) return;
  sim.dataset.workspaceReady="1";
  const get=id=>document.getElementById(id);
  const pane=(id,title,description)=>{
    const p=document.createElement("div");
    p.className="pane ss-work-pane";
    p.id="pane-"+id;
    p.innerHTML='<div class="ss-head"><h2>'+title+'</h2><p>'+description+"</p></div>";
    sim.appendChild(p);
    return p;
  };
  const overview=pane("overview","Live solar system",
    "See generation, battery charge and household demand together. The controls above run the same simulation as before.");
  overview.innerHTML+='<div class="ss-actions">'+
    '<button type="button" data-ss-go="build">Configure system</button>'+
    '<button type="button" data-ss-go="loads">Edit appliances</button>'+
    '<button type="button" data-ss-go="missions">Run a scenario</button>'+
    '<button type="button" data-ss-go="score">Review results</button>'+
    '<button type="button" data-ss-go="shop">Parts and costs</button></div>';
  const shop=pane("shop","Parts, prices and shopping",
    "Existing prices are dated October 30–31, 2026. They are not live stock or checkout quotes. The partial parts total excludes tax, shipping and unpriced items.");
  const reference=pane("reference","Sources and model details",
    "Detailed equations, source documents, limitations and further reading are kept here, instead of filling the main page.");

  // Relocate the actual price/parts elements, not clones: existing renderCost()
  // continues to update the same IDs and original input listeners survive.
  const rootChild=(element,root)=>{
    if(!element)return null;
    let node=element;
    while(node.parentElement && node.parentElement!==root)node=node.parentElement;
    return node.parentElement===root?node:null;
  };
  const costStart=rootChild(get("costTop"),build);
  const costEnd=rootChild(get("checks"),build);
  if(costStart&&costEnd){
    let node=costStart;
    for(let guard=0;node&&node!==costEnd&&guard<32;guard++){
      const next=node.nextElementSibling;
      shop.appendChild(node);
      node=next;
    }
  }
  // Documentation formerly came after the simulator as a second, unbounded
  // page. Keep everything, in its original order, inside Reference.
  const wrap=sim.parentElement;
  if(wrap){
    let sibling=sim.nextElementSibling;
    for(let guard=0;sibling&&guard<64;guard++){
      const next=sibling.nextElementSibling;
      reference.appendChild(sibling);
      sibling=next;
    }
  }
  for(const id of ["partsList","srcParts"]){
    const element=get(id);
    const details=element&&element.closest("details");
    if(details){
      if(!get("ss-shop-detail-title")){
        const h=document.createElement("h3");
        h.id="ss-shop-detail-title";
        h.textContent="Product specifications and source links";
        shop.appendChild(h);
      }
      shop.appendChild(details);
    }
  }
  const sourceHeader=reference.querySelector("h2");
  if(sourceHeader)sourceHeader.textContent="Model documentation";

  function addTab(id,label,position){
    const b=document.createElement("button");
    b.type="button";
    b.dataset.tab=id;
    b.textContent=label;
    b.onclick=()=>{
      nav.querySelectorAll("button[data-tab]").forEach(x=>x.classList.toggle("on",x===b));
      sim.querySelectorAll(".pane").forEach(p=>p.classList.toggle("on",p.id==="pane-"+id));
    };
    if(position==="first")nav.insertBefore(b,nav.firstElementChild);
    else nav.appendChild(b);
    return b;
  }
  const overviewTab=addTab("overview","Overview","first");
  addTab("shop","Shop & Compare","last");
  addTab("reference","Sources & Help","last");
  const textByTab={build:"System Builder",loads:"Loads",missions:"Scenarios",score:"Results"};
  nav.querySelectorAll("button[data-tab]").forEach(b=>{
    if(textByTab[b.dataset.tab])b.textContent=textByTab[b.dataset.tab];
    b.type="button";
    b.setAttribute("role","tab");
    b.setAttribute("aria-controls","pane-"+b.dataset.tab);
  });
  nav.setAttribute("aria-label","Solar Sandbox main navigation");

  // Move navigation before the live diagram: on mobile the menu must never be
  // hidden beneath a 1050-unit-high visualization.
  sim.insertBefore(nav,sim.firstElementChild);
  const liveSelectors=["quick","stage"];
  const liveControls=[...sim.querySelectorAll(":scope > .ctl")];
  function synchronize(view){
    const live=view==="overview";
    for(const id of liveSelectors){
      const n=get(id);
      if(n)n.hidden=!live;
    }
    for(const n of liveControls)n.hidden=!live;
    nav.querySelectorAll("button[data-tab]").forEach(b=>{
      const active=b.dataset.tab===view;
      b.setAttribute("aria-selected",String(active));
      b.tabIndex=active?0:-1;
      b.classList.toggle("on",active);
    });
    sim.setAttribute("data-workspace",view);
  }
  // Existing core registers onclick for Build, Loads, Missions and Score.
  // Bubble event runs AFTER their original handler; do not reimplement the
  // core's chart/render functions or change any simulation data.
  nav.addEventListener("click",event=>{
    const b=event.target.closest("button[data-tab]");
    if(b&&nav.contains(b))synchronize(b.dataset.tab);
  });
  overview.addEventListener("click",event=>{
    const b=event.target.closest("button[data-ss-go]");
    if(!b)return;
    const target=nav.querySelector('button[data-tab="'+b.dataset.ssGo+'"]');
    if(target)target.click();
  });
  if(get("qLoads"))get("qLoads").onclick=()=>{
    nav.querySelector('button[data-tab="loads"]').click();
  };
  if(get("qCost"))get("qCost").onclick=()=>{
    nav.querySelector('button[data-tab="shop"]').click();
  };

  const style=document.createElement("style");
  style.textContent=
    "#sim.ss-work-ready{overflow:visible}"+
    "#sim.ss-work-ready .tabs{position:sticky;top:0;z-index:30;display:flex;"+
      "gap:5px;overflow-x:auto;padding:8px;background:var(--sc);"+
      "border:1px solid var(--sr);border-radius:12px 12px 0 0;"+
      "scrollbar-width:thin;overscroll-behavior-x:contain}"+
    "#sim.ss-work-ready .tabs button{flex:none;white-space:nowrap;"+
      "border:1px solid var(--sr);border-radius:9px;min-height:44px;"+
      "padding:9px 14px;background:var(--sg);font-weight:600}"+
    "#sim.ss-work-ready .tabs button.on{border-color:var(--si);"+
      "background:var(--si);color:var(--sc)}"+
    "#sim.ss-work-ready .tabs button:focus-visible,"+
      "#sim.ss-work-ready .ss-actions button:focus-visible{outline:3px solid #3b82f6;outline-offset:2px}"+
    "#sim.ss-work-ready [hidden]{display:none!important}"+
    "#sim.ss-work-ready svg.stage{height:min(68vh,680px);max-height:680px;"+
      "width:100%;max-width:540px;margin:0 auto;object-fit:contain}"+
    "#sim.ss-work-ready .ss-work-pane{padding:20px;max-width:960px;margin:auto}"+
    "#sim.ss-work-ready .ss-head h2{font-size:21px;margin:0 0 4px}"+
    "#sim.ss-work-ready .ss-head p{font-size:13px;color:var(--sm);"+
      "line-height:1.5;margin:0 0 14px}"+
    "#sim.ss-work-ready .ss-actions{display:grid;"+
      "grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin:14px 0}"+
    "#sim.ss-work-ready .ss-actions button{min-height:44px;font-weight:600}"+
    "#sim.ss-work-ready #pane-shop .costs{max-width:100%}"+
    "#sim.ss-work-ready #pane-reference>details{margin:10px 0}"+
    "@media(max-width:600px){"+
      "#sim.ss-work-ready .tabs{border-radius:0;padding:6px;gap:4px}"+
      "#sim.ss-work-ready .tabs button{padding:8px 11px;min-height:44px;font-size:13px}"+
      "#sim.ss-work-ready .ss-work-pane{padding:12px}"+
      "#sim.ss-work-ready svg.stage{height:min(60vh,550px);max-width:100%}"+
    "}";
  document.head.appendChild(style);
  sim.classList.add("ss-work-ready");
  overviewTab.click();
})();