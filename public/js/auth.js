/**
 * auth.js - Manejador centralizado de autenticación para Eduplay
 */
document.addEventListener('DOMContentLoaded', () => {
    // 1. Buscamos el botón del header y el contenedor de login
    const loginBtn = document.getElementById('login-btn') || document.querySelector('header .btn-primary'); 
    const registerBtn = document.getElementById('register-btn'); // Si tienes botón de registro
    const loginCard = document.getElementById('login-card') || document.getElementById('modal-login');

    if (loginBtn && loginCard) {
        loginBtn.addEventListener('click', () => {
            // Mostramos el card (por si está oculto con la clase 'hidden')
            loginCard.classList.remove('hidden');
            // Hacemos scroll suave hacia el formulario para que el usuario no tenga que "bajar"
            loginCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            // Opcional: poner el foco en el primer campo
            const inputIdent = document.getElementById('identifier');
            if (inputIdent) inputIdent.focus();
        });
    }

    // Lógica para manejar el envío del formulario de login
    const loginForm = document.getElementById('loginForm') || document.getElementById('form-login');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Extraemos los datos por ID (más robusto ya que tus inputs no tienen atributo 'name')
            const identifier = document.getElementById('identifier')?.value;
            const password = document.getElementById('password')?.value;
            const rol = document.getElementById('rol')?.value;
            
            const msgDiv = document.getElementById('msg');
            if (msgDiv) {
                msgDiv.style.color = "var(--accent-color)";
                msgDiv.innerText = "Verificando identidad en el sistema...";
            }

            try {
                const res = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ identifier, password, rol })
                });
                const result = await res.json();

                if (result.status === 'success') {
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
                            : 'game.html';
                    }, 800);
                } else {
                    if (msgDiv) {
                        msgDiv.style.color = "#ff4444";
                        msgDiv.innerText = result.error || "Credenciales inválidas";
                    }
                }
            } catch (err) { 
                console.error(err);
                if (msgDiv) msgDiv.innerText = "Error de conexión con el núcleo.";
            }
        });
    }
});