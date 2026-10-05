/**
 * Controle de escolha de férias — FÉRIAS-2027
 * Cole todo este arquivo em Extensões > Apps Script da planilha.
 */

const CONFIG = {
  abaFerias: 'FERIAS 2027',
  abaRegras: 'REGRAS',
  descricaoProtecao: 'CONTROLE_FERIAS_2027',
  maxSemanas: 2,
  siglasUmaSemana: ['BA', 'FR', 'GB', 'L2', 'LD', 'LC', 'LU', 'MA', 'RA', 'RC', 'RO', 'WE', 'DN', 'AL'],
  sequenciaMarcacao: ['CR', 'AD', 'LH', 'FR', 'DE', 'LE', 'RO', 'AA', 'MA', 'RA', 'LU', 'LC', 'FL', 'L2', 'RL', 'MH', 'RC', 'LD', 'DN', 'WE', 'BA', 'GU', 'JA', 'IG', 'AL', 'GB'],
  mesesBloqueados: ['janeiro', 'julho'],
  linhas: {
    janeiro: [5, 6, 7, 8], fevereiro: [5, 6, 7, 8],
    marco: [13, 14, 15, 16, 17], abril: [13, 14, 15, 16],
    maio: [22, 23, 24, 25], junho: [22, 23, 24, 25, 26],
    julho: [31, 32, 33, 34], agosto: [31, 32, 33, 34, 35],
    setembro: [39, 40, 41, 42, 43], outubro: [39, 40, 41, 42],
    novembro: [48, 49, 50, 51, 52], dezembro: [48, 49, 50, 51, 52]
  },
  colunas: {
    janeiro: [3, 4, 5], fevereiro: [9, 10, 11],
    marco: [3, 4, 5], abril: [9, 10, 11],
    maio: [3, 4, 5], junho: [9, 10, 11],
    julho: [3, 4, 5], agosto: [9, 10, 11],
    setembro: [3, 4, 5], outubro: [9, 10, 11],
    novembro: [3, 4, 5], dezembro: [9, 10, 11]
  }
};

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Controle de férias')
    .addItem('Instalar / atualizar controle', 'instalarControleFerias')
    .addItem('Atualizar liberações', 'atualizarControleFerias')
    .addItem('Executar testes', 'executarTestes')
    .addToUi();
}

function instalarControleFerias() {
  const planilha = SpreadsheetApp.getActive();
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'onEditFerias')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('onEditFerias').forSpreadsheet(planilha).onEdit().create();
  atualizarControleFerias();
  planilha.toast('Controle instalado. As vagas liberadas estão prontas para escolha.', 'Férias 2027', 8);
}

function atualizarControleFerias() {
  const planilha = SpreadsheetApp.getActive();
  const ferias = planilha.getSheetByName(CONFIG.abaFerias);
  const regras = planilha.getSheetByName(CONFIG.abaRegras);
  if (!ferias || !regras) throw new Error('Não localizei as abas FERIAS 2027 e REGRAS.');

  const validacao = SpreadsheetApp.newDataValidation()
    .requireValueInRange(regras.getRange('A2:A100'), true)
    .setAllowInvalid(false)
    .build();

  todasVagas_().forEach(vaga => ferias.getRange(vaga.linha, vaga.coluna).setDataValidation(validacao));
  protegerAbaRegras_(regras);
  protegerAbaFerias_(ferias, obterVagasLiberadas_(ferias));
}

function onEditFerias(e) {
  const range = e && e.range;
  if (!range || range.getSheet().getName() !== CONFIG.abaFerias) return;
  if (range.getNumRows() !== 1 || range.getNumColumns() !== 1) {
    range.clearContent();
    avisar_(range.getSheet(), 'Edite somente uma vaga por vez.');
    return;
  }
  const vaga = localizarVaga_(range.getRow(), range.getColumn());
  if (!vaga) return;

  // Células já preenchidas ficam protegidas para editores. Este retorno permite
  // ao proprietário realizar uma correção excepcional e atualizar em seguida.
  if (e.oldValue !== undefined) return;

  const sigla = normalizarSigla_(range.getDisplayValue());
  if (!sigla) return;
  // A rodada é calculada como se a célula recém-editada ainda estivesse vazia.
  // Assim, a última SIGLA 1 é aceita e, em seguida, abre a rodada conjunta.
  const rodada = rodadaAtual_(range.getSheet(), range.getA1Notation());
  if (!vagaPermitidaNaRodada_(vaga, rodada)) {
    range.clearContent();
    avisar_(range.getSheet(), 'Esta vaga ainda não está liberada.');
    return;
  }

  const regras = mapaRegras_();
  const semanasJaMarcadas = contarSemanasDaSigla_(range.getSheet(), sigla, range.getA1Notation());
  if (atingiuLimiteSemanas_(semanasJaMarcadas, sigla)) {
    range.clearContent();
    const limite = limiteSemanasPorSigla_(sigla);
    avisar_(range.getSheet(), sigla + ' já atingiu o limite de ' + limite + (limite === 1 ? ' semana' : ' semanas') + ' nesta rodada.');
    return;
  }
  const antecedentePendente = antecedentePendenteSequencia_(contarSemanasPorSigla_(range.getSheet()), sigla);
  if (antecedentePendente) {
    range.clearContent();
    const semanasNecessarias = limiteSemanasPorSigla_(antecedentePendente);
    avisar_(range.getSheet(), 'Aguarde ' + antecedentePendente + ' completar a cota de ' + semanasNecessarias + (semanasNecessarias === 1 ? ' semana' : ' semanas') + ' desta rodada antes de liberar ' + sigla + '.');
    return;
  }
  const outrasSiglas = siglasDaSemana_(range.getSheet(), vaga, range.getA1Notation());
  const resultado = validarConjuntoSemana_(outrasSiglas, sigla, regras, deveValidarCoincidencia_(rodada));
  if (!resultado.valido) {
    range.clearContent();
    avisar_(range.getSheet(), resultado.mensagem);
    return;
  }

  range.setValue(sigla);
  atualizarControleFerias();
  avisar_(range.getSheet(), 'Escolha confirmada: ' + sigla + '.');
}

function obterVagasLiberadas_(aba) {
  const rodada = rodadaAtual_(aba);
  const liberadas = [];
  todasVagas_().forEach(vaga => {
    const range = aba.getRange(vaga.linha, vaga.coluna);
    if (range.getDisplayValue().trim()) return;
    if (vagaPermitidaNaRodada_(vaga, rodada)) liberadas.push(range);
  });
  return liberadas;
}

function rodadaAtual_(aba, a1Ignorado = '') {
  const vagasIniciais = todasVagas_()
    .filter(vaga => !mesBloqueado_(vaga.mes) && vaga.indiceSigla === 0);
  const todasPreenchidas = vagasIniciais.every(vaga => {
    const range = aba.getRange(vaga.linha, vaga.coluna);
    return range.getA1Notation() === a1Ignorado || normalizarSigla_(range.getDisplayValue());
  });
  return todasPreenchidas ? 'conjunta' : 'individual';
}

function vagaPermitidaNaRodada_(vaga, rodada) {
  if (mesBloqueado_(vaga.mes)) return false;
  return rodada === 'individual' ? vaga.indiceSigla === 0 : vaga.indiceSigla > 0;
}

function mesBloqueado_(mes) {
  return CONFIG.mesesBloqueados.includes(mes);
}

function deveValidarCoincidencia_(rodada) {
  return rodada === 'conjunta';
}

function limiteSemanasPorSigla_(sigla) {
  return CONFIG.siglasUmaSemana.includes(normalizarSigla_(sigla)) ? 1 : CONFIG.maxSemanas;
}

function atingiuLimiteSemanas_(semanasJaMarcadas, sigla) {
  return semanasJaMarcadas >= limiteSemanasPorSigla_(sigla);
}

function contarSemanasPorSigla_(aba) {
  const contagem = {};
  Object.keys(CONFIG.linhas).filter(mes => !mesBloqueado_(mes)).forEach(mes => {
    const linhas = CONFIG.linhas[mes];
    const colunas = CONFIG.colunas[mes];
    aba.getRange(linhas[0], colunas[0], linhas.length, colunas.length).getDisplayValues().forEach(linha => {
      linha.forEach(valor => {
        const sigla = normalizarSigla_(valor);
        if (sigla) contagem[sigla] = (contagem[sigla] || 0) + 1;
      });
    });
  });
  return contagem;
}

function antecedentePendenteSequencia_(contagem, sigla) {
  const indice = CONFIG.sequenciaMarcacao.indexOf(normalizarSigla_(sigla));
  if (indice < 0) return '';
  return CONFIG.sequenciaMarcacao.slice(0, indice).find(anterior =>
    Number(contagem[anterior] || 0) < limiteSemanasPorSigla_(anterior)
  ) || '';
}

function validarConjuntoSemana_(siglasExistentes, siglaNova, regras, validarCoincidencia = true) {
  const nova = normalizarSigla_(siglaNova);
  if (!regras[nova]) return { valido: false, mensagem: 'A sigla ' + nova + ' não existe na aba REGRAS.' };
  const existentes = siglasExistentes.map(normalizarSigla_).filter(Boolean);
  if (existentes.includes(nova)) return { valido: false, mensagem: 'A sigla ' + nova + ' já está nesta semana.' };
  if (!validarCoincidencia) return { valido: true, mensagem: '' };
  for (const existente of existentes) {
    const coincidencia = contarDiasCoincidentes_(regras[existente], regras[nova], existente, nova);
    if (coincidencia > 3) {
      const dias = String(coincidencia).replace('.', ',');
      const unidade = coincidencia === 1 || coincidencia < 1 ? 'dia útil' : 'dias úteis';
      return { valido: false, mensagem: existente + ' e ' + nova + ' coincidem em ' + dias + ' ' + unidade + '; o limite é 3 dias úteis.' };
    }
  }
  return { valido: true, mensagem: '' };
}

function contarDiasCoincidentes_(diasA, diasB, siglaA, siglaB) {
  const a = normalizarSigla_(siglaA);
  const b = normalizarSigla_(siglaB);
  const paresMeioDiaPorDia = [
    [['CH', 'FL']],
    [['RO', 'AA']],
    [['DE', 'BA'], ['LC', 'GU']],
    [['RO', 'AA']],
    [['L2', 'BA'], ['GB', 'AA']]
  ];
  return diasA.reduce((total, dia, indice) => {
    if (!dia || !diasB[indice]) return total;
    const contaMeioDia = (paresMeioDiaPorDia[indice] || []).some(par =>
      (par[0] === a && par[1] === b) || (par[0] === b && par[1] === a)
    );
    return total + (contaMeioDia ? 0.5 : 1);
  }, 0);
}

function normalizarSigla_(valor) {
  return String(valor || '').trim().toUpperCase();
}

function mapaRegras_() {
  const aba = SpreadsheetApp.getActive().getSheetByName(CONFIG.abaRegras);
  const valores = aba.getRange(2, 1, Math.max(aba.getLastRow() - 1, 1), 6).getDisplayValues();
  return valores.reduce((mapa, linha) => {
    const sigla = normalizarSigla_(linha[0]);
    if (sigla) mapa[sigla] = linha.slice(1, 6).map(valor => normalizarSigla_(valor) === 'X' ? 1 : 0);
    return mapa;
  }, {});
}

function todasVagas_() {
  return Object.keys(CONFIG.linhas).flatMap(mes =>
    CONFIG.linhas[mes].flatMap(linha => CONFIG.colunas[mes].map((coluna, indiceSigla) => ({ mes, linha, coluna, indiceSigla })))
  );
}

function localizarVaga_(linha, coluna) {
  return todasVagas_().find(vaga => vaga.linha === linha && vaga.coluna === coluna) || null;
}

function valoresDaColuna_(aba, mes, indiceSigla) {
  return CONFIG.linhas[mes].map(linha => aba.getRange(linha, CONFIG.colunas[mes][indiceSigla]).getDisplayValue());
}

function siglasDaSemana_(aba, vaga, a1Excluido) {
  return CONFIG.colunas[vaga.mes]
    .map(coluna => aba.getRange(vaga.linha, coluna))
    .filter(range => range.getA1Notation() !== a1Excluido)
    .map(range => range.getDisplayValue())
    .filter(Boolean);
}

function contarSemanasDaSigla_(aba, sigla, a1Excluido = '') {
  const procurada = normalizarSigla_(sigla);
  return todasVagas_().reduce((total, vaga) => {
    if (mesBloqueado_(vaga.mes)) return total;
    const range = aba.getRange(vaga.linha, vaga.coluna);
    if (range.getA1Notation() === a1Excluido) return total;
    return total + (normalizarSigla_(range.getDisplayValue()) === procurada ? 1 : 0);
  }, 0);
}

function protegerAbaFerias_(aba, vagasLiberadas) {
  const protecao = obterProtecao_(aba);
  protecao.setUnprotectedRanges(vagasLiberadas);
}

function protegerAbaRegras_(aba) {
  obterProtecao_(aba).setUnprotectedRanges([]);
}

function obterProtecao_(aba) {
  let protecao = aba.getProtections(SpreadsheetApp.ProtectionType.SHEET)
    .find(p => p.getDescription() === CONFIG.descricaoProtecao);
  if (!protecao) {
    protecao = aba.protect().setDescription(CONFIG.descricaoProtecao);
    protecao.getEditors().forEach(editor => protecao.removeEditor(editor));
    if (protecao.canDomainEdit()) protecao.setDomainEdit(false);
  }
  return protecao;
}

function avisar_(aba, mensagem) {
  aba.getParent().toast(mensagem, 'Férias 2027', 8);
}

function executarTestes() {
  const regras = { FR: [1, 1, 1, 1, 0], AA: [1, 1, 1, 0, 0], BA: [1, 1, 0, 0, 0] };
  const testes = [
    () => !validarConjuntoSemana_(['FR'], 'ZZ', regras).valido,
    () => !validarConjuntoSemana_(['FR'], 'FR', regras).valido,
    () => validarConjuntoSemana_(['FR'], 'AA', regras).valido,
    () => validarConjuntoSemana_(['FR'], 'BA', regras).valido,
    () => vagaPermitidaNaRodada_({ mes: 'fevereiro', indiceSigla: 0 }, 'individual'),
    () => !vagaPermitidaNaRodada_({ mes: 'janeiro', indiceSigla: 0 }, 'individual'),
    () => vagaPermitidaNaRodada_({ mes: 'fevereiro', indiceSigla: 1 }, 'conjunta'),
    () => !deveValidarCoincidencia_('individual') && deveValidarCoincidencia_('conjunta'),
    () => !atingiuLimiteSemanas_(1, 'AA') && atingiuLimiteSemanas_(2, 'AA')
  ];
  if (!testes.every(teste => teste())) throw new Error('Falha em um teste interno do controle de férias.');
  SpreadsheetApp.getActive().toast('Testes internos aprovados.', 'Férias 2027', 6);
}
