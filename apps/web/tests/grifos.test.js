// Marca-texto: offsets, sobreposição, normalização e remoção.
//
// A função é a base do grifo no quiz e no modal, e vai ser reusada no destaque
// de artigos. O que este arquivo protege é o contrato dela: os pedaços cobrem
// o texto inteiro, sem sobreposição, e o grifo mais novo vence onde cruza um
// antigo de outra cor.

import {
  CORES_DO_GRIFO,
  adicionarGrifo,
  apagarGrifo,
  corDoGrifo,
  grifosDoCampo,
  normalizarGrifos,
  trechosDoTexto,
  trechosPosicionados,
} from '../src/lib/grifos.js';

const falhas = [];
const exigir = (condicao, mensagem) => {
  if (!condicao) falhas.push(mensagem);
};

const texto = 'ABCDEFGHIJ';
const g = (inicio, fim, cor, campo = 'enunciado') => ({ campo, inicio, fim, cor });

// --- trechos sem grifo ---
{
  const trechos = trechosDoTexto(texto, []);
  exigir(trechos.length === 1, 'sem grifo deveria ser um pedaço só');
  exigir(trechos[0].texto === texto && trechos[0].cor === null, 'sem grifo deveria devolver o texto inteiro sem cor');
  exigir(trechosDoTexto('', []).length === 0, 'texto vazio não tem pedaço');
  exigir(trechosDoTexto(undefined, [g(0, 2, 'ambar')]).length === 0, 'texto ausente não quebra');
}

// --- grifo simples e offset que começa em 0 ---
{
  const trechos = trechosDoTexto(texto, [g(0, 4, 'ambar')]);
  exigir(trechos.map((t) => t.texto).join('') === texto, 'os pedaços têm de reconstruir o texto');
  exigir(trechos[0].cor === 'ambar' && trechos[0].texto === 'ABCD', 'grifo que começa no índice 0');
  exigir(trechos[1].cor === null && trechos[1].texto === 'EFGHIJ', 'o resto fica sem cor');
}

// --- sobreposição: o mais novo vence ---
{
  const trechos = trechosDoTexto(texto, [g(0, 6, 'ambar'), g(4, 10, 'salvia')]);
  exigir(trechos.map((t) => t.texto).join('') === texto, 'sobreposição reconstrói o texto');
  const porTexto = Object.fromEntries(trechos.map((t) => [t.texto, t.cor]));
  exigir(porTexto.ABCD === 'ambar', 'trecho só do antigo continua âmbar');
  exigir(porTexto.EFGHIJ === 'salvia', 'do trecho sobreposto em diante é do grifo novo');
  exigir(trechos.every((t) => t.cor === 'ambar' || t.cor === 'salvia'), 'todo pedaço pintado tem cor');
}

// --- sobreposição com grifo contido ---
{
  const trechos = trechosDoTexto(texto, [g(2, 8, 'ambar'), g(4, 6, 'lavanda')]);
  exigir(trechos.map((t) => t.texto).join('') === texto, 'grifo contido reconstrói o texto');
  exigir(trechos.find((t) => t.texto === 'EF')?.cor === 'lavanda', 'grifo novo cobre o meio do antigo');
  exigir(trechos.find((t) => t.texto === 'CD')?.cor === 'ambar', 'as pontas do antigo ficam');
}

// --- offsets inválidos ---
{
  const trechos = trechosDoTexto(texto, [
    g(5, 5, 'ambar'),
    g(8, 3, 'salvia'),
    g(-4, 2, 'lavanda'),
    g(9, 999, 'ambar'),
    g(100, 200, 'salvia'),
    { campo: 'enunciado', inicio: 'x', fim: 2, cor: 'ambar' },
    { campo: 'enunciado', inicio: 1, fim: 2 },
  ]);
  exigir(trechos.map((t) => t.texto).join('') === texto, 'inválidos não podem sumir com pedaço do texto');
  exigir(trechos.find((t) => t.texto === 'AB')?.cor === 'lavanda', 'início negativo é aparado para 0');
  exigir(trechos.find((t) => t.texto === 'J')?.cor === 'ambar', 'fim além do texto é aparado');
  exigir(trechos.filter((t) => t.cor === 'salvia').length === 0, 'grifo inteiro fora do texto é ignorado');
}

// --- normalização ---
{
  const normalizados = normalizarGrifos([
    g(0, 3, 'ambar'),
    g(3, 5, 'ambar'),
    g(4, 8, 'ambar'),
    g(6, 9, 'salvia'),
    g(1, 2, 'salvia'),
    g(12, 15, 'lavanda'),
  ]);
  const ambar = normalizados.filter((x) => x.cor === 'ambar');
  exigir(ambar.length === 1 && ambar[0].inicio === 0 && ambar[0].fim === 8, 'âmbar vizinho/sobreposto vira um só');
  const salvia = normalizados.filter((x) => x.cor === 'salvia');
  exigir(salvia.length === 2, 'cores diferentes não se juntam');
  exigir(normalizarGrifos([g(0, 3, 'ambar'), g(5, 8, 'ambar')]).length === 2, 'mesma cor separada não vira um só');
  // A extensão de um grifo pode encostar em outro da mesma cor que já estava
  // na lista; o laço tem de recomeçar até não sobrar nada para juntar.
  const encadeados = normalizarGrifos([g(0, 3, 'ambar'), g(10, 12, 'ambar'), g(3, 10, 'ambar')]);
  exigir(encadeados.length === 1 && encadeados[0].inicio === 0 && encadeados[0].fim === 12, 'junção em cadeia');
  exigir(normalizarGrifos([g(0, 3, 'ambar', 'alt-0'), g(0, 3, 'ambar', 'alt-1')]).length === 2, 'campos diferentes não se juntam');
  const original = [g(0, 3, 'ambar')];
  normalizarGrifos(original);
  exigir(original[0].inicio === 0 && original[0].fim === 3, 'normalizar não altera a lista recebida');
}

// --- acrescentar ---
{
  const lista = adicionarGrifo([], g(1, 4, 'ambar'));
  exigir(lista.length === 1 && lista[0].inicio === 1 && lista[0].fim === 4, 'acrescentar cria o grifo');

  const comNovoPorCima = adicionarGrifo([g(2, 8, 'ambar')], g(4, 6, 'lavanda'));
  exigir(comNovoPorCima.length === 2 && comNovoPorCima[1].cor === 'lavanda', 'o novo entra no fim (vence)');
  const trechos = trechosDoTexto(texto, comNovoPorCima);
  exigir(trechos.find((t) => t.texto === 'EF')?.cor === 'lavanda', 'o novo vence na sobreposição');

  const vizinho = adicionarGrifo([g(0, 3, 'ambar')], g(3, 6, 'ambar'));
  exigir(vizinho.length === 1 && vizinho[0].fim === 6, 'mesma cor vizinha é um grifo só');

  // Se o novo se junta a um antigo da mesma cor, o grupo inteiro tem de ir
  // para o fim: senão uma cor pintada depois ficaria por baixo no trecho novo.
  const recolorido = adicionarGrifo([g(0, 10, 'ambar'), g(10, 20, 'salvia')], g(5, 15, 'ambar'));
  const trechosRecoloridos = trechosDoTexto('ABCDEFGHIJKLMNOPQRST', recolorido);
  exigir(recolorido[recolorido.length - 1].cor === 'ambar', 'grupo do grifo novo vai para o fim');
  exigir(trechosRecoloridos.find((t) => t.texto.includes('KLMNO'))?.cor === 'ambar', 'o novo vence mesmo juntando com um antigo da mesma cor');
  exigir(trechosRecoloridos.find((t) => t.texto === 'PQRST')?.cor === 'salvia', 'o que o novo não cobre continua com a outra cor');

  exigir(adicionarGrifo([], g(4, 4, 'ambar')).length === 0, 'grifo vazio não entra');
  const comInvalido = adicionarGrifo([], g(-2, 2, 'ambar'));
  exigir(comInvalido.length === 1 && comInvalido[0].inicio === 0, 'offset negativo é aparado');
}

// --- apagar ---
{
  const lista = [g(0, 3, 'ambar'), g(5, 8, 'salvia'), g(9, 10, 'lavanda')];
  const semPrimeiro = apagarGrifo(lista, 0);
  exigir(semPrimeiro.length === 2 && semPrimeiro[0].cor === 'salvia', 'apaga pelo índice');
  exigir(lista.length === 3, 'apagar não altera a lista recebida');
  exigir(apagarGrifo(lista, 30).length === 3, 'índice inexistente não apaga nada');
  exigir(apagarGrifo(lista, -1).length === 3, 'índice negativo não apaga nada');
  exigir(apagarGrifo(null, 0).length === 0, 'lista ausente vira lista vazia');
}

// --- campo, cor e índice do trecho ---
{
  const mistos = [g(0, 4, 'ambar', 'enunciado'), g(0, 4, 'salvia', 'alt-1')];
  exigir(grifosDoCampo(mistos, 'enunciado').length === 1, 'filtra pelo campo');
  exigir(grifosDoCampo(mistos, 'alt-0').length === 0, 'campo sem grifo');
  exigir(grifosDoCampo(mistos, 'enunciado')[0].cor === 'ambar', 'grifo do campo certo');

  const posicionados = trechosPosicionados(texto, [g(2, 8, 'ambar'), g(4, 6, 'lavanda')]);
  const lavanda = posicionados.find((t) => t.cor === 'lavanda');
  exigir(lavanda?.indice === 1, 'o trecho aponta o índice do grifo que está por cima');
  const ambar = posicionados.find((t) => t.cor === 'ambar');
  exigir(ambar?.indice === 0, 'o trecho restante aponta o grifo de baixo');
  exigir(posicionados.find((t) => t.cor === null)?.indice === null, 'trecho sem cor não tem índice');

  // O índice é o da lista normalizada — o mesmo que `apagarGrifo` recebe.
  const comInvalidos = [g(5, 5, 'ambar'), g(2, 8, 'salvia')];
  const pedacos = trechosPosicionados(texto, comInvalidos);
  const apagado = apagarGrifo(comInvalidos, pedacos.find((t) => t.cor === 'salvia').indice);
  exigir(apagado.length === 0, 'apagar o índice desenhado remove o grifo certo');
}

// --- cores ---
{
  exigir(CORES_DO_GRIFO.map((c) => c.chave).join() === 'ambar,salvia,lavanda', 'as três cores na ordem do produto');
  exigir(corDoGrifo('ambar') === '#F3E3B5', 'âmbar');
  exigir(corDoGrifo('salvia') === '#DCE8D2', 'sálvia');
  exigir(corDoGrifo('lavanda') === '#E4DDF0', 'lavanda');
  exigir(corDoGrifo('#123456') === '#123456', 'hex antigo continua valendo');
}

if (falhas.length > 0) {
  console.error(`\n❌ ${falhas.length} problema(s):`);
  for (const f of falhas) console.error('   - ' + f);
  process.exit(1);
}

console.log('✅ grifos: trechos, sobreposição, normalização e remoção íntegros');
