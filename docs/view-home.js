/* ============================================================
   SHARMA360 CRM v4 — Home dashboard (view-home.js)
   Registers VIEWS.home + ACTIONS.home_*.
   Apple-design dashboard (spec §9.2): Large Title + greeting
   subline, one grouped KPI stat card, grouped quick-action list,
   "Needs attention" and recent-activity grouped lists.
   All numbers compute live from DB via core helpers — nothing
   is hardcoded.

   Conventions used (see V3-CONTRACT.md):
   - Clicks: data-act="home_*" (core delegation); KPI cards use
     data-nav like v2.
   - Opening a record from Home: sets
     window.CRM_OPEN = { tab, id } then navigates to that tab.
     Each module's view consumes CRM_OPEN on render (jobs and
     more/requests in this build do; quotes/invoices/clients
     modules should do the same).
   - Quick actions: routed through the owning module's ACTIONS
     if present (quote_new, invoice_new/inv_new, client_new,
     req_new), else fall back to tab navigation.
   ============================================================ */
(function(){
"use strict";

function refresh(){ if (typeof render === "function") render(); }
function navTo(tab){
  var el = document.querySelector('[data-nav="' + tab + '"]');
  if (el) { el.click(); return; }
  if (typeof go === "function") { go(tab); return; }
  refresh();
}
function etHour(){
  try {
    var s = new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: "America/New_York" }).format(new Date());
    return parseInt(s, 10) % 24;
  } catch (e) { return new Date().getHours(); }
}
function etWeekday(){
  try {
    return new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "America/New_York" }).format(new Date());
  } catch (e) { return ""; }
}
function greeting(){
  var hr = etHour();
  if (hr < 12) return "Good morning";
  if (hr < 17) return "Good afternoon";
  return "Good evening";
}
function stagesDone(j){
  return STAGES.filter(function(st){
    return j.stages && j.stages[st.key] && j.stages[st.key].status === "done";
  }).length;
}

/* ---------------- KPI computations ---------------- */
function kpis(){
  var sentQ = DB.quotes.filter(function(q){ return q.status === "Sent" && !recArchived(q); });
  var awaiting = DB.invoices.filter(function(i){ return displayInvoiceStatus(i) === "Awaiting payment" && !recArchived(i); });
  var pastDue = DB.invoices.filter(function(i){ return displayInvoiceStatus(i) === "Past due" && !recArchived(i); });
  return {
    awaitingApproval: { count: sentQ.length, total: sentQ.reduce(function(s, q){ return s + quoteTotal(q); }, 0) },
    awaitingPayment: { count: awaiting.length, total: awaiting.reduce(function(s, i){ return s + invoiceBalance(i); }, 0) },
    pastDue: { count: pastDue.length, total: pastDue.reduce(function(s, i){ return s + invoiceBalance(i); }, 0) },
    activeJobs: DB.jobs.filter(function(j){ return jobDisplayStatus(j) !== "Completed" && !recArchived(j); }).length,
    lateJobs: DB.jobs.filter(function(j){ return jobDisplayStatus(j) === "Late" && !recArchived(j); }).length,
    clients: DB.clients.filter(function(c){ return !c.archived; }).length
  };
}

/* ---------------- needs attention ---------------- */
function needsAttention(){
  var t = todayStr();
  var items = [];
  DB.invoices.forEach(function(i){
    if (recArchived(i)) return;
    if (displayInvoiceStatus(i) !== "Past due") return;
    var c = clientById(i.clientId);
    var since = i.dueDate || i.sentAt || i.createdAt;
    items.push({ kind: "invoice", id: i.id, rank: 0, age: since ? daysBetween(since, t) : 0,
      pill: '<span class="pill red">Past due</span>',
      text: i.number + " — " + (c ? c.name : "Invoice") + " · " + money(invoiceBalance(i)) + " past due",
      sub: "Invoice issued " + fmtDate(i.createdAt) + (i.dueDate ? " · due " + fmtDate(i.dueDate) : "") });
  });
  DB.jobs.forEach(function(j){
    if (recArchived(j)) return;
    if (jobDisplayStatus(j) !== "Late") return;
    var c = clientById(j.clientId);
    items.push({ kind: "job", id: j.id, rank: 1, age: j.createdAt ? daysBetween(j.createdAt, t) : 0,
      pill: '<span class="pill red">Late</span>',
      text: (j.title || (c ? c.name : "Job") + " · " + j.trade) + " — late",
      sub: "Job · " + (c ? c.name : "") + " · " + stagesDone(j) + " of 5 stages done" });
  });
  DB.quotes.forEach(function(q){
    if (recArchived(q)) return;
    var c = clientById(q.clientId);
    if (q.status === "Sent") {
      var sentDate = q.sentAt || q.createdAt;
      var age = sentDate ? daysBetween(sentDate, t) : 0;
      if (age > 7) items.push({ kind: "quote", id: q.id, rank: 2, age: age,
        pill: '<span class="pill blue">Sent</span>',
        text: q.number + " — " + quoteTitle(q) + " · sent " + age + " days ago, no answer yet",
        sub: "Quote · " + (c ? c.name : "") + " · " + money(quoteTotal(q)) });
    } else if (q.status === "Draft") {
      var dage = q.createdAt ? daysBetween(q.createdAt, t) : 0;
      if (dage > 14) items.push({ kind: "quote", id: q.id, rank: 3, age: dage,
        pill: '<span class="pill grey">Draft</span>',
        text: q.number + " — " + quoteTitle(q) + " · draft is " + dage + " days old",
        sub: "Quote · " + (c ? c.name : "") + " · " + money(quoteTotal(q)) });
    }
  });
  items.sort(function(a, b){ return (a.rank - b.rank) || (b.age - a.age); });
  return items;
}

/* ---------------- recent activity ---------------- */
function recentActivity(limit){
  var items = [];
  DB.quotes.forEach(function(q){
    if (recArchived(q)) return;
    items.push({ kind: "quote", id: q.id, date: q.createdAt || "",
      title: q.number + " — " + quoteTitle(q),
      sub: "Quote · " + q.status + " · " + money(quoteTotal(q)) });
  });
  DB.jobs.forEach(function(j){
    if (recArchived(j)) return;
    var c = clientById(j.clientId);
    items.push({ kind: "job", id: j.id, date: j.createdAt || "",
      title: j.title || ((c ? c.name : "Job") + " — " + j.trade + " job"),
      sub: "Job · " + jobDisplayStatus(j) + " · " + stagesDone(j) + " of 5 stages done" });
  });
  DB.invoices.forEach(function(i){
    if (recArchived(i)) return;
    var c = clientById(i.clientId);
    items.push({ kind: "invoice", id: i.id, date: i.createdAt || "",
      title: i.number + " — " + (c ? c.name : "Invoice"),
      sub: "Invoice · " + displayInvoiceStatus(i) + " · " + money(i.amount) });
  });
  items.sort(function(a, b){
    return String(b.date || "").localeCompare(String(a.date || "")) || b.title.localeCompare(a.title);
  });
  return items.slice(0, limit);
}
var TAB_FOR_KIND = { quote: "quotes", job: "jobs", invoice: "invoices" };

/* ---------------- view ----------------
   Apple design (spec §9.2): Large Title in content, greeting as the
   subline, date as a footnote. KPIs live in ONE grouped stat card
   (.statgroup) with hairline cross-dividers — no separate shadowed
   cards. Quick actions are a grouped action list (no FAB-style
   buttons). Needs attention / Recent activity are inset grouped
   lists of §9.3 rows; status shows as a quiet §9.7 pill, never a
   coloured left border or a chevron stacked next to a pill. */
function homeStyleTag(){
  return '<style>' +
    '.greet{font-size:17px;font-weight:600;color:var(--label,#000);margin-top:2px}' +
    '.greet-sub{font-size:13px;line-height:18px;color:var(--label-2,rgba(60,60,67,.6));margin-top:2px}' +
    '.statgroup{display:grid;grid-template-columns:1fr 1fr;gap:0;background:var(--bg-grouped-2,#fff);border-radius:12px;overflow:hidden;margin-bottom:0}' +
    '.statgroup .stat{background:transparent;border:0;box-shadow:none;border-radius:0;padding:16px;min-height:76px;text-align:left;width:100%}' +
    '.statgroup .stat:nth-child(odd){border-right:0.5px solid var(--separator,rgba(60,60,67,.29))}' +
    '.statgroup .stat:nth-child(-n+4){border-bottom:0.5px solid var(--separator,rgba(60,60,67,.29))}' +
    '.statgroup .stat:active{background:var(--fill-4,rgba(120,120,128,.08))}' +
    '.statgroup .stat.alert .n{color:var(--red,#FF3B30)}' +
    '@media (min-width:600px){' +
      '.statgroup{grid-template-columns:repeat(3,1fr)}' +
      '.statgroup .stat:nth-child(odd){border-right:0}' +
      '.statgroup .stat:not(:nth-child(3n)){border-right:0.5px solid var(--separator,rgba(60,60,67,.29))}' +
      '.statgroup .stat:nth-child(-n+4){border-bottom:0}' +
      '.statgroup .stat:nth-child(-n+3){border-bottom:0.5px solid var(--separator,rgba(60,60,67,.29))}' +
    '}' +
    '@media (min-width:1000px){' +
      '.statgroup{grid-template-columns:repeat(6,1fr)}' +
      '.statgroup .stat:not(:nth-child(3n)){border-right:0}' +
      '.statgroup .stat:nth-child(-n+3){border-bottom:0}' +
      '.statgroup .stat:not(:last-child){border-right:0.5px solid var(--separator,rgba(60,60,67,.29))}' +
    '}' +
    '.qa-ic{flex:0 0 auto;width:29px;height:29px;border-radius:50%;background:var(--fill-3,rgba(120,120,128,.12));color:var(--tint,#007AFF);display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:600;line-height:1}' +
    '.qalist .name{font-weight:400}' +
  '</style>';
}

VIEWS.home = function(){
  var k = kpis();
  var h = homeStyleTag();
  /* header — Large Title, greeting subline, date footnote */
  h += '<h2 class="view">Dashboard</h2>';
  h += '<div class="greet">' + greeting() + (isOwner() ? ", Sanjay" : "") + '</div>';
  h += '<div class="greet-sub">' + etWeekday() + ' · ' + fmtDate(todayStr()) + '</div>';

  /* KPI stat group — ONE grouped card, hairline cross-dividers.
     Money is the hero value (Title-2 tabular); the count rides in
     the Caption-1 subline. Past-due value turns system red. */
  h += '<div class="stats statgroup">' +
    '<button class="stat" data-nav="quotes"><div class="l">Quotes awaiting approval</div><div class="n">' + money(k.awaitingApproval.total) + '</div><div class="s">' + k.awaitingApproval.count + (k.awaitingApproval.count === 1 ? ' quote' : ' quotes') + '</div></button>' +
    '<button class="stat" data-nav="invoices"><div class="l">Awaiting payment</div><div class="n">' + money(k.awaitingPayment.total) + '</div><div class="s">' + k.awaitingPayment.count + (k.awaitingPayment.count === 1 ? ' invoice' : ' invoices') + '</div></button>' +
    '<button class="stat' + (k.pastDue.count ? " alert" : "") + '" data-nav="invoices"><div class="l">Past due</div><div class="n">' + money(k.pastDue.total) + '</div><div class="s">' + k.pastDue.count + (k.pastDue.count === 1 ? ' invoice' : ' invoices') + '</div></button>' +
    '<button class="stat" data-nav="jobs"><div class="l">Active jobs</div><div class="n">' + k.activeJobs + '</div></button>' +
    '<button class="stat' + (k.lateJobs ? " alert" : "") + '" data-nav="jobs"><div class="l">Late jobs</div><div class="n">' + k.lateJobs + '</div></button>' +
    '<button class="stat" data-nav="clients"><div class="l">Clients</div><div class="n">' + k.clients + '</div></button>' +
  '</div>';

  /* quick actions — grouped action list */
  h += '<h3 class="sec">Quick actions</h3>';
  h += '<div class="listcard qalist">' +
         '<button class="rowitem" data-act="home_qa_quote"><span class="qa-ic">+</span><span class="grow"><span class="name">New Quote</span></span></button>' +
         '<button class="rowitem" data-act="home_qa_invoice"><span class="qa-ic">+</span><span class="grow"><span class="name">New Invoice</span></span></button>' +
         '<button class="rowitem" data-act="home_qa_client"><span class="qa-ic">+</span><span class="grow"><span class="name">New Client</span></span></button>' +
         '<button class="rowitem" data-act="home_qa_request"><span class="qa-ic">+</span><span class="grow"><span class="name">New Request</span></span></button>' +
       '</div>';

  /* needs attention — grouped list, status pill instead of chevron */
  var na = needsAttention();
  h += '<h3 class="sec">Needs attention (' + na.length + ')</h3>';
  if (!na.length) {
    h += '<div class="empty"><h3>All clear</h3><p>Past-due invoices, unanswered quotes, stale drafts and late jobs will show up here.</p></div>';
  } else {
    h += '<div class="listcard">';
    na.slice(0, 12).forEach(function(u){
      h += '<button class="rowitem" data-act="home_open" data-kind="' + u.kind + '" data-id="' + u.id + '">' +
             '<span class="grow"><span class="name">' + esc(u.text) + '</span>' +
             '<div class="meta">' + esc(u.sub) + '</div></span>' + (u.pill || '') + '</button>';
    });
    h += '</div>';
    if (na.length > 12) h += '<p class="muted small">…and ' + (na.length - 12) + ' more in Quotes, Jobs and Invoices.</p>';
  }

  /* recent activity — grouped list, pure-navigation rows keep the chevron */
  var acts = recentActivity(10);
  h += '<h3 class="sec">Recent activity</h3>';
  if (!acts.length) {
    h += '<div class="empty"><h3>No activity yet</h3><p>No quotes, jobs or invoices yet. New activity will show up here.</p></div>';
  } else {
    h += '<div class="listcard">';
    acts.forEach(function(a){
      h += '<button class="rowitem" data-act="home_open" data-kind="' + a.kind + '" data-id="' + a.id + '">' +
             '<span class="grow"><span class="name">' + esc(a.title) + '</span>' +
             '<div class="meta">' + esc(a.sub) + (a.date ? ' · ' + fmtDate(a.date) : '') + '</div></span>' +
             '<span class="chev">›</span></button>';
    });
    h += '</div>';
  }
  return h;
};

/* ---------------- actions ---------------- */
ACTIONS.home_open = function(el){
  var kind = el.getAttribute("data-kind"), id = el.getAttribute("data-id");
  var tab = TAB_FOR_KIND[kind];
  if (!tab) return;
  if (typeof window !== "undefined") window.CRM_OPEN = { tab: tab, id: id };
  navTo(tab);
};
function quick(el, names, tab){
  for (var i = 0; i < names.length; i++) {
    if (typeof ACTIONS[names[i]] === "function") { ACTIONS[names[i]](el); return; }
  }
  navTo(tab);
}
ACTIONS.home_qa_quote = function(el){ quick(el, ["quote_new", "quote_add"], "quotes"); };
ACTIONS.home_qa_invoice = function(el){ quick(el, ["invoice_new", "inv_new"], "invoices"); };
ACTIONS.home_qa_client = function(el){ quick(el, ["client_new", "client_add"], "clients"); };
ACTIONS.home_qa_request = function(el){ quick(el, ["req_new"], "more"); };

})();
