const docenteId = localStorage.getItem('userId');

async function initDashboard() {
    if (!docenteId) return window.location.href = 'index.html';
    
    await loadStats();
    await loadRooms();
    await loadChart();
    await loadStudentsTable();
}

async function loadStats() {
    const res = await fetch(`/api/docente/resumen-global/${docenteId}`);
    const data = await res.json();
    
    document.getElementById('total-estudiantes').innerText = data.estudiantes_totales;
    document.getElementById('promedio-global').innerText = data.rendimiento_promedio;
    document.getElementById('total-errores').innerText = data.total_errores;
}

async function loadRooms() {
    const res = await fetch(`/api/docente/stats/${docenteId}`);
    const rooms = await res.json();
    const container = document.getElementById('rooms-container');
    
    container.innerHTML = rooms.filter(r => r.activa === 1).map(r => `
        <div class="stat-card" style="border-top-color: var(--accent-color);">
            <div style="display: flex; justify-content: space-between;">
                <span class="trend">CÓDIGO: ${r.codigo_unico}</span>
                <button onclick="deleteSala(${r.id})" style="background:none; border:none; color:var(--danger-color); cursor:pointer;">✕</button>
            </div>
            <div class="stat-value" style="font-size: 1.2rem;">${r.alumnos} Alumnos</div>
            <p>Promedio: ${r.promedio} pts</p>
        </div>
    `).join('') || '<p style="color:var(--text-muted)">No hay salas activas.</p>';
}

async function deleteSala(id) {
    if (!confirm("¿Seguro que deseas ocultar/borrar esta sala? Los alumnos no podrán unirse más.")) return;
    
    const res = await fetch('/api/salas/borrar', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ sala_id: id, docente_id: docenteId })
    });
    
    if (res.ok) {
        loadRooms();
        loadStats();
    }
}

async function loadChart() {
    const res = await fetch(`/api/docente/analisis-detallado/${docenteId}`);
    const data = await res.json();
    
    const ctx = document.getElementById('analyticsChart').getContext('2d');
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
}

async function loadStudentsTable() {
    const res = await fetch(`/api/docente/resultados/${docenteId}`);
    const students = await res.json();
    const tbody = document.getElementById('students-table-body');
    
    tbody.innerHTML = students.map(s => {
        const accuracy = s.total_aciertos + s.total_errores > 0 
            ? Math.round((s.total_aciertos / (s.total_aciertos + s.total_errores)) * 100) 
            : 0;
        const progressionPercent = Math.round((s.max_nivel_id / misiones.length) * 100); // Dynamic total levels
            
        let badgeClass = 'badge-success';
        let statusText = 'ESTABLE';
        
        if (accuracy < 50 || s.total_errores > 15) {
            badgeClass = 'badge-risk';
            statusText = 'EN RIESGO';
        } else if (accuracy < 75) {
            badgeClass = 'badge-warning';
            statusText = 'ALERTA';
        }

        return `
            <tr>
                <td style="font-weight: bold;">${s.alumno_nombre.toUpperCase()}</td>
                <td>Nivel ${s.max_nivel_id} (${progressionPercent}%)</td>
                <td class="score-val">${s.total_score} PTS</td>
                <td>
                    <div class="progress-container"><div class="progress-bar" style="width: ${accuracy}%"></div></div>
                    <small>${accuracy}% precisión</small>
                </td>
                <td><span class="badge ${badgeClass}">${statusText}</span></td>
                <td><button onclick="viewStudentDetail(${s.alumno_id}, '${s.alumno_nombre}')" class="btn btn-secondary" style="padding: 4px 8px; font-size: 0.7rem;">Ver Niveles</button></td>
            </tr>
        `;
    }).join('');
}

async function viewStudentDetail(id, nombre) {
    document.getElementById('detail-student-name').innerText = `HISTORIAL TÁCTICO: ${nombre.toUpperCase()}`;
    const modal = document.getElementById('detail-modal');
    const container = document.getElementById('student-levels-detail');
    
    container.innerHTML = "<p>Cargando análisis por nivel...</p>";
    modal.classList.remove("hidden");

    try {
        const res = await fetch(`/api/docente/detalle-estudiante/${id}`);
        const data = await res.json();

        if (!data || data.length === 0) {
            container.innerHTML = "<p style='text-align:center; padding:20px;'>El estudiante aún no tiene registros de actividad en los niveles.</p>";
            return;
        }

        container.innerHTML = `
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
                    ${data.map(d => {
                        const total = (d.aciertos || 0) + (d.errores || 0);
                        const acc = total > 0 ? Math.round((d.aciertos / total) * 100) : 0;
                        return `
                        <tr>
                            <td>Nivel ${d.nivel_id}</td>
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

initDashboard();