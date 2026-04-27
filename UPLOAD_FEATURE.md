# Funcionalidade de Upload de Fotos - TI SYSTEM SME

## Descrição
Implementação de upload real de fotos com pré-visualização ao criar um novo chamado no sistema.

## Alterações Realizadas

### 1. Frontend (dashboard.html)
- **Campo de Upload**: Substituído o campo de URL por um input de arquivo com suporte a drag-and-drop
- **Pré-visualização**: Adicionada área de pré-visualização da imagem selecionada
- **Botão de Remover**: Botão para limpar a seleção e a pré-visualização

### 2. Frontend (dashboard.js)
- **Listener de Imagem**: Implementado FileReader para exibir preview em tempo real
- **Função createOS**: Atualizada para enviar FormData com o arquivo
- **Função removeSelectedImage**: Nova função para limpar a seleção
- **Visualização de Anexos**: Melhorada exibição de imagens nos detalhes do chamado

### 3. Backend (orders.js)
- **Multer Integration**: Adicionado middleware multer para gerenciar uploads
- **Validação**: Limite de 5MB e validação de tipos (jpeg, jpg, png, gif)
- **Armazenamento**: Arquivos salvos em `/public/uploads/` com nomes únicos
- **Endpoint POST**: Atualizado para processar FormData e salvar URL do arquivo

### 4. Estilos (style.css)
- **Zona de Upload**: Estilos para drag-and-drop com hover effects
- **Pré-visualização**: Estilos responsivos para a imagem de preview
- **Botão de Remover**: Ícone flutuante para remover a seleção

## Como Usar

1. **Abrir um Novo Chamado**
   - Clique em "Novo" na seção de Chamados
   - Preencha os campos obrigatórios (Título, Localização, Descrição)

2. **Adicionar Foto**
   - Clique na zona de upload ou arraste uma imagem
   - A pré-visualização aparecerá automaticamente
   - Para remover: clique no ícone "X" no canto da imagem

3. **Enviar Chamado**
   - Clique em "Abrir Chamado"
   - A foto será enviada junto com os dados do chamado

4. **Visualizar Anexos**
   - Ao abrir os detalhes do chamado, a foto será exibida
   - Clique na imagem para abrir em tamanho real

## Especificações Técnicas

- **Tipos Aceitos**: JPEG, JPG, PNG, GIF
- **Tamanho Máximo**: 5MB
- **Pasta de Armazenamento**: `/public/uploads/`
- **Nomes de Arquivo**: Únicos com timestamp + random ID
- **Acesso**: URLs públicas via `/uploads/{filename}`

## Dependências Adicionadas

```json
{
  "multer": "^2.1.1"
}
```

## Instalação

Para instalar as dependências:
```bash
pnpm install
```

## Iniciar o Servidor

```bash
pnpm start
```

O servidor estará disponível em `http://localhost:3000`

## Notas Importantes

- Certifique-se de que a pasta `/public/uploads/` tem permissões de escrita
- As imagens são armazenadas permanentemente no servidor
- Para produção, considere implementar limpeza periódica de arquivos antigos
- Adicione validação adicional de segurança conforme necessário

