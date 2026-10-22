# Modelos de relatório

Coloque arquivos `.html` e `.css` com o mesmo nome nesta pasta. O seletor do painel reconhece automaticamente cada par. O HTML usa `{{variavel}}`; o CSS é incorporado no `<style>`.

## Variáveis disponíveis

| Variável | Conteúdo |
| --- | --- |
| `{{reportTitle}}` | Título do relatório |
| `{{generatedAt}}` | Data e hora de geração |
| `{{entity}}` | Geral, Pessoal (PF) ou Empresa (PJ) |
| `{{totalIncome}}` | Soma de entradas pagas nos filtros |
| `{{totalExpenses}}` | Soma de despesas pagas nos filtros, sem duplicar pagamentos de fatura |
| `{{balance}}` | Entradas menos despesas pagas |
| `{{transactionsTable}}` | Linhas HTML das movimentações já filtradas |
| `{{styles}}` | Conteúdo do arquivo CSS pareado |

## Criar um modelo

1. Crie `nome.html` e `nome.css` nesta pasta.
2. Use as variáveis da tabela onde os valores devem aparecer.
3. Mantenha os valores dentro de elementos HTML e use o CSS para impressão e visualização.
4. Reinicie o servidor de desenvolvimento se o novo modelo não aparecer no seletor.
5. Selecione o modelo no painel e use **Visualizar modelo** para conferir antes de imprimir ou salvar como PDF.

Não inclua scripts ou dados pessoais estáticos nos modelos. Os valores são escapados antes da inserção; apenas `transactionsTable` contém linhas geradas pelo sistema.
