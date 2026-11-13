// ============================================================================
// Itera - Punto Fijo Module
// ============================================================================
// Contiene: selector de metodo, router de calculo y logica del metodo
// de iteracion de punto fijo para calculadora.html
// ============================================================================

const CABECERA_BISECCION = '<tr><th>Iter</th><th>a</th><th>b</th><th>x_m</th><th>f(x_m)</th><th>Ea (%)</th></tr>';
const CABECERA_PUNTOFIJO = '<tr><th>Iter (n)</th><th>x</th><th>g(x)</th><th>Ea (%)</th></tr>';
const CABECERA_NEWTON = '<tr><th>Iter (n)</th><th>xₙ</th><th>f(xₙ)</th><th>f\'(xₙ)</th><th>xₙ₊₁</th><th>Ea (%)</th></tr>';
const CABECERA_TAYLOR = '<tr><th>Orden (n)</th><th>Derivada f⁽ⁿ⁾(x)</th><th>f⁽ⁿ⁾(a)</th><th>Término</th><th>Aproximación</th><th>Error Verdadero (%)</th></tr>';
const CABECERA_LAGRANGE_LINEAL = '<tr><th>Término</th><th>Cálculo (sustitución)</th><th>Valor</th></tr>';
const CABECERA_LAGRANGE = '<tr><th>i</th><th>xᵢ</th><th>yᵢ</th><th>Lᵢ(x)</th><th>Lᵢ(x)·yᵢ</th></tr>';
const CABECERA_SIMPSON = '<tr><th>i</th><th>xᵢ</th><th>f(xᵢ)</th><th>Coeficiente</th><th>Producto</th></tr>';

// Configuración de cada método disponible en el selector.
//   bloque    id del <div> que contiene sus inputs
//   campos    inputs que se deshabilitan cuando el método no está activo
//   requeridos subset de `campos` con required solo mientras esté activo
//   criterio  false cuando el método no usa criterio de paro (Taylor,
//             Lagrange y Simpson trabajan con un parámetro n, no iteran)
const CONFIG_METODOS = {
    biseccion: {
        bloque: 'inputs-biseccion',
        titulo: 'Método de Bisección',
        subtitulo: 'Análisis de Procedimiento y Raíces',
        cabecera: CABECERA_BISECCION,
        campos: ['funcion'],
        requeridos: ['funcion'],
        criterio: true,
    },
    puntofijo: {
        bloque: 'inputs-puntofijo',
        titulo: 'Iteración de Punto Fijo',
        subtitulo: 'Convergencia hacia x = g(x)',
        cabecera: CABECERA_PUNTOFIJO,
        campos: ['funcion-gx', 'x0'],
        requeridos: ['funcion-gx', 'x0'],
        criterio: true,
    },
    newton: {
        bloque: 'inputs-newton',
        titulo: 'Método de Newton-Raphson',
        subtitulo: 'Aproximación sucesiva xₙ₊₁ = xₙ - f(xₙ)/f\'(xₙ)',
        cabecera: CABECERA_NEWTON,
        campos: ['funcion-newton', 'x0-newton'],
        requeridos: ['funcion-newton', 'x0-newton'],
        criterio: true,
    },
    taylor: {
        bloque: 'inputs-taylor',
        titulo: 'Series de Taylor y Maclaurin',
        subtitulo: 'Aproximación polinómica Pₙ(x) alrededor del punto a',
        cabecera: CABECERA_TAYLOR,
        campos: ['funcion-taylor', 'a-taylor', 'x-taylor', 'n-taylor'],
        requeridos: ['funcion-taylor', 'a-taylor', 'x-taylor', 'n-taylor'],
        criterio: false,
    },
    lagrangelineal: {
        bloque: 'inputs-lagrangelineal',
        titulo: 'Interpolación Lineal de Lagrange',
        subtitulo: 'Recta que une dos puntos conocidos',
        cabecera: CABECERA_LAGRANGE_LINEAL,
        campos: ['x0-lineal', 'y0-lineal', 'x1-lineal', 'y1-lineal', 'x-lineal'],
        requeridos: ['x0-lineal', 'y0-lineal', 'x1-lineal', 'y1-lineal', 'x-lineal'],
        criterio: false,
    },
    lagrangepoly: {
        bloque: 'inputs-lagrangepoly',
        titulo: 'Interpolación Polinomial de Lagrange',
        subtitulo: 'Polinomio que pasa por todos los puntos dados',
        cabecera: CABECERA_LAGRANGE,
        campos: ['x-poly'],
        requeridos: ['x-poly'],
        criterio: false,
    },
    simpson: {
        bloque: 'inputs-simpson',
        titulo: 'Regla de Simpson 1/3',
        subtitulo: 'Integración numérica por parábolas',
        cabecera: CABECERA_SIMPSON,
        campos: ['funcion-simpson', 'a-simpson', 'b-simpson', 'n-simpson'],
        requeridos: ['funcion-simpson', 'a-simpson', 'b-simpson', 'n-simpson'],
        criterio: false,
    },
};

// Muestra u oculta los campos segun el metodo elegido
function alternarMetodoUI() {
    const selector = document.getElementById('metodo-selector');
    const metodo = selector ? selector.value : 'biseccion';
    const cfg = CONFIG_METODOS[metodo] || CONFIG_METODOS.biseccion;
    const claves = Object.keys(CONFIG_METODOS);

    // 1) Solo se ve el bloque de inputs del método activo
    claves.forEach((key) => {
        const div = document.getElementById(CONFIG_METODOS[key].bloque);
        if (div) div.style.display = key === metodo ? '' : 'none';
    });

    // 2) Los campos ocultos se deshabilitan para no bloquear el submit de
    //    HTML5; los del método activo recuperan su `required` de config.
    claves.forEach((key) => {
        const activo = key === metodo;
        const cfgM = CONFIG_METODOS[key];
        (cfgM.campos || []).forEach((id) => {
            const campo = document.getElementById(id);
            if (!campo) return;
            campo.disabled = !activo;
            campo.required = activo && (cfgM.requeridos || []).indexOf(id) !== -1;
        });
    });

    // 3) El criterio de paro solo aplica a los métodos iterativos
    const usaCriterio = cfg.criterio !== false;
    ['grupo-criterio', 'grupo-valor-criterio'].forEach((id) => {
        const grupo = document.getElementById(id);
        if (grupo) grupo.style.display = usaCriterio ? '' : 'none';
    });
    const selCriterio = document.getElementById('criterio');
    if (selCriterio) { selCriterio.disabled = !usaCriterio; selCriterio.required = usaCriterio; }
    const valCriterio = document.getElementById('valorCriterio');
    if (valCriterio) { valCriterio.disabled = !usaCriterio; valCriterio.required = usaCriterio; }
    // Al cambiar de método no se arrastra el valor del criterio anterior
    // (p. ej. un Ea % heredado de Bisección usado como tolerancia).
    if (usaCriterio && typeof mostrarCampoCriterio === 'function') mostrarCampoCriterio(true);

    // 4) Cabecera de tabla, título y subtítulo
    const cabecera = document.getElementById('tabla-cabecera');
    if (cabecera) cabecera.innerHTML = cfg.cabecera;
    const titulo = document.getElementById('titulo-metodo');
    if (titulo) titulo.innerText = cfg.titulo;
    const subtitulo = document.getElementById('subtitulo-metodo');
    if (subtitulo) subtitulo.innerText = cfg.subtitulo;

    // 5) Botón "Graficar" (gráfica independiente del método): solo aparece en
    //    los métodos cuyo primer campo es una función escrita a mano. Lagrange
    //    trabaja con puntos, así que ahí no hay nada que graficar por su cuenta.
    const btnGraf = document.getElementById('btn-graficar-libre');
    if (btnGraf) {
        const esFuncion = typeof (cfg.campos || [])[0] === 'string' && cfg.campos[0].indexOf('funcion') === 0;
        btnGraf.style.display = esFuncion ? '' : 'none';
    }

    limpiarTabla();
}

// Router: qué función ejecuta cada valor del selector (se resuelven en
// window al momento del submit, cuando todos los módulos ya cargaron).
const EJECUTORES = {
    biseccion: 'calcularBiseccion',
    puntofijo: 'calcularPuntoFijo',
    newton: 'calcularNewton',
    taylor: 'calcularTaylor',
    lagrangelineal: 'calcularLagrangeLineal',
    lagrangepoly: 'calcularLagrangePolinomial',
    simpson: 'calcularSimpson',
};

// Se exponen para que los tests (y la consola) puedan inspeccionarlas
window.CONFIG_METODOS = CONFIG_METODOS;
window.EJECUTORES = EJECUTORES;

// Router: decide que algoritmo ejecutar segun el metodo activo.
// Espera al motor lazy (math/KaTeX) antes de calcular.
async function ejecutarCalculo(event) {
    event.preventDefault();
    if (window.Vendor && window.Vendor.ensureCalc) {
        try {
            await window.Vendor.ensureCalc();
        } catch (e) {
            mostrarError('No se pudo cargar el motor matemático. Revisa tu conexión e intenta de nuevo.');
            return;
        }
    } else if (typeof math === 'undefined') {
        mostrarError('El motor matemático aún se está cargando. Intenta de nuevo en un momento.');
        return;
    }
    const metodo = document.getElementById('metodo-selector').value;
    const nombre = EJECUTORES[metodo];
    const fn = nombre ? window[nombre] : null;
    if (typeof fn === 'function') {
        // Cualquier excepción del método debe verse en pantalla: sin este
        // try/catch un fallo quedaba como "no pasa nada" (promesa rechazada
        // de un handler async sin capturar).
        try {
            const r = fn();
            if (r && typeof r.catch === 'function') {
                r.catch((e) => mostrarError('Error inesperado al calcular: ' + (e && e.message ? e.message : e)));
            }
        } catch (e) {
            mostrarError('Error inesperado al calcular: ' + (e && e.message ? e.message : e));
        }
    } else {
        mostrarError(`Este método aún no está disponible ("${metodo}"). Recarga la página o elige otra opción.`);
    }
}

// Aviso no bloqueante si |g'(x0)| > 1 (posible divergencia).
// El caso límite exacto |g'| = 1 NO avisa: con ln(x)+2 y x₀=1 (g'=1) el
// método converge igualmente y el aviso solo confundía.
function avisarConvergencia(exprG, x0) {
    if (typeof math === 'undefined' || !math.derivative) return true;
    try {
        const derivada = math.derivative(normalizarExpresion(exprG), 'x').evaluate({ x: x0 });
        if (Number.isFinite(derivada) && Math.abs(derivada) > 1) {
            mostrarError(`Aviso: |g'(${x0})| = ${Math.abs(derivada).toFixed(4)} > 1. El método puede diverger. Se continúa el cálculo.`);
            return false;
        }
    } catch (e) {
        // Si no se puede derivar, se omite el aviso en silencio
    }
    return true;
}

// --- ALGORITMO DE ITERACIÓN DE PUNTO FIJO ---

function calcularPuntoFijo() {
    const exprG = document.getElementById('funcion-gx').value.trim();
    let x_actual = parseNumeroConConstantes(document.getElementById('x0').value);

    const crit = leerCriterio();
    if (!crit) return;
    const { criterio, valor: valorCriterio } = crit;

    limpiarTabla();
    const resContainer = document.getElementById('resultado-container');
    const tbody = document.getElementById('tabla-cuerpo');

    if (!exprG) {
        mostrarError('Error: Escribe la función despejada g(x).');
        return;
    }
    if (!Number.isFinite(x_actual)) {
        mostrarError('Error: El valor inicial X₀ debe ser un número válido.');
        return;
    }

    // Pre-chequeo de convergencia (aviso no bloqueante, se continua iterando)
    avisarConvergencia(exprG, x_actual);

    const xs = [];
    let x_anterior = null;
    let g_last = NaN, x_last = NaN, ea_last = null;
    let criterioAlcanzado = false;
    let motivoParo = null;
    // Paro ANTES de llegar al límite de iteraciones (divergencia o error de
    // evaluación): el mensaje post-loop debe decir la iteración real, no el
    // "límite de 100 iteraciones" (bug reportado: paraba en la 14 y decía 100).
    let paroAnticipado = false;
    const maxIterSolicitado = criterio === 'iteraciones' ? Math.max(1, Math.floor(valorCriterio)) : 100;
    const maxIter = Math.min(100, maxIterSolicitado);
    const truncadoPorLimite = maxIterSolicitado > maxIter;
    let n = 1;

    while (n <= maxIter) {
        // Evaluar g(x). Se distingue un infinito (divergencia) de un NaN o un
        // throw (fuera de dominio / sintaxis), con el mismo criterio que
        // Bisección: mensajeErrorEvaluacion reutilizado con el nombre g(x).
        let g_x = NaN;
        try {
            const crudo = math.evaluate(normalizarExpresion(exprG), { x: x_actual });
            // Complejos, booleanos o símbolos no son iterables: se tratan como NaN
            if (typeof crudo === 'number') g_x = crudo;
        } catch (e) {
            g_x = NaN;
        }
        xs.push(x_actual);

        // Control de valores no válidos (dominio, complejos o infinitos)
        if (!Number.isFinite(g_x)) {
            if (g_x === Infinity || g_x === -Infinity) {
                mostrarError(`Divergencia: g(x) tiende a ${g_x > 0 ? '+∞' : '−∞'} en la iteración ${n}; la secuencia no acota.`);
                motivoParo = 'divergencia';
            } else {
                mostrarError(mensajeErrorEvaluacion(exprG, `x = ${x_actual}`, 'g(x)'));
                motivoParo = 'error de evaluación de g(x)';
            }
            paroAnticipado = true;
            break;
        }

        // Error relativo porcentual |g(x) - x| / |g(x)|
        let ea = null;
        if (x_anterior !== null && g_x !== 0) {
            ea = Math.abs((g_x - x_actual) / g_x) * 100;
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `<td data-label="Iter (n)">${n}</td><td data-label="x">${x_actual.toFixed(6)}</td><td data-label="g(x)">${g_x.toFixed(6)}</td><td data-label="Ea (%)">${ea === null ? '--' : ea.toFixed(4) + '%'}</td>`;
        tbody.appendChild(tr);

        g_last = g_x;
        x_last = x_actual;
        ea_last = ea;

        // Criterios de paro (registrando cuál se cumplió)
        if (criterio === 'iteraciones' && n >= maxIter) {
            criterioAlcanzado = true;
            motivoParo = `${n} iteraciones pedidas`;
            break;
        }
        if (criterio === 'tolerancia' && Math.abs(g_x - x_actual) <= valorCriterio) {
            criterioAlcanzado = true;
            motivoParo = `|g(x) - x| ≤ ${numTexto(valorCriterio)}`;
            break;
        }
        if (criterio === 'error' && ea !== null && ea <= valorCriterio) {
            criterioAlcanzado = true;
            motivoParo = `Ea ≤ ${numTexto(valorCriterio)}%`;
            break;
        }

        // Divergencia: el valor se aleja demasiado de la solucion
        if (Math.abs(g_x) > 1e6) {
            mostrarError('Divergencia: El valor se está alejando demasiado de la solución.');
            motivoParo = 'divergencia';
            paroAnticipado = true;
            break;
        }

        // Preparar siguiente iteración: el nuevo x es el g(x) calculado
        x_anterior = x_actual;
        x_actual = g_x;
        n++;
    }
    resContainer.style.display = 'block';
    if (paroAnticipado) {
        // Paro por divergencia/error antes del límite: se informa la iteración
        // REAL en la que se detuvo (la misma que cuentan las filas de la tabla).
        agregarInfo(
            `El cálculo se detuvo en la iteración ${n} (${motivoParo || 'paro anticipado'}) ` +
            `antes de las ${maxIter} iteraciones; no se cumplió el criterio de paro.` +
            (truncadoPorLimite ? ` Se habían pedido ${maxIterSolicitado} iteraciones (límite de seguridad: ${maxIter}).` : ''),
            'info'
        );
    } else if (truncadoPorLimite) {
        agregarInfo(`Se solicitaron ${maxIterSolicitado} iteraciones, pero el cálculo se limitó a ${maxIter} por seguridad.`, 'info');
    } else if (!criterioAlcanzado) {
        agregarInfo(`Se alcanzó el límite de ${maxIter} iteraciones sin cumplir el criterio de paro.`, 'info');
    }
    const residuo = (Number.isFinite(g_last) && Number.isFinite(x_last)) ? Math.abs(g_last - x_last) : NaN;

    // Verificación de que el punto fijo ES una solución: |g(x) - x| debe ser
    // pequeña. Si el criterio es de tolerancia/error se usa su valor; si fue
    // por iteraciones (que no define precisión) se usa la tolerancia por
    // defecto del sitio. Cumplir "100 iteraciones" con |g(x)-x| = 1.8 NO es
    // una raíz: con g(x) = x²-2 y x₀ = 1.9 la secuencia diverge.
    const umbralResiduo = (criterio === 'iteraciones')
        ? Number(VALORES_CRITERIO.tolerancia)
        : Math.max(valorCriterio, 1e-12);
    const residuoOk = Number.isFinite(residuo) && residuo <= umbralResiduo;

    const etiquetas = {
        fx: '|g(x) - x| Final',
        tolerancia: `|g(x) - x| ≤ ${numTexto(valorCriterio)}`,
        motivo: motivoParo,
        abs: true,
    };
    if (!criterioAlcanzado || !residuoOk) {
        // Sin convergencia NO se presenta como raíz: se etiqueta como lo que
        // es (el último iterado) y se avisa explícitamente.
        etiquetas.etiquetaRaiz = 'Último iterado (sin converger)';
        etiquetas.estado = 'fallo';
        if (paroAnticipado) {
            // Divergencia: el iterado final es un número gigante sin valor
            // informativo; la tarjeta muestra '—' (el detalle quedó en la
            // tabla y en el mensaje de error).
            etiquetas.raizStr = '—';
            etiquetas.fxStr = '—';
            etiquetas.estadoTexto = `Detenido en la iteración ${n} (sin converger)`;
        } else if (!criterioAlcanzado) {
            etiquetas.estadoTexto = 'Criterio no alcanzado';
        } else {
            etiquetas.estadoTexto =
                `Iteraciones cumplidas, pero sin convergencia (|g(x)-x| = ${Number.isFinite(residuo) ? numTexto(residuo) : 'N/A'})`;
        }
        agregarInfo(
            `El método NO convergió: |g(x) - x| = ${Number.isFinite(residuo) ? numTexto(residuo) : 'N/A'} en ` +
            `${tbody.children.length} iteraciones. El valor mostrado NO es una raíz verificada.`,
            'aviso'
        );
    }

    mostrarResumen(
        g_last, residuo,
        tbody.children.length,
        criterio, valorCriterio, ea_last, criterioAlcanzado && residuoOk, etiquetas
    );
    // La gráfica incluye la recta y = x: el punto fijo es su intersección
    graficarResultado(exprG, {
        xs,
        raiz: (criterioAlcanzado && residuoOk) ? g_last : null,
        identidad: true,
        titulo: 'g(x) y la recta y = x',
    });
}

window.alternarMetodoUI = alternarMetodoUI;
window.ejecutarCalculo = ejecutarCalculo;
window.calcularPuntoFijo = calcularPuntoFijo;

// Sincronizar UI y previews al cargar (biseccion por defecto)
document.addEventListener('DOMContentLoaded', () => {
    cablearPreview('funcion-gx', 'preview-gx', 'g(x)');
    if (document.getElementById('metodo-selector')) {
        alternarMetodoUI();
    }
});
