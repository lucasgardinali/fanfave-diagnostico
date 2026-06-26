require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(cors({
  origin: '*'
}));
app.use(express.json());

const PORT = process.env.PORT || 3000;

// ─── Labels para montar o prompt ───────────────────────────────────────────
const labelMap = {
  tipo_negocio: {
    restaurante: 'Restaurante',
    bar_boteco: 'Bar/Boteco',
    cafeteria_padaria: 'Cafeteria/Padaria',
    lanchonete_fast: 'Lanchonete/Fast Food',
    food_truck: 'Food Truck/Delivery'
  },
  tempo_negocio: {
    menos_1_ano: 'menos de 1 ano',
    '1_3_anos': '1 a 3 anos',
    '3_7_anos': '3 a 7 anos',
    mais_7_anos: 'mais de 7 anos'
  },
  movimento: {
    muito_novo_pouco_volta: 'Muito cliente novo, pouco retorno',
    base_fiel_pouco_novo: 'Base fiel mas sem crescimento',
    equilibrado: 'Equilibrado (sem clareza dos números)',
    movimento_irregular: 'Movimento irregular sem padrão'
  },
  conhece_clientes: {
    sim_sei_tudo: 'Conhece pelo nome e hábitos',
    sei_de_vista: 'Reconhece de vista mas sem dados',
    poucos_clientes: 'Conhece alguns, não a maioria',
    nao_sei: 'Sem controle de quem volta'
  },
  tentativa_anterior: {
    nunca_tentei: 'Nunca tentou fidelização formal',
    cartaozinho: 'Cartãozinho de papel',
    app_plataforma: 'App ou plataforma digital',
    whatsapp_manual: 'WhatsApp/promoções manuais'
  },
  maior_dificuldade: {
    cliente_some: 'Cliente some sem motivo aparente',
    nao_sei_por_que_volta: 'Não sabe o que faz o cliente voltar',
    concorrencia: 'Concorrência levando clientes',
    dependencia_delivery: 'Dependência de plataformas externas'
  },
  investimento_aquisicao: {
    nao_invisto: 'Não investe em aquisição',
    menos_300: 'Menos de R$300/mês',
    '300_1000': 'R$300 a R$1.000/mês',
    mais_1000: 'Mais de R$1.000/mês'
  },
  expectativa: {
    mais_retorno: 'Aumentar frequência de visitas',
    conhecer_clientes: 'Conhecer melhor os clientes',
    vender_mais: 'Aumentar ticket médio',
    recuperar_clientes: 'Recuperar clientes sumidos'
  }
};

function buildPrompt(dados) {
  const { nome, estabelecimento, cidade, respostas } = dados;
  const r = respostas;

  return `Você é um especialista sênior em fidelização de clientes para pequenos e médios negócios de alimentação no Brasil. Você trabalhou com centenas de estabelecimentos — desde botecos no interior até redes de cafeterias — e entende profundamente o comportamento do consumidor de food service, os erros operacionais mais comuns de donos de PME e o que realmente move a agulha em retenção.

Seu tom é direto, sem rodeios, sem clichês de marketing digital. Você fala como quem conhece a realidade do negócio — não como consultor de PowerPoint. Você usa dados e raciocínio, não motivação vazia.

---

PERFIL DO NEGÓCIO:
- Responsável: ${nome}
- Estabelecimento: ${estabelecimento} (${cidade})
- Tipo: ${labelMap.tipo_negocio[r.tipo_negocio] || r.tipo_negocio}
- Tempo de operação: ${labelMap.tempo_negocio[r.tempo_negocio] || r.tempo_negocio}
- Padrão de movimento: ${labelMap.movimento[r.movimento] || r.movimento}
- Conhecimento da base de clientes: ${labelMap.conhece_clientes[r.conhece_clientes] || r.conhece_clientes}
- Histórico de fidelização: ${labelMap.tentativa_anterior[r.tentativa_anterior] || r.tentativa_anterior}
- Principal dificuldade: ${labelMap.maior_dificuldade[r.maior_dificuldade] || r.maior_dificuldade}
- Investimento mensal em aquisição: ${labelMap.investimento_aquisicao[r.investimento_aquisicao] || r.investimento_aquisicao}
- Expectativa com fidelização: ${labelMap.expectativa[r.expectativa] || r.expectativa}

---

Gere um diagnóstico de fidelização personalizado para este negócio. O diagnóstico deve:

1. COMEÇAR com uma pontuação de maturidade em fidelização de 0 a 10 e uma frase de 1 linha que define o estágio atual do negócio.

2. ANALISAR o padrão atual com base nas respostas — não repita as respostas, interprete-as. Mostre o que os dados revelam sobre o comportamento dos clientes e o risco que isso representa.

3. IDENTIFICAR o erro principal de fidelização deste negócio especificamente — contextualizado ao tipo de estabelecimento e ao estágio.

4. DAR 2 ou 3 ações concretas e priorizadas para os próximos 30 dias. Nada de "melhore o atendimento" — ações táticas com lógica clara.

5. FECHAR com uma projeção realista: o que muda em 90 dias se implementar uma estratégia de fidelização estruturada agora.

Seja específico ao tipo de negócio. Um bar tem dinâmica diferente de uma cafeteria. Use isso.

Formato: texto corrido, sem bullet points excessivos, sem cabeçalhos com #. Parágrafos curtos. Máximo 400 palavras. Linguagem direta para dono de negócio.`;
}

// ─── ROTA: Health check ─────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ status: 'ok', servico: 'Fan Fave Backend', versao: '1.0.0' });
});

// ─── ROTA: Gerar diagnóstico ────────────────────────────────────────────────
app.post('/diagnostico', async (req, res) => {
  try {
    const { nome, estabelecimento, cidade, whatsapp, respostas } = req.body;

    if (!nome || !estabelecimento || !cidade || !respostas) {
      return res.status(400).json({ erro: 'Campos obrigatórios: nome, estabelecimento, cidade, respostas' });
    }

    const prompt = buildPrompt({ nome, estabelecimento, cidade, respostas });

    const resposta = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const dados = await resposta.json();

    if (!resposta.ok) {
      console.error('Erro Anthropic:', dados);
      return res.status(500).json({ erro: 'Erro ao gerar diagnóstico', detalhe: dados });
    }

    const texto = dados.content?.find(b => b.type === 'text')?.text || '';
    const scoreMatch = texto.match(/(\d[\.,]?\d?)\s*(?:\/\s*10|de\s*10)/i);
    const score = scoreMatch ? scoreMatch[1] : null;

    // Salvar lead no CRM (Supabase) se configurado
    if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
      try {
        await fetch(`${process.env.SUPABASE_URL}/rest/v1/leads`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': process.env.SUPABASE_KEY,
            'Authorization': `Bearer ${process.env.SUPABASE_KEY}`,
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({
            nome,
            estabelecimento,
            cidade,
            whatsapp,
            respostas,
            diagnostico: texto,
            score: score ? parseFloat(score) : null,
            origem: 'diagnostico_formulario',
            status: 'novo',
            created_at: new Date().toISOString()
          })
        });
      } catch (e) {
        console.warn('Aviso: não foi possível salvar no Supabase:', e.message);
      }
    }

    res.json({ diagnostico: texto, score });

  } catch (err) {
    console.error('Erro interno:', err);
    res.status(500).json({ erro: 'Erro interno do servidor', detalhe: err.message });
  }
});

// ─── ROTA: Disparar WhatsApp ────────────────────────────────────────────────
app.post('/whatsapp', async (req, res) => {
  try {
    const { whatsapp, nome, estabelecimento, diagnostico, score } = req.body;

    if (!whatsapp || !diagnostico) {
      return res.status(400).json({ erro: 'Campos obrigatórios: whatsapp, diagnostico' });
    }

    if (!process.env.ZAPI_INSTANCE || !process.env.ZAPI_TOKEN) {
      return res.status(500).json({ erro: 'Z-API não configurado' });
    }

    // Formata número: remove tudo que não é dígito
    const numero = whatsapp.replace(/\D/g, '');

    const mensagem = `Olá, ${nome}! 👋

Aqui é o Fan Fave. Seu diagnóstico de fidelização para *${estabelecimento}* ficou pronto.

📊 *Índice de maturidade em fidelização: ${score || '–'}/10*

${diagnostico.slice(0, 700)}

---
Quer entender como o Fan Fave pode mudar esse cenário para o seu negócio?

👇 Responde aqui que a gente conversa.

_Fan Fave — Fidelização para food service_`;

    const zapiRes = await fetch(
      `https://api.z-api.io/instances/${process.env.ZAPI_INSTANCE}/token/${process.env.ZAPI_TOKEN}/send-text`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: numero, message: mensagem })
      }
    );

    const zapiDados = await zapiRes.json();

    if (!zapiRes.ok) {
      return res.status(500).json({ erro: 'Erro ao enviar WhatsApp', detalhe: zapiDados });
    }

    res.json({ enviado: true, numero, zapiDados });

  } catch (err) {
    console.error('Erro WhatsApp:', err);
    res.status(500).json({ erro: 'Erro interno', detalhe: err.message });
  }
});

// ─── ROTA: Diagnóstico + WhatsApp em uma chamada só ────────────────────────
app.post('/diagnostico-completo', async (req, res) => {
  try {
    // 1. Gera diagnóstico
    const diagRes = await fetch(`http://localhost:${PORT}/diagnostico`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });
    const diagDados = await diagRes.json();

    if (!diagRes.ok) return res.status(500).json(diagDados);

    // 2. Dispara WhatsApp
    const { nome, estabelecimento, whatsapp } = req.body;
    const wppRes = await fetch(`http://localhost:${PORT}/whatsapp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        whatsapp,
        nome,
        estabelecimento,
        diagnostico: diagDados.diagnostico,
        score: diagDados.score
      })
    });
    const wppDados = await wppRes.json();

    res.json({
      diagnostico: diagDados.diagnostico,
      score: diagDados.score,
      whatsapp_enviado: wppDados.enviado || false
    });

  } catch (err) {
    console.error('Erro diagnóstico completo:', err);
    res.status(500).json({ erro: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Fan Fave Backend rodando na porta ${PORT}`);
});
