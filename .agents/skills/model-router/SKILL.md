---
name: model-router
description: >-
  Roteador Estratégico de Modelos e Economia de Tokens. Seleciona o modelo ideal (Flash-Lite, Flash ou Pro/Argon) com base na complexidade da tarefa e orquestra subagentes econômicos para preservar créditos do usuário. Use esta skill para avaliar qual modelo usar em cada etapa do desenvolvimento, para delegar tarefas operacionais a subagentes leves ou para otimizar consumo de IA tanto no ambiente de dev quanto no backend do SaaS.
---

# Model Router — Roteamento Inteligente & Economia de Créditos

Esta skill estabelece a governança de consumo de IA no workspace, garantindo que tarefas simples, leituras de código e refatorações pontuais **não consumam créditos de modelos caros (Argon/Pro)** desnecessariamente.

---

## 1. Matriz de Decisão de Modelos (Tiered Routing)

| Nível | Modelo Ideal | Características | Casos de Uso Indicados | O que NUNCA fazer neste modelo |
| :--- | :--- | :--- | :--- | :--- |
| **Tier 1: Operacional & Busca** | `flash_lite` | Custo praticamente zero (~95% mais barato que Pro), ultra-rápido (<500ms). | • Leitura e busca de arquivos no repositório.<br>• Formatação de JSON / DTO.<br>• Extração simples de dados.<br>• Transcrição de áudios curtos de WhatsApp. | Não usar para arquitetar sistemas complexos ou resolver bugs obscuros de concorrência. |
| **Tier 2: Construção Contínua** | `flash` | Equilíbrio perfeito entre inteligência, código limpo e baixo consumo. | • Criação de telas React/Tailwind.<br>• Endpoints Express e repositórios SQL.<br>• Testes unitários e mocks.<br>• Execução padrão do pair programming. | Não queimar em loops repetitivos de leitura de logs extensos. |
| **Tier 3: Arquitetura & Deep Thinking** | `pro` / `argon` | Raciocínio profundo, cadeias longas de inferência, alto custo de tokens. | • Desenho da arquitetura multi-tenant.<br>• Modelagem criptográfica e segurança Zero-Trust.<br>• Resolução de gargalos críticos de concorrência.<br>• Refatoração estrutural de múltiplos módulos. | **NUNCA usar para:**<br>• Digitar HTML/CSS básico.<br>• Rodar comandos de build (`npm test`).<br>• Dúvidas simples ou perguntas e respostas triviais. |

---

## 2. Padrão de Delegação Agêntica no Workspace

Quando o usuário estiver operando com um modelo principal mais pesado ou desejar economizar tokens:

1. **Tarefas de Pesquisa e Varredura Extensa:**
   - Invoque o subagente `research` ou `self` configurando explicitamente `Model: 'flash_lite'`:
     ```typescript
     invoke_subagent({
       TypeName: 'research',
       Role: 'Codebase Scanner',
       Model: 'flash_lite',
       Prompt: 'Localize todas as ocorrências de `escritorio_id` nos controllers e retorne apenas a lista de arquivos e linhas.'
     })
     ```
2. **Implementação de Telas e Endpoints Derivados:**
   - Invoque o subagente com `Model: 'flash'`.
3. **Reserva do Modelo Principal:**
   - O modelo principal atua como o **Maestro**, analisando a síntese executiva e tomando decisões estratégicas.

---

## 3. Diretriz para o Backend do SaaS (`DJEN`)

Ao projetar integrações de IA em produção no backend Node.js:
- **Áudios de WhatsApp e OCR de CNH:** Utilize estritamente `models/gemini-2.5-flash-lite` ou `models/gemini-3.8-flash` via `GEMINI_API_KEY`. O custo médio mensal para o escritório piloto será inferior a R$ 10,00.
- **Minuta de Petições Complexas:** Reserve o modelo com maior capacidade de contexto e raciocínio jurídico somente no momento do clique final de geração da peça.
