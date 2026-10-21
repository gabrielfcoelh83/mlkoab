import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import NaoEncontrada from './screens/NaoEncontrada';

// A entrada da página 404 — o `main.jsx` dela.
//
// O 404 tem HTML e bundle próprios (`404.html`, listado no `build` do
// vite.config.js) porque quem serve esta página é o host, no lugar de um
// endereço que não existe, e aí o status da resposta continua sendo 404 de
// verdade. Dentro do SPA isso não existe: qualquer rota responde 200 com o app
// montado.
//
// O CSS é o mesmo `index.css` do app — os tokens, a fonte e o `Button` são os
// mesmos; o que não vem junto é o App inteiro.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <NaoEncontrada />
  </StrictMode>,
);
