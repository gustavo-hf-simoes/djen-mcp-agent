# SPEC-001: Fundação SaaS Multi-Tenant, Autenticação RBAC (Master/Admin/Advogado) e Painel de Controladoria DJEN

## 1. Objetivo e Dor Resolvida
Transformar o dashboard público de consultas do DJEN em um **SaaS Jurídico fechado, seguro e multi-tenant**, garantindo:
1. **Propriedade e Controle de Acesso (RBAC):** Login seguro com hierarquia de papéis onde **Gustavo (`MASTER`)** detém controle absoluto da plataforma, **Alessandro (`ADMIN_DEV`)** possui acesso técnico administrativo e **André (`ADVOGADO` — `OAB 69161/PR`)** acessa exclusivamente os processos e prazos do seu escritório.
2. **Proteção de Dados Jurídicos:** Fechamento de todas as rotas da API (`/api/v1/*`) com autenticação via Token Assinado (`HMAC-SHA256`), impedindo acesso público via URL.
3. **Painel de Controladoria Persistente + Sincronização sob Demanda:** Evoluir o Frontend para consumir os dados persistidos no PostgreSQL (Dashboard de Controladoria, Visão por Processo CNJ, Estimativa de Prazo em Dias Úteis, Status de Tratamento da Intimação e Botão de Sincronização Imediata com o DJEN).

---

## 2. Modelo de Dados (Migration `005_saas_auth_e_tenants.sql`)

### 2.1. Tabela `escritorios` (Tenants do SaaS)
| Coluna | Tipo | Descrição |
| :--- | :--- | :--- |
| `id` | `UUID PRIMARY KEY` | Identificador único do escritório (Tenant). |
| `nome` | `VARCHAR(160) NOT NULL` | Ex: `André Oliveira Advocacia` |
| `slug` | `VARCHAR(80) UNIQUE NOT NULL` | Ex: `andre-oliveira` |
| `plano` | `VARCHAR(40) NOT NULL DEFAULT 'PILOTO'` | `PILOTO`, `SOLO`, `PRO` |
| `ativo` | `BOOLEAN NOT NULL DEFAULT TRUE` | Controle de ativação pelo `MASTER`. |
| `created_at` | `TIMESTAMPTZ NOT NULL` | Data de criação. |

### 2.2. Tabela `usuarios` (RBAC com Proteção do Proprietário `MASTER`)
| Coluna | Tipo | Descrição |
| :--- | :--- | :--- |
| `id` | `UUID PRIMARY KEY` | Identificador único do usuário. |
| `escritorio_id` | `UUID REFERENCES escritorios(id)` | Tenant vinculado. |
| `advogado_id` | `UUID REFERENCES advogados(id)` | Advogado vinculado (para filtro automático de OAB). |
| `nome` | `VARCHAR(150) NOT NULL` | Nome completo. |
| `email` | `VARCHAR(160) UNIQUE NOT NULL` | E-mail de login (case-insensitive). |
| `senha_hash` | `TEXT NOT NULL` | Hash seguro `scrypt:salt:hash`. |
| `role` | `VARCHAR(30) NOT NULL` | `MASTER` (Gustavo), `ADMIN_DEV` (Alessandro), `ADVOGADO` (André). |
| `ativo` | `BOOLEAN NOT NULL DEFAULT TRUE` | Status do usuário. |
| `ultimo_login_em` | `TIMESTAMPTZ` | Auditoria de acesso. |
| `created_at` | `TIMESTAMPTZ NOT NULL` | Data de criação. |

- **Vínculo Multi-tenant nas tabelas existentes:**
  - Adicionar `escritorio_id UUID REFERENCES escritorios(id)` em `advogados` e `processos`.
  - Associar o registro existente de `André Santos de Oliveira (OAB 69161/PR)` e os `69 processos` / `377 intimações` ao escritório piloto do André.
  - Associar a FK `intimacoes.lido_por_usuario_id` à nova tabela `usuarios(id)`.

---

## 3. Segurança e Contratos de API (Backend Express)

### 3.1. Criptografia de Senha e Token Stateless (`src/modules/auth/`)
- **Hash de Senha:** `node:crypto` (`scryptSync` com salt aleatório de 16 bytes e chave de 64 bytes + `timingSafeEqual`). Zero dependências externas vulneráveis.
- **Token de Sessão (`Bearer`):** Formato JWT/Stateless assinado com `HMAC-SHA256` usando `AUTH_SECRET` do `.env`, contendo `{ sub: usuario.id, email, nome, role, escritorioId, numeroOab, ufOab, exp }`.
- **Regras de Autorização (Middleware `requireAuth` e `requireRole`):**
  - Qualquer requisição para `/api/v1/*` ou `/api/djen/*` sem token válido recebe `401 Unauthorized`.
  - Usuários com `role === 'ADVOGADO'` têm seus filtros `numeroOab` e `ufOab` forçados pelo backend para a OAB do seu próprio cadastro (impedindo enumeração de OAB de terceiros).
  - Usuários `MASTER` e `ADMIN_DEV` podem visualizar qualquer OAB/Escritório, mas **somente `MASTER` (Gustavo)** pode gerenciar administradores ou alterar configurações globais.

### 3.2. Novos Endpoints
| Método | Rota | Acesso | Descrição |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/auth/login` | Público | Autentica `email` + `senha` e retorna `{ token, usuario }`. |
| `GET` | `/api/v1/auth/me` | Autenticado | Retorna os dados da sessão atual + escritório e OAB ativa. |
| `GET` | `/api/v1/auth/usuarios` | `MASTER` / `ADMIN_DEV` | Lista usuários e tenants cadastrados no SaaS. |
| `POST` | `/api/v1/publicacoes/sincronizar` | Autenticado | Dispara a busca imediata de novas comunicações na API oficial do DJEN para os últimos dias (ou período informado), persiste no PostgreSQL com auditoria SHA-256 e devolve o resumo de novas intimações. |

---

## 4. Experiência no Frontend (`frontend/`)

1. **Tela de Login SaaS (`LoginScreen.tsx`):**
   - Tema escuro jurídico consistente (`Chumbo + Âmbar`), login por e-mail/senha e botões de preenchimento rápido em modo local (*Dev Quick Login*: Gustavo Master, André Advogado, Alessandro Admin) para facilitar os testes locais.
2. **Barra Superior de Contexto SaaS (`Header.tsx`):**
   - Exibe o usuário logado, seu badge de permissão (`MASTER`, `ADMIN_DEV`, `ADVOGADO`), a OAB monitorada (`OAB 69.161/PR`), botão **"Sincronizar DJEN Agora"** e botão de Logout.
3. **Navegação da Controladoria (3 Visões Integradas ao PostgreSQL):**
   - **Aba 1 — Controladoria & Prazos (`/api/v1/publicacoes` + `/dashboard`):**
     - Cards de KPIs no topo: *Total de Processos (69)*, *Intimações Pendentes*, *Em Tratamento / Concluídas*.
     - Lista de intimações do banco local com **Badge de Prazo Estimado em Dias Úteis**, **Botão Copiar Contexto p/ IA** (`textoParaCopiar` já formatado pelo backend) e seletor de status em tempo real (`PENDENTE` -> `LIDA` -> `CONCLUIDA` via `PATCH /api/v1/publicacoes/:id/status`).
   - **Aba 2 — Pastas de Processos (`/api/v1/processos`):**
     - Agrupamento por **Número CNJ**, mostrando o Tribunal, Órgão Julgador, quantidade de publicações daquele processo e expansão para ver todo o histórico de intimações daquele processo específico (`/api/v1/processos/:id/publicacoes`).
   - **Aba 3 — Consulta Direta DJEN (`/api/v1/comunicacao`):**
     - Mantém a busca paginada completa com todos os filtros originais do Alessandro, agora protegida por login e gravando automaticamente no banco.
   - **Aba 4 (Exclusiva `MASTER` / `ADMIN_DEV`) — Gestão do SaaS:**
     - Visão administrativa mostrando os Tenants (Escritórios) e Usuários ativos, evidenciando a arquitetura SaaS Multi-tenant.

---

## 5. Credenciais Iniciais (Seed Local de Desenvolvimento)
- **Gustavo (Proprietário / Master):** `gustavo@ghfs.adv.br` | Senha: `Master@2026` (`role: MASTER`)
- **André Oliveira (Advogado Piloto):** `andre@oliveira.adv.br` | Senha: `Andre@2026` (`role: ADVOGADO`, `OAB 69161/PR`)
- **Alessandro (Admin Dev):** `alessandro@ghfs.adv.br` | Senha: `Alessandro@2026` (`role: ADMIN_DEV`)
