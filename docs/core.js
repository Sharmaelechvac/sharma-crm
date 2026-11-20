/* =====================================================================
   SHARMA360 · CRM v3 — core.js
   Data layer (DB, 40-builder seed, Jobber data.json merge, helpers,
   pills, PRODUCTS) copied from the v2 app (app/docs/index.html),
   verified against the real Jobber data. Shell: lock/roles, router,
   registries (VIEWS / ACTIONS), delegation, search, modal, toast.
   Only the SHA-256 hash of the passcode is stored — never the code.
   ===================================================================== */
"use strict";
/* =====================================================================
   SHARMA360 · CRM — Jobber-style rebuild (on the Stage A shell)
   Single-file app. Data lives in localStorage under "sharma-crm-v1".
   Only the SHA-256 hash of the passcode is stored — never the passcode.
   On startup the app also tries to fetch data.json (same folder) — the
   Jobber export drop-in — and merges it over the local data by id /
   quote number / invoice number, mapping Jobber status strings.
   ===================================================================== */
const LS_KEY = "sharma-crm-v1";
const SS_ROLE = "sharma-crm-role";

/* Seed: the 40 builder clients imported from the Bid Tracker (2026-11-20).
   The ONLY seed clients — quotes, jobs, invoices and requests start empty. */
const SEED_CLIENTS = [{"id": "c001", "type": "builder", "name": "A.L. Milton", "contacts": [], "properties": [], "notes": "", "source": "Bid Tracker import 2026-11-20"}, {"id": "c002", "type": "builder", "name": "AMG / Blackstone HOA", "contacts": [], "properties": [], "notes": "", "source": "Bid Tracker import 2026-11-20"}, {"id": "c003", "type": "builder", "name": "Arena Americas", "contacts": [], "properties": [], "notes": "", "source": "Bid Tracker import 2026-11-20"}, {"id": "c004", "type": "builder", "name": "BCL Homes", "contacts": [], "properties": [], "notes": "", "source": "Bid Tracker import 2026-11-20"}, {"id": "c005", "type": "builder", "name": "BR Ross Construction Group", "contacts": [], "properties": [], "notes": "", "source": "Bid Tracker import 2026-11-20"}, {"id": "c006", "type": "builder", "name": "Billy Hastings", "contacts": [], "properties": [], "notes": "", "source": "Bid Tracker import 2026-11-20"}, {"id": "c007", "type": "builder", "name": "Bonesteel Construction", "contacts": [], "properties": [], "notes": "", "source": "Bid Tracker import 2026-11-20"}, {"id": "c008", "type": "builder", "name": "Castle Group / Vizcaya Heights Multicondo", "contacts": [], "properties": [], "notes": "", "source": "Bid Tracker import 2026-11-20"}, {"id": "c009", "type": "builder", "name": "Chase Sterling Group", "contacts": [], "properties": [], "notes": "", "source": "Bid Tracker import 2026-11-20"}, {"id": "c010", "type": "builder", "name": "Cintra Development", "contacts": [], "properties": [], "notes": "", "source": "Bid Tracker import 2026-11-20"}, {"id": "c011", "type": "builder", "name": "Citrus Hills", "contacts": [], "properties": [], "notes": "", "source": "Bid Tracker import 2026-11-20"}, {"id": "c012", "type": "builder", "name": "Coastal Construction (CCI Florida)", "contacts": [], "properties": [], "notes": "", "source": "Bid Tracker import 2026-11-20"}, {"id": "c013", "type": "builder", "name": "Coaston Homes", "contacts": [], "properties": [], "notes": "", "source": "Bid Tracker import 2026-11-20"}, {"id": "c014", "type": "builder", "name": "Construction Vix", "contacts": [], "properties": [], "notes": "", "source": "Bid Tracker import 2026-11-20"}, {"id": "c015", "type": "builder", "name": "Craig White", "contacts": [], "properties": [], "notes": "", "source": "Bid Tracker import 2026-11-20"}, {"id": "c016", "type": "builder", "name": "DNJ Builders", "contacts": [], "properties": [], "notes": "", "source": "Bid Tracker import 2026-11-20"}, {"id": "c017", "type": "builder", "name": "DNR Contracting", "contacts": [], "properties": [], "notes": "", "source": "Bid Tracker import 2026-11-20"}, {"id": "c018", "type": "builder", "name": "DSA Empire", "contacts": [], "properties": [], "notes": "", "source": "Bid Tracker import 2026-11-20"}, {"id": "c019", "type": "builder", "name": "EXJ Root", "contacts": [], "properties": [], "notes": "", "source": "Bid Tracker import 2026-11-20"}, {"id": "c020", "type": "builder", "name": "Fickett Builders", "contacts": [], "properties": [], "notes": "", "source": "Bid Tracker import 2026-11-20"}, {"id": "c021", "type": "builder", "name": "GSB Construction", "contacts": [], "properties": [], "notes": "", "source": "Bid Tracker import 2026-11-20"}, {"id": "c022", "type": "builder", "name": "Groninger Custom Homes", "contacts": [], "properties": [], "notes": "", "source": "Bid Tracker import 2026-11-20"}, {"id": "c023", "type": "builder", "name": "Guida Group", "contacts": [], "properties": [], "notes": "", "source": "Bid Tracker import 2026-11-20"}, {"id": "c024", "type": "builder", "name": "Infinity Homes Developments", "contacts": [], "properties": [], "notes": "", "source": "Bid Tracker import 2026-11-20"}, {"id": "c025", "type": "builder", "name": "Jim Cody", "contacts": [], "properties": [], "notes": "", "source": "Bid Tracker import 2026-11-20"}, {"id": "c026", "type": "builder", "name": "Karma Construction Company", "contacts": [], "properties": [], "notes": "", "source": "Bid Tracker import 2026-11-20"}, {"id": "c027", "type": "builder", "name": "Liberty Development", "contacts": [], "properties": [], "notes": "", "source": "Bid Tracker import 2026-11-20"}, {"id": "c028", "type": "builder", "name": "Licciardello Construction (LCI)", "contacts": [], "properties": [], "notes": "", "source": "Bid Tracker import 2026-11-20"}, {"id": "c029", "type": "builder", "name": "Logan Construction Group", "contacts": [], "properties": [], "notes": "", "source": "Bid Tracker import 2026-11-20"}, {"id": "c030", "type": "builder", "name": "MRCELA Custom Homes", "contacts": [], "properties": [], "notes": "", "source": "Bid Tracker import 2026-11-20"}, {"id": "c031", "type": "builder", "name": "NOK Construction", "contacts": [], "properties": [], "notes": "", "source": "Bid Tracker import 2026-11-20"}, {"id": "c032", "type": "builder", "name": "Rocklyn Homes", "contacts": [], "properties": [], "notes": "", "source": "Bid Tracker import 2026-11-20"}, {"id": "c033", "type": "builder", "name": "Ron Hoffman", "contacts": [], "properties": [], "notes": "", "source": "Bid Tracker import 2026-11-20"}, {"id": "c034", "type": "builder", "name": "SI Homes", "contacts": [], "properties": [], "notes": "", "source": "Bid Tracker import 2026-11-20"}, {"id": "c035", "type": "builder", "name": "Sagewood Corporation", "contacts": [], "properties": [], "notes": "", "source": "Bid Tracker import 2026-11-20"}, {"id": "c036", "type": "builder", "name": "Summit GC", "contacts": [], "properties": [], "notes": "", "source": "Bid Tracker import 2026-11-20"}, {"id": "c037", "type": "builder", "name": "Tampa Shell Contractors", "contacts": [], "properties": [], "notes": "", "source": "Bid Tracker import 2026-11-20"}, {"id": "c038", "type": "builder", "name": "Timed Construction", "contacts": [], "properties": [], "notes": "", "source": "Bid Tracker import 2026-11-20"}, {"id": "c039", "type": "builder", "name": "Vakul Development", "contacts": [], "properties": [], "notes": "", "source": "Bid Tracker import 2026-11-20"}, {"id": "c040", "type": "builder", "name": "Z Brothers Construction", "contacts": [], "properties": [], "notes": "", "source": "Bid Tracker import 2026-11-20"}];

/* Product & submittal library (submittal-maker library, 2026-11-20):
   name / brand / model / category / trade / photo-on-file flag. */
const PRODUCTS = [{"name":"20A Commercial-Grade Duplex Receptacles","brand":"Pass & Seymour (Legrand)","model":"5362","category":"devices","trade":"electrical","photo":true},{"name":"GFCI Receptacles, 20A (incl. Weather-Resistant)","brand":"Pass & Seymour (Legrand)","model":"2097","category":"devices","trade":"electrical","photo":true},{"name":"Weather-Resistant USB Charging Receptacles, 20A","brand":"Pass & Seymour (Legrand)","model":"WRTR20USBAC6","category":"devices","trade":"electrical","photo":true},{"name":"Locking Receptacle, NEMA L6-15R","brand":"Leviton","model":"4560","category":"devices","trade":"electrical","photo":true},{"name":"Locking Receptacle, NEMA L6-30R","brand":"Leviton","model":"2620","category":"devices","trade":"electrical","photo":true},{"name":"Single Receptacle, NEMA 6-20R","brand":"Leviton","model":"5461","category":"devices","trade":"electrical","photo":true},{"name":"Single Receptacle, NEMA 6-50R","brand":"Leviton","model":"5374","category":"devices","trade":"electrical","photo":true},{"name":"Toggle Switch, 20A Single-Pole","brand":"Leviton","model":"1221-2W","category":"devices","trade":"electrical","photo":true},{"name":"0-10V Dimmer \u2014 Diva","brand":"Lutron","model":"DVSTV","category":"devices","trade":"electrical","photo":true},{"name":"In-Wall PIR Occupancy Sensor","brand":"Intermatic","model":"IOS-DDR","category":"devices","trade":"electrical","photo":true},{"name":"Ceiling-Mount PIR Occupancy Sensor","brand":"Intermatic","model":"IOS-CMP","category":"devices","trade":"electrical","photo":true},{"name":"2x4 LED Lay-In Panel (Type L6)","brand":"Cooper Lighting (Metalux)","model":"24GPT5040R","category":"fixtures","trade":"electrical","photo":true},{"name":"Emergency Lighting Unit (Type ELU)","brand":"The Exit Light Co.","model":"EL-M2","category":"fixtures","trade":"electrical","photo":true},{"name":"200A Heavy-Duty Fused Safety Switch (Service Disconnect)","brand":"Square D","model":"VH324NR","category":"service","trade":"electrical","photo":true},{"name":"200A 3-Phase Meter Socket","brand":"Milbank","model":"U9701-X","category":"service","trade":"electrical","photo":true},{"name":"Copper Feeder Conductors \u2014 SIMpull THHN/THWN-2 (2/0 AWG as submitted)","brand":"Southwire","model":"THHN-THWN-2","category":"wire","trade":"electrical","photo":true},{"name":"Rigid PVC Conduit, Schedule 40, 2 in. x 10 ft","brand":"CANTEX","model":"A52CA12","category":"boxes","trade":"electrical","photo":true},{"name":"Grounding Electrode \u2014 Copper-Bonded Ground Rod, 5/8 in. x 8 ft","brand":"nVent ERICO","model":"615880","category":"grounding","trade":"electrical","photo":true},{"name":"Occupancy / Motion Sensor Switches \u2014 radiant","brand":"Legrand \u2014 radiant Collection (Pass & Seymour)","model":"RRW600UTCCCV4","category":"devices","trade":"electrical","photo":true},{"name":"Hardwired Smoke & CO Combination Alarms","brand":"Kidde","model":"KN-COSM-IBA","category":"devices","trade":"electrical","photo":true},{"name":"radiant Screwless Wall Plates (1-gang; series incl. 2/3/4-gang)","brand":"Legrand \u2014 radiant Collection (Pass & Seymour)","model":"RWP26WCC10","category":"devices","trade":"electrical","photo":true},{"name":"Dryer Receptacle Outlet & Cover Plate (NEMA 14-30R)","brand":"Legrand \u2014 Pass & Seymour","model":"3864","category":"devices","trade":"electrical","photo":true},{"name":"LED Tape Light, 24V COB 3000K (Indoor)","brand":"HitLights","model":"HITLIGHTS-COB-INDOOR","category":"fixtures","trade":"electrical","photo":true},{"name":"LED Tape Light, 24V COB 3000K, IP67 (Wet Locations)","brand":"HitLights","model":"HITLIGHTS-COB-IP67","category":"fixtures","trade":"electrical","photo":true},{"name":"LED Tape Light, COB White, IP67","brand":"Armacost Lighting","model":"ARMACOST-COB-IP67","category":"fixtures","trade":"electrical","photo":true},{"name":"24V Dimmable LED Driver, 60W","brand":"Emitever","model":"EMITEVER-60W","category":"fixtures","trade":"electrical","photo":true},{"name":"24V Dimmable LED Driver, 96W, IP67","brand":"Emitever","model":"EMITEVER-96W","category":"fixtures","trade":"electrical","photo":true},{"name":"Load Center \u2014 200A Main-Lug, 30-Space, PN Series","brand":"Siemens","model":"PN3030L1200C","category":"panels","trade":"electrical","photo":true},{"name":"Dual-Function AFCI/GFCI Breaker, 20A 1-Pole","brand":"Siemens","model":"Q120DF","category":"panels","trade":"electrical","photo":true},{"name":"GFCI Receptacle \u2014 15A Self-Test, Tamper-Resistant, White","brand":"Legrand radiant","model":"1597TRW","category":"devices","trade":"electrical","photo":true},{"name":"GFCI Receptacle \u2014 15A Self-Test, Tamper- & Weather-Resistant","brand":"Legrand radiant","model":"1597TRWRWCC4","category":"devices","trade":"electrical","photo":true},{"name":"Smoke Alarm \u2014 Hardwired, Interconnected, Battery Backup","brand":"First Alert (BRK)","model":"9120B","category":"devices","trade":"electrical","photo":true},{"name":"Carbon Monoxide Alarm \u2014 Hardwired, Battery Backup","brand":"First Alert (BRK)","model":"CO5120BN","category":"devices","trade":"electrical","photo":true},{"name":"Intersystem Bonding Bridge","brand":"Arlington","model":"GB5","category":"grounding","trade":"electrical","photo":true},{"name":"Duplex Receptacle \u2014 15A Tamper-Resistant, Standard, White","brand":"Legrand Pass & Seymour","model":"TR5252W","category":"devices","trade":"electrical","photo":true},{"name":"Decorator Paddle Switch, Single-Pole, White","brand":"Legrand radiant","model":"TM870","category":"devices","trade":"electrical","photo":true},{"name":"Wall Plate \u2014 Standard Decorator, Screw-On, White","brand":"Legrand Pass & Seymour","model":"TP26W","category":"devices","trade":"electrical","photo":true},{"name":"AHRI Matched System Ratings (3 Systems) \u2014 Carrier 27SCA5 + FJ5","brand":"Carrier / AHRI","model":"AHRI-214179884","category":"ahri","trade":"hvac","photo":false},{"name":"Single-Stage Split Heat Pump \u2014 Comfort Series, R-454B, 3 Ton","brand":"Carrier","model":"27SCA536A003","category":"equipment","trade":"hvac","photo":true},{"name":"Multipoise Fan Coil \u2014 Comfort Series, R-454B (3 Ton)","brand":"Carrier","model":"FJ5ANXC42L00","category":"equipment","trade":"hvac","photo":true},{"name":"Electric Heat Strip \u2014 5 kW (Fan Coil Accessory)","brand":"Carrier","model":"KFFEH0501N05","category":"heat","trade":"hvac","photo":false},{"name":"Programmable Thermostat \u2014 T6 Pro","brand":"Honeywell Home (Resideo)","model":"TH6220U2000","category":"thermostats","trade":"hvac","photo":true},{"name":"Goodman GLZS5B 5-Ton Heat Pump (Sys 3)","brand":"Goodman","model":"GLZS5BA6010","category":"equipment","trade":"hvac","photo":true},{"name":"Goodman AMST 5-Ton Air Handler (Sys 3)","brand":"Goodman","model":"AMST60DU1300","category":"equipment","trade":"hvac","photo":true},{"name":"Goodman GLZS5B 3-Ton Heat Pump (Sys 1, 4, 5)","brand":"Goodman","model":"GLZS5BA3610","category":"equipment","trade":"hvac","photo":true},{"name":"Goodman AMST Air Handler (Sys 1, 4, 5)","brand":"Goodman","model":"AMST42CU1300","category":"equipment","trade":"hvac","photo":true},{"name":"Goodman GLZS5B 2-Ton Heat Pump (Sys 2)","brand":"Goodman","model":"GLZS5BA2410","category":"equipment","trade":"hvac","photo":true},{"name":"Goodman AMST 2-Ton Air Handler (Sys 2)","brand":"Goodman","model":"AMST24BU1300","category":"equipment","trade":"hvac","photo":true},{"name":"ecobee Smart Thermostat Premium","brand":"ecobee","model":"EB-STATE6P-01","category":"thermostats","trade":"hvac","photo":true},{"name":"ecobee SmartSensor 2-Pack","brand":"ecobee","model":"EB-RSHM2PK-01","category":"accessories","trade":"hvac","photo":true},{"name":"Aerus Air Scrubber by ActivePure (In-Duct Purifier)","brand":"Aerus","model":"A1013V","category":"accessories","trade":"hvac","photo":true},{"name":"AROMADD Central HVAC Scent Diffuser","brand":"AROMADD","model":"U5B","category":"accessories","trade":"hvac","photo":true},{"name":"Goodman GLZS4B 1.5-Ton R-32 Heat Pump","brand":"Goodman","model":"GLZS4BA1810","category":"equipment","trade":"hvac","photo":true},{"name":"Honeywell T4 Pro Programmable Thermostat","brand":"Honeywell Home (Resideo)","model":"TH4110U2005","category":"thermostats","trade":"hvac","photo":true},{"name":"RectorSeal Safe-T-Switch SS1 (97622) Condensate Overflow Switch","brand":"RectorSeal","model":"SS1","category":"accessories","trade":"hvac","photo":true},{"name":"DiversiTech UltraLite Equipment Pad, 32x32x3","brand":"DiversiTech","model":"UC3232-3","category":"accessories","trade":"hvac","photo":false},{"name":"Broan 80 CFM Bath Exhaust Fan","brand":"Broan","model":"AE80B","category":"accessories","trade":"hvac","photo":true},{"name":"Siemens 60A Non-Fusible A/C Disconnect","brand":"Siemens","model":"WN2060U","category":"accessories","trade":"hvac","photo":true},{"name":"Goodman 3-Ton Two-Stage R-32 Heat Pump Condenser (System 1)","brand":"Goodman","model":"GLZT7CA3610","category":"equipment","trade":"hvac","photo":true},{"name":"Goodman 2-Ton Two-Stage R-32 Heat Pump Condenser (System 2)","brand":"Goodman","model":"GLZT7CA2410","category":"equipment","trade":"hvac","photo":true},{"name":"Goodman Variable-Speed R-32 Air Handler (System 1)","brand":"Goodman","model":"AMVT42CP1300","category":"equipment","trade":"hvac","photo":true},{"name":"Goodman Variable-Speed R-32 Air Handler (System 2)","brand":"Goodman","model":"AMVT30BP1300","category":"equipment","trade":"hvac","photo":true},{"name":"Goodman 8 kW Electric Heat Kit with Breaker","brand":"Goodman","model":"HKTSD08X1","category":"heat","trade":"hvac","photo":true},{"name":"Goodman 5 kW Electric Heat Kit with Breaker","brand":"Goodman","model":"HKTSD05X1","category":"heat","trade":"hvac","photo":true},{"name":"Honeywell Home T10+ Pro Smart WiFi Thermostat","brand":"Honeywell Home (Resideo)","model":"THX321WFS3001W","category":"thermostats","trade":"hvac","photo":true},{"name":"Honeywell Home TrueZONE Zone Panel Kit","brand":"Honeywell Home (Resideo)","model":"HZ432K","category":"accessories","trade":"hvac","photo":true},{"name":"Goodman A2L Accessory / Zoning Control Kit","brand":"Goodman","model":"0230K00007","category":"accessories","trade":"hvac","photo":false},{"name":"Broan Automatic Make-Up Air Damper, 8 in.","brand":"Broan","model":"MD8TU","category":"accessories","trade":"hvac","photo":true},{"name":"AprilAire Ventilation Control System, Fresh Air","brand":"AprilAire","model":"8126X","category":"accessories","trade":"hvac","photo":true},{"name":"Carrier Comfort Single-Stage Split Heat Pump, 1.5 Ton","brand":"Carrier","model":"27SCA518A003","category":"equipment","trade":"hvac","photo":true},{"name":"Carrier Comfort Single-Stage Split Heat Pump, 4 Ton","brand":"Carrier","model":"27SCA548A003","category":"equipment","trade":"hvac","photo":true},{"name":"Carrier Comfort FJ5 Multipoise Fan Coil, 1.5 Ton","brand":"Carrier","model":"FJ5ANXB30L00","category":"equipment","trade":"hvac","photo":true},{"name":"Carrier Comfort FJ5 Multipoise Fan Coil, 4 Ton","brand":"Carrier","model":"FJ5ANXD60L00","category":"equipment","trade":"hvac","photo":true},{"name":"Carrier KFFEH Electric Heat Strip, 8 kW","brand":"Carrier","model":"KFFEH0801N08","category":"heat","trade":"hvac","photo":false},{"name":"Carrier WeatherMaster 50GE Packaged RTU, 10 Ton","brand":"Carrier","model":"50GEBN120","category":"equipment","trade":"hvac","photo":true},{"name":"Carrier WeatherMaster 50GE Packaged RTU, 7.5 Ton","brand":"Carrier","model":"50GEBN090","category":"equipment","trade":"hvac","photo":true},{"name":"Honeywell VisionPRO 8000 Thermostat (TH8321 Series)","brand":"Honeywell Home (Resideo)","model":"TH8321","category":"thermostats","trade":"hvac","photo":true},{"name":"Greenheck SP-B110-QD Ceiling Exhaust Fan","brand":"Greenheck","model":"SP-B110-QD","category":"accessories","trade":"hvac","photo":true},{"name":"Venstar ColorTouch Thermostat / Skyport EMS","brand":"Venstar","model":"T7900","category":"thermostats","trade":"hvac","photo":true},{"name":"Carrier GH5S Heat Pump Condenser, 3.5 Ton","brand":"Carrier","model":"GH5SAN54200AA0","category":"equipment","trade":"hvac","photo":true},{"name":"Carrier FJ5 Fan Coil (Florence, per load calc)","brand":"Carrier","model":"FJ5ANBC42L00","category":"equipment","trade":"hvac","photo":true},{"name":"Carrier GH5S Heat Pump Condenser, 3 Ton","brand":"Carrier","model":"GH5SAN53600AA0","category":"equipment","trade":"hvac","photo":true},{"name":"Carrier GH5S Heat Pump Condenser, 2 Ton","brand":"Carrier","model":"GH5SAN42400AA0","category":"equipment","trade":"hvac","photo":true},{"name":"Carrier FG4 Fan Coil (Lot 69, per energy forms)","brand":"Carrier","model":"FG4ANXB24L","category":"equipment","trade":"hvac","photo":true},{"name":"Siemens MM0202B1200 200A meter-main combo, back-to-back w/ panel on garage W wall","brand":"","model":"","category":"uncategorized","trade":"electrical","photo":true},{"name":"Siemens SN3048L1200 200A main-lug 30-space/48-circuit load center (per Sanjay via Nik 10/28: residential = Siemens 200A 30-space; replaces PN4040L1200 $200 est.)","brand":"","model":"","category":"uncategorized","trade":"electrical","photo":true},{"name":"4/0-4/0-4/0-2/0 AL SER meter-main to panel","brand":"","model":"","category":"uncategorized","trade":"electrical","photo":true},{"name":"#4 bare solid CU GEC","brand":"","model":"","category":"uncategorized","trade":"electrical","photo":true},{"name":"Ground rod 5/8x8 SOUTHERN ZZ588","brand":"","model":"","category":"uncategorized","trade":"electrical","photo":true},{"name":"Ground rod clamp F4P GRC-58","brand":"","model":"","category":"uncategorized","trade":"electrical","photo":true},{"name":"Grounding bridge F4P GBUS 6-2","brand":"","model":"","category":"uncategorized","trade":"electrical","photo":true},{"name":"2in SE cap clamp-on Topaz 736","brand":"","model":"","category":"uncategorized","trade":"electrical","photo":true},{"name":"Meter hub 2in MHB200","brand":"","model":"","category":"uncategorized","trade":"electrical","photo":false},{"name":"2in PVC Sch40 riser, 1 x 10 ft stick","brand":"","model":"","category":"uncategorized","trade":"electrical","photo":true},{"name":"2in terminal adapter PVC-F TA20","brand":"","model":"","category":"uncategorized","trade":"electrical","photo":true},{"name":"2in steel locknut Topaz 286","brand":"","model":"","category":"uncategorized","trade":"electrical","photo":true},{"name":"2in insulated bushing Topaz 336TZ","brand":"","model":"","category":"uncategorized","trade":"electrical","photo":true},{"name":"Siemens 2-pole GFCI: range 40A (QF240A, per Sanjay 10/28: range 40A), dryer 30A (Q230GF)","brand":"","model":"","category":"uncategorized","trade":"electrical","photo":false},{"name":"Siemens Q230 2-pole 30A, water heater","brand":"","model":"","category":"uncategorized","trade":"electrical","photo":true},{"name":"TR duplex receptacle P&S 3232TRW","brand":"","model":"","category":"uncategorized","trade":"electrical","photo":true},{"name":"WR TR duplex P&S 3232TRWRW (front + 2 lanai)","brand":"","model":"","category":"uncategorized","trade":"electrical","photo":true},{"name":"In-use cover Intermatic WP7000G","brand":"","model":"","category":"uncategorized","trade":"electrical","photo":true},{"name":"3-way switch P&S TM873W (4 pairs)","brand":"","model":"","category":"uncategorized","trade":"electrical","photo":true},{"name":"Duplex plate P&S TP8W","brand":"","model":"","category":"uncategorized","trade":"electrical","photo":true},{"name":"Smoke alarm BRK Smi100-AC","brand":"","model":"","category":"uncategorized","trade":"electrical","photo":true},{"name":"Smoke/CO combo BRK Smico100-AC","brand":"","model":"","category":"uncategorized","trade":"electrical","photo":true},{"name":"1G nail-on PSB118 (45 rec + 24 sw + 7 smoke)","brand":"","model":"","category":"uncategorized","trade":"electrical","photo":true},{"name":"Round ceiling box PSBR20","brand":"","model":"","category":"uncategorized","trade":"electrical","photo":true},{"name":"Pancake box CM-4PB, exterior wall lights","brand":"","model":"","category":"uncategorized","trade":"electrical","photo":true},{"name":"Fan/fixture support box CM-FSLPB","brand":"","model":"","category":"uncategorized","trade":"electrical","photo":true},{"name":"12/2 NM 250 ft roll (549 ft)","brand":"","model":"","category":"uncategorized","trade":"electrical","photo":true},{"name":"14/2 NM 250 ft roll (1,439 ft)","brand":"","model":"","category":"uncategorized","trade":"electrical","photo":true},{"name":"14/3 NM 250 ft roll (301 ft)","brand":"","model":"","category":"uncategorized","trade":"electrical","photo":true},{"name":"8/3 NM-B range 40A (per Sanjay 10/28: range 40A)","brand":"","model":"","category":"uncategorized","trade":"electrical","photo":true},{"name":"10/3 NM dryer","brand":"","model":"","category":"uncategorized","trade":"electrical","photo":true},{"name":"10/2 NM WH 11 ft + condenser 23 ft","brand":"","model":"","category":"uncategorized","trade":"electrical","photo":true},{"name":"AC disconnect 60A non-fused MAC-DNS60, condenser","brand":"","model":"","category":"uncategorized","trade":"electrical","photo":true},{"name":"Regular staples S100-100, 3 jars","brand":"","model":"","category":"uncategorized","trade":"electrical","photo":true},{"name":"Expanding foam F4P","brand":"","model":"","category":"uncategorized","trade":"electrical","photo":true},{"name":"Mounting ties F4P07-50M-W","brand":"","model":"","category":"uncategorized","trade":"electrical","photo":false},{"name":"Siemens SN3048L1200 30-space 200A ML load center (reference)","brand":"","model":"","category":"uncategorized","trade":"electrical","photo":true},{"name":"Siemens Q230GF 2P 30A GFCI (reference)","brand":"","model":"","category":"uncategorized","trade":"electrical","photo":true},{"name":"Siemens QF240A 2P 40A GFCI (reference)","brand":"","model":"","category":"uncategorized","trade":"electrical","photo":true},{"name":"NEMA 14-50R P&S 3894","brand":"","model":"","category":"uncategorized","trade":"electrical","photo":true},{"name":"Decora 2G plate TP262W","brand":"","model":"","category":"uncategorized","trade":"electrical","photo":true},{"name":"Decora 3G plate TP263W","brand":"","model":"","category":"uncategorized","trade":"electrical","photo":true},{"name":"Decora 4G plate TP264W","brand":"","model":"","category":"uncategorized","trade":"electrical","photo":true},{"name":"Power outlet plate TP703W","brand":"","model":"","category":"uncategorized","trade":"electrical","photo":true},{"name":"Siemens Q220 2P 20A (Nona condenser)","brand":"","model":"","category":"uncategorized","trade":"electrical","photo":true},{"name":"Whole-house surge protector (model TBD)","brand":"","model":"","category":"uncategorized","trade":"electrical","photo":false},{"name":"Siemens QF250A 2P 50A GFCI (EV)","brand":"","model":"","category":"uncategorized","trade":"electrical","photo":true},{"name":"Siemens QF230A 2P 30A GFCI (SI duplex dryer)","brand":"","model":"","category":"uncategorized","trade":"electrical","photo":true},{"name":"PVC 3/4\" 90 elbow SxS (406-007BC)","brand":"","model":"","category":"uncategorized","trade":"hvac","photo":true},{"name":"Boca plate 5\"x8\" 16ga (BOCA58)","brand":"","model":"","category":"uncategorized","trade":"hvac","photo":true},{"name":"Insultube 1/2\" x 7/8\" x 6' (RX048078)","brand":"","model":"","category":"uncategorized","trade":"hvac","photo":true},{"name":"8\" R-6 silver flex duct 25' bag","brand":"","model":"","category":"uncategorized","trade":"hvac","photo":true},{"name":"PVC cement clear 4oz","brand":"","model":"","category":"uncategorized","trade":"hvac","photo":true},{"name":"12in flex","brand":"","model":"","category":"uncategorized","trade":"hvac","photo":true},{"name":"9in flex","brand":"","model":"","category":"uncategorized","trade":"hvac","photo":true},{"name":"8in flex","brand":"","model":"","category":"uncategorized","trade":"hvac","photo":true},{"name":"7in flex","brand":"","model":"","category":"uncategorized","trade":"hvac","photo":true},{"name":"6in flex","brand":"","model":"","category":"uncategorized","trade":"hvac","photo":true},{"name":"5in flex","brand":"","model":"","category":"uncategorized","trade":"hvac","photo":true},{"name":"4in flex","brand":"","model":"","category":"uncategorized","trade":"hvac","photo":true},{"name":"Boot clips","brand":"","model":"","category":"uncategorized","trade":"hvac","photo":true},{"name":"Mastic","brand":"","model":"","category":"uncategorized","trade":"hvac","photo":true},{"name":"Duct tape","brand":"","model":"","category":"uncategorized","trade":"hvac","photo":true},{"name":"Hanging strap","brand":"","model":"","category":"uncategorized","trade":"hvac","photo":true},{"name":"T-fin","brand":"","model":"","category":"uncategorized","trade":"hvac","photo":false},{"name":"Line set 7/8 x 3/8","brand":"","model":"","category":"uncategorized","trade":"hvac","photo":true},{"name":"Pendant strap","brand":"","model":"","category":"uncategorized","trade":"hvac","photo":true}];

/* ---------------- utilities ---------------- */
const $ = (sel, el) => (el || document).querySelector(sel);
function esc(s){ return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function uid(prefix){ return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function todayStr(){
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");
}
function fmtDate(iso){
  if(!iso) return "—";
  const p = String(iso).split("-");
  if(p.length !== 3) return esc(iso);
  return MONTHS[parseInt(p[1],10)-1] + " " + parseInt(p[2],10) + ", " + p[0];
}
function daysBetween(fromIso, toIso){
  const a = new Date(fromIso + "T12:00:00"), b = new Date(toIso + "T12:00:00");
  return Math.round((b - a) / 86400000);
}
const USD = new Intl.NumberFormat("en-US", {style:"currency", currency:"USD"});
function money(n){ return USD.format(Number(n) || 0); }
function typeLabel(t){ t = String(t || "builder").toLowerCase(); return t === "builder" ? "Builder" : (t === "homeowner" ? "Homeowner" : (t === "commercial" ? "Commercial" : "Builder")); }
function djb2(str){
  let h = 5381;
  for(let i = 0; i < str.length; i++){ h = ((h << 5) + h + str.charCodeAt(i)) | 0; }
  return String(h >>> 0);
}

/* ---------------- data store ---------------- */
let DB = null;
function blankDB(){
  return {
    passHash: null,
    clients: [],
    quotes: [],
    jobs: [],
    invoices: [],
    requests: [],
    seq: { quote: 1001, invoice: 1001, client: 41 },
    importStamp: null,
    importInfo: null
  };
}
function loadDB(){
  try {
    const raw = localStorage.getItem(LS_KEY);
    if(raw){ DB = JSON.parse(raw); return; }
  } catch(e){ /* corrupted storage falls through to a fresh DB */ }
  DB = blankDB();
}
function saveDB(){ localStorage.setItem(LS_KEY, JSON.stringify(DB)); }
function seedIfNeeded(){
  if(!DB.clients || DB.clients.length === 0){
    DB.clients = JSON.parse(JSON.stringify(SEED_CLIENTS));
  }
  if(!DB.quotes) DB.quotes = [];
  if(!DB.jobs) DB.jobs = [];
  if(!DB.invoices) DB.invoices = [];
  if(!DB.requests) DB.requests = [];
  if(!DB.seq) DB.seq = { quote: 1001, invoice: 1001, client: 41 };
  DB.clients.forEach(c => {
    if(!("phone" in c)) c.phone = "";
    if(!("email" in c)) c.email = "";
    if(!("billingNotes" in c)) c.billingNotes = "";
    if(!Array.isArray(c.contacts)) c.contacts = [];
    if(!Array.isArray(c.properties)) c.properties = [];
  });
  /* migrate Stage A records to the Jobber-style shape */
  DB.invoices.forEach(inv => {
    if(!Array.isArray(inv.payments)){
      inv.payments = [];
      if(inv.payment){
        inv.payments.push({ date: inv.payment.date || inv.createdAt, method: inv.payment.method || "",
          ref: inv.payment.ref || "", amount: Number(inv.amount) || 0 });
        delete inv.payment;
      }
    }
    const mapped = mapInvoiceStatus(inv.status);
    if(mapped === "Past due"){ inv.status = "Sent"; inv.pastDue = true; }
    else if(mapped){ inv.status = mapped; }
  });
  DB.quotes.forEach(q => { if(!("title" in q)) q.title = ""; q.status = mapQuoteStatus(q.status) || q.status; });
  DB.jobs.forEach(j => { if(!j.stages) j.stages = blankStages(); });
  DB.requests.forEach(r => { if(!r.status) r.status = "New"; });
}

/* ---------------- passcode (SHA-256) ---------------- */
async function sha256(text){
  if(window.crypto && crypto.subtle){
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,"0")).join("");
  }
  /* Fallback for non-secure contexts only (rare): a simple non-crypto hash. */
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for(let i = 0; i < text.length; i++){
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16).padStart(8,"0") + (h1 >>> 0).toString(16).padStart(8,"0");
}

/* ---------------- gate: setup / lock / role ---------------- */
let ROLE = null;        /* "Owner" | "Office" — kept in sessionStorage */
let UNLOCKED = false;   /* in-memory only: every fresh page load starts locked */
const gateEl = () => $("#gate");

function gateHTML(inner){
  gateEl().innerHTML =
    '<div class="lockwrap"><div class="lockcard">' +
      '<div class="brand">SHARMA<span class="gold">360</span> · CRM</div>' +
      '<div class="sub">Sharma Electric &amp; HVAC</div>' + inner +
    '</div></div>';
}
function showSetup(){
  gateHTML(
    '<h2 class="view" style="text-align:center">Create your passcode</h2>' +
    '<p class="muted small">First run. Pick a passcode for this app — you will enter it each time you open the CRM. Only a scrambled (SHA-256) copy is stored on this device.</p>' +
    '<div class="err" id="gateerr"></div>' +
    '<label class="f" style="text-align:left">Passcode</label>' +
    '<input type="password" id="pc1" inputmode="numeric" autocomplete="new-password" placeholder="At least 4 characters">' +
    '<label class="f" style="text-align:left">Type it again</label>' +
    '<input type="password" id="pc2" inputmode="numeric" autocomplete="new-password" placeholder="Confirm passcode">' +
    '<button class="btn gold block" id="setupgo" style="margin-top:20px">Set passcode &amp; open CRM</button>'
  );
  $("#setupgo").addEventListener("click", async () => {
    const a = $("#pc1").value, b = $("#pc2").value, err = $("#gateerr");
    if(a.length < 4){ err.textContent = "Passcode needs at least 4 characters."; err.style.display = "block"; return; }
    if(a !== b){ err.textContent = "The two passcodes do not match."; err.style.display = "block"; return; }
    DB.passHash = await sha256(a);
    seedIfNeeded();
    saveDB();
    UNLOCKED = true;
    showRolePicker();
  });
}
function showLock(){
  gateHTML(
    '<h2 class="view" style="text-align:center">Locked</h2>' +
    '<p class="muted small">Enter your passcode to open the CRM.</p>' +
    '<div class="err" id="gateerr"></div>' +
    '<label class="f" style="text-align:left">Passcode</label>' +
    '<input type="password" id="pc" inputmode="numeric" autocomplete="current-password" placeholder="Passcode">' +
    '<button class="btn gold block" id="unlockgo" style="margin-top:20px">Unlock</button>'
  );
  const input = $("#pc");
  input.focus();
  const tryUnlock = async () => {
    const h = await sha256(input.value);
    if(h === DB.passHash){
      UNLOCKED = true;
      if(sessionStorage.getItem(SS_ROLE)){ ROLE = sessionStorage.getItem(SS_ROLE); enterApp(); }
      else showRolePicker();
    } else {
      const err = $("#gateerr");
      err.textContent = "That passcode is not right. Try again.";
      err.style.display = "block";
      input.value = "";
    }
  };
  $("#unlockgo").addEventListener("click", tryUnlock);
  input.addEventListener("keydown", e => { if(e.key === "Enter") tryUnlock(); });
}
function showRolePicker(){
  gateHTML(
    '<h2 class="view" style="text-align:center">Who is using the CRM?</h2>' +
    '<p class="muted small">Your role is remembered for this session only.</p>' +
    '<button class="rolebtn" id="role-owner"><span class="ic">👑</span><span><span class="t">Owner</span><br><span class="d">Sanjay — full access, including setting and sending quote prices</span></span></button>' +
    '<button class="rolebtn" id="role-office"><span class="ic">🗂️</span><span><span class="t">Office</span><br><span class="d">Office team — clients, jobs, invoices; quote prices are Owner-only</span></span></button>'
  );
  $("#role-owner").addEventListener("click", () => pickRole("Owner"));
  $("#role-office").addEventListener("click", () => pickRole("Office"));
}
function pickRole(r){
  ROLE = r;
  sessionStorage.setItem(SS_ROLE, r);
  enterApp();
}
function lockApp(){
  UNLOCKED = false;
  $("#appshell").classList.add("hidden");
  gateEl().classList.remove("hidden");
  showLock();
  window.scrollTo(0, 0);
}

/* ---------------- Jobber status mapping ----------------
   Imported records (data.json) may carry Jobber's status strings.
   Internal statuses: Quote Draft|Sent|Approved|Converted|Declined,
   Invoice Draft|Sent|Paid (Past due is a display state), Job Active|Completed (+Late). */
function normStatusStr(s){ return String(s == null ? "" : s).trim().toLowerCase().replace(/\s+/g, " "); }
function mapQuoteStatus(s){
  const k = normStatusStr(s);
  const map = {
    "draft": "Draft",
    "sent": "Sent",
    "awaiting": "Sent",
    "awaiting approval": "Sent",
    "awaiting response": "Sent",
    "awaiting client": "Sent",
    "approved": "Approved",
    "accepted": "Approved",
    "converted": "Converted",
    "declined": "Declined",
    "rejected": "Declined"
  };
  if(map[k]) return map[k];
  if(!k) return null;
  return k.replace(/\b\w/g, c => c.toUpperCase()); /* unknown: keep, title-cased */
}
function mapInvoiceStatus(s){
  const k = normStatusStr(s);
  const map = {
    "draft": "Draft",
    "awaiting payment": "Sent",
    "awaiting": "Sent",
    "sent": "Sent",
    "unpaid": "Sent",
    "partially paid": "Sent",
    "partial": "Sent",
    "paid": "Paid",
    "paid in full": "Paid",
    "past due": "Past due",
    "pastdue": "Past due",
    "overdue": "Past due"
  };
  if(map[k]) return map[k];
  if(!k) return null;
  return k.replace(/\b\w/g, c => c.toUpperCase());
}
function mapJobStatus(s){
  const k = normStatusStr(s);
  if(["active", "in progress", "in-progress", "open", "scheduled", "late"].includes(k)) return k === "late" ? "Late" : "Active";
  if(["completed", "complete", "done", "closed", "finished"].includes(k)) return "Completed";
  if(!k) return null;
  return k.replace(/\b\w/g, c => c.toUpperCase());
}

/* ---------------- data.json (Jobber export) merge ----------------
   Merge keys: clients by id, then by name; quotes & invoices by their
   Jobber number (the natural key); jobs by id, then by quote number.
   The merge runs once per data.json content (stamp of the file text),
   so local edits made after an import are not overwritten on reload. */
function normNumber(num, prefix){
  let n = String(num == null ? "" : num).trim().replace(/^#/, "").trim();
  if(!n) return "";
  if(prefix && n.toUpperCase().indexOf(prefix) !== 0){
    const digits = n.replace(/[^0-9]/g, "");
    if(digits) n = prefix + digits;
  }
  return n;
}
function numKey(num){ return String(num == null ? "" : num).replace(/[^0-9]/g, ""); }
function findClientByName(name){
  const k = String(name || "").trim().toLowerCase();
  if(!k) return null;
  return DB.clients.find(c => c.name.trim().toLowerCase() === k) || null;
}
function findQuoteByNumber(num){
  const k = numKey(num);
  if(!k) return null;
  return DB.quotes.find(q => numKey(q.number) === k) || null;
}
function findInvoiceByNumber(num){
  const k = numKey(num);
  if(!k) return null;
  return DB.invoices.find(i => numKey(i.number) === k) || null;
}
function cleanTrade(t, hintText){
  const k = normStatusStr(t);
  if(k === "electric" || k === "electrical") return "Electric";
  if(k === "hvac" || k === "mechanical") return "HVAC";
  const hint = (String(t || "") + " " + String(hintText || "")).toLowerCase();
  if(/hvac|a\/c|air condition|heat pump|furnace|mini.?split/.test(hint)) return "HVAC";
  return "Electric";
}
function cleanClientType(t){
  const k = normStatusStr(t);
  if(k === "builder" || k === "homeowner" || k === "commercial") return k;
  if(k === "residential") return "homeowner";
  if(k === "gc" || k === "general contractor") return "builder";
  return "homeowner";
}
function mergeClientRecord(rec){
  let c = null;
  if(rec.id) c = DB.clients.find(x => x.id === rec.id) || null;
  if(!c && rec.name) c = findClientByName(rec.name);
  if(!c){
    c = { id: rec.id || ("c" + String(DB.seq.client++).padStart(3, "0")),
      type: cleanClientType(rec.type), name: String(rec.name || "Unnamed client"),
      phone: "", email: "", billingNotes: "", notes: "", contacts: [], properties: [],
      source: "Jobber import" };
    DB.clients.push(c);
  }
  if(rec.name) c.name = String(rec.name);
  if(rec.type) c.type = cleanClientType(rec.type);
  ["phone", "email", "billingNotes", "notes"].forEach(f => {
    if(rec[f] && !c[f]) c[f] = String(rec[f]);
  });
  (rec.contacts || []).forEach(rc => {
    const nm = String(rc.name || "").trim();
    if(!nm) return;
    if(!c.contacts.some(x => x.name.trim().toLowerCase() === nm.toLowerCase())){
      c.contacts.push({ id: rc.id || uid("ct"), name: nm, role: String(rc.role || ""),
        phone: String(rc.phone || ""), email: String(rc.email || "") });
    }
  });
  const props = (rec.properties || []).slice();
  if(rec.address && props.length === 0) props.push({ address: rec.address });
  props.forEach(rp => {
    const addr = String(rp.address || "").trim();
    const comm = String(rp.community || "").trim();
    if(!addr && !comm) return;
    const dup = c.properties.some(x =>
      (addr && String(x.address || "").trim().toLowerCase() === addr.toLowerCase()) ||
      (comm && String(x.community || "").trim().toLowerCase() === comm.toLowerCase() && !addr));
    if(!dup){
      c.properties.push({ id: rp.id || uid("p"), address: addr, community: comm,
        plan: String(rp.plan || ""), livingSF: rp.livingSF != null ? String(rp.livingSF) : "",
        roofSF: rp.roofSF != null ? String(rp.roofSF) : "" });
    }
  });
  return c;
}
function mergeQuoteRecord(rec){
  const number = normNumber(rec.number != null ? rec.number : (rec.quoteNumber != null ? rec.quoteNumber : rec.id), "Q-");
  if(!number) return null;
  let client = null;
  if(rec.clientId) client = DB.clients.find(x => x.id === rec.clientId) || null;
  if(!client && (rec.clientName || rec.client)) client = findClientByName(rec.clientName || rec.client);
  if(!client && (rec.clientName || rec.client)) client = mergeClientRecord({ name: rec.clientName || rec.client, type: rec.clientType });
  if(!client) return null;
  let propertyId = "";
  if(rec.propertyId && (client.properties || []).some(p => p.id === rec.propertyId)) propertyId = rec.propertyId;
  else if(rec.property || rec.propertyAddress){
    const want = String(rec.propertyAddress || rec.property || "").trim().toLowerCase();
    const p = (client.properties || []).find(x => String(x.address || "").trim().toLowerCase() === want || String(x.community || "").trim().toLowerCase() === want);
    if(p) propertyId = p.id;
  }
  const lines = (rec.lines || rec.lineItems || []).map(l => ({
    desc: String(l.desc || l.description || l.name || ""),
    qty: Number(l.qty != null ? l.qty : (l.quantity != null ? l.quantity : 1)) || 0,
    price: Number(l.price != null ? l.price : (l.unitPrice != null ? l.unitPrice : (l.amount != null ? l.amount : 0))) || 0
  })).filter(l => l.desc || l.price);
  const mapped = mapQuoteStatus(rec.status) || "Draft";
  const fields = {
    clientId: client.id,
    propertyId: propertyId,
    trade: cleanTrade(rec.trade, rec.title || rec.name || (lines[0] && lines[0].desc)),
    title: String(rec.title || rec.name || ""),
    lines: lines,
    totalAmount: (rec.total != null ? Number(rec.total) : (rec.amount != null ? Number(rec.amount) : null)),
    status: mapped === "Past due" ? "Sent" : mapped,
    createdAt: String(rec.createdAt || rec.date || rec.issuedDate || todayStr()).slice(0, 10),
    sentAt: rec.sentAt ? String(rec.sentAt).slice(0, 10) : null,
    approvedAt: rec.approvedAt ? String(rec.approvedAt).slice(0, 10) : null
  };
  let q = findQuoteByNumber(number);
  if(q){ Object.assign(q, fields); }
  else {
    q = Object.assign({ id: uid("q"), number: number }, fields);
    DB.quotes.push(q);
  }
  const digits = parseInt(numKey(number), 10);
  if(digits && digits >= DB.seq.quote) DB.seq.quote = digits + 1;
  return q;
}
function mergeInvoiceRecord(rec){
  const number = normNumber(rec.number != null ? rec.number : (rec.invoiceNumber != null ? rec.invoiceNumber : rec.id), "INV-");
  if(!number) return null;
  let client = null;
  if(rec.clientId) client = DB.clients.find(x => x.id === rec.clientId) || null;
  if(!client && (rec.clientName || rec.client)) client = findClientByName(rec.clientName || rec.client);
  if(!client && (rec.clientName || rec.client)) client = mergeClientRecord({ name: rec.clientName || rec.client, type: rec.clientType });
  if(!client) return null;
  let quoteId = "", jobId = rec.jobId || "";
  const qref = rec.quoteNumber != null ? rec.quoteNumber : rec.quoteId;
  if(qref){
    const q = DB.quotes.find(x => x.id === qref) || findQuoteByNumber(qref);
    if(q){ quoteId = q.id; const j = DB.jobs.find(x => x.quoteId === q.id); if(j && !jobId) jobId = j.id; }
  }
  const mapped = mapInvoiceStatus(rec.status) || "Draft";
  const payments = [];
  const rawPays = rec.payments || (rec.payment ? [rec.payment] : []);
  rawPays.forEach(p => {
    payments.push({ date: String(p.date || rec.createdAt || todayStr()).slice(0, 10),
      method: String(p.method || ""), ref: String(p.ref || p.reference || ""),
      amount: Number(p.amount != null ? p.amount : (rec.amount != null ? rec.amount : (rec.total != null ? rec.total : 0))) || 0 });
  });
  const fields = {
    clientId: client.id,
    jobId: jobId,
    quoteId: quoteId,
    propertyId: rec.propertyId || "",
    trade: cleanTrade(rec.trade, rec.title || ""),
    basis: rec.basis === "draw" ? "draw" : "full",
    drawPct: rec.drawPct != null ? Number(rec.drawPct) : null,
    amount: Number(rec.amount != null ? rec.amount : (rec.total != null ? rec.total : 0)) || 0,
    status: mapped === "Past due" ? "Sent" : mapped,
    pastDue: mapped === "Past due" ? true : !!rec.pastDue,
    dueDate: rec.dueDate ? String(rec.dueDate).slice(0, 10) : null,
    createdAt: String(rec.createdAt || rec.issuedDate || rec.date || todayStr()).slice(0, 10),
    sentAt: rec.sentAt ? String(rec.sentAt).slice(0, 10) : null,
    payments: payments
  };
  if(fields.status === "Sent" && !fields.sentAt) fields.sentAt = fields.createdAt;
  let inv = findInvoiceByNumber(number);
  if(inv){ Object.assign(inv, fields); }
  else {
    inv = Object.assign({ id: uid("inv"), number: number }, fields);
    DB.invoices.push(inv);
  }
  const digits = parseInt(numKey(number), 10);
  if(digits && digits >= DB.seq.invoice) DB.seq.invoice = digits + 1;
  return inv;
}
function mergeJobRecord(rec){
  let job = null;
  if(rec.id) job = DB.jobs.find(x => x.id === rec.id) || null;
  let quote = null;
  const qref = rec.quoteNumber != null ? rec.quoteNumber : rec.quoteId;
  if(qref) quote = DB.quotes.find(x => x.id === qref) || findQuoteByNumber(qref);
  if(!job && quote) job = DB.jobs.find(x => x.quoteId === quote.id) || null;
  let client = null;
  if(rec.clientId) client = DB.clients.find(x => x.id === rec.clientId) || null;
  if(!client && quote) client = DB.clients.find(x => x.id === quote.clientId) || null;
  if(!client && (rec.clientName || rec.client)) client = findClientByName(rec.clientName || rec.client);
  if(!client && (rec.clientName || rec.client)) client = mergeClientRecord({ name: rec.clientName || rec.client, type: rec.clientType });
  if(!client) return null;
  const mapped = mapJobStatus(rec.status);
  if(!job){
    job = { id: rec.id || uid("j"), quoteId: quote ? quote.id : "", clientId: client.id,
      propertyId: rec.propertyId || (quote ? quote.propertyId : ""), trade: cleanTrade(rec.trade, rec.title || ""),
      createdAt: String(rec.createdAt || rec.date || todayStr()).slice(0, 10), stages: blankStages(),
      status: "Active", lateFlag: false };
    DB.jobs.push(job);
  }
  if(quote && !job.quoteId) job.quoteId = quote.id;
  job.clientId = client.id;
  if(rec.title) job.title = String(rec.title);
  if(rec.number != null) job.jobberNumber = String(rec.number).replace(/^#/, "");
  const jAmt = rec.total != null ? Number(rec.total) : (rec.amount != null ? Number(rec.amount) : null);
  if(jAmt != null && !isNaN(jAmt)) job.amount = jAmt;
  if(mapped === "Completed") job.status = "Completed";
  else if(mapped === "Late"){ job.status = "Active"; job.lateFlag = true; }
  else if(mapped === "Active" && job.status !== "Completed") job.status = "Active";
  if(rec.stages){
    if(Array.isArray(rec.stages)){
      rec.stages.forEach(s => {
        const key = STAGES.find(st => st.label.toLowerCase() === normStatusStr(s.name || s.label || s.key) || st.key === normStatusStr(s.key || s.name));
        if(key){
          const st = normStatusStr(s.status);
          job.stages[key.key] = { status: st === "done" || st === "completed" || st === "complete" ? "done" : (st === "scheduled" || st === "sched" ? "sched" : "not"),
            date: s.date ? String(s.date).slice(0, 10) : (job.stages[key.key] ? job.stages[key.key].date : "") };
        }
      });
    } else {
      STAGES.forEach(st => {
        const s = rec.stages[st.key];
        if(!s) return;
        const raw = typeof s === "string" ? { status: s } : s;
        const v = normStatusStr(raw.status);
        job.stages[st.key] = { status: v === "done" || v === "completed" || v === "complete" ? "done" : (v === "scheduled" || v === "sched" ? "sched" : "not"),
          date: raw.date ? String(raw.date).slice(0, 10) : (job.stages[st.key] ? job.stages[st.key].date : "") };
      });
    }
  }
  if(job.stages.final && job.stages.final.status === "done") job.status = "Completed";
  return job;
}
function mergeExternalData(data){
  const counts = { clients: 0, quotes: 0, jobs: 0, invoices: 0 };
  if(!data || typeof data !== "object") return counts;
  (data.clients || []).forEach(r => { if(mergeClientRecord(r)) counts.clients++; });
  (data.quotes || []).forEach(r => { if(mergeQuoteRecord(r)) counts.quotes++; });
  (data.jobs || []).forEach(r => { if(mergeJobRecord(r)) counts.jobs++; });
  (data.invoices || []).forEach(r => { if(mergeInvoiceRecord(r)) counts.invoices++; });
  return counts;
}
async function loadExternalData(){
  try {
    const res = await fetch("data.json", { cache: "no-store" });
    if(!res || !res.ok) return;
    const text = await res.text();
    const stamp = djb2(text);
    if(DB.importStamp === stamp) return;
    const data = JSON.parse(text);
    const counts = mergeExternalData(data);
    DB.importStamp = stamp;
    DB.importInfo = { at: todayStr(), counts: counts };
    saveDB();
    if(UNLOCKED) render();
  } catch(e){ /* no data.json in this folder yet — the app runs on local data */ }
}

/* ---------------- app state & lookups ---------------- */
let TAB = "home";
let selClientId = null, selQuoteId = null, selJobId = null, selInvoiceId = null, selRequestId = null;
let clientSearch = "", clientFilter = "all";
let quoteFilter = "All", quoteSort = "new";
let productSearch = "";

function clientById(id){ return DB.clients.find(c => c.id === id) || null; }
function quoteById(id){ return DB.quotes.find(q => q.id === id) || null; }
function jobById(id){ return DB.jobs.find(j => j.id === id) || null; }
function invoiceById(id){ return DB.invoices.find(i => i.id === id) || null; }
function requestById(id){ return DB.requests.find(r => r.id === id) || null; }
function propertyById(client, pid){
  if(!client || !pid) return null;
  return (client.properties || []).find(p => p.id === pid) || null;
}
function propertyLabel(client, pid){
  const p = propertyById(client, pid);
  if(!p) return "No property selected";
  if(client && String(client.type).toLowerCase() === "builder"){
    return (p.community || "—") + (p.address ? " · " + p.address : "");
  }
  return p.address || "—";
}
function clientAddressLine(c){
  if(!c) return "";
  const p = (c.properties || [])[0];
  if(p) return String(c.type).toLowerCase() === "builder"
    ? ((p.community || "") + (p.address ? " · " + p.address : "")).trim()
    : (p.address || "");
  return "";
}
function quoteTotal(q){
  const lines = q.lines || [];
  if(lines.length) return lines.reduce((sum, l) => sum + (Number(l.qty) || 0) * (Number(l.price) || 0), 0);
  return Number(q.totalAmount) || 0;
}
function quoteTitle(q){
  if(q.title) return q.title;
  if(q.lines && q.lines.length && q.lines[0].desc) return q.lines[0].desc;
  const c = clientById(q.clientId);
  return propertyLabel(c, q.propertyId) !== "No property selected" ? propertyLabel(c, q.propertyId) : (q.trade + " quote");
}
const STAGES = [
  { key: "tug",         label: "TUG" },
  { key: "underground", label: "Underground" },
  { key: "roughin",     label: "Rough-in" },
  { key: "trim",        label: "Trim" },
  { key: "final",       label: "Final" }
];
function blankStages(){
  const s = {};
  STAGES.forEach(st => { s[st.key] = { status: "not", date: "" }; });
  return s;
}
function jobDoneCount(job){
  return STAGES.filter(st => job.stages && job.stages[st.key] && job.stages[st.key].status === "done").length;
}
function jobIsLate(job){
  if(job.lateFlag) return true;
  const t = todayStr();
  return STAGES.some(st => {
    const s = job.stages && job.stages[st.key];
    return s && s.status === "sched" && s.date && s.date < t;
  });
}
function jobDisplayStatus(job){
  if((job.stages && job.stages.final && job.stages.final.status === "done") || job.status === "Completed") return "Completed";
  if(jobIsLate(job)) return "Late";
  return "Active";
}
function jobAmount(job){
  const q = job.quoteId ? quoteById(job.quoteId) : null;
  return q ? quoteTotal(q) : (Number(job.amount) || 0);
}
function jobInvoiced(job){
  return DB.invoices.filter(i => i.jobId === job.id && i.status !== "Draft")
    .reduce((s, i) => s + (Number(i.amount) || 0), 0);
}
function invoicePaidSum(inv){
  return (inv.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
}
function invoiceBalance(inv){
  return Math.max(0, Math.round(((Number(inv.amount) || 0) - invoicePaidSum(inv)) * 100) / 100);
}
function invoiceIsPastDue(inv){
  if(inv.status !== "Sent") return false;
  if(invoiceBalance(inv) <= 0) return false;
  if(inv.pastDue) return true;
  const t = todayStr();
  if(inv.dueDate && inv.dueDate < t) return true;
  const from = inv.sentAt || inv.createdAt;
  return from ? daysBetween(from, t) > 30 : false;
}
function displayInvoiceStatus(inv){
  if(inv.status === "Paid" || (inv.status === "Sent" && invoiceBalance(inv) <= 0 && invoicePaidSum(inv) > 0)) return "Paid";
  if(inv.status === "Draft") return "Draft";
  if(invoiceIsPastDue(inv)) return "Past due";
  return "Awaiting payment";
}
function clientBalanceOwed(clientId){
  return DB.invoices.filter(i => i.clientId === clientId && i.status === "Sent")
    .reduce((s, i) => s + invoiceBalance(i), 0);
}
function clientMoney(clientId){
  const quoted = DB.quotes.filter(q => q.clientId === clientId && q.status !== "Declined")
    .reduce((s, q) => s + quoteTotal(q), 0);
  const invoiced = DB.invoices.filter(i => i.clientId === clientId && i.status !== "Draft")
    .reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const paid = DB.invoices.filter(i => i.clientId === clientId)
    .reduce((s, i) => s + invoicePaidSum(i), 0);
  return { quoted: quoted, invoiced: invoiced, paid: paid, owed: clientBalanceOwed(clientId) };
}
/* dashboard helpers (Jobber Home insights) */
function quotesAwaitingApproval(){
  const list = DB.quotes.filter(q => q.status === "Sent");
  return { count: list.length, total: list.reduce((s, q) => s + quoteTotal(q), 0), list: list };
}
function invoicesAwaitingPayment(){
  const list = DB.invoices.filter(i => displayInvoiceStatus(i) === "Awaiting payment");
  return { count: list.length, total: list.reduce((s, i) => s + invoiceBalance(i), 0), list: list };
}
function invoicesPastDue(){
  const list = DB.invoices.filter(i => displayInvoiceStatus(i) === "Past due");
  return { count: list.length, total: list.reduce((s, i) => s + invoiceBalance(i), 0), list: list };
}
function activeJobs(){
  return DB.jobs.filter(j => jobDisplayStatus(j) !== "Completed");
}
function jobsScheduledToday(){
  const t = todayStr();
  return DB.jobs.filter(j => STAGES.some(st => {
    const s = j.stages && j.stages[st.key];
    return s && s.status === "sched" && s.date === t;
  }));
}
function recentActivity(limit){
  const items = [];
  DB.quotes.forEach(q => items.push({ kind: "quote", id: q.id, date: q.createdAt || "",
    title: q.number + " — " + quoteTitle(q), sub: "Quote · " + q.status + " · " + money(quoteTotal(q)) }));
  DB.jobs.forEach(j => {
    const c = clientById(j.clientId);
    items.push({ kind: "job", id: j.id, date: j.createdAt || "",
      title: (c ? c.name : "Job") + " — " + j.trade + " job",
      sub: "Job · " + jobDisplayStatus(j) + " · " + jobDoneCount(j) + " of 5 stages done" });
  });
  DB.invoices.forEach(i => items.push({ kind: "invoice", id: i.id, date: i.createdAt || "",
    title: i.number + " — " + (clientById(i.clientId) ? clientById(i.clientId).name : "Invoice"),
    sub: "Invoice · " + displayInvoiceStatus(i) + " · " + money(i.amount) }));
  items.sort((a, b) => (b.date || "").localeCompare(a.date || "") || b.title.localeCompare(a.title));
  return items.slice(0, limit || 8);
}

/* ---------------- status pills (from the v2 app) ---------------- */
function clientPill(c){
  const t = String(c.type || "builder").toLowerCase();
  if(t === "builder") return '<span class="pill navy">Builder</span>';
  if(t === "homeowner") return '<span class="pill gold">Homeowner</span>';
  return '<span class="pill blue">Commercial</span>';
}
function quotePill(st){
  if(st === "Draft") return '<span class="pill grey">Draft</span>';
  if(st === "Sent") return '<span class="pill blue">Sent</span>';
  if(st === "Approved") return '<span class="pill green">Approved</span>';
  if(st === "Converted") return '<span class="pill navy">Converted</span>';
  if(st === "Declined") return '<span class="pill red">Declined</span>';
  return '<span class="pill grey">' + esc(st) + '</span>';
}
function tradeTag(trade){
  return trade === "HVAC" ? '<span class="badge gold">HVAC</span>' : '<span class="badge">Electric</span>';
}
function jobPill(j){
  const st = jobDisplayStatus(j);
  if(st === "Completed") return '<span class="pill green">Completed</span>';
  if(st === "Late") return '<span class="pill red">Late</span>';
  return '<span class="pill gold">Active</span>';
}
function invoicePill(inv){
  const st = displayInvoiceStatus(inv);
  if(st === "Paid") return '<span class="pill green">Paid</span>';
  if(st === "Past due") return '<span class="pill red">Past due</span>';
  if(st === "Draft") return '<span class="pill grey">Draft</span>';
  return '<span class="pill gold">Awaiting payment</span>';
}

/* =====================================================================
   v3 SHELL — view/action registries, router, global click delegation,
   forms state, confirm modal, toast, global search, boot.
   view-*.js files register VIEWS.<tab> (returns HTML for #main) and
   ACTIONS.<name> (click handlers for [data-act="<name>"]). A missing
   view renders a graceful placeholder; a missing action toasts.
   ===================================================================== */
const VIEWS = {};
const ACTIONS = {};
let FORM_HTML = null;   /* when set, render() shows this instead of the tab view */
const VIEW_TITLES = { home: "Home", clients: "Clients", quotes: "Quotes", jobs: "Jobs",
  invoices: "Invoices", more: "More", settings: "Settings" };

function isOwner(){ return ROLE === "Owner"; }

/* ---------------- app entry / routing ---------------- */
function enterApp(){
  gateEl().classList.add("hidden");
  gateEl().innerHTML = "";
  $("#appshell").classList.remove("hidden");
  const chip = $("#rolechip");
  if(chip) chip.textContent = ROLE;
  updateNav();
  render();
}
function go(tab){
  TAB = tab;
  FORM_HTML = null;
  selClientId = selQuoteId = selJobId = selInvoiceId = selRequestId = null;
  render();
  window.scrollTo(0, 0);
}
function render(){
  if(!UNLOCKED) return;
  const main = $("#main");
  if(!main) return;
  document.querySelectorAll("[data-nav]").forEach(b => b.classList.toggle("on", b.dataset.nav === TAB));
  const t = $("#viewtitle");
  if(t) t.textContent = VIEW_TITLES[TAB] || "CRM";
  updateNav();
  if(FORM_HTML != null){ main.innerHTML = FORM_HTML; return; }
  const v = VIEWS[TAB];
  if(typeof v === "function"){
    main.innerHTML = v();
  } else {
    main.innerHTML = '<div class="card empty-module"><div class="empty-ic">◌</div>' +
      '<h3>Module loading</h3><p class="muted">The ' + esc(VIEW_TITLES[TAB] || TAB) +
      ' module has not loaded yet. Everything else in the CRM still works.</p></div>';
  }
}
function updateNav(){
  if(!DB) return;
  const set = (id, n) => { const e = document.getElementById(id); if(e) e.textContent = n; };
  set("navcount-clients", DB.clients.length);
  set("navcount-quotes", DB.quotes.length);
  set("navcount-jobs", DB.jobs.length);
  set("navcount-invoices", DB.invoices.length);
  const pd = invoicesPastDue().count;
  const badge = document.getElementById("tabbadge-invoices");
  if(badge){ badge.textContent = pd; badge.classList.toggle("hidden", pd === 0); }
}

/* ---------------- forms state ---------------- */
function openForm(html){ FORM_HTML = html; render(); window.scrollTo(0, 0); }
function closeForm(){ FORM_HTML = null; render(); }

/* ---------------- confirm modal + toast ---------------- */
let _confirmFn = null;
function confirmAct(msg, fn){
  _confirmFn = fn;
  const root = $("#modal-root");
  if(!root) return;
  root.innerHTML = '<div class="modalwrap"><div class="modalcard" role="alertdialog" aria-modal="true">' +
    '<p class="modalmsg">' + esc(msg) + '</p>' +
    '<div class="modalbtns"><button class="btn ghost" data-act="confirmNo">Cancel</button>' +
    '<button class="btn danger" data-act="confirmYes">Yes, continue</button></div></div></div>';
}
function closeModal(){
  const root = $("#modal-root");
  if(root) root.innerHTML = "";
  _confirmFn = null;
}
ACTIONS.confirmNo = function(){ closeModal(); };
ACTIONS.confirmYes = function(){ const f = _confirmFn; closeModal(); if(f) f(); };

let _toastTimer = null;
function toast(msg){
  const t = $("#toast");
  if(!t) return;
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
}

/* ---------------- core actions ---------------- */
ACTIONS.lock = function(){ lockApp(); };
ACTIONS.switchRole = function(){
  $("#appshell").classList.add("hidden");
  gateEl().classList.remove("hidden");
  showRolePicker();
};
ACTIONS.globalNew = function(){
  const root = $("#modal-root");
  if(!root) return;
  const items = [["newClient", "Client"], ["newQuote", "Quote"], ["newJob", "Job"],
    ["newInvoice", "Invoice"], ["newRequest", "Request"]];
  root.innerHTML = '<div class="modalwrap"><div class="modalcard"><h3 class="modalh">Create new</h3>' +
    items.map(x => '<button class="menuitem" data-act="' + x[0] + '"><span class="mi-plus">＋</span> New ' + x[1] + '</button>').join("") +
    '<div class="modalbtns"><button class="btn ghost block" data-act="confirmNo">Cancel</button></div></div></div>';
};

/* ---------------- record opening (data-open-*) ---------------- */
function setSel(kind, id){
  if(kind === "client") selClientId = id;
  else if(kind === "quote") selQuoteId = id;
  else if(kind === "job") selJobId = id;
  else if(kind === "invoice") selInvoiceId = id;
  else if(kind === "request") selRequestId = id;
}
const KIND_TAB = { client: "clients", quote: "quotes", job: "jobs", invoice: "invoices", request: "more" };
function openRecord(kind, id){
  setSel(kind, id);
  FORM_HTML = null;
  TAB = KIND_TAB[kind] || "home";
  const fn = ACTIONS["open" + kind.charAt(0).toUpperCase() + kind.slice(1)];
  if(typeof fn === "function") fn(null, null); else render();
  window.scrollTo(0, 0);
}
function handleOpen(el, ev){
  const map = [["openClient", "client"], ["openQuote", "quote"], ["openJob", "job"],
    ["openInvoice", "invoice"], ["openRequest", "request"]];
  for(let i = 0; i < map.length; i++){
    const id = el.dataset[map[i][0]];
    if(id){
      const kind = map[i][1];
      setSel(kind, id);
      FORM_HTML = null;
      TAB = KIND_TAB[kind] || "home";
      const fn = ACTIONS["open" + kind.charAt(0).toUpperCase() + kind.slice(1)];
      if(typeof fn === "function") fn(el, ev); else render();
      window.scrollTo(0, 0);
      return;
    }
  }
}

/* ---------------- global click delegation ---------------- */
document.addEventListener("click", function(ev){
  const t = ev.target;
  const closest = (sel) => (t && t.closest ? t.closest(sel) : null);
  const navEl = closest("[data-nav]");
  if(navEl){ go(navEl.dataset.nav); return; }
  const openEl = closest("[data-open-client],[data-open-quote],[data-open-job],[data-open-invoice],[data-open-request]");
  if(openEl){ handleOpen(openEl, ev); return; }
  const actEl = closest("[data-act]");
  if(actEl){
    const name = actEl.dataset.act;
    const fn = ACTIONS[name];
    if(typeof fn === "function"){
      if(name !== "confirmYes" && name !== "confirmNo") closeModal();
      fn(actEl, ev);
    } else {
      toast("That feature is still loading.");
    }
    return;
  }
  if(!closest(".searchwrap")) hideSearchResults();
});

/* ---------------- global search ---------------- */
function searchAll(q){
  q = String(q || "").trim().toLowerCase();
  if(q.length < 2 || !DB) return [];
  const out = [];
  DB.clients.forEach(c => {
    if(c.name.toLowerCase().indexOf(q) >= 0)
      out.push({ kind: "client", id: c.id, title: c.name, sub: typeLabel(c.type) + " · Client" });
  });
  DB.quotes.forEach(x => {
    const c = clientById(x.clientId);
    if(x.number.toLowerCase().indexOf(q) >= 0 || quoteTitle(x).toLowerCase().indexOf(q) >= 0 ||
       (c && c.name.toLowerCase().indexOf(q) >= 0))
      out.push({ kind: "quote", id: x.id, title: x.number + " — " + quoteTitle(x),
        sub: "Quote · " + (c ? c.name : "") + " · " + money(quoteTotal(x)) });
  });
  DB.jobs.forEach(x => {
    const c = clientById(x.clientId);
    const title = x.title || ((c ? c.name : "Job") + " — " + x.trade + " job");
    if(title.toLowerCase().indexOf(q) >= 0 || (x.jobberNumber && String(x.jobberNumber).indexOf(q) >= 0))
      out.push({ kind: "job", id: x.id, title: title, sub: "Job · " + jobDisplayStatus(x) + (c ? " · " + c.name : "") });
  });
  DB.invoices.forEach(x => {
    const c = clientById(x.clientId);
    if(x.number.toLowerCase().indexOf(q) >= 0 || (c && c.name.toLowerCase().indexOf(q) >= 0))
      out.push({ kind: "invoice", id: x.id, title: x.number + " — " + (c ? c.name : "Invoice"),
        sub: "Invoice · " + displayInvoiceStatus(x) + " · " + money(x.amount) });
  });
  return out.slice(0, 12);
}
function hideSearchResults(){
  const r = $("#searchresults");
  if(r){ r.classList.add("hidden"); r.innerHTML = ""; }
}
function wireSearch(){
  const inp = $("#globalsearch"), box = $("#searchresults");
  if(!inp || !box) return;
  inp.addEventListener("input", () => {
    const res = searchAll(inp.value);
    if(!res.length){
      box.innerHTML = inp.value.trim().length >= 2 ? '<div class="sr-none">No matches</div>' : "";
      box.classList.toggle("hidden", inp.value.trim().length < 2);
      return;
    }
    box.innerHTML = res.map(r => '<button class="sr-item" data-sr-kind="' + r.kind + '" data-sr-id="' + esc(r.id) + '">' +
      '<span class="sr-t">' + esc(r.title) + '</span><span class="sr-s">' + esc(r.sub) + '</span></button>').join("");
    box.classList.remove("hidden");
  });
  inp.addEventListener("keydown", e => { if(e.key === "Escape"){ hideSearchResults(); inp.blur(); } });
  box.addEventListener("click", e => {
    const b = e.target && e.target.closest ? e.target.closest("[data-sr-kind]") : null;
    if(!b) return;
    hideSearchResults();
    inp.value = "";
    openRecord(b.dataset.srKind, b.dataset.srId);
  });
}

/* ---------------- boot ---------------- */
wireSearch();
loadDB();
seedIfNeeded();
saveDB();
loadExternalData();
if(DB.passHash){ showLock(); }
else { showSetup(); }
