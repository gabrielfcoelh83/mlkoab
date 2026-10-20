// Regras do "Refazer" dentro do modal (lib/refazer.js): o resumo do fim, a
// frase do resultado e o congelamento da sequência. O teste é de lógica pura —
// nada aqui toca React nem rede.

import {
  ORIGEM_DO_REFAZER,
  congelarSequencia,
  resultadoDoRefazer,
  resumoDoRefazer,
} from '../src/lib/refazer.js';

const falhas = [];
const exigir = (condicao, mensagem) => {
  if (!condicao) falhas.push(mensagem);
};

// ---------------------------------------------------------------------------
// origem
// ---------------------------------------------------------------------------

exigir(ORIGEM_DO_REFAZER === 'revisao', `a origem do refazer mudou: ${ORIGEM_DO_REFAZER}`);

// ---------------------------------------------------------------------------
// resumoDoRefazer
// ---------------------------------------------------------------------------

{
  const r = resumoDoRefazer(3, 1);
  exigir(r.refeitas === 3, `esperadas 3 refeitas, vieram ${r.refeitas}`);
  exigir(r.acertos === 1, `esperado 1 acerto, veio ${r.acertos}`);
  exigir(r.continuamEmErrei === 2, `esperados 2 em Errei, vieram ${r.continuamEmErrei}`);
  exigir(r.houveRefeita === true, 'com 3 refeitas, houveRefeita deveria ser true');
}

{
  // Nada confirmado: "Concluir" só fecha, sem resumo.
  const r = resumoDoRefazer(0, 0);
  exigir(r.refeitas === 0 && r.acertos === 0 && r.continuamEmErrei === 0, 'zero e zero deveria dar tudo zero');
  exigir(r.houveRefeita === false, 'sem refeitas, houveRefeita deveria ser false');
}

{
  // Sem argumento nenhum: os padrões não podem estourar nem vazar null.
  const r = resumoDoRefazer();
  exigir(r.houveRefeita === false && r.continuamEmErrei === 0, 'sem argumentos deveria cair em zero');
}

{
  // Acertos a mais que refeitas não pode virar "−1 em Errei".
  const r = resumoDoRefazer(1, 5);
  exigir(r.acertos === 1, `acertos deveriam ser limitados às refeitas, veio ${r.acertos}`);
  exigir(r.continuamEmErrei === 0, `continuamEmErrei não pode ser negativo, veio ${r.continuamEmErrei}`);
}

{
  const r = resumoDoRefazer(-4, -2);
  exigir(r.refeitas === 0 && r.acertos === 0, 'negativos deveriam virar zero');
}

// ---------------------------------------------------------------------------
// resultadoDoRefazer
// ---------------------------------------------------------------------------

exigir(
  resultadoDoRefazer(true) === 'Acertou desta vez. A questão sai de Errei.',
  `frase de acerto inesperada: ${resultadoDoRefazer(true)}`,
);
exigir(
  resultadoDoRefazer(false) === 'Errou de novo. A questão continua em Errei.',
  `frase de erro inesperada: ${resultadoDoRefazer(false)}`,
);

// ---------------------------------------------------------------------------
// congelarSequencia
// ---------------------------------------------------------------------------

{
  const itens = [{ id: 1 }, { id: 2 }, { id: 3 }];
  const congelado = congelarSequencia(itens, 2);

  exigir(congelado.itens.length === 3, `deveria congelar 3 itens, congelou ${congelado.itens.length}`);
  exigir(congelado.indice === 2, `índice 2 deveria ficar 2, ficou ${congelado.indice}`);

  // É cópia: mexer na lista viva (o item some quando a questão sai de Errei)
  // não pode encolher a sequência do modal.
  itens.pop();
  exigir(congelado.itens.length === 3, 'a sequência do modal seguiu a lista viva');
}

{
  const congelado = congelarSequencia([{ id: 1 }], 9);
  exigir(congelado.indice === 0, `índice fora da lista deveria ser preso em 0, ficou ${congelado.indice}`);
}

{
  const congelado = congelarSequencia([{ id: 1 }, { id: 2 }], -3);
  exigir(congelado.indice === 0, `índice negativo deveria virar 0, ficou ${congelado.indice}`);
}

{
  const congelado = congelarSequencia([{ id: 1 }, null, undefined, { id: 2 }], 1);
  exigir(congelado.itens.length === 2, `itens vazios deveriam sair, sobraram ${congelado.itens.length}`);
  exigir(congelado.indice === 1, `com dois itens válidos, o índice 1 deveria continuar 1, ficou ${congelado.indice}`);
}

{
  const vazio = congelarSequencia([], 4);
  exigir(vazio.itens.length === 0 && vazio.indice === 0, 'lista vazia deveria dar sequência vazia e índice 0');
}

{
  const semLista = congelarSequencia(undefined, 2);
  exigir(semLista.itens.length === 0 && semLista.indice === 0, 'sem lista deveria dar sequência vazia');
}

if (falhas.length > 0) {
  console.error(`\n❌ ${falhas.length} problema(s):`);
  for (const f of falhas) console.error('   - ' + f);
  process.exit(1);
}

console.log('✅ refazer: resumo, resultado e sequência congelada íntegros');
