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
    var W = 800, H = 353;
    var LAT_TOP = 78, LAT_BOTTOM = -58;
    var state = {l0:15, vy:0};

    // Natural Earth projection: a gently curved world map
    function ne(lon, lat){
      var l = lon*Math.PI/180, p = lat*Math.PI/180, p2 = p*p, p4 = p2*p2;
      return [
        l*(0.8707 - 0.131979*p2 + p4*(-0.013791 + p4*(0.003971*p2 - 0.001529*p4))),
        p*(1.007226 + p2*(0.015085 + p4*(-0.044475 + 0.028874*p2 - 0.005916*p4)))
      ];
    }
    var SX = W/(2*Math.PI*0.8707);
    var Y_TOP = ne(0, LAT_TOP)[1];
    var SY = H/(Y_TOP - ne(0, LAT_BOTTOM)[1]);
    function wrapLon(d){ return ((d+180)%360+360)%360-180; }
    function project(lon, lat){
      var dl = wrapLon(lon - state.l0);
      var p = ne(dl, lat);
      return [W/2 + p[0]*SX, (Y_TOP - p[1])*SY + state.vy, dl];
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
      [[-9,43],[-8.5,44],[-2,43.5],[-1.2,46],[-2.5,47.2],[-4.7,48.3],[-1.5,48.8],[-1.5,49.7],[1.5,50.2],[2.5,51.2],[4,52],[5,53.4],[8,53.7],[8.7,55],[8.2,57],[10.5,57.7],[10.3,56],[11,54],[14,54],[19,54.4],[21,55.5],[21,57],[24,57.2],[24.2,58.3],[23.5,59.2],[28,59.5],[30,60],[31,63],[30,67],[31,70],[36,69.2],[41,67],[44,66.2],[43,68.5],[48,68],[53,68.5],[59,68.5],[66,69],[68,72.5],[73,72],[80,73.5],[87,75],[100,76.2],[105,77.5],[113,74],[125,73.5],[140,72.5],[150,71.5],[160,70],[170,70],[180,69],[180,65],[172,64],[170,60],[163,59.5],[163,56],[162,54],[160,53],[156.5,51],[156,53],[156,57],[160,60.5],[155,59.5],[150,59.2],[143,59.2],[138,56],[136,54.5],[140,53],[140.5,50],[140.3,48],[138,46],[135.5,43.5],[132,43],[130.5,42.5],[129.5,41],[128,39.5],[129.3,36],[129,35.2],[126.5,34.5],[126.5,37],[125,38],[125,39.5],[122,40.5],[121.5,39],[119,39.2],[118,38.2],[119,37.2],[122.5,37],[121,36.5],[120.5,35],[121.5,32],[122,30],[121.5,28],[119.5,25.5],[116.5,23],[113.5,22.2],[110.5,21],[108.5,21.7],[106.8,20.5],[105.8,19],[108,15.5],[109.3,12],[107,10.4],[105,8.7],[104.8,10.5],[103,11],[101,12.8],[100,13.5],[99.5,10],[100.2,7],[101.5,6.8],[103.4,4.5],[103.5,2],[101.3,2.8],[100.3,5.5],[98.3,8],[98.5,10.5],[98.3,13.5],[97.7,16.5],[95,16],[94.3,18.5],[92.5,20.5],[91.5,22.5],[89,21.8],[87,21.4],[86.5,20],[84.5,18.5],[82.2,16.5],[80.3,15.5],[80.2,13],[79.9,10.5],[79.2,9.5],[77.5,8.2],[76.3,9.8],[74.8,12.5],[73.2,16],[72.8,19],[72.7,21.5],[70.5,20.8],[69,22.4],[70.5,23.1],[68.5,23.6],[67,24.8],[64,25.3],[61.5,25.2],[58.5,25.7],[57,27],[55,26.7],[52,27.8],[50.5,29.5],[48.8,30],[48,29.5],[49.5,27],[50.2,26],[50.8,24.5],[51.5,24.2],[52,24],[54,24.2],[56,26],[56.4,24.5],[58.5,23.5],[59.8,22.3],[58.5,20.5],[57.5,18.7],[55,17],[52,16],[49,14.2],[45,12.8],[43.3,12.7],[42.8,15],[42.5,16.5],[41,19],[39,21.5],[37.5,24.5],[35.5,27.8],[35,29.5],[34.3,31.2],[35,33],[35.8,35.5],[36,36.7],[34,36.2],[32,36.2],[30,36.3],[28,36.7],[27.2,37.5],[26.5,38.8],[26.2,40.1],[24.5,40.2],[23.8,39.9],[24,38.5],[23.2,38.3],[23,36.6],[22,36.8],[21.5,38],[20.5,39.5],[19.5,41.8],[19,42.3],[17,43],[15.5,44],[13.7,45.1],[13.5,45.6],[12.4,45.3],[12.4,44.4],[13.7,43.5],[14.2,42.2],[16,41.9],[18.5,40.2],[17.2,39.5],[16.6,38.7],[16,38],[15.7,40],[14.3,40.9],[12,41.8],[10.5,43],[9,44.3],[7.5,43.8],[3.5,43.3],[3,42],[0.5,40.5],[-0.3,39],[-0.5,38.5],[-2,36.8],[-5.5,36.1],[-6.5,37],[-9,37.1],[-8.8,38.5],[-9.3,39.3],[-8.8,41.8]] /* eurasia */,
      [[5,58.5],[5,62],[9,64],[13,67.5],[18,70],[25,71],[31,70],[29,68],[26,66],[24,65.5],[22,63.5],[19,62],[18.5,60],[17,58.5],[16,56.5],[13,55.5],[11,58.5],[8,58]] /* scandinavia */,
      [[-5.5,50],[1.5,51],[1.7,53],[-0.5,55],[-2,57],[-2,57.7],[-3.5,58.6],[-5,58.6],[-6,57],[-5.5,55],[-3,54.8],[-3,53.5],[-4.5,52.5],[-5.2,51.7],[-3.5,51.3]] /* britain */,
      [[-10,52],[-6,52],[-6,54.5],[-8,55.2],[-10,54]] /* ireland */,
      [[-24,64],[-18,63.4],[-14,64.5],[-15,66],[-22,66.4]] /* iceland */,
      [[12.5,38],[15.6,38.2],[15,36.7]] /* sicily */,
      [[8.2,41],[9.7,41],[9.5,39],[8.5,39]] /* sardinia */,
      [[-17,21],[-16,15],[-11,7],[-9,5],[-3,5],[3,6],[9,5],[9,0],[13,-5],[12,-17],[15,-27],[20,-34],[26,-33],[31,-25],[35,-16],[39,-5],[41,3],[44,11],[48,11],[43,13],[38,15],[35,20],[33,22],[35,31],[25,32],[10,37],[0,35],[-6,36],[-9,30],[-13,27]] /* africa */,
      [[44,-25],[47,-25],[50,-15],[49.5,-12],[47,-15],[44,-20]] /* madagascar */,
      [[113,-22],[114,-27],[115,-33],[118,-35],[122,-34],[128,-32],[131,-31],[136,-35],[140,-38],[146,-38],[150,-37],[153,-28],[153,-24],[150,-21],[145,-16],[142,-11],[136,-12],[131,-12],[128,-15],[122,-18]] /* australia */,
      [[144.5,-41],[148.3,-41],[147,-43.5],[145.5,-43]] /* tasmania */,
      [[172.7,-34.5],[175,-36.5],[178,-37.7],[175,-41.5],[174.5,-39.5]] /* nz_n */,
      [[172.5,-40.7],[174,-41.5],[171,-44.5],[169,-46.5],[166.5,-45.5],[170,-43]] /* nz_s */,
      [[130,31],[132,34],[136,34],[140,35.5],[142,39],[141.5,41.5],[140,40],[139,38],[136.5,37],[133,35.5],[130,33.5]] /* japan */,
      [[140,42],[142,42.5],[145,43.5],[142,45.5],[140.5,43.5]] /* hokkaido */,
      [[120,14],[122,18],[124,13],[126,8],[125,6],[122,8],[120,12]] /* philippines */,
      [[95,5.5],[98,4],[104,-1],[106,-5.5],[102,-4],[96,2]] /* sumatra */,
      [[105.5,-6.5],[114.5,-7.5],[114,-8.7],[106,-7.5]] /* java */,
      [[109,2],[110,1],[114,-3.5],[116,-3.5],[118,1],[119,5],[117,7],[114,4.5],[111,2]] /* borneo */,
      [[131,-1],[135,-3.5],[141,-3],[147,-6],[150,-10],[143,-9],[138,-8],[134,-4]] /* png */,
      [[80,6],[82,7],[81,9.5],[79.8,9]] /* srilanka */,
      [[-168,65.5],[-166,68.5],[-156,71],[-141,69.8],[-128,70],[-114,68.5],[-105,68],[-95,68],[-88,68],[-82,69.5],[-78,67],[-72,62.5],[-65,60],[-62,57],[-58,54],[-56,52],[-60,50],[-66,50],[-65,47.5],[-60,47],[-64,45],[-67,44.5],[-70,43.5],[-70,41.8],[-74,40.5],[-76,38],[-75.5,35.2],[-79,33],[-81,31],[-80,27],[-80,25.3],[-82,26],[-83,29],[-85,29.8],[-89,30.2],[-90,29],[-94,29.5],[-97,27.5],[-97.5,24],[-97.5,21],[-96,19],[-94.5,18.2],[-91,18.7],[-90.5,21],[-87,21.5],[-87.5,18.5],[-88.5,16],[-84,15.5],[-83.5,11],[-81,9],[-78,9],[-77.5,8],[-79.5,8.5],[-83,8],[-86,11],[-88,13],[-92,14.5],[-96,15.7],[-101,17.5],[-105.5,20],[-105.5,23],[-109,26],[-112.5,29.5],[-114.8,31.7],[-117.1,32.5],[-120.5,34.5],[-122.5,37.5],[-124,40.5],[-124,46],[-124.5,48.3],[-123,49],[-127,51],[-130,54.5],[-134,57.5],[-138,59],[-144,60],[-150,59.5],[-152,58],[-158,56.5],[-163,55],[-158,58.5],[-162,60],[-165,62],[-161,64],[-166,64.5]] /* namerica */,
      [[-117,32.5],[-114.5,31],[-112,27],[-109.5,23],[-110.2,23],[-112.5,25],[-115,28],[-116,30]] /* baja */,
      [[-85,22],[-80,23],[-74,20],[-78,20],[-82,22.5]] /* cuba */,
      [[-80,73],[-62,67],[-65,63],[-72,64],[-80,70]] /* baffin */,
      [[-54,67],[-50,63],[-43,60],[-40,65],[-32,68],[-22,70],[-19,75],[-30,80],[-55,80],[-58,72]] /* greenland */,
      [[-77.5,8.5],[-75.5,10.5],[-72,12],[-70,11.2],[-65,10.5],[-62,10.5],[-60,8.5],[-57,6],[-52,5],[-50,1.5],[-50,0],[-48,-1],[-44,-2.5],[-39,-3.5],[-35,-5.5],[-35,-9],[-38.5,-13],[-39,-17.5],[-41,-22],[-44,-23],[-48,-26],[-48.5,-28],[-52,-32],[-54,-34.5],[-58,-34.5],[-57,-37],[-62,-39],[-62,-41],[-65,-41],[-64.5,-43],[-67.5,-46],[-66,-48],[-69,-51],[-68.5,-53],[-68,-55],[-72,-53],[-75,-50],[-74,-45],[-73.5,-40],[-72,-35],[-71.5,-30],[-70.5,-24],[-70.2,-18],[-75,-15],[-77,-12],[-79.5,-7],[-81,-5],[-80,-2],[-80.5,0],[-78.5,2],[-77.5,4]] /* samerica */
    ];
    var seas = [
      [[28,41.8],[28,43],[28.8,44.5],[30,45.5],[31,46.5],[33,46],[33.5,45],[36,45.2],[37.5,47],[39,47],[38,44.5],[41.5,42],[41.5,41.5],[36,41.2],[33,42],[31,41.2],[29,41.2]] /* black */,
      [[47,37.5],[49,38.5],[49,41],[47,43],[47,45],[49,46.5],[52,46.5],[53,45],[51.5,43],[52.5,41.5],[54,40],[53.8,37.5],[51,36.8]] /* caspian */,
      [[-95,59],[-94,64],[-88,64],[-83,66],[-81,63],[-78,62],[-77,58],[-79,52],[-82,52.5],[-88,56],[-92,57]] /* hudson */
    ];

    // Land dots, evenly spaced over the sphere (generated once, re-projected as the globe turns)
    var landDots = [];
    var dotsFrag = document.createDocumentFragment();
    var eqW = ne(1, 0)[0];
    var row = 0;
    for(var glat = LAT_BOTTOM; glat <= LAT_TOP; glat += 3.4, row++){
      var wf = ne(1, glat)[0] / eqW;
      var cols = Math.max(1, Math.round(360 * wf / 4.05));
      for(var ci = 0; ci < cols; ci++){
        var dlon = -180 + (ci + (row % 2 ? 0.5 : 0)) * (360 / cols) + (Math.random()-0.5)*1.6;
        var dlat = glat + (Math.random()-0.5)*1.4;
        var ll = [dlon, dlat];
        var hit = false;
        for(var c=0; c<continents.length; c++){
          if(pointInPolygon(ll, continents[c])){ hit = true; break; }
        }
        if(hit){
          for(var q=0; q<seas.length; q++){
            if(pointInPolygon(ll, seas[q])){ hit = false; break; }
          }
        }
        if(hit){
          var dot = document.createElementNS(ns,'circle');
          dot.setAttribute('class','map-dot');
          dotsFrag.appendChild(dot);
          landDots.push({lon:dlon, lat:dlat, r:Math.random()*0.7 + 1.1, o:Math.random()*0.45 + 0.35, el:dot});
        }
      }
    }
    mapDotsG.appendChild(dotsFrag);

    var hub = {name:'Portugal', lon:-9.1, lat:38.7, lab:'w'};
    var markets = [
      {name:'South Africa', lon:18.4, lat:-33.9, lab:'e'},
      {name:'Namibia', lon:17.1, lat:-22.6, lab:'w'},
      {name:'Botswana', lon:24.7, lat:-22.3, lab:'s'},
      {name:'Zimbabwe', lon:31.0, lat:-17.8, lab:'e'},
      {name:'Kenya', lon:36.8, lat:-1.3, lab:'w'},
      {name:'Zanzibar', lon:39.2, lat:-6.2, lab:'e'},
      {name:'Malta', lon:14.5, lat:35.9, lab:'e'},
      {name:'Italy', lon:12.5, lat:41.9, lab:'e'},
      {name:'Scotland', lon:-3.2, lat:56.0, lab:'n'},
      {name:'Mexico', lon:-99.1, lat:19.4, lab:'s'},
      {name:'Australia', lon:151.2, lat:-33.9, lab:'w'}
    ];

    // Label placement around a pin: n / s / e / w
    function placeLabel(el, x, y, dir, gap){
      var g = gap || 0;
      if(dir === 'w'){ el.setAttribute('x', x-11-g); el.setAttribute('y', y+4); el.setAttribute('text-anchor','end'); }
      else if(dir === 'e'){ el.setAttribute('x', x+11+g); el.setAttribute('y', y+4); el.setAttribute('text-anchor','start'); }
      else if(dir === 's'){ el.setAttribute('x', x); el.setAttribute('y', y+19+g); el.setAttribute('text-anchor','middle'); }
      else { el.setAttribute('x', x); el.setAttribute('y', y-12-g); el.setAttribute('text-anchor','middle'); }
    }
    function setXY(el, x, y){ el.setAttribute('cx', x.toFixed(1)); el.setAttribute('cy', y.toFixed(1)); }

    var arcsG = document.getElementById('mapArcs');
    var pinsG = document.getElementById('mapPins');
    var label = document.getElementById('mapLabel');

    function showLabel(m){
      if(!label) return;
      label.querySelector('.mn').textContent = m.name;
      label.classList.add('is-active');
    }

    // Build pins, arcs and the hub once; layout() repositions them as the globe turns
    markets.forEach(function(m, i){
      m.arcGlow = document.createElementNS(ns,'path');
      m.arcGlow.setAttribute('class','map-arc-glow');
      arcsG.appendChild(m.arcGlow);
      m.arc = document.createElementNS(ns,'path');
      m.arc.setAttribute('class','map-arc');
      m.arc.style.animationDelay = (i*0.6)+'s';
      arcsG.appendChild(m.arc);

      var pinG = document.createElementNS(ns,'g');
      pinG.setAttribute('class','map-pin');
      pinG.setAttribute('tabindex','0');
      m.pinG = pinG;
      m.halo = document.createElementNS(ns,'circle');
      m.halo.setAttribute('r',7.5);
      m.halo.setAttribute('class','map-pin-halo pulse');
      m.halo.style.animationDelay = (i*0.5)+'s';
      pinG.appendChild(m.halo);
      m.core = document.createElementNS(ns,'circle');
      m.core.setAttribute('r',3.4);
      m.core.setAttribute('class','map-pin-core');
      pinG.appendChild(m.core);
      m.lbl = document.createElementNS(ns,'text');
      m.lbl.setAttribute('class','map-pin-label');
      m.lbl.textContent = m.name;
      pinG.appendChild(m.lbl);
      pinsG.appendChild(pinG);

      function activate(){
        document.querySelectorAll('.map-arc, .map-arc-glow').forEach(function(a){a.classList.remove('active');});
        document.querySelectorAll('.map-pin').forEach(function(p){p.classList.remove('active');});
        m.arc.classList.add('active');
        m.arcGlow.classList.add('active');
        pinG.classList.add('active');
        showLabel(m);
      }
      pinG.addEventListener('mouseenter', activate);
      pinG.addEventListener('focus', activate);
      pinG.addEventListener('click', function(){ activate(); centerOn(m); });
      if(i===0){ activate(); }
    });

    var hubG = document.createElementNS(ns,'g');
    hubG.setAttribute('class','map-hub');
    var hubHalo = document.createElementNS(ns,'circle');
    hubHalo.setAttribute('r',9.5);
    hubHalo.setAttribute('class','map-hub-halo pulse');
    hubG.appendChild(hubHalo);
    var hubCore = document.createElementNS(ns,'circle');
    hubCore.setAttribute('r',4.4);
    hubCore.setAttribute('class','map-hub-core');
    hubG.appendChild(hubCore);
    var hubLbl = document.createElementNS(ns,'text');
    hubLbl.setAttribute('class','map-pin-label hub');
    hubLbl.textContent = 'Portugal · HQ';
    hubG.appendChild(hubLbl);
    hubG.addEventListener('mouseenter', function(){ showLabel(hub); });
    hubG.addEventListener('click', function(){ showLabel(hub); centerOn(hub); });
    pinsG.appendChild(hubG);

    function layout(){
      landDots.forEach(function(d){
        var p = project(d.lon, d.lat);
        var t = Math.abs(p[2]) / 180;
        var e = t*t;
        d.el.setAttribute('cx', p[0].toFixed(1));
        d.el.setAttribute('cy', p[1].toFixed(1));
        d.el.setAttribute('r', (d.r * (1 - 0.4*e)).toFixed(2));
        d.el.setAttribute('opacity', (d.o * (1 - 0.8*e)).toFixed(2));
      });

      var hxy = project(hub.lon, hub.lat);
      setXY(hubHalo, hxy[0], hxy[1]);
      setXY(hubCore, hxy[0], hxy[1]);
      placeLabel(hubLbl, hxy[0], hxy[1], hub.lab, 2);

      markets.forEach(function(m){
        var mxy = project(m.lon, m.lat);
        var x1 = hxy[0], y1 = hxy[1], x2 = mxy[0], y2 = mxy[1];
        var dx = x2-x1, dy = y2-y1;
        var dist = Math.sqrt(dx*dx+dy*dy) || 1;
        var nx = -dy/dist, ny = dx/dist;
        if(ny > 0){ nx = -nx; ny = -ny; }
        var bend = Math.min(dist*0.22, 55);
        var cx = (x1+x2)/2 + nx*bend, cy = (y1+y2)/2 + ny*bend;
        var d = 'M'+x1.toFixed(1)+','+y1.toFixed(1)+' Q'+cx.toFixed(1)+','+cy.toFixed(1)+' '+x2.toFixed(1)+','+y2.toFixed(1);
        var far = Math.abs(dx) > W*0.6;
        m.arc.setAttribute('d', d);
        m.arcGlow.setAttribute('d', d);
        m.arc.style.display = m.arcGlow.style.display = far ? 'none' : '';
        setXY(m.halo, x2, y2);
        setXY(m.core, x2, y2);
        placeLabel(m.lbl, x2, y2, m.lab);
      });
    }

    // Turn the globe so the selected location sits in the centre
    var turnFrame = null;
    function centerOn(target){
      var fromL = state.l0, fromV = state.vy;
      var dL = wrapLon(target.lon - fromL);
      var restV = state.vy; state.vy = 0;
      var targetY = project(target.lon, target.lat)[1];
      state.vy = restV;
      var toV = -(targetY - H/2) * 0.45;
      if(turnFrame) cancelAnimationFrame(turnFrame);
      if(reduceMotion){ state.l0 = fromL + dL; state.vy = toV; layout(); return; }
      var t0 = null, dur = 950;
      function step(ts){
        if(t0 === null) t0 = ts;
        var k = Math.min((ts - t0) / dur, 1);
        var e = k < 0.5 ? 4*k*k*k : 1 - Math.pow(-2*k + 2, 3)/2;
        state.l0 = fromL + dL*e;
        state.vy = fromV + (toV - fromV)*e;
        layout();
        turnFrame = k < 1 ? requestAnimationFrame(step) : null;
      }
      turnFrame = requestAnimationFrame(step);
    }

    layout();

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
      {name:'Markets', title:'Europe · Africa · the Americas · Australia', desc:"Active and expanding markets, with project-based work across the wider African continent."},
      {name:'Service Partners', title:'Logistics, Finance, Legal & Marketing', desc:"Service businesses seeking introductions into new markets alongside the brands they serve."},
      {name:'Capital', title:'Investors & Entrepreneurs', desc:"Investors and entrepreneurs seeking cross-border commercial opportunities."}
    ];
    var ncx=230, ncy=230, nr=165;
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
      circle.setAttribute('cx',x);circle.setAttribute('cy',y);circle.setAttribute('r',52);
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
