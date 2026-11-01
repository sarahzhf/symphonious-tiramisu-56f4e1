/* Escale : référentiels (pays, devises, catégories, icônes) et outils communs */
'use strict';
const $=id=>document.getElementById(id);
const REDUCED=matchMedia("(prefers-reduced-motion: reduce)").matches;
/** Échappe un texte avant de l'insérer dans du HTML (protection contre l'injection de code). */
const esc=v=>String(v==null?"":v).replace(/[&<>"'`]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;","`":"&#96;"}[c]));
const uid=()=>crypto.randomUUID();
/* ---------- Référentiels ---------- */
const COUNTRIES={
 JP:{n:"Japon",iso:"392",ll:[139.7,35.68],cur:"¥",rate:162},PT:{n:"Portugal",iso:"620",ll:[-9.14,38.72],cur:"€",rate:1},
 IT:{n:"Italie",iso:"380",ll:[14.6,40.63],cur:"€",rate:1},GR:{n:"Grèce",iso:"300",ll:[23.7,37.98],cur:"€",rate:1},
 MA:{n:"Maroc",iso:"504",ll:[-8,31.63],cur:"DH",rate:10.9},ES:{n:"Espagne",iso:"724",ll:[-5.98,37.39],cur:"€",rate:1},
 VN:{n:"Vietnam",iso:"704",ll:[105.85,21.03],cur:"₫",rate:27000},GB:{n:"Royaume-Uni",iso:"826",ll:[-0.12,51.5],cur:"£",rate:.85},
 US:{n:"États-Unis",iso:"840",ll:[-74,40.7],cur:"$",rate:1.08},MX:{n:"Mexique",iso:"484",ll:[-99.13,19.43],cur:"MXN",rate:19.5},
 TH:{n:"Thaïlande",iso:"764",ll:[100.5,13.75],cur:"฿",rate:38},ID:{n:"Indonésie",iso:"360",ll:[115.2,-8.4],cur:"IDR",rate:17000},
 TR:{n:"Turquie",iso:"792",ll:[28.97,41],cur:"TRY",rate:37},EG:{n:"Égypte",iso:"818",ll:[31.24,30.04],cur:"EGP",rate:52},
 IS:{n:"Islande",iso:"352",ll:[-21.9,64.14],cur:"ISK",rate:150},HR:{n:"Croatie",iso:"191",ll:[18.09,42.65],cur:"€",rate:1},
 NL:{n:"Pays-Bas",iso:"528",ll:[4.9,52.37],cur:"€",rate:1},DE:{n:"Allemagne",iso:"276",ll:[13.4,52.52],cur:"€",rate:1},
 BR:{n:"Brésil",iso:"076",ll:[-43.2,-22.9],cur:"R$",rate:6},CA:{n:"Canada",iso:"124",ll:[-73.57,45.5],cur:"CA$",rate:1.5},
 TN:{n:"Tunisie",iso:"788",ll:[10.18,36.8],cur:"DT",rate:3.4},DZ:{n:"Algérie",iso:"012",ll:[3.06,36.75],cur:"DA",rate:145},
 SN:{n:"Sénégal",iso:"686",ll:[-17.47,14.7],cur:"FCFA",rate:656},FR:{n:"France",iso:"250",ll:[2.35,48.85],cur:"€",rate:1}
};
const FLAG={
 JP:`<rect width="30" height="30" fill="#fff"/><circle cx="15" cy="15" r="7" fill="#bc002d"/>`,
 PT:`<rect width="30" height="30" fill="#da291c"/><rect width="12" height="30" fill="#046a38"/><circle cx="12" cy="15" r="5" fill="#ffe900"/>`,
 IT:`<rect width="10" height="30" fill="#009246"/><rect x="10" width="10" height="30" fill="#fff"/><rect x="20" width="10" height="30" fill="#ce2b37"/>`,
 FR:`<rect width="10" height="30" fill="#002395"/><rect x="10" width="10" height="30" fill="#fff"/><rect x="20" width="10" height="30" fill="#ed2939"/>`,
 GR:`<rect width="30" height="30" fill="#0d5eaf"/>${[1,3,5,7].map(i=>`<rect y="${i*3.33}" width="30" height="3.33" fill="#fff"/>`).join("")}<rect width="16.6" height="16.6" fill="#0d5eaf"/><rect x="6.6" width="3.3" height="16.6" fill="#fff"/><rect y="6.6" width="16.6" height="3.3" fill="#fff"/>`,
 MA:`<rect width="30" height="30" fill="#c1272d"/><path d="M15 8l1.9 5.8H23l-4.9 3.6 1.9 5.8-5-3.6-5 3.6 1.9-5.8L7 13.8h6.1z" fill="none" stroke="#006233" stroke-width="1.3"/>`,
 ES:`<rect width="30" height="30" fill="#aa151b"/><rect y="7.5" width="30" height="15" fill="#f1bf00"/>`,
 VN:`<rect width="30" height="30" fill="#da251d"/><path d="M15 8l1.9 5.8H23l-4.9 3.6 1.9 5.8-5-3.6-5 3.6 1.9-5.8L7 13.8h6.1z" fill="#ff0"/>`,
 DE:`<rect width="30" height="10" fill="#000"/><rect y="10" width="30" height="10" fill="#dd0000"/><rect y="20" width="30" height="10" fill="#ffce00"/>`,
 NL:`<rect width="30" height="10" fill="#ae1c28"/><rect y="10" width="30" height="10" fill="#fff"/><rect y="20" width="30" height="10" fill="#21468b"/>`,
 ID:`<rect width="30" height="15" fill="#ce1126"/><rect y="15" width="30" height="15" fill="#fff"/>`,
 TH:`<rect width="30" height="30" fill="#a51931"/><rect y="5" width="30" height="20" fill="#f4f5f8"/><rect y="10" width="30" height="10" fill="#2d2a4a"/>`,
 TR:`<rect width="30" height="30" fill="#e30a17"/><circle cx="12" cy="15" r="7" fill="#fff"/><circle cx="14" cy="15" r="5.6" fill="#e30a17"/>`,
 DZ:`<rect width="15" height="30" fill="#006233"/><rect x="15" width="15" height="30" fill="#fff"/><circle cx="15.5" cy="15" r="6" fill="#d21034"/><circle cx="17" cy="15" r="5" fill="#fff"/><circle cx="15.5" cy="15" r="6" fill="none"/>`
};
const flag=k=>FLAG[k]?`<span class="flag"><svg viewBox="0 0 30 30" aria-hidden="true">${FLAG[k]}</svg></span>`:`<span class="flag">${k}</span>`;
const CATS={
  logement:{n:"Logement",ic:'<path d="M3 18v-7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v7M3 14h18M7 9V6h4v3"/>',pct:.36},
  repas:{n:"Repas",ic:'<path d="M4 11h16a8 8 0 0 1-16 0zM9 3c-1 2 1 3 0 5M14 3c-1 2 1 3 0 5"/>',pct:.24},
  transport:{n:"Transport",ic:'<rect x="6" y="3" width="12" height="14" rx="3"/><path d="M6 11h12M9 21l1-4M15 21l-1-4"/>',pct:.17},
  activites:{n:"Activités",ic:'<path d="M4 8a2 2 0 0 0 0 4v4h16v-4a2 2 0 0 1 0-4V4H4z"/>',pct:.12},
  shopping:{n:"Shopping",ic:'<path d="M5 8h14l-1 12H6zM9 8V6a3 3 0 0 1 6 0v2"/>',pct:.11}
};
const ico=k=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${CATS[k].ic}</svg>`;
const SV={
 cam:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="6.5" width="18" height="13" rx="3"/><circle cx="12" cy="13" r="3.5"/><path d="M8.5 6.5l1.5-2.5h4l1.5 2.5"/></svg>',
 plus:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>',
 x:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg>',
 arrow:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 17L17 7M9 7h8v8"/></svg>',
 dots:'<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>',
 back:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>',
 share:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 15V3M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/></svg>',
 heart:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>',
 heartF:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>',
 pin:'<svg viewBox="0 0 24 24" fill="currentColor" width="11" height="11"><path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"/></svg>',
 bell:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M6 17V11a6 6 0 0 1 12 0v6l1.5 2h-15z"/><path d="M10 21h4"/></svg>',
 edit:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>',
 trash:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>',
 page:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M6 3h9l4 4v14H6z"/><path d="M9 12h7M9 16h5"/></svg>',
 globe:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/></svg>',
 spark:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 3l1.8 4.7 4.7 1.8-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/></svg>',
 book:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11"/></svg>',
 receipt:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M6 3h12v18l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5L6 21z"/><path d="M9 8h6M9 12h6"/></svg>',
 wallet:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="6" width="18" height="14" rx="3"/><path d="M16 13h2M3 10h18"/></svg>',
 plane:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 15.5v-2L13 8.5V3.8a1.5 1.5 0 0 0-3 0v4.7L2 13.5v2l8-2.5v5.2l-2 1.5V21l3.5-1 3.5 1v-1.3l-2-1.5V13z"/></svg>'
};

/* ---------- Dates ---------- */
const iso=d=>d.toISOString().slice(0,10);
const D=s=>new Date(s+"T12:00:00");
const TODAY=iso(new Date());
const diffDays=(a,b)=>Math.round((D(b)-D(a))/864e5);
const fd=s=>D(s).toLocaleDateString("fr-FR",{day:"numeric",month:"short"});
const addDays=(s,n)=>{const d=D(s);d.setDate(d.getDate()+n);return iso(d);};
function info(t){const jours=Math.max(1,diffDays(t.du,t.au)+1),j=diffDays(t.du,TODAY)+1,enCours=j>=1&&j<=jours,futur=j<1;return {jours,jour:enCours?j:(futur?0:jours),enCours,futur};}
/* ---------- Pays saisis au clavier ---------- */
Object.assign(COUNTRIES,{
 BE:{n:"Belgique",iso:"056",ll:[4.35,50.85],cur:"€",rate:1},CH:{n:"Suisse",iso:"756",ll:[7.45,46.95],cur:"CHF",rate:.95},IE:{n:"Irlande",iso:"372",ll:[-6.26,53.35],cur:"€",rate:1},
 NO:{n:"Norvège",iso:"578",ll:[10.75,59.91],cur:"NOK",rate:11.6},SE:{n:"Suède",iso:"752",ll:[18.07,59.33],cur:"SEK",rate:11.4},DK:{n:"Danemark",iso:"208",ll:[12.57,55.68],cur:"DKK",rate:7.46},
 FI:{n:"Finlande",iso:"246",ll:[24.94,60.17],cur:"€",rate:1},PL:{n:"Pologne",iso:"616",ll:[21.01,52.23],cur:"PLN",rate:4.3},CZ:{n:"Tchéquie",iso:"203",ll:[14.42,50.08],cur:"CZK",rate:25},
 AT:{n:"Autriche",iso:"040",ll:[16.37,48.21],cur:"€",rate:1},HU:{n:"Hongrie",iso:"348",ll:[19.04,47.5],cur:"HUF",rate:400},CN:{n:"Chine",iso:"156",ll:[116.4,39.9],cur:"CNY",rate:7.8},
 KR:{n:"Corée du Sud",iso:"410",ll:[126.98,37.57],cur:"KRW",rate:1480},IN:{n:"Inde",iso:"356",ll:[77.21,28.61],cur:"INR",rate:92},LK:{n:"Sri Lanka",iso:"144",ll:[79.86,6.93],cur:"LKR",rate:330},
 MV:{n:"Maldives",iso:"462",ll:[73.51,4.18],cur:"MVR",rate:16.7},AE:{n:"Émirats arabes unis",iso:"784",ll:[55.27,25.2],cur:"AED",rate:4},JO:{n:"Jordanie",iso:"400",ll:[35.93,31.95],cur:"JOD",rate:.77},
 ZA:{n:"Afrique du Sud",iso:"710",ll:[18.42,-33.92],cur:"ZAR",rate:19.5},KE:{n:"Kenya",iso:"404",ll:[36.82,-1.29],cur:"KES",rate:140},TZ:{n:"Tanzanie",iso:"834",ll:[39.27,-6.16],cur:"TZS",rate:2900},
 MG:{n:"Madagascar",iso:"450",ll:[47.52,-18.88],cur:"MGA",rate:4900},MU:{n:"Maurice",iso:"480",ll:[57.5,-20.16],cur:"MUR",rate:50},AU:{n:"Australie",iso:"036",ll:[151.2,-33.87],cur:"AUD",rate:1.65},
 NZ:{n:"Nouvelle-Zélande",iso:"554",ll:[174.76,-36.85],cur:"NZD",rate:1.8},AR:{n:"Argentine",iso:"032",ll:[-58.38,-34.6],cur:"ARS",rate:1000},CL:{n:"Chili",iso:"152",ll:[-70.65,-33.45],cur:"CLP",rate:1000},
 PE:{n:"Pérou",iso:"604",ll:[-77.04,-12.05],cur:"PEN",rate:4},CO:{n:"Colombie",iso:"170",ll:[-74.07,4.71],cur:"COP",rate:4400},CU:{n:"Cuba",iso:"192",ll:[-82.37,23.11],cur:"CUP",rate:26},
 CR:{n:"Costa Rica",iso:"188",ll:[-84.09,9.93],cur:"CRC",rate:550},PH:{n:"Philippines",iso:"608",ll:[120.98,14.6],cur:"PHP",rate:62},MY:{n:"Malaisie",iso:"458",ll:[101.69,3.14],cur:"MYR",rate:4.8},
 SG:{n:"Singapour",iso:"702",ll:[103.82,1.35],cur:"SGD",rate:1.45},KH:{n:"Cambodge",iso:"116",ll:[104.92,11.56],cur:"$",rate:1.08},NP:{n:"Népal",iso:"524",ll:[85.32,27.72],cur:"NPR",rate:145},
 ME:{n:"Monténégro",iso:"499",ll:[18.77,42.42],cur:"€",rate:1},AL:{n:"Albanie",iso:"008",ll:[19.82,41.33],cur:"ALL",rate:100},MT:{n:"Malte",iso:"470",ll:[14.51,35.9],cur:"€",rate:1},
 CY:{n:"Chypre",iso:"196",ll:[33.38,35.17],cur:"€",rate:1}
});
const norm=s=>(s||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().replace(/[^a-z ]/g," ").replace(/\s+/g," ").trim();
const ALIAS={"angleterre":"GB","ecosse":"GB","londres":"GB","usa":"US","etats unis":"US","amerique":"US","new york":"US","bali":"ID","hollande":"NL","coree":"KR","japan":"JP","tokyo":"JP","italy":"IT","spain":"ES","greece":"GR","morocco":"MA","emirats":"AE","dubai":"AE","tenerife":"ES","seville":"ES","lisbonne":"PT","rome":"IT","marrakech":"MA","algerie":"DZ","tunisie":"TN"};
function paysCode(v){ const n=norm(v); if(!n) return null; if(ALIAS[n]) return ALIAS[n];
  const e=Object.entries(COUNTRIES).find(([k,c])=>norm(c.n)===n||k.toLowerCase()===n); if(e) return e[0];
  const p=Object.entries(COUNTRIES).filter(([,c])=>norm(c.n).startsWith(n)); return p.length===1?p[0][0]:null; }
function paysList(){ return `<datalist id="pays-list">${Object.values(COUNTRIES).sort((a,b)=>a.n.localeCompare(b.n,"fr")).map(c=>`<option value="${c.n}"></option>`).join("")}</datalist>`; }


SV.planeO='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M21 3L3 10.5l7 2.5 2.5 7z"/><path d="M10 13l4-4"/></svg>';
SV.menu='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16M8 12h12M12 17h8"/></svg>';
SV.right='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
SV.leaf='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 19c0-8 6-14 14-14 0 8-6 14-14 14zM5 19l7-7"/></svg>';


/* icônes */
SV.chev='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 6l6 6-6 6"/></svg>';
SV.down='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>';
SV.search='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>';
SV.cal='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/></svg>';
SV.place='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 21s7-6.2 7-11a7 7 0 0 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>';
SV.img='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="M21 16l-5-5-8 8"/></svg>';
SV.star='<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3 6.6 7.2.8-5.4 4.9 1.5 7.1L12 17.8 5.7 21.4l1.5-7.1L1.8 9.4 9 8.6z"/></svg>';
SV.clock='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
SV.euro='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M15 9a4 4 0 1 0 0 6M8 11h5M8 13h5"/></svg>';
SV.planeO='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M21 3L3 10.5l7 2.5 2.5 7z"/><path d="M10 13l4-4"/></svg>';
SV.menu='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16M8 12h12M12 17h8"/></svg>';
SV.right='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
SV.leaf='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 19c0-8 6-14 14-14 0 8-6 14-14 14zM5 19l7-7"/></svg>';
SV.globeS='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/></svg>';
SV.users='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.5-4 3.3-6 6.5-6s6 2 6.5 6M16 4.5a3.5 3.5 0 0 1 0 7M18 14c2 .6 3.3 2.6 3.5 6"/></svg>';
SV.lock='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>';
SV.comment='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 18.5V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H8z"/></svg>';
SV.send='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 3L3 10.5l7 2.5 2.5 7z"/></svg>';
SV.save='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 3h12v18l-6-4-6 4z"/></svg>';
SV.saveF='<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 3h12v18l-6-4-6 4z"/></svg>';
SV.smile='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M8.5 14.5c1 1.3 2.1 2 3.5 2s2.5-.7 3.5-2M9 9.5h.01M15 9.5h.01"/></svg>';
SV.multi='<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 3h11a3 3 0 0 1 3 3v11h-2V6a1 1 0 0 0-1-1H7z"/><rect x="3" y="7" width="14" height="14" rx="2.5"/></svg>';
SV.userPlus='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.5-4 3.3-6 6.5-6s6 2 6.5 6M19 8v6M16 11h6"/></svg>';
SV.check='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12l5 5 9-10"/></svg>';
SV.target='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/></svg>';
SV.scale='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>';
SV.flatmap='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14M15 6v14"/></svg>';
/* codes ISO des devises (pour la base de données) */
const CUR_ISO={JP:"JPY",MA:"MAD",VN:"VND",GB:"GBP",US:"USD",MX:"MXN",TH:"THB",ID:"IDR",TR:"TRY",EG:"EGP",IS:"ISK",BR:"BRL",CA:"CAD",TN:"TND",DZ:"DZD",SN:"XOF",CH:"CHF",NO:"NOK",SE:"SEK",DK:"DKK",PL:"PLN",CZ:"CZK",HU:"HUF",CN:"CNY",KR:"KRW",IN:"INR",LK:"LKR",MV:"MVR",AE:"AED",JO:"JOD",ZA:"ZAR",KE:"KES",TZ:"TZS",MG:"MGA",MU:"MUR",AU:"AUD",NZ:"NZD",AR:"ARS",CL:"CLP",PE:"PEN",CO:"COP",CU:"CUP",CR:"CRC",PH:"PHP",MY:"MYR",SG:"SGD",KH:"USD",NP:"NPR",AL:"ALL"};
Object.entries(COUNTRIES).forEach(([k,c])=>{ c.code=CUR_ISO[k]||(c.rate===1?"EUR":null); });
