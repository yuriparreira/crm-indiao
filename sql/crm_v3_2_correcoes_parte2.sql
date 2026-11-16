-- CRM v3.2 · parte 2: regras de lead, prospecção e pós-venda (revisão de 16/11/2026)

-- #6 número com ponto de milhar ("1.500", "2.350.000") e erro em vez de apagar o campo
create or replace function public.crm_num(v jsonb) returns numeric language plpgsql immutable set search_path = '' as $$
declare t text;
begin
  if v is null or jsonb_typeof(v) = 'null' then return null; end if;
  if jsonb_typeof(v) = 'number' then return (v #>> '{}')::numeric; end if;
  t := btrim(v #>> '{}');
  if t = '' then return null; end if;
  t := regexp_replace(t, '[^0-9,.\-]', '', 'g');
  if t ~ ',' then t := replace(replace(t, '.', ''), ',', '.');
  elsif t ~ '^-?\d{1,3}(\.\d{3})+$' then t := replace(t, '.', '');
  end if;
  if t = '' then return null; end if;
  begin
    return t::numeric;
  exception when others then
    raise exception 'Valor inválido: %', v #>> '{}';
  end;
end $$;

-- #9/#11 status do lead: o espelho na prospecção fica só no tg_lead_depois; prazo do Pedro em dia útil
create or replace function public.tg_lead_status() returns trigger language plpgsql security definer set search_path = public as $$
declare v_por text := coalesce(public.meu_nome(), 'sistema');
begin
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    new.mudanca_status := now();
    insert into interacoes (conta_id, lead_id, prospeccao_id, tipo, evento, de, para, por)
    values (new.conta_id, new.id, new.prospeccao_id, 'status', 'Status do lead', old.status, new.status, v_por);
    if new.status = 'Qualificado' and coalesce(new.responsavel, '') <> 'Pedro' then
      new.responsavel := 'Pedro';
      new.proxima_acao := 'Pedro: assumir a conversa e enviar condições (até 24h)';
      new.data_proxima_acao := public.crm_mais_uteis(public.hoje_br(), 1);
    end if;
  elsif tg_op = 'INSERT' then
    new.mudanca_status := coalesce(new.mudanca_status, now());
  end if;
  return new;
end $$;

-- #7/#11 prospecção "8. Qualificado → Pedro" passa o lead aberto para o Pedro em qualquer etapa; etiqueta de rota recalculada
create or replace function public.tg_prosp_status() returns trigger language plpgsql security definer set search_path = public as $$
declare v_lead uuid; v_por text := coalesce(public.meu_nome(), 'sistema'); v_hoje date := public.hoje_br(); v_resp text;
begin
  if tg_op = 'INSERT' then
    insert into interacoes (conta_id, prospeccao_id, tipo, evento, para, por)
    values (new.conta_id, new.id, 'status', 'Prospecção criada', new.status, v_por);
  elsif new.status is distinct from old.status then
    insert into interacoes (conta_id, prospeccao_id, tipo, evento, de, para, por)
    values (new.conta_id, new.id, 'status', 'Status da prospecção', old.status, new.status, v_por);
  else
    return new;
  end if;

  if new.status in ('3. Respondeu', '8. Qualificado → Pedro') then
    select id into v_lead from leads
     where conta_id = new.conta_id and status not in ('Perdido', 'Descartado', 'Pedido fechado')
     order by (prospeccao_id = new.id) desc nulls last, criado_em desc limit 1;
    if v_lead is null then
      v_resp := case when new.status = '8. Qualificado → Pedro' then 'Pedro' else coalesce(nullif(new.sdr, ''), public.meu_nome()) end;
      insert into leads (conta_id, prospeccao_id, contato_nome, status, responsavel, origem, proxima_acao, data_proxima_acao, temperatura, criado_por)
      values (new.conta_id, new.id, new.decisor,
              case when new.status = '8. Qualificado → Pedro' then 'Qualificado' else 'Em contato' end,
              v_resp, 'Prospecção ativa',
              case when new.status = '8. Qualificado → Pedro' then 'Pedro: assumir a conversa e enviar condições (até 24h)' else 'Qualificar: decisor, marcas, público, época de compra e CNPJ' end,
              public.crm_mais_uteis(v_hoje, 1), 'Morno', (auth.jwt() ->> 'email'))
      returning id into v_lead;
      insert into interacoes (conta_id, lead_id, prospeccao_id, tipo, evento, por)
      values (new.conta_id, v_lead, new.id, 'sistema', 'Lead criado a partir da prospecção ' || new.codigo, v_por);
      if coalesce(new.sdr, '') = '' and public.meu_papel() = 'sdr' then
        update prospeccoes set sdr = public.meu_nome() where id = new.id;
      end if;
    elsif new.status = '8. Qualificado → Pedro' then
      update leads set responsavel = 'Pedro',
             status = case when status in ('Novo', 'Em contato', 'Nutrição') then 'Qualificado' else status end,
             prospeccao_id = coalesce(prospeccao_id, new.id),
             proxima_acao = 'Pedro: assumir a conversa e enviar condições (até 24h)', data_proxima_acao = public.crm_mais_uteis(v_hoje, 1)
       where id = v_lead and coalesce(responsavel, '') <> 'Pedro';
      update leads set prospeccao_id = coalesce(prospeccao_id, new.id) where id = v_lead and prospeccao_id is null;
    else
      update leads set prospeccao_id = coalesce(prospeccao_id, new.id) where id = v_lead and prospeccao_id is null;
    end if;
  end if;
  perform public.crm_rota_conta_recalc(new.conta_id);
  return new;
end $$;

-- #7/#9/#10 depois do lead: recompra entra no mesmo cliente do pós-venda; crédito do SDR só para a prospecção que ele levou a 3 ou 8
create or replace function public.tg_lead_depois() returns trigger language plpgsql security definer set search_path = public as $$
declare c contas; v_hoje date := hoje_br(); p prospeccoes; v_pv uuid; v_fechou boolean;
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status and new.responsavel is not distinct from old.responsavel then return new; end if;
  v_fechou := new.status = 'Pedido fechado' and (tg_op = 'INSERT' or old.status is distinct from new.status);
  if v_fechou then
    select * into c from contas where id = new.conta_id;
    select id into v_pv from pos_venda where conta_id = new.conta_id order by criado_em limit 1;
    if v_pv is not null then
      update pos_venda set lead_id = new.id, status = 'Ativo',
             ultimo_pedido = coalesce(new.ultimo_pedido_erp, v_hoje),
             n_pedidos = coalesce(n_pedidos, 0) + 1,
             total = coalesce(total, 0) + coalesce(new.valor_primeiro_pedido, 0),
             proximo_fu = v_hoje + 7, tipo_fu = 'Confirmar recebimento'
       where id = v_pv;
    else
      insert into pos_venda (codigo, lead_id, conta_id, vendedor, cliente, contato, whatsapp, cidade_uf, status, proximo_fu, tipo_fu,
                             n_pedidos, primeiro_pedido, ultimo_pedido, total, vendedor_erp)
      values (new.codigo, new.id, new.conta_id, coalesce(nullif(new.responsavel, ''), 'Pedro'), c.nome, new.contato_nome, c.whatsapp,
              concat_ws(' / ', nullif(c.cidade, ''), nullif(c.uf, '')), 'Onboarding', v_hoje + 7, 'Confirmar recebimento',
              coalesce(new.pedidos_erp, case when new.valor_primeiro_pedido > 0 then 1 end),
              coalesce(new.ultimo_pedido_erp, v_hoje), coalesce(new.ultimo_pedido_erp, v_hoje),
              coalesce(new.total_comprado_erp, new.valor_primeiro_pedido), new.vendedor_erp)
      on conflict (codigo) do nothing;
    end if;
  end if;
  select * into p from prospeccoes where id = new.prospeccao_id;
  if not found then select * into p from prospeccoes where conta_id = new.conta_id order by criado_em desc limit 1; end if;
  if p.id is not null then
    if p.status in ('3. Respondeu', '8. Qualificado → Pedro') then
      if v_fechou then
        update prospeccoes set status = '9. Virou cliente', proximo_toque = null, proximo_passo = 'Cliente' where id = p.id;
      elsif new.status in ('Qualificado', 'Catálogo enviado', 'Negociação') and coalesce(new.responsavel, '') = 'Pedro' and p.status = '3. Respondeu' then
        update prospeccoes set status = '8. Qualificado → Pedro', proximo_toque = null, proximo_passo = 'Com o Pedro' where id = p.id;
      end if;
    elsif p.status in ('1. A abordar', '2. Contatado', '4. Sem retorno (pausa 60d)', '7. Já é lead') then
      -- lead que nasceu fora da prospecção (site, indicação, painel): a loja sai da cadência e, se comprar, vira "já é cliente"
      if v_fechou then
        update prospeccoes set status = '0. Já é cliente', proximo_toque = null, proximo_passo = 'Cliente' where id = p.id;
      elsif tg_op = 'INSERT' and new.status not in ('Perdido', 'Descartado', 'Pedido fechado') and p.status <> '7. Já é lead' then
        update prospeccoes set status = '7. Já é lead', proximo_toque = null,
               proximo_passo = 'Com ' || coalesce(nullif(new.responsavel, ''), 'Pedro') where id = p.id;
      end if;
    end if;
  end if;
  perform crm_rota_conta_recalc(new.conta_id);
  return new;
end $$;
drop trigger if exists t_lead_depois on public.leads;
create trigger t_lead_depois after insert or update of status, responsavel on public.leads for each row execute function public.tg_lead_depois();
