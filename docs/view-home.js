/* ============================================================
   SHARMA360 CRM v3 — Home dashboard (view-home.js)
   Registers VIEWS.home + ACTIONS.home_*.
   Jobber-style dashboard: ET greeting, live KPI cards, a
   "Needs attention" list, recent activity, quick actions.
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
  var sentQ = DB.quotes.filter(function(q){ return q.status === "Sent"; });
  var awaiting = DB.invoices.filter(function(i){ return displayInvoiceStatus(i) === "Awaiting payment"; });
  var pastDue = DB.invoices.filter(function(i){ return displayInvoiceStatus(i) === "Past due"; });
  return {
    awaitingApproval: { count: sentQ.length, total: sentQ.reduce(function(s, q){ return s + quoteTotal(q); }, 0) },
    awaitingPayment: { count: awaiting.length, total: awaiting.reduce(function(s, i){ return s + invoiceBalance(i); }, 0) },
    pastDue: { count: pastDue.length, total: pastDue.reduce(function(s, i){ return s + invoiceBalance(i); }, 0) },
    activeJobs: DB.jobs.filter(function(j){ return jobDisplayStatus(j) !== "Completed"; }).length,
    lateJobs: DB.jobs.filter(function(j){ return jobDisplayStatus(j) === "Late"; }).length,
    clients: DB.clients.length
  };
}

/* ---------------- needs attention ---------------- */
function needsAttention(){
  var t = todayStr();
  var items = [];
  DB.invoices.forEach(function(i){
    if (displayInvoiceStatus(i) !== "Past due") return;
    var c = clientById(i.clientId);
    var since = i.dueDate || i.sentAt || i.createdAt;
    items.push({ kind: "invoice", id: i.id, rank: 0, age: since ? daysBetween(since, t) : 0,
      text: i.number + " — " + (c ? c.name : "Invoice") + " · " + money(invoiceBalance(i)) + " past due",
      sub: "Invoice issued " + fmtDate(i.createdAt) + (i.dueDate ? " · due " + fmtDate(i.dueDate) : "") });
  });
  DB.jobs.forEach(function(j){
    if (jobDisplayStatus(j) !== "Late") return;
    var c = clientById(j.clientId);
    items.push({ kind: "job", id: j.id, rank: 1, age: j.createdAt ? daysBetween(j.createdAt, t) : 0,
      text: (j.title || (c ? c.name : "Job") + " · " + j.trade) + " — late",
      sub: "Job · " + (c ? c.name : "") + " · " + stagesDone(j) + " of 5 stages done" });
  });
  DB.quotes.forEach(function(q){
    var c = clientById(q.clientId);
    if (q.status === "Sent") {
      var sentDate = q.sentAt || q.createdAt;
      var age = sentDate ? daysBetween(sentDate, t) : 0;
      if (age > 7) items.push({ kind: "quote", id: q.id, rank: 2, age: age,
        text: q.number + " — " + quoteTitle(q) + " · sent " + age + " days ago, no answer yet",
        sub: "Quote · " + (c ? c.name : "") + " · " + money(quoteTotal(q)) });
    } else if (q.status === "Draft") {
      var dage = q.createdAt ? daysBetween(q.createdAt, t) : 0;
      if (dage > 14) items.push({ kind: "quote", id: q.id, rank: 3, age: dage,
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
    items.push({ kind: "quote", id: q.id, date: q.createdAt || "",
      title: q.number + " — " + quoteTitle(q),
      sub: "Quote · " + q.status + " · " + money(quoteTotal(q)) });
  });
  DB.jobs.forEach(function(j){
    var c = clientById(j.clientId);
    items.push({ kind: "job", id: j.id, date: j.createdAt || "",
      title: j.title || ((c ? c.name : "Job") + " — " + j.trade + " job"),
      sub: "Job · " + jobDisplayStatus(j) + " · " + stagesDone(j) + " of 5 stages done" });
  });
  DB.invoices.forEach(function(i){
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

/* ---------------- view ---------------- */
VIEWS.home = function(){
  var k = kpis();
  var h = '<div class="greet">' + greeting() + (isOwner() ? ", Sanjay" : "") + '</div>';
  h += '<div class="greet-sub">' + etWeekday() + ", " + fmtDate(todayStr()) + ' · Here is where the business stands.</div>';

  /* quick actions */
  h += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin:14px 0">' +
         '<button class="btn gold" data-act="home_qa_quote">＋ New Quote</button>' +
         '<button class="btn" data-act="home_qa_invoice">＋ New Invoice</button>' +
         '<button class="btn" data-act="home_qa_client">＋ New Client</button>' +
         '<button class="btn" data-act="home_qa_request">＋ New Request</button>' +
       '</div>';

  /* KPI cards */
  h += '<div class="stats">' +
    '<button class="stat" data-nav="quotes"><div class="n">' + k.awaitingApproval.count + '</div><div class="l">Quotes awaiting approval</div><div class="s">' + money(k.awaitingApproval.total) + '</div></button>' +
    '<button class="stat" data-nav="invoices"><div class="n">' + k.awaitingPayment.count + '</div><div class="l">Awaiting payment</div><div class="s">' + money(k.awaitingPayment.total) + '</div></button>' +
    '<button class="stat' + (k.pastDue.count ? " alert" : "") + '" data-nav="invoices"><div class="n">' + k.pastDue.count + '</div><div class="l">Past due</div><div class="s">' + money(k.pastDue.total) + '</div></button>' +
    '<button class="stat" data-nav="jobs"><div class="n">' + k.activeJobs + '</div><div class="l">Active jobs</div></button>' +
    '<button class="stat' + (k.lateJobs ? " alert" : "") + '" data-nav="jobs"><div class="n">' + k.lateJobs + '</div><div class="l">Late jobs</div></button>' +
    '<button class="stat" data-nav="clients"><div class="n">' + k.clients + '</div><div class="l">Clients</div></button>' +
  '</div>';

  /* needs attention */
  var na = needsAttention();
  h += '<h3 class="sec">Needs attention (' + na.length + ')</h3>';
  if (!na.length) {
    h += '<div class="empty">All clear. Past-due invoices, unanswered quotes, stale drafts and late jobs will show up here.</div>';
  } else {
    na.slice(0, 12).forEach(function(u){
      h += '<button class="rowitem followup' + (u.rank === 0 ? " red" : "") + '" data-act="home_open" data-kind="' + u.kind + '" data-id="' + u.id + '">' +
             '<span class="grow"><span class="name">' + esc(u.text) + '</span>' +
             '<div class="meta">' + esc(u.sub) + '</div></span><span class="chev">›</span></button>';
    });
    if (na.length > 12) h += '<p class="muted small">…and ' + (na.length - 12) + ' more in Quotes, Jobs and Invoices.</p>';
  }

  /* recent activity */
  var acts = recentActivity(10);
  h += '<h3 class="sec">Recent activity</h3>';
  if (!acts.length) {
    h += '<div class="empty">No quotes, jobs or invoices yet. New activity will show up here.</div>';
  } else {
    acts.forEach(function(a){
      h += '<button class="rowitem" data-act="home_open" data-kind="' + a.kind + '" data-id="' + a.id + '">' +
             '<span class="grow"><span class="name">' + esc(a.title) + '</span>' +
             '<div class="meta">' + esc(a.sub) + (a.date ? ' · ' + fmtDate(a.date) : '') + '</div></span>' +
             '<span class="chev">›</span></button>';
    });
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
