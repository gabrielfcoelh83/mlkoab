// Semana do Cronograma em dias cumpridos (`semanaEmDias` em agenda.js): o
// índice que trocou a porcentagem da semana.
//
// Datas sem "Z" são hora local de propósito: o test:lib roda em UTC e em
// America/Sao_Paulo, e a semana é sempre a do dia local.

import { semanaEmDias } from '../src/lib/agenda.js';

const falhas = [];
const exigir = (condicao, mensagem) => {
  if (!condicao) falhas.push(mensagem);
};

// `n` respostas no dia `chave`, cada dia numa questão própria.
const respostas = (lista) => {
  const tentativas = {};
  lista.forEach(([chave, n], i) => {
    tentativas[`q${i}`] = { tentativas: Array.from({ length: n }, () => ({ correta: true, data: `${chave}T10:00:00` })) };
  });
  return tentativas;
};

// 9/10/2026 é uma sexta-feira; a semana vai de 4/10 (domingo) a 10/10.
const SEXTA = new Date('2026-10-09T10:00:00');
const UTEIS = [1, 2, 3, 4, 5];

{
  const tentativas = respostas([
    ['2026-10-05', 6], // segunda: cumprido
    ['2026-10-06', 3], // terça: abaixo da meta
    ['2026-10-07', 5], // quarta: exatamente a meta, cumprido
    ['2026-10-10', 9], // sábado: folga, não entra
    ['2026-09-28', 5], // semana passada: 1 dia
    ['2026-09-21', 5], ['2026-09-22', 5], ['2026-09-23', 7], // duas semanas atrás: 3 dias
  ]);
  const s = semanaEmDias({ tentativas, meta: 5, diasDeEstudo: UTEIS, hoje: SEXTA });

  exigir(s.dias.length === 7 && s.dias[0].dow === 'DOM' && s.dias[0].dia === 4, `começa no domingo 4: ${JSON.stringify(s.dias[0])}`);
  exigir(s.cumpridos === 2, `2 dias cumpridos, veio ${s.cumpridos}`);
  exigir(s.diasAteHoje === 5, `5 dias de estudo até sexta, veio ${s.diasAteHoje}`);
  exigir(s.diasNaSemana === 5, `5 dias de estudo na semana, veio ${s.diasNaSemana}`);
  exigir(s.semanaPassada === 1, `semana passada 1, veio ${s.semanaPassada}`);
  exigir(s.recorde === 3, `recorde 3, veio ${s.recorde}`);
  exigir(s.dias[5].hoje && !s.dias[5].futuro && s.dias[6].futuro, 'sexta é hoje e sábado é futuro');
  exigir(s.dias[6].estudo === false && s.dias[6].cumprido === false, 'folga nunca é cumprida, mesmo com respostas');
}

{
  // Sem ficha, todo dia é de estudo; domingo de manhã ainda não cumpriu nada.
  const domingo = new Date('2026-10-04T08:00:00');
  const s = semanaEmDias({ tentativas: {}, meta: 20, hoje: domingo });
  exigir(s.diasAteHoje === 1 && s.diasNaSemana === 7 && s.cumpridos === 0, `sem ficha: ${JSON.stringify({ ...s, dias: undefined })}`);
  exigir(s.recorde === 0 && s.semanaPassada === 0, 'sem histórico, recorde e semana passada zerados');
}

if (falhas.length > 0) {
  console.error(`✗ ${falhas.length} falha(s) em semana.test.js:`);
  for (const f of falhas) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('✓ semana.test.js: dias cumpridos, folga, semana passada e recorde');
