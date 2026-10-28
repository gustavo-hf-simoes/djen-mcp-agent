---
name: legal-compliance-architect
description: >-
  Auditoria Contínua de Compliance Jurídico, LGPD e Sigilo Profissional da OAB. Garante que qualquer código, migration SQL, rota de API, armazenamento de dados ou prompt de IA siga estritamente a LGPD (Lei 13.709/2018), o Estatuto da Advocacia (Lei 8.906/94), provimentos do CNJ e termos de operador/controlador para software jurídico SaaS no Brasil.
---

# Legal Compliance & LGPD Architect — Governança Jurídica para SaaS LegalTech

Esta skill estabelece diretrizes e verificações obrigatórias de **Privacidade por Design (Privacy by Design)**, **Segurança da Informação (Art. 46 da LGPD)** e **Sigilo Profissional da Advocacia (Art. 34 do EAOAB)** em qualquer funcionalidade implementada no monorepo.

---

## 1. Princípios Imutáveis de Compliance no Código

Em toda e qualquer implementação no backend ou frontend, o agente deve auditar:

### A) Papéis de Tratamento (Art. 5º da LGPD)
- **O Escritório Assinante é o CONTROLADOR:** É ele quem detém a relação com o cliente final e a responsabilidade primária de coleta.
- **A Plataforma GHFS é a OPERADORA:** O SaaS apenas hospeda, processa e executa tarefas sob a instrução do escritório.
- **Regra de Código:** Nunca reutilizar ou cruzar dados de clientes de um escritório (`escritorio_id`) para treinar modelos globais de IA ou para alimentar outros tenants.

### B) Criptografia e Armazenamento (Art. 46 da LGPD)
- **Zero-Trust em Repouso:** Qualquer campo contendo dados pessoais (nome, CPF, RG, telefone, áudios, transcrições e comprovantes) DEVE ser gravado cifrado em binário (`BYTEA`) via `AES-256-GCM` com Nonce exclusivo por registro.
- **Blind Indexing:** Buscas por telefone ou documento devem usar hash cego (`HMAC-SHA256`) com chave secreta separada, impedindo vazamento de números em consultas indexadas.
- **Cadeia de Custódia Probatória:** Arquivos de mídia (áudios, fotos, PDFs) devem ter hash criptográfico `SHA-256` gerado no ato do recebimento para garantia de autenticidade jurídica em juízo.

### C) Direitos do Titular (Art. 18 da LGPD)
- **Direito à Portabilidade:** O sistema deve oferecer mecanismo de exportação completa da pasta do cliente (arquivo `.ZIP` contendo mídias originais + certidões + resumo cronológico).
- **Direito ao Esquecimento / Eliminação (Art. 16):** Disponibilizar rotina segura de expurgo definitivo de dados de leads que não contrataram o escritório, apagando os arquivos físicos e sobrescrevendo os registros do banco.

---

## 2. Padrão de Termos de Uso (ToS) e Acordo de Processamento de Dados (DPA)

Ao estruturar novos fluxos comerciais ou cadastros de escritórios:
1. **DPA Vinculado:** Todo contrato de assinatura do SaaS deve conter Acordo de Processamento de Dados estabelecendo as obrigações da GHFS como Operadora.
2. **Cláusula de Limitação de Responsabilidade (*Liability Cap*):** A responsabilidade comercial da plataforma deve ser limitada aos valores pagos pelo assinante nos últimos meses.
3. **Propriedade Intelectual e dos Dados:** O escritório é o único proprietário de todos os processos, clientes e documentos; a plataforma não tem direito sobre o acervo do advogado.

---

## 3. Checklist de Auditoria para Novas Funcionalidades
Antes de aprovar qualquer migration ou rota:
- [ ] O endpoint exige autenticação com token JWT/HMAC e isolamento por `tenant_id` (`escritorio_id`)?
- [ ] Algum dado pessoal (PII) está sendo salvo em texto aberto (`VARCHAR` não cifrado)?
- [ ] As chamadas a provedores de IA (Gemini/Meta) trafegam apenas dados autorizados para a instrução daquele caso específico?
- [ ] Os logs de erro ou de servidor expõem tokens, senhas ou conteúdos sensíveis de mensagens?
