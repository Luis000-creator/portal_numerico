// ============================================================================
// Itera - Graficadora Module
// ============================================================================
// Graficadora liviana en canvas (sin dependencias externas): dibuja la
// función calculada con ejes, cuadrícula, intervalo [a,b] y raíz aproximada.
// Usa evaluarFuncion() compartido, así que respeta log = base 10, ln = natural.
//
// opts (todos opcionales):
//   expr     expresión principal
//   rango    [xmin, xmax] rango exacto en X (sin padding ni líneas)
//   a, b     bracket/intervalo: padding del rango + líneas punteadas
//   xs       array de x visitados (define el rango)
//   raiz     punto marcado sobre la curva principal
//   identidad true → dibuja la recta y = x (método de punto fijo)
//   titulo   texto del encabezado del bloque de gráfica
//   curvas   [{ expr, color, etiqueta, discontinua }]  curvas adicionales
//   puntos   [{ x, y, color, etiqueta, r }]  dispersión (datos interpolados)
//   marca(s) { x, y, color, etiqueta, radio } punto(s) marcado(s)
//   sombra   { a, b, color }                 área sombreada bajo la curva
//   etiqueta nombre de la curva principal en la leyenda
// ============================================================================

const GRAF_N = 240;
const GRAF_ALTO = 280;
const GRAF_N_SOMBRA = 160;

let ultimoGrafico = null;

// Paso "bonito" (1/2/5 × 10^n) para la cuadrícula
function grafPasoBonito(rango, objetivo = 6) {
    const bruto = rango / objetivo;
    const mag = Math.pow(10, Math.floor(Math.log10(bruto)));
    const norm = bruto / mag;
    return (norm >= 5 ? 5 : norm >= 2 ? 2 : 1) * mag;
}

// Muestrea una expresión en [xmin, xmax] con GRAF_N puntos
function grafMuestrear(expr, xmin, xmax) {
    const pts = [];
    for (let i = 0; i <= GRAF_N; i++) {
        const x = xmin + ((xmax - xmin) * i) / GRAF_N;
        pts.push({ x, y: evaluarFuncion(expr, x) });
    }
    return pts;
}

// Dibuja expr en el canvas #grafica.
function graficarResultado(expr, opts = {}) {
    const canvas = document.getElementById('grafica');
    const cont = document.getElementById('grafica-container');
    const msg = document.getElementById('grafica-msg');
    if (!canvas || !cont) return;
    ultimoGrafico = { expr, opts };

    const mostrarMsg = (t) => {
        canvas.style.display = 'none';
        if (msg) { msg.textContent = t; msg.style.display = 'block'; }
        cont.style.display = 'block';
    };
    const ocultarMsg = () => { if (msg) msg.style.display = 'none'; };

    try {
        if (!expr || typeof evaluarFuncion !== 'function') { cont.style.display = 'none'; return; }

        // --- Curvas a dibujar (principal + adicionales) ---
        const curvas = [{ expr, color: '#00f0ff', etiqueta: opts.etiqueta || 'f(x)' }]
            .concat(Array.isArray(opts.curvas) ? opts.curvas : [])
            .filter(c => c && c.expr);
        const puntos = Array.isArray(opts.puntos) ? opts.puntos : [];

        // --- Rango X ---
        let xmin, xmax;
        const a = opts.a, b = opts.b;
        if (Array.isArray(opts.rango) && opts.rango.length === 2
            && Number.isFinite(opts.rango[0]) && Number.isFinite(opts.rango[1])
            && opts.rango[1] > opts.rango[0]) {
            // Rango exacto, sin padding ni líneas de intervalo
            xmin = opts.rango[0]; xmax = opts.rango[1];
        } else if (Number.isFinite(a) && Number.isFinite(b) && a < b) {
            const pad = Math.max((b - a) * 0.25, 1e-6);
            xmin = a - pad; xmax = b + pad;
        } else if (Array.isArray(opts.xs) && opts.xs.length) {
            const vistos = opts.xs.filter(Number.isFinite);
            if (!vistos.length) { cont.style.display = 'none'; return; }
            let lo = Math.min(...vistos), hi = Math.max(...vistos);
            if (!(hi > lo)) { lo -= 1; hi += 1; }
            const pad = Math.max((hi - lo) * 0.25, 1e-6);
            xmin = lo - pad; xmax = hi + pad;
        } else if (puntos.length) {
            const xsP = puntos.map(p => p.x).filter(Number.isFinite);
            if (!xsP.length) { cont.style.display = 'none'; return; }
            let lo = Math.min(...xsP), hi = Math.max(...xsP);
            if (!(hi > lo)) { lo -= 1; hi += 1; }
            const pad = Math.max((hi - lo) * 0.25, 1e-6);
            xmin = lo - pad; xmax = hi + pad;
        } else if (Number.isFinite(opts.raiz)) {
            const d = Math.max(1, Math.abs(opts.raiz));
            xmin = opts.raiz - d; xmax = opts.raiz + d;
        } else { cont.style.display = 'none'; return; }
        if (!(xmax > xmin)) { cont.style.display = 'none'; return; }

        // --- Muestreo de todas las curvas (se corta en discontinuidades) ---
        const muestras = curvas.map(c => ({ curva: c, pts: grafMuestrear(c.expr, xmin, xmax) }));
        let ys = muestras.reduce((acc, m) => acc.concat(m.pts.map(p => p.y)), [])
            .filter(Number.isFinite);
        // Los puntos dispersos también deben verse en el rango vertical
        ys = ys.concat(puntos.map(p => p.y).filter(Number.isFinite));
        if (!ys.length) {
            mostrarMsg('La función no tiene valores reales en este rango.');
            return;
        }
        // Acotar asíntotas fuera del cálculo de rango
        const acotados = ys.filter(y => Math.abs(y) <= 1e4);
        const base = acotados.length ? acotados : ys;
        let ymin = Math.min(...base), ymax = Math.max(...base);
        if (!(ymax > ymin)) { ymin -= 1; ymax += 1; }
        ymin = Math.min(ymin, 0); ymax = Math.max(ymax, 0);
        const padY = Math.max((ymax - ymin) * 0.1, 1e-9);
        ymin -= padY; ymax += padY;

        // --- Lienzo (con DPR, tope 2) ---
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const w = Math.max(200, Math.round(canvas.clientWidth || (canvas.parentElement && canvas.parentElement.clientWidth) || 600));
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(GRAF_ALTO * dpr);
        canvas.style.height = GRAF_ALTO + 'px';
        canvas.style.display = 'block';
        ocultarMsg();
        cont.style.display = 'block';
        const etiquetaAria = curvas.map(c => c.etiqueta).join(', ');
        canvas.setAttribute('aria-label', 'Gráfica de ' + etiquetaAria);

        // Título del bloque de gráfica (los métodos pueden nombrarla mejor:
        // "g(x) y la recta y = x", "f(x) y P_n(x)", ...)
        const tituloEl = document.getElementById('grafica-titulo');
        if (tituloEl) {
            const span = tituloEl.querySelector('span');
            const txt = opts.titulo || 'Gráfica de la función';
            if (span) span.textContent = txt;
            else tituloEl.textContent = txt;
        }

        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, w, GRAF_ALTO);
        const X = (x) => ((x - xmin) / (xmax - xmin)) * w;
        const Y = (y) => GRAF_ALTO - ((y - ymin) / (ymax - ymin)) * GRAF_ALTO;
        const enVista = (y) => Number.isFinite(y) && y >= ymin && y <= ymax;
        const Y0 = Math.min(Math.max(Y(0), 0), GRAF_ALTO);

        // --- Cuadrícula + etiquetas ---
        const pasoX = grafPasoBonito(xmax - xmin);
        const pasoY = grafPasoBonito(ymax - ymin);
        ctx.font = '10px monospace';
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
        ctx.fillStyle = 'rgba(156, 163, 175, 0.9)';
        ctx.textAlign = 'left';
        for (let gx = Math.ceil(xmin / pasoX) * pasoX; gx <= xmax; gx += pasoX) {
            const px = X(gx);
            ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, GRAF_ALTO); ctx.stroke();
            if (Math.abs(gx) > 1e-12) {
                const txt = String(Number(gx.toPrecision(4)));
                // Si la etiqueta se saldría del borde derecho, se alinea hacia
                // dentro (antes quedaba cortada por el canvas).
                if (px + 6 + txt.length * 6 > w) {
                    ctx.textAlign = 'right';
                    ctx.fillText(txt, w - 4, GRAF_ALTO - 5);
                    ctx.textAlign = 'left';
                } else {
                    ctx.fillText(txt, px + 3, GRAF_ALTO - 5);
                }
            }
        }
        ctx.textAlign = 'right';
        for (let gy = Math.ceil(ymin / pasoY) * pasoY; gy <= ymax; gy += pasoY) {
            const py = Y(gy);
            ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(w, py); ctx.stroke();
            if (Math.abs(gy) > 1e-12) ctx.fillText(Number(gy.toPrecision(4)), w - 4, py - 3);
        }

        // --- Ejes ---
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
        if (ymin < 0 && ymax > 0) {
            ctx.beginPath(); ctx.moveTo(0, Y0); ctx.lineTo(w, Y0); ctx.stroke();
        }
        if (xmin < 0 && xmax > 0) {
            ctx.beginPath(); ctx.moveTo(X(0), 0); ctx.lineTo(X(0), GRAF_ALTO); ctx.stroke();
        }

        // --- Sombreado de área (Simpson, integrales) ---
        if (opts.sombra) {
            const sa = opts.sombra.a, sb = opts.sombra.b;
            if (Number.isFinite(sa) && Number.isFinite(sb) && sb > sa) {
                const dentro = [];
                for (let i = 0; i <= GRAF_N_SOMBRA; i++) {
                    const x = sa + ((sb - sa) * i) / GRAF_N_SOMBRA;
                    const y = evaluarFuncion(expr, x);
                    if (Number.isFinite(y) && enVista(y)) dentro.push({ x, y });
                }
                if (dentro.length > 1) {
                    ctx.save();
                    ctx.beginPath();
                    ctx.moveTo(X(dentro[0].x), Y0);
                    for (const p of dentro) ctx.lineTo(X(p.x), Y(p.y));
                    ctx.lineTo(X(dentro[dentro.length - 1].x), Y0);
                    ctx.closePath();
                    ctx.fillStyle = opts.sombra.color || 'rgba(0, 240, 255, 0.20)';
                    ctx.fill();
                    ctx.strokeStyle = opts.sombra.color || 'rgba(0, 240, 255, 0.45)';
                    ctx.lineWidth = 1;
                    ctx.stroke();
                    ctx.restore();
                }
            }
        }

        // --- Curvas ---
        for (const m of muestras) {
            ctx.strokeStyle = m.curva.color || '#00f0ff';
            ctx.lineWidth = m.curva.principal === false ? 1.6 : 2;
            ctx.lineJoin = 'round';
            if (m.curva.discontinua) ctx.setLineDash([6, 4]);
            ctx.beginPath();
            let trazando = false;
            for (const p of m.pts) {
                if (!enVista(p.y)) { trazando = false; continue; }
                if (!trazando) { ctx.moveTo(X(p.x), Y(p.y)); trazando = true; }
                else ctx.lineTo(X(p.x), Y(p.y));
            }
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // --- Recta identidad y = x (punto fijo: el cruce es la solución) ---
        if (opts.identidad) {
            const i0 = Math.max(xmin, ymin);
            const i1 = Math.min(xmax, ymax);
            if (i1 > i0) {
                ctx.save();
                ctx.setLineDash([6, 5]);
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
                ctx.lineWidth = 1.4;
                ctx.beginPath();
                ctx.moveTo(X(i0), Y(i0));
                ctx.lineTo(X(i1), Y(i1));
                ctx.stroke();
                ctx.setLineDash([]);
                ctx.font = '10px monospace';
                ctx.textAlign = 'right';
                ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
                ctx.fillText('y = x', X(i1) - 4, Math.max(Y(i1) - 6, 12));
                ctx.restore();
            }
        }

        // --- Intervalo [a, b] ---
        ctx.setLineDash([5, 4]);
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        if (Number.isFinite(a) && Number.isFinite(b) && a < b) {
            ctx.strokeStyle = 'rgba(189, 0, 255, 0.8)';
            ctx.fillStyle = '#bd00ff';
            ctx.beginPath(); ctx.moveTo(X(a), 0); ctx.lineTo(X(a), GRAF_ALTO); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(X(b), 0); ctx.lineTo(X(b), GRAF_ALTO); ctx.stroke();
            ctx.fillText('a', X(a), 12);
            ctx.fillText('b', X(b), 12);
        }
        ctx.setLineDash([]);

        // --- Puntos dispersos (datos conocidos) ---
        for (const pt of puntos) {
            if (!Number.isFinite(pt.x) || !Number.isFinite(pt.y)) continue;
            if (!enVista(pt.y)) continue;
            ctx.fillStyle = pt.color || '#ff007b';
            ctx.beginPath();
            ctx.arc(X(pt.x), Y(pt.y), pt.r || 4.5, 0, Math.PI * 2);
            ctx.fill();
            if (pt.etiqueta) {
                ctx.font = '10px monospace';
                ctx.textAlign = 'left';
                ctx.fillStyle = pt.color || '#ff007b';
                ctx.fillText(pt.etiqueta, X(pt.x) + 7, Math.max(Y(pt.y) - 7, 12));
            }
        }

        // --- Raíz aproximada (punto sobre la curva principal) ---
        if (Number.isFinite(opts.raiz)) {
            const ry = evaluarFuncion(expr, opts.raiz);
            grafMarcarPunto(ctx, X, Y, enVista, opts.raiz, ry, '#00ff78', 'x ≈ ' + Number(opts.raiz.toPrecision(6)), w);
        }

        // --- Puntos marcados con coordenadas propias (interpolación, Taylor) ---
        const marcas = Array.isArray(opts.marcas)
            ? opts.marcas
            : (opts.marca ? [opts.marca] : []);
        for (const m of marcas) {
            if (!m || !Number.isFinite(m.x) || !Number.isFinite(m.y)) continue;
            grafMarcarPunto(ctx, X, Y, enVista, m.x, m.y, m.color || '#ff007b',
                m.etiqueta || '', w, m.radio || 5);
        }

        // --- Leyenda (solo con más de una curva) ---
        if (curvas.length > 1) {
            ctx.font = '11px monospace';
            ctx.textAlign = 'left';
            let ly = 14;
            for (const c of curvas) {
                ctx.fillStyle = c.color || '#00f0ff';
                ctx.fillRect(8, ly - 4, 12, 3);
                ctx.fillText(c.etiqueta, 25, ly);
                ly += 15;
            }
        }
    } catch (e) {
        mostrarMsg('No se pudo dibujar la gráfica de esta función.');
    }
}

// Punto brillante con etiqueta
function grafMarcarPunto(ctx, X, Y, enVista, px, py, color, etiqueta, w, radio = 4) {
    if (!enVista(py)) return;
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(X(px), Y(py), radio, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    if (etiqueta) {
        ctx.font = '10px monospace';
        ctx.textAlign = 'left';
        ctx.fillStyle = color;
        ctx.fillText(etiqueta, Math.min(X(px) + 8, w - 90), Math.max(Y(py) - 8, 12));
    }
}

window.graficarResultado = graficarResultado;

// --- GRÁFICA INDEPENDIENTE (botón "Graficar") ---
// Dibuja la función del método activo SIN ejecutar el método: sirve para
// explorar la curva antes de elegir intervalo, tolerancia o iteraciones.
// Rango: a/b del método si son válidos; Taylor, [min(a,x)-2, max(a,x)+2];
// Punto Fijo, la recta y = x sobre la gráfica; si no, [-10, 10].
async function graficarLibre() {
    const cfgs = window.CONFIG_METODOS || {};
    const sel = document.getElementById('metodo-selector');
    const metodo = sel ? sel.value : 'biseccion';
    const cfg = cfgs[metodo] || cfgs.biseccion || { campos: [] };
    const inputId = (cfg.campos || [])[0];
    if (!inputId || inputId.indexOf('funcion') !== 0) {
        mostrarError('Este método no trabaja con una función f(x): usa sus puntos o parámetros para graficar.');
        return;
    }

    if (window.Vendor && window.Vendor.ensureCalc) {
        try {
            await window.Vendor.ensureCalc();
        } catch (e) {
            mostrarError('No se pudo cargar el motor matemático. Revisa tu conexión e intenta de nuevo.');
            return;
        }
    }

    const input = document.getElementById(inputId);
    const expr = input && input.value ? String(input.value).trim() : '';
    if (!expr) {
        mostrarError('Error: Escribe una función para graficar.');
        return;
    }

    // Validar con un punto de prueba: distingue sintaxis/dominio antes de dibujar
    try {
        if (typeof math === 'undefined' || !math.parse) {
            mostrarError('El motor matemático aún se está cargando. Intenta de nuevo en un momento.');
            return;
        }
        math.parse(normalizarExpresion(expr)).evaluate({ x: 1 });
    } catch (e) {
        mostrarError(mensajeErrorEvaluacion(expr, 'x = 1'));
        return;
    }

    limpiarTabla();

    const opts = { titulo: 'Gráfica de la función' };
    const numero = (id) => {
        const el = document.getElementById(id);
        if (!el || String(el.value).trim() === '') return NaN;
        // Acepta constantes ("pi", "e"...) igual que los demás métodos
        return parseNumeroConConstantes(el.value);
    };

    if (metodo === 'biseccion' || metodo === 'simpson') {
        const a = numero(metodo === 'biseccion' ? 'a' : 'a-simpson');
        const b = numero(metodo === 'biseccion' ? 'b' : 'b-simpson');
        if (Number.isFinite(a) && Number.isFinite(b) && a < b) {
            opts.a = a;
            opts.b = b;
        }
    } else if (metodo === 'taylor') {
        const vals = [numero('a-taylor'), numero('x-taylor')].filter(Number.isFinite);
        if (vals.length) opts.rango = [Math.min(...vals) - 2, Math.max(...vals) + 2];
    } else if (metodo === 'puntofijo') {
        opts.identidad = true;
        opts.etiqueta = 'g(x)';
        opts.titulo = 'g(x) y la recta y = x';
    }

    if (!opts.rango && !(Number.isFinite(opts.a) && Number.isFinite(opts.b))) {
        opts.rango = [-10, 10];
    }

    graficarResultado(expr, opts);
}

window.graficarLibre = graficarLibre;

// Botón "Graficar" junto al submit (calculadora.html)
document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('btn-graficar-libre');
    if (!btn) return;
    btn.addEventListener('click', () => {
        const r = graficarLibre();
        if (r && typeof r.catch === 'function') {
            r.catch((e) => mostrarError('Error inesperado al graficar: ' + (e && e.message ? e.message : e)));
        }
    });
});

// Redibujar al rotar/redimensionar (con debounce)
let grafResizeTimer = null;
window.addEventListener('resize', () => {
    clearTimeout(grafResizeTimer);
    grafResizeTimer = setTimeout(() => {
        const cont = document.getElementById('grafica-container');
        if (ultimoGrafico && cont && cont.style.display !== 'none') {
            graficarResultado(ultimoGrafico.expr, ultimoGrafico.opts);
        }
    }, 300);
});
