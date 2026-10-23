# Calculadora 3D

Calculadora de preço para impressão 3D: custo de filamento, energia, desgaste da máquina, mão de obra, falhas, preço sugerido, taxas de marketplace, atacado/consignado e cronograma de produção.

- **Front-end:** HTML + CSS + JavaScript puro (sem build)
- **Back-end:** funções da Vercel em `/api`
- **Banco:** Neon (Postgres serverless)

## Rodar no seu computador

```bash
npm install
cp .env.example .env   # e preencha os valores
npm run db:setup       # cria as tabelas (pode rodar quantas vezes quiser)
npm run dev            # http://localhost:3000
```

Para liberar um email pelo terminal:

```bash
npm run check -- --add cliente@email.com "Nome do Cliente"
```

## Como validar que está tudo funcionando

1. **Terminal:** `npm run check` testa variáveis, conexão, tabelas e uma escrita real (desfeita no final).
2. **Navegador:** `https://SEU-SITE/api/health` deve responder `{"ok":true,...}`.
3. **Painel:** `/admin` → aba **Sistema** mostra cada item em verde/vermelho e tem o botão **Criar tabelas**.

## Variáveis de ambiente (Vercel → Settings → Environment Variables)

| Variável | Para quê |
|---|---|
| `DATABASE_URL` | Conexão do Neon. Se conectar o Neon pela aba **Storage** da Vercel, ela é criada sozinha. |
| `AUTH_SECRET` | Assina o cookie de login. Gere com `openssl rand -hex 32`. |
| `ADMIN_SECRET` | Senha do painel `/admin`. |
| `HOTMART_SECRET` | Hottok do webhook da Hotmart (opcional). |

As variáveis antigas `SUPABASE_*` e `SITE_URL` não são mais usadas e podem ser apagadas.

## Estrutura

```
api/            funções serverless (login, me, logout, profile, calc-log, health, admin, hotmart-webhook)
lib/            conexão com o Neon, schema, sessão e utilitários HTTP
scripts/        servidor local (dev.js) e verificação do banco (check.js)
index.html      login
calculadora.html + calc.js, beds.js, planner.js, contrato.js, profile.js
admin.html + admin.js
marketplaces.js taxas por faixa de preço (revise quando os marketplaces mudarem)
```

## Login

O cliente entra só com o email da compra. O servidor confere se o email está ativo na tabela `members` e cria um cookie HttpOnly assinado, válido por 30 dias. Bloquear o membro no admin (ou via cancelamento na Hotmart) corta o acesso na hora.
