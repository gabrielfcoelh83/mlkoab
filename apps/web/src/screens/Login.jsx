import { useRef, useState } from 'react';
// O ESLint deste projeto não tem o plugin de JSX: `motion` só aparece em
// `<motion.div>` e seria acusado de não usado.
// eslint-disable-next-line no-unused-vars
import { AnimatePresence, motion, useAnimate, useIsPresent } from 'motion/react';
import { Effect } from '@animate-ui/react/primitives/effects/effect';
import { SwappingText } from '@animate-ui/react/primitives/texts/swapping';
import {
  ReducedMotionConfig,
  ReducedMotionContext,
  blur,
  shift,
  transition as motionTransition,
  useShouldReduceMotion,
  useTempoTransition,
} from '@animate-ui/react/utils/motion';
import { Icon } from '../lib/icons';
import {
  login, criarConta, entrarComGoogle, solicitarRedefinicaoSenha, redefinirSenha,
} from '../lib/api/api';
import { Button } from '../components/ui/button';
import BotaoGoogle from '../components/ui/BotaoGoogle';

// Entrar e criar conta na mesma tela, alternados por um botão. Duas telas
// separadas custariam rota, estado de navegação e um caminho de volta — para
// dois formulários que diferem em dois campos.
//
// À esquerda, o hero com o texto do produto; "Conhecer a plataforma" abre a
// vitrine das telas logo abaixo e rola até ela. O formulário fica sempre à
// vista: quem já tem conta não precisa de um clique a mais para entrar.
//
// O movimento segue a linguagem "Papel e tinta": entrada curta, sem bounce,
// um desfoque leve para ligar o que entra ao que já estava na tela. Os valores
// vêm dos tokens do Animate UI (springs, curvas, blur e shifts), não de
// números soltos — e tudo respeita prefers-reduced-motion.

// Telas reais do app, capturadas com dados fictícios do ambiente de teste.
const VITRINE = [
  { chave: 'disciplinas', rotulo: 'Disciplinas', texto: 'O que cada matéria vale na prova e quanto você leva dela hoje.' },
  { chave: 'dashboard', rotulo: 'Dashboard', texto: 'Semana, acerto, tempo e sequência, com o próximo passo.' },
  { chave: 'cronograma', rotulo: 'Cronograma', texto: 'Uma semana possível, contada em dias de estudo cumpridos.' },
];

const FRASES = ['da 1ª à 2ª fase com dados', 'da 1ª à 2ª fase com organização'];

// Sem Client ID no build (ou com o auth-service sem ele) o Google não tem como
// entrar; o clique avisa em vez de não fazer nada.
const GOOGLE_INDISPONIVEL = 'O login com o Google ainda não está disponível. Use e-mail e senha.';

// O formulário é `noValidate`: o balão do navegador ("Preencha este campo.")
// fala outra língua visual e some sozinho. A régua é a mesma do auth-service
// (`emailValido` em app.js), para não mandar para lá o que ele já vai recusar.
const emailValido = (email) => email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);

// Vermelho do aviso de erro, na versão que se lê contra o branco do campo.
const BORDA_ERRO = '#B4413A';

// A frase troca letra a letra: "dados" e "organização" dividem o começo, e só
// o fim se mexe — cada letra nova sobe meio corpo desfocada enquanto a antiga
// sai, e a largura desliza junto. O componente do Animate UI pausa fora da
// tela e em aba oculta; sob movimento reduzido a frase fica parada, porque a
// troca automática de texto também incomoda (o componente trocaria de uma vez).
function FraseQueAlterna() {
  const reduzir = useShouldReduceMotion();

  if (reduzir) return <span>{FRASES[0]}</span>;

  return <SwappingText text={FRASES} duration={4200} />;
}

// O Orca browser (e qualquer navegador com "movimento reduzido" ligado no
// sistema) chega com `prefers-reduced-motion` ligado — e a tela, que respeita
// a preferência, não mostra movimento nenhum. Em dev, `?motion=full` ignora a
// preferência só para conferir o desenho; no build de produção o parâmetro nem
// é lido.
const MOVIMENTO_FORCADO =
  import.meta.env.DEV && new URLSearchParams(window.location.search).get('motion') === 'full';

function PreferenciaDeMovimento({ children }) {
  return (
    <ReducedMotionContext.Provider value={MOVIMENTO_FORCADO ? 'never' : 'user'}>
      <ReducedMotionConfig>{children}</ReducedMotionConfig>
    </ReducedMotionContext.Provider>
  );
}

// O título troca com um desfoque curto em vez de sumir e reaparecer seco. As
// duas versões dividem a mesma célula do grid e se cruzam: com `mode="wait"` o
// topo do card ficava vazio enquanto uma saía para a outra entrar.
function TituloDoModo({ modo, s }) {
  const troca = useTempoTransition(motionTransition.swap);
  const titulo = modo === 'criar'
    ? 'Criar conta'
    : modo === 'esqueci'
      ? 'Recuperar senha'
      : modo === 'redefinir'
        ? 'Criar nova senha'
        : 'Entrar';
  const sub = modo === 'esqueci'
    ? 'Informe seu e-mail e enviaremos um link seguro.'
    : modo === 'redefinir'
      ? 'Escolha uma nova senha para sua conta.'
      : null;

  return (
    <div style={{ display: 'grid' }}>
      <AnimatePresence initial={false}>
        <motion.div key={modo} style={{ gridArea: '1 / 1' }}
          initial={{ opacity: 0, filter: blur.icon }}
          animate={{ opacity: 1, filter: 'blur(0px)', transition: troca }}
          exit={{ opacity: 0, filter: blur.icon, transition: troca }}
        >
          <div style={{ ...s.pageTitle, fontSize: 26, marginBottom: 6 }}>{titulo}</div>
          {sub ? (
            <div style={{ ...s.pageSub, marginBottom: 18 }}>{sub}</div>
          ) : (
            <div style={{ marginBottom: 18 }} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// Um bloco que entra e sai empurrando o que está abaixo. A altura é a exceção
// prevista na skill: `transition.disclosure` move altura e opacidade juntas, e
// o conteúdo entra no mesmo compasso em vez de aparecer cortado pelo clip.
// `inert` impede que o que está saindo receba foco (A17).
function BlocoQueEntra({ children }) {
  const presente = useIsPresent();
  const revelar = useTempoTransition(motionTransition.disclosure);

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={revelar}
      style={{ overflow: 'clip', overflowClipMargin: 4 }}
    >
      <div inert={!presente} style={{ display: 'flow-root' }}>{children}</div>
    </motion.div>
  );
}

// Erro e aviso entram no mesmo lugar. O erro ainda balança 3px (shift.shake)
// uma vez por montagem — o suficiente para o olho achar a mensagem, sem virar
// um tremor a cada tecla.
function Aviso({ tipo, children }) {
  const fade = useTempoTransition(motionTransition.fade);
  const balanco = useTempoTransition(motionTransition.shake);
  const erro = tipo === 'erro';
  const s = shift.shake;

  return (
    <motion.div
      role={erro ? 'alert' : 'status'}
      initial={{ opacity: 0, y: 4, x: 0 }}
      animate={{
        opacity: 1,
        y: 0,
        x: erro ? [0, -s, s, -0.66 * s, 0.66 * s, -0.33 * s, 0.33 * s, 0] : 0,
      }}
      transition={{ opacity: fade, y: fade, x: balanco }}
      style={{
        background: erro ? '#FAF0EE' : '#EEF7F0',
        color: erro ? '#8F2F29' : '#24613A',
        border: `1px solid ${erro ? '#EBCBC6' : '#C7E2CD'}`,
        borderRadius: 10,
        padding: '9px 12px',
        fontSize: 12.5,
        marginBottom: 14,
      }}
    >
      {children}
    </motion.div>
  );
}

// O rótulo do botão muda (Entrar → Entrando…) sem trocar o botão: o foco fica
// onde está e só o texto passa pelo desfoque curto. As duas versões dividem a
// mesma célula do grid, então não há um quadro com o botão vazio no meio.
function RotuloDoBotao({ children }) {
  const troca = useTempoTransition(motionTransition.swap);

  return (
    <span style={{ display: 'inline-grid', alignItems: 'center', justifyItems: 'center' }}>
      <AnimatePresence initial={false}>
        <motion.span
          key={children}
          style={{ gridArea: '1 / 1' }}
          initial={{ opacity: 0, filter: blur.icon }}
          animate={{ opacity: 1, filter: 'blur(0px)', transition: troca }}
          exit={{ opacity: 0, filter: blur.icon, transition: troca }}
        >
          {children}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

// O MotionConfig precisa ficar acima dos hooks da tela: `useShouldReduceMotion`
// e o `useAnimate` leem o contexto de onde o componente é renderizado, e um
// provider dentro do próprio JSX não alcança os hooks de fora dele.
export default function Login(props) {
  return (
    <PreferenciaDeMovimento>
      <TelaDeLogin {...props} />
    </PreferenciaDeMovimento>
  );
}

function TelaDeLogin({ theme, s, onEntrar }) {
  const parametros = new URLSearchParams(window.location.search);
  const tokenRedefinicao = parametros.get('token') || '';
  const caminhoRedefinicao = window.location.pathname === '/reset-password';
  const [modo, setModo] = useState(caminhoRedefinicao ? 'redefinir' : 'entrar'); // entrar | criar | esqueci | redefinir
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [mensagem, setMensagem] = useState(null);
  const [erro, setErro] = useState(null);
  // Qual campo o erro está apontando (`campo-email`, `campo-senha`…). Enquanto
  // for ele, o campo fica aceso em vermelho e é para lá que o foco vai.
  const [campoComErro, setCampoComErro] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [vitrineAberta, setVitrineAberta] = useState(false);
  const [telaDaVitrine, setTelaDaVitrine] = useState(VITRINE[0].chave);
  const vitrineRef = useRef(null);
  const emailRef = useRef(null);
  const senhaRef = useRef(null);
  const confirmacaoRef = useRef(null);
  const reduzir = useShouldReduceMotion();
  const revelar = useTempoTransition(motionTransition.reveal);
  const balanco = useTempoTransition(motionTransition.shake);
  const tremor = shift.shake;
  const [escopoDoForm, animar] = useAnimate();

  const conhecer = () => {
    setVitrineAberta(true);
    // Depois do render que monta a seção: sem o quadro seguinte, o scroll
    // mirava um elemento que ainda não existia.
    window.requestAnimationFrame(() => vitrineRef.current?.scrollIntoView({
      behavior: reduzir ? 'auto' : 'smooth',
      block: 'start',
    }));
  };

  const criando = modo === 'criar';
  const esquecendo = modo === 'esqueci';
  const redefinindo = modo === 'redefinir';


  // A vez de cada problema, na ordem em que os campos aparecem na tela: o
  // primeiro é o que ganha o aviso e o foco — o que o balão do navegador fazia,
  // agora no desenho da casa.
  const primeiroProblema = () => {
    if (!redefinindo) {
      if (!email.trim()) return ['Preencha o e-mail.', 'campo-email', emailRef];
      if (!emailValido(email.trim())) return ['Confira o e-mail digitado.', 'campo-email', emailRef];
    }
    if (!esquecendo) {
      if (!senha) return ['Preencha a senha.', 'campo-senha', senhaRef];
      if ((criando || redefinindo) && senha.length < 8) {
        return ['A senha precisa de pelo menos 8 caracteres.', 'campo-senha', senhaRef];
      }
      // Comparação antes de sair do navegador: o servidor não recebe a
      // confirmação e não teria como recusar por isso.
      if ((criando || redefinindo) && senha !== confirmacao) {
        return ['As senhas não são iguais.', 'campo-confirmacao', confirmacaoRef];
      }
    }
    return null;
  };

  // Mensagem no Aviso + campo aceso e focado. O tremor é o mesmo gesto do
  // Aviso (`shift.shake`), disparado na mão: o `animate` do Motion ignora
  // quadros-chave que terminam no valor atual, e o campo parado já está em
  // x: 0 — programático, ele toca todas as vezes que o problema volta.
  const apontar = ([texto, id, ref]) => {
    setErro(texto);
    setCampoComErro(id);
    ref.current?.focus();
    // `useShouldReduceMotion` porque o `animate` imperativo não passa pelo
    // corte de transform do MotionConfig; sob redução sobra o vermelho e o
    // foco.
    if (!reduzir) {
      animar(
        `#${id}`,
        { x: [0, -tremor, tremor, -0.66 * tremor, 0.66 * tremor, -0.33 * tremor, 0.33 * tremor, 0] },
        balanco
      );
    }
  };

  const submeter = async (e) => {
    e.preventDefault();
    if (enviando) return;

    const problema = primeiroProblema();
    if (problema) {
      apontar(problema);
      return;
    }

    setErro(null);
    setCampoComErro(null);
    setEnviando(true);
    try {
      if (esquecendo) {
        await solicitarRedefinicaoSenha(email.trim());
        setMensagem('Se existir uma conta com esse e-mail, enviaremos as instruções para redefinir a senha.');
        setEnviando(false);
        return;
      }
      if (redefinindo) {
        await redefinirSenha(tokenRedefinicao, senha);
        window.history.replaceState({}, '', '/');
        setModo('entrar');
        setSenha('');
        setConfirmacao('');
        setMensagem('Senha redefinida. Você já pode entrar com a nova senha.');
        setEnviando(false);
        return;
      }
      const usuario = criando
        ? await criarConta({ nome: nome.trim(), email: email.trim(), password: senha })
        : await login(email.trim(), senha);
      if (criando && usuario.confirmacaoPendente) {
        setMensagem('Conta criada. Confirme o link enviado ao seu e-mail antes de entrar.');
        setModo('entrar');
        setEnviando(false);
        return;
      }
      onEntrar(usuario);
    } catch (err) {
      // 409 é o único erro aqui com um próximo passo óbvio, então ele ganha
      // uma mensagem que aponta o caminho em vez de só constatar o problema.
      setErro(
        err.status === 409
          ? 'Este e-mail já tem conta. Use "Entrar" logo abaixo.'
          : err.message
      );
      setEnviando(false);
    }
  };

  // O Google já escolheu a conta; falta o auth-service conferir o token.
  // Mesmo tratamento de erro do formulário, para a mensagem aparecer no mesmo
  // lugar.
  const entrarGoogle = async (credential) => {
    if (enviando) return;
    setErro(null);
    setEnviando(true);
    try {
      onEntrar(await entrarComGoogle(credential));
    } catch (err) {
      setErro(err.status === 503 ? GOOGLE_INDISPONIVEL : err.message);
      setEnviando(false);
    }
  };

  // O campo do erro muda de borda e de cor de foco; o resto do desenho é o
  // mesmo em todos.
  const estiloDoCampo = (id, margem) => {
    const aceso = campoComErro === id;
    return {
      width: '100%',
      boxSizing: 'border-box',
      border: `1px solid ${aceso ? BORDA_ERRO : 'rgba(0,0,0,.1)'}`,
      borderRadius: 10,
      padding: '11px 13px',
      fontSize: 13.5,
      color: '#1c1b19',
      background: '#fff',
      outlineColor: aceso ? BORDA_ERRO : theme.primary,
      marginBottom: margem,
    };
  };

  // O vermelho sai na primeira tecla: o campo respondendo já é o recado de que
  // o problema está sendo resolvido.
  const aoDigitar = (id, definir) => (e) => {
    definir(e.target.value);
    if (campoComErro !== id) return;
    setCampoComErro(null);
    setErro(null);
  };

  const rotulo = { ...s.statLabel, display: 'block', marginBottom: 5 };

  const textoBotao = enviando
    ? esquecendo
      ? 'Enviando…'
      : redefinindo
        ? 'Salvando…'
        : criando
          ? 'Criando…'
          : 'Entrando…'
    : esquecendo
      ? 'Enviar link'
      : redefinindo
        ? 'Salvar nova senha'
        : criando
          ? 'Criar conta'
          : 'Entrar';

  return (
    <div style={{ height: '100vh', width: '100%', overflowY: 'auto', background: theme.bg }}>
    <div style={{ display: 'flex', minHeight: '100vh', width: '100%' }}>
      {/* O hero: o texto do produto, como o dono escreveu. Some em tela
          estreita (classe do Tailwind, porque estilo inline não tem media
          query), onde o formulário sozinho já ocupa a tela; lá o resumo vai
          acima do formulário. */}
      <section
        className="hidden lg:flex login-hero"
        style={{ flex: '0 0 54%', flexDirection: 'column', justifyContent: 'center', padding: '48px 64px', position: 'relative' }}
      >
        <Effect asChild fade slide={{ offset: 8 }} delay={0}>
          <div style={{ position: 'absolute', top: 32, left: 64, display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={s.logoMark}><Icon name="scale" color="#ffffff" size={16} /></div>
            <span style={s.logoText}>mlkoab</span>
          </div>
        </Effect>
        <Effect asChild fade slide={{ offset: 8 }} blur={{ initialBlur: 2 }} delay={60}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start', fontSize: 12.5, fontWeight: 600, color: '#355E35', background: '#E8F0E6', borderRadius: 999, padding: '4px 11px' }}>
            <Icon name="check" color="#355E35" size={13} /> Estudo organizado para a OAB
          </span>
        </Effect>
        <Effect asChild fade slide={{ offset: 12 }} blur={{ initialBlur: 2 }} delay={140}>
          <h1 style={{ margin: '18px 0 0', fontFamily: s.pageTitle.fontFamily, fontWeight: 500, fontSize: 52, lineHeight: 1.08, letterSpacing: '-0.02em', color: '#1c1b19', maxWidth: '18ch', textWrap: 'balance' }}>
            Tudo o que você precisa para ser aprovado na OAB
            <span style={{ display: 'block', marginTop: '0.25em', fontSize: '0.56em', lineHeight: 1.3, color: theme.primary, letterSpacing: '-0.01em' }}>
              <span className="so-leitor">da 1ª à 2ª fase com dados e organização</span>
              <span aria-hidden="true" style={{ display: 'inline-block' }}>
                <FraseQueAlterna />
              </span>
            </span>
          </h1>
        </Effect>
        <Effect asChild fade slide={{ offset: 8 }} blur={{ initialBlur: 2 }} delay={220}>
          <p style={{ margin: '18px 0 0', fontSize: 15, lineHeight: 1.6, color: '#4f4b45', maxWidth: '54ch' }}>
            Pratique com questões oficiais da 1ª e 2ª fase e simulados completos. Acompanhe sua evolução através de métricas detalhadas em uma estrutura organizada para potencializar seu aprendizado.
          </p>
        </Effect>
        <Effect asChild fade slide={{ offset: 8 }} delay={300}>
          <div style={{ display: 'flex', gap: 10, marginTop: 26, flexWrap: 'wrap' }}>
            <Button type="button" data-testid="conhecer-plataforma" variant="outline" size="lg" onClick={conhecer}>
              Conhecer a plataforma
            </Button>
            <Button type="button" size="lg" onClick={() => emailRef.current?.focus()}>
              Fazer login <Icon name="chevron-right" color="#fff" size={14} />
            </Button>
          </div>
        </Effect>
      </section>

      {/* minWidth 0: item flex não encolhe abaixo do conteúdo por padrão, e o
          form de 360px + 48px de padding davam 408px — rolagem horizontal em
          qualquer celular com menos de 408px de largura. */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <Effect asChild fade slide={{ offset: 16 }} blur={{ initialBlur: 4 }} delay={180}>
      <form ref={escopoDoForm} onSubmit={submeter} noValidate style={{ ...s.card, padding: 28, width: 400, maxWidth: '100%' }}>
        <div className="flex lg:hidden" style={{ alignItems: 'center', gap: 9, marginBottom: 20 }}>
          <div style={s.logoMark}>
            <Icon name="scale" color="#ffffff" size={17} />
          </div>
          <div>
            <div style={s.logoText}>mlkoab</div>
            <div style={s.logoSub}>versão beta</div>
          </div>
        </div>

        <TituloDoModo modo={modo} s={s} />

        <AnimatePresence initial={false}>
          {criando && (
            <BlocoQueEntra key="nome">
              <label style={rotulo} htmlFor="campo-nome">
                Nome
              </label>
              <input
                id="campo-nome"
                data-testid="campo-nome"
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                autoComplete="name"
                placeholder="Como quer ser chamado(a)"
                style={estiloDoCampo('campo-nome', 13)}
              />
            </BlocoQueEntra>
          )}
        </AnimatePresence>

        {/* Cada campo condicional anima a própria altura: sem isso, ao
            trocar de modo o bloco de baixo pulava alguns pixels para cima
            antes de crescer com os campos novos. */}
        <AnimatePresence initial={false}>
          {!redefinindo && (
            <BlocoQueEntra key="email">
              <label style={rotulo} htmlFor="campo-email">
                E-mail
              </label>
              <input
                id="campo-email"
                ref={emailRef}
                type="email"
                value={email}
                onChange={aoDigitar('campo-email', setEmail)}
                autoComplete="email"
                required
                aria-invalid={campoComErro === 'campo-email'}
                style={estiloDoCampo('campo-email', 13)}
              />
            </BlocoQueEntra>
          )}
        </AnimatePresence>

        <AnimatePresence initial={false}>
          {!esquecendo && (
            <BlocoQueEntra key="senha">
              <label style={rotulo} htmlFor="campo-senha">
                Senha
              </label>
              <input
                id="campo-senha"
                ref={senhaRef}
                type="password"
                value={senha}
                onChange={aoDigitar('campo-senha', setSenha)}
                // O gerenciador de senhas do navegador se comporta de formas
                // diferentes nos dois casos: oferecer a senha salva ao entrar,
                // propor uma nova ao cadastrar.
                autoComplete={criando || redefinindo ? 'new-password' : 'current-password'}
                required
                minLength={criando || redefinindo ? 8 : undefined}
                aria-invalid={campoComErro === 'campo-senha'}
                style={estiloDoCampo('campo-senha', criando || redefinindo ? 13 : 18)}
              />
            </BlocoQueEntra>
          )}
        </AnimatePresence>

        <AnimatePresence initial={false}>
          {(criando || redefinindo) && (
            <BlocoQueEntra key="confirmacao">
              <label style={rotulo} htmlFor="campo-confirmacao">
                Repita a senha
              </label>
              <input
                id="campo-confirmacao"
                ref={confirmacaoRef}
                data-testid="campo-confirmacao"
                type="password"
                value={confirmacao}
                onChange={aoDigitar('campo-confirmacao', setConfirmacao)}
                autoComplete="new-password"
                required
                aria-invalid={campoComErro === 'campo-confirmacao'}
                style={estiloDoCampo('campo-confirmacao', 18)}
              />
            </BlocoQueEntra>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait" initial={false}>
          {erro && (
            <BlocoQueEntra key={erro}>
              <Aviso tipo="erro">{erro}</Aviso>
            </BlocoQueEntra>
          )}
        </AnimatePresence>
        <AnimatePresence mode="wait" initial={false}>
          {mensagem && (
            <BlocoQueEntra key={mensagem}>
              <Aviso tipo="aviso">{mensagem}</Aviso>
            </BlocoQueEntra>
          )}
        </AnimatePresence>

        <Button
          type="submit"
          size="lg"
          disabled={enviando}
          className="w-full disabled:opacity-70"
        >
          <RotuloDoBotao>{textoBotao}</RotuloDoBotao>
        </Button>

        {/* Serve para entrar e para criar conta: na primeira vez, o
            auth-service cria a conta com o nome e o e-mail do Google. O
            botão fica sempre à vista; sem Client ID, o clique explica que
            o login com o Google ainda não está disponível. */}
        <AnimatePresence initial={false}>
          {!esquecendo && !redefinindo && (
            <BlocoQueEntra key="google">
              <div style={{ marginTop: 14 }}>
                <div style={{ ...s.pageSub, textAlign: 'center', fontSize: 12, marginBottom: 10 }}>ou</div>
                <BotaoGoogle
                  onCredencial={entrarGoogle}
                  onIndisponivel={() => setErro(GOOGLE_INDISPONIVEL)}
                />
              </div>
            </BlocoQueEntra>
          )}
        </AnimatePresence>

        {!redefinindo && <div style={{ ...s.pageSub, textAlign: 'center', marginTop: 16, fontSize: 12.5 }}>
          {criando ? 'Já tem conta?' : esquecendo ? 'Lembrou a senha?' : 'Primeira vez por aqui?'}{' '}
          {/* type="button" é obrigatório: dentro de um <form>, um botão sem
              type é submit, e alternar o modo enviaria o formulário. */}
          <Button
            type="button"
            variant="link"
            data-testid="trocar-modo"
            onClick={() => { setModo(esquecendo ? 'entrar' : criando ? 'entrar' : 'criar'); setErro(null); setCampoComErro(null); setMensagem(null); }}
            className="h-auto p-0 align-baseline text-[12.5px] font-semibold"
          >
            {criando || esquecendo ? 'Entrar' : 'Criar conta'}
          </Button>
        </div>}
        <AnimatePresence initial={false}>
          {!criando && !esquecendo && !redefinindo && (
            <BlocoQueEntra key="esqueci">
              <Button
                type="button"
                variant="link"
                onClick={() => { setModo('esqueci'); setErro(null); setCampoComErro(null); setMensagem(null); }}
                className="mx-auto mt-3.5 flex h-auto p-0 text-[12.5px] font-normal"
              >
                Esqueci minha senha
              </Button>
            </BlocoQueEntra>
          )}
        </AnimatePresence>
        {/* Links públicos: o Google exige que a página inicial do app leve à
            política de privacidade, e quem chega aqui pela primeira vez quer
            saber o que é o app antes de criar conta. */}
        <nav aria-label="Sobre o mlkoab" style={{ display: 'flex', justifyContent: 'center', gap: 14, marginTop: 22, fontSize: 11.5 }}>
          <a href="/sobre.html" style={{ color: '#6b6472' }}>Sobre</a>
          <a href="/privacidade.html" style={{ color: '#6b6472' }}>Privacidade</a>
          <a href="/termos.html" style={{ color: '#6b6472' }}>Termos</a>
        </nav>
      </form>
      </Effect>
      </div>
    </div>

    {vitrineAberta && (
      <Effect asChild fade slide={{ offset: 16 }} blur={{ initialBlur: 4 }}>
        <section ref={vitrineRef} data-testid="vitrine" className="vitrine" style={{ padding: '48px 24px 64px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, scrollMarginTop: 16 }}>
          <h2 style={{ ...s.pageTitle, fontSize: 30, textAlign: 'center' }}>Por dentro da plataforma</h2>
          <div role="tablist" aria-label="Telas" style={{ display: 'inline-flex', background: '#ece9e3', borderRadius: 8, padding: 3 }}>
            {VITRINE.map((t) => (
              <Button
                key={t.chave}
                role="tab"
                aria-selected={telaDaVitrine === t.chave}
                variant="ghost"
                size="sm"
                onClick={() => setTelaDaVitrine(t.chave)}
                className="h-[30px] rounded-[6px] px-3.5 text-[13px] font-semibold text-[#4f4b45] aria-selected:bg-card aria-selected:text-foreground"
              >
                {t.rotulo}
              </Button>
            ))}
          </div>
          <p style={{ ...s.pageSub, margin: 0, textAlign: 'center' }}>{VITRINE.find((t) => t.chave === telaDaVitrine)?.texto}</p>
          <div className="vitrine-quadro" style={{ position: 'relative', width: 'min(1040px, 100%)', aspectRatio: '1920 / 1200', borderRadius: 16, overflow: 'hidden', boxShadow: '0 0 0 1px rgba(28,27,25,.08), 0 24px 48px -16px rgba(28,27,25,.22)', background: '#fff' }}>
            <AnimatePresence initial={false} mode="sync">
              <motion.img
                key={telaDaVitrine}
                src={`/vitrine/${telaDaVitrine}.jpg`}
                alt={`Tela ${VITRINE.find((t) => t.chave === telaDaVitrine)?.rotulo} do mlkoab, com dados de exemplo`}
                width={1920}
                height={1200}
                initial={{ opacity: 0, filter: blur.icon }}
                animate={{ opacity: 1, filter: 'blur(0px)', transition: revelar }}
                exit={{ opacity: 0, filter: blur.icon, transition: revelar }}
                style={{ position: 'absolute', inset: 0, display: 'block', width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </AnimatePresence>
          </div>
          <span style={{ fontSize: 12, color: '#6a665f' }}>Telas com dados de exemplo.</span>
        </section>
      </Effect>
    )}
    </div>
  );
}
