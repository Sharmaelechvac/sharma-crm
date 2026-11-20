/* ============================================================
   SHARMA360 CRM v3 — Jobs module (view-jobs.js)
   Registers VIEWS.jobs + ACTIONS.job_*.
   Jobber-style: searchable/filterable job list, "+ New Job" create
   form (from scratch, not only from quotes), job detail with the
   5-stage Sharma tracker (TUG → Underground → Rough-in → Trim →
   Final), amounts, and a hand-off into the invoice maker.

   Conventions used (see V3-CONTRACT.md):
   - Clicks: data-act="job_*" (core delegation). Inputs/selects use
     inline oninput/onchange -> ACTIONS.job_* because core's
     delegation is click-only.
   - Forms go through core's openForm(html); leaving a form tries
     closeForm() if core provides it, else re-renders the tab.
   - Cross-module open: window.CRM_OPEN = { tab:"jobs", id } is
     consumed here on render (Home sets it for job rows).
   - Invoice maker hand-off: "Create invoice from this job" sets
     window.CRM_PRESELECT_INVOICE_JOB = <jobId>, then calls
     ACTIONS.invoice_new / ACTIONS.inv_new if the invoices module
     registered one, else navigates to the Invoices tab. The
     invoices module should read CRM_PRESELECT_INVOICE_JOB when its
     maker opens.
   ============================================================ */
(function(){
"use strict";

/* ---------------- module state ---------------- */
var S = { q: "", filter: "All", sort: "new", sel: null };
var JF = null; /* job form state: {id, clientId, propertyId, trade, title, amount, date} */

/* ---------------- small local helpers ---------------- */
function refresh(){ if (typeof render === "function") render(); }
function navTo(tab){
  var el = document.querySelector('[data-nav="' + tab + '"]');
  if (el) { el.click(); return; }
  if (typeof go === "function") { go(tab); return; }
  refresh();
}
function exitForm(tab){
  if (typeof closeForm === "function") { closeForm(); refresh(); return; }
  navTo(tab);
}
function refreshSearch(inputId){
  refresh();
  var el = document.getElementById(inputId);
  if (el) { el.focus(); var v = el.value; el.value = ""; el.value = v; }
}
function stagesDone(j){
  return STAGES.filter(function(st){
    return j.stages && j.stages[st.key] && j.stages[st.key].status === "done";
  }).length;
}
function stagePill(st){
  if (st === "done") return '<span class="pill green">Done</span>';
  if (st === "sched") return '<span class="pill gold">Scheduled</span>';
  return '<span class="pill grey">Not started</span>';
}
function jobTitle(j){
  if (j.title) return j.title;
  var c = clientById(j.clientId);
  return (c ? c.name : "Unknown client") + " · " + j.trade;
}
function initials(name){
  var parts = String(name || "?").trim().split(/\s+/);
  return ((parts[0] || "?").charAt(0) + (parts.length > 1 ? parts[parts.length - 1].charAt(0) : "")).toUpperCase();
}
function sortedClients(){
  return DB.clients.slice().sort(function(a, b){ return a.name.localeCompare(b.name); });
}

/* ---------------- list ---------------- */
function filteredJobs(){
  var q = S.q.trim().toLowerCase();
  var list = DB.jobs.filter(function(j){
    var st = jobDisplayStatus(j);
    if (S.filter !== "All" && st !== S.filter) return false;
    if (!q) return true;
    var c = clientById(j.clientId);
    var quote = j.quoteId ? quoteById(j.quoteId) : null;
    var hay = [
      j.title || "", c ? c.name : "", j.trade || "",
      j.jobberNumber || "", quote ? quote.number : "",
      propertyLabel(c, j.propertyId)
    ].join(" ").toLowerCase();
    return hay.indexOf(q) !== -1;
  });
  list.sort(function(a, b){
    if (S.sort === "old") return String(a.createdAt || "").localeCompare(String(b.createdAt || ""));
    if (S.sort === "amt-desc") return jobAmount(b) - jobAmount(a);
    if (S.sort === "amt-asc") return jobAmount(a) - jobAmount(b);
    if (S.sort === "client") {
      var ca = clientById(a.clientId), cb = clientById(b.clientId);
      return ((ca ? ca.name : "")).localeCompare(cb ? cb.name : "");
    }
    return String(b.createdAt || "").localeCompare(String(a.createdAt || "")); /* new */
  });
  return list;
}

function listHTML(){
  var list = filteredJobs();
  var h = '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">' +
          '<h2 class="view" style="margin:0">Jobs</h2>' +
          '<button class="btn gold" data-act="job_new">＋ New Job</button></div>';

  /* toolbar */
  h += '<div class="card" style="margin-top:12px">' +
         '<input type="text" id="job-q" placeholder="Search title, client, Jobber #…" value="' + esc(S.q) + '" oninput="ACTIONS.job_q(this.value)">' +
         '<div class="chips">' +
           ["All", "Active", "Late", "Completed"].map(function(f){
             return '<button data-act="job_filter" data-val="' + f + '"' + (S.filter === f ? ' class="on"' : '') + '>' + f + '</button>';
           }).join("") +
         '</div>' +
         '<label class="f">Sort</label>' +
         '<select id="job-sort" onchange="ACTIONS.job_sort(this.value)">' +
           '<option value="new"' + (S.sort === "new" ? " selected" : "") + '>Newest first</option>' +
           '<option value="old"' + (S.sort === "old" ? " selected" : "") + '>Oldest first</option>' +
           '<option value="amt-desc"' + (S.sort === "amt-desc" ? " selected" : "") + '>Amount: high to low</option>' +
           '<option value="amt-asc"' + (S.sort === "amt-asc" ? " selected" : "") + '>Amount: low to high</option>' +
           '<option value="client"' + (S.sort === "client" ? " selected" : "") + '>Client A–Z</option>' +
         '</select>' +
         '<p class="muted small" style="margin:10px 0 0">' + list.length + ' of ' + DB.jobs.length + ' jobs</p>' +
       '</div>';

  if (DB.jobs.length === 0) {
    h += '<div class="empty">No jobs yet. Jobs are created by converting an approved quote — or tap ＋ New Job to start one from scratch.</div>';
    return h;
  }
  if (list.length === 0) {
    h += '<div class="empty">No jobs match this search or filter.</div>';
    return h;
  }

  list.forEach(function(j){
    var c = clientById(j.clientId);
    var amt = jobAmount(j), invd = jobInvoiced(j);
    var meta = [];
    if (c) meta.push(esc(c.name));
    if (j.jobberNumber) meta.push("Jobber #" + esc(j.jobberNumber));
    var pl = propertyLabel(c, j.propertyId);
    if (pl && pl !== "No property selected") meta.push(esc(pl));
    meta.push(stagesDone(j) + " of 5 stages done");
    if (j.createdAt) meta.push("Started " + fmtDate(j.createdAt));
    h += '<button class="rowitem" data-act="job_open" data-id="' + j.id + '">' +
           '<span class="avatar">' + esc(initials(c ? c.name : "?")) + '</span>' +
           '<span class="grow"><span class="name">' + esc(jobTitle(j)) + '</span>' +
           '<div class="meta">' + meta.join(" · ") + '</div></span>' +
           '<span style="text-align:right"><span class="amt">' + money(amt) + '</span>' +
           '<div class="meta">invoiced ' + money(invd) + '</div></span>' +
           jobPill(j) + '<span class="chev">›</span></button>';
  });
  return h;
}

/* ---------------- detail ---------------- */
function detailHTML(j){
  var c = clientById(j.clientId);
  var q = j.quoteId ? quoteById(j.quoteId) : null;
  var amt = jobAmount(j), invd = jobInvoiced(j), left = Math.max(0, amt - invd);
  var h = '<button class="backbtn" data-act="job_back">← All jobs</button>';

  /* header card */
  h += '<div class="card"><div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap">' +
         '<div><div style="font-size:1.25rem;font-weight:800">' + esc(jobTitle(j)) + '</div>' +
         '<div class="muted">' + esc(c ? c.name : "Unknown client") +
           (propertyLabel(c, j.propertyId) !== "No property selected" ? ' · ' + esc(propertyLabel(c, j.propertyId)) : '') + '</div></div>' +
         jobPill(j) + '</div>' +
       '<div class="stats" style="margin-top:14px">' +
         '<div class="stat"><div class="n" style="font-size:1.3rem">' + money(amt) + '</div><div class="l">Job amount</div></div>' +
         '<div class="stat"><div class="n" style="font-size:1.3rem">' + money(invd) + '</div><div class="l">Invoiced so far</div></div>' +
         '<div class="stat"><div class="n" style="font-size:1.3rem">' + money(left) + '</div><div class="l">Left to invoice</div></div>' +
         '<div class="stat"><div class="n" style="font-size:1.3rem">' + stagesDone(j) + ' / 5</div><div class="l">Stages done</div></div>' +
       '</div>' +
       '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px">' +
         '<button class="btn gold" data-act="job_invoice" data-id="' + j.id + '">＋ Create invoice from this job</button>' +
         '<button class="btn" data-act="job_edit" data-id="' + j.id + '">Edit job</button>' +
         '<button class="btn ghost del" data-act="job_delete" data-id="' + j.id + '">Delete</button>' +
       '</div></div>';

  h += '<div class="grid2" style="align-items:start"><div>';

  /* stage tracker */
  h += '<div class="card"><h3 class="sec" style="margin-top:0">Stage tracker — ' + esc(j.trade) + '</h3>';
  STAGES.forEach(function(s){
    var cur = (j.stages && j.stages[s.key]) || { status: "not", date: "" };
    h += '<div class="stage"><div class="top"><span class="nm">' + s.label + '</span>' + stagePill(cur.status) + '</div>' +
           '<div class="segbtns">' +
             '<button data-act="job_stage" data-id="' + j.id + '" data-stage="' + s.key + '" data-val="not" class="' + (cur.status === "not" ? "on-not" : "") + '">Not started</button>' +
             '<button data-act="job_stage" data-id="' + j.id + '" data-stage="' + s.key + '" data-val="sched" class="' + (cur.status === "sched" ? "on-sched" : "") + '">Scheduled</button>' +
             '<button data-act="job_stage" data-id="' + j.id + '" data-stage="' + s.key + '" data-val="done" class="' + (cur.status === "done" ? "on-done" : "") + '">Done</button>' +
           '</div>' +
           '<input type="date" data-id="' + j.id + '" data-stage="' + s.key + '" value="' + esc(cur.date || "") + '" aria-label="' + s.label + ' date" onchange="ACTIONS.job_stage_date(this)">' +
         '</div>';
  });
  h += '<p class="muted small">Marking Final “Done” completes the job.</p></div>';

  /* invoices for this job */
  var invs = DB.invoices.filter(function(i){ return i.jobId === j.id; });
  h += '<div class="card"><h3 class="sec" style="margin-top:0">Invoices for this job (' + invs.length + ')</h3>';
  if (!invs.length) {
    h += '<div class="empty">No invoices yet for this job.</div>';
  } else {
    invs.forEach(function(inv){
      h += '<button class="rowitem" data-act="job_open_invoice" data-id="' + inv.id + '">' +
             '<span class="grow"><span class="name">' + inv.number + '</span>' +
             '<div class="meta">' + fmtDate(inv.createdAt) + ' · balance ' + money(invoiceBalance(inv)) + '</div></span>' +
             '<span class="amt">' + money(inv.amount) + '</span>' + invoicePill(inv) + '<span class="chev">›</span></button>';
    });
  }
  h += '</div></div>';

  /* side: job info card */
  h += '<div><div class="card"><h3 class="sec" style="margin-top:0">Job info</h3>' +
         '<div class="kv"><span class="k">Client</span><span class="v">' + esc(c ? c.name : "—") + '</span></div>' +
         '<div class="kv"><span class="k">Property</span><span class="v">' + esc(propertyLabel(c, j.propertyId)) + '</span></div>' +
         '<div class="kv"><span class="k">Trade</span><span class="v">' + esc(j.trade) + '</span></div>' +
         (j.jobberNumber ? '<div class="kv"><span class="k">Jobber job #</span><span class="v">' + esc(j.jobberNumber) + '</span></div>' : '') +
         (q ? '<div class="kv"><span class="k">From quote</span><span class="v">' + esc(q.number) + '</span></div>' : '') +
         '<div class="kv"><span class="k">Started</span><span class="v">' + fmtDate(j.createdAt) + '</span></div>' +
         '<div class="kv"><span class="k">Status</span><span class="v">' + jobDisplayStatus(j) + '</span></div>' +
       '</div>';

  /* side: client money card */
  if (c) {
    var cm = clientMoney(c.id);
    h += '<div class="card"><h3 class="sec" style="margin-top:0">' + esc(c.name) + ' — money</h3>' +
           '<div class="kv"><span class="k">Quoted</span><span class="v">' + money(cm.quoted) + '</span></div>' +
           '<div class="kv"><span class="k">Invoiced</span><span class="v">' + money(cm.invoiced) + '</span></div>' +
           '<div class="kv"><span class="k">Paid</span><span class="v">' + money(cm.paid) + '</span></div>' +
           '<div class="kv"><span class="k">Balance owed</span><span class="v">' + money(cm.owed) + '</span></div>' +
         '</div>';
  }
  h += '</div></div>';
  return h;
}

/* ---------------- create / edit form ---------------- */
function formHTML(){
  var editing = !!JF.id;
  var c = JF.clientId ? clientById(JF.clientId) : null;
  var props = c ? (c.properties || []) : [];
  var h = '<button class="backbtn" data-act="job_form_cancel">← Cancel</button>' +
          '<h2 class="view">' + (editing ? "Edit job" : "New Job") + '</h2>' +
          '<div class="card">' +
          '<label class="f">Client *</label>' +
          '<select id="jf-client" onchange="ACTIONS.job_form_client(this)">' +
            '<option value="">— Choose a client —</option>' +
            sortedClients().map(function(cl){
              return '<option value="' + cl.id + '"' + (JF.clientId === cl.id ? " selected" : "") + '>' + esc(cl.name) + '</option>';
            }).join("") +
          '</select>' +
          '<label class="f">Property</label>' +
          '<select id="jf-property">' +
            '<option value="">No property selected</option>' +
            props.map(function(p){
              return '<option value="' + p.id + '"' + (JF.propertyId === p.id ? " selected" : "") + '>' + esc(propertyLabel(c, p.id)) + '</option>';
            }).join("") +
          '</select>' +
          '<label class="f">Trade *</label>' +
          '<select id="jf-trade">' +
            '<option value="Electric"' + (JF.trade === "Electric" ? " selected" : "") + '>Electric</option>' +
            '<option value="HVAC"' + (JF.trade === "HVAC" ? " selected" : "") + '>HVAC</option>' +
          '</select>' +
          '<label class="f">Job title</label>' +
          '<input type="text" id="jf-title" placeholder="e.g. Rough-in — Lot 12, Bella Collina" value="' + esc(JF.title || "") + '">';
  if (JF.quoteId) {
    var qj = JF.id ? jobById(JF.id) : null;
    h += '<label class="f">Job amount</label>' +
         '<div class="kv"><span class="v">' + money(qj ? jobAmount(qj) : 0) + '</span></div>' +
         '<p class="muted small">This job\'s amount comes from its quote — edit the quote to change it.</p>';
  } else if (isOwner()) {
    h += '<label class="f">Job amount ($)</label>' +
         '<input type="number" id="jf-amount" min="0" step="0.01" inputmode="decimal" value="' + (JF.amount != null && JF.amount !== "" ? esc(JF.amount) : "") + '">';
  } else {
    h += '<label class="f">Job amount</label>' +
         '<div class="kv"><span class="v">' + money(JF.amount || 0) + '</span></div>' +
         '<p class="muted small">Only the Owner can set or change amounts. The Office can create the job — the Owner adds the amount.</p>';
  }
  h += '<label class="f">Start date</label>' +
       '<input type="date" id="jf-date" value="' + esc(JF.date || todayStr()) + '">' +
       '<div class="err" id="jf-err"></div>' +
       '<button class="btn gold block" data-act="job_save">' + (editing ? "Save changes" : "Create job") + '</button>' +
       '<button class="btn ghost block" data-act="job_form_cancel">Cancel</button>' +
       '</div>';
  return h;
}
function captureForm(){
  var g = function(id){ var el = document.getElementById(id); return el ? el.value : ""; };
  JF.clientId = g("jf-client") || JF.clientId;
  JF.propertyId = g("jf-property") || "";
  JF.trade = g("jf-trade") || JF.trade;
  JF.title = g("jf-title");
  if (isOwner()) JF.amount = g("jf-amount");
  JF.date = g("jf-date") || JF.date;
}

/* ---------------- view registration ---------------- */
VIEWS.jobs = function(){
  if (typeof window !== "undefined" && window.CRM_OPEN && window.CRM_OPEN.tab === "jobs") {
    S.sel = window.CRM_OPEN.id; window.CRM_OPEN = null;
  }
  if (S.sel) {
    var j = jobById(S.sel);
    if (j) return detailHTML(j);
    S.sel = null;
  }
  return listHTML();
};

/* ---------------- actions ---------------- */
ACTIONS.job_q = function(v){ S.q = String(v == null ? "" : v); refreshSearch("job-q"); };
ACTIONS.job_filter = function(el){ S.filter = el.getAttribute("data-val") || "All"; refresh(); };
ACTIONS.job_sort = function(v){ S.sort = String(v || "new"); refresh(); };
ACTIONS.job_open = function(el){ S.sel = el.getAttribute("data-id"); refresh(); if (typeof window !== "undefined" && window.scrollTo) window.scrollTo(0, 0); };
ACTIONS.job_back = function(){ S.sel = null; refresh(); };
ACTIONS.job_open_invoice = function(el){
  if (typeof window !== "undefined") window.CRM_OPEN = { tab: "invoices", id: el.getAttribute("data-id") };
  navTo("invoices");
};
ACTIONS.job_new = function(){
  JF = { id: null, quoteId: "", clientId: "", propertyId: "", trade: "Electric", title: "", amount: "", date: todayStr() };
  openForm(formHTML());
};
ACTIONS.job_edit = function(el){
  var j = jobById(el.getAttribute("data-id"));
  if (!j) return;
  JF = { id: j.id, quoteId: j.quoteId || "", clientId: j.clientId || "", propertyId: j.propertyId || "", trade: j.trade || "Electric",
         title: j.title || "", amount: (j.quoteId ? "" : (j.amount != null ? j.amount : "")), date: j.createdAt || todayStr() };
  openForm(formHTML());
};
ACTIONS.job_form_client = function(){
  captureForm();
  JF.propertyId = "";
  openForm(formHTML());
};
ACTIONS.job_form_cancel = function(){ JF = null; exitForm("jobs"); };
ACTIONS.job_save = function(){
  captureForm();
  var err = document.getElementById("jf-err");
  if (!JF.clientId) { if (err) err.textContent = "Choose a client first."; return; }
  var amt = isOwner() ? (parseFloat(JF.amount) || 0) : null;
  var j;
  if (JF.id) {
    j = jobById(JF.id);
    if (!j) { JF = null; exitForm("jobs"); return; }
    j.clientId = JF.clientId;
    j.propertyId = JF.propertyId || "";
    j.trade = JF.trade || "Electric";
    j.title = JF.title || "";
    if (amt != null && !j.quoteId) j.amount = amt;
    if (JF.date) j.createdAt = JF.date;
  } else {
    j = { id: uid("j"), quoteId: "", clientId: JF.clientId, propertyId: JF.propertyId || "",
          trade: JF.trade || "Electric", title: JF.title || "", jobberNumber: "",
          amount: amt != null ? amt : 0, createdAt: JF.date || todayStr(),
          stages: blankStages(), status: "Active", lateFlag: false };
    DB.jobs.push(j);
  }
  saveDB();
  S.sel = j.id;
  JF = null;
  exitForm("jobs");
};
ACTIONS.job_delete = function(el){
  var j = jobById(el.getAttribute("data-id"));
  if (!j) return;
  if (!confirm("Delete this job (" + jobTitle(j) + ")? This cannot be undone.")) return;
  DB.jobs = DB.jobs.filter(function(x){ return x.id !== j.id; });
  saveDB();
  if (S.sel === j.id) S.sel = null;
  refresh();
};
ACTIONS.job_stage = function(el){
  var j = jobById(el.getAttribute("data-id"));
  if (!j) return;
  var key = el.getAttribute("data-stage"), val = el.getAttribute("data-val");
  if (!j.stages) j.stages = blankStages();
  if (!j.stages[key]) j.stages[key] = { status: "not", date: "" };
  j.stages[key].status = val;
  if (key === "final") j.status = (val === "done") ? "Completed" : "Active";
  saveDB();
  refresh();
};
ACTIONS.job_stage_date = function(el){
  var j = jobById(el.getAttribute("data-id"));
  if (!j) return;
  var key = el.getAttribute("data-stage");
  if (!j.stages) j.stages = blankStages();
  if (!j.stages[key]) j.stages[key] = { status: "not", date: "" };
  j.stages[key].date = el.value || "";
  saveDB();
  refresh();
};
ACTIONS.job_invoice = function(el){
  var id = el.getAttribute("data-id");
  if (typeof window !== "undefined") window.CRM_PRESELECT_INVOICE_JOB = id;
  var fn = ACTIONS.invoice_new || ACTIONS.inv_new;
  if (typeof fn === "function") { fn(el); return; }
  navTo("invoices");
};

})();
