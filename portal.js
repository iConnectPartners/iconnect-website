/* iConnect Partner Portal
   Pages: portal-login.html (sign in / register / invite), portal.html (partner space and
   agreement viewer), portal-admin.html (staff: invites, send agreements, countersign).
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

  // Agreements the portal knows how to display. Add new ones here as they are written.
  var TEMPLATES = {
    'brand-exposure': {title: 'Website & Brand Exposure Agreement'}
  };
  function templateTitle(key){ return (TEMPLATES[key] && TEMPLATES[key].title) || key; }

  function $(id){ return document.getElementById(id); }
  function show(el, on){ if(el) el.hidden = !on; }
  function setText(id, t){ var e = $(id); if(e) e.textContent = (t === undefined || t === null) ? '' : t; }
  function fmtDate(iso){ return new Date(iso).toLocaleDateString('en-GB', {day:'numeric', month:'long', year:'numeric'}); }
  function fmtDateTime(iso){
    var d = new Date(iso);
    return fmtDate(iso) + ', ' + d.toLocaleTimeString('en-GB', {hour:'2-digit', minute:'2-digit'});
  }
  function msg(id, text, ok){
    var e = $(id); if(!e) return;
    e.textContent = text || '';
    e.className = 'form-msg' + (ok ? ' ok' : '');
  }
  function cleanError(err){
    var m = (err && err.message) || String(err);
    if(/duplicate key|unique/i.test(m)) return 'That has already been done.';
    return m;
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
    if(!t.fee || !t.fee.option) m.push('fee option');
    return m;
  }

  /* ----------------------------------------------------------- data layer */
  var api;

  function supabaseApi(){
    var sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey);
    function ok(r){ if(r.error) throw new Error(r.error.message); return r.data; }
    var self = {
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
            emailRedirectTo: location.origin + '/portal.html'
          }
        });
        if(r.error) throw new Error(r.error.message);
        return {needsConfirm: !r.data.session};
      },
      signIn: async function(email, password){ ok(await sb.auth.signInWithPassword({email: email, password: password})); },
      signOut: async function(){ await sb.auth.signOut(); },
      resetPassword: async function(email){ ok(await sb.auth.resetPasswordForEmail(email, {redirectTo: location.origin + '/portal-login.html'})); },
      updatePassword: async function(pw){ ok(await sb.auth.updateUser({password: pw})); },
      profile: async function(){ var u = await self.user(); return ok(await sb.from('partners').select('*').eq('id', u.id).single()); },
      saveProfile: async function(fields){
        var u = await self.user();
        fields.updated_at = new Date().toISOString();
        return ok(await sb.from('partners').update(fields).eq('id', u.id).select().single());
      },
      partnerById: async function(id){ return ok(await sb.from('partners').select('*').eq('id', id).single()); },
      myAgreements: async function(){
        var u = await self.user();
        return ok(await sb.from('agreements').select('*').eq('partner_id', u.id).order('sent_at', {ascending: false}));
      },
      agreementById: async function(id){ return ok(await sb.from('agreements').select('*').eq('id', id).maybeSingle()); },
      signAgreement: async function(id, p){
        return ok(await sb.rpc('sign_agreement', {
          p_id: id, p_signer_name: p.name, p_signer_title: p.title, p_channels: p.channels,
          p_territory: p.territory, p_user_agent: p.userAgent
        }));
      },
      getInvite: async function(token){
        var rows = ok(await sb.rpc('get_invite', {p_token: token}));
        return rows && rows.length ? rows[0] : null;
      },
      adminList: async function(){
        return {
          partners: ok(await sb.from('partners').select('*').order('created_at', {ascending: false})),
          agreements: ok(await sb.from('agreements').select('*').order('sent_at', {ascending: false})),
          invites: ok(await sb.from('invites').select('*').order('created_at', {ascending: false}))
        };
      },
      createInvite: async function(name, company, email, agreements){ ok(await sb.rpc('create_invite', {p_name: name, p_company: company, p_email: email, p_agreements: agreements || []})); },
      resendInvite: async function(id){ ok(await sb.rpc('resend_invite', {p_id: id})); },
      sendAgreement: async function(partnerId, template, version, t){
        ok(await sb.rpc('send_agreement', {p_partner: partnerId, p_template: template, p_version: version, p_terms: t}));
      },
      countersign: async function(id){ ok(await sb.rpc('countersign_agreement', {agreement_id: id})); }
    };
    return self;
  }

  function demoApi(){
    var K = {users: 'iconnect_demo_users', session: 'iconnect_demo_session', ag: 'iconnect_demo_agreements', inv: 'iconnect_demo_invites'};
    function read(k, d){ try{ return JSON.parse(localStorage.getItem(k)) || d; }catch(e){ return d; } }
    function write(k, v){ localStorage.setItem(k, JSON.stringify(v)); }
    function uid(){ return 'demo-' + Math.random().toString(36).slice(2, 10); }
    function me(){ var s = read(K.session, null); return s ? read(K.users, {})[s] : null; }
    function allPartners(){
      var users = read(K.users, {});
      return Object.keys(users).map(function(k){ var p = users[k].profile; p.id = users[k].id; return p; });
    }
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
        var inv = read(K.inv, []), ags = read(K.ag, []), newId = users[p.email].id;
        inv.forEach(function(i){
          if(i.email === p.email && !i.accepted_at){
            (i.agreements || []).forEach(function(a){
              ags.unshift({id: 'ag-' + uid(), partner_id: newId, template: a.template, version: a.version, status: 'sent', terms: a.terms, sent_at: new Date().toISOString()});
            });
            i.accepted_at = new Date().toISOString();
          }
        });
        write(K.inv, inv); write(K.ag, ags);
        return {needsConfirm: false};
      },
      signIn: async function(email, password){
        var u = read(K.users, {})[email];
        if(!u || u.password !== password) throw new Error('Invalid email or password.');
        write(K.session, email);
      },
      signOut: async function(){ localStorage.removeItem(K.session); },
      resetPassword: async function(){},
      updatePassword: async function(){},
      profile: async function(){ var u = me(); u.profile.id = u.id; return u.profile; },
      saveProfile: async function(fields){
        var users = read(K.users, {}), u = me();
        Object.keys(fields).forEach(function(k){ u.profile[k] = fields[k]; });
        u.profile.id = u.id;
        users[u.profile.email] = u; write(K.users, users);
        return u.profile;
      },
      partnerById: async function(id){ return allPartners().filter(function(p){ return p.id === id; })[0]; },
      myAgreements: async function(){
        var u = me();
        return read(K.ag, []).filter(function(a){ return a.partner_id === u.id; }).sort(function(a, b){ return b.sent_at < a.sent_at ? -1 : 1; });
      },
      agreementById: async function(id){
        var u = me(), a = read(K.ag, []).filter(function(x){ return x.id === id; })[0] || null;
        return a && (u.profile.is_admin || a.partner_id === u.id) ? a : null;
      },
      signAgreement: async function(id, p){
        var all = read(K.ag, []), u = me(), a = all.filter(function(x){ return x.id === id && x.partner_id === u.id; })[0];
        if(!a) throw new Error('Agreement not found.');
        if(a.status !== 'sent') throw new Error('This agreement has already been signed.');
        a.status = 'signed'; a.signer_name = p.name; a.signer_title = p.title; a.signer_email = u.profile.email;
        a.channels = p.channels; a.territory = p.territory; a.company = JSON.parse(JSON.stringify(u.profile));
        a.signed_at = new Date().toISOString(); write(K.ag, all);
        return a;
      },
      getInvite: async function(token){
        var i = read(K.inv, []).filter(function(x){ return x.token === token && !x.accepted_at; })[0];
        return i ? {contact_name: i.contact_name, company_name: i.company_name, email: i.email} : null;
      },
      adminList: async function(){ return {partners: allPartners(), agreements: read(K.ag, []), invites: read(K.inv, [])}; },
      createInvite: async function(name, company, email, agreements){
        email = email.toLowerCase().trim();
        if(allPartners().some(function(p){ return p.email === email; })) throw new Error('This email is already registered.');
        var inv = read(K.inv, []);
        inv.unshift({id: uid(), token: uid(), email: email, contact_name: name, company_name: company, agreements: agreements || [], created_at: new Date().toISOString(), accepted_at: null});
        write(K.inv, inv);
      },
      resendInvite: async function(){},
      sendAgreement: async function(partnerId, template, version, t){
        var all = read(K.ag, []);
        if(all.some(function(a){ return a.partner_id === partnerId && a.template === template && a.version === version; })) throw new Error('That agreement has already been sent to this partner.');
        all.unshift({id: 'ag-' + uid(), partner_id: partnerId, template: template, version: version, status: 'sent', terms: t, sent_at: new Date().toISOString()});
        write(K.ag, all);
      },
      countersign: async function(id){
        var all = read(K.ag, []);
        all.forEach(function(a){ if(a.id === id && a.status === 'signed'){ a.countersigned_at = new Date().toISOString(); a.countersigned_by = (AG.signatory && AG.signatory.name) || 'iConnect'; } });
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
    if(!u){
      var next = location.pathname.replace(/^\//, '') + location.hash;
      location.replace('portal-login.html?next=' + encodeURIComponent(next));
      return null;
    }
    return u;
  }
  function wireSignOut(){
    var btn = $('signOutBtn');
    if(btn) btn.addEventListener('click', async function(){ await api.signOut(); location.replace('portal-login.html'); });
  }
  function params(){ return new URLSearchParams(location.search); }
  // only ever follow a link back into the portal
  function safeNext(){
    var n = params().get('next');
    return n && /^portal[a-z-]*\.html(#[A-Za-z0-9\/_-]*)?$/.test(n) ? n : null;
  }
  async function homePage(){
    var n = safeNext(); if(n) return n;
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

    // invite link: open the register form, pre-filled
    var token = params().get('invite');
    if(token){
      api.getInvite(token).then(function(inv){
        if(inv){
          pick('register');
          $('rgCompany').value = inv.company_name || '';
          $('rgContact').value = inv.contact_name || '';
          $('rgEmail').value = inv.email || '';
          $('rgEmail').readOnly = true;
          show($('inviteNote'), true);
        }else{
          msg('signinMsg', 'This invitation has already been used. Sign in below, or reset your password if you need to.');
        }
      }).catch(function(){});
    }

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
  var profile = null, myAgreements = [], current = null, viewerIsAdmin = false;
  var REQUIRED = ['company_name', 'reg_no', 'address', 'contact_name', 'contact_title', 'phone'];
  var FIELD_IDS = {
    company_name: 'cdCompany', trading_names: 'cdTrading', reg_no: 'cdRegNo', address: 'cdAddress',
    contact_name: 'cdContact', contact_title: 'cdTitle', phone: 'cdPhone', website: 'cdWebsite',
    product_categories: 'cdProducts', current_markets: 'cdCurrent', target_markets: 'cdTarget', notes: 'cdNotes'
  };
  var CHANNEL_KEYS = ['website', 'social', 'newsletter', 'decks', 'events', 'casestudies'];
  function detailsComplete(p){ return REQUIRED.every(function(k){ return p && String(p[k] || '').trim(); }); }

  function statusOf(a){
    if(a.status !== 'signed') return {key: 'todo', label: 'Awaiting your signature'};
    if(a.countersigned_at) return {key: 'ok', label: 'Fully signed'};
    return {key: 'wait', label: 'Signed, awaiting iConnect'};
  }

  function route(){
    var h = (location.hash || '#overview').slice(1).split('/');
    var name = h[0];
    if(viewerIsAdmin){ name = 'agreement'; }
    else if(['overview', 'company', 'agreements', 'agreement'].indexOf(name) < 0) name = 'overview';
    if(name === 'agreement' && !h[1]) name = 'agreements';
    ['overview', 'company', 'agreements', 'agreement'].forEach(function(n){ show($('tab-' + n), n === name); });
    document.querySelectorAll('[data-portal-tab]').forEach(function(b){
      var t = b.getAttribute('data-portal-tab');
      b.classList.toggle('active', t === name || (t === 'agreements' && name === 'agreement'));
    });
    if(name === 'agreements') renderAgreementList();
    if(name === 'agreement') openAgreement(h[1]);
    window.scrollTo(0, 0);
  }

  function renderOverview(){
    var done = detailsComplete(profile);
    setText('ovCompanyStatus', done ? 'Complete' : 'Needs your details');
    $('ovCompanyStatus').className = 'status ' + (done ? 'ok' : 'todo');
    var waiting = myAgreements.filter(function(a){ return a.status !== 'signed'; }).length;
    var el = $('ovAgreementStatus');
    if(!myAgreements.length){
      el.textContent = 'None yet'; el.className = 'status wait';
      setText('ovAgreementNote', 'iConnect will send your agreement here to sign.');
    }else if(waiting){
      el.textContent = waiting + ' to sign'; el.className = 'status todo';
      setText('ovAgreementNote', waiting === 1 ? 'You have an agreement waiting for your signature.' : 'You have agreements waiting for your signature.');
    }else{
      el.textContent = 'All signed'; el.className = 'status ok';
      setText('ovAgreementNote', 'View or download your agreements.');
    }
    setText('whoName', profile.contact_name || profile.company_name || '');
  }

  function renderAgreementList(){
    var box = $('agrList'); box.textContent = '';
    show($('agrEmpty'), !myAgreements.length);
    myAgreements.forEach(function(a){
      var s = statusOf(a);
      var card = document.createElement('a');
      card.className = 'portal-step agr-card'; card.href = '#agreement/' + a.id;
      var h = document.createElement('h3'); h.textContent = templateTitle(a.template);
      var p = document.createElement('p'); p.textContent = 'Sent ' + fmtDate(a.sent_at) + (a.signed_at ? ' · Signed ' + fmtDate(a.signed_at) : '');
      var st = document.createElement('span'); st.className = 'status ' + s.key; st.textContent = s.label;
      var go = document.createElement('span'); go.className = 'agr-go'; go.textContent = a.status === 'signed' ? 'View / download →' : 'Review and sign →';
      card.appendChild(h); card.appendChild(p); card.appendChild(st); card.appendChild(go);
      box.appendChild(card);
    });
  }

  function fillCompanyForm(){
    var p = profile || {};
    Object.keys(FIELD_IDS).forEach(function(k){ $(FIELD_IDS[k]).value = p[k] || ''; });
    $('cdEmail').value = p.email || '';
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
        renderOverview();
        if(!detailsComplete(profile)){
          msg('companyMsg', 'Saved. Fill in every field marked * to continue to your agreement.', true);
          return;
        }
        // details are complete: carry on to the agreement waiting to be signed
        myAgreements = await api.myAgreements();
        var waiting = myAgreements.filter(function(a){ return a.status !== 'signed'; });
        if(waiting.length === 1){ msg('companyMsg', 'Saved. Opening your agreement…', true); location.hash = '#agreement/' + waiting[0].id; }
        else if(waiting.length > 1){ msg('companyMsg', 'Saved. Opening your agreements…', true); location.hash = '#agreements'; }
        else{ msg('companyMsg', 'Saved. iConnect will send you your agreement here to sign.', true); renderOverview(); }
      }catch(err){ msg('companyMsg', cleanError(err)); }
    });
  }

  /* ------------------------------------------------------------- agreement */
  function bind(name, value){
    document.querySelectorAll('[data-b="' + name + '"]').forEach(function(el){
      el.textContent = (value === undefined || value === null || value === '') ? '—' : value;
    });
  }

  async function openAgreement(id){
    var ag = null;
    try{ ag = await api.agreementById(id); }catch(e){ ag = null; }
    // partners only ever see their own agreements (the database enforces this too)
    if(ag && !viewerIsAdmin && profile && ag.partner_id !== profile.id) ag = null;
    if(!ag){ current = null; show($('agrDocWrap'), false); show($('agrNotFound'), true); return; }
    show($('agrNotFound'), false); show($('agrDocWrap'), true);
    current = ag;
    var prof = profile;
    if(viewerIsAdmin){ try{ prof = await api.partnerById(ag.partner_id); }catch(e){ prof = {}; } }
    renderAgreement(ag, prof);
  }

  function renderAgreement(ag, prof){
    prof = prof || {};
    var signed = ag.status === 'signed';
    var done = detailsComplete(prof);
    var canSign = !viewerIsAdmin && !signed && done;
    var snap = (signed && ag.company) ? ag.company : prof;
    snap = snap || {};
    var sel = ag.terms || terms();
    sel.iconnect = sel.iconnect || {}; sel.signatory = sel.signatory || {}; sel.fee = sel.fee || {};

    // navigation
    var back = $('agrBack');
    back.textContent = viewerIsAdmin ? '← Back to admin' : '← All agreements';
    back.href = viewerIsAdmin ? 'portal-admin.html' : '#agreements';

    setText('agrDocTitle', templateTitle(ag.template));
    show($('agrNeedDetails'), !viewerIsAdmin && !signed && !done);
    show($('agrSignedBanner'), signed);
    show($('agrSignBox'), canSign);
    show($('agrAdminPending'), viewerIsAdmin && !signed);

    // parties
    bind('ic_name', sel.iconnect.registeredName);
    bind('ic_reg', sel.iconnect.regNo);
    bind('ic_addr', sel.iconnect.address);
    bind('ic_web', sel.iconnect.website);
    bind('ic_contact', sel.iconnect.contact);
    bind('ic_email', sel.iconnect.email);
    ['ic_reg', 'ic_addr'].forEach(function(k){
      var dd = document.querySelector('[data-b="' + k + '"]');
      if(dd) dd.parentNode.hidden = !(k === 'ic_reg' ? sel.iconnect.regNo : sel.iconnect.address);
    });
    bind('br_name', snap.company_name);
    bind('br_trading', snap.trading_names);
    bind('br_reg', snap.reg_no);
    bind('br_addr', snap.address);
    bind('br_contact', [snap.contact_name, snap.contact_title].filter(Boolean).join(', '));
    bind('br_email', snap.email);
    bind('br_phone', snap.phone);
    bind('effective', signed ? fmtDate(ag.signed_at) : 'The date it is signed');
    bind('agr_ref', 'IC-' + String(ag.id).replace(/[^A-Za-z0-9]/g, '').slice(0, 8).toUpperCase());
    bind('agr_ver', ag.version || sel.version);

    bind('days', sel.assetsWithinDays);
    bind('cap', sel.liabilityCapIfNoFees);
    bind('law', sel.governingLaw);

    var fee = sel.fee || {};
    ['none', 'fee', 'separate'].forEach(function(o){ $('fee_' + o).checked = (fee.option === o); });
    bind('fee_amount', fee.amount); bind('fee_currency', fee.currency);
    bind('fee_per', fee.per); bind('fee_invoiced', fee.invoiced); bind('fee_sepdate', fee.separateDate);
    ['fee_amount', 'fee_currency', 'fee_per', 'fee_invoiced', 'fee_sepdate'].forEach(function(k){
      document.querySelectorAll('[data-b="' + k + '"]').forEach(function(el){ if(el.textContent === '—') el.textContent = '________'; });
    });

    // channels + territory
    var chosen = signed ? (ag.channels || {}) : null;
    document.querySelectorAll('input[name="ch"]').forEach(function(b){
      b.disabled = !canSign;
      b.checked = chosen ? !!chosen[b.value] : false;
    });
    $('chSocialOther').disabled = !canSign;
    $('chSocialOther').value = chosen ? (chosen.socialOther || '') : '';
    $('territory').disabled = !canSign;
    $('territory').value = signed ? (ag.territory || '') : '';
    if(!signed){ $('signAccept').checked = false; msg('signMsg', ''); }

    // signatures
    bind('sig_ic_name', sel.signatory.name); bind('sig_ic_title', sel.signatory.title);
    if(signed){
      bind('sig_br_name', ag.signer_name); bind('sig_br_title', ag.signer_title);
      bind('sig_br_sig', 'Accepted and signed electronically');
      bind('sig_br_date', fmtDateTime(ag.signed_at));
      bind('sig_ic_sig', ag.countersigned_at ? 'Countersigned by ' + ag.countersigned_by : 'Awaiting iConnect countersignature');
      bind('sig_ic_date', ag.countersigned_at ? fmtDateTime(ag.countersigned_at) : '');
      var pill = $('agrStatusPill'); pill.textContent = ag.countersigned_at ? 'Fully signed' : 'Signed'; pill.className = 'status ok';
      setText('agrSignedText', 'Signed by ' + ag.signer_name + ', ' + ag.signer_title + ', on ' + fmtDateTime(ag.signed_at));
      setText('agrCounterText', ag.countersigned_at
        ? 'Countersigned by ' + ag.countersigned_by + ' on ' + fmtDate(ag.countersigned_at)
        : 'Awaiting iConnect countersignature');
      show($('agrCountersignBtn'), viewerIsAdmin && !ag.countersigned_at);
    }else{
      ['sig_br_name', 'sig_br_title', 'sig_br_sig', 'sig_br_date', 'sig_ic_sig', 'sig_ic_date'].forEach(function(k){ bind(k, ''); });
      if(canSign){
        if(!$('signName').value) $('signName').value = prof.contact_name || '';
        if(!$('signTitle').value) $('signTitle').value = prof.contact_title || '';
      }
    }
  }

  function initAgreement(){
    $('signForm').addEventListener('submit', async function(e){
      e.preventDefault();
      if(!current || current.status === 'signed' || !detailsComplete(profile)) return;
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
        var res = await api.signAgreement(current.id, {
          name: name, title: title, channels: channels, territory: territory,
          userAgent: navigator.userAgent.slice(0, 250)
        });
        msg('signMsg', '');
        myAgreements = await api.myAgreements();
        renderOverview();
        current = (res && res.id) ? res : await api.agreementById(current.id);
        renderAgreement(current, profile);
        window.scrollTo(0, 0);
      }catch(err){ msg('signMsg', cleanError(err)); }
    });
    var pr = $('printAgr'); if(pr) pr.addEventListener('click', function(){ window.print(); });
    var cs = $('agrCountersignBtn');
    if(cs) cs.addEventListener('click', async function(){
      cs.disabled = true;
      try{
        await api.countersign(current.id);
        current = await api.agreementById(current.id);
        renderAgreement(current, await api.partnerById(current.partner_id));
      }catch(err){ alert(cleanError(err)); }
      cs.disabled = false;
    });
  }

  async function initPortal(){
    var u = await requireUser(); if(!u) return;
    profile = await api.profile();
    var wantsAgreement = /^#agreement\//.test(location.hash);
    if(profile.is_admin){
      if(!wantsAgreement){ location.replace('portal-admin.html'); return; }
      viewerIsAdmin = true;
      document.body.classList.add('viewer-admin');
    }else{
      myAgreements = await api.myAgreements();
    }
    wireSignOut();
    if(!viewerIsAdmin){ renderOverview(); initCompany(); }
    initAgreement();
    window.addEventListener('hashchange', route);
    route();
  }

  /* ============================================================ ADMIN PAGE */
  async function initAdmin(){
    var u = await requireUser(); if(!u) return;
    var me = await api.profile();
    wireSignOut();
    if(!me.is_admin){ show($('adminDenied'), true); show($('adminBody'), false); return; }
    show($('adminBody'), true);
    var data = {partners: [], agreements: [], invites: []};

    function cell(tr, text, cls){ var c = document.createElement('td'); c.textContent = text; if(cls) c.className = cls; tr.appendChild(c); return c; }
    function btn(label, kind, fn){
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'btn btn-sm ' + (kind || 'btn-outline'); b.textContent = label;
      b.addEventListener('click', fn); return b;
    }
    function link(label, href){
      var a = document.createElement('a'); a.className = 'btn btn-sm btn-outline'; a.href = href; a.textContent = label; return a;
    }
    function emptyRow(tbody, cols, text){
      var tr = document.createElement('tr'), c = document.createElement('td');
      c.colSpan = cols; c.textContent = text; tr.appendChild(c); tbody.appendChild(tr);
    }
    function partnerName(id){
      var p = data.partners.filter(function(x){ return x.id === id; })[0];
      return p ? (p.company_name || p.email) : 'Unknown';
    }

    async function load(){
      data = await api.adminList();
      var partners = data.partners.filter(function(p){ return !p.is_admin; });

      // partners
      var tb = $('adminRows'); tb.textContent = '';
      partners.forEach(function(p){
        var tr = document.createElement('tr');
        cell(tr, p.company_name || '(not set)');
        cell(tr, [p.contact_name, p.email].filter(Boolean).join('\n'), 'pre');
        var ok = detailsComplete(p);
        cell(tr, ok ? 'Complete' : 'Incomplete', ok ? 'ok' : 'todo');
        var n = data.agreements.filter(function(a){ return a.partner_id === p.id; }).length;
        cell(tr, n ? n + (n === 1 ? ' agreement' : ' agreements') : 'None sent');
        tb.appendChild(tr);
      });
      if(!partners.length) emptyRow(tb, 4, 'No partners have registered yet.');

      // partner dropdown for sending agreements
      var sel = $('sendPartner'); var keep = sel.value; sel.textContent = '';
      var o0 = document.createElement('option'); o0.value = ''; o0.textContent = 'Choose a partner'; sel.appendChild(o0);
      partners.forEach(function(p){
        var o = document.createElement('option'); o.value = p.id;
        o.textContent = (p.company_name || p.email) + (p.contact_name ? ' (' + p.contact_name + ')' : '');
        sel.appendChild(o);
      });
      sel.value = keep;

      // invites
      var ib = $('inviteRows'); ib.textContent = '';
      // once an invited person registers they become a partner and drop off this list
      var pending = data.invites.filter(function(i){ return !i.accepted_at; });
      pending.forEach(function(i){
        var tr = document.createElement('tr');
        cell(tr, i.company_name || '—');
        cell(tr, [i.contact_name, i.email].filter(Boolean).join('\n'), 'pre');
        cell(tr, (i.agreements && i.agreements.length) ? i.agreements.map(function(a){ return templateTitle(a.template); }).join('\n') : '—', 'pre');
        cell(tr, 'Invited ' + fmtDate(i.created_at), 'todo');
        var c = document.createElement('td');
        if(!i.accepted_at){
          c.appendChild(btn('Resend', 'btn-outline', async function(ev){
            var b = ev.currentTarget; b.disabled = true;
            try{ await api.resendInvite(i.id); b.textContent = 'Sent'; }catch(err){ alert(cleanError(err)); b.disabled = false; }
          }));
        }
        tr.appendChild(c); ib.appendChild(tr);
      });
      if(!pending.length) emptyRow(ib, 5, 'No pending invites.');

      // agreements
      var ab = $('agreementRows'); ab.textContent = '';
      data.agreements.forEach(function(a){
        var tr = document.createElement('tr');
        cell(tr, partnerName(a.partner_id));
        cell(tr, templateTitle(a.template) + '\nv' + a.version, 'pre');
        var st = a.status !== 'signed' ? 'Sent ' + fmtDate(a.sent_at) + '\nAwaiting partner signature'
               : (a.countersigned_at ? 'Fully signed\n' + fmtDate(a.countersigned_at) : 'Signed ' + fmtDate(a.signed_at) + '\nAwaiting countersignature');
        cell(tr, st, (a.countersigned_at ? 'ok' : 'todo') + ' pre');
        cell(tr, a.signer_name ? a.signer_name + ', ' + a.signer_title : '—');
        var c = document.createElement('td'); c.className = 'actions';
        c.appendChild(link(a.status === 'signed' ? 'View / download' : 'View', 'portal.html#agreement/' + a.id));
        if(a.status === 'signed' && !a.countersigned_at){
          c.appendChild(btn('Countersign', 'btn-gold', async function(ev){
            var b = ev.currentTarget; b.disabled = true;
            try{ await api.countersign(a.id); await load(); }catch(err){ alert(cleanError(err)); b.disabled = false; }
          }));
        }
        tr.appendChild(c); ab.appendChild(tr);
      });
      if(!data.agreements.length) emptyRow(ab, 5, 'No agreements sent yet.');
    }

    $('inviteForm').addEventListener('submit', async function(e){
      e.preventDefault();
      var name = $('invName').value.trim(), company = $('invCompany').value.trim(), email = $('invEmail').value.trim();
      if(!name || !company || !email){ msg('inviteMsg', 'Enter a name, business or brand name and email.'); return; }
      var picked = [].slice.call(document.querySelectorAll('#inviteAgreements input:checked')).map(function(b){ return b.value; });
      var agreements = [];
      if(picked.length){
        var t = terms(), miss = missingTerms(t);
        if(miss.length){ msg('inviteMsg', 'Agreement terms still to be set in portal-config.js: ' + miss.join(', ') + '.'); return; }
        agreements = picked.map(function(k){ return {template: k, version: t.version, terms: t}; });
      }
      msg('inviteMsg', 'Sending…', true);
      try{
        await api.createInvite(name, company, email, agreements);
        msg('inviteMsg', 'Invitation sent to ' + email + (agreements.length ? ', with the agreement included.' : '.'), true);
        $('inviteForm').reset();
        fillInviteAgreements();
        await load();
      }catch(err){ msg('inviteMsg', cleanError(err)); }
    });

    $('sendForm').addEventListener('submit', async function(e){
      e.preventDefault();
      var pid = $('sendPartner').value, tpl = $('sendTemplate').value;
      if(!pid){ msg('sendMsg', 'Choose a partner.'); return; }
      var t = terms(), miss = missingTerms(t);
      if(miss.length){ msg('sendMsg', 'Agreement terms still to be set in portal-config.js: ' + miss.join(', ') + '.'); return; }
      msg('sendMsg', 'Sending…', true);
      try{
        await api.sendAgreement(pid, tpl, t.version, t);
        msg('sendMsg', 'Agreement sent to ' + partnerName(pid) + '. They have been emailed.', true);
        await load();
      }catch(err){
        msg('sendMsg', /already been sent|duplicate|unique/i.test(err.message) ? 'That agreement has already been sent to this partner.' : cleanError(err));
      }
    });

    // agreements that can ship with an invitation (ticked by default)
    function fillInviteAgreements(){
      var box = $('inviteAgreements'); box.textContent = '';
      Object.keys(TEMPLATES).forEach(function(k){
        var lab = document.createElement('label'), inp = document.createElement('input'), sp = document.createElement('span');
        inp.type = 'checkbox'; inp.value = k; inp.checked = true; sp.textContent = TEMPLATES[k].title;
        lab.appendChild(inp); lab.appendChild(document.createTextNode(' ')); lab.appendChild(sp); box.appendChild(lab);
      });
    }
    fillInviteAgreements();

    // list the agreements Grant can send
    var ts = $('sendTemplate'); ts.textContent = '';
    Object.keys(TEMPLATES).forEach(function(k){
      var o = document.createElement('option'); o.value = k; o.textContent = TEMPLATES[k].title; ts.appendChild(o);
    });
    await load();
  }

  /* ------------------------------------------------------------------ boot */
  function showFatal(err){
    var e = $('portalError');
    if(e){
      var where = (err && err.stack ? String(err.stack).split('\n').slice(1, 3).join(' ').replace(/\s+/g, ' ').trim() : '');
      e.textContent = ((err && err.message) || String(err)) + (where ? '  [' + where + ']' : '');
      e.hidden = false;
    }
    console.error(err);
  }
  window.addEventListener('unhandledrejection', function(ev){ showFatal(ev.reason); });

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
      showFatal(err);
    }
  }
  boot();
})();
