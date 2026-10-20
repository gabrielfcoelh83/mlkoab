// Séries dos cartões de métrica (src/lib/metrics.js): semana a semana, últimos
// dias, recorde de sequência e variação. Datas sem "Z": hora local de
// propósito, o test:lib roda em UTC e em America/Sao_Paulo.

import { seriesSemanais, respondidasNosUltimosDias, recordeDeSequencia, variacaoPercentual } from '../src/lib/metrics.js';

const falhas = [];
const exigir = (condicao, mensagem) => {
  if (!condicao) falhas.push(mensagem);
};

const HOJE = new Date('2026-10-20T15:00:00');
const t = (dia, correta, tempo = null) => ({ data: `${dia}T10:00:00`, correta, tempo_gasto_segundos: tempo });
const tentativas = {
  a: { tentativas: [t('2026-10-20', true, 60), t('2026-10-19', false, 120), t('2026-10-14', true)] },
  b: { tentativas: [t('2026-10-13', true, 90), t('2026-10-10', true), t('2026-10-09', false), t('2026-10-08', true)] },
};

{
  const s = seriesSemanais(tentativas, 3, HOJE);
  exigir(s.length === 3, 'três semanas');
  exigir(s[2].total === 3 && s[2].acertos === 2 && s[2].taxa === 67, `esta semana (14 a 20): ${JSON.stringify(s[2])}`);
  exigir(s[2].tempoMedioSeg === 90, `tempo médio só com o que foi medido: ${s[2].tempoMedioSeg}`);
  exigir(s[2].rotulo === '14 out', `rótulo é o início da janela: ${s[2].rotulo}`);
  exigir(s[1].total === 4 && s[1].taxa === 75, `semana anterior (7 a 13): ${JSON.stringify(s[1])}`);
  exigir(s[0].total === 0 && s[0].taxa === null && s[0].tempoMedioSeg === null, 'semana vazia sem taxa nem tempo');
}

{
  const d = respondidasNosUltimosDias(tentativas, 14, HOJE);
  exigir(d.length === 14 && d[13] === 1 && d[12] === 1 && d[0] === 0, `últimos 14 dias: ${d}`);
  exigir(d.reduce((a, b) => a + b, 0) === 7, 'soma as 7 respostas da janela');
}

{
  exigir(recordeDeSequencia(tentativas) === 3, `recorde: 8, 9 e 10 de outubro, veio ${recordeDeSequencia(tentativas)}`);
  exigir(recordeDeSequencia({}) === 0, 'sem histórico, recorde zero');
  exigir(variacaoPercentual(40, 50) === 25 && variacaoPercentual(0, 5) === null && variacaoPercentual(3, 2) === -33.3, 'variação percentual');
}

if (falhas.length > 0) {
  console.error(`✗ ${falhas.length} falha(s) em series.test.js:`);
  for (const f of falhas) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('✓ series.test.js: semanas, últimos dias, recorde e variação');
