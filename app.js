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
  melde: null, // Glocke: {offen, eintraege} aus assistant_benachrichtigungen
  chatPoll: null, komEntwurf: '', // schneller Takt + Kommentarentwurf, solange der Agent schreibt
  zuruf: null, // {todoId, seit} — abgesetzter @agent-Zuruf, auf den noch keine Antwort da ist
};

// ---------- Dialoge ----------
// Ersetzen alert / confirm / prompt. Gleiche Aufrufform, nur dass die beiden
// fragenden ein Promise liefern und deshalb mit await stehen. Liegen hier in
// app.js (klassisches Skript), damit auch dashboard.js (Modul) sie sieht.
function uiEsc(s) { return String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

function uiModal(inhalt, fertig, breit) {
  const o = document.createElement('div');
  o.className = 'uidlg';
  o.innerHTML = '<div class="uidlg-karte' + (breit ? ' breit' : '') + '">' + inhalt + '</div>';
  document.body.appendChild(o);
  const schliessen = (wert) => { document.removeEventListener('keydown', taste, true); o.remove(); fertig(wert); };
  const taste = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); schliessen(null); }
    else if (e.key === 'Enter') {
      // In einem mehrzeiligen Feld gehoert Enter dem Text — sonst liesse sich kein
      // Absatz setzen und der Dialog schloesse beim ersten Umbruch. Strg+Enter uebernimmt.
      if (e.target && e.target.tagName === 'TEXTAREA' && !(e.ctrlKey || e.metaKey)) return;
      e.preventDefault(); e.stopPropagation(); o.querySelector('[data-ui="ok"]').click();
    }
  };
  document.addEventListener('keydown', taste, true);
  o.onclick = (e) => { if (e.target === o) schliessen(null); };
  return { o, schliessen };
}

// Ja/Nein. Liefert true nur bei ausdruecklicher Zustimmung — Esc und Klick
// daneben gelten als Nein, genau wie beim Browser-confirm.
function uiFrage(text, opt) {
  opt = opt || {};
  return new Promise(fertig => {
    const { o, schliessen } = uiModal(
      '<div class="uidlg-t">' + uiEsc(opt.titel || 'Bitte bestätigen') + '</div>' +
      '<div class="uidlg-x">' + uiEsc(text) + '</div>' +
      '<div class="uidlg-akt">' +
      '<button class="uidlg-b hell" data-ui="nein">' + uiEsc(opt.abbruch || 'Abbrechen') + '</button>' +
      '<button class="uidlg-b' + (opt.gefahr ? ' rot' : '') + '" data-ui="ok">' + uiEsc(opt.ok || 'Ja') + '</button>' +
      '</div>', w => fertig(w === true));
    o.querySelector('[data-ui="ok"]').onclick = () => schliessen(true);
    o.querySelector('[data-ui="nein"]').onclick = () => schliessen(false);
    o.querySelector('[data-ui="ok"]').focus();
  });
}

// Texteingabe. Liefert den Text oder null bei Abbruch — wie prompt().
function uiEingabe(text, vorbelegt, opt) {
  opt = opt || {};
  return new Promise(fertig => {
    const { o, schliessen } = uiModal(
      '<div class="uidlg-t">' + uiEsc(text) + '</div>' +
      (opt.mehrzeilig
        ? '<textarea class="uidlg-i uidlg-ta">' + uiEsc(vorbelegt || '') + '</textarea>' +
          '<div class="uidlg-hint">Strg+Enter übernimmt · Esc bricht ab</div>'
        : '<input class="uidlg-i" value="' + uiEsc(vorbelegt || '') + '">') +
      '<div class="uidlg-akt">' +
      '<button class="uidlg-b hell" data-ui="nein">Abbrechen</button>' +
      '<button class="uidlg-b" data-ui="ok">' + uiEsc(opt.ok || 'Übernehmen') + '</button>' +
      '</div>', w => fertig(w), opt.mehrzeilig);
    const f = o.querySelector('.uidlg-i');
    o.querySelector('[data-ui="ok"]').onclick = () => schliessen(f.value);
    o.querySelector('[data-ui="nein"]').onclick = () => schliessen(null);
    if (opt.mehrzeilig) {
      // Das Feld ist beim Oeffnen so hoch wie sein Inhalt — man soll den ganzen Text
      // sehen, ohne im Feld zu scrollen (Marcel, 25.08.). Gedeckelt bei 60 % der
      // Fensterhoehe, damit Ueberschrift und Knoepfe sichtbar bleiben.
      const wachse = () => { f.style.height = 'auto'; f.style.height = Math.min(f.scrollHeight, Math.round(innerHeight * 0.6)) + 'px'; };
      f.addEventListener('input', wachse); wachse();
      // Cursor ans Ende statt alles markieren: ein Tastendruck soll nicht den
      // ganzen Bestandstext loeschen, den man gerade korrigieren will.
      f.focus(); f.setSelectionRange(f.value.length, f.value.length);
    } else { f.focus(); f.select(); }
  });
}

// Kurze Meldung unten. Bleibt liegen, bis sie von selbst geht oder angeklickt wird.
function uiHinweis(text, art) {
  const t = document.createElement('div');
  t.className = 'uitoast' + (art === 'ok' ? ' ok' : '');
  t.textContent = String(text ?? '');
  t.onclick = () => t.remove();
  document.body.appendChild(t);
  setTimeout(() => { t.classList.add('weg'); setTimeout(() => t.remove(), 400); }, art === 'ok' ? 2600 : 5400);
}
window.uiFrage = uiFrage; window.uiEingabe = uiEingabe; window.uiHinweis = uiHinweis;

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
    const READS = ['board', 'board_liste', 'projects', 'todo_detail', 'todo_list', 'vgv_dashboard', 'mein_radar', 'kalender', 'agent_laeufe', 'benachrichtigungen'];
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
  if (r && r.fehler) uiHinweis(r.fehler);
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
  // Startansicht ist "Mein Radar" (Wunsch der Mitarbeiter, 24.08.): erst sehen, was
  // ueberall fuer mich offen ist -- dann hineinklicken. Die Boards bleiben, wo sie waren.
  if (!S.active) S.active = { typ: 'radar', id: null, name: 'Mein Dashboard' };
  renderSidebar();
  await ladeBoard();
}
let ladeToken = 0; // verwirft veraltete Antworten bei schnellem Board-Wechsel
async function ladeBoard() {
  if (!S.active) return;
  const token = ++ladeToken;
  ladeMeldungen(); // blockiert nichts; zeichnet die Topbar selbst nach
  if (S.active.typ === 'radar') {
    const d = await lotse('mein_radar').catch(() => ({ fehler: 'Netzwerkfehler' }));
    if (token !== ladeToken) return;
    // Frontend und Lotse gehen nie exakt gleichzeitig raus. Kennt der Lotse die
    // Aktion noch nicht, soll niemand vor einer englischen Fehlermeldung stehen.
    // Beim automatischen Start faellt die App aufs eigene Board zurueck -- wer aber
    // BEWUSST auf "Mein Dashboard" klickt, wird nicht weggeschoben (das fuehlt sich
    // wie ein Fehler an, Marcels Befund 24.08.), sondern liest, was noch fehlt.
    if (d.fehler && /unknown action/i.test(d.fehler)) {
      const hinweis = 'Das Dashboard ist noch nicht fertig freigeschaltet — der Server-Teil dazu '
        + 'fehlt noch. Deine Aufgaben findest du solange auf den Boards links.';
      if (!S.radarGeklickt && S.liste?.boards?.length) {
        const b0 = S.liste.boards[0];
        uiHinweis(hinweis);
        await wechsle('board', b0.id, b0.name);
        return;
      }
      S.radar = { fehler: hinweis }; S.board = null;
      renderSidebar(); renderTopbar(); zeigeAnsicht('board'); renderRadar();
      return;
    }
    S.radar = d; S.board = null;
    renderSidebar(); renderTopbar(); zeigeAnsicht('board'); renderRadar();
    return;
  }
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
  if (typ === 'radar') S.radarGeklickt = true;
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
  const term = document.getElementById('termin-root');
  if (!dash || !board) return;
  const radar = document.getElementById('radar-root');
  const istProjekt = S.active?.typ === 'projekt';
  const istRadar = S.active?.typ === 'radar';
  const dashAn = welche === 'dash' && istProjekt;
  const kalAn = welche === 'kal' && istProjekt;
  const termAn = welche === 'termin' && istProjekt;
  board.style.display = (dashAn || kalAn || termAn || istRadar) ? 'none' : '';
  dash.hidden = !dashAn;
  if (kal) kal.hidden = !kalAn;
  if (term) term.hidden = !termAn;
  if (radar) radar.hidden = !istRadar;
  if (dashAn && window.dashStart) window.dashStart(S.session, S.active.id);
  if (kalAn) renderKalender();
  if (termAn) renderTerminplan();
  renderTopbar();
}

// ---------- Terminplanung (Vollausbau 24.08. abends) ----------
// EINE generische Datei fuer ALLE Projekte: terminplan/plan.html bekommt das Projekt
// per URL und holt seine Plaene aus der Datenbank (termin_plaene & Co., Migration 106/107).
// Kein Plan vorhanden -> die Datei bietet selbst Vorlage / MS-Project-XML / leer an.
// Werkzeug-Grundlage: Benjamin Adams Eigenbau. (Der im Pentling-Plankopf genannte
// "Ersteller Julian Neuhoff" ist der Ersteller des BAUZEITENPLANS, nicht des Werkzeugs.)
function renderTerminplan() {
  const root = document.getElementById('termin-root');
  if (!root || S.active?.typ !== 'projekt') return;
  // Nur neu aufbauen, wenn ein anderes Projekt dran ist — sonst wuerde der Poll
  // alle 60 s den iframe neu laden und die Arbeit im Plan wegwerfen.
  if (root.dataset.projekt === String(S.active.id) && root.childElementCount) return;
  root.dataset.projekt = String(S.active.id);
  root.innerHTML = '';
  const url = 'terminplan/plan.html?projekt=' + encodeURIComponent(S.active.id)
    + '&name=' + encodeURIComponent(S.active.name);
  root.append(el('div', { class: 'terminhint' },
    el('span', { class: 'probe' }, 'PROBE'),
    el('span', {}, 'Werkzeug von Benjamin Adam · speichert in der Projekt-Datenbank'),
    el('a', { onclick: () => window.open(url, '_blank') }, 'eigenes Fenster')));
  const f = document.createElement('iframe');
  f.src = url;
  f.title = 'Terminplan ' + S.active.name;
  root.append(f);
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
        const titel = await uiEingabe(`Neue Aufgabe am ${t}.${S.kal.monat}.${S.kal.jahr}:`);
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

// ---------- Mein Dashboard (Startansicht) ----------
// Zeigt zuerst das eigene Pensum -- "Meine Aufgaben" und "Mir zugewiesen" stehen
// immer da --, danach die Bereiche, die sich jeder selbst dazustellt. Diese Auswahl
// IST die Pin-Liste der Seitenleiste (Migration 105): was hier steht, steht links
// oben. Datenschnitt und Reihenfolge: db/105_radar_selbst_zusammenstellen.sql.
const RADAR_ART = { projekt: 'Projekt', board: 'Büro intern' };
const RADAR_FEST_N = 8;   // die festen Bloecke zeigen mehr -- sie sind das Pensum
const RADAR_WAHL_N = 5;

function radarZeile(k) {
  const z = el('div', { class: 'rz', onclick: () => openCard(k.id) });
  const t = el('div', { class: 'rzt' });
  if (k.agent_status === 'wartet_info') t.append(el('span', { class: 'rchip rueck' }, 'Rückfrage'));
  else if (k.zuarbeit) t.append(el('span', { class: 'rchip zu' }, 'Zuarbeit'));
  else if (k.agent_status === 'fertig') t.append(el('span', { class: 'rchip fertig' }, 'Ergebnis da'));
  if (k.neue_kommentare > 0) t.append(el('span', { class: 'rchip komm' },
    k.neue_kommentare === 1 ? 'neuer Kommentar' : k.neue_kommentare + ' neue Kommentare'));
  const f = k.faellig && fmtDatum(k.faellig);
  if (f) t.append(el('span', { class: 'rchip frist' + (f.urgent ? '' : ' ruhig') }, f.txt));
  t.append(k.titel);
  z.append(t);
  z.append(el('div', { class: 'rzm' }, [
    // Im festen Block zaehlt, WOHER die Karte kommt; im Projektblock weiss man das.
    k.herkunft || k.spalte || null,
    k.besitzer ? personName(k.besitzer) : null,
    k.kommentar_von ? 'Kommentar von ' + (k.kommentar_von === 'agent' ? 'Agent' : personName(k.kommentar_von)) : null,
    k.seit_tage > 0 ? 'seit ' + k.seit_tage + (k.seit_tage === 1 ? ' Tag' : ' Tagen') + ' offen' : 'heute angelegt',
  ].filter(Boolean).join(' · ')));
  return z;
}

function radarBlock(b) {
  const box = el('div', { class: 'rbereich' + (b.fest ? ' fest' : '') });
  const kopf = el('div', { class: 'rbh' + (b.fest ? '' : ' klick'),
    title: b.fest ? '' : (b.art === 'projekt' ? 'Zum Projekt wechseln' : 'Zum Board wechseln') });
  if (!b.fest) kopf.addEventListener('click', () => wechsle(
    b.art === 'projekt' ? 'projekt' : 'board',
    b.art === 'projekt' ? b.projekt_id : b.board_id, b.name));
  kopf.append(
    b.art === 'projekt' ? el('span', { class: 'pdot', style: 'background:' + projDot(b.name) }) : '',
    el('span', { class: 'rbt' }, b.name),
    el('span', { class: 'rbart' }, b.fest ? '' : (RADAR_ART[b.art] || '')),
    b.kommentiert ? el('span', { class: 'rbneu', title: b.kommentiert + ' Karte(n) mit neuen Kommentaren' },
      b.kommentiert + ' neu') : '',
    el('span', { class: 'rbn' }, String(b.anzahl)));
  box.append(kopf);
  const karten = b.karten || [];
  const zeilen = el('div', {});
  const mehr = el('button', { class: 'rmehr', onclick: () => zeige(karten.length) });
  const zeige = (n) => {
    zeilen.innerHTML = '';
    for (const k of karten.slice(0, n)) zeilen.append(radarZeile(k));
    const rest = karten.length - n;
    mehr.style.display = rest > 0 ? '' : 'none';
    if (rest > 0) mehr.textContent = rest === 1 ? '… und eine weitere anzeigen' : '… und ' + rest + ' weitere anzeigen';
  };
  box.append(zeilen, mehr);
  zeige(b.fest ? RADAR_FEST_N : RADAR_WAHL_N);
  return box;
}

function renderRadar() {
  const root = document.getElementById('radar-root'); if (!root) return;
  root.innerHTML = '';
  const d = S.radar;
  if (!d) { root.append(el('div', { class: 'rleer' }, 'Lade…')); return; }
  if (d.fehler) { root.append(el('div', { class: 'rleer' }, d.fehler)); return; }
  const kpi = d.kpi || {};
  const bloecke = d.bloecke || [];
  // Springt zur ersten Karte, auf die die Kachel zeigt -- eine Zahl ohne Weg dorthin
  // ist im Board schon einmal untergegangen (Befund 10.08.). Nur die festen Bloecke:
  // die Kennzahlen zaehlen das eigene Pensum, nicht den Projektstand.
  const springe = (pruef) => () => {
    for (const b of bloecke.filter((x) => x.fest)) {
      const k = (b.karten || []).find(pruef); if (k) { openCard(k.id); return; }
    }
  };
  // Kennzahl im Datum-Muster (agentic-os/app/dashboard.css, .kpi): weisse Karte,
  // Label oben, grosse Zahl darunter, Unterzeile fuer den Bezug. Farbe steckt NUR
  // in der Zahl ('warn'/'alert') -- keine farbigen Flaechen, keine Kanten.
  const kachel = (zahl, label, sub, ton, klick) => el('div', {
    class: 'rkpi' + (ton ? ' ' + ton : '') + (klick ? ' klick' : ''),
    onclick: klick || null,
  }, el('div', { class: 'l' }, label),
     el('div', { class: 'z' }, String(zahl)),
     sub ? el('div', { class: 's' }, sub) : '');

  const kopf = el('div', { class: 'rkopf' });
  const kpis = el('div', { class: 'rkpis' });
  const nMeine = (bloecke.find((b) => b.art === 'meine') || {}).anzahl || 0;
  const nZug = (bloecke.find((b) => b.art === 'zugewiesen') || {}).anzahl || 0;
  kpis.append(kachel(kpi.gesamt || 0, 'Für dich offen',
    nMeine + ' aus deinem Bereich · ' + nZug + ' zugewiesen'));
  // Nur zeigen, was es wirklich gibt -- Nullkacheln sagen nichts.
  if (kpi.rueckfragen) kpis.append(kachel(kpi.rueckfragen,
    kpi.rueckfragen === 1 ? 'Rückfrage an dich' : 'Rückfragen an dich',
    'der Agent wartet auf deine Antwort', 'warn',
    springe((k) => k.agent_status === 'wartet_info')));
  if (kpi.zuarbeiten) kpis.append(kachel(kpi.zuarbeiten,
    kpi.zuarbeiten === 1 ? 'Zuarbeit vom Agenten' : 'Zuarbeiten vom Agenten',
    'liegt zur Durchsicht bei dir', 'warn',
    springe((k) => k.zuarbeit)));
  if (kpi.kommentiert) kpis.append(kachel(kpi.kommentiert,
    kpi.kommentiert === 1 ? 'Karte neu kommentiert' : 'Karten neu kommentiert',
    'seit deinem letzten Blick', null,
    springe((k) => k.neue_kommentare > 0)));
  if (kpi.ueberfaellig) kpis.append(kachel(kpi.ueberfaellig,
    kpi.ueberfaellig === 1 ? 'Aufgabe überfällig' : 'Aufgaben überfällig',
    'Frist ist verstrichen', 'alert',
    springe((k) => k.ueberfaellig)));
  kopf.append(kpis);
  kopf.append(el('button', { class: 'rwahlbtn', onclick: () => radarAuswahlDialog() },
    '⊞ Dashboard konfigurieren'));
  root.append(kopf);

  const fest = bloecke.filter((b) => b.fest);
  const gewaehlt = bloecke.filter((b) => !b.fest);
  const gfest = el('div', { class: 'rgrid fest' });
  // Die beiden festen Bloecke stehen auch leer da -- sonst wirkt ein ruhiger Tag
  // wie ein Fehler.
  for (const art of ['meine', 'zugewiesen']) {
    const b = fest.find((x) => x.art === art);
    if (b) { gfest.append(radarBlock(b)); continue; }
    gfest.append(el('div', { class: 'rbereich fest' },
      el('div', { class: 'rbh' },
        el('span', { class: 'rbt' }, art === 'meine' ? 'Meine Aufgaben' : 'Mir zugewiesen'),
        el('span', { class: 'rbn' }, '0')),
      el('div', { class: 'rzleer' }, art === 'meine'
        ? 'Nichts, was dir selbst gehört.'
        : 'Dir hat gerade niemand etwas zugewiesen.')));
  }
  root.append(gfest);

  if (!gewaehlt.length) {
    root.append(el('div', { class: 'rleer' }, el('b', {}, 'Noch nichts dazugestellt.'),
      'Über „Dashboard konfigurieren" wählst du die Projekte und internen Boards, die dich '
      + 'gerade betreffen. Sie erscheinen hier untereinander — und in derselben Reihenfolge '
      + 'oben in der Seitenleiste.'));
    return;
  }
  const grid = el('div', { class: 'rgrid' });
  for (const b of gewaehlt) grid.append(radarBlock(b));
  root.append(grid);
}

// Auswahl: links, was drin ist (in Reihenfolge, verschiebbar), rechts der Rest.
// Gespeichert wird die ganze Liste auf einmal -- die Reihenfolge ist die Aussage.
function radarAuswahlDialog() {
  const d = S.radar; if (!d) return;
  const verf = d.verfuegbar || { projekte: [], boards: [] };
  const alle = [].concat(
    (verf.projekte || []).map((p) => ({ art: 'projekt', id: p.id, name: p.name })),
    (verf.boards || []).map((b) => ({ art: 'board', id: b.id, name: b.name })));
  let wahl = (d.auswahl || []).filter((a) => alle.some((x) => x.art === a.art && x.id === a.id))
    .map((a) => ({ art: a.art, id: a.id, name: a.name }));

  const ov = el('div', { class: 'overlay', onclick: (e) => { if (e.target === ov) ov.remove(); } });
  const box = el('div', { class: 'rausw' });
  const listen = el('div', { class: 'rausw-listen' });
  const drin = el('div', { class: 'rausw-sp' });
  const raus = el('div', { class: 'rausw-sp' });

  const zeichne = () => {
    drin.innerHTML = ''; raus.innerHTML = '';
    drin.append(el('div', { class: 'rausw-h' }, 'In deinem Dashboard'));
    if (!wahl.length) drin.append(el('div', { class: 'rausw-leer' }, 'Noch nichts gewählt.'));
    wahl.forEach((w, i) => {
      drin.append(el('div', { class: 'rausw-z' },
        el('span', { class: 'rausw-n', title: w.name }, w.name),
        el('span', { class: 'rausw-art' }, RADAR_ART[w.art] || ''),
        el('button', { class: 'rausw-b', title: 'Nach oben', disabled: i === 0 ? '' : null,
          onclick: () => { wahl.splice(i - 1, 0, wahl.splice(i, 1)[0]); zeichne(); } }, '▲'),
        el('button', { class: 'rausw-b', title: 'Nach unten', disabled: i === wahl.length - 1 ? '' : null,
          onclick: () => { wahl.splice(i + 1, 0, wahl.splice(i, 1)[0]); zeichne(); } }, '▼'),
        el('button', { class: 'rausw-b weg', title: 'Entfernen',
          onclick: () => { wahl.splice(i, 1); zeichne(); } }, '✕')));
    });
    raus.append(el('div', { class: 'rausw-h' }, 'Dazustellen'));
    const offen = alle.filter((a) => !wahl.some((w) => w.art === a.art && w.id === a.id));
    if (!offen.length) raus.append(el('div', { class: 'rausw-leer' }, 'Alles schon drin.'));
    for (const a of offen) {
      raus.append(el('div', { class: 'rausw-z klick', onclick: () => { wahl.push(a); zeichne(); } },
        el('span', { class: 'rausw-n', title: a.name }, a.name),
        el('span', { class: 'rausw-art' }, RADAR_ART[a.art] || ''),
        el('span', { class: 'rausw-plus' }, '+')));
    }
  };
  zeichne();
  listen.append(drin, raus);

  const fuss = el('div', { class: 'rausw-fuss' },
    el('span', { class: 'rausw-hint' }, 'Die Reihenfolge gilt auch für die Seitenleiste.'),
    el('button', { class: 'rausw-ab', onclick: () => ov.remove() }, 'Abbrechen'),
    el('button', { class: 'rausw-ok', onclick: async () => {
      ov.remove();
      const r = await lotse('radar_auswahl', { ziele: wahl.map((w) => ({ art: w.art, id: w.id })) })
        .catch(() => ({ fehler: 'Netzwerkfehler' }));
      if (r.fehler) { uiHinweis(r.fehler); return; }
      S.liste = await lotse('board_liste');
      renderSidebar(); await ladeBoard();
    } }, 'Übernehmen'));

  box.append(el('div', { class: 'rausw-t' }, 'Dashboard konfigurieren'),
    el('div', { class: 'rausw-s' },
      '„Meine Aufgaben" und „Mir zugewiesen" stehen immer oben. Was du hier dazustellst, '
      + 'zeigt den vollständigen offenen Stand des Bereichs — auch Aufgaben von Kollegen.'),
    listen, fuss);
  ov.append(box);
  document.getElementById('drawer-root').append(ov);
}

// ---------- Sidebar ----------
function renderSidebar() {
  const sb = document.getElementById('sidebar'); sb.innerHTML = '';
  sb.append(el('div', { class: 'brand' },
    el('h1', {}, 'Gutthann HIW Architekten'),
    el('div', { class: 'sub' }, el('span', { class: 'dot' }), 'Digitaler Mitarbeiter aktiv')));
  const li = S.liste; if (!li) return;
  const grp = (label) => { const g = el('div', { class: 'sect' }); g.append(el('div', { class: 'lbl' }, label)); sb.append(g); return g; };

  // Radar zuerst: der Einstieg, nicht ein Board unter vielen.
  const gR = el('div', { class: 'sect' });
  gR.append(el('div', {
    class: 'row' + (S.active?.typ === 'radar' ? ' active' : ''),
    onclick: () => wechsle('radar', null, 'Mein Dashboard'),
  }, '◎ ', 'Mein Dashboard',
    (S.radar?.kpi?.rueckfragen || 0) > 0
      ? el('span', { class: 'badge', title: 'Rückfragen warten auf dich' }, String(S.radar.kpi.rueckfragen))
      : (S.radar?.kpi?.gesamt || 0) > 0
        ? el('span', { class: 'zahl', title: 'Offene Aufgaben, die dir gehören oder dir zugewiesen sind' }, String(S.radar.kpi.gesamt))
        : ''));
  sb.append(gR);

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
  const bGepinnt = new Set((li.pins || []).filter((p) => p.art === 'board').map((p) => p.board_id));
  for (const b of (li.team_boards || []).filter((b) => !bGepinnt.has(b.id))) {
    const aktiv = S.active?.typ === 'board' && S.active.id === b.id;
    g2.append(el('div', {
      class: 'row' + (aktiv ? ' active' : ''),
      onclick: () => wechsle('board', b.id, b.name),
      oncontextmenu: (e) => { e.preventDefault(); boardMenu(e, b, false); },
    }, '▤ ', b.name));
  }
  g2.append(el('div', { class: 'row addrow', onclick: () => neuesBoard('team') }, '+ Neues Board'));

  // Was im Dashboard steht, steht auch hier oben -- in derselben Reihenfolge
  // (Migration 105). Ein Pin ist ein Projekt ODER ein internes Board.
  if ((li.pins || []).length) {
    const g3 = grp('Im Dashboard');
    for (const p of li.pins) {
      const istProjekt = p.art !== 'board';
      const aktiv = istProjekt
        ? (S.active?.typ === 'projekt' && S.active.name === p.name)
        : (S.active?.typ === 'board' && S.active.id === p.board_id);
      g3.append(el('div', { class: 'row' + (aktiv ? ' active' : ''),
        onclick: () => wechsle(istProjekt ? 'projekt' : 'board',
          istProjekt ? p.project_id : p.board_id, p.name) },
        istProjekt ? el('span', { class: 'pdot', style: 'background:' + projDot(p.name) }) : '▤ ',
        p.name,
        el('button', { class: 'pin', title: 'Aus dem Dashboard nehmen', onclick: async (e) => {
          e.stopPropagation();
          const rest = (li.pins || []).filter((x) => x !== p)
            .map((x) => ({ art: x.art === 'board' ? 'board' : 'projekt', id: x.project_id || x.board_id }));
          await lotse('radar_auswahl', { ziele: rest });
          S.liste = await lotse('board_liste'); renderSidebar(); await ladeBoard();
        } }, '✕')));
    }
  }

  // Darunter der Rest -- was oben steht, steht hier nicht noch einmal.
  const g4 = grp('Projekte');
  const gepinnt = new Set((li.pins || []).filter((p) => p.art !== 'board').map((p) => p.name));
  for (const p of S.projects) {
    if (gepinnt.has(p.name)) continue;
    const aktiv = S.active?.typ === 'projekt' && S.active.name === p.name;
    g4.append(el('div', { class: 'row' + (aktiv ? ' active' : ''), onclick: () => wechsle('projekt', p.id, p.name) },
      el('span', { class: 'pdot', style: 'background:' + projDot(p.name) }), p.name,
      el('button', { class: 'pin', title: 'Ins Dashboard aufnehmen', onclick: async (e) => {
        e.stopPropagation();
        await mut('pin', { projekt: p.name, an: true });
        S.liste = await lotse('board_liste'); renderSidebar(); await ladeBoard();
      } }, '⌖')));
  }
}

function boardMenu(e, b, letztes) {
  ctxMenu(e.clientX, e.clientY, [
    { txt: 'Umbenennen', do: async () => { const n = await uiEingabe('Neuer Name:', b.name); if (n?.trim()) { await mut('board_umbenennen',{ board_id: b.id, name: n.trim() }); await ladeAlles(); } } },
    letztes ? { note: 'Letztes Board – nicht löschbar' } :
      { txt: 'Löschen', danger: true, do: async () => { if (await uiFrage(`Board "${b.name}" löschen? Karten wandern ins Default-Board.`)) { const r = await lotse('board_loeschen', { board_id: b.id }); if (r.fehler) uiHinweis(r.fehler); if (S.active?.id === b.id) S.active = null; await ladeAlles(); } } },
  ]);
}
async function neuesBoard(typ) {
  const n = await uiEingabe(typ === 'team' ? 'Name des Team-Boards:' : 'Name des Boards:');
  if (!n?.trim()) return;
  const r = await lotse('board_anlegen', { name: n.trim(), typ });
  if (r.fehler) { uiHinweis(r.fehler); return; }
  S.active = { typ: 'board', id: r.board_id, name: r.name };
  await ladeAlles();
}

// ---------- Glocke ----------
// Der Ereignisstrom aus Migration 113. Das Radar zeigt einen ZUSTAND ("da liegt was
// fuer dich"), die Glocke ein EREIGNIS ("das ist gerade passiert") -- beides braucht
// es, weil eine Zuweisung oder ein Abhaken im Radar nur stillschweigend die Liste
// veraendert und darum niemandem auffaellt.
const MELDE_ICO = { erwaehnung: '@', zuweisung: '\u25CE', kommentar: '\u2709', aenderung: '\u270E' };

async function ladeMeldungen() {
  const r = await lotse('benachrichtigungen', { anzahl: 30 }).catch(() => null);
  // Kennt der Lotse die Aktion noch nicht (aeltere Function-Version), bleibt die
  // Glocke einfach weg, statt eine englische Fehlermeldung zu zeigen.
  if (!r || r.fehler) return;
  S.melde = r;
  renderTopbar();
}

function meldeZeit(iso) {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'gerade eben';
  if (min < 60) return min + ' min';
  if (min < 60 * 24) return Math.round(min / 60) + ' h';
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
}

function meldeZeile(m, panel) {
  const wer = m.von ? (m.von === 'agent' ? 'Agent' : personName(m.von)) : 'automatisch';
  return el('div', { class: 'bmeld' + (m.gelesen ? ' gelesen' : ''), onclick: async () => {
    panel.remove();
    if (!m.gelesen) await lotse('benachrichtigung_gelesen', { ids: [m.id] }).catch(() => {});
    if (m.todo_id) await openCard(m.todo_id); // stempelt die Karte ohnehin als gesehen
    await ladeMeldungen();
  } },
    el('span', { class: 'bico' }, MELDE_ICO[m.art] || '\u2022'),
    el('div', { class: 'btxt' },
      el('div', { class: 'bwas' }, wer + ' · ' + m.text),
      el('div', { class: 'btitel' }, m.titel || 'Karte gelöscht')),
    el('span', { class: 'bzeit' }, meldeZeit(m.am)));
}

function meldePanel(anker) {
  const schon = document.getElementById('bell-panel');
  if (schon) { schon.remove(); return; } // zweiter Klick schliesst wieder
  const p = el('div', { class: 'bellpanel', id: 'bell-panel' });
  const kopf = el('div', { class: 'bkopf' }, el('b', {}, 'Benachrichtigungen'));
  if ((S.melde?.offen || 0) > 0) kopf.append(el('button', { class: 'balle', onclick: async () => {
    await lotse('benachrichtigung_gelesen', {}).catch(() => {});
    await ladeMeldungen();
  } }, 'Alle als gelesen'));
  p.append(kopf);
  const eintraege = S.melde?.eintraege || [];
  if (!eintraege.length) p.append(el('div', { class: 'bleer' },
    'Nichts Neues. Hier landet, wo dich jemand mit @ erwähnt, was dir zugewiesen wird '
    + 'und was auf deinen Karten passiert.'));
  for (const m of eintraege) p.append(meldeZeile(m, p));
  document.body.appendChild(p);
  const r = anker.getBoundingClientRect();
  p.style.top = Math.max(8, Math.min(r.bottom + 8, innerHeight - p.offsetHeight - 8)) + 'px';
  p.style.left = Math.max(8, Math.min(r.right - p.offsetWidth, innerWidth - p.offsetWidth - 8)) + 'px';
  // Wie die Kontextmenues: der naechste Klick irgendwohin schliesst wieder.
  setTimeout(() => addEventListener('click', () => p.remove(), { once: true }));
}

// @-Vorschlag im Kommentarfeld. Erwaehnungen laufen ueber die Kuerzel (adam, gross,
// ...) -- die kennt niemand auswendig, und eine Erwaehnung, die kein Kuerzel trifft,
// benachrichtigt lautlos niemanden.
// Chat-Nachricht als Text-Block. Der Agent formatiert seine Antworten seit 26.08.
// bewusst strukturiert (Listen, Fettes, Zwischenueberschriften) -- ohne diese Umsetzung
// stuenden die Markdown-Zeichen als Rohtext da und die Antwort waere ein Fliesstext-Klotz.
// BEWUSST NUR VIER DINGE, kein Markdown-Parser: Zwischenueberschrift, Aufzaehlung,
// **fett**, Absatz. Alles andere bleibt Text. Escaping laeuft ueber uiEsc, bevor
// irgendetwas als HTML gesetzt wird -- Kommentartext kommt von Menschen UND vom Agenten
// und darf nie als Markup wirken.
function chatText(roh) {
  const box = el('div', { class: 'txt' });
  const zeilen = String(roh ?? '').split('\n');
  let liste = null;
  const fett = (s) => uiEsc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  for (const z of zeilen) {
    const t = z.trim();
    const li = t.match(/^[-*•]\s+(.*)$/);
    if (li) {
      if (!liste) { liste = el('ul', { class: 'txt-liste' }); box.append(liste); }
      const punkt = el('li', {}); punkt.innerHTML = fett(li[1]); liste.append(punkt);
      continue;
    }
    liste = null;
    if (!t) continue;
    const h = t.match(/^#{1,4}\s+(.*)$/);
    if (h) { const e = el('div', { class: 'txt-kopf' }); e.innerHTML = fett(h[1]); box.append(e); continue; }
    const p = el('p', {}); p.innerHTML = fett(t); box.append(p);
  }
  if (!box.childNodes.length) box.textContent = String(roh ?? '');
  return box;
}

function mentionHilfe(inp) {
  let box = null;
  const zu = () => { if (box) { box.remove(); box = null; } };
  const auf = () => {
    const bis = inp.selectionStart ?? inp.value.length;
    const m = inp.value.slice(0, bis).match(/(?:^|[^A-Za-z0-9_@])@([A-Za-z]*)$/);
    zu();
    if (!m) return;
    const treffer = personListe().filter((p) => p.kurz.startsWith(m[1].toLowerCase())).slice(0, 6);
    if (!treffer.length) return;
    box = el('div', { class: 'mention' });
    treffer.forEach((p, i) => box.append(el('button', { class: i === 0 ? 'an' : '',
      // mousedown statt click: sonst nimmt der Fokusverlust die Liste weg, bevor der Klick ankommt.
      onmousedown: (e) => {
        e.preventDefault();
        const vor = inp.value.slice(0, bis - m[1].length);
        inp.value = vor + p.kurz + ' ' + inp.value.slice(bis);
        zu(); inp.focus();
        inp.selectionStart = inp.selectionEnd = vor.length + p.kurz.length + 1;
        // Direktes Setzen von .value loest kein input-Ereignis aus -- ohne das bliebe
        // der Entwurf ungespeichert und die mitwachsende Hoehe stuende auf altem Stand.
        inp.dispatchEvent(new Event('input', { bubbles: true }));
      } }, p.name, el('small', {}, '@' + p.kurz))));
    document.body.appendChild(box);
    const r = inp.getBoundingClientRect();
    box.style.left = Math.max(8, Math.min(r.left, innerWidth - box.offsetWidth - 8)) + 'px';
    box.style.top = Math.max(8, r.top - box.offsetHeight - 6) + 'px';
  };
  inp.addEventListener('input', auf);
  inp.addEventListener('blur', () => setTimeout(zu, 120));
  inp.addEventListener('keydown', (e) => {
    if (!box) return;
    const btns = [...box.querySelectorAll('button')];
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); zu(); }
    else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      box.querySelector('button.an')?.dispatchEvent(new MouseEvent('mousedown', { cancelable: true }));
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      let i = btns.findIndex((b) => b.classList.contains('an'));
      btns[i]?.classList.remove('an');
      i = ((i < 0 ? 0 : i) + (e.key === 'ArrowDown' ? 1 : btns.length - 1)) % btns.length;
      btns[i].classList.add('an');
    }
  });
}

// ---------- Topbar + Board ----------
function renderTopbar() {
  const tb = document.getElementById('topbar'); tb.innerHTML = '';
  if (!S.active) return;
  tb.append(el('h2', {}, S.active.name));
  const scope = S.active.typ === 'radar' ? 'Dein Pensum · dazu die Bereiche, die du dir dazustellst'
    : S.active.typ === 'projekt' ? 'Projekt-Board · für alle gleich'
    : S.board?.ist_team ? 'Team-Board · Büro intern' : 'Privates Board · nur für dich';
  tb.append(el('div', { class: 'scope' }, scope));
  // Im Projekt: Aufgaben und Dashboard sind zwei Ansichten derselben Ebene
  // (Marcels Vorgabe 29.07. -- im Projekt nur DIESES Board, Dashboard daneben).
  if (S.active.typ === 'projekt') {
    const tabs = el('div', { class: 'viewtabs' });
    for (const [key, label] of [['board', 'Aufgaben'], ['kal', 'Kalender'], ['dash', 'Dashboard'], ['termin', 'Terminplanung']]) {
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
    if (r.fehler) { uiHinweis(r.fehler); rufBtn.textContent = alt; rufBtn.disabled = false; }
    else setTimeout(() => { rufBtn.textContent = alt; rufBtn.disabled = false; }, 20000);
  } }, '📞 Ruf mich an');
  tb.append(rufBtn);
  // Glocke direkt neben dem Anruf-Knopf: die eine Stelle, an der alles auflaeuft,
  // was mich betrifft -- unabhaengig davon, welches Board gerade offen ist.
  const offen = S.melde?.offen || 0;
  const bell = el('button', { class: 'bellbtn',
    title: offen ? offen + (offen === 1 ? ' neue Benachrichtigung' : ' neue Benachrichtigungen') : 'Benachrichtigungen',
    onclick: (e) => { e.stopPropagation(); meldePanel(bell); } },
    '\u{1F514}', offen ? el('span', { class: 'cnt' }, offen > 99 ? '99+' : String(offen)) : '');
  tb.append(bell);
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
  // Immer sichtbar (auch leer), sonst findet niemand das Feature (Marcels Befund 10.08.);
  // rechts steht das Team, damit die Personen im Projekt greifbar sind.
  const ia = S.board?.in_arbeit || [];
  if (S.active.typ === 'projekt' && S.ansicht === 'board') {
    const z = el('div', { class: 'inarbeit' }, 'Gerade in Arbeit:');
    let n = 0;
    for (const p2 of ia.slice(0, 5)) {
      const t0 = (p2.themen || [])[0];
      if (!t0) continue;
      n++;
      z.append(el('span', { class: 'who', title: (p2.themen || []).map((x) => x.titel).slice(0, 5).join(' · ') },
        el('span', { class: 'av', style: 'background:' + avColor(p2.person) }, initialen(p2.name)),
        String(p2.name).split(' ')[0] + ' · ' + t0.titel.slice(0, 36)));
    }
    if (!n) z.append(el('span', { style: 'color:#8A8A83' }, 'noch niemand — Karten mit Besitzer oder Zuweisung erscheinen hier automatisch'));
    const team = personListe();
    if (team.length) {
      const avs = el('span', { style: 'display:flex' });
      for (const p3 of team.slice(0, 9)) avs.append(el('span', {
        class: 'av', style: 'background:' + avColor(p3.kurz) + ';margin-left:-4px;border:1.5px solid #F3F3F1', title: p3.name,
      }, initialen(p3.name)));
      z.append(el('span', { style: 'margin-left:auto;display:flex;align-items:center;gap:6px;color:#8A8A83' }, 'Team', avs));
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
    // Reihenfolge (Marcels Befund 25.08.): aelteste oben, neu Angelegtes unten — die
    // Karte bleibt dort stehen, wo sie angelegt wurde, statt nach oben zu springen.
    // Nur die Erledigt-Spalte bleibt neueste zuerst; dort ist das Letzte das Interessante.
    inSpalte.sort((x, y) => (sp.ist_erledigt ? -1 : 1) * String(x.erstellt || '').localeCompare(String(y.erstellt || '')));
    const cntEl = el('span', { class: 'cnt' }, String(inSpalte.length));
    const colEl = el('div', {
      class: 'col',
      // Nur Karten annehmen — eine hierher gezogene Datei gehoert ins Karten-Detail.
      ondragover: (e) => { if (!S.drag) return; e.preventDefault(); colEl.classList.add('dragover'); },
      ondragleave: () => colEl.classList.remove('dragover'),
      ondrop: (e) => {
        e.preventDefault(); colEl.classList.remove('dragover');
        if (!S.drag) return;
        const id = S.drag; S.drag = null;
        verschiebeKarte(id, sp); // bewusst ohne await: die Karte rutscht sofort hinueber
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
      cntEl,
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
        onkeydown: (e) => {
          if (e.key === 'Escape') { S.newCardCol = null; S.newCardText = ''; renderBoard(); ladeBoard(); }
          if (e.key === 'Enter' && inp.value.trim()) {
            // Die Karte steht sofort unten in DIESER Spalte, der Server faehrt hinterher.
            // Die Zeile bleibt offen — mehrere Aufgaben lassen sich am Stueck tippen.
            const titel = inp.value.trim();
            inp.value = ''; S.newCardText = '';
            legeKarteAn(titel, sp, cardsEl, cntEl, inp);
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
    const n = await uiEingabe('Name der Spalte:'); if (!n?.trim()) return;
    const r = await lotse('spalte_anlegen', S.active.typ === 'projekt'
      ? { name: n.trim(), projekt: S.active.name } : { name: n.trim(), board_id: S.active.id });
    if (r.fehler) uiHinweis(r.fehler);
    await ladeBoard();
  } }, '+ Spalte'));
}

// ---------- Bewegung ohne Wartezeit (Marcels Befund 25.08.) ----------
// Bisher wartete jede Karte auf den Server, bevor sie sich bewegte — das fuehlte sich
// zaeh und abgehackt an. Jetzt aendert sich das Bild sofort, der Server faehrt hinterher.
// Dafuer merken wir uns vor dem Neu-Aufbau, wo jede Karte lag (FLIP): danach starten
// die Karten optisch an ihrem alten Platz und gleiten an den neuen.
function kartenPositionen() {
  const m = new Map();
  for (const c of document.querySelectorAll('#board .card[data-id]')) m.set(c.dataset.id, c.getBoundingClientRect());
  return m;
}
function kartenGleiten(vorher, gewandert) {
  if (!vorher || !vorher.size) return;
  for (const c of document.querySelectorAll('#board .card[data-id]')) {
    const alt = vorher.get(c.dataset.id); if (!alt) continue;
    const neu = c.getBoundingClientRect();
    const dx = alt.left - neu.left, dy = alt.top - neu.top;
    if (!dx && !dy) continue;
    if (c.dataset.id === gewandert) {
      // Spaltenwechsel: die Spalten scrollen fuer sich, eine wandernde Karte wuerde an
      // ihrem Rand abgeschnitten. Deshalb fliegt eine freie Kopie ueber das Board; die
      // echte Karte wird erst sichtbar, wenn die Kopie angekommen ist.
      const kopie = c.cloneNode(true);
      kopie.classList.add('fliegt');
      kopie.style.cssText += `;position:fixed;margin:0;left:${alt.left}px;top:${alt.top}px;width:${alt.width}px;z-index:70;pointer-events:none;transition:transform .26s cubic-bezier(.2,.75,.3,1)`;
      document.body.append(kopie);
      c.style.visibility = 'hidden';
      requestAnimationFrame(() => { kopie.style.transform = `translate(${-dx}px,${-dy}px)`; });
      setTimeout(() => { kopie.remove(); c.style.visibility = ''; }, 290);
    } else {
      c.style.transition = 'none';
      c.style.transform = `translate(${dx}px,${dy}px)`;
      requestAnimationFrame(() => {
        c.style.transition = 'transform .26s cubic-bezier(.2,.75,.3,1)';
        c.style.transform = '';
        setTimeout(() => { c.style.transition = ''; }, 320);
      });
    }
  }
}
// Karte in eine andere Spalte legen: sofort sichtbar, Server danach. Geht es schief,
// springt die Karte zurueck und sagt warum.
async function verschiebeKarte(id, sp) {
  const t = (S.board?.todos || []).find((x) => x.id === id);
  if (!t || t.spalte_id === sp.id) return;
  const altSpalte = t.spalte_id, altStatus = t.status;
  const vorher = kartenPositionen();
  t.spalte_id = sp.id;
  // Der Server setzt beim Verschieben auch den Status (Migration 78) — lokal genauso,
  // sonst stuende die Karte fuer einen Moment in der falschen Spalte.
  t.status = sp.ist_erledigt ? 'erledigt' : 'offen';
  renderBoard();
  kartenGleiten(vorher, id);
  const r = await mut('todo_verschieben', { todo_id: id, spalte_id: sp.id });
  if (r && r.fehler) { t.spalte_id = altSpalte; t.status = altStatus; renderBoard(); return; }
  // Nachladen erst, wenn die Bewegung durch ist — sonst zuckt das Board mittendrin.
  setTimeout(() => { if (!S.newCardCol && !S.detail && !S.drag) ladeBoard(); }, 320);
}
// Karte anlegen: sie steht sofort unten in ihrer Spalte, mit halber Deckkraft, bis der
// Server sie bestaetigt hat. Kein Neu-Aufbau des Boards — die Eingabezeile behaelt den
// Fokus, sodass sich mehrere Aufgaben am Stueck tippen lassen.
async function legeKarteAn(titel, sp, cardsEl, cntEl, inp) {
  const tmp = {
    id: 'neu-' + Math.random().toString(36).slice(2), titel, status: 'offen', spalte_id: sp.id,
    erstellt: new Date().toISOString().slice(0, 19), zugewiesen: [],
  };
  if (!S.board.todos) S.board.todos = [];
  S.board.todos.push(tmp);
  const knoten = renderCard(tmp);
  knoten.classList.add('pending');
  cardsEl.append(knoten);
  if (cntEl) cntEl.textContent = String(Number(cntEl.textContent || 0) + 1);
  knoten.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  const misslungen = (grund) => {
    knoten.remove();
    S.board.todos = (S.board.todos || []).filter((x) => x !== tmp);
    if (cntEl) cntEl.textContent = String(Math.max(0, Number(cntEl.textContent || 1) - 1));
    if (inp && !inp.value) { inp.value = titel; S.newCardText = titel; inp.focus(); }
    uiHinweis('Nicht gespeichert: ' + grund + ' — der Text steht wieder in der Zeile, bitte nochmal Enter.');
  };
  let r;
  try { r = await lotse('todo_create', { titel, projekt: S.active.typ === 'projekt' ? S.active.name : null }); }
  catch (err) { r = { fehler: err.message }; }
  if (!r || !r.todo_id) { misslungen((r && (r.fehler || r.error)) || 'keine Antwort vom Server'); return; }
  tmp.id = r.todo_id; knoten.dataset.id = r.todo_id; knoten.classList.remove('pending');
  // mut wirft nie — schlaegt das Einsortieren fehl, existiert die Karte trotzdem (Spalte 1).
  if (!sp.ist_erledigt) await mut('todo_verschieben', { todo_id: r.todo_id, spalte_id: sp.id });
}

function spaltenMenu(e, sp, nSpalten) {
  const items = [];
  items.push({ txt: 'Umbenennen', do: async () => {
    const n = await uiEingabe('Neuer Spaltenname:', sp.name);
    if (n?.trim() && n.trim() !== sp.name) {
      const r = await lotse('spalte_umbenennen', { spalte_id: sp.id, name: n.trim() });
      if (r.fehler) uiHinweis(r.fehler);
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
  if (!sp.ist_erledigt && nSpalten > 1) items.push({ txt: 'Löschen – Karten wandern in erste Spalte', danger: true, do: async () => { const r = await lotse('spalte_loeschen', { spalte_id: sp.id }); if (r.fehler) uiHinweis(r.fehler); await ladeBoard(); } });
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
    if (!ta.value.trim()) { uiHinweis('Bitte einen Auftrag eingeben — oder „Automatik entfernen".'); return; }
    const quellen = QU.map(([k]) => k).filter((k) => checks[k].checked);
    const r = await lotse('spalte_automatik', { spalte_id: sp.id, auftrag: ta.value.trim(), quellen, ziel_spalte_id: sel.value || null });
    if (r.fehler) { uiHinweis(r.fehler); return; }
    zu(); await ladeBoard();
  } }, 'Speichern'));
  if (a.auftrag) row.append(el('button', { class: 'btn warn', onclick: async () => {
    const r = await lotse('spalte_automatik', { spalte_id: sp.id, auftrag: null });
    if (r.fehler) { uiHinweis(r.fehler); return; }
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
      if (r.fehler) { uiHinweis(r.fehler); return; }
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
    if (!await uiFrage(`Karte "${t.titel}" endgültig löschen? Unterpunkte, Kommentare und Dateien gehen mit verloren.`)) return;
    await mut('todo_loeschen', { todo_id: t.id }); await ladeBoard();
  } });
  ctxMenu(x, y, items);
}
function projektMenu(x, y, todoId, danach) {
  const fertig = danach || (async () => { await ladeBoard(); });
  if (!S.projects.length) { uiHinweis('Keine aktiven Projekte gefunden.'); return; }
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
    'data-id': t.id,
    ondragstart: (e) => {
      S.drag = t.id;
      if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
      // Erst im naechsten Bild blass werden — sonst nimmt der Browser die halb
      // durchsichtige Karte als Ziehbild und am Mauszeiger haengt fast nichts mehr.
      requestAnimationFrame(() => c.classList.add('dragging'));
    },
    // Ohne dragend blieb S.drag nach einem abgebrochenen Drag (Esc, daneben fallen
    // gelassen) haengen — und der 60s-Auto-Refresh war fuer den Rest der Sitzung tot.
    ondragend: () => { S.drag = null; c.classList.remove('dragging'); },
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
  // Poool-Klammer: die Karte ist zugleich ein Ticket im CRM und laeuft synchron.
  if (t.poool_ticket_id) meta.append(el('span', {
    class: 'pchip', title: 'Läuft synchron mit Poool-Ticket ' + (t.poool_nr || t.poool_ticket_id)
  }, 'Poool ' + (t.poool_nr || '#' + t.poool_ticket_id)));
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
  // Frisch angelegte Karten tragen bis zur Antwort des Servers eine Platzhalter-Kennung.
  if (!id || String(id).startsWith('neu-')) return;
  if (S.detail?.id !== id) { S.komEntwurf = ''; if (S.zuruf?.todoId !== id) S.zuruf = null; } // Entwurf und Anzeige gehoeren zu IHRER Karte
  try {
    S.detail = await lotse('todo_detail', { todo_id: id });
    renderDrawer();
    chatTakt(id);
  } catch (e) { console.error('openCard:', e); }
}

// Waehrend der Agent an der offenen Karte arbeitet, laeuft ein schneller Takt nur fuer
// diesen Kartenschnitt. Noetig, weil der 60s-Poll des Boards pausiert, solange ein Drawer
// offen ist (sonst raeumt er Eingaben weg) -- ohne den Takt sieht man die Antwort erst,
// wenn man die Karte schliesst und wieder oeffnet. Genau das nimmt dem Zuruf das
// Chat-Gefuehl. Neu gezeichnet wird nur, wenn sich wirklich etwas geaendert hat.
function kartenFinger(d) {
  return [d?.agent_status || '', (d?.kommentare || []).length, (d?.unterpunkte || []).length,
    (d?.anhaenge || []).length, (d?.kommentare || []).at(-1)?.text?.length || 0].join('|');
}
function chatTakt(id) {
  clearInterval(S.chatPoll); S.chatPoll = null;
  // Auch takten, solange nur die Bestaetigung steht: agent_status setzt erst der Server,
  // wenn er den Auftrag eingereiht hat -- bis dahin waere die Anzeige sonst eingefroren.
  if (statusVon(S.detail) !== 'arbeitet' && !(S.zuruf && S.zuruf.todoId === id)) return;
  const bis = Date.now() + 5 * 60000; // Notbremse: kein Dauertakt, wenn ein Lauf haengt
  S.chatPoll = setInterval(async () => {
    if (!S.detail || S.detail.id !== id || Date.now() > bis) { clearInterval(S.chatPoll); S.chatPoll = null; return; }
    let neu;
    try { neu = await lotse('todo_detail', { todo_id: id }); } catch { return; }
    if (!neu || neu.fehler || !S.detail || S.detail.id !== id) return;
    const anders = kartenFinger(neu) !== kartenFinger(S.detail);
    const fertig = statusVon(neu) !== 'arbeitet';
    // Antwort da (oder Rueckfrage gestellt) -> Bestaetigung verschwindet.
    const letzter = (neu.kommentare || []).at(-1);
    if (S.zuruf && S.zuruf.todoId === id
        && ((letzter && letzter.von === 'agent'
             && (neu.kommentare || []).length > (S.detail.kommentare || []).length)
            || Date.now() - S.zuruf.seit > 5 * 60000)) S.zuruf = null;
    S.detail = neu;
    if (anders) {
      // Wer gerade tippt, darf durch das Neuzeichnen weder Text noch Cursor verlieren.
      const warFokus = document.activeElement?.id === 'kom-inp';
      renderDrawer();
      if (warFokus) {
        const n = document.getElementById('kom-inp');
        if (n) { n.focus(); n.selectionStart = n.selectionEnd = n.value.length; }
      }
    }
    if (fertig && !S.zuruf) {
      clearInterval(S.chatPoll); S.chatPoll = null;
      ladeBoard().catch(() => {}); // Karte traegt jetzt "Ergebnis da" -- Board nachziehen
    }
  }, 2500);
}
function closeDrawer() { clearInterval(S.chatPoll); S.chatPoll = null; S.detail = null; S.komEntwurf = ''; S.zuruf = null; document.getElementById('drawer-root').innerHTML = ''; }

function renderDrawer() {
  const root = document.getElementById('drawer-root');
  // Jeder Re-Render (Senden, Chat-Takt, Board-Poll) baute die Karte komplett neu auf und
  // riss beide Spalten auf Scroll-Position 0 zurueck -- Marcels Befund: "nach jeder
  // Nachricht ganz nach oben geschickt". Fix: Positionen VOR dem Wegwerfen sichern, nach
  // dem Neuaufbau wiederherstellen. Die Aufgaben-Spalte bekommt exakt ihre alte Position
  // zurueck; die Chat-Spalte bleibt unten, wenn sie schon unten war (oder beim ersten
  // Oeffnen) -- so sieht man die eigene gerade gesendete Nachricht bzw. die Antwort, ohne
  // beim Lesen aelterer Nachrichten weggerissen zu werden.
  const altDinfo = root.querySelector('.dinfo');
  const altChat = root.querySelector('.dchat-verlauf');
  const dinfoScroll = altDinfo ? altDinfo.scrollTop : null;
  const chatWarUnten = !altChat || (altChat.scrollHeight - altChat.scrollTop - altChat.clientHeight < 48);
  const chatScroll = altChat ? altChat.scrollTop : null;
  root.innerHTML = '';
  const d = S.detail; if (!d || d.fehler) { if (d?.fehler) uiHinweis(d.fehler); return; }
  const st = statusVon(d); const chip = st && CHIPS[st];
  const ov = el('div', { class: 'overlay', onclick: (e) => { if (e.target === ov) closeDrawer(); } });
  const dr = el('div', {
    class: 'drawer dropzone',
    // Dateien lassen sich irgendwo auf das Blatt fallen — nicht nur auf die Ablage unten.
    ondragover: (e) => { if (!e.dataTransfer || !Array.from(e.dataTransfer.types || []).includes('Files')) return; e.preventDefault(); dr.classList.add('filedrag'); },
    ondragleave: (e) => { if (!dr.contains(e.relatedTarget)) dr.classList.remove('filedrag'); },
    ondrop: (e) => {
      if (!e.dataTransfer || !e.dataTransfer.files.length) return;
      e.preventDefault(); e.stopPropagation(); dr.classList.remove('filedrag');
      ladeDateienHoch(e.dataTransfer.files, d.id);
    },
  });
  // Redesign 26.08. (Feedback-Meeting): der Kopf spannt oben ueber beide Spalten,
  // darunter links der Chat (dchat -- primaerer Umgang mit dem Agenten), rechts die
  // Aufgabe wie gehabt (dinfo -- eigenstaendig scrollend). Jede bisherige Sektion
  // behaelt ihre Logik unveraendert, wandert nur von dr.append(...) auf dinfo.append(...).
  const dkopf = el('div', { class: 'drawer-kopf' }); // eigene Klasse -- '.dkopf' ist anderswo (Dashboard) schon vergeben
  const dbody = el('div', { class: 'dbody' });
  const dchat = el('div', { class: 'dchat' });
  const dinfo = el('div', { class: 'dinfo' });

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
      const t2 = await uiEingabe('Titel bearbeiten:', d.titel);
      if (t2 !== null && t2.trim() && t2.trim() !== d.titel) { await mut('todo_update', { todo_id: d.id, titel: t2.trim() }); await openCard(d.id); await ladeBoard(); }
    } }, '✎'));
  head.append(chipRow, titelZeile);
  const meta = el('div', { class: 'meta' });
  // Projekt: klickbar — zuweisen, aendern, entfernen (Migration 78).
  meta.append(el('button', { class: 'metabtn', title: 'Projekt zuweisen oder ändern', onclick: (e) => {
    if (S.board?.ist_team) { uiHinweis('Karte liegt auf einem Team-Board — Projekt-Zuordnung dort nicht möglich.'); return; }
    const x = e.clientX, y = e.clientY;
    const danach = async () => { await openCard(d.id); await ladeBoard(); };
    const items = S.projects.map((p) => ({ txt: p.name, do: async () => { await mut('todo_projekt', { todo_id: d.id, projekt: p.name }); await danach(); } }));
    if (d.projekt) items.push({ txt: 'Projekt entfernen', danger: true, do: async () => { await mut('todo_projekt', { todo_id: d.id, projekt: null }); await danach(); } });
    if (!items.length) { uiHinweis('Keine aktiven Projekte gefunden.'); return; }
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
  head.append(meta); dkopf.append(head);

  // Zielbild-Pflicht (Loop B2): bei Zuarbeitskarten steht das WOFUER vor der Bitte.
  if (d.zuarbeit && d.zielbild) {
    const sec = el('div', { class: 'dsec' });
    sec.append(el('div', { class: 'slbl' }, 'Wofür der Agent das braucht'));
    sec.append(el('div', { class: 'zielbild' }, d.zielbild));
    dinfo.append(sec);
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
    sec.append(kopf, inhalt); dinfo.append(sec);
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
    dinfo.append(sec);
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
        if (r.fehler) uiHinweis(r.fehler);
      }
    };
    const rowB = el('div', { style: 'display:flex;gap:9px;margin-top:10px;flex-wrap:wrap' });
    rowB.append(el('button', { class: 'btn warn', onclick: async () => {
      await speichereEntwuerfe();
      const r = await lotse('rueckfragen_absenden', { todo_id: d.id });
      if (r.fehler) uiHinweis(r.fehler);
      await openCard(d.id); await ladeBoard();
    } }, 'Losschicken – Agent arbeitet weiter'));
    rowB.append(el('button', { class: 'btn ghost', onclick: async () => {
      await speichereEntwuerfe();
      await openCard(d.id); await ladeBoard();
    } }, 'Zwischenspeichern'));
    sec.append(rowB);
    sec.append(el('div', { style: 'font-size:11.5px;color:#8A5606;margin-top:8px' }, 'Zwischengespeichert = der Agent wartet noch. Häng unten in Ruhe Dateien an – er bekommt sie beim Weiterarbeiten mit. Erst „Losschicken" lässt ihn weitermachen.'));
    dinfo.append(sec);
  }
  if (beantwortete.length) {
    const sec = el('div', { class: 'dsec' });
    sec.append(el('div', { class: 'slbl' }, 'Beantwortete Rückfragen'));
    for (const f of beantwortete) sec.append(
      el('div', { style: 'font-size:12.5px;color:#75756E;margin-bottom:2px' }, f.frage),
      el('div', { style: 'font-size:13px;margin-bottom:8px' }, '→ ' + (f.antwort || 'übersprungen')));
    dinfo.append(sec);
  }

  // Ergebnis
  if (d.agent_ergebnis && (st === 'fertig' || st === 'fehlgeschlagen' || !st)) {
    const sec = el('div', { class: 'dsec' });
    sec.append(el('div', { class: 'slbl' }, 'Ergebnis'));
    sec.append(el('div', { class: 'pre' }, d.agent_ergebnis));
    const m = d.agent_ergebnis.match(/Datei abgelegt:\s*([^\n—]+)/);
    if (m) sec.append(el('button', { class: 'btn ghost', style: 'margin-top:10px', onclick: () => { navigator.clipboard.writeText(m[1].trim()); } }, 'Datei-Pfad kopieren'));
    dinfo.append(sec);
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
  addU.append(uInp); su.append(addU); dinfo.append(su);

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
  } }, '+ Person')); dinfo.append(sp2);

  // Anhaenge — Bild und PDF zeigen sich als Vorschau, statt erst nach dem Herunterladen
  // (Marcel, 25.08.). Ablegen geht per Drag&Drop auf das ganze Blatt.
  const sa = el('div', { class: 'dsec' });
  sa.append(el('div', { class: 'slbl' }, 'Dateien'));
  const vorschaubar = d.anhaenge.filter((a) => istBild(a.name) || istPdf(a.name));
  if (vorschaubar.length) {
    const grid = el('div', { class: 'anhgrid' });
    for (const a of vorschaubar) grid.append(anhangKachel(a));
    sa.append(grid);
  }
  for (const a of d.anhaenge) sa.append(el('div', { class: 'sub' },
    el('a', { href: '#', style: 'color:#1C1C1A;font-weight:500', onclick: async (e) => {
      e.preventDefault();
      if (istBild(a.name) || istPdf(a.name)) anhangGross(a); else await downloadAnhang(a);
    } }, (istBild(a.name) ? '🖼 ' : istPdf(a.name) ? '📄 ' : '📎 ') + a.name),
    el('span', { style: 'color:#9A9A93;font-size:11.5px' }, a.groesse ? Math.round(a.groesse / 1024) + ' KB' : ''),
    el('button', { class: 'del', onclick: async () => { await mut('anhang_loeschen',{ anhang_id: a.id }); await openCard(d.id); } }, '✕')));
  const fileInp = el('input', { type: 'file', multiple: '', style: 'display:none',
    onchange: (e) => { const dateien = e.target.files; e.target.value = ''; ladeDateienHoch(dateien, d.id); } });
  sa.append(fileInp,
    el('div', { class: 'ablage', onclick: () => fileInp.click() }, 'Dateien hierher ziehen oder klicken zum Auswählen'),
    el('div', { id: 'anh-status', style: 'font-size:11.5px;color:#75756E;margin-top:6px' }));
  dinfo.append(sa);

  // Kommentare -- der Chat. Eigene, feste linke Spalte (Redesign 26.08.): der Kopf
  // der Spalte traegt die Ueberschrift, darum entfaellt das fruehere Inline-Label.
  const sk = el('div', { class: 'dchat-verlauf' });
  if (!d.kommentare.length) sk.append(el('div', { class: 'dchat-leer' },
    'Schreib hier mit dem Team, oder ruf @agent — er kennt Titel, Notiz, Unterpunkte, Dateien und den ganzen Verlauf dieser Karte.'));
  for (const k of d.kommentare) {
    const zeit = (iso) => new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    const kopf = el('div', { class: 'von' }, `${k.von} · ${zeit(k.am)}` + (k.bearbeitet ? ` · bearbeitet ${zeit(k.bearbeitet)}` : ''));
    // Eigene Kommentare korrigieren und wegnehmen. Stift und Kreuz stehen wie das ✕ an
    // den Unterpunkten am Zeilenende und erscheinen erst beim Hovern (Marcel, 25.08.).
    // Sie tragen ein title, damit die Bedeutung nicht am Symbol allein haengt.
    if (k.meiner) {
      kopf.append(el('button', { class: 'edit', title: 'Kommentar bearbeiten', onclick: async () => {
        const neu = await uiEingabe('Kommentar bearbeiten:', k.text, { mehrzeilig: true });
        if (neu === null || !neu.trim() || neu.trim() === k.text) return;
        const r = await mut('kommentar_bearbeiten', { kommentar_id: k.id, text: neu.trim() });
        if (r && r.ok) await openCard(d.id);
      } }, '✎'));
      kopf.append(el('button', { class: 'del', title: 'Kommentar löschen', onclick: async () => {
        if (!await uiFrage('Diesen Kommentar löschen?')) return;
        const r = await mut('kommentar_loeschen', { kommentar_id: k.id });
        if (r && r.ok) { await openCard(d.id); await ladeBoard(); }
      } }, '✕'));
    }
    // Eigene Nachrichten rechtsbuendig, alle anderen (Kollegen wie Agent) linksbuendig --
    // das gibt dem Chat sein Richtungsgefuehl. k.meiner traegt die App schon lange.
    const komKlasse = 'kom' + (k.von === 'agent' ? ' kom-agent' : '') + (k.meiner ? ' kom-mine' : '');
    const komZeile = el('div', { class: komKlasse }, kopf, chatText(k.text));
    // Vorschlag mit Klick-Bestaetigung (Migration 115/116): eine Frist AENDERT eine
    // bestehende Eigenschaft der Karte, darum wirkt sie nie sofort -- der Agent
    // schlaegt vor, ein Mensch entscheidet mit einem Klick. Einmal entschieden bleibt
    // die Zeile stehen (ausgegraut), damit der Verlauf nachvollziehbar bleibt.
    // Beschriftung je Vorschlagsart -- neue Arten (Migration 117: 'folgekarte') brauchen
    // hier nur eine weitere Zeile, nicht noch einen Block wie oben.
    const vorschlagTxt = k.vorschlag_art === 'frist' && k.vorschlag?.datum
      ? '📅 Frist ' + new Date(k.vorschlag.datum + 'T00:00:00').toLocaleDateString('de-DE')
      : k.vorschlag_art === 'folgekarte' && k.vorschlag?.titel
        ? '➕ Folgekarte „' + k.vorschlag.titel + '“'
        : null;
    if (vorschlagTxt) {
      if (!k.vorschlag_status) {
        const zeile = el('div', { class: 'vorschlagzeile' },
          el('span', {}, vorschlagTxt + ' übernehmen?'));
        const entscheiden = async (annehmen) => {
          zeile.querySelectorAll('button').forEach((b) => { b.disabled = true; });
          const r = await mut('vorschlag_entscheiden', { kommentar_id: k.id, annehmen });
          if (r && r.ok) { await openCard(d.id); await ladeBoard(); }
          else zeile.querySelectorAll('button').forEach((b) => { b.disabled = false; });
        };
        zeile.append(
          el('button', { class: 'btn', style: 'padding:3px 11px;font-size:12px', onclick: () => entscheiden(true) }, 'Übernehmen'),
          el('button', { class: 'btn ghost', style: 'padding:3px 11px;font-size:12px', onclick: () => entscheiden(false) }, 'Ablehnen'));
        komZeile.append(zeile);
      } else {
        komZeile.append(el('div', { class: 'vorschlagzeile entschieden' },
          el('span', {}, vorschlagTxt + ' — ' + (k.vorschlag_status === 'angenommen' ? 'übernommen ✓' : 'abgelehnt'))));
      }
    }
    sk.append(komZeile);
  }
  // Empfangsbestaetigung. Anforderung von Marcel: wenn ich den Agenten anschreibe,
  // muss DIREKT etwas kommen, damit ich weiss, dass er was macht. Die Zeile steht
  // sofort beim Absenden da -- also bevor der Server geantwortet hat -- und benennt
  // danach den echten Stand. Bewusst KEIN gespeicherter Kommentar: ein "bin dran"
  // in jedem Strang waere nach einer Woche nur noch Muell in der Historie.
  const zurufOffen = S.zuruf && S.zuruf.todoId === d.id;
  if (zurufOffen || statusVon(d) === 'arbeitet') {
    const wartet = Math.round((Date.now() - (S.zuruf?.seit || Date.now())) / 1000);
    // "arbeitet" statt "schreibt" (Marcel, 26.08.): der Agent liest und sucht die meiste
    // Zeit -- geschrieben wird erst ganz am Ende. "schreibt" verspricht eine Antwort in
    // der naechsten Sekunde und laesst 40s Wartezeit wie einen Fehler aussehen.
    const was = d.agent_status === 'laeuft' ? 'arbeitet…'
      : d.agent_status === 'wartet_info' ? 'hat eine Rückfrage an dich — siehe oben'
      : d.agent_status === 'wartet' ? 'hat den Auftrag angenommen und fängt gleich an'
      : wartet > 25 ? 'nimmt den Auftrag an — dauert heute länger als sonst'
      : 'hat deinen Zuruf bekommen';
    sk.append(el('div', { class: 'agenttippt' },
      el('span', { class: 'punkte' }, '•••'),
      el('span', {}, 'Agent ' + was),
      wartet > 3 ? el('small', { style: 'color:#9A9A93' }, ' ' + wartet + ' Sek.') : ''));
  }
  const addK = el('div', { class: 'dchat-eingabe' });
  const senden = async () => {
    const txt = kInp.value.trim(); if (!txt) return;
    kInp.value = ''; S.komEntwurf = '';
    kInp.style.height = 'auto';   // mitgewachsenes Feld wieder auf eine Zeile
    // Erst die Bestaetigung zeichnen, dann zum Server: ein Zuruf darf sich nie
    // anfuehlen, als waere er ins Leere gegangen.
    if (/@agent\b/i.test(txt)) { S.zuruf = { todoId: d.id, seit: Date.now() }; renderDrawer(); }
    await mut('kommentar_anlegen', { todo_id: d.id, text: txt });
    await openCard(d.id); await ladeBoard();
  };
  // Mehrzeiliges Eingabefeld, das mitwaechst (Marcel, 26.08.: "passt sich nicht der
  // Masse an Text an, ich muss mit der Pfeiltaste durchzippen"). Aufgebaut wie das
  // Claude-Chatfenster: Enter sendet, Shift+Enter macht einen Absatz, die Hoehe folgt
  // dem Text bis zu einer Deckelung -- danach scrollt das Feld selbst, statt den
  // halben Chat zu verdraengen.
  const kInp = el('textarea', { id: 'kom-inp', rows: '1',
    placeholder: 'Nachricht…  @ erwähnt jemanden, @agent fragt den Agenten',
    oninput: () => { S.komEntwurf = kInp.value; hoeheAnpassen(); },
    onkeydown: (e) => {
      // Waehrend die @-Vorschlagsliste offen ist, gehoert Enter der Auswahl.
      if (e.key === 'Enter' && !e.shiftKey && !document.querySelector('.mention')) { e.preventDefault(); senden(); }
    } });
  const hoeheAnpassen = () => {
    kInp.style.height = 'auto';                       // erst zurueck, sonst waechst es nur
    kInp.style.height = Math.min(kInp.scrollHeight, 180) + 'px';
  };
  kInp.value = S.komEntwurf || '';
  mentionHilfe(kInp);
  addK.append(kInp, el('button', { class: 'btn', title: 'Senden (Enter) · Shift+Enter macht einen Absatz', onclick: senden }, 'Senden'));
  // Nach dem Einhaengen messen: vorher ist scrollHeight 0.
  setTimeout(hoeheAnpassen);
  dchat.append(el('div', { class: 'dchat-kopf' }, 'Chat',
    el('span', { class: 'dchat-hinweis' }, '@agent fragt den Agenten')), sk, addK);

  // Verlauf
  if ((d.verlauf || []).length) {
    const sv = el('div', { class: 'dsec' });
    sv.append(el('div', { class: 'slbl' }, 'Verlauf'));
    const WAS = { erstellt: 'Erstellt', rueckfragen: 'Rückfragen', gemeldet: 'Per Anruf gemeldet', erledigt: 'Erledigt' };
    for (const v of d.verlauf) sv.append(el('div', { class: 'vrow' },
      el('span', {}, new Date(v.am).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })),
      el('span', {}, (WAS[v.was] || v.was) + (v.detail ? ' — ' + v.detail : ''))));
    dinfo.append(sv);
  }

  // Aktionen
  const sf = el('div', { class: 'dsec', style: 'display:flex;gap:9px;border-bottom:none' });
  if (d.status === 'offen') {
    sf.append(el('button', { class: 'btn lime', onclick: async () => {
      const kom = await uiEingabe('Kommentar zum Abschluss (fließt ins Agenten-Gedächtnis):', '');
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
      const grund = await uiEingabe('Warum ist das gerade nicht relevant? (fließt ins Agenten-Gedächtnis — er schlägt so etwas dann nicht mehr vor)');
      if (grund === null || !grund.trim()) return;
      await mut('todo_complete', { todo_id: d.id, kommentar: 'NICHT RELEVANT: ' + grund.trim() });
      closeDrawer(); await ladeBoard();
    } }, 'Nicht relevant…'));
  }
  sf.append(el('button', { class: 'btn ghost gefahr', style: 'margin-left:auto', onclick: async () => {
    if (!await uiFrage(`Karte "${d.titel}" endgültig löschen? Unterpunkte, Kommentare und Dateien gehen mit verloren.`)) return;
    const r = await mut('todo_loeschen', { todo_id: d.id });
    if (r && r.ok) { closeDrawer(); await ladeBoard(); }
  } }, 'Löschen'));
  dinfo.append(sf);

  // Marcels Korrektur nach dem ersten Blick (26.08.): Aufgabe links (primaer, mehr
  // Inhalt), Chat rechts wie eine Seitenleiste -- nicht umgekehrt.
  dbody.append(dinfo, dchat);
  dr.append(dkopf, dbody);
  ov.append(dr); root.append(ov);
  // Scroll-Positionen zurueckgeben (siehe oben). Erst NACH dem Einhaengen ins Dokument,
  // vorher sind scrollHeight/clientHeight noch 0.
  if (dinfoScroll) dinfo.scrollTop = dinfoScroll;
  if (chatWarUnten) sk.scrollTop = sk.scrollHeight;
  else if (chatScroll) sk.scrollTop = chatScroll;
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
    } catch (e) { if (wins[i] && !wins[i].closed) wins[i].close(); uiHinweis('Öffnen fehlgeschlagen: ' + a.name); }
  }
}

// ---------- Dateien: Vorschau und Ablegen (25.08.) ----------
function istBild(n) { return /\.(png|jpe?g|gif|webp|bmp|avif|svg)$/i.test(String(n || '')); }
function istPdf(n) { return /\.pdf$/i.test(String(n || '')); }
// Die Storage will den Anmelde-Kopf sehen, den ein <img src="…"> nicht mitschicken kann.
// Also holen wir die Datei einmal und merken uns ihre Blob-Adresse fuer diese Sitzung.
const anhangUrls = new Map();
async function anhangUrl(a) {
  if (anhangUrls.has(a.pfad)) return anhangUrls.get(a.pfad);
  const r = await fetch(`${SUPA}/storage/v1/object/todo-anhaenge/${a.pfad}`, {
    headers: { apikey: ANON, Authorization: 'Bearer ' + S.session.access_token } });
  if (!r.ok) throw new Error('Datei nicht abrufbar');
  const typ = istPdf(a.name) ? 'application/pdf' : (r.headers.get('content-type') || 'application/octet-stream');
  const u = URL.createObjectURL(new Blob([await r.arrayBuffer()], { type: typ }));
  anhangUrls.set(a.pfad, u);
  return u;
}
function anhangKachel(a) {
  const vs = el('div', { class: 'vs' }, el('span', { class: 'lade' }, 'lädt…'));
  const k = el('div', { class: 'anhkachel', title: a.name, onclick: () => anhangGross(a) },
    vs, el('div', { class: 'nm' }, a.name));
  anhangUrl(a).then((u) => {
    vs.innerHTML = '';
    vs.append(istBild(a.name)
      ? el('img', { src: u, alt: a.name })
      : el('iframe', { src: u + '#toolbar=0&navpanes=0&scrollbar=0&view=FitH', tabindex: '-1' }));
  }).catch(() => { vs.innerHTML = ''; vs.append(el('span', { class: 'lade' }, 'Vorschau nicht möglich')); });
  return k;
}
// Grosse Ansicht ueber dem Karten-Detail: Bild als Bild, PDF im Betrachter des Browsers.
function anhangGross(a) {
  const inhalt = el('div', { class: 'lbinhalt' }, 'Lädt…');
  const zu = () => { removeEventListener('keydown', taste, true); ov.remove(); };
  const taste = (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); zu(); } };
  const ov = el('div', { class: 'overlay lightbox', onclick: (e) => { if (e.target === ov) zu(); } },
    el('div', { class: 'lbbox' },
      el('div', { class: 'lbkopf' },
        el('span', { class: 'nm' }, a.name),
        el('button', { class: 'btn ghost', onclick: () => downloadAnhang(a) }, 'Herunterladen'),
        el('button', { class: 'btn ghost', onclick: zu }, 'Schließen')),
      inhalt));
  document.body.append(ov);
  addEventListener('keydown', taste, true);
  anhangUrl(a).then((u) => {
    inhalt.innerHTML = '';
    inhalt.append(istBild(a.name) ? el('img', { src: u, alt: a.name }) : el('iframe', { src: u }));
  }).catch((e) => { inhalt.textContent = 'Konnte nicht geladen werden: ' + e.message; });
}
// Hochladen: mehrere Dateien am Stueck, mit Fortschritt unter der Dateiliste.
let anhangZaehler = 0;
// Datei -> base64. FileReader statt btoa(String.fromCharCode(...)): letzteres sprengt
// bei groesseren Dateien den Aufrufstapel.
function dateiAlsBase64(f) {
  return new Promise((fertig, schief) => {
    const r = new FileReader();
    r.onload = () => fertig(String(r.result).split(',')[1] || '');
    r.onerror = () => schief(new Error('Datei liess sich nicht lesen'));
    r.readAsDataURL(f);
  });
}

async function ladeDateienHoch(dateien, todoId) {
  const liste = Array.from(dateien || []); if (!liste.length) return;
  const box = document.getElementById('anh-status');
  let n = 0;
  for (const f of liste) {
    n++;
    if (box) box.textContent = `Lädt hoch (${n}/${liste.length}): ${f.name}`;
    const pfad = `${todoId}/${Date.now()}_${++anhangZaehler}_${f.name.replace(/[^\w.\-äöüÄÖÜß ]/g, '_')}`;
    // Der Upload laeuft am Lotsen VORBEI direkt in den Speicher — und war darum der
    // einzige Weg ohne Token-Erneuerung. Ein Supabase-Zugangstoken laeuft nach einer
    // Stunde ab: wer das Board lange offen hat, konnte weiter Karten und Kommentare
    // schreiben (lotse() erneuert selbst), aber keine Datei mehr anhaengen. Die Meldung
    // dazu nannte keinen Grund. Beides ist hier behoben.
    const hochladen = () => fetch(`${SUPA}/storage/v1/object/todo-anhaenge/${encodeURI(pfad)}`, {
      method: 'POST',
      headers: { apikey: ANON, Authorization: 'Bearer ' + (S.session?.access_token || ''),
        'x-upsert': 'true', 'Content-Type': f.type || 'application/octet-stream' },
      body: f });
    let up;
    try {
      up = await hochladen();
      if (up.status === 401 || up.status === 403) { if (await authRefresh()) up = await hochladen(); }
    } catch (e) { up = { ok: false, status: 0, text: async () => e.message || 'Netzwerkfehler' }; }
    if (!up.ok) {
      // Rueckfallweg: ueber den Lotsen, der mit dem Dienstschluessel arbeitet und
      // deshalb nicht davon abhaengt, wie alt die Browser-Sitzung gerade ist.
      if (f.size <= 12 * 1024 * 1024) {
        if (box) box.textContent = `Zweiter Versuch (${n}/${liste.length}): ${f.name}`;
        try {
          const b64 = await dateiAlsBase64(f);
          const r2 = await lotse('anhang_upload', { todo_id: todoId, name: f.name, mime: f.type || '', base64: b64 });
          if (r2 && !r2.fehler) { if (box) box.textContent = ''; continue; }
          var lotseFehler = r2 && r2.fehler;
        } catch (e) { var lotseFehler = e.message; }
      }
      let grund = '';
      try { const j = JSON.parse(await up.text()); grund = j.message || j.error || ''; } catch {}
      if (box) box.textContent = '';
      uiHinweis(`Upload fehlgeschlagen: ${f.name}`
        + (up.status ? ` (${up.status}${grund ? ' — ' + grund : ''})` : ' — keine Verbindung')
        + (typeof lotseFehler === 'string' && lotseFehler ? ` — auch über den Lotsen nicht: ${lotseFehler}` : ''));
      return;
    }
    await mut('anhang_registrieren', { todo_id: todoId, pfad, name: f.name, groesse: f.size });
  }
  if (box) box.textContent = '';
  await openCard(todoId); await ladeBoard();
}

async function downloadAnhang(a) {
  const r = await fetch(`${SUPA}/storage/v1/object/todo-anhaenge/${a.pfad}`, {
    headers: { apikey: ANON, Authorization: 'Bearer ' + S.session.access_token } });
  if (!r.ok) { uiHinweis('Download fehlgeschlagen'); return; }
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
// Eine Datei daneben fallen zu lassen oeffnete sie bisher im Browser — die App war weg.
// Ausserhalb der Ablagezonen passiert jetzt nichts mehr.
for (const ereignis of ['dragover', 'drop']) {
  addEventListener(ereignis, (e) => {
    if (!e.dataTransfer || !Array.from(e.dataTransfer.types || []).includes('Files')) return;
    if (e.target && e.target.closest && e.target.closest('.dropzone')) return;
    e.preventDefault();
  });
}
addEventListener('unhandledrejection', (e) => console.error('unhandled:', e.reason));
loadSession();
if (S.session?.access_token) start().catch(() => showLogin());
else showLogin();
