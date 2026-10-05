/* iConnect Partner Portal
   Pages: portal-login.html (sign in / register), portal.html (overview, company details,
   agreement), portal-admin.html (staff view).
   Data: Supabase when portal-config.js is filled in; otherwise a local-only demo mode
   (localhost only) so the screens can be tested without a backend. */
(function(){
  'use strict';

  var CFG = window.PORTAL_CONFIG || {};
  var AG = CFG.agreement || {};
  var page = document.body.getAttribute('data-page');
  var isLocal = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  var configured = !!(CFG.supabaseUrl && CFG.supabaseAnonKey);
  var demo = !configured && isLocal;

  function $(id){ return document.getElementById(id); }
  function show(el, on){ if(el) el.hidden = !on; }
  function setText(id, t){ var e = $(id); if(e) e.textContent = (t === undefined || t === null || t === '') ? '' : t; }
  function fmtDate(iso){
    var d = new Date(iso);
    return d.toLocaleDateString('en-GB', {day:'numeric', month:'long', year:'numeric'});
  }
  function fmtDateTime(iso){
    var d = new Date(iso);
    return fmtDate(iso) + ', ' + d.toLocaleTimeString('en-GB', {hour:'2-digit', minute:'2-digit'});
  }
  function msg(id, text, ok){
    var e = $(id); if(!e) return;
    e.textContent = text || '';
    e.className = 'form-msg' + (ok ? ' ok' : '');
  }

  /* ---------------------------------------------------------------- terms */
  function terms(){
    var t = JSON.parse(JSON.stringify(AG));
    t.iconnect = t.iconnect || {}; t.fee = t.fee || {}; t.signatory = t.signatory || {};
    if(demo){ // clearly marked placeholders so the screens can be tested locally
      t.assetsWithinDays = t.assetsWithinDays || '[10]';
      t.liabilityCapIfNoFees = t.liabilityCapIfNoFees || '[SAMPLE CAP]';
      t.governingLaw = t.governingLaw || '[SAMPLE JURISDICTION]';
      t.fee.option = t.fee.option || 'none';
    }
    return t;
  }
  function missingTerms(t){
    var m = [];
    if(!t.assetsWithinDays) m.push('asset delivery days');
    if(!t.liabilityCapIfNoFees) m.push('liability cap');
    if(!t.governingLaw) m.push('governing law');
    if(!t.fee.option) m.push('fee option');
    return m;
  }

  /* ----------------------------------------------------------- data layer */
  var api;

  function supabaseApi(){
    var sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey);
    function fail(r){ if(r.error) throw new Error(r.error.message); return r.data; }
    return {
      raw: sb,
      user: async function(){
        var r = await sb.auth.getSession();
        var s = r.data && r.data.session;
        return s ? {id: s.user.id, email: s.user.email} : null;
      },
      signUp: async function(p){
        var r = await sb.auth.signUp({
          email: p.email, password: p.password,
          options: {
            data: {company_name: p.company, contact_name: p.contact},
            emailRedirectTo: location.origin + location.pathname.replace('portal-login.html', 'portal.html')
          }
        });
        if(r.error) throw new Error(r.error.message);
        return {needsConfirm: !r.data.session};
      },
      signIn: async function(email, password){
        fail(await sb.auth.signInWithPassword({email: email, password: password}));
      },
      signOut: async function(){ await sb.auth.signOut(); },
      resetPassword: async function(email){
        fail(await sb.auth.resetPasswordForEmail(email, {redirectTo: location.origin + '/portal-login.html'}));
      },
      updatePassword: async function(pw){ fail(await sb.auth.updateUser({password: pw})); },
      profile: async function(){
        var u = await this.user();
        return fail(await sb.from('partners').select('*').eq('id', u.id).single());
      },
      saveProfile: async function(fields){
        var u = await this.user();
        fields.updated_at = new Date().toISOString();
        return fail(await sb.from('partners').update(fields).eq('id', u.id).select().single());
      },
      agreement: async function(version){
        var u = await this.user();
        return fail(await sb.from('agreements').select('*').eq('partner_id', u.id).eq('version', version).maybeSingle());
      },
      sign: async function(payload){
        var u = await this.user();
        payload.partner_id = u.id;
        return fail(await sb.from('agreements').insert(payload).select().single());
      },
      adminList: async function(){
        var p = fail(await sb.from('partners').select('*').order('created_at', {ascending: false}));
        var a = fail(await sb.from('agreements').select('*').order('signed_at', {ascending: false}));
        return {partners: p, agreements: a};
      },
      countersign: async function(id){ fail(await sb.rpc('countersign_agreement', {agreement_id: id})); }
    };
  }

  function demoApi(){
    var K = {users: 'iconnect_demo_users', session: 'iconnect_demo_session', ag: 'iconnect_demo_agreements'};
    function read(k, d){ try{ return JSON.parse(localStorage.getItem(k)) || d; }catch(e){ return d; } }
    function write(k, v){ localStorage.setItem(k, JSON.stringify(v)); }
    function uid(){ return 'demo-' + Math.random().toString(36).slice(2, 10); }
    function me(){ var s = read(K.session, null); return s ? read(K.users, {})[s] : null; }
    return {
      user: async function(){ var u = me(); return u ? {id: u.id, email: u.profile.email} : null; },
      signUp: async function(p){
        var users = read(K.users, {});
        if(users[p.email]) throw new Error('An account with this email already exists.');
        users[p.email] = {id: uid(), password: p.password, profile: {
          email: p.email, company_name: p.company, contact_name: p.contact,
          is_admin: /^admin@/.test(p.email), created_at: new Date().toISOString()
        }};
        write(K.users, users); write(K.session, p.email);
        return {needsConfirm: false};
      },
      signIn: async function(email, password){
        var u = read(K.users, {})[email];
        if(!u || u.password !== password) throw new Error('Invalid email or password.');
        write(K.session, email);
      },
      signOut: async function(){ localStorage.removeItem(K.session); },
      resetPassword: async function(){ /* demo only */ },
      updatePassword: async function(){ /* demo only */ },
      profile: async function(){ return me().profile; },
      saveProfile: async function(fields){
        var users = read(K.users, {}), u = me();
        Object.keys(fields).forEach(function(k){ u.profile[k] = fields[k]; });
        users[u.profile.email] = u; write(K.users, users);
        return u.profile;
      },
      agreement: async function(version){
        var u = me();
        return read(K.ag, []).filter(function(a){ return a.partner_id === u.id && a.version === version; })[0] || null;
      },
      sign: async function(payload){
        var u = me(), all = read(K.ag, []);
        payload.id = uid(); payload.partner_id = u.id; payload.status = 'signed';
        payload.signer_email = u.profile.email; payload.signed_at = new Date().toISOString();
        all.push(payload); write(K.ag, all);
        return payload;
      },
      adminList: async function(){
        var users = read(K.users, {});
        var partners = Object.keys(users).map(function(k){ var p = users[k].profile; p.id = users[k].id; return p; });
        return {partners: partners, agreements: read(K.ag, [])};
      },
      countersign: async function(id){
        var all = read(K.ag, []);
        all.forEach(function(a){ if(a.id === id){ a.countersigned_at = new Date().toISOString(); a.countersigned_by = (AG.signatory && AG.signatory.name) || 'iConnect'; } });
        write(K.ag, all);
      }
    };
  }

  /* ------------------------------------------------------------ shared UI */
  function notReady(){
    var box = $('portalApp'); if(box) box.hidden = true;
    var n = $('portalSoon'); if(n) n.hidden = false;
  }
  function demoBanner(){
    if(!demo) return;
    var b = document.createElement('div');
    b.className = 'portal-demo';
    b.textContent = 'Demo mode: data is stored only in this browser. Connect Supabase in portal-config.js to go live.';
    document.body.insertBefore(b, document.body.firstChild);
  }
  async function requireUser(){
    var u = await api.user();
    if(!u){ location.replace('portal-login.html'); return null; }
    return u;
  }
  function wireSignOut(){
    var btn = $('signOutBtn');
    if(btn) btn.addEventListener('click', async function(){ await api.signOut(); location.replace('portal-login.html'); });
  }

  // Where a signed-in user belongs: staff go to the admin page, partners to their portal
  async function homePage(){
    try{
      var p = await api.profile();
      return p && p.is_admin ? 'portal-admin.html' : 'portal.html';
    }catch(e){ return 'portal.html'; }
  }

  /* ============================================================= LOGIN PAGE */
  function initLogin(){
    var tabs = document.querySelectorAll('[data-auth-tab]');
    function pick(name){
      tabs.forEach(function(t){ t.classList.toggle('active', t.getAttribute('data-auth-tab') === name); });
      ['signin', 'register', 'reset', 'newpw'].forEach(function(n){ show($('pane-' + n), n === name); });
      ['signinMsg', 'registerMsg', 'resetMsg', 'newpwMsg'].forEach(function(m){ msg(m, ''); });
    }
    tabs.forEach(function(t){ t.addEventListener('click', function(){ pick(t.getAttribute('data-auth-tab')); }); });
    var forgot = $('forgotLink'); if(forgot) forgot.addEventListener('click', function(e){ e.preventDefault(); pick('reset'); });
    var back = $('backToSignin'); if(back) back.addEventListener('click', function(e){ e.preventDefault(); pick('signin'); });

    if(api.raw){
      api.raw.auth.onAuthStateChange(function(ev){ if(ev === 'PASSWORD_RECOVERY') pick('newpw'); });
    }
    api.user().then(async function(u){ if(u && !/type=recovery/.test(location.hash)) location.replace(await homePage()); });

    $('signinForm').addEventListener('submit', async function(e){
      e.preventDefault(); msg('signinMsg', 'Signing in…', true);
      try{
        await api.signIn($('siEmail').value.trim(), $('siPassword').value);
        location.replace(await homePage());
      }catch(err){ msg('signinMsg', err.message); }
    });
    $('registerForm').addEventListener('submit', async function(e){
      e.preventDefault();
      var pw = $('rgPassword').value;
      if(pw.length < 8){ msg('registerMsg', 'Use a password of at least 8 characters.'); return; }
      msg('registerMsg', 'Creating your account…', true);
      try{
        var r = await api.signUp({
          email: $('rgEmail').value.trim(), password: pw,
          company: $('rgCompany').value.trim(), contact: $('rgContact').value.trim()
        });
        if(r.needsConfirm){
          msg('registerMsg', 'Almost there. Check your email and click the confirmation link, then sign in.', true);
        }else{
          location.replace(await homePage());
        }
      }catch(err){ msg('registerMsg', err.message); }
    });
    $('resetForm').addEventListener('submit', async function(e){
      e.preventDefault();
      try{
        await api.resetPassword($('rsEmail').value.trim());
        msg('resetMsg', 'If that email has an account, a reset link is on its way.', true);
      }catch(err){ msg('resetMsg', err.message); }
    });
    $('newpwForm').addEventListener('submit', async function(e){
      e.preventDefault();
      var pw = $('npPassword').value;
      if(pw.length < 8){ msg('newpwMsg', 'Use a password of at least 8 characters.'); return; }
      try{
        await api.updatePassword(pw);
        location.replace(await homePage());
      }catch(err){ msg('newpwMsg', err.message); }
    });
  }

  /* =========================================================== PORTAL PAGE */
  var profile = null, signed = null;
  var REQUIRED = ['company_name', 'reg_no', 'address', 'contact_name', 'contact_title', 'phone'];
  var FIELD_IDS = {
    company_name: 'cdCompany', trading_names: 'cdTrading', reg_no: 'cdRegNo', address: 'cdAddress',
    contact_name: 'cdContact', contact_title: 'cdTitle', phone: 'cdPhone', website: 'cdWebsite',
    product_categories: 'cdProducts', current_markets: 'cdCurrent', target_markets: 'cdTarget', notes: 'cdNotes'
  };
  function detailsComplete(p){ return REQUIRED.every(function(k){ return p && String(p[k] || '').trim(); }); }

  function route(){
    var name = (location.hash || '#overview').slice(1);
    if(['overview', 'company', 'agreement'].indexOf(name) < 0) name = 'overview';
    ['overview', 'company', 'agreement'].forEach(function(n){
      show($('tab-' + n), n === name);
      var b = document.querySelector('[data-portal-tab="' + n + '"]');
      if(b) b.classList.toggle('active', n === name);
    });
    if(name === 'agreement') renderAgreement();
    window.scrollTo(0, 0);
  }

  function renderOverview(){
    var done = detailsComplete(profile);
    setText('ovCompanyStatus', done ? 'Complete' : 'Needs your details');
    $('ovCompanyStatus').className = 'status ' + (done ? 'ok' : 'todo');
    var ag = signed;
    var statusEl = $('ovAgreementStatus');
    if(ag){
      statusEl.textContent = 'Signed';
      statusEl.className = 'status ok';
      setText('ovAgreementNote', 'Signed by ' + ag.signer_name + ' on ' + fmtDate(ag.signed_at));
    }else{
      statusEl.textContent = done ? 'Ready to sign' : 'Waiting for company details';
      statusEl.className = 'status todo';
      setText('ovAgreementNote', 'Website & Brand Exposure Agreement');
    }
    setText('whoName', profile.contact_name || profile.company_name || '');
  }

  function fillCompanyForm(){
    Object.keys(FIELD_IDS).forEach(function(k){ $(FIELD_IDS[k]).value = profile[k] || ''; });
    $('cdEmail').value = profile.email || '';
  }
  function initCompany(){
    fillCompanyForm();
    $('companyForm').addEventListener('submit', async function(e){
      e.preventDefault();
      var f = {};
      Object.keys(FIELD_IDS).forEach(function(k){ f[k] = $(FIELD_IDS[k]).value.trim(); });
      msg('companyMsg', 'Saving…', true);
      try{
        profile = await api.saveProfile(f);
        msg('companyMsg', 'Saved.', true);
        renderOverview();
        if(signed) renderAgreement(); // company snapshot on a signed agreement never changes
      }catch(err){ msg('companyMsg', err.message); }
    });
  }

  /* ------------------------------------------------------------- agreement */
  var CHANNEL_KEYS = ['website', 'social', 'newsletter', 'decks', 'events', 'casestudies'];

  function bind(name, value){
    document.querySelectorAll('[data-b="' + name + '"]').forEach(function(el){
      el.textContent = (value === undefined || value === null || value === '') ? '—' : value;
    });
  }

  function renderAgreement(){
    var t = terms(), miss = missingTerms(t);
    var ready = miss.length === 0;
    var done = detailsComplete(profile);
    var snap = signed ? signed.company : profile;     // a signed agreement shows the details as signed
    var sel = signed ? signed.terms : t;

    show($('agrNotReady'), !ready && !signed);
    show($('agrNeedDetails'), ready && !done && !signed);
    show($('agrSignedBanner'), !!signed);
    show($('agrSignBox'), ready && done && !signed);

    // parties
    bind('ic_name', sel.iconnect.registeredName);
    bind('ic_reg', sel.iconnect.regNo);
    bind('ic_addr', sel.iconnect.address);
    // iConnect's registration number and address are optional: hide the rows until they are set
    ['ic_reg', 'ic_addr'].forEach(function(k){
      var dd = document.querySelector('[data-b="' + k + '"]');
      if(dd) dd.parentNode.hidden = !(k === 'ic_reg' ? sel.iconnect.regNo : sel.iconnect.address);
    });
    bind('ic_web', sel.iconnect.website);
    bind('ic_contact', sel.iconnect.contact);
    bind('ic_email', sel.iconnect.email);
    bind('br_name', snap.company_name);
    bind('br_trading', snap.trading_names);
    bind('br_reg', snap.reg_no);
    bind('br_addr', snap.address);
    bind('br_contact', [snap.contact_name, snap.contact_title].filter(Boolean).join(', '));
    bind('br_email', snap.email);
    bind('br_phone', snap.phone);
    bind('effective', signed ? fmtDate(signed.signed_at) : 'The date you sign');
    bind('agr_ref', signed ? 'IC-' + String(signed.id).replace(/-/g, '').slice(0, 8).toUpperCase() : 'Issued on signing');
    bind('agr_ver', sel.version);

    // clauses with blanks
    bind('days', sel.assetsWithinDays);
    bind('cap', sel.liabilityCapIfNoFees);
    bind('law', sel.governingLaw);

    // fees
    var fee = sel.fee || {};
    ['none', 'fee', 'separate'].forEach(function(o){ $('fee_' + o).checked = (fee.option === o); });
    bind('fee_amount', fee.amount); bind('fee_currency', fee.currency);
    bind('fee_per', fee.per); bind('fee_invoiced', fee.invoiced); bind('fee_sepdate', fee.separateDate);
    ['fee_amount', 'fee_currency', 'fee_per', 'fee_invoiced', 'fee_sepdate'].forEach(function(k){
      document.querySelectorAll('[data-b="' + k + '"]').forEach(function(el){ if(el.textContent === '—') el.textContent = '________'; });
    });

    // channels + territory
    var boxes = document.querySelectorAll('input[name="ch"]');
    var chosen = signed ? signed.channels : null;
    boxes.forEach(function(b){
      b.disabled = !!signed || !(ready && done);
      if(chosen) b.checked = !!chosen[b.value];
    });
    $('chSocialOther').disabled = !!signed || !(ready && done);
    $('territory').disabled = !!signed || !(ready && done);
    if(signed){
      $('chSocialOther').value = (chosen && chosen.socialOther) || '';
      $('territory').value = signed.territory || '';
    }

    // signature table
    bind('sig_ic_name', sel.signatory.name); bind('sig_ic_title', sel.signatory.title);
    if(signed){
      bind('sig_br_name', signed.signer_name); bind('sig_br_title', signed.signer_title);
      bind('sig_br_sig', 'Accepted and signed electronically');
      bind('sig_br_date', fmtDateTime(signed.signed_at));
      bind('sig_ic_sig', signed.countersigned_at ? 'Countersigned by ' + signed.countersigned_by : 'Awaiting iConnect countersignature');
      bind('sig_ic_date', signed.countersigned_at ? fmtDateTime(signed.countersigned_at) : '');
      setText('agrSignedText', 'Signed by ' + signed.signer_name + ', ' + signed.signer_title + ', on ' + fmtDateTime(signed.signed_at));
      setText('agrCounterText', signed.countersigned_at
        ? 'Countersigned by ' + signed.countersigned_by + ' on ' + fmtDate(signed.countersigned_at)
        : 'Awaiting iConnect countersignature');
    }else{
      bind('sig_br_name', ''); bind('sig_br_title', ''); bind('sig_br_sig', ''); bind('sig_br_date', '');
      bind('sig_ic_sig', ''); bind('sig_ic_date', '');
    }

    if(!signed && ready && done){
      if(!$('signName').value) $('signName').value = profile.contact_name || '';
      if(!$('signTitle').value) $('signTitle').value = profile.contact_title || '';
    }
    if(miss.length && !signed){
      setText('agrMissing', 'Still to be confirmed by iConnect: ' + miss.join(', ') + '.');
    }
  }

  function initAgreement(){
    $('signForm').addEventListener('submit', async function(e){
      e.preventDefault();
      var t = terms();
      if(missingTerms(t).length || !detailsComplete(profile)) return;
      var channels = {}, any = false;
      CHANNEL_KEYS.forEach(function(k){
        var b = document.querySelector('input[name="ch"][value="' + k + '"]');
        channels[k] = !!b.checked; if(b.checked) any = true;
      });
      channels.socialOther = $('chSocialOther').value.trim();
      var territory = $('territory').value.trim();
      var name = $('signName').value.trim(), title = $('signTitle').value.trim();
      if(!any){ msg('signMsg', 'Tick at least one channel in section 2.'); return; }
      if(!territory){ msg('signMsg', 'Enter the territory for exposure in section 2.'); return; }
      if(!name || !title){ msg('signMsg', 'Enter your full name and title.'); return; }
      if(!$('signAccept').checked){ msg('signMsg', 'Please confirm you are authorised and accept the agreement.'); return; }
      msg('signMsg', 'Signing…', true);
      try{
        signed = await api.sign({
          version: t.version, signer_name: name, signer_title: title,
          channels: channels, territory: territory, terms: t, company: profile,
          user_agent: navigator.userAgent.slice(0, 250)
        });
        msg('signMsg', '');
        renderOverview(); renderAgreement();
        window.scrollTo(0, 0);
      }catch(err){
        msg('signMsg', /duplicate|unique/i.test(err.message) ? 'This agreement has already been signed.' : err.message);
      }
    });
    var pr = $('printAgr'); if(pr) pr.addEventListener('click', function(){ window.print(); });
  }

  async function initPortal(){
    var u = await requireUser(); if(!u) return;
    profile = await api.profile();
    if(profile.is_admin){ location.replace('portal-admin.html'); return; }
    signed = await api.agreement(terms().version);
    wireSignOut();
    renderOverview(); initCompany(); initAgreement();
    window.addEventListener('hashchange', route);
    document.querySelectorAll('[data-go]').forEach(function(a){
      a.addEventListener('click', function(){ location.hash = a.getAttribute('data-go'); });
    });
    route();
  }

  /* ============================================================ ADMIN PAGE */
  async function initAdmin(){
    var u = await requireUser(); if(!u) return;
    var me = await api.profile();
    wireSignOut();
    if(!me.is_admin){ show($('adminDenied'), true); show($('adminBody'), false); return; }
    show($('adminBody'), true);
    var t = terms();

    async function load(){
      var data = await api.adminList();
      var byPartner = {};
      data.agreements.forEach(function(a){ byPartner[a.partner_id] = a; });
      var tbody = $('adminRows'); tbody.textContent = '';
      data.partners.filter(function(p){ return !p.is_admin; }).forEach(function(p){
        var a = byPartner[p.id];
        var tr = document.createElement('tr');
        function td(text, cls){ var c = document.createElement('td'); c.textContent = text; if(cls) c.className = cls; tr.appendChild(c); return c; }
        td(p.company_name || '(not set)');
        td([p.contact_name, p.email].filter(Boolean).join('\n'), 'pre');
        td(detailsComplete(p) ? 'Complete' : 'Incomplete', detailsComplete(p) ? 'ok' : 'todo');
        td(a ? 'Signed by ' + a.signer_name + ', ' + a.signer_title + '\n' + fmtDateTime(a.signed_at) : 'Not signed', a ? 'ok pre' : 'todo');
        var c5 = document.createElement('td');
        if(a && !a.countersigned_at){
          var btn = document.createElement('button');
          btn.className = 'btn btn-gold btn-sm'; btn.type = 'button'; btn.textContent = 'Countersign';
          btn.addEventListener('click', async function(){
            btn.disabled = true;
            try{ await api.countersign(a.id); await load(); }catch(err){ alert(err.message); btn.disabled = false; }
          });
          c5.appendChild(btn);
        }else if(a){
          c5.textContent = 'Countersigned ' + fmtDate(a.countersigned_at);
        }else{ c5.textContent = '—'; }
        tr.appendChild(c5);
        var c6 = document.createElement('td');
        if(a){
          var v = document.createElement('button');
          v.className = 'btn btn-outline btn-sm'; v.type = 'button'; v.textContent = 'Details';
          v.addEventListener('click', function(){ showDetail(p, a); });
          c6.appendChild(v);
        }
        tr.appendChild(c6);
        tbody.appendChild(tr);
      });
      if(!tbody.children.length){
        var tr0 = document.createElement('tr'), c = document.createElement('td');
        c.colSpan = 6; c.textContent = 'No partners have registered yet.'; tr0.appendChild(c); tbody.appendChild(tr0);
      }
    }
    function showDetail(p, a){
      var rows = [
        ['Company', a.company.company_name], ['Trading names', a.company.trading_names],
        ['Registration no.', a.company.reg_no], ['Address', a.company.address],
        ['Contact', [a.company.contact_name, a.company.contact_title].filter(Boolean).join(', ')],
        ['Email / phone', [a.company.email, a.company.phone].filter(Boolean).join(' / ')],
        ['Signed by', a.signer_name + ', ' + a.signer_title + ' (' + (a.signer_email || '') + ')'],
        ['Signed at', fmtDateTime(a.signed_at)],
        ['Agreement version', a.version],
        ['Channels', CHANNEL_KEYS.filter(function(k){ return a.channels[k]; }).join(', ') + (a.channels.socialOther ? ' (social: ' + a.channels.socialOther + ')' : '')],
        ['Territory', a.territory],
        ['Fee option', a.terms && a.terms.fee ? a.terms.fee.option : ''],
        ['Countersigned', a.countersigned_at ? a.countersigned_by + ', ' + fmtDateTime(a.countersigned_at) : 'Not yet']
      ];
      var box = $('adminDetail'); box.textContent = '';
      var h = document.createElement('h3'); h.textContent = (a.company.company_name || 'Partner') + ': signed agreement'; box.appendChild(h);
      var dl = document.createElement('dl'); dl.className = 'lb-notes';
      rows.forEach(function(r){
        var d = document.createElement('div'), dt = document.createElement('dt'), dd = document.createElement('dd');
        dt.textContent = r[0]; dd.textContent = r[1] || '—'; d.appendChild(dt); d.appendChild(dd); dl.appendChild(d);
      });
      box.appendChild(dl); show(box, true); box.scrollIntoView({behavior: 'smooth', block: 'nearest'});
    }
    await load();
  }

  /* ------------------------------------------------------------------ boot */
  async function boot(){
    if(!configured && !demo){ notReady(); return; }
    try{
      if(configured){
        if(!window.supabase){ throw new Error('Could not load the sign-in service. Check your connection.'); }
        api = supabaseApi();
      }else{
        api = demoApi();
      }
      demoBanner();
      if(page === 'login') initLogin();
      else if(page === 'portal') await initPortal();
      else if(page === 'admin') await initAdmin();
    }catch(err){
      var e = $('portalError'); if(e){ e.textContent = err.message; e.hidden = false; }
      console.error(err);
    }
  }
  boot();
})();
