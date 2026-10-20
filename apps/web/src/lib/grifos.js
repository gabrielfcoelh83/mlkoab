// Marca-texto do enunciado e das alternativas.
//
// O grifo é guardado em offsets do texto PURO do campo, e não em marcação:
// o texto da questão vem do servidor e pode ser renderizado de mais de um
// jeito (quiz, modal, futuro destaque de artigo). Offsets sobrevivem a essa
// troca de renderização; HTML dentro do texto não.
//
// A resolução de sobreposição usa a ORDEM da lista: o grifo mais recente
// (o último) vence no trecho em que os dois se cruzam. É o que faz grifar de
// novo por cima de um grifo antigo trocar a cor sem apagar o antigo — apagar
// o antigo é ação explícita ("Apagar" no grifo clicado).
//
// Tudo aqui é genérico de propósito: o destaque de artigos vai usar a mesma
// função com outro `campo`.

/**
 * @typedef {Object} Grifo
 * @property {string} campo
 * @property {number} inicio
 * @property {number} fim
 * @property {string} cor
 */

export const CORES_DO_GRIFO = [
  { chave: 'ambar', rotulo: 'âmbar', aria: 'Grifar em âmbar', cor: '#F3E3B5', borda: '#C9A64A' },
  { chave: 'salvia', rotulo: 'sálvia', aria: 'Grifar em sálvia', cor: '#DCE8D2', borda: '#7E9A6C' },
  { chave: 'lavanda', rotulo: 'lavanda', aria: 'Grifar em lavanda', cor: '#E4DDF0', borda: '#8C7AAE' },
];

const POR_CHAVE = new Map(CORES_DO_GRIFO.map((c) => [c.chave, c]));

/** A cor de fundo de um grifo. Aceita a chave nova e um hex antigo. */
export function corDoGrifo(cor) {
  return POR_CHAVE.get(cor)?.cor || cor;
}

function inteiro(valor) {
  const n = Number(valor);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

/** @param {Grifo | null | undefined} grifo @returns {Grifo | null} */
function valido(grifo) {
  if (!grifo || typeof grifo !== 'object') return null;
  if (typeof grifo.campo !== 'string' || !grifo.campo) return null;
  if (typeof grifo.cor !== 'string' || !grifo.cor) return null;
  const inicio = inteiro(grifo.inicio);
  const fim = inteiro(grifo.fim);
  if (inicio == null || fim == null || fim <= 0 || fim <= inicio) return null;
  return { campo: grifo.campo, inicio: Math.max(0, inicio), fim, cor: grifo.cor };
}

/**
 * Junta grifos vizinhos ou sobrepostos da mesma cor e do mesmo campo.
 *
 * Não mexe em grifos de cores diferentes que se sobrepõem: eles continuam na
 * lista, na ordem em que estavam, porque é a ordem que decide quem aparece
 * por cima em `trechosDoTexto`.
 *
 * @param {Grifo[] | null | undefined} grifos
 * @returns {Grifo[]}
 */
export function normalizarGrifos(grifos) {
  const lista = Array.isArray(grifos) ? grifos.map(valido).filter(Boolean) : [];

  // A extensão de um intervalo pode encostar em outro da mesma cor que já
  // estava na lista (A[0,3], B[10,12], C[3,10]): por isso o laço recomeça
  // depois de cada junção, em vez de olhar cada par uma vez só.
  let mudou = true;
  while (mudou) {
    mudou = false;
    for (let i = 0; i < lista.length && !mudou; i++) {
      for (let j = i + 1; j < lista.length; j++) {
        const a = lista[i];
        const b = lista[j];
        if (a.campo !== b.campo || a.cor !== b.cor) continue;
        if (b.inicio > a.fim || b.fim < a.inicio) continue;

        a.inicio = Math.min(a.inicio, b.inicio);
        a.fim = Math.max(a.fim, b.fim);
        lista.splice(j, 1);
        mudou = true;
        break;
      }
    }
  }

  return lista;
}

/** Os grifos de um campo, já normalizados. @param {Grifo[] | null | undefined} grifos @param {string} campo @returns {Grifo[]} */
export function grifosDoCampo(grifos, campo) {
  return normalizarGrifos(grifos).filter((g) => g.campo === campo);
}

/**
 * Acrescenta um grifo. Devolve uma lista nova e normalizada.
 *
 * O grifo novo entra no fim: se cruzar um antigo de outra cor, é ele que
 * aparece no trecho sobreposto.
 *
 * @param {Grifo[] | null | undefined} grifos
 * @param {Grifo} novo
 * @returns {Grifo[]}
 */
export function adicionarGrifo(grifos, novo) {
  const lista = normalizarGrifos(grifos);
  const grifo = valido(novo);
  if (!grifo) return lista;

  // Normalizar pode juntar o grifo novo com um antigo da mesma cor e deixar o
  // resultado na posição do antigo. Se houver outra cor depois, ela venceria
  // no trecho recém-pintado. Por isso o grupo que contém o novo vai para o fim.
  const normalizada = normalizarGrifos([...lista, grifo]);
  const grupo = normalizada.filter((g) => (
    g.campo === grifo.campo && g.cor === grifo.cor
    && g.inicio <= grifo.fim && grifo.inicio <= g.fim
  ));
  return [...normalizada.filter((g) => !grupo.includes(g)), ...grupo];
}

/** Apaga pelo índice na lista normalizada (o mesmo que a tela desenhou). @param {Grifo[] | null | undefined} grifos @param {number} indice @returns {Grifo[]} */
export function apagarGrifo(grifos, indice) {
  const lista = normalizarGrifos(grifos);
  if (!Number.isInteger(indice) || indice < 0 || indice >= lista.length) return lista;
  return lista.filter((_, i) => i !== indice);
}

/**
 * Os pedaços do texto com a cor que deve ser pintada em cada um.
 *
 * Sem sobreposição: em cada intervalo vale o último grifo da lista que o
 * cobre. Offsets fora do texto são aparados; grifo inteiro fora do texto, ou
 * com fim <= início, é ignorado. Trecho sem grifo sai com `cor: null`.
 *
 * @param {string} texto
 * @param {Grifo[] | null | undefined} grifos
 * @returns {{ texto: string, cor: string | null, inicio: number, fim: number, indice: number | null }[]}
 */
export function trechosPosicionados(texto, grifos) {
  const t = typeof texto === 'string' ? texto : '';
  if (t.length === 0) return [];

  const lista = normalizarGrifos(grifos)
    .map((g, indice) => ({
      ...g,
      indice,
      inicio: Math.max(0, Math.min(t.length, g.inicio)),
      fim: Math.max(0, Math.min(t.length, g.fim)),
    }))
    .filter((g) => g.fim > g.inicio);

  const limites = [...new Set([0, t.length, ...lista.flatMap((g) => [g.inicio, g.fim])])]
    .sort((a, b) => a - b);

  const pedacos = [];
  for (let i = 0; i < limites.length - 1; i++) {
    const inicio = limites[i];
    const fim = limites[i + 1];
    if (fim <= inicio) continue;

    let vencedor = null;
    for (const g of lista) {
      if (g.inicio <= inicio && g.fim >= fim) vencedor = g;
    }

    const cor = vencedor ? vencedor.cor : null;
    const anterior = pedacos[pedacos.length - 1];
    if (anterior && anterior.cor === cor && anterior.fim === inicio) {
      anterior.texto += t.slice(inicio, fim);
      anterior.fim = fim;
      anterior.indice = cor == null ? null : vencedor.indice;
    } else {
      pedacos.push({
        texto: t.slice(inicio, fim),
        cor,
        inicio,
        fim,
        indice: cor == null ? null : vencedor.indice,
      });
    }
  }

  return pedacos;
}

/** Só texto + cor, a forma genérica que as telas e os testes consomem. @param {string} texto @param {Grifo[] | null | undefined} grifos @returns {{ texto: string, cor: string | null }[]} */
export function trechosDoTexto(texto, grifos) {
  return trechosPosicionados(texto, grifos).map(({ texto: pedaco, cor }) => ({ texto: pedaco, cor }));
}
