// ============================================================================
// Portal Numérico - Apuntes Module
// ============================================================================
// Contiene: funciones para cargar, publicar y buscar apuntes en Supabase
// ============================================================================

// --- CARGAR APUNTES DESDE SUPABASE ---

async function cargarApuntesRemotos() {
    if (!window.supabaseClient) return;
    const { data, error } = await window.supabaseClient
        .from('apuntes')
        .select('id,titulo,contenido,created_at')
        .order('created_at', { ascending: false });
    if (error) { console.error('No se pudieron cargar los apuntes:', error); return; }
    const cont = document.getElementById('apuntes-remotos');
    cont.innerHTML = '';
    data.forEach(apunte => {
        const card = document.createElement('div');
        card.className = 'apunte-card apunte-remoto';
        card.dataset.id = apunte.id;
        const fecha = new Date(apunte.created_at).toLocaleString('es-MX');
        card.innerHTML = `<h4></h4><p></p><small style="color:var(--text-muted);display:block;margin-top:8px">Publicado: ${fecha}</small>`;
        card.querySelector('h4').textContent = apunte.titulo;
        card.querySelector('p').textContent = apunte.contenido;
        // Renderizar KaTEX en el contenido del apunte
        const parrafo = card.querySelector('p');
        if (parrafo) { renderizarMath(parrafo); }
        cont.appendChild(card);
    });
    filtrarContenido();
}

// --- PUBLICAR NUEVO APUNTE ---

async function publicarApunte(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const titulo = form.titulo.value.trim();
    const contenido = form.contenido.value.trim();
    if (!titulo || !contenido) return;
    if (!window.supabaseClient) {
        alert('La base de datos compartida todavía no está configurada.');
        return;
    }
    const boton = form.querySelector('button');
    boton.disabled = true;
    boton.textContent = 'Publicando...';
    const { error } = await window.supabaseClient.from('apuntes').insert({titulo, contenido});
    boton.disabled = false;
    boton.textContent = 'Publicar Apunte';
    if (error) { console.error(error); alert('No se pudo publicar el apunte. Revisa la configuración de la base de datos.'); return; }
    form.reset();
    await cargarApuntesRemotos();
}

// Exponer globalmente para usar en index.html
window.cargarApuntesRemotos = cargarApuntesRemotos;
window.publicarApunte = publicarApunte;

// --- FILTRAR CONTENIDO (compatibilidad) ---

function filtrarContenido() {
    const q = document.getElementById('buscador').value.toLowerCase().trim();
    document.querySelectorAll('.apunte-card').forEach(card => {
        card.style.display = card.innerText.toLowerCase().includes(q) ? '' : 'none';
    });
}

// Exponer globalmente
window.filtrarContenido = filtrarContenido;

// Cargar apuntes en cuanto el DOM este listo
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('form-apunte');
    if (form) {
        form.addEventListener('submit', publicarApunte);
    }
    if (document.getElementById('apuntes-remotos')) {
        cargarApuntesRemotos();
    }
});