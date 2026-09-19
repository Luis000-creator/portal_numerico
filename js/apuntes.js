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
        .select('id,titulo,contenido,archivo_url,created_at')
        .order('created_at', { ascending: false });
    if (error) { console.error('No se pudieron cargar los apuntes:', error); return; }
    const cont = document.getElementById('apuntes-remotos');
    cont.innerHTML = '';
    const vacioMsg = document.getElementById('apuntes-vacio');
    if (vacioMsg) vacioMsg.style.display = data.length === 0 ? 'block' : 'none';
    data.forEach(apunte => {
        const card = document.createElement('div');
        card.className = 'apunte-card card apunte-remoto';
        card.dataset.id = apunte.id;
        const fecha = new Date(apunte.created_at).toLocaleString('es-MX');
        const esPdf = apunte.archivo_url && apunte.archivo_url.toLowerCase().endsWith('.pdf');
        const esMd = apunte.archivo_url && apunte.archivo_url.toLowerCase().endsWith('.md');
        const fileIcon = esPdf ? '<i class="fa-regular fa-file-pdf" style="margin-right:6px; color:#ff6b6b;"></i>'
                       : esMd ? '<i class="fa-regular fa-file-lines" style="margin-right:6px; color:#00f0ff;"></i>'
                       : '<i class="fa-solid fa-file" style="margin-right:6px; color:var(--text-muted);"></i>';
        card.innerHTML = `<h4>${fileIcon}<span></span></h4><p></p><small style="color:var(--text-muted);display:block;margin-top:8px"><i class="fa-regular fa-clock" style="margin-right:4px;"></i>Publicado: ${fecha}</small>`;
        card.querySelector('h4 span').textContent = apunte.titulo;
        card.querySelector('p').textContent = apunte.contenido;
        // Renderizar KaTEX en el contenido del apunte
        const parrafo = card.querySelector('p');
        if (parrafo) { renderizarMath(parrafo); }
        // Si hay archivo adjunto, agregar visor integrado
        if (apunte.archivo_url) {
            const btnContainer = document.createElement('div');
            btnContainer.style.cssText = 'margin-top: 12px; display: flex; gap: 10px; align-items: center;';

            // Boton para visualizar en la pagina (glifo Font Awesome, no emoji)
            const btnVer = document.createElement('button');
            btnVer.type = 'button';
            btnVer.innerHTML = '<i class="fa-regular fa-eye" style="margin-right:6px;"></i> Ver documento';
            btnVer.style.cssText = 'background: rgba(255,255,255,0.08); border: 1px solid var(--border-color); color: var(--text-white); padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 0.8rem; transition: background 0.3s; width: auto; margin-top: 0;';
            btnVer.onmouseover = () => btnVer.style.background = 'rgba(255,255,255,0.15)';
            btnVer.onmouseout = () => btnVer.style.background = 'rgba(255,255,255,0.08)';

            // Enlace de descarga directa (glifo)
            const enlace = document.createElement('a');
            enlace.href = apunte.archivo_url;
            enlace.target = '_blank';
            enlace.rel = 'noopener';
            enlace.innerHTML = '<i class="fa-solid fa-download" style="margin-right:4px;"></i> Descargar original';
            enlace.style.cssText = 'color: #00f0ff; font-size: 0.8rem; text-decoration: none;';

            // Contenedor oscuro que servira como pantalla del visor
            const visor = document.createElement('div');
            visor.style.cssText = 'display: none; margin-top: 15px; padding: 20px; background: rgba(0,0,0,0.5); border: 1px solid var(--border-color); border-radius: 8px; max-height: 600px; overflow-y: auto; font-size: 0.9rem;';

            // Logica para abrir/cerrar el documento
            btnVer.onclick = async () => {
                // Si esta abierto, cerrarlo
                if (visor.style.display === 'block') {
                    visor.style.display = 'none';
                    btnVer.innerHTML = '<i class="fa-regular fa-eye" style="margin-right:6px;"></i> Ver documento';
                    return;
                }

                // Abrir visor con estado de carga
                visor.style.display = 'block';
                btnVer.innerHTML = '<i class="fa-regular fa-eye-slash" style="margin-right:6px;"></i> Ocultar documento';
                visor.textContent = 'Cargando documento...';

                const url = apunte.archivo_url;

                // Renderizar segun el tipo de archivo
                if (url.toLowerCase().endsWith('.pdf')) {
                    visor.textContent = '';
                    const objeto = document.createElement('object');
                    objeto.data = url;
                    objeto.type = 'application/pdf';
                    objeto.className = 'visor-pdf';
                    objeto.style.cssText = 'border-radius: 4px; background: #222;';
                    // Fallback si el navegador no soporta el visor integrado
                    const aviso = document.createElement('p');
                    aviso.style.cssText = 'color: var(--text-muted); text-align: center;';
                    aviso.textContent = 'Tu navegador no soporta el visor integrado. ';
                    const alt = document.createElement('a');
                    alt.href = url;
                    alt.target = '_blank';
                    alt.rel = 'noopener';
                    alt.textContent = 'Haz clic aqui para descargar o ver el PDF original';
                    alt.style.cssText = 'color: #00f0ff;';
                    aviso.appendChild(alt);
                    objeto.appendChild(aviso);
                    visor.appendChild(objeto);
                } else if (url.toLowerCase().endsWith('.md')) {
                    try {
                        const response = await fetch(url);
                        const text = await response.text();
                        // Traducir Markdown a HTML y sanitizar contra XSS
                        const limpio = DOMPurify.sanitize(marked.parse(text));
                        visor.innerHTML = limpio;
                        // Pasar las matematicas por KaTeX
                        if (typeof renderizarMath === 'function') {
                            renderizarMath(visor);
                        }
                    } catch (e) {
                        visor.textContent = 'Error al cargar el archivo Markdown.';
                    }
                }
            };

            btnContainer.appendChild(btnVer);
            btnContainer.appendChild(enlace);
            card.appendChild(btnContainer);
            card.appendChild(visor); // El visor se anexa debajo de los botones
        }
        cont.appendChild(card);
    });
    filtrarContenido();
}

// --- PUBLICAR NUEVO APUNTE ---

async function publicarApunte(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const titulo = form.titulo.value.trim();
    const contenido = form.contenido.value.trim() || '';
    const archivoInput = form.archivo ? form.archivo.files[0] : null;
    let archivo_url = null;

    if (!titulo) return;

    // Evitar apunte fantasma (sin texto Y sin archivo)
    if (!contenido && !archivoInput) {
        alert('Debes escribir una descripción o subir un archivo adjunto.');
        return;
    }
    if (!window.supabaseClient) {
        alert('La base de datos compartida todavía no está configurada.');
        return;
    }

    // Validar archivo: solo PDF o Markdown, maximo 10 MB
    if (archivoInput) {
        const ext = archivoInput.name.split('.').pop().toLowerCase();
        if (!['pdf', 'md'].includes(ext)) {
            alert('Solo se permiten archivos PDF o Markdown (.pdf, .md).');
            return;
        }
        if (archivoInput.size > 10 * 1024 * 1024) {
            alert('El archivo supera el limite de 10 MB.');
            return;
        }
    }

    const boton = form.querySelector('button');
    boton.disabled = true;
    boton.textContent = 'Subiendo...';

    // 1. Si hay archivo, subirlo al bucket de Supabase
    if (archivoInput) {
        const fileExt = archivoInput.name.split('.').pop().toLowerCase();
        const fileName = `${Date.now()}.${fileExt}`; // Nombre unico

        // Asignar el tipo MIME correcto para que el navegador lo visualice
        const mimeType = fileExt === 'pdf' ? 'application/pdf' : 'text/markdown';

        const { error: uploadError } = await window.supabaseClient.storage
            .from('archivos_apuntes')
            .upload(`public/${fileName}`, archivoInput, {
                contentType: mimeType
            });

        if (uploadError) {
            console.error('Error al subir archivo:', uploadError);
            alert('No se pudo subir el archivo.');
            boton.disabled = false;
            boton.textContent = 'Publicar Apunte';
            return;
        }

        // Obtener la URL publica del archivo
        const { data: publicUrlData } = window.supabaseClient.storage
            .from('archivos_apuntes')
            .getPublicUrl(`public/${fileName}`);

        archivo_url = publicUrlData.publicUrl;
    }

    // 2. Guardar el apunte en la base de datos (con o sin archivo)
    // Si no hay texto, guardar marcador para cumplir el CHECK de la columna
    const contenidoFinal = contenido || `(archivo adjunto: ${archivoInput.name})`;
    const { error } = await window.supabaseClient
        .from('apuntes')
        .insert({ titulo, contenido: contenidoFinal, archivo_url });

    boton.disabled = false;
    boton.textContent = 'Publicar Apunte';

    if (error) {
        console.error(error);
        alert('No se pudo publicar el apunte. Revisa la configuración de la base de datos.');
        return;
    }

    form.reset();
    const displaySpan = document.getElementById('file-name-display');
    if (displaySpan) {
        displaySpan.innerHTML = '<i class="fa-solid fa-file-arrow-up"></i> Haz clic para seleccionar un archivo...';
    }
    await cargarApuntesRemotos();
}

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

// Exponer globalmente para usar en index.html
window.cargarApuntesRemotos = cargarApuntesRemotos;
window.publicarApunte = publicarApunte;
window.renderizarMath = renderizarMath;

// --- FILTRAR CONTENIDO (compatibilidad) ---

function filtrarContenido() {
    const q = document.getElementById('buscador').value.toLowerCase().trim();
    document.querySelectorAll('.apunte-card, .card').forEach(card => {
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

    // Escuchar seleccion de archivo: mostrar nombre y autocompletar titulo
    const archivoInput = document.getElementById('archivo');
    if (archivoInput) {
        archivoInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            const displaySpan = document.getElementById('file-name-display');
            const tituloInput = document.querySelector('input[name="titulo"]');

            if (file) {
                // Actualiza el texto visual del boton (icono + nombre)
                const icon = file.name.toLowerCase().endsWith('.pdf')
                    ? '<i class="fa-regular fa-file-pdf" style="margin-right:6px; color:#ff4d4d;"></i>'
                    : '<i class="fa-regular fa-file-lines" style="margin-right:6px; color:#00f0ff;"></i>';
                displaySpan.innerHTML = `${icon} ${file.name}`;

                // Si el titulo esta vacio, autocompletar sin la extension (.md o .pdf)
                if (tituloInput && tituloInput.value.trim() === '') {
                    tituloInput.value = file.name.replace(/\.[^/.]+$/, "");
                }
            } else {
                displaySpan.innerHTML = '<i class="fa-solid fa-file-arrow-up"></i> Haz clic para seleccionar un archivo...';
            }
        });
    }
});