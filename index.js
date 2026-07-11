require('dotenv').config();
const express = require('express');
const cors = require('cors');
// Node 18+ tem fetch nativo — não precisa de node-fetch

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

const PORT = process.env.PORT || 3000;
const SOFIA_API = process.env.SOFIA_API_URL || 'https://sofia-sdr-production-df9f.up.railway.app';

const labelMap = {
  tipo_negocio: { restaurante: 'Restaurante', bar_boteco: 'Bar/Boteco', cafeteria_padaria: 'Cafeteria/Padaria', lanchonete_fast: 'Lanchonete/Fast Food', pizzaria: 'Pizzaria', sorveteria_acaiteria: 'Sorveteria/Açaiteria', food_truck: 'Food Truck/Delivery' },
  tempo_negocio: { menos_1_ano: 'menos de 1 ano', '1_3_anos': '1 a 3 anos', '3_7_anos': '3 a 7 anos', mais_7_anos: 'mais de 7 anos' },
  movimento: { muito_novo_pouco_volta: 'Muito cliente novo, pouco retorno', base_fiel_pouco_novo: 'Base fiel mas sem crescimento', equilibrado: 'Equilibrado (sem clareza dos números)', movimento_irregular: 'Movimento irregular sem padrão' },
  conhece_clientes: { sim_sei_tudo: 'Conhece pelo nome e hábitos', sei_de_vista: 'Reconhece de vista mas sem dados', poucos_clientes: 'Conhece alguns, maioria passa anônima', nao_sei: 'Sem controle de quem volta' },
  tentativa_anterior: { nunca_tentei: 'Nunca tentou fidelização formal', cartaozinho: 'Cartãozinho de papel', app_plataforma: 'App ou plataforma digital', whatsapp_manual: 'WhatsApp/promoções manuais' },
  maior_dificuldade: { cliente_some: 'Cliente some sem motivo aparente', nao_sei_por_que_volta: 'Não sabe o que faz o cliente voltar', concorrencia: 'Concorrência levando clientes', dependencia_delivery: 'Dependência de plataformas externas' },
  investimento_aquisicao: { nao_invisto: 'Não investe em aquisição', menos_300: 'Menos de R$300/mês', '300_1000': 'R$300 a R$1.000/mês', mais_1000: 'Mais de R$1.000/mês' },
  expectativa: { mais_retorno: 'Fazer o cliente voltar com mais frequência', conhecer_clientes: 'Saber quem são os clientes e ter os dados', vender_mais: 'Aumentar o ticket médio por visita', recuperar_clientes: 'Recuperar clientes que sumiram' }
};

function buildPrompt(dados) {
  const { nome, estabelecimento, cidade, melhoria, respostas: r } = dados;

  const tipo = labelMap.tipo_negocio[r.tipo_negocio] || r.tipo_negocio;
  const tempo = labelMap.tempo_negocio[r.tempo_negocio] || r.tempo_negocio;
  const movimento = labelMap.movimento[r.movimento] || r.movimento;
  const conhece = labelMap.conhece_clientes[r.conhece_clientes] || r.conhece_clientes;
  const tentativa = labelMap.tentativa_anterior[r.tentativa_anterior] || r.tentativa_anterior;
  const dificuldade = labelMap.maior_dificuldade[r.maior_dificuldade] || r.maior_dificuldade;
  const investimento = labelMap.investimento_aquisicao[r.investimento_aquisicao] || r.investimento_aquisicao;
  const expectativa = labelMap.expectativa[r.expectativa] || r.expectativa;

  let scoreBase = 5;
  if (r.conhece_clientes === 'sim_sei_tudo') scoreBase += 2;
  if (r.conhece_clientes === 'nao_sei') scoreBase -= 2;
  if (r.tentativa_anterior === 'app_plataforma') scoreBase += 1;
  if (r.tentativa_anterior === 'nunca_tentei') scoreBase -= 1;
  if (r.movimento === 'base_fiel_pouco_novo') scoreBase += 1;
  if (r.movimento === 'muito_novo_pouco_volta') scoreBase -= 1;
  if (r.investimento_aquisicao === 'mais_1000') scoreBase += 1;
  if (r.investimento_aquisicao === 'nao_invisto') scoreBase -= 1;
  scoreBase = Math.max(2, Math.min(9, scoreBase));

  return `Você é um consultor especialista em fidelização de clientes para food service no Brasil, com 15 anos de experiência. Você conhece profundamente as métricas reais de cada segmento — ticket médio, frequência de visita, taxa de retorno típica, margem — e sabe exatamente o que trava o crescimento de cada tipo de negócio.

Gere um diagnóstico profundo e específico para ${nome}, dono de um negócio do tipo "${tipo}" chamado "${estabelecimento}" em ${cidade}.

ATENÇÃO AO SEGMENTO: o negócio é "${tipo}". Todas as suas análises, exemplos e números devem ser sobre ${tipo} — NÃO confunda com outro segmento. Se é cafeteria, fale de cafeteria. Se é pizzaria, fale de pizzaria.

REGRAS DE ESCRITA:
- PRIMEIRA PESSOA, falando direto com ${nome}: "você", "seu negócio". NUNCA "o ${nome}" na terceira pessoa.
- Traga NÚMEROS REAIS do segmento ${tipo}: ticket médio típico, frequência de visita esperada, quanto vale um cliente fiel vs ocasional, taxa de retorno média do setor.
- Seja específico e picante — aponte o problema real com franqueza, sem ser genérico.
- Score entre ${scoreBase - 1} e ${scoreBase + 1}.

DADOS DO NEGÓCIO:
- ${estabelecimento} — ${tipo}, ${tempo} de operação, em ${cidade}
- Padrão de movimento: ${movimento}
- Conhecimento dos clientes: ${conhece}
- Já tentou fidelizar: ${tentativa}
- Maior dificuldade: ${dificuldade}
- Investimento em atrair clientes: ${investimento}
- Objetivo principal: ${expectativa}
- Nas palavras dele, quer melhorar: "${melhoria || 'não informado'}"

COMO O FAN FAVE RESOLVE (conecte especificamente com os problemas acima):
- Programa de pontos digital: cliente pontua só com o número de celular, sem app nem cartão
- Cria automaticamente a base de dados que ${nome} não tem hoje — nome, contato, histórico de cada cliente
- Painel mostra quem sumiu, quem está prestes a sumir, quem são os clientes mais fiéis
- Notifica o cliente automaticamente quando tem pontos, trazendo ele de volta
- Ativa em 2 dias, R$119,90/mês

Responda APENAS com JSON válido, sem markdown:
{"score":${scoreBase},"estagio":"<frase de 1 linha sobre o estágio de maturidade específico deste ${tipo}>","diagnostico":"<3 parágrafos densos e específicos na primeira pessoa. Parágrafo 1: o que os dados revelam sobre a situação real do ${tipo} de ${nome}, com números do segmento. Parágrafo 2: o erro central que está custando dinheiro — seja franco e específico, quantifique a perda. Parágrafo 3: como o Fan Fave resolve exatamente esse problema, conectando funcionalidade com a dor real dele.>","acao_imediata":"<1 ação concreta e específica para os próximos 7 dias, que ${nome} consiga executar sozinho. Máximo 3 frases.>"}`;
}

// ─── CHAMADA À ANTHROPIC (node-fetch, como o original) ───────────────────────
async function callAnthropic(prompt) {
  const resposta = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 3000,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  const dados = await resposta.json();
  if (!resposta.ok) throw new Error(`Anthropic ${resposta.status}: ${JSON.stringify(dados)}`);
  return dados.content?.find(b => b.type === 'text')?.text || '';
}

async function salvarLeadNoCRM({ nome, whatsapp, estabelecimento, tipo, cidade, diagnostico, score, acao_imediata, melhoria }) {
  try {
    const notas = `Score: ${score}/10\n\nAção imediata: ${acao_imediata}`;
    const res = await fetch(`${SOFIA_API}/api/public/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, whatsapp: whatsapp?.replace(/\D/g, '') || '', estabelecimento, tipo: tipo || 'Food service', cidade: cidade || 'Montes Claros', origem: 'diagnostico', notas })
    });
    const data = await res.json();
    if (!res.ok && res.status !== 409) console.warn('Aviso CRM:', data.error);
    else console.log(`✅ Lead salvo no CRM: ${nome}`);
  } catch (err) {
    console.warn('Erro ao salvar lead no CRM:', err.message);
  }
}

async function enviarWhatsApp(numero, mensagem) {
  const instance = process.env.ZAPI_INSTANCE_ID || process.env.ZAPI_INSTANCE;
  const token = process.env.ZAPI_TOKEN;
  const clientToken = process.env.ZAPI_CLIENT_TOKEN;
  if (!instance || !token) { console.warn('Z-API não configurado'); return null; }
  const res = await fetch(`https://api.z-api.io/instances/${instance}/token/${token}/send-text`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(clientToken ? { 'Client-Token': clientToken } : {}) },
    body: JSON.stringify({ phone: numero.replace(/\D/g, ''), message: mensagem })
  });
  const data = await res.json();
  if (!res.ok) console.warn('Z-API erro:', data);
  return data;
}

app.get('/', (req, res) => res.json({ status: 'ok', servico: 'Fan Fave Diagnóstico', versao: '3.1.0' }));

app.post('/diagnostico', async (req, res) => {
  try {
    const { nome, estabelecimento, cidade, whatsapp, melhoria, respostas } = req.body;
    if (!nome || !estabelecimento || !cidade || !respostas) return res.status(400).json({ erro: 'Campos obrigatórios: nome, estabelecimento, cidade, respostas' });

    const prompt = buildPrompt({ nome, estabelecimento, cidade, melhoria, respostas });

    let texto;
    try {
      texto = await callAnthropic(prompt);
    } catch (err) {
      console.error('Anthropic falhou após retries:', err.message);
      return res.status(503).json({ erro: 'Serviço de IA temporariamente indisponível. Tente novamente em alguns minutos.', detalhe: err.message });
    }

    let parsed;
    try { parsed = JSON.parse(texto.replace(/```json|```/g, '').trim()); }
    catch(e) {
      const scoreMatch = texto.match(/(\d[\.,]?\d?)\s*(?:\/\s*10|de\s*10)/i);
      parsed = { score: scoreMatch ? parseFloat(scoreMatch[1]) : null, diagnostico: texto, acao_imediata: '', estagio: '' };
    }

    // Salva no CRM automaticamente — sempre, sem depender do Supabase
    const tipo = labelMap.tipo_negocio[respostas.tipo_negocio] || respostas.tipo_negocio || 'Food service';
    await salvarLeadNoCRM({ nome, whatsapp, estabelecimento, tipo, cidade, diagnostico: parsed.diagnostico, score: parsed.score, acao_imediata: parsed.acao_imediata, melhoria });

    res.json({ diagnostico: parsed.diagnostico, score: parsed.score, acao_imediata: parsed.acao_imediata, estagio: parsed.estagio });
  } catch (err) {
    console.error('Erro:', err);
    res.status(500).json({ erro: 'Erro interno', detalhe: err.message });
  }
});

app.post('/whatsapp', async (req, res) => {
  try {
    const { whatsapp, nome, estabelecimento, cidade, diagnostico, score, acao_imediata, melhoria } = req.body;
    if (!whatsapp || !diagnostico) return res.status(400).json({ erro: 'Campos obrigatórios: whatsapp, diagnostico' });

    const msgLead = `Olá, ${nome}! 👋\n\nAqui é o Fan Fave. Seu diagnóstico de fidelização para *${estabelecimento}* ficou pronto.\n\n📊 *Índice de maturidade: ${score || '–'}/10*\n\n${(diagnostico || '').slice(0, 600)}...\n\n⚡ *Ação imediata:*\n${acao_imediata || ''}\n\n---\nQuer entender como o Fan Fave resolve isso para o seu negócio?\n\n👇 Responde aqui que a gente conversa.\n\n_Fan Fave — Fidelização para food service_`;

    await enviarWhatsApp(whatsapp, msgLead);

    const msgManager = `🔔 *Novo lead — Fan Fave Diagnóstico*\n\n👤 *Nome:* ${nome}\n🏪 *Estabelecimento:* ${estabelecimento}\n📍 *Cidade:* ${cidade || ''}\n📱 *WhatsApp:* ${whatsapp}\n📊 *Score:* ${score || '–'}/10\n\n💬 *O que quer melhorar:*\n${melhoria || 'não informado'}\n\n⚡ *Ação imediata:*\n${acao_imediata || ''}\n\n_Lead salvo no CRM: fanfave-crm.vercel.app/#crm_`;

    await enviarWhatsApp('5538999741263', msgManager);

    res.json({ enviado: true });
  } catch (err) {
    res.status(500).json({ erro: 'Erro interno', detalhe: err.message });
  }
});

app.post('/diagnostico-completo', async (req, res) => {
  try {
    const { nome, estabelecimento, cidade, whatsapp, melhoria, respostas } = req.body;
    if (!nome || !estabelecimento || !cidade || !respostas) {
      return res.status(400).json({ erro: 'Campos obrigatórios: nome, estabelecimento, cidade, respostas' });
    }

    // 1. Gera o diagnóstico
    const prompt = buildPrompt({ nome, estabelecimento, cidade, melhoria, respostas });
    let texto;
    try {
      texto = await callAnthropic(prompt);
    } catch (err) {
      console.error('Anthropic falhou:', err.message);
      return res.status(503).json({ erro: 'Serviço de IA temporariamente indisponível. Tente novamente em alguns minutos.' });
    }

    let parsed;
    try {
      parsed = JSON.parse(texto.replace(/```json|```/g, '').trim());
    } catch (e) {
      const scoreMatch = texto.match(/(\d[\.,]?\d?)\s*(?:\/\s*10|de\s*10)/i);
      parsed = { score: scoreMatch ? parseFloat(scoreMatch[1]) : null, diagnostico: texto, acao_imediata: '', estagio: '' };
    }

    // 2. Salva no CRM
    const tipo = labelMap.tipo_negocio[respostas.tipo_negocio] || respostas.tipo_negocio || 'Food service';
    await salvarLeadNoCRM({ nome, whatsapp, estabelecimento, tipo, cidade, diagnostico: parsed.diagnostico, score: parsed.score, acao_imediata: parsed.acao_imediata, melhoria });

    // 3. Responde para a tela imediatamente
    res.json({ diagnostico: parsed.diagnostico, score: parsed.score, acao_imediata: parsed.acao_imediata, estagio: parsed.estagio });

    // 4. Envia WhatsApp em background (não bloqueia a resposta) — chama as funções diretamente
    (async () => {
      try {
        if (whatsapp) {
          const msgLead = `Olá, ${nome}! 👋\n\nAqui é o Fan Fave. Seu diagnóstico de fidelização para *${estabelecimento}* ficou pronto.\n\n📊 *Índice de maturidade: ${parsed.score || '–'}/10*\n\n${(parsed.diagnostico || '').slice(0, 600)}...\n\n⚡ *Ação imediata:*\n${parsed.acao_imediata || ''}\n\n---\nQuer entender como o Fan Fave resolve isso para o seu negócio?\n\n👇 Responde aqui que a gente conversa.\n\n_Fan Fave — Fidelização para food service_`;
          await enviarWhatsApp(whatsapp, msgLead);
        }

        const msgManager = `🔔 *Novo lead — Fan Fave Diagnóstico*\n\n👤 *Nome:* ${nome}\n🏪 *Estabelecimento:* ${estabelecimento}\n📍 *Cidade:* ${cidade || ''}\n📱 *WhatsApp:* ${whatsapp}\n📊 *Score:* ${parsed.score || '–'}/10\n\n💬 *O que quer melhorar:*\n${melhoria || 'não informado'}\n\n⚡ *Ação imediata:*\n${parsed.acao_imediata || ''}\n\n_Lead salvo no CRM: fanfave-crm.vercel.app/#crm_`;
        await enviarWhatsApp('5538999741263', msgManager);

        console.log(`✅ WhatsApp enviado para lead e manager`);
      } catch (err) {
        console.warn('Erro ao enviar WhatsApp:', err.message);
      }
    })();

  } catch (err) {
    console.error('Erro:', err);
    res.status(500).json({ erro: err.message });
  }
});

app.listen(PORT, () => console.log(`✅ Fan Fave Diagnóstico v3 rodando na porta ${PORT}`));
