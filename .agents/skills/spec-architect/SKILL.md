---
name: spec-architect
description: >-
  Transforma ideias brutas, transcrições de voz do Gustavo ou documentos de brainstorming do advogado (André) em Especificações Técnicas Executáveis (Specs) usando Deep Thinking. Use esta skill quando o usuário enviar documentos de ideias, pedir para mapear requisitos do escritório de advocacia, estruturar módulos do SaaS (Controladoria, Operacional WhatsApp, Autos/Tribunais, Multi-tenant) ou planejar uma nova funcionalidade antes de codificar.
---

# Spec Architect — Engenharia de Produto e Arquitetura Agêntica

Esta skill transforma visões de negócio e dores jurídicas desestruturadas em **Especificações Técnicas Executáveis (`SPEC.md`)** que alimentam diretamente os agentes codificadores (`fullstack-builder` e `ai-agent-designer`).

## Quando Ativar
- Recebimento do documento Markdown de ideias do André.
- Áudios de brainstorming do Gustavo sobre novas automações ou módulos.
- Solicitações de análise profunda (*Deep Thinking*) sobre viabilidade técnica, modelo SaaS ou arquitetura.

## Processo de Análise (Deep Thinking em 4 Etapas)

### 1. Decodificação e Classificação de Domínio
Ao receber ideias soltas do advogado, classifique cada item em um dos **4 Motores do SaaS**:
1. **Core / SaaS (`core`):** Multi-tenancy (`escritorios`, `usuarios`), autenticação, cofre de credenciais/certificados A1.
2. **Controladoria & DJEN (`controladoria`):** Captura de publicações, leitura de decisões, contagem determinística de prazos (dias úteis + feriados), criação de tarefas/providências no Kanban.
3. **Autos & Conectores de Tribunais (`tribunais`):** Acesso autenticado (Projudi-PR, e-Proc, PJe via MNI/Playwright), download de inteiro teor e sincronização com pastas locais do cliente.
4. **Operacional & Atendimento (`operacional`):** Webhook WhatsApp, transcrição de áudios de clientes, OCR e checklist de documentos (`RG`, `CPF`, `Procuração`), notificações aprovadas pelo advogado.

### 2. Desenho do Fluxo Autônomo (Foco no Advogado Solo)
Como o André trabalha sozinho, toda funcionalidade deve responder:
- **Gatilho (Trigger):** O que inicia o fluxo sem ação humana? (Ex: `DjenSyncWorker` detectou intimação ou `WhatsAppWebhook` recebeu áudio/PDF).
- **Trabalho dos Agentes (Background):** O que o Orquestrador e os Subagentes preparam sozinhos?
- **Ponto de Decisão Humana (Human-in-the-Loop):** Qual é a ação de 1 clique que o André faz na tela? (Ex: *Confirmar Prazo*, *Aprovar Minuta*, *Disparar WhatsApp*).

### 3. Estrutura do Documento de Spec (`docs/specs/<numero>-<slug>.md`)
Gere especificações enxutas e diretamente acionáveis pelos agentes de código contendo:
1. **Objetivo & Dor Resolvida** (3 linhas).
2. **Impacto no Modelo de Dados (PostgreSQL):** Tabelas/colunas novas e isolamento por `escritorio_id` (`tenant_id`).
3. **Design do Orquestrador / Agentes (se aplicável):** Quais Subagentes, *Tools* e JSON Schemas serão usados.
4. **Contratos de API (Backend Express):** Rotas, payloads e respostas.
5. **Impacto na UI (Frontend React):** Telas/componentes em `D:\Projetos\consultas-andre`.
6. **Plano de Implementação Verificável:** Passos atômicos para o `fullstack-builder`.

## Regra de Ouro de Priorização
Priorize sempre **Impacto Real na Rotina do André vs. Complexidade de Infraestrutura**:
- **Nível 1 (Determinístico + Rápido):** SQL, Regras de Prazo, Filtros, Status, Autenticação.
- **Nível 2 (IA Assistiva / Estruturada):** Triagem JSON de intimações, transcrição de áudio, resumo executivo, geração de minuta baseada em template.
- **Nível 3 (Automação Externa Sensível):** Crawlers autenticados em tribunais (Projudi/e-Proc) e disparo ativo no WhatsApp.
