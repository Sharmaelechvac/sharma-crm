/* ============================================================
   SHARMA360 CRM v4 — More module (view-more.js)
   Registers VIEWS.more + ACTIONS.more_* / req_* / prod_* / set_*.
   Sections: hub → Requests, Products & Submittals, Settings.

   Apple-design restyle of the v3 module: Settings-style hub with
   29px icon tiles (§9.3, settings-like lists only), grouped inset
   lists with footnote group headers, §9.5 grouped form rows,
   §9.7 quiet status pills, §5.9 empty states, and a true iOS
   Settings page. Appearance is Light | Dark ONLY (Sanjay's
   standing rule): default Light, never follows the OS, choice
   remembered on device, applied via the shell's setAppearance()
   when present (guarded).
   All data logic and action names are unchanged from v3.

   New class hooks introduced (for style.css): .grouplabel
   (shared with view-jobs), .tile (hub icon tile, inline SVG
   stroke icons per spec §7.2), .rval (quiet secondary trailing
   value), .rowactions (action row inside a group), .frow /
   .fctl / .fval / .fstack (shared form-row hooks, see
   view-jobs). Removed in this module: .cathead (→ .grouplabel),
   .badge for sources/photos (→ secondary text / .rval).

   Conventions used (see V3-CONTRACT.md):
   - Clicks: data-act (core delegation). Inputs/selects/file use
     inline oninput/onchange -> ACTIONS because core's delegation
     is click-only.
   - Forms go through core's openForm(html); leaving a form tries
     closeForm() if core provides it, else re-renders the tab.
   - Requests convert creates a client + an empty, unpriced Draft
     quote shell (quote number from DB.seq.quote). The request
     keeps clientId/quoteId of what it created.
   - Settings role switch: uses core's setRole(r) if present,
     else sets the global ROLE + sessionStorage "sharma-crm-role"
     (v2's key). Lock: lockApp() if present.
   - Export excludes passHash, matching v2. Import replaces the
     data arrays on DB in place (never rebinds DB) after confirm.
   ============================================================ */
(function(){
"use strict";

var M = { section: "hub" };            /* hub | requests | products | settings */
var PQ = { q: "", trade: "All" };      /* product search state */
var REQ_SOURCES = ["Bid Boards", "Lead Finder", "Call", "Picker", "Referral"];

/* ---------------- appearance (Light | Dark only) ---------------- */
function appearanceNow(){
  try {
    if (typeof document !== "undefined" && document.documentElement) {
      var t = document.documentElement.getAttribute("data-theme");
      if (t === "dark" || t === "light") return t;
    }
  } catch (e) { /* no DOM yet */ }
  try {
    var saved = localStorage.getItem("sharma-crm-appearance");
    if (saved === "dark" || saved === "light") return saved;
  } catch (e) { /* storage unavailable */ }
  return "light"; /* Sanjay's rule: default Light, never the OS setting */
}
var APP_MODE = appearanceNow();

/* ---------------- small local helpers ---------------- */
function refresh(){ if (typeof render === "function") render(); }
function navTo(tab){
  var el = document.querySelector('[data-nav="' + tab + '"]');
  if (el) { el.click(); return; }
  if (typeof go === "function") { go(tab); return; }
  refresh();
}
function exitForm(){
  if (typeof closeForm === "function") { closeForm(); refresh(); return; }
  navTo("more");
}
function refreshSearch(inputId){
  refresh();
  var el = document.getElementById(inputId);
  if (el) { el.focus(); var v = el.value; el.value = ""; el.value = v; }
}
function requestPill(st){
  if (st === "Converted") return '<span class="pill green">Converted</span>';
  if (st === "Archived") return '<span class="pill grey">Archived</span>';
  return '<span class="pill blue">New</span>';
}
function cap(s){ s = String(s || ""); return s.charAt(0).toUpperCase() + s.slice(1); }
function tileIcon(paths){
  return '<span class="tile"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths + '</svg></span>';
}

/* ---------------- hub ---------------- */
function hubHTML(){
  var newReqs = DB.requests.filter(function(r){ return r.status === "New"; }).length;
  var h = '<h2 class="view">More</h2><div class="listcard">';
  h += '<button class="rowitem" data-act="more_go" data-val="requests">' +
         tileIcon('<rect x="3.5" y="5" width="17" height="14" rx="2"/><path d="M3.5 13.5h4.2l1.6 2.5h5.4l1.6-2.5h4.2"/>') +
         '<span class="grow"><span class="name">Requests</span></span>' +
         (newReqs ? '<span class="rval">' + newReqs + ' new</span>' : '') + '<span class="chev">›</span></button>';
  h += '<button class="rowitem" data-act="more_go" data-val="products">' +
         tileIcon('<path d="M12 3.2 20 7.6v8.8l-8 4.4-8-4.4V7.6z"/><path d="M4.3 7.8 12 12l7.7-4.2"/><path d="M12 12v8.6"/>') +
         '<span class="grow"><span class="name">Products &amp; Submittals</span></span>' +
         '<span class="rval">' + PRODUCTS.length + '</span><span class="chev">›</span></button>';
  h += '<button class="rowitem" data-act="more_go" data-val="settings">' +
         tileIcon('<path d="M4.5 7.5h15M4.5 12h15M4.5 16.5h15"/><circle cx="9" cy="7.5" r="2.1"/><circle cx="15.5" cy="12" r="2.1"/><circle cx="8" cy="16.5" r="2.1"/>') +
         '<span class="grow"><span class="name">Settings</span></span>' +
         '<span class="chev">›</span></button>';
  h += '</div>';
  return h;
}

/* ---------------- requests ---------------- */
function requestsHTML(){
  var h = '<button class="backbtn" data-act="more_go" data-val="hub">← More</button>' +
          '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">' +
          '<h2 class="view" style="margin:0">Requests</h2>' +
          '<button class="btn gold" data-act="req_new">＋ New Request</button></div>';
  if (!DB.requests.length) {
    h += '<div class="empty"><div class="empty-ic">▥</div><h3>No Requests Yet</h3>' +
         '<p class="muted">New work from Bid Boards, the Lead Finder, phone calls and the picker lands here — then converts to a client + draft quote in one tap.</p>' +
         '<button class="btn gold" data-act="req_new">＋ New Request</button></div>';
    return h;
  }
  var order = { "New": 0, "Converted": 1, "Archived": 2 };
  var list = DB.requests.slice().sort(function(a, b){
    return ((order[a.status] || 0) - (order[b.status] || 0)) ||
           String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
  });
  ["New", "Converted", "Archived"].forEach(function(st){
    var g = list.filter(function(r){ return r.status === st; });
    if (!g.length) return;
    h += '<div class="grouplabel">' + st + ' · ' + g.length + '</div><div class="listcard">';
    g.forEach(function(r){
      var desc = r.desc || r.description || "";
      var meta = [];
      meta.push(esc(r.source || "—"));
      meta.push(fmtDate(r.createdAt));
      if (r.contact) meta.push(esc(r.contact));
      h += '<div class="rowitem"><span class="grow">' +
             '<span class="name">' + esc(r.name) + '</span>' +
             '<div class="meta">' + meta.join(" · ") + '</div>' +
             (desc ? '<div class="meta">' + esc(desc) + '</div>' : '') +
             '</span>' +
             requestPill(r.status) + '</div>';
      if (r.status === "New") {
        h += '<div class="rowactions">' +
               '<button class="btn" data-act="req_convert" data-id="' + r.id + '">Convert to client + draft quote</button>' +
               '<button class="btn ghost" data-act="req_archive" data-id="' + r.id + '">Archive</button>' +
             '</div>';
      }
    });
    h += '</div>';
  });
  return h;
}
function requestFormHTML(){
  return '<button class="backbtn" data-act="req_form_cancel">← Cancel</button>' +
    '<h2 class="view">New Request</h2><div class="card">' +
    '<div class="frow"><label class="f" for="rq-name">Name *</label>' +
    '<span class="fctl"><input type="text" id="rq-name" placeholder="Builder, homeowner, GC…"></span></div>' +
    '<div class="frow"><label class="f" for="rq-contact">Phone or email</label>' +
    '<span class="fctl"><input type="text" id="rq-contact"></span></div>' +
    '<div class="frow"><label class="f" for="rq-source">Source</label>' +
    '<span class="fctl"><select id="rq-source">' +
      REQ_SOURCES.map(function(s){ return '<option value="' + s + '">' + s + '</option>'; }).join("") + '</select></span></div>' +
    '<div class="frow fstack"><label class="f" for="rq-desc">What do they need?</label>' +
    '<textarea id="rq-desc" placeholder="Scope, address, timing…"></textarea></div>' +
    '</div>' +
    '<div class="err" id="rq-err"></div>' +
    '<button class="btn gold block" data-act="req_save">Save request</button>' +
    '<button class="btn ghost block" data-act="req_form_cancel">Cancel</button>';
}
function convertFormHTML(r){
  var contact = r.contact || "";
  var isEmail = contact.indexOf("@") !== -1;
  return '<button class="backbtn" data-act="req_form_cancel">← Cancel</button>' +
    '<h2 class="view">Convert request</h2><div class="card">' +
    '<p class="muted small">Creates a client and an empty, unpriced Draft quote shell. Prices are added later — by the Owner.</p>' +
    '<div class="frow"><label class="f" for="cv-name">Client name *</label>' +
    '<span class="fctl"><input type="text" id="cv-name" value="' + esc(r.name) + '"></span></div>' +
    '<div class="frow"><label class="f" for="cv-type">Client type</label>' +
    '<span class="fctl"><select id="cv-type">' +
      '<option value="builder">Builder</option><option value="homeowner">Homeowner</option><option value="commercial">Commercial</option></select></span></div>' +
    (isEmail
      ? '<div class="frow"><label class="f" for="cv-email">Email</label>' +
        '<span class="fctl"><input type="email" id="cv-email" value="' + esc(contact) + '"></span></div>'
      : '<div class="frow"><label class="f" for="cv-phone">Phone</label>' +
        '<span class="fctl"><input type="tel" id="cv-phone" value="' + esc(contact) + '"></span></div>') +
    '<div class="frow"><label class="f" for="cv-trade">Quote trade</label>' +
    '<span class="fctl"><select id="cv-trade">' +
      '<option value="Electric">Electric</option><option value="HVAC">HVAC</option></select></span></div>' +
    '</div>' +
    '<div class="err" id="cv-err"></div>' +
    '<button class="btn gold block" data-act="req_convert_save" data-id="' + r.id + '">Create client + draft quote</button>' +
    '<button class="btn ghost block" data-act="req_form_cancel">Cancel</button>';
}

/* ---------------- products & submittals ---------------- */
function productsHTML(){
  var q = PQ.q.trim().toLowerCase();
  var groups = {}, order = [];
  PRODUCTS.forEach(function(p){
    if (PQ.trade !== "All") {
      var t = String(p.trade || "").toLowerCase();
      if (PQ.trade === "Electrical" && t !== "electrical") return;
      if (PQ.trade === "HVAC" && t !== "hvac") return;
    }
    if (q) {
      var hay = [p.name || "", p.brand || "", p.model || "", p.category || ""].join(" ").toLowerCase();
      if (hay.indexOf(q) === -1) return;
    }
    var cat = p.category || "uncategorized";
    if (!groups[cat]) { groups[cat] = []; order.push(cat); }
    groups[cat].push(p);
  });
  order.sort();
  var shown = order.reduce(function(s, c){ return s + groups[c].length; }, 0);

  var h = '<button class="backbtn" data-act="more_go" data-val="hub">← More</button>' +
          '<h2 class="view">Products &amp; Submittals</h2>' +
          '<p class="muted">Submittal library — packets are built with the Bid Package tool from a quote.</p>' +
          '<div class="card">' +
            '<input type="text" id="prod-q" placeholder="Search name, brand, model…" value="' + esc(PQ.q) + '" oninput="ACTIONS.prod_q(this.value)">' +
            '<div class="chips">' +
              ["All", "Electrical", "HVAC"].map(function(t){
                return '<button data-act="prod_trade" data-val="' + t + '"' + (PQ.trade === t ? ' class="on"' : '') + '>' + t + '</button>';
              }).join("") +
            '</div>' +
            '<p class="muted small" style="margin:8px 0 0">Showing ' + shown + ' of ' + PRODUCTS.length + ' products</p>' +
          '</div>';
  if (!shown) {
    h += '<div class="empty"><div class="empty-ic">⌕</div><h3>No Products Found</h3>' +
         '<p class="muted">No products match this search.</p></div>';
    return h;
  }
  order.forEach(function(cat){
    h += '<div class="grouplabel">' + esc(cap(cat)) + ' · ' + groups[cat].length + '</div><div class="listcard">';
    groups[cat].forEach(function(p){
      var meta = [];
      if (p.brand) meta.push(esc(p.brand));
      if (p.model) meta.push("Model " + esc(p.model));
      if (!meta.length) meta.push(p.trade === "hvac" ? "HVAC" : "Electrical");
      h += '<div class="rowitem"><span class="grow"><span class="name">' + esc(p.name) + '</span>' +
             '<div class="meta">' + meta.join(" · ") + '</div></span>' +
             '<span class="rval">' + (p.photo ? "Photo on file" : "No photo") + '</span>' +
           '</div>';
    });
    h += '</div>';
  });
  return h;
}

/* ---------------- settings ---------------- */
function settingsHTML(){
  var h = '<button class="backbtn" data-act="more_go" data-val="hub">← More</button>' +
          '<h2 class="view">Settings</h2>';

  /* account + role */
  h += '<div class="grouplabel">Account</div><div class="card">' +
       '<div class="kv"><span class="k">Signed in as</span><span class="v">' + esc(ROLE || "—") + '</span></div>' +
       '<div class="kv"><span class="k">Role</span><span class="v">' + esc(ROLE || "—") + '</span></div>' +
       '<div class="chips">' +
         '<button data-act="set_role" data-val="Owner"' + (ROLE === "Owner" ? ' class="on"' : '') + '>Owner</button>' +
         '<button data-act="set_role" data-val="Office"' + (ROLE === "Office" ? ' class="on"' : '') + '>Office</button>' +
       '</div></div>' +
       '<p class="muted small">The Owner sets prices and sends quotes/invoices. The Office sees amounts read-only.</p>';

  /* appearance — Light | Dark only, default Light, never follows the OS */
  h += '<div class="grouplabel">Appearance</div><div class="card">' +
       '<div class="frow"><span class="f">Theme</span>' +
       '<span class="segbtns">' +
         '<button data-act="set_appearance" data-val="light" class="' + (APP_MODE === "light" ? "on" : "") + '">Light</button>' +
         '<button data-act="set_appearance" data-val="dark" class="' + (APP_MODE === "dark" ? "on" : "") + '">Dark</button>' +
       '</span></div></div>' +
       '<p class="muted small">Your choice is remembered on this device.</p>';

  /* data */
  h += '<div class="grouplabel">Data</div><div class="card">' +
       '<div class="kv"><span class="k">Clients</span><span class="v">' + DB.clients.length + '</span></div>' +
       '<div class="kv"><span class="k">Quotes</span><span class="v">' + DB.quotes.length + '</span></div>' +
       '<div class="kv"><span class="k">Jobs</span><span class="v">' + DB.jobs.length + '</span></div>' +
       '<div class="kv"><span class="k">Invoices</span><span class="v">' + DB.invoices.length + '</span></div>' +
       '<div class="kv"><span class="k">Requests</span><span class="v">' + DB.requests.length + '</span></div>';
  if (DB.importInfo) {
    var ci = DB.importInfo.counts || {};
    h += '<div class="kv"><span class="k">Jobber import (data.json)</span><span class="v">Merged ' + fmtDate(DB.importInfo.at) + ' — ' +
           (ci.clients || 0) + ' clients, ' + (ci.quotes || 0) + ' quotes, ' + (ci.jobs || 0) + ' jobs, ' + (ci.invoices || 0) + ' invoices</span></div>';
  } else {
    h += '<div class="kv"><span class="k">Jobber import (data.json)</span><span class="v">No data.json merged yet</span></div>';
  }
  h += '</div>';

  /* backup */
  h += '<div class="grouplabel">Backup</div><div class="card">' +
       '<button class="btn block" data-act="set_export">Export data (JSON)</button>' +
       '<div class="frow fstack"><label class="f" for="set-import">Import a backup</label>' +
       '<input type="file" id="set-import" accept=".json,application/json" onchange="ACTIONS.set_import(this)"></div>' +
       '<div class="okmsg" id="set-ok"></div><div class="err" id="set-err"></div>' +
       '</div>' +
       '<p class="muted small">Data is stored on this device (this browser). Export a backup file regularly — importing a backup replaces the data on this device. Your passcode is never part of the export.</p>';

  /* lock — its own group, last action */
  h += '<div class="listcard">' +
       '<button class="rowitem" data-act="set_lock"><span class="grow"><span class="name">Lock now</span></span></button>' +
       '</div>';

  h += '<p class="muted small" style="text-align:center">SHARMA360 CRM · Sharma Electric &amp; HVAC · data stays on this device<br>Lic. EC13013924 · CAC1823596</p>';
  return h;
}

/* ---------------- view registration ---------------- */
VIEWS.more = function(){
  if (typeof window !== "undefined" && window.CRM_OPEN && window.CRM_OPEN.tab === "more") {
    M.section = window.CRM_OPEN.section || "requests";
    window.CRM_OPEN = null;
  }
  if (M.section === "requests") return requestsHTML();
  if (M.section === "products") return productsHTML();
  if (M.section === "settings") return settingsHTML();
  return hubHTML();
};

/* ---------------- actions: navigation ---------------- */
ACTIONS.more_go = function(el){ M.section = el.getAttribute("data-val") || "hub"; refresh(); if (typeof window !== "undefined" && window.scrollTo) window.scrollTo(0, 0); };

/* ---------------- actions: requests ---------------- */
ACTIONS.req_new = function(){ M.section = "requests"; openForm(requestFormHTML()); };
ACTIONS.req_form_cancel = function(){ exitForm(); };
ACTIONS.req_save = function(){
  var g = function(id){ var el = document.getElementById(id); return el ? el.value.trim() : ""; };
  var name = g("rq-name");
  var err = document.getElementById("rq-err");
  if (!name) { if (err) err.textContent = "Name is required."; return; }
  DB.requests.push({ id: uid("r"), name: name, contact: g("rq-contact"), source: g("rq-source") || "Call",
                     desc: g("rq-desc"), status: "New", createdAt: todayStr() });
  saveDB();
  M.section = "requests";
  exitForm();
};
ACTIONS.req_archive = function(el){
  var r = requestById(el.getAttribute("data-id"));
  if (!r) return;
  r.status = "Archived";
  saveDB();
  refresh();
};
ACTIONS.req_convert = function(el){
  var r = requestById(el.getAttribute("data-id"));
  if (!r || r.status !== "New") return;
  openForm(convertFormHTML(r));
};
ACTIONS.req_convert_save = function(el){
  var r = requestById(el.getAttribute("data-id"));
  if (!r) { exitForm(); return; }
  var g = function(id){ var e = document.getElementById(id); return e ? e.value.trim() : ""; };
  var name = g("cv-name");
  var err = document.getElementById("cv-err");
  if (!name) { if (err) err.textContent = "Client name is required."; return; }
  var client = { id: uid("c"), type: g("cv-type") || "builder", name: name,
                 phone: g("cv-phone"), email: g("cv-email"), billingNotes: "", notes: "",
                 contacts: [], properties: [], source: "Request — " + (r.source || "") };
  DB.clients.push(client);
  if (!DB.seq) DB.seq = { client: 41, quote: 1001, invoice: 1001 };
  var num = "Q-" + (DB.seq.quote++);
  var quote = { id: uid("q"), number: num, clientId: client.id, propertyId: "",
                trade: g("cv-trade") || "Electric", title: r.desc || "", lines: [], totalAmount: 0,
                status: "Draft", createdAt: todayStr(), sentAt: null, approvedAt: null };
  DB.quotes.push(quote);
  r.status = "Converted";
  r.clientId = client.id;
  r.quoteId = quote.id;
  saveDB();
  M.section = "requests";
  exitForm();
};

/* ---------------- actions: products ---------------- */
ACTIONS.prod_q = function(v){ PQ.q = String(v == null ? "" : v); refreshSearch("prod-q"); };
ACTIONS.prod_trade = function(el){ PQ.trade = el.getAttribute("data-val") || "All"; refresh(); };

/* ---------------- actions: settings ---------------- */
ACTIONS.set_role = function(el){
  var r = el.getAttribute("data-val");
  if (r !== "Owner" && r !== "Office") return;
  if (typeof setRole === "function") { setRole(r); }
  else {
    try { ROLE = r; } catch (e) { /* core owns ROLE */ }
    try { sessionStorage.setItem("sharma-crm-role", r); } catch (e) { /* private mode */ }
  }
  refresh();
};
ACTIONS.set_appearance = function(el){
  var mode = el.getAttribute("data-val");
  if (mode !== "light" && mode !== "dark") return; /* Light | Dark only — no Automatic */
  APP_MODE = mode;
  if (typeof setAppearance === "function") { setAppearance(mode); }
  else {
    try { document.documentElement.setAttribute("data-theme", mode); } catch (e) { /* no DOM */ }
    try { localStorage.setItem("sharma-crm-appearance", mode); } catch (e) { /* private mode */ }
  }
  refresh();
};
ACTIONS.set_lock = function(){
  if (typeof lockApp === "function") { lockApp(); return; }
  if (typeof lock === "function") { lock(); }
};
ACTIONS.set_export = function(){
  var data = { clients: DB.clients, quotes: DB.quotes, jobs: DB.jobs, invoices: DB.invoices,
               requests: DB.requests, seq: DB.seq, importInfo: DB.importInfo || null };
  var blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  a.href = url;
  a.download = "sharma-crm-backup-" + todayStr() + ".json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(function(){ URL.revokeObjectURL(url); }, 4000);
};
ACTIONS.set_import = function(input){
  var file = input && input.files && input.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function(){
    var okEl = document.getElementById("set-ok"), errEl = document.getElementById("set-err");
    try {
      var data = JSON.parse(String(reader.result || ""));
      if (!data || !Array.isArray(data.clients) || !Array.isArray(data.quotes)) throw new Error("not a CRM backup");
      if (!confirm("Import this backup? It REPLACES all CRM data on this device.")) return;
      DB.clients = data.clients;
      DB.quotes = data.quotes;
      DB.jobs = Array.isArray(data.jobs) ? data.jobs : [];
      DB.invoices = Array.isArray(data.invoices) ? data.invoices : [];
      DB.requests = Array.isArray(data.requests) ? data.requests : [];
      if (data.seq) DB.seq = data.seq;
      saveDB();
      refresh();
    } catch (e) {
      if (errEl) errEl.textContent = "Import failed: " + e.message;
      else alert("Import failed: " + e.message);
    }
  };
  reader.readAsText(file);
};

})();
