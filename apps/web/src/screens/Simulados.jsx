import { useCallback, useEffect, useState } from 'react';
import { Icon } from '../lib/icons';
import { corrigirSimulado, respostasParaRegistrar, situacaoDaResposta, tempoDeProvaMinutos } from '../lib/simulado';
import { sortearMisto } from '../lib/quiz';
import { provasAnteriores, questoesDoExame, montarApostila, questoesParaTreinar, QUESTOES_DA_PROVA } from '../lib/apostila';
import { corDaMateria } from '../lib/areas';
import { formatarDuracao } from '../lib/metrics';
import { abrirSimulado, listarSimulados, finalizarSimulado as finalizarNoServidor, abandonarSimulado } from '../lib/api/api';
import ConfigSimulado from '../components/ui/ConfigSimulado';
import Cronometro from '../components/ui/Cronometro';
import Dialogo from '../components/ui/Dialogo';
import { TileDaMateria } from '../components/ui/Materia';
import { KpiCard, GraficoArea, CartaoDeGrafico } from '../components/ui/Metricas';
import { BotaoRiscar, GabaritoComentado, OrigemDaQuestao, TrilhaDaQuestao } from '../components/ui/CardDeQuestao';
import { alternarRisco } from '../lib/cardDeQuestao';

const LETRA = (i) => String.fromCharCode(65 + i);

const SITUACAO = {
  certa: { rotulo: 'Acertou', icone: 'circle-check', cor: '#4A7A4A', borda: '#4A7A4A40', fundo: '#4A7A4A08' },
  errada: { rotulo: 'Errou', icone: 'circle-x', cor: '#B4413A', borda: '#B4413A40', fundo: '#B4413A08' },
  'em-branco': { rotulo: 'Em branco', icone: 'circle-x', cor: '#7A5A12', borda: '#B07A1F40', fundo: '#B07A1F08' },
};

const COR_DO_QUADRADO = { certa: '#4A7A4A', errada: '#B4413A', 'em-branco': '#d9d5cc' };

// Nota de corte da 1ª fase: 40 das 80.
const CORTE = 40;
// A prova real: 5 horas.
const MINUTOS_DA_PROVA = 300;

// Botão secundário dos cards: o cheio fica só para a ação principal da tela.
const btnEscuro = { background: '#fff', color: '#1c1b19', border: '1px solid #d6d1c8', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 };

// Servidor anterior à migration 009 não manda `modalidade`: decide pela forma
// da linha, para uma linha geral nunca cair no ramo da prova real.
const ehGeral = (linha) => linha?.modalidade === 'geral' || Array.isArray(linha?.questoes);

// Simulados cuja fila de respostas ainda corre, por id do servidor. No módulo,
// e não no estado da tela: trocar de tela e voltar durante a fila não pode
// oferecer "Retomar" ou "Descartar" do simulado que acabou de terminar.
const FINALIZANDO = new Set();

const dataCurta = (iso) => (iso ? new Date(iso).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }) : '');

function nomeDoSimulado(linha) {
  if (!linha) return 'Simulado';
  if (ehGeral(linha)) return `Simulado Geral de ${dataCurta(linha.iniciado_em)}`;
  return `${linha.exame}º Exame de Ordem`;
}

const totalDoSimulado = (linha) => (ehGeral(linha) ? (linha.questoes || []).length : QUESTOES_DA_PROVA);

// Simulados de dois tipos, ambos registrados no servidor (estudo-service):
// a prova anterior, refeita como foi aplicada (as 80 do exame, na ordem, em 5
// horas), e o Simulado Geral, sorteado do acervo. Cada um vira uma apostila:
// a prova como a pessoa fez, para rever e treinar a partir dela.
//
// O servidor é que guarda a ordem e as respostas; se ele não responder ao
// abrir, a prova corre do mesmo jeito e só a apostila fica de fora. O histórico
// antigo do navegador (`resultados_historico`) continua aparecendo em "Meus
// simulados", sem apostila, porque não guardava as respostas.
export default function Simulados({ theme, s, data, setResultadosHistorico, resultados_historico, registrarRespostas, revisarQuestoes, acervo, recarregarAcervo, usuarioTentativas, sessaoExpirou }) {
  const [etapa, setEtapa] = useState('lista');
  const [simulado, setSimulado] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [filtroRevisao, setFiltroRevisao] = useState('todas');
  // Alternativas riscadas, por id da questão. Fora de `simulado` porque não é
  // resposta: não entra na correção nem no que se grava.
  const [riscadas, setRiscadas] = useState({});
  const [servidor, setServidor] = useState({ estado: 'carregando', simulados: [] });
  const [aviso, setAviso] = useState(null);
  const [lista, setLista] = useState('provas');
  const [ano, setAno] = useState('todos');
  const [apostilaId, setApostilaId] = useState(null);
  const [abrindo, setAbrindo] = useState(false);

  const QUESTOES = data.QUESTOES || [];

  const carregar = useCallback(async () => {
    try {
      const simulados = await listarSimulados();
      setServidor({ estado: 'pronto', simulados });
    } catch (err) {
      if (err.status === 401) { sessaoExpirou?.(); return; }
      setServidor((atual) => ({ ...atual, estado: 'erro' }));
    }
  }, [sessaoExpirou]);

  useEffect(() => { carregar(); }, [carregar]);

  const comecar = ({ pool, nome, modalidade, minutos, linha = null, inicio = Date.now() }) => {
    setSimulado({
      id: `sim-${Date.now()}`,
      nome,
      modalidade,
      servidorId: linha?.id ?? null,
      exame: linha?.exame ?? null,
      quantidade: pool.length,
      questoes_pool: pool,
      tempo_inicio: inicio,
      tempo_total_minutos: minutos,
      respostas: {},
    });
    setResultado(null);
    setFiltroRevisao('todas');
    setRiscadas({});
    setApostilaId(null);
    setEtapa('execucao');
  };

  // Abre no servidor e começa. 409 = já há um aberto: a tela mostra o aberto
  // para retomar ou descartar, em vez de abrir outro por cima. Outra falha
  // (rede, servidor antigo) não impede a prova: ela corre sem apostila.
  const abrirEComecar = async (corpo, montar) => {
    setAviso(null);
    setAbrindo(true);
    let linha = null;
    try {
      linha = await abrirSimulado(corpo);
    } catch (err) {
      if (err.status === 401) { sessaoExpirou?.(); return; }
      if (err.status === 409) {
        setAbrindo(false);
        setEtapa('lista');
        setAviso('Você já tem um simulado aberto. Retome ou descarte antes de começar outro.');
        carregar();
        return;
      }
      setAviso('O simulado não foi registrado no servidor: a prova vale, mas não vai gerar apostila.');
    }
    setAbrindo(false);
    comecar(montar(linha));
  };

  const iniciarGeral = ({ quantidade }) => {
    const pool = sortearMisto(QUESTOES, quantidade, usuarioTentativas || {});
    if (pool.length === 0) return;
    abrirEComecar({ modalidade: 'geral', questoes: pool.map((q) => String(q.id)) }, (linha) => ({
      pool, linha, modalidade: 'geral', nome: 'Simulado Geral', minutos: tempoDeProvaMinutos(pool.length),
    }));
  };

  const iniciarProva = (exame) => {
    const pool = questoesDoExame(QUESTOES, exame);
    if (pool.length === 0) return;
    // O caderno (tipo 1 a 4) é a mesma prova embaralhada; o acervo guarda a
    // ordem do tipo 1, e é ela que se refaz.
    abrirEComecar({ exame, tipo: 1 }, (linha) => ({
      pool, linha, modalidade: 'prova', nome: `${exame}º Exame de Ordem`, minutos: MINUTOS_DA_PROVA,
    }));
  };

  // Retomar reabre a mesma prova com o relógio de quando ela começou. As
  // respostas só vão ao servidor ao finalizar, então a prova volta em branco.
  const retomar = (linha) => {
    const porId = new Map(QUESTOES.map((q) => [String(q.id), q]));
    const pool = ehGeral(linha)
      ? (linha.questoes || []).map((id) => porId.get(String(id))).filter(Boolean)
      : questoesDoExame(QUESTOES, linha.exame);
    if (pool.length === 0) { setAviso('As questões deste simulado não estão no acervo carregado.'); return; }
    const total = ehGeral(linha) ? tempoDeProvaMinutos(pool.length) : MINUTOS_DA_PROVA;
    const inicio = Date.parse(linha.iniciado_em) || Date.now();
    const passados = Math.floor((Date.now() - inicio) / 60000);
    comecar({ pool, linha, modalidade: ehGeral(linha) ? 'geral' : 'prova', nome: nomeDoSimulado(linha), minutos: Math.max(1, total - passados), inicio });
  };

  // O simulado aberto que já tem respostas gravadas é um que terminou e não
  // chegou a ser finalizado (a rede caiu no /finalizar). Refazê-lo gravaria as
  // respostas de novo, contando tudo em dobro no desempenho: o caminho é só
  // concluir o registro, com a nota do que já está gravado.
  const concluirRegistro = async (linha) => {
    const ap = montarApostila(linha, { tentativas: usuarioTentativas, acervo: QUESTOES });
    try {
      await finalizarNoServidor(linha.id, { acertos: ap?.acertos ?? 0, anuladas: 0 });
      setAviso(null);
    } catch (err) {
      if (err.status === 401) { sessaoExpirou?.(); return; }
      setAviso(`O simulado não foi finalizado no servidor: ${err.message}`);
    }
    carregar();
  };

  const descartar = async (linha) => {
    try {
      await abandonarSimulado(linha.id);
    } catch (err) {
      if (err.status === 401) { sessaoExpirou?.(); return; }
      setAviso(`O simulado não foi descartado: ${err.message}`);
    }
    setAviso(null);
    carregar();
  };

  // Riscar não responde: a alternativa riscada continua clicável e vale como
  // resposta se a pessoa clicar nela, como no quiz.
  const alternarRiscoDe = (questaoId) => (idx) => setRiscadas((prev) => ({
    ...prev,
    [questaoId]: alternarRisco(prev[questaoId], idx),
  }));

  const selecionarResposta = (questaoId, respostaIdx) => {
    setSimulado((prev) => ({
      ...prev,
      respostas: { ...prev.respostas, [questaoId]: respostaIdx },
    }));
  };

  const finalizarSimulado = () => {
    // Cada resposta vira uma tentativa no servidor, igual às do quiz, as em
    // branco inclusive (como erradas e sem alternativa). `tempoSeg` vai nulo:
    // o cronômetro é da prova inteira. Com `simuladoId`, a tentativa fica
    // ligada ao simulado, e é isso que monta a apostila.
    //
    // A fila corre em segundo plano (a tela de resultado abre na hora) e só
    // depois dela o simulado é finalizado: o serviço recusa resposta num
    // simulado já encerrado.
    const correcao = corrigirSimulado(simulado.questoes_pool, simulado.respostas);
    const servidorId = simulado.servidorId;
    if (registrarRespostas) {
      const respostas = respostasParaRegistrar(simulado.questoes_pool, simulado.respostas)
        .map((r) => (servidorId ? { ...r, simuladoId: servidorId } : r));
      if (servidorId) FINALIZANDO.add(servidorId);
      Promise.resolve(registrarRespostas(respostas)).then(async (fila) => {
        if (!servidorId || fila?.sessaoTrocou) { FINALIZANDO.delete(servidorId); return; }
        try {
          await finalizarNoServidor(servidorId, { acertos: correcao.acertos, anuladas: 0 });
        } catch (err) {
          if (err.status === 401) { sessaoExpirou?.(); return; }
          setAviso(`O simulado não foi finalizado no servidor: ${err.message}`);
        } finally {
          FINALIZANDO.delete(servidorId);
        }
        carregar();
      });
    }

    const tempoTotalMinutos = Math.max(1, Math.round((Date.now() - simulado.tempo_inicio) / 60000));
    const novo = {
      id: simulado.id,
      nome: simulado.nome,
      tipo: simulado.modalidade,
      quantidade: simulado.quantidade,
      acertos: correcao.acertos,
      errados: simulado.quantidade - correcao.acertos,
      em_branco: correcao.emBranco,
      nota_final: correcao.nota,
      tempo_total_minutos: tempoTotalMinutos,
      tempo_limite_minutos: simulado.tempo_total_minutos,
      data_conclusao: new Date().toISOString(),
      servidor_id: servidorId,
    };

    // Registrado no servidor, o simulado já está em "Meus simulados" com
    // apostila; o histórico local fica só para o que não chegou lá.
    if (!servidorId) setResultadosHistorico((prev) => [...(prev || []), novo]);
    setResultado(novo);
    setEtapa('resultado');
  };

  // ---- ETAPA: lista (provas anteriores, meus simulados, simulado geral) ----
  if (etapa === 'lista') {
    const estadoAcervo = acervo?.estado || 'pronto';
    const semAcervo = QUESTOES.length === 0;
    const erroAcervo = semAcervo && estadoAcervo === 'erro';

    const doServidor = servidor.simulados;
    const aberto = doServidor.find((x) => x.status === 'aberto') || null;
    const finalizandoAberto = aberto ? FINALIZANDO.has(aberto.id) : false;
    const respondidasNoAberto = aberto
      ? Object.values(usuarioTentativas || {}).filter((r) => (r?.tentativas || []).some((t) => t.simulado_id === aberto.id)).length
      : 0;
    const finalizados = doServidor.filter((x) => x.status === 'finalizado');
    const locais = (resultados_historico || []).filter((r) => !r.servidor_id);
    const feitos = finalizados.length + locais.length;

    // Placar em acertos de 80 só para provas de 80 questões: um geral de 20
    // não entra na média nem na curva, ou a curva compararia coisas diferentes.
    // Prova refeita (a pessoa já viu as questões) fica fora da média e da
    // curva, como a migration 006 decidiu; ela continua na lista, com o aviso.
    const completos = finalizados.filter((x) => totalDoSimulado(x) === QUESTOES_DA_PROVA && !x.refeito).slice().reverse();
    const ultimo = completos[completos.length - 1] || null;
    const penultimo = completos[completos.length - 2] || null;
    const media = completos.length > 0 ? Math.round(completos.reduce((t, x) => t + x.nota, 0) / completos.length) : null;
    const passou = completos.filter((x) => x.nota >= CORTE).length;

    const provas = provasAnteriores(QUESTOES);
    const anos = [...new Set(provas.map((p) => p.ano).filter(Boolean))].sort((a, b) => b - a);
    const visiveis = provas.filter((p) => ano === 'todos' || String(p.ano) === String(ano));
    const feitasPorExame = new Map();
    for (const x of doServidor) {
      if (!ehGeral(x) && x.status !== 'abandonado') {
        if (!feitasPorExame.has(x.exame)) feitasPorExame.set(x.exame, x); // a mais recente primeiro
      }
    }

    const ultimaApostila = finalizados[0] ? montarApostila(finalizados[0], { tentativas: usuarioTentativas, acervo: QUESTOES }) : null;
    const deixou = ultimaApostila
      ? ultimaApostila.porMateria.filter((m) => m.erros + m.emBranco > 0 && m.nome !== 'Sem classificação').slice(0, 6)
      : [];

    const linhaDeProva = (p) => {
      const feita = feitasPorExame.get(p.exame);
      const status = !feita
        ? <span style={s.pill('#f1efea', '#4f4b45')}>Não feita</span>
        : feita.status === 'aberto'
          ? <span style={s.pill('#F5EEDC', '#7A5A12')}>Em andamento</span>
          : (
            <span style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <b style={{ fontVariantNumeric: 'tabular-nums', fontSize: 13 }}>{feita.nota} de 80</b>
              <span style={feita.nota >= CORTE ? s.pill('#E4EEE1', '#355E35') : s.pill('#F6E4E1', '#8F2F29')}>{feita.nota >= CORTE ? 'Acima de 40' : 'Abaixo de 40'}</span>
              {feita.duracao_seg != null && <span style={{ fontSize: 12, color: '#6a665f' }}>{formatarDuracao(feita.duracao_seg)}</span>}
            </span>
          );
      return (
        <div key={p.exame} data-testid={`prova-${p.exame}`} className="linha-prova" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.3fr) minmax(0, 1fr) auto', gap: 14, alignItems: 'center', padding: '12px 0', borderTop: '1px solid #eeebe5' }}>
          <div>
            <b style={{ fontSize: 13.5, color: '#1c1b19' }}>{p.exame}º Exame de Ordem</b>
            <div style={{ fontSize: 12, color: '#6a665f' }}>
              {p.completa ? '1ª fase · 80 questões · 5 horas · como foi aplicada' : `${p.total} de 80 questões no acervo`}
            </div>
          </div>
          <span style={{ justifySelf: 'start' }}>{status}</span>
          {feita && feita.status === 'finalizado' ? (
            <button data-testid={`apostila-${feita.id}`} onClick={() => setApostilaId(feita.id)} style={{ ...s.link, background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 600 }}>
              <Icon name="book" color={theme.primary} size={14} /> Abrir apostila
            </button>
          ) : (
            <button
              data-testid={`fazer-prova-${p.exame}`}
              disabled={!p.completa || Boolean(aberto) || abrindo}
              title={!p.completa ? 'O acervo ainda não tem as 80 questões deste exame' : aberto ? 'Termine ou descarte o simulado aberto' : undefined}
              onClick={() => iniciarProva(p.exame)}
              style={{ ...s.btnOutline, opacity: !p.completa || aberto ? 0.5 : 1, cursor: !p.completa || aberto ? 'not-allowed' : 'pointer' }}
            >
              Fazer a prova
            </button>
          )}
        </div>
      );
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="grade-kpi" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 14 }}>
          <KpiCard rotulo="Simulados feitos" valor={feitos} contexto={finalizados.length > 0 ? 'cada um tem a sua apostila' : 'nenhum ainda'} testId="kpi-feitos" />
          <KpiCard
            rotulo="Último de 80 questões"
            valor={ultimo ? `${ultimo.nota} de 80` : '—'}
            variacao={ultimo && penultimo ? { valor: ultimo.nota - penultimo.nota, texto: `${ultimo.nota - penultimo.nota >= 0 ? '+' : '−'}${Math.abs(ultimo.nota - penultimo.nota)}` } : null}
            contexto={penultimo ? `vs o anterior (${penultimo.nota})` : 'prova completa'}
            curva={completos.length >= 2 ? completos.map((x) => x.nota) : undefined}
            corDaCurva={theme.primary}
          />
          <KpiCard rotulo="Média" valor={media != null ? `${media} de 80` : '—'} contexto={completos.length > 0 ? `melhor: ${Math.max(...completos.map((x) => x.nota))}` : 'sem prova completa'} />
          <KpiCard rotulo="Para passar" valor="40 de 80" contexto={completos.length > 0 ? `você passou em ${passou} de ${completos.length}` : 'a nota de corte da 1ª fase'} />
        </div>

        {erroAcervo && (
          <div role="alert" data-testid="simulados-acervo-erro" style={{ ...s.card, display: 'flex', alignItems: 'center', gap: 14, background: '#FAF0EE', border: '1px solid #EBCBC6' }}>
            <Icon name="circle-x" color="#9E3630" size={22} />
            <div style={{ flex: 1, fontSize: 13, color: '#8F2F29', lineHeight: 1.5 }}>
              <b>O acervo não carregou.</b> {acervo?.erro ? `${acervo.erro}. ` : ''}As questões vêm do servidor, então sem esta chamada não há simulado.
            </div>
            {recarregarAcervo && (
              <button style={{ ...s.btnOutline, flex: 'none', cursor: 'pointer' }} onClick={recarregarAcervo}>Tentar de novo</button>
            )}
          </div>
        )}

        {aviso && (
          <div role="status" data-testid="aviso-simulado" style={{ ...s.card, padding: '12px 16px', fontSize: 13, color: '#7A5A12', background: '#FBF6EA' }}>{aviso}</div>
        )}

        {aberto && finalizandoAberto && (
          <div role="status" data-testid="simulado-finalizando" style={{ ...s.card, padding: '12px 16px', fontSize: 13, color: '#4f4b45' }}>
            Salvando as respostas do {nomeDoSimulado(aberto)}. A apostila aparece em "Meus simulados" quando terminar.
          </div>
        )}
        {aberto && !finalizandoAberto && respondidasNoAberto > 0 && (
          <div data-testid="simulado-sem-registro" style={{ ...s.card, display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <h2 style={s.sectionTitle}>O {nomeDoSimulado(aberto)} não terminou de ser registrado</h2>
              <p style={{ ...s.pageSub, margin: '3px 0 0' }}>
                {respondidasNoAberto} {respondidasNoAberto === 1 ? 'resposta já está salva' : 'respostas já estão salvas'}. Concluir o registro gera a apostila com elas, sem refazer a prova.
              </p>
            </div>
            <button data-testid="concluir-registro" style={s.btnPrimary} onClick={() => concluirRegistro(aberto)}>Concluir o registro</button>
          </div>
        )}
        {aberto && !finalizandoAberto && respondidasNoAberto === 0 && (
          <div data-testid="simulado-aberto" style={{ ...s.card, display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ width: 40, height: 40, borderRadius: 9, background: theme.primarySoft, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
              <Icon name="timer" color={theme.primary} size={20} />
            </span>
            <div style={{ flex: 1, minWidth: 220 }}>
              <h2 style={s.sectionTitle}>Retomar o {nomeDoSimulado(aberto)}</h2>
              <p style={{ ...s.pageSub, margin: '3px 0 0' }}>
                Começou em {new Date(aberto.iniciado_em).toLocaleString('pt-BR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}. O relógio segue de onde a prova começou; as respostas só ficam salvas ao finalizar.
              </p>
            </div>
            <button data-testid="descartar-simulado" style={s.btnOutline} onClick={() => descartar(aberto)}>Descartar</button>
            <button data-testid="retomar-simulado" style={s.btnPrimary} onClick={() => retomar(aberto)}>
              Retomar simulado <Icon name="chevron-right" color="#fff" size={14} />
            </button>
          </div>
        )}

        <div className="grade-simulados" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.7fr) minmax(0, 1fr)', gap: 16, alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <section style={s.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <div role="tablist" aria-label="Lista" style={{ display: 'inline-flex', background: '#f1efea', borderRadius: 8, padding: 3 }}>
                  {[['provas', 'Provas anteriores'], ['meus', `Meus simulados (${feitos})`]].map(([k, rotulo]) => (
                    <button
                      key={k}
                      role="tab"
                      aria-selected={lista === k}
                      data-testid={`lista-${k}`}
                      onClick={() => setLista(k)}
                      style={{ border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', background: lista === k ? '#fff' : 'transparent', color: lista === k ? '#1c1b19' : '#4f4b45', boxShadow: lista === k ? '0 1px 2px rgba(0,0,0,.08)' : 'none' }}
                    >
                      {rotulo}
                    </button>
                  ))}
                </div>
                {lista === 'provas' && anos.length > 1 && (
                  <div role="radiogroup" aria-label="Ano" style={{ display: 'inline-flex', gap: 4 }}>
                    {['todos', ...anos].map((y) => (
                      <button
                        key={y}
                        role="radio"
                        aria-checked={String(ano) === String(y)}
                        onClick={() => setAno(y)}
                        style={{ border: '1px solid #e6e2da', borderRadius: 6, padding: '5px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', background: String(ano) === String(y) ? theme.primarySoft : '#fff', color: String(ano) === String(y) ? theme.primaryDark : '#4f4b45' }}
                      >
                        {y === 'todos' ? 'Todos' : y}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <p style={{ ...s.pageSub, margin: '10px 0 4px' }}>
                {lista === 'provas'
                  ? 'Cada prova é refeita como foi aplicada: as questões do exame, na ordem, com 5 horas e o gabarito oficial da FGV.'
                  : 'Todo simulado registrado vira uma apostila: as questões, o seu gabarito e o que treinar a partir dele.'}
              </p>
              {lista === 'provas' ? (
                visiveis.length === 0 ? (
                  <div style={{ fontSize: 13, color: '#6a665f', padding: '14px 0' }}>{semAcervo ? 'O acervo ainda não carregou.' : 'Nenhum exame no acervo.'}</div>
                ) : (
                  (ano === 'todos' && anos.length > 0 ? anos : [ano]).map((y) => {
                    const doAno = visiveis.filter((p) => String(p.ano) === String(y));
                    if (doAno.length === 0) return null;
                    return (
                      <div key={y}>
                        {ano === 'todos' && <div style={{ fontSize: 12, fontWeight: 700, color: '#6a665f', marginTop: 12 }}>{y}</div>}
                        {doAno.map(linhaDeProva)}
                      </div>
                    );
                  }).concat(visiveis.filter((p) => p.ano == null).map(linhaDeProva))
                )
              ) : (
                <div data-testid="meus-simulados">
                  {feitos === 0 && <div style={{ fontSize: 13, color: '#6a665f', padding: '14px 0' }}>Você ainda não terminou nenhum simulado.</div>}
                  {finalizados.map((x, i) => {
                    const total = totalDoSimulado(x);
                    const anterior = finalizados.slice(i + 1).find((y) => totalDoSimulado(y) === total);
                    const dif = anterior ? x.nota - anterior.nota : null;
                    return (
                      <div key={x.id} className="linha-prova" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.3fr) minmax(0, 1fr) auto', gap: 14, alignItems: 'center', padding: '12px 0', borderTop: '1px solid #eeebe5' }}>
                        <div>
                          <b style={{ fontSize: 13.5, color: '#1c1b19' }}>{nomeDoSimulado(x)}</b>
                          <div style={{ fontSize: 12, color: '#6a665f' }}>{dataCurta(x.finalizado_em)}{x.fora_do_tempo ? ' · passou do tempo' : ''}{x.refeito ? ' · prova já feita antes' : ''}</div>
                        </div>
                        <span style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          <b style={{ fontVariantNumeric: 'tabular-nums', fontSize: 13 }}>{x.nota} de {total}</b>
                          {dif != null && dif !== 0 && <span style={s.pill(dif > 0 ? '#E8F0E6' : '#F6E5E3', dif > 0 ? '#355E35' : '#8F2F29')}>{dif > 0 ? '+' : '−'}{Math.abs(dif)}</span>}
                          {x.duracao_seg != null && <span style={{ fontSize: 12, color: '#6a665f' }}>{formatarDuracao(x.duracao_seg)}</span>}
                        </span>
                        <button data-testid={`apostila-${x.id}`} onClick={() => setApostilaId(x.id)} style={{ ...s.link, background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 600 }}>
                          <Icon name="book" color={theme.primary} size={14} /> Abrir apostila
                        </button>
                      </div>
                    );
                  })}
                  {locais.slice().reverse().map((r) => (
                    <div key={r.id} className="linha-prova" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.3fr) minmax(0, 1fr) auto', gap: 14, alignItems: 'center', padding: '12px 0', borderTop: '1px solid #eeebe5' }}>
                      <div>
                        <b style={{ fontSize: 13.5, color: '#1c1b19' }}>{r.nome}</b>
                        <div style={{ fontSize: 12, color: '#6a665f' }}>{dataCurta(r.data_conclusao)} · só neste navegador</div>
                      </div>
                      <span style={{ fontSize: 13 }}><b style={{ fontVariantNumeric: 'tabular-nums' }}>{r.acertos} de {r.quantidade}</b></span>
                      <span style={{ fontSize: 12, color: '#6a665f' }}>sem apostila</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section data-testid="hero-simulado-geral" style={{ ...s.card, display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 220 }}>
                <h2 style={s.sectionTitle}>Simulado Geral</h2>
                <p style={{ ...s.pageSub, margin: '3px 0 0' }}>
                  {semAcervo
                    ? 'O acervo ainda não carregou, então não há questões para sortear.'
                    : 'Questões distribuídas como a prova cobra, primeiro as que você ainda não fez. Também vira apostila.'}
                </p>
              </div>
              <button
                data-testid="novo-simulado"
                onClick={() => setEtapa('config')}
                disabled={semAcervo || Boolean(aberto)}
                title={aberto ? 'Termine ou descarte o simulado aberto' : undefined}
                style={{ ...s.btnOutline, display: 'flex', alignItems: 'center', gap: 6, opacity: semAcervo || aberto ? 0.5 : 1, cursor: semAcervo || aberto ? 'not-allowed' : 'pointer' }}
              >
                <Icon name="play" color="#1c1b19" size={12} /> Iniciar simulado
              </button>
            </section>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {completos.length >= 2 && (
              <CartaoDeGrafico titulo="Acertos por simulado" sub={`${completos.length} provas de 80 questões. A linha tracejada é a nota de corte.`}>
                <GraficoArea
                  rotulos={completos.map((x) => dataCurta(x.finalizado_em))}
                  series={[{ rotulo: 'Acertos', valores: completos.map((x) => x.nota), cor: theme.primary }]}
                  descricao={`Acertos por simulado, de ${Math.min(...completos.map((x) => x.nota))} a ${Math.max(...completos.map((x) => x.nota))} de 80`}
                  largura={320}
                  altura={210}
                  referencia={{ valor: CORTE, rotulo: 'Corte: 40' }}
                />
              </CartaoDeGrafico>
            )}
            {ultimaApostila && deixou.length > 0 && (
              <section style={s.card} data-testid="onde-deixou">
                <h2 style={s.sectionTitle}>Onde você deixou pontos</h2>
                <div style={{ fontSize: 12, color: '#6a665f', margin: '4px 0 12px' }}>No {nomeDoSimulado(ultimaApostila.simulado)}: as matérias em que você mais deixou questões.</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                  {deixou.map((m) => (
                    <div key={m.nome}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
                        <span style={{ display: 'flex', gap: 8, alignItems: 'center', color: '#1c1b19', minWidth: 0 }}><TileDaMateria materia={m.nome} tamanho={22} />{m.nome}</span>
                        <span style={{ color: '#6a665f', flex: 'none' }}>levou {m.acertos} de {m.total}</span>
                      </div>
                      <div style={{ ...s.progressTrack, marginTop: 5 }}><div style={{ width: `${(m.acertos / m.total) * 100}%`, height: '100%', background: corDaMateria(m.nome), borderRadius: 3 }} /></div>
                    </div>
                  ))}
                </div>
                <button onClick={() => setApostilaId(ultimaApostila.simulado.id)} style={{ ...s.link, background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 600, marginTop: 14, padding: 0 }}>
                  <Icon name="book" color={theme.primary} size={14} /> Abrir a apostila deste simulado
                </button>
              </section>
            )}
            <section style={s.card}>
              <h2 style={s.sectionTitle}>Simulado da 2ª fase</h2>
              <p style={{ ...s.pageSub, margin: '4px 0 0' }}>A 2ª fase de Direito Civil tem tela própria: troque a fase no seletor do topo da barra lateral.</p>
            </section>
          </div>
        </div>

        {apostilaId != null && (() => {
          const linha = doServidor.find((x) => x.id === apostilaId);
          const ap = linha ? montarApostila(linha, { tentativas: usuarioTentativas, acervo: QUESTOES }) : null;
          if (!ap) return null;
          return (
            <Apostila
              s={s}
              theme={theme}
              apostila={ap}
              onFechar={() => setApostilaId(null)}
              treinar={(questoes) => { setApostilaId(null); revisarQuestoes?.(questoes); }}
              refazerProva={aberto ? null : () => {
                setApostilaId(null);
                if (!ehGeral(linha)) iniciarProva(linha.exame);
                else {
                  const pool = ap.itens.map((x) => x.questao).filter(Boolean);
                  if (pool.length === 0) { setAviso('As questões deste simulado não estão no acervo carregado.'); return; }
                  abrirEComecar({ modalidade: 'geral', questoes: pool.map((q) => String(q.id)) }, (l) => ({
                    pool, linha: l, modalidade: 'geral', nome: 'Simulado Geral', minutos: tempoDeProvaMinutos(pool.length),
                  }));
                }
              }}
            />
          );
        })()}
      </div>
    );
  }

  // ---- ETAPA: Configuração do Simulado Geral ----
  if (etapa === 'config') {
    return (
      <div>
        <button
          onClick={() => setEtapa('lista')}
          style={{ marginBottom: 16, padding: '8px 14px', border: '1px solid #e6e2da', background: '#fff', color: '#4f4b45', borderRadius: 8, fontSize: 12.5, cursor: 'pointer', fontWeight: 600 }}
        >
          ← Voltar
        </button>
        <ConfigSimulado s={s} onConfirm={iniciarGeral} questoes={QUESTOES} />
      </div>
    );
  }

  // ---- ETAPA: Execução (todas as questões em uma página, sem feedback) ----
  if (etapa === 'execucao' && simulado) {
    const respondidas = Object.keys(simulado.respostas).length;
    const pctRespondidas = simulado.quantidade ? (respondidas / simulado.quantidade) * 100 : 0;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, position: 'relative' }}>
        <div style={{ ...s.card, textAlign: 'center', padding: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#1c1b19' }}>
            {simulado.nome}
          </div>
          <div style={{ fontSize: 13, color: '#6a665f', marginTop: 4 }}>
            <b style={{ color: '#1c1b19' }}>{simulado.quantidade} {simulado.quantidade === 1 ? 'questão' : 'questões'}</b> · {formatarDuracao(simulado.tempo_total_minutos * 60)} de prova
          </div>
          <div style={{ fontSize: 12, color: '#6a665f', marginTop: 6 }}>
            Sem correção durante a prova — o gabarito aparece quando você finalizar.
          </div>
        </div>

        {simulado.questoes_pool.map((q, i) => (
          <div key={q.id} data-testid={`sim-q-${i}`} style={s.card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 14, borderBottom: '1px solid #eeebe5', flexWrap: 'wrap' }}>
              <span style={{ background: theme.primarySoft, color: theme.primaryDark, fontWeight: 700, fontSize: 12.5, padding: '5px 14px', borderRadius: 8 }}>
                Questão {i + 1}
              </span>
              {/* Procedência real (exame, ano, banca, número) e a trilha
                  "Disciplina › Tema" — os mesmos do quiz. Nada aqui entrega
                  gabarito: a prova continua sem correção até o fim. A
                  disciplina antes só aparecia no simulado geral (no por
                  matéria é a mesma em todas); a trilha aparece nos dois porque
                  o tema muda de questão para questão. */}
              <OrigemDaQuestao questao={q} />
              <TrilhaDaQuestao s={s} theme={theme} questao={q} style={{ marginLeft: 'auto' }} />
            </div>

            <div style={{ fontSize: 14.5, color: '#1c1b19', lineHeight: 1.65, margin: '16px 0', whiteSpace: 'pre-wrap' }}>{q.enunciado}</div>

            <div role="radiogroup" aria-label={`Alternativas da questão ${i + 1}`} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {q.alternativas.map((alt, idx) => {
                const escolhida = simulado.respostas[q.id] === idx;
                const riscada = (riscadas[q.id] || []).includes(idx);
                // A tesoura fica ao lado, e não dentro, da alternativa: botão
                // não pode conter botão, e aqui a alternativa é um <button> de
                // verdade (foco e Enter/Espaço nativos).
                return (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button
                      role="radio"
                      aria-checked={escolhida}
                      data-testid={`alt-${idx}`}
                      onClick={() => selecionarResposta(q.id, idx)}
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '13px 16px',
                        borderRadius: 10,
                        border: escolhida ? `1.5px solid ${theme.primary}` : '1px solid #e6e2da',
                        background: escolhida ? theme.primarySoft : '#fff',
                        cursor: 'pointer',
                        textAlign: 'left',
                        fontSize: 13.5,
                        color: '#1c1b19',
                        fontFamily: 'inherit',
                        transition: 'border-color 150ms var(--ease-out), background-color 150ms var(--ease-out)',
                      }}
                    >
                      <div style={{
                        width: 18, height: 18, borderRadius: '50%', flex: 'none',
                        border: escolhida ? `5px solid ${theme.primary}` : '2px solid #d6d1c8',
                        background: '#fff', boxSizing: 'border-box',
                      }} />
                      <b style={{ color: escolhida ? theme.primaryDark : '#6a665f', flex: 'none', opacity: riscada ? 0.5 : 1 }}>{LETRA(idx)})</b>
                      <div
                        data-riscada={riscada ? 'sim' : 'nao'}
                        style={{ textDecoration: riscada ? 'line-through' : 'none', opacity: riscada ? 0.5 : 1 }}
                      >
                        {alt}
                      </div>
                    </button>
                    <BotaoRiscar theme={theme} indice={idx} riscada={riscada} onAlternar={alternarRiscoDe(q.id)} />
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Barra fixa inferior: cronômetro, contador e Finalizar */}
        <div
          data-testid="barra-simulado"
          style={{
            position: 'sticky', bottom: 12, zIndex: 20,
            ...s.card,
            boxShadow: '0 6px 24px rgba(0,0,0,.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
            padding: '12px 20px',
          }}
        >
          <Cronometro tempoTotalMinutos={simulado.tempo_total_minutos} aoTerminar={finalizarSimulado} />
          <div style={{ flex: 1, maxWidth: 260, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <div data-testid="contador-respondidas" style={{ fontSize: 13, color: '#4f4b45', fontWeight: 600 }}>
              {respondidas}/{simulado.quantidade} respondidas
            </div>
            <div style={{ ...s.progressTrack, height: 6, width: '100%' }}>
              <div style={{ width: `${pctRespondidas}%`, height: '100%', background: theme.primary, borderRadius: 5, transition: 'width 200ms var(--ease-out)' }} />
            </div>
          </div>
          <button
            data-testid="finalizar-simulado"
            onClick={finalizarSimulado}
            style={{ ...btnEscuro, background: theme.primary, color: "#fff", border: `1px solid ${theme.primaryDark}`, padding: '11px 24px', borderRadius: 10, fontSize: 13.5 }}
          >
            Finalizar <Icon name="check" color="#fff" size={16} />
          </button>
        </div>
      </div>
    );
  }

  // ---- ETAPA: Resultado + revisão questão a questão ----
  if (etapa === 'resultado' && simulado && resultado) {
    const correcao = corrigirSimulado(simulado.questoes_pool, simulado.respostas);
    const nota = resultado.nota_final;
    const faixa = nota >= 70
      ? { icone: 'trophy', cor: '#4A7A4A', fundo: '#E4EEE1' }
      : nota >= 50
        ? { icone: 'target', cor: '#B07A1F', fundo: '#F5EEDC' }
        : { icone: 'trending-up', cor: '#B4413A', fundo: '#F6E4E1' };

    const itens = simulado.questoes_pool
      .map((q, i) => ({ q, i, situacao: situacaoDaResposta(q, simulado.respostas) }))
      .filter((it) => filtroRevisao === 'todas'
        || (filtroRevisao === 'erradas' && it.situacao !== 'certa'));

    const resumo = [
      { rotulo: 'Acertos', valor: correcao.acertos, cor: '#4A7A4A' },
      { rotulo: 'Erros', valor: correcao.erros, cor: '#B4413A' },
      { rotulo: 'Em branco', valor: correcao.emBranco, cor: '#B07A1F' },
      { rotulo: 'Tempo', valor: `${resultado.tempo_total_minutos} min`, cor: '#1c1b19' },
    ];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ ...s.card, textAlign: 'center', padding: 28 }}>
          <div style={{ width: 76, height: 76, borderRadius: '50%', margin: '0 auto', background: faixa.fundo, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={faixa.icone} color={faixa.cor} size={38} />
          </div>
          <div style={{ fontSize: 14, color: '#6a665f', marginTop: 8 }}>Nota final</div>
          <div data-testid="nota-final" style={{ fontSize: 48, fontWeight: 700, color: theme.primary }}>{nota}%</div>
          <div style={{ fontSize: 13, marginTop: 4, color: '#4f4b45' }}>{resultado.acertos} acertos em {resultado.quantidade} questões</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginTop: 20, maxWidth: 520, marginLeft: 'auto', marginRight: 'auto' }}>
            {resumo.map((r) => (
              <div key={r.rotulo} style={{ background: '#faf9f6', borderRadius: 12, padding: '10px 6px' }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: r.cor }}>{r.valor}</div>
                <div style={s.statLabel}>{r.rotulo}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={s.card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <h2 style={s.sectionTitle}><Icon name="clipboard-list" color={theme.primary} size={18} />Revisão do simulado</h2>
            <div style={{ display: 'flex', gap: 6 }}>
              {[['todas', 'Todas'], ['erradas', 'Erradas e em branco']].map(([k, rotulo]) => (
                <button
                  key={k}
                  data-testid={`revisao-${k}`}
                  onClick={() => setFiltroRevisao(k)}
                  style={{
                    padding: '6px 12px', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    border: `1px solid ${filtroRevisao === k ? theme.primary : '#e6e2da'}`,
                    background: filtroRevisao === k ? theme.primarySoft : '#fff',
                    color: filtroRevisao === k ? theme.primaryDark : '#4f4b45',
                  }}
                >
                  {rotulo}
                </button>
              ))}
            </div>
          </div>

          {itens.length === 0 && (
            <div style={{ fontSize: 13, color: '#6a665f', marginTop: 14 }}>Nenhuma questão errada ou em branco.</div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 14 }}>
            {itens.map(({ q, i, situacao }) => {
              const sit = SITUACAO[situacao];
              const resposta = simulado.respostas[q.id];
              return (
                <div key={q.id} data-testid={`revisao-q-${i}`} style={{ padding: 16, borderRadius: 12, border: `1px solid ${sit.borda}`, background: sit.fundo }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <Icon name={sit.icone} color={sit.cor} size={18} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#1c1b19' }}>Questão {i + 1}</span>
                    <span style={{ fontSize: 11.5, color: sit.cor, fontWeight: 700 }}>{sit.rotulo}</span>
                    <OrigemDaQuestao questao={q} style={{ fontSize: 11 }} />
                    <TrilhaDaQuestao s={s} theme={theme} questao={q} pill={s.pill('#fff', '#4f4b45')} style={{ marginLeft: 'auto' }} />
                  </div>
                  <div style={{ fontSize: 13, color: '#4f4b45', marginTop: 8, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{q.enunciado}</div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
                    {q.alternativas.map((alt, idx) => {
                      const eGabarito = idx === q.correta;
                      const eMarcada = idx === resposta;
                      const cor = eGabarito ? '#4A7A4A' : eMarcada ? '#B4413A' : null;
                      return (
                        <div
                          key={idx}
                          style={{
                            display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12.5, lineHeight: 1.5,
                            padding: '7px 10px', borderRadius: 8, background: '#fff',
                            border: `1px solid ${cor ? cor + '60' : '#eeebe5'}`,
                            color: '#1c1b19',
                          }}
                        >
                          <b style={{ color: cor || '#6a665f', flex: 'none' }}>{LETRA(idx)})</b>
                          <span style={{ flex: 1 }}>{alt}</span>
                          {eGabarito && <span style={{ fontSize: 11, fontWeight: 700, color: '#4A7A4A', flex: 'none' }}>Gabarito</span>}
                          {eMarcada && !eGabarito && <span style={{ fontSize: 11, fontWeight: 700, color: '#B4413A', flex: 'none' }}>Sua resposta</span>}
                        </div>
                      );
                    })}
                  </div>

                  {/* O mesmo gabarito comentado do quiz, com a mesma
                      assinatura: o que a IA escreveu vem "Comentado pelo Kepy".
                      Abre aberto, como antes; cada questão recolhe o seu sem
                      mexer nas outras. */}
                  {q.explicacao && (
                    <GabaritoComentado
                      s={s}
                      questao={q}
                      compacto
                      style={{ marginTop: 10, padding: 12, background: '#fff', borderRadius: 8 }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <button
          data-testid="voltar-simulados"
          onClick={() => { setSimulado(null); setResultado(null); setEtapa('lista'); }}
          style={{ ...btnEscuro, padding: 13, borderRadius: 10, fontSize: 14 }}
        >
          Voltar para simulados
        </button>
      </div>
    );
  }

  return null;
}

// A apostila de um simulado: o placar, o mapa das questões na ordem em que
// caíram (verde acertou, vermelho errou, cinza em branco), o desempenho por
// matéria naquela prova e o treino a partir dela. Treinar abre as questões no
// quiz, com gabarito ao responder; refazer a prova abre outro simulado.
function Apostila({ s, theme, apostila, onFechar, treinar, refazerProva }) {
  const { simulado, itens } = apostila;
  const erros = questoesParaTreinar(apostila, { filtro: 'erros' });
  const emBranco = questoesParaTreinar(apostila, { filtro: 'em-branco' });
  const resumo = [
    { rotulo: 'Acertos', valor: apostila.acertos, cor: '#355E35' },
    { rotulo: 'Erros', valor: apostila.erros, cor: '#8F2F29' },
    { rotulo: 'Em branco', valor: apostila.emBranco, cor: '#4f4b45' },
    { rotulo: 'Tempo', valor: apostila.duracaoSeg != null ? formatarDuracao(apostila.duracaoSeg) : '—', cor: '#1c1b19' },
  ];

  return (
    <Dialogo
      testId="apostila"
      largura={820}
      titulo={`Apostila · ${nomeDoSimulado(simulado)}`}
      sub={`${simulado.nota ?? apostila.acertos} de ${apostila.total} · ${dataCurta(simulado.finalizado_em)}${simulado.fora_do_tempo ? ' · passou do tempo' : ''}`}
      acoes={(
        <button data-testid="refazer-erros" disabled={erros.length === 0} onClick={() => treinar(erros)} style={{ ...s.btnPrimary, opacity: erros.length === 0 ? 0.5 : 1 }}>
          <Icon name="rotate-ccw" color="#fff" size={13} /> Refazer só os erros
        </button>
      )}
      onFechar={onFechar}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
        {resumo.map((r) => (
          <div key={r.rotulo} style={{ background: '#fff', borderRadius: 10, padding: '10px 12px', border: '1px solid #eeebe5' }}>
            <div style={{ fontSize: 11.5, color: '#6a665f' }}>{r.rotulo}</div>
            <div style={{ fontSize: 20, fontWeight: 600, color: r.cor, fontVariantNumeric: 'tabular-nums' }}>{r.valor}</div>
          </div>
        ))}
      </div>

      <div style={{ background: '#fff', borderRadius: 10, padding: 14, border: '1px solid #eeebe5' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#1c1b19', marginBottom: 10 }}>Seu gabarito</div>
        <div
          role="img"
          aria-label={`${apostila.acertos} acertos, ${apostila.erros} erros e ${apostila.emBranco} em branco, na ordem da prova`}
          style={{ display: 'grid', gridTemplateColumns: 'repeat(20, minmax(0, 1fr))', gap: 4 }}
        >
          {itens.map((x) => (
            <span
              key={x.numero}
              title={`Questão ${x.numero} · ${x.disciplina} · ${SITUACAO[x.situacao].rotulo}`}
              style={{ aspectRatio: '1', borderRadius: 3, background: COR_DO_QUADRADO[x.situacao], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: x.situacao === 'em-branco' ? '#4f4b45' : '#fff', fontVariantNumeric: 'tabular-nums' }}
            >
              {x.numero}
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 11.5, color: '#6a665f', marginTop: 10 }}>
          {[['certa', 'Acertou'], ['errada', 'Errou'], ['em-branco', 'Em branco']].map(([k, rotulo]) => (
            <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><i style={{ width: 9, height: 9, borderRadius: 2, background: COR_DO_QUADRADO[k], display: 'block' }} />{rotulo}</span>
          ))}
        </div>
      </div>

      <div style={{ background: '#fff', borderRadius: 10, padding: 14, border: '1px solid #eeebe5' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#1c1b19', marginBottom: 8 }}>Por matéria nesta prova</div>
        {apostila.porMateria.map((m) => {
          const pendentes = questoesParaTreinar(apostila, { materia: m.nome });
          return (
            <div key={m.nome} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 90px auto', gap: 12, alignItems: 'center', padding: '7px 0', borderTop: '1px solid #f1efea' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: '#1c1b19', minWidth: 0 }}>
                <TileDaMateria materia={m.nome} tamanho={22} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.nome}</span>
              </span>
              <span style={{ fontSize: 12.5, color: '#4f4b45', fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>{m.acertos} de {m.total}</span>
              <button
                disabled={pendentes.length === 0}
                onClick={() => treinar(pendentes)}
                style={{ ...s.btnOutline, padding: '5px 10px', fontSize: 12, opacity: pendentes.length === 0 ? 0.4 : 1 }}
              >
                Treinar
              </button>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button data-testid="treinar-em-branco" disabled={emBranco.length === 0} onClick={() => treinar(emBranco)} style={{ ...s.btnOutline, opacity: emBranco.length === 0 ? 0.5 : 1 }}>
          Treinar as {emBranco.length} em branco
        </button>
        {refazerProva && (
          <button data-testid="refazer-prova" onClick={refazerProva} style={s.btnOutline}>
            Refazer a prova inteira
          </button>
        )}
        <span style={{ fontSize: 12, color: theme ? '#6a665f' : undefined, alignSelf: 'center' }}>
          O treino abre as questões no quiz, com o gabarito ao responder.
        </span>
      </div>
    </Dialogo>
  );
}
