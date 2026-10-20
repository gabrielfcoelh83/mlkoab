// Apostila do simulado e provas anteriores (src/lib/apostila.js).

import { provasAnteriores, questoesDoExame, montarApostila, questoesParaTreinar } from '../src/lib/apostila.js';

const falhas = [];
const exigir = (condicao, mensagem) => {
  if (!condicao) falhas.push(mensagem);
};

const q = (id, extra = {}) => ({ id, correta: 0, disciplina: 'Direito Penal', exame: 44, ano: 2025, numero: Number(id), ...extra });

// --- provas anteriores ---
{
  const acervo = [
    ...Array.from({ length: 80 }, (_, i) => q(i + 1)),
    q(200, { exame: 45, ano: 2026, numero: 1 }),
    q(201, { exame: null }),
  ];
  const provas = provasAnteriores(acervo);
  exigir(provas.length === 2 && provas[0].exame === 45, `mais recente primeiro: ${JSON.stringify(provas)}`);
  exigir(provas[1].completa === true && provas[0].completa === false, 'completa só com 80');
  exigir(provas[0].ano === 2026, 'ano vem do acervo');
  const ordem = questoesDoExame([q(3, { numero: 3 }), q(1, { numero: 1 }), q(2, { numero: 2 })], 44).map((x) => x.id);
  exigir(ordem.join() === '1,2,3', `ordem do caderno: ${ordem}`);
}

// --- apostila do simulado geral ---
{
  const acervo = [q(10, { disciplina: 'Direito Civil' }), q(11), q(12), q(13)];
  const simulado = { id: 7, modalidade: 'geral', questoes: ['12', '10', '11', '13', '99'], duracao_seg: 600 };
  const tentativas = {
    12: { tentativas: [{ resposta: 0, correta: true, simulado_id: 7 }] },
    10: { tentativas: [{ resposta: 0, correta: true, simulado_id: null }, { resposta: 2, correta: false, simulado_id: 7 }] },
    11: { tentativas: [{ resposta: null, correta: false, simulado_id: 7 }] },
    13: { tentativas: [{ resposta: 0, correta: true, simulado_id: 3 }] },
  };
  const a = montarApostila(simulado, { tentativas, acervo });

  exigir(a.itens.map((x) => x.id).join() === '12,10,11,13,99', 'ordem sorteada mantida');
  exigir(a.itens[0].situacao === 'certa' && a.itens[1].situacao === 'errada', 'certa e errada pelo simulado, não pela tentativa de fora');
  exigir(a.itens[2].situacao === 'em-branco', 'sem alternativa é em branco');
  exigir(a.itens[3].situacao === 'em-branco', 'tentativa de outro simulado não conta');
  exigir(a.itens[4].questao === null && a.total === 5, 'fora do acervo segue no mapa');
  exigir(a.acertos === 1 && a.erros === 1 && a.emBranco === 3, `placar: ${a.acertos}/${a.erros}/${a.emBranco}`);
  exigir(a.porMateria[0].nome === 'Direito Penal', `matéria que mais custou primeiro: ${a.porMateria[0].nome}`);

  exigir(questoesParaTreinar(a).map((x) => x.id).join() === '10', 'refazer os erros');
  exigir(questoesParaTreinar(a, { filtro: 'em-branco' }).map((x) => x.id).join() === '11,13', 'refazer as em branco (só as do acervo)');
  exigir(questoesParaTreinar(a, { materia: 'Direito Civil' }).map((x) => x.id).join() === '10', 'treinar a matéria');
}

// --- servidor anterior à migration 009: linha sem `modalidade` ---
{
  const acervo = [q(10), q(11, { exame: null })];
  const a = montarApostila({ id: 8, questoes: ['10'] }, { acervo });
  exigir(a.itens.map((x) => x.id).join() === '10', 'sem modalidade, a lista de questões manda: é geral');
}

// --- apostila da prova real ---
{
  const acervo = [q(1, { numero: 2 }), q(2, { numero: 1 }), q(3, { exame: 45 })];
  const a = montarApostila({ id: 9, modalidade: 'prova', exame: 44, tipo: 1 }, { acervo });
  exigir(a.itens.map((x) => x.id).join() === '2,1', 'prova real na ordem do caderno, só do exame');
  exigir(montarApostila(null) === null, 'sem simulado, sem apostila');
}

if (falhas.length > 0) {
  console.error(`✗ ${falhas.length} falha(s) em apostila.test.js:`);
  for (const f of falhas) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('✓ apostila.test.js: provas anteriores, apostila do geral e da prova, treino pela apostila');
