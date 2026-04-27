const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const { dbPath } = require('./database');

/**
 * Serviço de Backup para SQLite
 * Realiza cópias periódicas do arquivo do banco de dados.
 */

const BACKUP_DIR = process.env.BACKUP_PATH || path.join(path.dirname(dbPath), 'backups');

// Garantir que o diretório de backup existe
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

function performBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(BACKUP_DIR, `database-backup-${timestamp}.sqlite`);

  console.log(`[Backup] Iniciando backup em: ${backupFile}`);

  try {
    // Para SQLite, uma cópia simples do arquivo funciona se não houver escritas pesadas no momento.
    // O modo WAL ajuda na consistência durante a cópia.
    fs.copyFileSync(dbPath, backupFile);
    
    // Opcional: Limpar backups antigos (manter apenas os últimos 7 dias)
    cleanOldBackups();
    
    console.log(`[Backup] Backup concluído com sucesso!`);
  } catch (err) {
    console.error(`[Backup] Erro ao realizar backup:`, err);
  }
}

function cleanOldBackups() {
  const MAX_AGE_DAYS = 7;
  const now = Date.now();

  fs.readdirSync(BACKUP_DIR).forEach(file => {
    const filePath = path.join(BACKUP_DIR, file);
    const stats = fs.statSync(filePath);
    const ageInDays = (now - stats.mtimeMs) / (1000 * 60 * 60 * 24);

    if (ageInDays > MAX_AGE_DAYS) {
      fs.unlinkSync(filePath);
      console.log(`[Backup] Backup antigo removido: ${file}`);
    }
  });
}

// Agendar backup (Padrão: Todos os dias à meia-noite)
// Formato: minuto hora dia-do-mes mes dia-da-semana
const schedule = process.env.BACKUP_SCHEDULE || '0 0 * * *';

function startBackupService() {
  console.log(`[Backup] Serviço de backup iniciado. Agendamento: ${schedule}`);
  
  // Realiza um backup inicial ao subir o servidor
  performBackup();

  cron.schedule(schedule, () => {
    performBackup();
  });
}

module.exports = { startBackupService, performBackup };
