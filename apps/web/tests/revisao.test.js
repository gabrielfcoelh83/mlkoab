// Agrupamento da revisão e as refeitas do dia. Os dois decidem o que a tela
// mostra e em que ordem; e o corte do dia é local, então este arquivo roda em
// UTC e em America/Sao_Paulo pelo scripts/testes-lib.js.

import { agruparPorDisciplina, refeitasHoje } from '../src/lib/revisao.js';

const falhas = [];
const exigir = (condicao, mensagem) => {
  if (!condicao) falhas.push(mensagem);
};

// ---------------------------------------------------------------------------
// agruparPorDisciplina
// ---------------------------------------------------------------------------

{
  const item = (id, disciplina) => ({ questao: { id, disciplina } });
  const grupos = agruparPorDisciplina([
    item(1, 'Direito Penal'),
    item(2, 'Direito Civil'),
    item(3, 'Direito Penal'),
    item(4, null),
    item(5, '   '),
    item(6, 'Direito Civil'),
  ]);

  exigir(
    JSON.stringify(grupos.map((g) => g.disciplina)) === JSON.stringify(['Direito Penal', 'Direito Civil', 'Sem classificação']),
    `ordem dos grupos errada: ${grupos.map((g) => g.disciplina).join(', ')}`,
  );
  exigir(grupos[0].itens.length === 2, 'Direito Penal deveria ter 2 itens');
  exigir(grupos[1].itens.length === 2, 'Direito Civil deveria ter 2 itens');
  exigir(grupos[2].itens.length === 2, 'vazio e espaço deveriam cair no mesmo "Sem classificação"');
  exigir(grupos[0].itens.map((i) => i.questao.id).join(',') === '1,3', 'a ordem dentro do grupo mudou');
  exigir(agruparPorDisciplina([]).length === 0, 'lista vazia deveria dar nenhum grupo');
}

// ---------------------------------------------------------------------------
// refeitasHoje
// ---------------------------------------------------------------------------

// Datas construídas no fuso local de propósito: o teste mede o dia de quem
// usa o app, não o de Greenwich. Em UTC e em São Paulo os dois lados da
// comparação estão no mesmo fuso.
const dia = (d, h = 10) => new Date(2026, 7, d, h, 0, 0);
const tentativa = (correta, data) => ({ correta, data: data.toISOString() });

{
  const hoje = dia(19, 12);
  const tentativas = {
    // Errou ontem, acertou hoje: refeita e acerto.
    1: { tentativas: [tentativa(false, dia(18, 10)), tentativa(true, dia(19, 9))] },
    // Errou ontem e errou de novo hoje: refeita, sem acerto. A questão conta
    // uma vez, mesmo com duas tentativas hoje.
    2: { tentativas: [tentativa(false, dia(18, 11)), tentativa(false, dia(19, 8)), tentativa(false, dia(19, 9))] },
    // Acertou hoje sem erro anterior: não é segunda chance.
    3: { tentativas: [tentativa(true, dia(19, 8))] },
    // Só ontem: não entrou no dia de hoje.
    4: { tentativas: [tentativa(false, dia(18, 9))] },
    // Só acertos antes: não é "depois de um erro".
    5: { tentativas: [tentativa(true, dia(17, 9)), tentativa(true, dia(19, 23))] },
    // 23h locais: em São Paulo já é dia 20 em UTC. O corte é local.
    6: { tentativas: [tentativa(false, dia(17, 9)), tentativa(true, dia(19, 23))] },
    // 00:30 locais do dia seguinte: ainda não é hoje.
    7: { tentativas: [tentativa(false, dia(18, 9)), tentativa(true, dia(20, 0))] },
    // Data sem hora já é um dia do calendário.
    8: { tentativas: [tentativa(false, dia(18, 9)), { correta: true, data: '2026-08-19' }] },
  };

  const resultado = refeitasHoje(tentativas, hoje);
  exigir(resultado.refeitas === 4, `esperadas 4 refeitas, vieram ${resultado.refeitas}`);
  exigir(resultado.acertos === 3, `esperados 3 acertos, vieram ${resultado.acertos}`);

  const vazio = refeitasHoje({}, hoje);
  exigir(vazio.refeitas === 0 && vazio.acertos === 0, 'sem tentativas deveria dar zero e zero');
}

if (falhas.length > 0) {
  console.error(`\n❌ ${falhas.length} problema(s):`);
  for (const f of falhas) console.error('   - ' + f);
  process.exit(1);
}

console.log('✅ revisão: agrupamento por disciplina e refeitas do dia íntegros');
