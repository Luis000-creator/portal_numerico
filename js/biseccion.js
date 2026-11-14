// ============================================================================
// Itera - Bisección Module
// ============================================================================
// Contiene: evaluador de expresiones con mathjs y logica del metodo
// de biseccion para calculadora.html
// ============================================================================

// Valores por defecto de cada criterio. Se reasignan al cambiar de criterio
// o de método para que no se arrastre un valor que no tiene sentido
// (p. ej. "5 iteraciones" usada como tolerancia, o un Ea % heredado).
const VALORES_CRITERIO = {
    tolerancia: '0.001',
    error: '1',
    iteraciones: '100',
};

//   reiniciar: true cuando cambia el criterio/método (reescribe el valor);
//               false al cargar la página (solo rellena si está vacío).
function mostrarCampoCriterio(reiniciar = false) {
    const criterio = document.getElementById('criterio');
    const label = document.getElementById('label-criterio');
    const input = document.getElementById('valorCriterio');
    if (!criterio || !label || !input) return;

    const valor = criterio.value;
    if (valor === 'tolerancia') {
        label.innerText = "Valor de Tolerancia";
        input.placeholder = "0.001";
    } else if (valor === 'error') {
        label.innerText = "Porcentaje de Error Máximo Permitido (%)";
        input.placeholder = "1.0 o 0.5";
    } else if (valor === 'iteraciones') {
        label.innerText = "Número Exacto de Iteraciones";
        input.placeholder = "10 o 15";
    }

    const porDefecto = VALORES_CRITERIO[valor];
    if (porDefecto && (reiniciar || input.value.trim() === '')) {
        input.value = porDefecto;
    }
}

// Exponer globalmente
window.mostrarCampoCriterio = mostrarCampoCriterio;

// --- MOSTRAR MENSAJE DE INFO (intervalo auto, avisos, etc.) ---
function mostrarInfo(mensaje, tipo = 'info') {
    const box = document.getElementById('info-box');
    const text = document.getElementById('info-text');
    if (!box || !text) return;
    text.innerHTML = mensaje;
    box.className = 'info-box info-box--' + tipo;
    box.style.display = 'block';
}

function ocultarInfo() {
    const box = document.getElementById('info-box');
    if (box) box.style.display = 'none';
}

// Agrega un aviso al cuadro de info sin borrar los mensajes ya mostrados
// (mostrarInfo reemplaza el contenido; aquí se acumulan).
function agregarInfo(mensaje, tipo = 'info') {
    const box = document.getElementById('info-box');
    const text = document.getElementById('info-text');
    const previo = (box && text && box.style.display === 'block') ? text.innerHTML + ' ' : '';
    mostrarInfo(previo + mensaje, tipo);
}

window.mostrarInfo = mostrarInfo;
window.ocultarInfo = ocultarInfo;
window.agregarInfo = agregarInfo;

// --- EVALUADOR DE EXPRESIONES MATEMÁTICAS ---

// Usamos mathjs (CDN UMD en calculadora.html) para evaluacion segura.
// mathjs maneja el simbolo '^', constantes y funciones de forma nativa.
//
// Convención de logaritmos (mathjs usa ln por defecto):
//   log(...) -> logaritmo base 10 | ln(...) -> logaritmo natural.
// Se normaliza ANTES de evaluar, derivar o previsualizar.

// Normaliza logaritmos de notación escolar a funciones mathjs.
// 'log(' -> 'log10(' (base 10), 'ln(' -> 'log(' (natural en mathjs).
function normalizarExpresion(expr) {
    if (!expr) return expr;
    return String(expr).replace(/(?<![A-Za-z0-9_.])(ln|log)(?=\s*\()/g, (m, fn) => (fn === 'ln' ? 'log' : 'log10'));
}

window.normalizarExpresion = normalizarExpresion;

function evaluarFuncion(expr, x) {
    try {
        if (typeof math === 'undefined' || !math.evaluate) return NaN;
        const result = math.evaluate(normalizarExpresion(expr), { x });
        return Number.isFinite(result) ? result : NaN;
    } catch (err) { return NaN; }
}

// Busca automáticamente un intervalo [a, b] con cambio de signo.
// Estrategia en 2 pasadas para no hacer ~20,000 evaluaciones:
//   1) barrido grueso (paso 0.25, binario-exacto) sobre [-100, 100] → candidatos;
//   2) refinado fino (paso 1/16) y descarte de candidatos con polo dentro.
// El paso 0.25 recupera raíces que con paso 1 se perdían porque los extremos
// del paso caían con el mismo signo (p. ej. tan(x) - x = 4.493: f(4) y f(5)
// son negativos, pero en 4.25 y 4.5 cambian de signo).
function buscarIntervaloAuto(expr) {
    const inicio = -100.0, fin = 100.0;
    const pasoGrueso = 0.25;
    const pasoFino = 1 / 16;

    // --- 1) Barrido grueso: localiza ceros exactos y cambios de signo ---
    const candidatos = [];
    let x = inicio;
    let fx = evaluarFuncion(expr, x);

    while (x + pasoGrueso <= fin + 1e-9) {
        const xSiguiente = x + pasoGrueso;
        const fSiguiente = evaluarFuncion(expr, xSiguiente);

        if (Number.isFinite(fx) && Math.abs(fx) < 1e-12 && x !== inicio) {
            return [x - pasoGrueso, x, 'exacta'];
        }
        if (Number.isFinite(fSiguiente) && Math.abs(fSiguiente) < 1e-12) {
            return [x, xSiguiente, 'exacta'];
        }
        if (Number.isFinite(fx) && Number.isFinite(fSiguiente) && fx * fSiguiente < 0) {
            candidatos.push([x, xSiguiente]);
        }

        x = xSiguiente;
        fx = fSiguiente;
    }

    if (!candidatos.length) return [0, 2, 'default'];

    // Priorizar los intervalos más cercanos a 0 (más intuitivos)
    candidatos.sort((p, q) => Math.abs((p[0] + p[1]) / 2) - Math.abs((q[0] + q[1]) / 2));

    // --- 2) Refinar candidatos y descartar los que son polos, no raíces ---
    // Tope de 20 candidatos refinados: funciones con muchos polos (tan, cot...)
    // generan más de un centenar de cambios de signo y no vale la pena
    // revisarlos todos; el primer candidato sin polo se devuelve de inmediato.
    const limite = Math.min(candidatos.length, 20);
    for (let i = 0; i < limite; i++) {
        let lo = candidatos[i][0];
        let hi = candidatos[i][1];
        let fLo = evaluarFuncion(expr, lo);
        for (let xf = lo + pasoFino; xf < hi; xf += pasoFino) {
            const fXf = evaluarFuncion(expr, xf);
            if (!Number.isFinite(fXf)) break;
            if (Math.abs(fXf) < 1e-12) return [xf - pasoFino, xf + pasoFino, 'exacta'];
            if (Number.isFinite(fLo) && fLo * fXf < 0) { hi = xf; break; }
            lo = xf;
            fLo = fXf;
        }

        // Un cambio de signo atravesando una discontinuidad NO es una raíz:
        // se descarta y se prueba el siguiente candidato.
        const centro = (lo + hi) / 2;
        if (detectarPolo(expr, centro)) continue;
        if (hayPoloEnIntervalo(expr, lo, hi)) continue;

        return [lo, hi, 'auto'];
    }

    // Todos los candidatos (revisados) eran discontinuidades
    return [candidatos[0][0], candidatos[0][1], 'discontinuo'];
}

// ¿Hay un polo (discontinuidad no evitable) dentro de [lo, hi]?
// Muestrea el interior y ejecuta detectarPolo en el punto de MAYOR |f|: en un
// polo la función se dispara, así que el máximo absoluto lo delata (con la
// revisión solo del centro se escapaban polos descentrados). También devuelve
// true si algún punto del intervalo no es evaluable (hueco de dominio).
function hayPoloEnIntervalo(expr, lo, hi) {
    const ancho = hi - lo;
    if (!(ancho > 0)) return false;
    const muestras = Math.min(512, Math.max(64, Math.round(ancho / 0.002)));
    let xMax = null;
    let fMaxAbs = 0;
    for (let i = 1; i < muestras; i++) {
        const x = lo + (ancho * i) / muestras;
        const y = evaluarFuncion(expr, x);
        if (!Number.isFinite(y)) return true; // punto no evaluable: hueco/polo
        const abs = Math.abs(y);
        if (abs > fMaxAbs) { fMaxAbs = abs; xMax = x; }
    }
    if (xMax === null) return false;
    return detectarPolo(expr, xMax);
}

// Exponer globalmente
window.evaluarFuncion = evaluarFuncion;
window.buscarIntervaloAuto = buscarIntervaloAuto;
window.hayPoloEnIntervalo = hayPoloEnIntervalo;

// Formato numérico compartido (tablas, LaTeX y expresiones).
// Evita notación tipo "0.30000000000000004" y usa exponencial fuera de
// un rango razonable para que mathjs y KaTeX lo acepten.
function numTexto(n) {
    if (!Number.isFinite(n)) return '0';
    if (n === 0) return '0';
    const abs = Math.abs(n);
    if (abs >= 1e-4 && abs < 1e7) return String(Number(n.toPrecision(12)));
    return n.toExponential(6);
}

window.numTexto = numTexto;

// Convierte el texto de un campo numérico a number, aceptando constantes y
// expresiones simples: "pi", "π", "e", "pi/2", "2*e", "1,5" (coma decimal).
// Devuelve NaN si el texto no evalúa a un número (vacío, letras sueltas...).
// Así los límites de Simpson/Bisección/Taylor aceptan "pi" sin que el
// navegador vacíe el campo (los inputs son type="text").
function parseNumeroConConstantes(valor) {
    let texto = String(valor == null ? '' : valor).trim().replace(/,/g, '.').replace(/π/g, 'pi');
    if (!texto) return NaN;
    try {
        if (typeof math !== 'undefined' && typeof math.evaluate === 'function') {
            const r = math.evaluate(texto);
            return typeof r === 'number' ? r : NaN;
        }
    } catch (e) {
        return NaN;
    }
    return Number(texto);
}

window.parseNumeroConConstantes = parseNumeroConConstantes;

// Helpers de UI para errores.
// Además de mostrar el mensaje, OCULTA los resultados del cálculo anterior:
// si no, un error (intervalo inválido, n impar, función fuera de dominio...)
// dejaría en pantalla la tabla y el resumen viejos junto a los datos nuevos.
function mostrarError(mensaje) {
    const errorBox = document.getElementById('error-box');
    const errorText = document.getElementById('error-text');
    if (errorBox && errorText) {
        errorText.innerText = mensaje;
        errorBox.style.display = 'block';
    }
    const resContainer = document.getElementById('resultado-container');
    if (resContainer) resContainer.style.display = 'none';
    const grafCont = document.getElementById('grafica-container');
    if (grafCont) grafCont.style.display = 'none';
    ocultarInfo();
    ocultarProcedimiento();
}

// --- HELPERS COMPARTIDOS ENTRE MÉTODOS ---

// Detectar si un punto tiene comportamiento discontinuo (saltos bruscos)
function esDiscontinuo(expr, x, paso = 0.01) {
    const f1 = evaluarFuncion(expr, x - paso);
    const f2 = evaluarFuncion(expr, x);
    const f3 = evaluarFuncion(expr, x + paso);

    if (!Number.isFinite(f1) || !Number.isFinite(f2) || !Number.isFinite(f3)) return true;

    // Salto brusco: diferencia relativa muy grande entre puntos cercanos
    const maxVal = Math.max(Math.abs(f1), Math.abs(f2), Math.abs(f3));
    const minVal = Math.min(Math.abs(f1), Math.abs(f2), Math.abs(f3));

    if (maxVal > 1e6 && minVal < 1e-6) return true;
    if (minVal > 0 && maxVal / minVal > 1e4) return true;

    return false;
}

window.esDiscontinuo = esDiscontinuo;

// Detecta si `x` es un POLO (discontinuidad no evitable) y no una raíz.
// Criterio: a izquierda y derecha el signo es constante y opuesto entre sí,
// y ACERCÁNDOSE a x el valor crece en los dos lados. En una raíz verdadera
// |f| decrece hacia 0 al acercarse, así que no se confunde.
//   Ej.: f(x) = 1/(x-2) en x = 2.000244 → |f| = 101 → 1255 (izq.)
//        y 99 → 818 (der.) con signos opuestos: hay un polo, no una raíz.
function detectarPolo(expr, x) {
    const h1 = 1e-2, h2 = 1e-3;
    const l1 = evaluarFuncion(expr, x - h1);
    const l2 = evaluarFuncion(expr, x - h2);
    const r2 = evaluarFuncion(expr, x + h2);
    const r1 = evaluarFuncion(expr, x + h1);
    if (![l1, l2, r1, r2].every(Number.isFinite)) return false;

    const sgn = (v) => (v > 0 ? 1 : v < 0 ? -1 : 0);
    // Signo constante en cada lado y opuesto entre lados
    if (sgn(l1) === 0 || sgn(l2) === 0 || sgn(r1) === 0 || sgn(r2) === 0) return false;
    if (sgn(l1) !== sgn(l2) || sgn(r1) !== sgn(r2)) return false;
    if (sgn(l1) === sgn(r1)) return false;
    // |f| crece al acercarse por ambos lados
    if (!(Math.abs(l2) > Math.abs(l1) && Math.abs(r2) > Math.abs(r1))) return false;
    // Y el salto es grande (no es solo una pendiente pronunciada)
    return Math.min(Math.abs(l2), Math.abs(r2)) > 50;
}

window.detectarPolo = detectarPolo;

// Distingue "sintaxis inválida" de "punto fuera de dominio".
// Devuelve un mensaje de error apropiado para fa/fb no finitos.
// `nombre` permite reutilizarlo en otros métodos ('g(x)' en Punto Fijo).
function mensajeErrorEvaluacion(expr, donde, nombre = 'f(x)') {
    let sintaxisOk = true;
    try {
        if (typeof math !== 'undefined' && math.parse) math.parse(normalizarExpresion(expr));
    } catch (e) { sintaxisOk = false; }

    if (!sintaxisOk) {
        return `Error: Revisa la sintaxis de tu función ${nombre}.`;
    }
    return `Error: ${nombre} no está definida en ${donde} (el punto está fuera del dominio de la función). ` +
        `Ej.: sqrt(x) y ln(x) solo existen para x > 0.`;
}

window.mensajeErrorEvaluacion = mensajeErrorEvaluacion;

// --- PISTAS CUANDO NO HAY CAMBIO DE SIGNO (fa · fb > 0) ---
// El error de Bolzano por sí solo no dice por qué falló. Estas funciones
// miran el interior del intervalo y sugieren la causa más probable:
//   - una raíz doble (f toca 0 sin cruzar: (x-1)^2) → Newton o Punto Fijo;
//   - una discontinuidad (un polo / asíntota: tan(x) en π/2 + kπ);
//   - una raíz real escondida dentro de [a, b] → bisectar ese tramo.

// Refina el tramo donde f cambia de signo y clasifica el cruce:
// si |f| se dispara es un polo; si se anula, hay una raíz dentro.
function pistaPorCambioDeSigno(expr, x1, x2, f1, f2) {
    let lo = x1, hi = x2, fLo = f1;
    let it = 0;
    while ((hi - lo) > 1e-7 && it < 80) {
        const mid = (lo + hi) / 2;
        const fMid = evaluarFuncion(expr, mid);
        if (!Number.isFinite(fMid)) {
            return ' Pista: f cambia de signo dentro del intervalo por una discontinuidad (polo), no por ' +
                'una raíz: p. ej. tan(x) tiene asíntotas verticales en π/2 + kπ. Por eso f(a) y f(b) pueden ' +
                'tener el mismo signo aunque existan raíces: usa un intervalo que no cruce la asíntota.';
        }
        if (fMid === 0) break;
        if (fLo * fMid < 0) hi = mid;
        else { lo = mid; fLo = fMid; }
        it++;
    }
    const fHi = evaluarFuncion(expr, hi);
    const minFinal = Math.min(Math.abs(fLo), Number.isFinite(fHi) ? Math.abs(fHi) : Infinity);
    const umbral = Math.max(1e-6, 1e-3 * Math.max(Math.abs(f1), Math.abs(f2)));
    if (detectarPolo(expr, (lo + hi) / 2) || minFinal > umbral) {
        return ' Pista: f cambia de signo dentro del intervalo por una discontinuidad (polo), no por una ' +
            'raíz: p. ej. tan(x) tiene asíntotas verticales en π/2 + kπ. Por eso f(a) y f(b) pueden tener ' +
            'el mismo signo aunque existan raíces: usa un intervalo que no cruce la asíntota.';
    }
    return ` Pista: f cambia de signo dentro del intervalo (hay una raíz entre ${numTexto(x1)} y ${numTexto(x2)}), ` +
        'así que f(a) y f(b) pueden tener el mismo signo igual: usa ese tramo más pequeño como intervalo.';
}

// Barrido del interior de [a, b] buscando la causa de la ausencia de cambio
// de signo. Devuelve '' si no hay nada notable que reportar.
function pistaSinCambioDeSigno(expr, a, b, fa, fb) {
    const N = 200;
    const paso = (b - a) / N;
    let xPrev = a;
    let fPrev = fa;
    let minAbs = Math.abs(fa);
    let minX = a;

    for (let i = 1; i <= N; i++) {
        const x = a + paso * i;
        const y = evaluarFuncion(expr, x);
        if (!Number.isFinite(y)) {
            return ' Pista: f no está definida en todo el intervalo (hay una discontinuidad o una asíntota ' +
                'vertical, p. ej. tan(x) en π/2 + kπ), por eso f(a) y f(b) pueden tener el mismo signo ' +
                'aunque exista una raíz.';
        }
        const abs = Math.abs(y);
        if (abs < minAbs) { minAbs = abs; minX = x; }

        if (y === 0) {
            // Cero exacto en el interior: ¿cruza el eje o solo lo toca?
            const fSiguiente = evaluarFuncion(expr, x + paso);
            if (Number.isFinite(fSiguiente) && fPrev !== 0 && fPrev * fSiguiente < 0) {
                return ` Pista: f cambia de signo en x ≈ ${x.toFixed(4)} (y f ahí es 0): hay una raíz DENTRO ` +
                    'de [a, b]. Bisecta un tramo más pequeño alrededor de esa x.';
            }
            // No cruza: es un toque (típico de una raíz doble); el mínimo
            // reportado al final del barrido lo describe mejor.
        } else if (fPrev !== 0 && fPrev * y < 0) {
            return pistaPorCambioDeSigno(expr, xPrev, x, fPrev, y);
        }
        xPrev = x;
        fPrev = y;
    }

    const escala = Math.max(Math.abs(fa), Math.abs(fb));
    if (minAbs <= Math.max(1e-6, 1e-3 * escala)) {
        return ` Pista: f(x) toca 0 sin cruzar el eje (|f| mínimo = ${numTexto(minAbs)} cerca de x ≈ ` +
            `${minX.toFixed(4)}): puede ser una raíz doble, p. ej. (x - 1)^2. Bisección no la detecta porque ` +
            'f(a) y f(b) no cambian de signo: prueba Newton o Punto Fijo.';
    }
    return '';
}

// Lee el criterio de paro y su valor (acepta fracciones como 1/16).
// Muestra error y retorna null si el valor no es valido.
function leerCriterio() {
    const criterio = document.getElementById('criterio').value;
    let valor;
    try {
        if (typeof math === 'undefined' || !math.evaluate) {
            mostrarError('La librería matemática aún se está cargando. Intenta de nuevo en un momento.');
            return null;
        }
        valor = math.evaluate(normalizarExpresion(document.getElementById('valorCriterio').value));
        valor = Number(valor);
    } catch (e) {
        mostrarError('El valor del criterio debe ser un número o una fracción válida (ej. 1/16).');
        return null;
    }
    if (!Number.isFinite(valor) || valor <= 0) {
        mostrarError('Error: El criterio de paro debe ser mayor que 0.');
        return null;
    }
    return { criterio, valor };
}

// Limpia errores y tabla previa antes de un calculo
function limpiarTabla() {
    const errorBox = document.getElementById('error-box');
    const resContainer = document.getElementById('resultado-container');
    const tbody = document.getElementById('tabla-cuerpo');
    if (errorBox) errorBox.style.display = 'none';
    if (resContainer) resContainer.style.display = 'none';
    if (tbody) tbody.innerHTML = '';
    const grafCont = document.getElementById('grafica-container');
    if (grafCont) grafCont.style.display = 'none';
    ocultarProcedimiento();
    ocultarInfo();
}

// --- PASO A PASO EN KATEX (Taylor, Lagrange, Simpson) ---
// Renderiza LaTeX en el bloque #procedimiento-katex y lo muestra.
function renderizarProcedimiento(latex) {
    const el = document.getElementById('procedimiento-katex');
    if (!el) return false;
    if (!latex || typeof katex === 'undefined') { ocultarProcedimiento(); return false; }
    try {
        katex.render(latex, el, { displayMode: true, throwOnError: false });
        el.style.display = 'block';
        return true;
    } catch (e) {
        ocultarProcedimiento();
        return false;
    }
}

function ocultarProcedimiento() {
    const el = document.getElementById('procedimiento-katex');
    if (el) { el.innerHTML = ''; el.style.display = 'none'; }
}

window.renderizarProcedimiento = renderizarProcedimiento;
window.ocultarProcedimiento = ocultarProcedimiento;

// Conecta un input de funcion con su previsualizacion KaTeX en vivo.
// Carga math/KaTeX bajo demanda en el primer input (lazy-load anti-TBT).
function cablearPreview(inputId, previewId, prefijo) {
    const input = document.getElementById(inputId);
    const preview = document.getElementById(previewId);
    if (!input || !preview) return;
    const render = (expr) => {
        if (!expr) {
            preview.innerHTML = '';
            preview.className = 'preview-fx';
            return;
        }
        if (typeof math === 'undefined' || typeof katex === 'undefined') {
            preview.innerHTML = '';
            preview.className = 'preview-fx';
            return;
        }
        try {
            const latex = math.parse(normalizarExpresion(expr)).toTex();
            katex.render(`${prefijo} = ${latex}`, preview, { displayMode: true, throwOnError: false });
            preview.className = 'preview-fx preview-fx--valid';
        } catch (err) {
            preview.innerHTML = `<span class="preview-fx--invalid">Expresión no reconocida aún. Sigue escribiendo...</span>`;
            preview.className = 'preview-fx preview-fx--invalid';
        }
    };
    input.addEventListener('input', function(e) {
        const expr = e.target.value.trim();
        if (!expr) { render(''); return; }
        if (typeof math !== 'undefined' && typeof katex !== 'undefined') {
            render(expr);
            return;
        }
        if (window.Vendor && window.Vendor.ensureCalc) {
            window.Vendor.ensureCalc()
                .then(() => render(document.getElementById(inputId)?.value.trim() || ''))
                .catch(() => render(''));
        } else {
            render('');
        }
    });
}

// --- LÓGICA DE BISECCIÓN CLIENT-SIDE ---

function calcularBiseccion() {
    const expr = document.getElementById('funcion').value;

    if (!expr) {
        mostrarError('Error: Escribe una función f(x).');
        return;
    }

    const crit = leerCriterio();
    if (!crit) return;
    const { criterio, valor: valorCriterio } = crit;

    // 2. Lógica de Intervalo Automático
    let a_str = document.getElementById('a').value.trim();
    let b_str = document.getElementById('b').value.trim();
    let a, b;
    let intervaloModo = 'manual';

    if (a_str === '' || b_str === '') {
        const autoInt = buscarIntervaloAuto(expr);
        a = autoInt[0];
        b = autoInt[1];
        intervaloModo = autoInt[2] || 'auto';
        document.getElementById('a').value = a;
        document.getElementById('b').value = b;
    } else {
        // Acepta constantes en los límites: "pi/2", "e", "2*pi"...
        a = parseNumeroConConstantes(a_str);
        b = parseNumeroConConstantes(b_str);
    }
    const a0 = a, b0 = b; // bracket inicial para la gráfica

    limpiarTabla();
    ocultarInfo();
    const resContainer = document.getElementById('resultado-container');
    const tbody = document.getElementById('tabla-cuerpo');

    if (!Number.isFinite(a) || !Number.isFinite(b) || a >= b) {
        mostrarError('Error: El intervalo debe cumplir a < b y contener números válidos.');
        return;
    }

    // El intervalo automático solo encontró polos: en vez de bisectar una
    // discontinuidad y reconocerlo recién al final, se avisa ANTES de calcular.
    if (intervaloModo === 'discontinuo') {
        mostrarInfo(
            'Aviso: el intervalo automático solo encontró discontinuidades (polos) de f(x) en [-100, 100], ' +
            'así que no hay cambio de signo válido donde bisectar. Se llenaron a y b con el primer candidato ' +
            `[${a.toFixed(4)}, ${b.toFixed(4)}]: pulsa "Calcular Procedimiento" de nuevo para ver el detalle ` +
            'de ese tramo, o escribe un intervalo donde f sí cambie de signo.',
            'aviso'
        );
        return;
    }

    // Mostrar indicador de intervalo automático
    if (intervaloModo === 'auto' || intervaloModo === 'exacta') {
        mostrarInfo(`Intervalo automático detectado: [${a.toFixed(4)}, ${b.toFixed(4)}]. Puedes modificarlo manualmente si es necesario.`, 'info');
    }

    let fa = evaluarFuncion(expr, a);
    let fb = evaluarFuncion(expr, b);
    if (!Number.isFinite(fa) || !Number.isFinite(fb)) {
        mostrarError(mensajeErrorEvaluacion(expr, !Number.isFinite(fa) ? `x = ${a}` : `x = ${b}`));
        return;
    }

    // Detectar raíz exacta en extremos
    if (fa === 0) {
        mostrarInfo(`Raíz exacta encontrada en el extremo! f(${a.toFixed(4)}) = 0. No se requieren más iteraciones.`, 'exito');
        const tr = document.createElement('tr');
        tr.innerHTML = `<td data-label="Iter">0</td><td data-label="a">${a.toFixed(4)}</td><td data-label="b">${b.toFixed(4)}</td><td data-label="x_m"><strong>${a.toFixed(4)}</strong></td><td data-label="f(x_m)">0.0000</td><td data-label="Ea (%)">--</td>`;
        tbody.appendChild(tr);
        resContainer.style.display = 'block';
        mostrarResumen(a, 0, 0, criterio, valorCriterio, null, true, {
            motivo: 'f(x) = 0 (raíz exacta en el extremo)',
        });
        graficarResultado(expr, { a, b, raiz: a });
        return;
    }
    if (fb === 0) {
        mostrarInfo(`Raíz exacta encontrada en el extremo! f(${b.toFixed(4)}) = 0. No se requieren más iteraciones.`, 'exito');
        const tr = document.createElement('tr');
        tr.innerHTML = `<td data-label="Iter">0</td><td data-label="a">${a.toFixed(4)}</td><td data-label="b">${b.toFixed(4)}</td><td data-label="x_m"><strong>${b.toFixed(4)}</strong></td><td data-label="f(x_m)">0.0000</td><td data-label="Ea (%)">--</td>`;
        tbody.appendChild(tr);
        resContainer.style.display = 'block';
        mostrarResumen(b, 0, 0, criterio, valorCriterio, null, true, {
            motivo: 'f(x) = 0 (raíz exacta en el extremo)',
        });
        graficarResultado(expr, { a, b, raiz: b });
        return;
    }

    if (fa * fb > 0) {
        mostrarError('Error: f(a) y f(b) deben tener signos opuestos (Teorema de Bolzano).' +
            pistaSinCambioDeSigno(expr, a, b, fa, fb));
        return;
    }

    // Escala del residuo inicial: sirve para comprobar después si |f|
    // realmente decreció (si no, el cambio de signo era de un polo).
    const escalaResiduo = Math.max(Math.abs(fa), Math.abs(fb));

    let x_m_anterior = null;
    let x_m_ultimo = null;
    let motivoParo = null;
    // Límite de seguridad de 100 iteraciones. Se guarda lo que pidió el
    // usuario para poder avisar si el cálculo quedó truncado (B3).
    const maxIterSolicitado = criterio === 'iteraciones' ? Math.max(1, Math.floor(valorCriterio)) : 100;
    const maxIter = Math.min(100, maxIterSolicitado);
    const truncadoPorLimite = maxIterSolicitado > maxIter;
    let n = 1;
    let criterioAlcanzado = false;

    while (n <= maxIter) {
        const x_m = (a + b) / 2;
        const fx_m = evaluarFuncion(expr, x_m);
        if (!Number.isFinite(fx_m)) {
            mostrarError(mensajeErrorEvaluacion(expr, `x = ${x_m}`));
            return;
        }
        // Ea relativo: queda indefinido cuando x_m = 0 (división entre cero).
        // Se marca como NaN para mostrar "N/A" en vez de "Infinity%" (B2).
        const ea = x_m_anterior === null
            ? null
            : (x_m === 0 ? NaN : Math.abs((x_m - x_m_anterior) / x_m) * 100);
        const eaTexto = ea === null ? '--' : (Number.isFinite(ea) ? ea.toFixed(4) + '%' : 'N/A');
        const tr = document.createElement('tr');
        tr.innerHTML = `<td data-label="Iter">${n}</td><td data-label="a">${a.toFixed(4)}</td><td data-label="b">${b.toFixed(4)}</td><td data-label="x_m">${x_m.toFixed(4)}</td><td data-label="f(x_m)">${fx_m.toFixed(4)}</td><td data-label="Ea (%)">${eaTexto}</td>`;
        tbody.appendChild(tr);
        x_m_ultimo = x_m;

        // Raíz exacta hallada: f(x_m) = 0.
        // Hay que parar ANTES de actualizar el intervalo: si no, fa = 0 hace
        // que "fa * fx_m" sea siempre 0 en las iteraciones siguientes y el
        // algoritmo colapsa hacia b en vez de hacia la raíz (B1).
        if (fx_m === 0) {
            criterioAlcanzado = true;
            motivoParo = 'f(x) = 0 (raíz exacta)';
            break;
        }

        // Criterios de paro. Se registra CUAL se cumplió, para no decir
        // "criterio alcanzado" sin explicar que fue solo por Δx (B4).
        let parar = false;
        if (criterio === 'iteraciones' && n >= maxIter) {
            parar = true;
            motivoParo = `${n} iteraciones pedidas`;
        }
        if (criterio === 'tolerancia') {
            if (Math.abs(fx_m) <= valorCriterio) {
                parar = true;
                motivoParo = `residuo |f(x)| ≤ ${numTexto(valorCriterio)}`;
            } else if (x_m_anterior !== null && Math.abs(x_m - x_m_anterior) <= valorCriterio) {
                parar = true;
                motivoParo = `Δx ≤ ${numTexto(valorCriterio)}`;
            }
        }
        if (criterio === 'error' && ea !== null && Number.isFinite(ea) && ea <= valorCriterio) {
            parar = true;
            motivoParo = `Ea ≤ ${numTexto(valorCriterio)}%`;
        }

        if (parar) {
            criterioAlcanzado = true;
            break;
        }

        if (fa * fx_m < 0) { b = x_m; fb = fx_m; }
        else { a = x_m; fa = fx_m; }
        x_m_anterior = x_m;
        n++;
    }

    // Último punto de la tabla (coherente con lo que el usuario ve); si el
    // bucle no llegó a iterar, se usa el punto medio del intervalo.
    const x_final = x_m_ultimo !== null ? x_m_ultimo : (a + b) / 2;
    const fx_final = evaluarFuncion(expr, x_final);
    // Mismo guard que en el bucle: x_final = 0 deja el Ea indefinido (B2)
    const ea_final = (x_m_anterior === null || x_final === 0)
        ? null
        : Math.abs((x_final - x_m_anterior) / x_final) * 100;

    // --- Verificación de que el resultado ES una raíz ---
    // 1) ¿Hay un polo cerca? (cambio de signo a través de una discontinuidad)
    const esPolo = detectarPolo(expr, x_final);
    // 2) ¿|f| decreció de verdad? Si mantiene la escala inicial, no convergió.
    const residuoAbs = Math.abs(fx_final);
    const residuoRel = escalaResiduo > 0 ? residuoAbs / escalaResiduo : 0;
    const residuoNoCayo = Number.isFinite(residuoRel)
        && residuoRel > 0.05
        && residuoAbs > Math.max(valorCriterio, 1e-12);

    const etiquetas = {};
    if (esPolo) {
        etiquetas.etiquetaRaiz = 'Posible polo (sin raíz)';
        etiquetas.estadoTexto = 'Sin raíz: discontinuidad';
        etiquetas.estado = 'polo';
        etiquetas.motivo = 'el signo cambia por una división entre cero, no por una raíz';
    } else if (!criterioAlcanzado) {
        etiquetas.etiquetaRaiz = 'Último estimado (sin converger)';
        etiquetas.estadoTexto = 'Criterio no alcanzado';
        etiquetas.estado = 'fallo';
    } else {
        etiquetas.motivo = motivoParo || 'criterio cumplido';
    }

    // Avisos si el cálculo quedó truncado por el límite de 100 iteraciones (B3)
    const avisos = [];
    if (esPolo) {
        avisos.push(
            `<strong>Posible discontinuidad (polo) cerca de x = ${numTexto(x_final)}:</strong> ` +
            `f(x) salta de un lado a otro del cero y |f| crece al acercarse ` +
            `(f = ${numTexto(fx_final)}). Ese punto NO es una raíz.`
        );
    } else if (residuoNoCayo) {
        avisos.push(
            `El residuo |f(x)| = ${numTexto(fx_final)} no disminuyó frente al inicio ` +
            `(|f| máx = ${numTexto(escalaResiduo)}); revisa si hay una discontinuidad en el intervalo.`
        );
    }
    if (criterioAlcanzado && !esPolo && residuoAbs > Math.max(valorCriterio * 10, 1e-12)
        && (motivoParo || '').indexOf('Δx') !== -1) {
        avisos.push(
            `El criterio se cumplió por Δx, pero |f(x)| = ${numTexto(fx_final)} sigue siendo ` +
            `mayor que la tolerancia: x convergió antes que el residuo.`
        );
    }
    if (truncadoPorLimite) {
        avisos.push(`Se solicitaron ${maxIterSolicitado} iteraciones, pero el cálculo se limitó a ${maxIter} por seguridad.`);
    }
    if (!criterioAlcanzado) {
        avisos.push(`Se alcanzó el límite de ${maxIter} iteraciones sin cumplir el criterio de paro.`);
    }
    if (avisos.length) agregarInfo(avisos.join(' '), esPolo || residuoNoCayo ? 'aviso' : 'info');

    resContainer.style.display = 'block';
    mostrarResumen(
        x_final, fx_final,
        tbody.children.length,
        criterio, valorCriterio, ea_final, criterioAlcanzado, etiquetas
    );
    graficarResultado(expr, { a: a0, b: b0, raiz: esPolo ? null : x_final });
}

// --- MOSTRAR RESUMEN FINAL DE LA RAÍZ ---
// Formato de 6 decimales que nunca imprime "-0.000000" (cero con signo)
// ni "NaN".
function formatoDecimal(v, dec = 6) {
    if (!Number.isFinite(v)) return 'N/A';
    const r = Number(v.toFixed(dec));
    return (r === 0 ? 0 : r).toFixed(dec);
}

function mostrarResumen(x_raiz, fx_val, iteraciones, criterio, valorCriterio, ea_final = null, criterioAlcanzado = false, etiquetas = {}) {
    const resumenBox = document.getElementById('resumen-container');
    const btnCopy = document.getElementById('btn-copy-icon');
    if (!resumenBox) return;

    // etiquetas.abs: cuando la tarjeta es |f(x)|, el valor llega con signo
    const fxMostrar = etiquetas.abs && Number.isFinite(fx_val) ? Math.abs(fx_val) : fx_val;
    // etiquetas.raizStr: en una divergencia el último iterado es un número
    // gigante sin valor informativo; el llamador puede mandar '—' para que la
    // tarjeta no lo muestre en grande.
    const raizStr = etiquetas.raizStr !== undefined ? etiquetas.raizStr : formatoDecimal(x_raiz);
    // etiquetas.fxStr: mismo caso que raizStr para la tarjeta de residuo.
    const fxStr = etiquetas.fxStr !== undefined ? etiquetas.fxStr : formatoDecimal(fxMostrar);
    const eaStr = (ea_final !== null && Number.isFinite(ea_final)) ? formatoDecimal(Math.abs(ea_final), 4) + '%' : 'N/A';

    const etiquetaFx = etiquetas.fx || 'f(x) Final';
    let textoCriterio = '';
    if (criterio === 'tolerancia') {
        // v4 P0-3: salto antes de la "ó" para que en móvil no quede un
        // "0.001" huérfano en la 2ª línea. En escritorio el <br> se oculta
        // (ver .criterio-salto en css/styles.css) y sigue en una sola línea:
        // el ESPACIO antes del <br> es el que separa "0.001 ó" allí (sin él
        // salía "0.001ó", regresión de la v4 reportada en PC).
        textoCriterio = etiquetas.tolerancia ||
            `|f(x)| ≤ ${numTexto(valorCriterio)} <br class="criterio-salto">ó |Δx| ≤ ${numTexto(valorCriterio)}`;
    } else if (criterio === 'error') {
        textoCriterio = `Ea ≤ ${numTexto(valorCriterio)}%`;
    } else {
        textoCriterio = `${iteraciones} iteraciones`;
    }

    // Estado: indica QUÉ criterio se cumplió (o por qué no se cumplió),
    // en vez de un "Criterio alcanzado" sin más.
    const etiquetaRaiz = etiquetas.etiquetaRaiz || 'Raíz Aproximada';
    let claseEstado = 'resumen-card--ok';
    let iconoEstado = 'fa-circle-check';
    let textoEstado;
    if (etiquetas.estadoTexto) {
        textoEstado = etiquetas.estadoTexto;
    } else if (criterioAlcanzado) {
        textoEstado = `Criterio cumplido: ${etiquetas.motivo || 'ok'}`;
    } else {
        textoEstado = 'Criterio no alcanzado';
        claseEstado = 'resumen-card--warn';
        iconoEstado = 'fa-triangle-exclamation';
    }
    if (etiquetas.estado === 'polo') {
        claseEstado = 'resumen-card--error';
        iconoEstado = 'fa-circle-xmark';
    } else if (etiquetas.estado === 'fallo') {
        claseEstado = 'resumen-card--warn';
        iconoEstado = 'fa-triangle-exclamation';
    }

    resumenBox.innerHTML = `
        <div class="resumen-grid">
            <div class="resumen-card resumen-card--raiz">
                <span class="resumen-icon"><i class="fa-solid fa-bullseye"></i></span>
                <span class="resumen-label">${etiquetaRaiz}</span>
                <span class="resumen-value">x = ${raizStr}</span>
            </div>
            <div class="resumen-card">
                <span class="resumen-icon"><i class="fa-solid fa-square-root-variable"></i></span>
                <span class="resumen-label">${etiquetaFx}</span>
                <span class="resumen-value">${fxStr}</span>
            </div>
            <div class="resumen-card">
                <span class="resumen-icon"><i class="fa-solid fa-rotate"></i></span>
                <span class="resumen-label">Iteraciones</span>
                <span class="resumen-value">${iteraciones}</span>
            </div>
            <div class="resumen-card">
                <span class="resumen-icon"><i class="fa-solid fa-percent"></i></span>
                <span class="resumen-label">Ea Final</span>
                <span class="resumen-value">${eaStr}</span>
            </div>
            <div class="resumen-card resumen-card--criterio">
                <span class="resumen-label">Criterio de Paro</span>
                <span class="resumen-value resumen-value--small">${textoCriterio}</span>
            </div>
            <div class="resumen-card resumen-card--estado ${claseEstado}">
                <span class="resumen-icon"><i class="fa-solid ${iconoEstado}"></i></span>
                <span class="resumen-label">Estado</span>
                <span class="resumen-value resumen-value--small">${textoEstado}</span>
            </div>
        </div>
    `;
    resumenBox.style.display = 'block';
    // El contenedor padre también: sin esto, Taylor/Lagrange/Simpson no se
    // veían NADA porque #resultado-container seguía en display:none.
    const cont = document.getElementById('resultado-container');
    if (cont) cont.style.display = 'block';

    // Mostrar botones de acción (copiar + exportar)
    if (btnCopy) btnCopy.style.display = 'inline-flex';
    const btnExport = document.getElementById('btn-export-csv');
    if (btnExport) btnExport.style.display = 'inline-flex';
}

// Resumen genérico para métodos que no encajan en las tarjetas de raíz
// (Taylor, Lagrange, Simpson): recibe la lista de tarjetas a mostrar.
//   tarjetas: [{ etiqueta, valor, tipo?: 'principal', icono? }]
//   opciones: { informacion?, tipoInfo? }
function mostrarResumenCustom(tarjetas, opciones = {}) {
    const resumenBox = document.getElementById('resumen-container');
    const btnCopy = document.getElementById('btn-copy-icon');
    if (!resumenBox) return;

    const html = (tarjetas || []).map((t) => `
            <div class="resumen-card${t.tipo === 'principal' ? ' resumen-card--raiz' : ''}">
                <span class="resumen-icon"><i class="fa-solid ${t.icono || 'fa-calculator'}"></i></span>
                <span class="resumen-label">${t.etiqueta}</span>
                <span class="resumen-value">${t.valor}</span>
            </div>`).join('');

    // Con más de 4 tarjetas (Taylor) se pasan a 3 columnas para que no
    // queden filas a medio llenar.
    const claseGrid = (tarjetas || []).length > 4 ? 'resumen-grid resumen-grid--6' : 'resumen-grid';
    resumenBox.innerHTML = `<div class="${claseGrid}">${html}
        </div>`;
    resumenBox.style.display = 'block';
    // Sin esto el bloque padre seguía oculto y NO se veía ni el resumen, ni
    // la tabla, ni la gráfica de Taylor/Lagrange/Simpson (bug crítico).
    const cont = document.getElementById('resultado-container');
    if (cont) cont.style.display = 'block';

    if (opciones.informacion) mostrarInfo(opciones.informacion, opciones.tipoInfo || 'info');

    if (btnCopy) btnCopy.style.display = 'inline-flex';
    const btnExport = document.getElementById('btn-export-csv');
    if (btnExport) btnExport.style.display = 'inline-flex';
}

window.mostrarResumen = mostrarResumen;
window.mostrarResumenCustom = mostrarResumenCustom;

window.calcularBiseccion = calcularBiseccion;
window.mostrarError = mostrarError;
window.leerCriterio = leerCriterio;
window.limpiarTabla = limpiarTabla;
window.cablearPreview = cablearPreview;

// --- TECLADO MATEMÁTICO (menú de inserción de expresiones) ---
// Reemplaza a los "ejemplos rápidos": inserta funciones, constantes y
// operadores en el cursor del input objetivo y dispara el preview en vivo.
// Etiquetas bonitas (π, √, ×) que insertan sintaxis válida para mathjs.

const TECLAS_MATEMATICAS = [
    { etiqueta: 'log(', inserta: 'log(', titulo: 'Logaritmo base 10' },
    { etiqueta: 'ln(', inserta: 'ln(', titulo: 'Logaritmo natural' },
    { etiqueta: 'sin(', inserta: 'sin(', titulo: 'Seno' },
    { etiqueta: 'cos(', inserta: 'cos(', titulo: 'Coseno' },
    { etiqueta: 'tan(', inserta: 'tan(', titulo: 'Tangente' },
    { etiqueta: '√(', inserta: 'sqrt(', titulo: 'Raíz cuadrada' },
    { etiqueta: 'e', inserta: 'e', titulo: 'Constante de Euler (≈ 2.718)' },
    { etiqueta: 'π', inserta: 'pi', titulo: 'Pi (≈ 3.1416)' },
    { etiqueta: '^', inserta: '^', titulo: 'Potencia' },
    { etiqueta: 'x', inserta: 'x', titulo: 'Variable x' },
    { etiqueta: '(', inserta: '(', titulo: 'Abrir paréntesis' },
    { etiqueta: ')', inserta: ')', titulo: 'Cerrar paréntesis' },
    { etiqueta: '+', inserta: '+', titulo: 'Suma' },
    { etiqueta: '−', inserta: '-', titulo: 'Resta' },
    { etiqueta: '×', inserta: '*', titulo: 'Multiplicación' },
    { etiqueta: '÷', inserta: '/', titulo: 'División' },
    { etiqueta: '.', inserta: '.', titulo: 'Punto decimal' },
    { etiqueta: '⌫', accion: 'borrar', titulo: 'Borrar carácter', aria: 'Borrar último carácter' },
    { etiqueta: 'C', accion: 'limpiar', titulo: 'Limpiar campo', aria: 'Limpiar campo de función' },
];

// Inserta texto en la posición del cursor y avisa al preview en vivo
function insertarEnInput(input, texto) {
    if (!input) return;
    const ini = input.selectionStart ?? input.value.length;
    const fin = input.selectionEnd ?? input.value.length;
    input.value = input.value.slice(0, ini) + texto + input.value.slice(fin);
    const pos = ini + texto.length;
    try { input.focus({ preventScroll: true }); } catch (e) { input.focus(); }
    try { input.setSelectionRange(pos, pos); } catch (e) { /* inputs no textuales */ }
    input.dispatchEvent(new Event('input', { bubbles: true }));
}

// Borra la selección o el carácter previo al cursor
function borrarEnInput(input) {
    if (!input) return;
    const ini = input.selectionStart ?? input.value.length;
    const fin = input.selectionEnd ?? input.value.length;
    let pos;
    if (ini !== fin) {
        input.value = input.value.slice(0, ini) + input.value.slice(fin);
        pos = ini;
    } else if (ini > 0) {
        input.value = input.value.slice(0, ini - 1) + input.value.slice(ini);
        pos = ini - 1;
    } else {
        return;
    }
    try { input.focus({ preventScroll: true }); } catch (e) { input.focus(); }
    try { input.setSelectionRange(pos, pos); } catch (e) { /* inputs no textuales */ }
    input.dispatchEvent(new Event('input', { bubbles: true }));
}

// Construye los menús <div class="math-menu" data-target="id-input">
function inicializarMenusMatematicos() {
    document.querySelectorAll('.math-menu').forEach(cont => {
        if (cont.dataset.menuListo) return;
        const input = cont.dataset.target && document.getElementById(cont.dataset.target);
        if (!input) return;
        cont.dataset.menuListo = '1';
        const etiqueta = document.createElement('span');
        etiqueta.className = 'examples-label';
        etiqueta.textContent = 'Insertar expresión:';
        const grupo = document.createElement('div');
        grupo.className = 'chip-group';
        grupo.setAttribute('role', 'group');
        grupo.setAttribute('aria-label', 'Teclado matemático');
        TECLAS_MATEMATICAS.forEach(t => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'btn-chip';
            b.textContent = t.etiqueta;
            // ÷ era casi indistinguible de + a tamaño normal: se resalta
            if (t.inserta === '/') b.classList.add('btn-chip--division');
            if (t.titulo) b.title = t.titulo;
            b.setAttribute('aria-label', t.aria || t.titulo || ('Insertar ' + t.etiqueta));
            b.addEventListener('click', () => {
                if (t.accion === 'borrar') borrarEnInput(input);
                else if (t.accion === 'limpiar') {
                    input.value = '';
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    try { input.focus({ preventScroll: true }); } catch (e) { input.focus(); }
                } else insertarEnInput(input, t.inserta);
            });
            grupo.appendChild(b);
        });
        cont.appendChild(etiqueta);
        cont.appendChild(grupo);
    });
}

window.insertarEnInput = insertarEnInput;
window.borrarEnInput = borrarEnInput;
window.inicializarMenusMatematicos = inicializarMenusMatematicos;

// --- PREVISUALIZACIÓN EN VIVO CON KATEX ---
document.addEventListener('DOMContentLoaded', () => {
    cablearPreview('funcion', 'preview-fx', 'f(x)');
    inicializarMenusMatematicos();
    blindarInputsNumericos();
});

// --- v4 P1-3: la rueda/scroll no cambia los campos numéricos ---
// type="number" incrementa/decrementa con el scroll mientras tiene el foco;
// en móvil eso cambiaba el GRADO de Taylor al desplazar la página. El primer
// scroll con foco se cancela y se suelta el foco, así el resto de la página
// vuelve a desplazarse con normalidad.
function blindarInputsNumericos() {
    document.querySelectorAll('input[type="number"]').forEach((el) => {
        el.addEventListener('wheel', (e) => {
            if (document.activeElement !== el) return;
            e.preventDefault();
            el.blur();
        }, { passive: false });
    });
}
window.blindarInputsNumericos = blindarInputsNumericos;

// --- COPIAR TABLA DE RESULTADOS (botón icono en cabecera) ---
function copiarTablaClipboard() {
    const tabla = document.querySelector('.procedure-table');
    const tbody = document.getElementById('tabla-cuerpo');
    if (!tabla || !tbody || !tbody.rows.length) {
        mostrarError('No hay resultados para copiar.');
        return;
    }

    let texto = '';
    for (const row of tabla.rows) {
        const cols = Array.from(row.cells).map(c => c.innerText.trim());
        texto += cols.join('\t') + '\n';
    }

    navigator.clipboard.writeText(texto).then(() => {
        const btn = document.getElementById('btn-copy-icon');
        if (!btn) return;
        const originalHTML = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-check" style="color: #34d399;"></i>';
        setTimeout(() => { btn.innerHTML = originalHTML; }, 2000);
    }).catch(() => {
        mostrarError('No se pudo copiar. Usa Ctrl+C manualmente.');
    });
}

window.copiarTablaClipboard = copiarTablaClipboard;

// Exportar tabla como archivo .csv compatible con Excel
function exportarTablaCSV() {
    const tabla = document.querySelector('.procedure-table');
    const tbody = document.getElementById('tabla-cuerpo');
    if (!tabla || !tbody || !tbody.rows.length) {
        mostrarError('No hay resultados para exportar.');
        return;
    }

    const csv = [];
    Array.from(tabla.rows).forEach(row => {
        const cols = Array.from(row.cells).map(c => `"${c.innerText.trim().replace(/"/g, '""')}"`);
        csv.push(cols.join(','));
    });

    const blob = new Blob([csv.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tabla_metodos_numericos.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

window.exportarTablaCSV = exportarTablaCSV;
