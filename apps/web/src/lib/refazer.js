// Refazer dentro do modal: a segunda chance sem sair da Revisões.
//
// A regra que não depende de React mora aqui porque é ela que decide o que a
// tela promete: a origem gravada, o resultado de cada tentativa e a contagem
// do resumo final. O modal (VerQuestao.tsx) só desenha.

// O estudo-service aceita origem livre (até 20 caracteres, migration 007) e
// entende 'quiz', 'simulado' e 'revisao'. Refazer pela Revisões é a terceira:
// gravar como 'quiz' misturaria, no relatório, a segunda chance com o estudo
// normal.
export const ORIGEM_DO_REFAZER = 'revisao';

/**
 * O que o "Concluir" mostra depois de uma sessão de refazer.
 *
 * `refeitas` conta as tentativas confirmadas na sessão (a questão, não a
 * resposta: refazer a mesma duas vezes ainda é uma refeita), `acertos` as que
 * terminaram certas e `continuamEmErrei` as que ficaram erradas de novo — é o
 * número que a pessoa leva dali.
 */
export function resumoDoRefazer(refeitas = 0, acertos = 0) {
  const total = Math.max(0, refeitas);
  // Um acerto a mais que refeitas seria impossível; o teto evita um resumo
  // com "−1 continua em Errei" caso alguém conte errado.
  const certas = Math.min(total, Math.max(0, acertos));
  return {
    refeitas: total,
    acertos: certas,
    continuamEmErrei: total - certas,
    houveRefeita: total > 0,
  };
}

/** A frase do resultado, logo depois de "Confirmar resposta". */
export function resultadoDoRefazer(acertou) {
  return acertou
    ? 'Acertou desta vez. A questão sai de Erradas.'
    : 'Errou de novo. A questão continua em Erradas.';
}

/**
 * Congela a sequência que o modal vai percorrer, no momento da abertura.
 *
 * Gravar uma tentativa muda `usuarioTentativas` e a questão pode sair da lista
 * em tempo real — a certa sai de "Errei". Se o modal lesse a lista viva, o
 * item sumiria debaixo dele e a navegação pularia uma questão (ou fecharia
 * sozinha). Por isso a cópia é tirada aqui, uma vez, e o índice é preso dentro
 * da lista para um alvo que não existe mais não abrir o modal em branco.
 */
export function congelarSequencia(itens = [], indice = 0) {
  const lista = (itens || []).filter(Boolean);
  if (lista.length === 0) return { itens: [], indice: 0 };
  const bruto = Number.isFinite(indice) ? Math.floor(indice) : 0;
  return { itens: [...lista], indice: Math.min(Math.max(0, bruto), lista.length - 1) };
}
