// ============================================================================
// Portal Numérico - Punto Fijo Module
// ============================================================================
// Contiene: selector de metodo, router de calculo y logica del metodo
// de iteracion de punto fijo para calculadora.html
// ============================================================================

const CABECERA_BISECCION = '<tr><th>Iter</th><th>a</th><th>b</th><th>x_m</th><th>f(x_m)</th><th>Ea (%)</th></tr>';
const CABECERA_PUNTOFIJO = '<tr><th>Iter (n)</th><th>x</th><th>g(x)</th><th>Ea (%)</th></tr>';
const CABECERA_NEWTON = '<tr><th>Iter (n)</th><th>xₙ</th><th>f(xₙ)</th><th>f\'(xₙ)</th><th>xₙ₊₁</th><th>Ea (%)</th></tr>';

// Muestra u oculta los campos segun el metodo elegido
function alternarMetodoUI() {
    const metodo = document.getElementById('metodo-selector').value;
    const divBiseccion = document.getElementById('inputs-biseccion');
    const divPuntoFijo = document.getElementById('inputs-puntofijo');
    const divNewton = document.getElementById('inputs-newton');
    const cabecera = document.getElementById('tabla-cabecera');
    const titulo = document.getElementById('titulo-metodo');
    const subtitulo = document.getElementById('subtitulo-metodo');

    const esBiseccion = metodo === 'biseccion';
    const esPuntoFijo = metodo === 'puntofijo';
    const esNewton = metodo === 'newton';

    if (divBiseccion) divBiseccion.style.display = esBiseccion ? '' : 'none';
    if (divPuntoFijo) divPuntoFijo.style.display = esPuntoFijo ? '' : 'none';
    if (divNewton) divNewton.style.display = esNewton ? '' : 'none';

    // Mostrar/ocultar contenedores de ejemplos según el método
    const ejBiseccion = document.getElementById('ejemplos-biseccion');
    const ejPuntoFijo = document.getElementById('ejemplos-puntofijo');
    const ejNewton = document.getElementById('ejemplos-newton');
    if (ejBiseccion) ejBiseccion.style.display = esBiseccion ? 'block' : 'none';
    if (ejPuntoFijo) ejPuntoFijo.style.display = esPuntoFijo ? 'block' : 'none';
    if (ejNewton) ejNewton.style.display = esNewton ? 'block' : 'none';

    // Los campos ocultos no deben bloquear el submit de HTML5
    const campoFx = document.getElementById('funcion');
    const campoGx = document.getElementById('funcion-gx');
    const campoX0 = document.getElementById('x0');
    const campoFxNewton = document.getElementById('funcion-newton');
    const campoX0Newton = document.getElementById('x0-newton');
    
    if (campoFx) { campoFx.required = esBiseccion; campoFx.disabled = !esBiseccion; }
    if (campoGx) { campoGx.required = esPuntoFijo; campoGx.disabled = !esPuntoFijo; }
    if (campoX0) { campoX0.required = esPuntoFijo; campoX0.disabled = !esPuntoFijo; }
    if (campoFxNewton) { campoFxNewton.required = esNewton; campoFxNewton.disabled = !esNewton; }
    if (campoX0Newton) { campoX0Newton.required = esNewton; campoX0Newton.disabled = !esNewton; }

    if (cabecera) {
        if (esBiseccion) cabecera.innerHTML = CABECERA_BISECCION;
        else if (esPuntoFijo) cabecera.innerHTML = CABECERA_PUNTOFIJO;
        else if (esNewton) cabecera.innerHTML = CABECERA_NEWTON;
    }

    if (titulo) {
        if (esBiseccion) titulo.innerText = 'Método de Bisección';
        else if (esPuntoFijo) titulo.innerText = 'Iteración de Punto Fijo';
        else if (esNewton) titulo.innerText = 'Método de Newton-Raphson';
    }
    if (subtitulo) {
        if (esBiseccion) subtitulo.innerText = 'Análisis de Procedimiento y Raíces';
        else if (esPuntoFijo) subtitulo.innerText = 'Convergencia hacia x = g(x)';
        else if (esNewton) subtitulo.innerText = 'Aproximación sucesiva xₙ₊₁ = xₙ - f(xₙ)/f\'(xₙ)';
    }

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
    } else if (metodo === 'newton') {
        calcularNewton();
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
    let g_last = NaN, x_last = NaN, ea_last = null;
    let criterioAlcanzado = false;
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
        tr.innerHTML = `<td data-label="Iter (n)">${n}</td><td data-label="x">${x_actual.toFixed(6)}</td><td data-label="g(x)">${g_x.toFixed(6)}</td><td data-label="Ea (%)">${ea === null ? '--' : ea.toFixed(4) + '%'}</td>`;
        tbody.appendChild(tr);

        g_last = g_x;
        x_last = x_actual;
        ea_last = ea;

        // Criterios de paro
        if (criterio === 'iteraciones' && n >= maxIter) { criterioAlcanzado = true; break; }
        if (criterio === 'tolerancia' && Math.abs(g_x - x_actual) <= valorCriterio) { criterioAlcanzado = true; break; }
        if (criterio === 'error' && ea !== null && ea <= valorCriterio) { criterioAlcanzado = true; break; }

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
    const residuo = (Number.isFinite(g_last) && Number.isFinite(x_last)) ? Math.abs(g_last - x_last) : NaN;
    mostrarResumen(g_last, residuo, n, criterio, valorCriterio, ea_last, criterioAlcanzado, {
        fx: '|g(x) - x| Final',
        tolerancia: `|g(x) - x| ≤ ${Number(valorCriterio).toFixed(6)}`
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

// --- CARGAR EJEMPLOS DE BISECCIÓN ---
function cargarEjemploBiseccion(expr) {
    const input = document.getElementById('funcion');
    if (input) {
        input.value = expr;
        input.dispatchEvent(new Event('input'));
    }
}

window.cargarEjemploBiseccion = cargarEjemploBiseccion;

// --- CARGAR EJEMPLOS DE PUNTO FIJO ---
function cargarEjemploPuntoFijo(expr, x0) {
    const inputGx = document.getElementById('funcion-gx');
    const inputX0 = document.getElementById('x0');
    if (inputGx) {
        inputGx.value = expr;
        inputGx.dispatchEvent(new Event('input'));
    }
    if (inputX0) {
        inputX0.value = x0;
    }
}

window.cargarEjemploPuntoFijo = cargarEjemploPuntoFijo;
