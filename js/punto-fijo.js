// ============================================================================
// Portal Numérico - Punto Fijo Module
// ============================================================================
// Contiene: selector de metodo, router de calculo y logica del metodo
// de iteracion de punto fijo para calculadora.html
// ============================================================================

const CABECERA_BISECCION = '<tr><th>Iter</th><th>a</th><th>b</th><th>x_m</th><th>f(x_m)</th><th>Ea (%)</th></tr>';
const CABECERA_PUNTOFIJO = '<tr><th>Iter (n)</th><th>x</th><th>g(x)</th><th>Ea (%)</th></tr>';

// Muestra u oculta los campos segun el metodo elegido
function alternarMetodoUI() {
    const metodo = document.getElementById('metodo-selector').value;
    const divBiseccion = document.getElementById('inputs-biseccion');
    const divPuntoFijo = document.getElementById('inputs-puntofijo');
    const cabecera = document.getElementById('tabla-cabecera');
    const titulo = document.getElementById('titulo-metodo');
    const subtitulo = document.getElementById('subtitulo-metodo');

    const esBiseccion = metodo === 'biseccion';

    if (divBiseccion) divBiseccion.style.display = esBiseccion ? '' : 'none';
    if (divPuntoFijo) divPuntoFijo.style.display = esBiseccion ? 'none' : '';

    // Los campos ocultos no deben bloquear el submit de HTML5
    const campoFx = document.getElementById('funcion');
    const campoGx = document.getElementById('funcion-gx');
    const campoX0 = document.getElementById('x0');
    if (campoFx) { campoFx.required = esBiseccion; campoFx.disabled = !esBiseccion; }
    if (campoGx) { campoGx.required = !esBiseccion; campoGx.disabled = esBiseccion; }
    if (campoX0) { campoX0.required = !esBiseccion; campoX0.disabled = esBiseccion; }

    if (cabecera) cabecera.innerHTML = esBiseccion ? CABECERA_BISECCION : CABECERA_PUNTOFIJO;

    if (titulo) titulo.innerText = esBiseccion ? 'Método de Bisección' : 'Iteración de Punto Fijo';
    if (subtitulo) subtitulo.innerText = esBiseccion ? 'Análisis de Procedimiento y Raíces' : 'Convergencia hacia x = g(x)';

    limpiarTabla();
}

// Router: decide que algoritmo ejecutar segun el metodo activo
function ejecutarCalculo(event) {
    event.preventDefault();
    const metodo = document.getElementById('metodo-selector').value;

    if (metodo === 'biseccion') {
        calcularBiseccion();
    } else if (metodo === 'puntofijo') {
        calcularPuntoFijo();
    }
}

// Aviso no bloqueante si |g'(x0)| >= 1 (posible divergencia)
function avisarConvergencia(exprG, x0) {
    try {
        const derivada = math.derivative(exprG, 'x').evaluate({ x: x0 });
        if (Number.isFinite(derivada) && Math.abs(derivada) >= 1) {
            mostrarError(`Aviso: |g'(${x0})| = ${Math.abs(derivada).toFixed(4)} >= 1. El método puede diverger. Se continúa el cálculo.`);
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
    let x_actual = parseFloat(document.getElementById('x0').value);

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

    let x_anterior = null;
    const maxIter = criterio === 'iteraciones' ? Math.min(100, Math.max(1, Math.floor(valorCriterio))) : 100;
    let n = 1;

    while (n <= maxIter) {
        // Evaluar g(x). Los complejos/infinitos llegan como NaN.
        const g_x = evaluarFuncion(exprG, x_actual);

        // Control de divergencia (complejos, NaN o infinito)
        if (!Number.isFinite(g_x)) {
            mostrarError(`Divergencia detectada en la iteración ${n}. La función produjo un valor no válido (ej. número complejo o infinito).`);
            break;
        }

        // Error relativo porcentual |g(x) - x| / |g(x)|
        let ea = null;
        if (x_anterior !== null && g_x !== 0) {
            ea = Math.abs((g_x - x_actual) / g_x) * 100;
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${n}</td><td>${x_actual.toFixed(6)}</td><td>${g_x.toFixed(6)}</td><td>${ea === null ? '--' : ea.toFixed(4) + '%'}</td>`;
        tbody.appendChild(tr);

        // Criterios de paro
        if (criterio === 'iteraciones' && n >= maxIter) break;
        if (criterio === 'tolerancia' && Math.abs(g_x - x_actual) <= valorCriterio) break;
        if (criterio === 'error' && ea !== null && ea <= valorCriterio) break;

        // Divergencia: el valor se aleja demasiado de la solucion
        if (Math.abs(g_x) > 1e6) {
            mostrarError('Divergencia: El valor se está alejando demasiado de la solución.');
            break;
        }

        // Preparar siguiente iteración: el nuevo x es el g(x) calculado
        x_anterior = x_actual;
        x_actual = g_x;
        n++;
    }
    resContainer.style.display = 'block';
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
