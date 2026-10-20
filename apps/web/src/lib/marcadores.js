// Por que esta questão deve voltar.
//
// O marcador substitui a estrela de favorito: em vez de "guardei", ele diz o
// motivo (chutei, não sabia, quero refazer, tenho dúvida) e fica na conta. A
// lista é fechada porque o servidor valida `tipo` contra ela; a cor e o ícone
// existem para o motivo ser lido sem depender só da cor.
//
// As cores foram escolhidas contra as sete paletas de `THEME`: nenhuma delas
// se confunde com a cor da marca nem com verde/vermelho/âmbar semânticos.

export const NOTA_DO_MARCADOR_MAX = 280;

export const TIPOS_DE_MARCADOR = [
  {
    tipo: 'chute',
    rotulo: 'Chutei',
    descricao: 'Acertei ou errei no chute',
    cor: '#962D86',
    icone: 'dice',
  },
  {
    tipo: 'nao_sabia',
    rotulo: 'Não sabia',
    descricao: 'Não conhecia o conteúdo',
    cor: '#6C5631',
    icone: 'book',
  },
  {
    tipo: 'refazer',
    rotulo: 'Quero refazer',
    descricao: 'Sabia, mas quero fixar',
    // O ícone `repeat` é o mesmo que a tela já usa para "refazer".
    cor: '#0B7F7C',
    icone: 'repeat',
  },
  {
    tipo: 'duvida',
    rotulo: 'Dúvida',
    descricao: 'Fiquei em dúvida e quero anotar',
    cor: '#6C6F99',
    icone: 'help',
  },
];

// Tipo fora da lista (servidor mais novo, dado adulterado) não pode sumir da
// tela sem explicação: ganha rótulo e ícone neutros, mas nunca só a cor.
const TIPO_DESCONHECIDO = { tipo: '', rotulo: 'Marcador', descricao: '', cor: '#7a766f', icone: 'flag' };

/** A definição visual de um tipo; nunca `undefined`. */
export function dadosDoMarcador(tipo) {
  return TIPOS_DE_MARCADOR.find((t) => t.tipo === tipo) || { ...TIPO_DESCONHECIDO, tipo };
}

/**
 * Traduz uma linha da API (ou um marcador já local) para o formato da tela.
 * Aceita as duas grafias porque `api.js` pode devolver a linha crua e o estado
 * local usa camelCase — misturar as duas sem uma porta de entrada só espalharia
 * `questao_id ?? questaoId` por toda a interface.
 */
export function normalizarMarcador(linha) {
  if (!linha) return null;

  const questaoId = linha.questaoId ?? linha.questao_id;
  if (questaoId == null || String(questaoId).trim() === '') return null;

  return {
    questaoId: String(questaoId),
    tipo: linha.tipo,
    nota: linha.nota ?? null,
    criadoEm: linha.criadoEm ?? linha.criado_em ?? null,
    atualizadoEm: linha.atualizadoEm ?? linha.atualizado_em ?? null,
  };
}

/** `{ [questaoId]: marcador }` — um marcador por questão, como no servidor. */
export function indexarMarcadores(marcadores = []) {
  const lista = Array.isArray(marcadores) ? marcadores : Object.values(marcadores || {});
  const indice = {};

  for (const linha of lista) {
    const marcador = normalizarMarcador(linha);
    if (marcador) indice[marcador.questaoId] = marcador;
  }

  return indice;
}

/** Contagem por tipo para os chips; `todas` inclui tipos desconhecidos. */
export function contarPorTipo(marcadores = []) {
  const lista = Array.isArray(marcadores) ? marcadores : Object.values(marcadores || {});
  const contagem = { todas: 0, chute: 0, nao_sabia: 0, refazer: 0, duvida: 0 };

  for (const linha of lista) {
    const marcador = normalizarMarcador(linha);
    if (!marcador) continue;
    contagem.todas += 1;
    if (Object.prototype.hasOwnProperty.call(contagem, marcador.tipo) && marcador.tipo !== 'todas') {
      contagem[marcador.tipo] += 1;
    }
  }

  return contagem;
}

function comoIndice(marcadores) {
  // Aceita a lista crua ou o índice já montado: a chamada da migração acontece
  // logo depois do GET, quando as duas formas estão à mão.
  return Array.isArray(marcadores) ? indexarMarcadores(marcadores) : (marcadores || {});
}

/**
 * Estrelas antigas que ainda não têm marcador. Duplicata no estado antigo e
 * questão já marcada ficam de fora: migrar de novo só trocaria o motivo que a
 * pessoa escolheu por "Quero refazer".
 */
export function idsParaMigrar(favoritos = [], marcadores = {}) {
  const indice = comoIndice(marcadores);
  const vistos = new Set();
  const ids = [];

  for (const bruto of Array.isArray(favoritos) ? favoritos : []) {
    if (bruto == null) continue;
    const id = String(bruto);
    if (id.trim() === '' || vistos.has(id) || indice[id]) continue;
    vistos.add(id);
    ids.push(id);
  }

  return ids;
}

/**
 * Converte as estrelas antigas em marcador `refazer`.
 *
 * `salvar` é chamado só para as questões sem marcador. Se qualquer PUT falhar,
 * a lista original de favoritos volta intacta para a próxima tentativa (no
 * próximo login); os que deram certo já viraram marcador e serão pulados. Nada
 * é apagado antes de a gravação confirmar.
 */
export async function migrarEstrelas(favoritos = [], marcadores = {}, salvar) {
  const ids = idsParaMigrar(favoritos, marcadores);
  const falhas = [];

  if (typeof salvar === 'function') {
    for (const id of ids) {
      try {
        await salvar(id, { tipo: 'refazer', nota: null });
      } catch {
        falhas.push(id);
      }
    }
  } else if (ids.length > 0) {
    falhas.push(...ids);
  }

  return {
    ids,
    migrados: ids.length - falhas.length,
    falhas,
    favoritos: falhas.length === 0 ? [] : [...(Array.isArray(favoritos) ? favoritos : [])],
  };
}
