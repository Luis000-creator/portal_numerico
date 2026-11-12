// ============================================================================
// Itera - Lagrange Module (interpolación lineal y polinomial)
// ============================================================================
// Contiene: interpolación de Lagrange de 1.er grado y la general, más la
// tabla dinámica de puntos. Usa las utilidades compartidas de biseccion.js
// (evaluarFuncion, limpiarTabla, mostrarError, mostrarResumenCustom,
// renderizarProcedimiento, numTexto).
// ============================================================================

// Grado máximo razonable: a partir de aquí el polinomio se inestable
// (fenómeno de Runge) y la tabla resulta inmanejable.
const LAGRANGE_MAX_PUNTOS = 12;

// ---------------------------------------------------------------------------
// Polinomios representados como arrays de coeficientes de MENOR a MAYOR grado:
//   [c0, c1, c2, ...]  ->  c0 + c1·x + c2·x² + ...
// ---------------------------------------------------------------------------

function polyMul(p, q) {
    const res = new Array(p.length + q.length - 1).fill(0);
    for (let i = 0; i < p.length; i++) {
        for (let j = 0; j < q.length; j++) res[i + j] += p[i] * q[j];
    }
    return res;
}

// Expresión evaluable por mathjs (para la gráfica)
function polyAExpr(coef) {
    const partes = [];
    for (let i = coef.length - 1; i >= 0; i--) {
        const c = coef[i];
        if (!Number.isFinite(c) || c === 0) continue;
        if (i === 0) partes.push(numTexto(c));
        else if (i === 1) partes.push(`${numTexto(c)}*x`);
        else partes.push(`${numTexto(c)}*x^${i}`);
    }
    return partes.length ? partes.join(' + ') : '0';
}

// LaTeX del polinomio expandido
function polyALatex(coef) {
    const partes = [];
    for (let i = coef.length - 1; i >= 0; i--) {
        const c = coef[i];
        if (!Number.isFinite(c) || Math.abs(c) < 1e-12) continue;
        const signo = c < 0 ? '-' : (partes.length ? '+' : '');
        const mag = numTexto(Math.abs(c));
        let termino;
        if (i === 0) termino = mag;
        else if (i === 1) termino = `${mag === '1' ? '' : mag}\\,x`;
        else termino = `${mag === '1' ? '' : mag}\\,x^{${i}}`;
        partes.push(`${signo} ${termino}`);
    }
    return partes.length ? partes.join(' ') : '0';
}

// LaTeX de la forma factorizada de Lagrange (plan B si la expansión
// numérica se desestabiliza)
function lagrangeFactorizadaLatex(puntos) {
    const n = puntos.length;
    const terminos = [];
    for (let i = 0; i < n; i++) {
        const num = [];
        const den = [];
        for (let j = 0; j < n; j++) {
            if (j === i) continue;
            num.push(`(x - ${numTexto(puntos[j].x)})`);
            den.push(`(${numTexto(puntos[i].x)} - ${numTexto(puntos[j].x)})`);
        }
        terminos.push(`${numTexto(puntos[i].y)} \\cdot \\frac{${num.join('')}}{${den.join('')}}`);
    }
    return `P_{${n - 1}}(x) = ${terminos.join(' + ')}`;
}

// Coeficientes del polinomio de Lagrange expandido
function lagrangeCoeficientes(puntos) {
    const n = puntos.length;
    const total = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
        let num = [1];
        let den = 1;
        for (let j = 0; j < n; j++) {
            if (j === i) continue;
            num = polyMul(num, [-puntos[j].x, 1]); // (x - x_j)
            den *= (puntos[i].x - puntos[j].x);
        }
        const escalar = puntos[i].y / den;
        for (let k = 0; k < num.length; k++) total[k] += escalar * num[k];
    }
    return total;
}

// ---------------------------------------------------------------------------
// TABLA DINÁMICA DE PUNTOS (Interpolación Polinomial)
// Se construye con createElement (nada de innerHTML) para mantener los
// listeners y poder testearlo sin parser de HTML.
// ---------------------------------------------------------------------------

function crearFilaPunto() {
    const cont = document.getElementById('tabla-puntos');
    if (!cont) return null;
    if (cont.children.length >= LAGRANGE_MAX_PUNTOS) {
        mostrarError(`Error: máximo ${LAGRANGE_MAX_PUNTOS} puntos. Con más grados el polinomio pierde precisión.`);
        return null;
    }

    const fila = document.createElement('div');
    fila.className = 'punto-fila';

    const etiqueta = document.createElement('span');
    etiqueta.className = 'punto-indice';

    const inpX = document.createElement('input');
    inpX.type = 'number';
    inpX.step = 'any';
    inpX.placeholder = 'x';
    inpX.dataset.campo = 'x';

    const inpY = document.createElement('input');
    inpY.type = 'number';
    inpY.step = 'any';
    inpY.placeholder = 'y';
    inpY.dataset.campo = 'y';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn-quitar-punto';
    btn.innerHTML = '&times;';

    fila.appendChild(etiqueta);
    fila.appendChild(inpX);
    fila.appendChild(inpY);
    fila.appendChild(btn);
    cont.appendChild(fila);

    btn.addEventListener('click', () => quitarFilaPunto(fila));
    renumerarPuntos();
    return fila;
}

function quitarFilaPunto(fila) {
    const cont = document.getElementById('tabla-puntos');
    if (!cont) return;
    if (cont.children.length <= 3) {
        mostrarError('Error: se requieren al menos 3 puntos para interpolar.');
        return;
    }
    if (typeof cont.removeChild === 'function') cont.removeChild(fila);
    renumerarPuntos();
}

function renumerarPuntos() {
    const cont = document.getElementById('tabla-puntos');
    if (!cont) return;
    for (let i = 0; i < cont.children.length; i++) {
        const fila = cont.children[i];
        const ind = fila.querySelector('.punto-indice');
        if (ind) ind.textContent = 'P' + (i + 1);
    }
}

// Lee y valida la tabla. Devuelve { puntos } o { error }.
function leerPuntos() {
    const cont = document.getElementById('tabla-puntos');
    if (!cont) return { error: 'No se encontró la tabla de puntos.' };

    const puntos = [];
    for (let i = 0; i < cont.children.length; i++) {
        const fila = cont.children[i];
        const inpX = fila.querySelector('[data-campo="x"]');
        const inpY = fila.querySelector('[data-campo="y"]');
        if (!inpX || !inpY) continue;
        const sx = String(inpX.value === undefined || inpX.value === null ? '' : inpX.value).trim();
        const sy = String(inpY.value === undefined || inpY.value === null ? '' : inpY.value).trim();
        if (sx === '' || sy === '') return { error: `El punto P${i + 1} tiene campos vacíos.` };
        const x = Number(sx);
        const y = Number(sy);
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
            return { error: `El punto P${i + 1} no contiene números válidos.` };
        }
        puntos.push({ x, y });
    }

    if (puntos.length < 3) return { error: 'Se requieren al menos 3 puntos para interpolar.' };
    if (puntos.length > LAGRANGE_MAX_PUNTOS) {
        return { error: `Máximo ${LAGRANGE_MAX_PUNTOS} puntos.` };
    }
    for (let i = 0; i < puntos.length; i++) {
        for (let j = i + 1; j < puntos.length; j++) {
            const dif = Math.abs(puntos[i].x - puntos[j].x);
            const escala = Math.max(1, Math.abs(puntos[i].x), Math.abs(puntos[j].x));
            if (dif <= 1e-12 * escala) {
                return {
                    error: `Los puntos P${i + 1} y P${j + 1} tienen la misma x (${numTexto(puntos[i].x)}). Deben ser distintos.`,
                };
            }
        }
    }
    return { puntos };
}

// ---------------------------------------------------------------------------
// 2. INTERPOLACIÓN LINEAL DE LAGRANGE
// ---------------------------------------------------------------------------

function calcularLagrangeLineal() {
    limpiarTabla();

    const leer = (id) => { const e = document.getElementById(id); return e ? String(e.value).trim() : ''; };
    const sx0 = leer('x0-lineal');
    const sy0 = leer('y0-lineal');
    const sx1 = leer('x1-lineal');
    const sy1 = leer('y1-lineal');
    const sx = leer('x-lineal');

    if (!sx0 || !sy0 || !sx1 || !sy1 || !sx) {
        mostrarError('Error: completa los puntos (x₀, y₀), (x₁, y₁) y el valor de x a interpolar.');
        return;
    }
    const x0 = Number(sx0);
    const y0 = Number(sy0);
    const x1 = Number(sx1);
    const y1 = Number(sy1);
    const x = Number(sx);
    if (![x0, y0, x1, y1, x].every(Number.isFinite)) {
        mostrarError('Error: todos los campos deben ser números válidos.');
        return;
    }
    if (x0 === x1) {
        mostrarError('Error: x₀ y x₁ deben ser distintos para evitar división por cero.');
        return;
    }

    // f1(x) = (x - x1)/(x0 - x1)·y0 + (x - x0)/(x1 - x0)·y1
    const L0 = (x - x1) / (x0 - x1);
    const L1 = (x - x0) / (x1 - x0);
    const t0 = L0 * y0;
    const t1 = L1 * y1;
    const y = t0 + t1;

    // --- Tabla paso a paso ---
    const tbody = document.getElementById('tabla-cuerpo');
    const filas = [
        { termino: 'L₀(x)·y₀', calc: `(${numTexto(x)} - ${numTexto(x1)}) / (${numTexto(x0)} - ${numTexto(x1)}) × ${numTexto(y0)}`, valor: t0 },
        { termino: 'L₁(x)·y₁', calc: `(${numTexto(x)} - ${numTexto(x0)}) / (${numTexto(x1)} - ${numTexto(x0)}) × ${numTexto(y1)}`, valor: t1 },
        { termino: 'y = Σ', calc: `${numTexto(t0)} + ${numTexto(t1)}`, valor: y },
    ];
    filas.forEach((f) => {
        const tr = document.createElement('tr');
        tr.innerHTML =
            `<td data-label="Término">${f.termino}</td>` +
            `<td data-label="Cálculo (sustitución)">${f.calc}</td>` +
            `<td data-label="Valor">${numTexto(f.valor)}</td>`;
        tbody.appendChild(tr);
    });

    // --- Sustitución en la fórmula, en KaTeX ---
    const latex =
        `y = \\frac{${numTexto(x)} - ${numTexto(x1)}}{${numTexto(x0)} - ${numTexto(x1)}} \\cdot ${numTexto(y0)}` +
        ` + \\frac{${numTexto(x)} - ${numTexto(x0)}}{${numTexto(x1)} - ${numTexto(x0)}} \\cdot ${numTexto(y1)}` +
        ` \\\\ \\Rightarrow\\quad y = ${numTexto(L0)} \\cdot ${numTexto(y0)} + ${numTexto(L1)} \\cdot ${numTexto(y1)} = ${numTexto(y)}`;
    renderizarProcedimiento(latex);

    // --- Gráfica: los2 puntos, la recta y el punto interpolado ---
    const pendiente = (y1 - y0) / (x1 - x0);
    const exprRecta = `${numTexto(y0)} + ${numTexto(pendiente)}*(x - ${numTexto(x0)})`;
    graficarResultado(exprRecta, {
        xs: [x0, x1, x],
        puntos: [
            { x: x0, y: y0, etiqueta: `(${numTexto(x0)}, ${numTexto(y0)})`, color: '#ff007b' },
            { x: x1, y: y1, etiqueta: `(${numTexto(x1)}, ${numTexto(y1)})`, color: '#ff007b' },
        ],
        marcas: [{ x, y, etiqueta: `y = ${numTexto(y)}`, color: '#00ff78' }],
        etiqueta: 'Recta',
    });

    mostrarResumenCustom([
        { etiqueta: 'Valor interpolado', valor: `y = ${numTexto(y)}`, tipo: 'principal', icono: 'fa-bullseye' },
        { etiqueta: 'Pendiente m', valor: numTexto(pendiente), icono: 'fa-equals' },
        { etiqueta: 'x a interpolar', valor: numTexto(x), icono: 'fa-hashtag' },
        { etiqueta: 'Puntos usados', valor: '2', icono: 'fa-table-list' },
    ]);
}

// ---------------------------------------------------------------------------
// 3. INTERPOLACIÓN POLINOMIAL DE LAGRANGE (general)
// ---------------------------------------------------------------------------

function calcularLagrangePolinomial() {
    limpiarTabla();

    const campoX = document.getElementById('x-poly');
    const sx = campoX ? String(campoX.value).trim() : '';
    if (!sx) { mostrarError('Error: escribe el valor de X que quieres interpolar.'); return; }
    const x = Number(sx);
    if (!Number.isFinite(x)) { mostrarError('Error: X debe ser un número válido.'); return; }

    const lectura = leerPuntos();
    if (lectura.error) { mostrarError('Error: ' + lectura.error); return; }
    const puntos = lectura.puntos;
    const n = puntos.length;

    // --- Coeficientes del polinomio y resultado ---
    let coef;
    try {
        coef = lagrangeCoeficientes(puntos);
    } catch (e) {
        mostrarError('Error: no se pudo construir el polinomio (puntos inválidos).');
        return;
    }
    if (!coef.every(Number.isFinite)) {
        mostrarError('Error: el polinomio resultó no válido. Revisa los puntos ingresados.');
        return;
    }

    const grado = n - 1;

    // --- Valores L_i(x) por el producto directo (mucho más preciso que
    //     evaluar el polinomio expandido, que acumula redondeo) ---
    const L = [];
    let y = 0;
    for (let i = 0; i < n; i++) {
        let Li = 1;
        for (let j = 0; j < n; j++) {
            if (j === i) continue;
            Li *= (x - puntos[j].x) / (puntos[i].x - puntos[j].x);
        }
        L.push(Li);
        y += Li * puntos[i].y;
    }
    if (!Number.isFinite(y)) {
        mostrarError('Error: no se pudo evaluar el polinomio en ese valor de X.');
        return;
    }

    // --- Tabla de coeficientes L_i(x) y aportes ---
    const tbody = document.getElementById('tabla-cuerpo');
    for (let i = 0; i < n; i++) {
        const Li = L[i];
        const aporte = Li * puntos[i].y;
        const tr = document.createElement('tr');
        tr.innerHTML =
            `<td data-label="i">${i}</td>` +
            `<td data-label="xᵢ">${numTexto(puntos[i].x)}</td>` +
            `<td data-label="yᵢ">${numTexto(puntos[i].y)}</td>` +
            `<td data-label="Lᵢ(x)">${Number.isFinite(Li) ? Li.toPrecision(8) : 'N/A'}</td>` +
            `<td data-label="Lᵢ(x)·yᵢ">${Number.isFinite(aporte) ? aporte.toPrecision(8) : 'N/A'}</td>`;
        tbody.appendChild(tr);
    }

    // --- Polinomio final en KaTeX (expandido, con repliegue a factorizado) ---
    const expandido = polyALatex(coef);
    const estable = coef.every((c) => Number.isFinite(c) && Math.abs(c) < 1e12);
    const polinomioLatex = estable
        ? `P_{${grado}}(x) = ${expandido}`
        : lagrangeFactorizadaLatex(puntos);
    renderizarProcedimiento(
        `${polinomioLatex} \\\\ P_{${grado}}(${numTexto(x)}) = ${numTexto(y)}`
    );

    // --- Gráfica: puntos conocidos + polinomio + punto interpolado ---
    const exprPoly = polyAExpr(coef);
    graficarResultado(exprPoly, {
        xs: puntos.map((p) => p.x).concat([x]),
        puntos: puntos.map((p) => ({
            x: p.x, y: p.y, color: '#ff007b',
            etiqueta: `(${numTexto(p.x)}, ${numTexto(p.y)})`,
        })),
        marcas: [{ x, y, etiqueta: `y = ${numTexto(y)}`, color: '#00ff78' }],
        etiqueta: `P${grado}(x)`,
    });

    mostrarResumenCustom([
        { etiqueta: 'Valor interpolado', valor: `y = ${numTexto(y)}`, tipo: 'principal', icono: 'fa-bullseye' },
        { etiqueta: 'Grado del polinomio', valor: String(grado), icono: 'fa-superscript' },
        { etiqueta: 'Puntos usados', valor: String(n), icono: 'fa-table-list' },
        { etiqueta: 'X a interpolar', valor: numTexto(x), icono: 'fa-hashtag' },
    ]);
}

window.crearFilaPunto = crearFilaPunto;
window.quitarFilaPunto = quitarFilaPunto;
window.renumerarPuntos = renumerarPuntos;
window.leerPuntos = leerPuntos;
window.calcularLagrangeLineal = calcularLagrangeLineal;
window.calcularLagrangePolinomial = calcularLagrangePolinomial;

// 3 filas iniciales + botón de agregar
document.addEventListener('DOMContentLoaded', () => {
    const cont = document.getElementById('tabla-puntos');
    if (!cont) return;
    if (!cont.children.length) {
        for (let i = 0; i < 3; i++) crearFilaPunto();
    }
    const btnAgregar = document.getElementById('btn-agregar-punto');
    if (btnAgregar) btnAgregar.addEventListener('click', () => crearFilaPunto());
});
