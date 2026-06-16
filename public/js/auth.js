/**
 * auth.js - Manejador centralizado de autenticación para Eduplay
 */
document.addEventListener('DOMContentLoaded', () => {
    const loginBtn = document.getElementById('login-btn'); // ID del botón en tu header
    const registerBtn = document.getElementById('register-btn'); // Si tienes botón de registro

    if (loginBtn) {
        loginBtn.addEventListener('click', () => {
            // Si no tienes modal, redirigir a una página o mostrar el modal de login
            const modal = document.getElementById('modal-login');
            if (modal) {
                modal.classList.remove('hidden');
            } else {
                alert("Redirigiendo al sistema de acceso...");
                // window.location.href = 'login.html'; // Descomenta si tienes página aparte
            }
        });
    }

    // Lógica para manejar el envío del formulario de login
    const loginForm = document.getElementById('form-login');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(loginForm);
            const data = Object.fromEntries(formData.entries());

            try {
                const res = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                const result = await res.json();

                if (result.status === 'success') {
                    localStorage.setItem('token', result.token);
                    localStorage.setItem('userId', result.user.id);
                    localStorage.setItem('rol', result.user.rol);
                    localStorage.setItem('username', result.user.username);

                    // Redirección inteligente por rol
                    window.location.href = (result.user.rol === 'profesor') 
                        ? 'teacher_dashboard.html' 
                        : 'game.html';
                } else {
                    alert("Error: " + (result.error || "Credenciales inválidas"));
                }
            } catch (err) { console.error(err); }
        });
    }
});