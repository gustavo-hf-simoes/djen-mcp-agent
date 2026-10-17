export const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'DJEN Local API',
    version: '1.0.0',
    description: 'API local para consulta e persistência auditável de publicações do DJEN, com webhook inicial da WhatsApp Cloud API.'
  },
  servers: [{ url: 'http://localhost:3000', description: 'Backend local' }],
  tags: [
    { name: 'Publicações', description: 'Consulta local, agrupamento por processo e atualização de status.' },
    { name: 'Tribunais', description: 'Homepages oficiais mapeadas por sigla.' },
    { name: 'WhatsApp', description: 'Verificação e recebimento de webhooks oficiais da Meta.' }
  ],
  paths: {
    '/api/v1/publicacoes/dashboard': {
      get: {
        tags: ['Publicações'],
        summary: 'Obter contagens e publicações recentes',
        parameters: [
          { name: 'numeroOab', in: 'query', schema: { type: 'string', default: '69161' } },
          { name: 'ufOab', in: 'query', schema: { type: 'string', default: 'PR' } }
        ],
        responses: {
          '200': {
            description: 'Contagens por status e as dez publicações mais recentes do banco local.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    contagens: {
                      type: 'object',
                      properties: {
                        totalPublicacoes: { type: 'integer' },
                        totalProcessos: { type: 'integer' },
                        porStatus: { type: 'object', additionalProperties: { type: 'integer' } }
                      }
                    },
                    ultimasPublicacoes: { type: 'array', items: { $ref: '#/components/schemas/Publicacao' } }
                  }
                }
              }
            }
          },
          '400': { description: 'OAB ou UF inválida.' },
          '500': { description: 'Falha ao consultar o banco local.' }
        }
      }
    },
    '/api/v1/processos': {
      get: {
        tags: ['Publicações'],
        summary: 'Listar processos agrupados',
        description: 'Lista processos que possuem publicações persistidas para a OAB/UF e resume quantidade e publicação mais recente.',
        parameters: [
          { name: 'numeroOab', in: 'query', schema: { type: 'string', default: '69161' } },
          { name: 'ufOab', in: 'query', schema: { type: 'string', default: 'PR' } },
          { name: 'numeroProcesso', in: 'query', schema: { type: 'string' } },
          { name: 'tribunal', in: 'query', schema: { type: 'string' } },
          { name: 'pagina', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
          { name: 'itensPorPagina', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 25 } }
        ],
        responses: {
          '200': {
            description: 'Página de processos agrupados.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    items: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'string', format: 'uuid' },
                          numeroProcesso: { type: 'string' },
                          tribunal: { type: 'string', nullable: true },
                          homepageTribunal: { type: 'string', format: 'uri', nullable: true },
                          orgaoJulgador: { type: 'string', nullable: true },
                          quantidadePublicacoes: { type: 'integer' },
                          ultimaPublicacao: { type: 'object', nullable: true }
                        }
                      }
                    },
                    pagination: { $ref: '#/components/schemas/Pagination' }
                  }
                }
              }
            }
          },
          '400': { description: 'Filtro ou paginação inválida.' },
          '500': { description: 'Falha ao consultar o banco local.' }
        }
      }
    },
    '/api/v1/processos/{id}/publicacoes': {
      get: {
        tags: ['Publicações'],
        summary: 'Listar publicações de um processo',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'numeroOab', in: 'query', schema: { type: 'string', default: '69161' } },
          { name: 'ufOab', in: 'query', schema: { type: 'string', default: 'PR' } },
          { name: 'pagina', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
          { name: 'itensPorPagina', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 25 } }
        ],
        responses: {
          '200': {
            description: 'Publicações locais em ordem decrescente de data.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    items: { type: 'array', items: { $ref: '#/components/schemas/Publicacao' } },
                    pagination: { $ref: '#/components/schemas/Pagination' }
                  }
                }
              }
            }
          },
          '400': { description: 'ID de processo ou paginação inválida.' },
          '500': { description: 'Falha ao consultar o banco local.' }
        }
      }
    },
    '/api/v1/publicacoes': {
      get: {
        tags: ['Publicações'],
        summary: 'Listar publicações locais',
        parameters: [
          { name: 'numeroOab', in: 'query', schema: { type: 'string', default: '69161' } },
          { name: 'ufOab', in: 'query', schema: { type: 'string', default: 'PR' } },
          { name: 'status', in: 'query', schema: { type: 'string' } },
          { name: 'tribunal', in: 'query', schema: { type: 'string' } },
          { name: 'dataInicio', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'dataFim', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'pagina', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
          { name: 'itensPorPagina', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 25 } }
        ],
        responses: {
          '200': {
            description: 'Publicações do banco local com texto em plain text, conteúdo para cópia e estimativa de prazo.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    items: { type: 'array', items: { $ref: '#/components/schemas/Publicacao' } },
                    pagination: { $ref: '#/components/schemas/Pagination' }
                  }
                }
              }
            }
          },
          '400': { description: 'Filtro ou paginação inválida.' },
          '500': { description: 'Falha ao consultar o banco local.' }
        }
      }
    },
    '/api/v1/tribunais': {
      get: {
        tags: ['Tribunais'],
        summary: 'Listar homepages oficiais mapeadas',
        responses: {
          '200': {
            description: 'Siglas e homepages de tribunais com URL cadastrada no backend.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    items: {
                      type: 'array',
                      items: {
                        type: 'object',
                        required: ['sigla', 'homepage'],
                        properties: {
                          sigla: { type: 'string' },
                          homepage: { type: 'string', format: 'uri' }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/api/v1/comunicacao': {
      get: {
        tags: ['Publicações'],
        summary: 'Consultar publicações no DJEN',
        description: 'Encaminha os filtros para a API oficial. Persiste a resposta original e as novas comunicações; devolve o JSON do DJEN sem remodelá-lo.',
        parameters: [
          { name: 'numeroOab', in: 'query', schema: { type: 'string', default: '69161' } },
          { name: 'ufOab', in: 'query', schema: { type: 'string', default: 'PR' } },
          { name: 'pagina', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'itensPorPagina', in: 'query', schema: { type: 'integer', enum: [5, 10, 100], default: 10 } },
          { name: 'numeroProcesso', in: 'query', schema: { type: 'string' } },
          { name: 'nomeAdvogado', in: 'query', schema: { type: 'string' } },
          { name: 'nomeParte', in: 'query', schema: { type: 'string' } },
          { name: 'siglaTribunal', in: 'query', schema: { type: 'string' } },
          { name: 'dataDisponibilizacaoInicio', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'dataDisponibilizacaoFim', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'meio', in: 'query', schema: { type: 'string', enum: ['D', 'E'] } },
          { name: 'numeroComunicacao', in: 'query', schema: { type: 'integer' } },
          { name: 'orgaoId', in: 'query', schema: { type: 'integer' } }
        ],
        responses: {
          '200': {
            description: 'JSON original retornado pelo DJEN.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['status', 'message', 'count', 'items'],
                  properties: {
                    status: { type: 'string' },
                    message: { type: 'string' },
                    count: { type: 'integer', description: 'Quantidade total de comunicações da pesquisa, não de processos únicos.' },
                    items: { type: 'array', items: { type: 'object', additionalProperties: true } }
                  }
                }
              }
            }
          },
          '500': { description: 'Falha na consulta ou persistência.' }
        }
      }
    },
    '/api/djen/intimacoes/{id}/status': {
      patch: {
        tags: ['Publicações'],
        summary: 'Atualizar status de leitura',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['status'],
                properties: { status: { type: 'string' } }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Status atualizado.',
            content: {
              'application/json': {
                schema: { type: 'object', properties: { success: { type: 'boolean' } } }
              }
            }
          },
          '400': { description: 'ID ou status ausente.' },
          '500': { description: 'Falha ao atualizar o status.' }
        }
      }
    },
    '/api/v1/publicacoes/{id}/status': {
      patch: {
        tags: ['Publicações'],
        summary: 'Atualizar status de leitura da publicação',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['status'],
                properties: { status: { type: 'string' } }
              }
            }
          }
        },
        responses: {
          '200': { description: 'Status atualizado.' },
          '400': { description: 'ID ou status ausente.' },
          '500': { description: 'Falha ao atualizar o status.' }
        }
      }
    },
    '/webhook/whatsapp': {
      get: {
        tags: ['WhatsApp'],
        summary: 'Verificação do webhook pela Meta',
        parameters: [
          { name: 'hub.mode', in: 'query', required: true, schema: { type: 'string', example: 'subscribe' } },
          { name: 'hub.verify_token', in: 'query', required: true, schema: { type: 'string' } },
          { name: 'hub.challenge', in: 'query', required: true, schema: { type: 'string' } }
        ],
        responses: {
          '200': { description: 'Challenge devolvido como texto.' },
          '403': { description: 'Token de verificação inválido.' },
          '503': { description: 'Webhook sem configuração.' }
        }
      },
      post: {
        tags: ['WhatsApp'],
        summary: 'Receber eventos assinados da Meta',
        description: 'Exige a assinatura HMAC SHA-256 no cabeçalho x-hub-signature-256. O corpo é limitado a 3 MB.',
        parameters: [
          { name: 'x-hub-signature-256', in: 'header', required: true, schema: { type: 'string', example: 'sha256=<hex>' } }
        ],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } }
        },
        responses: {
          '200': { description: 'Evento persistido ou reconhecido como duplicado.' },
          '401': { description: 'Assinatura inválida.' },
          '503': { description: 'Webhook ou chaves de cifragem sem configuração.' },
          '500': { description: 'Falha ao persistir o evento.' }
        }
      }
    }
  },
  components: {
    schemas: {
      Pagination: {
        type: 'object',
        properties: {
          page: { type: 'integer' },
          pageSize: { type: 'integer' },
          totalItems: { type: 'integer' },
          totalPages: { type: 'integer' }
        }
      },
      Publicacao: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          processoId: { type: 'string', format: 'uuid' },
          numeroProcesso: { type: 'string' },
          tribunal: { type: 'string', nullable: true },
          homepageTribunal: { type: 'string', format: 'uri', nullable: true },
          linkInteiroTeor: { type: 'string', format: 'uri', nullable: true },
          nomeOrgao: { type: 'string', nullable: true },
          nomeClasse: { type: 'string', nullable: true },
          tipoComunicacao: { type: 'string' },
          dataDisponibilizacao: { type: 'string', format: 'date', nullable: true },
          dataPublicacao: { type: 'string', format: 'date', nullable: true },
          texto: { type: 'string', description: 'Texto convertido de HTML para plain text.' },
          partes: { type: 'array', items: { type: 'object' } },
          hash: { type: 'string', nullable: true, description: 'Usar com o link de certidão que o front já possui.' },
          statusLeitura: { type: 'string' },
          textoParaCopiar: { type: 'string', description: 'Inclui partes, exceto para Intimação.' },
          estimativaPrazoFinal: {
            type: 'object',
            properties: {
              status: {
                type: 'string',
                enum: ['CALCULADA_POR_PRAZO_EXPRESSO', 'REGRA_LEGAL_PENDENTE', 'SEM_DATA_PUBLICACAO']
              },
              dataFinal: { type: 'string', format: 'date', nullable: true },
              diasUteis: { type: 'integer', nullable: true },
              mensagem: { type: 'string' }
            }
          }
        }
      }
    }
  }
} as const;