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
const GRAF_ALTO = 280; // respaldo si no hay CSS utilizable (tests / sin hoja de estilo)
const GRAF_N_SOMBRA = 160;

// Alto real del lienzo: lo decide el CSS (.grafica-canvas es 280px, y 320px en
// escritorio ≥1024px). Se limpia el alto en línea para poder leerlo; si no hay
// CSS utilizable se usa el respaldo GRAF_ALTO.
function grafAltoDelCSS(canvas) {
    try {
        if (canvas && canvas.style) canvas.style.height = '';
        if (canvas && typeof window.getComputedStyle === 'function') {
            const h = parseFloat(window.getComputedStyle(canvas).height);
            // Rango [200, 400]: cubre 280/320 y descarta tamaños intrínsecos
            // sin CSS (150, o el propio bitmap), que crecerían en cada dibujo.
            if (Number.isFinite(h) && h >= 200 && h <= 400) return h;
        }
    } catch (e) { /* sin CSS computado: respaldo */ }
    return GRAF_ALTO;
}

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

// La gráfica vive DENTRO de #resultado-container: mostrarla exige re-mostrar
// también ese padre (si no, el canvas queda invisible aunque se dibuje — el
// botón "Graficar" nunca debe ocultar lo que dejó un Calcular). Además, si
// aún no hay resultados (tabla vacía y sin resumen), los bloques vacíos se
// ocultan: en una gráfica libre solo debe verse la curva.
function mostrarSeccionGrafica() {
    const res = document.getElementById('resultado-container');
    if (res) res.style.display = 'block';

    const tbody = document.getElementById('tabla-cuerpo');
    const resumen = document.getElementById('resumen-container');
    const hayResultados = (tbody && tbody.children.length > 0)
        || (resumen && resumen.style.display === 'block');

    const bloque = document.getElementById('bloque-tabla');
    if (bloque) bloque.style.display = hayResultados ? 'block' : 'none';

    const divider = document.querySelector ? document.querySelector('.result-divider') : null;
    if (divider) divider.style.display = hayResultados ? 'block' : 'none';
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
        mostrarSeccionGrafica();
    };
    const ocultarMsg = () => { if (msg) msg.style.display = 'none'; };

    try {
        if (!expr || typeof evaluarFuncion !== 'function') { cont.style.display = 'none'; return; }

        // --- Color del método activo (§3.3): --method del contenedor; si no
        //     hay CSS utilizable se queda el cian de siempre ---
        let colorMetodo = '#00f0ff';
        const contMetodo = document.querySelector('.container');
        if (contMetodo && typeof window.getComputedStyle === 'function') {
            colorMetodo = window.getComputedStyle(contMetodo).getPropertyValue('--method').trim() || '#00f0ff';
        }

        // --- Curvas a dibujar (principal + adicionales) ---
        const curvas = [{ expr, color: colorMetodo, etiqueta: opts.etiqueta || 'f(x)' }]
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
        const alto = grafAltoDelCSS(canvas);
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(alto * dpr);
        canvas.style.height = alto + 'px';
        canvas.style.display = 'block';
        ocultarMsg();
        cont.style.display = 'block';
        mostrarSeccionGrafica();
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
        ctx.clearRect(0, 0, w, alto);
        const X = (x) => ((x - xmin) / (xmax - xmin)) * w;
        const Y = (y) => alto - ((y - ymin) / (ymax - ymin)) * alto;
        const enVista = (y) => Number.isFinite(y) && y >= ymin && y <= ymax;
        const Y0 = Math.min(Math.max(Y(0), 0), alto);

        // --- Cuadrícula + etiquetas ---
        const pasoX = grafPasoBonito(xmax - xmin);
        const pasoY = grafPasoBonito(ymax - ymin);
        // P0-3 v3: 12px y gris claro (antes 11px y gris lavado, poco contraste)
        ctx.font = '12px monospace';
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
        ctx.fillStyle = 'rgba(229, 231, 235, 0.95)';
        ctx.textAlign = 'left';
        // Las etiquetas del eje X se guardan y se dibujan AL FINAL, con un
        // chip oscuro detrás: si se dibujaran aquí, después las cruzan la
        // cuadrícula horizontal y las líneas punteadas del intervalo [a, b].
        const etiquetasEjeX = [];
        for (let gx = Math.ceil(xmin / pasoX) * pasoX; gx <= xmax; gx += pasoX) {
            const px = X(gx);
            ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, alto); ctx.stroke();
            if (Math.abs(gx) > 1e-12) {
                const txt = String(Number(gx.toPrecision(4)));
                etiquetasEjeX.push({ txt, px });
            }
        }
        ctx.textAlign = 'right';
        for (let gy = Math.ceil(ymin / pasoY) * pasoY; gy <= ymax; gy += pasoY) {
            const py = Y(gy);
            ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(w, py); ctx.stroke();
            // Etiqueta del eje Y: margen derecho (antes en w - 4, cortada) y
            // anclaje mínimo en y=12 para que no salga recortada por arriba
            // (P0-3 v3: el "160" de Taylor salía partido por el borde).
            if (Math.abs(gy) > 1e-12) {
                const ly = Math.max(py, 12);
                ctx.fillText(Number(gy.toPrecision(4)), w - 10, ly - 3);
            }
        }

        // --- Ejes ---
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
        if (ymin < 0 && ymax > 0) {
            ctx.beginPath(); ctx.moveTo(0, Y0); ctx.lineTo(w, Y0); ctx.stroke();
        }
        if (xmin < 0 && xmax > 0) {
            ctx.beginPath(); ctx.moveTo(X(0), 0); ctx.lineTo(X(0), alto); ctx.stroke();
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
            // v4 P1-1: las punteadas se recortan 20px antes del borde inferior
            // para que NUNCA lleguen a la banda de etiquetas del eje X.
            ctx.beginPath(); ctx.moveTo(X(a), 0); ctx.lineTo(X(a), alto - 20); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(X(b), 0); ctx.lineTo(X(b), alto - 20); ctx.stroke();
            // Chip visible y 'a'/'b' bajadas (ronda 9): el chip en y=6 y el
            // texto en y=18 quedaban pegados al borde superior y se cortaban.
            grafChipEtiqueta(ctx, X(a) - 6, 20, 12);
            grafChipEtiqueta(ctx, X(b) - 6, 20, 12);
            ctx.fillStyle = '#06222b';
            ctx.fillText('a', X(a), 32);
            ctx.fillText('b', X(b), 32);
        }
        ctx.setLineDash([]);

        // --- Etiquetas del eje X: al final, con chip detrás ---
        // (si se dibujaran con la cuadrícula, después las tapan las líneas
        //  horizontales y las punteadas del intervalo: guiones sobre los dígitos)
        ctx.font = '12px monospace';
        ctx.textAlign = 'left';
        for (const et of etiquetasEjeX) {
            const ancho = et.txt.length * 7 + 6;
            const cercaDerecha = et.px + 6 + et.txt.length * 7 > w;
            // v4 P1-1: la etiqueta pegada al borde izquierdo (p. ej. "-0.5")
            // se sujeta a un mínimo de 4px para que no salga cortada.
            const tx = cercaDerecha ? w - 10 : Math.max(et.px + 3, 4);
            grafChipEtiqueta(ctx, cercaDerecha ? w - 8 - ancho : Math.max(et.px + 1, 1), alto - 16, ancho);
            // Texto oscuro sobre la pastilla clara (ronda 9): el gris claro
            // salía con poco contraste sobre el fondo translúcido.
            ctx.fillStyle = '#06222b';
            if (cercaDerecha) {
                ctx.textAlign = 'right';
                ctx.fillText(et.txt, w - 10, alto - 5);
                ctx.textAlign = 'left';
            } else {
                ctx.fillText(et.txt, tx, alto - 5);
            }
        }

        // El "0" del origen: los bucles de la cuadrícula lo saltan
        // (Math.abs(gx/gy) > 1e-12) y las X pueden arrancar en 0.5 —x=0
        // queda fuera del lienzo izquierdo—, así que nunca salía. Ronda 9:
        // se dibuja siempre que exista el eje horizontal (y=0) y, si x=0 no
        // cabe, al inicio del propio eje.
        if (ymin < 0 && ymax > 0) {
            const ox = (xmin < 0 && xmax > 0) ? X(0) : (xmin > 0 ? 0 : w);
            const cy = Math.min(Y0 + 4, Math.max(alto - 32, 4));
            const cx = Math.min(Math.max(ox + 2, 1), w - 16);
            grafChipEtiqueta(ctx, cx, cy, 13);
            ctx.fillStyle = '#06222b';
            ctx.textAlign = 'left';
            ctx.fillText('0', cx + 3, cy + 10);
        }
        ctx.font = '10px monospace';

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
                const lx = X(pt.x) + 7;
                const ly = Math.max(Y(pt.y) - 7, 12);
                // Chip visible para que la curva no pise la etiqueta
                grafChipEtiqueta(ctx, lx - 3, ly - 11, pt.etiqueta.length * 6 + 6);
                ctx.fillStyle = '#06222b';
                ctx.fillText(pt.etiqueta, lx, ly);
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
        // P0-3 v3: si dos marcas caen en el mismo punto (Taylor: f(x) y
        // P_n(x)), la segunda etiqueta se baja 14px en vez de superponerse.
        const etiquetasMarcas = [];
        for (const m of marcas) {
            if (!m || !Number.isFinite(m.x) || !Number.isFinite(m.y)) continue;
            const enX = X(m.x), enY = Y(m.y);
            const solapa = etiquetasMarcas.some((e) =>
                Math.abs(e.x - enX) < 40 && Math.abs(e.y - enY) < 16);
            grafMarcarPunto(ctx, X, Y, enVista, m.x, m.y, m.color || '#ff007b',
                m.etiqueta || '', w, m.radio || 5, solapa ? 14 : 0);
            if (m.etiqueta) etiquetasMarcas.push({ x: enX, y: enY });
        }

        // --- Leyenda (solo con más de una curva) ---
        if (curvas.length > 1) {
            ctx.font = '12px monospace';
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

// Chip de fondo detrás de las etiquetas de la gráfica (ronda 9: pastilla
// realmente VISIBLE — fondo claro translúcido con borde. El chip negro de la
// v3 era invisible sobre el lienzo casi negro, y el gris 0.14 de la v4 seguía
// leyéndose "gris oscuro sobre negro": ahora el fondo es claro y el texto que
// va encima es #06222b, con alto contraste en todos los casos).
function grafChipEtiqueta(ctx, x, y, ancho, altoChip = 13) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.fillRect(x, y, ancho, altoChip);
    ctx.strokeStyle = 'rgba(6, 34, 43, 0.55)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, ancho, altoChip);
}

// Punto brillante con etiqueta (P0-3 v3: chip oscuro detrás para que la curva
// o la cuadrícula no crucen el texto; desplazY baja la etiqueta cuando otra
// marca ya escribió en el mismo punto)
function grafMarcarPunto(ctx, X, Y, enVista, px, py, color, etiqueta, w, radio = 4, desplazY = 0) {
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
        const lx = Math.min(X(px) + 8, w - 90);
        const ly = Math.max(Y(py) - 8 + desplazY, 12);
        grafChipEtiqueta(ctx, lx - 3, ly - 11, etiqueta.length * 6 + 6);
        // Texto oscuro sobre la pastilla clara (ronda 9)
        ctx.fillStyle = '#06222b';
        ctx.fillText(etiqueta, lx, ly);
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

    // Este botón NO ejecuta el método ni borra lo que dejó un Calcular: solo
    // dibuja la curva (limpiarTabla() vaciaba la tabla, ocultaba los
    // resultados y, como la gráfica vive dentro de ese contenedor, la curva
    // tampoco se veía). Solo se descarta un error anterior, que ya no aplica
    // si esta gráfica sale bien.
    const errBox = document.getElementById('error-box');
    if (errBox) errBox.style.display = 'none';

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
