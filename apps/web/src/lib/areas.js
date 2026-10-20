// As 20 matérias da 1ª fase agrupadas em cinco áreas, cada área com uma cor
// e cada matéria com um ícone próprio.
//
// A cor por hash do nome (`corDaDisciplina`) distinguia as matérias, mas não
// dizia nada: Penal e Processo Penal saíam com cores sem relação, e o ícone
// se repetia (Civil e Criança com o mesmo "users"). Agrupar por área dá a
// leitura que a prova tem — as matérias vizinhas se parecem — e o ícone
// próprio separa as irmãs. É o mesmo lugar para todas as telas, para a
// matéria ter a mesma cara no Dashboard, nas Questões e nas Revisões.

import { QUESTOES_NA_PROVA } from './quiz.js';

export const AREAS = [
  {
    chave: 'fundamentos', nome: 'Fundamentos e ética', cor: '#5B4A7A',
    materias: ['Ética Profissional', 'Filosofia do Direito', 'Direitos Humanos', 'Direito Internacional'],
  },
  {
    chave: 'publico', nome: 'Direito público', cor: '#2F5D8A',
    materias: [
      'Direito Constitucional', 'Direito Administrativo', 'Direito Tributário',
      'Direito Financeiro', 'Direito Eleitoral', 'Direito Ambiental',
    ],
  },
  {
    chave: 'privado', nome: 'Direito privado', cor: '#2F6B6B',
    materias: [
      'Direito Civil', 'Direito Processual Civil', 'Direito Empresarial',
      'Direito do Consumidor', 'Direito da Criança e do Adolescente',
    ],
  },
  { chave: 'penal', nome: 'Penal', cor: '#8F3F5A', materias: ['Direito Penal', 'Direito Processual Penal'] },
  {
    chave: 'trabalho', nome: 'Trabalho e previdência', cor: '#8A5A2F',
    materias: ['Direito do Trabalho', 'Direito Processual do Trabalho', 'Direito Previdenciário'],
  },
];

// Ícone por matéria: um por matéria, sem repetir dentro da área.
export const ICONE_DA_MATERIA = {
  'Ética Profissional': 'scale',
  'Filosofia do Direito': 'brain',
  'Direitos Humanos': 'heart',
  'Direito Internacional': 'globe',
  'Direito Constitucional': 'landmark',
  'Direito Administrativo': 'building-2',
  'Direito Tributário': 'percent',
  'Direito Financeiro': 'chart-column',
  'Direito Eleitoral': 'vote',
  'Direito Ambiental': 'leaf',
  'Direito Civil': 'house',
  'Direito Processual Civil': 'file-text',
  'Direito Empresarial': 'factory',
  'Direito do Consumidor': 'shopping-bag',
  'Direito da Criança e do Adolescente': 'baby',
  'Direito Penal': 'gavel',
  'Direito Processual Penal': 'file-search',
  'Direito do Trabalho': 'briefcase',
  'Direito Processual do Trabalho': 'file-clock',
  'Direito Previdenciário': 'shield-check',
};

// As matérias na ordem das áreas: é a ordem de leitura das listas.
export const MATERIAS = AREAS.flatMap((a) => a.materias);

// Matéria fora da tabela (grafia nova, "Sem classificação") cai num cinza
// neutro e no ícone genérico, em vez de quebrar a tela.
const COR_NEUTRA = '#6a665f';

export function areaDaMateria(nome) {
  return AREAS.find((a) => a.materias.includes(nome)) || null;
}

export function corDaMateria(nome) {
  return areaDaMateria(nome)?.cor || COR_NEUTRA;
}

export function iconeDaMateria(nome) {
  return ICONE_DA_MATERIA[nome] || 'library';
}

/** Quantas das 80 questões da prova são desta matéria (null se não estiver na tabela). */
export function pesoDaMateria(nome) {
  return QUESTOES_NA_PROVA[nome] ?? null;
}

// Abaixo disso a taxa de acerto não fala pela matéria: é o mesmo corte que a
// tela já usava para esconder a porcentagem.
export const RESPOSTAS_PARA_MEDIR = 10;

export const NIVEIS = ['Iniciando', 'Base', 'Avançando', 'Domínio'];

/**
 * Nível de 1 a 4 numa matéria, a partir das tentativas e acertos.
 * Iniciando: menos de 10 respostas. Depois os cortes de 50% e 80% que o
 * status (`statusDe`) já usava, para as duas leituras não divergirem.
 */
export function nivelDaMateria(tentativas = 0, acertos = 0) {
  if (tentativas < RESPOSTAS_PARA_MEDIR) return 1;
  const taxa = acertos / tentativas;
  if (taxa < 0.5) return 2;
  if (taxa < 0.8) return 3;
  return 4;
}

/**
 * O que falta para subir de nível, em linguagem de estudo.
 *
 * Acertos seguidos levam a taxa A/T a A+k / T+k. Para chegar a 50%:
 * k ≥ T − 2A. Para chegar a 80%: k ≥ 4T − 5A. Mínimo de 1, porque quem está
 * exatamente no corte por arredondamento ainda precisa de uma resposta.
 */
export function acertosParaSubir(tentativas = 0, acertos = 0) {
  const nivel = nivelDaMateria(tentativas, acertos);
  if (nivel === 1) return { nivel, faltam: RESPOSTAS_PARA_MEDIR - tentativas, tipo: 'respostas' };
  if (nivel === 2) return { nivel, faltam: Math.max(1, tentativas - 2 * acertos), tipo: 'acertos' };
  if (nivel === 3) return { nivel, faltam: Math.max(1, 4 * tentativas - 5 * acertos), tipo: 'acertos' };
  return { nivel, faltam: 0, tipo: 'manter' };
}

/** A frase do próximo passo, pronta para a tela. */
export function proximoPasso(tentativas = 0, acertos = 0) {
  const { nivel, faltam } = acertosParaSubir(tentativas, acertos);
  if (nivel === 1) return `faltam ${faltam} ${faltam === 1 ? 'resposta' : 'respostas'} para medir seu acerto`;
  if (nivel === 2) return `${faltam} ${faltam === 1 ? 'acerto seguido' : 'acertos seguidos'} para Avançando`;
  if (nivel === 3) return `${faltam} ${faltam === 1 ? 'acerto seguido' : 'acertos seguidos'} para Domínio`;
  return 'mantenha acima de 80%';
}

/**
 * Quantas questões da prova a pessoa deixaria de acertar nesta matéria se a
 * prova fosse hoje: peso × (1 − taxa). Null enquanto não há como medir.
 * É o que ordena o "Foco agora": uma matéria de peso 8 com 50% custa mais que
 * uma de peso 2 com 0%.
 */
export function perdaEsperada(nome, tentativas = 0, acertos = 0) {
  const peso = pesoDaMateria(nome);
  if (peso == null || tentativas < RESPOSTAS_PARA_MEDIR) return null;
  return Math.round(peso * (1 - acertos / tentativas) * 10) / 10;
}
