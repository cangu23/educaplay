/**
 * auth.js - Manejador centralizado de autenticación para Eduplay
 */
document.addEventListener('DOMContentLoaded', () => {
    // --- LÓGICA DE NAVEGACIÓN (Bajar sola) ---
    const loginHeaderBtn = document.getElementById('login-btn-header');
    const loginCard = document.getElementById('login-card');

    if (loginHeaderBtn && loginCard) {
        loginHeaderBtn.addEventListener('click', (e) => {
            e.preventDefault();
            loginCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Enfoque automático al primer campo después de bajar
            const input = document.getElementById('identifier');
            if (input) setTimeout(() => input.focus(), 800);
        });
    }

    // Lógica para manejar el envío del formulario de login
    const loginForm = document.getElementById('loginForm') || document.getElementById('form-login');
    const loginBtn = document.getElementById('loginBtn'); // Obtener el botón de login
    const msgDiv = document.getElementById('msg'); // Obtener el div de mensajes

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Protección contra doble clic
            if (loginBtn && loginBtn.disabled) return;

            if (loginBtn) {
                loginBtn.disabled = true;
                loginBtn.innerText = "CONECTANDO...";
            }
            if (msgDiv) {
                msgDiv.innerText = ""; // Limpiar mensajes previos
                msgDiv.style.color = "var(--accent-color)";
                msgDiv.innerText = "Verificando identidad en el sistema...";
            }

            // Extraemos los datos por ID (más robusto ya que tus inputs no tienen atributo 'name')
            const identifier = document.getElementById('identifier')?.value;
            const password = document.getElementById('password')?.value;
            const selectedRol = document.getElementById('rol')?.value; // Obtener rol seleccionado

            try {
                const res = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ identifier, password, rol: selectedRol }) // Enviar rol seleccionado
                });

                if (!res.ok) {
                    const errorData = await res.json();
                    throw new Error(errorData.error || "Acceso Denegado: Credenciales incorrectas");
                }

                const result = await res.json();

                if (result.status === 'success') {
                    // Verificar que el rol en DB coincida con el seleccionado
                    if (result.user.rol !== selectedRol) {
                        throw new Error("El rol seleccionado no coincide con tu cuenta");
                    }

                    localStorage.setItem('token', result.token);
                    localStorage.setItem('userId', result.user.id);
                    localStorage.setItem('rol', result.user.rol);
                    localStorage.setItem('username', result.user.username);

                    if (msgDiv) {
                        msgDiv.style.color = "var(--success-color)";
                        msgDiv.innerText = "¡Acceso concedido! Sincronizando perfil...";
                    }

                    // Redirección inteligente por rol
                    setTimeout(() => {
                        window.location.href = (result.user.rol === 'profesor') 
                            ? 'teacher_dashboard.html' 
                            : 'student_dashboard.html'; // Redirigir a panel del estudiante
                    }, 800);
                } else {
                    // Caso de respuesta inesperada
                    if (msgDiv) {
                        msgDiv.style.color = "#ff4444";
                        msgDiv.innerText = result.error || "Respuesta inesperada del servidor";
                    }
                }
            } catch (error) { 
                console.error(error);
                if (msgDiv) {
                    msgDiv.style.color = "#ff4444";
                    msgDiv.innerText = error.message || "Error de conexión con el núcleo.";
                }
            } finally {
                if (loginBtn) {
                    loginBtn.disabled = false;
                    loginBtn.innerText = "Ingresar";
                }
            }
        });
    }

    // --- Función quickJoin ---
    async function quickJoin() {
        const code = document.getElementById('quick-code').value.toUpperCase();
        const userId = localStorage.getItem('userId');
        const quickMsg = document.getElementById('quick-msg');
        if (!userId) {
            if (quickMsg) {
                quickMsg.style.color = "var(--danger-color)";
                quickMsg.innerText = "Inicia sesión primero.";
            }
            return;
        }
        try {
            const res = await fetch('/api/salas/unirse', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ codigo: code, estudiante_id: userId })
            });
            const data = await res.json();
            if (data.status === 'success') {
                localStorage.setItem('salaId', data.salaId);
                window.location.href = data.redirect + data.params;
            } else { 
                if (quickMsg) quickMsg.innerText = data.error; 
            }
        } catch (e) { 
            if (quickMsg) quickMsg.innerText = "Error de conexión"; 
        }
    }
    // Hacer quickJoin accesible globalmente (llamado desde onclick en HTML)
    window.quickJoin = quickJoin;

    // --- Función loadRanking ---
    async function loadRanking() {
        const body = document.getElementById('ranking-body');
        const avatarsMap = { 'agente_1': '👤', 'agente_2': '🕵️', 'agente_3': '🤖', 'agente_4': '🛡️', 'agente_5': '⚡', 'agente_6': '💻' };

        try {
            const res = await fetch('/api/ranking');
            const data = await res.json();
            if (data.length === 0) {
                if (body) body.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px; color: var(--text-muted);">No hay registros de misiones completadas aún.</td></tr>';
                return;
            }
            if (body) {
                body.innerHTML = data.map((r, index) => {
                    const medals = ["🥇", "🥈", "🥉"];
                    const medal = medals[index] ? medals[index] + " " : "";

                    const avatarContent = avatarsMap[r.avatar] 
                        ? `<span style="font-size: 1.5rem;">${avatarsMap[r.avatar]}</span>`
                        : `<img src="${r.avatar}" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover; border: 1px solid var(--primary-color); vertical-align: middle;">`;

                    return `
                        <tr class="ranking-row" style="animation-delay: ${index * 0.1}s;">
                            <td style="font-weight: bold; color: var(--accent-color);">#${index + 1}</td>
                            <td style="width: 40px; text-align: center; padding-right: 0;">${avatarContent}</td>
                            <td>${medal}${r.username}</td>
                            <td class="score-val" style="text-align: right;">${Math.floor(r.total_score)} PTS</td>
                        </tr>
                    `;
                }).join('');
            }
        } catch (e) {
            console.error("Error al cargar ranking:", e);
            if (body) body.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px; color: var(--danger-color);">Error al conectar con la base de datos.</td></tr>';
        }
    }
    loadRanking();

    // --- Función checkSession ---
    function checkSession() {
        const token = localStorage.getItem('token');
        const username = localStorage.getItem('username');
        const userId = localStorage.getItem('userId');

        if (token && username) {
            // Cambiar Header
            const navAuthButtons = document.getElementById('nav-auth-buttons');
            if (navAuthButtons) {
                navAuthButtons.innerHTML = `
                    <a href="profile.html" class="btn btn-secondary">Mi Perfil</a>
                    <button onclick="localStorage.clear(); location.reload();" class="btn btn-danger">Salir</button>
                `;
            }

            // Cambiar Acciones Hero
            const heroActions = document.getElementById('hero-actions');
            if (heroActions) {
                heroActions.innerHTML = `
                    <a href="student_dashboard.html" class="btn btn-primary">Ir a mis Misiones</a>
                    <a href="profile.html" class="btn btn-secondary">Ver mi Rango</a>
                `;
            }

            // Cambiar Sección de Login por Bienvenida
            const authSection = document.getElementById('login-card');
            if (authSection) {
                authSection.innerHTML = `
                    <div style="text-align: center; padding: 20px;">
                        <span class="material-icons" style="font-size: 4rem; color: var(--primary-color);">account_circle</span>
                        <h2 style="margin-top: 10px;">¡Bienvenido, ${username}!</h2>
                        <p style="color: var(--text-muted); margin-bottom: 20px;">Tu sesión está activa en el sistema.</p>
                        <a href="student_dashboard.html" class="btn btn-primary" style="width: 100%; margin-bottom: 10px;">Continuar Operaciones</a>
                        <button onclick="localStorage.clear(); location.reload();" class="btn btn-secondary" style="width: 100%;">Cerrar Sesión Actual</button>
                    </div>
                `;
            }
        }
    }
    checkSession();
});