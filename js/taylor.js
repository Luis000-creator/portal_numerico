// ============================================================================
// Itera - Taylor / Maclaurin Module
// ============================================================================
// Contiene: series de Taylor y Maclaurin para calculadora.html. Deriva la
// función con mathjs y muestra la tabla de términos, el polinomio P_n(x) en
// KaTeX y la gráfica de f(x) superpuesta con P_n(x).
// Usa las utilidades compartidas de biseccion.js.
// ============================================================================

// Grado máximo: más allá de aquí math.derivative se vuelve lento y el
// polinomio deja de ser útil (y puede desestabilizarse numéricamente).
const TAYLOR_MAX_GRADO = 20;

// Convierte un nodo de mathjs a LaTeX embebible (con repliegue a texto)
function taylorTexDe(nodo) {
    try {
        if (nodo && typeof nodo.toTex === 'function' && typeof katex !== 'undefined') {
            return katex.renderToString(nodo.toTex(), { throwOnError: false });
        }
    } catch (e) { /* se usa el texto plano */ }
    try { return nodo ? String(nodo) : ''; } catch (e) { return ''; }
}

// Construye "c0 + c1*(x-a) + c2*(x-a)^2 ..." con los signos ya resueltos.
// Sirve a la vez como expresión evaluable por mathjs (gráfica) y como
// fuente del LaTeX del polinomio.
// Devuelve los TÉRMINOS con su signo embebido ("- 0.5*x^3"); hay que
// unirlos con ' ' (no con ' + ', o aparecerían signos dobles: "+ - 0.5").
function taylorPartes(coefs, a) {
    // Con centro 0 el desplazamiento es simplemente x (menos ruido en LaTeX)
    const desplazamiento = a === 0
        ? 'x'
        : (a > 0 ? `(x - ${numTexto(a)})` : `(x + ${numTexto(-a)})`);
    const partes = [];
    for (let k = 0; k < coefs.length; k++) {
        const c = coefs[k];
        if (!Number.isFinite(c) || c === 0) continue;
        const mag = numTexto(Math.abs(c));
        const base = k === 0 ? mag : `${mag} * ${desplazamiento}${k === 1 ? '' : '^' + k}`;
        // El primer término no lleva signo: math.parse('+ x') lo tolera pero
        // ensucia el LaTeX.
        if (!partes.length) partes.push(base);
        else partes.push((c < 0 ? '- ' : '+ ') + base);
    }
    return partes;
}

function calcularTaylor() {
    limpiarTabla();

    const leer = (id) => { const e = document.getElementById(id); return e ? String(e.value).trim() : ''; };
    const expr = leer('funcion-taylor');
    const aStr = leer('a-taylor');
    const xStr = leer('x-taylor');
    const nStr = leer('n-taylor');

    if (!expr) { mostrarError('Error: escribe la función f(x).'); return; }
    if (aStr === '' || xStr === '' || nStr === '') {
        mostrarError('Error: completa el punto base a, el punto a evaluar x y el grado n.');
        return;
    }

    // Acepta constantes: a = "pi/2", x = "pi/6"... (inputs type="text")
    const a = parseNumeroConConstantes(aStr);
    const x = parseNumeroConConstantes(xStr);
    const n = Number(nStr);
    if (!Number.isFinite(a) || !Number.isFinite(x)) {
        mostrarError('Error: a y x deben ser números válidos (aceptan pi, e...).');
        return;
    }
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
        mostrarError('Error: el grado n debe ser un entero positivo (1, 2, 3...).');
        return;
    }
    if (n > TAYLOR_MAX_GRADO) {
        mostrarError(`Error: n = ${n} es demasiado grande. El máximo permitido es ${TAYLOR_MAX_GRADO}.`);
        return;
    }

    // --- Valor real f(x) (necesario para el error verdadero) ---
    const fReal = evaluarFuncion(expr, x);
    if (!Number.isFinite(fReal)) {
        mostrarError(`Error: f(x) no está definida en x = ${x}. Revisa el dominio de la función.`);
        return;
    }

    // --- Derivadas sucesivas: f, f', f'', ... ---
    let nodo;
    try {
        if (typeof math === 'undefined' || !math.parse || !math.derivative) {
            mostrarError('La librería matemática aún se está cargando. Intenta de nuevo en un momento.');
            return;
        }
        nodo = math.parse(normalizarExpresion(expr));
    } catch (e) {
        mostrarError('Error: sintaxis inválida en la función f(x).');
        return;
    }

    const tbody = document.getElementById('tabla-cuerpo');
    const coefs = [];            // f^(k)(a) / k!
    const terminos = [];         // coef_k · (x-a)^k
    let aproximacion = 0;

    for (let k = 0; k <= n; k++) {
        if (k > 0) {
            try {
                nodo = math.derivative(nodo, 'x');
            } catch (e) {
                mostrarError(
                    `Error: no se pudo calcular la derivada de orden ${k}. ` +
                    `La función contiene operaciones que mathjs no puede derivar (ej. abs, sign, floor).`
                );
                return;
            }
        }

        let valorEnA;
        try {
            valorEnA = nodo.evaluate({ x: a });
        } catch (e) {
            mostrarError(`Error: no se pudo evaluar la derivada de orden ${k} en a = ${numTexto(a)}.`);
            return;
        }
        if (typeof valorEnA !== 'number' || !Number.isFinite(valorEnA)) {
            mostrarError(`Error: f⁽${k}⁾(a) no es un número real (posible asíntota o punto no diferenciable).`);
            return;
        }

        let factorial;
        try { factorial = math.factorial(k); } catch (e) { factorial = NaN; }
        if (!Number.isFinite(factorial)) {
            mostrarError(`Error: no se pudo calcular ${k}!`);
            return;
        }

        const coef = valorEnA / factorial;
        const term = coef * Math.pow(x - a, k);
        coefs.push(coef);
        terminos.push(term);
        aproximacion += term;

        // Error verdadero = |f(x) - P_k(x)| / |f(x)| · 100
        let errorTexto = 'N/A';
        if (fReal !== 0) {
            const err = Math.abs((fReal - aproximacion) / fReal) * 100;
            errorTexto = Number.isFinite(err) ? err.toFixed(4) + '%' : 'N/A';
        }

        const tr = document.createElement('tr');
        tr.innerHTML =
            `<td data-label="Orden (n)">${k}</td>` +
            `<td data-label="Derivada f⁽ⁿ⁾(x)">${taylorTexDe(nodo)}</td>` +
            `<td data-label="f⁽ⁿ⁾(a)">${numTexto(valorEnA)}</td>` +
            `<td data-label="Término">${numTexto(term)}</td>` +
            `<td data-label="Aproximación">${numTexto(aproximacion)}</td>` +
            `<td data-label="Error Verdadero (%)">${errorTexto}</td>`;
        tbody.appendChild(tr);
    }

    if (!Number.isFinite(aproximacion)) {
        mostrarError('Error: la aproximación de Taylor produjo un valor no válido.');
        return;
    }

    // --- Polinomio P_n(x) en KaTeX y expresión para la gráfica ---
    const partes = taylorPartes(coefs, a);
    // Cada término ya lleva su signo ('- ...' / '+ ...'): se unen con espacio
    const exprPolinomio = partes.length ? partes.join(' ') : '0';
    let latexPolinomio = '0';
    try {
        latexPolinomio = partes.length ? math.parse(exprPolinomio).toTex() : '0';
    } catch (e) { latexPolinomio = exprPolinomio; }

    const gradoTexto = n === 1 ? 'P_1(x)' : `P_{${n}}(x)`;
    const errorAbs = Math.abs(fReal - aproximacion);
    const errorRel = fReal !== 0 ? (errorAbs / Math.abs(fReal)) * 100 : NaN;

    // Nombre del polinomio evaluado: P_{5}(x) -> P_{5}(1)
    const gradoEnX = n === 1 ? `P_1(${numTexto(x)})` : `P_{${n}}(${numTexto(x)})`;
    renderizarProcedimiento(
        `${gradoTexto} = ${latexPolinomio} \\\\ ` +
        `${gradoEnX} = ${numTexto(aproximacion)}`
    );

    // --- Gráfica: f(x) y el polinomio superpuestos ---
    // P1-3 v3 (auto-zoom): el rango se acota alrededor del centro a y del
    // punto evaluado x. Antes era [a-span, a+span] con span ≥ 5, y en x=1 el
    // punto quedaba diminuto abajo (el gráfico abarcaba x −5..5, y −20..160).
    const x0 = Math.min(a, x) - 1;
    const x1 = Math.max(a, x) + 1;
    graficarResultado(expr, {
        rango: [x0, x1],
        etiqueta: 'f(x)',
        curvas: [{ expr: exprPolinomio, color: '#bd00ff', etiqueta: `P${n}(x)`, discontinua: true }],
        marcas: [
            { x, y: fReal, color: '#00ff78', etiqueta: `f(x) = ${numTexto(fReal)}` },
            { x, y: aproximacion, color: '#bd00ff', etiqueta: `P${n}(x) = ${numTexto(aproximacion)}` },
        ],
    });

    mostrarResumenCustom([
        { etiqueta: 'Aproximación P' + n + '(x)', valor: numTexto(aproximacion), tipo: 'principal', icono: 'fa-bullseye' },
        { etiqueta: 'Valor real f(x)', valor: numTexto(fReal), icono: 'fa-square-root-variable' },
        { etiqueta: 'Error absoluto', valor: numTexto(errorAbs), icono: 'fa-ruler-horizontal' },
        { etiqueta: 'Error relativo', valor: Number.isFinite(errorRel) ? errorRel.toFixed(4) + '%' : 'N/A', icono: 'fa-percent' },
        { etiqueta: 'Grado n', valor: String(n), icono: 'fa-superscript' },
        { etiqueta: 'Centro a', valor: numTexto(a), icono: 'fa-hashtag' },
    ]);
}

window.calcularTaylor = calcularTaylor;

document.addEventListener('DOMContentLoaded', () => {
    cablearPreview('funcion-taylor', 'preview-fx-taylor', 'f(x)');
});
