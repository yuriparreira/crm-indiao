-- CRM v3: painel do Apps Script portado para o Supabase (16/11/2026)
-- Pós-venda, cadência em dias úteis e funções que repetem as regras da planilha antiga (CRM.gs + Prospeccao.gs)

-- ---------- pós-venda ----------
create table if not exists public.pos_venda (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  lead_id uuid references public.leads(id) on delete set null,
  conta_id uuid not null references public.contas(id) on delete cascade,
  vendedor text not null,
  cliente text, contato text, whatsapp text, cidade_uf text,
  status text not null default 'Onboarding' check (status in ('Onboarding','Ativo','Recompra próxima','Em risco','Inativo','Encerrado')),
  proximo_fu date, tipo_fu text default 'Confirmar recebimento',
  ultimo_contato date, resultado text, satisfacao smallint check (satisfacao between 1 and 5),
  n_pedidos integer, primeiro_pedido date, ultimo_pedido date, total numeric,
  vendedor_erp text, atualizado_erp timestamptz, vendido_vendedor numeric, vendido_vendedor_mes numeric, comprado_mes numeric,
  observacoes text,
  criado_em timestamptz not null default now(), atualizado_em timestamptz not null default now()
);
create index if not exists pos_venda_conta_idx on public.pos_venda (conta_id);
create index if not exists pos_venda_lead_idx on public.pos_venda (lead_id);
alter table public.pos_venda enable row level security;
create policy pv_ler on public.pos_venda for select to authenticated
  using (public.meu_papel() in ('gestor','vendas') or vendedor = public.meu_nome());
create policy pv_editar on public.pos_venda for update to authenticated
  using (public.meu_papel() = 'gestor' or vendedor = public.meu_nome())
  with check (public.meu_papel() = 'gestor' or vendedor = public.meu_nome());
create policy pv_gestor_criar on public.pos_venda for insert to authenticated with check (public.meu_papel() = 'gestor');
create policy pv_gestor_apagar on public.pos_venda for delete to authenticated using (public.meu_papel() = 'gestor');
create trigger t_touch before update on public.pos_venda for each row execute function public.tg_touch();
grant select, insert, update, delete on public.pos_venda to authenticated;
grant all on public.pos_venda to service_role;
alter table public.interacoes add column if not exists pos_venda_id uuid references public.pos_venda(id) on delete set null;

-- ---------- utilitários ----------
create or replace function public.crm_dia_util(d date) returns boolean language sql immutable set search_path = '' as $$
  select extract(isodow from d) < 6
     and to_char(d, 'MM-DD') <> all (array['01-01','04-21','05-01','09-07','10-12','11-02','11-15','11-20','12-25'])
     and d <> all (array['2027-03-26','2028-04-14','2029-03-30']::date[]) $$;
create or replace function public.crm_prox_util(d date) returns date language plpgsql immutable set search_path = '' as $$
begin while not public.crm_dia_util(d) loop d := d + 1; end loop; return d; end $$;
create or replace function public.crm_mais_uteis(d date, n int) returns date language plpgsql immutable set search_path = '' as $$
declare k int := 0;
begin while k < n loop d := d + 1; if public.crm_dia_util(d) then k := k + 1; end if; end loop; return d; end $$;
-- pausas longas (30 dias ou mais) contam corrido e caem num dia útil; as curtas contam só dias úteis
create or replace function public.crm_data_toque(d date, n int) returns date language sql immutable set search_path = '' as $$
  select case when n >= 30 then public.crm_prox_util(d + n) else public.crm_mais_uteis(d, n) end $$;

create or replace function public.crm_fone(t text) returns text language sql immutable set search_path = '' as $$
  select case when d = '' then null when length(d) <= 11 then '55' || d else d end
    from (select regexp_replace(coalesce(t, ''), '\D', '', 'g') as d) x $$;
create or replace function public.crm_fone_fmt(t text) returns text language sql immutable set search_path = '' as $$
  select case
    when d = '' then ''
    when length(n) = 11 then '(' || left(n, 2) || ') ' || substr(n, 3, 5) || '-' || right(n, 4)
    when length(n) = 10 then '(' || left(n, 2) || ') ' || substr(n, 3, 4) || '-' || right(n, 4)
    else d end
  from (select d, case when length(d) in (12, 13) and left(d, 2) = '55' then substr(d, 3) else d end as n
          from (select regexp_replace(coalesce(t, ''), '\D', '', 'g') as d) a) b $$;
create or replace function public.crm_num(v jsonb) returns numeric language plpgsql immutable set search_path = '' as $$
declare t text;
begin
  if v is null or jsonb_typeof(v) = 'null' then return null; end if;
  if jsonb_typeof(v) = 'number' then return (v #>> '{}')::numeric; end if;
  t := btrim(v #>> '{}');
  if t = '' then return null; end if;
  t := regexp_replace(t, '[^0-9,.\-]', '', 'g');
  if t ~ ',' then t := replace(replace(t, '.', ''), ',', '.'); end if; -- 1.234,56 (padrão brasileiro)
  return nullif(t, '')::numeric;
exception when others then return null;
end $$;
create or replace function public.crm_ms(t timestamptz) returns jsonb language sql immutable set search_path = '' as $$
  select case when t is null then to_jsonb(''::text) else to_jsonb((extract(epoch from t) * 1000)::bigint) end $$;
create or replace function public.crm_d(d date) returns text language sql immutable set search_path = '' as $$
  select coalesce(d::text, '') $$;
create or replace function public.crm_nota(obs text, quem text, nota text) returns text language sql stable set search_path = '' as $$
  select coalesce(nullif(btrim(obs), '') || E'\n', '') || '[' || to_char(public.hoje_br(), 'DD/MM') || ' · ' || coalesce(quem, '') || '] ' || btrim(nota) $$;
create or replace function public.crm_tipo_status(st text) returns text language sql immutable set search_path = '' as $$
  select case st when 'Pedido fechado' then 'Ganho' when 'Perdido' then 'Perdido' when 'Descartado' then 'Descartado' else 'Aberto' end $$;
create or replace function public.crm_canal_etapa(e text) returns text language sql immutable set search_path = '' as $$
  select case when e ~* 'insta' then 'Instagram' when e ~* 'liga' then 'Ligação' else 'WhatsApp' end $$;
create or replace function public.crm_pode(resp text, quem text, admin boolean) returns boolean language sql immutable set search_path = '' as $$
  select admin or coalesce(btrim(resp), '') = '' or lower(btrim(resp)) = lower(coalesce(quem, '')) $$;

-- ---------- objetos no formato do painel ----------
create or replace function public.crm_lead_obj(p_id uuid) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'uid', l.id, 'id', l.codigo, 'conta', l.conta_id, 'nome', coalesce(l.contato_nome, ''), 'loja', coalesce(c.nome, ''),
    'status', l.status, 'tipo', crm_tipo_status(l.status), 'resp', coalesce(l.responsavel, ''),
    'acao', coalesce(l.proxima_acao, ''), 'dataAcao', crm_d(l.data_proxima_acao),
    'whats', crm_fone_fmt(coalesce(nullif(c.whatsapp, ''), c.telefone)), 'temp', coalesce(l.temperatura, ''),
    'origem', coalesce(l.origem, ''), 'entrada', crm_ms(l.data_entrada),
    'email', coalesce(nullif(l.email, ''), c.email, ''), 'cidade', coalesce(c.cidade, ''), 'uf', coalesce(c.uf, ''),
    'doc', coalesce(c.cnpj, ''), 'ultContato', crm_d(l.ultimo_contato), 'potencial', l.potencial,
    'pedido', l.valor_primeiro_pedido, 'motivo', coalesce(l.motivo_perda, ''), 'obs', coalesce(l.observacoes, ''),
    'mudStatus', crm_ms(l.mudanca_status), 'pedERP', l.pedidos_erp, 'ultPedERP', crm_d(l.ultimo_pedido_erp),
    'totalERP', l.total_comprado_erp, 'insta', coalesce(c.instagram, ''), 'rota', coalesce(c.rota, ''),
    'endereco', coalesce(c.endereco, ''), 'utm', coalesce(l.utm, ''))
  from leads l join contas c on c.id = l.conta_id where l.id = p_id $$;

create or replace function public.crm_prosp_obj(p_id uuid) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'uid', p.id, 'id', p.codigo, 'conta', p.conta_id, 'tier', coalesce(c.tier, ''), 'score', c.score,
    'loja', coalesce(c.nome, ''), 'cidade', coalesce(c.cidade, ''), 'uf', coalesce(c.uf, ''), 'resp', coalesce(p.sdr, ''),
    'status', p.status, 'etapa', coalesce(p.etapa_feita, ''), 'proxPasso', coalesce(p.proximo_passo, ''),
    'ultToque', crm_d(p.ultimo_toque), 'prox', crm_d(p.proximo_toque),
    'whats', crm_fone_fmt(coalesce(nullif(c.whatsapp, ''), c.telefone)),
    'wa', case when coalesce(nullif(c.whatsapp, ''), c.telefone, '') = '' then ''
               when length(regexp_replace(regexp_replace(coalesce(nullif(c.whatsapp, ''), c.telefone), '\D', '', 'g'), '^55(\d{10,11})$', '\1')) = 11 then 'Sim' else 'Não' end,
    'insta', coalesce(c.instagram, ''), 'decisor', coalesce(p.decisor, ''), 'cnpj', coalesce(c.cnpj, ''),
    'marcas', coalesce(p.marcas, ''), 'publico', coalesce(p.publico, ''), 'epoca', coalesce(p.epoca_compra, ''),
    'canalResp', coalesce(p.respondeu_por, ''),
    'lead', coalesce((select l.codigo from leads l where l.prospeccao_id = p.id order by l.criado_em desc limit 1),
                     case when p.status in ('3. Respondeu', '8. Qualificado → Pedro', '9. Virou cliente', '7. Já é lead')
                          then (select l.codigo from leads l where l.conta_id = p.conta_id order by (l.status not in ('Perdido', 'Descartado')) desc, l.criado_em desc limit 1) end, ''),
    'obs', coalesce(p.anotacoes, ''), 'segmento', coalesce(c.segmento, ''), 'regiao', coalesce(p.regiao, ''),
    'nota', c.nota_google, 'aval', c.avaliacoes, 'sinais', coalesce(p.sinais, ''), 'endereco', coalesce(c.endereco, ''),
    'rota', coalesce(c.rota, ''))
  from prospeccoes p join contas c on c.id = p.conta_id where p.id = p_id $$;

create or replace function public.crm_pv_obj(p_id uuid) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'uid', v.id, 'id', v.codigo, 'conta', v.conta_id, 'vend', v.vendedor, 'cliente', coalesce(v.cliente, c.nome, ''),
    'contato', coalesce(v.contato, ''), 'whats', crm_fone_fmt(coalesce(nullif(v.whatsapp, ''), c.whatsapp, c.telefone)),
    'status', v.status, 'proxFU', crm_d(v.proximo_fu), 'tipoFU', coalesce(v.tipo_fu, ''), 'ultContato', crm_d(v.ultimo_contato),
    'resultado', coalesce(v.resultado, ''), 'satisf', coalesce(v.satisfacao::text, ''), 'nPed', v.n_pedidos,
    'primPed', crm_d(v.primeiro_pedido), 'ultPed', crm_d(v.ultimo_pedido), 'total', v.total,
    'cidade', coalesce(nullif(v.cidade_uf, ''), concat_ws(' / ', nullif(c.cidade, ''), nullif(c.uf, '')), ''),
    'obs', coalesce(v.observacoes, ''), 'vendTotal', v.vendido_vendedor, 'vendMes', v.vendido_vendedor_mes,
    'mesTotal', v.comprado_mes, 'atualERP', coalesce(((v.atualizado_erp at time zone 'America/Sao_Paulo')::date)::text, ''),
    'insta', coalesce(c.instagram, ''), 'rota', coalesce(c.rota, ''))
  from pos_venda v join contas c on c.id = v.conta_id where v.id = p_id $$;

-- ---------- carga inicial do painel ----------
create or replace function public.crm_boot() returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_me text := meu_nome(); v_papel text := meu_papel(); v_admin boolean;
begin
  if v_papel is null then raise exception 'Acesso não liberado para este e-mail. Peça ao gestor.'; end if;
  v_admin := v_papel = 'gestor';
  return jsonb_build_object(
    'me', v_me, 'admin', v_admin, 'papel', v_papel, 'today', hoje_br()::text,
    'status', '[{"s":"Novo","t":"Aberto","bg":"#F9DEC6","fg":"#8A3E0B"},{"s":"Em contato","t":"Aberto","bg":"#F2E8DA","fg":"#6B4226"},{"s":"Qualificado","t":"Aberto","bg":"#E6D2B8","fg":"#4A2F1B"},{"s":"Catálogo enviado","t":"Aberto","bg":"#D9BF9C","fg":"#3A2414"},{"s":"Negociação","t":"Aberto","bg":"#D9782D","fg":"#FFFFFF"},{"s":"Pedido fechado","t":"Ganho","bg":"#4F6B3A","fg":"#FFFFFF"},{"s":"Nutrição","t":"Aberto","bg":"#E1E7D6","fg":"#3E5530"},{"s":"Perdido","t":"Perdido","bg":"#CFC8C2","fg":"#3A2A20"},{"s":"Descartado","t":"Descartado","bg":"#EDEBE9","fg":"#8C8580"}]'::jsonb,
    'pvStatus', '[{"s":"Onboarding"},{"s":"Ativo"},{"s":"Recompra próxima"},{"s":"Em risco"},{"s":"Inativo"},{"s":"Encerrado"}]'::jsonb,
    'sellers', (select coalesce(jsonb_agg(n order by case n when 'Pedro' then 0 when 'Yuri' then 1 when 'Lucas' then 2 when 'Ian' then 3 else 9 end, n), '[]')
                  from (select nome as n from perfis where ativo union select sdr from prospeccoes union select responsavel from leads union select vendedor from pos_venda) s
                 where coalesce(n, '') not in ('', 'Gestor')),
    'origens', '["Site – LP B2B","WhatsApp","Instagram","Indicação","Representante","Feira / Evento","Visita presencial","Prospecção ativa","RD Station – LP B2B","Outro"]'::jsonb,
    'temps', '["Quente","Morno","Frio"]'::jsonb,
    'motivos', '["Preço / margem","Grade fechada não serve","Sem retorno","Comprou de concorrente","Fora do perfil","Sem CNPJ / não é lojista","Timing (voltar depois)","Outro"]'::jsonb,
    'ufs', '["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"]'::jsonb,
    'fuTipos', '["Confirmar recebimento","Giro de vendas / reposição","Apresentar novidades","Resolver problema","Financeiro / cobrança","Visita / reunião"]'::jsonb,
    'leads', (select coalesce(jsonb_agg(crm_lead_obj(l.id) order by l.criado_em), '[]') from leads l where crm_pode(l.responsavel, v_me, v_admin)),
    'pv', (select coalesce(jsonb_agg(crm_pv_obj(v.id) order by v.criado_em), '[]') from pos_venda v where v_admin or lower(v.vendedor) = lower(coalesce(v_me, ''))),
    'prosp', jsonb_build_object(
      'rows', (select coalesce(jsonb_agg(crm_prosp_obj(p.id) order by p.codigo), '[]') from prospeccoes p where crm_pode(p.sdr, v_me, v_admin)),
      'status', '[{"s":"0. Já é cliente","d":"Já comprava antes desta prospecção: não entra no Placar e sai da cadência"},{"s":"1. A abordar","d":"Ainda não recebeu nenhum toque"},{"s":"2. Contatado","d":"Em cadência, sem resposta ainda"},{"s":"3. Respondeu","d":"Respondeu: virou lead e está sendo qualificado por quem abordou"},{"s":"4. Sem retorno (pausa 60d)","d":"Cadência terminou sem resposta; reativar em 60 dias"},{"s":"5. Sem interesse","d":"Não quer ou pediu para não receber mais mensagens"},{"s":"6. Fora do ICP","d":"Franquia, atacadista, concorrente ou fechada"},{"s":"7. Já é lead","d":"Já está na aba Leads (veio do site, indicação etc.)"},{"s":"8. Qualificado → Pedro","d":"Qualificado e passado para o Pedro fechar"},{"s":"9. Virou cliente","d":"Fez o primeiro pedido"}]'::jsonb,
      'etapas', '[{"e":"D0 WhatsApp","dias":2,"prox":"D2 WhatsApp"},{"e":"D2 WhatsApp","dias":2,"prox":"D4 Instagram"},{"e":"D4 Instagram","dias":3,"prox":"D7 Ligação"},{"e":"D7 Ligação","dias":3,"prox":"D10 WhatsApp"},{"e":"D10 WhatsApp","dias":4,"prox":"D14 Encerramento"},{"e":"D14 Encerramento","dias":60,"prox":"Reativação"},{"e":"Reativação","dias":4,"prox":"D14 Encerramento"}]'::jsonb,
      'feriados', '["01-01","04-21","05-01","09-07","10-12","11-02","11-15","11-20","12-25","2027-03-26","2028-04-14","2029-03-30"]'::jsonb,
      'PS', '{"ABORDAR":"1. A abordar","CADENCIA":"2. Contatado","RESPONDEU":"3. Respondeu","SEM_RETORNO":"4. Sem retorno (pausa 60d)","SEM_INTERESSE":"5. Sem interesse","FORA":"6. Fora do ICP","JA_LEAD":"7. Já é lead","JA_CLIENTE":"0. Já é cliente","QUALIFICADO":"8. Qualificado → Pedro","CLIENTE":"9. Virou cliente"}'::jsonb,
      'meta', 15,
      'sdrs', (select coalesce(jsonb_agg(n order by case n when 'Lucas' then 0 when 'Yuri' then 1 when 'Ian' then 2 else 9 end, n), '[]')
                 from (select nome as n from perfis where ativo and papel = 'sdr'
                       union select sdr from prospeccoes where status <> '0. Já é cliente') s where coalesce(n, '') not in ('', 'Gestor')),
      'closer', 'Pedro',
      'playbook', 'https://drive.google.com/file/d/1tEZ7Wx13ihAaPQ049fRpMEY0NHxQRAg1/view'));
end $$;

-- ---------- lead: depois de mudar o status (pós-venda e espelho na prospecção) ----------
create or replace function public.tg_lead_depois() returns trigger language plpgsql security definer set search_path = public as $$
declare c contas; v_hoje date := hoje_br(); p prospeccoes;
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then return new; end if;
  if new.status = 'Pedido fechado' then
    select * into c from contas where id = new.conta_id;
    insert into pos_venda (codigo, lead_id, conta_id, vendedor, cliente, contato, whatsapp, cidade_uf, status, proximo_fu, tipo_fu,
                           n_pedidos, primeiro_pedido, ultimo_pedido, total, vendedor_erp)
    values (new.codigo, new.id, new.conta_id, coalesce(nullif(new.responsavel, ''), 'Pedro'), c.nome, new.contato_nome, c.whatsapp,
            concat_ws(' / ', nullif(c.cidade, ''), nullif(c.uf, '')), 'Onboarding', v_hoje + 7, 'Confirmar recebimento',
            coalesce(new.pedidos_erp, case when new.valor_primeiro_pedido > 0 then 1 end),
            coalesce(new.ultimo_pedido_erp, v_hoje), coalesce(new.ultimo_pedido_erp, v_hoje),
            coalesce(new.total_comprado_erp, new.valor_primeiro_pedido), new.vendedor_erp)
    on conflict (codigo) do update set status = case when pos_venda.status in ('Encerrado', 'Inativo') then 'Ativo' else pos_venda.status end;
  end if;
  -- espelho na prospecção da loja
  select * into p from prospeccoes where id = new.prospeccao_id;
  if not found then select * into p from prospeccoes where conta_id = new.conta_id order by criado_em desc limit 1; end if;
  if p.id is not null then
    if new.status = 'Pedido fechado' then
      update prospeccoes set status = case when p.status in ('7. Já é lead', '0. Já é cliente') then '0. Já é cliente' else '9. Virou cliente' end,
                             proximo_toque = null, proximo_passo = 'Cliente'
       where id = p.id and status not in ('9. Virou cliente', '0. Já é cliente');
    elsif new.status in ('Qualificado', 'Catálogo enviado', 'Negociação')
          and p.status not in ('9. Virou cliente', '8. Qualificado → Pedro', '7. Já é lead', '0. Já é cliente') then
      update prospeccoes set status = '8. Qualificado → Pedro', proximo_toque = null, proximo_passo = 'Com o Pedro' where id = p.id;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists t_lead_depois on public.leads;
create trigger t_lead_depois after insert or update of status on public.leads for each row execute function public.tg_lead_depois();

-- ---------- ações do painel ----------
-- Atualiza um lead. ch: status, acao, dataAcao, temp, motivo, pedido, potencial, nome, loja, email, whats, doc, cidade, uf, insta, resp (gestor), nota, contato
create or replace function public.crm_update_lead(p_id text, ch jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_me text := meu_nome(); v_papel text := meu_papel(); v_admin boolean := meu_papel() = 'gestor';
  l leads; c contas; v_de text; v_st text; v_pv jsonb := null; v_nota text := nullif(btrim(ch->>'nota'), '');
begin
  if v_papel is null then raise exception 'Acesso não liberado.'; end if;
  select * into l from leads where codigo = p_id for update;
  if not found then raise exception 'Lead % não encontrado.', p_id; end if;
  if not crm_pode(l.responsavel, v_me, v_admin) then raise exception 'Este lead é de outro vendedor.'; end if;
  select * into c from contas where id = l.conta_id for update;
  v_de := l.status;

  if not v_admin and coalesce(btrim(l.responsavel), '') = '' then
    l.responsavel := v_me;
    insert into interacoes (conta_id, lead_id, tipo, evento) values (l.conta_id, l.id, 'sistema', 'Lead assumido por ' || v_me);
  end if;
  if v_admin and ch ? 'resp' and coalesce(ch->>'resp', '') is distinct from coalesce(l.responsavel, '') then
    insert into interacoes (conta_id, lead_id, tipo, evento, de, para) values (l.conta_id, l.id, 'sistema', 'Responsável alterado', l.responsavel, ch->>'resp');
    l.responsavel := nullif(ch->>'resp', '');
  end if;
  if ch ? 'nome' then l.contato_nome := nullif(btrim(ch->>'nome'), ''); end if;
  if ch ? 'acao' then l.proxima_acao := nullif(btrim(ch->>'acao'), ''); end if;
  if ch ? 'temp' then l.temperatura := nullif(ch->>'temp', ''); end if;
  if ch ? 'motivo' then l.motivo_perda := nullif(ch->>'motivo', ''); end if;
  if ch ? 'email' then l.email := nullif(lower(btrim(ch->>'email')), ''); end if;
  if ch ? 'dataAcao' then l.data_proxima_acao := nullif(ch->>'dataAcao', '')::date; end if;
  if ch ? 'potencial' then l.potencial := crm_num(ch->'potencial'); end if;
  if ch ? 'pedido' then l.valor_primeiro_pedido := crm_num(ch->'pedido'); end if;
  if v_nota is not null then l.observacoes := crm_nota(l.observacoes, v_me, v_nota); end if;
  if (ch->>'contato')::boolean is true then l.ultimo_contato := hoje_br(); end if;
  if ch ? 'loja' and nullif(btrim(ch->>'loja'), '') is not null then c.nome := btrim(ch->>'loja'); end if;
  if ch ? 'cidade' then c.cidade := nullif(btrim(ch->>'cidade'), ''); end if;
  if ch ? 'uf' then c.uf := nullif(upper(btrim(ch->>'uf')), ''); end if;
  if ch ? 'whats' then c.whatsapp := crm_fone(ch->>'whats'); end if;
  if ch ? 'doc' then c.cnpj := nullif(btrim(ch->>'doc'), ''); end if;
  if ch ? 'insta' then c.instagram := nullif('@' || regexp_replace(regexp_replace(btrim(ch->>'insta'), '^https?://(www\.)?instagram\.com/', '', 'i'), '^@|[/?#].*$', '', 'g'), '@'); end if;
  if ch ? 'email' and coalesce(c.email, '') = '' then c.email := l.email; end if;

  v_st := coalesce(nullif(ch->>'status', ''), l.status);
  if v_st is distinct from v_de then
    if v_st = 'Perdido' and coalesce(l.motivo_perda, '') = '' then raise exception 'Escolha o motivo de perda.'; end if;
    l.status := v_st;
    if v_st not in ('Novo', 'Descartado') then l.ultimo_contato := hoje_br(); end if;
    -- passagem para o closer: o gatilho do status troca o responsável e a próxima ação
    if v_st = 'Qualificado' and coalesce(l.responsavel, '') <> 'Pedro' then
      l.temperatura := 'Quente';
      l.observacoes := crm_nota(l.observacoes, v_me, 'Qualificado por ' || coalesce(nullif(l.responsavel, ''), v_me) || '.');
    end if;
  end if;

  update contas set nome = c.nome, cidade = c.cidade, uf = c.uf, whatsapp = c.whatsapp, cnpj = c.cnpj, instagram = c.instagram, email = c.email
   where id = c.id;
  update leads set responsavel = l.responsavel, contato_nome = l.contato_nome, proxima_acao = l.proxima_acao, temperatura = l.temperatura,
         motivo_perda = l.motivo_perda, email = l.email, data_proxima_acao = l.data_proxima_acao, potencial = l.potencial,
         valor_primeiro_pedido = l.valor_primeiro_pedido, observacoes = l.observacoes, ultimo_contato = l.ultimo_contato, status = l.status
   where id = l.id;

  if v_nota is not null or (ch->>'contato')::boolean is true then
    insert into interacoes (conta_id, lead_id, tipo, evento, texto)
    values (l.conta_id, l.id, 'toque', case when v_st is distinct from v_de then 'Contato registrado com mudança de etapa' else 'Contato registrado' end, v_nota);
  end if;
  if v_st = 'Pedido fechado' and v_de is distinct from v_st then
    select crm_pv_obj(id) into v_pv from pos_venda where codigo = l.codigo;
  end if;
  return jsonb_build_object('lead', crm_lead_obj(l.id), 'pv', v_pv);
end $$;

-- Atualiza uma loja da prospecção. ch: etapa, status, decisor, cnpj, marcas, publico, epoca, insta, whats, nota, prox, proxPasso, resp (gestor)
create or replace function public.crm_update_prosp(p_id text, ch jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_me text := meu_nome(); v_papel text := meu_papel(); v_admin boolean := meu_papel() = 'gestor';
  p prospeccoes; c contas; v_hoje date := hoje_br(); v_ant text; v_st text; v_aviso text := '';
  v_nota text := nullif(btrim(ch->>'nota'), ''); v_et jsonb; v_lead leads; v_falta text; v_q text;
  v_vendedor boolean;
begin
  if v_papel is null then raise exception 'Acesso não liberado.'; end if;
  select * into p from prospeccoes where codigo = p_id for update;
  if not found then raise exception 'Loja % não encontrada na prospecção.', p_id; end if;
  if not crm_pode(p.sdr, v_me, v_admin) then raise exception 'Esta loja está com %.', p.sdr; end if;
  select * into c from contas where id = p.conta_id for update;
  v_vendedor := coalesce(v_me, '') not in ('', 'Gestor');

  if not v_admin and coalesce(btrim(p.sdr), '') = '' then p.sdr := v_me; end if;
  if v_admin and ch ? 'resp' and coalesce(ch->>'resp', '') is distinct from coalesce(p.sdr, '') then
    insert into interacoes (conta_id, prospeccao_id, tipo, evento, de, para)
    values (p.conta_id, p.id, 'sistema', 'Prospecção ' || p.codigo || ': responsável alterado', coalesce(p.sdr, 'ninguém'), coalesce(nullif(ch->>'resp', ''), 'ninguém'));
    p.sdr := nullif(ch->>'resp', '');
  end if;
  if ch ? 'decisor' then p.decisor := nullif(btrim(ch->>'decisor'), ''); end if;
  if ch ? 'marcas' then p.marcas := nullif(btrim(ch->>'marcas'), ''); end if;
  if ch ? 'publico' then p.publico := nullif(btrim(ch->>'publico'), ''); end if;
  if ch ? 'epoca' then p.epoca_compra := nullif(btrim(ch->>'epoca'), ''); end if;
  if ch ? 'cnpj' then c.cnpj := nullif(btrim(ch->>'cnpj'), ''); end if;
  if ch ? 'whats' then c.whatsapp := crm_fone(ch->>'whats'); end if;
  if ch ? 'insta' then c.instagram := nullif('@' || regexp_replace(regexp_replace(btrim(ch->>'insta'), '^https?://(www\.)?instagram\.com/', '', 'i'), '^@|[/?#].*$', '', 'g'), '@'); end if;
  if v_nota is not null then p.anotacoes := crm_nota(p.anotacoes, v_me, v_nota); end if;

  -- toque feito agora: mesma regra de quando a etapa era escolhida na planilha
  if nullif(ch->>'etapa', '') is not null then
    select e.value into v_et from jsonb_array_elements(crm_boot_etapas()) e where e.value->>'e' = ch->>'etapa';
    if v_et is null then raise exception 'Etapa % não existe.', ch->>'etapa'; end if;
    p.etapa_feita := ch->>'etapa';
    p.ultimo_toque := v_hoje;
    p.proximo_toque := crm_data_toque(v_hoje, (v_et->>'dias')::int);
    p.proximo_passo := v_et->>'prox';
    if p.etapa_feita = 'D14 Encerramento' then
      if p.status not in ('3. Respondeu', '8. Qualificado → Pedro') then p.status := '4. Sem retorno (pausa 60d)'; end if;
    elsif p.status in ('1. A abordar', '4. Sem retorno (pausa 60d)') or p.status is null then
      p.status := '2. Contatado';
    end if;
    if coalesce(p.sdr, '') = '' and v_vendedor then p.sdr := v_me; end if;
    insert into interacoes (conta_id, prospeccao_id, tipo, canal, evento, texto)
    values (p.conta_id, p.id, 'toque', crm_canal_etapa(p.etapa_feita), 'Toque ' || p.etapa_feita, v_nota);
  elsif v_nota is not null then
    insert into interacoes (conta_id, prospeccao_id, tipo, evento, texto) values (p.conta_id, p.id, 'nota', 'Anotação', v_nota);
  end if;

  v_ant := p.status;
  v_st := coalesce(nullif(ch->>'status', ''), p.status);
  if v_st is distinct from v_ant then
    if v_st = '8. Qualificado → Pedro' then
      v_falta := concat_ws(' e ', case when coalesce(p.decisor, '') = '' then 'Decisor' end, case when coalesce(c.cnpj, '') = '' then 'CNPJ' end);
      if v_falta <> '' then raise exception 'Para passar ao Pedro, preencha: %.', v_falta; end if;
    end if;
    p.status := v_st;
    if v_st = '2. Contatado' then
      if coalesce(p.etapa_feita, '') = '' then p.etapa_feita := 'D0 WhatsApp'; p.proximo_passo := 'D2 WhatsApp'; end if;
      p.ultimo_toque := coalesce(p.ultimo_toque, v_hoje);
      p.proximo_toque := coalesce(p.proximo_toque, crm_mais_uteis(v_hoje, 2));
    elsif v_st = '3. Respondeu' then
      p.proximo_toque := null; p.proximo_passo := 'Qualificar'; p.ultimo_toque := v_hoje;
      p.respondeu_por := coalesce(nullif(p.respondeu_por, ''), crm_canal_etapa(p.etapa_feita));
    elsif v_st = '8. Qualificado → Pedro' then
      p.respondeu_por := coalesce(nullif(p.respondeu_por, ''), crm_canal_etapa(p.etapa_feita));
      p.proximo_toque := null; p.proximo_passo := 'Com o Pedro';
    elsif v_st = '4. Sem retorno (pausa 60d)' then
      p.proximo_toque := crm_prox_util(v_hoje + 60); p.proximo_passo := 'Reativação';
    elsif v_st = '0. Já é cliente' then
      p.proximo_toque := null; p.proximo_passo := 'Cliente'; p.respondeu_por := null;
      if coalesce(p.anotacoes, '') !~* 'já era cliente' then
        p.anotacoes := coalesce(nullif(btrim(p.anotacoes), '') || E'\n', '') || 'Já era cliente antes da prospecção (' || to_char(v_hoje, 'DD/MM') || ').';
      end if;
    elsif v_st in ('5. Sem interesse', '6. Fora do ICP') then
      p.proximo_toque := null; p.proximo_passo := null;
    end if;
  end if;

  -- retorno pedido pela loja (data do próximo contato)
  if ch ? 'prox' then
    p.proximo_toque := nullif(ch->>'prox', '')::date;
    if ch ? 'proxPasso' then p.proximo_passo := nullif(ch->>'proxPasso', ''); end if;
    if p.proximo_toque is not null and p.status = '1. A abordar' then p.status := '2. Contatado'; end if;
    if p.proximo_toque is not null then
      insert into interacoes (conta_id, prospeccao_id, tipo, evento)
      values (p.conta_id, p.id, 'sistema', 'Retorno combinado para ' || to_char(p.proximo_toque, 'DD/MM'));
    end if;
  end if;

  update contas set cnpj = c.cnpj, whatsapp = c.whatsapp, instagram = c.instagram where id = c.id;
  -- o gatilho de status cria ou atualiza o lead (3. Respondeu e 8. Qualificado → Pedro)
  update prospeccoes set sdr = p.sdr, decisor = p.decisor, marcas = p.marcas, publico = p.publico, epoca_compra = p.epoca_compra,
         anotacoes = p.anotacoes, etapa_feita = p.etapa_feita, ultimo_toque = p.ultimo_toque, proximo_toque = p.proximo_toque,
         proximo_passo = p.proximo_passo, status = p.status, respondeu_por = p.respondeu_por
   where id = p.id;

  -- efeitos no lead depois que a prospecção mudou
  select * into v_lead from leads where prospeccao_id = p.id order by criado_em desc limit 1;
  if v_lead.id is null then
    select * into v_lead from leads where conta_id = p.conta_id and status not in ('Perdido', 'Descartado', 'Pedido fechado') order by criado_em desc limit 1;
  end if;
  if v_st is distinct from v_ant then
    if v_st = '3. Respondeu' and v_lead.id is not null then
      v_aviso := 'virou o lead ' || v_lead.codigo;
    elsif v_st = '8. Qualificado → Pedro' and v_lead.id is not null then
      v_q := concat_ws(' · ', 'Qualificado por ' || coalesce(nullif(p.sdr, ''), v_me),
                       'Decisor: ' || nullif(p.decisor, ''), 'Marcas: ' || nullif(p.marcas, ''), 'Público: ' || nullif(p.publico, ''),
                       'Época de compra: ' || nullif(p.epoca_compra, ''), 'Respondeu por ' || nullif(p.respondeu_por, ''));
      update leads set contato_nome = coalesce(nullif(contato_nome, ''), p.decisor), temperatura = 'Quente',
             observacoes = crm_nota(observacoes, v_me, v_q)
       where id = v_lead.id;
      insert into interacoes (conta_id, lead_id, prospeccao_id, tipo, evento, texto)
      values (p.conta_id, v_lead.id, p.id, 'sistema', 'Passagem para o Pedro', v_q);
      v_aviso := 'passou para o Pedro';
    elsif v_st in ('5. Sem interesse', '6. Fora do ICP') and v_lead.id is not null and crm_tipo_status(v_lead.status) = 'Aberto' then
      update leads set status = 'Perdido', motivo_perda = coalesce(nullif(motivo_perda, ''), case when v_st = '6. Fora do ICP' then 'Fora do perfil' else 'Outro' end),
             observacoes = crm_nota(observacoes, v_me, 'Prospecção: ' || v_st)
       where id = v_lead.id;
    end if;
  end if;
  if v_lead.id is not null then
    select * into v_lead from leads where id = v_lead.id;
  end if;
  -- o lead volta mesmo quando saiu da carteira de quem salvou (o painel tira da lista dele)
  return jsonb_build_object('prosp', crm_prosp_obj(p.id),
                            'lead', case when v_lead.id is not null then crm_lead_obj(v_lead.id) end,
                            'aviso', v_aviso);
end $$;

create or replace function public.crm_boot_etapas() returns jsonb language sql immutable set search_path = '' as $$
  select '[{"e":"D0 WhatsApp","dias":2,"prox":"D2 WhatsApp"},{"e":"D2 WhatsApp","dias":2,"prox":"D4 Instagram"},{"e":"D4 Instagram","dias":3,"prox":"D7 Ligação"},{"e":"D7 Ligação","dias":3,"prox":"D10 WhatsApp"},{"e":"D10 WhatsApp","dias":4,"prox":"D14 Encerramento"},{"e":"D14 Encerramento","dias":60,"prox":"Reativação"},{"e":"Reativação","dias":4,"prox":"D14 Encerramento"}]'::jsonb $$;

-- Atualiza um cliente do pós-venda. ch: status, proxFU, tipoFU, satisf, nota (resultado), contato
create or replace function public.crm_update_pv(p_id text, ch jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_me text := meu_nome(); v_papel text := meu_papel(); v_admin boolean := meu_papel() = 'gestor';
  v pos_venda; v_hoje date := hoje_br(); v_de text; v_nota text := nullif(btrim(ch->>'nota'), '');
begin
  if v_papel is null then raise exception 'Acesso não liberado.'; end if;
  select * into v from pos_venda where codigo = p_id for update;
  if not found then raise exception 'Cliente % não encontrado no pós-venda.', p_id; end if;
  if not v_admin and lower(v.vendedor) <> lower(coalesce(v_me, '')) then raise exception 'Este cliente é de outro vendedor.'; end if;
  v_de := v.status;
  if ch ? 'tipoFU' then v.tipo_fu := nullif(ch->>'tipoFU', ''); end if;
  if ch ? 'satisf' then v.satisfacao := nullif(ch->>'satisf', '')::smallint; end if;
  if ch ? 'proxFU' then v.proximo_fu := nullif(ch->>'proxFU', '')::date; end if;
  if v_nota is not null then v.resultado := v_nota; v.observacoes := crm_nota(v.observacoes, v_me, v_nota); end if;
  if (ch->>'contato')::boolean is true then
    v.ultimo_contato := v_hoje;
    if not ch ? 'proxFU' and (v.proximo_fu is null or v.proximo_fu <= v_hoje) then
      v.proximo_fu := v_hoje + 30;
      if not ch ? 'tipoFU' and coalesce(v.tipo_fu, 'Confirmar recebimento') = 'Confirmar recebimento' then v.tipo_fu := 'Giro de vendas / reposição'; end if;
    end if;
    if not ch ? 'status' and v.status = 'Onboarding' then v.status := 'Ativo'; end if;
    insert into interacoes (conta_id, lead_id, pos_venda_id, tipo, evento, texto) values (v.conta_id, v.lead_id, v.id, 'toque', 'Follow-up de pós-venda', v_nota);
  end if;
  if ch ? 'status' and ch->>'status' is distinct from v.status then v.status := ch->>'status'; end if;
  if v.status is distinct from v_de then
    insert into interacoes (conta_id, lead_id, pos_venda_id, tipo, evento, de, para) values (v.conta_id, v.lead_id, v.id, 'status', 'Status de pós-venda', v_de, v.status);
  end if;
  update pos_venda set tipo_fu = v.tipo_fu, satisfacao = v.satisfacao, proximo_fu = v.proximo_fu, resultado = v.resultado,
         observacoes = v.observacoes, ultimo_contato = v.ultimo_contato, status = v.status
   where id = v.id;
  return crm_pv_obj(v.id);
end $$;

-- Novo lead pelo painel (evita duplicado por WhatsApp ou e-mail)
create or replace function public.crm_add_lead(f jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_me text := meu_nome(); v_papel text := meu_papel(); v_admin boolean := meu_papel() = 'gestor';
  v_wa text := crm_fone(f->>'whatsapp'); v_email text := nullif(lower(btrim(f->>'email')), '');
  v_conta uuid; v_dup leads; v_lead uuid; v_resp text; v_nome text := nullif(btrim(f->>'nome'), ''); v_loja text := nullif(btrim(f->>'loja'), '');
begin
  if v_papel is null then raise exception 'Acesso não liberado.'; end if;
  if v_nome is null and v_loja is null then raise exception 'Informe o nome do contato ou da loja.'; end if;
  if v_wa is null and v_email is null then raise exception 'Informe o WhatsApp ou o e-mail.'; end if;
  v_resp := case when v_admin then coalesce(nullif(f->>'responsavel', ''), v_me) else v_me end;
  if v_wa is not null then
    select id into v_conta from contas where whatsapp in (v_wa, substr(v_wa, 3)) or crm_fone(telefone) = v_wa order by criado_em limit 1;
  end if;
  if v_conta is null and v_email is not null then
    select id into v_conta from contas where lower(email) = v_email order by criado_em limit 1;
    if v_conta is null then select conta_id into v_conta from leads where lower(email) = v_email order by criado_em limit 1; end if;
  end if;
  if v_conta is not null and not coalesce((f->>'forcar')::boolean, false) then
    select * into v_dup from leads where conta_id = v_conta order by (status not in ('Perdido', 'Descartado')) desc, criado_em desc limit 1;
    if v_dup.id is not null then
      return jsonb_build_object('duplicate', true, 'id', v_dup.codigo, 'nome', coalesce(v_dup.contato_nome, (select nome from contas where id = v_conta)),
                                'resp', coalesce(v_dup.responsavel, ''), 'visivel', crm_pode(v_dup.responsavel, v_me, v_admin));
    end if;
  end if;
  if v_conta is null or coalesce((f->>'forcar')::boolean, false) then
    insert into contas (nome, cidade, uf, whatsapp, email, cnpj, origem, criado_por)
    values (coalesce(v_loja, v_nome), nullif(btrim(f->>'cidade'), ''), nullif(upper(btrim(f->>'uf')), ''), v_wa, v_email,
            nullif(btrim(f->>'cnpj'), ''), coalesce(nullif(f->>'origem', ''), 'WhatsApp'), auth.jwt()->>'email')
    returning id into v_conta;
  end if;
  insert into leads (conta_id, contato_nome, status, responsavel, origem, email, temperatura, proxima_acao, data_proxima_acao, observacoes, criado_por)
  values (v_conta, v_nome, 'Novo', v_resp, coalesce(nullif(f->>'origem', ''), 'WhatsApp'), v_email, nullif(f->>'temperatura', ''),
          coalesce(nullif(btrim(f->>'proxima_acao'), ''), 'Fazer 1º contato'), coalesce(nullif(f->>'data_proxima_acao', '')::date, hoje_br()),
          nullif(btrim(f->>'obs'), ''), auth.jwt()->>'email')
  returning id into v_lead;
  return jsonb_build_object('ok', true, 'id', (select codigo from leads where id = v_lead), 'lead', crm_lead_obj(v_lead));
end $$;

-- Nova loja para prospectar (botão dos SDRs). Evita duplicado por WhatsApp, Instagram ou nome + cidade
create or replace function public.crm_add_prosp(f jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_me text := meu_nome(); v_papel text := meu_papel(); v_admin boolean := meu_papel() = 'gestor';
  v_wa text := crm_fone(f->>'whatsapp'); v_loja text := nullif(btrim(f->>'loja'), ''); v_cid text := nullif(btrim(f->>'cidade'), '');
  v_ig text := nullif(lower(regexp_replace(regexp_replace(btrim(coalesce(f->>'insta', '')), '^https?://(www\.)?instagram\.com/', '', 'i'), '^@|[/?#].*$', '', 'g')), '');
  v_conta uuid; v_p prospeccoes; v_l leads; v_sdr text; v_id uuid;
begin
  if v_papel is null then raise exception 'Acesso não liberado.'; end if;
  if v_loja is null then raise exception 'Informe o nome da loja.'; end if;
  if v_wa is null and v_ig is null then raise exception 'Informe o telefone/WhatsApp ou o Instagram da loja.'; end if;
  v_sdr := case when v_admin then coalesce(nullif(f->>'sdr', ''), case when coalesce(v_me, '') <> 'Gestor' then v_me end) else v_me end;
  if v_wa is not null then select id into v_conta from contas where whatsapp in (v_wa, substr(v_wa, 3)) or crm_fone(telefone) = v_wa order by criado_em limit 1; end if;
  if v_conta is null and v_ig is not null then select id into v_conta from contas where lower(regexp_replace(instagram, '^@', '')) = v_ig order by criado_em limit 1; end if;
  if v_conta is null and v_cid is not null then
    select id into v_conta from contas where lower(btrim(nome)) = lower(v_loja) and lower(btrim(cidade)) = lower(v_cid) order by criado_em limit 1;
  end if;
  if v_conta is not null then
    select * into v_p from prospeccoes where conta_id = v_conta order by criado_em desc limit 1;
    select * into v_l from leads where conta_id = v_conta order by criado_em desc limit 1;
    if not coalesce((f->>'forcar')::boolean, false) then
      if v_p.id is not null then
        return jsonb_build_object('duplicate', true, 'id', v_p.codigo, 'loja', (select nome from contas where id = v_conta), 'resp', coalesce(v_p.sdr, ''),
                                  'status', v_p.status, 'visivel', crm_pode(v_p.sdr, v_me, v_admin), 'tipo', 'prosp');
      end if;
      if v_l.id is not null then
        return jsonb_build_object('duplicate', true, 'id', v_l.codigo, 'loja', (select nome from contas where id = v_conta), 'resp', coalesce(v_l.responsavel, ''),
                                  'status', v_l.status, 'visivel', crm_pode(v_l.responsavel, v_me, v_admin), 'tipo', 'lead');
      end if;
    end if;
    -- "salvar mesmo assim" numa loja que já tem prospecção cria outra loja; se só tinha lead, usa a mesma
    if v_p.id is not null then v_conta := null; end if;
  end if;
  if v_conta is null then
    insert into contas (nome, cidade, uf, whatsapp, instagram, segmento, endereco, origem, criado_por)
    values (v_loja, v_cid, nullif(upper(btrim(f->>'uf')), ''), v_wa, case when v_ig is not null then '@' || v_ig end,
            nullif(f->>'segmento', ''), nullif(btrim(f->>'endereco'), ''), coalesce(nullif(f->>'origem', ''), 'Prospecção ativa'), auth.jwt()->>'email')
    returning id into v_conta;
  end if;
  insert into prospeccoes (conta_id, status, sdr, anotacoes, incluida_em, criado_por)
  values (v_conta, '1. A abordar', v_sdr,
          case when nullif(btrim(f->>'obs'), '') is not null then crm_nota(null, v_me, f->>'obs') end,
          to_char(hoje_br(), 'DD/MM/YYYY'), auth.jwt()->>'email')
  returning id into v_id;
  return jsonb_build_object('ok', true, 'id', (select codigo from prospeccoes where id = v_id), 'prosp', crm_prosp_obj(v_id));
end $$;

-- Histórico da loja (lead, prospecção, pós-venda e visitas)
create or replace function public.crm_history(p_id text) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_me text := meu_nome(); v_admin boolean := meu_papel() = 'gestor'; v_conta uuid; v_resp text;
begin
  if meu_papel() is null then raise exception 'Acesso não liberado.'; end if;
  select conta_id, responsavel into v_conta, v_resp from leads where codigo = p_id;
  if v_conta is null then select conta_id, sdr into v_conta, v_resp from prospeccoes where codigo = p_id; end if;
  if v_conta is null then select conta_id, vendedor into v_conta, v_resp from pos_venda where codigo = p_id; end if;
  if v_conta is null then return '[]'::jsonb; end if;
  if not crm_pode(v_resp, v_me, v_admin) then raise exception 'Esta loja é de outro vendedor.'; end if;
  return coalesce((select jsonb_agg(x order by (x->>'t')::bigint desc) from (
    select jsonb_build_object('t', (extract(epoch from i.quando) * 1000)::bigint,
             'ev', coalesce(i.evento, i.canal, i.tipo) || coalesce(': ' || left(i.texto, 160), '') || coalesce(' · ' || nullif(i.por, ''), ''),
             'de', coalesce(i.de, ''), 'para', coalesce(i.para, '')) x
      from interacoes i where i.conta_id = v_conta order by i.quando desc limit 40) s), '[]'::jsonb);
end $$;

-- ---------- permissões ----------
do $$
declare fn text;
begin
  foreach fn in array array['crm_boot()', 'crm_update_lead(text,jsonb)', 'crm_update_prosp(text,jsonb)', 'crm_update_pv(text,jsonb)',
                            'crm_add_lead(jsonb)', 'crm_add_prosp(jsonb)', 'crm_history(text)'] loop
    execute format('revoke all on function public.%s from public, anon', fn);
    execute format('grant execute on function public.%s to authenticated, service_role', fn);
  end loop;
  -- os montadores de objeto leem qualquer registro: só as funções acima (que conferem o papel) chamam
  foreach fn in array array['crm_lead_obj(uuid)', 'crm_prosp_obj(uuid)', 'crm_pv_obj(uuid)', 'tg_lead_depois()'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', fn);
  end loop;
end $$;
