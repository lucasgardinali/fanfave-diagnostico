require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

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

  // Calcula score base para calibrar a IA
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

  return `Você é um especialista em fidelização de clientes para negócios de alimentação no Brasil. Você conhece profundamente o comportamento do consumidor em cada segmento — sabe que um bar/boteco tem dinâmica completamente diferente de uma cafeteria, que uma pizzaria tem ticket médio e frequência de visita diferentes de uma lanchonete, e que o perfil de cliente fiel varia muito entre esses contextos.

REGRAS ABSOLUTAS — LEIA COM ATENÇÃO:
1. Escreva SEMPRE na PRIMEIRA PESSOA, falando DIRETAMENTE com ${nome}. Use "você", "seu negócio", "sua ${tipo}". NUNCA use o nome dele na terceira pessoa. NUNCA escreva "o ${nome} deve..." ou "${nome} precisa...". SEMPRE "você deve...", "seu negócio precisa...".
2. Seja ESPECÍFICO para o segmento ${tipo}. Mencione características reais desse tipo de negócio — ticket médio típico, frequência de visita, comportamento do cliente fiel nesse segmento.
3. O score deve ser CALIBRADO de forma realista. Use ${scoreBase} como referência central. Ajuste de acordo com a combinação de respostas. Um negócio com ${tempo} de operação, que ${conhece.toLowerCase()} e nunca teve sistema formal tem score diferente de um que já tentou e tem base fiel. Seja preciso — scores próximos de 2 ou 9 são extremos e raros.
4. As ações devem ser CONCRETAS e PRÁTICAS — não genéricas. Diga o que fazer, como fazer, em quanto tempo.
5. Apresente o Fan Fave como solução ESPECÍFICA para os problemas identificados — não como propaganda genérica. Conecte diretamente o problema diagnosticado à funcionalidade do Fan Fave que resolve.

PERFIL COMPLETO DO NEGÓCIO:
- Responsável: ${nome}
- Estabelecimento: ${estabelecimento} — ${tipo} em ${cidade}
- Tempo de operação: ${tempo}
- Padrão de movimento: ${movimento}
- Conhecimento da base de clientes: ${conhece}
- Histórico de fidelização: ${tentativa}
- Principal dificuldade: ${dificuldade}
- Investimento mensal em aquisição: ${investimento}
- Objetivo principal: ${expectativa}
- O que ${nome} quer melhorar (palavras dele): "${melhoria || 'não informado'}"

SOBRE O FAN FAVE (use essas informações para conectar com os problemas específicos):
- Programa de pontos digital para food service
- Funciona APENAS com o número de celular do cliente — sem app, sem cartão, sem QR code
- O atendente digita o número no caixa e o ponto é registrado na hora
- O cliente acumula pontos e recebe notificação automática no WhatsApp quando tem pontos para resgatar
- O estabelecimento acessa painel completo: quem voltou, quem sumiu, frequência, perfil
- Funcionalidade de reativação: identifica clientes inativos e permite enviar oferta diretamente
- Ativação em até 2 dias com treinamento da equipe incluído
- R$119,90/mês

---

Gere o diagnóstico no seguinte formato JSON. Nada além do JSON — sem markdown, sem backticks, sem texto antes ou depois:

{
  "score": <número de ${scoreBase - 1} a ${scoreBase + 1}, sendo honesto e calibrado para este perfil específico>,
  "estagio": "<frase curta e direta descrevendo em que estágio de maturidade em fidelização este negócio está — seja específico para o segmento ${tipo}>",
  "diagnostico": "<4 parágrafos diretos, escritos na PRIMEIRA PESSOA falando com ${nome}:\n\nParágrafo 1: Diagnóstico real do padrão atual de clientes na ${tipo} de ${nome} — interprete as combinações de respostas, não as repita. Conecte o padrão de movimento com o que acontece no caixa em termos concretos.\n\nParágrafo 2: O erro principal de fidelização específico para este tipo de negócio e este perfil. Seja preciso — o que exatamente está fazendo o cliente não voltar ou o negócio não crescer. Traga dados ou referências do segmento ${tipo} para embasar.\n\nParágrafo 3: As consequências reais no caixa — quanto custa esse erro em reais, de forma aproximada, baseado no perfil de investimento e segmento informado.\n\nParágrafo 4: Como o Fan Fave resolve especificamente o problema identificado neste negócio — não genérico, conecte a funcionalidade específica do Fan Fave com a dor específica de ${nome}>",
  "acao_imediata": "<uma ação ESPECÍFICA e PRÁTICA que ${nome} pode implementar nos próximos 7 dias para começar a resolver o problema principal. Seja tão específico que ele consiga executar sem precisar de mais explicação. Se o Fan Fave for parte da ação, mencione como ele se encaixa. Máximo 3 frases.>"
}`;
}

// ─── CHAMADA À ANTHROPIC COM RETRY ───────────────────────────────────────────
async function callAnthropic(prompt, tentativas = 3) {
  let ultimoErro;
  for (let i = 1; i <= tentativas; i++) {
    try {
      console.log(`🤖 Tentativa ${i}/${tentativas} — Anthropic API`);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 25000);

      const resposta = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1200,
          messages: [{ role: 'user', content: prompt }]
        }),
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!resposta.ok) {
        const dados = await resposta.json();
        throw new Error(`Status ${resposta.status}: ${JSON.stringify(dados)}`);
      }

      const dados = await resposta.json();
      const texto = dados.content?.find(b => b.type === 'text')?.text || '';
      console.log(`✅ Anthropic respondeu na tentativa ${i}`);
      return texto;

    } catch (err) {
      ultimoErro = err;
      console.warn(`⚠️ Tentativa ${i} falhou: ${err.message}`);
      if (err.message?.includes('401') || err.message?.includes('403')) break;
      if (i < tentativas) {
        const espera = i * 2000;
        console.log(`⏳ Aguardando ${espera / 1000}s antes da próxima tentativa...`);
        await new Promise(r => setTimeout(r, espera));
      }
    }
  }
  throw new Error(`Falha após ${tentativas} tentativas: ${ultimoErro?.message}`);
}

async function salvarLeadNoCRM({ nome, whatsapp, estabelecimento, tipo, cidade, diagnostico, score, acao_imediata, melhoria }) {
  try {
    const notas = `Score: ${score}/10\n\nDiagnóstico:\n${diagnostico}\n\nAção imediata:\n${acao_imediata}\n\nO que quer melhorar:\n${melhoria || 'não informado'}`;
    const res = await fetch(`${SOFIA_API}/api/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, whatsapp: whatsapp?.replace(/\D/g, '') || '', estabelecimento, tipo: tipo || 'Food service', cidade: cidade || 'Montes Claros', status: 'novo', origem: 'landing', notas })
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
    const diagRes = await fetch(`http://localhost:${PORT}/diagnostico`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(req.body)
    });
    const diagDados = await diagRes.json();
    if (!diagRes.ok) return res.status(500).json(diagDados);

    const { nome, estabelecimento, cidade, whatsapp, melhoria } = req.body;
    fetch(`http://localhost:${PORT}/whatsapp`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ whatsapp, nome, estabelecimento, cidade, melhoria, diagnostico: diagDados.diagnostico, score: diagDados.score, acao_imediata: diagDados.acao_imediata })
    }).catch(e => console.warn('WhatsApp background:', e.message));

    res.json(diagDados);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.listen(PORT, () => console.log(`✅ Fan Fave Diagnóstico v3 rodando na porta ${PORT}`));
