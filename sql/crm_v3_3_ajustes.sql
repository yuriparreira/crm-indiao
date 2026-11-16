-- CRM v3.3 · segunda rodada da verificação independente (16/11/2026)

-- roteiro: só "cancelado" solta as visitas pendentes (concluir mantém as paradas para lançar o resultado)
create or replace function public.tg_roteiro_status() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'cancelado' and new.status is distinct from old.status then
    update visitas set roteiro_id = null, ordem = null where roteiro_id = new.id and situacao in ('a agendar', 'agendada', 'reagendar');
  end if;
  return new;
end $$;

-- "A planejar": loja ativa em SP ou numa cidade da lista de outros estados; UF vazia casa só pela cidade
insert into public.cidades_planejar (k, uf) values ('londrina','PR'),('fazenda rio grande','PR'),('bandeirantes','PR'),('pocos de caldas','MG'),('jacutinga','MG'),('volta redonda','RJ'),('resende','RJ')
on conflict do nothing;
create or replace function public.crm_rota_alvo(p_conta uuid, p_cidade text, p_uf text, p_planejar text) returns text
language sql stable security definer set search_path = public as $$
  select case when crm_chave_cidade(p_cidade) = 'jaguariuna' then null
    else coalesce(crm_rota_membro(p_conta, p_cidade, p_uf),
      case when p_planejar = 'nao' then null
           when p_planejar = 'sim' then 'A planejar'
           when crm_chave_cidade(p_cidade) is not null
                and (upper(coalesce(p_uf, '')) = 'SP'
                     or exists (select 1 from cidades_planejar r where r.k = crm_chave_cidade(p_cidade)
                                  and (r.uf = upper(coalesce(p_uf, '')) or coalesce(p_uf, '') = '')))
                and crm_conta_ativa(p_conta) then 'A planejar' end) end $$;
-- as marcações 'sim' vieram da carga (ninguém escolheu na ficha): voltam para a regra automática
update public.contas set planejar = null where planejar = 'sim';
select public.crm_rotas_recalcular();

-- "A planejar" não pode ser renomeada nem desativada
create or replace function public.tg_rota_proteger() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.codigo = 'A planejar' and (new.codigo is distinct from old.codigo or new.ativa is distinct from old.ativa) then
    raise exception 'A etiqueta "A planejar" não pode ser renomeada nem desativada.';
  end if;
  return new;
end $$;
drop trigger if exists t_rota_proteger on public.rotas;
create trigger t_rota_proteger before update on public.rotas for each row execute function public.tg_rota_proteger();

-- loja que passa a ser de Jaguariúna sai das rotas e tem as visitas pendentes canceladas
create or replace function public.tg_conta_jaguariuna() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if crm_chave_cidade(new.cidade) = 'jaguariuna' and crm_chave_cidade(old.cidade) is distinct from 'jaguariuna' then
    delete from rota_paradas where conta_id = new.id;
    update visitas set situacao = 'cancelada', roteiro_id = null, ordem = null,
           observacoes = concat_ws(' · ', nullif(observacoes, ''), 'Cancelada: Jaguariúna não recebe visita (exclusividade com a Western)')
     where conta_id = new.id and situacao in ('a agendar', 'agendada', 'reagendar');
    insert into interacoes (conta_id, tipo, evento) values (new.id, 'sistema', 'Loja passou para Jaguariúna: saiu das rotas e as visitas pendentes foram canceladas');
  end if;
  return new;
end $$;
drop trigger if exists t_conta_jaguariuna on public.contas;
create trigger t_conta_jaguariuna after update of cidade on public.contas for each row execute function public.tg_conta_jaguariuna();
drop trigger if exists t_visita_jaguariuna on public.visitas;
create trigger t_visita_jaguariuna before insert or update of conta_id, roteiro_id on public.visitas for each row execute function public.tg_visita_jaguariuna();

-- visitas: o SDR lê e pede visita só das lojas dele; não pendura visita em roteiro
alter policy vis_ler on public.visitas using (
  public.meu_papel() in ('gestor', 'vendas') or agendado_por = public.meu_nome()
  or exists (select 1 from public.prospeccoes p where p.conta_id = visitas.conta_id and (p.sdr = public.meu_nome() or coalesce(p.sdr, '') = ''))
  or exists (select 1 from public.leads l where l.conta_id = visitas.conta_id and l.responsavel = public.meu_nome()));
alter policy vis_criar on public.visitas with check (
  public.meu_papel() in ('gestor', 'vendas')
  or (roteiro_id is null and agendado_por = public.meu_nome()
      and (exists (select 1 from public.prospeccoes p where p.conta_id = visitas.conta_id and (p.sdr = public.meu_nome() or coalesce(p.sdr, '') = ''))
           or exists (select 1 from public.leads l where l.conta_id = visitas.conta_id and l.responsavel = public.meu_nome()))));

-- recompra: soma só quando é outro lead fechando; o mesmo lead fechado de novo só atualiza a data
-- passagem pelo lead: a prospecção só vai a "8" com decisor e CNPJ; senão fica anotado o que falta
create or replace function public.tg_lead_depois() returns trigger language plpgsql security definer set search_path = public as $$
declare c contas; v_hoje date := hoje_br(); p prospeccoes; v_pv pos_venda; v_fechou boolean;
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status and new.responsavel is not distinct from old.responsavel then return new; end if;
  v_fechou := new.status = 'Pedido fechado' and (tg_op = 'INSERT' or old.status is distinct from new.status);
  if v_fechou then
    select * into c from contas where id = new.conta_id;
    select * into v_pv from pos_venda where conta_id = new.conta_id order by criado_em limit 1;
    if v_pv.id is not null and v_pv.lead_id is not distinct from new.id then
      update pos_venda set ultimo_pedido = coalesce(new.ultimo_pedido_erp, v_hoje), status = case when status in ('Encerrado', 'Inativo') then 'Ativo' else status end
       where id = v_pv.id;
    elsif v_pv.id is not null then
      update pos_venda set lead_id = new.id, status = 'Ativo',
             ultimo_pedido = coalesce(new.ultimo_pedido_erp, v_hoje),
             n_pedidos = coalesce(n_pedidos, 0) + 1,
             total = coalesce(total, 0) + coalesce(new.valor_primeiro_pedido, 0),
             proximo_fu = v_hoje + 7, tipo_fu = 'Confirmar recebimento'
       where id = v_pv.id;
      insert into interacoes (conta_id, lead_id, pos_venda_id, tipo, evento, texto)
      values (new.conta_id, new.id, v_pv.id, 'sistema', 'Recompra pelo lead ' || new.codigo, 'Fechado por ' || coalesce(nullif(new.responsavel, ''), '?') || '; o cliente segue na carteira de ' || v_pv.vendedor || '.');
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
        if coalesce(p.decisor, '') <> '' and exists (select 1 from contas where id = p.conta_id and coalesce(cnpj, '') <> '') then
          update prospeccoes set status = '8. Qualificado → Pedro', proximo_toque = null, proximo_passo = 'Com o Pedro' where id = p.id;
        else
          insert into interacoes (conta_id, lead_id, prospeccao_id, tipo, evento, texto)
          values (p.conta_id, new.id, p.id, 'sistema', 'Lead com o Pedro, mas a prospecção ' || p.codigo || ' não foi a "8"',
                  'Falta preencher ' || concat_ws(' e ', case when coalesce(p.decisor, '') = '' then 'Decisor' end,
                                                  case when not exists (select 1 from contas where id = p.conta_id and coalesce(cnpj, '') <> '') then 'CNPJ' end) || ' na prospecção.');
        end if;
      end if;
    elsif p.status in ('1. A abordar', '2. Contatado', '4. Sem retorno (pausa 60d)', '7. Já é lead') then
      if v_fechou then
        update prospeccoes set status = '0. Já é cliente', proximo_toque = null, proximo_passo = 'Cliente' where id = p.id;
      elsif new.status not in ('Perdido', 'Descartado', 'Pedido fechado') and p.status <> '7. Já é lead'
            and (tg_op = 'INSERT' or old.status in ('Perdido', 'Descartado')) then
        update prospeccoes set status = '7. Já é lead', proximo_toque = null,
               proximo_passo = 'Com ' || coalesce(nullif(new.responsavel, ''), 'Pedro') where id = p.id;
      end if;
    end if;
  end if;
  perform crm_rota_conta_recalc(new.conta_id);
  return new;
end $$;

-- prospecção em "8": só mexe no lead da própria prospecção, do SDR dela ou sem dono; nos outros casos anota
create or replace function public.tg_prosp_status() returns trigger language plpgsql security definer set search_path = public as $$
declare v_lead leads; v_novo uuid; v_por text := coalesce(public.meu_nome(), 'sistema'); v_hoje date := public.hoje_br(); v_resp text;
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
    select * into v_lead from leads
     where conta_id = new.conta_id and status not in ('Perdido', 'Descartado', 'Pedido fechado')
     order by (prospeccao_id = new.id) desc nulls last, criado_em desc limit 1;
    if v_lead.id is null then
      v_resp := case when new.status = '8. Qualificado → Pedro' then 'Pedro' else coalesce(nullif(new.sdr, ''), public.meu_nome()) end;
      insert into leads (conta_id, prospeccao_id, contato_nome, status, responsavel, origem, proxima_acao, data_proxima_acao, temperatura, criado_por)
      values (new.conta_id, new.id, new.decisor,
              case when new.status = '8. Qualificado → Pedro' then 'Qualificado' else 'Em contato' end,
              v_resp, 'Prospecção ativa',
              case when new.status = '8. Qualificado → Pedro' then 'Pedro: assumir a conversa e enviar condições (até 24h)' else 'Qualificar: decisor, marcas, público, época de compra e CNPJ' end,
              public.crm_mais_uteis(v_hoje, 1), 'Morno', (auth.jwt() ->> 'email'))
      returning id into v_novo;
      insert into interacoes (conta_id, lead_id, prospeccao_id, tipo, evento, por)
      values (new.conta_id, v_novo, new.id, 'sistema', 'Lead criado a partir da prospecção ' || new.codigo, v_por);
      if coalesce(new.sdr, '') = '' and public.meu_papel() = 'sdr' then
        update prospeccoes set sdr = public.meu_nome() where id = new.id;
      end if;
    elsif new.status = '8. Qualificado → Pedro' then
      if v_lead.prospeccao_id = new.id or coalesce(v_lead.responsavel, '') in ('', coalesce(new.sdr, '')) then
        update leads set responsavel = 'Pedro',
               status = case when status in ('Novo', 'Em contato', 'Nutrição') then 'Qualificado' else status end,
               prospeccao_id = coalesce(prospeccao_id, new.id),
               proxima_acao = 'Pedro: assumir a conversa e enviar condições (até 24h)', data_proxima_acao = public.crm_mais_uteis(v_hoje, 1)
         where id = v_lead.id and coalesce(responsavel, '') <> 'Pedro';
      else
        insert into interacoes (conta_id, lead_id, prospeccao_id, tipo, evento, texto, por)
        values (new.conta_id, v_lead.id, new.id, 'sistema', 'Prospecção ' || new.codigo || ' qualificada, mas o lead ' || v_lead.codigo || ' é de ' || coalesce(v_lead.responsavel, '?'),
                'O lead não foi passado para o Pedro automaticamente: combinar com ' || coalesce(v_lead.responsavel, '?') || '.', v_por);
      end if;
    else
      update leads set prospeccao_id = coalesce(prospeccao_id, new.id) where id = v_lead.id and prospeccao_id is null;
    end if;
  end if;
  perform public.crm_rota_conta_recalc(new.conta_id);
  return new;
end $$;

-- crm_rota_conta: só gestor e vendas mudam a rota; entrar numa rota limpa a escolha antiga de "fora das rotas"
do $$
declare d text;
begin
  d := pg_get_functiondef('public.crm_rota_conta(uuid,text,integer)'::regprocedure);
  d := replace(d, $x$  if v_papel not in ('gestor', 'vendas') and not exists (
       select 1 from prospeccoes p where p.conta_id = p_conta and (p.sdr = v_me or coalesce(p.sdr, '') = '')) then
    raise exception 'Só o gestor, vendas ou o SDR da loja mudam a rota.';
  end if;$x$, $x$  if v_papel not in ('gestor', 'vendas') then
    raise exception 'Só o gestor e o Pedro mudam a rota. Peça a visita pela ficha.';
  end if;$x$);
  d := replace(d, $x$    if v_k = 'jaguariuna' then raise exception 'Jaguariúna não recebe visita (exclusividade com a Western).'; end if;
    if not exists (select 1 from rotas where codigo = p_rota and ativa) then raise exception 'Rota % não existe.', p_rota; end if;$x$,
    $x$    if v_k = 'jaguariuna' then raise exception 'Jaguariúna não recebe visita (exclusividade com a Western).'; end if;
    if not exists (select 1 from rotas where codigo = p_rota and ativa) then raise exception 'Rota % não existe.', p_rota; end if;
    update contas set planejar = null where id = p_conta and planejar = 'nao';$x$);
  d := replace(d, $x$  if coalesce(p_rota, '') = '' or p_rota = 'A planejar' then
    delete from rota_paradas where conta_id = p_conta;$x$, $x$  if p_rota = 'A planejar' and v_k = 'jaguariuna' then raise exception 'Jaguariúna não recebe visita (exclusividade com a Western).'; end if;
  if coalesce(p_rota, '') = '' or p_rota = 'A planejar' then
    delete from rota_paradas where conta_id = p_conta;$x$);
  d := replace(d, $x$select p.lat, p.lng into v_lat, v_lng from rota_paradas p where p.conta_id is null and p.lat is not null and crm_chave_cidade(p.cidade) = v_k limit 1;$x$,
    $x$select p.lat, p.lng into v_lat, v_lng from rota_paradas p where p.conta_id is null and p.lat is not null and crm_chave_cidade(p.cidade) = v_k
           and (coalesce(p.uf, '') = '' or coalesce(c.uf, '') = '' or upper(p.uf) = upper(c.uf)) limit 1;$x$);
  if d not like '%Só o gestor e o Pedro mudam a rota%' or d not like '%planejar = null where id = p_conta and planejar = ''nao''%' or d not like '%p_rota = ''A planejar'' and v_k = ''jaguariuna''%' then
    raise exception 'crm_rota_conta: trecho não encontrado';
  end if;
  execute d;

  -- crm_update_prosp: lead de outro dono volta só com código e responsável (a tela tira da lista), e o SDR é avisado
  d := pg_get_functiondef('public.crm_update_prosp(text,jsonb)'::regprocedure);
  d := replace(d, $x$'lead', case when v_lead.id is not null and (crm_pode(v_lead.responsavel, v_me, v_admin) or v_lead.prospeccao_id = p.id) then crm_lead_obj(v_lead.id) end,$x$,
    $x$'lead', case when v_lead.id is null then null when crm_pode(v_lead.responsavel, v_me, v_admin) then crm_lead_obj(v_lead.id)
                    else jsonb_build_object('id', v_lead.codigo, 'resp', coalesce(v_lead.responsavel, ''), 'status', v_lead.status, 'tipo', crm_tipo_status(v_lead.status)) end,$x$);
  d := replace(d, $x$                'O lead ' || v_lead.codigo || ' continua com ' || coalesce(nullif(v_lead.responsavel, ''), 'ninguém') || ' e não foi alterado.');
      end if;$x$, $x$                'O lead ' || v_lead.codigo || ' continua com ' || coalesce(nullif(v_lead.responsavel, ''), 'ninguém') || ' e não foi alterado.');
        v_aviso := 'foi marcada, mas o lead ' || v_lead.codigo || ' é de ' || coalesce(nullif(v_lead.responsavel, ''), 'ninguém') || ' e não foi alterado';
      end if;$x$);
  if d not like '%jsonb_build_object(''id'', v_lead.codigo, ''resp''%' or d not like '%e não foi alterado'';%' then raise exception 'crm_update_prosp: trecho não encontrado'; end if;
  execute d;

  -- crm_add_lead: com lead aberto na loja, "salvar mesmo assim" recusa (não cria loja duplicada)
  d := pg_get_functiondef('public.crm_add_lead(jsonb)'::regprocedure);
  d := replace(d, $x$  if v_conta is not null and coalesce((f->>'forcar')::boolean, false)
     and exists (select 1 from leads where conta_id = v_conta and status not in ('Pedido fechado', 'Perdido', 'Descartado')) then
    v_conta := null;
  end if;$x$, $x$  if v_conta is not null and coalesce((f->>'forcar')::boolean, false) then
    select * into v_dup from leads where conta_id = v_conta and status not in ('Pedido fechado', 'Perdido', 'Descartado') order by criado_em desc limit 1;
    if v_dup.id is not null then
      raise exception 'Essa loja já tem o lead % aberto com %. Peça para essa pessoa (ou o gestor) seguir com ele.', v_dup.codigo, coalesce(nullif(v_dup.responsavel, ''), 'ninguém');
    end if;
  end if;$x$);
  if d not like '%já tem o lead % aberto com%' then raise exception 'crm_add_lead: trecho não encontrado'; end if;
  execute d;

  -- crm_add_prosp: loja que já é cliente entra como "0. Já é cliente" mesmo com "salvar mesmo assim"
  d := pg_get_functiondef('public.crm_add_prosp(jsonb)'::regprocedure);
  d := replace(d, $x$  values (v_conta, '1. A abordar', v_sdr,$x$, $x$  values (v_conta, case when v_pv.id is not null then '0. Já é cliente' else '1. A abordar' end, v_sdr,$x$);
  if d not like '%case when v_pv.id is not null then ''0. Já é cliente''%' then raise exception 'crm_add_prosp: trecho não encontrado'; end if;
  execute d;
end $$;
revoke all on function public.tg_rota_proteger() from public, anon, authenticated;
revoke all on function public.tg_conta_jaguariuna() from public, anon, authenticated;
