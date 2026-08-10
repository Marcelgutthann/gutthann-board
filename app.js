// Gutthann Board — Kanban-Frontend fuer das Agentic OS.
// Daten: lotse Edge Function (JWT-verifiziert) -> assistant_*-RPCs. Design: Marcels
// Standalone-Entwurf vom 23.07.2026, Farbwelt "datum" (Ink / #E8E8E6 / Lime).

const SUPA = 'https://lzrfyxejlejxfpvqpket.supabase.co';
const ANON = 'sb_publishable_adwNO1cSP6M2OmOV-8t_1g_lmGuj40V';
const LOTSE = SUPA + '/functions/v1/lotse';

const PROJ_DOTS = ['#D08427', '#3D78C2', '#5FA132', '#D24A7E', '#7C4FD0', '#1FA095', '#C2543D'];
const AV_COLORS = ['#1C1C1A', '#8FA3B9', '#7C9464', '#B98F9C', '#9C8FB9', '#A66A12', '#6E8F8A'];
const CHIPS = {
  rueckfrage: { txt: 'Rückfrage an dich', bg: '#E29A2E', fg: '#231602', dot: '#231602', anim: false },
  arbeitet: { txt: 'Agent arbeitet', bg: '#E8F5C4', fg: '#3E5312', dot: '#7CA928', anim: true },
  fertig: { txt: 'Fertig', bg: 'rgba(28,28,26,.07)', fg: '#4F7A4B', dot: '#4F7A4B', anim: false },
  fehlgeschlagen: { txt: 'Fehlgeschlagen', bg: '#F4E0DC', fg: '#B4432E', dot: '#B4432E', anim: false },
};

const S = {
  session: null, liste: null, projects: [],
  active: null, // {typ:'board'|'projekt', id, name}
  ansicht: 'board', // im Projekt: 'board' (Aufgaben) oder 'dash' (Projekt-Dashboard)
  board: null, detail: null, drag: null, newCardCol: null, newCardText: '', poll: null,
};

// ---------- API ----------
function saveSession(s) { S.session = s; localStorage.setItem('gb_session', JSON.stringify(s)); }
function loadSession() { try { S.session = JSON.parse(localStorage.getItem('gb_session')); } catch { S.session = null; } }

async function authLogin(email, pw) {
  const r = await fetch(SUPA + '/auth/v1/token?grant_type=password', {
    method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: pw }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error_description || j.msg || 'Anmeldung fehlgeschlagen');
  saveSession({ access_token: j.access_token, refresh_token: j.refresh_token, email });
}

async function authRefresh() {
  if (!S.session?.refresh_token) return false;
  const r = await fetch(SUPA + '/auth/v1/token?grant_type=refresh_token', {
    method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: S.session.refresh_token }),
  });
  if (!r.ok) return false;
  const j = await r.json();
  saveSession({ access_token: j.access_token, refresh_token: j.refresh_token, email: S.session.email });
  return true;
}

async function lotse(action, body = {}, retried = false) {
  let r;
  try {
    r = await fetch(LOTSE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: ANON, Authorization: 'Bearer ' + (S.session?.access_token || '') },
      body: JSON.stringify({ action, ...body }),
    });
  } catch (e) {
    // Kaltstart/Netz-Huester: einmal kurz warten und wiederholen — aber NUR bei
    // Lese-Aktionen. Eine wiederholte Mutation, deren Antwort nur verloren ging,
    // wuerde doppelt ausgefuehrt (doppelte Karte, doppelter Kommentar).
    const READS = ['board', 'board_liste', 'projects', 'todo_detail', 'todo_list', 'vgv_dashboard', 'kalender', 'agent_laeufe'];
    if (!retried && READS.includes(action)) { await new Promise((s2) => setTimeout(s2, 900)); return lotse(action, body, true); }
    throw e;
  }
  const j = await r.json().catch(() => ({}));
  if (j && j.error && /Anmeldung erforderlich/.test(j.error)) {
    if (!retried && await authRefresh()) return lotse(action, body, true);
    showLogin(); throw new Error('Sitzung abgelaufen');
  }
  // lotse liefert Transportfehler als {error} mit HTTP 200, die RPCs App-Fehler als
  // {fehler} — vereinheitlichen, damit jede r.fehler-Pruefung beide Kanaele sieht.
  if (j && j.error && !j.fehler) j.fehler = j.error;
  return j;
}

// Mutation mit zentraler Fehlermeldung: Aktionen ohne eigene Fehlerbehandlung liefen
// bisher still ins Leere (Aktion sah erfolgreich aus, nichts passierte).
async function mut(action, body = {}) {
  let r;
  try { r = await lotse(action, body); }
  catch (e) { r = { fehler: e.message || 'Netzwerkfehler' }; }
  if (r && r.fehler) alert(r.fehler);
  return r;
}

// ---------- Helfer ----------
function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') n.className = v;
    else if (k === 'style') n.style.cssText = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (v !== null && v !== undefined) n.setAttribute(k, v);
  }
  for (const k of kids.flat()) if (k !== null && k !== undefined) n.append(k.nodeType ? k : document.createTextNode(k));
  return n;
}
function initialen(name) {
  const t = String(name).replace(/^user:/, '').split(/[.\s@_-]+/).filter(Boolean);
  return ((t[0]?.[0] || '') + (t[1]?.[0] || t[0]?.[1] || '')).toUpperCase();
}
function avColor(name) { let h = 0; for (const c of String(name)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return AV_COLORS[h % AV_COLORS.length]; }
// Personen kommen als {kurz, name} (Migration 53). Angezeigt wird der Klarname, gespeichert
// bleibt die Kurzform. Farbe haengt an der Kurzform, damit sie sich nie aendert.
function personListe() { return (S.liste?.personen || []).map((p) => (typeof p === 'string' ? { kurz: p, name: p } : p)); }
function personName(kurz) { return personListe().find((p) => p.kurz === kurz)?.name || String(kurz).replace(/^user:/, ''); }
function projDot(name) { let h = 0; for (const c of String(name)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return PROJ_DOTS[h % PROJ_DOTS.length]; }
function statusVon(t) {
  // agent_status traegt sowohl den Delegations-Fluss (delegiert=true) als auch die
  // Spalten-Automatik (delegiert=false, Karte in programmierter Spalte).
  if (!t.agent_status) return null;
  if (t.agent_status === 'wartet_info') return 'rueckfrage';
  if (t.agent_status === 'laeuft' || t.agent_status === 'wartet') return 'arbeitet';
  if (t.agent_status === 'fertig') return 'fertig';
  if (t.agent_status === 'fehlgeschlagen') return 'fehlgeschlagen';
  return null;
}
function fmtDatum(iso) {
  if (!iso) return null;
  const d = new Date(iso + 'T00:00:00'); const heute = new Date(); heute.setHours(0, 0, 0, 0);
  const diff = Math.round((d - heute) / 86400000);
  if (diff === 0) return { txt: 'Heute', urgent: true };
  if (diff === 1) return { txt: 'Morgen', urgent: true };
  if (diff < 0) return { txt: d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }) + ' überfällig', urgent: true };
  return { txt: d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' }), urgent: false };
}
// Abgabefrist einer VgV-Karte ('JJJJ-MM-TT HH:MM' oder ISO) -> Kachel-Text + Dringlichkeit
function vgvRest(frist) {
  if (!frist) return null;
  const d = new Date(String(frist).replace(' ', 'T'));
  if (isNaN(d)) return null;
  const heute = new Date(); heute.setHours(0, 0, 0, 0);
  const d0 = new Date(d); d0.setHours(0, 0, 0, 0);
  const tage = Math.round((d0 - heute) / 86400000);
  const dat = d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
  if (tage < 0) return { txt: `Abgabe ${dat} vorbei`, tage, knapp: true };
  if (tage === 0) return { txt: 'Abgabe HEUTE', tage, knapp: true };
  return { txt: `Abgabe ${dat} · ${tage} Tg`, tage, knapp: tage <= 7 };
}
function ctxMenu(x, y, items) {
  closeCtx();
  const m = el('div', { class: 'ctx' });
  for (const it of items) {
    if (it.note) m.append(el('div', { class: 'note' }, it.note));
    else m.append(el('button', { class: it.danger ? 'danger' : '', onclick: () => { closeCtx(); it.do(); } }, it.txt));
  }
  document.getElementById('ctx-root').append(m);
  // Erst nach dem Einhaengen an der ECHTEN Groesse klemmen — lange Menues
  // (Projektliste) ragten sonst unter den Viewport.
  m.style.left = Math.max(8, Math.min(x, innerWidth - m.offsetWidth - 8)) + 'px';
  m.style.top = Math.max(8, Math.min(y, innerHeight - m.offsetHeight - 8)) + 'px';
  setTimeout(() => addEventListener('click', closeCtx, { once: true }));
}
function closeCtx() { document.getElementById('ctx-root').innerHTML = ''; }

// ---------- Laden ----------
async function ladeAlles() {
  const [liste, projs] = await Promise.all([lotse('board_liste'), lotse('projects')]);
  S.liste = liste; S.projects = projs.projects || [];
  if (!S.active && liste.boards?.length) S.active = { typ: 'board', id: liste.boards[0].id, name: liste.boards[0].name };
  renderSidebar();
  await ladeBoard();
}
let ladeToken = 0; // verwirft veraltete Antworten bei schnellem Board-Wechsel
async function ladeBoard() {
  if (!S.active) return;
  const token = ++ladeToken;
  const b = S.active.typ === 'projekt'
    ? await lotse('board', { projekt: S.active.name })
    : await lotse('board', { board_id: S.active.id });
  if (token !== ladeToken) return; // inzwischen wurde ein anderes Board angefordert
  S.board = b;
  renderTopbar(); renderBoard();
  // Agenten-Taskbar nachladen (blockiert das Board nicht; Fehler sind egal)
  lotse('agent_laeufe').then((r) => {
    if (token !== ladeToken) return;
    S.laeufe = r.laeufe || [];
    renderTopbar();
  }).catch(() => {});
}
async function wechsle(typ, id, name) {
  S.active = { typ, id, name }; S.board = null;
  S.kal = null; // Kalender-Monat gehoert zum alten Projekt
  // Halboffene Neue-Karte-Zeile gehoert zum alten Board — sonst blockiert ihr
  // Poll-Guard den Auto-Refresh dauerhaft.
  S.newCardCol = null; S.newCardText = '';
  zeigeAnsicht('board'); // beim Wechsel immer zuerst die Aufgaben zeigen
  renderSidebar(); renderTopbar(); renderBoard(); await ladeBoard();
}

// Umschalten zwischen Aufgaben-Board und Projekt-Dashboard. Beide leben im selben
// Hauptbereich; das Dashboard bekommt beim ersten Aufruf die Sitzung der Huelle.
function zeigeAnsicht(welche) {
  S.ansicht = welche;
  const dash = document.getElementById('dash-root');
  const board = document.getElementById('board');
  const kal = document.getElementById('kal-root');
  if (!dash || !board) return;
  const istProjekt = S.active?.typ === 'projekt';
  const dashAn = welche === 'dash' && istProjekt;
  const kalAn = welche === 'kal' && istProjekt;
  board.style.display = (dashAn || kalAn) ? 'none' : '';
  dash.hidden = !dashAn;
  if (kal) kal.hidden = !kalAn;
  if (dashAn && window.dashStart) window.dashStart(S.session, S.active.id);
  if (kalAn) renderKalender();
  renderTopbar();
}

// ---------- Projekt-Kalender (Loop proaktiver Kollege, Baustein E) ----------
let kalToken = 0; // verwirft veraltete Antworten bei Monats-/Projektwechsel
async function renderKalender() {
  const root = document.getElementById('kal-root'); if (!root || S.active?.typ !== 'projekt') return;
  const token = ++kalToken;
  if (!S.kal) { const h = new Date(); S.kal = { jahr: h.getFullYear(), monat: h.getMonth() + 1 }; }
  root.innerHTML = '';
  root.append(el('div', { class: 'kalkopf' },
    el('button', { class: 'kalnav', onclick: () => { S.kal.monat--; if (S.kal.monat < 1) { S.kal.monat = 12; S.kal.jahr--; } renderKalender(); } }, '‹'),
    el('span', { class: 'kaltitel' }, new Date(S.kal.jahr, S.kal.monat - 1, 1).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })),
    el('button', { class: 'kalnav', onclick: () => { S.kal.monat++; if (S.kal.monat > 12) { S.kal.monat = 1; S.kal.jahr++; } renderKalender(); } }, '›'),
    el('span', { class: 'kalhint' }, 'Karte auf einen Tag ziehen = Frist ändern · Doppelklick auf einen Tag = Aufgabe anlegen')));
  const grid = el('div', { class: 'kalgrid' });
  for (const w of ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']) grid.append(el('div', { class: 'kalwt' }, w));
  root.append(grid);
  const d = await lotse('kalender', { projekt: S.active.name, jahr: S.kal.jahr, monat: S.kal.monat }).catch(() => ({ fehler: 'Netzwerkfehler' }));
  if (token !== kalToken || !S.kal || S.active?.typ !== 'projekt') return; // inzwischen gewechselt
  if (d.fehler) { root.append(el('div', { class: 'empty', style: 'padding:16px' }, d.fehler)); return; }
  const tage = new Date(S.kal.jahr, S.kal.monat, 0).getDate();
  const offset = (new Date(S.kal.jahr, S.kal.monat - 1, 1).getDay() + 6) % 7; // Mo = 0
  const heute = new Date();
  const proTag = {}; for (const k of d.karten || []) (proTag[k.tag] = proTag[k.tag] || []).push(k);
  const fixProTag = {}; for (const f of d.fixtermine || []) (fixProTag[f.tag] = fixProTag[f.tag] || []).push(f);
  for (let i = 0; i < offset; i++) grid.append(el('div', { class: 'kaltag leer' }));
  for (let t = 1; t <= tage; t++) {
    const datum = `${S.kal.jahr}-${String(S.kal.monat).padStart(2, '0')}-${String(t).padStart(2, '0')}`;
    const istHeute = heute.getFullYear() === S.kal.jahr && heute.getMonth() + 1 === S.kal.monat && heute.getDate() === t;
    const wtag = new Date(S.kal.jahr, S.kal.monat - 1, t).getDay();
    const zelle = el('div', {
      class: 'kaltag' + (istHeute ? ' heute' : '') + (wtag === 0 || wtag === 6 ? ' we' : ''),
      ondragover: (e) => { e.preventDefault(); zelle.classList.add('dragover'); },
      ondragleave: () => zelle.classList.remove('dragover'),
      ondrop: async (e) => {
        e.preventDefault(); zelle.classList.remove('dragover');
        if (!S.kalDrag) return;
        const id = S.kalDrag; S.kalDrag = null;
        await mut('todo_update', { todo_id: id, faellig: datum });
        renderKalender();
      },
      ondblclick: async (e) => {
        if (e.target !== zelle && !e.target.closest('b')) return; // nur auf freier Flaeche
        const titel = prompt(`Neue Aufgabe am ${t}.${S.kal.monat}.${S.kal.jahr}:`);
        if (!titel?.trim()) return;
        const r = await mut('todo_create', { titel: titel.trim(), projekt: S.active.name, faellig: datum });
        if (r && r.todo_id) renderKalender();
      },
    }, el('b', {}, String(t)));
    for (const f of fixProTag[t] || []) zelle.append(el('div', { class: 'kalfix', title: f.titel }, f.titel));
    for (const k of proTag[t] || []) {
      const pille = el('div', {
        class: 'kalpille' + (k.zuarbeit ? ' zu' : '') + (k.status === 'erledigt' ? ' erl' : ''),
        draggable: 'true', title: k.titel,
        ondragstart: () => { S.kalDrag = k.id; },
        ondragend: () => { S.kalDrag = null; },
        onclick: () => openCard(k.id),
      }, k.titel);
      zelle.append(pille);
    }
    grid.append(zelle);
  }
}

// ---------- Sidebar ----------
function renderSidebar() {
  const sb = document.getElementById('sidebar'); sb.innerHTML = '';
  sb.append(el('div', { class: 'brand' },
    el('h1', {}, 'Gutthann HIW Architekten'),
    el('div', { class: 'sub' }, el('span', { class: 'dot' }), 'Digitaler Mitarbeiter aktiv')));
  const li = S.liste; if (!li) return;
  const grp = (label) => { const g = el('div', { class: 'sect' }); g.append(el('div', { class: 'lbl' }, label)); sb.append(g); return g; };

  const g1 = grp('Meine Boards');
  for (const b of li.boards || []) {
    const aktiv = S.active?.typ === 'board' && S.active.id === b.id;
    // Default-Board (erstes) traegt den Zaehler offener, mir zugewiesener Karten —
    // dort kommen sie an (Migration 78).
    const badge = (b === (li.boards || [])[0] && (li.zugewiesen_offen || 0) > 0)
      ? el('span', { class: 'badge', title: 'Dir zugewiesene offene Aufgaben' }, String(li.zugewiesen_offen)) : '';
    g1.append(el('div', {
      class: 'row' + (aktiv ? ' active' : ''),
      onclick: () => wechsle('board', b.id, b.name),
      oncontextmenu: (e) => { e.preventDefault(); boardMenu(e, b, li.boards.length <= 1); },
    }, '▦ ', b.name, badge));
  }
  g1.append(el('div', { class: 'row addrow', onclick: () => neuesBoard('privat') }, '+ Neues Board'));

  const g2 = grp('Büro intern');
  for (const b of li.team_boards || []) {
    const aktiv = S.active?.typ === 'board' && S.active.id === b.id;
    g2.append(el('div', {
      class: 'row' + (aktiv ? ' active' : ''),
      onclick: () => wechsle('board', b.id, b.name),
      oncontextmenu: (e) => { e.preventDefault(); boardMenu(e, b, false); },
    }, '▤ ', b.name));
  }
  g2.append(el('div', { class: 'row addrow', onclick: () => neuesBoard('team') }, '+ Neues Board'));

  if ((li.pins || []).length) {
    const g3 = grp('Angeheftet');
    for (const p of li.pins) {
      const aktiv = S.active?.typ === 'projekt' && S.active.name === p.name;
      g3.append(el('div', { class: 'row' + (aktiv ? ' active' : ''), onclick: () => wechsle('projekt', p.project_id, p.name) },
        '⌖ ', p.name,
        el('button', { class: 'pin', title: 'Lösen', onclick: async (e) => { e.stopPropagation(); await mut('pin',{ projekt: p.name, an: false }); S.liste = await lotse('board_liste'); renderSidebar(); } }, '✕')));
    }
  }

  const g4 = grp('Projekte');
  const gepinnt = new Set((li.pins || []).map((p) => p.name));
  for (const p of S.projects) {
    const aktiv = S.active?.typ === 'projekt' && S.active.name === p.name;
    g4.append(el('div', { class: 'row' + (aktiv ? ' active' : ''), onclick: () => wechsle('projekt', p.id, p.name) },
      el('span', { class: 'pdot', style: 'background:' + projDot(p.name) }), p.name,
      gepinnt.has(p.name) ? '' :
        el('button', { class: 'pin', title: 'An Sidebar anheften', onclick: async (e) => { e.stopPropagation(); await mut('pin',{ projekt: p.name, an: true }); S.liste = await lotse('board_liste'); renderSidebar(); } }, '⌖')));
  }
}
function boardMenu(e, b, letztes) {
  ctxMenu(e.clientX, e.clientY, [
    { txt: 'Umbenennen', do: async () => { const n = prompt('Neuer Name:', b.name); if (n?.trim()) { await mut('board_umbenennen',{ board_id: b.id, name: n.trim() }); await ladeAlles(); } } },
    letztes ? { note: 'Letztes Board – nicht löschbar' } :
      { txt: 'Löschen', danger: true, do: async () => { if (confirm(`Board "${b.name}" löschen? Karten wandern ins Default-Board.`)) { const r = await lotse('board_loeschen', { board_id: b.id }); if (r.fehler) alert(r.fehler); if (S.active?.id === b.id) S.active = null; await ladeAlles(); } } },
  ]);
}
async function neuesBoard(typ) {
  const n = prompt(typ === 'team' ? 'Name des Team-Boards:' : 'Name des Boards:');
  if (!n?.trim()) return;
  const r = await lotse('board_anlegen', { name: n.trim(), typ });
  if (r.fehler) { alert(r.fehler); return; }
  S.active = { typ: 'board', id: r.board_id, name: r.name };
  await ladeAlles();
}

// ---------- Topbar + Board ----------
function renderTopbar() {
  const tb = document.getElementById('topbar'); tb.innerHTML = '';
  if (!S.active) return;
  tb.append(el('h2', {}, S.active.name));
  const scope = S.active.typ === 'projekt' ? 'Projekt-Board · für alle gleich'
    : S.board?.ist_team ? 'Team-Board · Büro intern' : 'Privates Board · nur für dich';
  tb.append(el('div', { class: 'scope' }, scope));
  // Im Projekt: Aufgaben und Dashboard sind zwei Ansichten derselben Ebene
  // (Marcels Vorgabe 29.07. -- im Projekt nur DIESES Board, Dashboard daneben).
  if (S.active.typ === 'projekt') {
    const tabs = el('div', { class: 'viewtabs' });
    for (const [key, label] of [['board', 'Aufgaben'], ['kal', 'Kalender'], ['dash', 'Dashboard']]) {
      tabs.append(el('button', { class: S.ansicht === key ? 'on' : '', onclick: () => zeigeAnsicht(key) }, label));
    }
    tb.append(tabs);
  }
  // Dashboard neben dem Boardnamen — vorerst nur fuer das VgV-Radar-Board (Marcels Auftrag 24.07.)
  if (S.board?.ist_team && S.active.name === 'VgV-Radar') {
    tb.append(el('button', { class: 'dashbtn', onclick: openVgvDashboard }, '▦ Dashboard'));
  }
  // "Ruf mich an" (24.07.): Assistent ruft die eigene hinterlegte Nummer an —
  // kostenlos telefonieren, solange die deutsche Nummer noch in der Twilio-Freigabe haengt.
  const rufBtn = el('button', { class: 'callbtn', title: 'Der Assistent ruft dich auf deiner hinterlegten Nummer an', onclick: async () => {
    rufBtn.disabled = true; const alt = rufBtn.textContent; rufBtn.textContent = '📞 Anruf kommt…';
    const r = await lotse('ruf_mich_an').catch(() => ({ fehler: 'Netzwerkfehler' }));
    if (r.fehler) { alert(r.fehler); rufBtn.textContent = alt; rufBtn.disabled = false; }
    else setTimeout(() => { rufBtn.textContent = alt; rufBtn.disabled = false; }, 20000);
  } }, '📞 Ruf mich an');
  tb.append(rufBtn);
  const rf = (S.board?.todos || []).filter((t) => statusVon(t) === 'rueckfrage');
  if (rf.length) tb.append(el('button', {
    class: 'alertbtn', onclick: () => openCard(rf[0].id),
  }, '⚠ ', rf.length === 1 ? '1 Rückfrage wartet auf dich' : rf.length + ' Rückfragen warten auf dich'));
  // Agenten-Taskbar (Loop D): was die Flotte JETZT tut — klickbar zur Karte.
  const laufend = (S.laeufe || []).filter((l) => l.status === 'running').slice(0, 3);
  const wartend = (S.laeufe || []).filter((l) => l.status === 'queued').length;
  if (laufend.length || wartend) {
    const tb2 = el('div', { class: 'taskbar' });
    for (const l of laufend) tb2.append(el('button', {
      class: 'tchip', title: (l.titel || l.agent) + (l.projekt ? ' · ' + l.projekt : ''),
      onclick: () => { if (l.todo_id) openCard(l.todo_id); },
    }, el('span', { class: 'tdot' }),
      (l.projekt ? l.projekt.replace(/^\d+\s*-?\s*/, '').slice(0, 16) + ': ' : '') + (l.titel || l.agent).slice(0, 34),
      l.seit_min != null ? el('small', {}, ' ' + l.seit_min + ' min') : ''));
    if (wartend) tb2.append(el('span', { class: 'tchip warte' }, '+' + wartend + ' wartend'));
    tb.append(tb2);
  }
  // "Gerade in Arbeit" (Loop D): wer im Projekt woran dran ist — nur Karten-Daten.
  const ia = S.board?.in_arbeit || [];
  if (S.active.typ === 'projekt' && S.ansicht === 'board' && ia.length) {
    const z = el('div', { class: 'inarbeit' }, 'Gerade in Arbeit:');
    for (const p2 of ia.slice(0, 5)) {
      const t0 = (p2.themen || [])[0];
      if (!t0) continue;
      z.append(el('span', { class: 'who', title: (p2.themen || []).map((x) => x.titel).slice(0, 5).join(' · ') },
        el('span', { class: 'av', style: 'background:' + avColor(p2.person) }, initialen(p2.name)),
        String(p2.name).split(' ')[0] + ' · ' + t0.titel.slice(0, 36)));
    }
    tb.append(z);
  }
}

function renderBoard() {
  const bw = document.getElementById('board'); bw.innerHTML = '';
  const b = S.board;
  if (!b) { bw.append(el('div', { class: 'empty', style: 'padding:20px' }, 'Lade…')); return; }
  if (b.fehler) { bw.append(el('div', { class: 'empty', style: 'padding:20px' }, b.fehler)); return; }
  const spalten = b.spalten || [];
  const erste = spalten[0]?.id;
  for (const sp of spalten) {
    const bekannt = (id) => spalten.some((s2) => s2.id === id);
    const inSpalte = (b.todos || []).filter((t) =>
      (t.spalte_id === sp.id || (sp.id === erste && !t.spiegel && (!t.spalte_id || !bekannt(t.spalte_id)))) &&
      (sp.ist_erledigt ? t.status === 'erledigt' : t.status !== 'erledigt'));
    const colEl = el('div', {
      class: 'col',
      ondragover: (e) => { e.preventDefault(); colEl.classList.add('dragover'); },
      ondragleave: () => colEl.classList.remove('dragover'),
      ondrop: async (e) => {
        e.preventDefault(); colEl.classList.remove('dragover');
        if (!S.drag) return;
        const id = S.drag; S.drag = null;
        await mut('todo_verschieben', { todo_id: id, spalte_id: sp.id });
        await ladeBoard();
      },
    });
    colEl.append(el('div', { class: 'colhead' },
      sp.ist_agent ? el('span', { class: 'roledot', title: 'Agenten-Spalte' }) : '',
      sp.auto_status === 'rueckfrage' ? el('span', { class: 'roledot', style: 'background:#E29A2E', title: 'Rückfragen wandern automatisch her' }) : '',
      sp.auto_status === 'fertig' ? el('span', { class: 'roledot', style: 'background:#4F7A4B', title: 'Fertige Agenten-Ergebnisse landen hier' }) : '',
      el('span', { class: 'name' }, sp.name),
      sp.automatik?.auftrag ? el('span', {
        class: 'autochip', title: 'Automatik: ' + (sp.automatik.auftrag || '').slice(0, 200),
        onclick: (e) => { e.stopPropagation(); spalteAutomatikDialog(sp); },
      }, '⚙ Auto') : '',
      el('span', { class: 'cnt' }, String(inSpalte.length)),
      sp.ist_erledigt ? el('span', { class: 'cnt' }, '✓') : '',
      el('button', { class: 'menu', onclick: (e) => { e.stopPropagation(); spaltenMenu(e, sp, spalten.length); } }, '···')));
    const cardsEl = el('div', { class: 'cards' });
    for (const t of inSpalte) cardsEl.append(renderCard(t));
    colEl.append(cardsEl);
    if (S.newCardCol === sp.id) {
      // Getippter Text lebt in S.newCardText, damit ein Neu-Aufbau des Boards (Poll, Drag,
      // Spaltenmenue) die halbfertige Eingabe nicht wegwirft — Marcels Befund 27.07.
      const inp = el('input', {
        class: 'newinput', placeholder: 'Titel der Aufgabe…',
        oninput: () => { S.newCardText = inp.value; },
        onkeydown: async (e) => {
          if (e.key === 'Escape') { S.newCardCol = null; S.newCardText = ''; renderBoard(); }
          if (e.key === 'Enter' && inp.value.trim()) {
            const titel = inp.value.trim();
            inp.disabled = true;
            let r;
            try { r = await lotse('todo_create', { titel, projekt: S.active.typ === 'projekt' ? S.active.name : null }); }
            catch (err) { r = { fehler: err.message }; }
            if (!r || !r.todo_id) {
              // Nicht gespeichert: Eingabe stehen lassen und sagen, was los ist.
              inp.disabled = false; inp.focus();
              alert('Nicht gespeichert: ' + ((r && (r.fehler || r.error)) || 'keine Antwort vom Server') + '\nDer Text bleibt stehen — bitte nochmal Enter.');
              return;
            }
            // mut wirft nie — der State-Reset laeuft auch, wenn das Einsortieren
            // fehlschlaegt (die Karte existiert dann bereits in Spalte 1).
            if (!sp.ist_erledigt) await mut('todo_verschieben', { todo_id: r.todo_id, spalte_id: sp.id });
            S.newCardCol = null; S.newCardText = ''; await ladeBoard();
          }
        },
      });
      inp.value = S.newCardText;
      colEl.append(inp); setTimeout(() => { inp.focus(); inp.selectionStart = inp.value.length; });
    } else if (!sp.ist_erledigt) {
      // In der Erledigt-Spalte kein "+ Aufgabe": neu Angelegtes landete dort ohnehin
      // nie (Schutz gegen als-erledigt-Anlegen), sondern kommentarlos in Spalte 1.
      colEl.append(el('button', { class: 'addcard', onclick: () => { S.newCardCol = sp.id; S.newCardText = ''; renderBoard(); } }, '+ Aufgabe'));
    }
    bw.append(colEl);
  }
  bw.append(el('button', { class: 'addcol', onclick: async () => {
    const n = prompt('Name der Spalte:'); if (!n?.trim()) return;
    const r = await lotse('spalte_anlegen', S.active.typ === 'projekt'
      ? { name: n.trim(), projekt: S.active.name } : { name: n.trim(), board_id: S.active.id });
    if (r.fehler) alert(r.fehler);
    await ladeBoard();
  } }, '+ Spalte'));
}

function spaltenMenu(e, sp, nSpalten) {
  const items = [];
  items.push({ txt: 'Umbenennen', do: async () => {
    const n = prompt('Neuer Spaltenname:', sp.name);
    if (n?.trim() && n.trim() !== sp.name) {
      const r = await lotse('spalte_umbenennen', { spalte_id: sp.id, name: n.trim() });
      if (r.fehler) alert(r.fehler);
      await ladeBoard();
    }
  } });
  const rolle = async (r) => { await mut('spalte_rolle',{ spalte_id: sp.id, rolle: r }); await ladeBoard(); };
  if (!sp.ist_erledigt && !sp.ist_agent) items.push({ txt: sp.automatik?.auftrag ? 'Automatik bearbeiten…' : 'Automatisieren (Agent verarbeitet jede Karte hier)…', do: () => spalteAutomatikDialog(sp) });
  if (!sp.ist_erledigt) items.push({ txt: sp.ist_agent ? 'Agenten-Rolle entfernen' : 'Als Agenten-Spalte (Karte rein = erledigen lassen)', do: () => rolle(sp.ist_agent ? 'keine' : 'agent') });
  if (!sp.ist_erledigt) items.push({ txt: sp.auto_status === 'rueckfrage' ? 'Rückfrage-Rolle entfernen' : 'Als Rückfrage-Spalte (Karten wandern automatisch her)', do: () => rolle(sp.auto_status === 'rueckfrage' ? 'keine' : 'rueckfrage') });
  if (!sp.ist_erledigt) items.push({ txt: sp.auto_status === 'fertig' ? 'Fertig-prüfen-Rolle entfernen' : 'Als Fertig-prüfen-Spalte (Agenten-Ergebnisse landen hier)', do: () => rolle(sp.auto_status === 'fertig' ? 'keine' : 'fertig_pruefen') });
  if (!sp.ist_erledigt) items.push({ txt: 'Als Erledigt-Spalte', do: () => rolle('erledigt') });
  if (sp.ist_erledigt) items.push({ note: 'Erledigt-Spalte – Rolle über andere Spalte ändern' });
  if (!sp.ist_erledigt && nSpalten > 1) items.push({ txt: 'Löschen – Karten wandern in erste Spalte', danger: true, do: async () => { const r = await lotse('spalte_loeschen', { spalte_id: sp.id }); if (r.fehler) alert(r.fehler); await ladeBoard(); } });
  ctxMenu(e.clientX, e.clientY, items);
}

function spalteAutomatikDialog(sp) {
  // "Spalte programmieren": Auftrag + Quellen + Ziel. Loest NUR bei Hand-Moves aus
  // (Entscheidung Marcel 24.07.); Agenten-Moves koennen keine Automatik starten.
  const root = document.getElementById('drawer-root'); root.innerHTML = '';
  const a = sp.automatik || {};
  const zu = () => { root.innerHTML = ''; };
  const ov = el('div', { class: 'overlay', style: 'justify-content:center;align-items:center', onclick: (e) => { if (e.target === ov) zu(); } });
  const box = el('div', { class: 'modalbox' });
  box.append(el('div', { style: 'font-size:15px;font-weight:700;margin-bottom:2px' }, 'Spalte automatisieren — „' + sp.name + '“'));
  box.append(el('div', { style: 'font-size:12px;color:#75756E;margin-bottom:12px' }, 'Jede Karte, die du von Hand in diese Spalte ziehst, verarbeitet der Agent mit diesem Auftrag. Das Ergebnis landet an der Karte.'));
  box.append(el('div', { class: 'slbl' }, 'Auftrag'));
  const ta = el('textarea', { class: 'autota', placeholder: 'Was soll mit jeder Karte passieren? Z. B.: „Prüfe die Ausschreibung gegen unsere Referenzen und erstelle eine Ersteinschätzung."' });
  ta.value = a.auftrag || '';
  box.append(ta);
  box.append(el('div', { class: 'slbl', style: 'margin-top:12px' }, 'Quellen'));
  const QU = [['projekt', 'Projektdaten (Ordner + Wissen des Karten-Projekts)'], ['internet', 'Internet-Recherche'], ['arbeitsstand', 'Marcels Arbeitsstand']];
  // Neu angelegte Automatik in einem Projekt-Board: Projektdaten sind der Normalfall -> vorangekreuzt.
  const vorQuellen = a.auftrag ? (a.quellen || []) : (S.active?.typ === 'projekt' ? ['projekt'] : []);
  const checks = {};
  for (const [k, label] of QU) {
    const cb = el('input', { type: 'checkbox', ...(vorQuellen.includes(k) ? { checked: '' } : {}) });
    checks[k] = cb;
    box.append(el('label', { style: 'display:flex;gap:8px;align-items:center;font-size:13px;margin:4px 0;cursor:pointer' }, cb, label));
  }
  box.append(el('div', { class: 'slbl', style: 'margin-top:12px' }, 'Wenn der Agent fertig ist'));
  const sel = el('select', { class: 'autosel' });
  sel.append(el('option', { value: '' }, 'Karte bleibt in dieser Spalte'));
  for (const s2 of (S.board?.spalten || [])) {
    if (s2.id === sp.id || s2.ist_erledigt || s2.ist_agent) continue;
    const o = el('option', { value: s2.id }, 'Karte wandert nach „' + s2.name + '“');
    if (a.ziel_spalte_id === s2.id) o.selected = true;
    sel.append(o);
  }
  box.append(sel);
  box.append(el('div', { style: 'font-size:11.5px;color:#8A8A83;margin-top:8px' }, 'Braucht der Agent etwas von dir, wandert die Karte in die Rückfrage-Spalte — antworten kannst du hier oder am Telefon. Nochmal ausführen: Karte kurz raus- und wieder reinziehen.'));
  const row = el('div', { style: 'display:flex;gap:9px;margin-top:16px;flex-wrap:wrap' });
  row.append(el('button', { class: 'btn lime', onclick: async () => {
    if (!ta.value.trim()) { alert('Bitte einen Auftrag eingeben — oder „Automatik entfernen".'); return; }
    const quellen = QU.map(([k]) => k).filter((k) => checks[k].checked);
    const r = await lotse('spalte_automatik', { spalte_id: sp.id, auftrag: ta.value.trim(), quellen, ziel_spalte_id: sel.value || null });
    if (r.fehler) { alert(r.fehler); return; }
    zu(); await ladeBoard();
  } }, 'Speichern'));
  if (a.auftrag) row.append(el('button', { class: 'btn warn', onclick: async () => {
    const r = await lotse('spalte_automatik', { spalte_id: sp.id, auftrag: null });
    if (r.fehler) { alert(r.fehler); return; }
    zu(); await ladeBoard();
  } }, 'Automatik entfernen'));
  row.append(el('button', { class: 'btn ghost', onclick: zu }, 'Abbrechen'));
  box.append(row);
  ov.append(box); root.append(ov);
}

// ---------- VgV-Dashboard (Marcels Auftrag 24.07.: Fristen-Grafik + Weitwinkel-Kandidaten) ----------
async function openVgvDashboard() {
  const root = document.getElementById('drawer-root'); root.innerHTML = '';
  const ov = el('div', { class: 'overlay', style: 'justify-content:center;align-items:center' });
  const box = el('div', { class: 'dashbox' }, el('div', { class: 'dleer' }, 'Lade Dashboard…'));
  ov.append(box); root.append(ov);
  ov.addEventListener('click', (e) => { if (e.target === ov) closeDrawer(); });
  const d = await lotse('vgv_dashboard').catch(() => ({ fehler: 'Netzwerkfehler' }));
  if (d.fehler) { box.innerHTML = ''; box.append(el('div', { class: 'dleer' }, d.fehler)); return; }
  renderVgvDashboard(box, d);
}

function dashLane(titel, eintraege, leerText) {
  const TAGE = 49;
  const lane = el('div', { class: 'dlane' });
  lane.append(el('div', { class: 'slbl' }, titel));
  if (!eintraege.length) { lane.append(el('div', { class: 'dleer' }, leerText)); return lane; }
  const kopfTrack = el('div', { class: 'dtrack kopf' });
  for (let w = 0; w <= 7; w++) {
    const dt = new Date(); dt.setDate(dt.getDate() + w * 7);
    kopfTrack.append(el('span', { class: 'dtick', style: `left:${(w * 7 / TAGE) * 100}%` },
      dt.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })));
  }
  lane.append(el('div', { class: 'drow' }, el('div', { class: 'dlbl' }, ''), kopfTrack));
  const sortiert = [...eintraege].sort((a, b2) => new Date(String(a.datum).replace(' ', 'T')) - new Date(String(b2.datum).replace(' ', 'T')));
  for (const e2 of sortiert) {
    const rest = vgvRest(e2.datum);
    if (!rest) continue;
    const pos = Math.max(0.5, Math.min(100, (rest.tage / TAGE) * 100));
    const cls = rest.tage < 0 ? 'vorbei' : rest.tage <= 3 ? 'rot' : rest.tage <= 7 ? 'knapp' : '';
    const lbl = el('div', { class: 'dlbl' }, el('b', {}, e2.name.slice(0, 44)),
      e2.sub ? el('span', { class: 'dsub' }, e2.sub) : '');
    const track = el('div', { class: 'dtrack' },
      el('div', { class: 'dbar ' + cls, style: `width:${pos}%` }),
      el('span', { class: 'ddot ' + cls, style: `left:${pos}%` }),
      el('span', { class: 'dend ' + cls, style: pos > 62 ? `right:${100 - pos}%;transform:translateX(0)` : `left:${pos}%` },
        rest.tage < 0 ? `${String(e2.datum).slice(8, 10)}.${String(e2.datum).slice(5, 7)}. vorbei`
          : rest.tage === 0 ? 'HEUTE' : `${new Date(String(e2.datum).replace(' ', 'T')).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })} · ${rest.tage} Tg`));
    lane.append(el('div', { class: 'drow' }, lbl, track));
  }
  return lane;
}

// Umschalter-Merker (Marcels Auftrag 27.07.): das Dashboard zeigt entweder die laufenden
// Verfahren oder die Empfehlungen — beides zusammen war zu voll. Trennlinie: eine Karte in
// der Spalte "Neu" ist ein Vorschlag, ab der zweiten Spalte ist sie ein laufendes Verfahren.
let dashTab = 'laufend';

function dashKpi(wert, lbl, sub, cls = '') {
  return el('div', { class: 'kpi ' + cls },
    el('div', { class: 'w' }, String(wert)), el('div', { class: 'l' }, lbl),
    sub ? el('div', { class: 's' }, sub) : '');
}

function dashNaechste(eintraege) {
  return eintraege.map((x) => vgvRest(x.datum) ? { ...x, rest: vgvRest(x.datum) } : null)
    .filter((x) => x && x.rest.tage >= 0).sort((a, b2) => a.rest.tage - b2.rest.tage)[0];
}

// Eine Verfahrenszeile (laufendes Verfahren bzw. Board-Vorschlag), aufklappbar wie die Kandidaten.
function verfahrenZeile(k) {
  const v = k.vgv || {};
  const erl = k.status === 'erledigt';
  const zeile = el('div', { class: 'kand2' + (erl ? ' erl' : '') });
  const datum = v.termin_phase2 || v.frist;
  const rest = vgvRest(datum);
  const kopf = el('div', { class: 'krow' }, el('span', { class: 'kt2', title: k.titel }, k.titel));
  if (v.empfehlung) {
    const f = v.empfehlung === 'BEWERBEN' ? { bg: '#E8F5C4', fg: '#3C5D1E' }
      : v.empfehlung === 'PRUEFEN' ? { bg: '#FBEFDA', fg: '#8A5606' } : { bg: '#ECECE8', fg: '#75756E' };
    kopf.append(el('span', { class: 'vtag', style: `background:${f.bg};color:${f.fg}` }, v.empfehlung));
  }
  // Nur noch offene Termine bekommen einen Chip: bei einem abgegebenen Antrag ist die
  // vergangene Phase-1-Frist kein Warnsignal, sondern der Normalfall.
  if (rest && rest.tage >= 0 && !erl) {
    const f = rest.tage <= 3 ? { bg: '#F7DDD6', fg: '#B4432E' }
      : rest.tage <= 7 ? { bg: '#FBEFDA', fg: '#8A5606' } : { bg: '#EDF3E1', fg: '#3C5D1E' };
    kopf.append(el('span', { class: 'vtag', style: `background:${f.bg};color:${f.fg}` },
      rest.tage === 0 ? 'HEUTE' : rest.tage + ' Tg'));
  }
  if (k.agent_status === 'laeuft') kopf.append(el('span', { class: 'vtag', style: 'background:#E8F5C4;color:#3C5D1E' }, 'Agent läuft'));
  zeile.append(kopf);
  zeile.append(el('div', { class: 'vm2' }, [
    v.ort, v.auftraggeber,
    v.frist ? 'Abgabe ' + String(v.frist).slice(8, 10) + '.' + String(v.frist).slice(5, 7) + '.' : null,
    v.termin_phase2 ? 'Phase 2 ' + String(v.termin_phase2).slice(8, 10) + '.' + String(v.termin_phase2).slice(5, 7) + '.' : null,
    v.konstellation ? String(v.konstellation).toUpperCase() : null,
  ].filter(Boolean).join(' · ')));
  const det = el('div', { class: 'kdet vdet', style: 'display:none' });
  if (v.stand_text) det.append(el('div', { class: 'vst' }, v.stand_text));
  if (v.empfehlung_grund && !v.stand_text) det.append(el('div', { class: 'vst' }, v.empfehlung_grund));
  if (v.ordner || v.ordner_laufend) det.append(el('div', { class: 'vpfad' }, v.ordner_laufend || v.ordner));
  if (v.beleg) det.append(el('div', { class: 'vpfad' }, 'Beleg: ' + v.beleg));
  if (det.childNodes.length) {
    zeile.append(det);
    zeile.addEventListener('click', () => { det.style.display = det.style.display === 'none' ? 'block' : 'none'; });
  } else { zeile.style.cursor = 'default'; }
  return zeile;
}

// Ansicht 1: laufende Verfahren — Termine links, Stand je Spalte rechts.
function renderDashLaufend(grid, laufend) {
  const offen = laufend.filter((k) => k.status !== 'erledigt');
  const p1 = offen.filter((k) => k.vgv.frist && (vgvRest(k.vgv.frist) || {}).tage >= 0).map((k) => ({
    name: k.titel, datum: k.vgv.frist,
    sub: [k.spalte, k.vgv.frist_bieterfragen ? 'Bieterfragen bis ' + String(k.vgv.frist_bieterfragen).slice(0, 10) : null].filter(Boolean).join(' · '),
  }));
  const p2 = offen.filter((k) => k.vgv.termin_phase2).map((k) => ({ name: k.titel, datum: k.vgv.termin_phase2, sub: k.spalte }));
  const naechste = dashNaechste(p1.concat(p2));
  const wartend = offen.filter((k) => k.spalte === 'Beworben').length;
  const inP2 = offen.filter((k) => String(k.spalte).startsWith('Phase 2')).length;

  const links = el('div', { class: 'dcol' });
  links.append(el('div', { class: 'kpis' },
    dashKpi(naechste ? (naechste.rest.tage === 0 ? 'HEUTE' : naechste.rest.tage + ' Tg') : '—', 'Nächster Termin',
      naechste ? naechste.name.slice(0, 26) : 'kein Termin offen', naechste && naechste.rest.tage <= 7 ? 'warn' : ''),
    dashKpi(offen.length, 'Laufende Verfahren', 'auf dem Board'),
    dashKpi(wartend, 'Beworben', 'Rückmeldung offen'),
    dashKpi(inP2, 'In Phase 2', 'Präsentation / Angebot')));
  links.append(dashLane('Phase 1 — Abgabe Teilnahmeunterlagen', p1, 'Keine offene Abgabefrist.'));
  links.append(dashLane('Phase 2 — Präsentation', p2,
    'Noch keine Phase-2-Termine bekannt — sie erscheinen automatisch, sobald die VgV-Analyse sie aus den Unterlagen zieht.'));
  grid.append(links);

  const rechts = el('div', { class: 'dcol' });
  rechts.append(el('div', { class: 'slbl' }, `Stand je Verfahren (${laufend.length})`));
  if (!laufend.length) rechts.append(el('div', { class: 'dleer' }, 'Keine laufenden Verfahren auf dem Board.'));
  const liste = el('div', { class: 'klist' });
  let gruppe = null;
  for (const k of laufend) {
    if (k.spalte !== gruppe) {
      gruppe = k.spalte;
      const n = laufend.filter((x) => x.spalte === gruppe).length;
      liste.append(el('div', { class: 'vgrp' }, `${gruppe} · ${n}`));
    }
    liste.append(verfahrenZeile(k));
  }
  rechts.append(liste);
  grid.append(rechts);
}

// Ansicht 2: Empfehlungen — frische Board-Karten links, Weitwinkel-Markt rechts.
function renderDashEmpfehlungen(grid, vorschlaege, kandidaten, d) {
  const p1 = vorschlaege.filter((k) => k.vgv.frist).map((k) => ({
    name: k.titel, datum: k.vgv.frist,
    sub: [k.spalte, k.vgv.frist_bieterfragen ? 'Bieterfragen bis ' + String(k.vgv.frist_bieterfragen).slice(0, 10) : null].filter(Boolean).join(' · '),
  }));
  const naechste = dashNaechste(p1);

  const links = el('div', { class: 'dcol' });
  links.append(el('div', { class: 'kpis' },
    dashKpi(kandidaten.length, 'Kandidaten offen', 'warten auf Go / No-Go'),
    dashKpi(vorschlaege.length, 'Neu auf dem Board', 'aufgenommen, nicht entschieden'),
    dashKpi(naechste ? naechste.rest.tage + ' Tg' : '—', 'Nächste Abgabe',
      naechste ? naechste.name.slice(0, 26) : 'keine Frist offen', naechste && naechste.rest.tage <= 7 ? 'warn' : ''),
    dashKpi(`${(d.entschieden || {}).go || 0} / ${(d.entschieden || {}).nogo || 0}`, 'Go / No-Go', 'letzte 14 Tage')));
  links.append(el('div', { class: 'slbl' }, `Aufgenommen, noch nicht entschieden (${vorschlaege.length})`));
  if (!vorschlaege.length) {
    links.append(el('div', { class: 'dleer' }, 'Nichts Neues in der ersten Spalte. Neue Funde legt der Radar dort automatisch ab.'));
  }
  const vliste = el('div', { class: 'klist' });
  for (const k of vorschlaege) vliste.append(verfahrenZeile(k));
  links.append(vliste);
  links.append(el('div', { style: 'height:18px' }));
  links.append(dashLane('Abgabefristen dieser Verfahren', p1, 'Keine Frist hinterlegt.'));
  grid.append(links);

  const rechts = el('div', { class: 'dcol' });
  rechts.append(el('div', { class: 'slbl' }, `Markt im größeren Radius — was noch passen würde (${kandidaten.length})`));
  if (!kandidaten.length) {
    rechts.append(el('div', { class: 'dleer' }, 'Keine offenen Kandidaten. Die Weitwinkel-Suche läuft täglich — alle Themengebiete mit Referenzlage, bis 250 km um Donaustauf und Bogen.'));
  }
  const liste = el('div', { class: 'klist' });
  for (const k of kandidaten) {
    const zeile = el('div', { class: 'kand2' });
    const det = el('div', { class: 'kdet', style: 'display:none' });
    if (k.referenzlage) det.append(el('div', { class: 'kref' }, 'Referenzlage: ' + k.referenzlage));
    if (k.begruendung) det.append(el('div', { class: 'kbeg' }, k.begruendung));
    const entscheide = async (was, ev) => {
      ev.stopPropagation();
      const r = await lotse('vgv_entscheiden', { kandidat_id: k.id, entscheidung: was }).catch(() => ({ fehler: 'Netzwerkfehler' }));
      if (r.fehler) { alert(r.fehler); return; }
      zeile.replaceWith(el('div', { class: 'kandhin' + (was === 'go' ? ' go' : '') },
        (was === 'go' ? '✓ GO — ' : '✕ No-Go — ') + (r.hinweis || '')));
      if (was === 'go') await ladeBoard();
    };
    zeile.append(el('div', { class: 'krow' },
      k.score != null ? el('span', { class: 'kscore' }, k.score) : el('span', { class: 'kscore leer' }, '–'),
      el('span', { class: 'kt2', title: k.titel }, k.titel),
      el('button', { class: 'kbtn go', title: 'Go — Karte in „Neu", Aufnahme startet automatisch', onclick: (ev) => entscheide('go', ev) }, '✓ Go'),
      el('button', { class: 'kbtn nogo', title: 'No-Go — wird nie wieder vorgelegt', onclick: (ev) => entscheide('nogo', ev) }, '✕')));
    zeile.append(el('div', { class: 'km2' }, [
      k.ort, k.km != null ? Math.round(k.km) + ' km' : null, k.kategorie,
      k.frist ? 'Abgabe ' + String(k.frist).slice(8, 10) + '.' + String(k.frist).slice(5, 7) + '.' : null,
      k.volumen, k.konstellation ? String(k.konstellation).toUpperCase() : null,
    ].filter(Boolean).join(' · ')));
    zeile.append(det);
    zeile.addEventListener('click', () => { det.style.display = det.style.display === 'none' ? 'block' : 'none'; });
    liste.append(zeile);
  }
  rechts.append(liste);
  grid.append(rechts);
}

function renderVgvDashboard(box, d) {
  box.innerHTML = '';
  const alle = (d.karten || []).filter((k) => k.vgv);
  const vorschlaege = alle.filter((k) => (k.spalte_pos || 0) === 0 && k.status !== 'erledigt');
  const laufend = alle.filter((k) => (k.spalte_pos || 0) > 0);
  const kandidaten = d.kandidaten || [];

  const st = d.weitwinkel_stand ? 'Weitwinkel-Stand ' + String(d.weitwinkel_stand).slice(0, 16).replace('T', ' ') : '';
  const tabs = el('div', { class: 'dtabs' });
  const tab = (id, lbl, n) => el('button', {
    class: 'dtab' + (dashTab === id ? ' an' : ''),
    onclick: () => { dashTab = id; renderVgvDashboard(box, d); },
  }, lbl, el('span', { class: 'n' }, String(n)));
  tabs.append(tab('laufend', 'Laufende Verfahren', laufend.filter((k) => k.status !== 'erledigt').length));
  tabs.append(tab('empfehlung', 'Empfehlungen', vorschlaege.length + kandidaten.length));
  box.append(el('div', { class: 'dkopf' },
    el('h2', {}, 'VgV-Dashboard'), tabs,
    el('span', { class: 'scope' }, st),
    el('button', { class: 'dclose', onclick: closeDrawer }, '✕')));

  const grid = el('div', { class: 'dgrid' });
  if (dashTab === 'empfehlung') renderDashEmpfehlungen(grid, vorschlaege, kandidaten, d);
  else renderDashLaufend(grid, laufend);
  box.append(grid);
}

// Rechtsklick auf eine Karte: Verschieben (auch der Touch-Ausweg ohne Drag&Drop),
// Projekt zuweisen/entfernen, Loeschen. Untermenues oeffnen nach dem closeCtx des
// Hauptmenues (setTimeout, weil ctxMenu einen once-Klick-Listener zum Schliessen setzt).
function kartenMenu(e, t) {
  const x = e.clientX, y = e.clientY;
  const items = [];
  const andere = (S.board?.spalten || []).filter((s2) => s2.id !== t.spalte_id);
  if (andere.length) items.push({ txt: '→ Verschieben nach…', do: () => setTimeout(() => ctxMenu(x, y,
    andere.map((s2) => ({ txt: s2.name, do: async () => { await mut('todo_verschieben', { todo_id: t.id, spalte_id: s2.id }); await ladeBoard(); } })))) });
  // Auf Team-Boards keine Projekt-Zuordnung — Projekt-Karten gehoeren nicht auf
  // Team-Boards (Server lehnt ab, Migration 79).
  if (!S.board?.ist_team) {
    items.push({ txt: '⌖ ' + (t.projekt_name ? 'Projekt ändern…' : 'Projekt zuweisen…'), do: () => setTimeout(() => projektMenu(x, y, t.id)) });
    if (t.projekt_name) items.push({ txt: '⌖ Projekt entfernen', do: async () => { await mut('todo_projekt', { todo_id: t.id, projekt: null }); await ladeBoard(); } });
  }
  items.push({ txt: 'Löschen…', danger: true, do: async () => {
    if (!confirm(`Karte "${t.titel}" endgültig löschen? Unterpunkte, Kommentare und Dateien gehen mit verloren.`)) return;
    await mut('todo_loeschen', { todo_id: t.id }); await ladeBoard();
  } });
  ctxMenu(x, y, items);
}
function projektMenu(x, y, todoId, danach) {
  const fertig = danach || (async () => { await ladeBoard(); });
  if (!S.projects.length) { alert('Keine aktiven Projekte gefunden.'); return; }
  ctxMenu(x, y, S.projects.map((p) => ({ txt: p.name, do: async () => {
    await mut('todo_projekt', { todo_id: todoId, projekt: p.name }); await fertig();
  } })));
}

function renderCard(t) {
  const st = statusVon(t);
  const chip = st && CHIPS[st];
  const due = fmtDatum(t.faellig);
  const c = el('div', {
    class: 'card' + (st === 'arbeitet' ? ' aura' : '') + (st === 'rueckfrage' ? ' rf' : ''),
    draggable: 'true',
    ondragstart: () => { S.drag = t.id; },
    // Ohne dragend blieb S.drag nach einem abgebrochenen Drag (Esc, daneben fallen
    // gelassen) haengen — und der 60s-Auto-Refresh war fuer den Rest der Sitzung tot.
    ondragend: () => { S.drag = null; },
    onclick: () => openCard(t.id),
    oncontextmenu: (e) => { e.preventDefault(); e.stopPropagation(); kartenMenu(e, t); },
  });
  if (t.zuarbeit) c.append(el('div', { class: 'chip zu' }, '⇄ Zuarbeit · vom Agenten'));
  if (chip) c.append(el('div', { class: 'chip', style: `background:${chip.bg};color:${chip.fg}` },
    el('span', { class: 'cdot', style: `background:${chip.dot}` }),
    chip.txt, st === 'fertig' && t.anhaenge_n ? ' 📎' : ''));
  c.append(el('div', { class: 't' }, t.titel));
  // Zielbild-Pflicht (Marcels Regel): das WOFUER steht sichtbar VOR der Bitte.
  if (t.zuarbeit && t.zielbild) c.append(el('div', { class: 'wofuer' }, el('b', {}, 'Wofür: '), t.zielbild));
  // VgV-Karte: Empfehlung + Abgabefrist direkt auf der Kachel (Radar-Board)
  if (t.vgv_empfehlung || t.vgv_frist) {
    const rest = vgvRest(t.vgv_frist);
    const f = t.vgv_empfehlung === 'BEWERBEN' ? { bg: '#E8F5C4', fg: '#3C5D1E' }
      : t.vgv_empfehlung === 'PRUEFEN' ? { bg: '#FBEFDA', fg: '#8A5606' }
      : { bg: '#ECECE8', fg: '#75756E' };
    const row = el('div', { class: 'vgvrow' });
    if (t.vgv_empfehlung) row.append(el('span', { class: 'vchip', style: `background:${f.bg};color:${f.fg}` }, t.vgv_empfehlung));
    if (rest) row.append(el('span', { class: 'vfrist' + (rest.knapp ? ' urgent' : '') }, rest.txt));
    c.append(row);
  }
  const meta = el('div', { class: 'meta' });
  // Redesign 10.08.: die Kachel zeigt nur Frist, Personen, Herkunft, Projekt — Zaehler
  // (Unterpunkte/Kommentare) und das ⌨-Icon stehen im Detail, nicht auf der Karte.
  if (t.quelle === 'voice') meta.append(el('span', { title: 'Per Anruf erstellt' }, '📞'));
  if (due) meta.append(el('span', { class: 'due' + (due.urgent ? ' urgent' : '') }, due.txt));
  if ((t.zugewiesen || []).length) {
    const avs = el('span', { class: 'avs' });
    for (const p of t.zugewiesen.slice(0, 3)) avs.append(el('span', { class: 'av', style: 'background:' + avColor(p), title: personName(p) }, initialen(personName(p))));
    meta.append(avs);
  }
  // Fremde Karte, die mir zugewiesen wurde: sichtbar machen, von wem sie kommt.
  if (t.besitzer && S.board?.wer && t.besitzer !== S.board.wer && !S.board.ist_team && !S.board.projekt_id) {
    meta.append(el('span', { style: 'color:#8A5606' }, 'von ' + personName(t.besitzer)));
  }
  if (t.projekt_name) meta.append(el('span', { class: 'proj', style: 'color:' + projDot(t.projekt_name) }, t.projekt_name.replace(/^\d+\s*/, '')));
  c.append(meta);
  return c;
}

// ---------- Drawer ----------
async function openCard(id) {
  try {
    S.detail = await lotse('todo_detail', { todo_id: id });
    renderDrawer();
  } catch (e) { console.error('openCard:', e); }
}
function closeDrawer() { S.detail = null; document.getElementById('drawer-root').innerHTML = ''; }

function renderDrawer() {
  const root = document.getElementById('drawer-root'); root.innerHTML = '';
  const d = S.detail; if (!d || d.fehler) { if (d?.fehler) alert(d.fehler); return; }
  const st = statusVon(d); const chip = st && CHIPS[st];
  const ov = el('div', { class: 'overlay', onclick: (e) => { if (e.target === ov) closeDrawer(); } });
  const dr = el('div', { class: 'drawer' });

  // Kopf
  const head = el('div', { class: 'dsec dhead' });
  const chipRow = el('div', { style: 'display:flex;align-items:center;gap:8px;flex-wrap:wrap' });
  if (chip) chipRow.append(el('span', { class: 'chip', style: `display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:600;padding:3px 10px;border-radius:10px;background:${chip.bg};color:${chip.fg}` }, chip.txt));
  if (d.zuarbeit) chipRow.append(el('span', { class: 'chip zu', style: 'font-size:11px;font-weight:700;padding:3px 10px;border-radius:10px' }, '⇄ Zuarbeit · vom Agenten' + (d.projekt ? ' für ' + d.projekt.name : '')));
  chipRow.append(el('span', { style: 'font-size:12px;color:#75756E' },
    d.quelle === 'agent' ? '⚙ vom Agenten angelegt' : d.quelle === 'voice' ? '📞 per Anruf erstellt' : '⌨ in der App erstellt'));
  chipRow.append(el('button', { style: 'margin-left:auto;font-size:16px;color:#75756E', onclick: closeDrawer }, '✕'));
  const titelZeile = el('div', { class: 't', style: 'display:flex;gap:8px;align-items:baseline' }, d.titel,
    el('button', { title: 'Titel bearbeiten', style: 'font-size:13px;color:#9A9A93', onclick: async () => {
      const t2 = prompt('Titel bearbeiten:', d.titel);
      if (t2 !== null && t2.trim() && t2.trim() !== d.titel) { await mut('todo_update', { todo_id: d.id, titel: t2.trim() }); await openCard(d.id); await ladeBoard(); }
    } }, '✎'));
  head.append(chipRow, titelZeile);
  const meta = el('div', { class: 'meta' });
  // Projekt: klickbar — zuweisen, aendern, entfernen (Migration 78).
  meta.append(el('button', { class: 'metabtn', title: 'Projekt zuweisen oder ändern', onclick: (e) => {
    if (S.board?.ist_team) { alert('Karte liegt auf einem Team-Board — Projekt-Zuordnung dort nicht möglich.'); return; }
    const x = e.clientX, y = e.clientY;
    const danach = async () => { await openCard(d.id); await ladeBoard(); };
    const items = S.projects.map((p) => ({ txt: p.name, do: async () => { await mut('todo_projekt', { todo_id: d.id, projekt: p.name }); await danach(); } }));
    if (d.projekt) items.push({ txt: 'Projekt entfernen', danger: true, do: async () => { await mut('todo_projekt', { todo_id: d.id, projekt: null }); await danach(); } });
    if (!items.length) { alert('Keine aktiven Projekte gefunden.'); return; }
    ctxMenu(x, y, items);
  } }, d.projekt ? '⌖ ' + d.projekt.name : '⌖ Projekt zuweisen'));
  // Frist: klickbar — Schnellwahl, freies Datum, entfernen (Migration 78: leerbar).
  const inTagen = (n) => { const dt = new Date(); dt.setDate(dt.getDate() + n);
    return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0'); };
  const fristBtn = el('button', { class: 'metabtn', title: 'Frist setzen oder ändern', onclick: (e) => {
    const x = e.clientX, y = e.clientY;
    const setze = async (body) => { await mut('todo_update', { todo_id: d.id, ...body }); await openCard(d.id); await ladeBoard(); };
    ctxMenu(x, y, [
      { txt: 'Heute', do: () => setze({ faellig: inTagen(0) }) },
      { txt: 'Morgen', do: () => setze({ faellig: inTagen(1) }) },
      { txt: 'In einer Woche', do: () => setze({ faellig: inTagen(7) }) },
      { txt: 'Datum wählen…', do: () => {
        const di = el('input', { type: 'date', class: 'metabtn', onchange: () => { if (di.value) setze({ faellig: di.value }); } });
        di.value = d.faellig || '';
        fristBtn.replaceWith(di); setTimeout(() => { di.focus(); di.showPicker?.(); });
      } },
      ...(d.faellig ? [{ txt: 'Frist entfernen', danger: true, do: () => setze({ faellig_leeren: true }) }] : []),
    ]);
  } }, d.faellig ? '📅 fällig ' + new Date(d.faellig).toLocaleDateString('de-DE') : '📅 Frist setzen');
  meta.append(fristBtn);
  meta.append(el('span', {}, 'Besitzer: ' + personName(d.besitzer)));
  head.append(meta); dr.append(head);

  // Zielbild-Pflicht (Loop B2): bei Zuarbeitskarten steht das WOFUER vor der Bitte.
  if (d.zuarbeit && d.zielbild) {
    const sec = el('div', { class: 'dsec' });
    sec.append(el('div', { class: 'slbl' }, 'Wofür der Agent das braucht'));
    sec.append(el('div', { class: 'zielbild' }, d.zielbild));
    dr.append(sec);
  }

  // Auftrag (editierbar — auch KI-formulierte Texte)
  {
    const sec = el('div', { class: 'dsec' });
    const kopf = el('div', { class: 'slbl', style: 'display:flex;gap:10px;align-items:center' }, d.zuarbeit ? 'Die Bitte' : 'Auftrag');
    const inhalt = el('div', { class: 'pre' }, d.notiz || '');
    kopf.append(el('button', { style: 'font-size:11px;color:#75756E', onclick: () => {
      const ta = el('textarea', { style: 'width:100%;min-height:110px;padding:8px 10px;border:1px solid rgba(28,28,26,.2);border-radius:8px;background:#fff;font-size:13px' });
      ta.value = d.notiz || '';
      const speichern = el('button', { class: 'btn', style: 'margin-top:8px', onclick: async () => {
        await mut('todo_update', { todo_id: d.id, notiz: ta.value }); await openCard(d.id);
      } }, 'Speichern');
      inhalt.replaceWith(el('div', {}, ta, speichern));
    } }, 'Bearbeiten'));
    sec.append(kopf, inhalt); dr.append(sec);
  }

  // VgV-Verfahren (Radar-Pipeline, Migration 45)
  if (d.vgv && typeof d.vgv === 'object') {
    const v = d.vgv;
    const sec = el('div', { class: 'dsec' });
    sec.append(el('div', { class: 'slbl' }, 'VgV-Verfahren'));
    if (v.empfehlung) {
      const f = v.empfehlung === 'BEWERBEN' ? { bg: '#E8F5C4', fg: '#3C5D1E' }
        : v.empfehlung === 'PRUEFEN' ? { bg: '#FBEFDA', fg: '#8A5606' }
        : { bg: '#ECECE8', fg: '#55554F' };
      const ban = el('div', { class: 'vgvban', style: `background:${f.bg};color:${f.fg}` });
      ban.append(el('div', { style: 'font-weight:700;font-size:13px' }, 'Erst-Empfehlung: ' + v.empfehlung));
      if (v.empfehlung_grund) ban.append(el('div', { style: 'font-size:12.5px;margin-top:3px' }, v.empfehlung_grund));
      sec.append(ban);
    }
    const kv = el('div', { class: 'vgvkv' });
    const rest = vgvRest(v.frist);
    const paare = [
      ['Auftraggeber', v.auftraggeber], ['Ort', v.ort],
      ['Abgabefrist', v.frist ? v.frist + (rest ? ` (${rest.txt.replace('Abgabe ', '')})` : '') : null],
      ['Bieterfragen bis', v.frist_bieterfragen], ['Verfahrensart', v.verfahrensart],
      ['Volumen', v.volumen], ['Leistung', v.leistung],
      ['Konstellation', v.konstellation ? String(v.konstellation).toUpperCase() : null],
      ['Scout-Score', v.score != null ? v.score + '/100' : null],
    ];
    for (const [k2, w] of paare) if (w) kv.append(el('div', { class: 'k' }, k2), el('div', { class: 'w' }, String(w)));
    sec.append(kv);
    if (Array.isArray(v.referenzen) && v.referenzen.length) {
      sec.append(el('div', { class: 'slbl', style: 'margin-top:10px' }, 'Referenz-Anker'));
      for (const r of v.referenzen) sec.append(el('div', { style: 'font-size:12.5px;margin-bottom:2px' },
        el('b', {}, r.id || ''), r.grund ? ' — ' + r.grund : ''));
      if (v.luecke) sec.append(el('div', { style: 'font-size:12px;color:#8A5606;margin-top:3px' }, 'Lücke: ' + v.luecke));
    }
    const links = el('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;margin-top:10px' });
    if (v.ted_link) links.append(el('a', { class: 'btn ghost vgvlnk', href: v.ted_link, target: '_blank' }, 'TED-Bekanntmachung ↗'));
    if (v.portal_link) links.append(el('a', { class: 'btn ghost vgvlnk', href: v.portal_link, target: '_blank' }, (v.portal || 'Portal') + ' / Unterlagen ↗'));
    if (links.childNodes.length) sec.append(links);
    if (v.ordner) sec.append(el('div', { style: 'display:flex;gap:8px;align-items:center;margin-top:8px;font-size:12px;color:#75756E' },
      el('span', { style: 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap' }, v.ordner),
      el('button', { class: 'btn ghost', style: 'font-size:11px;padding:3px 9px;flex:none', onclick: () => navigator.clipboard.writeText(v.ordner) }, 'Pfad kopieren')));
    // Heruntergeladene Portal-Dateien + Vollstaendigkeit
    const dat = Array.isArray(v.dateien) ? v.dateien : [];
    const kopf = el('div', { class: 'slbl', style: 'margin-top:12px;display:flex;gap:8px;align-items:center' },
      `Unterlagen aus dem Portal (${dat.length})`,
      v.vollstaendig ? el('span', { style: 'color:#3C5D1E;font-weight:700;font-size:11px' }, '✓ vollständig')
        : el('span', { style: 'color:#B4540A;font-weight:700;font-size:11px' }, '⚠ unvollständig'));
    sec.append(kopf);
    if (!v.vollstaendig && v.fehlend) sec.append(el('div', { style: 'font-size:12px;color:#B4540A;margin-bottom:5px' }, 'Fehlt: ' + v.fehlend));
    if (dat.length) {
      const box = el('div', { class: 'vgvdat' });
      for (const f2 of dat) box.append(el('div', {}, '📄 ' + (f2.name || f2) + (f2.kb ? ` (${f2.kb} KB)` : '')));
      sec.append(box);
    }
    // Analyse-Dateien (Agent-Anhaenge) direkt oeffnen
    const ana = (d.anhaenge || []).filter((a2) => /(^|\d_)(VGV_?Analyse|Referenz_?Analyse|TERMINE)/i.test(a2.name));
    if (ana.length) {
      const row2 = el('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;margin-top:12px' });
      for (const a2 of ana.slice(0, 3)) row2.append(el('button', { class: 'btn', onclick: () => oeffneAnhaenge([a2]) },
        /TERMINE/i.test(a2.name) ? 'Termine' : /Referenz/i.test(a2.name) ? 'Referenzen' : 'Analyse'));
      if (ana.length > 1) row2.append(el('button', { class: 'btn lime', onclick: () => oeffneAnhaenge(ana.slice(0, 3)) }, `Alle ${Math.min(ana.length, 3)} öffnen`));
      sec.append(row2);
    }
    dr.append(sec);
  }

  // Rueckfragen — Sammel-Modus (Marcels Wunsch 24.07.): Antworten zwischenspeichern
  // ('entwurf', Agent wartet weiter), Dateien in Ruhe anhaengen, erst "Losschicken" laesst
  // den Agenten weiterarbeiten. Telefon-Antworten bleiben sofort final.
  const offene = (d.rueckfragen || []).filter((f) => f.status === 'offen' || f.status === 'entwurf');
  const beantwortete = (d.rueckfragen || []).filter((f) => f.status === 'beantwortet' || f.status === 'uebersprungen');
  if (offene.length) {
    const sec = el('div', { class: 'dsec rfsec' });
    sec.append(el('div', { class: 'slbl' }, `${offene.length} Frage${offene.length > 1 ? 'n' : ''} — Antworten sammeln, dann losschicken`));
    const inputs = [];
    offene.forEach((f, i) => {
      sec.append(el('div', { class: 'frage' }, `${i + 1}. ${f.frage}`,
        f.status === 'entwurf' ? el('span', { style: 'font-size:11px;color:#5A6E1E;font-weight:700' }, ' 💾 zwischengespeichert') : ''));
      const inp = el('input', { placeholder: 'Deine Antwort…' });
      inp.value = f.antwort || '';
      inputs.push({ f, inp }); sec.append(inp);
      if (f.status === 'offen') sec.append(el('button', { style: 'font-size:11.5px;color:#8A5606;margin:4px 0 8px', onclick: async () => { await mut('rueckfrage_antworten',{ rueckfrage_id: f.id, antwort: 'ueberspringen' }); await openCard(d.id); await ladeBoard(); } }, 'Überspringen'));
    });
    const speichereEntwuerfe = async () => {
      for (const { f, inp } of inputs) if (inp.value.trim() && inp.value.trim() !== (f.antwort || '')) {
        const r = await lotse('rueckfrage_entwurf', { rueckfrage_id: f.id, antwort: inp.value.trim() });
        if (r.fehler) alert(r.fehler);
      }
    };
    const rowB = el('div', { style: 'display:flex;gap:9px;margin-top:10px;flex-wrap:wrap' });
    rowB.append(el('button', { class: 'btn warn', onclick: async () => {
      await speichereEntwuerfe();
      const r = await lotse('rueckfragen_absenden', { todo_id: d.id });
      if (r.fehler) alert(r.fehler);
      await openCard(d.id); await ladeBoard();
    } }, 'Losschicken – Agent arbeitet weiter'));
    rowB.append(el('button', { class: 'btn ghost', onclick: async () => {
      await speichereEntwuerfe();
      await openCard(d.id); await ladeBoard();
    } }, 'Zwischenspeichern'));
    sec.append(rowB);
    sec.append(el('div', { style: 'font-size:11.5px;color:#8A5606;margin-top:8px' }, 'Zwischengespeichert = der Agent wartet noch. Häng unten in Ruhe Dateien an – er bekommt sie beim Weiterarbeiten mit. Erst „Losschicken" lässt ihn weitermachen.'));
    dr.append(sec);
  }
  if (beantwortete.length) {
    const sec = el('div', { class: 'dsec' });
    sec.append(el('div', { class: 'slbl' }, 'Beantwortete Rückfragen'));
    for (const f of beantwortete) sec.append(
      el('div', { style: 'font-size:12.5px;color:#75756E;margin-bottom:2px' }, f.frage),
      el('div', { style: 'font-size:13px;margin-bottom:8px' }, '→ ' + (f.antwort || 'übersprungen')));
    dr.append(sec);
  }

  // Ergebnis
  if (d.agent_ergebnis && (st === 'fertig' || st === 'fehlgeschlagen' || !st)) {
    const sec = el('div', { class: 'dsec' });
    sec.append(el('div', { class: 'slbl' }, 'Ergebnis'));
    sec.append(el('div', { class: 'pre' }, d.agent_ergebnis));
    const m = d.agent_ergebnis.match(/Datei abgelegt:\s*([^\n—]+)/);
    if (m) sec.append(el('button', { class: 'btn ghost', style: 'margin-top:10px', onclick: () => { navigator.clipboard.writeText(m[1].trim()); } }, 'Datei-Pfad kopieren'));
    dr.append(sec);
  }

  // Unterpunkte
  const su = el('div', { class: 'dsec' });
  // Leere Sektionen zeigen kein Label — nur die schlanke Hinzufuegen-Zeile (Redesign 10.08.).
  if (d.unterpunkte.length) su.append(el('div', { class: 'slbl' }, `Unterpunkte (${d.unterpunkte.filter(u => u.erledigt).length}/${d.unterpunkte.length})`));
  for (const u of d.unterpunkte) {
    su.append(el('div', { class: 'sub' },
      el('input', { type: 'checkbox', ...(u.erledigt ? { checked: '' } : {}), onchange: async (e) => { await mut('unterpunkt_setzen',{ unterpunkt_id: u.id, erledigt: e.target.checked }); await openCard(d.id); } }),
      el('span', { style: u.erledigt ? 'text-decoration:line-through;color:#8A8A83' : '' }, u.text),
      el('button', { class: 'del', onclick: async () => { await mut('unterpunkt_loeschen',{ unterpunkt_id: u.id }); await openCard(d.id); } }, '✕')));
  }
  const addU = el('div', { class: 'inline-add' });
  const uInp = el('input', { placeholder: 'Unterpunkt hinzufügen…', onkeydown: async (e) => { if (e.key === 'Enter' && uInp.value.trim()) { await mut('unterpunkt_anlegen',{ todo_id: d.id, text: uInp.value.trim() }); await openCard(d.id); } } });
  addU.append(uInp); su.append(addU); dr.append(su);

  // Personen
  const sp2 = el('div', { class: 'dsec' });
  sp2.append(el('div', { class: 'slbl' }, 'Personen'));
  for (const p of d.zugewiesen) sp2.append(el('span', { class: 'pill' },
    el('span', { class: 'av', style: 'width:16px;height:16px;border-radius:50%;color:#fff;font-size:8px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;background:' + avColor(p) }, initialen(personName(p))),
    personName(p), el('button', { style: 'color:#9A9A93', onclick: async () => { await mut('todo_zuweisen',{ todo_id: d.id, person: p, an: false }); await openCard(d.id); await ladeBoard(); } }, '✕')));
  sp2.append(el('button', { class: 'btn ghost', style: 'font-size:12px;padding:5px 11px', onclick: (e) => {
    const kandidaten = personListe().filter((p) => !d.zugewiesen.includes(p.kurz));
    if (!kandidaten.length) return;
    ctxMenu(e.clientX, e.clientY, kandidaten.map((p) => ({ txt: p.name, do: async () => { await mut('todo_zuweisen',{ todo_id: d.id, person: p.kurz, an: true }); await openCard(d.id); await ladeBoard(); } })));
  } }, '+ Person')); dr.append(sp2);

  // Anhaenge
  const sa = el('div', { class: 'dsec' });
  if (d.anhaenge.length) sa.append(el('div', { class: 'slbl' }, 'Dateien'));
  for (const a of d.anhaenge) sa.append(el('div', { class: 'sub' },
    el('a', { href: '#', style: 'color:#1C1C1A;font-weight:500', onclick: async (e) => { e.preventDefault(); await downloadAnhang(a); } }, '📎 ' + a.name),
    el('span', { style: 'color:#9A9A93;font-size:11.5px' }, a.groesse ? Math.round(a.groesse / 1024) + ' KB' : ''),
    el('button', { class: 'del', onclick: async () => { await mut('anhang_loeschen',{ anhang_id: a.id }); await openCard(d.id); } }, '✕')));
  const fileInp = el('input', { type: 'file', style: 'display:none', onchange: async (e) => {
    const f = e.target.files[0]; if (!f) return;
    const pfad = `${d.id}/${Date.now()}_${f.name.replace(/[^\w.\-äöüÄÖÜß ]/g, '_')}`;
    const up = await fetch(`${SUPA}/storage/v1/object/todo-anhaenge/${pfad}`, {
      method: 'POST', headers: { apikey: ANON, Authorization: 'Bearer ' + S.session.access_token }, body: f,
    });
    if (!up.ok) { alert('Upload fehlgeschlagen'); return; }
    await mut('anhang_registrieren',{ todo_id: d.id, pfad, name: f.name, groesse: f.size });
    await openCard(d.id); await ladeBoard();
  } });
  sa.append(fileInp, el('button', { class: 'btn ghost', style: 'font-size:12px;padding:5px 11px', onclick: () => fileInp.click() }, 'Anhängen')); dr.append(sa);

  // Kommentare
  const sk = el('div', { class: 'dsec' });
  if (d.kommentare.length) sk.append(el('div', { class: 'slbl' }, 'Kommentare'));
  for (const k of d.kommentare) sk.append(el('div', { class: 'kom' },
    el('div', { class: 'von' }, `${k.von} · ${new Date(k.am).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`),
    el('div', { class: 'txt' }, k.text)));
  const addK = el('div', { class: 'inline-add' });
  const kInp = el('input', { placeholder: 'Kommentar…' });
  addK.append(kInp, el('button', { class: 'btn', onclick: async () => { if (kInp.value.trim()) { await mut('kommentar_anlegen',{ todo_id: d.id, text: kInp.value.trim() }); await openCard(d.id); await ladeBoard(); } } }, 'Senden'));
  sk.append(addK); dr.append(sk);

  // Verlauf
  if ((d.verlauf || []).length) {
    const sv = el('div', { class: 'dsec' });
    sv.append(el('div', { class: 'slbl' }, 'Verlauf'));
    const WAS = { erstellt: 'Erstellt', rueckfragen: 'Rückfragen', gemeldet: 'Per Anruf gemeldet', erledigt: 'Erledigt' };
    for (const v of d.verlauf) sv.append(el('div', { class: 'vrow' },
      el('span', {}, new Date(v.am).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })),
      el('span', {}, (WAS[v.was] || v.was) + (v.detail ? ' — ' + v.detail : ''))));
    dr.append(sv);
  }

  // Aktionen
  const sf = el('div', { class: 'dsec', style: 'display:flex;gap:9px;border-bottom:none' });
  if (d.status === 'offen') {
    sf.append(el('button', { class: 'btn lime', onclick: async () => {
      const kom = prompt('Kommentar zum Abschluss (fließt ins Agenten-Gedächtnis):', '');
      if (kom === null) return;
      await mut('todo_complete',{ todo_id: d.id, kommentar: kom || null });
      closeDrawer(); await ladeBoard();
    } }, 'Mit Kommentar abschließen'));
  }
  sf.append(el('button', { class: 'btn ghost', title: 'Kommt in der nächsten Ausbaustufe', disabled: '', style: 'opacity:.45;cursor:default' }, 'Nachbessern'));
  // "Nicht relevant" (Loop D): die Begruendung fliesst als Kommentar-Abschluss in die
  // Lernschleife (item_feedback via assistant_todo_abschliessen, Migration 52).
  if (d.status === 'offen' && (d.zuarbeit || d.quelle === 'agent')) {
    sf.append(el('button', { class: 'btn ghost gefahr', onclick: async () => {
      const grund = prompt('Warum ist das gerade nicht relevant? (fließt ins Agenten-Gedächtnis — er schlägt so etwas dann nicht mehr vor)');
      if (grund === null || !grund.trim()) return;
      await mut('todo_complete', { todo_id: d.id, kommentar: 'NICHT RELEVANT: ' + grund.trim() });
      closeDrawer(); await ladeBoard();
    } }, 'Nicht relevant…'));
  }
  sf.append(el('button', { class: 'btn ghost gefahr', style: 'margin-left:auto', onclick: async () => {
    if (!confirm(`Karte "${d.titel}" endgültig löschen? Unterpunkte, Kommentare und Dateien gehen mit verloren.`)) return;
    const r = await mut('todo_loeschen', { todo_id: d.id });
    if (r && r.ok) { closeDrawer(); await ladeBoard(); }
  } }, 'Löschen'));
  dr.append(sf);

  ov.append(dr); root.append(ov);
}

// HTML-Anhaenge im neuen Tab ANZEIGEN statt herunterladen (VgV-Analyse-Dateien). Fenster
// synchron im Klick oeffnen (Popup-Blocker), Inhalt nach dem Fetch als Blob-URL setzen.
async function oeffneAnhaenge(liste) {
  const wins = liste.map(() => window.open('about:blank'));
  for (let i = 0; i < liste.length; i++) {
    const a = liste[i];
    try {
      const r = await fetch(`${SUPA}/storage/v1/object/todo-anhaenge/${a.pfad}`, {
        headers: { apikey: ANON, Authorization: 'Bearer ' + S.session.access_token } });
      if (!r.ok) throw new Error(r.status);
      const buf = await r.arrayBuffer();
      const typ = a.name.toLowerCase().endsWith('.html') ? 'text/html' : (r.headers.get('content-type') || 'application/octet-stream');
      const u = URL.createObjectURL(new Blob([buf], { type: typ }));
      if (wins[i] && !wins[i].closed) wins[i].location = u; else window.open(u);
      setTimeout(() => URL.revokeObjectURL(u), 60000);
    } catch (e) { if (wins[i] && !wins[i].closed) wins[i].close(); alert('Öffnen fehlgeschlagen: ' + a.name); }
  }
}

async function downloadAnhang(a) {
  const r = await fetch(`${SUPA}/storage/v1/object/todo-anhaenge/${a.pfad}`, {
    headers: { apikey: ANON, Authorization: 'Bearer ' + S.session.access_token } });
  if (!r.ok) { alert('Download fehlgeschlagen'); return; }
  const blob = await r.blob();
  const u = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = u; link.download = a.name; link.click();
  setTimeout(() => URL.revokeObjectURL(u), 5000);
}

// ---------- Login + Start ----------
function showLogin() {
  document.getElementById('login').classList.remove('hidden');
  document.getElementById('app').classList.add('hidden');
}
async function start() {
  document.getElementById('login').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  try { await ladeAlles(); }
  catch (e) {
    console.error('start:', e);
    await new Promise((s2) => setTimeout(s2, 1200));
    try { await ladeAlles(); } catch (e2) {
      document.getElementById('board').innerHTML = '<div class="empty" style="padding:20px">Verbindung fehlgeschlagen — bitte neu laden.</div>';
      throw e2;
    }
  }
  clearInterval(S.poll);
  // Auto-Aktualisierung pausiert, solange jemand schreibt (Karte anlegen, Drawer offen,
  // Cursor in einem Eingabefeld) — sonst raeumt der Neu-Aufbau die Eingabe weg.
  S.poll = setInterval(async () => {
    const tippt = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '');
    if (S.detail || S.newCardCol || S.drag || S.kalDrag || tippt) return;
    try {
      await ladeBoard();
      // Offener Kalender-Tab bekommt Frist-Aenderungen anderer auch mit.
      if (S.ansicht === 'kal' && S.active?.typ === 'projekt') await renderKalender();
    } catch {}
  }, 60000);
}
document.getElementById('li-btn').addEventListener('click', doLogin);
document.getElementById('li-pw').addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin(); });
async function doLogin() {
  const err = document.getElementById('li-err'); err.textContent = '';
  try {
    await authLogin(document.getElementById('li-mail').value.trim(), document.getElementById('li-pw').value);
    await start();
  } catch (e) { err.textContent = e.message; }
}
addEventListener('unhandledrejection', (e) => console.error('unhandled:', e.reason));
loadSession();
if (S.session?.access_token) start().catch(() => showLogin());
else showLogin();
