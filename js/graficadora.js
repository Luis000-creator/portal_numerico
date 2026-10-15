// ============================================================================
// Itera - Graficadora Module
// ============================================================================
// Graficadora liviana en canvas (sin dependencias externas): dibuja la
// función calculada con ejes, cuadrícula, intervalo [a,b] y raíz aproximada.
// Usa evaluarFuncion() compartido, así que respeta log = base 10, ln = natural.
// ============================================================================

const GRAF_N = 240;
const GRAF_ALTO = 280;

let ultimoGrafico = null;

// Paso "bonito" (1/2/5 × 10^n) para la cuadrícula
function grafPasoBonito(rango, objetivo = 6) {
    const bruto = rango / objetivo;
    const mag = Math.pow(10, Math.floor(Math.log10(bruto)));
    const norm = bruto / mag;
    return (norm >= 5 ? 5 : norm >= 2 ? 2 : 1) * mag;
}

// Dibuja expr en el canvas #grafica.
// opts: { a, b } (bracket) | { xs } (puntos visitados) | { raiz }
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

        // --- Rango X ---
        let xmin, xmax;
        const a = opts.a, b = opts.b;
        if (Number.isFinite(a) && Number.isFinite(b) && a < b) {
            const pad = Math.max((b - a) * 0.25, 1e-6);
            xmin = a - pad; xmax = b + pad;
        } else if (Array.isArray(opts.xs) && opts.xs.length) {
            const vistos = opts.xs.filter(Number.isFinite);
            if (!vistos.length) { cont.style.display = 'none'; return; }
            let lo = Math.min(...vistos), hi = Math.max(...vistos);
            if (!(hi > lo)) { lo -= 1; hi += 1; }
            const pad = Math.max((hi - lo) * 0.25, 1e-6);
            xmin = lo - pad; xmax = hi + pad;
        } else if (Number.isFinite(opts.raiz)) {
            const d = Math.max(1, Math.abs(opts.raiz));
            xmin = opts.raiz - d; xmax = opts.raiz + d;
        } else { cont.style.display = 'none'; return; }
        if (!(xmax > xmin)) { cont.style.display = 'none'; return; }

        // --- Muestreo (se corta en discontinuidades) ---
        const pts = [];
        for (let i = 0; i <= GRAF_N; i++) {
            const x = xmin + ((xmax - xmin) * i) / GRAF_N;
            pts.push({ x, y: evaluarFuncion(expr, x) });
        }
        const ys = pts.map(p => p.y).filter(Number.isFinite);
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
        const w = Math.max(200, Math.round(canvas.clientWidth || canvas.parentElement.clientWidth || 600));
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(GRAF_ALTO * dpr);
        canvas.style.height = GRAF_ALTO + 'px';
        canvas.style.display = 'block';
        ocultarMsg();
        cont.style.display = 'block';
        canvas.setAttribute('aria-label', 'Gráfica de ' + expr);

        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, w, GRAF_ALTO);
        const X = (x) => ((x - xmin) / (xmax - xmin)) * w;
        const Y = (y) => GRAF_ALTO - ((y - ymin) / (ymax - ymin)) * GRAF_ALTO;
        const enVista = (y) => Number.isFinite(y) && y >= ymin && y <= ymax;

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
            if (Math.abs(gx) > 1e-12) ctx.fillText(Number(gx.toPrecision(4)), px + 3, GRAF_ALTO - 5);
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
            ctx.beginPath(); ctx.moveTo(0, Y(0)); ctx.lineTo(w, Y(0)); ctx.stroke();
        }
        if (xmin < 0 && xmax > 0) {
            ctx.beginPath(); ctx.moveTo(X(0), 0); ctx.lineTo(X(0), GRAF_ALTO); ctx.stroke();
        }

        // --- Curva ---
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 2;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        let trazando = false;
        for (const p of pts) {
            if (!enVista(p.y)) { trazando = false; continue; }
            if (!trazando) { ctx.moveTo(X(p.x), Y(p.y)); trazando = true; }
            else ctx.lineTo(X(p.x), Y(p.y));
        }
        ctx.stroke();

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

        // --- Raíz aproximada ---
        if (Number.isFinite(opts.raiz)) {
            const ry = evaluarFuncion(expr, opts.raiz);
            if (enVista(ry)) {
                ctx.fillStyle = '#00ff78';
                ctx.shadowColor = '#00ff78';
                ctx.shadowBlur = 8;
                ctx.beginPath();
                ctx.arc(X(opts.raiz), Y(ry), 4, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
                ctx.textAlign = 'left';
                ctx.fillText('x ≈ ' + Number(opts.raiz.toPrecision(6)), Math.min(X(opts.raiz) + 8, w - 90), Math.max(Y(ry) - 8, 12));
            }
        }
    } catch (e) {
        mostrarMsg('No se pudo dibujar la gráfica de esta función.');
    }
}

window.graficarResultado = graficarResultado;

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
