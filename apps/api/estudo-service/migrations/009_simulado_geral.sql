-- Simulado geral: questões sorteadas do acervo, registradas no servidor.
--
-- Até aqui o simulado sorteado guardava só o resultado no navegador, sem a
-- ordem das questões nem as respostas. Sem isso a pessoa não consegue rever
-- a prova depois (a "apostila" do simulado) nem refazer só os erros, e o
-- histórico some ao trocar de aparelho. Esta migration deixa a tabela de
-- simulados guardar também esse caso, ao lado da prova real.
--
-- Compatível com o código anterior: as colunas novas têm padrão, e a prova
-- real continua exigindo exame e tipo pelo CHECK abaixo.
ALTER TABLE simulados
  ADD COLUMN IF NOT EXISTS modalidade TEXT NOT NULL DEFAULT 'prova';

-- Ordem sorteada, guardada para reabrir a mesma prova. Os ids são TEXT como
-- em `tentativas.questao_id`.
ALTER TABLE simulados
  ADD COLUMN IF NOT EXISTS questoes TEXT[];

-- O simulado geral não tem exame nem caderno.
ALTER TABLE simulados ALTER COLUMN exame DROP NOT NULL;
ALTER TABLE simulados ALTER COLUMN tipo DROP NOT NULL;

-- Nomeados para o IF NOT EXISTS por baixo: rodar de novo não duplica.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_simulados_modalidade') THEN
    ALTER TABLE simulados ADD CONSTRAINT ck_simulados_modalidade
      CHECK (modalidade IN ('prova', 'geral'));
  END IF;

  -- Coerência entre modalidade e colunas: prova real é um exame e um
  -- caderno; o geral é uma lista de 1 a 80 questões.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_simulados_coerencia') THEN
    ALTER TABLE simulados ADD CONSTRAINT ck_simulados_coerencia CHECK (
      (modalidade = 'prova' AND exame IS NOT NULL AND tipo IS NOT NULL)
      OR (modalidade = 'geral' AND questoes IS NOT NULL
          AND cardinality(questoes) BETWEEN 1 AND 80)
    );
  END IF;
END $$;
