/* ============================================================
   SHARMA360 CRM v4 — Jobs module (view-jobs.js)
   Registers VIEWS.jobs + ACTIONS.job_*.
   Apple-design restyle of the v3 module: grouped inset lists
   (§9.3 rows: title / client · property · date subtitle /
   amount-over-pill trailing column, no chevron with pill),
   §9.4 detail header + grouped stat card, stage tracker as a
   grouped list with in-row segmented control + date pill,
   §9.5 grouped form rows, §5.9 empty states.
   All data logic, action names and cross-module conventions
   (CRM_OPEN, CRM_PRESELECT_INVOICE_JOB) are unchanged from v3.

   New class hooks introduced (for style.css): .grouplabel,
   .trail, .dtitle, .frow, .fctl, .fval, .cur, input.money,
   input.datepill. Existing hooks reused: .listcard, .rowitem,
   .stats/.stat/.n/.l, .kv/.k/.v, .stage/.top/.nm/.segbtns,
   .chips, .empty/.empty-ic, .pill (core jobPill/invoicePill).

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
function jobTitle(j){
  if (j.title) return j.title;
  var c = clientById(j.clientId);
  return (c ? c.name : "Unknown client") + " · " + j.trade;
}
function sortedClients(){
  return DB.clients.slice().sort(function(a, b){ return a.name.localeCompare(b.name); });
}

/* ---------------- list ---------------- */
function filteredJobs(){
  var q = S.q.trim().toLowerCase();
  var list = DB.jobs.filter(function(j){
    if (recArchived(j)) return false;
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

function jobRowHTML(j){
  var c = clientById(j.clientId);
  var sub = [];
  if (c) sub.push(esc(c.name));
  var pl = propertyLabel(c, j.propertyId);
  if (pl && pl !== "No property selected") sub.push(esc(pl));
  if (j.jobberNumber) sub.push("Jobber #" + esc(j.jobberNumber));
  var meta = [];
  if (j.createdAt) meta.push("Started " + fmtDate(j.createdAt));
  meta.push(stagesDone(j) + " of 5 stages done");
  meta.push("Invoiced " + money(jobInvoiced(j)));
  return '<button class="rowitem" data-act="job_open" data-id="' + j.id + '">' +
           '<span class="grow"><span class="name">' + esc(jobTitle(j)) + '</span>' +
           (sub.length ? '<div class="meta">' + sub.join(" · ") + '</div>' : '') +
           '<div class="meta">' + meta.join(" · ") + '</div></span>' +
           '<span class="trail"><span class="amt">' + money(jobAmount(j)) + '</span>' +
           jobPill(j) + '</span></button>';
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
         '<div class="frow"><label class="f" for="job-sort">Sort</label>' +
         '<span class="fctl"><select id="job-sort" onchange="ACTIONS.job_sort(this.value)">' +
           '<option value="new"' + (S.sort === "new" ? " selected" : "") + '>Newest first</option>' +
           '<option value="old"' + (S.sort === "old" ? " selected" : "") + '>Oldest first</option>' +
           '<option value="amt-desc"' + (S.sort === "amt-desc" ? " selected" : "") + '>Amount: high to low</option>' +
           '<option value="amt-asc"' + (S.sort === "amt-asc" ? " selected" : "") + '>Amount: low to high</option>' +
           '<option value="client"' + (S.sort === "client" ? " selected" : "") + '>Client A–Z</option>' +
         '</select></span></div>' +
         '<p class="muted small" style="margin:10px 0 0">' + list.length + ' of ' + DB.jobs.filter(function(x){ return !recArchived(x); }).length + ' jobs</p>' +
       '</div>';

  if (DB.jobs.length === 0) {
    h += '<div class="empty"><div class="empty-ic">▤</div><h3>No Jobs Yet</h3>' +
         '<p class="muted">Jobs are created by converting an approved quote — or start one from scratch.</p>' +
         '<button class="btn gold" data-act="job_new">＋ New Job</button></div>';
    return h;
  }
  if (list.length === 0) {
    h += '<div class="empty"><div class="empty-ic">⌕</div><h3>No Matching Jobs</h3>' +
         '<p class="muted">No jobs match this search or filter.</p></div>';
    return h;
  }

  if (S.filter === "All") {
    /* group by status with footnote group headers (§9.3 grouping) */
    ["Late", "Active", "Completed"].forEach(function(st){
      var g = list.filter(function(j){ return jobDisplayStatus(j) === st; });
      if (!g.length) return;
      h += '<div class="grouplabel">' + st + ' · ' + g.length + '</div>' +
           '<div class="listcard">' + g.map(jobRowHTML).join("") + '</div>';
    });
  } else {
    h += '<div class="listcard">' + list.map(jobRowHTML).join("") + '</div>';
  }
  return h;
}

/* ---------------- detail ---------------- */
function detailHTML(j){
  var c = clientById(j.clientId);
  var q = j.quoteId ? quoteById(j.quoteId) : null;
  var amt = jobAmount(j), invd = jobInvoiced(j), left = Math.max(0, amt - invd);
  var h = '<button class="backbtn" data-act="job_back">← All jobs</button>';

  /* header group (§9.4): status pill + number, title, subline, amounts group */
  h += '<div class="card">' +
         '<div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap">' +
           jobPill(j) +
           (j.jobberNumber ? '<span class="muted small">Jobber #' + esc(j.jobberNumber) + '</span>' : '') +
         '</div>' +
         '<div class="dtitle">' + esc(jobTitle(j)) + '</div>' +
         '<div class="muted">' + esc(c ? c.name : "Unknown client") +
           (propertyLabel(c, j.propertyId) !== "No property selected" ? ' · ' + esc(propertyLabel(c, j.propertyId)) : '') + '</div>' +
         '<div class="stats">' +
           '<div class="stat"><div class="n">' + money(amt) + '</div><div class="l">Job amount</div></div>' +
           '<div class="stat"><div class="n">' + money(invd) + '</div><div class="l">Invoiced so far</div></div>' +
           '<div class="stat"><div class="n">' + money(left) + '</div><div class="l">Left to invoice</div></div>' +
         '</div>' +
         '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
           '<button class="btn gold" data-act="job_invoice" data-id="' + j.id + '">＋ Create invoice from this job</button>' +
           '<button class="btn" data-act="job_edit" data-id="' + j.id + '">Edit job</button>' +
         '</div>' +
       '</div>';

  h += '<div class="grid2" style="align-items:start"><div>';

  /* stage tracker — grouped list, one row per stage (§9.4) */
  h += '<div class="grouplabel">Stage tracker — ' + esc(j.trade) + '</div>' +
       '<div class="card">';
  STAGES.forEach(function(s){
    var cur = (j.stages && j.stages[s.key]) || { status: "not", date: "" };
    h += '<div class="stage"><div class="top"><span class="nm">' + s.label + '</span>' +
           '<input type="date" class="datepill" data-id="' + j.id + '" data-stage="' + s.key + '" value="' + esc(cur.date || "") + '" aria-label="' + s.label + ' date" onchange="ACTIONS.job_stage_date(this)">' +
           '</div>' +
           '<div class="segbtns">' +
             '<button data-act="job_stage" data-id="' + j.id + '" data-stage="' + s.key + '" data-val="not" class="' + (cur.status === "not" ? "on-not" : "") + '">Not started</button>' +
             '<button data-act="job_stage" data-id="' + j.id + '" data-stage="' + s.key + '" data-val="sched" class="' + (cur.status === "sched" ? "on-sched" : "") + '">Scheduled</button>' +
             '<button data-act="job_stage" data-id="' + j.id + '" data-stage="' + s.key + '" data-val="done" class="' + (cur.status === "done" ? "on-done" : "") + '">Done</button>' +
           '</div>' +
         '</div>';
  });
  h += '<p class="muted small">Marking Final “Done” completes the job.</p></div>';

  /* invoices for this job */
  var invs = DB.invoices.filter(function(i){ return i.jobId === j.id; });
  h += '<div class="grouplabel">Invoices for this job · ' + invs.length + '</div><div class="card">';
  if (!invs.length) {
    h += '<div class="empty"><div class="empty-ic">▤</div><h3>No Invoices Yet</h3>' +
         '<p class="muted">No invoices yet for this job.</p>' +
         '<button class="btn" data-act="job_invoice" data-id="' + j.id + '">＋ Create invoice</button></div>';
  } else {
    invs.forEach(function(inv){
      h += '<button class="rowitem" data-act="job_open_invoice" data-id="' + inv.id + '">' +
             '<span class="grow"><span class="name">' + inv.number + '</span>' +
             '<div class="meta">' + fmtDate(inv.createdAt) + ' · balance ' + money(invoiceBalance(inv)) + '</div></span>' +
             '<span class="trail"><span class="amt">' + money(inv.amount) + '</span>' + invoicePill(inv) + '</span></button>';
    });
  }
  h += '</div></div>';

  /* side: job info group */
  h += '<div><div class="grouplabel">Job info</div><div class="card">' +
         '<div class="kv"><span class="k">Client</span><span class="v">' + esc(c ? c.name : "—") + '</span></div>' +
         '<div class="kv"><span class="k">Property</span><span class="v">' + esc(propertyLabel(c, j.propertyId)) + '</span></div>' +
         '<div class="kv"><span class="k">Trade</span><span class="v">' + esc(j.trade) + '</span></div>' +
         (j.jobberNumber ? '<div class="kv"><span class="k">Jobber job #</span><span class="v">' + esc(j.jobberNumber) + '</span></div>' : '') +
         (q ? '<div class="kv"><span class="k">From quote</span><span class="v">' + esc(q.number) + '</span></div>' : '') +
         '<div class="kv"><span class="k">Started</span><span class="v">' + fmtDate(j.createdAt) + '</span></div>' +
         '<div class="kv"><span class="k">Status</span><span class="v">' + jobDisplayStatus(j) + '</span></div>' +
       '</div>';

  /* side: client money group */
  if (c) {
    var cm = clientMoney(c.id);
    h += '<div class="grouplabel">' + esc(c.name) + ' — money</div><div class="card">' +
           '<div class="kv"><span class="k">Quoted</span><span class="v">' + money(cm.quoted) + '</span></div>' +
           '<div class="kv"><span class="k">Invoiced</span><span class="v">' + money(cm.invoiced) + '</span></div>' +
           '<div class="kv"><span class="k">Paid</span><span class="v">' + money(cm.paid) + '</span></div>' +
           '<div class="kv"><span class="k">Balance owed</span><span class="v">' + money(cm.owed) + '</span></div>' +
         '</div>';
  }
  h += '</div></div>';

  /* archive — quiet group above the destructive one */
  if (j.archived)
    h += '<div class="card"><button class="btn ghost block" data-act="job_unarchive" data-id="' + j.id + '">Restore from Archive</button></div>';
  else
    h += '<div class="card"><button class="btn ghost block" data-act="job_archive" data-id="' + j.id + '">Archive job</button></div>';

  /* destructive — last, alone (§9.4) */
  h += '<div class="card"><button class="btn ghost del block" data-act="job_delete" data-id="' + j.id + '">Delete job</button></div>';
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
          '<div class="frow"><label class="f" for="jf-client">Client *</label>' +
          '<span class="fctl"><select id="jf-client" onchange="ACTIONS.job_form_client(this)">' +
            '<option value="">— Choose a client —</option>' +
            sortedClients().map(function(cl){
              return '<option value="' + cl.id + '"' + (JF.clientId === cl.id ? " selected" : "") + '>' + esc(cl.name) + '</option>';
            }).join("") +
          '</select></span></div>' +
          '<div class="frow"><label class="f" for="jf-property">Property</label>' +
          '<span class="fctl"><select id="jf-property">' +
            '<option value="">No property selected</option>' +
            props.map(function(p){
              return '<option value="' + p.id + '"' + (JF.propertyId === p.id ? " selected" : "") + '>' + esc(propertyLabel(c, p.id)) + '</option>';
            }).join("") +
          '</select></span></div>' +
          '<div class="frow"><label class="f" for="jf-trade">Trade *</label>' +
          '<span class="fctl"><select id="jf-trade">' +
            '<option value="Electric"' + (JF.trade === "Electric" ? " selected" : "") + '>Electric</option>' +
            '<option value="HVAC"' + (JF.trade === "HVAC" ? " selected" : "") + '>HVAC</option>' +
          '</select></span></div>' +
          '<div class="frow"><label class="f" for="jf-title">Job title</label>' +
          '<span class="fctl"><input type="text" id="jf-title" placeholder="e.g. Rough-in — Lot 12, Bella Collina" value="' + esc(JF.title || "") + '"></span></div>';
  var foot = "";
  if (JF.quoteId) {
    var qj = JF.id ? jobById(JF.id) : null;
    h += '<div class="frow"><span class="f">Job amount</span>' +
         '<span class="fval">' + money(qj ? jobAmount(qj) : 0) + '</span></div>';
    foot = '<p class="muted small">This job\'s amount comes from its quote — edit the quote to change it.</p>';
  } else if (isOwner()) {
    h += '<div class="frow"><label class="f" for="jf-amount">Job amount</label>' +
         '<span class="fctl"><span class="cur">$</span>' +
         '<input type="number" class="money" id="jf-amount" min="0" step="0.01" inputmode="decimal" value="' + (JF.amount != null && JF.amount !== "" ? esc(JF.amount) : "") + '"></span></div>';
  } else {
    h += '<div class="frow"><span class="f">Job amount</span>' +
         '<span class="fval">' + money(JF.amount || 0) + '</span></div>';
    foot = '<p class="muted small">Only the Owner can set or change amounts. The Office can create the job — the Owner adds the amount.</p>';
  }
  h += '<div class="frow"><label class="f" for="jf-date">Start date</label>' +
       '<span class="fctl"><input type="date" class="datepill" id="jf-date" value="' + esc(JF.date || todayStr()) + '"></span></div>' +
       '</div>' + foot +
       '<div class="err" id="jf-err"></div>' +
       '<button class="btn gold block" data-act="job_save">' + (editing ? "Save changes" : "Create job") + '</button>' +
       '<button class="btn ghost block" data-act="job_form_cancel">Cancel</button>';
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
ACTIONS.job_archive = function(el){
  var j = jobById(el.getAttribute("data-id"));
  if (!j) return;
  j.archived = true; saveDB();
  if (S.sel === j.id) S.sel = null;
  toast("Job archived — find it in More \u2192 Archive");
  refresh();
};
ACTIONS.job_unarchive = function(el){
  var j = jobById(el.getAttribute("data-id"));
  if (!j) return;
  j.archived = false; saveDB();
  toast("Job restored");
  refresh();
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
