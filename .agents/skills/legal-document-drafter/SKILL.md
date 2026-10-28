---
name: legal-document-drafter
description: >-
  Geração e montagem automatizada de documentos jurídicos (Procuração Ad Judicia, Contrato de Honorários, Declaração de Hipossuficiência e minuta de Petição Inicial). Lê o dossiê da pasta do cliente (fatos dos áudios transcritos + dados de CNH/documentos extraídos por OCR), aplica os templates do escritório e gera arquivos preenchidos (.docx/.pdf) com rastreabilidade probatória e supervisão humana obrigatória.
---

# Legal Document Drafter — Automação de Peças e Instrumentos Jurídicos

Esta skill transforma os dados coletados na Triagem de WhatsApp em **documentos contratuais e processuais prontos para revisão e assinatura**.

---

## 1. Princípios de Engenharia Jurídica (Anti-Alucinação & Human-in-the-Loop)

1. **Fidelidade Estrita aos Fatos (Zero Alucinação Fática):** A qualificação civil (nome, CPF, RG, estado civil, endereço) e o relato dos fatos devem se basear **exclusivamente** nas informações transcritas dos áudios e comprovantes documentais da pasta do cliente (`storage/clientes/{clienteId}/`). É vedado inventar ou presumir dados não informados pelo titular.
2. **Supervisão Humana Obrigatória (Art. 34 do EAOAB):** Nenhum documento gerado é assinado ou distribuído automaticamente. Todas as peças são salvas com o status de `MINUTA_RASCUNHO` para revisão e validação do advogado responsável.
3. **Indexação e Tabela de Documentos Anexos:** Ao gerar a Petição Inicial, o agente deve catalogar e referenciar diretamente os nomes e hashes `SHA-256` dos documentos existentes na pasta física do cliente (Doc. 01 - CNH, Doc. 02 - Comprovante de Residência, Doc. 03 - Contrato do Empréstimo).

---

## 2. Estrutura dos Templates do Escritório

Os modelos devem suportar placeholders padronizados:

```text
QUALIFICAÇÃO:
{{CLIENTE_NOME}}, {{CLIENTE_ESTADO_CIVIL}}, portador do RG nº {{CLIENTE_RG}} e inscrito no CPF sob nº {{CLIENTE_CPF}}, residente e domiciliado em {{CLIENTE_ENDERECO}}, telefone WhatsApp {{CLIENTE_TELEFONE}}.

DOS FATOS:
{{FATOS_CONSOLIDADOS_TRIAGEM}}

DOCUMENTOS JUNTADOS:
{{TABELA_DOCUMENTOS_ANEXOS}}
```

---

## 3. Fluxo de Execução
1. Ler o dossiê consolidado via `obterDossieCliente(clienteId)`.
2. Verificar se o checklist atingiu o nível mínimo para a peça solicitada (para Procuração: RG/CNH + Comprovante; para Inicial: Provas da causa).
3. Aplicar os dados extraídos no template correspondente à área jurídica (`RCV_BANCARIO`, `ECOMMERCE_ML`, etc.).
4. Gravar a minuta gerada na pasta física do cliente (`storage/clientes/{clienteId}/MINUTA_...docx`).
