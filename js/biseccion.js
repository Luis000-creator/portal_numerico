// ============================================================================
// Portal Numérico - Bisección Module
// ============================================================================
// Contiene: evaluador de expresiones, lógica de método de bisección,
// renderizado KaTEX y utilidades de navegación entre secciones
// ============================================================================

// --- CONFIGURACIÓN GLOBAL DE NAVEGACIÓN ---

function cambiarSeccion(seccion, elemento) {
    document.querySelectorAll('.section-block').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-links a').forEach(el => el.classList.remove('active-link'));

    const target = document.getElementById('seccion-' + seccion);
    if (target) target.classList.add('active');
    if (elemento) elemento.classList.add('active-link');

    if (typeof particleAnimation !== 'undefined' && particleAnimation) {
        particleAnimation.regenerateSymbols();
    }
}

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

function filtrarContenido() {
    const q = document.getElementById('buscador').value.toLowerCase().trim();
    document.querySelectorAll('.apunte-card').forEach(card => {
        card.style.display = card.innerText.toLowerCase().includes(q) ? '' : 'none';
    });
}

// Exponer globalmente
window.cambiarSeccion = cambiarSeccion;
window.mostrarCampoCriterio = mostrarCampoCriterio;
window.filtrarContenido = filtrarContenido;

// --- EVALUADOR DE EXPRESIONES MATEMÁTICAS ---

// Usamos mathjs para evaluación segura en lugar de Function() + regexs frágiles
// Carga esta librería desde index.html: <script src="https://cdn.jsdelivr.net/npm/mathjs@11.7.0/lib/es5/index.js"></script>

function evaluarFuncion(expr, x) {
    try {
        // mathjs maneja el simbolo '^' de forma nativa
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

// Exponer globalmente para uso en index.html
window.evaluarFuncion = evaluarFuncion;
window.buscarIntervaloAuto = buscarIntervaloAuto;

// --- RENDERIZADO KATEX ---

// Renderiza formulas LaTeX con KaTeX en cualquier parte del texto
function renderizarMath(elemento) {
    let html = elemento.innerHTML;

    // Funcion auxiliar para revertir los caracteres seguros a matematicos
    const decodificarMath = (texto) => {
        return texto.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
    };

    // Renderizar display math (formulas centradas entre $$ ... $$)
    html = html.replace(/\$\$([\s\S]*?)\$\$/g, (match, math) => {
        try { return katex.renderToString(decodificarMath(math), { displayMode: true, throwOnError: false }); }
        catch (e) { return match; }
    });

    // Renderizar inline math (formulas en linea entre $ ... $)
    html = html.replace(/\$([\s\S]*?)\$/g, (match, math) => {
        try { return katex.renderToString(decodificarMath(math), { displayMode: false, throwOnError: false }); }
        catch (e) { return match; }
    });

    elemento.innerHTML = html;
}

// --- LÓGICA DE BISECCIÓN CLIENT-SIDE ---

function ejecutarBiseccion(event) {
    event.preventDefault();

    const expr = document.getElementById('funcion').value;
    let a = parseFloat(document.getElementById('a').value);
    let b = parseFloat(document.getElementById('b').value);
    const criterio = document.getElementById('criterio').value;
    const valorCriterio = parseFloat(document.getElementById('valorCriterio').value);

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

document.addEventListener('DOMContentLoaded', () => {
    // Revisar si hay un hash en la URL (ej. #seccion-teoria)
    const hash = window.location.hash;
    if (hash) {
        // Extraemos el nombre (ej. 'teoria')
        const seccion = hash.replace('#seccion-', '');
        // Buscamos el enlace en el menu de navegacion para ponerlo activo
        const link = document.querySelector(`.nav-links a[onclick*="${seccion}"]`);

        if (link || document.getElementById('seccion-' + seccion)) {
            cambiarSeccion(seccion, link);
        }
    }
});