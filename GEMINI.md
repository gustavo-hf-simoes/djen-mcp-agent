# Regras do Workspace — SaaS Jurídico Agêntico (DJEN + Controladoria + Operacional)

## 1. Protocolo de Comunicação (Otimização de Voz e Economia de Tokens)
O usuário (Gustavo) utiliza ditado por voz. Suas mensagens podem conter repetições, digressões ou vícios de linguagem.
1. **Síntese Executiva no Topo:** Sempre inicie respostas a prompts longos ou falados com um bloco curto `### Síntese do que entendi:` (máximo 3 a 5 bullets objetivos) traduzindo a fala em intenção técnica e de negócio.
2. **Concisão Extrema:** Vá direto ao ponto. Evite introduções prolixas, elogios desnecessários ou repetição do que já foi dito para preservar a janela de contexto e economizar tokens.
3. **Papel do Usuário:** Gustavo atua como **Arquiteto de Produto e Diretor de Engenharia Agêntica** (ex-desenvolvedor de sistemas laboratoriais LIS migrando para o mercado jurídico).

## 2. Mapa Monorepo Agêntico (Backend + Frontend Unificados)
Este produto opera em formato **Monorepo** para contexto atômico dos agentes:
- **Raiz / Backend (`DJEN`):** `C:\Users\gusta\OneDrive\Área de Trabalho\DJEN`
  - Stack: Node.js 20+, Express 5, TypeScript, PostgreSQL (`pg` sem ORM pesado, SQL puro parametrizado), CQRS leve por módulo (`src/modules/auth`, `src/modules/djen`, `src/modules/operacional`).
- **Frontend (`frontend/`):** `C:\Users\gusta\OneDrive\Área de Trabalho\DJEN\frontend` (espelhado de `D:\Projetos\consultas-andre`)
  - Stack: React 19, Vite 8, Tailwind CSS v4, Framer Motion, `@phosphor-icons/react`.
  - Mantido em parceria com o Alessandro (Dev Front-end).

## 3. Contexto de Domínio, Negócio e Segurança SaaS
- **Propriedade do Sistema:** **Gustavo** é o proprietário e criador exclusivo da plataforma (`MASTER` / `SUPER_ADMIN`).
- **Hierarquia de Acesso (RBAC):**
  - `MASTER` (**Gustavo**): Controle total do SaaS, gestão de todos os escritórios (tenants), usuários, chaves e auditoria. Nenhum outro papel pode alterar ou remover um usuário `MASTER`.
  - `ADMIN_DEV` (**Alessandro**): Acesso administrativo de suporte/desenvolvimento ao ambiente, subordinado ao `MASTER`.
  - `ADVOGADO` (**André — `OAB 69161/PR`**): Usuário piloto ("Laboratório Vivo"), advogado solo (sem equipe humana) operando nos nichos de Direito Bancário (RCV) e E-commerce (Mercado Livre).
- **Regras Estritas de Segurança & LGPD (Zero-Trust & OWASP & Lei 13.709/2018):**
  1. **Nenhuma rota de dados jurídicos pode ser pública:** Todo endpoint de `/api/v1/*` e `/api/djen/*` exige token autenticado (`Bearer` HMAC-SHA256) e verificação de `tenant_id` (`escritorio_id`).
  2. **Senhas e Tokens:** Senhas devem usar `crypto.scrypt` com salt aleatório e comparação em tempo constante (`timingSafeEqual`).
  3. **Isolamento Multi-tenant:** Um usuário `ADVOGADO` jamais pode consultar ou modificar processos/intimações de outro `escritorio_id` / `advogado_id`.
  4. **Conformidade LGPD & OAB (Skill `legal-compliance-architect`):** Toda feature atua estritamente como **Operador de Dados (LGPD Art. 5º)**. Dados pessoais, áudios e documentos devem ser armazenados com criptografia autenticada (`AES-256-GCM`), blind index para telefones e hashes probatórios de cadeia de custódia.

## 4. Diretrizes Obrigatórias de Usabilidade (UX Jurídica & Padrão de Mercado)
A usabilidade intuitiva é o maior diferencial comercial do SaaS:
1. **Regra de Ouro — TI no Background, Advocacia no Foreground:**
   - Toda tela, card, métrica ou botão deve responder à pergunta: *"Qual dor concreta do advogado isso resolve e que decisão prática ele toma ao ver isso?"*.
   - Métricas de infraestrutura ou inteligência artificial (ex: "X áudios transcritos", "Tokens consumidos", "Webhooks processados", "Payload criptografado") NUNCA devem poluir o fluxo de trabalho do advogado. Elas pertencem a logs de auditoria ou ao painel exclusivo do MASTER.
   - Telas operacionais e de controladoria devem refletir a **esteira de conversão e urgência processual do escritório** (ex: *Novos Contatos*, *Aguardando Documentos*, *Prontos para Inicial*, *Sem Retorno +48h*).
2. **Linguagem do Advogado (Zero Jargão Técnico de TI):** Nunca exiba termos internos de banco/infraestrutura na UI (como `SHA-256`, `UUID`, `JSONB`, `WABA ID`, `x-hub-signature`). Priorize sempre **Nome do Cliente / Partes**, **Número do Processo Formatado (`NNNNNNN-DD.AAAA.J.TR.OOOO`)** e **Prazo Fatal**.
3. **Setup Técnico sem Intrusão Operacional:**
   - Telas de parametrização e credenciais (ex: WhatsApp Meta Cloud API, tokens) NUNCA devem viver no topo da tela de trabalho diário. Devem residir em **Modais Centrais** ou **Drawers Dedicados**, abertos apenas sob demanda via botão sutil no cabeçalho.
   - Quando um módulo estiver sem dados ou desconectado, exiba um **Empty State de Boas-Vindas acolhedor** (`EmptyState.tsx`), com linguagem humana e um único botão amigável (ex: *"Conectar WhatsApp Oficial do Escritório"*), sem expor formulários de desenvolvimento.
4. **Ergonomia, Abas e Redução de Sobrecarga Cognitiva:**
   - Evite empilhar múltiplos formulários ou listas infinitas na mesma coluna. Utilize **Abas Temáticas Focadas** (ex: `[📋 Qualificação Civil]`, `[📑 Checklist de Provas]`, `[⚡ Ações & Minutas]`).
   - Sempre decodificar entidades HTML (`&iacute;`, `&ccedil;`, etc.) para UTF-8 limpo tanto em visualizações recolhidas quanto expandidas.
   - Em listagens longas, disponibilizar controles de paginação **no topo e no rodapé** para evitar rolagem excessiva.
   - Painéis de filtro laterais devem ter scroll independente (`overscroll-contain`) sem arrastar a página principal.
   - Manter fidelidade absoluta à paleta escura e badges semânticos criados pelo Alessandro (`Chumbo + Âmbar`: `#161618`, `#1e1e21`, `#252528`, `#e09f3e`).
5. **Navegação Escalável (Sidebar com Busca):** O sistema utiliza menu lateral recolhível (`Sidebar`) com filtro de busca instantânea para comportar o crescimento de módulos (Controladoria, Operacional WhatsApp, Jurisprudência, Base de Conhecimento, Financeiro e Governança Master).
6. **Ergonomia de Scroll, Viewport e Blindagem contra 'Scroll Trap':**
   - Nenhuma listagem ou feed pode ter a última linha ou card colado na borda inferior do container. Use sempre padding inferior amplo (`pb-16` a `pb-24`) e espaçadores de respiro.
   - Colunas de trabalho lado a lado devem possuir alturas uniformes sincronizadas (`lg:h-[720px]`), com cabeçalhos e barras de ação fixos (`shrink-0`) e containers internos com scroll independente (`overscroll-contain`).
   - Feeds de mensagens devem sempre inicializar com auto-scroll suave (`scrollIntoView`) apontando para o conteúdo mais recente.
7. **Segurança de Eventos Assíncronos & Zero Supply-Chain Bloat:**
   - Todo manipulador de evento assíncrono (mídias de áudio/vídeo, formulários) deve extrair valores primitivos de `e.currentTarget` de forma síncrona e segura antes de chamar setters de estado (`setState`). Jamais leia propriedades do DOM dentro de callbacks enfileiradas.
   - Ferramentas de teste e validação de interface devem viver estritamente em `devDependencies`, sem adicionar dependências transitivas desnecessárias ao runtime de produção.

## 5. Fluxo de Desenvolvimento Agêntico (Spec-Driven & Token-Aware)
- Antes de escrever código complexo, utilize a skill `spec-architect` para transformar ideias brutas (áudios do Gustavo ou documentos do André) em especificações técnicas executáveis (`docs/specs/`).
- Para implementar banco, backend e frontend ponta a ponta, utilize a skill `fullstack-builder`.
- Para construir orquestradores, subagentes jurídicos e tools determinísticas, utilize a skill `ai-agent-designer`.
- **Governança de Custos e Roteamento de Modelos (`model-router`):** Sempre aplique o princípio da economia de créditos: use `flash_lite` para buscas extensas e tarefas operacionais via subagentes, `flash` para construção e refatoração contínua, reservando `pro` / `argon` estritamente para arquitetura profunda ou quando solicitado pelo usuário.
- **Auditoria de Compliance e LGPD (`legal-compliance-architect`):** Audite toda migration SQL, rota de API ou uso de LLM para garantir que sigilo profissional, privacidade e termos de operador sejam preservados.
- **Minutas e Peças Jurídicas (`legal-document-drafter`):** Garanta zero alucinação fática, fidelidade estrita às provas da pasta do cliente e supervisão humana obrigatória (status `MINUTA_RASCUNHO`).
- **Automação Pós-Triagem e Assinatura (`client-intake-flow`):** Governe cobrança cordial de pendências no WhatsApp, links de assinatura eletrônica e o auto-link entre o cliente do WhatsApp e o processo CNJ do DJEN.

## 6. Regras de Engenharia de Prompt Jurídico (Anti-Alucinação & Human-in-the-Loop)
1. **Fidelidade Fática Absoluta:** O sistema jamais presumirá fatos, valores de dívida ou nomes de testemunhas não declarados nos áudios ou documentos da pasta do cliente.
2. **Supervisão Humana Prévia (Human-in-the-Loop):** Nenhuma petição inicial, procuração ou mensagem de cobrança processual é enviada ou protocolada de forma autônoma sem a aprovação explícita de 1 clique do advogado titular.
