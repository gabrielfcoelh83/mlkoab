// Regras dos marcadores (lib/marcadores.js): a lista fechada de motivos, a
// tradução da linha da API, as contagens e — o mais delicado — a migração das
// estrelas antigas. A migração é o único caminho que apaga dado local, então o
// teste cobre o caso ruim: se um PUT falha, `favoritos` fica intacto.

import {
  NOTA_DO_MARCADOR_MAX,
  TIPOS_DE_MARCADOR,
  contarPorTipo,
  dadosDoMarcador,
  idsParaMigrar,
  indexarMarcadores,
  migrarEstrelas,
  normalizarMarcador,
} from '../src/lib/marcadores.js';

const falhas = [];
const exigir = (condicao, mensagem) => {
  if (!condicao) falhas.push(mensagem);
};

// ---------------------------------------------------------------------------
// Tipos de marcador
// ---------------------------------------------------------------------------

exigir(NOTA_DO_MARCADOR_MAX === 280, `a nota deveria aceitar 280 caracteres, veio ${NOTA_DO_MARCADOR_MAX}`);

{
  const esperado = {
    chute: { rotulo: 'Chutei', descricao: 'Acertei ou errei no chute', cor: '#962D86', icone: 'dice' },
    nao_sabia: { rotulo: 'Não sabia', descricao: 'Não conhecia o conteúdo', cor: '#6C5631', icone: 'book' },
    refazer: { rotulo: 'Quero refazer', descricao: 'Sabia, mas quero fixar', cor: '#0B7F7C', icone: 'repeat' },
    duvida: { rotulo: 'Dúvida', descricao: 'Fiquei em dúvida e quero anotar', cor: '#6C6F99', icone: 'help' },
  };

  exigir(TIPOS_DE_MARCADOR.length === 4, `esperados 4 tipos, vieram ${TIPOS_DE_MARCADOR.length}`);

  for (const tipo of TIPOS_DE_MARCADOR) {
    const alvo = esperado[tipo.tipo];
    exigir(Boolean(alvo), `tipo inesperado: ${tipo.tipo}`);
    if (!alvo) continue;
    for (const campo of ['rotulo', 'descricao', 'cor', 'icone']) {
      exigir(tipo[campo] === alvo[campo], `${tipo.tipo}.${campo}: esperado ${alvo[campo]}, veio ${tipo[campo]}`);
    }
    // A cor sozinha nunca identifica o motivo: ícone e rótulo são obrigatórios.
    exigir(Boolean(tipo.icone) && Boolean(tipo.rotulo), `${tipo.tipo} sem ícone ou rótulo`);
    exigir(/^#[0-9A-Fa-f]{6}$/.test(tipo.cor), `${tipo.tipo} com cor fora do formato: ${tipo.cor}`);
  }

  const cores = TIPOS_DE_MARCADOR.map((t) => t.cor.toUpperCase());
  exigir(new Set(cores).size === cores.length, 'as cores dos tipos precisam ser distintas');

  const chute = dadosDoMarcador('chute');
  exigir(chute.rotulo === 'Chutei' && chute.icone === 'dice', 'dadosDoMarcador não achou "chute"');
}

{
  // Tipo desconhecido (servidor mais novo) não pode quebrar a tela nem virar
  // só uma cor: ganha rótulo, ícone e uma cor neutra.
  const desconhecido = dadosDoMarcador('novo_tipo');
  exigir(desconhecido.rotulo === 'Marcador', `rótulo neutro esperado, veio ${desconhecido.rotulo}`);
  exigir(desconhecido.icone === 'flag', `ícone neutro esperado, veio ${desconhecido.icone}`);
  exigir(Boolean(desconhecido.cor), 'tipo desconhecido ficou sem cor');
  exigir(desconhecido.tipo === 'novo_tipo', 'dadosDoMarcador deve preservar o tipo recebido');
  exigir(Boolean(dadosDoMarcador(undefined).rotulo), 'sem tipo também precisa devolver algo exibível');
}

// ---------------------------------------------------------------------------
// normalizarMarcador
// ---------------------------------------------------------------------------

{
  const daApi = normalizarMarcador({
    questao_id: '42',
    tipo: 'duvida',
    nota: 'Art. 5º',
    criado_em: '2026-10-01T10:00:00Z',
    atualizado_em: '2026-10-02T10:00:00Z',
  });
  exigir(daApi.questaoId === '42', `questao_id deveria virar questaoId string, veio ${daApi.questaoId}`);
  exigir(daApi.tipo === 'duvida' && daApi.nota === 'Art. 5º', 'tipo/nota perdidos na normalização');
  exigir(daApi.criadoEm === '2026-10-01T10:00:00Z', 'criado_em não virou criadoEm');
  exigir(daApi.atualizadoEm === '2026-10-02T10:00:00Z', 'atualizado_em não virou atualizadoEm');

  const local = normalizarMarcador({ questaoId: 7, tipo: 'chute', nota: null });
  exigir(local.questaoId === '7', 'questaoId numérico deveria virar string');
  exigir(local.nota === null, 'nota ausente deveria virar null');

  exigir(normalizarMarcador(null) === null, 'linha nula deveria virar null');
  exigir(normalizarMarcador({ tipo: 'chute' }) === null, 'sem id deveria ser descartado');
  exigir(normalizarMarcador({ questao_id: '   ', tipo: 'chute' }) === null, 'id em branco deveria ser descartado');
  exigir(normalizarMarcador({ questao_id: 0, tipo: 'chute' }).questaoId === '0', 'id 0 é válido');
}

// ---------------------------------------------------------------------------
// indexarMarcadores
// ---------------------------------------------------------------------------

{
  const indice = indexarMarcadores([
    { questao_id: 1, tipo: 'chute' },
    { questao_id: '2', tipo: 'refazer' },
    // Vem depois da mesma questão: o servidor garante um por questão, e a
    // última linha da resposta é a versão mais nova.
    { questao_id: '1', tipo: 'duvida', nota: 'mudou' },
    null,
  ]);

  exigir(Object.keys(indice).join(',') === '1,2', `índice inesperado: ${Object.keys(indice).join(',')}`);
  exigir(indice['1'].tipo === 'duvida' && indice['1'].nota === 'mudou', 'a última linha da questão deveria vencer');
  exigir(indice['2'].tipo === 'refazer', 'id 2 não entrou no índice');

  const vazio = indexarMarcadores();
  exigir(Object.keys(vazio).length === 0, 'sem argumento deveria dar índice vazio');

  const comoObjeto = indexarMarcadores({
    9: { questaoId: '9', tipo: 'nao_sabia' },
  });
  exigir(comoObjeto['9']?.tipo === 'nao_sabia', 'índice já pronto deveria ser aceito');
}

// ---------------------------------------------------------------------------
// contarPorTipo
// ---------------------------------------------------------------------------

{
  const contagem = contarPorTipo([
    { questao_id: 1, tipo: 'chute' },
    { questao_id: 2, tipo: 'chute' },
    { questao_id: 3, tipo: 'nao_sabia' },
    { questao_id: 4, tipo: 'refazer' },
    { questao_id: 5, tipo: 'duvida' },
    { questao_id: 6, tipo: 'novo_tipo' },
    null,
  ]);

  exigir(contagem.todas === 6, `todas deveria contar a lista inteira (inclusive tipo desconhecido), veio ${contagem.todas}`);
  exigir(contagem.chute === 2, `chute esperado 2, veio ${contagem.chute}`);
  exigir(contagem.nao_sabia === 1, `nao_sabia esperado 1, veio ${contagem.nao_sabia}`);
  exigir(contagem.refazer === 1, `refazer esperado 1, veio ${contagem.refazer}`);
  exigir(contagem.duvida === 1, `duvida esperado 1, veio ${contagem.duvida}`);

  const vazia = contarPorTipo();
  exigir(vazia.todas === 0 && vazia.chute === 0, 'sem marcadores toda contagem deveria ser zero');
}

// ---------------------------------------------------------------------------
// idsParaMigrar
// ---------------------------------------------------------------------------

{
  const ids = idsParaMigrar(
    ['1', '2', '1', 3, null, '', '  '],
    { 2: { questaoId: '2', tipo: 'chute' } },
  );
  exigir(ids.join(',') === '1,3', `só as estrelas sem marcador deveriam migrar; vieram ${ids.join(',')}`);

  const comLista = idsParaMigrar(['10'], [{ questao_id: '10', tipo: 'refazer' }]);
  exigir(comLista.length === 0, 'marcador vindo como lista também bloqueia a migração');

  exigir(idsParaMigrar().length === 0, 'sem favoritos não há o que migrar');
  exigir(idsParaMigrar(['5'], {}).join(',') === '5', 'favorito sem marcador deve entrar');
}

// ---------------------------------------------------------------------------
// migrarEstrelas
// ---------------------------------------------------------------------------

await (async () => {
  {
    // Caminho feliz: grava só o que falta e só então esvazia favoritos.
    const chamadas = [];
    const resultado = await migrarEstrelas(
      ['1', '2'],
      { 2: { questaoId: '2', tipo: 'chute' } },
      async (id, dados) => { chamadas.push([id, dados]); },
    );

    exigir(chamadas.length === 1, `só a questão 1 deveria ser gravada, houve ${chamadas.length} chamada(s)`);
    exigir(chamadas[0][0] === '1', `questão gravada errada: ${chamadas[0]?.[0]}`);
    exigir(chamadas[0][1].tipo === 'refazer', `a estrela antiga deveria virar refazer, veio ${chamadas[0]?.[1]?.tipo}`);
    exigir(resultado.ids.join(',') === '1', 'ids para migrar deveriam ser só a 1');
    exigir(resultado.migrados === 1, `esperado 1 migrado, veio ${resultado.migrados}`);
    exigir(resultado.falhas.length === 0, 'não deveria haver falhas');
    exigir(resultado.favoritos.length === 0, 'todos os PUTs deram certo: favoritos deveria esvaziar');
  }

  {
    // Um PUT falha: nada é apagado, e os que já gravaram não são repetidos na
    // próxima tentativa (o índice novo é a fonte da verdade).
    const chamadas = [];
    const resultado = await migrarEstrelas(
      ['1', '2'],
      {},
      async (id) => {
        chamadas.push(id);
        if (id === '2') throw new Error('rede');
      },
    );

    exigir(chamadas.join(',') === '1,2', `as duas deveriam ser tentadas; foram ${chamadas.join(',')}`);
    exigir(resultado.migrados === 1, `esperado 1 migrado, veio ${resultado.migrados}`);
    exigir(resultado.falhas.join(',') === '2', `a falha deveria ser só a 2, veio ${resultado.falhas.join(',')}`);
    exigir(
      resultado.favoritos.join(',') === '1,2',
      `com falha, favoritos deveria continuar intacto; veio ${resultado.favoritos.join(',')}`,
    );
  }

  {
    // Todas falham: favoritos preservado por inteiro, para tentar no próximo login.
    const resultado = await migrarEstrelas(['7', '8'], {}, async () => { throw new Error('sem rede'); });
    exigir(resultado.falhas.length === 2, `esperadas 2 falhas, vieram ${resultado.falhas.length}`);
    exigir(resultado.favoritos.join(',') === '7,8', 'nenhum dado podia ser apagado sem gravação confirmada');
  }

  {
    // Sem função de gravar não há como confirmar nada: não apaga.
    const resultado = await migrarEstrelas(['3'], {}, undefined);
    exigir(resultado.falhas.join(',') === '3', 'sem `salvar`, a estrela não pode ser dada como migrada');
    exigir(resultado.favoritos.join(',') === '3', 'sem gravação, favoritos deveria ficar');
  }

  {
    // Já tem marcador: nem chama a API (não troca o motivo escolhido).
    const chamadas = [];
    const resultado = await migrarEstrelas(
      ['4'],
      { 4: { questaoId: '4', tipo: 'duvida', nota: 'já escolhi' } },
      async (id) => { chamadas.push(id); },
    );
    exigir(chamadas.length === 0, 'questão já marcada não deveria ser regravada');
    exigir(resultado.falhas.length === 0 && resultado.favoritos.length === 0, 'nada a migrar: favoritos pode esvaziar');
  }
})();

if (falhas.length > 0) {
  console.error(`\n✗ ${falhas.length} falha(s) em marcadores.test.js:`);
  for (const f of falhas) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('✓ marcadores.test.js: tipos, normalização, índice, contagens e migração das estrelas');
