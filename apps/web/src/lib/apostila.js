// A apostila de cada simulado e a lista de provas anteriores, sem React.
//
// A apostila é a prova como a pessoa fez: cada questão na ordem em que caiu,
// com o que ela marcou. Serve para rever e para treinar de novo pelo mesmo
// simulado (refazer só os erros, só as em branco, ou uma matéria). Antes o
// simulado guardava só o placar no navegador e não havia o que rever.

// Questões de um exame completo da 1ª fase.
export const QUESTOES_DA_PROVA = 80;

/**
 * Os exames do acervo como provas anteriores, do mais recente para o mais
 * antigo. `completa` quando o acervo tem as 80: prova incompleta abriria um
 * simulado que não mede o mesmo que a prova. Não existe semestre nem data de
 * aplicação no acervo, só o `ano`; a tela não deve inventar um.
 */
export function provasAnteriores(questoes = []) {
  const porExame = new Map();
  for (const q of questoes) {
    if (!Number.isInteger(q?.exame)) continue;
    const p = porExame.get(q.exame) || { exame: q.exame, ano: q.ano ?? null, total: 0 };
    p.total += 1;
    if (p.ano == null && q.ano != null) p.ano = q.ano;
    porExame.set(q.exame, p);
  }
  return [...porExame.values()]
    .map((p) => ({ ...p, completa: p.total >= QUESTOES_DA_PROVA }))
    .sort((a, b) => b.exame - a.exame);
}

/** As questões de um exame na ordem do caderno (número da questão). */
export function questoesDoExame(questoes = [], exame) {
  return questoes
    .filter((q) => q?.exame === exame)
    .sort((a, b) => (a.numero ?? Infinity) - (b.numero ?? Infinity));
}

// A tentativa que a pessoa deu à questão dentro do simulado `simuladoId`.
// As tentativas chegam por questão (ver `agruparPorQuestao`), com o id da
// questão como texto; a última vale, como no servidor.
function tentativaNoSimulado(tentativas, questaoId, simuladoId) {
  const registro = tentativas?.[String(questaoId)];
  const daProva = (registro?.tentativas || []).filter((t) => t.simulado_id === simuladoId);
  return daProva.length > 0 ? daProva[daProva.length - 1] : null;
}

/**
 * Monta a apostila de um simulado registrado no servidor.
 *
 * `simulado` é a linha de GET /api/simulados. A ordem vem de `questoes` no
 * simulado geral e do caderno (número) na prova real. `acervo` resolve o id
 * em questão de tela; id que não está no acervo carregado entra como
 * `questao: null`, para o mapa de 80 não encolher.
 *
 * Situação por questão: 'certa', 'errada' ou 'em-branco'. Em branco é a
 * tentativa gravada sem alternativa (o simulado registra assim) ou a questão
 * sem tentativa nenhuma (prova abandonada no meio).
 */
export function montarApostila(simulado, { tentativas = {}, acervo = [] } = {}) {
  if (!simulado) return null;
  const porId = new Map(acervo.map((q) => [String(q.id), q]));

  // Sem `modalidade` (servidor anterior à migration 009), a lista de questões
  // é o que distingue o geral.
  const geral = simulado.modalidade === 'geral' || Array.isArray(simulado.questoes);
  const ids = geral
    ? (simulado.questoes || []).map(String)
    : questoesDoExame(acervo, simulado.exame).map((q) => String(q.id));

  const itens = ids.map((id, i) => {
    const t = tentativaNoSimulado(tentativas, id, simulado.id);
    const questao = porId.get(id) || null;
    let situacao = 'em-branco';
    if (t && t.resposta !== null && t.resposta !== undefined) situacao = t.correta ? 'certa' : 'errada';
    return {
      numero: i + 1,
      id,
      questao,
      disciplina: questao?.disciplina || 'Sem classificação',
      situacao,
      alternativa: t?.resposta ?? null,
    };
  });

  const contar = (s) => itens.filter((x) => x.situacao === s).length;

  const porMateria = new Map();
  for (const x of itens) {
    const m = porMateria.get(x.disciplina) || { nome: x.disciplina, total: 0, acertos: 0, erros: 0, emBranco: 0 };
    m.total += 1;
    if (x.situacao === 'certa') m.acertos += 1;
    else if (x.situacao === 'errada') m.erros += 1;
    else m.emBranco += 1;
    porMateria.set(x.disciplina, m);
  }

  return {
    simulado,
    itens,
    total: itens.length,
    acertos: contar('certa'),
    erros: contar('errada'),
    emBranco: contar('em-branco'),
    duracaoSeg: simulado.duracao_seg ?? null,
    // A matéria que mais custou ponto vem primeiro: é por onde treinar.
    porMateria: [...porMateria.values()].sort(
      (a, b) => b.erros + b.emBranco - (a.erros + a.emBranco) || a.nome.localeCompare(b.nome)
    ),
  };
}

/** Os ids para treinar de novo pela apostila: 'erros', 'em-branco' ou uma matéria. */
export function questoesParaTreinar(apostila, { filtro = 'erros', materia = null } = {}) {
  if (!apostila) return [];
  return apostila.itens
    .filter((x) => x.questao)
    .filter((x) => {
      if (materia) return x.disciplina === materia && x.situacao !== 'certa';
      if (filtro === 'em-branco') return x.situacao === 'em-branco';
      if (filtro === 'erros-e-branco') return x.situacao !== 'certa';
      return x.situacao === 'errada';
    })
    .map((x) => x.questao);
}
