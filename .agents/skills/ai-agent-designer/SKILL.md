---
name: ai-agent-designer
description: >-
  Projeta e implementa Orquestradores, Subagentes Especialistas e Tools determinísticas em TypeScript para automação jurídica (Controladoria, análise de decisões, contagem de prazos, geração de minutas e triagem de WhatsApp). Use esta skill ao desenhar fluxos agênticos ou integrar LLMs (Claude/Gemini/OpenAI) no backend.
---

# AI Agent Designer — Arquitetura de Orquestradores e Subagentes Jurídicos

Esta skill define o padrão de engenharia para construir a **"equipe virtual"** do advogado no backend Node.js/TypeScript.

## Princípios Fundamentais de IA Jurídica

1. **Separação Estrita entre Raciocínio (LLM) e Cálculo (Código Determinístico):**
   - **Proibido:** Nunca peça para uma LLM somar dias úteis no calendário ou adivinhar datas finais de prazo.
   - **Padrão:** O Subagente Analista extrai o **prazo legal em dias** e o **fundamento legal** (ex: `{ prazoDiasUteis: 15, tipoPrazo: "RECURSO_APELACAO", artigo: "Art. 1.003 §5º CPC" }`). Em seguida, uma **Tool determinística em TypeScript** calcula a data fatal cruzando `dataPublicacao` + dias úteis + tabela de feriados do tribunal.
2. **Orquestração por Máquina de Estados (Pipeline / DAG), não "Conversa Solta":**
   - O **Orquestrador (`ControladoriaOrchestrator`)** é código TypeScript determinístico que coordena subagentes especializados em etapas claras e auditáveis.
3. **Structured Outputs (JSON Schema Estrito):**
   - Todo Subagente de triagem, classificação ou diagnóstico deve retornar exclusivamente JSON validado por schema antes de persistir no PostgreSQL.
4. **Human-in-the-Loop (Trava de Segurança OAB):**
   - Nenhum prazo calculado por IA é dado como encerrado e nenhuma peça ou mensagem de WhatsApp é enviada/protocolada sem ação explícita de aprovação do advogado (`status_aprovacao = 'PENDENTE_REVISAO' -> 'APROVADO'`).

## Catálogo de Subagentes da Controladoria (Padrão do Produto)

| Subagente | Responsabilidade Única | Entrada | Saída Estruturada |
| :--- | :--- | :--- | :--- |
| **`TriadorPublicacaoAgent`** | Classificar o recorte do DJEN e decidir se precisa buscar o PDF no tribunal. | Texto da publicação DJEN + Classe + Órgão | `{ tipoAto, polaridadeDecisao, exigeProvidencia, precisaInteiroTeor, prazoExpressoDias }` |
| **`AnalistaProcessualAgent`** | Ler a decisão completa do juiz + última manifestação da parte contrária e definir a estratégia. | Texto da decisão + Peças recentes do processo + Contexto do cliente | `{ resumoExecutivo, pontosControvertidos, providenciaRecomendada, pecaSugerida, prazoLegalDias, urgencia }` |
| **`RedatorJuridicoAgent`** | ("Estagiário Sênior") Elaborar o esboço/minuta da peça processual seguindo os modelos do escritório. | Diagnóstico do Analista + Fatos do cliente + Template do André | `{ tituloPeca, conteudoMarkdown, documentosAnexarChecklist }` |
| **`ComunicadorClienteAgent`** | Traduzir o "juridiquês" em uma mensagem curta e empática para o WhatsApp do cliente. | Resumo Executivo + Nome do Cliente + Solicitação de documentos (se houver) | `{ mensagemWhatsapp, exigeRespostaCliente, documentosSolicitados }` |

## Rastreabilidade e Auditoria de IA no Banco
Toda execução de agente deve registrar:
- `modelo_llm` utilizado, `prompt_version`, `tokens_entrada`, `tokens_saida`, `latencia_ms` e o JSON bruto retornado, garantindo auditoria completa e controle de custo por `tenant_id`.
