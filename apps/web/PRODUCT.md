# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Candidato ao Exame de Ordem da OAB que estuda por conta própria: bacharel em Direito que se prepara para a 1ª e a 2ª fase e volta ao app em sessões curtas e frequentes. O trabalho dele é transformar tempo de estudo limitado em acerto na prova.

## Product Purpose

Plataforma de estudos para a OAB, em versão beta. Reúne questões oficiais e simulados dos Exames de Ordem (FGV), revisão dos erros, plano semanal de estudo e a 2ª fase de Direito Civil. Sucesso é a pessoa saber o que estudar hoje, errar menos o que já errou e chegar à prova com metas cumpridas.

## Positioning

Quatro coisas que o produto faz de verdade e que a concorrência não copia só com uma tela:
- O acervo tem somente questões reais da OAB/FGV. A IA explica questões do acervo e não inventa nenhuma.
- O caderno de erros transforma cada erro em revisão, com justificativa anotada pela pessoa e segunda chance, em vez de só estatística.
- O cronograma é "possível": semana com folga e ritmo realista, com envio opcional ao Google Agenda.
- A 2ª fase de Direito Civil confere os fundamentos da resposta contra o padrão da FGV.

## Operating Context

Uso diário, em sessões curtas, num navegador de computador. O fluxo central é responder questões, corrigir com o gabarito comentado, revisar o que errou e acompanhar meta diária, sequência e desempenho por disciplina, com a data da prova à vista.

## Capabilities and Constraints

- Telas da 1ª fase: Dashboard, Cronograma, Questões (cadernos por matéria), Simulados (provas anteriores, Simulado Geral e apostila), Revisões, Desempenho, Estatísticas, Marcadores, Disciplinas, Anotações e Configurações. A 2ª fase tem layout próprio.
- Simulado simula a prova inteira; não existe simulado por matéria. O acervo guarda exame e ano por questão, mas não o semestre nem a data de aplicação.
- Os dados de conta vêm da plataforma de microserviços em `apps/api`, neste mesmo monorepo. Tentativas, marcadores e simulados (com a apostila de cada um) ficam no servidor; anotações, grifos e o histórico de simulados antigos ainda ficam só no navegador.
- O front é publicado na Vercel. O app usa só estilo próprio ("Papel e tinta", ver DESIGN.md).
- Marcadores de questão com motivo (chutei, não sabia, quero refazer, dúvida) substituem a estrela de favorito.
- A 1ª fase não tem layout de celular. Se isso muda, é decisão a registrar aqui.

## Brand Commitments

- Nome que a pessoa vê: **mlkoab**. A marca curta `ma.` é o logotipo.
- Voz direta, em segunda pessoa, sem exclamação de comemoração.
- A pessoa escolhe entre sete paletas sóbrias; a identidade "Papel e tinta" é compromisso do produto.

## Evidence on Hand

- Acervo real de questões OAB/FGV, carregado pelo gateway.
- Não há depoimentos, números de clientes, preços nem comparações de concorrentes. Nada disso deve ser inventado em tela ou texto.

## Product Principles

1. Só conteúdo oficial: nenhuma questão gerada por IA.
2. Cada erro deve virar aprendizado, não só um número.
3. O plano precisa ser cumprível: ritmo realista antes de ambição.
4. O conteúdo da questão chama atenção; a interface fica calma e sem celebração.
5. Dado da conta tem lugar certo: o que o servidor guarda e o que ainda é só do navegador deve estar claro para a pessoa.
