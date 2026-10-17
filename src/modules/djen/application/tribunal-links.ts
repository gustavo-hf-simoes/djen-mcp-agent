const HOMEPAGES_TRIBUNAIS: Readonly<Record<string, string>> = {
  STF: 'https://portal.stf.jus.br/',
  STJ: 'https://www.stj.jus.br/',
  TST: 'https://www.tst.jus.br/',
  TSE: 'https://www.tse.jus.br/',
  STM: 'https://www.stm.jus.br/',
  TJAC: 'https://www.tjac.jus.br/',
  TJAL: 'https://www.tjal.jus.br/',
  TJAP: 'https://www.tjap.jus.br/',
  TJAM: 'https://www.tjam.jus.br/',
  TJBA: 'https://www.tjba.jus.br/',
  TJCE: 'https://www.tjce.jus.br/',
  TJDFT: 'https://www.tjdft.jus.br/',
  TJES: 'https://www.tjes.jus.br/',
  TJGO: 'https://www.tjgo.jus.br/',
  TJMA: 'https://www.tjma.jus.br/',
  TJMG: 'https://www.tjmg.jus.br/',
  TJMS: 'https://www.tjms.jus.br/',
  TJMT: 'https://www.tjmt.jus.br/',
  TJPA: 'https://www.tjpa.jus.br/',
  TJPB: 'https://www.tjpb.jus.br/',
  TJPE: 'https://www.tjpe.jus.br/',
  TJPI: 'https://www.tjpi.jus.br/',
  TJPR: 'https://www.tjpr.jus.br/',
  TJRJ: 'https://www.tjrj.jus.br/',
  TJRN: 'https://www.tjrn.jus.br/',
  TJRO: 'https://www.tjro.jus.br/',
  TJRR: 'https://www.tjrr.jus.br/',
  TJRS: 'https://www.tjrs.jus.br/',
  TJSC: 'https://www.tjsc.jus.br/',
  TJSE: 'https://www.tjse.jus.br/',
  TJSP: 'https://www.tjsp.jus.br/',
  TJTO: 'https://www.tjto.jus.br/',
  TRF1: 'https://www.trf1.jus.br/',
  TRF2: 'https://www.trf2.jus.br/',
  TRF3: 'https://www.trf3.jus.br/',
  TRF4: 'https://www.trf4.jus.br/',
  TRF5: 'https://www.trf5.jus.br/',
  TRF6: 'https://portal.trf6.jus.br/'
};

export function homepageTribunal(sigla: string | null | undefined): string | null {
  return sigla ? HOMEPAGES_TRIBUNAIS[sigla.trim().toUpperCase()] ?? null : null;
}

export function listarTribunaisMapeados(): Array<{ sigla: string; homepage: string }> {
  return Object.entries(HOMEPAGES_TRIBUNAIS)
    .map(([sigla, homepage]) => ({ sigla, homepage }))
    .sort((left, right) => left.sigla.localeCompare(right.sigla));
}