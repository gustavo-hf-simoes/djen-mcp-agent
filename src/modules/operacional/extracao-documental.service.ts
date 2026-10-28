import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config();

export interface DadosQualificacaoExtraidos {
  tipoDocumentoDetectado: 'CNH' | 'RG' | 'COMPROVANTE_RESIDENCIA' | 'OUTRO';
  nomeCompleto?: string;
  cpf?: string;
  rg?: string;
  orgaoEmissor?: string;
  dataNascimento?: string;
  filiacaoMae?: string;
  filiacaoPai?: string;
  nacionalidade?: string;
  cnhNumero?: string;
  endereco?: string;
  cidade?: string;
  uf?: string;
  cep?: string;
  confianca: 'ALTA' | 'MEDIA' | 'BAIXA';
  observacoes?: string;
}

export function validarCpf(cpfRaw?: string): boolean {
  if (!cpfRaw) return false;
  const cpf = cpfRaw.replace(/\D/g, '');
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  let soma = 0;
  for (let i = 0; i < 9; i++) {
    soma += parseInt(cpf.charAt(i), 10) * (10 - i);
  }
  let resto = 11 - (soma % 11);
  let dv1 = resto === 10 || resto === 11 ? 0 : resto;
  if (dv1 !== parseInt(cpf.charAt(9), 10)) return false;

  soma = 0;
  for (let i = 0; i < 10; i++) {
    soma += parseInt(cpf.charAt(i), 10) * (11 - i);
  }
  resto = 11 - (soma % 11);
  let dv2 = resto === 10 || resto === 11 ? 0 : resto;
  return dv2 === parseInt(cpf.charAt(10), 10);
}

export function formatarCpf(cpfRaw?: string): string {
  if (!cpfRaw) return '';
  const digits = cpfRaw.replace(/\D/g, '');
  if (digits.length !== 11) return cpfRaw;
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

export async function extrairDadosDocumento(
  caminhoArquivo: string,
  mimeType = 'image/jpeg'
): Promise<DadosQualificacaoExtraidos | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('[ExtracaoDocumental] GEMINI_API_KEY não encontrada no .env');
    return null;
  }

  if (!fs.existsSync(caminhoArquivo)) {
    console.warn('[ExtracaoDocumental] Arquivo não encontrado:', caminhoArquivo);
    return null;
  }

  const fileBytes = fs.readFileSync(caminhoArquivo);
  const base64Data = fileBytes.toString('base64');

  const prompt = `Você é um perito em análise e extração de documentos civis e judiciais brasileiros (CNH, RG, Comprovante de Residência).
Analise rigorosamente a imagem fornecida e extraia todos os dados cadastrais legíveis.

Retorne EXCLUSIVAMENTE um objeto JSON válido (sem tags markdown, sem blocos de código) no seguinte formato exato:
{
  "tipoDocumentoDetectado": "CNH",
  "nomeCompleto": "NOME COMPLETO EM MAIÚSCULAS",
  "cpf": "000.000.000-00",
  "rg": "NÚMERO DO RG",
  "orgaoEmissor": "ÓRGÃO EMISSOR/UF",
  "dataNascimento": "DD/MM/AAAA",
  "filiacaoMae": "NOME DA MÃE",
  "filiacaoPai": "NOME DO PAI",
  "nacionalidade": "brasileiro(a)",
  "cnhNumero": "NÚMERO DO REGISTRO CNH",
  "endereco": "LOGRADOURO, NÚMERO, BAIRRO",
  "cidade": "CIDADE",
  "uf": "UF",
  "cep": "00000-000",
  "confianca": "ALTA",
  "observacoes": "breve nota explicativa"
}

Se algum campo não constar ou não estiver legível, preencha como null.`;

  const modelos = ['gemini-3.5-flash', 'gemini-flash-latest'];

  for (const modelo of modelos) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inline_data: {
                    mime_type: mimeType,
                    data: base64Data
                  }
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.1
          }
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        console.warn(`[ExtracaoDocumental] Modelo ${modelo} retornou ${response.status}:`, errText);
        continue;
      }

      const data = (await response.json()) as any;
      const parts = data.candidates?.[0]?.content?.parts ?? [];
      const textPart = parts.find((p: any) => typeof p.text === 'string' && !p.thought) ?? parts[0];
      let rawText = textPart?.text;
      if (!rawText) continue;

      // Limpa eventuais marcadores markdown
      rawText = rawText.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();

      const parsed = JSON.parse(rawText) as DadosQualificacaoExtraidos;
      if (parsed.cpf) {
        parsed.cpf = formatarCpf(parsed.cpf);
      }
      return parsed;
    } catch (error) {
      console.warn(`[ExtracaoDocumental] Erro ao tentar modelo ${modelo}:`, (error as Error).message);
    }
  }

  return null;
}
