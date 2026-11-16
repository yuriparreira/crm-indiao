# CRM Indião Store (v3)

Front-end estático (GitHub Pages, `crm.indiaostore.com.br`) sobre o Supabase (projeto `CRM IS`, região sa-east-1).

- **Tela:** é o painel do Apps Script (`crm.html`, "INDIÃO | CRM ATACADO") portado sem mudar o visual nem as regras: abas Hoje, Funil, Prospectar, Clientes (pós-venda) e Painel; playbook e roteiros de mensagem; meta de 15 toques por dia; alertas iguais aos da planilha. Cópia do código antigo em `../codigo-crm-antigo-2026-11-16`.
- **Dados:** as chamadas `google.script.run` (CRM.gs) viraram funções do banco: `crm_boot`, `crm_update_lead`, `crm_update_prosp`, `crm_update_pv`, `crm_add_lead`, `crm_add_prosp`, `crm_history`. SQL em `sql/crm_v3_painel.sql`.
- **Novo na v3:** login por link no e-mail; aba Visitas (gestor e vendas: lojas por rota, roteiro e prestação de contas); "Nova loja para prospectar" (botão na aba Prospectar e o "+" quando ela está aberta); bloco "Visita presencial e rota" em todas as fichas; acessos e exportações no Painel.
- `index.html`, `style.css`, `app.js`: sem build. Biblioteca `@supabase/supabase-js` via CDN.
- Só entra quem está na tabela `perfis` (gestor, vendas, sdr). A chave do Supabase no código é a **publicável**; os dados são protegidos por login, RLS e pelas funções, que conferem o papel.
- Leads do site: Edge Function `lead-b2b` (`https://lnihrsdpogrtoqodbmtu.supabase.co/functions/v1/lead-b2b`).
