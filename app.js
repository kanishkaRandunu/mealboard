/* Mealboard: weekly meal plan + grocery list. No build step, no backend. */
(() => {
  'use strict';

  const SLOTS = [
    { key: 's0', time: '12:00', label: 'First meal', type: 'first' },
    { key: 's1', time: '16:00', label: 'Second meal', type: 'main' },
    { key: 's2', time: '19:30', label: 'Third meal', type: 'main' },
    { key: 's3', time: 'Snack', label: 'Snack', type: 'snack' },
  ];
  const SLOT_NAMES = { first: 'First meal', main: 'Main meal', snack: 'Snack' };
  const SECTION_ORDER = ['Meat & fish', 'Dairy & eggs', 'Produce', 'Frozen', 'Bakery', 'Pantry'];
  const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const WEEKDAYS_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const STORE_KEY = 'mealboard:v1';

  // ---------- state ----------
  const defaults = () => ({ targets: { kcal: 2000, p: 150 }, weeks: {}, checked: {}, extras: {} });
  let state = load();
  let data = null; // meals.json
  let mealMacros = {};
  let ui = { tab: 'plan', weekStart: mondayOf(new Date()), day: dayIndex(new Date()), filter: 'all', cuisine: 'all', q: '' };

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return defaults();
      return Object.assign(defaults(), JSON.parse(raw));
    } catch (e) { return defaults(); }
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { toast('Could not save on this device'); }
  }

  // ---------- dates ----------
  function mondayOf(d) {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const offset = (x.getDay() + 6) % 7;
    x.setDate(x.getDate() - offset);
    return x;
  }
  function dayIndex(d) { return (d.getDay() + 6) % 7; }
  function isoDate(d) {
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
  }
  function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
  const weekKey = () => isoDate(ui.weekStart);

  function week(key = weekKey()) {
    if (!state.weeks[key]) state.weeks[key] = { days: Array.from({ length: 7 }, () => ({})) };
    return state.weeks[key];
  }

  // ---------- nutrition ----------
  function macrosFor(items) {
    const t = { kcal: 0, p: 0, c: 0, f: 0 };
    for (const [id, g] of items) {
      const ing = data.ingredients[id];
      if (!ing) continue;
      for (const k in t) t[k] += (ing.per100[k] * g) / 100;
    }
    return t;
  }
  function dayTotals(day) {
    const t = { kcal: 0, p: 0, c: 0, f: 0 };
    for (const s of SLOTS) {
      const m = day[s.key] && mealMacros[day[s.key]];
      if (m) for (const k in t) t[k] += m[k];
    }
    return t;
  }
  const mealById = (id) => data.meals.find((m) => m.id === id);
  const r = (n) => Math.round(n);
  const fmt = (n) => r(n).toLocaleString('en-AU');

  // ---------- helpers ----------
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $view = document.getElementById('view');
  const $sheet = document.getElementById('sheet');
  let toastTimer;
  function toast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
  }

  // ---------- render ----------
  function render() {
    const ws = ui.weekStart, we = addDays(ws, 6);
    document.getElementById('week-title').textContent =
      ws.getMonth() === we.getMonth()
        ? `${ws.getDate()}–${we.getDate()} ${MONTHS[ws.getMonth()]}`
        : `${ws.getDate()} ${MONTHS[ws.getMonth()]} – ${we.getDate()} ${MONTHS[we.getMonth()]}`;
    document.querySelectorAll('.tab').forEach((b) => {
      if (b.dataset.tab === ui.tab) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    if (ui.tab === 'plan') renderPlan();
    else if (ui.tab === 'groceries') renderGroceries();
    else renderMeals();
  }

  function renderPlan() {
    const w = week();
    const todayKey = isoDate(new Date());
    const T = state.targets;
    const shelf = w.days.map((d, i) => {
      const t = dayTotals(d);
      const date = addDays(ui.weekStart, i);
      const pct = Math.min(100, (t.kcal / T.kcal) * 100);
      const cls = ['jar', t.kcal > T.kcal ? 'over' : '', isoDate(date) === todayKey ? 'today' : ''].join(' ');
      return `<button class="${cls}" data-action="pick-day" data-day="${i}" aria-pressed="${i === ui.day}"
        aria-label="${WEEKDAYS_LONG[i]} ${date.getDate()}: ${fmt(t.kcal)} kcal, ${fmt(t.p)} g protein">
        <span class="wd">${WEEKDAYS[i]}</span><span class="dt">${date.getDate()}</span>
        <span class="glass"><span class="fill" style="height:${pct}%"></span></span>
        <span class="pdot ${t.p >= T.p ? 'met' : ''}"></span></button>`;
    }).join('');

    const day = w.days[ui.day];
    const t = dayTotals(day);
    const date = addDays(ui.weekStart, ui.day);
    const kOver = t.kcal > T.kcal;
    const slots = SLOTS.map((s) => {
      const m = day[s.key] && mealById(day[s.key]);
      const mm = m && mealMacros[m.id];
      return `<li class="slot"><button data-action="open-picker" data-slot="${s.key}">
        <span class="time">${s.time}</span>
        ${m ? `<span class="meal">${esc(m.name)}</span>` : `<span class="meal empty">Add ${s.label.toLowerCase()}</span>`}
        <span class="macro num">${mm ? `<b>${fmt(mm.kcal)}</b> kcal<br>${fmt(mm.p)} g protein` : ''}</span>
      </button></li>`;
    }).join('');

    $view.innerHTML = `
      <div class="shelf" role="group" aria-label="Days">${shelf}</div>
      <div class="day-head">
        <h2>${WEEKDAYS_LONG[ui.day]} ${date.getDate()} ${MONTHS_LONG[date.getMonth()]}</h2>
      </div>
      <div class="meters">
        <div class="meter ${kOver ? 'over' : ''}">
          <div class="row"><span>Calories</span><span class="num"><strong>${fmt(t.kcal)}</strong> / ${fmt(T.kcal)}${kOver ? `, ${fmt(t.kcal - T.kcal)} over` : ''}</span></div>
          <div class="bar"><span style="width:${Math.min(100, (t.kcal / T.kcal) * 100)}%"></span></div>
        </div>
        <div class="meter protein">
          <div class="row"><span>Protein</span><span class="num"><strong>${fmt(t.p)}</strong> / ${fmt(T.p)} g${t.p < T.p && t.kcal > 0 ? `, ${fmt(T.p - t.p)} g to go` : ''}</span></div>
          <div class="bar"><span style="width:${Math.min(100, (t.p / T.p) * 100)}%"></span></div>
        </div>
        <div class="cfb num">Carbs ${fmt(t.c)} g, fat ${fmt(t.f)} g</div>
      </div>
      <ul class="slots">${slots}</ul>
      <div class="day-actions">
        ${ui.day < 6 ? `<button class="chip-btn" data-action="copy-next">Copy to ${WEEKDAYS_LONG[ui.day + 1]}</button>` : ''}
        <button class="chip-btn" data-action="copy-prev-week">Copy last week's plan</button>
        <button class="chip-btn" data-action="clear-day">Clear day</button>
      </div>`;
  }

  function groceryItems() {
    const w = week();
    const totals = {};
    for (const d of w.days) for (const s of SLOTS) {
      const m = d[s.key] && mealById(d[s.key]);
      if (!m) continue;
      for (const [id, g] of m.items) totals[id] = (totals[id] || 0) + g;
    }
    return Object.entries(totals).map(([id, g]) => ({ id, g, ing: data.ingredients[id] })).filter((x) => x.ing);
  }
  function qtyText(ing, g) {
    if (ing.each) {
      const n = Math.ceil(g / ing.each.g - 0.05);
      return `${n} ${n === 1 ? ing.each.label : ing.each.plural}`;
    }
    const unit = ing.unit === 'ml' ? ['ml', 'L'] : ['g', 'kg'];
    const rounded = Math.ceil(g / 10) * 10;
    return rounded >= 1000 ? `${(rounded / 1000).toFixed(rounded % 1000 === 0 ? 0 : 1)} ${unit[1]}` : `${rounded} ${unit[0]}`;
  }

  function renderGroceries() {
    const key = weekKey();
    const checked = state.checked[key] || {};
    const extras = state.extras[key] || [];
    const items = groceryItems();
    const buy = items.filter((x) => !x.ing.pantry);
    const pantry = items.filter((x) => x.ing.pantry);
    const planned = week().days.reduce((n, d) => n + SLOTS.filter((s) => d[s.key]).length, 0);

    const row = (id, name, qty) => `<li class="g-item ${checked[id] ? 'done' : ''}"><label>
      <input type="checkbox" data-action="check" data-id="${esc(id)}" ${checked[id] ? 'checked' : ''}>
      <span class="name">${esc(name)}</span><span class="qty num">${esc(qty)}</span></label></li>`;

    const sections = SECTION_ORDER.map((sec) => {
      const list = buy.filter((x) => x.ing.section === sec).sort((a, b) => a.ing.name.localeCompare(b.ing.name));
      if (!list.length) return '';
      return `<section class="g-section"><h3>${esc(sec)}</h3><ul class="g-list">
        ${list.map((x) => row(x.id, x.ing.name, qtyText(x.ing, x.g))).join('')}</ul></section>`;
    }).join('');

    const extraRows = extras.map((e, i) => row(`x:${i}`, e, '')).join('');

    $view.innerHTML = `
      <div class="g-head"><h2>Groceries</h2>
        <button class="primary" data-action="share-list" ${items.length || extras.length ? '' : 'disabled'}>Share list</button></div>
      <p class="g-sub">${planned ? `From ${planned} planned ${planned === 1 ? 'meal' : 'meals'} this week. Quantities are raw weight, rounded up.` : 'Plan some meals and the list fills itself.'}</p>
      ${sections || (planned ? '' : '<p class="empty-state">Nothing to buy yet. Go to Plan and add meals to the week.</p>')}
      <section class="g-section"><h3>Other items</h3><ul class="g-list">${extraRows}</ul>
        <form class="add-row" data-action="add-extra">
          <input name="item" placeholder="Add an item, e.g. dishwashing liquid" autocomplete="off" aria-label="Add an item">
          <button class="chip-btn" type="submit">Add</button>
        </form></section>
      ${pantry.length ? `<details class="pantry"><summary>Check the pantry (${pantry.length})</summary><ul class="g-list">
        ${pantry.map((x) => row(x.id, x.ing.name, qtyText(x.ing, x.g))).join('')}</ul></details>` : ''}
      ${Object.keys(checked).length || extras.length ? '<div class="day-actions"><button class="chip-btn" data-action="reset-list">Untick all and clear added items</button></div>' : ''}`;
  }

  const matchQ = (m, q) => !q || (m.name + ' ' + (m.cuisine || '') + ' ' + (m.tags || []).join(' ')).toLowerCase().includes(q.toLowerCase());
  const subline = (m) => [SLOT_NAMES[m.slot], m.cuisine, m.prep_min ? `${m.prep_min} min` : ''].filter(Boolean).map(esc).join(', ');

  function mealRows() {
    const f = ui.filter, cz = ui.cuisine, q = ui.q || '';
    const shown = data.meals.filter((m) => (f === 'all' || m.slot === f) && (cz === 'all' || m.cuisine === cz) && matchQ(m, q));
    const list = shown.map((m) => {
      const mm = mealMacros[m.id];
      const ings = m.items.map(([id, g]) => {
        const ing = data.ingredients[id];
        const n = +(g / ing.each?.g).toFixed(1);
        const amount = ing.each ? `${g} ${ing.unit || 'g'} (${n} ${n === 1 ? ing.each.label : ing.each.plural})` : `${g} ${ing.unit || 'g'}`;
        return `<tr><td>${esc(ing.name)}</td><td class="num">${amount}</td></tr>`;
      }).join('');
      return `<li class="meal-item"><details><summary>
          <span><span class="mname">${esc(m.name)}</span><br><span class="mslot">${subline(m)}</span></span>
          <span class="macro num"><b>${fmt(mm.kcal)}</b> kcal<br>${fmt(mm.p)} g protein</span></summary>
        <div class="cfb num">Carbs ${fmt(mm.c)} g, fat ${fmt(mm.f)} g. Weights are raw or dry.</div>
        <table class="ing">${ings}</table>
        <p class="method">${esc(m.method)}</p></details></li>`;
    }).join('');
    return { count: shown.length, html: list || '<li class="empty-state">No meals match. Clear the search or pick a different type or cuisine.</li>' };
  }

  function cuisineList() { return [...new Set(data.meals.map((m) => m.cuisine).filter(Boolean))].sort((a, b) => a.localeCompare(b)); }

  function renderMeals() {
    const f = ui.filter, cz = ui.cuisine;
    const chips = [['all', 'All'], ['first', 'First meals'], ['main', 'Mains'], ['snack', 'Snacks']]
      .map(([k, l]) => `<button class="chip-btn" data-action="filter" data-filter="${k}" aria-pressed="${f === k}">${l}</button>`).join('');
    const cchips = [['all', 'All cuisines'], ...cuisineList().map((c) => [c, c])]
      .map(([k, l]) => `<button class="chip-btn" data-action="cuisine" data-cuisine="${esc(k)}" aria-pressed="${cz === k}">${esc(l)}</button>`).join('');
    const rows = mealRows();
    $view.innerHTML = `<input class="search" type="search" id="meal-q" placeholder="Search meals, e.g. kottu, salmon, batch" value="${esc(ui.q || '')}" aria-label="Search meals" autocomplete="off">
      <div class="filters" role="group" aria-label="Filter by meal type">${chips}</div>
      <div class="filters" role="group" aria-label="Filter by cuisine">${cchips}</div>
      <p class="g-sub" id="meal-count">${rows.count} of ${data.meals.length} meals</p>
      <ul class="meal-list" id="meal-list">${rows.html}</ul>
      <p class="fine">Nutrition is calculated from typical values per 100 g. Check labels in Cronometer when you save these as recipes.</p>`;
  }

  // ---------- sheets ----------
  let pick = null;
  function openPicker(slotKey) {
    pick = { slotKey, q: '', cuisine: 'all', all: false };
    const slot = SLOTS.find((s) => s.key === slotKey);
    const current = week().days[ui.day][slotKey];
    const cchips = [['all', 'All cuisines'], ...cuisineList().map((c) => [c, c])]
      .map(([k, l]) => `<button class="chip-btn" data-action="pick-cuisine" data-cuisine="${esc(k)}" aria-pressed="${k === 'all'}">${esc(l)}</button>`).join('');
    $sheet.innerHTML = `<div class="sheet-inner">
      <div class="sheet-head"><h2>${slot.time === 'Snack' ? 'Snack' : `${slot.label}, ${slot.time}`}</h2>
        <button class="text-btn" data-action="close-sheet">Done</button></div>
      <input class="search" type="search" id="pick-q" placeholder="Search meals" aria-label="Search meals" autocomplete="off">
      <div class="filters" role="group" aria-label="Filter by cuisine">${cchips}</div>
      <label class="toggle"><input type="checkbox" id="pick-all"> Show all meal types, not just ${SLOT_NAMES[slot.type].toLowerCase()}s</label>
      ${current ? `<button class="chip-btn" data-action="choose" data-slot="${slotKey}" data-meal="">Remove ${esc(mealById(current)?.name || 'meal')}</button>` : ''}
      <ul class="pick" id="pick-list"></ul></div>`;
    renderPickList();
    showSheet();
  }
  function renderPickList() {
    if (!pick) return;
    const slot = SLOTS.find((s) => s.key === pick.slotKey);
    const day = week().days[ui.day];
    const current = day[pick.slotKey];
    const others = { ...day }; delete others[pick.slotKey];
    const base = dayTotals(others);
    const T = state.targets;
    const list = data.meals
      .filter((m) => (pick.all || m.slot === slot.type) && (pick.cuisine === 'all' || m.cuisine === pick.cuisine) && matchQ(m, pick.q))
      .map((m) => ({ m, mm: mealMacros[m.id], after: base.kcal + mealMacros[m.id].kcal }))
      .sort((a, b) => (a.m.slot !== slot.type) - (b.m.slot !== slot.type) || (a.after > T.kcal) - (b.after > T.kcal) || (b.mm.p / b.mm.kcal) - (a.mm.p / a.mm.kcal));
    document.getElementById('pick-list').innerHTML = list.map(({ m, mm, after }) =>
      `<li><button data-action="choose" data-slot="${pick.slotKey}" data-meal="${m.id}" aria-current="${m.id === current}">
        <span><span class="mname">${esc(m.name)}</span><br>
        <span class="fit ${after > T.kcal ? 'bad' : ''}">${m.cuisine ? `${esc(m.cuisine)}. ` : ''}Day would be ${fmt(after)} kcal</span></span>
        <span class="macro num"><b>${fmt(mm.kcal)}</b> kcal<br>${fmt(mm.p)} g protein</span></button></li>`).join('')
      || '<li class="empty-state">No meals match. Clear the search or change the cuisine.</li>';
  }

  function openSettings() {
    const T = state.targets;
    $sheet.innerHTML = `<div class="sheet-inner">
      <div class="sheet-head"><h2>Settings</h2><button class="text-btn" data-action="close-sheet">Done</button></div>
      <form data-action="save-targets">
        <label class="field">Daily calories (kcal)<input name="kcal" type="number" inputmode="numeric" min="1000" max="5000" value="${T.kcal}"></label>
        <label class="field">Daily protein (g)<input name="p" type="number" inputmode="numeric" min="50" max="400" value="${T.p}"></label>
        <button class="primary" type="submit">Save targets</button>
      </form>
      <div class="settings-actions">
        <button class="chip-btn" data-action="export">Export backup</button>
        <label class="chip-btn">Import backup<input type="file" accept="application/json" data-action="import" hidden></label>
        <button class="chip-btn danger" data-action="clear-week">Clear this week's plan</button>
      </div>
      <p class="fine">Your plan is saved on this device only. Export a backup before switching phones.</p></div>`;
    showSheet();
  }
  function showSheet() { if (!$sheet.open) $sheet.showModal(); }
  function closeSheet() { if ($sheet.open) $sheet.close(); }
  $sheet.addEventListener('click', (e) => { if (e.target === $sheet) closeSheet(); });

  // ---------- actions ----------
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action], [data-tab]');
    if (!el) return;
    if (el.dataset.tab) { ui.tab = el.dataset.tab; render(); window.scrollTo(0, 0); return; }
    const a = el.dataset.action;
    const w = week();
    switch (a) {
      case 'prev-week': ui.weekStart = addDays(ui.weekStart, -7); render(); break;
      case 'next-week': ui.weekStart = addDays(ui.weekStart, 7); render(); break;
      case 'pick-day': ui.day = +el.dataset.day; render(); break;
      case 'open-picker': openPicker(el.dataset.slot); break;
      case 'choose': {
        const day = w.days[ui.day];
        if (el.dataset.meal) day[el.dataset.slot] = el.dataset.meal; else delete day[el.dataset.slot];
        save(); closeSheet(); render(); break;
      }
      case 'close-sheet': closeSheet(); break;
      case 'copy-next':
        w.days[ui.day + 1] = { ...w.days[ui.day] }; ui.day += 1; save(); render();
        toast(`Copied to ${WEEKDAYS_LONG[ui.day]}`); break;
      case 'copy-prev-week': {
        const prev = state.weeks[isoDate(addDays(ui.weekStart, -7))];
        if (!prev || !prev.days.some((d) => Object.keys(d).length)) { toast('Last week has no plan to copy'); break; }
        if (w.days.some((d) => Object.keys(d).length) && !confirmReplace()) break;
        state.weeks[weekKey()] = { days: prev.days.map((d) => ({ ...d })) }; save(); render(); toast('Copied last week'); break;
      }
      case 'clear-day': w.days[ui.day] = {}; save(); render(); break;
      case 'filter': ui.filter = el.dataset.filter; render(); break;
      case 'cuisine': ui.cuisine = el.dataset.cuisine; render(); break;
      case 'pick-cuisine':
        pick.cuisine = el.dataset.cuisine;
        el.parentElement.querySelectorAll('[data-action=pick-cuisine]').forEach((b) => b.setAttribute('aria-pressed', b === el));
        renderPickList(); break;
      case 'share-list': shareList(); break;
      case 'reset-list': delete state.checked[weekKey()]; delete state.extras[weekKey()]; save(); render(); break;
      case 'open-settings': openSettings(); break;
      case 'export': exportData(); break;
      case 'clear-week': state.weeks[weekKey()] = { days: Array.from({ length: 7 }, () => ({})) }; save(); closeSheet(); render(); toast('Week cleared'); break;
    }
  });
  // replacing a planned week needs a second tap, no blocking dialogs
  let replaceArmed = 0;
  function confirmReplace() {
    if (Date.now() - replaceArmed < 4000) { replaceArmed = 0; return true; }
    replaceArmed = Date.now(); toast('Tap again to replace this week'); return false;
  }

  document.addEventListener('change', (e) => {
    const el = e.target;
    if (el.dataset.action === 'check') {
      const key = weekKey();
      state.checked[key] = state.checked[key] || {};
      if (el.checked) state.checked[key][el.dataset.id] = true; else delete state.checked[key][el.dataset.id];
      save(); el.closest('.g-item').classList.toggle('done', el.checked);
    }
    if (el.dataset.action === 'import' && el.files[0]) importData(el.files[0]);
    if (el.id === 'pick-all') { pick.all = el.checked; renderPickList(); }
  });

  document.addEventListener('input', (e) => {
    if (e.target.id === 'meal-q') {
      ui.q = e.target.value;
      const rows = mealRows();
      document.getElementById('meal-list').innerHTML = rows.html;
      document.getElementById('meal-count').textContent = `${rows.count} of ${data.meals.length} meals`;
    }
    if (e.target.id === 'pick-q') { pick.q = e.target.value; renderPickList(); }
  });
  document.addEventListener('submit', (e) => {
    const form = e.target; e.preventDefault();
    if (form.dataset.action === 'add-extra') {
      const v = form.item.value.trim(); if (!v) return;
      const key = weekKey(); (state.extras[key] = state.extras[key] || []).push(v);
      save(); render(); document.querySelector('.add-row input')?.focus();
    }
    if (form.dataset.action === 'save-targets') {
      const kcal = +form.kcal.value, p = +form.p.value;
      if (!(kcal >= 1000 && kcal <= 5000 && p >= 50 && p <= 400)) { toast('Use 1,000–5,000 kcal and 50–400 g protein'); return; }
      state.targets = { kcal, p }; save(); closeSheet(); render(); toast('Targets saved');
    }
  });

  async function shareList() {
    const key = weekKey();
    const checked = state.checked[key] || {};
    const items = groceryItems().filter((x) => !x.ing.pantry && !checked[x.id]);
    const lines = [`Groceries, week of ${ui.weekStart.getDate()} ${MONTHS[ui.weekStart.getMonth()]}`];
    for (const sec of SECTION_ORDER) {
      const list = items.filter((x) => x.ing.section === sec);
      if (!list.length) continue;
      lines.push('', sec);
      list.sort((a, b) => a.ing.name.localeCompare(b.ing.name)).forEach((x) => lines.push(`• ${x.ing.name}: ${qtyText(x.ing, x.g)}`));
    }
    const extras = (state.extras[key] || []).filter((_, i) => !checked[`x:${i}`]);
    if (extras.length) { lines.push('', 'Other'); extras.forEach((x) => lines.push(`• ${x}`)); }
    const text = lines.join('\n');
    try {
      if (navigator.share) { await navigator.share({ text }); return; }
      await navigator.clipboard.writeText(text); toast('List copied');
    } catch (err) {
      if (err && err.name === 'AbortError') return;
      try { await navigator.clipboard.writeText(text); toast('List copied'); } catch (e2) { toast('Could not share the list'); }
    }
  }

  function exportData() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `mealboard-backup-${isoDate(new Date())}.json`;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function importData(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!parsed || typeof parsed.weeks !== 'object') throw new Error('bad');
        state = Object.assign(defaults(), parsed); save(); closeSheet(); render(); toast('Backup imported');
      } catch (e) { toast('That file is not a Mealboard backup'); }
    };
    reader.readAsText(file);
  }

  // ---------- boot ----------
  async function boot() {
    try {
      const res = await fetch('meals.json', { cache: 'no-cache' });
      data = await res.json();
    } catch (e) {
      $view.innerHTML = '<p class="empty-state">Could not load the meal library. Check your connection and reopen the app.</p>';
      return;
    }
    for (const m of data.meals) mealMacros[m.id] = macrosFor(m.items);
    render();
  }
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
  boot();
})();
