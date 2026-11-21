/* ============================================================================
   SHARMA360 CRM v4 — INVOICES module (view-invoices.js)
   Invoice workflow: summary strip, searchable/filterable list,
   the Invoice Maker (from scratch with line items + product picker, or from
   a job at full amount / stage-draw %), invoice detail with partial-payment
   recording, and a printable invoice document.
   v4: Apple-design restyle (grouped stat group, .dhead detail header with
   hero amount, §9.6 item rows, §9.8 .doc document — DRAFT is now the quiet
   .tag-draft in the header, no diagonal watermark). Data logic, ACTIONS /
   VIEWS names and price gates are unchanged from v3.
   New class hooks introduced for style.css: .inv-head (parallel to
   .q-head), .inv-count, .inv-search, .inv-sort, .trail (row trailing
   column: amount over pill), .items/.lrow (grouped line-item rows),
   .addrow (tint add-line row), .dangerzone (bottom destructive group),
   .doc-rule (doc hairline), .dh-num/.dh-pills/.dh-hero (detail-header
   family, joining core's .dh-top/.dh-sub/.dh-actions).

   Registers:  VIEWS.invoices, ACTIONS.inv_*  (all actions prefixed "inv_").

   Core contract used (V3-CONTRACT.md): DB, saveDB(), money(), esc(),
   fmtDate(), todayStr(), daysBetween(), uid(), clientById(), quoteById(),
   jobById(), invoiceById(), jobAmount(), jobInvoiced(), invoicePaidSum(),
   invoiceBalance(), invoiceIsPastDue(), displayInvoiceStatus(),
   propertyLabel(), invoicePill(), PRODUCTS, isOwner()/ROLE, openForm(html),
   render().

   Assumptions documented for the integrator:
   - Forms: the maker is opened through core's openForm(html) when available
     and closed through core's closeForm() (which clears core's FORM_HTML);
     if openForm is not a function, the maker renders as the invoices tab
     view instead (INV.formOpen fallback) — either way ACTIONS drive it.
   - After any state change this module calls core's render() to redraw.
   - Cross-navigation: the Clients/Jobs detail state belongs to those modules,
     so inv_openClient / inv_openJob set the conventional selection globals
     (selClientId / selJobId, as the v2 app used) when they exist, then click
     the shell's [data-nav="clients"] / [data-nav="jobs"] element (falling
     back to a global go()/switchTab() if core exposes one).
   - Extra fields stored on invoice records created here (beyond the contract
     shape, harmless to the data layer): `lines` [{desc,qty,price}] for
     from-scratch invoices, and `notes`.
   - CSS: the document uses core's .doc system (.doc-head/.doc-co/.doc-title/
     .doc-num/.doc-parties/.doc-totals/.doc-foot — core's @media print
     shows only .doc), the detail uses .dhead + .detail-grid/.col-main/
     .col-side + .dh-actions, totals use .lines-total/.grand, and lists reuse
     .stats/.stat, .chips, .rowitem, .segbtns, .linerow.
     Classes this module uses (style.css should define them):
       .invtable / .inv-tablewrap / .inv-rowswrap — desktop table vs phone
         rows (hide .inv-tablewrap below 900px, .inv-rowswrap at ≥900px)
       .tag-draft — the red "DRAFT — not sent" tag (was in the v2 CSS).
   ========================================================================== */
(function(){
"use strict";

/* ---------------- module state ---------------- */
const INV = {
  q: "",                 /* list search text */
  filter: "All",         /* All | Draft | Awaiting payment | Past due | Paid */
  sort: "new",           /* new | old | amt | bal */
  selId: null,           /* invoice open in detail */
  docId: null,           /* invoice open as printable document */
  draft: null,           /* maker draft (module-owned, survives re-renders) */
  editingId: null,       /* invoice id loaded in the maker, null = new */
  formOpen: false,       /* fallback form mode when core has no openForm */
  formViaOpen: false,    /* maker was opened through core's openForm() */
  payErr: "",            /* record-payment error, shown on the detail */
  confirmDel: null,      /* invoice id armed for delete confirmation */
  flash: ""              /* one-line confirmation shown on list/detail */
};

const INV_FILTERS = ["All", "Draft", "Awaiting payment", "Past due", "Paid"];
const PAY_METHODS = ["Check", "ACH", "Card", "Zelle", "Cash"];

/* ---------------- small local helpers ---------------- */
function invRound2(n){ return Math.round((Number(n) || 0) * 100) / 100; }
function invIsOwner(){
  if(typeof isOwner === "function") return isOwner();
  return (typeof ROLE !== "undefined" && ROLE === "Owner");
}
function invRender(){ if(typeof render === "function") render(); }
function invEl(sel){ return document.querySelector(sel); }
function invField(id){
  const el = document.getElementById ? document.getElementById(id) : invEl("#" + id);
  return el ? el.value : "";
}
function invAddDays(iso, days){
  const p = String(iso || "").split("-");
  if(p.length !== 3) return iso;
  const d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  d.setDate(d.getDate() + days);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return d.getFullYear() + "-" + mm + "-" + dd;
}
function invClientName(inv){
  const c = inv ? clientById(inv.clientId) : null;
  return c ? c.name : "Unknown client";
}
function invJobLabel(inv){
  const j = inv.jobId ? jobById(inv.jobId) : null;
  if(j) return j.title || ("Job #" + (j.jobberNumber || ""));
  const q = inv.quoteId ? quoteById(inv.quoteId) : null;
  if(q) return q.number + " · " + quoteTitle(q);
  return "—";
}
function invJobShort(inv){
  const j = inv.jobId ? jobById(inv.jobId) : null;
  if(j) return j.title || ("Job #" + (j.jobberNumber || ""));
  return "";
}
function invCatLabel(cat){
  const map = { devices: "Devices", fixtures: "Fixtures", service: "Service gear",
    wire: "Wire & cable", boxes: "Boxes & conduit", grounding: "Grounding",
    panels: "Panels & breakers", equipment: "Equipment", thermostats: "Thermostats",
    accessories: "Accessories", heat: "Heat kits", ahri: "AHRI ratings", uncategorized: "Other" };
  return map[cat] || (cat ? cat.charAt(0).toUpperCase() + cat.slice(1) : "Other");
}

/* ---------------- summary + list computation ---------------- */
function invSummary(){
  const s = { awaiting: 0, awaitingN: 0, pastDue: 0, pastDueN: 0,
              draftN: 0, draftTotal: 0, paidMonth: 0, paidMonthN: 0 };
  const ym = todayStr().slice(0, 7);
  DB.invoices.forEach(inv => {
    if(recArchived(inv)) return;
    const st = displayInvoiceStatus(inv);
    if(st === "Awaiting payment"){ s.awaiting += invoiceBalance(inv); s.awaitingN++; }
    else if(st === "Past due"){ s.pastDue += invoiceBalance(inv); s.pastDueN++; }
    else if(st === "Draft"){ s.draftN++; s.draftTotal += Number(inv.amount) || 0; }
    (inv.payments || []).forEach(p => {
      if(String(p.date || "").slice(0, 7) === ym){ s.paidMonth += Number(p.amount) || 0; s.paidMonthN++; }
    });
  });
  s.awaiting = invRound2(s.awaiting); s.pastDue = invRound2(s.pastDue);
  s.paidMonth = invRound2(s.paidMonth);
  return s;
}
function invFiltered(){
  const q = INV.q.trim().toLowerCase();
  const list = DB.invoices.filter(inv => {
    if(recArchived(inv)) return false;
    if(INV.filter !== "All" && displayInvoiceStatus(inv) !== INV.filter) return false;
    if(!q) return true;
    const num = String(inv.number || "").toLowerCase();
    const digits = num.replace(/[^0-9]/g, "");
    return num.includes(q) || digits.includes(q.replace(/[^0-9]/g, "") || q) ||
           invClientName(inv).toLowerCase().includes(q);
  });
  const numOf = inv => parseInt(String(inv.number || "").replace(/[^0-9]/g, ""), 10) || 0;
  if(INV.sort === "old") list.sort((a, b) => String(a.createdAt || "").localeCompare(String(b.createdAt || "")) || numOf(a) - numOf(b));
  else if(INV.sort === "amt") list.sort((a, b) => (Number(b.amount) || 0) - (Number(a.amount) || 0));
  else if(INV.sort === "bal") list.sort((a, b) => invoiceBalance(b) - invoiceBalance(a));
  else list.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")) || numOf(b) - numOf(a));
  return list;
}

/* ============================================================================
   LIST VIEW
   ========================================================================== */
function invListHTML(){
  const s = invSummary();
  const list = invFiltered();
  let h = "";
  h += '<div class="inv-head"><h2 class="view">Invoices</h2>' +
    '<button class="btn gold" data-act="inv_new">+ New Invoice</button></div>';
  if(INV.flash) h += '<div class="okmsg">' + esc(INV.flash) + "</div>";

  /* summary strip — one grouped stat card, hairline dividers (§9.2) */
  h += '<div class="stats">' +
    '<div class="stat"><div class="n">' + money(s.awaiting) + '</div><div class="l">Awaiting payment</div><div class="s">' + s.awaitingN + (s.awaitingN === 1 ? " invoice" : " invoices") + "</div></div>" +
    '<div class="stat' + (s.pastDue > 0 ? " alert" : "") + '"><div class="n">' + money(s.pastDue) + '</div><div class="l">Past due</div><div class="s">' + s.pastDueN + (s.pastDueN === 1 ? " invoice" : " invoices") + "</div></div>" +
    '<div class="stat"><div class="n">' + money(s.paidMonth) + '</div><div class="l">Paid this month</div><div class="s">' + s.paidMonthN + (s.paidMonthN === 1 ? " payment" : " payments") + "</div></div>" +
    '<div class="stat"><div class="n">' + s.draftN + '</div><div class="l">Drafts</div><div class="s">' + money(s.draftTotal) + " not sent</div></div>" +
    "</div>";

  /* toolbar */
  h += '<div class="toolbar">' +
    '<input type="search" id="inv-q" class="inv-search" placeholder="Search invoice # or client…" value="' + esc(INV.q) + '" autocomplete="off">' +
    '<select id="inv-sort" class="inv-sort" aria-label="Sort invoices">' +
      '<option value="new"' + (INV.sort === "new" ? " selected" : "") + ">Newest first</option>" +
      '<option value="old"' + (INV.sort === "old" ? " selected" : "") + ">Oldest first</option>" +
      '<option value="amt"' + (INV.sort === "amt" ? " selected" : "") + ">Amount — high to low</option>" +
      '<option value="bal"' + (INV.sort === "bal" ? " selected" : "") + ">Balance — high to low</option>" +
    "</select></div>";
  h += '<div class="chips">' + INV_FILTERS.map(f =>
      '<button data-act="inv_filter" data-f="' + f + '"' + (INV.filter === f ? ' class="on"' : "") + ">" + f + "</button>").join("") + "</div>";
  h += '<div class="inv-count">Showing ' + list.length + " of " + DB.invoices.filter(i => !recArchived(i)).length + " invoices</div>";

  if(DB.invoices.length === 0){
    h += '<div class="empty">No invoices yet. Build the first one with the Invoice Maker — from scratch, or straight from a job.</div>';
    return h;
  }
  if(list.length === 0){
    h += '<div class="empty">No invoices match that search/filter.</div>';
    return h;
  }

  /* desktop table (§5.8: no vertical borders/zebra/coloured header,
     44px rows, right-aligned tabular amounts) */
  h += '<div class="inv-tablewrap"><table class="invtable lines"><thead><tr>' +
    "<th>Invoice #</th><th>Client</th><th>Job</th><th>Issued</th>" +
    '<th class="r">Amount</th><th class="r">Balance</th><th>Status</th>' +
    "</tr></thead><tbody>";
  list.forEach(inv => {
    const bal = invoiceBalance(inv);
    h += '<tr data-act="inv_open" data-id="' + inv.id + '">' +
      "<td>" + esc(inv.number) + "</td>" +
      "<td>" + esc(invClientName(inv)) + "</td>" +
      "<td>" + esc(invJobLabel(inv)) + "</td>" +
      "<td>" + fmtDate(inv.createdAt) + "</td>" +
      '<td class="r">' + money(inv.amount) + "</td>" +
      '<td class="r">' + (bal > 0 ? money(bal) : "—") + "</td>" +
      "<td>" + invoicePill(inv) + "</td></tr>";
  });
  h += "</tbody></table></div>";

  /* phone rows (§9.3: trailing column = amount over pill, no chevron) */
  h += '<div class="inv-rowswrap">';
  list.forEach(inv => {
    const bal = invoiceBalance(inv);
    const initial = (invClientName(inv).trim().charAt(0) || "?").toUpperCase();
    h += '<button class="rowitem" data-act="inv_open" data-id="' + inv.id + '">' +
      '<span class="avatar">' + esc(initial) + "</span>" +
      '<span class="grow"><span class="name">' + esc(inv.number) + " · " + esc(invClientName(inv)) + "</span>" +
      '<div class="meta">' + esc(invJobLabel(inv)) + " · Issued " + fmtDate(inv.createdAt) +
        (inv.basis === "draw" ? " · Draw " + inv.drawPct + "%" : "") + "</div></span>" +
      '<span class="trail"><span class="amt">' + money(inv.amount) + "</span>" +
        (bal > 0 && inv.status !== "Draft" ? '<span class="amt owed">' + money(bal) + " owed</span>" : "") +
      invoicePill(inv) + "</span></button>";
  });
  h += "</div>";
  return h;
}
function bindInvList(){
  const q = invEl("#inv-q");
  if(q && !q._invBound){ q._invBound = true; q.addEventListener("input", () => {
    INV.q = q.value;
    invRender();
    const nq = invEl("#inv-q");
    if(nq){ nq.focus(); try { nq.setSelectionRange(nq.value.length, nq.value.length); } catch(e){} }
  }); }
  const so = invEl("#inv-sort");
  if(so && !so._invBound){ so._invBound = true; so.addEventListener("change", () => { INV.sort = so.value; invRender(); }); }
}

/* ============================================================================
   INVOICE MAKER (form)
   ========================================================================== */
function invNewDraft(){
  return { mode: "scratch", clientId: "", jobId: "", trade: "", basis: "full",
           drawPct: "", lines: [{ desc: "", qty: 1, price: "" }],
           issueDate: todayStr(), dueDate: "", notes: "", err: "" };
}
function invDraftFromInvoice(inv){
  const d = invNewDraft();
  d.clientId = inv.clientId || "";
  d.jobId = inv.jobId || "";
  d.trade = inv.trade || "";
  d.basis = inv.basis === "draw" ? "draw" : "full";
  d.drawPct = inv.drawPct != null ? String(inv.drawPct) : "";
  d.issueDate = inv.createdAt || todayStr();
  d.dueDate = inv.dueDate || "";
  d.notes = inv.notes || "";
  if(inv.jobId){ d.mode = "job"; }
  else if(inv.lines && inv.lines.length){
    d.mode = "scratch";
    d.lines = inv.lines.map(l => ({ desc: l.desc || "", qty: l.qty != null ? l.qty : 1, price: l.price != null ? l.price : "" }));
  } else {
    d.mode = "scratch";
    d.lines = [{ desc: inv.basis === "draw" ? ("Stage draw — " + inv.drawPct + "%") : "Full amount",
                 qty: 1, price: inv.amount != null ? inv.amount : "" }];
  }
  return d;
}
function invLinesTotal(lines){
  return invRound2((lines || []).reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.price) || 0), 0));
}
function invJobModeAmount(){
  const d = INV.draft;
  const j = d && d.jobId ? jobById(d.jobId) : null;
  if(!j) return 0;
  const total = jobAmount(j);
  if(d.basis === "draw"){
    const pct = Number(d.drawPct) || 0;
    return invRound2(Math.round(total * pct) / 100);
  }
  return invRound2(total);
}
/* Read the live form DOM back into INV.draft before any structural re-render. */
function invSyncDraft(){
  const d = INV.draft;
  if(!d) return;
  if(d.mode === "scratch"){
    const c = document.getElementById("invf-client"); if(c) d.clientId = c.value;
    const jl = document.getElementById("invf-joblink"); if(jl) d.jobId = jl.value;
    const t = document.getElementById("invf-trade"); if(t) d.trade = t.value;
    const rows = document.querySelectorAll("#invf-lines .linerow");
    if(rows && rows.length){
      d.lines = Array.prototype.map.call(rows, r => ({
        desc: r.querySelector(".li-desc") ? r.querySelector(".li-desc").value : "",
        qty: r.querySelector(".li-qty") ? r.querySelector(".li-qty").value : 1,
        price: r.querySelector(".li-price") ? r.querySelector(".li-price").value : ""
      }));
    }
  } else {
    const j = document.getElementById("invf-job"); if(j) d.jobId = j.value;
    const b = document.getElementById("invf-basis"); if(b) d.basis = b.value;
    const p = document.getElementById("invf-pct"); if(p) d.drawPct = p.value;
  }
  const is = document.getElementById("invf-issue"); if(is) d.issueDate = is.value;
  const du = document.getElementById("invf-due"); if(du) d.dueDate = du.value;
  const no = document.getElementById("invf-notes"); if(no) d.notes = no.value;
}
function invLineRowHTML(l){
  l = l || { desc: "", qty: 1, price: "" };
  return '<div class="linerow"><input type="text" class="li-desc" placeholder="Description" value="' + esc(l.desc) + '">' +
    '<input type="number" class="li-qty" min="0" step="any" inputmode="decimal" value="' + esc(l.qty) + '" aria-label="Quantity">' +
    '<input type="number" class="li-price" min="0" step="any" inputmode="decimal" placeholder="$ Unit price" value="' + esc(l.price) + '" aria-label="Unit price">' +
    '<button type="button" class="del" data-act="inv_delLine" title="Remove line">✕</button></div>';
}
function invProductPickerHTML(){
  const cats = {};
  PRODUCTS.forEach((p, i) => { (cats[p.category] = cats[p.category] || []).push(i); });
  let h = '<label class="f">Add a line from the product library</label>' +
    '<div class="prodrow"><select id="invf-product"><option value="">Pick a product…</option>';
  Object.keys(cats).sort().forEach(cat => {
    h += '<optgroup label="' + esc(invCatLabel(cat)) + '">';
    cats[cat].forEach(i => {
      const p = PRODUCTS[i];
      h += '<option value="' + i + '">' + esc(p.name + (p.model ? " — " + p.model : "")) + "</option>";
    });
    h += "</optgroup>";
  });
  h += '</select><button type="button" class="btn ghost" data-act="inv_addProduct">Add</button></div>' +
    '<p class="muted small">The picker fills the description and model only — the price stays blank for the Owner to price. Prices are never pulled in automatically.</p>';
  return h;
}
function invJobOptions(selectedId, clientId){
  let jobs = DB.jobs.slice().reverse();
  if(clientId) jobs = jobs.filter(j => j.clientId === clientId);
  return jobs.map(j => {
    const c = clientById(j.clientId);
    return '<option value="' + j.id + '"' + (selectedId === j.id ? " selected" : "") + ">" +
      esc((c ? c.name : "Unknown client") + " · " + (j.title || ("Job #" + (j.jobberNumber || ""))) + " · " + j.trade + " · " + money(jobAmount(j))) + "</option>";
  }).join("");
}
function invMakerHTML(){
  const d = INV.draft;
  const editing = INV.editingId ? invoiceById(INV.editingId) : null;
  let h = '<div id="invoiceform">';
  if(!invIsOwner()){
    h += '<div class="card"><h3 class="sec">Invoice Maker</h3>' +
      '<p class="muted">Only the Owner can build or edit invoices — prices are the Owner\'s call. ' +
      "Office can record payments on sent invoices from the invoice itself.</p>" +
      '<button class="btn ghost block" data-act="inv_cancel">Close</button></div></div>';
    return h;
  }
  /* details group: mode toggle + who/what (§9.5 grouped form) */
  h += '<div class="card"><h3 class="sec">' +
    (editing ? "Edit invoice " + esc(editing.number) : "Invoice Maker — new invoice") + "</h3>";
  h += '<div class="segbtns">' +
    '<button type="button" data-act="inv_mode" data-m="scratch" class="' + (d.mode === "scratch" ? "on-sched" : "") + '">From scratch</button>' +
    '<button type="button" data-act="inv_mode" data-m="job" class="' + (d.mode === "job" ? "on-sched" : "") + '">From a job</button></div>';

  let totalsCard = "";
  if(d.mode === "scratch"){
    h += '<label class="f">Client *</label><select id="invf-client"><option value="">Select a client…</option>';
    DB.clients.forEach(c => { h += '<option value="' + c.id + '"' + (d.clientId === c.id ? " selected" : "") + ">" + esc(c.name) + "</option>"; });
    h += "</select>";
    h += '<label class="f">Link to a job (optional)</label><select id="invf-joblink"><option value="">No job — standalone invoice</option>' +
      invJobOptions(d.jobId, d.clientId) + "</select>";
    h += '<label class="f">Trade *</label><select id="invf-trade">' +
      '<option value="">Select trade…</option>' +
      '<option value="Electric"' + (d.trade === "Electric" ? " selected" : "") + ">Electric</option>" +
      '<option value="HVAC"' + (d.trade === "HVAC" ? " selected" : "") + ">HVAC</option></select>";
    h += "</div>";
    /* items group (§9.6) */
    h += '<div class="card"><h3 class="sec">Line items</h3>';
    h += invProductPickerHTML();
    h += '<div id="invf-lines">';
    (d.lines.length ? d.lines : [{ desc: "", qty: 1, price: "" }]).forEach(l => { h += invLineRowHTML(l); });
    h += '</div><button type="button" class="addrow" data-act="inv_addLine">＋ Add line</button></div>';
    totalsCard = '<div class="card"><div class="lines-total"><span>Total</span><span class="grand" id="invf-total">' + money(invLinesTotal(d.lines)) + "</span></div></div>";
  } else {
    if(DB.jobs.length === 0){
      h += '<p class="muted">There are no jobs yet — an invoice from a job needs a job. Convert an approved quote first, or build one from scratch.</p>';
      h += "</div>";
    } else {
      h += '<label class="f">Job *</label><select id="invf-job"><option value="">Select a job…</option>' + invJobOptions(d.jobId, "") + "</select>";
      const j = d.jobId ? jobById(d.jobId) : null;
      if(j){
        const already = jobInvoiced(j);
        h += '<p class="muted small">Job total ' + money(jobAmount(j)) + " · already invoiced " + money(already) +
             " · left to invoice " + money(Math.max(0, jobAmount(j) - already)) + "</p>";
      }
      h += '<label class="f">Bill</label><select id="invf-basis">' +
        '<option value="full"' + (d.basis === "full" ? " selected" : "") + ">Full amount of the job</option>" +
        '<option value="draw"' + (d.basis === "draw" ? " selected" : "") + ">Stage draw — a % of the job</option></select>";
      h += '<div id="invf-pctwrap"' + (d.basis === "draw" ? "" : ' class="hidden"') + '><label class="f">Draw %</label>' +
        '<input type="number" id="invf-pct" min="1" max="100" step="any" inputmode="decimal" placeholder="e.g. 60" value="' + esc(d.drawPct) + '"></div>';
      h += "</div>";
      totalsCard = '<div class="card"><div class="lines-total"><span>Invoice amount</span><span class="grand" id="invf-amt">' + money(invJobModeAmount()) + "</span></div></div>";
    }
  }
  h += totalsCard;

  /* dates + notes group; the error sits below the fields (§9.5) */
  h += '<div class="card"><div class="grid2"><div><label class="f">Issue date *</label><input type="date" id="invf-issue" value="' + esc(d.issueDate) + '"></div>' +
    '<div><label class="f">Due date</label><input type="date" id="invf-due" value="' + esc(d.dueDate) + '"></div></div>';
  h += '<label class="f">Notes</label><textarea id="invf-notes" placeholder="Notes for the office / the client…">' + esc(d.notes) + "</textarea>";
  h += '<div class="err" id="invf-err"' + (d.err ? ' style="display:block"' : "") + ">" + esc(d.err || "") + "</div></div>";
  h += '<button class="btn block" data-act="inv_save">' + (editing ? "Save changes" : "Create draft invoice") + "</button>";
  h += '<p class="muted small" style="text-align:center">New invoices start as <b>drafts — not sent</b>. The Owner marks them sent.</p>';
  h += '<button class="btn ghost block" data-act="inv_cancel">Cancel</button></div>';
  return h;
}
function invOpenForm(){
  const html = invMakerHTML();
  if(typeof openForm === "function"){ INV.formViaOpen = true; INV.formOpen = false; openForm(html); }
  else { INV.formViaOpen = false; INV.formOpen = true; invRender(); }
  setTimeout(bindInvForm, 0);
}
function invCloseForm(){
  const wasOpen = INV.formViaOpen;
  INV.draft = null; INV.editingId = null; INV.formOpen = false; INV.formViaOpen = false;
  if(wasOpen && typeof closeForm === "function") closeForm(); /* nulls core's FORM_HTML + renders */
  else invRender();
}
function invRefreshJobAmt(){
  invSyncDraft();
  const el = document.getElementById("invf-amt");
  if(el) el.textContent = money(invJobModeAmount());
}
function bindInvForm(){
  const d = INV.draft;
  if(!d) return;
  const once = (el, ev, fn) => { if(el && !el._invBound){ el._invBound = true; el.addEventListener(ev, fn); } };
  const clientSel = document.getElementById("invf-client");
  once(clientSel, "change", () => {
    invSyncDraft(); INV.draft.jobId = ""; INV.draft.err = ""; invOpenForm();
  });
  const jobSel = document.getElementById("invf-job");
  once(jobSel, "change", () => { invSyncDraft(); INV.draft.err = ""; invOpenForm(); });
  const basisSel = document.getElementById("invf-basis");
  once(basisSel, "change", () => {
    invSyncDraft();
    const wrap = document.getElementById("invf-pctwrap");
    if(wrap) wrap.classList.toggle("hidden", INV.draft.basis !== "draw");
    invRefreshJobAmt();
  });
  const pct = document.getElementById("invf-pct");
  once(pct, "input", invRefreshJobAmt);
  const lines = document.getElementById("invf-lines");
  once(lines, "input", () => {
    invSyncDraft();
    const t = document.getElementById("invf-total");
    if(t) t.textContent = money(invLinesTotal(INV.draft.lines));
  });
}
function invSaveFromDraft(){
  const d = INV.draft;
  invSyncDraft();
  const fail = msg => { d.err = msg; invOpenForm(); };
  if(!invIsOwner()){ fail("Only the Owner can save invoices with prices."); return; }
  if(!d.issueDate){ fail("Set the issue date."); return; }
  let rec;
  if(d.mode === "job"){
    const j = d.jobId ? jobById(d.jobId) : null;
    if(!j){ fail("Pick the job first."); return; }
    if(d.basis === "draw"){
      const pct = Number(d.drawPct);
      if(!(pct > 0 && pct <= 100)){ fail("Enter a draw % between 1 and 100."); return; }
    }
    const amt = invJobModeAmount();
    if(!(amt > 0)){ fail("That job has no priced amount yet — price its quote first."); return; }
    rec = { clientId: j.clientId, jobId: j.id, quoteId: j.quoteId || "", propertyId: j.propertyId || "",
            trade: j.trade, basis: d.basis, drawPct: d.basis === "draw" ? Number(d.drawPct) : null,
            amount: amt, lines: [] };
  } else {
    if(!d.clientId){ fail("Pick the client first."); return; }
    if(!d.trade){ fail("Trade is required — Electric or HVAC."); return; }
    const lines = d.lines
      .map(l => ({ desc: String(l.desc || "").trim(), qty: Number(l.qty) || 0, price: invRound2(l.price) }))
      .filter(l => l.desc || l.price > 0);
    if(lines.length === 0){ fail("Add at least one line item."); return; }
    const total = invLinesTotal(lines);
    if(!(total > 0)){ fail("Enter the line prices — the Owner prices every invoice."); return; }
    const j = d.jobId ? jobById(d.jobId) : null;
    rec = { clientId: d.clientId, jobId: j ? j.id : "", quoteId: j ? (j.quoteId || "") : "",
            propertyId: j ? (j.propertyId || "") : "", trade: d.trade,
            basis: "full", drawPct: null, amount: total, lines: lines };
  }
  rec.notes = d.notes || "";
  rec.createdAt = d.issueDate;
  rec.dueDate = d.dueDate || null;

  if(INV.editingId){
    const inv = invoiceById(INV.editingId);
    if(!inv){ invCloseForm(); return; }
    Object.assign(inv, rec);
    INV.flash = "Invoice " + inv.number + " updated — still a draft, not sent.";
    INV.selId = inv.id;
  } else {
    if(!DB.seq) DB.seq = { quote: 1001, invoice: 1001, client: 41 };
    if(!DB.seq.invoice) DB.seq.invoice = 1001;
    const inv = Object.assign({ id: uid("inv"), number: "INV-" + (DB.seq.invoice++),
      status: "Draft", pastDue: false, sentAt: null, payments: [] }, rec);
    DB.invoices.push(inv);
    INV.flash = "Invoice " + inv.number + " created as a draft — not sent.";
    INV.selId = inv.id;
  }
  saveDB();
  invCloseForm();
}

/* ============================================================================
   DETAIL VIEW
   ========================================================================== */
function invDetailHTML(inv){
  if(!inv) return '<div class="empty">That invoice no longer exists.</div>';
  const c = clientById(inv.clientId);
  const j = inv.jobId ? jobById(inv.jobId) : null;
  const q = inv.quoteId ? quoteById(inv.quoteId) : null;
  const bal = invoiceBalance(inv), paidSum = invoicePaidSum(inv);
  const st = displayInvoiceStatus(inv);
  const owner = invIsOwner();
  let h = '<button class="backbtn" data-act="inv_back">← All invoices</button>';
  if(INV.flash) h += '<div class="okmsg">' + esc(INV.flash) + "</div>";

  /* header (§9.4): pill/tag + number footnote, hero amount, sublines;
     money group = Paid so far / Balance due (amount is the hero) */
  h += '<div class="dhead">' +
    '<div class="dh-top"><span class="dh-num">' + esc(inv.number) + '</span>' +
    (inv.status === "Draft" ? '<span class="tag-draft">DRAFT — not sent</span>' : invoicePill(inv)) + "</div>" +
    '<div class="dh-hero">' + money(inv.amount) + "</div>" +
    '<div class="dh-sub">' + esc(invClientName(inv)) + (c ? " · " + esc(propertyLabel(c, inv.propertyId)) : "") + "</div>" +
    '<div class="dh-sub">Issued ' + fmtDate(inv.createdAt) +
      (inv.sentAt ? " · Sent " + fmtDate(inv.sentAt) : "") +
      (inv.dueDate ? " · Due " + fmtDate(inv.dueDate) : "") + "</div>";
  h += '<div class="stats">' +
    '<div class="stat"><div class="n">' + money(paidSum) + '</div><div class="l">Paid so far</div></div>' +
    '<div class="stat' + (bal > 0 && inv.status !== "Draft" ? " alert" : "") + '"><div class="n">' + money(bal) + '</div><div class="l">Balance due</div></div>' +
    "</div>";

  /* actions — Delete lives in the danger zone at the bottom (§9.4) */
  h += '<div class="dh-actions">';
  if(inv.status === "Draft" && owner) h += '<button class="btn" data-act="inv_send" data-id="' + inv.id + '">Mark as Sent</button>';
  if(inv.status === "Draft" && owner) h += '<button class="btn ghost" data-act="inv_edit" data-id="' + inv.id + '">Edit</button>';
  if(owner) h += '<button class="btn ghost" data-act="inv_dup" data-id="' + inv.id + '">Duplicate</button>';
  h += '<button class="btn ghost" data-act="inv_doc" data-id="' + inv.id + '">View Document</button>';
  h += "</div>";
  if(inv.status === "Draft" && !owner)
    h += '<p class="muted small">Draft — only the Owner can edit or send an invoice with prices.</p>';
  h += "</div>"; /* /header card */

  /* two-column body */
  h += '<div class="detail-grid"><div class="col-main">';
  /* lines / basis */
  h += '<div class="card"><h3 class="sec" style="margin-top:0">Details</h3>';
  if(inv.lines && inv.lines.length){
    /* grouped item rows (§9.6): title, "qty × price" detail, amount */
    h += '<div class="items">';
    inv.lines.forEach(l => {
      h += '<div class="lrow"><span class="grow"><span class="name">' + esc(l.desc) + "</span>" +
           '<span class="meta">' + esc(l.qty) + " × " + money(l.price) + "</span></span>" +
           '<span class="amt">' + money((Number(l.qty) || 0) * (Number(l.price) || 0)) + "</span></div>";
    });
    h += '</div><div class="lines-total"><span>Total</span><span class="grand">' + money(invLinesTotal(inv.lines)) + "</span></div>";
  } else if(j){
    h += '<div class="kv"><span class="k">Job</span><span class="v">' + esc(invJobShort(inv)) + "</span></div>" +
         '<div class="kv"><span class="k">Billing</span><span class="v">' +
           (inv.basis === "draw" ? "Stage draw — " + inv.drawPct + "% of the job amount (" + money(jobAmount(j)) + ")" : "Full amount of the job") + "</span></div>";
  } else if(q){
    h += '<div class="kv"><span class="k">From quote</span><span class="v">' + esc(q.number) + " · " + esc(quoteTitle(q)) + "</span></div>";
  } else {
    h += '<p class="muted">Full amount — ' + esc(inv.trade || "") + " work. (Line detail was not part of the Jobber record.)</p>";
  }
  if(inv.notes) h += '<div class="kv"><span class="k">Notes</span><span class="v">' + esc(inv.notes) + "</span></div>";
  h += "</div>";

  /* payments */
  h += '<div class="card"><h3 class="sec" style="margin-top:0">Payments</h3>';
  if((inv.payments || []).length){
    inv.payments.forEach(p => {
      h += '<div class="kv"><span class="k">' + fmtDate(p.date) + " · " + esc(p.method || "") + (p.ref ? " · " + esc(p.ref) : "") +
           '</span><span class="v">' + money(p.amount) + "</span></div>";
    });
    h += '<div class="lines-total"><span>Paid so far</span><span class="grand">' + money(paidSum) + "</span></div>";
  } else {
    h += '<p class="muted">No payments recorded yet.</p>';
  }
  if(inv.status === "Sent" && bal > 0){
    if(st === "Past due") h += '<p class="small" style="color:var(--red);font-weight:700">Past due — this balance is still open.</p>';
    h += '<h3 class="sec">Record a payment</h3>' +
      '<label class="f">Amount</label><input type="number" id="pay-amount" min="0" step="any" value="' + bal + '">' +
      '<label class="f">Payment date</label><input type="date" id="pay-date" value="' + todayStr() + '">' +
      '<label class="f">Method</label><select id="pay-method">' +
        PAY_METHODS.map(m => '<option value="' + m + '">' + m + "</option>").join("") + "</select>" +
      '<label class="f">Reference</label><input type="text" id="pay-ref" placeholder="Check #, confirmation, last 4…">' +
      '<div class="err" id="pay-err"' + (INV.payErr ? ' style="display:block"' : "") + ">" + esc(INV.payErr || "") + "</div>" +
      '<button class="btn green block" data-act="inv_pay" data-id="' + inv.id + '" style="margin-top:14px">Record payment</button>' +
      '<p class="muted small">Partial payments are fine — the balance updates and the invoice flips to Paid at $0.</p>';
  }
  if(st === "Paid") h += '<p class="small" style="color:var(--green);font-weight:700">Paid in full.</p>';
  h += "</div></div>"; /* /main column */

  /* side column */
  h += '<div class="col-side">';
  h += '<div class="card"><h3 class="sec" style="margin-top:0">Client</h3>' +
    '<div style="font-weight:700">' + esc(invClientName(inv)) + "</div>" +
    (c && (c.phone || c.email) ? '<div class="muted small">' + esc([c.phone, c.email].filter(Boolean).join(" · ")) + "</div>" : "") +
    (c ? '<div class="muted small">' + esc(propertyLabel(c, inv.propertyId)) + "</div>" : "") +
    '<button class="btn ghost block" data-act="inv_openClient" data-id="' + inv.id + '" style="margin-top:10px">Open client →</button></div>';
  h += '<div class="card"><h3 class="sec" style="margin-top:0">About this invoice</h3>' +
    '<div class="kv"><span class="k">Trade</span><span class="v">' + esc(inv.trade || "—") + "</span></div>" +
    (j ? '<div class="kv"><span class="k">Job</span><span class="v">' + esc(invJobShort(inv)) + "</span></div>" : "") +
    (q ? '<div class="kv"><span class="k">Quote</span><span class="v">' + esc(q.number) + "</span></div>" : "") +
    '<div class="kv"><span class="k">Issued</span><span class="v">' + fmtDate(inv.createdAt) + "</span></div>" +
    (inv.sentAt ? '<div class="kv"><span class="k">Sent</span><span class="v">' + fmtDate(inv.sentAt) + "</span></div>" : "") +
    (inv.dueDate ? '<div class="kv"><span class="k">Due</span><span class="v">' + fmtDate(inv.dueDate) + "</span></div>" : "") +
    '<div class="kv"><span class="k">Status</span><span class="v">' + esc(st) + "</span></div>" +
    (j ? '<button class="btn ghost block" data-act="inv_openJob" data-id="' + inv.id + '" style="margin-top:10px">Open job →</button>' : "") +
    "</div>";
  h += "</div></div>"; /* /side + /detail-grid */

  /* archive — quiet group above the destructive one */
  if (inv.archived)
    h += '<div class="card"><button class="btn ghost block" data-act="inv_unarchive" data-id="' + inv.id + '">Restore from Archive</button></div>';
  else
    h += '<div class="card"><button class="btn ghost block" data-act="inv_archive" data-id="' + inv.id + '">Archive invoice</button></div>';

  /* destructive group — last, alone (§9.4); two-step confirm stays */
  if(inv.status === "Draft" && INV.confirmDel !== inv.id){
    h += '<div class="dangerzone"><button class="btn danger block" data-act="inv_del" data-id="' + inv.id + '">Delete invoice</button></div>';
  }
  if(INV.confirmDel === inv.id){
    h += '<div class="dangerzone"><b>Delete ' + esc(inv.number) + "?</b>" +
      '<p class="muted small">This draft will be removed for good. Sent and paid invoices cannot be deleted.</p>' +
      '<div class="btnrow"><button class="btn danger" data-act="inv_delGo" data-id="' + inv.id + '">Delete invoice</button>' +
      '<button class="btn ghost" data-act="inv_delCancel">Keep it</button></div></div>';
  }
  return h;
}

/* ============================================================================
   PRINTABLE DOCUMENT
   ========================================================================== */
function invDocRows(inv){
  if(inv.lines && inv.lines.length) return inv.lines.map(l => ({ desc: l.desc || "", qty: l.qty, price: l.price }));
  const j = inv.jobId ? jobById(inv.jobId) : null;
  const q = inv.quoteId ? quoteById(inv.quoteId) : null;
  let desc;
  if(j && inv.basis === "draw") desc = "Stage draw — " + inv.drawPct + "% of " + (j.title || ("Job #" + (j.jobberNumber || "")));
  else if(j) desc = j.title || ("Job #" + (j.jobberNumber || ""));
  else if(q) desc = quoteTitle(q);
  else desc = (inv.trade || "") + " services";
  return [{ desc: desc, qty: 1, price: inv.amount }];
}
function invDocumentHTML(inv){
  if(!inv) return '<div class="empty">That invoice no longer exists.</div>';
  const c = clientById(inv.clientId);
  const bal = invoiceBalance(inv), paidSum = invoicePaidSum(inv);
  const st = displayInvoiceStatus(inv);
  let addr = "";
  if(c){
    if(inv.propertyId) addr = propertyLabel(c, inv.propertyId);
    if((!addr || addr === "No property selected") && (c.properties || []).length){
      const p = c.properties[0];
      addr = p.address || p.community || "";
    }
    if(addr === "No property selected") addr = "";
  }
  let h = '<button class="backbtn" data-act="inv_docBack">← Back to invoice</button>' +
    '<div class="btnrow" style="margin-bottom:12px"><button class="btn" data-act="inv_print">Print invoice</button></div>';
  /* §9.8: DRAFT is the quiet .tag-draft in the header — no watermark.
     Brand colour appears only in the wordmark + one tint rule. */
  h += '<div class="doc" id="inv-doc">';
  h += '<div class="doc-head"><div>' +
    '<img class="doc-logo" src="assets/sharma360-logo.png" alt="SHARMA360 — Sharma Electric &amp; HVAC">' +
    '<div class="muted">SHARMA360</div>' +
    '<div class="small muted">Lic. EC13013924 · CAC1823596</div>' +
    '<div class="small muted">office@sharmaelectric.com · 407-881-9076</div></div>' +
    '<div><div class="doc-title">Invoice</div>' +
    '<div class="doc-num">' + esc(inv.number) + "</div>" +
    (inv.status === "Draft" ? '<span class="tag-draft">DRAFT — not sent</span>' : invoicePill(inv)) + "</div></div>";
  h += '<div class="doc-rule"></div>';

  h += '<div class="doc-parties">' +
    '<div class="dp"><div class="dp-h">Bill to</div>' +
    '<div style="font-weight:700;font-size:1.05rem">' + esc(invClientName(inv)) + "</div>" +
    (addr ? '<div class="muted">' + esc(addr) + "</div>" : "") +
    (c && c.email ? '<div class="muted small">' + esc(c.email) + "</div>" : "") + "</div>" +
    '<div class="dp"><div class="dp-h">Details</div>' +
    '<div class="kv"><span class="k">Issued</span><span class="v">' + fmtDate(inv.createdAt) + "</span></div>" +
    (inv.dueDate ? '<div class="kv"><span class="k">Due</span><span class="v">' + fmtDate(inv.dueDate) + "</span></div>" : "") +
    '<div class="kv"><span class="k">Trade</span><span class="v">' + esc(inv.trade || "—") + "</span></div>" +
    (invJobShort(inv) ? '<div class="kv"><span class="k">Job</span><span class="v">' + esc(invJobShort(inv)) + "</span></div>" : "") +
    '<div class="kv"><span class="k">Status</span><span class="v">' + esc(st) + "</span></div>" +
    "</div></div>";

  h += '<table><thead><tr><th>Description</th><th class="r">Qty</th><th class="r">Price</th><th class="r">Total</th></tr></thead><tbody>';
  invDocRows(inv).forEach(l => {
    h += "<tr><td>" + esc(l.desc) + '</td><td class="r">' + esc(l.qty) + '</td><td class="r">' + money(l.price) +
         '</td><td class="r">' + money((Number(l.qty) || 0) * (Number(l.price) || 0)) + "</td></tr>";
  });
  h += "</tbody></table>";

  h += '<div class="doc-totals">' +
    '<div class="kv"><span class="k">Amount</span><span class="v">' + money(inv.amount) + "</span></div>" +
    (paidSum > 0 ? '<div class="kv"><span class="k">Payments received</span><span class="v">− ' + money(paidSum) + "</span></div>" : "") +
    '<div class="kv"><span class="k">Balance due</span><span class="v grand">' + money(bal) + "</span></div></div>";

  if((inv.payments || []).length){
    h += '<h3 class="sec">Payments</h3>';
    inv.payments.forEach(p => {
      h += '<div class="kv"><span class="k">' + fmtDate(p.date) + " · " + esc(p.method || "") + (p.ref ? " · " + esc(p.ref) : "") +
           '</span><span class="v">' + money(p.amount) + "</span></div>";
    });
  }
  if(inv.notes) h += '<h3 class="sec">Notes</h3><p>' + esc(inv.notes) + "</p>";
  h += '<div class="doc-foot">Thank you — Sharma Electric &amp; HVAC · Lic. EC13013924 · CAC1823596 · office@sharmaelectric.com · 407-881-9076</div>';
  h += "</div>";
  return h;
}

/* ============================================================================
   ACTIONS
   ========================================================================== */
function invId(el){ return el && el.getAttribute ? el.getAttribute("data-id") : null; }
function invCrossNav(tab, key, id){
  try {
    if(key === "clientId" && typeof selClientId !== "undefined") selClientId = id;
    if(key === "jobId" && typeof selJobId !== "undefined") selJobId = id;
  } catch(e){ /* selection globals are another module's — best effort only */ }
  const navEl = document.querySelector('[data-nav="' + tab + '"]');
  if(navEl){ navEl.click(); return; }
  if(typeof go === "function"){ go(tab); return; }
  if(typeof switchTab === "function"){ switchTab(tab); }
}

ACTIONS.inv_open = function(el){ INV.selId = invId(el); INV.docId = null; INV.payErr = ""; INV.confirmDel = null; INV.flash = ""; invRender(); };
ACTIONS.inv_back = function(){ INV.selId = null; INV.docId = null; INV.payErr = ""; INV.confirmDel = null; invRender(); };
ACTIONS.inv_archive = function(el){
  const inv = invoiceById(invId(el));
  if(!inv) return;
  inv.archived = true; saveDB();
  INV.selId = null; INV.docId = null;
  toast("Invoice archived — find it in More \u2192 Archive");
  invRender();
};
ACTIONS.inv_unarchive = function(el){
  const inv = invoiceById(invId(el));
  if(!inv) return;
  inv.archived = false; saveDB();
  toast("Invoice restored");
  invRender();
};
ACTIONS.inv_filter = function(el){ INV.filter = el.getAttribute("data-f") || "All"; invRender(); };
ACTIONS.inv_new = function(){
  INV.flash = ""; INV.editingId = null; INV.draft = invNewDraft();
  const preJob = (typeof window !== "undefined" && window.CRM_PRESELECT_INVOICE_JOB) || null;
  if(preJob){
    window.CRM_PRESELECT_INVOICE_JOB = null;
    const pj = jobById(preJob);
    if(pj){ INV.draft.mode = "job"; INV.draft.jobId = pj.id; INV.draft.clientId = pj.clientId; INV.draft.trade = pj.trade || ""; }
  }
  invOpenForm();
};
ACTIONS.inv_edit = function(el){
  const inv = invoiceById(invId(el));
  if(!inv || inv.status !== "Draft" || !invIsOwner()) return;
  INV.editingId = inv.id; INV.draft = invDraftFromInvoice(inv); invOpenForm();
};
ACTIONS.inv_cancel = function(){ invCloseForm(); };
ACTIONS.inv_mode = function(el){
  invSyncDraft();
  INV.draft.mode = el.getAttribute("data-m") === "job" ? "job" : "scratch";
  INV.draft.err = "";
  invOpenForm();
};
ACTIONS.inv_addLine = function(){
  invSyncDraft();
  INV.draft.lines.push({ desc: "", qty: 1, price: "" });
  invOpenForm();
};
ACTIONS.inv_delLine = function(el){
  invSyncDraft();
  const row = el.closest ? el.closest(".linerow") : null;
  const rows = document.querySelectorAll("#invf-lines .linerow");
  let idx = -1;
  if(row && rows) rows.forEach((r, i) => { if(r === row) idx = i; });
  if(idx >= 0) INV.draft.lines.splice(idx, 1);
  if(INV.draft.lines.length === 0) INV.draft.lines = [{ desc: "", qty: 1, price: "" }];
  invOpenForm();
};
ACTIONS.inv_addProduct = function(){
  invSyncDraft();
  const sel = document.getElementById("invf-product");
  if(!sel || sel.value === "") return;
  const p = PRODUCTS[Number(sel.value)];
  if(!p) return;
  INV.draft.lines.push({ desc: p.name + (p.model ? " — " + p.model : ""), qty: 1, price: "" });
  invOpenForm();
};
ACTIONS.inv_save = function(){ invSaveFromDraft(); };

ACTIONS.inv_send = function(el){
  const inv = invoiceById(invId(el));
  if(!inv || inv.status !== "Draft") return;
  if(!invIsOwner()){ INV.flash = "Only the Owner can mark an invoice sent."; invRender(); return; }
  inv.status = "Sent";
  inv.sentAt = todayStr();
  if(!inv.dueDate) inv.dueDate = invAddDays(inv.sentAt, 30);
  saveDB();
  INV.flash = inv.number + " marked as sent — due " + fmtDate(inv.dueDate) + ".";
  invRender();
};
ACTIONS.inv_pay = function(el){
  const inv = invoiceById(invId(el));
  if(!inv || inv.status !== "Sent") return;
  const amt = invRound2(invField("pay-amount"));
  const bal = invoiceBalance(inv);
  if(!(amt > 0)){ INV.payErr = "Enter the payment amount."; invRender(); return; }
  if(amt > bal + 0.009){ INV.payErr = "That is more than the balance owed (" + money(bal) + ")."; invRender(); return; }
  if(!inv.payments) inv.payments = [];
  inv.payments.push({ date: invField("pay-date") || todayStr(), method: invField("pay-method") || "Check",
                      ref: String(invField("pay-ref") || "").trim(), amount: amt });
  if(invoiceBalance(inv) <= 0){ inv.status = "Paid"; inv.pastDue = false; }
  saveDB();
  INV.payErr = "";
  INV.flash = "Payment of " + money(amt) + " recorded on " + inv.number +
              (inv.status === "Paid" ? " — paid in full." : " — balance now " + money(invoiceBalance(inv)) + ".");
  invRender();
};
ACTIONS.inv_dup = function(el){
  const src = invoiceById(invId(el));
  if(!src || !invIsOwner()) return;
  if(!DB.seq) DB.seq = { quote: 1001, invoice: 1001, client: 41 };
  if(!DB.seq.invoice) DB.seq.invoice = 1001;
  const copy = JSON.parse(JSON.stringify(src));
  copy.id = uid("inv");
  copy.number = "INV-" + (DB.seq.invoice++);
  copy.status = "Draft"; copy.pastDue = false;
  copy.payments = []; copy.sentAt = null; copy.dueDate = null; copy.createdAt = todayStr();
  DB.invoices.push(copy);
  saveDB();
  INV.selId = copy.id; INV.flash = "Duplicated as " + copy.number + " — a fresh draft, not sent.";
  invRender();
};
ACTIONS.inv_del = function(el){ INV.confirmDel = invId(el); invRender(); };
ACTIONS.inv_delCancel = function(){ INV.confirmDel = null; invRender(); };
ACTIONS.inv_delGo = function(el){
  const id = invId(el);
  const inv = invoiceById(id);
  if(inv && inv.status === "Draft"){
    DB.invoices = DB.invoices.filter(i => i.id !== id);
    saveDB();
    INV.flash = "Invoice " + inv.number + " deleted.";
    INV.selId = null;
  }
  INV.confirmDel = null;
  invRender();
};
ACTIONS.inv_doc = function(el){ INV.docId = invId(el); invRender(); };
ACTIONS.inv_docBack = function(){ INV.docId = null; invRender(); };
ACTIONS.inv_print = function(){ if(typeof window !== "undefined" && window.print) window.print(); };
ACTIONS.inv_openClient = function(el){
  const inv = invoiceById(invId(el));
  if(inv) invCrossNav("clients", "clientId", inv.clientId);
};
ACTIONS.inv_openJob = function(el){
  const inv = invoiceById(invId(el));
  if(inv && inv.jobId) invCrossNav("jobs", "jobId", inv.jobId);
};

/* ---------------- view registration ---------------- */
VIEWS.invoices = function(){
  if(INV.formOpen && INV.draft){ setTimeout(bindInvForm, 0); return invMakerHTML(); }
  if(INV.docId) return invDocumentHTML(invoiceById(INV.docId));
  if(INV.selId) return invDetailHTML(invoiceById(INV.selId));
  setTimeout(bindInvList, 0);
  return invListHTML();
};

})();
