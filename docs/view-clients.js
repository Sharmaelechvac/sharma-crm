/* =====================================================================
   SHARMA360 CRM v3 — CLIENTS module  (view-clients.js)
   Registers VIEWS.clients + ACTIONS.cl_* per V3-CONTRACT.md.

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
   Mostly cl-* classes; the .grid2/.amt.owed/label.f rules are layout
   fallbacks in case the core stylesheet has not defined them yet. */
function clStyleTag(){
  return '<style>' +
    '@media (min-width:900px){.cl-mobile{display:none}}' +
    '@media (max-width:899px){.cl-desktop{display:none}}' +
    '.cl-tbl{width:100%;border-collapse:collapse;background:#fff}' +
    '.cl-tbl th{text-align:left;font-size:.78rem;text-transform:uppercase;letter-spacing:.04em;color:#5b6b84;padding:10px 12px;border-bottom:1px solid #e3e8f0}' +
    '.cl-tbl td{padding:11px 12px;border-bottom:1px solid #eef1f6;vertical-align:middle}' +
    '.cl-tbl tbody tr{cursor:pointer}.cl-tbl tbody tr:hover{background:#f5f8fd}' +
    '.cl-tbl .r{text-align:right}.cl-owed{color:#c22f2f;font-weight:700}' +
    '.cl-money{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}' +
    '@media (min-width:900px){.cl-money{grid-template-columns:repeat(4,1fr)}}' +
    '.cl-tabs{display:flex;gap:6px;flex-wrap:wrap;margin:14px 0 4px}' +
    '.cl-tabs button{min-height:44px;padding:8px 14px;border-radius:999px;border:1px solid #d4dce8;background:#fff;font-weight:600;cursor:pointer}' +
    '.cl-tabs button.on{background:#264387;color:#fff;border-color:#264387}' +
    '.cl-tl{display:flex;gap:12px;padding:12px 0;border-bottom:1px solid #eef1f6}' +
    '.cl-tl:last-child{border-bottom:none}' +
    '.cl-badge{flex:0 0 auto;font-size:.68rem;font-weight:800;letter-spacing:.05em;padding:4px 8px;border-radius:6px;background:#e8edf6;color:#264387;height:fit-content}' +
    '.cl-actions{display:flex;gap:8px;flex-wrap:wrap}' +
    '.grid2{display:grid;grid-template-columns:1fr 1fr;gap:0 12px}' +
    '@media (max-width:560px){.grid2{grid-template-columns:1fr}}' +
    '.amt.owed{color:#c22f2f}' +
    'label.f{display:block}' +
    '</style>';
}

/* ---------------- LIST VIEW ---------------- */
function clListHTML(){
  var list = clFilteredClients();
  var total = DB.clients.filter(function(c){ return !c.archived; }).length;
  var h = clStyleTag();

  h += '<h2 class="view">Clients</h2>';

  /* toolbar */
  h += '<div class="toolbar">' +
    '<input type="text" id="cl-search" placeholder="Search name, contact, address, phone…" value="' + esc(CL.search) + '" autocomplete="off" oninput="CLSearch(this.value)">' +
    '<select id="cl-sort" onchange="CLSort(this.value)" aria-label="Sort clients">' +
      '<option value="name"' + (CL.sort === "name" ? " selected" : "") + '>Sort: Name A–Z</option>' +
      '<option value="owed"' + (CL.sort === "owed" ? " selected" : "") + '>Sort: Most owed</option>' +
      '<option value="recent"' + (CL.sort === "recent" ? " selected" : "") + '>Sort: Recent activity</option>' +
    '</select>' +
    '<button class="btn gold" data-act="cl_new">＋ New Client</button>' +
  '</div>';
  h += '<div class="chips">' +
    [["all", "All"], ["builder", "Builders"], ["homeowner", "Homeowners"], ["commercial", "Commercial"], ["archived", "Archived"]].map(function(pair){
      return '<button data-act="cl_filter" data-f="' + pair[0] + '"' + (CL.filter === pair[0] ? ' class="on"' : '') + '>' + pair[1] + '</button>';
    }).join("") + '</div>';
  h += '<p class="muted small">' +
    (CL.filter === "archived"
      ? list.length + (list.length === 1 ? " archived client" : " archived clients")
      : list.length + " of " + total + (total === 1 ? " client" : " clients")) +
  '</p>';

  if(list.length === 0){
    h += '<div class="empty">' +
      (CL.filter === "archived" ? "No archived clients."
        : (CL.search || CL.filter !== "all" ? "No clients match that search/filter." : "No clients yet — tap ＋ New Client to add the first one.")) +
    '</div>';
    return h;
  }

  /* phone / narrow: CRM rows */
  h += '<div class="cl-mobile">';
  list.forEach(function(c){
    var addr = clAddressLine(c);
    var ct = clPrimaryContact(c);
    var owed = clientBalanceOwed(c.id);
    h += '<button class="rowitem" data-act="cl_open" data-id="' + c.id + '">' +
      '<span class="avatar">' + clInitial(c) + '</span>' +
      '<span class="grow"><span class="name">' + esc(c.name) + '</span>' +
      '<div class="meta">' +
        (ct ? esc(ct.name) + (addr ? " · " : "") : "") + (addr ? esc(addr) : "") +
        (!ct && !addr ? clTypeLabel(c.type) + " · no property on file yet" : "") +
      '</div></span>' +
      (owed > 0 ? '<span class="amt owed">' + money(owed) + ' owed</span>' : '') +
      clTypePill(c) + '<span class="chev">›</span></button>';
  });
  h += '</div>';

  /* desktop: table */
  h += '<div class="cl-desktop card" style="padding:0;overflow:hidden"><table class="cl-tbl"><thead><tr>' +
    '<th>Client</th><th>Type</th><th>Contact</th><th>Properties</th><th class="r">Balance</th><th class="r">Quotes</th><th class="r">Jobs</th><th></th>' +
  '</tr></thead><tbody>';
  list.forEach(function(c){
    var addr = clAddressLine(c);
    var ct = clPrimaryContact(c);
    var owed = clientBalanceOwed(c.id);
    h += '<tr data-act="cl_open" data-id="' + c.id + '">' +
      '<td><span style="display:flex;gap:10px;align-items:center"><span class="avatar">' + clInitial(c) + '</span>' +
        '<span><b>' + esc(c.name) + '</b>' + (addr ? '<div class="small muted">' + esc(addr) + '</div>' : '') + '</span></span></td>' +
      '<td>' + clTypePill(c) + '</td>' +
      '<td>' + (ct ? esc(ct.name) + (ct.role ? '<div class="small muted">' + esc(ct.role) + '</div>' : '') : '<span class="muted">—</span>') + '</td>' +
      '<td>' + clPropertyCountLabel(c) + '</td>' +
      '<td class="r">' + (owed > 0 ? '<span class="cl-owed">' + money(owed) + '</span>' : '<span class="muted">—</span>') + '</td>' +
      '<td class="r">' + clQuotesOf(c.id).length + '</td>' +
      '<td class="r">' + clJobsOf(c.id).length + '</td>' +
      '<td class="r"><span class="chev">›</span></td></tr>';
  });
  h += '</tbody></table></div>';
  return h;
}

/* ---------------- CLIENT FORM (new / edit) ---------------- */
function clFormHTML(){
  var isNew = CL.formMode === "new";
  var c = isNew ? { name: "", type: "builder", phone: "", email: "", billingNotes: "", notes: "" }
                : (clientById(CL.formId) || { name: "", type: "builder", phone: "", email: "", billingNotes: "", notes: "" });
  var sel = function(t){ return String(c.type || "builder").toLowerCase() === t ? " selected" : ""; };
  var h = clStyleTag() + '<button class="backbtn" data-act="cl_cancel_form">← ' + (isNew ? "All clients" : "Back to client") + '</button>';
  h += '<div class="card"><h3 class="sec" style="margin-top:0">' + (isNew ? "New client" : "Edit client") + '</h3>';
  if(CL.formErr) h += '<div class="err" style="display:block">' + esc(CL.formErr) + '</div>';
  h += '<label class="f">Name *</label><input type="text" id="clf-name" value="' + esc(c.name) + '" autocomplete="off">';
  h += '<label class="f">Type</label><select id="clf-type">' +
    '<option value="builder"' + sel("builder") + '>Builder</option>' +
    '<option value="homeowner"' + sel("homeowner") + '>Homeowner</option>' +
    '<option value="commercial"' + sel("commercial") + '>Commercial</option></select>';
  h += '<div class="grid2"><div><label class="f">Phone</label><input type="tel" id="clf-phone" value="' + esc(c.phone || "") + '"></div>' +
       '<div><label class="f">Email</label><input type="email" id="clf-email" value="' + esc(c.email || "") + '"></div></div>';
  h += '<label class="f">Billing notes</label><textarea id="clf-billing" placeholder="Terms, where invoices go, draw schedule…">' + esc(c.billingNotes || "") + '</textarea>';
  h += '<label class="f">Notes</label><textarea id="clf-notes">' + esc(c.notes || "") + '</textarea>';

  if(isNew){
    h += '<h3 class="sec">First contact <span class="muted small">(optional)</span></h3>' +
      '<label class="f">Contact name</label><input type="text" id="clf-ct-name" autocomplete="off">' +
      '<label class="f">Role</label><input type="text" id="clf-ct-role" placeholder="Purchasing, PM, owner…">' +
      '<div class="grid2"><div><label class="f">Contact phone</label><input type="tel" id="clf-ct-phone"></div>' +
      '<div><label class="f">Contact email</label><input type="email" id="clf-ct-email"></div></div>';
    h += '<h3 class="sec">First property <span class="muted small">(optional)</span></h3>' +
      '<label class="f">Address</label><input type="text" id="clf-p-address" autocomplete="off">' +
      '<label class="f">Community</label><input type="text" id="clf-p-community">' +
      '<label class="f">Plan</label><input type="text" id="clf-p-plan">' +
      '<div class="grid2"><div><label class="f">Living SF</label><input type="number" id="clf-p-living" inputmode="numeric" placeholder="Blank = not on file"></div>' +
      '<div><label class="f">Under Roof SF</label><input type="number" id="clf-p-roof" inputmode="numeric" placeholder="Blank = not on file"></div></div>';
  }
  h += '<div class="cl-actions" style="margin-top:16px">' +
    '<button class="btn gold" data-act="cl_save">' + (isNew ? "Add client" : "Save changes") + '</button>' +
    '<button class="btn ghost" data-act="cl_cancel_form">Cancel</button></div>';
  h += '</div>';
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
  if(!c) return '<div class="empty">That client no longer exists.</div>';
  var cm = clientMoney(c.id);
  var qs = clQuotesOf(c.id), js = clJobsOf(c.id), is = clInvoicesOf(c.id);
  var h = clStyleTag() + '<button class="backbtn" data-act="cl_back">← All clients</button>';

  /* header card */
  h += '<div class="card"><div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap">' +
    '<div style="display:flex;gap:12px;align-items:center"><span class="avatar">' + clInitial(c) + '</span>' +
    '<div><div style="font-size:1.3rem;font-weight:800;line-height:1.2">' + esc(c.name) + '</div>' +
    '<div style="margin-top:4px">' + clTypePill(c) +
    (c.archived ? ' <span class="pill grey">Archived</span>' : '') + '</div></div></div>' +
    '<div class="cl-actions">' +
      '<button class="btn" data-act="cl_edit" data-id="' + c.id + '">Edit</button>' +
      (c.archived
        ? '<button class="btn" data-act="cl_restore" data-id="' + c.id + '">Restore</button>' +
          '<button class="btn ghost" data-act="cl_delete" data-id="' + c.id + '">Delete permanently</button>'
        : '<button class="btn ghost" data-act="cl_archive" data-id="' + c.id + '">Archive</button>') +
    '</div></div>';
  if(c.phone) h += '<div class="kv"><span class="k">Phone</span><span class="v">' + esc(c.phone) + '</span></div>';
  if(c.email) h += '<div class="kv"><span class="k">Email</span><span class="v">' + esc(c.email) + '</span></div>';
  if(c.billingNotes) h += '<div class="kv"><span class="k">Billing notes</span><span class="v">' + esc(c.billingNotes) + '</span></div>';
  if(c.notes) h += '<div class="kv"><span class="k">Notes</span><span class="v">' + esc(c.notes) + '</span></div>';
  if(!c.phone && !c.email && !c.billingNotes && !c.notes)
    h += '<p class="muted small" style="margin-bottom:0">No phone, email or notes on file yet — tap Edit to add them.</p>';
  h += '</div>';

  /* money strip */
  h += '<div class="cl-money stats">' +
    '<div class="stat"><div class="n">' + money(cm.quoted) + '</div><div class="l">Quoted</div></div>' +
    '<div class="stat"><div class="n">' + money(cm.invoiced) + '</div><div class="l">Invoiced</div></div>' +
    '<div class="stat"><div class="n">' + money(cm.paid) + '</div><div class="l">Paid</div></div>' +
    '<div class="stat' + (cm.owed > 0 ? " alert" : "") + '"><div class="n">' + money(cm.owed) + '</div><div class="l">Balance owed</div></div></div>';

  /* section tabs */
  var tabs = [["overview", "Overview"], ["quotes", "Quotes (" + qs.length + ")"],
              ["jobs", "Jobs (" + js.length + ")"], ["invoices", "Invoices (" + is.length + ")"],
              ["activity", "Activity"]];
  h += '<div class="cl-tabs">' + tabs.map(function(t){
    return '<button data-act="cl_tab" data-t="' + t[0] + '"' + (CL.detailTab === t[0] ? ' class="on"' : '') + '>' + t[1] + '</button>';
  }).join("") + '</div>';

  if(CL.detailTab === "overview") h += clOverviewHTML(c);
  else if(CL.detailTab === "quotes") h += clRecordListHTML("quotes", c, qs);
  else if(CL.detailTab === "jobs") h += clRecordListHTML("jobs", c, js);
  else if(CL.detailTab === "invoices") h += clRecordListHTML("invoices", c, is);
  else if(CL.detailTab === "activity") h += clActivityHTML(c);
  return h;
}

function clOverviewHTML(c){
  var h = "";
  /* contacts */
  h += '<h3 class="sec">Contacts (' + (c.contacts || []).length + ')</h3>';
  if((c.contacts || []).length === 0) h += '<div class="empty">No contacts on file for this client yet.</div>';
  (c.contacts || []).forEach(function(ct){
    if(CL.contactEditId === ct.id){
      h += '<div class="card"><b>Edit contact</b>' +
        '<label class="f">Name *</label><input type="text" id="cle-name" value="' + esc(ct.name) + '">' +
        '<label class="f">Role</label><input type="text" id="cle-role" value="' + esc(ct.role || "") + '">' +
        '<div class="grid2"><div><label class="f">Phone</label><input type="tel" id="cle-phone" value="' + esc(ct.phone || "") + '"></div>' +
        '<div><label class="f">Email</label><input type="email" id="cle-email" value="' + esc(ct.email || "") + '"></div></div>' +
        '<div class="cl-actions" style="margin-top:12px"><button class="btn" data-act="cl_contact_save" data-id="' + ct.id + '">Save contact</button>' +
        '<button class="btn ghost" data-act="cl_contact_cancel">Cancel</button></div></div>';
    } else {
      h += '<div class="card" style="padding:13px 16px"><div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start">' +
        '<div><b>' + esc(ct.name) + '</b>' + (ct.role ? ' <span class="muted">· ' + esc(ct.role) + '</span>' : '') +
        (ct.phone ? '<div class="small muted">Phone: ' + esc(ct.phone) + '</div>' : '') +
        (ct.email ? '<div class="small muted">Email: ' + esc(ct.email) + '</div>' : '') + '</div>' +
        '<span class="cl-actions"><button class="btn ghost" data-act="cl_contact_edit" data-id="' + ct.id + '">Edit</button>' +
        '<button class="btn ghost" data-act="cl_contact_del" data-id="' + ct.id + '">Delete</button></span></div></div>';
    }
  });
  h += '<div class="card"><b>Add a contact</b>' +
    '<label class="f">Name *</label><input type="text" id="cla-name">' +
    '<label class="f">Role</label><input type="text" id="cla-role" placeholder="Purchasing, PM, homeowner…">' +
    '<div class="grid2"><div><label class="f">Phone</label><input type="tel" id="cla-phone"></div>' +
    '<div><label class="f">Email</label><input type="email" id="cla-email"></div></div>' +
    '<button class="btn block" data-act="cl_contact_add" style="margin-top:14px">Add contact</button></div>';

  /* properties */
  h += '<h3 class="sec">Properties (' + (c.properties || []).length + ')</h3>';
  if((c.properties || []).length === 0) h += '<div class="empty">No properties on file for this client yet.</div>';
  (c.properties || []).forEach(function(p){
    if(CL.propEditId === p.id){
      h += '<div class="card"><b>Edit property</b>' +
        '<label class="f">Address</label><input type="text" id="clpe-address" value="' + esc(p.address || "") + '">' +
        '<label class="f">Community</label><input type="text" id="clpe-community" value="' + esc(p.community || "") + '">' +
        '<label class="f">Plan</label><input type="text" id="clpe-plan" value="' + esc(p.plan || "") + '">' +
        '<div class="grid2"><div><label class="f">Living SF</label><input type="number" id="clpe-living" inputmode="numeric" value="' + esc(p.livingSF || "") + '" placeholder="Blank = not on file"></div>' +
        '<div><label class="f">Under Roof SF</label><input type="number" id="clpe-roof" inputmode="numeric" value="' + esc(p.roofSF || "") + '" placeholder="Blank = not on file"></div></div>' +
        '<div class="cl-actions" style="margin-top:12px"><button class="btn" data-act="cl_prop_save" data-id="' + p.id + '">Save property</button>' +
        '<button class="btn ghost" data-act="cl_prop_cancel">Cancel</button></div></div>';
    } else {
      h += '<div class="card" style="padding:13px 16px"><div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start">' +
        '<div><b>' + esc(p.community || p.address || "—") + '</b>' +
        (p.community && p.address ? ' <span class="muted">· ' + esc(p.address) + '</span>' : '') +
        (p.plan ? '<div class="small muted">Plan: ' + esc(p.plan) + '</div>' : '') +
        '<div class="small muted">Living SF: ' + (p.livingSF ? esc(p.livingSF) : "not on file") +
        ' · Under Roof SF: ' + (p.roofSF ? esc(p.roofSF) : "not on file") + '</div></div>' +
        '<span class="cl-actions"><button class="btn ghost" data-act="cl_prop_edit" data-id="' + p.id + '">Edit</button>' +
        '<button class="btn ghost" data-act="cl_prop_del" data-id="' + p.id + '">Delete</button></span></div></div>';
    }
  });
  h += '<div class="card"><b>Add a property</b>' +
    '<label class="f">Address</label><input type="text" id="clp-address">' +
    '<label class="f">Community</label><input type="text" id="clp-community">' +
    '<label class="f">Plan</label><input type="text" id="clp-plan">' +
    '<div class="grid2"><div><label class="f">Living SF</label><input type="number" id="clp-living" inputmode="numeric" placeholder="Blank = not on file"></div>' +
    '<div><label class="f">Under Roof SF</label><input type="number" id="clp-roof" inputmode="numeric" placeholder="Blank = not on file"></div></div>' +
    '<button class="btn block" data-act="cl_prop_add" style="margin-top:14px">Add property</button></div>';
  return h;
}

function clRecordListHTML(kind, c, list){
  var h = "";
  if(kind === "quotes"){
    h += '<h3 class="sec">Quotes (' + list.length + ')</h3>';
    if(list.length === 0) h += '<div class="empty">No quotes for this client yet.</div>';
    list.slice().sort(function(a, b){ return String(b.createdAt || "") < String(a.createdAt || "") ? -1 : 1; }).forEach(function(q){
      h += '<button class="rowitem" data-act="cl_open_quote" data-id="' + q.id + '"><span class="grow">' +
        '<span class="name">' + q.number + ' · ' + esc(quoteTitle(q)) + '</span>' +
        '<div class="meta">' + q.trade + ' · ' + fmtDate(q.createdAt) + '</div></span>' +
        '<span class="amt">' + money(quoteTotal(q)) + '</span>' + quotePill(q.status) + '<span class="chev">›</span></button>';
    });
  } else if(kind === "jobs"){
    h += '<h3 class="sec">Jobs (' + list.length + ')</h3>';
    if(list.length === 0) h += '<div class="empty">No jobs for this client yet.</div>';
    list.slice().sort(function(a, b){ return String(b.createdAt || "") < String(a.createdAt || "") ? -1 : 1; }).forEach(function(j){
      h += '<button class="rowitem" data-act="cl_open_job" data-id="' + j.id + '"><span class="grow">' +
        '<span class="name">' + esc(clJobLabel(j)) + '</span>' +
        '<div class="meta">' + (j.trade || "") + ' · ' + jobDoneCount(j) + ' of 5 stages done' + (j.createdAt ? ' · ' + fmtDate(j.createdAt) : '') + '</div></span>' +
        '<span class="amt">' + money(jobAmount(j)) + '</span>' + jobPill(j) + '<span class="chev">›</span></button>';
    });
  } else {
    h += '<h3 class="sec">Invoices (' + list.length + ')</h3>';
    if(list.length === 0) h += '<div class="empty">No invoices for this client yet.</div>';
    list.slice().sort(function(a, b){ return String(b.createdAt || "") < String(a.createdAt || "") ? -1 : 1; }).forEach(function(inv){
      var bal = invoiceBalance(inv);
      h += '<button class="rowitem" data-act="cl_open_invoice" data-id="' + inv.id + '"><span class="grow">' +
        '<span class="name">' + inv.number + '</span>' +
        '<div class="meta">' + fmtDate(inv.sentAt || inv.createdAt) + (bal > 0 && inv.status !== "Draft" ? ' · ' + money(bal) + ' balance' : '') + '</div></span>' +
        '<span class="amt">' + money(inv.amount) + '</span>' + invoicePill(inv) + '<span class="chev">›</span></button>';
    });
  }
  return h;
}

/* Merged timeline of the client's quotes, jobs, invoices + payments. */
function clActivityHTML(c){
  var ev = [];
  clQuotesOf(c.id).forEach(function(q){
    ev.push({ date: q.createdAt || "", kind: "QUOTE", act: "cl_open_quote", id: q.id,
      text: q.number + " — " + quoteTitle(q), sub: q.status + " · " + money(quoteTotal(q)) });
  });
  clJobsOf(c.id).forEach(function(j){
    ev.push({ date: j.createdAt || "", kind: "JOB", act: "cl_open_job", id: j.id,
      text: clJobLabel(j), sub: jobDisplayStatus(j) + " · " + jobDoneCount(j) + " of 5 stages done · " + money(jobAmount(j)) });
  });
  clInvoicesOf(c.id).forEach(function(inv){
    ev.push({ date: inv.createdAt || "", kind: "INVOICE", act: "cl_open_invoice", id: inv.id,
      text: inv.number, sub: displayInvoiceStatus(inv) + " · " + money(inv.amount) });
    (inv.payments || []).forEach(function(p){
      ev.push({ date: p.date || inv.createdAt || "", kind: "PAYMENT", act: "cl_open_invoice", id: inv.id,
        text: "Payment on " + inv.number, sub: money(p.amount) + (p.method ? " · " + p.method : "") + (p.ref ? " · " + p.ref : "") });
    });
  });
  ev.sort(function(a, b){ return a.date < b.date ? 1 : (a.date > b.date ? -1 : 0); });
  var h = '<h3 class="sec">Activity (' + ev.length + ')</h3>';
  if(ev.length === 0) return h + '<div class="empty">No activity for this client yet.</div>';
  h += '<div class="card">';
  ev.forEach(function(e){
    h += '<div class="cl-tl"><span class="cl-badge">' + e.kind + '</span>' +
      '<span class="grow"><button class="rowitem" style="border:none;padding:0;min-height:0" data-act="' + e.act + '" data-id="' + e.id + '">' +
      '<span class="grow"><span class="name">' + esc(e.text) + '</span>' +
      '<div class="meta">' + esc(e.sub) + '</div></span><span class="chev">›</span></button></span>' +
      '<span class="muted small" style="flex:0 0 auto">' + (e.date ? fmtDate(e.date) : "") + '</span></div>';
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
