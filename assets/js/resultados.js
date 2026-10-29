/* Resultados GA4 por campaña y mes · hoja "[Baloto] Fuente de datos", pestaña RESUMEN GENERAL
   Trae registros y compras de GA4 (y los de plataforma, como referencia) agrupados por campaña y
   mes con una consulta de Google Visualization, y los cruza con las nomenclaturas de la hoja de
   seguimiento con la misma clave que usa el cruce de consumo (sin tildes, espacios ni signos).
   Si la hoja no responde usa la copia de data/resultados_baloto.js. */
(function () {
  'use strict';

  const SHEET_ID = '1zEv8npIyHnoaEXKZDRh-vpyo88RU0WmKUgSKwSYzaMU', TAB = 'RESUMEN GENERAL';
  // A Date · B Campaign Name · G Compras · H Registros · O Source / Medium · P Compras GA4 · Q Registros GA4
  const TQ = "select B, O, year(A), month(A), sum(P), sum(Q), sum(G), sum(H) where A >= date '2025-01-01' group by B, O, year(A), month(A)";
  // Anuncios de TikTok que llevaron el utm_campaign de otra campaña hasta el 27 oct 2026 (ya corregidos en TikTok):
  // MiLoto retención de TikTok usaba el nombre de la campaña de Meta, e Italia 2 el de la Italia original.
  const MILOTO_META = 'adcom_miloto_fb_ret_conversion-rmkt-ret_miloto', MILOTO_TT = 'adcom_miloto_tiktok_ret_conversion-rmkt-ret_miloto';
  const ITALIA = 'adcom_baloto_tiktok_act_conversion_promocional-italia', ITALIA_2 = ITALIA + '_2', ITALIA_2_DESDE = '2026-10-13';
  const TQ_ITALIA = `select sum(P), sum(Q), sum(G), sum(H) where B = '${ITALIA}' and A >= date '${ITALIA_2_DESDE}'`;
  const clave = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
  const num = v => { const n = parseFloat(String(v ?? '').replace(/[^\d.-]/g, '')); return isFinite(n) ? n : 0 };

  // filas [nombre, 'YYYY-MM', compras GA4, registros GA4, compras plataforma, registros plataforma]
  function desdeCsv(txt) {
    const g = Papa.parse(txt).data.slice(1);
    return g.filter(r => r.length >= 8 && r[0]).map(r => {
      const mes = `${r[2]}-${String(num(r[3]) + 1).padStart(2, '0')}`;  // month() de gviz empieza en 0
      // los resultados de MiLoto con fuente TikTok son de la campaña de TikTok
      const nombre = r[0] === MILOTO_META && /tiktok/i.test(r[1]) ? MILOTO_TT : r[0];
      return [nombre, mes, num(r[4]), num(r[5]), num(r[6]), num(r[7])];
    });
  }
  const gviz = async tq => {
    const u = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(TAB)}&headers=1&tq=${encodeURIComponent(tq)}&_=${Date.now()}`;
    const res = await fetch(u); if (!res.ok) throw new Error(res.status);
    const txt = await res.text(); if (/<html/i.test(txt.slice(0, 200))) throw new Error('sin acceso');
    return txt;
  };

  async function cargar() {
    try {
      const filas = desdeCsv(await gviz(TQ)); if (!filas.length) throw new Error('vacía');
      // lo que la Italia original registró desde el arranque de Italia 2 es de Italia 2
      const it = (Papa.parse(await gviz(TQ_ITALIA)).data[1] || []).map(num);
      if (it.some(v => v)) {
        const mes = ITALIA_2_DESDE.slice(0, 7);
        const resta = it.slice(0, 4);  // se descuenta una sola vez, aunque la Italia original tenga una fila por fuente
        filas.forEach(f => { if (f[0] === ITALIA && f[1] === mes) for (let i = 2; i < 6; i++) { const d = Math.min(f[i], resta[i - 2] || 0); f[i] -= d; resta[i - 2] -= d } });
        filas.push([ITALIA_2, mes, it[0] || 0, it[1] || 0, it[2] || 0, it[3] || 0]);
      }
      return {filas, fuente: 'vivo'};
    } catch (e) {
      const c = window.RESULTADOS_COPIA;
      return {filas: c ? c.filas : [], fuente: c ? 'copia' : 'sin datos', copia: c ? c.fecha : ''};
    }
  }

  // Reparte los resultados de cada campaña entre las filas de la hoja con esa nomenclatura.
  // Si una nomenclatura se repite en el mes, se reparte en proporción al consumo de cada fila.
  function asignar(D, R) {
    D.campanas.forEach(f => { f.reg = 0; f.com = 0; f.regP = 0; f.comP = 0 });
    const porMes = {};
    R.filas.forEach(r => (porMes[r[1]] = porMes[r[1]] || []).push(r));
    const resumen = {};
    D.meses.forEach(mes => {
      const rows = D.campanas.filter(f => f.mes === mes && f.nom !== '(sin nomenclatura)');
      const grupos = {};
      rows.forEach(f => { const k = clave(f.nom); if (k) (grupos[k] = grupos[k] || []).push(f) });
      const keys = Object.keys(grupos);
      const t = {reg: 0, com: 0, regMap: 0, comMap: 0, sinMap: []};
      (porMes[mes] || []).forEach(([nombre, , com, reg, comP, regP]) => {
        if (nombre === '(otros)') return;                         // tráfico que no es de Adcom
        t.reg += reg; t.com += com;
        const k = clave(nombre);
        const hit = grupos[k] ? k : keys.filter(x => x.length > 8 && (k.includes(x) || x.includes(k))).sort((a, b) => b.length - a.length)[0];
        if (!hit) { if (reg || com) t.sinMap.push({nombre, reg, com}); return }
        t.regMap += reg; t.comMap += com;
        const fs = grupos[hit], base = fs.reduce((a, f) => a + f.cons, 0);
        fs.forEach(f => {
          const w = base ? f.cons / base : 1 / fs.length;
          f.reg += reg * w; f.com += com * w; f.regP += regP * w; f.comP += comP * w;
        });
      });
      resumen[mes] = t;
    });
    return resumen;
  }

  window.RES = {cargar, asignar};
})();
