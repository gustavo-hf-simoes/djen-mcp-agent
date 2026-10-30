# Especificação Técnica 002: Ponte Agêntica WhatsApp ⇄ Claude (MCP Jurídico Local)

> **Status:** Aprovado para Implementação  
> **Autor:** Gustavo Simões (Diretor de Engenharia Agêntica)  
> **Usuário Alvo:** Dr. André Santos de Oliveira (OAB 69161/PR) · Advogado Solo Agêntico  
> **Data:** 30 de Outubro de 2026  

---

## 1. Visão de Negócio & Problema Resolvido

O mercado jurídico está inundado de prompts e skills superficiais vendidas sem capacidade de execução. Advogados de alta performance (como o Dr. André) operam seus escritórios diretamente no **VS Code com Claude** (Claude Code / Cowork / Cline / Roo Code) acoplado a pastas locais e automação no Chrome (MCP Chrome Automation).

Para esse perfil, um SaaS Web tradicional impõe atrito inútil de context-switching. O valor real reside em uma **Ponte Agêntica Local (MCP Server)** que:
1. **Instala-se com zero atrito:** O próprio Claude do André executa a instalação e a configuração oficial da Meta via automação do navegador (André só aprova e faz login no Facebook).
2. **Recebe mensagens e mídias em tempo real:** Mensagens, áudios transcritos e fotos de CNH/documentos entram automaticamente no contexto do Claude e em pastas locais do computador (`C:\Processos\<Cliente>\`).
3. **Controla a Janela de 24h da Meta:** Informa se o envio é gratuito ou template oficial.
4. **Responde via WhatsApp por comando do Claude:** O advogado aprova com "Pode enviar" e o Claude dispara a resposta e os anexos sem que o advogado abra o WhatsApp Web.

---

## 2. Arquitetura em 2 Camadas: Setup Autônomo vs. Runtime Diário

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        VS CODE DO DR. ANDRÉ                             │
│                                                                         │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │                 CLAUDE (Claude Code / Cline / Cowork)           │   │
│   └──────────────────────┬───────────────────────────▲──────────────┘   │
│                          │                           │                  │
│       [CAMADA 1: SETUP]  │                           │ [CAMADA 2: RUN]  │
│       Chrome Automation  │                           │ MCP Tools        │
│       MCP (Playwright)   │                           │ StdIO / IPC      │
│                          ▼                           │                  │
│   ┌──────────────────────────────┐    ┌──────────────┴──────────────┐   │
│   │  AGENTE DE ONBOARDING META   │    │  MCP SERVER WHATSAPP LOCAL  │   │
│   │  • Abre developers.facebook  │    │  • Tools: listar_msgs()     │   │
│   │  • André faz login           │    │  • Tools: responder()       │   │
│   │  • Cria App WhatsApp Cloud   │    │  • Tools: baixar_provas()   │   │
│   │  • Gera Token Permanente     │    │  • Transcrição Whisper      │   │
│   │  • Configura Webhook & Tunnel│    │  • Monitor Janela 24h Meta  │   │
│   └──────────────┬───────────────┘    └──────────────▲──────────────┘   │
│                  │                                   │                  │
└──────────────────┼───────────────────────────────────┼──────────────────┘
                   ▼                                   ▼
        Meta Developers Portal               WhatsApp Cloud API
        (developers.facebook.com)           (graph.facebook.com)
```

---

## 3. Camada 1: O Fluxo de Onboarding Autônomo (Zero-Touch)

O André não toca em arquivos de configuração JSON nem no terminal. O onboarding é conduzido pelo próprio Claude:

1. **Gatilho:** O André digita no chat do Claude no VS Code:
   > *"Claude, conecte o WhatsApp oficial do meu escritório."*
2. **Execução pelo Claude:**
   - O Claude detecta o script `setup-meta-onboarding.ts`.
   - O Claude aciona o **Chrome Automation MCP**:
     1. Abre uma janela do navegador apontando para `https://developers.facebook.com`.
     2. Mensagem ao André: *"André, a janela do navegador foi aberta. Por favor, faça login na sua conta do Facebook e me avise quando terminar."*
     3. André insere login e 2FA.
     4. André responde: *"Pronto, logado."*
   - O Claude assume o controle do Chrome:
     1. Clica em **Criar Aplicativo** ➔ Seleciona tipo **Outro / Negócios**.
     2. Nomeia o App: `ASO Advogados - WhatsApp Agêntico`.
     3. Adiciona o produto **WhatsApp**.
     4. Navega até a aba **Início Rápido / Configuração de API**.
     5. Lê e extrai: `Phone Number ID` e `WhatsApp Business Account ID (WABA ID)`.
     6. Navega até **Configurações do Negócio ➔ Usuários do Sistema** e gera o **Token Permanente de Acesso** com permissões `whatsapp_business_messaging` e `whatsapp_business_management`.
     7. Inicia o túnel de webhook local (Cloudflare Quick Tunnel em background).
     8. Configura o Callback URL do Webhook na Meta e o Verify Token.
     9. Escreve o arquivo `.env` local na pasta do André.
     10. Registra o MCP Server no arquivo de configuração do Claude (`claude_desktop_config.json` ou `.cline/mcp.json`).
3. **Conclusão:** O Claude avisa: *"WhatsApp oficial conectado com sucesso! O número (43) 99603-4632 está ativo. A partir de agora, qualquer mensagem ou áudio que chegar será transcrito e notificado aqui."*

---

## 4. Camada 2: Ferramentas do MCP Server (`mcp-whatsapp-juridico`)

O servidor MCP expõe as seguintes ferramentas oficiais para o Claude:

### 4.1 `whatsapp_listar_conversas`
* **Descrição:** Retorna as conversas ativas com resumo da última mensagem, tempo de espera e status da janela gratuita de 24 horas da Meta.
* **Retorno:**
  ```json
  [
    {
      "clienteId": "5543996034632",
      "nome": "Gustavo Simões",
      "tipoCaso": "Bancário / Revisional",
      "totalMensagens": 12,
      "janela24h": {
        "status": "ativa",
        "horasRestantes": 22.5,
        "gratuita": true
      },
      "ultimaMensagem": "Enviei minha CNH e o contrato do banco",
      "pastaLocal": "C:\\Processos\\Gustavo_Simoes"
    }
  ]
  ```

### 4.2 `whatsapp_obter_conversa_completa`
* **Parâmetros:** `clienteId` (string)
* **Descrição:** Retorna todo o histórico de mensagens, transcrições de áudios (Whisper) e links locais dos documentos baixados.

### 4.3 `whatsapp_enviar_mensagem`
* **Parâmetros:**
  - `clienteId`: Telefone com DDI/DDD
  - `texto`: Texto da resposta aprovada pelo advogado
  - `caminhoAnexo` (opcional): Caminho absoluto de arquivo local (`.pdf`, `.docx`, áudio) para envio direto ao cliente
* **Descrição:** Dispara a mensagem via Meta Cloud API oficial. Valida se está dentro das 24h gratuitas ou se requer template.

### 4.4 `whatsapp_baixar_provas_para_pasta_local`
* **Parâmetros:**
  - `clienteId`: Telefone do cliente
  - `diretorioDestino`: Caminho da pasta local do advogado (ex: `C:\Processos\Gustavo_Simoes\Provas`)
* **Descrição:** Baixa fotos, PDFs e áudios originais da Meta e organiza em disco com nomes limpos (`CNH_Frente.pdf`, `Extrato_Bancario.pdf`).

---

## 5. Estrutura do Novo Repositório Dedicado (`mcp-whatsapp-juridico`)

O projeto será criado como um pacote TypeScript autônomo, leve e de alta performance:

```
mcp-whatsapp-juridico/
├── .env.example
├── package.json               # Dependências mínimas (@modelcontextprotocol/sdk, axios, dotenv)
├── tsconfig.json
├── src/
│   ├── index.ts               # Ponto de entrada do MCP Server (StdIO)
│   ├── meta-client.ts         # Chamadas à Meta Cloud API (envio de texto, áudio e documentos)
│   ├── webhook-receiver.ts    # Servidor local Express/HTTP para receber eventos da Meta
│   ├── audio-transcriber.ts   # Transcrição Whisper (Groq / OpenAI API ou Whisper Local)
│   ├── local-storage.ts       # Gestão de pastas locais de clientes em C:\Processos\...
│   └── tools/
│       ├── listar-conversas.tool.ts
│       ├── obter-conversa.tool.ts
│       ├── enviar-mensagem.tool.ts
│       └── organizar-pasta.tool.ts
├── scripts/
│   ├── setup-meta-chrome.ts   # Automação do Chrome para configurar a Meta developers
│   └── start-tunnel.ts        # Cloudflare Tunnel rápido em background
└── skills/
    └── whatsapp-atendimento-juridico.md  # Skill do Claude com as regras de ouro do Dr. André
```

---

## 6. Próximos Passos de Execução

1. **Inicializar a pasta e estrutura do projeto `mcp-whatsapp-juridico`**.
2. **Implementar o servidor MCP (`src/index.ts`)** com as tools de listar, ler e responder WhatsApp.
3. **Implementar o script de automação do Chrome (`scripts/setup-meta-chrome.ts`)** para criação e captura de chaves no portal da Meta.
4. **Criar a Skill do Claude (`skills/whatsapp-atendimento-juridico.md`)** que comanda o MCP dentro do VS Code.
