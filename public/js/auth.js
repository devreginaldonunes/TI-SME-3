document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('errorMessage');
    const btn = e.target.querySelector('button[type="submit"]');

    btn.disabled = true;
    const originalText = btn.innerText;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Autenticando...';
    errorDiv.classList.add('hidden');

    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.ok) {
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            window.location.href = 'dashboard.html';
        } else {
            const errorMsg = data.message || 'E-mail ou senha incorretos';
            errorDiv.querySelector('span').innerText = errorMsg;
            errorDiv.classList.remove('hidden');
            errorDiv.style.display = 'flex';
        }
    } catch (error) {
        errorDiv.querySelector('span').innerText = 'Erro de conexão com o servidor';
        errorDiv.classList.remove('hidden');
        errorDiv.style.display = 'flex';
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
});

// Verificar se já está logado
document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname;
    if (path.endsWith('index.html') || path.endsWith('/') || path === '') {
        if (localStorage.getItem('token')) {
            window.location.href = 'dashboard.html';
        }
    }
});
