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
- **Regras Estritas de Segurança (Zero-Trust & OWASP):**
  1. **Nenhuma rota de dados jurídicos pode ser pública:** Todo endpoint de `/api/v1/*` e `/api/djen/*` exige token autenticado (`Bearer` HMAC-SHA256) e verificação de `tenant_id` (`escritorio_id`).
  2. **Senhas e Tokens:** Senhas devem usar `crypto.scrypt` com salt aleatório e comparação em tempo constante (`timingSafeEqual`).
  3. **Isolamento Multi-tenant:** Um usuário `ADVOGADO` jamais pode consultar ou modificar processos/intimações de outro `escritorio_id` / `advogado_id`.

## 4. Diretrizes Obrigatórias de Usabilidade (UX Jurídica & Padrão de Mercado)
A usabilidade intuitiva é o maior diferencial comercial do SaaS:
1. **Linguagem do Advogado (Zero Jargão Técnico de TI):** Nunca exiba termos internos de banco/infraestrutura na UI (como `SHA-256`, `UUID`, `JSONB`). Priorize sempre **Nome do Cliente / Partes**, **Número do Processo Formatado (`NNNNNNN-DD.AAAA.J.TR.OOOO`)** e **Prazo Fatal**.
2. **Navegação Escalável (Sidebar com Busca):** O sistema utiliza menu lateral recolhível (`Sidebar`) com filtro de busca instantânea para comportar o crescimento de módulos (Controladoria, Operacional WhatsApp, Jurisprudência, Base de Conhecimento, Financeiro e Governança Master).
3. **Ergonomia de Leitura e Paginação:**
   - Sempre decodificar entidades HTML (`&iacute;`, `&ccedil;`, etc.) para UTF-8 limpo tanto em visualizações recolhidas quanto expandidas.
   - Em listagens longas, disponibilizar controles de paginação **no topo e no rodapé** para evitar rolagem excessiva.
   - Painéis de filtro laterais devem ter scroll independente (`overscroll-contain`) sem arrastar a página principal.
   - Manter fidelidade absoluta à paleta escura e badges semânticos criados pelo Alessandro (`Chumbo + Âmbar`).

## 5. Fluxo de Desenvolvimento Agêntico (Spec-Driven & Token-Aware)
- Antes de escrever código complexo, utilize a skill `spec-architect` para transformar ideias brutas (áudios do Gustavo ou documentos do André) em especificações técnicas executáveis (`docs/specs/`).
- Para implementar banco, backend e frontend ponta a ponta, utilize a skill `fullstack-builder`.
- Para construir orquestradores, subagentes jurídicos e tools determinísticas, utilize a skill `ai-agent-designer`.
- **Governança de Custos e Roteamento de Modelos (`model-router`):** Sempre aplique o princípio da economia de créditos: use `flash_lite` para buscas extensas e tarefas operacionais via subagentes, `flash` para construção e refatoração contínua, reservando `pro` / `argon` estritamente para arquitetura profunda ou quando solicitado pelo usuário.
