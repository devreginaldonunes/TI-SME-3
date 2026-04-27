/**
 * T.I SYSTEM SME - Módulo de Impressão e PDF
 * Layout Moderno, Sofisticado e Minimalista
 */

/**
 * Gera PDF da O.S. via Servidor (Puppeteer)
 */
async function generateOSPDF(osId) {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            showToast('Sessão expirada. Por favor, faça login novamente.', 'error');
            return;
        }

        if (typeof showToast === 'function') showToast('Preparando PDF...', 'success');

        const response = await fetch(`/api/orders/${osId}/pdf`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Erro ao gerar PDF no servidor');
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `OS_${osId}_TI_SYSTEM.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        if (typeof showToast === 'function') showToast('PDF baixado com sucesso!', 'success');
    } catch (error) {
        console.error('Erro ao baixar PDF:', error);
        if (typeof showToast === 'function') showToast('Erro ao gerar PDF profissional.', 'error');
    }
}

/**
 * Imprime a O.S. abrindo o PDF em uma nova aba
 */
async function printOS(osId) {
    try {
        const token = localStorage.getItem('token');
        if (!token) return;

        if (typeof showToast === 'function') showToast('Preparando impressão...', 'success');

        const response = await fetch(`/api/orders/${osId}/pdf`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) throw new Error('Erro ao buscar PDF');

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        
        // Abrir em nova aba para impressão
        const printWindow = window.open(url, '_blank');
        if (printWindow) {
            printWindow.onload = () => {
                printWindow.print();
            };
        } else {
            showToast('Por favor, permita pop-ups para imprimir.', 'error');
        }
    } catch (error) {
        console.error('Erro ao imprimir O.S.:', error);
        if (typeof showToast === 'function') showToast('Erro ao preparar impressão.', 'error');
    }
}
