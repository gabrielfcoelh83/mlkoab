import { useRef, useState } from 'react';
import { Icon } from '../lib/icons';
import {
  login, criarConta, entrarComGoogle, solicitarRedefinicaoSenha, redefinirSenha,
} from '../lib/api/api';
import BotaoGoogle from '../components/ui/BotaoGoogle';

// Entrar e criar conta na mesma tela, alternados por um botão. Duas telas
// separadas custariam rota, estado de navegação e um caminho de volta — para
// dois formulários que diferem em dois campos.
//
// À esquerda, o hero com o texto do produto; "Conhecer a plataforma" abre a
// vitrine das telas logo abaixo e rola até ela. O formulário fica sempre à
// vista: quem já tem conta não precisa de um clique a mais para entrar.

// Telas reais do app, capturadas com dados fictícios do ambiente de teste.
const VITRINE = [
  { chave: 'disciplinas', rotulo: 'Disciplinas', texto: 'O que cada matéria vale na prova e quanto você leva dela hoje.' },
  { chave: 'dashboard', rotulo: 'Dashboard', texto: 'Semana, acerto, tempo e sequência, com o próximo passo.' },
  { chave: 'cronograma', rotulo: 'Cronograma', texto: 'Uma semana possível, contada em dias de estudo cumpridos.' },
];

export default function Login({ theme, s, onEntrar }) {
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
  const [enviando, setEnviando] = useState(false);
  const [vitrineAberta, setVitrineAberta] = useState(false);
  const [telaDaVitrine, setTelaDaVitrine] = useState(VITRINE[0].chave);
  const vitrineRef = useRef(null);
  const emailRef = useRef(null);

  const conhecer = () => {
    setVitrineAberta(true);
    // Depois do render que monta a seção: sem o quadro seguinte, o scroll
    // mirava um elemento que ainda não existia.
    window.requestAnimationFrame(() => vitrineRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  const criando = modo === 'criar';
  const esquecendo = modo === 'esqueci';
  const redefinindo = modo === 'redefinir';


  const submeter = async (e) => {
    e.preventDefault();
    if (enviando) return;

    // Comparação antes de sair do navegador: o servidor não recebe a
    // confirmação e não teria como recusar por isso.
    if ((criando || redefinindo) && senha !== confirmacao) {
      setErro('As senhas não são iguais.');
      return;
    }

    setErro(null);
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
      setErro(
        err.status === 503
          ? 'O login com o Google ainda não está disponível. Use e-mail e senha.'
          : err.message
      );
      setEnviando(false);
    }
  };

  const campo = {
    width: '100%',
    boxSizing: 'border-box',
    border: '1px solid rgba(0,0,0,.1)',
    borderRadius: 10,
    padding: '11px 13px',
    fontSize: 13.5,
    color: '#1c1b19',
    background: '#fff',
    outlineColor: theme.primary,
  };

  const rotulo = { ...s.statLabel, display: 'block', marginBottom: 5 };

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
        <div style={{ position: 'absolute', top: 32, left: 64, display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={s.logoMark}><Icon name="scale" color="#ffffff" size={16} /></div>
          <span style={s.logoText}>mlkoab</span>
        </div>
        <span className="entra" style={{ '--i': 0, display: 'inline-flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start', fontSize: 12.5, fontWeight: 600, color: '#355E35', background: '#E8F0E6', borderRadius: 999, padding: '4px 11px' }}>
          <Icon name="check" color="#355E35" size={13} /> Estudo organizado para a OAB
        </span>
        <h1 className="entra" style={{ '--i': 1, margin: '18px 0 0', fontFamily: s.pageTitle.fontFamily, fontWeight: 500, fontSize: 52, lineHeight: 1.08, letterSpacing: '-0.02em', color: '#1c1b19', maxWidth: '18ch', textWrap: 'balance' }}>
          Tudo o que você precisa para ser aprovado na OAB
          <span style={{ display: 'block', marginTop: '0.25em', fontSize: '0.56em', lineHeight: 1.3, color: theme.primary, letterSpacing: '-0.01em' }}>
            <span className="so-leitor">da 1ª à 2ª fase com dados e organização</span>
            <span className="alterna" aria-hidden="true">
              <span>da 1ª à 2ª fase com dados</span>
              <span>da 1ª à 2ª fase com organização</span>
            </span>
          </span>
        </h1>
        <p className="entra" style={{ '--i': 2, margin: '18px 0 0', fontSize: 15, lineHeight: 1.6, color: '#4f4b45', maxWidth: '54ch' }}>
          Pratique com questões oficiais da 1ª e 2ª fase e simulados completos. Acompanhe sua evolução através de métricas detalhadas em uma estrutura organizada para potencializar seu aprendizado.
        </p>
        <div className="entra" style={{ '--i': 3, display: 'flex', gap: 10, marginTop: 26, flexWrap: 'wrap' }}>
          <button type="button" data-testid="conhecer-plataforma" onClick={conhecer} style={{ ...s.btnOutline, padding: '11px 18px', fontSize: 13.5 }}>
            Conhecer a plataforma
          </button>
          <button type="button" onClick={() => emailRef.current?.focus()} style={{ ...s.btnPrimary, padding: '11px 18px', fontSize: 13.5 }}>
            Fazer login <Icon name="chevron-right" color="#fff" size={14} />
          </button>
        </div>
      </section>

      {/* minWidth 0: item flex não encolhe abaixo do conteúdo por padrão, e o
          form de 360px + 48px de padding davam 408px — rolagem horizontal em
          qualquer celular com menos de 408px de largura. */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <form onSubmit={submeter} style={{ ...s.card, padding: 28, width: 400, maxWidth: '100%' }}>
        <div className="flex lg:hidden" style={{ alignItems: 'center', gap: 9, marginBottom: 20 }}>
          <div style={s.logoMark}>
            <Icon name="scale" color="#ffffff" size={17} />
          </div>
          <div>
            <div style={s.logoText}>mlkoab</div>
            <div style={s.logoSub}>versão beta</div>
          </div>
        </div>

        <div style={{ ...s.pageTitle, fontSize: 26, marginBottom: 6 }}>
          {criando ? 'Criar conta' : esquecendo ? 'Recuperar senha' : redefinindo ? 'Criar nova senha' : 'Entrar'}
        </div>
        {(esquecendo || redefinindo) ? (
          <div style={{ ...s.pageSub, marginBottom: 18 }}>
            {esquecendo ? 'Informe seu e-mail e enviaremos um link seguro.' : 'Escolha uma nova senha para sua conta.'}
          </div>
        ) : (
          <div style={{ marginBottom: 18 }} />
        )}

        {criando && (
          <>
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
              style={{ ...campo, marginBottom: 13 }}
            />
          </>
        )}

        {!redefinindo && <label style={rotulo} htmlFor="campo-email">
          E-mail
        </label>}
        {!redefinindo && <input
          id="campo-email"
          ref={emailRef}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
          style={{ ...campo, marginBottom: 13 }}
        />}

        {!esquecendo && <label style={rotulo} htmlFor="campo-senha">
          Senha
        </label>}
        {!esquecendo && <input
          id="campo-senha"
          type="password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          // O gerenciador de senhas do navegador se comporta de formas
          // diferentes nos dois casos: oferecer a senha salva ao entrar,
          // propor uma nova ao cadastrar.
          autoComplete={criando || redefinindo ? 'new-password' : 'current-password'}
          required
          minLength={criando || redefinindo ? 8 : undefined}
          style={{ ...campo, marginBottom: criando || redefinindo ? 13 : 18 }}
        />}

        {(criando || redefinindo) && (
          <>
            <label style={rotulo} htmlFor="campo-confirmacao">
              Repita a senha
            </label>
            <input
              id="campo-confirmacao"
              data-testid="campo-confirmacao"
              type="password"
              value={confirmacao}
              onChange={(e) => setConfirmacao(e.target.value)}
              autoComplete="new-password"
              required
              style={{ ...campo, marginBottom: 18 }}
            />
          </>
        )}

        {erro && (
          <div
            role="alert"
            style={{
              background: '#FAF0EE',
              color: '#8F2F29',
              border: '1px solid #EBCBC6',
              borderRadius: 10,
              padding: '9px 12px',
              fontSize: 12.5,
              marginBottom: 14,
            }}
          >
            {erro}
          </div>
        )}
        {mensagem && (
          <div role="status" style={{ background: '#EEF7F0', color: '#24613A', border: '1px solid #C7E2CD', borderRadius: 10, padding: '9px 12px', fontSize: 12.5, marginBottom: 14 }}>
            {mensagem}
          </div>
        )}

        <button
          type="submit"
          disabled={enviando}
          style={{
            ...s.btnPrimary,
            width: '100%',
            justifyContent: 'center',
            padding: '11px 18px',
            fontSize: 13.5,
            opacity: enviando ? 0.7 : 1,
          }}
        >
          {enviando
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
                  : 'Entrar'}
        </button>

        {/* Serve para entrar e para criar conta: na primeira vez, o
            auth-service cria a conta com o nome e o e-mail do Google. */}
        {!esquecendo && !redefinindo && import.meta.env.VITE_GOOGLE_CLIENT_ID && (
          <div style={{ marginTop: 14 }}>
            <div style={{ ...s.pageSub, textAlign: 'center', fontSize: 12, marginBottom: 10 }}>ou</div>
            <BotaoGoogle onCredencial={entrarGoogle} />
          </div>
        )}

        {!redefinindo && <div style={{ ...s.pageSub, textAlign: 'center', marginTop: 16, fontSize: 12.5 }}>
          {criando ? 'Já tem conta?' : esquecendo ? 'Lembrou a senha?' : 'Primeira vez por aqui?'}{' '}
          {/* type="button" é obrigatório: dentro de um <form>, um botão sem
              type é submit, e alternar o modo enviaria o formulário. */}
          <button
            type="button"
            data-testid="trocar-modo"
            onClick={() => { setModo(esquecendo ? 'entrar' : criando ? 'entrar' : 'criar'); setErro(null); setMensagem(null); }}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              font: 'inherit',
              color: theme.primary,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {criando || esquecendo ? 'Entrar' : esquecendo ? 'Entrar' : 'Criar conta'}
          </button>
        </div>}
        {!criando && !esquecendo && !redefinindo && (
          <button type="button" onClick={() => { setModo('esqueci'); setErro(null); setMensagem(null); }} style={{ display: 'block', margin: '14px auto 0', background: 'none', border: 'none', padding: 0, font: 'inherit', color: theme.primary, fontSize: 12.5, cursor: 'pointer' }}>
            Esqueci minha senha
          </button>
        )}
        {/* Links públicos: o Google exige que a página inicial do app leve à
            política de privacidade, e quem chega aqui pela primeira vez quer
            saber o que é o app antes de criar conta. */}
        <nav aria-label="Sobre o mlkoab" style={{ display: 'flex', justifyContent: 'center', gap: 14, marginTop: 22, fontSize: 11.5 }}>
          <a href="/sobre.html" style={{ color: '#6b6472' }}>Sobre</a>
          <a href="/privacidade.html" style={{ color: '#6b6472' }}>Privacidade</a>
          <a href="/termos.html" style={{ color: '#6b6472' }}>Termos</a>
        </nav>
      </form>
      </div>
    </div>

    {vitrineAberta && (
      <section ref={vitrineRef} data-testid="vitrine" className="vitrine" style={{ padding: '48px 24px 64px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, scrollMarginTop: 16 }}>
        <h2 style={{ ...s.pageTitle, fontSize: 30, textAlign: 'center' }}>Por dentro da plataforma</h2>
        <div role="tablist" aria-label="Telas" style={{ display: 'inline-flex', background: '#ece9e3', borderRadius: 8, padding: 3 }}>
          {VITRINE.map((t) => (
            <button
              key={t.chave}
              role="tab"
              aria-selected={telaDaVitrine === t.chave}
              onClick={() => setTelaDaVitrine(t.chave)}
              style={{ border: 'none', borderRadius: 6, padding: '7px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', background: telaDaVitrine === t.chave ? '#fff' : 'transparent', color: telaDaVitrine === t.chave ? '#1c1b19' : '#4f4b45' }}
            >
              {t.rotulo}
            </button>
          ))}
        </div>
        <p style={{ ...s.pageSub, margin: 0, textAlign: 'center' }}>{VITRINE.find((t) => t.chave === telaDaVitrine)?.texto}</p>
        <div className="vitrine-quadro" style={{ width: 'min(1040px, 100%)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 0 0 1px rgba(28,27,25,.08), 0 24px 48px -16px rgba(28,27,25,.22)', background: '#fff' }}>
          <img
            key={telaDaVitrine}
            src={`/vitrine/${telaDaVitrine}.jpg`}
            alt={`Tela ${VITRINE.find((t) => t.chave === telaDaVitrine)?.rotulo} do mlkoab, com dados de exemplo`}
            width={1920}
            height={1200}
            style={{ display: 'block', width: '100%', height: 'auto' }}
          />
        </div>
        <span style={{ fontSize: 12, color: '#6a665f' }}>Telas com dados de exemplo.</span>
      </section>
    )}
    </div>
  );
}
