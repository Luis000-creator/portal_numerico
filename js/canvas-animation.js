// ============================================================================
// Itera - Canvas Animation Module
// ============================================================================
// Gestiona: fondo de estrellas, partículas de símbolos, animación en tiempo real
// ============================================================================

// --- CONFIGURACIÓN GLOBAL DE PARTÍCULAS ---
const symbolsList = ['+', '-', '×', '÷', '∑', '∫', 'π', '√', 'lim', 'f(x)', 'Δ'];
const colors = ['#ffffff', '#00f0ff', '#bd00ff', '#ff007b', '#7000ff'];
let mouse = { x: null, y: null, radius: 130 };

// No animar si el usuario prefiere movimiento reducido (ahorra CPU y mejora a11y)
const REDUCED_MOTION = window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;
// Móvil = menos partículas y sin líneas entre estrellas (O(n²) caro)
const IS_SMALL_SCREEN = window.matchMedia
    ? window.matchMedia('(max-width: 768px)').matches
    : window.innerWidth < 768;

window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
});

window.addEventListener('mouseout', () => {
    mouse.x = null;
    mouse.y = null;
});

// --- CLASES DE ANIMACIÓN ---

class Star {
    constructor(canvas) {
        this.canvas = canvas;
        this.reset();
    }

    reset() {
        this.x = Math.random() * this.canvas.width;
        this.y = Math.random() * this.canvas.height;
        this.vx = (Math.random() - 0.5) * 0.4;
        this.vy = (Math.random() - 0.5) * 0.4;
        this.size = Math.random() * 1.5 + 0.5;
        this.alpha = Math.random() * 0.4 + 0.1;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        if (this.x < 0 || this.x > this.canvas.width) this.vx *= -1;
        if (this.y < 0 || this.y > this.canvas.height) this.vy *= -1;

        if (mouse.x !== null) {
            let dx = mouse.x - this.x;
            let dy = mouse.y - this.y;
            let dist = Math.hypot(dx, dy);
            if (dist < mouse.radius) {
                let angle = Math.atan2(dy, dx);
                let force = (mouse.radius - dist) / mouse.radius;
                this.x -= Math.cos(angle) * force * 4;
                this.y -= Math.sin(angle) * force * 4;
            }
        }
    }

    draw(ctx) {
        ctx.fillStyle = `rgba(255, 255, 255, ${this.alpha})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
    }
}

function getSymbolPoints(symbolText) {
    const offScreen = document.createElement('canvas');
    const offCtx = offScreen.getContext('2d');
    offScreen.width = 120;
    offScreen.height = 120;

    offCtx.font = 'bold 65px sans-serif';
    offCtx.fillStyle = '#ffffff';
    offCtx.textAlign = 'center';
    offCtx.textBaseline = 'middle';
    offCtx.fillText(symbolText, 60, 60);

    const imgData = offCtx.getImageData(0, 0, 120, 120);
    const points = [];
    // Paso 4 en vez de 3: ~44% menos partículas con forma aún reconocible
    const step = IS_SMALL_SCREEN ? 5 : 4;
    const MAX_POINTS = IS_SMALL_SCREEN ? 60 : 120;

    for (let y = 0; y < 120; y += step) {
        for (let x = 0; x < 120; x += step) {
            const index = (y * 120 + x) * 4;
            if (imgData.data[index + 3] > 128) {
                points.push({ x: x - 60, y: y - 60 });
                if (points.length >= MAX_POINTS) return points;
            }
        }
    }
    return points;
}

class SymbolParticle {
    constructor(baseX, baseY, relX, relY, color, symbolGroup) {
        this.baseX = baseX;
        this.baseY = baseY;
        this.relX = relX;
        this.relY = relY;
        this.x = Math.random() * window.innerWidth;
        this.y = Math.random() * window.innerHeight;
        this.vx = 0;
        this.vy = 0;
        this.size = Math.random() * 1.5 + 0.7;
        this.color = color;
        this.friction = 0.86;
        this.spring = 0.04;
        this.group = symbolGroup;
    }

    update(globalTime) {
        let floatOffsetX = Math.cos(globalTime * 0.0015 + this.group.offsetSeed) * 15;
        let floatOffsetY = Math.sin(globalTime * 0.002 + this.group.offsetSeed) * 15;

        let targetX = this.baseX + this.relX + floatOffsetX;
        let targetY = this.baseY + this.relY + floatOffsetY;

        let dx = targetX - this.x;
        let dy = targetY - this.y;

        this.vx = (this.vx + dx * this.spring) * this.friction;
        this.vy = (this.vy + dy * this.spring) * this.friction;

        this.x += this.vx;
        this.y += this.vy;

        if (mouse.x !== null) {
            let mdx = mouse.x - this.x;
            let mdy = mouse.y - this.y;
            let dist = Math.hypot(mdx, mdy);
            if (dist < mouse.radius) {
                let angle = Math.atan2(mdy, mdx);
                let force = (mouse.radius - dist) / mouse.radius;
                this.x -= Math.cos(angle) * force * 16;
                this.y -= Math.sin(angle) * force * 16;
            }
        }
    }

    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
    }
}

// --- GESTOR DE ANIMACIÓN ---

class ParticleAnimation {
    constructor() {
        this.canvas = document.getElementById('particle-canvas');
        this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
        this.backgroundStars = [];
        this.symbolParticles = [];
        this.animationId = null;
        this.initialized = false;
        this.lastFrame = 0;
        this.resizeTimer = null;
        this.visible = true;
    }

    init() {
        if (!this.canvas || this.initialized) return;
        // Con reduced-motion: dibujar un frame estático y no animar
        if (REDUCED_MOTION) {
            this.resize();
            this.drawStatic();
            this.initialized = true;
            return;
        }
        this.resize();
        this.initialized = true;
        this.animate(0);
    }

    drawStatic() {
        if (!this.ctx || !this.canvas) return;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.backgroundStars.forEach(s => s.draw(this.ctx));
        this.symbolParticles.forEach(p => p.draw(this.ctx));
    }

    resize() {
        if (!this.canvas) return;
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.initBackgroundStars();
        this.initSymbolParticles();
    }

    initBackgroundStars() {
        this.backgroundStars = [];
        // Densidad menor + tope absoluto (antes sin tope: O(n²) en animate)
        const raw = (this.canvas.width * this.canvas.height) / 22000;
        const count = Math.min(IS_SMALL_SCREEN ? 35 : 90, Math.floor(raw));
        for (let i = 0; i < count; i++) {
            this.backgroundStars.push(new Star(this.canvas));
        }
    }

    // Zona central ocupada por el contenido: las partículas ahí quedan tapadas.
    // Se calcula desde el .container visible + margen (símbolo ±60px + flotación ±15px).
    getContentExclusion() {
        const pad = 110;
        const el = document.querySelector('.container');
        if (el) {
            const r = el.getBoundingClientRect();
            // Si el contenedor no está en viewport (raro), caer al estimado centrado
            if (r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight) {
                return {
                    left: r.left - pad,
                    right: r.right + pad,
                    top: r.top - pad,
                    bottom: r.bottom + pad,
                };
            }
        }
        const w = Math.min(760, window.innerWidth * 0.72);
        const h = Math.min(620, window.innerHeight * 0.72);
        return {
            left: window.innerWidth / 2 - w / 2 - pad,
            right: window.innerWidth / 2 + w / 2 + pad,
            top: window.innerHeight / 2 - h / 2 - pad,
            bottom: window.innerHeight / 2 + h / 2 + pad,
        };
    }

    initSymbolParticles() {
        this.symbolParticles = [];
        // 14 → 7 desktop / 4 móvil
        const totalSymbols = IS_SMALL_SCREEN ? 4 : 7;
        const W = window.innerWidth;
        const H = window.innerHeight;
        const margin = 80;
        const exclusion = this.getContentExclusion();
        const isExcluded = (x, y) =>
            x > exclusion.left && x < exclusion.right && y > exclusion.top && y < exclusion.bottom;

        for (let i = 0; i < totalSymbols; i++) {
            const randomSymbol = symbolsList[Math.floor(Math.random() * symbolsList.length)];
            const symbolColor = colors[Math.floor(Math.random() * colors.length)];

            // Muestreo por rechazo: buscar base fuera del contenido, en los márgenes visibles
            let baseX = margin;
            let baseY = margin;
            let placed = false;
            for (let attempt = 0; attempt < 25 && !placed; attempt++) {
                const x = margin + Math.random() * Math.max(1, W - margin * 2);
                // Evitar la franja vertical del header en el primer intento no es necesario;
                // basta con huir del rectángulo de contenido
                const y = margin + Math.random() * Math.max(1, H - margin * 2);
                if (!isExcluded(x, y)) {
                    baseX = x;
                    baseY = y;
                    placed = true;
                }
            }
            if (!placed) {
                // Fallback: esquinas alternadas (siempre visibles)
                const corners = [
                    [margin + 40, margin + 40],
                    [W - margin - 40, margin + 40],
                    [margin + 40, H - margin - 40],
                    [W - margin - 40, H - margin - 40],
                ];
                const c = corners[i % corners.length];
                baseX = Math.min(Math.max(c[0], margin), W - margin);
                baseY = Math.min(Math.max(c[1], margin), H - margin);
            }

            const symbolGroup = { offsetSeed: Math.random() * 100 };
            const points = getSymbolPoints(randomSymbol);

            points.forEach(pt => {
                this.symbolParticles.push(new SymbolParticle(baseX, baseY, pt.x, pt.y, symbolColor, symbolGroup));
            });
        }
    }

    regenerateSymbols() {
        this.initSymbolParticles();
    }

    animate(timestamp) {
        if (!this.ctx || !this.canvas) return;
        // Throttle a ~30fps: el ojo no nota más en un fondo decorativo
        if (timestamp - this.lastFrame < 33) {
            this.animationId = requestAnimationFrame((ts) => this.animate(ts));
            return;
        }
        this.lastFrame = timestamp;
        // Pausar trabajo si la pestaña no es visible
        if (!this.visible || document.hidden) {
            this.animationId = requestAnimationFrame((ts) => this.animate(ts));
            return;
        }

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        for (let i = 0; i < this.backgroundStars.length; i++) {
            this.backgroundStars[i].update();
            this.backgroundStars[i].draw(this.ctx);
        }

        // Líneas entre estrellas solo en desktop (coste cuadrático)
        if (!IS_SMALL_SCREEN) {
            for (let i = 0; i < this.backgroundStars.length; i++) {
                for (let j = i + 1; j < this.backgroundStars.length; j++) {
                    let dist = Math.hypot(
                        this.backgroundStars[i].x - this.backgroundStars[j].x,
                        this.backgroundStars[i].y - this.backgroundStars[j].y
                    );
                    if (dist < 85) {
                        this.ctx.strokeStyle = `rgba(255, 255, 255, ${0.08 * (1 - dist / 85)})`;
                        this.ctx.lineWidth = 0.4;
                        this.ctx.beginPath();
                        this.ctx.moveTo(this.backgroundStars[i].x, this.backgroundStars[i].y);
                        this.ctx.lineTo(this.backgroundStars[j].x, this.backgroundStars[j].y);
                        this.ctx.stroke();
                    }
                }
            }
        }

        this.symbolParticles.forEach(p => {
            p.update(timestamp);
            p.draw(this.ctx);
        });

        this.animationId = requestAnimationFrame((ts) => this.animate(ts));
    }

    destroy() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }
}

// Instancia global de la animación
const particleAnimation = new ParticleAnimation();

// Exponer funciones globales para compatibilidad con código existente
window.resize = () => particleAnimation.resize();
window.regenerateSymbols = () => particleAnimation.regenerateSymbols();
window.animate = (ts) => particleAnimation.animate(ts);

// Inicializar cuando el navegador esté libre (no bloquea FCP/LCP)
function initWhenIdle() {
    particleAnimation.init();
}
if ('requestIdleCallback' in window) {
    document.addEventListener('DOMContentLoaded', () => {
        requestIdleCallback(initWhenIdle, { timeout: 1500 });
    });
} else {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(initWhenIdle, 300);
    });
}

// Debounce resize: antes reconstruía cientos de partículas por cada píxel
window.addEventListener('resize', () => {
    clearTimeout(particleAnimation.resizeTimer);
    particleAnimation.resizeTimer = setTimeout(() => particleAnimation.resize(), 250);
});

// Pausar cuando la pestaña se oculta (ahorra CPU/batería)
document.addEventListener('visibilitychange', () => {
    particleAnimation.visible = !document.hidden;
});