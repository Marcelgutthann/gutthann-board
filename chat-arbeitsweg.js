// ---------- Chat: schwebendes Fenster „Arbeitsweg“ (Marcel, 30.09.) ----------
// „Hier soll ein Fenster aufgehen, welches Arbeitsweg heißt, das will ich verschieben können über den
// ganzen Screen und aufklappen können. Dort drinnen will ich alles sehen, welche Tools, welche Aufgaben
// er Stück für Stück abarbeitet.“
// Inhalt: Tonys Plan (Werkzeug plan, Strom {t:"plan"}), jeder Werkzeugschritt der laufenden Antwort
// (Strom {t:"wx"}) und — wenn ein Agent läuft — dessen Arbeitsliste, Schritte und Lebenszeichen
// (dok_stand alle 4 s, agent_runs.lauf). Position und Auf/Zu bleiben im Browser gespeichert.
// Gerufen aus chatDokRender (jedes renderChat) und chatLetzte (jedes Stück beim Streamen).

function chatAwGespeichert(n, sonst) {
  try { const v = localStorage.getItem('kiaw.' + n); return v == null ? sonst : JSON.parse(v); } catch { return sonst; }
}
function chatAwMerken(n, v) { try { localStorage.setItem('kiaw.' + n, JSON.stringify(v)); } catch { /* nur fuer jetzt */ } }

function chatAwPunkt(p) {
  return el('div', { class: 'awp ' + (p.s || 'pending') },
    el('span', { class: 'kiawhaken' }, p.s === 'completed' ? '✓' : p.s === 'in_progress' ? '▸' : '○'), el('span', {}, p.t));
}

function chatArbeitsweg() {
  const root = document.getElementById('chat-root');
  const k = S.kichat;
  let fen = document.getElementById('kiaw');
  if (!root || !k || S.kiansicht) { fen?.remove(); return; }

  const letzte = [...k.zeilen].reverse().find((z) => z.rolle === 'assistent' && !z.agentLink);
  const weg = letzte?.weg || [];
  const plan = k.plan || [];
  const d = k.dok;
  const lw = d?.lauf_weg || {};
  const agentPlan = Array.isArray(lw.plan) ? lw.plan : [];
  const agentSchritte = Array.isArray(lw.schritte) ? lw.schritte : [];
  const agentLaeuft = d?.status === 'arbeitet' && d.agent !== 'tony';
  const tonyLaeuft = !!(letzte?.laeuft);
  if (k.awZu || !(plan.length || weg.length || tonyLaeuft || agentLaeuft || agentPlan.length)) { fen?.remove(); return; }

  if (!fen) {
    fen = el('div', { id: 'kiaw', class: 'kiaw' });
    root.append(fen);
    const pos = chatAwGespeichert('pos', null);
    if (pos) chatAwSetzen(fen, pos.x, pos.y);
  }
  fen.classList.toggle('zu', !!chatAwGespeichert('zu', false));
  const laeuft = tonyLaeuft || agentLaeuft;
  const unten = fen.querySelector('.kiawinhalt');
  const warUnten = !unten || unten.scrollHeight - unten.scrollTop - unten.clientHeight < 40;

  const kopf = el('div', { class: 'kiawkopf', title: 'Ziehen zum Verschieben · Doppelklick: auf-/zuklappen' },
    el('span', { class: 'kiawpunkt' + (laeuft ? ' laeuft' : '') }),
    el('span', { class: 'kiawtitel' }, 'Arbeitsweg'),
    el('span', { class: 'kiawstand' }, laeuft ? 'arbeitet …' : 'fertig'),
    el('button', { class: 'kichip', type: 'button', title: 'Auf-/zuklappen', onclick: () => { chatAwMerken('zu', !chatAwGespeichert('zu', false)); chatArbeitsweg(); } },
      fen.classList.contains('zu') ? '▸' : '▾'),
    el('button', { class: 'kichip', type: 'button', title: 'Schließen (kommt mit der nächsten Frage wieder)', onclick: () => { k.awZu = true; chatArbeitsweg(); } }, '×'));
  chatAwZiehen(fen, kopf);

  const inhalt = el('div', { class: 'kiawinhalt' });
  // Tony: Plan, dann jeder Schritt mit Logo der Quelle, zuletzt, was er gerade tut.
  if (plan.length || weg.length || tonyLaeuft) {
    const fertig = plan.filter((p) => p.s === 'completed').length;
    inhalt.append(el('div', { class: 'kiawabschnitt' }, 'Tony' + (plan.length ? ` · Plan ${fertig} von ${plan.length}` : '')));
    if (plan.length) inhalt.append(el('div', { class: 'kiawplan' }, ...plan.map(chatAwPunkt)));
    for (const w of weg) {
      const q = chatQuelle(w.n);
      inhalt.append(el('div', { class: 'kiwegz' + (w.ok ? '' : ' fehl') }, chatLogo(q),
        el('span', {}, (KI_QUELLE[q]?.name ? KI_QUELLE[q].name + ' · ' : '') + (w.was || chatWerkzeugWort(w.n)) + (w.x ? ': ' + w.x : '') +
          (w.ok ? '' : ' — ging nicht' + (w.f ? ': ' + chatGrund(w.f) : '')))));
    }
    if (tonyLaeuft) inhalt.append(el('div', { class: 'kiawjetzt' }, 'Tony ' + (letzte.tut || (letzte.text ? 'schreibt' : 'denkt')) + ' …'));
  }
  // Agent: Arbeitsliste, Schritte mit Uhrzeit seit Start, Lebenszeichen.
  if (d && d.agent !== 'tony' && (agentLaeuft || agentPlan.length || agentSchritte.length)) {
    const fertig = agentPlan.filter((p) => p.s === 'completed').length;
    inhalt.append(el('div', { class: 'kiawabschnitt' }, 'Agent · ' + (d.titel || 'Lauf') + (agentPlan.length ? ` · ${fertig} von ${agentPlan.length}` : '')));
    if (agentLaeuft) inhalt.append(el('div', { class: 'kiawjetzt' + (d.still_s >= 180 ? ' haengt' : '') },
      d.lauf_status === 'queued' ? 'wartet auf den Büro-PC …'
        : d.still_s >= 180 ? `kein Lebenszeichen seit ${Math.floor(d.still_s / 60)} min`
        : (lw.jetzt || 'arbeitet') + (d.still_s != null ? ` · vor ${d.still_s} s` : '')));
    if (agentPlan.length) inhalt.append(el('div', { class: 'kiawplan' }, ...agentPlan.map(chatAwPunkt)));
    if (agentSchritte.length) inhalt.append(el('div', { class: 'kiawschritte' },
      ...agentSchritte.slice(-40).map((x) => el('div', { class: 'kiawschritt' }, el('span', { class: 'kiawzeit' }, mmss(x.s || 0)), el('span', {}, x.t)))));
    if (!agentPlan.length && !agentSchritte.length && !agentLaeuft && d.antwort) inhalt.append(el('div', { class: 'kiawjetzt' }, d.antwort));
  }
  fen.replaceChildren(kopf, inhalt);
  if (warUnten) inhalt.scrollTop = inhalt.scrollHeight;
}

// Verschieben ueber den ganzen Bildschirm, am Kopf. Bleibt immer ganz sichtbar.
function chatAwSetzen(fen, x, y) {
  const b = fen.offsetWidth || 360, h = 44;
  x = Math.max(0, Math.min(x, window.innerWidth - b));
  y = Math.max(0, Math.min(y, window.innerHeight - h));
  fen.style.left = x + 'px'; fen.style.top = y + 'px'; fen.style.right = 'auto';
  return { x, y };
}
function chatAwZiehen(fen, kopf) {
  kopf.addEventListener('dblclick', () => { chatAwMerken('zu', !chatAwGespeichert('zu', false)); chatArbeitsweg(); });
  kopf.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    e.preventDefault();
    const r = fen.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top;
    kopf.setPointerCapture(e.pointerId);
    fen.classList.add('zieht');
    let pos = { x: r.left, y: r.top };
    const zug = (ev) => { pos = chatAwSetzen(fen, ev.clientX - dx, ev.clientY - dy); };
    const los = () => { kopf.removeEventListener('pointermove', zug); fen.classList.remove('zieht'); chatAwMerken('pos', pos); };
    kopf.addEventListener('pointermove', zug);
    kopf.addEventListener('pointerup', los, { once: true });
    kopf.addEventListener('pointercancel', los, { once: true });
  });
}
window.addEventListener('resize', () => {
  const fen = document.getElementById('kiaw'), pos = chatAwGespeichert('pos', null);
  if (fen && pos) chatAwSetzen(fen, pos.x, pos.y);
});
