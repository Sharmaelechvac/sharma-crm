/* =====================================================================
   SHARMA360 CRM v4 — CLIENTS module  (view-clients.js)
   Registers VIEWS.clients + ACTIONS.cl_* per V3-CONTRACT.md.
   v4 presentation: Apple design (spec §9.3 rows, §9.4 detail header,
   §9.5 grouped forms, §9.7 pills, §5.8 desktop table). All data
   logic, actions and navigation conventions are unchanged from v3.

   Navigation convention used: core's openRecord(kind, id) when present
   (kind: client|quote|job|invoice); otherwise the shared state vars —
   TAB, selClientId, selQuoteId, selJobId, selInvoiceId — are set and
   render() is called. Confirms use core's confirmAct() modal and
   notices core's toast() when available (native-dialog fallbacks).
   Forms render inside this view (CL.mode === "form") so the module is
   self-contained; core's openForm() is not required.
   Client CRUD is open to Owner + Office (no prices live on clients).
   ===================================================================== */

/* ---------------- module state ---------------- */
var CL = {
  search: "",            // list search text
  filter: "all",         // all | builder | homeowner | commercial | archived
  sort: "name",          // name | owed | recent
  mode: "list",          // list | form   (detail comes from selClientId)
  formMode: "new",       // new | edit
  formId: null,          // client id when editing
  formErr: "",
  detailTab: "overview", // overview | quotes | jobs | invoices | activity
  contactEditId: null,   // contact id being edited inline, or null
  propEditId: null       // property id being edited inline, or null
};

/* ---------------- small helpers (cl-prefixed, no collisions) -------- */
function clTypeLabel(t){
  t = String(t || "builder").toLowerCase();
  if(t === "builder") return "Builder";
  if(t === "homeowner") return "Homeowner";
  if(t === "commercial") return "Commercial";
  return "Builder";
}
function clTypePill(c){
  var t = String(c.type || "builder").toLowerCase();
  if(t === "builder") return '<span class="pill navy">Builder</span>';
  if(t === "homeowner") return '<span class="pill gold">Homeowner</span>';
  if(t === "commercial") return '<span class="pill blue">Commercial</span>';
  return '<span class="pill navy">Builder</span>';
}
function clInitial(c){
  var n = String(c.name || "").trim();
  return esc((n.charAt(0) || "?").toUpperCase());
}
function clPrimaryContact(c){
  var cs = c.contacts || [];
  return cs.length ? cs[0] : null;
}
/* Address line for list rows: first property (community · address for
   builders, address otherwise). Falls back to the Jobber property-count
   note ("6 properties in Jobber") so imported clients still read true. */
function clAddressLine(c){
  var line = (typeof clientAddressLine === "function") ? clientAddressLine(c) : "";
  if(line) return line;
  var props = c.properties || [];
  if(props.length){
    var p = props[0];
    return String(c.type).toLowerCase() === "builder"
      ? ((p.community || "") + (p.address ? " · " + p.address : "")).trim()
      : (p.address || "");
  }
  var m = String(c.notes || "").match(/(\d+)\s+properties in Jobber/i);
  if(m) return m[1] + (m[1] === "1" ? " property" : " properties") + " on file (Jobber)";
  return "";
}
function clPropertyCountLabel(c){
  var n = (c.properties || []).length;
  if(n) return n + (n === 1 ? " property" : " properties");
  var m = String(c.notes || "").match(/(\d+)\s+properties in Jobber/i);
  if(m) return m[1] + " (Jobber)";
  return "—";
}
function clQuotesOf(id){ return DB.quotes.filter(function(q){ return q.clientId === id; }); }
function clJobsOf(id){ return DB.jobs.filter(function(j){ return j.clientId === id; }); }
function clInvoicesOf(id){ return DB.invoices.filter(function(i){ return i.clientId === id; }); }
/* Past-due balance for one client — drives the red owed amount in
   list rows (§9.3: overdue amount in --red/600). Read-only. */
function clPastDue(id){
  return clInvoicesOf(id).reduce(function(s, i){
    return displayInvoiceStatus(i) === "Past due" ? s + invoiceBalance(i) : s;
  }, 0);
}
/* Inline SVG stroke icons (spec §7.2 web equivalent of SF Symbols):
   24px grid, stroke currentColor, round caps/joins. Used for the
   detail quick-action row and the list search glyph. */
function clIcon(name){
  var p = {
    phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>',
    message: '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>',
    mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>',
    pin: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>'
  }[name] || "";
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>';
}
/* Most recent activity date (ISO string) across the client's records. */
function clLastActivity(c){
  var d = "";
  clQuotesOf(c.id).forEach(function(q){ if(q.createdAt && q.createdAt > d) d = q.createdAt; });
  clJobsOf(c.id).forEach(function(j){ if(j.createdAt && j.createdAt > d) d = j.createdAt; });
  clInvoicesOf(c.id).forEach(function(i){
    if(i.createdAt && i.createdAt > d) d = i.createdAt;
    (i.payments || []).forEach(function(p){ if(p.date && p.date > d) d = p.date; });
  });
  return d;
}
function clVal(id){
  var el = (typeof document !== "undefined") ? document.getElementById(id) : null;
  return el ? String(el.value || "").trim() : "";
}
function clConfirm(msg){
  if(typeof confirm === "function") return confirm(msg);
  return true;
}
/* Prefer core's designed confirm modal (confirmAct) and toast when the
   core provides them; fall back to native dialogs otherwise. */
function clConfirmDo(msg, fn){
  if(typeof confirmAct === "function"){ confirmAct(msg, fn); return; }
  if(clConfirm(msg)) fn();
}
function clNotify(msg){
  if(typeof toast === "function"){ toast(msg); return; }
  if(typeof alert === "function") alert(msg);
}
function clNav(tab, id){
  var kind = { clients: "client", quotes: "quote", jobs: "job", invoices: "invoice" }[tab];
  if(kind && typeof openRecord === "function"){ openRecord(kind, id); return; }
  if(typeof goto === "function"){ goto(tab, id); return; }
  if(typeof go === "function"){
    go(tab);
    if(tab === "clients") selClientId = id;
    if(tab === "quotes") selQuoteId = id;
    if(tab === "jobs") selJobId = id;
    if(tab === "invoices") selInvoiceId = id;
    render();
    if(typeof window !== "undefined" && window.scrollTo) window.scrollTo(0, 0);
    return;
  }
  TAB = tab;
  if(tab === "clients") selClientId = id;
  if(tab === "quotes") selQuoteId = id;
  if(tab === "jobs") selJobId = id;
  if(tab === "invoices") selInvoiceId = id;
  render();
  if(typeof window !== "undefined" && window.scrollTo) window.scrollTo(0, 0);
}
/* Inline search/sort handlers (referenced from the toolbar markup). */
function CLSearch(v){
  CL.search = v;
  render();
  var s = (typeof document !== "undefined") ? document.getElementById("cl-search") : null;
  if(s){ s.focus(); try { s.setSelectionRange(s.value.length, s.value.length); } catch(e){} }
}
function CLSort(v){ CL.sort = v; render(); }

/* ---------------- filtering / sorting ---------------- */
function clFilteredClients(){
  var q = CL.search.trim().toLowerCase();
  var list = DB.clients.filter(function(c){
    var archived = !!c.archived;
    if(CL.filter === "archived"){ if(!archived) return false; }
    else {
      if(archived) return false;
      if(CL.filter !== "all" && String(c.type || "builder").toLowerCase() !== CL.filter) return false;
    }
    if(!q) return true;
    if(String(c.name || "").toLowerCase().indexOf(q) >= 0) return true;
    if(String(c.phone || "").toLowerCase().indexOf(q) >= 0) return true;
    if(String(c.email || "").toLowerCase().indexOf(q) >= 0) return true;
    if(String(c.notes || "").toLowerCase().indexOf(q) >= 0) return true;
    if(clAddressLine(c).toLowerCase().indexOf(q) >= 0) return true;
    var hit = false;
    (c.contacts || []).forEach(function(ct){
      if(String(ct.name || "").toLowerCase().indexOf(q) >= 0) hit = true;
      if(String(ct.email || "").toLowerCase().indexOf(q) >= 0) hit = true;
      if(String(ct.phone || "").toLowerCase().indexOf(q) >= 0) hit = true;
    });
    (c.properties || []).forEach(function(p){
      if(String(p.address || "").toLowerCase().indexOf(q) >= 0) hit = true;
      if(String(p.community || "").toLowerCase().indexOf(q) >= 0) hit = true;
    });
    return hit;
  });
  if(CL.sort === "owed"){
    list.sort(function(a, b){
      var d = clientBalanceOwed(b.id) - clientBalanceOwed(a.id);
      return d !== 0 ? d : String(a.name).localeCompare(String(b.name));
    });
  } else if(CL.sort === "recent"){
    list.sort(function(a, b){
      var da = clLastActivity(a), db = clLastActivity(b);
      if(da !== db) return da < db ? 1 : -1;
      return String(a.name).localeCompare(String(b.name));
    });
  } else {
    list.sort(function(a, b){ return String(a.name).localeCompare(String(b.name)); });
  }
  return list;
}

/* Module-scoped styles, emitted with every clients render (list, detail
   and form) so the module looks right however the user lands on it.
   v4: Apple design tokens (spec §8) with literal fallbacks, so the
   module renders correctly before/with the shell stylesheet. Content
   surfaces are opaque grouped cards — no shadows, 0.5px hairlines. */
function clStyleTag(){
  var SEP = '0.5px solid var(--separator,rgba(60,60,67,.29))';
  return '<style>' +
    '@media (min-width:900px){.cl-mobile{display:none}}' +
    '@media (max-width:899px){.cl-desktop{display:none}}' +
    /* search field icon (§9.3) */
    '.cl-search .s-ic{color:var(--label-2,rgba(60,60,67,.6))}' +
    '.cl-search .s-ic svg{width:18px;height:18px;display:block}' +
    /* filter pills — §9.7 monochrome inversion, one scroll row */
    '.cl-filters{flex-wrap:nowrap;overflow-x:auto;padding-bottom:4px}' +
    '.cl-filters .chip{flex:0 0 auto;background:var(--fill-3,rgba(120,120,128,.12));border-color:transparent;color:var(--label,#000)}' +
    '.cl-filters .chip.on{background:var(--label,#000);border-color:var(--label,#000);color:var(--bg,#fff)}' +
    /* desktop table — §5.8: hairlines only, no zebra, tabular amounts */
    '.cl-tbl{width:100%;border-collapse:collapse;background:var(--bg-grouped-2,#fff)}' +
    '.cl-tbl th{text-align:left;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--label-2,rgba(60,60,67,.6));padding:10px 16px;border-bottom:' + SEP + '}' +
    '.cl-tbl td{padding:11px 16px;border-bottom:' + SEP + ';vertical-align:middle;font-size:15px}' +
    '.cl-tbl tbody tr{cursor:pointer}.cl-tbl tbody tr:hover{background:var(--fill-4,rgba(120,120,128,.08))}' +
    '.cl-tbl tbody tr:last-child td{border-bottom:0}' +
    '.cl-tbl .r{text-align:right;font-variant-numeric:tabular-nums}' +
    '.cl-owed{color:var(--red,#FF3B30);font-weight:600}' +
    '.amt.owed{color:var(--red,#FF3B30);font-weight:600}' +
    '.cl-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}' +
    /* detail header (§9.4) */
    '.avatar.lg{flex:0 0 64px;width:64px;height:64px;border-radius:50%;font-size:24px}' +
    '.cl-dh{display:flex;gap:16px;align-items:center}' +
    '.cl-dh .grow{flex:1;min-width:0}' +
    '.cl-quick{display:flex;gap:8px;margin-top:16px;padding-top:16px;border-top:' + SEP + '}' +
    '.cl-qa{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;min-height:44px;padding:6px 4px;color:var(--tint,#007AFF);text-decoration:none;font-size:12px;font-weight:500}' +
    '.cl-qa svg{width:22px;height:22px}' +
    '.cl-qa:active{opacity:.6}' +
    /* money strip — one grouped card, hairline dividers (like §9.2) */
    '.cl-money{display:grid;grid-template-columns:1fr 1fr;gap:0;background:var(--bg-grouped-2,#fff);border-radius:12px;overflow:hidden}' +
    '.cl-money .stat{background:transparent;border:0;box-shadow:none;border-radius:0;padding:16px;min-height:76px}' +
    '.cl-money .stat:nth-child(odd){border-right:' + SEP + '}' +
    '.cl-money .stat:nth-child(-n+2){border-bottom:' + SEP + '}' +
    '.cl-money .stat.alert .n{color:var(--red,#FF3B30)}' +
    '@media (min-width:900px){.cl-money{grid-template-columns:repeat(4,1fr)}' +
      '.cl-money .stat:nth-child(-n+2){border-bottom:0}' +
      '.cl-money .stat:not(:last-child){border-right:' + SEP + '}}' +
    /* section tabs — §5.3 segmented control */
    '.cl-tabs{display:flex;gap:2px;background:var(--fill-3,rgba(120,120,128,.12));border-radius:999px;padding:2px;margin:16px 0 4px}' +
    '.cl-tabs button{flex:1;min-height:32px;padding:4px 6px;border:0;border-radius:999px;background:transparent;font-size:13px;font-weight:500;color:var(--label,#000);cursor:pointer;white-space:nowrap}' +
    '.cl-tabs button.on{background:var(--bg,#fff);font-weight:600;box-shadow:0 3px 8px rgba(0,0,0,.15),0 0 1px rgba(0,0,0,.12)}' +
    /* contact / property rows inside a grouped list */
    '.cl-crow{display:flex;gap:12px;align-items:flex-start;padding:12px 16px;border-bottom:' + SEP + '}' +
    '.cl-crow:last-child{border-bottom:0}' +
    '.cl-crow .grow{flex:1;min-width:0}' +
    /* destructive rows — own final group, red, centred (§9.4) */
    '.cl-danger-row{justify-content:center;text-align:center;color:var(--red,#FF3B30);font-weight:600}' +
    '.cl-danger-row:active{background:var(--fill-4,rgba(120,120,128,.08))}' +
    /* activity date — footnote, secondary */
    '.cl-date{flex:0 0 auto;font-size:13px;color:var(--label-2,rgba(60,60,67,.6));padding-top:2px}' +
    /* grouped forms — §9.5: the grouped row IS the field */
    '.cl-ghead{font-size:13px;color:var(--label-2,rgba(60,60,67,.6));margin:28px 16px 6px}' +
    '.cl-ghead.first{margin-top:4px}' +
    '.cl-form{background:var(--bg-grouped-2,#fff);border-radius:12px;overflow:hidden}' +
    '.cl-frow{display:flex;align-items:center;gap:12px;padding:0 16px;min-height:44px;border-bottom:' + SEP + '}' +
    '.cl-frow:last-child{border-bottom:0}' +
    '.cl-flabel{flex:0 0 104px;font-size:17px;color:var(--label,#000)}' +
    '.cl-frow.err-row .cl-flabel{color:var(--red,#FF3B30)}' +
    '.cl-frow input,.cl-frow select{flex:1;min-width:0;border:0;background:transparent;min-height:44px;padding:10px 0;font-size:17px;text-align:right;color:var(--label,#000);border-radius:0;box-shadow:none}' +
    '.cl-frow input.ta-l{text-align:left}' +
    '.cl-frow input::placeholder,.cl-frow textarea::placeholder{color:var(--placeholder,rgba(60,60,67,.3))}' +
    '.cl-frow.stack{flex-direction:column;align-items:stretch;gap:2px;padding-top:10px;padding-bottom:10px}' +
    '.cl-frow.stack .cl-flabel{flex:none}' +
    '.cl-frow.stack textarea{border:0;background:transparent;width:100%;min-height:88px;font-size:17px;line-height:22px;padding:4px 0;text-align:left;color:var(--label,#000);resize:vertical;border-radius:0;box-shadow:none}' +
    '.cl-ferr{font-size:13px;color:var(--red,#FF3B30);margin:8px 16px 0}' +
    '.cl-fhelp{font-size:13px;line-height:18px;color:var(--label-2,rgba(60,60,67,.6));margin:8px 16px 0}' +
    '.cl-addrow{display:flex;align-items:center;gap:8px;width:100%;padding:0 16px;min-height:48px;background:transparent;border:0;color:var(--tint,#007AFF);font-size:17px;cursor:pointer;text-align:left}' +
    '.cl-addrow:active{opacity:.6}' +
    '</style>';
}

/* ---------------- LIST VIEW ----------------
   Apple design (§9.3): grouped inset list; 40px initials avatar;
   title Body 17, subtitle Subheadline secondary (contact · address);
   trailing is the owed amount (tabular, red when any of it is past
   due) OR a chevron — never amount + pill + chevron together. The
   type filter is a §9.7 monochrome pill row. Desktop keeps a §5.8
   table: hairlines only, no zebra, right-aligned tabular amounts. */
function clListHTML(){
  var list = clFilteredClients();
  var total = DB.clients.filter(function(c){ return !c.archived; }).length;
  var h = clStyleTag();

  h += '<h2 class="view">Clients</h2>';

  /* toolbar — §9.3 search field (36px, radius 10, fill background) */
  h += '<div class="toolbar">' +
    '<span class="t-search cl-search"><span class="s-ic">' + clIcon("search") + '</span>' +
    '<input type="text" id="cl-search" placeholder="Search clients" value="' + esc(CL.search) + '" autocomplete="off" oninput="CLSearch(this.value)"></span>' +
    '<select id="cl-sort" onchange="CLSort(this.value)" aria-label="Sort clients">' +
      '<option value="name"' + (CL.sort === "name" ? " selected" : "") + '>Sort: Name A–Z</option>' +
      '<option value="owed"' + (CL.sort === "owed" ? " selected" : "") + '>Sort: Most owed</option>' +
      '<option value="recent"' + (CL.sort === "recent" ? " selected" : "") + '>Sort: Recent activity</option>' +
    '</select>' +
    '<button class="btn gold" data-act="cl_new">＋ New Client</button>' +
  '</div>';
  h += '<div class="chips cl-filters">' +
    [["all", "All"], ["builder", "Builders"], ["homeowner", "Homeowners"], ["commercial", "Commercial"], ["archived", "Archived"]].map(function(pair){
      return '<button class="chip' + (CL.filter === pair[0] ? ' on' : '') + '" data-act="cl_filter" data-f="' + pair[0] + '">' + pair[1] + '</button>';
    }).join("") + '</div>';
  h += '<p class="muted small">' +
    (CL.filter === "archived"
      ? list.length + (list.length === 1 ? " archived client" : " archived clients")
      : list.length + " of " + total + (total === 1 ? " client" : " clients")) +
  '</p>';

  if(list.length === 0){
    h += '<div class="empty"><h3>' +
      (CL.filter === "archived" ? "No Archived Clients"
        : (CL.search || CL.filter !== "all" ? "No Clients Found" : "No Clients Yet")) +
      '</h3><p>' +
      (CL.filter === "archived" ? "Clients you archive will show up here."
        : (CL.search || CL.filter !== "all" ? "No clients match that search or filter." : "Tap ＋ New Client to add the first one.")) +
      '</p></div>';
    return h;
  }

  /* phone / narrow: grouped inset rows */
  h += '<div class="listcard cl-mobile">';
  list.forEach(function(c){
    var addr = clAddressLine(c);
    var ct = clPrimaryContact(c);
    var owed = clientBalanceOwed(c.id);
    var pastDue = owed > 0 ? clPastDue(c.id) : 0;
    h += '<button class="rowitem" data-act="cl_open" data-id="' + c.id + '">' +
      '<span class="avatar">' + clInitial(c) + '</span>' +
      '<span class="grow"><span class="name">' + esc(c.name) + '</span>' +
      '<div class="meta">' +
        (ct ? esc(ct.name) + (addr ? " · " : "") : "") + (addr ? esc(addr) : "") +
        (!ct && !addr ? clTypeLabel(c.type) + " · no property on file yet" : "") +
      '</div></span>' +
      (owed > 0
        ? '<span class="amt' + (pastDue > 0 ? ' owed' : '') + '">' + money(owed) + '</span>'
        : '<span class="chev">›</span>') +
      '</button>';
  });
  h += '</div>';

  /* desktop: table (§5.8) */
  h += '<div class="cl-desktop listcard"><table class="cl-tbl"><thead><tr>' +
    '<th>Client</th><th>Type</th><th>Contact</th><th>Properties</th><th class="r">Balance</th><th class="r">Quotes</th><th class="r">Jobs</th><th></th>' +
  '</tr></thead><tbody>';
  list.forEach(function(c){
    var addr = clAddressLine(c);
    var ct = clPrimaryContact(c);
    var owed = clientBalanceOwed(c.id);
    var pastDue = owed > 0 ? clPastDue(c.id) : 0;
    h += '<tr data-act="cl_open" data-id="' + c.id + '">' +
      '<td><span style="display:flex;gap:12px;align-items:center"><span class="avatar">' + clInitial(c) + '</span>' +
        '<span><b>' + esc(c.name) + '</b>' + (addr ? '<div class="small muted">' + esc(addr) + '</div>' : '') + '</span></span></td>' +
      '<td>' + clTypeLabel(c.type) + '</td>' +
      '<td>' + (ct ? esc(ct.name) + (ct.role ? '<div class="small muted">' + esc(ct.role) + '</div>' : '') : '<span class="muted">—</span>') + '</td>' +
      '<td>' + clPropertyCountLabel(c) + '</td>' +
      '<td class="r">' + (owed > 0 ? '<span' + (pastDue > 0 ? ' class="cl-owed"' : '') + '>' + money(owed) + '</span>' : '<span class="muted">—</span>') + '</td>' +
      '<td class="r">' + clQuotesOf(c.id).length + '</td>' +
      '<td class="r">' + clJobsOf(c.id).length + '</td>' +
      '<td class="r"><span class="chev">›</span></td></tr>';
  });
  h += '</tbody></table></div>';
  return h;
}

/* ---------------- CLIENT FORM (new / edit) ----------------
   §9.5 grouped form: one field per row, label leading, value
   trailing (right-aligned value rows; subject fields left-aligned),
   no boxed inputs, no floating labels. Errors are a red footnote
   below the group + a red row label — never a banner or border. */
function clFormHTML(){
  var isNew = CL.formMode === "new";
  var c = isNew ? { name: "", type: "builder", phone: "", email: "", billingNotes: "", notes: "" }
                : (clientById(CL.formId) || { name: "", type: "builder", phone: "", email: "", billingNotes: "", notes: "" });
  var sel = function(t){ return String(c.type || "builder").toLowerCase() === t ? " selected" : ""; };
  var h = clStyleTag() + '<button class="backbtn" data-act="cl_cancel_form">← ' + (isNew ? "All clients" : "Back to client") + '</button>';
  h += '<h2 class="view">' + (isNew ? "New Client" : "Edit Client") + '</h2>';

  h += '<div class="cl-form">' +
    '<div class="cl-frow' + (CL.formErr ? ' err-row' : '') + '"><span class="cl-flabel">Name</span>' +
      '<input type="text" class="ta-l" id="clf-name" value="' + esc(c.name) + '" autocomplete="off" placeholder="Client name"></div>' +
    '<div class="cl-frow"><span class="cl-flabel">Type</span><select id="clf-type">' +
      '<option value="builder"' + sel("builder") + '>Builder</option>' +
      '<option value="homeowner"' + sel("homeowner") + '>Homeowner</option>' +
      '<option value="commercial"' + sel("commercial") + '>Commercial</option></select></div>' +
    '<div class="cl-frow"><span class="cl-flabel">Phone</span>' +
      '<input type="tel" id="clf-phone" value="' + esc(c.phone || "") + '" autocomplete="tel"></div>' +
    '<div class="cl-frow"><span class="cl-flabel">Email</span>' +
      '<input type="email" id="clf-email" value="' + esc(c.email || "") + '" autocomplete="email"></div>' +
  '</div>';
  if(CL.formErr) h += '<p class="cl-ferr">' + esc(CL.formErr) + '</p>';

  h += '<div class="cl-ghead">Billing &amp; notes</div>' +
    '<div class="cl-form">' +
    '<div class="cl-frow stack"><span class="cl-flabel">Billing notes</span>' +
      '<textarea id="clf-billing" placeholder="Terms, where invoices go, draw schedule…">' + esc(c.billingNotes || "") + '</textarea></div>' +
    '<div class="cl-frow stack"><span class="cl-flabel">Notes</span>' +
      '<textarea id="clf-notes">' + esc(c.notes || "") + '</textarea></div>' +
    '</div>' +
    '<p class="cl-fhelp">Billing notes cover terms and where invoices go — they are used when billing this client.</p>';

  if(isNew){
    h += '<div class="cl-ghead">First contact (optional)</div>' +
      '<div class="cl-form">' +
      '<div class="cl-frow"><span class="cl-flabel">Name</span><input type="text" class="ta-l" id="clf-ct-name" autocomplete="off"></div>' +
      '<div class="cl-frow"><span class="cl-flabel">Role</span><input type="text" class="ta-l" id="clf-ct-role" placeholder="Purchasing, PM, owner…"></div>' +
      '<div class="cl-frow"><span class="cl-flabel">Phone</span><input type="tel" id="clf-ct-phone"></div>' +
      '<div class="cl-frow"><span class="cl-flabel">Email</span><input type="email" id="clf-ct-email"></div>' +
      '</div>';
    h += '<div class="cl-ghead">First property (optional)</div>' +
      '<div class="cl-form">' +
      '<div class="cl-frow"><span class="cl-flabel">Address</span><input type="text" class="ta-l" id="clf-p-address" autocomplete="off"></div>' +
      '<div class="cl-frow"><span class="cl-flabel">Community</span><input type="text" class="ta-l" id="clf-p-community"></div>' +
      '<div class="cl-frow"><span class="cl-flabel">Plan</span><input type="text" class="ta-l" id="clf-p-plan"></div>' +
      '<div class="cl-frow"><span class="cl-flabel">Living SF</span><input type="number" id="clf-p-living" inputmode="numeric" placeholder="Not on file"></div>' +
      '<div class="cl-frow"><span class="cl-flabel">Under Roof SF</span><input type="number" id="clf-p-roof" inputmode="numeric" placeholder="Not on file"></div>' +
      '</div>' +
      '<p class="cl-fhelp">Square footage: leave blank when it isn\'t on file — it will show as "not on file".</p>';
  }
  h += '<div class="btnrow" style="margin-top:28px">' +
    '<button class="btn" data-act="cl_save">' + (isNew ? "Add Client" : "Save Changes") + '</button>' +
    '<button class="btn ghost" data-act="cl_cancel_form">Cancel</button></div>';
  return h;
}
/* Pure save step (DOM-free so it can be smoke-tested): vals mirrors the form. */
function clSaveClient(vals){
  if(!vals.name) return null;
  if(CL.formMode === "edit" && CL.formId){
    var ex = clientById(CL.formId);
    if(!ex) return null;
    ex.name = vals.name; ex.type = vals.type;
    ex.phone = vals.phone; ex.email = vals.email;
    ex.billingNotes = vals.billingNotes; ex.notes = vals.notes;
    return ex;
  }
  var nc = {
    id: "c" + String(DB.seq.client++).padStart(3, "0"),
    type: vals.type, name: vals.name,
    phone: vals.phone, email: vals.email,
    billingNotes: vals.billingNotes, notes: vals.notes,
    contacts: [], properties: [], source: "Added in CRM"
  };
  if(vals.contact && vals.contact.name){
    nc.contacts.push({ id: uid("ct"), name: vals.contact.name, role: vals.contact.role || "",
      phone: vals.contact.phone || "", email: vals.contact.email || "" });
  }
  if(vals.property && (vals.property.address || vals.property.community)){
    nc.properties.push({ id: uid("p"), address: vals.property.address || "",
      community: vals.property.community || "", plan: vals.property.plan || "",
      livingSF: vals.property.livingSF || "", roofSF: vals.property.roofSF || "" });
  }
  DB.clients.push(nc);
  return nc;
}

/* ---------------- CLIENT DETAIL ---------------- */
function clJobLabel(j){
  if(j.title) return j.title;
  var q = j.quoteId ? quoteById(j.quoteId) : null;
  if(q) return q.number + " · " + quoteTitle(q);
  if(j.jobberNumber) return "Job #" + j.jobberNumber + " · " + (j.trade || "Electric");
  return (j.trade || "Electric") + " job";
}
function clDetailHTML(c){
  if(!c) return '<div class="empty"><h3>Client Not Found</h3><p>That client no longer exists.</p></div>';
  var cm = clientMoney(c.id);
  var qs = clQuotesOf(c.id), js = clJobsOf(c.id), is = clInvoicesOf(c.id);
  var h = clStyleTag() + '<button class="backbtn" data-act="cl_back">← All clients</button>';

  /* header block (§9.4): 64px avatar, Title-1 name, secondary
     subline (type · address), then a quick-action row that only
     offers actions the data supports — never a dead button. */
  var addr = clAddressLine(c);
  var pct = clPrimaryContact(c);
  var qaPhone = c.phone || (pct && pct.phone) || "";
  var qaEmail = c.email || (pct && pct.email) || "";
  var qaProp = (c.properties || []).filter(function(p){ return p.address; })[0] || null;
  var qa = "";
  if(qaPhone) qa += '<a class="cl-qa" href="tel:' + esc(qaPhone.replace(/[^+0-9]/g, "")) + '">' + clIcon("phone") + '<span>Call</span></a>';
  if(qaPhone) qa += '<a class="cl-qa" href="sms:' + esc(qaPhone.replace(/[^+0-9]/g, "")) + '">' + clIcon("message") + '<span>Message</span></a>';
  if(qaEmail) qa += '<a class="cl-qa" href="mailto:' + esc(qaEmail) + '">' + clIcon("mail") + '<span>Email</span></a>';
  if(qaProp) qa += '<a class="cl-qa" href="https://maps.apple.com/?q=' + encodeURIComponent(qaProp.address) + '" target="_blank" rel="noopener">' + clIcon("pin") + '<span>Directions</span></a>';

  h += '<div class="dhead"><div class="cl-dh">' +
    '<span class="avatar lg">' + clInitial(c) + '</span>' +
    '<div class="grow"><div class="dh-name">' + esc(c.name) + '</div>' +
    '<div class="dh-sub">' + clTypeLabel(c.type) +
      (c.archived ? ' · Archived' : '') +
      (addr ? ' · ' + esc(addr) : '') + '</div></div>' +
    '<div class="cl-actions">' +
      '<button class="btn sm" data-act="cl_edit" data-id="' + c.id + '">Edit</button>' +
      (c.archived ? '<button class="btn sm ghost" data-act="cl_restore" data-id="' + c.id + '">Restore</button>' : '') +
    '</div></div>';
  if(qa) h += '<div class="cl-quick">' + qa + '</div>';
  if(c.phone) h += '<div class="kv"><span class="k">Phone</span><span class="v">' + esc(c.phone) + '</span></div>';
  if(c.email) h += '<div class="kv"><span class="k">Email</span><span class="v">' + esc(c.email) + '</span></div>';
  if(c.billingNotes) h += '<div class="kv"><span class="k">Billing notes</span><span class="v">' + esc(c.billingNotes) + '</span></div>';
  if(c.notes) h += '<div class="kv"><span class="k">Notes</span><span class="v">' + esc(c.notes) + '</span></div>';
  if(!c.phone && !c.email && !c.billingNotes && !c.notes)
    h += '<p class="muted small" style="margin-bottom:0">No phone, email or notes on file yet — tap Edit to add them.</p>';
  h += '</div>';

  /* money strip — one grouped card with hairline dividers (§9.2) */
  h += '<div class="cl-money stats">' +
    '<div class="stat"><div class="l">Quoted</div><div class="n">' + money(cm.quoted) + '</div></div>' +
    '<div class="stat"><div class="l">Invoiced</div><div class="n">' + money(cm.invoiced) + '</div></div>' +
    '<div class="stat"><div class="l">Paid</div><div class="n">' + money(cm.paid) + '</div></div>' +
    '<div class="stat' + (cm.owed > 0 ? " alert" : "") + '"><div class="l">Balance owed</div><div class="n">' + money(cm.owed) + '</div></div></div>';

  /* section tabs — segmented control (§5.3); counts live in the
     section headers, not the segments */
  var tabs = [["overview", "Overview"], ["quotes", "Quotes"],
              ["jobs", "Jobs"], ["invoices", "Invoices"],
              ["activity", "Activity"]];
  h += '<div class="cl-tabs">' + tabs.map(function(t){
    return '<button data-act="cl_tab" data-t="' + t[0] + '"' + (CL.detailTab === t[0] ? ' class="on"' : '') + '>' + t[1] + '</button>';
  }).join("") + '</div>';

  if(CL.detailTab === "overview") h += clOverviewHTML(c);
  else if(CL.detailTab === "quotes") h += clRecordListHTML("quotes", c, qs);
  else if(CL.detailTab === "jobs") h += clRecordListHTML("jobs", c, js);
  else if(CL.detailTab === "invoices") h += clRecordListHTML("invoices", c, is);
  else if(CL.detailTab === "activity") h += clActivityHTML(c);

  /* destructive group — last, alone, red (§9.4) */
  h += '<div class="listcard" style="margin-top:28px"><button class="rowitem cl-danger-row" data-act="' +
    (c.archived ? 'cl_delete' : 'cl_archive') + '" data-id="' + c.id + '">' +
    (c.archived ? 'Delete Permanently' : 'Archive Client') + '</button></div>';
  return h;
}

function clOverviewHTML(c){
  var h = "";
  /* contacts — view rows grouped in ONE listcard; an open edit form
     renders as its own §9.5 grouped form below the list */
  var cts = c.contacts || [];
  h += '<h3 class="sec">Contacts (' + cts.length + ')</h3>';
  if(cts.length === 0){
    h += '<div class="empty"><h3>No Contacts Yet</h3><p>No contacts on file for this client yet.</p></div>';
  } else {
    var crows = "", cedit = "";
    cts.forEach(function(ct){
      if(CL.contactEditId === ct.id){
        cedit = '<div class="cl-ghead first">Edit contact</div><div class="cl-form">' +
          '<div class="cl-frow"><span class="cl-flabel">Name</span><input type="text" class="ta-l" id="cle-name" value="' + esc(ct.name) + '"></div>' +
          '<div class="cl-frow"><span class="cl-flabel">Role</span><input type="text" class="ta-l" id="cle-role" value="' + esc(ct.role || "") + '"></div>' +
          '<div class="cl-frow"><span class="cl-flabel">Phone</span><input type="tel" id="cle-phone" value="' + esc(ct.phone || "") + '"></div>' +
          '<div class="cl-frow"><span class="cl-flabel">Email</span><input type="email" id="cle-email" value="' + esc(ct.email || "") + '"></div>' +
          '</div>' +
          '<div class="btnrow" style="margin-top:12px"><button class="btn" data-act="cl_contact_save" data-id="' + ct.id + '">Save Contact</button>' +
          '<button class="btn ghost" data-act="cl_contact_cancel">Cancel</button></div>';
      } else {
        crows += '<div class="cl-crow">' +
          '<div class="grow"><b>' + esc(ct.name) + '</b>' + (ct.role ? ' <span class="muted">· ' + esc(ct.role) + '</span>' : '') +
          (ct.phone ? '<div class="small muted">Phone: ' + esc(ct.phone) + '</div>' : '') +
          (ct.email ? '<div class="small muted">Email: ' + esc(ct.email) + '</div>' : '') + '</div>' +
          '<span class="cl-actions"><button class="btn ghost sm" data-act="cl_contact_edit" data-id="' + ct.id + '">Edit</button>' +
          '<button class="btn ghost sm" data-act="cl_contact_del" data-id="' + ct.id + '">Delete</button></span></div>';
      }
    });
    if(crows) h += '<div class="listcard">' + crows + '</div>';
    h += cedit;
  }
  h += '<div class="cl-ghead">Add a contact</div><div class="cl-form">' +
    '<div class="cl-frow"><span class="cl-flabel">Name</span><input type="text" class="ta-l" id="cla-name"></div>' +
    '<div class="cl-frow"><span class="cl-flabel">Role</span><input type="text" class="ta-l" id="cla-role" placeholder="Purchasing, PM, homeowner…"></div>' +
    '<div class="cl-frow"><span class="cl-flabel">Phone</span><input type="tel" id="cla-phone"></div>' +
    '<div class="cl-frow"><span class="cl-flabel">Email</span><input type="email" id="cla-email"></div>' +
    '<button class="cl-addrow" data-act="cl_contact_add">+ Add Contact</button></div>';

  /* properties — same grouped pattern */
  var prs = c.properties || [];
  h += '<h3 class="sec">Properties (' + prs.length + ')</h3>';
  if(prs.length === 0){
    h += '<div class="empty"><h3>No Properties Yet</h3><p>No properties on file for this client yet.</p></div>';
  } else {
    var prows = "", pedit = "";
    prs.forEach(function(p){
      if(CL.propEditId === p.id){
        pedit = '<div class="cl-ghead first">Edit property</div><div class="cl-form">' +
          '<div class="cl-frow"><span class="cl-flabel">Address</span><input type="text" class="ta-l" id="clpe-address" value="' + esc(p.address || "") + '"></div>' +
          '<div class="cl-frow"><span class="cl-flabel">Community</span><input type="text" class="ta-l" id="clpe-community" value="' + esc(p.community || "") + '"></div>' +
          '<div class="cl-frow"><span class="cl-flabel">Plan</span><input type="text" class="ta-l" id="clpe-plan" value="' + esc(p.plan || "") + '"></div>' +
          '<div class="cl-frow"><span class="cl-flabel">Living SF</span><input type="number" id="clpe-living" inputmode="numeric" value="' + esc(p.livingSF || "") + '" placeholder="Not on file"></div>' +
          '<div class="cl-frow"><span class="cl-flabel">Under Roof SF</span><input type="number" id="clpe-roof" inputmode="numeric" value="' + esc(p.roofSF || "") + '" placeholder="Not on file"></div>' +
          '</div>' +
          '<div class="btnrow" style="margin-top:12px"><button class="btn" data-act="cl_prop_save" data-id="' + p.id + '">Save Property</button>' +
          '<button class="btn ghost" data-act="cl_prop_cancel">Cancel</button></div>';
      } else {
        prows += '<div class="cl-crow">' +
          '<div class="grow"><b>' + esc(p.community || p.address || "—") + '</b>' +
          (p.community && p.address ? ' <span class="muted">· ' + esc(p.address) + '</span>' : '') +
          (p.plan ? '<div class="small muted">Plan: ' + esc(p.plan) + '</div>' : '') +
          '<div class="small muted">Living SF: ' + (p.livingSF ? esc(p.livingSF) : "not on file") +
          ' · Under Roof SF: ' + (p.roofSF ? esc(p.roofSF) : "not on file") + '</div></div>' +
          '<span class="cl-actions"><button class="btn ghost sm" data-act="cl_prop_edit" data-id="' + p.id + '">Edit</button>' +
          '<button class="btn ghost sm" data-act="cl_prop_del" data-id="' + p.id + '">Delete</button></span></div>';
      }
    });
    if(prows) h += '<div class="listcard">' + prows + '</div>';
    h += pedit;
  }
  h += '<div class="cl-ghead">Add a property</div><div class="cl-form">' +
    '<div class="cl-frow"><span class="cl-flabel">Address</span><input type="text" class="ta-l" id="clp-address"></div>' +
    '<div class="cl-frow"><span class="cl-flabel">Community</span><input type="text" class="ta-l" id="clp-community"></div>' +
    '<div class="cl-frow"><span class="cl-flabel">Plan</span><input type="text" class="ta-l" id="clp-plan"></div>' +
    '<div class="cl-frow"><span class="cl-flabel">Living SF</span><input type="number" id="clp-living" inputmode="numeric" placeholder="Not on file"></div>' +
    '<div class="cl-frow"><span class="cl-flabel">Under Roof SF</span><input type="number" id="clp-roof" inputmode="numeric" placeholder="Not on file"></div>' +
    '<button class="cl-addrow" data-act="cl_prop_add">+ Add Property</button></div>' +
    '<p class="cl-fhelp">Square footage: leave blank when it isn\'t on file — it will show as "not on file".</p>';
  return h;
}

/* Record rows (§9.3): grouped list; trailing column is the amount
   over the status pill — no chevron stacked next to a pill. */
function clRecordListHTML(kind, c, list){
  var h = "";
  if(kind === "quotes"){
    h += '<h3 class="sec">Quotes (' + list.length + ')</h3>';
    if(list.length === 0) return h + '<div class="empty"><h3>No Quotes Yet</h3><p>No quotes for this client yet.</p></div>';
    h += '<div class="listcard">';
    list.slice().sort(function(a, b){ return String(b.createdAt || "") < String(a.createdAt || "") ? -1 : 1; }).forEach(function(q){
      h += '<button class="rowitem" data-act="cl_open_quote" data-id="' + q.id + '"><span class="grow">' +
        '<span class="name">' + q.number + ' · ' + esc(quoteTitle(q)) + '</span>' +
        '<div class="meta">' + q.trade + ' · ' + fmtDate(q.createdAt) + '</div></span>' +
        '<span class="side"><span class="amt">' + money(quoteTotal(q)) + '</span>' + quotePill(q.status) + '</span></button>';
    });
    h += '</div>';
  } else if(kind === "jobs"){
    h += '<h3 class="sec">Jobs (' + list.length + ')</h3>';
    if(list.length === 0) return h + '<div class="empty"><h3>No Jobs Yet</h3><p>No jobs for this client yet.</p></div>';
    h += '<div class="listcard">';
    list.slice().sort(function(a, b){ return String(b.createdAt || "") < String(a.createdAt || "") ? -1 : 1; }).forEach(function(j){
      h += '<button class="rowitem" data-act="cl_open_job" data-id="' + j.id + '"><span class="grow">' +
        '<span class="name">' + esc(clJobLabel(j)) + '</span>' +
        '<div class="meta">' + (j.trade || "") + ' · ' + jobDoneCount(j) + ' of 5 stages done' + (j.createdAt ? ' · ' + fmtDate(j.createdAt) : '') + '</div></span>' +
        '<span class="side"><span class="amt">' + money(jobAmount(j)) + '</span>' + jobPill(j) + '</span></button>';
    });
    h += '</div>';
  } else {
    h += '<h3 class="sec">Invoices (' + list.length + ')</h3>';
    if(list.length === 0) return h + '<div class="empty"><h3>No Invoices Yet</h3><p>No invoices for this client yet.</p></div>';
    h += '<div class="listcard">';
    list.slice().sort(function(a, b){ return String(b.createdAt || "") < String(a.createdAt || "") ? -1 : 1; }).forEach(function(inv){
      var bal = invoiceBalance(inv);
      h += '<button class="rowitem" data-act="cl_open_invoice" data-id="' + inv.id + '"><span class="grow">' +
        '<span class="name">' + inv.number + '</span>' +
        '<div class="meta">' + fmtDate(inv.sentAt || inv.createdAt) + (bal > 0 && inv.status !== "Draft" ? ' · ' + money(bal) + ' balance' : '') + '</div></span>' +
        '<span class="side"><span class="amt">' + money(inv.amount) + '</span>' + invoicePill(inv) + '</span></button>';
    });
    h += '</div>';
  }
  return h;
}

/* Merged timeline of the client's quotes, jobs, invoices + payments.
   Apple design: plain grouped rows — the kind rides in the meta line
   (no uppercase badge tiles), the date is a footnote trailing. */
function clActivityHTML(c){
  var ev = [];
  clQuotesOf(c.id).forEach(function(q){
    ev.push({ date: q.createdAt || "", kind: "Quote", act: "cl_open_quote", id: q.id,
      text: q.number + " — " + quoteTitle(q), sub: q.status + " · " + money(quoteTotal(q)) });
  });
  clJobsOf(c.id).forEach(function(j){
    ev.push({ date: j.createdAt || "", kind: "Job", act: "cl_open_job", id: j.id,
      text: clJobLabel(j), sub: jobDisplayStatus(j) + " · " + jobDoneCount(j) + " of 5 stages done · " + money(jobAmount(j)) });
  });
  clInvoicesOf(c.id).forEach(function(inv){
    ev.push({ date: inv.createdAt || "", kind: "Invoice", act: "cl_open_invoice", id: inv.id,
      text: inv.number, sub: displayInvoiceStatus(inv) + " · " + money(inv.amount) });
    (inv.payments || []).forEach(function(p){
      ev.push({ date: p.date || inv.createdAt || "", kind: "Payment", act: "cl_open_invoice", id: inv.id,
        text: "Payment on " + inv.number, sub: money(p.amount) + (p.method ? " · " + p.method : "") + (p.ref ? " · " + p.ref : "") });
    });
  });
  ev.sort(function(a, b){ return a.date < b.date ? 1 : (a.date > b.date ? -1 : 0); });
  var h = '<h3 class="sec">Activity (' + ev.length + ')</h3>';
  if(ev.length === 0) return h + '<div class="empty"><h3>No Activity Yet</h3><p>No activity for this client yet.</p></div>';
  h += '<div class="listcard">';
  ev.forEach(function(e){
    h += '<button class="rowitem" data-act="' + e.act + '" data-id="' + e.id + '">' +
      '<span class="grow"><span class="name">' + esc(e.text) + '</span>' +
      '<div class="meta">' + e.kind + ' · ' + esc(e.sub) + '</div></span>' +
      '<span class="cl-date">' + (e.date ? fmtDate(e.date) : "") + '</span></button>';
  });
  h += '</div>';
  return h;
}

/* ---------------- VIEW registration ---------------- */
VIEWS.clients = function(){
  if(CL.mode === "form") return clFormHTML();
  if(selClientId) return clDetailHTML(clientById(selClientId));
  return clListHTML();
};

/* ---------------- ACTIONS ---------------- */
ACTIONS.cl_open = function(el){
  selClientId = el.getAttribute("data-id");
  CL.detailTab = "overview"; CL.contactEditId = null; CL.propEditId = null;
  render();
  if(typeof window !== "undefined" && window.scrollTo) window.scrollTo(0, 0);
};
ACTIONS.cl_back = function(){
  selClientId = null; CL.contactEditId = null; CL.propEditId = null;
  render();
};
ACTIONS.cl_filter = function(el){ CL.filter = el.getAttribute("data-f") || "all"; render(); };
ACTIONS.cl_new = function(){
  CL.mode = "form"; CL.formMode = "new"; CL.formId = null; CL.formErr = "";
  render();
  if(typeof window !== "undefined" && window.scrollTo) window.scrollTo(0, 0);
};
ACTIONS.cl_edit = function(el){
  CL.mode = "form"; CL.formMode = "edit"; CL.formId = el.getAttribute("data-id"); CL.formErr = "";
  render();
  if(typeof window !== "undefined" && window.scrollTo) window.scrollTo(0, 0);
};
ACTIONS.cl_cancel_form = function(){
  CL.mode = "list"; CL.formErr = "";
  render();
};
ACTIONS.cl_save = function(){
  var name = clVal("clf-name");
  if(!name){ CL.formErr = "The client needs a name."; render(); return; }
  var vals = {
    name: name,
    type: clVal("clf-type") || "builder",
    phone: clVal("clf-phone"), email: clVal("clf-email"),
    billingNotes: clVal("clf-billing"), notes: clVal("clf-notes"),
    contact: { name: clVal("clf-ct-name"), role: clVal("clf-ct-role"), phone: clVal("clf-ct-phone"), email: clVal("clf-ct-email") },
    property: { address: clVal("clf-p-address"), community: clVal("clf-p-community"), plan: clVal("clf-p-plan"),
                livingSF: clVal("clf-p-living"), roofSF: clVal("clf-p-roof") }
  };
  var saved = clSaveClient(vals);
  if(!saved){ CL.formErr = "Could not save that client."; render(); return; }
  saveDB();
  CL.mode = "list"; CL.formErr = "";
  selClientId = saved.id; CL.detailTab = "overview";
  render();
  if(typeof window !== "undefined" && window.scrollTo) window.scrollTo(0, 0);
};
ACTIONS.cl_archive = function(el){
  var c = clientById(el.getAttribute("data-id"));
  if(!c) return;
  clConfirmDo("Archive " + c.name + "? Their quotes, jobs and invoices stay on file; the client leaves the main list.", function(){
    c.archived = true;
    saveDB();
    selClientId = null;
    render();
  });
};
ACTIONS.cl_restore = function(el){
  var c = clientById(el.getAttribute("data-id"));
  if(!c) return;
  c.archived = false;
  saveDB();
  render();
};
ACTIONS.cl_delete = function(el){
  var c = clientById(el.getAttribute("data-id"));
  if(!c) return;
  var n = clQuotesOf(c.id).length + clJobsOf(c.id).length + clInvoicesOf(c.id).length;
  if(n > 0){ clNotify(c.name + " has " + n + " quotes/jobs/invoices on file. Archive instead of deleting so the records keep their client."); return; }
  clConfirmDo("Permanently delete " + c.name + "? This cannot be undone.", function(){
    DB.clients = DB.clients.filter(function(x){ return x.id !== c.id; });
    saveDB();
    selClientId = null;
    render();
  });
};
ACTIONS.cl_tab = function(el){
  CL.detailTab = el.getAttribute("data-t") || "overview";
  CL.contactEditId = null; CL.propEditId = null;
  render();
};
/* contacts */
ACTIONS.cl_contact_add = function(){
  var c = clientById(selClientId);
  if(!c) return;
  var name = clVal("cla-name");
  if(!name){ clNotify("The contact needs a name."); return; }
  c.contacts = c.contacts || [];
  c.contacts.push({ id: uid("ct"), name: name, role: clVal("cla-role"), phone: clVal("cla-phone"), email: clVal("cla-email") });
  saveDB(); render();
};
ACTIONS.cl_contact_edit = function(el){ CL.contactEditId = el.getAttribute("data-id"); render(); };
ACTIONS.cl_contact_cancel = function(){ CL.contactEditId = null; render(); };
ACTIONS.cl_contact_save = function(el){
  var c = clientById(selClientId);
  if(!c) return;
  var ct = (c.contacts || []).find(function(x){ return x.id === el.getAttribute("data-id"); });
  if(!ct) return;
  var name = clVal("cle-name");
  if(!name){ clNotify("The contact needs a name."); return; }
  ct.name = name; ct.role = clVal("cle-role"); ct.phone = clVal("cle-phone"); ct.email = clVal("cle-email");
  CL.contactEditId = null;
  saveDB(); render();
};
ACTIONS.cl_contact_del = function(el){
  var c = clientById(selClientId);
  if(!c) return;
  var ct = (c.contacts || []).find(function(x){ return x.id === el.getAttribute("data-id"); });
  if(!ct) return;
  clConfirmDo("Delete contact " + ct.name + "?", function(){
    c.contacts = c.contacts.filter(function(x){ return x.id !== ct.id; });
    if(CL.contactEditId === ct.id) CL.contactEditId = null;
    saveDB(); render();
  });
};
/* properties */
ACTIONS.cl_prop_add = function(){
  var c = clientById(selClientId);
  if(!c) return;
  var p = { address: clVal("clp-address"), community: clVal("clp-community"), plan: clVal("clp-plan"),
            livingSF: clVal("clp-living"), roofSF: clVal("clp-roof") };
  if(!p.address && !p.community){ clNotify("Add at least an address or a community."); return; }
  c.properties = c.properties || [];
  c.properties.push({ id: uid("p"), address: p.address, community: p.community, plan: p.plan, livingSF: p.livingSF, roofSF: p.roofSF });
  saveDB(); render();
};
ACTIONS.cl_prop_edit = function(el){ CL.propEditId = el.getAttribute("data-id"); render(); };
ACTIONS.cl_prop_cancel = function(){ CL.propEditId = null; render(); };
ACTIONS.cl_prop_save = function(el){
  var c = clientById(selClientId);
  if(!c) return;
  var p = (c.properties || []).find(function(x){ return x.id === el.getAttribute("data-id"); });
  if(!p) return;
  p.address = clVal("clpe-address"); p.community = clVal("clpe-community"); p.plan = clVal("clpe-plan");
  p.livingSF = clVal("clpe-living"); p.roofSF = clVal("clpe-roof");
  if(!p.address && !p.community){ clNotify("A property needs at least an address or a community."); return; }
  CL.propEditId = null;
  saveDB(); render();
};
ACTIONS.cl_prop_del = function(el){
  var c = clientById(selClientId);
  if(!c) return;
  var p = (c.properties || []).find(function(x){ return x.id === el.getAttribute("data-id"); });
  if(!p) return;
  clConfirmDo("Delete this property (" + (p.community || p.address || "property") + ")?", function(){
    c.properties = c.properties.filter(function(x){ return x.id !== p.id; });
    if(CL.propEditId === p.id) CL.propEditId = null;
    saveDB(); render();
  });
};
/* cross-module navigation */
ACTIONS.cl_open_quote = function(el){ clNav("quotes", el.getAttribute("data-id")); };
ACTIONS.cl_open_job = function(el){ clNav("jobs", el.getAttribute("data-id")); };
ACTIONS.cl_open_invoice = function(el){ clNav("invoices", el.getAttribute("data-id")); };
