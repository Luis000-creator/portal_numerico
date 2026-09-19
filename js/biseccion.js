// ============================================================================
// Portal Numérico - Bisección Module
// ============================================================================
// Contiene: evaluador de expresiones con mathjs y logica del metodo
// de biseccion para calculadora.html
// ============================================================================

function mostrarCampoCriterio() {
    const criterio = document.getElementById('criterio');
    const label = document.getElementById('label-criterio');
    const input = document.getElementById('valorCriterio');
    if (!criterio || !label || !input) return;

    const valor = criterio.value;
    if (valor === 'tolerancia') {
        label.innerText = "Valor de Tolerancia";
        input.placeholder = "0.0001";
    } else if (valor === 'error') {
        label.innerText = "Porcentaje de Error Máximo Permitido (%)";
        input.placeholder = "1.0 o 0.5";
    } else if (valor === 'iteraciones') {
        label.innerText = "Número Exacto de Iteraciones";
        input.placeholder = "10 o 15";
    }
}

// Exponer globalmente
window.mostrarCampoCriterio = mostrarCampoCriterio;

// --- EVALUADOR DE EXPRESIONES MATEMÁTICAS ---

// Usamos mathjs (CDN UMD en calculadora.html) para evaluacion segura.
// mathjs maneja el simbolo '^', constantes y funciones de forma nativa.

function evaluarFuncion(expr, x) {
    try {
        const result = math.evaluate(expr, { x });
        return Number.isFinite(result) ? result : NaN;
    } catch (err) { return NaN; }
}

function buscarIntervaloAuto(expr) {
    const inicio = -50.0, fin = 50.0, paso = 0.25;
    for (let x = inicio; x < fin; x += paso) {
        const fa = evaluarFuncion(expr, x);
        const fb = evaluarFuncion(expr, x + paso);
        if (isNaN(fa) || isNaN(fb)) continue;
        if (Math.abs(fa) < 1e-12) return [x, x + paso];
        if (fa * fb < 0) return [x, x + paso];
    }
    return [0, 2];
}

// Exponer globalmente
window.evaluarFuncion = evaluarFuncion;
window.buscarIntervaloAuto = buscarIntervaloAuto;

// Helpers de UI para errores
function mostrarError(mensaje) {
    const errorBox = document.getElementById('error-box');
    const errorText = document.getElementById('error-text');
    if (errorBox && errorText) {
        errorText.innerText = mensaje;
        errorBox.style.display = 'block';
    }
}

// --- LÓGICA DE BISECCIÓN CLIENT-SIDE ---

function ejecutarBiseccion(event) {
    event.preventDefault();

    const expr = document.getElementById('funcion').value;
    const criterio = document.getElementById('criterio').value;

    // 1. Evaluación de Fracciones para la Tolerancia
    let valorCriterio;
    try {
        valorCriterio = math.evaluate(document.getElementById('valorCriterio').value);
        valorCriterio = Number(valorCriterio);
    } catch (e) {
        mostrarError('El valor del criterio debe ser un número o una fracción válida (ej. 1/16).');
        return;
    }

    // 2. Lógica de Intervalo Automático
    let a_str = document.getElementById('a').value.trim();
    let b_str = document.getElementById('b').value.trim();
    let a, b;

    if (a_str === '' || b_str === '') {
        const autoInt = buscarIntervaloAuto(expr);
        a = autoInt[0];
        b = autoInt[1];
        document.getElementById('a').value = a;
        document.getElementById('b').value = b;
    } else {
        a = parseFloat(a_str);
        b = parseFloat(b_str);
    }

    const errorBox = document.getElementById('error-box');
    const errorText = document.getElementById('error-text');
    const resContainer = document.getElementById('resultado-container');
    const tbody = document.getElementById('tabla-cuerpo');

    errorBox.style.display = 'none';
    resContainer.style.display = 'none';
    tbody.innerHTML = '';

    if (!Number.isFinite(a) || !Number.isFinite(b) || a >= b) {
        errorText.innerText = 'Error: El intervalo debe cumplir a < b y contener números válidos.';
        errorBox.style.display = 'block'; return;
    }
    if (!Number.isFinite(valorCriterio) || valorCriterio <= 0) {
        errorText.innerText = 'Error: El criterio de paro debe ser mayor que 0.';
        errorBox.style.display = 'block'; return;
    }

    let fa = evaluarFuncion(expr, a);
    let fb = evaluarFuncion(expr, b);
    if (!Number.isFinite(fa) || !Number.isFinite(fb)) {
        errorText.innerText = 'Error: Revisa la sintaxis de tu función f(x).';
        errorBox.style.display = 'block'; return;
    }
    if (fa === 0 || fb === 0) {
        const root = fa === 0 ? a : b;
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>0</td><td>${a}</td><td>${b}</td><td>${root.toFixed(4)}</td><td>0.0000</td><td>--</td>`;
        tbody.appendChild(tr); resContainer.style.display='block'; return;
    }
    if (fa * fb > 0) {
        errorText.innerText = 'Error: f(a) y f(b) deben tener signos opuestos (Teorema de Bolzano).';
        errorBox.style.display = 'block'; return;
    }

    let x_m_anterior = null;
    const maxIter = criterio === 'iteraciones' ? Math.min(100, Math.max(1, Math.floor(valorCriterio))) : 100;
    let n = 1;
    while (n <= maxIter) {
        const x_m = (a + b) / 2;
        const fx_m = evaluarFuncion(expr, x_m);
        if (!Number.isFinite(fx_m)) {
            errorText.innerText = 'Error: La función produjo un valor no válido durante el cálculo.';
            errorBox.style.display = 'block'; return;
        }
        const ea = x_m_anterior === null ? null : Math.abs((x_m - x_m_anterior) / x_m) * 100;
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${n}</td><td>${a.toFixed(4)}</td><td>${b.toFixed(4)}</td><td>${x_m.toFixed(4)}</td><td>${fx_m.toFixed(4)}</td><td>${ea === null ? '--' : ea.toFixed(4) + '%'}</td>`;
        tbody.appendChild(tr);

        if (criterio === 'iteraciones' && n >= maxIter) break;
        if (criterio === 'tolerancia' && Math.abs(fx_m) <= valorCriterio) break;
        if (criterio === 'error' && ea !== null && ea <= valorCriterio) break;

        if (fa * fx_m < 0) { b = x_m; fb = fx_m; }
        else { a = x_m; fa = fx_m; }
        x_m_anterior = x_m;
        n++;
    }
    resContainer.style.display = 'block';
}

window.ejecutarBiseccion = ejecutarBiseccion;
window.mostrarError = mostrarError;

// --- PREVISUALIZACIÓN EN VIVO CON KATEX ---
document.addEventListener('DOMContentLoaded', () => {
    const inputFuncion = document.getElementById('funcion');
    if (inputFuncion) {
        inputFuncion.addEventListener('input', function(e) {
            const expr = e.target.value;
            const preview = document.getElementById('preview-fx');
            if (!preview) return;
            if (!expr) {
                preview.innerHTML = '';
                return;
            }
            try {
                const latex = math.parse(expr).toTex();
                katex.render(`f(x) = ${latex}`, preview, { displayMode: true, throwOnError: false });
            } catch (err) {
                // Ignorar errores silenciosamente mientras el usuario sigue escribiendo
            }
        });
    }
});
