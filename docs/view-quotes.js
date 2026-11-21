/* =====================================================================
   SHARMA360 CRM v4 — QUOTES module  (view-quotes.js)
   Quote workflow: list / maker / detail / printable document.
   v4: Apple-design restyle (grouped lists, .dhead detail header with
   hero amount, §9.6 item rows, §9.8 .doc document). Data logic,
   ACTIONS/VIEWS names and price gates are unchanged from v3.
   New class hooks introduced for style.css: .q-toolbar (no longer a
   card), .q-toolsrow, .trail (row trailing column: amount over pill),
   .items/.lrow (grouped line-item rows), .addrow (tint add-line row),
   .dangerzone (bottom destructive group), .doc-rule (doc hairline),
   .dh-num/.dh-pills/.dh-hero/.dh-title (detail-header family, joining
   core's .dh-top/.dh-sub/.dh-actions). Labels now use core's .f;
   .q-flabel is retired. Pills come from core's quotePill() (§9.7
   dot + tinted fill is CSS's job on .pill).

   Registers:  VIEWS.quotes, ACTIONS.q_*  (see V3-CONTRACT.md)

   CROSS-NAVIGATION USED (documented for the integrator):
   - Same-tab state lives in the module-local QV object; VIEWS.quotes
     dispatches on QV.mode ("list" | "detail" | "maker" | "doc").
   - After every state change, actions call qRender(): core's render()
     when present. Selection is also mirrored to the legacy globals
     selQuoteId / selJobId / selClientId when core uses them.
   - Opening a record in another tab: the element carries BOTH
     data-open-client="<id>" / data-open-job="<id>" (contract convention,
     routed by core) and data-act="q_openclient" / data-act="q_openjob"
     (this module's fallback). The fallback actions set the legacy
     sel* global and click the matching [data-nav] element if one is in
     the DOM, else set TAB + call render(). ACTIONS.open_client /
     ACTIONS.open_job are also registered ONLY if not already defined,
     so the owning module's version (loaded before/after) wins.
   - Maker: rendered through core's openForm(html) when available
     (contract FORM state); otherwise as QV.mode="maker" + render().
     Leaving the maker calls closeForm() when present, else render().
   - Live behaviours that clicks can't cover (search-as-you-type,
     sort <select>, client→property cascade, product picker, live
     totals) are bound by qBind() via a deferred setTimeout after the
     view HTML is returned, guarded by element existence. List search
     re-fills only #q-results so the search box keeps focus.
   - Print: the document view uses core's .doc surface — core's
     @media print rules print only .doc, so window.print() prints
     just the document.
   ===================================================================== */

/* ---------------- module state ---------------- */
var QV = {
  mode: "list",          // list | detail | maker | doc
  id: null,              // quote id for detail/doc
  search: "",
  status: "All",         // All | Draft | Sent | Approved | Converted | Declined
  sort: "new",           // new | old | amt
  editId: null,          // quote id being edited in the maker (null = new)
  formViaOpen: false     // maker was opened through core's openForm()
};
var Q_STATUSES = ["Draft", "Sent", "Approved", "Converted", "Declined"];

/* ---------------- small utilities (module-local) ---------------- */
function qRender(){
  if (typeof render === "function") render();
  if (typeof window !== "undefined" && window.scrollTo) { /* keep position on list ops */ }
}
function qSetSel(name, id){
  try { eval(name + " = " + JSON.stringify(id)); } catch (e) { /* legacy global not declared — module state is enough */ }
}
function qNav(tab, selName, id){
  if (selName) qSetSel(selName, id);
  var btn = null;
  try { btn = document.querySelector('[data-nav="' + tab + '"]'); } catch (e) {}
  if (btn && btn.click) { btn.click(); return; }
  try { TAB = tab; } catch (e) {}
  qRender();
}
function qClientName(q){
  var c = clientById(q.clientId);
  return c ? c.name : "Unknown client";
}
function qMatchesSearch(q){
  var s = QV.search.trim().toLowerCase();
  if (!s) return true;
  var num = String(q.number || "").toLowerCase();
  var bare = num.replace(/^q-/, "");
  return num.indexOf(s) >= 0 || bare.indexOf(s) >= 0 ||
         qClientName(q).toLowerCase().indexOf(s) >= 0 ||
         quoteTitle(q).toLowerCase().indexOf(s) >= 0;
}
function qFiltered(){
  var list = DB.quotes.filter(function(q){
    return !recArchived(q) && (QV.status === "All" || q.status === QV.status) && qMatchesSearch(q);
  });
  list.sort(function(a, b){
    if (QV.sort === "amt") return quoteTotal(b) - quoteTotal(a);
    if (QV.sort === "old") return String(a.createdAt || "").localeCompare(String(b.createdAt || "")) ||
                                   String(a.number).localeCompare(String(b.number));
    return String(b.createdAt || "").localeCompare(String(a.createdAt || "")) ||
           String(b.number).localeCompare(String(a.number));
  });
  return list;
}
function qTradeTag(trade){
  /* Core's badge — one icon/tag system across the app (no inline colours). */
  if (typeof tradeTag === "function") return tradeTag(trade || "Electric");
  return '<span class="badge">' + esc(trade || "Electric") + "</span>";
}
function qStatusCounts(){
  var counts = { All: DB.quotes.filter(function(q){ return !recArchived(q); }).length };
  Q_STATUSES.forEach(function(st){
    counts[st] = DB.quotes.filter(function(q){ return q.status === st && !recArchived(q); }).length;
  });
  return counts;
}

/* ---------------- LIST ---------------- */
function qListHTML(){
  var counts = qStatusCounts();
  var chips = ["All"].concat(Q_STATUSES).map(function(st){
    return '<button class="chip' + (QV.status === st ? " on" : "") + '" data-act="q_chip" data-status="' +
      st + '">' + st + ' <span class="chipn">' + (counts[st] || 0) + "</span></button>";
  }).join("");
  var h = '<div id="qroot">';
  h += '<div class="q-head"><h2 class="view">Quotes</h2>' +
       (isOwner()
         ? '<button class="btn gold" data-act="q_new">+ New Quote</button>'
         : '<span class="muted q-gatenote">Office view — quotes are created by the Owner.</span>') +
       "</div>";
  h += '<div class="q-toolbar">' +
         '<input id="q-search" class="q-search" type="search" placeholder="Search number, client, or title…" value="' + esc(QV.search) + '">' +
         '<div class="q-toolsrow"><div class="chips q-chips">' + chips + "</div>" +
         '<label class="q-sortwrap">Sort <select id="q-sort" class="q-sort">' +
           '<option value="new"' + (QV.sort === "new" ? " selected" : "") + ">Newest first</option>" +
           '<option value="old"' + (QV.sort === "old" ? " selected" : "") + ">Oldest first</option>" +
           '<option value="amt"' + (QV.sort === "amt" ? " selected" : "") + ">Amount, high to low</option>" +
         "</select></label></div>" +
       "</div>";
  h += '<div id="q-results">' + qResultsHTML() + "</div>";
  h += "</div>";
  return h;
}
function qResultsHTML(){
  if (!DB.quotes.length){
    return '<div class="empty">No quotes yet.' +
      (isOwner() ? ' Tap “+ New Quote” to write the first one.' : "") + "</div>";
  }
  var list = qFiltered();
  var total = list.reduce(function(s, q){ return s + quoteTotal(q); }, 0);
  var h = '<div class="q-count">' + list.length + (list.length === 1 ? " quote" : " quotes") +
          ' · <strong>' + money(total) + "</strong> total</div>";
  if (!list.length){
    return h + '<div class="empty">No quotes match this search / filter.</div>';
  }
  /* Desktop table */
  h += '<style>@media (max-width:899px){.q-desk{display:none}}@media (min-width:900px){.q-mob{display:none}}</style>';
  h += '<div class="card q-desk"><table class="qtable"><thead><tr>' +
       "<th>Quote #</th><th>Client</th><th>Title</th><th>Trade</th>" +
       '<th class="r">Amount</th><th>Status</th><th>Date</th></tr></thead><tbody>';
  list.forEach(function(q){
    h += '<tr class="qrow" data-act="q_open" data-id="' + q.id + '">' +
      "<td>" + esc(q.number) + "</td>" +
      "<td>" + esc(qClientName(q)) + "</td>" +
      "<td>" + esc(quoteTitle(q)) + "</td>" +
      "<td>" + qTradeTag(q.trade) + "</td>" +
      '<td class="r">' + money(quoteTotal(q)) + "</td>" +
      "<td>" + quotePill(q.status) + "</td>" +
      "<td>" + fmtDate(q.createdAt) + "</td></tr>";
  });
  h += "</tbody></table></div>";
  /* Phone rows */
  h += '<div class="q-mob">';
  list.forEach(function(q){
    var c = clientById(q.clientId);
    var init = (qClientName(q).trim().charAt(0) || "?").toUpperCase();
    h += '<button class="rowitem" data-act="q_open" data-id="' + q.id + '">' +
      '<span class="avatar">' + esc(init) + "</span>" +
      '<span class="grow"><span class="name">' + esc(q.number) + " · " + esc(quoteTitle(q)) + "</span>" +
      '<span class="meta">' + esc(qClientName(q)) + " · " + esc(q.trade || "Electric") + " · " + fmtDate(q.createdAt) + "</span></span>" +
      '<span class="trail"><span class="amt">' + money(quoteTotal(q)) + "</span>" + quotePill(q.status) +
      "</span></button>";
  });
  h += "</div>";
  return h;
}

/* ---------------- DETAIL ---------------- */
function qDetailHTML(q){
  if (!q) return '<div id="qroot"><button class="backbtn" data-act="q_back">← All quotes</button>' +
                 '<div class="empty">That quote no longer exists.</div></div>';
  var c = clientById(q.clientId);
  var total = quoteTotal(q);
  var owner = isOwner();
  var h = '<div id="qroot">';
  h += '<button class="backbtn" data-act="q_back">← All quotes</button>';

  /* header (§9.4): pill + number footnote, hero amount, title, sublines */
  h += '<div class="dhead">' +
    '<div class="dh-top"><span class="dh-num">' + esc(q.number) + '</span>' +
    '<span class="dh-pills">' + quotePill(q.status) + " " + qTradeTag(q.trade) + "</span></div>" +
    '<div class="dh-hero">' + money(total) + "</div>" +
    '<div class="dh-title">' + esc(quoteTitle(q)) + "</div>" +
    '<div class="dh-sub">' + esc(qClientName(q)) + " · " + esc(propertyLabel(c, q.propertyId)) + "</div>" +
    '<div class="dh-sub">Created ' + fmtDate(q.createdAt) +
      (q.sentAt ? " · Sent " + fmtDate(q.sentAt) : "") +
      (q.approvedAt ? " · Approved " + fmtDate(q.approvedAt) : "") + "</div>";

  /* actions — one filled (gold) primary per state; Delete lives in the
     danger zone at the bottom, never beside Save/Send (§9.4). */
  var acts = [];
  acts.push('<button class="btn" data-act="q_doc" data-id="' + q.id + '">View Document</button>');
  if (q.status === "Draft"){
    if (owner) acts.push('<button class="btn gold" data-act="q_sent" data-id="' + q.id + '">Mark Sent</button>');
    if (owner) acts.push('<button class="btn" data-act="q_edit" data-id="' + q.id + '">Edit</button>');
  }
  if (q.status === "Sent"){
    acts.push('<button class="btn gold" data-act="q_approve" data-id="' + q.id + '">Record Approval</button>');
    acts.push('<button class="btn" data-act="q_decline" data-id="' + q.id + '">Record Decline</button>');
  }
  if (q.status === "Approved"){
    acts.push('<button class="btn gold" data-act="q_convert" data-id="' + q.id + '">Convert to Job →</button>');
  }
  if (q.status === "Converted"){
    var job = DB.jobs.find(function(j){ return j.quoteId === q.id; });
    if (job) acts.push('<button class="btn gold" data-open-job="' + job.id + '" data-act="q_openjob" data-id="' + job.id + '">View Job →</button>');
  }
  if (owner) acts.push('<button class="btn" data-act="q_dup" data-id="' + q.id + '">Duplicate</button>');
  h += '<div class="dh-actions">' + acts.join("") + "</div></div>";
  if (q.status === "Draft" && !owner)
    h += '<div class="card q-notice">Draft quotes are priced and sent by the Owner — the office can view everything here but can’t send or edit amounts.</div>';

  /* two-column body */
  h += '<div class="q-cols"><div class="q-main">';
  h += '<div class="card"><h3 class="sec">Line items</h3>' + qLinesRowsHTML(q) + "</div>";
  h += '<div class="card q-totals"><div class="kv"><span class="k">Subtotal</span><span class="v">' + money(total) + "</span></div>" +
       '<div class="kv q-grand"><span class="k">Total</span><span class="v">' + money(total) + "</span></div></div>";
  if (q.notes) h += '<div class="card"><h3 class="sec">Internal notes</h3><p class="q-notes">' + esc(q.notes) + "</p></div>";
  h += "</div>";

  h += '<div class="q-side">';
  /* client card */
  h += '<div class="card"><h3 class="sec">Client</h3>' +
    '<div class="q-cname">' + esc(qClientName(q)) + "</div>" +
    (c ? '<div class="muted">' + esc(c.type ? (c.type.charAt(0).toUpperCase() + c.type.slice(1)) : "") + "</div>" : "") +
    (c && c.phone ? '<div class="kv"><span class="k">Phone</span><span class="v">' + esc(c.phone) + "</span></div>" : "") +
    (c && c.email ? '<div class="kv"><span class="k">Email</span><span class="v">' + esc(c.email) + "</span></div>" : "") +
    '<div class="kv"><span class="k">Property</span><span class="v">' + esc(propertyLabel(c, q.propertyId)) + "</span></div>" +
    (c ? '<button class="btn block" data-open-client="' + c.id + '" data-act="q_openclient" data-id="' + c.id + '">Open client →</button>' : "") +
    "</div>";
  /* meta card */
  h += '<div class="card"><h3 class="sec">Quote details</h3>' +
    '<div class="kv"><span class="k">Number</span><span class="v">' + esc(q.number) + "</span></div>" +
    '<div class="kv"><span class="k">Trade</span><span class="v">' + esc(q.trade || "Electric") + "</span></div>" +
    '<div class="kv"><span class="k">Status</span><span class="v">' + esc(q.status) + "</span></div>" +
    '<div class="kv"><span class="k">Created</span><span class="v">' + fmtDate(q.createdAt) + "</span></div>" +
    '<div class="kv"><span class="k">Sent</span><span class="v">' + fmtDate(q.sentAt) + "</span></div>" +
    '<div class="kv"><span class="k">Approved</span><span class="v">' + fmtDate(q.approvedAt) + "</span></div>" +
    "</div>";
  h += "</div></div>"; /* /q-side /q-cols */

  /* archive — quiet group above the destructive one */
  if (q.archived)
    h += '<div class="card"><button class="btn ghost block" data-act="q_unarchive" data-id="' + q.id + '">Restore from Archive</button></div>';
  else
    h += '<div class="card"><button class="btn ghost block" data-act="q_archive" data-id="' + q.id + '">Archive quote</button></div>';

  /* destructive group — last, alone (§9.4) */
  if (q.status === "Draft")
    h += '<div class="dangerzone"><button class="btn danger block" data-act="q_del" data-id="' + q.id + '">Delete draft</button></div>';
  h += "</div>";
  return h;
}
/* Detail line items as grouped rows (§9.6): title Body, detail
   Subheadline "qty × unit price", trailing amount tabular. */
function qLinesRowsHTML(q){
  var lines = q.lines || [];
  if (!lines.length){
    return '<div class="items"><div class="lrow"><span class="grow">' +
      '<span class="name">Quote total (from Jobber)</span>' +
      '<span class="meta">No line items on file — the total was carried over from Jobber</span></span>' +
      '<span class="amt">' + money(q.totalAmount) + "</span></div></div>";
  }
  var h = '<div class="items">';
  lines.forEach(function(l){
    var qty = Number(l.qty) || 0, price = Number(l.price) || 0;
    h += '<div class="lrow"><span class="grow"><span class="name">' + esc(l.desc || "") + "</span>" +
      '<span class="meta">' + qty + " × " + money(price) + "</span></span>" +
      '<span class="amt">' + money(qty * price) + "</span></div>";
  });
  h += "</div>";
  return h;
}
/* Document line items as a true table (§9.8 — the one place a grid is
   native to the medium). Rendered inside core's .doc surface. */
function qDocLinesHTML(q){
  var lines = q.lines || [];
  var h = '<table><thead><tr><th>Description</th><th class="r">Qty</th>' +
          '<th class="r">Unit price</th><th class="r">Amount</th></tr></thead><tbody>';
  if (!lines.length){
    h += '<tr><td>Quote total (from Jobber)</td><td class="r">1</td><td class="r">' +
         money(q.totalAmount) + '</td><td class="r">' + money(q.totalAmount) + "</td></tr>";
  } else {
    lines.forEach(function(l){
      var qty = Number(l.qty) || 0, price = Number(l.price) || 0;
      h += "<tr><td>" + esc(l.desc || "") + '</td><td class="r">' + qty + '</td><td class="r">' +
           money(price) + '</td><td class="r">' + money(qty * price) + "</td></tr>";
    });
  }
  h += "</tbody></table>";
  return h;
}

/* ---------------- PRINTABLE DOCUMENT ---------------- */
function qDocHTML(q){
  if (!q) return '<div id="qroot"><button class="backbtn" data-act="q_back">← All quotes</button>' +
                 '<div class="empty">That quote no longer exists.</div></div>';
  var c = clientById(q.clientId);
  var total = quoteTotal(q);
  var contact = (c && c.contacts && c.contacts[0]) ? c.contacts[0] : null;
  var h = '<div id="qroot">';
  h += '<div class="q-docbar"><button class="backbtn" data-act="q_open" data-id="' + q.id + '">← Back to quote</button>' +
       '<button class="btn gold" data-act="q_print">Print</button></div>';
  /* §9.8: opaque light-only .doc surface (core's print CSS prints only
     .doc). Brand colour appears only in the wordmark + one tint rule. */
  h += '<div class="doc q-doc">';
  h += '<div class="doc-head"><div><img class="doc-logo" src="assets/sharma360-logo.png" alt="SHARMA360 — Sharma Electric &amp; HVAC">' +
       '<div class="muted">SHARMA360</div>' +
       '<div class="small muted">Lic. EC13013924 · CAC1823596</div>' +
       '<div class="small muted">office@sharmaelectric.com · 407-881-9076</div></div>' +
       '<div><div class="doc-title">Quote</div><div class="doc-num">' + esc(q.number) + "</div>" +
       (q.status === "Draft" ? '<span class="tag-draft">DRAFT — not sent</span>' : quotePill(q.status)) +
       '<div class="muted">' + fmtDate(q.createdAt) + "</div></div></div>";
  h += '<div class="doc-rule"></div>';
  h += '<div class="doc-parties">' +
       '<div class="dp"><div class="dp-h">Prepared for</div>' +
       '<div class="q-cname">' + esc(qClientName(q)) + "</div>" +
       (contact ? '<div>' + esc(contact.name) + (contact.role ? " · " + esc(contact.role) : "") + "</div>" : "") +
       (c && c.phone ? "<div>" + esc(c.phone) + "</div>" : "") +
       (c && c.email ? "<div>" + esc(c.email) + "</div>" : "") + "</div>" +
       '<div class="dp"><div class="dp-h">Job details</div>' +
       '<div class="kv"><span class="k">Property</span><span class="v">' + esc(propertyLabel(c, q.propertyId)) + "</span></div>" +
       '<div class="kv"><span class="k">Trade</span><span class="v">' + esc(q.trade || "Electric") + "</span></div>" +
       '<div class="kv"><span class="k">Date</span><span class="v">' + fmtDate(q.createdAt) + "</span></div>" +
       '<div class="kv"><span class="k">Status</span><span class="v">' + esc(q.status) + "</span></div>" +
       "</div></div>";
  if (q.title) h += '<div class="q-doc-title">' + esc(q.title) + "</div>";
  h += qDocLinesHTML(q);
  h += '<div class="doc-totals"><div class="kv"><span class="k">Subtotal</span><span class="v">' + money(total) + "</span></div>" +
       '<div class="kv"><span class="k">Total</span><span class="v grand">' + money(total) + "</span></div></div>";
  h += '<div class="doc-foot">Thank you for the opportunity to earn your business. ' +
       "This quote is a proposal only and is not a bill. Prices are as quoted above; work is scheduled once the quote is approved.</div>";
  h += "</div></div>";
  return h;
}

/* ---------------- QUOTE MAKER ---------------- */
function qGateHTML(){
  return '<div id="qroot"><button class="backbtn" data-act="q_back">← All quotes</button>' +
    '<div class="card q-notice"><h3 class="sec">Owner pricing</h3>' +
    "<p>Quotes carry prices, so creating and editing them is Owner-only. " +
    "The office can view every quote, record approvals and declines, and convert approved quotes to jobs.</p></div></div>";
}
function qClientOptions(selectedId, filter){
  var f = (filter || "").trim().toLowerCase();
  var clients = DB.clients.slice().sort(function(a, b){ return a.name.localeCompare(b.name); });
  var h = '<option value="">— Pick a client —</option>';
  clients.forEach(function(c){
    if (f && c.name.toLowerCase().indexOf(f) < 0 && c.id !== selectedId) return;
    h += '<option value="' + c.id + '"' + (c.id === selectedId ? " selected" : "") + ">" + esc(c.name) + "</option>";
  });
  return h;
}
function qPropertyOptions(client, selectedId){
  var h = '<option value="">No property</option>';
  if (!client) return h;
  (client.properties || []).forEach(function(p){
    h += '<option value="' + p.id + '"' + (p.id === selectedId ? " selected" : "") + ">" +
         esc(propertyLabel(client, p.id)) + "</option>";
  });
  return h;
}
function qProductOptions(){
  var h = '<option value="">＋ Product (optional)…</option>';
  (typeof PRODUCTS !== "undefined" ? PRODUCTS : []).forEach(function(p, i){
    h += '<option value="' + i + '">' + esc(p.name) + (p.model ? " · " + esc(p.model) : "") + "</option>";
  });
  return h;
}
function qLineRowHTML(l){
  l = l || { desc: "", qty: 1, price: "" };
  var lineTotal = (Number(l.qty) || 0) * (Number(l.price) || 0);
  return '<div class="qf-row">' +
    '<select class="qf-prod" aria-label="Pick a product">' + qProductOptions() + "</select>" +
    '<input class="qf-desc" type="text" placeholder="Description" value="' + esc(l.desc) + '">' +
    '<input class="qf-qty" type="number" min="0" step="any" inputmode="decimal" placeholder="Qty" value="' + (l.qty === "" ? "" : l.qty) + '">' +
    '<input class="qf-price" type="number" min="0" step="0.01" inputmode="decimal" placeholder="Unit price" value="' + (l.price === "" ? "" : l.price) + '">' +
    '<span class="qf-ltotal">' + money(lineTotal) + "</span>" +
    '<span class="qf-rowbtns">' +
      '<button class="btn sm" data-act="q_lineup" title="Move up">↑</button>' +
      '<button class="btn sm" data-act="q_linedown" title="Move down">↓</button>' +
      '<button class="btn sm danger" data-act="q_delline" title="Remove line">✕</button>' +
    "</span></div>";
}
function qMakerHTML(){
  if (!isOwner()) return qGateHTML();
  var q = QV.editId ? quoteById(QV.editId) : null;
  var lines = [{ desc: "", qty: 1, price: "" }];
  var clientId = "", propertyId = "", trade = "Electric", title = "", notes = "";
  if (q){
    clientId = q.clientId; propertyId = q.propertyId || ""; trade = q.trade || "Electric";
    title = q.title || ""; notes = q.notes || "";
    if (q.lines && q.lines.length) lines = q.lines.map(function(l){ return { desc: l.desc || "", qty: l.qty, price: l.price }; });
    else if (q.totalAmount) lines = [{ desc: "Quote total (from Jobber)", qty: 1, price: q.totalAmount }];
  }
  var client = clientById(clientId);
  var total = lines.reduce(function(s, l){ return s + (Number(l.qty) || 0) * (Number(l.price) || 0); }, 0);
  var h = '<div id="qroot">';
  h += '<button class="backbtn" data-act="q_cancel">← Cancel</button>';
  /* details group (§9.5 grouped form) */
  h += '<div class="card q-maker"><h2 class="view">' + (q ? "Edit " + esc(q.number) : "New Quote") + "</h2>";
  h += '<label class="f">Client</label>' +
       '<input id="qf-clientsearch" class="q-search" type="search" placeholder="Search clients…">' +
       '<select id="qf-client" class="q-select">' + qClientOptions(clientId) + "</select>";
  h += '<label class="f">Property</label>' +
       '<select id="qf-property" class="q-select">' + qPropertyOptions(client, propertyId) + "</select>";
  h += '<label class="f">Trade — one trade per quote</label>' +
       '<div class="q-tradewrap seg">' +
         '<button class="btn q-tradebtn' + (trade === "Electric" ? " on" : "") + '" data-act="q_trade" data-trade="Electric">Electric</button>' +
         '<button class="btn q-tradebtn' + (trade === "HVAC" ? " on" : "") + '" data-act="q_trade" data-trade="HVAC">HVAC</button>' +
       '</div><input type="hidden" id="qf-trade" value="' + esc(trade) + '">';
  h += '<label class="f">Title</label>' +
       '<input id="qf-title" class="q-input" type="text" placeholder="e.g. Rough-in — Lot 12, Bella Collina" value="' + esc(title) + '">';
  h += "</div>";
  /* items group (§9.6) */
  h += '<div class="card"><h3 class="sec">Line items</h3><div id="qf-lines">';
  lines.forEach(function(l){ h += qLineRowHTML(l); });
  h += '</div><button class="addrow" data-act="q_addline">＋ Add line</button>';
  h += '<p class="muted q-picknote">Picking a product fills the description and model — the price is always entered by hand.</p></div>';
  /* totals group — separate grouped card (§9.6) */
  h += '<div class="card q-totals"><div class="kv"><span class="k">Subtotal</span><span class="v" id="qf-subtotal">' + money(total) + "</span></div>" +
       '<div class="kv q-grand"><span class="k">Total</span><span class="v" id="qf-total">' + money(total) + "</span></div></div>";
  /* notes group */
  h += '<div class="card"><label class="f">Internal notes (not on the client document)</label>' +
       '<textarea id="qf-notes" class="q-input" rows="3" placeholder="Office notes…">' + esc(notes) + "</textarea></div>";
  /* error sits below the groups, footnote-style (§9.5) */
  h += '<div class="q-err" id="qf-err" style="display:none"></div>';
  h += '<div class="q-actions"><button class="btn gold" data-act="q_save">Save as Draft</button>' +
       '<button class="btn" data-act="q_cancel">Cancel</button></div>';
  h += "</div>";
  return h;
}

/* ---------------- maker DOM helpers ---------------- */
function qHarvestLines(){
  var rows = [];
  document.querySelectorAll("#qf-lines .qf-row").forEach(function(r){
    var d = r.querySelector(".qf-desc"), qt = r.querySelector(".qf-qty"), pr = r.querySelector(".qf-price");
    rows.push({
      desc: d ? d.value.trim() : "",
      qty: qt ? (Number(qt.value) || 0) : 0,
      price: pr ? (Number(pr.value) || 0) : 0
    });
  });
  return rows;
}
function qRecalcTotals(){
  var lines = qHarvestLines();
  var total = lines.reduce(function(s, l){ return s + l.qty * l.price; }, 0);
  var st = document.getElementById("qf-subtotal"), tt = document.getElementById("qf-total");
  if (st) st.textContent = money(total);
  if (tt) tt.textContent = money(total);
  document.querySelectorAll("#qf-lines .qf-row").forEach(function(r, i){
    var lt = r.querySelector(".qf-ltotal");
    if (lt && lines[i]) lt.textContent = money(lines[i].qty * lines[i].price);
  });
}
function qShowMaker(){
  if (typeof openForm === "function"){
    QV.formViaOpen = true;
    openForm(qMakerHTML());
  } else {
    QV.formViaOpen = false;
    QV.mode = "maker";
    qRender();
  }
  qScheduleBind();
}
function qHideMaker(){
  var wasOpen = QV.formViaOpen;
  QV.formViaOpen = false;
  QV.mode = QV.id ? "detail" : "list";
  if (wasOpen && typeof closeForm === "function") closeForm();
  qRender();
}

/* ---------------- deferred binding (input/change events) ---------------- */
function qScheduleBind(){
  if (typeof setTimeout !== "function") return;
  setTimeout(qBind, 0);
  setTimeout(function(){ qBind(); }, 80); /* one retry if core inserts HTML late */
}
function qBind(){
  var root = null;
  try { root = document.getElementById("qroot"); } catch (e) {}
  if (!root || root.dataset.qbound === "1") return;
  root.dataset.qbound = "1";

  var search = document.getElementById("q-search");
  if (search) search.addEventListener("input", function(){
    QV.search = search.value;
    var res = document.getElementById("q-results");
    if (res) res.innerHTML = qResultsHTML();
  });
  var sort = document.getElementById("q-sort");
  if (sort) sort.addEventListener("change", function(){
    QV.sort = sort.value;
    var res = document.getElementById("q-results");
    if (res) res.innerHTML = qResultsHTML();
  });

  var csearch = document.getElementById("qf-clientsearch");
  var csel = document.getElementById("qf-client");
  if (csearch && csel) csearch.addEventListener("input", function(){
    var cur = csel.value;
    csel.innerHTML = qClientOptions(cur, csearch.value);
    csel.value = cur;
  });
  if (csel) csel.addEventListener("change", function(){
    var psel = document.getElementById("qf-property");
    if (psel) psel.innerHTML = qPropertyOptions(clientById(csel.value), "");
  });
  var linesBox = document.getElementById("qf-lines");
  if (linesBox){
    linesBox.addEventListener("input", qRecalcTotals);
    linesBox.addEventListener("change", function(ev){
      var t = ev.target;
      if (t && t.classList && t.classList.contains("qf-prod") && t.value !== ""){
        var p = (typeof PRODUCTS !== "undefined") ? PRODUCTS[Number(t.value)] : null;
        var row = t.closest ? t.closest(".qf-row") : null;
        var desc = row ? row.querySelector(".qf-desc") : null;
        if (p && desc) desc.value = p.name + (p.model ? " · Model " + p.model : "") + (p.brand ? " (" + p.brand + ")" : "");
        t.value = "";
        qRecalcTotals();
      }
    });
  }
}

/* ---------------- VIEW ---------------- */
VIEWS.quotes = function(){
  var html;
  if (QV.mode === "detail") html = qDetailHTML(quoteById(QV.id));
  else if (QV.mode === "doc") html = qDocHTML(quoteById(QV.id));
  else if (QV.mode === "maker" && !QV.formViaOpen) html = qMakerHTML();
  else html = qListHTML();
  qScheduleBind();
  return html;
};

/* ---------------- ACTIONS ---------------- */
ACTIONS.q_open = function(el){
  QV.id = el.dataset.id; QV.mode = "detail";
  qSetSel("selQuoteId", QV.id);
  qRender();
};
ACTIONS.q_back = function(){
  QV.id = null; QV.mode = "list"; QV.editId = null;
  qSetSel("selQuoteId", null);
  qRender();
};
ACTIONS.q_chip = function(el){
  QV.status = el.dataset.status || "All";
  qRender();
};
ACTIONS.q_new = function(){
  if (!isOwner()) { QV.mode = "maker"; QV.editId = null; qRender(); return; } /* gate notice */
  QV.editId = null;
  qShowMaker();
};
ACTIONS.q_edit = function(el){
  var q = quoteById(el.dataset.id);
  if (!q || q.status !== "Draft") return;
  if (!isOwner()) { QV.id = q.id; QV.mode = "maker"; QV.editId = null; qRender(); return; } /* gate notice */
  QV.id = q.id; QV.editId = q.id;
  qShowMaker();
};
ACTIONS.q_cancel = function(){
  QV.editId = null;
  qHideMaker();
};
ACTIONS.q_trade = function(el){
  var v = el.dataset.trade;
  var hidden = document.getElementById("qf-trade");
  if (hidden) hidden.value = v;
  var wrap = el.parentNode;
  if (wrap) wrap.querySelectorAll(".q-tradebtn").forEach(function(b){
    b.classList.toggle("on", b.dataset.trade === v);
  });
};
ACTIONS.q_addline = function(){
  var box = document.getElementById("qf-lines");
  if (box) box.insertAdjacentHTML("beforeend", qLineRowHTML());
};
ACTIONS.q_delline = function(el){
  var row = el.closest ? el.closest(".qf-row") : null;
  var box = document.getElementById("qf-lines");
  if (row && box && box.querySelectorAll(".qf-row").length > 1) row.remove();
  else if (row) { /* keep one blank row */
    row.querySelectorAll("input").forEach(function(i){ i.value = i.classList.contains("qf-qty") ? "1" : ""; });
  }
  qRecalcTotals();
};
ACTIONS.q_lineup = function(el){
  var row = el.closest ? el.closest(".qf-row") : null;
  if (row && row.previousElementSibling) row.parentNode.insertBefore(row, row.previousElementSibling);
};
ACTIONS.q_linedown = function(el){
  var row = el.closest ? el.closest(".qf-row") : null;
  if (row && row.nextElementSibling) row.parentNode.insertBefore(row.nextElementSibling, row);
};
ACTIONS.q_save = function(){
  if (!isOwner()) return;
  var err = document.getElementById("qf-err");
  function fail(msg){ if (err){ err.textContent = msg; err.style.display = "block"; } }
  var clientId = (document.getElementById("qf-client") || {}).value || "";
  var propertyId = (document.getElementById("qf-property") || {}).value || "";
  var trade = (document.getElementById("qf-trade") || {}).value || "";
  var title = ((document.getElementById("qf-title") || {}).value || "").trim();
  var notes = ((document.getElementById("qf-notes") || {}).value || "").trim();
  var lines = qHarvestLines().filter(function(l){ return l.desc || l.price; });
  if (!clientId) return fail("Pick the client first.");
  if (trade !== "Electric" && trade !== "HVAC")
    return fail("Trade is required — Electric or HVAC. One trade per quote, always.");
  if (!lines.length) return fail("Add at least one line item.");
  var savedId;
  if (QV.editId){
    var q = quoteById(QV.editId);
    if (!q || q.status !== "Draft") return fail("Only Draft quotes can be edited.");
    Object.assign(q, { clientId: clientId, propertyId: propertyId, trade: trade,
                       title: title, lines: lines, totalAmount: null, notes: notes });
    savedId = q.id;
  } else {
    var nq = { id: uid("q"), number: "Q-" + (DB.seq.quote++), clientId: clientId,
      propertyId: propertyId, trade: trade, title: title, lines: lines,
      totalAmount: null, status: "Draft", createdAt: todayStr(), sentAt: null,
      approvedAt: null, notes: notes };
    DB.quotes.push(nq);
    savedId = nq.id;
  }
  saveDB();
  QV.editId = null; QV.id = savedId;
  qSetSel("selQuoteId", savedId);
  qHideMaker();
};
ACTIONS.q_sent = function(el){
  if (!isOwner()) return; /* price gate: sending carries a price */
  var q = quoteById(el.dataset.id);
  if (!q || q.status !== "Draft") return;
  q.status = "Sent"; q.sentAt = todayStr();
  saveDB(); qRender();
};
ACTIONS.q_archive = function(el){
  var q = quoteById(el.dataset.id);
  if (!q) return;
  q.archived = true; saveDB();
  QV.id = null; QV.mode = "list"; qSetSel("selQuoteId", null);
  toast("Quote archived — find it in More \u2192 Archive");
  qRender();
};
ACTIONS.q_unarchive = function(el){
  var q = quoteById(el.dataset.id);
  if (!q) return;
  q.archived = false; saveDB();
  toast("Quote restored");
  qRender();
};
ACTIONS.q_approve = function(el){
  var q = quoteById(el.dataset.id);
  if (!q || q.status !== "Sent") return;
  q.status = "Approved"; q.approvedAt = todayStr();
  saveDB(); qRender();
};
ACTIONS.q_decline = function(el){
  var q = quoteById(el.dataset.id);
  if (!q || q.status !== "Sent") return;
  q.status = "Declined";
  saveDB(); qRender();
};
ACTIONS.q_convert = function(el){
  var q = quoteById(el.dataset.id);
  if (!q || q.status !== "Approved") return;
  var job = { id: uid("j"), quoteId: q.id, clientId: q.clientId, propertyId: q.propertyId || "",
    trade: q.trade, title: quoteTitle(q), jobberNumber: "", amount: quoteTotal(q),
    createdAt: todayStr(), stages: blankStages(), status: "Active", lateFlag: false };
  DB.jobs.push(job);
  q.status = "Converted";
  saveDB();
  QV.id = null; QV.mode = "list";
  qNav("jobs", "selJobId", job.id);
};
ACTIONS.q_dup = function(el){
  if (!isOwner()) return; /* duplicating creates a priced draft */
  var q = quoteById(el.dataset.id);
  if (!q) return;
  var nq = { id: uid("q"), number: "Q-" + (DB.seq.quote++), clientId: q.clientId,
    propertyId: q.propertyId || "", trade: q.trade, title: q.title || "",
    lines: (q.lines || []).map(function(l){ return { desc: l.desc, qty: l.qty, price: l.price }; }),
    totalAmount: (q.lines && q.lines.length) ? null : (q.totalAmount != null ? q.totalAmount : null),
    status: "Draft", createdAt: todayStr(), sentAt: null, approvedAt: null, notes: q.notes || "" };
  DB.quotes.push(nq);
  saveDB();
  QV.id = nq.id; QV.mode = "detail";
  qSetSel("selQuoteId", nq.id);
  qRender();
};
ACTIONS.q_del = function(el){
  var q = quoteById(el.dataset.id);
  if (!q || q.status !== "Draft") return;
  if (typeof confirm === "function" && !confirm("Delete draft " + q.number + "? This cannot be undone.")) return;
  DB.quotes = DB.quotes.filter(function(x){ return x.id !== q.id; });
  saveDB();
  QV.id = null; QV.mode = "list";
  qSetSel("selQuoteId", null);
  qRender();
};
ACTIONS.q_doc = function(el){
  QV.id = el.dataset.id; QV.mode = "doc";
  qRender();
};
ACTIONS.q_print = function(){
  if (typeof window !== "undefined" && window.print) window.print();
};
ACTIONS.q_openclient = function(el){
  qNav("clients", "selClientId", el.dataset.id);
};
ACTIONS.q_openjob = function(el){
  qNav("jobs", "selJobId", el.dataset.id);
};

/* Cross-module open fallbacks — only if the owning module hasn't registered them. */
if (typeof ACTIONS !== "undefined" && !ACTIONS.open_client)
  ACTIONS.open_client = function(el){ qNav("clients", "selClientId", el.dataset.openClient || el.dataset.id); };
if (typeof ACTIONS !== "undefined" && !ACTIONS.open_job)
  ACTIONS.open_job = function(el){ qNav("jobs", "selJobId", el.dataset.openJob || el.dataset.id); };
