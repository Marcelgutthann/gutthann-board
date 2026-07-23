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
  board: null, detail: null, drag: null, newCardCol: null, poll: null,
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
    // Kaltstart/Netz-Huester: einmal kurz warten und wiederholen
    if (!retried) { await new Promise((s2) => setTimeout(s2, 900)); return lotse(action, body, true); }
    throw e;
  }
  const j = await r.json().catch(() => ({}));
  if (j && j.error && /Anmeldung erforderlich/.test(j.error)) {
    if (!retried && await authRefresh()) return lotse(action, body, true);
    showLogin(); throw new Error('Sitzung abgelaufen');
  }
  return j;
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
function projDot(name) { let h = 0; for (const c of String(name)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return PROJ_DOTS[h % PROJ_DOTS.length]; }
function statusVon(t) {
  if (!t.delegiert || !t.agent_status) return null;
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
function ctxMenu(x, y, items) {
  closeCtx();
  const m = el('div', { class: 'ctx' });
  for (const it of items) {
    if (it.note) m.append(el('div', { class: 'note' }, it.note));
    else m.append(el('button', { class: it.danger ? 'danger' : '', onclick: () => { closeCtx(); it.do(); } }, it.txt));
  }
  m.style.left = Math.min(x, innerWidth - 240) + 'px'; m.style.top = Math.min(y, innerHeight - 200) + 'px';
  document.getElementById('ctx-root').append(m);
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
async function ladeBoard() {
  if (!S.active) return;
  S.board = S.active.typ === 'projekt'
    ? await lotse('board', { projekt: S.active.name })
    : await lotse('board', { board_id: S.active.id });
  renderTopbar(); renderBoard();
}
async function wechsle(typ, id, name) { S.active = { typ, id, name }; S.board = null; renderSidebar(); renderTopbar(); renderBoard(); await ladeBoard(); }

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
    g1.append(el('div', {
      class: 'row' + (aktiv ? ' active' : ''),
      onclick: () => wechsle('board', b.id, b.name),
      oncontextmenu: (e) => { e.preventDefault(); boardMenu(e, b, li.boards.length <= 1); },
    }, '▦ ', b.name));
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
        el('button', { class: 'pin', title: 'Lösen', onclick: async (e) => { e.stopPropagation(); await lotse('pin', { projekt: p.name, an: false }); S.liste = await lotse('board_liste'); renderSidebar(); } }, '✕')));
    }
  }

  const g4 = grp('Projekte');
  const gepinnt = new Set((li.pins || []).map((p) => p.name));
  for (const p of S.projects) {
    const aktiv = S.active?.typ === 'projekt' && S.active.name === p.name;
    g4.append(el('div', { class: 'row' + (aktiv ? ' active' : ''), onclick: () => wechsle('projekt', p.id, p.name) },
      el('span', { class: 'pdot', style: 'background:' + projDot(p.name) }), p.name,
      gepinnt.has(p.name) ? '' :
        el('button', { class: 'pin', title: 'An Sidebar anheften', onclick: async (e) => { e.stopPropagation(); await lotse('pin', { projekt: p.name, an: true }); S.liste = await lotse('board_liste'); renderSidebar(); } }, '⌖')));
  }
}
function boardMenu(e, b, letztes) {
  ctxMenu(e.clientX, e.clientY, [
    { txt: 'Umbenennen', do: async () => { const n = prompt('Neuer Name:', b.name); if (n?.trim()) { await lotse('board_umbenennen', { board_id: b.id, name: n.trim() }); await ladeAlles(); } } },
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
  const rf = (S.board?.todos || []).filter((t) => statusVon(t) === 'rueckfrage');
  if (rf.length) tb.append(el('button', {
    class: 'alertbtn', onclick: () => openCard(rf[0].id),
  }, '⚠ ', rf.length === 1 ? '1 Rückfrage wartet auf dich' : rf.length + ' Rückfragen warten auf dich'));
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
        const r = await lotse('todo_verschieben', { todo_id: S.drag, spalte_id: sp.id });
        S.drag = null;
        if (r.fehler) alert(r.fehler);
        await ladeBoard();
      },
    });
    colEl.append(el('div', { class: 'colhead' },
      sp.ist_agent ? el('span', { class: 'roledot', title: 'Agenten-Spalte' }) : '',
      sp.auto_status === 'rueckfrage' ? el('span', { class: 'roledot', style: 'background:#E29A2E', title: 'Rückfragen wandern automatisch her' }) : '',
      sp.auto_status === 'fertig' ? el('span', { class: 'roledot', style: 'background:#4F7A4B', title: 'Fertige Agenten-Ergebnisse landen hier' }) : '',
      el('span', { class: 'name' }, sp.name),
      el('span', { class: 'cnt' }, String(inSpalte.length)),
      sp.ist_erledigt ? el('span', { class: 'cnt' }, '✓') : '',
      el('button', { class: 'menu', onclick: (e) => { e.stopPropagation(); spaltenMenu(e, sp, spalten.length); } }, '···')));
    const cardsEl = el('div', { class: 'cards' });
    for (const t of inSpalte) cardsEl.append(renderCard(t));
    colEl.append(cardsEl);
    if (S.newCardCol === sp.id) {
      const inp = el('input', {
        class: 'newinput', placeholder: 'Titel der Aufgabe…',
        onkeydown: async (e) => {
          if (e.key === 'Escape') { S.newCardCol = null; renderBoard(); }
          if (e.key === 'Enter' && inp.value.trim()) {
            const r = await lotse('todo_create', {
              titel: inp.value.trim(),
              projekt: S.active.typ === 'projekt' ? S.active.name : null,
            });
            if (r.todo_id && !sp.ist_erledigt) await lotse('todo_verschieben', { todo_id: r.todo_id, spalte_id: sp.id });
            S.newCardCol = null; await ladeBoard();
          }
        },
      });
      colEl.append(inp); setTimeout(() => inp.focus());
    } else {
      colEl.append(el('button', { class: 'addcard', onclick: () => { S.newCardCol = sp.id; renderBoard(); } }, '+ Aufgabe'));
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
  const rolle = async (r) => { await lotse('spalte_rolle', { spalte_id: sp.id, rolle: r }); await ladeBoard(); };
  if (!sp.ist_erledigt) items.push({ txt: sp.ist_agent ? 'Agenten-Rolle entfernen' : 'Als Agenten-Spalte (Karte rein = erledigen lassen)', do: () => rolle(sp.ist_agent ? 'keine' : 'agent') });
  if (!sp.ist_erledigt) items.push({ txt: sp.auto_status === 'rueckfrage' ? 'Rückfrage-Rolle entfernen' : 'Als Rückfrage-Spalte (Karten wandern automatisch her)', do: () => rolle(sp.auto_status === 'rueckfrage' ? 'keine' : 'rueckfrage') });
  if (!sp.ist_erledigt) items.push({ txt: sp.auto_status === 'fertig' ? 'Fertig-prüfen-Rolle entfernen' : 'Als Fertig-prüfen-Spalte (Agenten-Ergebnisse landen hier)', do: () => rolle(sp.auto_status === 'fertig' ? 'keine' : 'fertig_pruefen') });
  if (!sp.ist_erledigt) items.push({ txt: 'Als Erledigt-Spalte', do: () => rolle('erledigt') });
  if (sp.ist_erledigt) items.push({ note: 'Erledigt-Spalte – Rolle über andere Spalte ändern' });
  if (!sp.ist_erledigt && nSpalten > 1) items.push({ txt: 'Löschen – Karten wandern in erste Spalte', danger: true, do: async () => { const r = await lotse('spalte_loeschen', { spalte_id: sp.id }); if (r.fehler) alert(r.fehler); await ladeBoard(); } });
  ctxMenu(e.clientX, e.clientY, items);
}

function renderCard(t) {
  const st = statusVon(t);
  const chip = st && CHIPS[st];
  const due = fmtDatum(t.faellig);
  const c = el('div', {
    class: 'card' + (st === 'arbeitet' ? ' aura' : '') + (st === 'rueckfrage' ? ' rf' : ''),
    draggable: 'true',
    ondragstart: () => { S.drag = t.id; },
    onclick: () => openCard(t.id),
  });
  if (chip) c.append(el('div', { class: 'chip', style: `background:${chip.bg};color:${chip.fg}` },
    el('span', { class: 'cdot', style: `background:${chip.dot};${chip.anim ? 'animation:dotPulse 1.8s ease-in-out infinite' : ''}` }),
    chip.txt, st === 'fertig' && t.anhaenge_n ? ' 📎' : ''));
  c.append(el('div', { class: 't' }, t.titel));
  const meta = el('div', { class: 'meta' });
  meta.append(el('span', {}, t.quelle === 'voice' ? '📞' : '⌨'));
  if (due) meta.append(el('span', { class: 'due' + (due.urgent ? ' urgent' : '') }, due.txt));
  if (t.unterpunkte_gesamt) meta.append(el('span', {}, `☑ ${t.unterpunkte_erledigt}/${t.unterpunkte_gesamt}`));
  if (t.kommentare_n) meta.append(el('span', {}, `💬 ${t.kommentare_n}`));
  if ((t.zugewiesen || []).length) {
    const avs = el('span', { class: 'avs' });
    for (const p of t.zugewiesen.slice(0, 3)) avs.append(el('span', { class: 'av', style: 'background:' + avColor(p), title: p }, initialen(p)));
    meta.append(avs);
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
  chipRow.append(el('span', { style: 'font-size:12px;color:#75756E' }, (d.quelle === 'voice' ? '📞 per Anruf erstellt' : '⌨ in der App erstellt')));
  chipRow.append(el('button', { style: 'margin-left:auto;font-size:16px;color:#75756E', onclick: closeDrawer }, '✕'));
  const titelZeile = el('div', { class: 't', style: 'display:flex;gap:8px;align-items:baseline' }, d.titel,
    el('button', { title: 'Titel bearbeiten', style: 'font-size:13px;color:#9A9A93', onclick: async () => {
      const t2 = prompt('Titel bearbeiten:', d.titel);
      if (t2 !== null && t2.trim() && t2.trim() !== d.titel) { await lotse('todo_update', { todo_id: d.id, titel: t2.trim() }); await openCard(d.id); await ladeBoard(); }
    } }, '✎'));
  head.append(chipRow, titelZeile);
  const meta = el('div', { class: 'meta' });
  if (d.projekt) meta.append(el('span', {}, '⌖ ' + d.projekt.name));
  if (d.faellig) meta.append(el('span', {}, 'fällig ' + new Date(d.faellig).toLocaleDateString('de-DE')));
  meta.append(el('span', {}, 'Besitzer: ' + d.besitzer));
  head.append(meta); dr.append(head);

  // Auftrag (editierbar — auch KI-formulierte Texte)
  {
    const sec = el('div', { class: 'dsec' });
    const kopf = el('div', { class: 'slbl', style: 'display:flex;gap:10px;align-items:center' }, 'Auftrag');
    const inhalt = el('div', { class: 'pre' }, d.notiz || '');
    kopf.append(el('button', { style: 'font-size:11px;color:#75756E', onclick: () => {
      const ta = el('textarea', { style: 'width:100%;min-height:110px;padding:8px 10px;border:1px solid rgba(28,28,26,.2);border-radius:8px;background:#fff;font-size:13px' });
      ta.value = d.notiz || '';
      const speichern = el('button', { class: 'btn', style: 'margin-top:8px', onclick: async () => {
        await lotse('todo_update', { todo_id: d.id, notiz: ta.value }); await openCard(d.id);
      } }, 'Speichern');
      inhalt.replaceWith(el('div', {}, ta, speichern));
    } }, 'Bearbeiten'));
    sec.append(kopf, inhalt); dr.append(sec);
  }

  // Rueckfragen
  const offene = (d.rueckfragen || []).filter((f) => f.status === 'offen');
  const beantwortete = (d.rueckfragen || []).filter((f) => f.status !== 'offen');
  if (offene.length) {
    const sec = el('div', { class: 'dsec rfsec' });
    sec.append(el('div', { class: 'slbl' }, `${offene.length} Frage${offene.length > 1 ? 'n' : ''} — danach arbeitet der Agent weiter`));
    const inputs = [];
    offene.forEach((f, i) => {
      sec.append(el('div', { class: 'frage' }, `${i + 1}. ${f.frage}`));
      const inp = el('input', { placeholder: 'Deine Antwort…' });
      inputs.push({ f, inp }); sec.append(inp);
      sec.append(el('button', { style: 'font-size:11.5px;color:#8A5606;margin:4px 0 8px', onclick: async () => { await lotse('rueckfrage_antworten', { rueckfrage_id: f.id, antwort: 'ueberspringen' }); await openCard(d.id); await ladeBoard(); } }, 'Überspringen'));
    });
    sec.append(el('button', { class: 'btn warn', style: 'margin-top:8px', onclick: async () => {
      for (const { f, inp } of inputs) if (inp.value.trim()) await lotse('rueckfrage_antworten', { rueckfrage_id: f.id, antwort: inp.value.trim() });
      await openCard(d.id); await ladeBoard();
    } }, 'Antworten senden – Agent arbeitet weiter'));
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
  su.append(el('div', { class: 'slbl' }, `Unterpunkte ${d.unterpunkte.length ? `(${d.unterpunkte.filter(u => u.erledigt).length}/${d.unterpunkte.length})` : ''}`));
  for (const u of d.unterpunkte) {
    su.append(el('div', { class: 'sub' },
      el('input', { type: 'checkbox', ...(u.erledigt ? { checked: '' } : {}), onchange: async (e) => { await lotse('unterpunkt_setzen', { unterpunkt_id: u.id, erledigt: e.target.checked }); await openCard(d.id); } }),
      el('span', { style: u.erledigt ? 'text-decoration:line-through;color:#8A8A83' : '' }, u.text),
      el('button', { class: 'del', onclick: async () => { await lotse('unterpunkt_loeschen', { unterpunkt_id: u.id }); await openCard(d.id); } }, '✕')));
  }
  const addU = el('div', { class: 'inline-add' });
  const uInp = el('input', { placeholder: 'Unterpunkt hinzufügen…', onkeydown: async (e) => { if (e.key === 'Enter' && uInp.value.trim()) { await lotse('unterpunkt_anlegen', { todo_id: d.id, text: uInp.value.trim() }); await openCard(d.id); } } });
  addU.append(uInp); su.append(addU); dr.append(su);

  // Personen
  const sp2 = el('div', { class: 'dsec' });
  sp2.append(el('div', { class: 'slbl' }, 'Personen'));
  for (const p of d.zugewiesen) sp2.append(el('span', { class: 'pill' },
    el('span', { class: 'av', style: 'width:16px;height:16px;border-radius:50%;color:#fff;font-size:8px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;background:' + avColor(p) }, initialen(p)),
    p, el('button', { style: 'color:#9A9A93', onclick: async () => { await lotse('todo_zuweisen', { todo_id: d.id, person: p, an: false }); await openCard(d.id); await ladeBoard(); } }, '✕')));
  sp2.append(el('button', { class: 'btn ghost', style: 'font-size:12px;padding:5px 11px', onclick: (e) => {
    const kandidaten = (S.liste?.personen || []).filter((p) => !d.zugewiesen.includes(p));
    if (!kandidaten.length) return;
    ctxMenu(e.clientX, e.clientY, kandidaten.map((p) => ({ txt: p, do: async () => { await lotse('todo_zuweisen', { todo_id: d.id, person: p, an: true }); await openCard(d.id); await ladeBoard(); } })));
  } }, '+ Person')); dr.append(sp2);

  // Anhaenge
  const sa = el('div', { class: 'dsec' });
  sa.append(el('div', { class: 'slbl' }, 'Dateien'));
  for (const a of d.anhaenge) sa.append(el('div', { class: 'sub' },
    el('a', { href: '#', style: 'color:#1C1C1A;font-weight:500', onclick: async (e) => { e.preventDefault(); await downloadAnhang(a); } }, '📎 ' + a.name),
    el('span', { style: 'color:#9A9A93;font-size:11.5px' }, a.groesse ? Math.round(a.groesse / 1024) + ' KB' : ''),
    el('button', { class: 'del', onclick: async () => { await lotse('anhang_loeschen', { anhang_id: a.id }); await openCard(d.id); } }, '✕')));
  const fileInp = el('input', { type: 'file', style: 'display:none', onchange: async (e) => {
    const f = e.target.files[0]; if (!f) return;
    const pfad = `${d.id}/${Date.now()}_${f.name.replace(/[^\w.\-äöüÄÖÜß ]/g, '_')}`;
    const up = await fetch(`${SUPA}/storage/v1/object/todo-anhaenge/${pfad}`, {
      method: 'POST', headers: { apikey: ANON, Authorization: 'Bearer ' + S.session.access_token }, body: f,
    });
    if (!up.ok) { alert('Upload fehlgeschlagen'); return; }
    await lotse('anhang_registrieren', { todo_id: d.id, pfad, name: f.name, groesse: f.size });
    await openCard(d.id); await ladeBoard();
  } });
  sa.append(fileInp, el('button', { class: 'btn ghost', style: 'font-size:12px;padding:5px 11px', onclick: () => fileInp.click() }, 'Anhängen')); dr.append(sa);

  // Kommentare
  const sk = el('div', { class: 'dsec' });
  sk.append(el('div', { class: 'slbl' }, 'Kommentare'));
  for (const k of d.kommentare) sk.append(el('div', { class: 'kom' },
    el('div', { class: 'von' }, `${k.von} · ${new Date(k.am).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`),
    el('div', { class: 'txt' }, k.text)));
  const addK = el('div', { class: 'inline-add' });
  const kInp = el('input', { placeholder: 'Kommentar…' });
  addK.append(kInp, el('button', { class: 'btn', onclick: async () => { if (kInp.value.trim()) { await lotse('kommentar_anlegen', { todo_id: d.id, text: kInp.value.trim() }); await openCard(d.id); await ladeBoard(); } } }, 'Senden'));
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
      await lotse('todo_complete', { todo_id: d.id, kommentar: kom || null });
      closeDrawer(); await ladeBoard();
    } }, 'Mit Kommentar abschließen'));
  }
  sf.append(el('button', { class: 'btn ghost', title: 'Kommt in der nächsten Ausbaustufe', disabled: '', style: 'opacity:.45;cursor:default' }, 'Nachbessern'));
  dr.append(sf);

  ov.append(dr); root.append(ov);
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
  S.poll = setInterval(async () => { if (!S.detail) { try { await ladeBoard(); } catch {} } }, 60000);
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
