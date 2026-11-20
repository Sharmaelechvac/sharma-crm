/* ============================================================
   SHARMA360 CRM v3 — More module (view-more.js)
   Registers VIEWS.more + ACTIONS.more_* / req_* / prod_* / set_*.
   Sections: hub → Requests, Products & Submittals, Settings.

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
  return '<span class="pill gold">New</span>';
}
function cap(s){ s = String(s || ""); return s.charAt(0).toUpperCase() + s.slice(1); }

/* ---------------- hub ---------------- */
function hubHTML(){
  var newReqs = DB.requests.filter(function(r){ return r.status === "New"; }).length;
  var h = '<h2 class="view">More</h2>';
  h += '<button class="rowitem" data-act="more_go" data-val="requests"><span class="grow">' +
         '<span class="name">Requests</span><div class="meta">New work in — convert to a client + draft quote</div></span>' +
         (newReqs ? '<span class="pill gold">' + newReqs + ' new</span>' : '') + '<span class="chev">›</span></button>';
  h += '<button class="rowitem" data-act="more_go" data-val="products"><span class="grow">' +
         '<span class="name">Products &amp; Submittals</span><div class="meta">Submittal library — ' + PRODUCTS.length + ' products</div></span>' +
         '<span class="chev">›</span></button>';
  h += '<button class="rowitem" data-act="more_go" data-val="settings"><span class="grow">' +
         '<span class="name">Settings</span><div class="meta">Role, lock, Jobber import, backup export / import</div></span>' +
         '<span class="chev">›</span></button>';
  return h;
}

/* ---------------- requests ---------------- */
function requestsHTML(){
  var h = '<button class="backbtn" data-act="more_go" data-val="hub">← More</button>' +
          '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">' +
          '<h2 class="view" style="margin:0">Requests</h2>' +
          '<button class="btn gold" data-act="req_new">＋ New Request</button></div><div style="height:10px"></div>';
  if (!DB.requests.length) {
    h += '<div class="empty">No requests yet. New work from Bid Boards, the Lead Finder, phone calls and the picker lands here — then converts to a client + draft quote in one tap.</div>';
    return h;
  }
  var order = { "New": 0, "Converted": 1, "Archived": 2 };
  var list = DB.requests.slice().sort(function(a, b){
    return ((order[a.status] || 0) - (order[b.status] || 0)) ||
           String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
  });
  list.forEach(function(r){
    var desc = r.desc || r.description || "";
    h += '<div class="rowitem"><span class="grow">' +
           '<span class="name">' + esc(r.name) + '</span>' +
           '<div class="meta"><span class="badge">' + esc(r.source || "—") + '</span> ' +
             fmtDate(r.createdAt) +
             (r.contact ? ' · ' + esc(r.contact) : '') +
             (desc ? '<br>' + esc(desc) : '') +
           '</div></span>' +
           requestPill(r.status) + '</div>';
    if (r.status === "New") {
      h += '<div style="display:flex;gap:8px;margin:-4px 0 12px">' +
             '<button class="btn" data-act="req_convert" data-id="' + r.id + '">Convert to client + draft quote</button>' +
             '<button class="btn ghost" data-act="req_archive" data-id="' + r.id + '">Archive</button>' +
           '</div>';
    }
  });
  return h;
}
function requestFormHTML(){
  return '<button class="backbtn" data-act="req_form_cancel">← Cancel</button>' +
    '<h2 class="view">New Request</h2><div class="card">' +
    '<label class="f">Name *</label><input type="text" id="rq-name" placeholder="Builder, homeowner, GC…">' +
    '<label class="f">Phone or email</label><input type="text" id="rq-contact">' +
    '<label class="f">Source</label><select id="rq-source">' +
      REQ_SOURCES.map(function(s){ return '<option value="' + s + '">' + s + '</option>'; }).join("") + '</select>' +
    '<label class="f">What do they need?</label><textarea id="rq-desc" placeholder="Scope, address, timing…"></textarea>' +
    '<div class="err" id="rq-err"></div>' +
    '<button class="btn gold block" data-act="req_save">Save request</button>' +
    '<button class="btn ghost block" data-act="req_form_cancel">Cancel</button></div>';
}
function convertFormHTML(r){
  var contact = r.contact || "";
  var isEmail = contact.indexOf("@") !== -1;
  return '<button class="backbtn" data-act="req_form_cancel">← Cancel</button>' +
    '<h2 class="view">Convert request</h2><div class="card">' +
    '<p class="muted">Creates a client and an empty, unpriced Draft quote shell. Prices are added later — by the Owner.</p>' +
    '<label class="f">Client name *</label><input type="text" id="cv-name" value="' + esc(r.name) + '">' +
    '<label class="f">Client type</label><select id="cv-type">' +
      '<option value="builder">Builder</option><option value="homeowner">Homeowner</option><option value="commercial">Commercial</option></select>' +
    (isEmail
      ? '<label class="f">Email</label><input type="email" id="cv-email" value="' + esc(contact) + '">'
      : '<label class="f">Phone</label><input type="tel" id="cv-phone" value="' + esc(contact) + '">') +
    '<label class="f">Quote trade</label><select id="cv-trade">' +
      '<option value="Electric">Electric</option><option value="HVAC">HVAC</option></select>' +
    '<div class="err" id="cv-err"></div>' +
    '<button class="btn gold block" data-act="req_convert_save" data-id="' + r.id + '">Create client + draft quote</button>' +
    '<button class="btn ghost block" data-act="req_form_cancel">Cancel</button></div>';
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
    h += '<div class="empty">No products match this search.</div>';
    return h;
  }
  order.forEach(function(cat){
    h += '<div class="cathead">' + esc(cap(cat)) + ' (' + groups[cat].length + ')</div>';
    groups[cat].forEach(function(p){
      var meta = [];
      if (p.brand) meta.push(esc(p.brand));
      if (p.model) meta.push("Model " + esc(p.model));
      meta.push(p.trade === "hvac" ? "HVAC" : "Electrical");
      h += '<div class="rowitem"><span class="grow"><span class="name">' + esc(p.name) + '</span>' +
             '<div class="meta">' + meta.join(" · ") + '</div></span>' +
             (p.photo ? '<span class="badge gold">Photo on file</span>' : '<span class="badge">No photo</span>') +
           '</div>';
    });
  });
  return h;
}

/* ---------------- settings ---------------- */
function settingsHTML(){
  var h = '<button class="backbtn" data-act="more_go" data-val="hub">← More</button>' +
          '<h2 class="view">Settings</h2><div class="card">' +
          '<div class="kv"><span class="k">Signed in as</span><span class="v">' + esc(ROLE || "—") + '</span></div>' +
          '<div class="kv"><span class="k">Clients</span><span class="v">' + DB.clients.length + '</span></div>' +
          '<div class="kv"><span class="k">Quotes / Jobs / Invoices</span><span class="v">' + DB.quotes.length + ' / ' + DB.jobs.length + ' / ' + DB.invoices.length + '</span></div>' +
          '<div class="kv"><span class="k">Requests</span><span class="v">' + DB.requests.length + '</span></div>';
  if (DB.importInfo) {
    var ci = DB.importInfo.counts || {};
    h += '<div class="kv"><span class="k">Jobber import (data.json)</span><span class="v">Merged ' + fmtDate(DB.importInfo.at) + ' — ' +
           (ci.clients || 0) + ' clients, ' + (ci.quotes || 0) + ' quotes, ' + (ci.jobs || 0) + ' jobs, ' + (ci.invoices || 0) + ' invoices</span></div>';
  } else {
    h += '<div class="kv"><span class="k">Jobber import (data.json)</span><span class="v">No data.json merged yet</span></div>';
  }
  h += '<h3 class="sec">Role</h3>' +
       '<p class="muted small">The Owner sets prices and sends quotes/invoices. The Office sees amounts read-only.</p>' +
       '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
         '<button class="btn' + (ROLE === "Owner" ? " gold" : " ghost") + '" data-act="set_role" data-val="Owner">Owner</button>' +
         '<button class="btn' + (ROLE === "Office" ? " gold" : " ghost") + '" data-act="set_role" data-val="Office">Office</button>' +
       '</div>' +
       '<button class="btn red block" data-act="set_lock" style="margin-top:14px">🔒 Lock now</button>' +
       '</div>';

  h += '<div class="card"><h3 class="sec" style="margin-top:0">Backup</h3>' +
       '<p class="muted small">Data is stored on this device (this browser). Export a backup file regularly — importing a backup replaces the data on this device. Your passcode is never part of the export.</p>' +
       '<button class="btn block" data-act="set_export">⬇ Export data (JSON)</button>' +
       '<label class="f">Import a backup</label>' +
       '<input type="file" id="set-import" accept=".json,application/json" onchange="ACTIONS.set_import(this)">' +
       '<div class="okmsg" id="set-ok"></div><div class="err" id="set-err"></div>' +
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
