// O que precisa de revisão — de verdade.
//
// A tela de Revisões tinha cinco abas e nenhuma delas filtrava nada: o código
// era `let filtered = all` e só duas abas chegavam a mexer nisso. Clicar em
// "Errei" listava o acervo inteiro, com a etiqueta vermelha "Errei" colada em
// questão que a pessoa tinha acertado. E os números do topo (212 erradas, 36
// marcadas) eram constantes escritas no arquivo.
//
// Aqui a pergunta é respondida com o histórico: o que decide se uma questão
// entra em "Errei" é a ÚLTIMA tentativa dela, não a primeira nem a média —
// quem errou e depois acertou já corrigiu o problema.

// Por que a pessoa errou — a anotação do Caderno de Erros. É o que separa
// lacuna de conteúdo ("não conhecia") de erro de atenção ("li errado"), e só
// quem errou sabe. Opcional: obrigar faria a pessoa marcar qualquer coisa.
//
// `valor` vai para o servidor, que não tem lista fechada (o vocabulário é do
// produto, ADR-001 do estudo-service) e aceita até 40 caracteres. Por isso
// trocar um rótulo aqui não pede migration — mas trocar um `valor` deixa as
// anotações antigas com o valor velho, que `rotuloDoMotivo` ainda mostra.
export const MOTIVOS_DO_ERRO = [
  { valor: 'nao-conhecia', rotulo: 'Não conhecia o conteúdo' },
  { valor: 'confundi', rotulo: 'Confundi com outro instituto' },
  { valor: 'li-errado', rotulo: 'Li errado o enunciado' },
  { valor: 'faltou-tempo', rotulo: 'Faltou tempo' },
];

// O mesmo teto do servidor: passar dele só trocaria o aviso da tela por um 400.
export const NOTA_DO_MOTIVO_MAX = 280;

/** Texto do motivo para a tela; valor fora da lista aparece como veio. */
export function rotuloDoMotivo(valor) {
  if (!valor) return null;
  return MOTIVOS_DO_ERRO.find((m) => m.valor === valor)?.rotulo || valor;
}

function historico(tentativas, id) {
  const registro = tentativas?.[String(id)] || tentativas?.[id];
  return registro?.tentativas || [];
}

/**
 * A tentativa mais recente. O array chega em ordem cronológica (a API devolve
 * do mais novo para o mais velho e `agruparPorQuestao` inverte), então a
 * última posição é a mais recente.
 */
export function ultimaTentativa(tentativas, id) {
  const hist = historico(tentativas, id);
  return hist.length > 0 ? hist[hist.length - 1] : null;
}

export function situacaoDaQuestao(tentativas, id) {
  const hist = historico(tentativas, id);
  if (hist.length === 0) return { situacao: 'em-aberto', tentativas: 0, acertos: 0, pct: null, ultima: null };

  const acertos = hist.filter((t) => t.correta === true).length;
  const ultima = hist[hist.length - 1];

  return {
    situacao: ultima.correta === true ? 'acertou' : 'errou',
    tentativas: hist.length,
    acertos,
    pct: Math.round((acertos / hist.length) * 100),
    ultima,
  };
}

/**
 * Separa o acervo nas listas que a tela oferece.
 *
 * `favoritos` é uma lista de ids marcados à mão; ela vive só neste navegador
 * porque não existe rota de favorito na API — a tela diz isso em vez de fingir
 * que sincroniza.
 */
export function classificarRevisao(questoes = [], tentativas = {}, favoritos = []) {
  const marcados = new Set((favoritos || []).map(String));

  const comSituacao = questoes.map((q) => ({ questao: q, ...situacaoDaQuestao(tentativas, q.id) }));

  const errei = comSituacao
    .filter((x) => x.situacao === 'errou')
    // A que foi errada há mais tempo é a que corre mais risco de ter sido
    // esquecida: ela vem primeiro.
    .sort((a, b) => String(a.ultima?.data || '').localeCompare(String(b.ultima?.data || '')));

  const favoritas = comSituacao.filter((x) => marcados.has(String(x.questao.id)));

  const emAberto = comSituacao.filter((x) => x.situacao === 'em-aberto');

  // "Menor desempenho" só faz sentido para quem já tem histórico na questão:
  // taxa de acerto de zero tentativas não é zero, é ausência de dado.
  const menorDesempenho = comSituacao
    .filter((x) => x.tentativas > 0)
    .sort((a, b) => a.pct - b.pct || b.tentativas - a.tentativas);

  const respondidas = comSituacao.filter((x) => x.tentativas > 0);
  const acertos = comSituacao.filter((x) => x.situacao === 'acertou').length;

  return {
    errei,
    favoritas,
    emAberto,
    menorDesempenho,
    // "Todas para revisar" = o que se errou mais o que se marcou, sem repetir.
    todas: [...errei, ...favoritas.filter((f) => f.situacao !== 'errou')],
    resumo: {
      acervo: questoes.length,
      respondidas: respondidas.length,
      acertos,
      erros: errei.length,
      // Erros cujo motivo ninguém anotou. Só o erro da ÚLTIMA tentativa conta:
      // errar de novo é um erro novo, e o motivo do anterior pode não valer.
      errosSemMotivo: errei.filter((x) => !x.ultima?.motivo).length,
      emAberto: emAberto.length,
      favoritas: favoritas.length,
      pct: respondidas.length > 0 ? Math.round((acertos / respondidas.length) * 100) : null,
    },
  };
}

/**
 * Agrupa os itens da revisão pela disciplina, na ordem em que aparecem.
 *
 * A lista chega ordenada por outro critério (a errada há mais tempo primeiro,
 * o menor desempenho primeiro) e o grupo herda a posição do seu primeiro item:
 * reordenar as disciplinas aqui esconderia essa prioridade. Questão sem
 * disciplina não some — vira "Sem classificação", porque sumir pareceria
 * perda de dado.
 */
export function agruparPorDisciplina(itens = []) {
  const grupos = new Map();

  for (const item of itens) {
    const disciplina = String(item?.questao?.disciplina ?? '').trim() || 'Sem classificação';
    if (!grupos.has(disciplina)) grupos.set(disciplina, []);
    grupos.get(disciplina).push(item);
  }

  return [...grupos.entries()].map(([disciplina, doGrupo]) => ({ disciplina, itens: doGrupo }));
}

// 'AAAA-MM-DD' já é um dia do calendário: passá-lo por `new Date` o leria como
// meia-noite UTC e, no Brasil, cairia no dia anterior. Data com hora é lida e
// reduzida ao dia LOCAL — é o dia de quem está estudando, não o de Greenwich.
const SO_DATA = /^(\d{4})-(\d{2})-(\d{2})$/;

function chaveDoDiaLocal(valor) {
  if (valor == null || valor === '') return null;

  if (typeof valor === 'string') {
    const so = SO_DATA.exec(valor);
    if (so) return `${so[1]}-${so[2]}-${so[3]}`;
  }

  const data = valor instanceof Date ? valor : new Date(valor);
  if (Number.isNaN(data.getTime())) return null;

  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${data.getFullYear()}-${mes}-${dia}`;
}

/**
 * Questões refeitas hoje depois de um erro: as que tinham uma tentativa errada
 * antes da tentativa de hoje e receberam uma nova.
 *
 * Conta a questão, não a tentativa: refazer duas vezes no mesmo dia ainda é
 * uma segunda chance. O acerto é o da última tentativa de hoje — é ela que
 * diz como a questão ficou.
 *
 * O corte é o dia LOCAL (`getFullYear`/`getMonth`/`getDate`). Comparar o
 * `toISOString()` faria a resposta das 23h em São Paulo contar como amanhã.
 */
export function refeitasHoje(tentativas = {}, hoje = new Date()) {
  const diaDeHoje = chaveDoDiaLocal(hoje);
  let refeitas = 0;
  let acertos = 0;

  for (const registro of Object.values(tentativas || {})) {
    const hist = Array.isArray(registro?.tentativas) ? registro.tentativas : [];

    let ultimaDeHoje = null;
    for (const tentativa of hist) {
      if (chaveDoDiaLocal(tentativa?.data) === diaDeHoje) ultimaDeHoje = tentativa;
    }
    if (!ultimaDeHoje) continue;

    // `!== true` e não `=== false`: tentativa antiga sem a chave conta como
    // erro, a mesma leitura de `situacaoDaQuestao`.
    const anteriores = hist.slice(0, hist.lastIndexOf(ultimaDeHoje));
    if (!anteriores.some((t) => t?.correta !== true)) continue;

    refeitas += 1;
    if (ultimaDeHoje.correta === true) acertos += 1;
  }

  return { refeitas, acertos };
}
