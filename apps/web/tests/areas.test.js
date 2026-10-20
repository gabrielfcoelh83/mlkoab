// Áreas, níveis e peso na prova (src/lib/areas.js). A conta de "acertos para
// subir" é o que a tela promete à pessoa; errar por um faz a promessa falhar.

import {
  AREAS, MATERIAS, ICONE_DA_MATERIA, corDaMateria, iconeDaMateria, pesoDaMateria,
  nivelDaMateria, acertosParaSubir, proximoPasso, perdaEsperada,
} from '../src/lib/areas.js';
import { QUESTOES_NA_PROVA } from '../src/lib/quiz.js';
import { readFileSync } from 'node:fs';

// icons.jsx tem JSX e não roda no node: confere o desenho pelo texto.
const ICONES_DESENHADOS = readFileSync(new URL('../src/lib/icons.jsx', import.meta.url), 'utf8');

const falhas = [];
const exigir = (condicao, mensagem) => {
  if (!condicao) falhas.push(mensagem);
};

// --- tabela ---
{
  exigir(AREAS.length === 5, 'cinco áreas');
  exigir(MATERIAS.length === 20 && new Set(MATERIAS).size === 20, 'vinte matérias, sem repetir');
  const daProva = Object.keys(QUESTOES_NA_PROVA).sort();
  exigir(JSON.stringify([...MATERIAS].sort()) === JSON.stringify(daProva), 'as matérias das áreas são as da prova');
  exigir(MATERIAS.reduce((s, m) => s + pesoDaMateria(m), 0) === 80, 'os pesos somam 80');
  const icones = Object.values(ICONE_DA_MATERIA);
  exigir(new Set(icones).size === 20, 'um ícone por matéria, sem repetir');
  for (const i of icones) exigir(ICONES_DESENHADOS.includes(/^[a-z]+$/.test(i) ? `  ${i}: '` : `  '${i}': '`), `ícone "${i}" sem desenho em icons.jsx`);
  exigir(corDaMateria('Direito Penal') === corDaMateria('Direito Processual Penal'), 'matérias da mesma área têm a mesma cor');
  exigir(corDaMateria('Matéria nova') === '#6a665f' && iconeDaMateria('Matéria nova') === 'library', 'fora da tabela cai no neutro');
}

// --- nível ---
{
  exigir(nivelDaMateria(0, 0) === 1 && nivelDaMateria(9, 9) === 1, 'menos de 10 respostas é Iniciando');
  exigir(nivelDaMateria(10, 4) === 2, '40% é Base');
  exigir(nivelDaMateria(10, 5) === 3, '50% é Avançando');
  exigir(nivelDaMateria(10, 8) === 4, '80% é Domínio');
}

// --- acertos para subir: a promessa tem de se cumprir exatamente ---
{
  for (const [T, A] of [[10, 2], [24, 6], [41, 2], [12, 0], [22, 13], [29, 14], [15, 6]]) {
    const { nivel, faltam } = acertosParaSubir(T, A);
    const depois = nivelDaMateria(T + faltam, A + faltam);
    exigir(depois === nivel + 1, `${A}/${T}: ${faltam} acertos deveriam subir do nível ${nivel}, ficou ${depois}`);
    if (faltam > 1) {
      const antes = nivelDaMateria(T + faltam - 1, A + faltam - 1);
      exigir(antes === nivel, `${A}/${T}: ${faltam - 1} acertos já subiriam, a conta exagera`);
    }
  }
  exigir(acertosParaSubir(4, 2).faltam === 6, 'Iniciando: faltam 10 − T respostas');
  exigir(proximoPasso(9, 0) === 'faltam 1 resposta para medir seu acerto', 'singular de resposta');
  exigir(proximoPasso(10, 9) === 'mantenha acima de 80%', 'Domínio só mantém');
}

// --- perda esperada ---
{
  exigir(perdaEsperada('Ética Profissional', 24, 6) === 6, 'peso 8 com 25% perde 6');
  exigir(perdaEsperada('Ética Profissional', 4, 0) === null, 'sem medida, sem perda');
  exigir(perdaEsperada('Matéria nova', 20, 0) === null, 'fora da prova, sem perda');
}

if (falhas.length > 0) {
  console.error(`✗ ${falhas.length} falha(s) em areas.test.js:`);
  for (const f of falhas) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('✓ areas.test.js: tabela, nível, acertos para subir e perda esperada');
