(function(){
  if('scrollRestoration' in history){ history.scrollRestoration = 'manual'; }
  window.scrollTo(0,0);

  var canHover = !!(window.matchMedia && window.matchMedia('(hover:hover) and (pointer:fine)').matches);
  var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  // Custom gold cursor (desktop only)
  if(canHover){
    document.body.classList.add('has-custom-cursor');
    var cursorDot = document.createElement('div');
    cursorDot.className = 'cursor-dot';
    var cursorRing = document.createElement('div');
    cursorRing.className = 'cursor-ring';
    document.body.appendChild(cursorDot);
    document.body.appendChild(cursorRing);
    var ringX = 0, ringY = 0, targetX = 0, targetY = 0, cursorPrimed = false;
    function raiseCursor(){
      cursorDot.style.opacity = '1';
      cursorRing.style.opacity = '1';
    }
    function hideCursor(){
      cursorDot.style.opacity = '0';
      cursorRing.style.opacity = '0';
    }
    document.addEventListener('mousemove', function(e){
      targetX = e.clientX; targetY = e.clientY;
      cursorDot.style.left = targetX+'px';
      cursorDot.style.top = targetY+'px';
      if(!cursorPrimed){ ringX = targetX; ringY = targetY; cursorPrimed = true; }
      raiseCursor();
    });
    document.addEventListener('mouseout', function(e){
      if(!e.relatedTarget){ hideCursor(); }
    });
    document.addEventListener('mouseenter', raiseCursor);
    (function tick(){
      ringX += (targetX - ringX) * 0.18;
      ringY += (targetY - ringY) * 0.18;
      cursorRing.style.left = ringX+'px';
      cursorRing.style.top = ringY+'px';
      requestAnimationFrame(tick);
    })();
    var hoverTargets = 'a, button, .map-pin, .map-hub, .net-node, .timeline-num-btn, .chip, .tab-btn, input, textarea';
    document.addEventListener('mouseover', function(e){
      if(e.target.closest && e.target.closest(hoverTargets)){ cursorRing.classList.add('hover'); }
    });
    document.addEventListener('mouseout', function(e){
      if(e.target.closest && e.target.closest(hoverTargets)){ cursorRing.classList.remove('hover'); }
    });
  }

  // Mobile nav toggle
  var navToggle = document.getElementById('navToggle');
  var navLinks = document.getElementById('navLinks');
  if(navToggle && navLinks){
    navToggle.addEventListener('click', function(){
      navToggle.classList.toggle('open');
      navLinks.classList.toggle('open');
    });
    navLinks.querySelectorAll('a').forEach(function(a){
      a.addEventListener('click', function(){
        navToggle.classList.remove('open');
        navLinks.classList.remove('open');
      });
    });
  }

  // Page-load entrance animation
  var revealEls = document.querySelectorAll('.reveal');
  requestAnimationFrame(function(){
    requestAnimationFrame(function(){
      revealEls.forEach(function(el){ el.classList.add('is-visible'); });
    });
  });

  // Hero world map (home page)
  var mapDotsG = document.getElementById('mapDots');
  if(mapDotsG){
    var ns = 'http://www.w3.org/2000/svg';
    var W = 800, H = 467;
    var LON_MIN = -20, LON_MAX = 160, LAT_MIN = -45, LAT_MAX = 60;

    function project(lon, lat){
      return [
        (lon - LON_MIN) / (LON_MAX - LON_MIN) * W,
        (LAT_MAX - lat) / (LAT_MAX - LAT_MIN) * H
      ];
    }
    function unproject(x, y){
      return [
        LON_MIN + (x / W) * (LON_MAX - LON_MIN),
        LAT_MAX - (y / H) * (LAT_MAX - LAT_MIN)
      ];
    }
    function pointInPolygon(pt, poly){
      var inside = false;
      for(var i=0, j=poly.length-1; i<poly.length; j=i++){
        var xi=poly[i][0], yi=poly[i][1], xj=poly[j][0], yj=poly[j][1];
        var intersect = ((yi>pt[1]) !== (yj>pt[1])) && (pt[0] < (xj-xi)*(pt[1]-yi)/(yj-yi)+xi);
        if(intersect) inside = !inside;
      }
      return inside;
    }

    var continents = [
      [[-9,44],[-9,36],[3,38],[9,38],[13,38],[16,40],[19,40],[23,35],[27,37],[29,41],[35,42],[40,44],[40,50],[35,52],[30,55],[25,56],[20,55],[14,55],[12,56],[8,58],[5,60],[0,60],[-4,58],[-8,52],[-5,49],[-9,44]],
      [[-17,21],[-16,15],[-11,7],[-9,5],[-3,5],[3,6],[9,5],[9,0],[13,-5],[12,-17],[15,-27],[20,-34],[26,-33],[31,-25],[35,-16],[39,-5],[41,3],[44,11],[48,11],[43,13],[38,15],[35,20],[33,22],[35,31],[25,32],[10,37],[0,35],[-6,36],[-9,30],[-13,27],[-17,21]],
      [[35,42],[40,44],[45,40],[50,38],[55,38],[60,38],[63,30],[60,25],[58,22],[55,16],[50,13],[44,12],[40,15],[38,20],[36,25],[35,32],[35,42]],
      [[68,25],[70,20],[68,10],[73,8],[77,8],[80,13],[80,20],[83,17],[88,22],[92,22],[95,20],[98,10],[101,4],[104,1],[103,-5],[106,-6],[112,-8],[115,-9],[120,-10],[125,-8],[130,-3],[140,-3],[141,5],[130,10],[122,17],[110,22],[100,25],[92,27],[80,28],[73,32],[68,25]],
      [[113,-22],[114,-27],[115,-33],[118,-35],[122,-34],[128,-32],[131,-31],[136,-35],[140,-38],[146,-38],[150,-37],[153,-28],[153,-24],[150,-21],[145,-16],[142,-11],[136,-12],[131,-12],[128,-15],[122,-18],[113,-22]]
    ];

    var frag = document.createDocumentFragment();
    var step = 9;
    for(var gy=0; gy<H; gy+=step){
      for(var gx=0; gx<W; gx+=step){
        var jx = gx + (Math.random()-0.5)*4;
        var jy = gy + (Math.random()-0.5)*4;
        var ll = unproject(jx, jy);
        var hit = false;
        for(var c=0; c<continents.length; c++){
          if(pointInPolygon(ll, continents[c])){ hit = true; break; }
        }
        if(hit){
          var dot = document.createElementNS(ns,'circle');
          dot.setAttribute('cx', jx.toFixed(1));
          dot.setAttribute('cy', jy.toFixed(1));
          dot.setAttribute('r', (Math.random()*0.7 + 1.1).toFixed(2));
          dot.setAttribute('class','map-dot');
          dot.setAttribute('opacity', (Math.random()*0.45 + 0.3).toFixed(2));
          frag.appendChild(dot);
        }
      }
    }
    mapDotsG.appendChild(frag);

    var hub = {name:'Malta', lon:14.5, lat:35.9, desc:'Headquarters — 20+ years of relationships start here.'};
    var markets = [
      {name:'Portugal', lon:-9.1, lat:38.7, desc:'Expanding 2025/26.'},
      {name:'South Africa', lon:18.4, lat:-33.9, desc:'Wholesale · Retail.'},
      {name:'Africa', lon:31.0, lat:-17.8, desc:'Zimbabwe · Botswana · beyond.'},
      {name:'Australia', lon:151.2, lat:-33.9, desc:'Active · Expanding.'}
    ];

    var arcsG = document.getElementById('mapArcs');
    var pinsG = document.getElementById('mapPins');
    var hubXY = project(hub.lon, hub.lat);
    var label = document.getElementById('mapLabel');

    function showLabel(m){
      if(!label) return;
      label.querySelector('.mn').textContent = m.name;
      label.querySelector('.md').textContent = m.desc;
      label.classList.add('is-active');
    }

    markets.forEach(function(m, i){
      var mxy = project(m.lon, m.lat);
      var x1 = hubXY[0], y1 = hubXY[1], x2 = mxy[0], y2 = mxy[1];
      var midX = (x1+x2)/2, midY = (y1+y2)/2;
      var dx = x2-x1, dy = y2-y1;
      var dist = Math.sqrt(dx*dx+dy*dy) || 1;
      var nx = -dy/dist, ny = dx/dist;
      if(ny > 0){ nx = -nx; ny = -ny; }
      var bend = Math.min(dist*0.22, 70);
      var cx = midX + nx*bend, cy = midY + ny*bend;
      var d = 'M'+x1+','+y1+' Q'+cx+','+cy+' '+x2+','+y2;

      var arcGlow = document.createElementNS(ns,'path');
      arcGlow.setAttribute('d', d);
      arcGlow.setAttribute('class','map-arc-glow');
      arcsG.appendChild(arcGlow);

      var arc = document.createElementNS(ns,'path');
      arc.setAttribute('d', d);
      arc.setAttribute('class','map-arc');
      arc.style.animationDelay = (i*0.6)+'s';
      arcsG.appendChild(arc);

      var pinG = document.createElementNS(ns,'g');
      pinG.setAttribute('class','map-pin');
      pinG.setAttribute('tabindex','0');
      var halo = document.createElementNS(ns,'circle');
      halo.setAttribute('cx',x2);halo.setAttribute('cy',y2);halo.setAttribute('r',9);
      halo.setAttribute('class','map-pin-halo pulse');
      halo.style.animationDelay = (i*0.5)+'s';
      pinG.appendChild(halo);
      var core = document.createElementNS(ns,'circle');
      core.setAttribute('cx',x2);core.setAttribute('cy',y2);core.setAttribute('r',4);
      core.setAttribute('class','map-pin-core');
      pinG.appendChild(core);
      var lbl = document.createElementNS(ns,'text');
      lbl.setAttribute('x',x2);
      lbl.setAttribute('y', y2 < H/2 ? y2+20 : y2-12);
      lbl.setAttribute('class','map-pin-label');
      lbl.setAttribute('text-anchor', x2 > W-90 ? 'end' : (x2 < 90 ? 'start' : 'middle'));
      lbl.textContent = m.name;
      pinG.appendChild(lbl);
      pinsG.appendChild(pinG);

      function activate(){
        document.querySelectorAll('.map-arc, .map-arc-glow').forEach(function(a){a.classList.remove('active');});
        document.querySelectorAll('.map-pin').forEach(function(p){p.classList.remove('active');});
        arc.classList.add('active');
        arcGlow.classList.add('active');
        pinG.classList.add('active');
        showLabel(m);
      }
      pinG.addEventListener('mouseenter', activate);
      pinG.addEventListener('focus', activate);
      pinG.addEventListener('click', activate);
      if(i===0){ activate(); }
    });

    var hubG = document.createElementNS(ns,'g');
    hubG.setAttribute('class','map-hub');
    var hubHalo = document.createElementNS(ns,'circle');
    hubHalo.setAttribute('cx',hubXY[0]);hubHalo.setAttribute('cy',hubXY[1]);hubHalo.setAttribute('r',11);
    hubHalo.setAttribute('class','map-hub-halo pulse');
    hubG.appendChild(hubHalo);
    var hubCore = document.createElementNS(ns,'circle');
    hubCore.setAttribute('cx',hubXY[0]);hubCore.setAttribute('cy',hubXY[1]);hubCore.setAttribute('r',5);
    hubCore.setAttribute('class','map-hub-core');
    hubG.appendChild(hubCore);
    var hubLbl = document.createElementNS(ns,'text');
    hubLbl.setAttribute('x',hubXY[0]);hubLbl.setAttribute('y',hubXY[1]-16);
    hubLbl.setAttribute('class','map-pin-label hub');
    hubLbl.setAttribute('text-anchor','middle');
    hubLbl.textContent = 'Malta · HQ';
    hubG.appendChild(hubLbl);
    hubG.addEventListener('mouseenter', function(){ showLabel(hub); });
    hubG.addEventListener('click', function(){ showLabel(hub); });
    pinsG.appendChild(hubG);

    // Cursor-driven parallax
    var parallaxG = document.getElementById('mapParallax');
    if(parallaxG && canHover && !reduceMotion){
      var px = 0, py = 0;
      document.addEventListener('mousemove', function(e){
        var nx = (e.clientX / window.innerWidth - 0.5) * 2;
        var ny = (e.clientY / window.innerHeight - 0.5) * 2;
        px = nx * 16;
        py = ny * 10;
        parallaxG.style.transform = 'translate('+px.toFixed(1)+'px,'+py.toFixed(1)+'px)';
      });
    }
  }

  // Network diagram (network page)
  var netLines = document.getElementById('netLines');
  var netNodes = document.getElementById('netNodes');
  var panel = document.getElementById('networkPanel');
  if(netLines && netNodes && panel){
    var netData = [
      {name:'Brands', title:'Producers & International Brands', desc:"Producers and international brands seeking efficient, low-risk entry into new geographies."},
      {name:'Distributors', title:'Importers & Distributors', desc:"Importers and distributors expanding their portfolio with new international brands."},
      {name:'Retail', title:'Retailers & Wholesale', desc:"Retailers and wholesale groups seeking first-to-market access and supplier diversification."},
      {name:'Markets', title:'Malta · South Africa · Portugal · Australia · Africa', desc:"Active and expanding markets, with project-based work across the wider African continent."},
      {name:'Service Partners', title:'Logistics, Finance, Legal & Marketing', desc:"Service businesses seeking introductions into new markets alongside the brands they serve."},
      {name:'Capital', title:'Investors & Entrepreneurs', desc:"Investors and entrepreneurs seeking cross-border commercial opportunities."}
    ];
    var ncx=210, ncy=210, nr=160;
    var ns = 'http://www.w3.org/2000/svg';
    var netItems = [];
    var lockedIndex = 0;

    function renderPanel(d){
      panel.innerHTML = '<span class="tag">'+d.name+'</span><h3>'+d.title+'</h3><p>'+d.desc+'</p>';
    }
    function show(i){
      netItems.forEach(function(item, ii){
        item.g.classList.toggle('active', ii===i);
        item.line.classList.toggle('active', ii===i);
      });
      renderPanel(netData[i]);
    }
    function lock(i){
      lockedIndex = i;
      show(i);
    }

    netData.forEach(function(d, i){
      var angle = (i / netData.length) * Math.PI * 2 - Math.PI/2;
      var x = ncx + nr*Math.cos(angle);
      var y = ncy + nr*Math.sin(angle);
      var line = document.createElementNS(ns,'line');
      line.setAttribute('x1',ncx);line.setAttribute('y1',ncy);
      line.setAttribute('x2',x);line.setAttribute('y2',y);
      line.setAttribute('class','net-line');
      netLines.appendChild(line);

      var g = document.createElementNS(ns,'g');
      g.setAttribute('class','net-node');
      g.setAttribute('tabindex','0');
      var circle = document.createElementNS(ns,'circle');
      circle.setAttribute('cx',x);circle.setAttribute('cy',y);circle.setAttribute('r',40);
      g.appendChild(circle);
      var text = document.createElementNS(ns,'text');
      var words = d.name.split(' ');
      if(words.length>1){
        words.forEach(function(w,wi){
          var tsp = document.createElementNS(ns,'tspan');
          tsp.setAttribute('x',x);
          tsp.setAttribute('dy', wi===0? -4 : 12);
          tsp.textContent = w;
          text.appendChild(tsp);
        });
      } else {
        text.setAttribute('x',x);text.setAttribute('y',y+4);
        text.textContent = d.name;
      }
      if(words.length>1){ text.setAttribute('x',x); text.setAttribute('y',y-2); }
      g.appendChild(text);
      netNodes.appendChild(g);
      netItems.push({g:g, line:line});

      g.addEventListener('mouseenter', function(){ if(canHover){ show(i); } });
      g.addEventListener('focus', function(){ show(i); });
      g.addEventListener('click', function(){ lock(i); });
    });

    var networkHolder = document.querySelector('.network-svg-holder');
    if(networkHolder){
      networkHolder.addEventListener('mouseleave', function(){ show(lockedIndex); });
    }
    lock(0);
  }

  // Timeline (process page)
  var timeBtns = document.querySelectorAll('.timeline-num-btn');
  var timePanels = document.querySelectorAll('.timeline-panel');
  if(timeBtns.length){
    function selectStep(btn){
      timeBtns.forEach(function(b){b.classList.remove('active');});
      timePanels.forEach(function(p){p.classList.remove('active');});
      btn.classList.add('active');
      document.querySelector('.timeline-panel[data-panel="'+btn.dataset.step+'"]').classList.add('active');
    }
    timeBtns.forEach(function(btn){
      btn.addEventListener('click', function(){ selectStep(btn); });
      if(canHover){
        btn.addEventListener('mouseenter', function(){ selectStep(btn); });
      }
    });
  }

  // Contact form -> Formspree
  var form = document.getElementById('contactForm');
  if(form){
    var formMsg = document.getElementById('formMsg');
    var formSubmitBtn = document.getElementById('formSubmitBtn');
    form.addEventListener('submit', function(e){
      e.preventDefault();
      if(form.action.indexOf('YOUR_FORM_ID') !== -1){
        formMsg.textContent = 'Form not yet connected — add your Formspree form ID in the HTML.';
        formMsg.style.color = '#e2554a';
        return;
      }
      formSubmitBtn.disabled = true;
      formMsg.style.color = '';
      formMsg.textContent = 'Sending…';
      fetch(form.action, {
        method: 'POST',
        body: new FormData(form),
        headers: {'Accept':'application/json'}
      }).then(function(res){
        if(res.ok){
          formMsg.textContent = 'Thank you — Grant will be in touch shortly.';
          form.reset();
        } else {
          res.json().then(function(data){
            formMsg.style.color = '#e2554a';
            formMsg.textContent = (data && data.errors) ? data.errors.map(function(er){return er.message;}).join(', ') : 'Something went wrong — please try again.';
          });
        }
      }).catch(function(){
        formMsg.style.color = '#e2554a';
        formMsg.textContent = 'Something went wrong — please try again.';
      }).finally(function(){
        formSubmitBtn.disabled = false;
      });
    });
  }
})();
