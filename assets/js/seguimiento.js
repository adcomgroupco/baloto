/* Seguimiento de presupuesto de Baloto. Misma estructura que los seguimientos de
   adcomgroupco/seguimientos-eros (resumen del mes, alertas, medios, campañas e histórico) y,
   además, registros y compras de GA4 por campaña, medio y total (assets/js/resultados.js). */
(function () {
  'use strict';
  const S = window.SEG, KEY = window.CUENTA, CFG = S.CUENTAS[KEY], F = S.fmt(CFG.moneda);
  const {esc, fP, div, pace, paceCol, mesLbl, mesCorto, fDate, suma} = S;
  const $ = id => document.getElementById(id);
  let D = null, CHARTS = {}, RESUMEN = {}, R = null;
  const fN = n => (n && isFinite(n)) ? Math.round(n).toLocaleString('es-CO') : '—';
  const costo = (c, n) => n >= 1 ? F.full(c / n) : '—';
  const res = rows => rows.reduce((a, f) => (a.reg += f.reg || 0, a.com += f.com || 0, a), {reg: 0, com: 0});

  const pbar = f => `<div class="pbar" title="Consumo ${fP(f.pc)} · esperado ${fP(div(f.esp, f.ppto))}"><i style="width:${Math.min(f.pc || 0, 1) * 100}%;background:${paceCol(f.pace)}"></i><b style="left:${Math.min(div(f.esp, f.ppto) || 0, 1) * 100}%"></b></div>`;
  const tr = (c, cls) => `<tr class="${cls || ''}">${c.map((x, i) => `<td class="${i ? 'r' : ''}">${x}</td>`).join('')}</tr>`;
  const sevCls = s => s >= 3 ? 'p-neg' : s === 2 ? 'p-mid' : 'p-pos';

  function filtradas(mes) {
    const md = $('f-medio').value, dm = $('f-dim') ? $('f-dim').value : '', es = $('f-estado').value;
    return D.campanas.filter(f => (!mes || f.mes === mes) && (!md || f.medio === md) && (!dm || f.dim === dm) && (!es || f.est === es));
  }

  function render() {
    const mes = $('f-mes').value, rows = filtradas(mes), T = suma(rows);
    const act = rows.filter(f => f.est === 'Activado'), pend = rows.filter(f => f.est === 'Pendiente');
    const enCurso = D.corte.slice(0, 7) === mes;
    const k = (l, v, sub, extra) => `<div class="card kpi-card"><div class="kpi-label">${l}</div><div class="kpi-value">${v}</div>${sub ? `<div class="kpi-sub">${sub}</div>` : ''}${extra || ''}</div>`;
    const bar = (lbl, p, cls) => `<div class="kpi-bwrap"><div class="kpi-brow"><span>${lbl}</span><b>${fP(p)}</b></div><div class="kpi-bar"><div class="kpi-bfill ${cls || 'bg-pos'}" style="width:${Math.min(p || 0, 1) * 100}%"></div></div></div>`;

    // consumo de plataformas del mes, solo en los medios con API
    const am = S.apiMes(D.api, mes);
    const medApi = Object.keys(S.MEDIOS_API).filter(m => (am.por[S.MEDIOS_API[m]] || 0) > 0 && (!$('f-medio').value || $('f-medio').value === m));
    const plat = medApi.reduce((a, m) => a + am.por[S.MEDIOS_API[m]], 0);
    const hojaMed = rows.filter(f => medApi.includes(f.medio)).reduce((a, f) => a + f.cons, 0);
    const filtroDim = $('f-dim') && $('f-dim').value;

    $('kpi-grid').innerHTML = [
      k('Presupuesto', F.corto(T.ppto), `${rows.length} campañas`),
      k('Consumo en la hoja', F.corto(T.cons), `${fP(T.pc)} del presupuesto`, bar('Consumo', T.pc)),
      k('Esperado a la fecha', F.corto(T.esp), enCurso ? `al ${fDate(D.corte)}` : 'mes cerrado', bar('Ideal', div(T.esp, T.ppto), 'bg-mid')),
      k('Pacing', `<span class="pill ${pace(T.pace)}" style="font-size:16px;padding:3px 12px">${fP(T.pace)}</span>`, 'consumo ÷ esperado'),
      k('Por consumir', F.corto(T.rem), enCurso ? `${act.length} activas · ${pend.length} pendientes` : `${pend.length} pendientes`),
      k('Plataformas', plat && !filtroDim ? F.corto(plat) : '—', plat && !filtroDim ? `${medApi.join(', ')} · hoja ${F.corto(hojaMed)}` : filtroDim ? 'no aplica con filtro de ' + CFG.dim.label.toLowerCase() : 'sin datos de API'),
    ].join('');
    $('kpi-note').textContent = `${mesLbl(mes)} · corte ${fDate(D.corte)}`;

    // resultados GA4: sin filtros, el total de la pauta del mes; con filtros, lo que suman las campañas filtradas
    const sinFiltro = !$('f-medio').value && !($('f-dim') && $('f-dim').value) && !$('f-estado').value;
    const Rm = RESUMEN[mes] || {reg: 0, com: 0, regMap: 0, comMap: 0, sinMap: []}, Rf = res(rows);
    const reg = sinFiltro ? Rm.reg : Rf.reg, com = sinFiltro ? Rm.com : Rf.com;
    const nSin = sinFiltro ? Rm.sinMap.length : 0;
    const subMap = (tot, map, u) => nSin && tot - map >= 1 ? `${fN(tot - map)} ${u} de campañas fuera de la hoja` : 'GA4 · campañas de la hoja';
    $('res-grid').innerHTML = [
      k('Registros GA4', fN(reg), subMap(Rm.reg, Rm.regMap, 'registros')),
      k('Costo por registro', costo(T.cons, reg), 'consumo de la hoja ÷ registros'),
      k('Compras GA4', fN(com), subMap(Rm.com, Rm.comMap, 'compras')),
      k('Costo por compra', costo(T.cons, com), 'consumo de la hoja ÷ compras'),
    ].join('');
    $('res-note').textContent = R.fuente === 'vivo' ? `${mesLbl(mes)} · hoja de fuente de datos en vivo` : R.fuente === 'copia' ? `${mesLbl(mes)} · copia del ${fDate(R.copia)}` : 'sin datos de resultados';
    renderAlertas(mes); renderCruce(mes); renderMedio(rows); renderCamp(); renderHist();
  }

  function renderAlertas(mes) {
    const A = S.alertas(D), box = $('alertas');
    if (A.mes !== mes) {
      box.innerHTML = `<div class="card notice">Las alertas se calculan para el mes en curso (<b>${mesLbl(A.mes)}</b>). <a href="#" id="ir-curso">Ver ${mesLbl(A.mes).toLowerCase()}</a></div>`;
      $('ir-curso').onclick = e => { e.preventDefault(); $('f-mes').value = A.mes; render() };
      return;
    }
    box.innerHTML = `<div class="alert-list">${A.lista.map(a => `<div class="card alert alert-${a.sev}">
      <span class="pill ${sevCls(a.sev)}">${esc(a.tipo)}</span><p>${esc(a.txt)}</p>
      ${a.campanas ? `<small>${a.campanas.slice(0, 4).map(esc).join(' · ')}${a.campanas.length > 4 ? ' …' : ''}</small>` : ''}</div>`).join('')}</div>`;
  }

  // Consumo mapeado vs plataforma: campañas que gastan sin estar en la hoja y conciliación por nomenclatura
  function renderCruce(mes) {
    const X = S.cruce(D, mes), k = (l, v, sub, extra) => `<div class="card kpi-card"><div class="kpi-label">${l}</div><div class="kpi-value">${v}</div>${sub ? `<div class="kpi-sub">${sub}</div>` : ''}${extra || ''}</div>`;
    if (!X) {
      $('cruce-kpi').innerHTML = `<div class="card notice" style="grid-column:1/-1">No hay consumo por campaña de las plataformas para ${mesLbl(mes).toLowerCase()}.</div>`;
      $('sinmap-body').innerHTML = $('concil-body').innerHTML = ''; $('cruce-note').textContent = ''; return;
    }
    const U = S.umbral(CFG.moneda), hayFuga = X.sinMap > U;
    const mapH = X.grupos.filter(g => g.plat).reduce((a, g) => a + g.hoja, 0);
    const difMap = div(mapH - X.mapeado, X.mapeado);
    const pill = (cls, t) => `<span class="pill ${cls}" style="font-size:16px;padding:3px 12px">${t}</span>`;
    $('cruce-kpi').innerHTML = [
      k('Consumo en plataforma', F.corto(X.total), `${X.sinMapear.length + X.grupos.reduce((a, g) => a + g.campanas.length, 0)} campañas con gasto`),
      k('Mapeado en la hoja', F.corto(X.mapeado), `${fP(X.pc)} del consumo en plataforma`, `<div class="kpi-bwrap"><div class="kpi-bar"><div class="kpi-bfill ${X.pc >= .98 ? 'bg-pos' : X.pc >= .9 ? 'bg-mid' : 'bg-neg'}" style="width:${Math.min(X.pc || 0, 1) * 100}%"></div></div></div>`),
      k('Sin mapear', hayFuga ? pill(X.sinMap > X.total * .02 ? 'p-neg' : 'p-mid', F.corto(X.sinMap)) : pill('p-pos', 'Todo mapeado'), hayFuga ? `${X.sinMapear.length} ${X.sinMapear.length === 1 ? 'campaña' : 'campañas'} fuera de la hoja` : 'ninguna campaña gasta por fuera'),
      k('Hoja vs plataforma', difMap === null ? '—' : pill(Math.abs(difMap) <= .05 ? 'p-pos' : Math.abs(difMap) <= .15 ? 'p-mid' : 'p-neg', (difMap > 0 ? '+' : '') + fP(difMap)), `en lo mapeado: hoja ${F.corto(mapH)} · plataforma ${F.corto(X.mapeado)}`),
    ].join('');
    $('sinmap-body').innerHTML = X.sinMapear.length
      ? X.sinMapear.map(c => `<tr><td>${esc(c.plat)}</td><td class="td-nom" title="${esc(c.nombre)}">${esc(c.nombre)}</td><td class="r t-neg">${F.full(c.valor)}</td></tr>`).join('')
        + `<tr class="tr-total"><td colspan="2">Total sin mapear</td><td class="r">${F.full(X.sinMap)}</td></tr>`
      : `<tr><td colspan="3"><span class="pill p-pos">Sin fugas</span> Todas las campañas con gasto en ${mesLbl(mes).toLowerCase()} están en la hoja.</td></tr>`;
    const estadoG = g => !g.plat ? (g.hoja ? ['p-neg', 'no está en plataforma'] : ['p-off', 'sin gasto']) : Math.abs(g.dif) <= Math.max(U, g.plat * .05) ? ['p-pos', 'cuadra'] : ['p-mid', g.dif > 0 ? 'hoja mayor' : 'hoja menor'];
    $('concil-body').innerHTML = [...X.grupos].sort((a, b) => Math.abs(b.dif) - Math.abs(a.dif)).map(g => {
      const [cls, t] = estadoG(g);
      return `<tr><td class="td-nom" title="${esc(g.nom)}${g.campanas.length ? ' ← ' + esc(g.campanas.join(' · ')) : ''}">${esc(g.nom)}</td><td class="r">${F.full(g.hoja)}</td><td class="r">${F.full(g.plat)}</td><td class="r">${F.full(g.dif)}</td><td><span class="pill ${cls}">${t}</span></td></tr>`;
    }).join('');
    $('cruce-note').textContent = `${mesLbl(mes)} · plataformas al ${fDate(D.api.hasta)}, hoja al ${fDate(D.corte)} · no aplica filtros de medio ni estado`;
  }

  function grupo(rows, key, orden) {
    const m = {}; rows.forEach(f => (m[f[key]] = m[f[key]] || []).push(f));
    const ks = Object.keys(m).sort((a, b) => orden ? orden.indexOf(a) - orden.indexOf(b) : suma(m[b]).ppto - suma(m[a]).ppto);
    return ks.map(x => [x, suma(m[x])]);
  }

  function barras(id, data, lbl) {
    if (CHARTS[id]) CHARTS[id].destroy();
    CHARTS[id] = new Chart($(id), {type: 'bar',
      data: {labels: data.map(d => lbl ? lbl(d[0]) : d[0]), datasets: [
        {label: 'Presupuesto', data: data.map(d => d[1].ppto / F.escala), backgroundColor: '#d4d4d4', borderRadius: 4},
        {label: 'Consumo', data: data.map(d => d[1].cons / F.escala), backgroundColor: '#ffd400', borderRadius: 4}]},
      options: {maintainAspectRatio: false, plugins: {legend: {position: 'bottom'}, tooltip: {callbacks: {label: c => `${c.dataset.label}: ${F.full(c.raw * F.escala)}`}}},
        scales: {y: {ticks: {callback: F.eje}, grid: {color: '#f0f0f0'}}, x: {grid: {display: false}}}}});
  }

  function renderMedio(rows) {
    const gm = grupo(rows, 'medio');
    barras('ch-medio', gm);
    const conEtapa = rows.some(f => f.etapa && f.etapa !== 'OTRA');
    if (conEtapa) { $('ch2-h').textContent = 'Presupuesto y consumo por etapa'; barras('ch-2', grupo(rows, 'etapa', S.ETAPAS), e => S.ET_LBL[e]) }
    else if (CFG.dim) { $('ch2-h').textContent = `Presupuesto y consumo por ${CFG.dim.label.toLowerCase()}`; barras('ch-2', grupo(rows, 'dim')) }
    else { $('ch2-h').textContent = 'Presupuesto y consumo por estado'; barras('ch-2', grupo(rows, 'est', S.ESTADOS)) }
    const th = ['Medio', 'Campañas', 'Presupuesto', 'Consumo', '% consumo', 'Esperado', 'Pacing', 'Por consumir', 'Registros', 'Costo por registro', 'Compras', 'Costo por compra'];
    const rx = (lista, t) => { const r = res(lista); return [fN(r.reg), costo(t.cons, r.reg), fN(r.com), costo(t.cons, r.com)] };
    $('medio-head').innerHTML = `<tr>${th.map((h, i) => `<th class="${i ? 'r' : ''}">${h}</th>`).join('')}</tr>`;
    const T = suma(rows);
    $('medio-body').innerHTML = gm.map(([m, t]) => tr([`<b>${esc(m)}</b>`, t.n, F.full(t.ppto), F.full(t.cons), fP(t.pc), F.full(t.esp), `<span class="pill ${pace(t.pace)}">${fP(t.pace)}</span>`, F.full(t.rem), ...rx(rows.filter(f => f.medio === m), t)])).join('')
      + tr(['Total', rows.length, F.full(T.ppto), F.full(T.cons), fP(T.pc), F.full(T.esp), `<span class="pill ${pace(T.pace)}">${fP(T.pace)}</span>`, F.full(T.rem), ...rx(rows, T)], 'tr-total');
  }

  function renderCamp() {
    const mes = $('f-mes').value, q = $('q').value.toLowerCase();
    const rows = filtradas(mes).filter(f => !q || (f.nom + ' ' + f.medio + ' ' + (f.dim || '') + ' ' + f.programa).toLowerCase().includes(q));
    const conEtapa = rows.some(f => f.etapa && f.etapa !== 'OTRA'), conProg = rows.some(f => f.programa);
    const extra = [CFG.dim ? CFG.dim.label : null, conProg ? 'Programa' : null, conEtapa ? 'Etapa' : null].filter(Boolean);
    const th = ['Campaña', ...extra, 'Medio', 'Estado', 'Fechas', 'Presupuesto', 'Consumo', 'Avance', 'Pacing', 'Por consumir', 'Diario sug.', 'Registros', 'Compras'];
    const rc = (n, c) => n >= 1 ? `${fN(n)}<small class="cpx">${costo(c, n)} c/u</small>` : '—';
    const nTxt = 4 + extra.length;
    $('camp-head').innerHTML = `<tr>${th.map((h, i) => `<th class="${i > nTxt ? 'r' : ''}">${h}</th>`).join('')}</tr>`;
    const estCls = e => e === 'Activado' ? 'p-pos' : e === 'Pendiente' ? 'p-mid' : e === 'Detenido' ? 'p-neg' : 'p-off';
    const bloques = [...new Set(rows.map(f => f.bloque))];
    const corta = (s, n) => s.length > n ? s.slice(0, n - 2) + '…' : s;
    let html = '';
    bloques.forEach(b => {
      const rs = rows.filter(f => f.bloque === b).sort((x, y) => (conEtapa ? S.ETAPAS.indexOf(x.etapa) - S.ETAPAS.indexOf(y.etapa) : 0) || y.ppto - x.ppto);
      if (bloques.length > 1) html += `<tr class="blk"><td colspan="${th.length}">${esc(b)} · ${rs.length}</td></tr>`;
      html += rs.map(f => `<tr>
        <td title="${esc(f.nom)}">${esc(corta(f.nom, 44))}</td>
        ${CFG.dim ? `<td>${esc(f.dim)}</td>` : ''}${conProg ? `<td title="${esc(f.programa)}">${esc(corta(titleCase(f.programa), 30))}</td>` : ''}${conEtapa ? `<td>${S.ET_LBL[f.etapa]}</td>` : ''}
        <td>${esc(f.medio)}</td>
        <td><span class="pill ${estCls(f.est)}">${esc(f.est)}</span></td>
        <td>${f.ini === f.fin ? fDate(f.ini) : `${fDate(f.ini)} – ${fDate(f.fin)}`}</td>
        <td class="r">${F.full(f.ppto)}</td><td class="r">${F.full(f.cons)}</td>
        <td class="r">${pbar(f)}</td>
        <td class="r">${f.est === 'Pendiente' && !f.cons ? '<span class="pill p-off">sin iniciar</span>' : `<span class="pill ${pace(f.pace)}">${fP(f.pace)}</span>`}</td>
        <td class="r${f.rem < 0 ? ' t-neg' : ''}">${F.full(f.rem)}</td><td class="r">${f.diario ? F.full(f.diario) : '—'}</td>
        <td class="r">${rc(f.reg, f.cons)}</td><td class="r">${rc(f.com, f.cons)}</td></tr>`).join('');
    });
    const T = suma(rows);
    html += `<tr class="tr-total"><td colspan="${nTxt + 1}">Total</td><td class="r">${F.full(T.ppto)}</td><td class="r">${F.full(T.cons)}</td><td class="r">${pbar(T)}</td><td class="r"><span class="pill ${pace(T.pace)}">${fP(T.pace)}</span></td><td class="r">${F.full(T.rem)}</td><td></td><td class="r">${rc(res(rows).reg, T.cons)}</td><td class="r">${rc(res(rows).com, T.cons)}</td></tr>`;
    $('camp-body').innerHTML = html;
    $('camp-note').textContent = `${rows.length} campañas · ${mesLbl(mes)}`;
  }
  const titleCase = s => String(s || '').toLowerCase().replace(/(^|\s)\S/g, c => c.toUpperCase());

  // Histórico: presupuesto de la hoja; consumo de la hoja o de las plataformas según la cuenta
  function historico() {
    const rows = filtradas(''), api = D.api ? D.api.mensual : {};
    const primero = D.meses[0] || '';
    const meses = [...new Set([...D.meses, ...Object.keys(api).filter(m => m >= primero && Object.values(api[m]).some(v => v > 0))])].sort().slice(-15);
    return meses.map(m => {
      const t = suma(rows.filter(f => f.mes === m)), am = S.apiMes(D.api, m);
      const cons = CFG.hist === 'api' ? am.total : t.cons;
      const filtro = $('f-medio').value || ($('f-dim') && $('f-dim').value) || $('f-estado').value;
      const r = filtro ? res(rows.filter(f => f.mes === m)) : (RESUMEN[m] || {reg: 0, com: 0});
      return {m, ppto: t.ppto, hoja: t.cons, plat: am.total, por: am.por, cons, pc: div(cons, t.ppto), n: t.n, reg: r.reg, com: r.com};
    });
  }

  function renderHist() {
    const H = historico(), sel = $('f-mes').value;
    if (CHARTS.hist) CHARTS.hist.destroy();
    CHARTS.hist = new Chart($('ch-hist'), {type: 'bar',
      data: {labels: H.map(h => mesCorto(h.m)), datasets: [
        {label: 'Presupuesto (hoja)', data: H.map(h => h.ppto / F.escala), backgroundColor: H.map(h => h.m === sel ? '#a3a3a3' : '#d4d4d4'), borderRadius: 4},
        {label: CFG.hist === 'api' ? 'Consumo (plataformas)' : 'Consumo (hoja)', data: H.map(h => h.cons / F.escala), backgroundColor: H.map(h => h.m === sel ? '#111' : '#ffd400'), borderRadius: 4}]},
      options: {maintainAspectRatio: false, plugins: {legend: {position: 'bottom'}, tooltip: {callbacks: {label: c => `${c.dataset.label}: ${F.full(c.raw * F.escala)}`}}},
        onClick: (e, el) => { if (el.length && D.meses.includes(H[el[0].index].m)) { $('f-mes').value = H[el[0].index].m; render() } },
        scales: {y: {ticks: {callback: F.eje}, grid: {color: '#f0f0f0'}}, x: {grid: {display: false}}}}});

    const medios = Object.keys(S.MEDIOS_API).filter(m => H.some(h => (h.por[S.MEDIOS_API[m]] || 0) > 0));
    const filtro = $('f-medio').value || ($('f-dim') && $('f-dim').value) || $('f-estado').value;
    $('hist-head').innerHTML = `<tr><th>Mes</th><th class="r">Presupuesto</th><th class="r">Consumo</th><th class="r">% ejecución</th><th class="r grp">Consumo hoja</th><th class="r">Plataformas</th><th class="r">Hoja vs plat.</th>${medios.map(m => `<th class="r">${m}</th>`).join('')}<th class="r grp">Registros GA4</th><th class="r">Costo por registro</th><th class="r">Compras GA4</th><th class="r">Costo por compra</th></tr>`;
    $('hist-body').innerHTML = [...H].reverse().map(h => {
      const dif = div(h.hoja - h.plat, h.plat), d = dif === null ? '—' : `<span class="pill ${Math.abs(dif) <= .1 ? 'p-pos' : Math.abs(dif) <= .25 ? 'p-mid' : 'p-neg'}">${dif > 0 ? '+' : ''}${fP(dif)}</span>`;
      const pc = h.pc === null ? '—' : `<span class="pill ${h.pc > 1.05 ? 'p-neg' : h.pc >= .9 ? 'p-pos' : h.pc >= .75 ? 'p-mid' : 'p-neg'}">${fP(h.pc)}</span>`;
      return `<tr style="cursor:${D.meses.includes(h.m) ? 'pointer' : 'default'}${h.m === sel ? ';font-weight:700' : ''}" data-mes="${h.m}">
        <td>${mesLbl(h.m)}</td><td class="r">${h.n ? F.full(h.ppto) : '<span class="t-mute">sin bloque</span>'}</td><td class="r">${F.full(h.cons)}</td><td class="r">${pc}</td>
        <td class="r grp">${F.full(h.hoja)}</td><td class="r">${F.full(h.plat)}</td><td class="r">${filtro ? '—' : d}</td>
        ${medios.map(m => `<td class="r">${F.full(h.por[S.MEDIOS_API[m]] || 0)}</td>`).join('')}
        <td class="r grp">${fN(h.reg)}</td><td class="r">${costo(h.hoja, h.reg)}</td><td class="r">${fN(h.com)}</td><td class="r">${costo(h.hoja, h.com)}</td></tr>`;
    }).join('');
    $('hist-body').querySelectorAll('tr[data-mes]').forEach(r => r.onclick = () => {
      if (!D.meses.includes(r.dataset.mes)) return;
      $('f-mes').value = r.dataset.mes; render(); $('sec-kpi').scrollIntoView({behavior: 'smooth'});
    });
    $('hist-note').textContent = CFG.hist === 'api'
      ? 'consumo del gráfico: plataformas (Meta, Google Ads, TikTok)'
      : 'consumo del gráfico: hoja de seguimiento';
  }

  function resetFilters() {
    ['f-medio', 'f-dim', 'f-estado'].forEach(id => { if ($(id)) $(id).value = '' });
    $('q').value = '';
    $('f-mes').value = D.meses.includes(D.corte.slice(0, 7)) ? D.corte.slice(0, 7) : D.meses[D.meses.length - 1];
    render();
  }

  (async () => {
    document.title = `Seguimiento ${CFG.nombre}`;
    $('cliente').textContent = `${CFG.sub} · presupuesto y resultados`;
    if (CFG.dim) $('dim-fg').innerHTML = `<span class="fl">${CFG.dim.label}</span><select id="f-dim"><option value="">Todas</option></select>`;
    else $('dim-fg').remove();
    [D, R] = await Promise.all([S.leer(KEY), RES.cargar()]);
    RESUMEN = RES.asignar(D, R);
    const opt = (id, vals) => $(id) && $(id).insertAdjacentHTML('beforeend', vals.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join(''));
    $('f-mes').innerHTML = [...D.meses].reverse().map(m => `<option value="${m}">${mesLbl(m)}</option>`).join('');
    opt('f-medio', [...new Set(D.campanas.map(f => f.medio))].sort());
    opt('f-dim', [...new Set(D.campanas.map(f => f.dim))].filter(Boolean).sort());
    opt('f-estado', S.ESTADOS.filter(e => D.campanas.some(f => f.est === e)));
    ['f-mes', 'f-medio', 'f-dim', 'f-estado'].forEach(id => $(id) && ($(id).onchange = render));
    $('q').oninput = renderCamp; $('btn-reset').onclick = resetFilters;
    $('corte-side').textContent = fDate(D.corte) + '/' + D.corte.slice(0, 4);
    $('last-upd').textContent = D.fuente === 'vivo' ? 'Hoja en vivo' : `Copia del ${fDate(D.copia)}`;
    const apiTxt = D.api ? ` Consumo de plataformas al <b>${fDate(D.api.hasta)}/${D.api.hasta.slice(0, 4)}</b> (${D.api.cuentas.map(c => esc(c.name)).join(', ')}).` : '';
    $('fuente-note').innerHTML = `<b>Fuente</b>: pestaña ${esc(CFG.nombre)} de la hoja de seguimiento${D.fuente === 'vivo' ? ', leída en vivo al abrir la página' : ' (copia guardada; la hoja no respondió)'}. Corte de la hoja: <b>${fDate(D.corte)}/${D.corte.slice(0, 4)}</b>.${apiTxt} ${esc(CFG.nota)} <b>Registros y compras</b>: GA4, de la hoja de fuente de datos (RESUMEN GENERAL), cruzados con las nomenclaturas por nombre de campaña.`;
    resetFilters();
    $('loading').style.display = 'none';
  })();
})();
