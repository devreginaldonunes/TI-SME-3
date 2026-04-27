# Guia de Deploy no Railway - T.I SYSTEM SME

Este projeto foi configurado para rodar no Railway com persistência de dados e backup automático.

## 1. Configuração do Volume (Essencial)

Como o SQLite utiliza arquivos locais, você **precisa** configurar um Volume no Railway para que os dados não sejam perdidos ao reiniciar o servidor.

1. No painel do seu projeto no Railway, clique em **"Add Service"** -> **"Volume"**.
2. Nomeie o volume (ex: `system-data`).
3. Nas configurações do serviço da aplicação, vá em **"Settings"** -> **"Volumes"** -> **"Mount Volume"**.
4. Configure o **Mount Path** para: `/data`

## 2. Variáveis de Ambiente

Configure as seguintes variáveis em **"Variables"**:

| Variável | Valor Padrão | Descrição |
|----------|--------------|-----------|
| `PORT` | `3000` | Porta da aplicação |
| `DB_PATH` | `/data/database.sqlite` | Caminho do banco no volume |
| `BACKUP_PATH` | `/data/backups` | Onde os backups serão salvos |
| `BACKUP_SCHEDULE` | `0 0 * * *` | Cron do backup (Padrão: Meia-noite) |
| `JWT_SECRET` | `sua_chave_secreta` | Chave para tokens JWT |

## 3. Como funciona o Backup

O sistema realiza um backup automático:
1. Sempre que o servidor inicia.
2. Periodicamente conforme o `BACKUP_SCHEDULE`.
3. Mantém apenas os backups dos últimos 7 dias para economizar espaço.

Os arquivos ficam em `/data/backups`. Você pode acessá-los via CLI do Railway ou montando o volume localmente para download.

## 4. Deploy

Basta conectar seu repositório GitHub ao Railway. O `Dockerfile` incluído cuidará de toda a instalação e configuração.
