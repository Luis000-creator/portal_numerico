// ============================================================================
// Portal Numérico - Canvas Animation Module
// ============================================================================
// Gestiona: fondo de estrellas, partículas de símbolos, animación en tiempo real
// ============================================================================

// --- CONFIGURACIÓN GLOBAL DE PARTÍCULAS ---
const symbolsList = ['+', '-', '×', '÷', '∑', '∫', 'π', '√', 'lim', 'f(x)', 'Δ'];
const colors = ['#ffffff', '#00f0ff', '#bd00ff', '#ff007b', '#7000ff'];
let mouse = { x: null, y: null, radius: 130 };

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
    const step = 3;

    for (let y = 0; y < 120; y += step) {
        for (let x = 0; x < 120; x += step) {
            const index = (y * 120 + x) * 4;
            if (imgData.data[index + 3] > 128) {
                points.push({ x: x - 60, y: y - 60 });
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
    }

    init() {
        if (!this.canvas || this.initialized) return;
        this.resize();
        this.initialized = true;
        this.animate(0);
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
        const count = (this.canvas.width * this.canvas.height) / 10000;
        for (let i = 0; i < count; i++) {
            this.backgroundStars.push(new Star(this.canvas));
        }
    }

    initSymbolParticles() {
        this.symbolParticles = [];
        const totalSymbols = 14;
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;

        for (let i = 0; i < totalSymbols; i++) {
            const randomSymbol = symbolsList[Math.floor(Math.random() * symbolsList.length)];
            const symbolColor = colors[Math.floor(Math.random() * colors.length)];

            const angle = (i / totalSymbols) * Math.PI * 2 + (Math.random() * 0.3);
            const distance = 360 + Math.random() * 220;

            const baseX = centerX + Math.cos(angle) * distance;
            const baseY = centerY + Math.sin(angle) * (distance * 0.75);

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

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        for (let i = 0; i < this.backgroundStars.length; i++) {
            this.backgroundStars[i].update();
            this.backgroundStars[i].draw(this.ctx);

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

// Inicializar al cargar
document.addEventListener('DOMContentLoaded', () => {
    particleAnimation.init();
});

window.addEventListener('resize', () => particleAnimation.resize());