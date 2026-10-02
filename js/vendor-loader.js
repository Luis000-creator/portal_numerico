// ============================================================================
// Itera - Vendor Lazy Loader (calculadora)
// ============================================================================
// mathjs y KaTeX solo se descargan tras la primera interacción (input/submit).
// Sin interacción no hay parse/compile de ~240KB y el TBT de carga cae.
// ============================================================================

const MATH_URL = 'https://cdnjs.cloudflare.com/ajax/libs/mathjs/11.8.0/math.min.js';
const KATEX_URL = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js';

function loadVendorScript(src) {
    return new Promise((resolve, reject) => {
        const existing = document.querySelector(`script[data-vendor="${src}"]`);
        if (existing) {
            if (existing.dataset.loaded === '1') return resolve();
            existing.addEventListener('load', () => resolve());
            existing.addEventListener('error', () => reject(new Error(`No se pudo cargar ${src}`)));
            return;
        }
        const s = document.createElement('script');
        s.src = src;
        s.async = true;
        s.dataset.vendor = src;
        s.onload = () => { s.dataset.loaded = '1'; resolve(); };
        s.onerror = () => reject(new Error(`No se pudo cargar ${src}`));
        document.head.appendChild(s);
    });
}

let mathPromise = null;
let katexPromise = null;

window.Vendor = {
    ensureMath() {
        if (typeof math !== 'undefined' && math.evaluate && math.parse) {
            return Promise.resolve();
        }
        if (!mathPromise) mathPromise = loadVendorScript(MATH_URL);
        return mathPromise;
    },
    ensureKatex() {
        if (typeof katex !== 'undefined' && katex.render) {
            return Promise.resolve();
        }
        if (!katexPromise) katexPromise = loadVendorScript(KATEX_URL);
        return katexPromise;
    },
    // Motor completo de la calculadora: parse/evaluate + previews
    ensureCalc() {
        return Promise.all([this.ensureMath(), this.ensureKatex()]);
    },
};
