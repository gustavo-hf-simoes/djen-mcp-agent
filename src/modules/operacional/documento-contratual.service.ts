import { DEFAULT_ASO_LOGO_DATA_URL } from '../auth/auth.service';

export interface DadosContratuaisCliente {
  nomeCliente: string;
  nacionalidade?: string;
  estadoCivil?: string;
  rg?: string;
  cpf?: string;
  endereco?: string;
  cidade?: string;
  estadoUf?: string;
  cep?: string;
  telefone?: string;
  email?: string;
  tipoCaso?: string;
  dataExtenso?: string;
  resumoFatos?: string;
  dadosEscritorio?: {
    nomeEscritorio?: string;
    logoUrl?: string;
    advogadoTitular?: string;
    oabNumero?: string;
    oabUf?: string;
    enderecoProfissional?: string;
    emailContato?: string;
    telefoneContato?: string;
  };
}

export function formatarDataExtenso(date = new Date()): string {
  const dia = date.getDate();
  const meses = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
  ];
  const mes = meses[date.getMonth()];
  const ano = date.getFullYear();
  return `${dia} de ${mes} de ${ano}`;
}

export function gerarHtmlKitContratualAso(dados: DadosContratuaisCliente): string {
  const dataExtenso = dados.dataExtenso ?? formatarDataExtenso();
  const nomeCliente = (dados.nomeCliente || 'CONTRATANTE').toUpperCase();
  const nacionalidade = dados.nacionalidade || 'brasileiro(a)';
  const estadoCivil = dados.estadoCivil || 'casado(a)';
  const rg = dados.rg || 'RG a confirmar';
  const cpf = dados.cpf || 'CPF a confirmar';
  const endereco = dados.endereco || 'Endereço residencial a confirmar';
  const cidade = dados.cidade || 'Londrina';
  const uf = dados.estadoUf || 'Paraná';
  const cep = dados.cep ? `CEP ${dados.cep}` : '';
  const telefone = dados.telefone || '(43) 9 9999-9999';
  const email = dados.email || 'sem endereço eletrônico cadastrado';

  const nomeEscritorio = dados.dadosEscritorio?.nomeEscritorio || 'ASO Advogados';
  const logoEscritorio = dados.dadosEscritorio?.logoUrl || DEFAULT_ASO_LOGO_DATA_URL;
  const advogadoTitular = (dados.dadosEscritorio?.advogadoTitular || 'ANDRÉ SANTOS DE OLIVEIRA').toUpperCase();
  const oabNumero = dados.dadosEscritorio?.oabNumero || '69.161';
  const oabUf = dados.dadosEscritorio?.oabUf || 'PR';
  const enderecoProfissional = dados.dadosEscritorio?.enderecoProfissional || 'Rua Pedro Rossato, nº 55, unidade 20, CEP 86.084-016, na cidade de Londrina/PR';
  const emailProfissional = dados.dadosEscritorio?.emailContato || 'andreolicontato@gmail.com';
  const telefoneProfissional = dados.dadosEscritorio?.telefoneContato || '(44) 9 9850-7150';

  let objetoCaso = 'questões bancárias e de consumo';
  let poderesEspecificos = 'propor ações de RMC SANTANDER, RCC BANCO PAN, CONTRIBUIÇÃO SINDICAL, VENDA CASADA SEGURO, REVISÃO BANCÁRIA E DEFESA DO CONSUMIDOR';

  if (dados.tipoCaso === 'ECOMMERCE_ML') {
    objetoCaso = 'ações indenizatórias e de cobrança contra plataformas de e-commerce e intermediadoras de pagamento';
    poderesEspecificos = 'propor ações contra MERCADO LIVRE, MERCADO PAGO, SHOPEE, AMAZON, instituições financeiras e parceiros comerciais';
  } else if (dados.tipoCaso === 'TRABALHISTA') {
    objetoCaso = 'reclamatória trabalhista e verbas rescisórias perante a Justiça do Trabalho';
    poderesEspecificos = 'propor reclamação trabalhista perante a Justiça do Trabalho, pleitear verbas rescisórias, horas extras, FGTS e adicionais';
  } else if (dados.tipoCaso === 'CIVEL_CONSUMIDOR') {
    objetoCaso = 'ações indenizatórias de direito do consumidor e reparação de danos';
    poderesEspecificos = 'propor ações de reparação por danos morais e materiais, declaração de inexigibilidade de débito e exclusão de cadastros de proteção ao crédito';
  }

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>Kit Contratual & Procuração — ${nomeEscritorio} — ${nomeCliente}</title>
  <style>
    @page {
      size: A4;
      margin: 20mm 20mm 20mm 20mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      font-family: 'Times New Roman', Times, serif;
      font-size: 11pt;
      line-height: 1.5;
      color: #000;
      background: #f4f4f5;
      margin: 0;
      padding: 24px;
    }
    .sheet {
      background: #fff;
      max-width: 210mm;
      min-height: 297mm;
      margin: 0 auto 30px auto;
      padding: 25mm 22mm 25mm 22mm;
      box-shadow: 0 4px 20px rgba(0,0,0,0.12);
      position: relative;
    }
    .page-break {
      page-break-before: always;
      break-before: page;
    }
    .header-logo {
      text-align: center;
      margin-bottom: 25px;
    }
    .header-logo img {
      width: 140px;
      height: auto;
    }
    h1 {
      font-size: 13pt;
      font-weight: bold;
      text-align: center;
      letter-spacing: 0.5px;
      margin-top: 0;
      margin-bottom: 24px;
      text-transform: uppercase;
    }
    h2 {
      font-size: 11.5pt;
      font-weight: bold;
      margin-top: 18px;
      margin-bottom: 8px;
    }
    p {
      text-align: justify;
      text-justify: inter-word;
      margin-top: 0;
      margin-bottom: 12px;
      text-indent: 0;
    }
    .signature-block {
      margin-top: 45px;
      text-align: center;
    }
    .signature-line {
      width: 320px;
      border-top: 1px solid #000;
      margin: 0 auto 6px auto;
    }
    .footer-stamp {
      margin-top: 35px;
      padding-top: 10px;
      border-top: 1px dashed #ccc;
      font-size: 8pt;
      color: #666;
      font-family: Arial, sans-serif;
      text-align: center;
    }
    .witness-grid {
      display: flex;
      justify-content: space-between;
      margin-top: 40px;
      font-size: 9pt;
      font-family: Arial, sans-serif;
    }
    .witness-box {
      width: 45%;
      border-top: 1px solid #000;
      padding-top: 4px;
    }
    .no-print-bar {
      max-width: 210mm;
      margin: 0 auto 16px auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #211E4A;
      color: #fff;
      padding: 12px 20px;
      border-radius: 12px;
      font-family: Arial, sans-serif;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    .btn-print {
      background: #e09f3e;
      color: #000;
      border: none;
      padding: 8px 18px;
      font-weight: bold;
      font-size: 13px;
      border-radius: 8px;
      cursor: pointer;
      transition: opacity 0.2s;
    }
    .btn-print:hover {
      opacity: 0.9;
    }
    @media print {
      body {
        background: #fff;
        padding: 0;
      }
      .sheet {
        margin: 0;
        box-shadow: none;
        padding: 0;
        min-height: auto;
      }
      .no-print-bar {
        display: none !important;
      }
    }
  </style>
</head>
<body>

  <div class="no-print-bar">
    <div>
      <strong>${nomeEscritorio}</strong> — Kit Contratual Gerado para <strong>${nomeCliente}</strong>
      <div style="font-size: 11px; opacity: 0.8; margin-top: 2px;">
        Pronto para conferência, impressão em PDF ou envio para assinatura digital (ZapSign / Clicksign / Gov.br)
      </div>
    </div>
    <button class="btn-print" onclick="window.print()">🖨️ Imprimir / Salvar em PDF</button>
  </div>

  <!-- PÁGINA 1: PROCURAÇÃO "AD JUDICIA" -->
  <div class="sheet">
    <div class="header-logo">
      <img src="${logoEscritorio}" alt="${nomeEscritorio}">
    </div>

    <h1>PROCURAÇÃO "AD JUDICIA"</h1>

    <p>
      Através do presente instrumento particular de mandato, <strong>${nomeCliente}</strong>,
      ${nacionalidade}, ${estadoCivil}, portador(a) do RG nº ${rg}, inscrito(a) no CPF sob nº <strong>${cpf}</strong>,
      residente e domiciliado(a) no(a) ${endereco}, ${cidade}/${uf}, ${cep}, telefone/WhatsApp ${telefone},
      e-mail: ${email}, nomeia e constitui como seu bastante procurador:
    </p>

    <p>
      <strong>${advogadoTitular}</strong>, advogado(a) devidamente inscrito(a) na Ordem dos Advogados do Brasil
      sob <strong>OAB/${oabUf} ${oabNumero}</strong>, com escritório profissional situado no(a) ${enderecoProfissional},
      e-mail: <em>${emailProfissional}</em>, telefone ${telefoneProfissional},
    </p>

    <p>
      <strong>PODERES:</strong> outorgando-lhe amplos poderes, inerentes ao bom e fiel cumprimento deste mandato,
      bem como para o foro em geral, e os especiais para transigir, fazer acordo, firmar compromisso, substabelecer,
      renunciar, requerer os benefícios da justiça gratuita, desistir, reconhecer a procedência do pedido, receber
      intimações, receber e dar quitação, praticar todos atos perante repartições públicas Federais, Estaduais e Municipais,
      e órgãos da administração pública direta e indireta, praticar quaisquer atos perante particulares ou empresas privadas,
      recorrer a quaisquer instâncias e tribunais, podendo atuar em conjunto ou separadamente,
      <strong>RENUNCIAR AOS VALORES QUE ULTRAPASSEM O MÁXIMO PREVISTO NAS LEIS 9.099/95 E 10.529/01</strong>,
      dando tudo por bom e valioso, especialmente, ${poderesEspecificos}.
    </p>

    <p style="text-align: right; margin-top: 35px;">
      ${cidade}, ${uf}, ${dataExtenso}.
    </p>

    <div class="signature-block">
      <div class="signature-line"></div>
      <strong>${nomeCliente}</strong><br>
      Outorgante
    </div>

    <div class="footer-stamp">
      Documento integrado via GHFS Jurídico para ASO Advogados · OAB/PR 69.161 · Validade jurídica conforme MP 2.200-2/2001 e Lei 14.063/2020.
    </div>
  </div>

  <!-- PÁGINA 2: DECLARAÇÃO DE HIPOSSUFICIÊNCIA & DECLARAÇÃO DE RESIDÊNCIA -->
  <div class="sheet page-break">
    <div class="header-logo">
      <img src="${DEFAULT_ASO_LOGO_DATA_URL}" alt="ASO Advogados">
    </div>

    <h1>DECLARAÇÃO DE HIPOSSUFICIÊNCIA</h1>

    <p>
      Eu, <strong>${nomeCliente}</strong>, ${nacionalidade}, ${estadoCivil}, portador(a) do RG nº ${rg},
      inscrito(a) no CPF sob nº <strong>${cpf}</strong>, residente e domiciliado(a) no(a) ${endereco}, ${cidade}/${uf},
      ${cep}, <strong>DECLARO</strong>, para todos os fins de direito e sob as penas da lei, que não tenho condições
      de arcar com as despesas inerentes ao presente processo, sem prejuízo do meu sustento e de minha família,
      necessitando, portanto, da <strong>GRATUIDADE DA JUSTIÇA</strong>, nos termos do art. 98 e seguintes da Lei 13.105/2015
      (Código de Processo Civil). Requeiro, ainda, que o benefício abranja a todos os atos do processo.
    </p>

    <p style="text-align: right; margin-top: 25px;">
      ${cidade}, ${uf}, ${dataExtenso}.
    </p>

    <div class="signature-block" style="margin-top: 30px;">
      <div class="signature-line"></div>
      <strong>${nomeCliente}</strong>
    </div>

    <div style="margin-top: 50px; border-top: 1px solid #e5e7eb; padding-top: 30px;">
      <h1>DECLARAÇÃO DE RESIDÊNCIA</h1>

      <p>
        Eu, <strong>${nomeCliente}</strong>, ${nacionalidade}, ${estadoCivil}, portador(a) do RG nº ${rg},
        inscrito(a) no CPF sob nº <strong>${cpf}</strong>, <strong>declaro sob as penas da Lei 7.115/1983</strong>,
        ser residente e domiciliado(a) no(a) ${endereco}, ${cidade}/${uf}, ${cep}, estando ciente que em caso de
        falsa declaração estarei sujeito(a) às sanções civis, administrativas e criminais previstas na legislação aplicável.
      </p>

      <p style="text-align: right; margin-top: 25px;">
        ${cidade}, ${uf}, ${dataExtenso}.
      </p>

      <div class="signature-block" style="margin-top: 30px;">
        <div class="signature-line"></div>
        <strong>${nomeCliente}</strong>
      </div>
    </div>

    <div class="footer-stamp">
      ASO Advogados · Londrina/PR · Relatório preparado para assinatura eletrônica (ZapSign / Clicksign / Gov.br).
    </div>
  </div>

  <!-- PÁGINA 3: CONTRATO DE HONORÁRIOS DE PRESTAÇÃO DE SERVIÇOS ADVOCATÍCIOS -->
  <div class="sheet page-break">
    <div class="header-logo">
      <img src="${DEFAULT_ASO_LOGO_DATA_URL}" alt="ASO Advogados">
    </div>

    <h1>CONTRATO DE HONORÁRIOS DE PRESTAÇÃO DE SERVIÇOS ADVOCATÍCIOS</h1>

    <p>
      Pelo presente instrumento particular de contrato de prestação de serviços advocatícios, de um lado:
    </p>

    <p>
      <strong>CONTRATADO: ANDRÉ SANTOS DE OLIVEIRA</strong>, brasileiro, casado, advogado com registro profissional
      na Ordem dos Advogados do Brasil sob nº <strong>OAB/PR 69.161</strong>, com escritório profissional situado na
      Rua Pedro Rossato, nº 55, unidade 20, CEP 86.084-016, na cidade de Londrina/PR, e-mail:
      <em>andreolicontato@gmail.com</em>, telefone: (44) 9 9850-7150, doravante denominado <strong>CONTRATADO</strong>;
    </p>

    <p>
      E, de outro lado:
    </p>

    <p>
      <strong>CONTRATANTE: ${nomeCliente}</strong>, ${nacionalidade}, ${estadoCivil}, inscrito(a) no CPF sob nº
      <strong>${cpf}</strong>, portador(a) do RG nº ${rg}, residente e domiciliado(a) no(a) ${endereco},
      ${cidade}/${uf}, ${cep}, telefone/WhatsApp ${telefone}, e-mail: ${email}, doravante denominado(a)
      <strong>CONTRATANTE</strong>.
    </p>

    <p>
      Resolvem firmar o presente contrato de prestação de serviços advocatícios, mediante as cláusulas e condições seguintes:
    </p>

    <h2>1. DO OBJETO</h2>
    <p>
      O presente contrato tem por objeto a prestação de serviços advocatícios pelo CONTRATADO ao CONTRATANTE,
      para representação em processos judiciais e administrativos envolvendo ${objetoCaso}, notadamente:
    </p>
    <p>
      a) Análise e organização de toda a documentação relevante para defesa em processo administrativo e/ou judicial,
      incluindo os recursos necessários;<br>
      b) Acompanhamento integral do processo até sua conclusão.
    </p>

    <h2>2. DOS HONORÁRIOS</h2>
    <p>
      Para os serviços especificados, convenciona-se o valor de <strong>30% (trinta por cento)</strong> sobre a
      redução/economia gerada ou sobre o proveito econômico obtido na demanda com os serviços ora contratados,
      sendo devido o pagamento, <strong>exclusivamente, em caso de êxito</strong>.
    </p>
    <p>
      2.1. Qualquer quantia depositada por instituição financeira, que seja demandada administrativa ou judicialmente
      pelo contratante, diretamente em sua conta bancária após a celebração deste instrumento, as partes presumirão
      ser fruto das tratativas do contratado com a instituição financeira, ainda que iniciadas antes da contratação,
      devendo ser pagos os honorários convencionados neste contrato em até um dia útil após o recebimento.
    </p>

    <h2>3. DAS OBRIGAÇÕES DO CONTRATADO</h2>
    <p>
      O CONTRATADO compromete-se a:<br>
      a) Representar a CONTRATANTE com diligência e ética em todas as fases administrativas e judiciais;<br>
      b) Manter a CONTRATANTE informada sobre o andamento dos processos e providências adotadas;<br>
      c) Zelar pelo sigilo e confidencialidade das informações fornecidas pela CONTRATANTE.
    </p>

    <h2>4. DAS OBRIGAÇÕES DA CONTRATANTE</h2>
    <p>
      A CONTRATANTE compromete-se a:<br>
      a) Fornecer ao CONTRATADO todas as informações e documentos necessários para a atuação;<br>
      b) Informar eventual alteração em seu endereço e telefone, assumindo toda responsabilidade por danos decorrentes
      da dificuldade de sua localização;<br>
      c) Informar o CONTRATADO dos resultados das defesas/recursos administrativos pelo menos 5 (cinco) dias antes
      do término do prazo assinalado;<br>
      d) Realizar o pagamento dos honorários conforme os prazos estipulados neste contrato.
    </p>

    <h2>5. DA RESCISÃO</h2>
    <p>
      O presente contrato poderá ser rescindido a qualquer momento por qualquer das partes, mediante aviso prévio
      por escrito de 30 (trinta) dias, sem prejuízo do pagamento dos honorários devidos até a data da rescisão.
    </p>

    <h2>6. DO FORO</h2>
    <p>
      Para dirimir quaisquer controvérsias oriundas deste contrato, as partes elegem o foro da comarca de Londrina/PR,
      com renúncia a qualquer outro, por mais privilegiado que seja.
    </p>

    <p style="text-align: right; margin-top: 30px;">
      ${cidade}/PR, Data da assinatura eletrônica.
    </p>

    <div style="display: flex; justify-content: space-between; margin-top: 50px; text-align: center;">
      <div style="width: 45%;">
        <div class="signature-line" style="width: 100%;"></div>
        <strong>ANDRÉ SANTOS DE OLIVEIRA</strong><br>
        OAB/PR 69.161 (Contratado)
      </div>
      <div style="width: 45%;">
        <div class="signature-line" style="width: 100%;"></div>
        <strong>${nomeCliente}</strong><br>
        Contratante
      </div>
    </div>

    <div class="witness-grid">
      <div class="witness-box">Testemunha 1: CPF:</div>
      <div class="witness-box">Testemunha 2: CPF:</div>
    </div>

    <div class="footer-stamp">
      Contrato padrão ASO Advogados · Validade probatória eletrônica conforme MP 2.200-2/2001 e Lei 14.063/2020.
    </div>
  </div>

</body>
</html>`;
}
