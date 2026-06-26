# Fan Fave Backend

Backend para geração de diagnóstico de fidelização com IA e disparo automático via WhatsApp.

## Rotas

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/` | Health check |
| POST | `/diagnostico` | Gera diagnóstico via IA e salva lead no CRM |
| POST | `/whatsapp` | Dispara mensagem via Z-API |
| POST | `/diagnostico-completo` | Faz os dois em uma chamada só |

## Exemplo de chamada — `/diagnostico-completo`

```json
POST /diagnostico-completo
{
  "nome": "João Silva",
  "estabelecimento": "Bar do João",
  "cidade": "Montes Claros",
  "whatsapp": "38999999999",
  "respostas": {
    "tipo_negocio": "bar_boteco",
    "tempo_negocio": "3_7_anos",
    "movimento": "muito_novo_pouco_volta",
    "conhece_clientes": "sei_de_vista",
    "tentativa_anterior": "cartaozinho",
    "maior_dificuldade": "cliente_some",
    "investimento_aquisicao": "menos_300",
    "expectativa": "mais_retorno"
  }
}
```

## Deploy no Railway

### 1. Suba o código no GitHub

```bash
git init
git add .
git commit -m "primeiro deploy"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/fanfave-backend.git
git push -u origin main
```

### 2. Configure no Railway

1. Acesse [railway.app](https://railway.app) → New Project → Deploy from GitHub
2. Selecione o repositório `fanfave-backend`
3. Vá em **Variables** e adicione:

```
ANTHROPIC_API_KEY    →  sua chave da Anthropic
ZAPI_INSTANCE        →  ID da instância Z-API
ZAPI_TOKEN           →  token Z-API
SUPABASE_URL         →  URL do projeto Supabase
SUPABASE_KEY         →  service_role key do Supabase
```

4. O Railway detecta automaticamente o `npm start` e faz o deploy
5. Copie a URL gerada (ex: `https://fanfave-backend.up.railway.app`)

### 3. Atualize o formulário

No código do formulário (widget), substitua a chamada da API Anthropic pela chamada ao seu backend:

```javascript
// ANTES (chamada direta — não funciona no browser)
const res = await fetch('https://api.anthropic.com/v1/messages', { ... })

// DEPOIS (chamada ao seu backend)
const res = await fetch('https://fanfave-backend.up.railway.app/diagnostico-completo', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    nome,
    estabelecimento,
    cidade,
    whatsapp,
    respostas: answers
  })
});
const dados = await res.json();
// dados.diagnostico → texto do diagnóstico
// dados.score       → pontuação
// dados.whatsapp_enviado → true/false
```

## Tabela no Supabase

Execute este SQL no Supabase para criar a tabela de leads:

```sql
create table leads (
  id uuid default gen_random_uuid() primary key,
  nome text not null,
  estabelecimento text not null,
  cidade text,
  whatsapp text,
  respostas jsonb,
  diagnostico text,
  score numeric,
  origem text default 'diagnostico_formulario',
  status text default 'novo',
  created_at timestamptz default now()
);
```
