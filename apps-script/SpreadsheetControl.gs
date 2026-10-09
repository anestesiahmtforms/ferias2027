/**
 * Controle de escolha de férias — FÉRIAS-2027
 * Cole todo este arquivo em Extensões > Apps Script da planilha.
 */

const CONFIG = {
  abaFerias: 'FERIAS 2027',
  abaRegras: 'REGRAS',
  abaAuditoria: 'AUDITORIA_PWA',
  descricaoProtecao: 'CONTROLE_FERIAS_2027',
  maxSemanas: 2,
  maxDiasCoincidencia: 3,
  siglasUmaSemana: ['BA', 'FR', 'GB', 'L2', 'LD', 'LC', 'LU', 'MA', 'RA', 'RC', 'RO', 'WE', 'DN', 'AL'],
  sequenciaMarcacao: ['CR', 'AD', 'LH', 'FR', 'DE', 'LE', 'RO', 'AA', 'MA', 'RA', 'LU', 'LC', 'FL', 'L2', 'RL', 'MH', 'RC', 'LD', 'DN', 'WE', 'BA', 'GU', 'JA', 'IG', 'AL', 'GB'],
  siglasForaDaFila: ['CH', 'PR', 'LA', 'LO', 'RU'],
  chaveInicioFase2: 'PHASE2_SEQUENCE_START_SIGLA',
  mesesBloqueados: ['janeiro', 'julho'],
  linhas: {
    janeiro: [5, 6, 7, 8], fevereiro: [5, 6, 7, 8],
    marco: [13, 14, 15, 16, 17], abril: [13, 14, 15, 16],
    maio: [22, 23, 24, 25], junho: [22, 23, 24, 25, 26],
    julho: [31, 32, 33, 34], agosto: [31, 32, 33, 34],
    setembro: [39, 40, 41, 42, 43], outubro: [39, 40, 41, 42],
    novembro: [48, 49, 50, 51], dezembro: [48, 49, 50, 51, 52]
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
  if (!vagaPermitidaNaRodada_(vaga, rodada) || !precedentesPreenchidos_(range.getSheet(), vaga, range.getA1Notation())) {
    range.clearContent();
    avisar_(range.getSheet(), 'Esta vaga ainda não está liberada.');
    return;
  }

  const regras = mapaRegras_();
  if (vaga.indiceSigla === 2) {
    const sabado = conferirSabadoDaSemana_(range.getSheet(), vaga, sigla);
    if (!sabado.verificado || sabado.tres) {
      range.clearContent();
      avisar_(range.getSheet(), sabado.tres
        ? 'A terceira sigla não pode ser marcada: os três profissionais estão escalados no sábado.'
        : 'Não foi possível conferir a escala de sábado. Tente novamente.');
      return;
    }
  }
  const semanasJaMarcadas = contarSemanasDaSigla_(range.getSheet(), sigla, range.getA1Notation(), rodada);
  if (atingiuLimiteSemanas_(semanasJaMarcadas, sigla, rodada)) {
    range.clearContent();
    const limite = limiteSemanasPorSigla_(sigla, rodada);
    avisar_(range.getSheet(), sigla + ' já atingiu o limite de ' + limite + (limite === 1 ? ' semana' : ' semanas') + ' nesta rodada.');
    return;
  }
  const antecedentePendente = antecedentePendenteSequencia_(contarSemanasPorSigla_(range.getSheet(), rodada), sigla, rodada, range.getSheet());
  if (antecedentePendente) {
    range.clearContent();
    const semanasNecessarias = limiteSemanasPorSigla_(antecedentePendente, rodada);
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
  if (rodada === 'individual' && vaga.indiceSigla === 0 && rodadaAtual_(range.getSheet()) === 'conjunta') {
    definirInicioFase2_(range.getSheet(), sigla);
  }
  atualizarControleFerias();
  avisar_(range.getSheet(), 'Escolha confirmada: ' + sigla + '.');
}

function obterVagasLiberadas_(aba) {
  const rodada = rodadaAtual_(aba);
  const regras = mapaRegras_();
  const liberadas = [];
  todasVagas_().forEach(vaga => {
    const range = aba.getRange(vaga.linha, vaga.coluna);
    if (range.getDisplayValue().trim()) return;
    if (vagaPermitidaNaRodada_(vaga, rodada) && precedentesPreenchidos_(aba, vaga) ) liberadas.push(range);
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
  if (rodada === 'individual' && mesBloqueado_(vaga.mes)) return false;
  return rodada === 'individual' ? vaga.indiceSigla === 0 : vaga.indiceSigla > 0;
}

function mesBloqueado_(mes) {
  return CONFIG.mesesBloqueados.includes(mes);
}

function deveValidarCoincidencia_(rodada) {
  return rodada === 'conjunta';
}

function precedentesPreenchidos_(aba, vaga, a1Ignorado = '') {
  if (vaga.indiceSigla === 0) return true;
  const primeira = aba.getRange(vaga.linha, CONFIG.colunas[vaga.mes][0]);
  if (primeira.getA1Notation() === a1Ignorado || !normalizarSigla_(primeira.getDisplayValue())) return false;
  return true;
}

function coincidenciaPrimeirasDuasSiglas_(aba, vaga, regras) {
  if (vaga.indiceSigla !== 2) return 0;
  const siglas = CONFIG.colunas[vaga.mes].slice(0, 2)
    .map(coluna => normalizarSigla_(aba.getRange(vaga.linha, coluna).getDisplayValue()));
  if (!siglas[0] || !siglas[1]) return 0;
  return contarCoincidenciaTotal_(siglas, regras);
}

function vagaSigla3BloqueadaPelaTolerancia_(aba, vaga, regras) {
  return vaga.indiceSigla === 2 && coincidenciaPrimeirasDuasSiglas_(aba, vaga, regras) >= CONFIG.maxDiasCoincidencia;
}

function vagaSigla3BloqueadaNoSabado_(aba, vaga) {
  if (vaga.indiceSigla !== 2) return false;
  return CONFIG.colunas[vaga.mes].slice(0, 2)
    .every(coluna => !!normalizarSigla_(aba.getRange(vaga.linha, coluna).getDisplayValue()));
}

function conferirSabadoDaSemana_(aba, vaga, sigla) {
  const colunaPeriodo = CONFIG.colunas[vaga.mes][0] > 5 ? 8 : 2;
  const periodo = String(aba.getRange(vaga.linha, colunaPeriodo).getDisplayValue() || '');
  const partes = periodo.match(/\b\d{1,2}\s*A\s*(\d{1,2})\/(\d{1,2})\b/i);
  if (!partes) return { verificado: false, tres: false };
  const mesFinal = Number(partes[2]);
  const anoFinal = vaga.mes === 'dezembro' && mesFinal === 1 ? 2028 : 2027;
  const dataSabado = Utilities.formatDate(new Date(anoFinal, mesFinal - 1, Number(partes[1]) - 1), 'America/Sao_Paulo', 'dd/MM/yyyy');
  try {
    const planilhaSemanal = SpreadsheetApp.openById('13ymRGSscE2OOFUH6-77Q_j9J3McaDJQTIUuZVYRFbxg');
    const abaSabado = planilhaSemanal.getSheetByName('SÁBADO');
    if (!abaSabado || abaSabado.getLastRow() < 6) return { verificado: false, tres: false };
    const dados = abaSabado.getRange(6, 1, abaSabado.getLastRow() - 5, 18).getDisplayValues();
    const linha = dados.find(item => String(item[0] || '').trim() === dataSabado);
    if (!linha) return { verificado: false, tres: false };
    const escalados = new Set(linha.slice(1).map(normalizarSigla_).filter(Boolean));
    const presentes = siglasDaSemana_(aba, vaga, aba.getRange(vaga.linha, vaga.coluna).getA1Notation());
    presentes.push(sigla);
    return { verificado: true, tres: presentes.map(normalizarSigla_).filter(item => escalados.has(item)).length >= 3 };
  } catch (_error) {
    return { verificado: false, tres: false };
  }
}

function limiteSemanasPorSigla_(sigla, rodada) {
  if (rodada === 'conjunta') return CONFIG.maxSemanas;
  return CONFIG.siglasUmaSemana.includes(normalizarSigla_(sigla)) ? 1 : CONFIG.maxSemanas;
}

function atingiuLimiteSemanas_(semanasJaMarcadas, sigla, rodada) {
  return semanasJaMarcadas >= limiteSemanasPorSigla_(sigla, rodada);
}

function contarSemanasPorSigla_(aba, rodada) {
  const contagem = {};
  Object.keys(CONFIG.linhas).filter(mes => rodada === 'conjunta' || !mesBloqueado_(mes)).forEach(mes => {
    const linhas = CONFIG.linhas[mes];
    const colunas = CONFIG.colunas[mes];
    aba.getRange(linhas[0], colunas[0], linhas.length, colunas.length).getDisplayValues().forEach(linha => {
      linha.forEach((valor, indiceSigla) => {
        if (rodada === 'conjunta' ? indiceSigla === 0 : indiceSigla > 0) return;
        const sigla = normalizarSigla_(valor);
        if (sigla) contagem[sigla] = (contagem[sigla] || 0) + 1;
      });
    });
  });
  return contagem;
}

function ordemSequencia_(aba, rodada) {
  const sequencia = CONFIG.sequenciaMarcacao.slice();
  if (rodada !== 'conjunta') return sequencia;
  const contagemInicial = contarSemanasPorSigla_(aba, 'individual');
  const inicioPadrao = sequencia.find(item => Number(contagemInicial[item] || 0) < limiteSemanasPorSigla_(item, 'individual')) || sequencia[0];
  const inicio = inicioFase2Compartilhado_(aba) || PropertiesService.getScriptProperties().getProperty(CONFIG.chaveInicioFase2) || inicioPadrao;
  const indiceInicio = sequencia.indexOf(normalizarSigla_(inicio));
  return indiceInicio > 0 ? sequencia.slice(indiceInicio).concat(sequencia.slice(0, indiceInicio)) : sequencia;
}

function inicioFase2Compartilhado_(aba) {
  const auditoria = aba.getParent().getSheetByName(CONFIG.abaAuditoria);
  if (!auditoria || auditoria.getLastRow() < 2) return '';
  const registros = auditoria.getRange(2, 2, auditoria.getLastRow() - 1, 2).getDisplayValues();
  for (let indice = registros.length - 1; indice >= 0; indice -= 1) {
    if (normalizarSigla_(registros[indice][0]) === 'FASE2_INICIO') return normalizarSigla_(registros[indice][1]);
  }
  return '';
}

function definirInicioFase2_(aba, siglaFinal) {
  const indiceAtual = CONFIG.sequenciaMarcacao.indexOf(normalizarSigla_(siglaFinal));
  let proxima = indiceAtual >= 0 ? CONFIG.sequenciaMarcacao[(indiceAtual + 1) % CONFIG.sequenciaMarcacao.length] : '';
  if (!proxima) {
    const contagemInicial = contarSemanasPorSigla_(aba, 'individual');
    proxima = CONFIG.sequenciaMarcacao.find(sigla => Number(contagemInicial[sigla] || 0) < limiteSemanasPorSigla_(sigla, 'individual')) || CONFIG.sequenciaMarcacao[0];
  }
  PropertiesService.getScriptProperties().setProperty(CONFIG.chaveInicioFase2, proxima);
  registrarInicioFase2Auditoria_(aba.getParent(), proxima, siglaFinal);
  return proxima;
}

function registrarInicioFase2Auditoria_(planilha, proxima, siglaFinal) {
  let auditoria = planilha.getSheetByName(CONFIG.abaAuditoria);
  if (!auditoria) {
    auditoria = planilha.insertSheet(CONFIG.abaAuditoria);
    auditoria.appendRow(['Data/hora', 'Tipo', 'Sigla', 'Vaga', 'Resultado', 'Justificativa']);
    const protecao = auditoria.protect().setDescription('AUDITORIA_PWA_PROTEGIDA');
    protecao.getEditors().forEach(editor => protecao.removeEditor(editor));
    if (protecao.canDomainEdit()) protecao.setDomainEdit(false);
  }
  auditoria.appendRow([new Date(), 'fase2_inicio', proxima, '', 'OK', 'Fase 2 iniciada após o fechamento de SIGLA 1 por ' + (normalizarSigla_(siglaFinal) || 'edição administrativa') + '.']);
}

function antecedentePendenteSequencia_(contagem, sigla, rodada, aba) {
  const sequencia = ordemSequencia_(aba, rodada);
  const indice = sequencia.indexOf(normalizarSigla_(sigla));
  if (indice < 0) return '';
  return sequencia.slice(0, indice).find(anterior =>
    Number(contagem[anterior] || 0) < limiteSemanasPorSigla_(anterior, rodada)
  ) || '';
}

function validarConjuntoSemana_(siglasExistentes, siglaNova, regras, validarCoincidencia = true) {
  const nova = normalizarSigla_(siglaNova);
  if (!regras[nova]) return { valido: false, mensagem: 'A sigla ' + nova + ' não existe na aba REGRAS.' };
  const existentes = siglasExistentes.map(normalizarSigla_).filter(Boolean);
  if (existentes.includes(nova)) return { valido: false, mensagem: 'A sigla ' + nova + ' já está nesta semana.' };
  if (!validarCoincidencia) return { valido: true, mensagem: '' };
  const coincidencia = contarCoincidenciaTotal_([...existentes, nova], regras);
  if (coincidencia > CONFIG.maxDiasCoincidencia) {
    const dias = String(coincidencia).replace('.', ',');
    const unidade = coincidencia === 1 || coincidencia < 1 ? 'dia útil' : 'dias úteis';
    return { valido: false, mensagem: 'A soma das coincidências desta semana seria de ' + dias + ' ' + unidade + '; o limite é ' + CONFIG.maxDiasCoincidencia + ' dias úteis.' };
  }
  return { valido: true, mensagem: '' };
}

function contarCoincidenciaTotal_(siglas, regras) {
  const participantes = siglas.map(normalizarSigla_).filter(Boolean);
  let total = 0;
  for (let esquerda = 0; esquerda < participantes.length; esquerda += 1) {
    for (let direita = esquerda + 1; direita < participantes.length; direita += 1) {
      const siglaA = participantes[esquerda];
      const siglaB = participantes[direita];
      total += contarDiasCoincidentes_(regras[siglaA] || [], regras[siglaB] || [], siglaA, siglaB);
    }
  }
  return total;
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

function contarSemanasDaSigla_(aba, sigla, a1Excluido = '', rodada) {
  const procurada = normalizarSigla_(sigla);
  return todasVagas_().reduce((total, vaga) => {
    if (rodada === 'individual' && mesBloqueado_(vaga.mes)) return total;
    if (rodada === 'conjunta' ? vaga.indiceSigla === 0 : vaga.indiceSigla > 0) return total;
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
