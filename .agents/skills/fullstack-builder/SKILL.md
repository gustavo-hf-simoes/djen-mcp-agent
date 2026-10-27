---
name: fullstack-builder
description: >-
  Constrói, modifica e valida funcionalidades ponta a ponta sincronizando o Backend (DJEN em Node.js/Express/PostgreSQL) e o Frontend (consultas-andre em React 19/Vite/Tailwind v4). Use esta skill sempre que for criar migrations SQL, endpoints de API, repositórios ou componentes de interface.
---

# Fullstack Builder — Executor Dual-Repo (Backend + Frontend)

Esta skill garante que qualquer implementação siga rigorosamente os padrões arquiteturais dos dois repositórios locais sem quebrar contratos ou testes existentes.

## 1. Diretrizes do Backend (`C:\Users\gusta\OneDrive\Área de Trabalho\DJEN`)

### Banco de Dados & Migrations (`database/migrations/`)
- **Sequencial e Aditivo:** Crie sempre arquivos numerados sequencialmente (ex: `005_<nome>.sql`) envoltos em `BEGIN; ... COMMIT;`.
- **Imutabilidade e Auditoria:** Nunca altere nem remova as triggers de imutabilidade das tabelas `djen_respostas`, `djen_resposta_itens`, `djen_resposta_chaves` e `djen_intimacao_origens`.
- **Segurança e LGPD:** Dados sensíveis de clientes no schema `operacional` devem utilizar as funções de `src/modules/operacional/whatsapp.crypto.ts` (AES-256-GCM com `cifrado`, `nonce` e `tag` + `HMAC-SHA256` para busca por telefone).
- **Multi-tenancy:** Novas tabelas de negócio devem prever isolamento por escritório (`escritorio_id` / `advogado_id`).

### Arquitetura de Código (`src/`)
- **CQRS Leve:**
  - *Commands* (`*.command.ts`): Mutações transacionais com `client.query('BEGIN')` / `COMMIT` / `ROLLBACK`.
  - *Queries & Read Repositories* (`*.query.ts`, `*-read.repository.ts`): Consultas otimizadas e paginação retornando DTOs limpos para o frontend.
- **Injeção de Dependências:** Controllers devem receber portas/serviços pelo construtor (como em `src/app.ts` e `src/server.ts`) para permitir testes unitários sem banco real.

### Validação Obrigatória no Backend
Após qualquer alteração no backend, execute:
1. `npm test`
2. `npx tsc --noEmit --verbatimModuleSyntax false`

---

## 2. Diretrizes do Frontend (`D:\Projetos\consultas-andre`)

### Stack & Design System
- **React 19 + TypeScript + Tailwind CSS v4 + Framer Motion + `@phosphor-icons/react`**.
- **Variáveis de Tema (Dark Legal UI):** Preserve o uso das variáveis CSS existentes (`var(--color-surface)`, `var(--color-surface-raised)`, `var(--color-surface-overlay)`, `var(--color-ink)`, `var(--color-ink-muted)`, `var(--color-ink-faint)`, `var(--color-accent)` `#e09f3e`, `var(--color-edge)`).
- **Camada de API (`src/api/`):**
  - Centralize chamadas HTTP em `src/api/`.
  - Prefira consumir as rotas locais enriquecidas do backend (`/api/v1/publicacoes/dashboard`, `/api/v1/publicacoes`, `/api/v1/processos`, `PATCH /api/v1/publicacoes/:id/status`) em vez de depender apenas da rota bruta legada (`/api/v1/comunicacao`).
  - Certidões oficiais do PJe/DJEN usam o domínio público `https://comunicaapi.pje.jus.br/api/v1/comunicacao/${hash}/certidao`.

### Validação Obrigatória no Frontend
Após qualquer alteração em `D:\Projetos\consultas-andre`, execute nesse diretório:
1. `npm run build` (que valida `tsc && vite build`).
