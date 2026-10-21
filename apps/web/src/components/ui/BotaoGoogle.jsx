import { useEffect, useRef } from 'react';
import { Button } from './button';

// "Entrar com o Google" desenhado pela própria tela, no mesmo estilo outline
// dos outros botões. O Google Identity Services entrega o ID token pelo
// callback; quem confere o token é o auth-service, nunca o navegador.
//
// O botão oficial do Google (`renderButton`) é um iframe com tipografia e
// cantos próprios. Para manter o desenho da tela, o fluxo é aberto pelo
// `prompt()` do GSI, a entrada programática documentada — ela mostra o
// seletor de contas do Google (One Tap/FedCM) em cima da página.
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const SCRIPT = 'https://accounts.google.com/gsi/client';

// Uma carga só por página, mesmo que o Login monte e desmonte várias vezes.
let carregando = null;
function carregarScript() {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (!carregando) {
    carregando = new Promise((resolver, rejeitar) => {
      const tag = document.createElement('script');
      tag.src = SCRIPT;
      tag.async = true;
      tag.defer = true;
      tag.onload = () => resolver();
      tag.onerror = () => {
        carregando = null; // deixa tentar de novo na próxima tentativa
        rejeitar(new Error('script do Google não carregou'));
      };
      document.head.appendChild(tag);
    });
  }
  return carregando;
}

// O "G" oficial, em quatro cores. Decorativo: o texto do botão já diz o que
// ele faz.
function IconeGoogle() {
  return (
    <svg viewBox="0 0 48 48" width="16" height="16" aria-hidden="true" focusable="false" style={{ display: 'block', flex: '0 0 auto' }}>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

export default function BotaoGoogle({ onCredencial, onIndisponivel }) {
  // O callback muda a cada render do Login; a ref faz o Google sempre chamar
  // o mais novo.
  const aoReceber = useRef(onCredencial);
  aoReceber.current = onCredencial;
  const semGoogle = useRef(onIndisponivel);
  semGoogle.current = onIndisponivel;
  const iniciado = useRef(false);

  const iniciar = () => {
    if (iniciado.current || !window.google?.accounts?.id) return;
    window.google.accounts.id.initialize({
      client_id: CLIENT_ID,
      callback: (resposta) => aoReceber.current(resposta.credential),
      // Sem o "One Tap" automático: o seletor abre no clique, como o resto
      // da tela.
      auto_select: false,
      cancel_on_tap_outside: true,
      use_fedcm_for_prompt: true,
      // Safari/ITP: sem isto o seletor pode não aparecer.
      itp_support: true,
    });
    iniciado.current = true;
  };

  // Deixa tudo pronto antes do clique, para o seletor abrir sem atraso.
  useEffect(() => {
    if (!CLIENT_ID) return undefined;
    let ativo = true;
    carregarScript().then(() => { if (ativo) iniciar(); }).catch(() => {});
    return () => { ativo = false; };
  }, []);

  const abrir = async () => {
    if (!CLIENT_ID) {
      semGoogle.current();
      return;
    }
    try {
      await carregarScript();
      iniciar();
      window.google.accounts.id.prompt();
    } catch {
      semGoogle.current();
    }
  };

  return (
    <Button
      type="button"
      data-testid="login-google"
      variant="outline"
      size="lg"
      onClick={abrir}
      className="w-full"
    >
      <IconeGoogle />
      Entrar com Google
    </Button>
  );
}
