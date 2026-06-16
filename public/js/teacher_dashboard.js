const docenteId = localStorage.getItem('userId');
const token = localStorage.getItem('token');

async function initDashboard() {
    if (!docenteId || !token) return window.location.href = 'index.html';
    
    // Ejecutamos las cargas en paralelo y de forma segura. 
    // Si una falla (ej. no existe el canvas del gráfico), las demás continúan.
    await Promise.allSettled([
        loadStats(),
        loadRooms(),
        loadChart(),
        loadStudentsTable()
    ]);

    // Monitoreo táctico: Actualización periódica silenciosa
    setInterval(() => {
        loadStats();
        loadChart(); // Ahora el gráfico también se actualiza solo
        loadStudentsTable();
    }, 20000);

    // Vincular buscador si existe el elemento en el HTML
    const searchInput = document.getElementById('student-search');
    if (searchInput) {
        searchInput.addEventListener('input', filterStudents);
    }

    // Vincular botón de exportación global
    const exportBtn = document.getElementById('btn-export-excel');
    if (exportBtn) {
        exportBtn.onclick = exportGeneralReport;
    }
}

async function loadStats() {
    try {
        const res = await fetch(`/api/docente/resumen-global/${docenteId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        
        const elEst = document.getElementById('total-estudiantes');
        const elProm = document.getElementById('promedio-global');
        const elErr = document.getElementById('total-errores');

        if (elEst) elEst.innerText = data.estudiantes_totales ?? 0;
        if (elProm) elProm.innerText = data.rendimiento_promedio ?? 0;
        if (elErr) elErr.innerText = data.total_errores ?? 0;

        // Actualizar sello de tiempo
        const updateEl = document.getElementById('last-update-time');
        if (updateEl) {
            updateEl.innerText = `Última sincronización: ${new Date().toLocaleTimeString()}`;
        }
    } catch (e) { console.warn("Error cargando estadísticas globales:", e); }
}

async function loadRooms() {
    const container = document.getElementById('rooms-container');
    if (!container) return;

    const res = await fetch(`/api/docente/stats/${docenteId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const rooms = await res.json();
    
    container.innerHTML = rooms.filter(r => r.activa === 1).map(r => `
        <div class="stat-card" style="border-top-color: var(--accent-color);">
            <div style="display: flex; justify-content: space-between;">
                <span class="trend">CÓDIGO: ${r.codigo_unico}</span>
                <button onclick="deleteSala(${r.id})" class="btn-delete-small">✕</button>
            </div>
            <div class="stat-value" style="font-size: 1.2rem;">${r.alumnos} Alumnos</div>
            <p>Promedio: ${r.promedio} pts</p>
        </div>
    `).join('') || '<p class="empty-msg">No hay salas activas.</p>';
}

async function deleteSala(id) {
    if (!confirm("¿Seguro que deseas ocultar/borrar esta sala? Los alumnos no podrán unirse más.")) return;
    
    const res = await fetch('/api/salas/borrar', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ sala_id: id, docente_id: docenteId })
    });
    
    if (res.ok) {
        loadRooms();
        loadStats();
    }
}

async function loadChart() {
    const chartEl = document.getElementById('analyticsChart');
    if (!chartEl) return;

    const res = await fetch(`/api/docente/analisis-detallado/${docenteId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    
    try {
        const ctx = chartEl.getContext('2d');
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.map(d => `Nivel ${d.nivel_id}`),
                datasets: [{
                    label: 'Aciertos (Seguridad)',
                    data: data.map(d => d.avg_aciertos),
                    backgroundColor: 'rgba(34, 197, 94, 0.5)',
                    borderColor: '#22c55e',
                    borderWidth: 2
                }, {
                    label: 'Errores (Vulnerabilidades)',
                    data: data.map(d => d.avg_errores),
                    backgroundColor: 'rgba(239, 68, 68, 0.5)',
                    borderColor: '#ef4444',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, grid: { color: '#262626' }, ticks: { color: '#fff' } },
                    x: { grid: { display: false }, ticks: { color: '#fff' } }
                },
                plugins: {
                    legend: { labels: { color: '#fff', font: { family: 'Courier New' } } }
                }
            }
        });
    } catch (e) { console.warn("Error renderizando gráfico:", e); }
}

async function loadStudentsTable() {
    const tbody = document.getElementById('students-table-body');
    if (!tbody) return;

    const res = await fetch(`/api/docente/resultados/${docenteId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const students = await res.json();
    
    if (students.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-msg">No hay registros de alumnos en tus salas.</td></tr>';
        return;
    }
    
    // Si hay un término de búsqueda activo, lo aplicamos tras recargar los datos
    const searchTerm = document.getElementById('student-search')?.value.toLowerCase() || "";
    
    tbody.innerHTML = students.map(s => {
        // Lógica de filtrado en tiempo real
        const matchesSearch = s.alumno_nombre.toLowerCase().includes(searchTerm);
        const displayStyle = matchesSearch ? "" : 'style="display:none;"';
        const salaId = s.sala_id; // Guardamos el ID para las acciones

        const accuracy = s.total_aciertos + s.total_errores > 0 
            ? Math.round((s.total_aciertos / (s.total_aciertos + s.total_errores)) * 100) 
            : 0;
        
        const totalLevels = (window.misiones && misiones.length) ? misiones.length : 5;
        const progressionPercent = Math.round((s.max_nivel_id / totalLevels) * 100);
            
        let badgeClass = 'badge-success';
        let statusText = 'ESTABLE';
        
        // Lógica de alerta temprana para el docente
        if (accuracy < 40 || s.total_errores > 20) {
            badgeClass = 'badge-risk';
            statusText = 'EN RIESGO';
        } else if (accuracy < 70) {
            badgeClass = 'badge-warning';
            statusText = 'ALERTA';
        }

        return `
            <tr ${displayStyle}>
                <td style="font-weight: bold;">${document.createTextNode(s.alumno_nombre.toUpperCase()).wholeText}</td>
                <td>Nivel ${s.max_nivel_id} (${progressionPercent}%)</td>
                <td class="score-val">${s.total_score} PTS</td>
                <td>
                    <div class="progress-container"><div class="progress-bar" style="width: ${accuracy}%"></div></div>
                    <small>${accuracy}% precisión</small>
                </td>
                <td><span class="badge ${badgeClass}">${statusText}</span></td>
                <td><button onclick="viewStudentDetail(${s.alumno_id}, '${s.alumno_nombre}', ${salaId})" class="btn btn-secondary" style="padding: 4px 8px; font-size: 0.7rem;">Ver Niveles</button></td>
            </tr>
        `;
    }).join('');
}

// Función para filtrar estudiantes sin necesidad de peticiones al servidor
function filterStudents() {
    const term = document.getElementById('student-search')?.value.toLowerCase() || "";
    const rows = document.querySelectorAll('#students-table-body tr');
    rows.forEach(row => {
        const name = row.cells[0]?.textContent.toLowerCase() || "";
        row.style.display = name.includes(term) ? "" : "none";
    });
}

async function viewStudentDetail(id, nombre, salaId) {
    document.getElementById('detail-student-name').innerText = `HISTORIAL TÁCTICO: ${nombre.toUpperCase()}`;
    const modal = document.getElementById('detail-modal');
    const container = document.getElementById('student-levels-detail');
    
    container.innerHTML = "<p>Cargando análisis por nivel...</p>";
    modal.classList.remove("hidden");

    try {
        const res = await fetch(`/api/docente/detalle-estudiante/${id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await res.json();
        const progreso = result.progreso || [];
        const errores = result.errores || [];

        if (progreso.length === 0) {
            container.innerHTML = "<p style='text-align:center; padding:20px;'>El estudiante aún no tiene registros de actividad en los niveles.</p>";
            return;
        }

        // Añadir Panel de Comandos de Intervención al inicio del modal
        const interventionPanel = `
            <div style="background: rgba(250, 204, 21, 0.1); border: 1px solid var(--primary-color); padding: 15px; border-radius: 8px; margin-bottom: 20px; display: flex; gap: 10px; align-items: center; justify-content: center;">
                <span style="font-size: 0.8rem; font-weight: bold; color: var(--primary-color);">INTERVENCIÓN:</span>
                <button onclick="intervenir(${id}, 'score', 500)" class="btn btn-primary" style="padding: 5px 10px; font-size: 0.7rem;">+500 PTS</button>
                <button onclick="intervenir(${id}, 'lives', 1)" class="btn btn-success" style="padding: 5px 10px; font-size: 0.7rem; background:#22c55e; color:black;">+1 VIDA</button>
                <div style="height: 20px; width: 1px; background: var(--border-color);"></div>
                <input type="text" id="direct-msg-${id}" placeholder="Mensaje directo..." style="width: 150px; padding: 5px; font-size: 0.7rem;">
                <button onclick="enviarAlerta(${salaId}, ${id})" class="btn btn-secondary" style="padding: 5px 10px; font-size: 0.7rem;">ENVIAR ALERTA</button>
            </div>
        `;

        // CORRECCIÓN: Se eliminó la doble asignación que borraba el panel de intervención
        container.innerHTML = interventionPanel + `
            <table class="report-table">
                <thead>
                    <tr>
                        <th>NIVEL</th>
                        <th>PUNTOS</th>
                        <th>ACIERTOS</th>
                        <th>ERRORES</th>
                        <th>PRECISIÓN</th>
                    </tr>
                </thead>
                <tbody>
                    ${progreso.map(d => {
                        const total = (d.aciertos || 0) + (d.errores || 0);
                        const acc = total > 0 ? Math.round((d.aciertos / total) * 100) : 0;
                        
                        // Filtrar los errores específicos cometidos en este nivel
                        const fallosNivel = errores.filter(e => e.nivel_id === d.nivel_id);
                        let detalleFallosHtml = "";
                        
                        if (fallosNivel.length > 0) {
                            // Función interna para limpiar texto y evitar XSS en los detalles
                            const escapeHTML = (str) => {
                                const p = document.createElement('p');
                                p.textContent = str;
                                return p.innerHTML;
                            };

                            detalleFallosHtml = `
                                <div style="margin-top: 8px; padding: 10px; background: rgba(239, 68, 68, 0.05); border-radius: 6px; border: 1px dashed rgba(239, 68, 68, 0.3); text-align: left;">
                                    <div style="color: var(--danger-color); font-weight: bold; font-size: 0.75rem; margin-bottom: 5px;">📍 ANÁLISIS DE VULNERABILIDADES (ERRORES):</div>
                                    <ul style="margin: 0; padding-left: 15px; font-size: 0.75rem; line-height: 1.4;">
                                        ${fallosNivel.map(f => `
                                            <li style="margin-bottom: 6px;">
                                                <b style="color: #fff;">P: ${escapeHTML(f.pregunta_texto)}</b><br>
                                                <span style="color: #ff8080;">✖ Falló: ${escapeHTML(f.respuesta_estudiante)}</span><br>
                                                <span style="color: #80ff80;">✔ Correcta: ${escapeHTML(f.respuesta_correcta)}</span>
                                            </li>
                                        `).join('')}
                                    </ul>
                                </div>
                            `;
                        }

                        return `
                        <tr>
                            <td style="vertical-align: top;">
                                <div style="font-weight: bold;">Nivel ${d.nivel_id}</div>
                                ${detalleFallosHtml}
                            </td>
                            <td class="score-val">${d.score}</td>
                            <td style="color:var(--success-color)">${d.aciertos}</td>
                            <td style="color:var(--danger-color)">${d.errores}</td>
                            <td>${acc}%</td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
        `;
    } catch (error) {
        container.innerHTML = `<p style="color:var(--danger-color); text-align:center;">Error al conectar con el servidor. Intente de nuevo.</p>`;
        console.error("Error cargando detalles:", error);
    }
}

// Función para cerrar el modal de forma segura
function closeDetailModal() {
    document.getElementById('detail-modal').classList.add('hidden');
}

async function exportGeneralReport() {
    const btn = document.getElementById('btn-export-excel');
    if (btn) {
        btn.innerText = "GENERANDO...";
        btn.disabled = true;
    }

    try {
        const res = await fetch(`/api/docente/exportar-global/${docenteId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error("Fallo al generar reporte");
        
        const data = await res.json(); // La API ahora devuelve JSON con ambas hojas
        const resumenData = data.resumen;
        const fallosData = data.fallos;

        // --- Generar Excel ---
        // Reconstruimos el workbook aquí para usar los datos JSON directamente
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(resumenData), "Resumen General");
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(fallosData), "Analisis de Refuerzo");

        const excelBuffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
        const excelBlob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const excelUrl = window.URL.createObjectURL(excelBlob);
        const excelLink = document.createElement('a');
        excelLink.href = excelUrl;
        excelLink.download = `Reporte_Academico_Eduplay_${new Date().toLocaleDateString().replace(/\//g, '-')}.xlsx`;
        document.body.appendChild(excelLink);
        excelLink.click();
        excelLink.remove();
        window.URL.revokeObjectURL(excelUrl);

        // --- Generar PDF ---
        const fechaGeneracion = new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
        const horaGeneracion = new Date().toLocaleTimeString('es-ES');

        let resumenHtml = resumenData.map(r => `
            <tr>
                <td style="padding: 8px; border: 1px solid #333;">${r.Sala}</td>
                <td style="padding: 8px; border: 1px solid #333;">${r.Cedula}</td>
                <td style="padding: 8px; border: 1px solid #333;">${r.Agente}</td>
                <td style="padding: 8px; border: 1px solid #333; text-align: right;">${r.Puntaje_Total}</td>
                <td style="padding: 8px; border: 1px solid #333; text-align: right;">${r.Aciertos}</td>
                <td style="padding: 8px; border: 1px solid #333; text-align: right;">${r.Errores}</td>
            </tr>
        `).join('');
        if (resumenData.length === 0) resumenHtml = '<tr><td colspan="6" style="text-align: center; padding: 20px;">No hay datos de resumen.</td></tr>';

        let fallosHtml = fallosData.map(f => `
            <tr>
                <td style="padding: 8px; border: 1px solid #333;">${f.Agente}</td>
                <td style="padding: 8px; border: 1px solid #333;">${f.Nivel}</td>
                <td style="padding: 8px; border: 1px solid #333;">${f.Pregunta}</td>
                <td style="padding: 8px; border: 1px solid #333;">${f.Respuesta_Dada}</td>
                <td style="padding: 8px; border: 1px solid #333;">${f.Respuesta_Correcta}</td>
                <td style="padding: 8px; border: 1px solid #333;">${new Date(f.Fecha).toLocaleDateString()}</td>
            </tr>
        `).join('');
        if (fallosData.length === 0) fallosHtml = '<tr><td colspan="6" style="text-align: center; padding: 20px;">No hay errores registrados.</td></tr>';

        const pdfContentHtml = `
            <div style="font-family: 'Courier New', monospace; padding: 20px; color: #000; background-color: #fff;">
                <div style="text-align: center; margin-bottom: 30px;">
                    <img src="assets/logo.png" alt="Eduplay Logo" style="width: 80px; height: 80px; margin-bottom: 10px;">
                    <h1 style="color: #333;">REPORTE ACADÉMICO GLOBAL EDUPLAY OS</h1>
                    <p style="font-size: 0.9em; color: #666;">Generado el: ${fechaGeneracion} ${horaGeneracion}</p>
                </div>

                <h2 style="color: #000; border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-top: 30px;">Resumen General de Agentes</h2>
                <table style="width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 0.8em;">
                    <thead><tr style="background-color: #eee;"><th>Sala</th><th>Cédula</th><th>Agente</th><th style="text-align: right;">Puntaje Total</th><th style="text-align: right;">Aciertos</th><th style="text-align: right;">Errores</th></tr></thead>
                    <tbody>${resumenHtml}</tbody>
                </table>

                <h2 style="color: #000; border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-top: 40px;">Análisis de Refuerzo (Errores Detallados)</h2>
                <table style="width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 0.8em;">
                    <thead><tr style="background-color: #eee;"><th>Agente</th><th>Nivel</th><th>Pregunta</th><th>Respuesta Dada</th><th>Respuesta Correcta</th><th>Fecha</th></tr></thead>
                    <tbody>${fallosHtml}</tbody>
                </table>
            </div>
        `;

        html2pdf().set({
            margin: [10, 10, 10, 10], // top, left, bottom, right
            filename: `Reporte_Academico_Eduplay_${new Date().toLocaleDateString().replace(/\//g, '-')}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, logging: false, dpi: 192, letterRendering: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        }).from(pdfContentHtml).save();

    } catch (e) { alert("Error al exportar datos: " + e.message); }
    finally { if (btn) { btn.innerText = "EXPORTAR EXCEL"; btn.disabled = false; } }
}

// --- FUNCIONES DE INTERVENCIÓN TÁCTICA ---

async function intervenir(estudianteId, tipo, valor) {
    try {
        const res = await fetch('/api/docente/intervenir-alumno', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ estudiante_id: estudianteId, tipo, valor })
        });
        if (res.ok) {
            alert("¡Protocolo de apoyo enviado al agente!");
            loadStudentsTable(); 
        }
    } catch (e) { console.error("Error en intervención:", e); }
}

async function enviarAlerta(salaId, estudianteId) {
    const input = document.getElementById(`direct-msg-${estudianteId}`);
    if (!input) return;
    const msg = input.value.trim();
    if (!msg) return;

    try {
        const res = await fetch('/api/docente/broadcast', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ sala_id: salaId, mensaje: `ALERTA DEL PROFESOR: ${msg}` })
        });
        if (res.ok) {
            input.value = "";
            alert("Mensaje de alerta transmitido al canal de la sala.");
        }
    } catch (e) { console.error("Error al enviar alerta:", e); }
}

// Hacer las funciones accesibles globalmente para los botones generados dinámicamente
window.intervenir = intervenir;
window.enviarAlerta = enviarAlerta;

initDashboard();