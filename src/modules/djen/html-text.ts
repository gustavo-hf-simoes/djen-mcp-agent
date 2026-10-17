import { convert } from 'html-to-text';

export function htmlParaTexto(value: unknown): string {
  if (typeof value !== 'string') return '';
  return convert(value, { wordwrap: false }).trim();
}