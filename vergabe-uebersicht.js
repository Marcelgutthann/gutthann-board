// ---------- Vergabeübersicht: Sonderboard unter dem VgV-Board (Migration 224) ----------
// Besprechung „Vergabe Übersicht" 05.10.2026 (Benjamin Adam, Julian Neuhoff, Marcel):
// Kein Kanban mehr (Informationsmenge), sondern eine kalenderähnliche Zeitachse über alle Projekte,
// begleitend zur Ausschreibungsrunde. Quelle sind allein die Vergabeterminpläne (db/vergabe-import.mjs).
//  - Massgeblich ist die Lesefassung beim Bauherrn; davor liegt der geschätzte Bearbeitungszeitraum.
//  - Zugeklappt eine Zeile je Projekt (oder Gewerk / Mitarbeiter) als „Morse"-Balken, aufgeklappt
//    die einzelnen Vergabeeinheiten. Überlappung = dichtere Farbe.
//  - Umschalten Projekt / Gewerk / Mitarbeiter, Filter nach Projekt, Gewerk, Zeit; ELT/HLS raus.
//  - Vergabeeinheit einem Mitarbeiter zuordnen; offene bleiben erkennbar (nur Umriss).
// Farben: Projekte zufällig (projDot wie in der Seitenleiste), Gewerkfarben sind zurückgestellt.

const VG = { d: null, fehler: null, sicht: 'projekt', monate: 6, offen: new Set(), projekte: null,
  gewerk: '', fremde: false, erledigte: false, nurOffen: false, detail: null,
  von: null, tage: null }; // sichtbarer Ausschnitt der Zeitachse (Strg/Alt+Mausrad zoomt, Umschalt+Mausrad schiebt)
const VG_TAGE = 14; // Beispiel aus der Besprechung (Baumeister-LV), je Einheit änderbar
const VG_TAG_MS = 86400000;

async function ladeVergabe() {
  vgStil();
  const root = document.getElementById('vergabe-root');
  if (!root) return;
  if (!VG.d) root.replaceChildren(el('div', { class: 'vgleer' }, 'Lade Vergabeterminpläne…'));
  try {
    const d = await restRpc('assistant_vergabe_uebersicht', {});
    if (d?.fehler) { VG.fehler = d.fehler; VG.d = null; }
    else { for (const e of d.einheiten || []) vgLesefassung(e); VG.d = d; VG.fehler = null; }
  } catch (e) { VG.fehler = 'Die Vergabeübersicht ist gerade nicht erreichbar (' + e.message + ').'; }
  renderVergabe();
}

const vgTag = (s) => s ? new Date(s + 'T00:00:00') : null;
const vgPlus = (d, n) => new Date(d.getTime() + n * 86400000);
const vgFmt = (d) => d ? d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '–';
const vgEuro = (n) => n == null ? '' : n >= 1e6 ? (n / 1e6).toLocaleString('de-DE', { maximumFractionDigits: 1 }) + ' Mio €'
  : Math.round(n / 1000).toLocaleString('de-DE') + ' T€';
const vgKurzProjekt = (p) => String(p).replace(/^\d+\s*-\s*/, '').replace(/^\d{4}\s+/, '');

// Massgeblicher Termin: die Lesefassung laut Plan. Liegt sie mehr als 90 Tage vor der Veroeffentlichung,
// ist die Zelle offensichtlich veraltet (Wenzenbach 29.09.2026: Lesefassung 2025, Veroeffentlichung 2026).
// Dann gilt die Regel des Plans selbst — „Lesefassung 10 KT vor Versendung" — und der Termin ist als
// abgeleitet markiert (hohle Raute, Hinweis im Detail).
// Fehlt die Lesefassung ganz, gibt es einen Ersatztermin (Marcel 05.10.: „dass wir alles mal drin haben"),
// zurueckgerechnet aus dem naechsten Termin, der in der Zeile steht:
//   Veroeffentlichung − 10 KT · Submission − Angebotszeit (EU 35 / national 10 KT) − 10 KT ·
//   Baubeginn − Versand-Orientierung aus dem Wenzenbach-Plan (EU 90 / national 42 KT) − 10 KT.
// Immer als Schaetzung markiert; e.lf_grund sagt, woraus.
function vgLesefassung(e) {
  e.lf = e.lesefassung; e.lf_abgeleitet = false; e.lf_grund = null;
  const eu = /eu/i.test(e.vergabeart || '');
  const ab = (d, tage, grund) => { e.lf = vgPlus(vgTag(d), -tage).toLocaleDateString('sv-SE'); e.lf_abgeleitet = true; e.lf_grund = grund; };
  if (e.lesefassung && e.veroeffentlichung && (vgTag(e.veroeffentlichung) - vgTag(e.lesefassung)) / 86400000 > 90) {
    ab(e.veroeffentlichung, 10, 'veraltet');
  } else if (!e.lesefassung && !e.erledigt) {
    if (e.veroeffentlichung) ab(e.veroeffentlichung, 10, 'veroeffentlichung');
    else if (e.submission) ab(e.submission, (eu ? 35 : 10) + 10, 'submission');
    else if (e.baubeginn) ab(e.baubeginn, (eu ? 90 : 42) + 10, 'baubeginn');
  }
}
const VG_LF_GRUND = {
  veraltet: (e) => `Im Plan steht ${vgFmt(vgTag(e.lesefassung))} — über 90 Tage vor der Veröffentlichung, also veraltet. Angesetzt: 10 Kalendertage vor der Veröffentlichung.`,
  veroeffentlichung: () => 'Im Plan fehlt die Lesefassung. Geschätzt: 10 Kalendertage vor der Veröffentlichung.',
  submission: (e) => `Im Plan fehlt die Lesefassung. Geschätzt aus der Submission: ${/eu/i.test(e.vergabeart || '') ? '35' : '10'} Tage Angebotszeit + 10 Tage.`,
  baubeginn: (e) => `Im Plan fehlt die Lesefassung. Geschätzt aus dem Baubeginn: Versand ${/eu/i.test(e.vergabeart || '') ? '90 (EU)' : '42 (national)'} Tage vorher (Faustregel aus dem Wenzenbach-Plan), Lesefassung 10 Tage davor.`,
};

// Bearbeitungsfenster einer Einheit: [Lesefassung − Bearbeitung, Lesefassung]. Den Vorlauf gibt es nicht
// mehr (Marcel 05.10.: ergibt keinen Sinn) — eine alte vorlauf_tage-Angabe in der Datenbank wird ignoriert.
function vgFenster(e) {
  const ende = vgTag(e.lf);
  if (!ende) return null;
  return { start: vgPlus(ende, -(e.bearbeitung_tage || VG_TAGE)), ende };
}

// Ausschnitt auf eine Voreinstellung (3/6/12 Monate ab zwei Wochen vor heute) setzen
function vgAusschnitt(monate) {
  const heute = vgTag(VG.d.heute);
  VG.monate = monate;
  VG.von = vgPlus(heute, -14);
  VG.tage = Math.round((new Date(heute.getFullYear(), heute.getMonth() + monate, heute.getDate()) - VG.von) / VG_TAG_MS);
}

// Alles auf der Zeitachse traegt data-a (und data-b fuer Breiten) als Millisekunden. Zoomen und Schieben
// setzen nur left/width neu — kein Neuaufbau, deshalb laeuft es fluessig wie im Terminplan.
function vgLage(wurzel) {
  const von = VG.von.getTime(), span = VG.tage * VG_TAG_MS;
  for (const n of wurzel.querySelectorAll('[data-a]')) {
    const a = +n.dataset.a;
    n.style.left = ((a - von) / span * 100) + '%';
    if (n.dataset.b) n.style.width = Math.max(0.15, (+n.dataset.b - a) / span * 100) + '%';
  }
}

// Strg/Alt+Mausrad zoomt am Zeiger, Umschalt+Mausrad (oder seitliches Wischen) schiebt, Ziehen mit der
// linken Maustaste auf freier Flaeche schiebt ebenfalls. Vorbild: terminplan/plan.html.
function vgBewegung(plan) {
  let rahmen = 0;
  const zeichne = () => { if (!rahmen) rahmen = requestAnimationFrame(() => { rahmen = 0; vgLage(plan); }); };
  const spur = () => plan.querySelector('.vgspur').getBoundingClientRect();
  const schiebe = (px) => { VG.von = new Date(VG.von.getTime() + px / spur().width * VG.tage * VG_TAG_MS); VG.monate = null; zeichne(); };
  plan.addEventListener('wheel', (ev) => {
    const r = spur();
    if (ev.ctrlKey || ev.altKey || ev.metaKey) {
      ev.preventDefault();
      const anteil = Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width));
      const anker = VG.von.getTime() + anteil * VG.tage * VG_TAG_MS;
      const d = ev.deltaMode === 1 ? ev.deltaY * 33 : ev.deltaY;
      VG.tage = Math.max(14, Math.min(1100, VG.tage * Math.exp(d * 0.0015)));
      VG.von = new Date(anker - anteil * VG.tage * VG_TAG_MS);
      VG.monate = null; zeichne();
      vgSegmentAus(plan);
    } else if (ev.shiftKey || Math.abs(ev.deltaX) > Math.abs(ev.deltaY)) {
      ev.preventDefault();
      schiebe(ev.deltaX || ev.deltaY);
      vgSegmentAus(plan);
    }
  }, { passive: false });
  plan.addEventListener('mousedown', (ev) => {
    if (ev.button !== 0 || ev.target.closest('.vgbalken, .vgraute, .vglabel, button, a, input')) return;
    vgZug = { plan, x: ev.clientX, los: false, schiebe };
  });
}
const vgSegmentAus = (plan) => plan.closest('.vghaupt')?.querySelectorAll('.vgseg.zeit button.an').forEach((b) => b.classList.remove('an'));
// Ziehen: EIN Satz Fenster-Lauscher fuer alle Neuaufbauten (sonst saemmelte jeder renderVergabe neue an)
let vgZug = null;
window.addEventListener('mousemove', (ev) => {
  if (!vgZug || !vgZug.plan.isConnected) return;
  const dx = ev.clientX - vgZug.x;
  if (!vgZug.los && Math.abs(dx) < 4) return;
  vgZug.los = true; vgZug.x = ev.clientX; vgZug.plan.classList.add('zieht');
  vgZug.schiebe(-dx); vgSegmentAus(vgZug.plan);
});
window.addEventListener('mouseup', () => {
  if (vgZug?.los) vgZug.plan.addEventListener('click', (ev) => ev.stopPropagation(), { capture: true, once: true });
  vgZug?.plan.classList.remove('zieht'); vgZug = null;
});

function vgEinheiten() {
  const alle = VG.d?.einheiten || [];
  return alle.filter((e) => (VG.fremde || e.ghiw)
    && (VG.erledigte || !e.erledigt)
    && (!VG.projekte || VG.projekte.has(e.projekt))
    && (!VG.gewerk || e.gewerk === VG.gewerk)
    && (!VG.nurOffen || !e.person));
}

function renderVergabe() {
  const root = document.getElementById('vergabe-root');
  if (!root) return;
  if (VG.fehler) { root.replaceChildren(el('div', { class: 'vgleer' }, VG.fehler)); return; }
  if (!VG.d) return;
  const heute = vgTag(VG.d.heute);
  if (!VG.von) vgAusschnitt(VG.monate || 6);
  // Zeilen haengen nicht am Zoom: alles ab zwei Wochen vor heute steht drin, der Ausschnitt waehlt nur den Blick
  const ab = vgPlus(heute, -14);
  const pos = (a, b) => b ? { 'data-a': String(+a), 'data-b': String(+b) } : { 'data-a': String(+a) };

  const basis = vgEinheiten();
  const imFenster = basis.filter((e) => { const f = vgFenster(e); return f && f.ende >= ab; });
  const ohneTermin = basis.filter((e) => !e.lf && !e.erledigt);

  // ---- Werkzeugleiste ----
  const leiste = el('div', { class: 'vgleiste' });
  const seg = (werte, aktiv, setze, klasse) => {
    const s = el('div', { class: 'vgseg' + (klasse ? ' ' + klasse : '') });
    for (const [k, t] of werte) s.append(el('button', { class: aktiv === k ? 'an' : '', onclick: () => { setze(k); renderVergabe(); } }, t));
    return s;
  };
  leiste.append(seg([['projekt', 'Projekte'], ['gewerk', 'Gewerke'], ['person', 'Mitarbeiter']], VG.sicht,
    (k) => { VG.sicht = k; VG.offen.clear(); }));
  leiste.append(seg([[3, '3 Monate'], [6, '6 Monate'], [12, '12 Monate']], VG.monate, (k) => vgAusschnitt(k), 'zeit'));
  const gewerke = [...new Set((VG.d.einheiten || []).filter((e) => VG.fremde || e.ghiw).map((e) => e.gewerk))].sort((a, b) => a.localeCompare(b, 'de'));
  const gsel = el('select', { class: 'vgsel', onchange: (ev) => { VG.gewerk = ev.target.value; renderVergabe(); } },
    el('option', { value: '' }, 'Alle Gewerke'), ...gewerke.map((g) => el('option', { value: g }, g)));
  gsel.value = VG.gewerk;
  leiste.append(gsel);
  const schalter = (an, text, titel, setze) => el('label', { class: 'vgcheck', title: titel },
    el('input', { type: 'checkbox', ...(an ? { checked: '' } : {}), onchange: (ev) => { setze(ev.target.checked); renderVergabe(); } }), text);
  leiste.append(schalter(VG.nurOffen, 'nur nicht zugeordnete', 'Nur Vergabeeinheiten ohne Mitarbeiter', (v) => { VG.nurOffen = v; }));
  leiste.append(schalter(VG.fremde, 'ELT/HLS & Fachplaner', 'Auch Einheiten, die GHIW nicht selbst ausschreibt (die KI hat sie aussortiert)', (v) => { VG.fremde = v; }));
  leiste.append(schalter(VG.erledigte, 'erledigte', 'Auch bereits vergebene/entfallene Einheiten', (v) => { VG.erledigte = v; }));
  leiste.append(el('button', { class: 'vgknopf', title: 'Neu laden', onclick: () => ladeVergabe() }, ico('refresh')));

  // Projektfilter als Chips
  const projekte = [...new Set((VG.d.einheiten || []).map((e) => e.projekt))].sort();
  const chips = el('div', { class: 'vgchips' });
  for (const p of projekte) {
    const an = !VG.projekte || VG.projekte.has(p);
    chips.append(el('button', { class: 'vgchip' + (an ? ' an' : ''), title: an ? 'Ausblenden' : 'Einblenden', onclick: () => {
      const s = VG.projekte ? new Set(VG.projekte) : new Set(projekte);
      s.has(p) ? s.delete(p) : s.add(p);
      VG.projekte = s.size === projekte.length ? null : s;
      renderVergabe();
    } }, el('span', { class: 'vgpunkt', style: 'background:' + projDot(p) }), vgKurzProjekt(p)));
  }

  // ---- Zeitachse: ueber den ganzen Datenbereich plus Reserve gebaut, damit Zoomen/Schieben nichts nachbauen muss ----
  const fenster = imFenster.map(vgFenster);
  const bereichVon = new Date(Math.min(+vgPlus(heute, -400), ...fenster.map((f) => +f.start)));
  const bereichBis = new Date(Math.max(+vgPlus(heute, 1100), ...fenster.map((f) => +f.ende)));
  const achse = el('div', { class: 'vgachse' });
  for (let m = new Date(bereichVon.getFullYear(), bereichVon.getMonth() + 1, 1); m < bereichBis; m = new Date(m.getFullYear(), m.getMonth() + 1, 1)) {
    achse.append(el('div', { class: 'vgmonat', ...pos(m) },
      m.toLocaleDateString('de-DE', { month: 'short', year: m.getMonth() === 0 ? '2-digit' : undefined })));
  }
  const heuteLinie = () => el('div', { class: 'vgheute', ...pos(heute) });

  // Dichte je Kalenderwoche (ab Montag): wie viele Einheiten sind gleichzeitig in Bearbeitung („wo zwickt es")
  const montag0 = vgPlus(bereichVon, -((bereichVon.getDay() + 6) % 7));
  const wochen = Math.ceil((bereichBis - montag0) / VG_TAG_MS / 7);
  const dichte = Array(wochen).fill(0);
  for (const f of fenster) {
    for (let w = 0; w < wochen; w++) {
      const a = vgPlus(montag0, w * 7), b = vgPlus(a, 7);
      if (f.start < b && f.ende >= a) dichte[w]++;
    }
  }
  const maxD = Math.max(1, ...dichte);
  const dichteBand = el('div', { class: 'vgdichte' });
  dichte.forEach((n, w) => { if (n) dichteBand.append(el('div', {
    class: 'vgdzelle', title: `KW ab ${vgFmt(vgPlus(montag0, w * 7))}: ${n} Einheit${n === 1 ? '' : 'en'} in Bearbeitung`,
    ...pos(vgPlus(montag0, w * 7), vgPlus(montag0, w * 7 + 7)), style: `opacity:${0.12 + 0.88 * n / maxD}` }, String(n))); });

  // ---- Gruppen ----
  const gruppeVon = (e) => VG.sicht === 'projekt' ? e.projekt : VG.sicht === 'gewerk' ? e.gewerk : (e.person || 'Nicht zugeordnet');
  const gruppen = new Map();
  for (const e of imFenster) { const g = gruppeVon(e); if (!gruppen.has(g)) gruppen.set(g, []); gruppen.get(g).push(e); }
  // Mitarbeiter-Ansicht: jede Person der Liste (Migration 226) hat eine Zeile, auch ohne Zuordnung —
  // so sieht man freie Kapazitaet. Reihenfolge wie in der Liste, Nicht zugeordnet zuletzt.
  const team = VG.d.personen || [];
  if (VG.sicht === 'person') for (const p of team) if (!gruppen.has(p)) gruppen.set(p, []);
  const rang = (n) => n === 'Nicht zugeordnet' ? 1e9 : team.includes(n) ? team.indexOf(n) : 1e6;
  const reihe = [...gruppen.entries()].sort((a, b) => {
    if (VG.sicht === 'person') return rang(a[0]) - rang(b[0]) || a[0].localeCompare(b[0], 'de');
    return Math.min(...a[1].map((e) => vgFenster(e).start)) - Math.min(...b[1].map((e) => vgFenster(e).start));
  });

  const farbe = (e) => projDot(e.projekt);
  const balken = (e, klein) => {
    const f = vgFenster(e);
    const b = el('div', {
      class: 'vgbalken' + (e.person ? ' zu' : ' frei') + (klein ? ' klein' : ''),
      ...pos(f.start, f.ende), style: `--f:${farbe(e)}`,
      title: `${e.leistungsbereich} · ${vgKurzProjekt(e.projekt)}\nLesefassung ${vgFmt(f.ende)}${e.person ? '\nbei ' + e.person : '\nnoch nicht zugeordnet'}`,
      onclick: (ev) => { ev.stopPropagation(); VG.detail = e.schluessel; renderVergabe(); },
    });
    return b;
  };
  // Meilensteine: gleiche Lesefassung im selben Projekt = EIN gemeinsamer Meilenstein (Beschluss 12)
  const meilensteine = (liste) => {
    const m = new Map();
    for (const e of liste) { const k = e.projekt + '|' + e.lf; m.set(k, [...(m.get(k) || []), e]); }
    return [...m.values()].map((l) => el('div', { class: 'vgraute' + (l.every((e) => e.lf_abgeleitet) ? ' abgeleitet' : ''), ...pos(vgTag(l[0].lf)), style: `--f:${farbe(l[0])}`,
      title: `Lesefassung beim Bauherrn ${vgFmt(vgTag(l[0].lf))}${l[0].lf_abgeleitet ? ' (geschätzt, nicht im Plan)' : ''} · ${vgKurzProjekt(l[0].projekt)}\n` + l.map((e) => '· ' + e.leistungsbereich).join('\n') },
    l.length > 1 ? el('span', { class: 'vgrzahl' }, String(l.length)) : null));
  };

  const plan = el('div', { class: 'vgplan' });
  plan.append(el('div', { class: 'vgzeile vgkopfzeile' }, el('div', { class: 'vglabel' }, 'Auslastung je Woche'),
    el('div', { class: 'vgspur' }, achse, dichteBand, heuteLinie())));
  for (const [name, liste] of reihe) {
    const offen = VG.offen.has(name);
    const frei = liste.filter((e) => !e.person).length;
    const kopf = el('div', { class: 'vgzeile vggruppe' + (offen ? ' offen' : ''), onclick: () => {
      offen ? VG.offen.delete(name) : VG.offen.add(name); renderVergabe(); } },
    el('div', { class: 'vglabel' },
      el('span', { class: 'vgpfeil' }, '›'),
      VG.sicht === 'projekt' ? el('span', { class: 'vgpunkt', style: 'background:' + projDot(name) }) : null,
      el('span', { class: 'vgname', title: name }, VG.sicht === 'projekt' ? vgKurzProjekt(name) : name),
      el('span', { class: 'vgzahl', title: frei ? `${frei} noch ohne Mitarbeiter` : 'alle zugeordnet' },
        liste.length ? `${liste.length}${frei ? ' · ' + frei + ' offen' : ''}` : 'frei')),
    el('div', { class: 'vgspur' }, heuteLinie(), ...liste.map((e) => balken(e, false)), ...meilensteine(liste)));
    plan.append(kopf);
    if (!offen) continue;
    for (const e of [...liste].sort((a, b) => vgFenster(a).ende - vgFenster(b).ende)) {
      // Beschriftung = Leistungsbereich wie im Vergabeterminplan (gleich dem Detail rechts), nie die KI-Kategorie
      const unter = VG.sicht === 'projekt' ? e.leistungsbereich : vgKurzProjekt(e.projekt) + ' · ' + e.leistungsbereich;
      plan.append(el('div', { class: 'vgzeile vgeinheit' + (VG.detail === e.schluessel ? ' gewaehlt' : ''), onclick: () => { VG.detail = e.schluessel; renderVergabe(); } },
        el('div', { class: 'vglabel' },
          VG.sicht !== 'projekt' ? el('span', { class: 'vgpunkt', style: 'background:' + projDot(e.projekt) }) : null,
          el('span', { class: 'vgname', title: e.leistungsbereich }, unter),
          el('span', { class: 'vgmeta' }, [e.budget_brutto ? vgEuro(e.budget_brutto) : '', e.person ? initialen(e.person) : ''].filter(Boolean).join(' · '))),
        el('div', { class: 'vgspur' }, heuteLinie(), balken(e, true), ...meilensteine([e]))));
    }
  }
  // Projekt mit Vergabeterminplan, aber ohne Vergabe ab heute: trotzdem eine Zeile, mit Grund (Marcel 05.10.:
  // „warum sind 8 Projekte mit Vergabeplan und du zeigst mir nur 4") — nichts darf stillschweigend fehlen.
  if (VG.sicht === 'projekt' && !VG.gewerk && !VG.nurOffen) {
    for (const q of VG.d.quellen || []) {
      if (gruppen.has(q.projekt) || (VG.projekte && !VG.projekte.has(q.projekt))) continue;
      const eig = (VG.d.einheiten || []).filter((e) => e.projekt === q.projekt && (VG.fremde || e.ghiw) && (VG.erledigte || !e.erledigt));
      const ohne = eig.filter((e) => !e.lf).length;
      const letzte = eig.map((e) => e.lf).filter(Boolean).sort().pop();
      const grund = !eig.length ? 'keine offenen GHIW-Vergaben im Plan'
        : [letzte ? `keine Vergabe ab heute im Plan · letzte Lesefassung ${vgFmt(vgTag(letzte))}` : 'kein einziger Termin im Plan',
          ohne ? `${ohne} Vergabe${ohne === 1 ? '' : 'n'} ohne Termin` : ''].filter(Boolean).join(' · ');
      plan.append(el('div', { class: 'vgzeile vggruppe vgohnezeile' },
        el('div', { class: 'vglabel' }, el('span', { class: 'vgpfeil' }, ''),
          el('span', { class: 'vgpunkt', style: 'background:' + projDot(q.projekt) }),
          el('span', { class: 'vgname', title: q.projekt }, vgKurzProjekt(q.projekt)),
          el('span', { class: 'vgzahl' }, String(eig.length))),
        el('div', { class: 'vgspur' }, el('span', { class: 'vgohnegrund' }, grund + ' — ',
          q.url ? el('a', { href: q.url, target: '_blank', rel: 'noopener' }, 'Plan öffnen') : q.datei))));
    }
  }
  if (!plan.querySelector('.vggruppe')) plan.append(el('div', { class: 'vgleer' }, 'Keine Vergabeeinheit mit Lesefassungstermin in diesem Zeitraum und Filter.'));
  vgLage(plan);
  vgBewegung(plan);

  // ---- Legende + Datenlage ----
  const legende = el('div', { class: 'vglegende' },
    el('span', {}, el('i', { class: 'vglg voll' }), 'zugeordnet'),
    el('span', {}, el('i', { class: 'vglg leer' }), 'noch offen'),
    el('span', {}, el('i', { class: 'vglg raute' }), 'Lesefassung beim Bauherrn'),
    el('span', {}, el('i', { class: 'vglg raute hohl' }), 'geschätzt (Lesefassung fehlt oder ist veraltet)'),
    el('span', { class: 'vgklein' }, `Balken = geschätzte Bearbeitung, Standard ${VG_TAGE} Tage, je Einheit änderbar · Strg/Alt + Mausrad zoomt, Umschalt + Mausrad oder Ziehen schiebt`));

  const lage = el('details', { class: 'vglage' });
  lage.append(el('summary', {}, `Datenlage: ${(VG.d.quellen || []).length} Vergabeterminpläne · `
    + `${ohneTermin.length} Einheiten ganz ohne Termin`));
  const tab = el('table', { class: 'vgtab' }, el('tr', {}, el('th', {}, 'Projekt'), el('th', {}, 'Plan'), el('th', {}, 'Stand'),
    el('th', {}, 'GHIW'), el('th', {}, 'Lesefassung fehlt im Plan')));
  for (const q of VG.d.quellen || []) tab.append(el('tr', {}, el('td', {}, vgKurzProjekt(q.projekt), q.im_board ? '' : el('span', { class: 'vgklein' }, ' (nicht im Board)')),
    el('td', {}, q.url ? el('a', { href: q.url, target: '_blank', rel: 'noopener' }, q.datei) : q.datei),
    el('td', {}, vgFmt(vgTag(q.stand))), el('td', {}, `${q.ghiw} von ${q.gesamt}`),
    el('td', { class: q.ohne_lesefassung ? 'warn' : '' }, String(q.ohne_lesefassung))));
  lage.append(tab, el('div', { class: 'vgklein' }, 'Fehlt die Lesefassung, steht die Einheit mit einem geschätzten Termin auf der Zeitachse (hohle Raute); '
    + `${ohneTermin.length} Einheiten haben gar keinen Termin im Plan. Bitte die Spalte „Versendung LV als Lesefassung an Bauherr" im Vergabeterminplan ausfüllen (Projektleitung).`));

  // ---- Abdeckung (Migration 227): jedes laufende Poool-Projekt muss hier auftauchen ----
  // Marcel 05.10.: „Wenn ein Projekt, was wir bearbeiten, nicht dort drinnen steht, ist das Katastrophe."
  const abd = VG.d.abdeckung || [];
  const GRUND = { plan: 'Vergabeterminplan gelesen', ordner_leer: 'Vergabe-Ordner ist leer', kein_vergabeordner: 'kein Ordner „Vergabeterminplan" unter Termine',
    kein_termine: 'kein Ordner „Termine"', kein_ordner: 'kein SharePoint-Ordner zur Projektnummer' };
  const bau = abd.filter((a) => a.art === 'bau');
  const fehlt = bau.filter((a) => a.plan_status !== 'plan');
  const abdeckung = el('details', { class: 'vgabd' + (fehlt.length ? ' luecke' : '') });
  abdeckung.append(el('summary', {}, el('b', {}, `${bau.length - fehlt.length} von ${bau.length} laufenden Bauprojekten`),
    ' (laut Poool) haben einen Vergabeterminplan', fehlt.length ? el('span', { class: 'warn' }, ` · ${fehlt.length} ohne — nicht planbar`) : ''));
  for (const st of ['kein_ordner', 'kein_termine', 'kein_vergabeordner', 'ordner_leer']) {
    const l = fehlt.filter((a) => a.plan_status === st);
    if (!l.length) continue;
    abdeckung.append(el('div', { class: 'vgdlbl' }, `${GRUND[st]} (${l.length})`),
      el('div', { class: 'vgohne' }, ...l.map((a) => el('span', { class: 'vgohnez', title: `${a.titel} · Poool: ${a.poool_status}${a.ordner ? ' · Ordner: ' + a.ordner : ''}` },
        `${a.nummer} ${a.titel}${a.poool_status !== 'Aktuell' ? ' (' + a.poool_status + ')' : ''}`))));
  }
  const rest = abd.filter((a) => a.art !== 'bau');
  if (rest.length) abdeckung.append(el('div', { class: 'vgklein' }, `Nicht mitgezählt: ${rest.length} Bauleitpläne und interne Positionen ohne Vergaben (`
    + rest.map((a) => a.nummer).join(', ') + ').'));
  if (abd.length) abdeckung.append(el('div', { class: 'vgklein' }, `Abgleich Poool ↔ SharePoint vom ${new Date(abd[0].geprueft_at).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}, läuft alle 15 Minuten.`));

  const haupt = el('div', { class: 'vghaupt' }, leiste, abd.length ? abdeckung : null, chips, plan, legende, lage);
  const teile = [haupt];
  const det = VG.detail && (VG.d.einheiten || []).find((e) => e.schluessel === VG.detail);
  if (det) teile.push(vgDetail(det));
  const scroll = root.querySelector('.vghaupt')?.scrollTop || 0;
  root.replaceChildren(...teile);
  haupt.scrollTop = scroll;
}

function vgDetail(e) {
  const f = vgFenster(e);
  const zeile = (k, v, klasse) => v ? el('div', { class: 'vgdz' + (klasse ? ' ' + klasse : '') }, el('span', {}, k), el('b', {}, v)) : null;
  const personen = [...(VG.d.personen || []), ...(VG.d.weitere || [])];
  const liste = el('datalist', { id: 'vg-personen' }, ...personen.map((p) => el('option', { value: p })));
  const pIn = el('input', { class: 'vgin', list: 'vg-personen', placeholder: 'Mitarbeiter wählen oder eintippen', value: e.person || '' });
  const tIn = el('input', { class: 'vgin kurz', type: 'number', min: '1', max: '120', value: String(e.bearbeitung_tage || VG_TAGE) });
  const speichern = async (entfernen) => {
    const r = await restRpc('assistant_vergabe_zuordnen', { p_schluessel: e.schluessel, p_person: entfernen ? null : pIn.value.trim() || null,
      p_bearbeitung_tage: Number(tIn.value) || null, p_entfernen: !!entfernen })
      .catch((err) => ({ fehler: err.message }));
    if (r?.fehler) { uiHinweis(r.fehler); return; }
    await ladeVergabe();
  };
  return el('aside', { class: 'vgdetail' },
    el('div', { class: 'vgdkopf' }, el('span', { class: 'vgpunkt', style: 'background:' + projDot(e.projekt) }),
      el('div', {}, el('div', { class: 'vgdtitel' }, e.leistungsbereich), el('div', { class: 'vgklein' }, vgKurzProjekt(e.projekt) + (e.paket ? ' · Paket ' + e.paket : ''))),
      el('button', { class: 'vgknopf', title: 'Schließen', onclick: () => { VG.detail = null; renderVergabe(); } }, ico('weg'))),
    el('div', { class: 'vgdblock' },
      zeile('Lesefassung beim Bauherrn', e.lf ? vgFmt(vgTag(e.lf)) + (e.lf_abgeleitet ? ' (abgeleitet)' : '') : 'fehlt im Plan', e.lf && !e.lf_abgeleitet ? 'stark' : 'warn'),
      f ? zeile('Bearbeitung (geschätzt)', `${vgFmt(f.start)} – ${vgFmt(f.ende)}`) : null,
      e.lf_abgeleitet ? el('div', { class: 'vghinweis' }, VG_LF_GRUND[e.lf_grund](e) + ' Bitte im Vergabeterminplan nachtragen.') : null,
      zeile('Budget (KB brutto)', e.budget_brutto ? Number(e.budget_brutto).toLocaleString('de-DE', { maximumFractionDigits: 0 }) + ' €' : null),
      zeile('Gewerk', e.gewerk), zeile('Vergabeart', e.vergabeart), zeile('Verantwortlich laut Plan', e.verantwortlich),
      zeile('Bearbeiter laut Plan', e.bearbeiter_plan), zeile('Status laut Plan', e.status)),
    el('div', { class: 'vgdblock' },
      el('div', { class: 'vgdlbl' }, 'Zuordnung'), liste,
      el('label', { class: 'vgfeld' }, 'Mitarbeiter', pIn),
      el('label', { class: 'vgfeld' }, 'Bearbeitung (Tage)', tIn),
      el('div', { class: 'vgdknoepfe' }, el('button', { class: 'btn primary', onclick: () => speichern(false) }, 'Speichern'),
        e.person ? el('button', { class: 'btn', onclick: () => speichern(true) }, 'Zuordnung lösen') : null)),
    el('div', { class: 'vgdblock vgklein' },
      zeile('Veröffentlichung', vgFmt(vgTag(e.veroeffentlichung))), zeile('Submission', vgFmt(vgTag(e.submission))),
      zeile('Sitzung', vgFmt(vgTag(e.sitzung))), zeile('Beginn Gewerk', vgFmt(vgTag(e.baubeginn))),
      el('div', { class: 'vgquelle' }, `Einordnung der KI: ${e.ghiw ? 'GHIW schreibt aus' : 'nicht GHIW'} — ${e.ghiw_grund || ''}`),
      el('div', { class: 'vgquelle' }, 'Quelle: ', e.quelle_url ? el('a', { href: e.quelle_url, target: '_blank', rel: 'noopener' }, e.quelle_datei) : e.quelle_datei,
        ` (Stand ${vgFmt(vgTag(e.plan_stand))})`)));
}

let vgStilDa = false;
function vgStil() {
  if (vgStilDa) return; vgStilDa = true;
  document.head.append(el('style', {}, `
#vergabe-root{flex:1;min-height:0;display:flex;gap:0}
#vergabe-root[hidden]{display:none}
#vergabe-root .vghaupt{flex:1;min-width:0;overflow:auto;padding:4px 28px 28px}
#vergabe-root .vgleer{padding:28px;font-size:13.5px;color:#6E6E67}
#vergabe-root .vgleiste{display:flex;flex-wrap:wrap;align-items:center;gap:10px;padding:4px 0 6px}
#vergabe-root .vgseg{display:inline-flex;background:#E8E8E6;border-radius:8px;padding:2px}
#vergabe-root .vgseg button{padding:5px 11px;border-radius:6px;font-size:12.5px;color:#55554F}
#vergabe-root .vgseg button.an{background:#FFFFFF;color:#1C1C1A;box-shadow:0 1px 2px rgba(28,28,26,.12)}
#vergabe-root .vgsel{font:inherit;font-size:12.5px;padding:5px 8px;border-radius:8px;border:1px solid rgba(28,28,26,.14);background:#FFFFFF}
#vergabe-root .vgcheck{display:inline-flex;align-items:center;gap:5px;font-size:12.5px;color:#55554F;cursor:pointer}
#vergabe-root .vgknopf{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:8px;color:#55554F}
#vergabe-root .vgknopf:hover{background:rgba(28,28,26,.06)}
#vergabe-root .vgchips{display:flex;flex-wrap:wrap;gap:5px;padding:0 0 8px}
#vergabe-root .vgchip{display:inline-flex;align-items:center;gap:6px;padding:2px 9px;border-radius:999px;font-size:12px;border:1px solid rgba(28,28,26,.12);color:#8A8A83;background:transparent}
#vergabe-root .vgchip.an{color:#1C1C1A;background:#FFFFFF}
#vergabe-root .vgpunkt{width:8px;height:8px;border-radius:50%;flex:none;display:inline-block}
#vergabe-root .vgplan{background:#FFFFFF;border:1px solid rgba(28,28,26,.10);border-radius:12px;overflow:hidden}
#vergabe-root .vgplan.zieht{cursor:grabbing;user-select:none}
#vergabe-root .vgzeile{display:flex;min-height:22px;border-top:1px solid rgba(28,28,26,.06)}
#vergabe-root .vgkopfzeile{border-top:0;min-height:40px;background:#FAFAF9}
#vergabe-root .vglabel{width:300px;flex:none;display:flex;align-items:center;gap:7px;padding:0 12px;font-size:12px;color:#1C1C1A;border-right:1px solid rgba(28,28,26,.06);min-width:0}
#vergabe-root .vgkopfzeile .vglabel{font-size:11px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:#8A8A83;align-items:flex-end;padding-bottom:4px}
#vergabe-root .vgname{overflow:hidden;min-width:0;flex:1;line-height:1.3;padding:5px 0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
#vergabe-root .vgohnezeile{cursor:default}
#vergabe-root .vgohnezeile .vgname{color:#75756E}
#vergabe-root .vgohnegrund{position:absolute;left:12px;top:50%;transform:translateY(-50%);font-size:12px;color:#8A8A83;white-space:nowrap}
#vergabe-root .vgohnegrund a{color:#4E6117;text-decoration:underline;text-underline-offset:2px}
#vergabe-root .vgzahl,#vergabe-root .vgmeta{font-size:11.5px;color:#8A8A83;white-space:nowrap}
#vergabe-root .vgpfeil{display:inline-block;width:10px;color:#8A8A83;transition:transform .15s ease}
#vergabe-root .vggruppe{cursor:pointer;min-height:26px}
#vergabe-root .vggruppe:hover{background:#FAFAF9}
#vergabe-root .vggruppe .vglabel{font-weight:600}
#vergabe-root .vggruppe.offen .vgpfeil{transform:rotate(90deg)}
#vergabe-root .vgeinheit{cursor:pointer;background:#FCFCFB}
#vergabe-root .vgeinheit .vglabel{padding-left:29px;font-weight:400}
#vergabe-root .vgeinheit:hover,#vergabe-root .vgeinheit.gewaehlt{background:#F3F3F1}
#vergabe-root .vgspur{flex:1;position:relative;min-width:420px;overflow-x:clip}
#vergabe-root .vgachse{position:absolute;inset:0 0 auto 0;height:18px}
#vergabe-root .vgmonat{position:absolute;top:3px;font-size:11px;color:#75756E;padding-left:4px;border-left:1px solid rgba(28,28,26,.15);height:14px;line-height:14px;white-space:nowrap}
#vergabe-root .vgdichte{position:absolute;left:0;right:0;bottom:4px;height:16px}
#vergabe-root .vgdzelle{position:absolute;top:0;bottom:0;background:#4E6117;color:#FFFFFF;font-size:10px;line-height:16px;text-align:center;border-right:1px solid #FAFAF9;box-sizing:border-box;overflow:hidden}
#vergabe-root .vgheute{position:absolute;top:0;bottom:0;width:0;border-left:1.5px solid #C2410C;opacity:.55;pointer-events:none}
#vergabe-root .vgbalken{position:absolute;top:50%;height:14px;transform:translateY(-50%);border-radius:4px;cursor:pointer;background:var(--f);opacity:.42;border:1px solid var(--f);box-sizing:border-box;mix-blend-mode:multiply}
#vergabe-root .vgbalken.klein{height:12px;opacity:.75}
#vergabe-root .vgbalken.frei{background:repeating-linear-gradient(135deg,transparent 0 3px,rgba(255,255,255,.6) 3px 6px),var(--f);border-style:dashed}
#vergabe-root .vgbalken:hover{opacity:1}
#vergabe-root .vgraute{position:absolute;top:50%;width:10px;height:10px;margin:-5px 0 0 -5px;background:#1C1C1A;transform:rotate(45deg);border:2px solid #FFFFFF;box-shadow:0 0 0 1px var(--f);pointer-events:auto}
#vergabe-root .vgraute.abgeleitet{background:#FFFFFF;border:2px solid #B45309;box-shadow:none}
#vergabe-root .vgrzahl{position:absolute;left:10px;top:-12px;transform:rotate(-45deg);font-size:10px;font-weight:600;color:#1C1C1A;background:#FFFFFF;border-radius:6px;padding:0 3px}
#vergabe-root .vglegende{display:flex;flex-wrap:wrap;gap:16px;align-items:center;font-size:12px;color:#55554F;padding:8px 2px}
#vergabe-root .vglegende span{display:inline-flex;align-items:center;gap:6px}
#vergabe-root .vglg{display:inline-block;width:22px;height:10px;border-radius:3px;background:#8A8A83;opacity:.6}
#vergabe-root .vglg.leer{background:transparent;border:1px dashed #55554F}
#vergabe-root .vglg.raute{width:9px;height:9px;border-radius:0;background:#1C1C1A;transform:rotate(45deg);opacity:1}
#vergabe-root .vglg.raute.hohl{background:#FFFFFF;border:2px solid #B45309;box-sizing:border-box}
#vergabe-root .vgklein{font-size:11.5px;color:#8A8A83;line-height:1.45}
#vergabe-root .vglage{margin-top:8px;font-size:12.5px;color:#55554F}
#vergabe-root .vgabd{font-size:12.5px;color:#55554F;background:#FFFFFF;border:1px solid rgba(28,28,26,.10);border-radius:10px;padding:8px 12px;margin:0 0 12px}
#vergabe-root .vgabd.luecke{border-color:rgba(180,83,9,.35);background:#FFFBF5}
#vergabe-root .vgabd summary{cursor:pointer}
#vergabe-root .vgabd .vgdlbl{margin-top:10px}
#vergabe-root .vglage summary{cursor:pointer;padding:6px 2px}
#vergabe-root .vgtab{border-collapse:collapse;margin:6px 0 8px;font-size:12px}
#vergabe-root .vgtab th,#vergabe-root .vgtab td{text-align:left;padding:4px 14px 4px 0;border-bottom:1px solid rgba(28,28,26,.07)}
#vergabe-root .vgtab th{font-weight:600;color:#75756E}
#vergabe-root .warn{color:#B45309}
#vergabe-root .vgohne{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
#vergabe-root .vgohnez{display:inline-flex;align-items:center;gap:6px;padding:3px 9px;border-radius:999px;border:1px solid rgba(28,28,26,.12);font-size:11.5px;color:#55554F;background:#FFFFFF}
#vergabe-root .vgdetail{width:340px;flex:none;overflow-y:auto;border-left:1px solid rgba(28,28,26,.09);padding:8px 18px 24px;background:#FAFAF9}
#vergabe-root .vgdkopf{display:flex;align-items:flex-start;gap:9px;padding:6px 0 12px}
#vergabe-root .vgdkopf .vgpunkt{margin-top:6px}
#vergabe-root .vgdkopf>div{flex:1;min-width:0}
#vergabe-root .vgdtitel{font-size:14.5px;font-weight:600;color:#1C1C1A;line-height:1.35}
#vergabe-root .vgdblock{background:#FFFFFF;border:1px solid rgba(28,28,26,.10);border-radius:10px;padding:10px 12px;margin:0 0 10px}
#vergabe-root .vgdz{display:flex;justify-content:space-between;gap:10px;font-size:12.5px;padding:3px 0;color:#55554F}
#vergabe-root .vgdz b{font-weight:500;color:#1C1C1A;text-align:right}
#vergabe-root .vgdz.stark b{font-weight:600}
#vergabe-root .vgdz.warn b{color:#B45309}
#vergabe-root .vghinweis{font-size:12px;color:#B45309;padding:4px 0}
#vergabe-root .vgdlbl{font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#8A8A83;margin-bottom:6px}
#vergabe-root .vgfeld{display:flex;flex-direction:column;gap:4px;font-size:12px;color:#75756E;margin-bottom:8px;flex:1}
#vergabe-root .vgfeldreihe{display:flex;gap:10px}
#vergabe-root .vgin{font:inherit;font-size:13px;padding:7px 9px;border-radius:8px;border:1px solid rgba(28,28,26,.16);background:#FFFFFF;color:#1C1C1A;width:100%;box-sizing:border-box}
#vergabe-root .vgdknoepfe{display:flex;gap:8px;margin-top:4px}
#vergabe-root .vglage a,#vergabe-root .vgquelle a{color:#4E6117;text-decoration:underline;text-underline-offset:2px}
#vergabe-root .vgquelle{font-size:11.5px;color:#8A8A83;margin-top:6px;line-height:1.45}
`));
}
