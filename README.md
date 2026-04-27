# Sistema de Ordens de Serviço - TI SEDUC

Sistema desenvolvido para a Secretaria de Educação (SEDUC) para gerenciamento de ordens de serviço de T.I.

## Tecnologias
- **Backend:** Node.js, Express, SQLite
- **Frontend:** HTML5, CSS3, JavaScript (Vanilla)
- **Autenticação:** JWT (JSON Web Token)

## Funcionalidades
- Login seguro
- Dashboards específicos por cargo (Admin, Técnico, Escola, Secretaria)
- Gestão de Usuários (CRUD - apenas Admin)
- Abertura e acompanhamento de Ordens de Serviço
- Atualização de status (apenas Técnicos e Admin)

## Deploy no Railway
1. Conecte seu repositório GitHub ao Railway.
2. Crie um novo projeto e selecione o repositório.
3. Adicione as variáveis de ambiente:
   - `JWT_SECRET`: Uma chave aleatória segura.
   - `PORT`: 3000 (ou deixe o Railway definir).
4. O Railway detectará o `Procfile` e o `package.json` e iniciará o deploy automaticamente.
5. **Importante:** O SQLite cria um arquivo local. Para persistência permanente no Railway, você deve montar um volume para o arquivo `database.sqlite` ou migrar para um banco gerenciado como PostgreSQL.
