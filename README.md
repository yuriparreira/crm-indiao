# CRM Indião Store (v2)

Front-end estático (GitHub Pages, `crm.indiaostore.com.br`) sobre o Supabase (projeto `CRM IS`, região sa-east-1).

- `index.html`, `style.css`, `app.js`: app de página única, sem build. Biblioteca `@supabase/supabase-js` via CDN.
- Login por link no e-mail (Supabase Auth). Só entra quem está na tabela `perfis` (gestor, vendas, sdr).
- A chave do Supabase neste código é a chave **publicável** (pública por definição). Os dados são protegidos por login + RLS no banco.
- Leads do site: Edge Function `lead-b2b` (`https://lnihrsdpogrtoqodbmtu.supabase.co/functions/v1/lead-b2b`).

Banco, regras e migrações: ver o painel do Supabase (Database › Migrations).
