const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user') || '{}');
let socket;

if (!token) {
    window.location.href = 'index.html';
}

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('userName').innerText = user.name;
    if (document.getElementById('userNameMobile')) {
        document.getElementById('userNameMobile').innerText = user.name.split(' ')[0];
    }
    document.getElementById('userRoleDisplay').innerText = user.role;
    document.getElementById('userInitial').innerText = user.name.charAt(0).toUpperCase();
    document.getElementById('userInitialMobile').innerText = user.name.charAt(0).toUpperCase();
    document.getElementById('currentDate').innerText = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full' }).format(new Date());
    
    if (user.role !== 'admin') {
        const adminEl = document.getElementById('adminOnlyUsers');
        if (adminEl) adminEl.style.display = 'none';
    }

    // Carregar tema salvo
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);

    initCharts();
    loadStats();
    loadRecentOrders();

    // Atualização automática a cada 5 minutos
    setInterval(() => {
        if (document.getElementById('overviewSection').classList.contains('hidden') === false) {
            loadStats();
            loadRecentOrders();
        }
    }, 300000);

    // Inicializar Socket.io
    initSocket();

    // Listeners de formulários
    document.getElementById('osForm').addEventListener('submit', createOS);

    // Listener para prévia de imagem
    const fileInput = document.getElementById('osAttachmentFile');
    if (fileInput) {
        fileInput.addEventListener('change', function() {
            const file = this.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    document.getElementById('imagePreview').src = e.target.result;
                    document.getElementById('imagePreviewContainer').classList.remove('hidden');
                }
                reader.readAsDataURL(file);
            }
        });
    }
    document.getElementById('userForm').addEventListener('submit', createUser);
    document.getElementById('editUserForm').addEventListener('submit', updateUser);
    document.getElementById('commentForm').addEventListener('submit', addComment);
    
    // Listeners para os novos modais
    document.getElementById('concluirForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const solution = document.getElementById('solutionDescription').value;
        updateOSStatus('concluido', solution);
        // Limpar o formulário
        document.getElementById('concluirForm').reset();
    });
    
    document.getElementById('naoResolvidoForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const reason = document.getElementById('failureReason').value;
        updateOSStatus('nao_resolvido', null, reason);
        // Limpar o formulário
        document.getElementById('naoResolvidoForm').reset();
    });
    
    document.getElementById('cancelarForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const cancellation = document.getElementById('cancellationReason').value;
        updateOSStatus('cancelado', null, null, cancellation);
        // Limpar o formulário
        document.getElementById('cancelarForm').reset();
    });

    document.getElementById('assignForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const tecnicoId = document.getElementById('assignTecnico').value;
        assignTecnico(tecnicoId);
    });
});

let ordersChart, statusPieChart;

function initCharts() {
    const canvasLine = document.getElementById('ordersChart');
    const canvasPie = document.getElementById('statusPieChart');
    
    if (!canvasLine || !canvasPie) {
        console.warn('Elementos de gráfico não encontrados no DOM.');
        return;
    }

    const ctxLine = canvasLine.getContext('2d');
    const ctxPie = canvasPie.getContext('2d');
    
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#94a3b8' : '#64748b';
    const gridColor = isDark ? '#1e293b' : '#e2e8f0';

    if (ordersChart) ordersChart.destroy();
    if (statusPieChart) statusPieChart.destroy();

    ordersChart = new Chart(ctxLine, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Chamados Abertos',
                data: [],
                borderColor: '#6366f1',
                backgroundColor: 'rgba(99, 102, 241, 0.15)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            resizeDelay: 200,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: textColor, stepSize: 1 } },
                x: { grid: { display: false }, ticks: { color: textColor } }
            }
        }
    });

    statusPieChart = new Chart(ctxPie, {
        type: 'doughnut',
        data: {
            labels: ['Pendente', 'Em Atendimento', 'Concluído', 'Não Resolvido', 'Cancelado'],
            datasets: [{
                data: [0, 0, 0, 0, 0],
                backgroundColor: isDark ? ['#fbbf24', '#60a5fa', '#34d399', '#fbbf24', '#f87171'] : ['#f59e0b', '#6366f1', '#10b981', '#fbbf24', '#ef4444'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            resizeDelay: 200,
            cutout: '70%',
            plugins: { legend: { position: 'bottom', labels: { color: textColor, padding: 20, usePointStyle: true } } }
        }
    });
}

async function updateCharts(stats) {
    if (statusPieChart) {
        statusPieChart.data.labels = ['Pendente', 'Em Atendimento', 'Concluído', 'Não Resolvido', 'Cancelado'];
        statusPieChart.data.datasets[0].data = [
            stats.pendentes || 0,
            stats.em_atendimento || 0,
            stats.concluidas || 0,
            stats.nao_resolvidas || 0,
            stats.canceladas || 0
        ];
        statusPieChart.update();
    }

    if (ordersChart && stats.daily) {
        const labels = [];
        const data = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            // Formato YYYY-MM-DD local
            const dateStr = d.toLocaleDateString('en-CA'); // en-CA retorna YYYY-MM-DD
            
            const label = d.toLocaleDateString('pt-BR', { weekday: 'short' });
            labels.push(label);
            
            const dayStat = stats.daily.find(s => s.date === dateStr);
            data.push(dayStat ? dayStat.count : 0);
        }
        
        ordersChart.data.labels = labels;
        ordersChart.data.datasets[0].data = data;
        ordersChart.update();
    }
}

// Tema
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
    
    // Recriar gráficos para atualizar cores
    initCharts();
    
    // Recarregar estatísticas para preencher os gráficos recém-criados
    if (document.getElementById('overviewSection').classList.contains('hidden') === false) {
        loadStats();
    }
}

function updateThemeIcon(theme) {
    const icons = document.querySelectorAll('.theme-toggle i, .theme-toggle-mobile i');
    icons.forEach(icon => {
        icon.className = theme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
    });
}

function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    sidebar.classList.toggle('active');
    overlay.style.display = sidebar.classList.contains('active') ? 'block' : 'none';
}

// Navegação
function showSection(section) {
    if (window.innerWidth <= 1024) {
        const sidebar = document.querySelector('.sidebar');
        const overlay = document.querySelector('.sidebar-overlay');
        sidebar.classList.remove('active');
        overlay.style.display = 'none';
    }

    const sections = ['overview', 'orders', 'users'];
    sections.forEach(s => {
        const el = document.getElementById(s + 'Section');
        if (el) el.classList.add('hidden');
        
        const link = document.getElementById('nav-' + s);
        if (link) link.classList.remove('active');
    });

    const currentSection = document.getElementById(section + 'Section');
    if (currentSection) currentSection.classList.remove('hidden');
    
    const activeLink = document.getElementById('nav-' + section);
    if (activeLink) activeLink.classList.add('active');
    
    const titles = { 
        overview: `Olá, ${user.name}! Aqui está o seu resumo`, 
        orders: 'Gerenciar Chamados de TI', 
        users: 'Administração de Usuários' 
    };
    document.getElementById('sectionTitle').innerText = titles[section];

    if (section === 'overview') {
        loadStats();
        loadRecentOrders();
    }
    if (section === 'orders') loadOrders();
    if (section === 'users') loadUsers();
}

// Toast Notification
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast`;
    if (type === 'error') toast.style.borderLeftColor = 'var(--danger)';
    
    const icon = type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle';
    const color = type === 'success' ? 'var(--success)' : 'var(--danger)';
    
    toast.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px;">
            <div style="background: ${color}20; width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: ${color}">
                <i class="fas ${icon}"></i>
            </div>
            <span style="font-size: 14px; font-weight: 600; color: var(--dark)">${message}</span>
        </div>
    `;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(20px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// Carregar Estatísticas
async function loadStats() {
    try {
        const res = await fetch('/api/orders/stats', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Falha ao carregar estatísticas');
        
        const stats = await res.json();
        
        // Atualizar Cards
        if (document.getElementById('statTotal')) document.getElementById('statTotal').innerText = stats.total || 0;
        if (document.getElementById('statPendentes')) document.getElementById('statPendentes').innerText = stats.pendentes || 0;
        if (document.getElementById('statAtendimento')) document.getElementById('statAtendimento').innerText = stats.em_atendimento || 0;
        if (document.getElementById('statConcluidas')) document.getElementById('statConcluidas').innerText = stats.concluidas || 0;
        
        // Atualizar Gráficos
        updateCharts(stats);
    } catch (e) { 
        console.error('Erro no loadStats:', e); 
    }
}

// Formatar Badges
function getStatusBadge(status) {
    const labels = { pendente: 'Pendente', em_atendimento: 'Em Atendimento', concluido: 'Concluído', nao_resolvido: 'Não Resolvido', cancelado: 'Cancelado' };
    return `<span class="badge badge-${status}">${labels[status] || status}</span>`;
}

function getPriorityColor(priority) {
    const colors = { baixa: 'color: var(--secondary)', media: 'color: var(--info)', alta: 'color: var(--warning)', urgente: 'color: var(--danger); font-weight: 800' };
    return colors[priority] || '';
}

// Listar OS
let allOrders = [];

async function loadOrders() {
    const search = document.getElementById('searchOrder').value.toLowerCase();
    const status = document.getElementById('filterStatus').value;
    
    try {
        const res = await fetch(`/api/orders?search=${search}&status=${status}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        allOrders = await res.json();
        renderOrdersTable(allOrders, 'ordersBody');
    } catch (e) { console.error(e); }
}

async function loadRecentOrders() {
    try {
        const res = await fetch('/api/orders', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const orders = await res.json();
        renderOrdersTable(orders.slice(0, 5), 'recentOrdersBody');
    } catch (e) { console.error(e); }
}

function renderOrdersTable(orders, elementId) {
    const tbody = document.getElementById(elementId);
    if (!tbody) return;
    tbody.innerHTML = '';

    if (orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="justify-content: center; text-align: center; padding: 40px; color: var(--secondary);">Nenhum chamado encontrado.</td></tr>';
        return;
    }

    orders.forEach(os => {
        const tr = document.createElement('tr');
        // Formatar data local
        const createdAt = os.created_at.includes(' ') ? os.created_at.replace(' ', 'T') + 'Z' : os.created_at;
        const dateStr = new Date(createdAt).toLocaleDateString('pt-BR');

        tr.innerHTML = `
            <td data-label="ID" style="font-family: monospace; font-weight: 600; color: var(--secondary);">#${os.id}</td>
            <td data-label="Título">
                <div style="font-weight: 700; color: var(--dark);">${os.title}</div>
                <div style="font-size: 12px; color: var(--secondary); max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${os.description}</div>
            </td>
            <td data-label="Localização">
                <div style="display: flex; align-items: center; gap: 6px; font-size: 13px;">
                    <i class="fas fa-map-marker-alt" style="color: var(--danger); font-size: 12px;"></i>
                    ${os.location}
                </div>
            </td>
            <td data-label="Prioridade">
                <span style="font-size: 13px; text-transform: capitalize; ${getPriorityColor(os.priority)}">
                    <i class="fas fa-circle" style="font-size: 8px; margin-right: 4px;"></i>
                    ${os.priority}
                </span>
            </td>
            <td data-label="Status">${getStatusBadge(os.status)}</td>
            <td data-label="Data" style="font-size: 13px; color: var(--secondary);">${dateStr}</td>
            <td data-label="Ações">
                <button class="btn btn-outline" style="padding: 6px 12px; font-size: 12px;" onclick="viewOS(${os.id})">
                    <i class="fas fa-eye"></i> Detalhes
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Modais
function openModal(id) {
    document.getElementById(id).style.display = 'flex';
}

function closeModal(id) {
    document.getElementById(id).style.display = 'none';
}

// CRUD OS
function removeSelectedImage() {
    document.getElementById('osAttachmentFile').value = '';
    document.getElementById('imagePreview').src = '';
    document.getElementById('imagePreviewContainer').classList.add('hidden');
}

async function createOS(e) {
    e.preventDefault();
    
    const formData = new FormData();
    formData.append('title', document.getElementById('osTitle').value);
    formData.append('location', document.getElementById('osLocation').value);
    formData.append('priority', document.getElementById('osPriority').value);
    formData.append('description', document.getElementById('osDescription').value);
    formData.append('category', document.getElementById('osCategory').value);
    
    const fileInput = document.getElementById('osAttachmentFile');
    if (fileInput.files.length > 0) {
        formData.append('attachment', fileInput.files[0]);
    }

    try {
        const res = await fetch('/api/orders', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });

        if (res.ok) {
            showToast('Chamado aberto com sucesso!');
            closeModal('osModal');
            document.getElementById('osForm').reset();
            removeSelectedImage();
            loadStats();
            loadRecentOrders();
            if (!document.getElementById('ordersSection').classList.contains('hidden')) loadOrders();
        } else {
            const err = await res.json();
            showToast(err.message, 'error');
        }
    } catch (e) { showToast('Erro de conexão', 'error'); }
}

let currentOSId = null;

async function viewOS_Internal(id) {
    currentOSId = id;
    try {
        const res = await fetch(`/api/orders/${id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const os = await res.json();

        const categoryMap = {
            'suporte': 'Suporte Técnico',
            'rede': 'Redes / Internet',
            'hardware': 'Hardware / Peças',
            'software': 'Software / Sistemas',
            'impressora': 'Impressoras',
            'outros': 'Outros'
        };

        document.getElementById('detailsTitle').innerText = os.title;
        document.getElementById('detailsSubtitle').innerText = `Chamado #${os.id} • ${categoryMap[os.category] || os.category || 'Suporte Geral'}`;
        
        document.getElementById('detailsDesc').innerText = os.description;
        
        // Tratar Anexo
        const attachmentContainer = document.getElementById('attachmentContainer');
        const attachmentPreview = document.getElementById('attachmentPreview');
        if (os.attachment_url) {
            attachmentContainer.classList.remove('hidden');
            const isImage = os.attachment_url.match(/\.(jpeg|jpg|gif|png)$/i);
            if (isImage) {
                attachmentPreview.innerHTML = `<a href="${os.attachment_url}" target="_blank"><img src="${os.attachment_url}" style="max-width: 100%; max-height: 300px; border-radius: 12px; border: 1px solid var(--border); box-shadow: var(--shadow-sm); transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.01)'" onmouseout="this.style.transform='scale(1)'"></a>`;
            } else {
                attachmentPreview.innerHTML = `<a href="${os.attachment_url}" target="_blank" class="btn btn-outline" style="display: inline-flex; align-items: center; gap: 8px;"><i class="fas fa-file-download"></i> Baixar Arquivo Anexo</a>`;
            }
        } else {
            attachmentContainer.classList.add('hidden');
        }

        document.getElementById('detailsStatus').innerHTML = getStatusBadge(os.status);
        const priorityColor = getPriorityColor(os.priority).split(':')[1];
        document.getElementById('detailsPriority').innerHTML = `<i class="fas fa-circle" style="color: ${priorityColor}; font-size: 10px;"></i> ${os.priority.toUpperCase()}`;
        document.getElementById('detailsPriority').style.color = priorityColor;
        document.getElementById('detailsRequester').innerText = os.requester_name;
        document.getElementById('detailsTecnico').innerText = os.tecnico_name || 'Aguardando Técnico';
        
        const createdAt = os.created_at.includes(' ') ? os.created_at.replace(' ', 'T') + 'Z' : os.created_at;
        document.getElementById('detailsDate').innerText = new Date(createdAt).toLocaleString('pt-BR');

        // Ações administrativas
        const adminActions = document.getElementById('adminActions');
        const commentForm = document.getElementById('commentForm');
        
        if (user.role === 'admin' || user.role === 'tecnico') {
            adminActions.classList.remove('hidden');
            const buttons = adminActions.querySelectorAll('button');
            
            const btnCancel = document.getElementById('btnCancelOS');
            if (btnCancel) btnCancel.style.display = user.role === 'admin' ? 'flex' : 'none';
            
            const btnAssign = document.getElementById('btnAssignTecnico');
            if (btnAssign) btnAssign.style.display = user.role === 'admin' ? 'flex' : 'none';

            if (os.status === 'cancelado' || os.status === 'concluido' || os.status === 'nao_resolvido') {
                buttons.forEach(btn => {
                    btn.disabled = true;
                    btn.style.opacity = '0.5';
                    btn.style.cursor = 'not-allowed';
                });
                if (commentForm) commentForm.style.display = 'none';
            } else {
                buttons.forEach(btn => {
                    btn.disabled = false;
                    btn.style.opacity = '1';
                    btn.style.cursor = 'pointer';
                });
                if (commentForm) commentForm.style.display = 'flex';
            }
        } else {
            adminActions.classList.add('hidden');
            if (os.status === 'cancelado' || os.status === 'concluido' || os.status === 'nao_resolvido') {
                if (commentForm) commentForm.style.display = 'none';
            } else {
                if (commentForm) commentForm.style.display = 'flex';
            }
        }

        // Ações de exportação
        const printActions = document.getElementById('printActions');
        if (user.role === 'admin' || user.role === 'tecnico') {
            printActions.classList.remove('hidden');
        } else {
            printActions.classList.add('hidden');
        }

        renderComments(os.comments);
        renderLogs(os.logs);
        openModal('detailsModal');
    } catch (e) { console.error(e); }
}

function renderComments(comments) {
    const list = document.getElementById('commentsList');
    list.innerHTML = '';
    if (comments.length === 0) {
        list.innerHTML = '<p style="color: var(--secondary); font-size: 13px; text-align: center; padding: 20px;">Nenhum comentário ainda.</p>';
        return;
    }
    comments.forEach(c => {
        const div = document.createElement('div');
        div.className = 'comment-box';
        div.innerHTML = `
            <div class="comment-header">
                <strong>${c.user_name}</strong>
                <span>${new Date(c.created_at).toLocaleString('pt-BR')}</span>
            </div>
            <p style="font-size: 14px;">${c.comment}</p>
        `;
        list.appendChild(div);
    });
    list.scrollTop = list.scrollHeight;
}

function renderLogs(logs) {
    const list = document.getElementById('logsList');
    list.innerHTML = '';
    logs.forEach(l => {
        const div = document.createElement('div');
        div.className = 'log-item';
        div.innerHTML = `
            <div style="display: flex; justify-content: space-between;">
                <strong>${l.action}</strong>
                <span class="log-date">${new Date(l.created_at).toLocaleString('pt-BR')}</span>
            </div>
            <div style="color: var(--secondary); margin-top: 4px;">${l.details} - por ${l.user_name}</div>
        `;
        list.appendChild(div);
    });
}

async function addComment(e) {
    e.preventDefault();
    const comment = document.getElementById('commentInput').value;
    try {
        const res = await fetch(`/api/orders/${currentOSId}/comments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ comment })
        });
        if (res.ok) {
            document.getElementById('commentInput').value = '';
            viewOS(currentOSId); // Recarregar detalhes
        }
    } catch (e) { console.error(e); }
}

async function updateOSStatus(status, solution = null, reason = null, cancellation = null) {
    let solution_description = solution;
    let failure_reason = reason;
    let cancellation_reason = cancellation;
    
    // Fechar todos os modais e limpar ID da OS IMEDIATAMENTE ao iniciar a função
    // Isso evita que qualquer evento de rede reabra o modal enquanto a requisição está em curso
    closeModal('concluirModal');
    closeModal('naoResolvidoModal');
    closeModal('cancelarModal');
    closeModal('detailsModal');
    
    // Armazenar ID para a requisição mas limpar a referência global
    const osIdToUpdate = currentOSId;
    currentOSId = null;

    try {
        const payload = { status, solution_description, failure_reason };
        if (cancellation_reason) {
            payload.cancellation_reason = cancellation_reason;
        }
        
        const res = await fetch(`/api/orders/${osIdToUpdate}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(payload)
        });
        
        if (res.ok) {
            showToast(`Status atualizado para ${status.replace('_', ' ')}`);
            
            // Resetar formulários
            if (document.getElementById('concluirForm')) document.getElementById('concluirForm').reset();
            if (document.getElementById('naoResolvidoForm')) document.getElementById('naoResolvidoForm').reset();
            if (document.getElementById('cancelarForm')) document.getElementById('cancelarForm').reset();
            
            // Redirecionar para o início do dashboard (visão geral)
            showSection('overview');
            
            // Atualizar dados globais
            loadStats();
            loadRecentOrders();
            if (!document.getElementById('ordersSection').classList.contains('hidden')) loadOrders();
        } else {
            const err = await res.json();
            showToast(err.message, 'error');
        }
    } catch (e) { console.error(e); }
}

// Gestão de Usuários
async function loadUsers() {
    try {
        const res = await fetch('/api/auth/users', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const users = await res.json();
        const tbody = document.getElementById('usersBody');
        tbody.innerHTML = '';
        users.forEach(u => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td data-label="Nome"><strong>${u.name}</strong></td>
                <td data-label="E-mail">${u.email}</td>
                <td data-label="Telefone">${u.phone || '-'}</td>
                <td data-label="Cargo"><span class="badge" style="background: var(--primary-light); color: var(--primary);">${u.role.toUpperCase()}</span></td>
                <td data-label="Ações">
                    <div style="display: flex; gap: 8px;">
                        <button class="btn btn-outline" style="padding: 6px 12px; font-size: 12px;" onclick="editUser(${JSON.stringify(u).replace(/"/g, '&quot;')})"><i class="fas fa-edit"></i></button>
                        <button class="btn btn-danger" style="padding: 6px 12px; font-size: 12px;" onclick="deleteUser(${u.id})"><i class="fas fa-trash"></i></button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) { console.error(e); }
}

async function createUser(e) {
    e.preventDefault();
    const data = {
        name: document.getElementById('regName').value,
        email: document.getElementById('regEmail').value,
        role: document.getElementById('regRole').value,
        password: document.getElementById('regPassword').value,
        phone: document.getElementById('userPhone').value
    };
    try {
        const res = await fetch('/api/auth/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(data)
        });
        if (res.ok) {
            showToast('Usuário criado com sucesso!');
            closeModal('userModal');
            document.getElementById('userForm').reset();
            loadUsers();
        } else {
            const err = await res.json();
            showToast(err.message, 'error');
        }
    } catch (e) { showToast('Erro ao criar usuário', 'error'); }
}

function editUser(u) {
    document.getElementById('editUserId').value = u.id;
    document.getElementById('editRegName').value = u.name;
    document.getElementById('editRegEmail').value = u.email;
    document.getElementById('editRegRole').value = u.role;
    document.getElementById('editUserPhone').value = u.phone || '';
    document.getElementById('editRegPassword').value = '';
    openModal('editUserModal');
}

async function updateUser(e) {
    e.preventDefault();
    const id = document.getElementById('editUserId').value;
    const data = {
        name: document.getElementById('editRegName').value,
        email: document.getElementById('editRegEmail').value,
        role: document.getElementById('editRegRole').value,
        phone: document.getElementById('editUserPhone').value
    };
    const password = document.getElementById('editRegPassword').value;
    if (password) data.password = password;

    try {
        const res = await fetch(`/api/auth/users/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(data)
        });
        if (res.ok) {
            showToast('Usuário atualizado!');
            closeModal('editUserModal');
            loadUsers();
        }
    } catch (e) { showToast('Erro ao atualizar', 'error'); }
}

function deleteUser(id) {
    document.getElementById('deleteUserIdInput').value = id;
    openModal('deleteUserModal');
}

async function confirmDeleteUser() {
    const id = document.getElementById('deleteUserIdInput').value;
    try {
        const res = await fetch(`/api/auth/users/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            showToast('Usuário excluído com sucesso');
            closeModal('deleteUserModal');
            loadUsers();
        } else {
            const err = await res.json();
            showToast(err.message, 'error');
        }
    } catch (e) { 
        showToast('Erro ao excluir usuário', 'error'); 
    }
}

async function openAssignModal() {
    try {
        const res = await fetch('/api/auth/users', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const users = await res.json();
        const tecnicos = users.filter(u => u.role === 'tecnico');
        
        const select = document.getElementById('assignTecnico');
        select.innerHTML = '<option value="">Selecione um técnico...</option>';
        tecnicos.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t.id;
            opt.textContent = t.name;
            select.appendChild(opt);
        });
        
        openModal('assignModal');
    } catch (e) {
        showToast('Erro ao carregar lista de técnicos', 'error');
    }
}

async function assignTecnico(tecnicoId) {
    if (!tecnicoId) return;
    
    const osId = currentOSId;
    try {
        const res = await fetch(`/api/orders/${osId}/assign`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ tecnico_id: tecnicoId })
        });
        
        if (res.ok) {
            const data = await res.json();
            showToast(data.message);
            closeModal('assignModal');
            showSection('overview');
            loadStats();
            loadRecentOrders();
        } else {
            const err = await res.json();
            showToast(err.message, 'error');
        }
    } catch (e) {
        showToast('Erro ao atribuir técnico', 'error');
    }
}

// Exportar para PDF (Implementação simplificada via CSV ou mensagem de aviso)
function exportToPDF() {
    showToast('A exportação de relatórios gerais será migrada para o servidor em breve.', 'info');
}

function initSocket() {
    socket = io();

    socket.on('connect', () => {
        console.log('Conectado ao servidor de tempo real');
    });

    socket.on('new_order', (order) => {
        // Se for admin/tecnico ou se a OS for do próprio usuário
        if (user.role === 'admin' || user.role === 'tecnico' || order.user_id === user.id) {
            showToast(`Novo chamado aberto: #${order.id} - ${order.title}`);
            refreshData();
        }
    });

    socket.on('order_updated', (data) => {
        // Se a OS que estamos visualizando for a que foi atualizada, recarregar detalhes
        // APENAS se o modal de detalhes estiver visível (display === 'flex')
        const detailsModal = document.getElementById('detailsModal');
        const isVisible = detailsModal && detailsModal.style.display === 'flex';
        
        if (isVisible && typeof currentOSId !== 'undefined' && currentOSId == data.orderId) {
            viewOS(currentOSId);
        }
        refreshData();
    });

    socket.on('new_comment', (comment) => {
        if (typeof currentOSId !== 'undefined' && currentOSId == comment.order_id) {
            // Se for um comentário de outro usuário, mostrar toast
            if (comment.user_id !== user.id) {
                showToast(`Novo comentário na OS #${comment.order_id}`);
                viewOS(currentOSId);
            }
        }
    });
}

function refreshData() {
    loadStats();
    loadRecentOrders();
    if (!document.getElementById('ordersSection').classList.contains('hidden')) {
        loadOrders();
    }
}

// Sobrescrever viewOS para entrar na sala da OS no socket
async function viewOS(id) {
    if (typeof currentOSId !== 'undefined' && currentOSId) {
        socket.emit('leave_order', currentOSId);
    }
    
    await viewOS_Internal(id);
    
    socket.emit('join_order', id);
}

// Renomear a função original para permitir o wrapper
// Nota: Como estamos editando o arquivo, vamos renomear a definição original.

function logout() {
    if (socket) socket.disconnect();
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'index.html';
}
