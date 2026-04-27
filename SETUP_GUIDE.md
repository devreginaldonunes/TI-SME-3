# Guia de Instalação e Configuração - T.I SYSTEM SME (v2.0)

## 🚀 Início Rápido

### Pré-requisitos

- Node.js 16+ (recomendado 18+)
- npm ou pnpm
- Chromium/Chrome instalado no sistema
- SQLite3

### 1. Instalação das Dependências

```bash
# Clone ou extraia o projeto
cd ti-system-sme

# Instale as dependências
npm install

# Ou com pnpm
pnpm install
```

### 2. Configuração do Ambiente

Crie um arquivo `.env` na raiz do projeto:

```env
# Servidor
PORT=3000
NODE_ENV=development

# JWT
JWT_SECRET=sua_chave_secreta_muito_segura_aqui

# Banco de Dados (opcional - usa SQLite por padrão)
DB_PATH=./database.sqlite

# Chromium (opcional - detecta automaticamente)
CHROMIUM_PATH=/usr/bin/chromium-browser
```

### 3. Inicializar Banco de Dados

O banco de dados é inicializado automaticamente na primeira execução. Se precisar resetar:

```bash
rm database.sqlite
npm start
```

### 4. Iniciar o Servidor

```bash
# Desenvolvimento
npm start

# Ou com nodemon (recomendado)
npm install -D nodemon
npx nodemon server.js
```

O servidor estará disponível em: `http://localhost:3000`

---

## 🔧 Configuração Avançada

### Chromium em Ambientes Docker

Se estiver usando Docker, instale o Chromium:

```dockerfile
FROM node:18-alpine

# Instalar Chromium e dependências
RUN apk add --no-cache \
    chromium \
    noto-sans \
    font-noto-emoji

ENV CHROMIUM_PATH=/usr/bin/chromium-browser

WORKDIR /app
COPY . .
RUN npm install
EXPOSE 3000
CMD ["npm", "start"]
```

### Chromium em Linux (Ubuntu/Debian)

```bash
sudo apt-get update
sudo apt-get install -y chromium-browser
```

### Chromium em macOS

```bash
brew install chromium
```

### Chromium em Windows

Baixe do site oficial: https://www.chromium.org/getting-involved/download-chromium

---

## 📊 Estrutura do Banco de Dados

### Tabelas Principais

**users**
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT DEFAULT 'user',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**service_orders**
```sql
CREATE TABLE service_orders (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT DEFAULT 'pendente',
  priority TEXT DEFAULT 'media',
  location TEXT NOT NULL,
  category TEXT DEFAULT 'suporte',
  user_id INTEGER NOT NULL,
  tecnico_id INTEGER,
  attachment_url TEXT,
  solution_description TEXT,
  failure_reason TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (tecnico_id) REFERENCES users(id)
);
```

**comments**
```sql
CREATE TABLE comments (
  id INTEGER PRIMARY KEY,
  order_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  comment TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES service_orders(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

**os_logs**
```sql
CREATE TABLE os_logs (
  id INTEGER PRIMARY KEY,
  order_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  details TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES service_orders(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

---

## 👥 Usuários Padrão

Na primeira execução, os seguintes usuários são criados:

| Email | Senha | Papel |
|-------|-------|-------|
| admin@example.com | admin123 | admin |
| tecnico@example.com | tecnico123 | tecnico |
| usuario@example.com | usuario123 | user |

⚠️ **IMPORTANTE**: Altere essas senhas em produção!

---

## 🔐 Segurança em Produção

### 1. Variáveis de Ambiente

```env
# Altere a chave JWT
JWT_SECRET=gere_uma_chave_aleatoria_segura_muito_longa

# Use HTTPS
NODE_ENV=production

# Desabilite logs detalhados
LOG_LEVEL=error
```

### 2. HTTPS

Configure um proxy reverso (nginx, Apache) ou use um serviço como Heroku, Railway, etc.

### 3. Rate Limiting

Adicione rate limiting para proteger contra ataques:

```bash
npm install express-rate-limit
```

### 4. CORS

Configure CORS adequadamente em `server.js`:

```javascript
app.use(cors({
  origin: ['https://seu-dominio.com'],
  credentials: true
}));
```

### 5. Validação de Entrada

Sempre valide e sanitize dados de entrada.

---

## 📈 Escalabilidade

### Para Múltiplas Instâncias

1. **Use um banco de dados compartilhado** (PostgreSQL, MySQL)
2. **Configure sessões compartilhadas** (Redis)
3. **Use um load balancer** (nginx, HAProxy)

### Exemplo com PM2

```bash
npm install -g pm2

# Criar arquivo ecosystem.config.js
pm2 start ecosystem.config.js

# Monitorar
pm2 monit
```

**ecosystem.config.js:**
```javascript
module.exports = {
  apps: [{
    name: 'ti-system-sme',
    script: './server.js',
    instances: 4,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production'
    }
  }]
};
```

---

## 🧪 Testes

### Testar Autenticação

```bash
# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}'

# Resposta esperada
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": 1,
    "name": "Admin",
    "email": "admin@example.com",
    "role": "admin"
  }
}
```

### Testar Geração de PDF

```bash
# 1. Obter token
TOKEN="seu_token_aqui"

# 2. Criar uma O.S.
curl -X POST http://localhost:3000/api/orders \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Teste PDF",
    "description": "Descrição de teste",
    "priority": "alta",
    "location": "Sala 101",
    "category": "suporte"
  }'

# 3. Gerar PDF (substitua ID)
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/orders/1/pdf \
  -o teste.pdf

# 4. Verificar
file teste.pdf
```

---

## 🐛 Troubleshooting

### Problema: "Port 3000 already in use"

```bash
# Encontrar processo usando a porta
lsof -i :3000

# Matar processo
kill -9 <PID>

# Ou usar outra porta
PORT=3001 npm start
```

### Problema: "Cannot find Chromium"

```bash
# Instalar Chromium
sudo apt-get install chromium-browser

# Ou definir caminho no .env
CHROMIUM_PATH=/usr/bin/chromium-browser
```

### Problema: "JWT malformed"

- Verifique se o token está sendo enviado corretamente
- Verifique se a chave JWT é a mesma em todas as instâncias

### Problema: "PDF vazio"

- Verifique se a O.S. existe no banco
- Verifique os logs do servidor
- Teste com uma O.S. simples primeiro

---

## 📚 Documentação Adicional

- [PDF_IMPLEMENTATION.md](./PDF_IMPLEMENTATION.md) - Detalhes técnicos da implementação
- [README.md](./README.md) - Informações gerais do projeto
- [UPLOAD_FEATURE.md](./UPLOAD_FEATURE.md) - Documentação de upload de arquivos

---

## 🆘 Suporte

Para reportar problemas ou sugestões:

1. Verifique os logs: `npm start` (modo desenvolvimento)
2. Consulte a documentação
3. Abra uma issue no repositório

---

## 📝 Changelog

### v2.0.0 (14 de Abril de 2026)

- ✨ Implementação de PDF profissional com Puppeteer
- 🎨 Novo layout moderno e sofisticado
- 🚀 Novo endpoint `/api/orders/:id/pdf`
- 📉 Redução de dependências frontend (~80KB)
- 🔒 Melhor segurança com processamento no servidor

### v1.0.0

- Versão inicial do sistema

---

**Última atualização**: 14 de Abril de 2026
