# Correção do Serviço de PDF - TI SYSTEM SME

## Problema Identificado
O erro `500` ao gerar o PDF ocorria devido à dependência do `puppeteer-core` que tentava localizar um executável do Chromium no caminho `/usr/bin/chromium-browser`, o qual não estava disponível ou configurado corretamente no ambiente de execução. Além disso, o Puppeteer é uma biblioteca pesada para simples geração de documentos.

## Solução Aplicada
1. **Substituição da Biblioteca**: Trocamos o `puppeteer-core` pelo **PDFKit**.
   - **Vantagem**: O PDFKit é uma biblioteca nativa do Node.js para geração de PDFs, extremamente leve, rápida e não depende de navegadores externos (Chromium).
   - **Estabilidade**: Elimina erros de "browser not found" e problemas de memória comuns com Puppeteer.
2. **Layout Preservado**: O layout moderno e profissional foi recriado programaticamente no PDFKit, mantendo a identidade visual do sistema (cores, fontes e estrutura).
3. **Consistência**: A mesma lógica de geração atende tanto ao botão de **Baixar PDF** quanto ao de **Imprimir**, garantindo que o documento seja idêntico em ambas as ações.

## Como instalar as novas dependências
Caso for rodar em um novo ambiente, certifique-se de executar:
```bash
npm install pdfkit
```

O arquivo `pdf-service.js` agora está pronto para uso e não requer configurações de sistema adicionais.
