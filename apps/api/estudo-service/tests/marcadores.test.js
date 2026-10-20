const request = require('supertest');

// A verificação do token é local, então o teste assina JWT de verdade em
// vez de simular o auth-service — exercita o mesmo caminho da produção.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'segredo-de-teste';

const jwt = require('jsonwebtoken');
const { app, pool } = require('../app');
const { migrate } = require('../migrate');

const DONO = 3001;
const OUTRO = 3002;

const como = (id) =>
  `Bearer ${jwt.sign({ id, email: `u${id}@exemplo.local` }, process.env.JWT_SECRET)}`;

const limpar = () =>
  pool.query('DELETE FROM marcadores WHERE user_id = ANY($1)', [[DONO, OUTRO]]);

beforeAll(async () => {
  await migrate(pool); // o teste também exercita as migrations
});

beforeEach(limpar);

afterAll(async () => {
  await limpar();
  await pool.end();
});

describe('PUT /marcadores/:questaoId — criar e substituir', () => {
  it('cria o marcador do usuário autenticado', async () => {
    const res = await request(app)
      .put('/marcadores/q-1')
      .set('Authorization', como(DONO))
      .send({ tipo: 'chute', nota: '  chutei na terceira  ' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      questao_id: 'q-1',
      tipo: 'chute',
      nota: 'chutei na terceira',
    });

    // O que importa não é o 200, é o que ficou gravado — e para quem.
    const { rows } = await pool.query(
      'SELECT user_id, tipo, nota FROM marcadores WHERE questao_id = $1',
      ['q-1']
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({ user_id: DONO, tipo: 'chute', nota: 'chutei na terceira' });
  });

  it('substitui o marcador anterior sem criar uma segunda linha', async () => {
    await request(app)
      .put('/marcadores/q-substitui')
      .set('Authorization', como(DONO))
      .send({ tipo: 'chute', nota: 'primeira nota' });

    const res = await request(app)
      .put('/marcadores/q-substitui')
      .set('Authorization', como(DONO))
      .send({ tipo: 'duvida', nota: 'mudei de ideia' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ tipo: 'duvida', nota: 'mudei de ideia' });

    const { rows } = await pool.query(
      'SELECT tipo, nota FROM marcadores WHERE user_id = $1 AND questao_id = $2',
      [DONO, 'q-substitui']
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({ tipo: 'duvida', nota: 'mudei de ideia' });
  });

  it('nota ausente ou vazia vira null', async () => {
    const ausente = await request(app)
      .put('/marcadores/q-sem-nota')
      .set('Authorization', como(DONO))
      .send({ tipo: 'refazer' });
    expect(ausente.status).toBe(200);
    expect(ausente.body.nota).toBeNull();

    const vazia = await request(app)
      .put('/marcadores/q-nota-vazia')
      .set('Authorization', como(DONO))
      .send({ tipo: 'nao_sabia', nota: '   ' });
    expect(vazia.status).toBe(200);
    expect(vazia.body.nota).toBeNull();
  });

  it('recusa nota com mais de 280 caracteres', async () => {
    const res = await request(app)
      .put('/marcadores/q-nota-longa')
      .set('Authorization', como(DONO))
      .send({ tipo: 'chute', nota: 'x'.repeat(281) });

    expect(res.status).toBe(400);

    const { rows } = await pool.query(
      'SELECT 1 FROM marcadores WHERE questao_id = $1',
      ['q-nota-longa']
    );
    expect(rows).toHaveLength(0);
  });

  it('recusa nota que não é texto', async () => {
    for (const nota of [7, true, { texto: 'oi' }, ['oi']]) {
      const res = await request(app)
        .put('/marcadores/q-nota-invalida')
        .set('Authorization', como(DONO))
        .send({ tipo: 'chute', nota });
      expect(res.status).toBe(400);
    }
  });

  it('aceita nota com exatamente 280 caracteres', async () => {
    const nota = 'x'.repeat(280);
    const res = await request(app)
      .put('/marcadores/q-nota-no-teto')
      .set('Authorization', como(DONO))
      .send({ tipo: 'chute', nota });

    expect(res.status).toBe(200);
    expect(res.body.nota).toBe(nota);
  });

  it('recusa tipo fora dos quatro valores', async () => {
    for (const tipo of ['outro', '', '   ', 'CHUTE', 7, null, undefined]) {
      const res = await request(app)
        .put('/marcadores/q-tipo-invalido')
        .set('Authorization', como(DONO))
        .send({ tipo });
      expect(res.status).toBe(400);
    }

    const { rows } = await pool.query(
      'SELECT 1 FROM marcadores WHERE questao_id = $1',
      ['q-tipo-invalido']
    );
    expect(rows).toHaveLength(0);
  });

  it('ignora user_id vindo do corpo e usa o do token', async () => {
    const res = await request(app)
      .put('/marcadores/q-forjada')
      .set('Authorization', como(DONO))
      .send({ tipo: 'chute', user_id: OUTRO });

    expect(res.status).toBe(200);

    const { rows } = await pool.query(
      'SELECT user_id FROM marcadores WHERE questao_id = $1',
      ['q-forjada']
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].user_id).toBe(DONO);
  });

  it('exige autenticação', async () => {
    const res = await request(app).put('/marcadores/q-1').send({ tipo: 'chute' });
    expect(res.status).toBe(401);
  });
});

describe('GET /marcadores — lista do próprio usuário', () => {
  beforeEach(async () => {
    await pool.query(
      `INSERT INTO marcadores (user_id, questao_id, tipo, nota) VALUES
         ($1, 'q-chute-1', 'chute', NULL),
         ($1, 'q-chute-2', 'chute', 'duas opções parecidas'),
         ($1, 'q-duvida', 'duvida', NULL),
         ($2, 'q-do-outro', 'refazer', NULL)`,
      [DONO, OUTRO]
    );
  });

  it('devolve só os marcadores do próprio usuário', async () => {
    const res = await request(app).get('/marcadores').set('Authorization', como(DONO));

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3);
    expect(JSON.stringify(res.body)).not.toContain('q-do-outro');
  });

  it('filtra por tipo', async () => {
    const res = await request(app)
      .get('/marcadores?tipo=chute')
      .set('Authorization', como(DONO));

    expect(res.status).toBe(200);
    expect(res.body.map((m) => m.questao_id).sort()).toEqual(['q-chute-1', 'q-chute-2']);
    expect(res.body.every((m) => m.tipo === 'chute')).toBe(true);
  });

  it('recusa tipo de filtro inválido em vez de ignorar o filtro', async () => {
    const res = await request(app)
      .get('/marcadores?tipo=outro')
      .set('Authorization', como(DONO));

    expect(res.status).toBe(400);
  });

  it('exige autenticação', async () => {
    expect((await request(app).get('/marcadores')).status).toBe(401);
  });
});

describe('DELETE /marcadores/:questaoId — idempotente e por dono', () => {
  it('apaga o marcador e responde 204; repetir continua 204', async () => {
    await request(app)
      .put('/marcadores/q-apaga')
      .set('Authorization', como(DONO))
      .send({ tipo: 'chute' });

    const primeira = await request(app)
      .delete('/marcadores/q-apaga')
      .set('Authorization', como(DONO));
    expect(primeira.status).toBe(204);

    const segunda = await request(app)
      .delete('/marcadores/q-apaga')
      .set('Authorization', como(DONO));
    expect(segunda.status).toBe(204);

    const { rows } = await pool.query(
      'SELECT 1 FROM marcadores WHERE user_id = $1 AND questao_id = $2',
      [DONO, 'q-apaga']
    );
    expect(rows).toHaveLength(0);
  });

  it('não apaga nem vê o marcador de outro usuário', async () => {
    const alheio = await request(app)
      .put('/marcadores/q-alheia')
      .set('Authorization', como(OUTRO))
      .send({ tipo: 'refazer', nota: 'minha' });
    expect(alheio.status).toBe(200);

    // A lista do DONO não traz a linha do OUTRO.
    const lista = await request(app).get('/marcadores').set('Authorization', como(DONO));
    expect(lista.body).toEqual([]);

    // O DELETE responde 204 (idempotente), mas não toca na linha alheia.
    const apagar = await request(app)
      .delete('/marcadores/q-alheia')
      .set('Authorization', como(DONO));
    expect(apagar.status).toBe(204);

    const { rows } = await pool.query(
      'SELECT user_id, tipo, nota FROM marcadores WHERE questao_id = $1',
      ['q-alheia']
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({ user_id: OUTRO, tipo: 'refazer', nota: 'minha' });
  });

  it('exige autenticação', async () => {
    expect((await request(app).delete('/marcadores/q-1')).status).toBe(401);
  });
});
