import { createHash } from 'node:crypto';

export interface OfficialDjenResponse {
  body: Buffer;
  sha256: string;
  json: Record<string, unknown>;
}

export function parseOfficialDjenResponse(body: Buffer): OfficialDjenResponse {
  const json: unknown = JSON.parse(body.toString('utf8'));
  if (!json || typeof json !== 'object' || Array.isArray(json)) {
    throw new Error('A resposta oficial do DJEN não é um objeto JSON.');
  }

  return {
    body,
    sha256: createHash('sha256').update(body).digest('hex'),
    json: json as Record<string, unknown>
  };
}