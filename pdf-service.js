const PDFDocument = require('pdfkit');
const path = require('path');

/**
 * Serviço de Geração de PDF Profissional usando PDFKit
 * Oferece maior estabilidade e performance sem depender de navegadores externos.
 */
class PDFService {
    async generateOSPDF(osData) {
        return new Promise((resolve, reject) => {
            try {
                const doc = new PDFDocument({
                    size: 'A4',
                    margin: 40,
                    info: {
                        Title: `OS #${osData.id} - ${osData.title}`,
                        Author: 'TI SYSTEM SME',
                    }
                });

                let buffers = [];
                doc.on('data', buffers.push.bind(buffers));
                doc.on('end', () => {
                    const pdfBuffer = Buffer.concat(buffers);
                    resolve(pdfBuffer);
                });

                // Mapeamentos
                const statusMap = {
                    'pendente': { label: 'PENDENTE', color: '#f59e0b' },
                    'em_atendimento': { label: 'EM ATENDIMENTO', color: '#2563eb' },
                    'concluido': { label: 'CONCLUÍDO', color: '#059669' },
                    'nao_resolvido': { label: 'NÃO RESOLVIDO', color: '#d97706' },
                    'cancelado': { label: 'CANCELADO', color: '#dc2626' }
                };

                const priorityMap = { 'baixa': 'Baixa', 'media': 'Média', 'alta': 'Alta', 'urgente': 'Urgente' };
                const categoryMap = {
                    'suporte': 'Suporte Técnico',
                    'rede': 'Redes / Internet',
                    'hardware': 'Hardware / Peças',
                    'software': 'Software / Sistemas',
                    'impressora': 'Impressoras',
                    'outros': 'Outros'
                };

                const status = statusMap[osData.status] || { label: osData.status.toUpperCase(), color: '#64748b' };
                const dateStr = new Date(osData.created_at).toLocaleDateString('pt-BR');
                const timeStr = new Date(osData.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

                // --- CABEÇALHO ---
                doc.fillColor('#0f172a').fontSize(24).font('Helvetica-Bold').text('T.I ', { continued: true }).fillColor('#2563eb').text('SYSTEM');
                doc.fillColor('#64748b').fontSize(10).font('Helvetica-Bold').text('SME • PARACURU • CEARÁ', { characterSpacing: 1 });
                
                // Número da OS (Alinhado à direita)
                doc.fillColor('#94a3b8').fontSize(10).text('ORDEM DE SERVIÇO', 400, 40, { align: 'right' });
                doc.fillColor('#0f172a').fontSize(32).font('Helvetica-Bold').text(`#${osData.id}`, 400, 55, { align: 'right' });
                
                doc.moveDown(2);
                const currentY = doc.y;
                doc.moveTo(40, currentY).lineTo(555, currentY).strokeColor('#f1f5f9').stroke();
                doc.moveDown(1.5);

                // --- GRID DE INFORMAÇÕES RÁPIDAS ---
                const gridY = doc.y;
                
                // Status
                doc.fillColor('#94a3b8').fontSize(8).font('Helvetica-Bold').text('STATUS', 40, gridY);
                doc.fillColor(status.color).fontSize(12).text(status.label, 40, gridY + 12);

                // Prioridade
                doc.fillColor('#94a3b8').fontSize(8).text('PRIORIDADE', 180, gridY);
                doc.fillColor('#1e293b').fontSize(12).text(priorityMap[osData.priority] || osData.priority, 180, gridY + 12);

                // Data
                doc.fillColor('#94a3b8').fontSize(8).text('DATA ABERTURA', 320, gridY);
                doc.fillColor('#1e293b').fontSize(12).text(dateStr, 320, gridY + 12);

                // Hora
                doc.fillColor('#94a3b8').fontSize(8).text('HORA', 460, gridY);
                doc.fillColor('#1e293b').fontSize(12).text(timeStr, 460, gridY + 12);

                doc.moveDown(3);

                // --- INFORMAÇÕES GERAIS ---
                this._drawSectionTitle(doc, 'INFORMAÇÕES GERAIS');
                
                this._drawDataRow(doc, 'Título', osData.title);
                this._drawDataRow(doc, 'Localização', osData.location);
                this._drawDataRow(doc, 'Categoria', categoryMap[osData.category] || osData.category || 'Suporte Geral');
                this._drawDataRow(doc, 'Solicitante', osData.requester_name || 'Não informado');

                doc.moveDown(1);

                // --- DESCRIÇÃO ---
                this._drawSectionTitle(doc, 'DESCRIÇÃO DO PROBLEMA');
                doc.fillColor('#334155').fontSize(11).font('Helvetica').text(osData.description, { align: 'justify', lineGap: 2 });
                doc.moveDown(1.5);

                // --- SOLUÇÃO OU FALHA ---
                if (osData.status === 'concluido' && osData.solution_description) {
                    this._drawSectionTitle(doc, 'SOLUÇÃO TÉCNICA');
                    doc.fillColor('#166534').fontSize(11).text(osData.solution_description, { align: 'justify', lineGap: 2 });
                    doc.moveDown(1.5);
                } else if (osData.status === 'nao_resolvido' && osData.failure_reason) {
                    this._drawSectionTitle(doc, 'MOTIVO DA NÃO RESOLUÇÃO');
                    doc.fillColor('#92400e').fontSize(11).text(osData.failure_reason, { align: 'justify', lineGap: 2 });
                    doc.moveDown(1.5);
                }

                // --- DADOS DE EXECUÇÃO ---
                this._drawSectionTitle(doc, 'DADOS DE EXECUÇÃO');
                this._drawDataRow(doc, 'Técnico Responsável', osData.tecnico_name || 'Aguardando atribuição');
                const completionDate = osData.updated_at && (osData.status === 'concluido' || osData.status === 'nao_resolvido') 
                    ? new Date(osData.updated_at).toLocaleDateString('pt-BR') 
                    : '___/___/_____';
                this._drawDataRow(doc, 'Data de Conclusão', completionDate);

                // --- ASSINATURAS ---
                const sigY = 650;
                doc.moveTo(40, sigY).lineTo(250, sigY).strokeColor('#cbd5e1').stroke();
                doc.moveTo(345, sigY).lineTo(555, sigY).strokeColor('#cbd5e1').stroke();

                doc.fillColor('#0f172a').fontSize(10).font('Helvetica-Bold').text(osData.tecnico_name || 'Responsável Técnico', 40, sigY + 5, { width: 210, align: 'center' });
                doc.fillColor('#64748b').fontSize(8).font('Helvetica').text('Assinatura do Técnico', 40, sigY + 18, { width: 210, align: 'center' });

                doc.fillColor('#0f172a').fontSize(10).font('Helvetica-Bold').text(osData.requester_name || 'Responsável Local', 345, sigY + 5, { width: 210, align: 'center' });
                doc.fillColor('#64748b').fontSize(8).font('Helvetica').text('Assinatura do Solicitante', 345, sigY + 18, { width: 210, align: 'center' });

                // --- RODAPÉ ---
                doc.fontSize(8).fillColor('#94a3b8').text(`Documento gerado eletronicamente pelo T.I SYSTEM SME em ${new Date().toLocaleString('pt-BR')}`, 40, 780, { align: 'center' });
                doc.font('Helvetica-Bold').text('PREFEITURA MUNICIPAL DE PARACURU - SECRETARIA DE EDUCAÇÃO', 40, 792, { align: 'center' });

                doc.end();
            } catch (err) {
                reject(err);
            }
        });
    }

    _drawSectionTitle(doc, title) {
        const y = doc.y;
        doc.fillColor('#0f172a').fontSize(9).font('Helvetica-Bold').text(title, 40, y);
        doc.moveTo(doc.x + doc.widthOfString(title) + 10, y + 5).lineTo(555, y + 5).strokeColor('#f1f5f9').stroke();
        doc.moveDown(1);
    }

    _drawDataRow(doc, label, value) {
        const y = doc.y;
        doc.fillColor('#64748b').fontSize(10).font('Helvetica').text(label, 40, y);
        doc.fillColor('#1e293b').fontSize(10).font('Helvetica-Bold').text(value || '---', 180, y);
        doc.moveDown(0.5);
    }
}

module.exports = new PDFService();
