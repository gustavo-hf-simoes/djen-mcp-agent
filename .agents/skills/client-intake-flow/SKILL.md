---
name: client-intake-flow
description: >-
  Orquestração do ciclo de vida do cliente pós-triagem. Gerencia cobrança assistida de documentos pendentes via WhatsApp oficial da Meta, disparo de links de assinatura digital (ZapSign / Clicksign / Gov.br), auto-link de clientes aos processos judiciais do DJEN por cruzamento de partes/CPF e atualização contínua de status na controladoria.
---

# Client Intake & Lifecycle Flow — Fechamento e Conexão Processual

Esta skill governa o fluxo de conversão do lead em cliente contratado e conecta a pasta operacional do WhatsApp com a Controladoria do DJEN.

---

## 1. Cobrança Ativa e Assistida de Pendências (WhatsApp Follow-up)

1. **Gatilho Humano (Human-in-the-Loop):** O envio de mensagens ativas pelo WhatsApp NUNCA é 100% automático para evitar spam ou captação indevida (Provimento 205/2021 OAB). O sistema gera uma sugestão de mensagem cordial com base nos itens faltantes do checklist para o advogado aprovar com 1 clique.
2. **Template de Mensagem de Cobrança:**
   ```text
   Olá {{PRIMEIRO_NOME}}! Aqui é do escritório {{ESCRITORIO_NOME}}.
   Para o Dr. {{NOME_ADVOGADO}} concluir a análise do seu caso de {{AREA_CASO}},
   precisamos que nos envie por aqui apenas os seguintes documentos:
   • {{LISTA_ITENS_FALTANDO}}
   Assim que enviar, já daremos andamento ao seu contrato. Qualquer dúvida estamos à disposição!
   ```
3. **Baixa Automática:** Ao receber o documento solicitado no Webhook, o sistema reavalia o checklist e notifica o painel.

---

## 2. Assinatura Digital e Formalização

1. **Geração do Link de Assinatura:**
   - Integração com plataformas idôneas de assinatura eletrônica (ZapSign / Clicksign) ou envio direto de PDF para assinatura via conta Gov.br (Prata/Ouro).
   - O link gerado é enviado diretamente na conversa do cliente no WhatsApp.
2. **Confirmação e Sinal Verde:**
   - Quando o documento assinado retorna, ele é arquivado na pasta física (`PROCURACAO_ASSINADA.pdf`), o status do cliente vira `PRONTO_INICIAL` e uma notificação aparece na tela de *Prazos & Providências*.

---

## 3. Auto-Link (Cliente WhatsApp ↔ Processo CNJ do DJEN)

1. **Regra de Cruzamento:**
   - Quando a ação é distribuída no tribunal e a primeira publicação chega via sincronização do DJEN, o sistema compara as partes do processo (`partes_publicacao`) com o nome e CPF do cliente triado no WhatsApp.
   - Ao encontrar correspondência acima de 90%, o sistema atualiza `processos.cliente_id = operacional.clientes.id`.
2. **Resultado na Interface:**
   - Na tela *Pastas de Processos*, o advogado visualiza imediatamente todo o histórico de áudios e documentos da triagem daquele cliente.
   - Na tela do *DJEN*, surge o botão de 1 clique para avisar o cliente no WhatsApp sobre a nova publicação do juiz em linguagem desmistificada.
