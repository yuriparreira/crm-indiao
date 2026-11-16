-- CRM v3.2 · correções da revisão independente de 16/11/2026 + decisões de rota do Yuri
-- (parte 1: permissões, etiqueta "A planejar", Jaguariúna e regra de 3 cidades)

-- #1/#13 só gestor e vendas leem rotas, roteiros, despesas e comprovantes; o SDR só edita a visita que ele pediu
create or replace function public.crm_rota_lojas(p_rota text) returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if coalesce(meu_papel(), '') not in ('gestor', 'vendas') then raise exception 'Acesso não liberado.'; end if;
  return coalesce((
    with par as (
      select p.*, crm_chave_cidade(p.cidade) as k from rota_paradas p where p.rota = p_rota),
    m as (
      select c.id as conta, p.dia, p.ordem as pordem, p.sugerida, 'cidade' as via
        from contas c join par p on p.conta_id is null and p.k = crm_chave_cidade(c.cidade)
         and (coalesce(p.uf, '') = '' or coalesce(c.uf, '') = '' or upper(p.uf) = upper(c.uf))
      union all
      select p.conta_id, p.dia, p.ordem, p.sugerida, 'avulsa' from par p where p.conta_id is not null
      union all
      select c.id, null, null, false, 'etiqueta' from contas c where p_rota = 'A planejar' and c.rota = 'A planejar'),
    u as (select distinct on (conta) * from m order by conta, sugerida, dia nulls last, pordem)
    select jsonb_agg(jsonb_build_object(
      'id', c.id, 'nome', c.nome, 'cidade', coalesce(c.cidade, ''), 'uf', coalesce(c.uf, ''), 'endereco', coalesce(c.endereco, ''),
      'whatsapp', coalesce(c.whatsapp, ''), 'telefone', coalesce(c.telefone, ''), 'lat', c.lat, 'lng', c.lng,
      'rota', coalesce(c.rota, ''), 'rota_anterior', coalesce(c.rota_anterior, ''),
      'dia', u.dia, 'pordem', u.pordem, 'sugerida', u.sugerida, 'via', u.via,
      'prosp', (select jsonb_build_object('codigo', p.codigo, 'status', p.status, 'sdr', coalesce(p.sdr, '')) from prospeccoes p where p.conta_id = c.id order by p.criado_em desc limit 1),
      'lead', (select jsonb_build_object('codigo', l.codigo, 'status', l.status, 'resp', coalesce(l.responsavel, ''), 'tipo', crm_tipo_status(l.status))
                 from leads l where l.conta_id = c.id order by (l.status not in ('Perdido', 'Descartado')) desc, l.criado_em desc limit 1),
      'cliente', exists (select 1 from pos_venda v where v.conta_id = c.id))
      order by u.dia nulls last, u.pordem nulls last, c.uf, crm_chave_cidade(c.cidade), c.nome)
    from u join contas c on c.id = u.conta), '[]'::jsonb);
end $$;
alter policy rot_ler on public.roteiros using (public.meu_papel() in ('gestor', 'vendas'));
alter policy desp_ler on public.despesas_viagem using (public.meu_papel() in ('gestor', 'vendas'));
alter policy comprov_ler on storage.objects using (bucket_id = 'comprovantes' and public.meu_papel() in ('gestor', 'vendas'));
alter policy vis_editar on public.visitas
  using (public.meu_papel() in ('gestor', 'vendas') or (agendado_por = public.meu_nome() and roteiro_id is null))
  with check (public.meu_papel() in ('gestor', 'vendas') or (agendado_por = public.meu_nome() and roteiro_id is null));

-- #2 etiqueta "A planejar" vale para lojas novas também (cidades a até 500 km de Jaguariúna), com escolha manual na ficha
create table if not exists public.cidades_planejar (k text not null, uf text not null, primary key (k, uf));
alter table public.cidades_planejar enable row level security;
drop policy if exists cidades_planejar_ler on public.cidades_planejar;
create policy cidades_planejar_ler on public.cidades_planejar for select to authenticated using (public.meu_papel() is not null);
grant select on public.cidades_planejar to authenticated;
grant all on public.cidades_planejar to service_role;
insert into public.cidades_planejar (k, uf) values ('aguas de santa barbara','SP'),('altair','SP'),('alvares florence','SP'),('americana','SP'),('americo brasiliense','SP'),('americo de campos','SP'),('amparo','SP'),('analandia','SP'),('aracatuba','SP'),('araraquara','SP'),('araras','SP'),('artur nogueira','SP'),('auriflama','SP'),('avanhandava','SP'),('bady bassitt','SP'),('balsamo','SP'),('barbosa','SP'),('barretos','SP'),('batatais','SP'),('bauru','SP'),('bebedouro','SP'),('birigui','SP'),('boa esperanca do sul','SP'),('borborema','SP'),('botucatu','SP'),('brotas','SP'),('buritama','SP'),('cafelandia','SP'),('cajobi','SP'),('campinas','SP'),('campo florido','MG'),('cardoso','SP'),('catanduva','SP'),('catigua','SP'),('cedral','SP'),('colina','SP'),('comendador gomes','MG'),('conceicao das alagoas','MG'),('conchal','SP'),('conquista','MG'),('cordeiropolis','SP'),('cosmopolis','SP'),('cosmorama','SP'),('delta','MG'),('descalvado','SP'),('dourado','SP'),('echapora','SP'),('elisiario','SP'),('embauba','SP'),('engenheiro coelho','SP'),('esmeraldas','MG'),('estrela d''oeste','SP'),('fernandopolis','SP'),('floreal','SP'),('franca','SP'),('fronteira','MG'),('frutal','MG'),('gastao vidigal','SP'),('gaviao peixoto','SP'),('general salgado','SP'),('getulina','SP'),('guaicara','SP'),('guaira','SP'),('guapiacu','SP'),('holambra','SP'),('ibate','SP'),('ibira','SP'),('ibitinga','SP'),('ibitiuva','SP'),('icem','SP'),('indaiatuba','SP'),('ipeuna','SP'),('ipigua','SP'),('iracemapolis','SP'),('irapua','SP'),('itajobi','SP'),('itapagipe','MG'),('itapecerica da serra','SP'),('itapeva','SP'),('itapira','SP'),('itapolis','SP'),('iturama','MG'),('jaboticabal','SP'),('jales','SP'),('jose bonifacio','SP'),('lavras','MG'),('leme','SP'),('limeira','SP'),('lins','SP'),('lourdes','SP'),('macaubal','SP'),('machado','MG'),('magda','SP'),('matao','SP'),('mendonca','SP'),('meridiano','SP'),('mirassol','SP'),('mirassolandia','SP'),('mogi guacu','SP'),('mogi mirim','SP'),('moncoes','SP'),('monte alto','SP'),('monte aprazivel','SP'),('monte azul paulista','SP'),('neves paulista','SP'),('nhandeara','SP'),('nipoa','SP'),('nova alianca','SP'),('nova europa','SP'),('nova granada','SP'),('novo horizonte','SP'),('olimpia','SP'),('onda verde','SP'),('orindiuva','SP'),('orlandia','SP'),('palestina','SP'),('palmares paulista','SP'),('palmeira d''oeste','SP'),('paraguacu paulista','SP'),('paraiso','SP'),('paraisopolis','MG'),('paranapanema','SP'),('parisi','SP'),('paulo de faria','SP'),('pedregulho','SP'),('pedreira','SP'),('penapolis','SP'),('pilar do sul','SP'),('pindorama','SP'),('piracicaba','SP'),('pirajuba','MG'),('pirajui','SP'),('pirassununga','SP'),('pitangueiras','SP'),('planalto','SP'),('planura','MG'),('poloni','SP'),('pontes gestal','SP'),('porto ferreira','SP'),('potirendaba','SP'),('pouso alegre','MG'),('presidente prudente','SP'),('promissao','SP'),('reginopolis','SP'),('ribeirao bonito','SP'),('ribeirao preto','SP'),('rio claro','SP'),('rio das pedras','SP'),('riolandia','SP'),('sabino','SP'),('sales','SP'),('santa adelia','SP'),('santa barbara d''oeste','SP'),('santa rita do passa quatro','SP'),('sao carlos','SP'),('sao francisco de sales','MG'),('sao jose do rio preto','SP'),('sao sebastiao do paraiso','MG'),('sebastianopolis do sul','SP'),('sertaozinho','SP'),('severinia','SP'),('tabapua','SP'),('tabatinga','SP'),('tanabi','SP'),('taquaritinga','SP'),('terra roxa','SP'),('tres fronteiras','SP'),('turiuba','SP'),('turmalina','SP'),('ubarana','SP'),('uberaba','MG'),('uberlandia','MG'),('uchoa','SP'),('uniao paulista','SP'),('urupes','SP'),('valentim gentil','SP'),('viradouro','SP'),('votuporanga','SP'),('zacarias','SP')
on conflict do nothing;
alter table public.contas add column if not exists planejar text;
alter table public.contas drop constraint if exists contas_planejar_chk;
alter table public.contas add constraint contas_planejar_chk check (planejar is null or planejar in ('sim', 'nao'));

create or replace function public.crm_conta_ativa(p_conta uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from prospeccoes p where p.conta_id = p_conta and p.status not in ('5. Sem interesse', '6. Fora do ICP'))
      or exists (select 1 from leads l where l.conta_id = p_conta and l.status not in ('Perdido', 'Descartado'))
      or exists (select 1 from pos_venda v where v.conta_id = p_conta) $$;
-- etiqueta da loja: a rota em que entra; senão "A planejar" (escolha manual, ou loja ativa numa cidade a até 500 km); Jaguariúna nunca
create or replace function public.crm_rota_alvo(p_conta uuid, p_cidade text, p_uf text, p_planejar text) returns text
language sql stable security definer set search_path = public as $$
  select case when crm_chave_cidade(p_cidade) = 'jaguariuna' then null
    else coalesce(crm_rota_membro(p_conta, p_cidade, p_uf),
      case when p_planejar = 'nao' then null
           when p_planejar = 'sim' then 'A planejar'
           when exists (select 1 from cidades_planejar r where r.k = crm_chave_cidade(p_cidade) and r.uf = upper(coalesce(p_uf, '')))
                and crm_conta_ativa(p_conta) then 'A planejar' end) end $$;
create or replace function public.crm_rotas_recalcular() returns integer language plpgsql security definer set search_path = public as $$
declare n int;
begin
  with novo as (select c.id, crm_rota_alvo(c.id, c.cidade, c.uf, c.planejar) as r from contas c)
  update contas c set rota = novo.r from novo where novo.id = c.id and c.rota is distinct from novo.r;
  get diagnostics n = row_count;
  return n;
end $$;
create or replace function public.crm_rota_conta_recalc(p_conta uuid) returns void language sql security definer set search_path = public as $$
  update contas c set rota = crm_rota_alvo(c.id, c.cidade, c.uf, c.planejar)
   where c.id = p_conta and c.rota is distinct from crm_rota_alvo(c.id, c.cidade, c.uf, c.planejar) $$;
create or replace function public.tg_conta_rota() returns trigger language plpgsql security definer set search_path = public as $$
begin new.rota := crm_rota_alvo(new.id, new.cidade, new.uf, new.planejar); return new; end $$;
drop trigger if exists t_conta_rota on public.contas;
create trigger t_conta_rota before insert or update of cidade, uf, planejar on public.contas for each row execute function public.tg_conta_rota();

-- #3 apagar ou desativar rota: as lojas vão para a etiqueta certa; "A planejar" não pode ser apagada
create or replace function public.tg_rota_apagar() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.codigo = 'A planejar' then raise exception 'A etiqueta "A planejar" não pode ser apagada.'; end if;
  delete from rota_paradas where rota = old.codigo;
  return old;
end $$;
drop trigger if exists t_rota_apagar on public.rotas;
create trigger t_rota_apagar before delete on public.rotas for each row execute function public.tg_rota_apagar();
create or replace function public.tg_rota_ativa() returns trigger language plpgsql security definer set search_path = public as $$
begin perform crm_rotas_recalcular(); return null; end $$;
drop trigger if exists t_rota_ativa on public.rotas;
create trigger t_rota_ativa after update of ativa on public.rotas for each statement execute function public.tg_rota_ativa();

-- #4/#5/#17 Jaguariúna bloqueada; loja avulsa sem cidade recusada; trava contra inclusões simultâneas no mesmo dia
create or replace function public.tg_parada_capacidade() returns trigger language plpgsql security definer set search_path = public as $$
declare v_chave text; n int;
begin
  v_chave := coalesce(crm_chave_cidade(new.cidade), (select crm_chave_cidade(cidade) from contas where id = new.conta_id));
  if v_chave = 'jaguariuna' then raise exception 'Jaguariúna não recebe visita (exclusividade com a Western).'; end if;
  if v_chave is null then raise exception 'Cadastre a cidade da loja antes de incluí-la na rota.'; end if;
  if new.sugerida then return new; end if;
  perform pg_advisory_xact_lock(hashtext('rota:' || new.rota || ':' || new.dia));
  select count(distinct k) into n from (
    select coalesce(crm_chave_cidade(p.cidade), crm_chave_cidade(c.cidade), 'conta:' || p.conta_id::text) as k
      from rota_paradas p left join contas c on c.id = p.conta_id
     where p.rota = new.rota and p.dia = new.dia and not p.sugerida and p.id <> new.id
    union select v_chave) s;
  if n > 3 then
    raise exception 'O dia % da % já tem 3 cidades. Coloque em outro dia (regra: no máximo 3 cidades por dia).', new.dia, new.rota;
  end if;
  return new;
end $$;
create or replace function public.tg_visita_jaguariuna() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from contas where id = new.conta_id and crm_chave_cidade(cidade) = 'jaguariuna') then
    raise exception 'Jaguariúna não recebe visita (exclusividade com a Western).';
  end if;
  return new;
end $$;
drop trigger if exists t_visita_jaguariuna on public.visitas;
create trigger t_visita_jaguariuna before insert or update of conta_id on public.visitas for each row execute function public.tg_visita_jaguariuna();

-- #2/#4/#20 incluir ou tirar loja da rota pela ficha: "fora das rotas" e "A planejar" ficam gravados; parada avulsa com coordenada
create or replace function public.crm_rota_conta(p_conta uuid, p_rota text, p_dia int default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_papel text := meu_papel(); v_me text := meu_nome(); c contas; v_dia int; v_k text; v_msg text := ''; v_membro text;
  v_lat double precision; v_lng double precision;
begin
  if v_papel is null then raise exception 'Acesso não liberado.'; end if;
  select * into c from contas where id = p_conta;
  if not found then raise exception 'Loja não encontrada.'; end if;
  if v_papel not in ('gestor', 'vendas') and not exists (
       select 1 from prospeccoes p where p.conta_id = p_conta and (p.sdr = v_me or coalesce(p.sdr, '') = '')) then
    raise exception 'Só o gestor, vendas ou o SDR da loja mudam a rota.';
  end if;
  v_k := crm_chave_cidade(c.cidade);
  if coalesce(p_rota, '') = '' or p_rota = 'A planejar' then
    delete from rota_paradas where conta_id = p_conta;
    update contas set planejar = case when coalesce(p_rota, '') = '' then 'nao' else 'sim' end where id = p_conta;
    v_membro := crm_rota_membro(p_conta, c.cidade, c.uf);
    if v_membro is not null then
      v_msg := 'A cidade ' || coalesce(c.cidade, '') || ' está na ' || v_membro || ': a loja continua nessa rota.';
    end if;
  else
    if v_k = 'jaguariuna' then raise exception 'Jaguariúna não recebe visita (exclusividade com a Western).'; end if;
    if not exists (select 1 from rotas where codigo = p_rota and ativa) then raise exception 'Rota % não existe.', p_rota; end if;
    if exists (select 1 from rota_paradas p where p.rota = p_rota and p.conta_id is null and not p.sugerida and crm_chave_cidade(p.cidade) = v_k
                  and (coalesce(p.uf, '') = '' or coalesce(c.uf, '') = '' or upper(p.uf) = upper(c.uf))) then
      v_msg := 'A cidade ' || c.cidade || ' já está na ' || p_rota || ': a loja já entra nessa rota.';
    elsif not exists (select 1 from rota_paradas where rota = p_rota and conta_id = p_conta) then
      v_dia := p_dia;
      if v_dia is null then
        select d into v_dia from (
          select p.dia as d, count(distinct coalesce(crm_chave_cidade(p.cidade), crm_chave_cidade(cc.cidade))) as n
            from rota_paradas p left join contas cc on cc.id = p.conta_id
           where p.rota = p_rota and not p.sugerida group by p.dia) s
         where n < 3 order by d limit 1;
        if v_dia is null then select coalesce(max(dia), 0) + 1 into v_dia from rota_paradas where rota = p_rota; end if;
      end if;
      -- coordenada: a da loja ou a da cidade (de qualquer parada dessa cidade), para estimar os km do dia
      v_lat := c.lat; v_lng := c.lng;
      if v_lat is null then
        select p.lat, p.lng into v_lat, v_lng from rota_paradas p where p.conta_id is null and p.lat is not null and crm_chave_cidade(p.cidade) = v_k limit 1;
      end if;
      insert into rota_paradas (rota, dia, ordem, conta_id, lat, lng, criado_por)
      values (p_rota, v_dia, (select coalesce(max(ordem), 0) + 1 from rota_paradas where rota = p_rota and dia = v_dia), p_conta, v_lat, v_lng, auth.jwt() ->> 'email');
      v_msg := c.nome || ' incluída na ' || p_rota || ' (dia ' || v_dia || ').';
    end if;
  end if;
  return jsonb_build_object('rota', (select coalesce(rota, '') from contas where id = p_conta), 'msg', v_msg,
    'rotas', coalesce((select jsonb_agg(distinct p.rota) from rota_paradas p where not p.sugerida and (p.conta_id = p_conta
        or (p.conta_id is null and crm_chave_cidade(p.cidade) = v_k and (coalesce(p.uf, '') = '' or coalesce(c.uf, '') = '' or upper(p.uf) = upper(c.uf))))), '[]'::jsonb));
end $$;

-- #16 roteiro gravado de uma vez (se a rede cair, tentar de novo não duplica); #19 roteiro cancelado ou concluído solta as visitas pendentes
create or replace function public.crm_salvar_roteiro(p_id uuid, p_rota text, p_nome text, p_ini date, p_fim date, p_km numeric, p_custo numeric, p_contas uuid[])
returns uuid language plpgsql security invoker set search_path = public as $$
declare v_ok int; v_c uuid; v_k bigint; v_vis uuid; v_email text := auth.jwt() ->> 'email'; v_me text := meu_nome();
begin
  if coalesce(meu_papel(), '') not in ('gestor', 'vendas') then raise exception 'Só o gestor e vendas montam roteiros.'; end if;
  insert into roteiros (id, nome, rota, data_inicio, data_fim, km_previsto, custo_previsto, criado_por)
  values (p_id, p_nome, p_rota, p_ini, p_fim, p_km, p_custo, v_email) on conflict (id) do nothing;
  get diagnostics v_ok = row_count;
  if v_ok = 0 then return p_id; end if;
  for v_c, v_k in select u.c, u.k from unnest(p_contas) with ordinality as u(c, k) loop
    v_vis := null;
    select id into v_vis from visitas where conta_id = v_c and roteiro_id is null and situacao in ('a agendar', 'agendada', 'reagendar')
     order by criado_em limit 1 for update;
    if v_vis is not null then update visitas set roteiro_id = p_id, ordem = v_k::int where id = v_vis;
    else insert into visitas (conta_id, roteiro_id, ordem, situacao, agendado_por, criado_por) values (v_c, p_id, v_k::int, 'a agendar', v_me, v_email);
    end if;
  end loop;
  return p_id;
end $$;
revoke all on function public.crm_salvar_roteiro(uuid, text, text, date, date, numeric, numeric, uuid[]) from public, anon;
grant execute on function public.crm_salvar_roteiro(uuid, text, text, date, date, numeric, numeric, uuid[]) to authenticated, service_role;
create or replace function public.tg_roteiro_status() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status in ('cancelado', 'concluído') and new.status is distinct from old.status then
    update visitas set roteiro_id = null, ordem = null where roteiro_id = new.id and situacao in ('a agendar', 'agendada', 'reagendar');
  end if;
  return new;
end $$;
drop trigger if exists t_roteiro_status on public.roteiros;
create trigger t_roteiro_status after update of status on public.roteiros for each row execute function public.tg_roteiro_status();

revoke all on function public.crm_conta_ativa(uuid) from public, anon, authenticated;
revoke all on function public.crm_rota_alvo(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.crm_rota_conta_recalc(uuid) from public, anon, authenticated;
revoke all on function public.tg_rota_apagar() from public, anon, authenticated;
revoke all on function public.tg_rota_ativa() from public, anon, authenticated;
revoke all on function public.tg_visita_jaguariuna() from public, anon, authenticated;
revoke all on function public.tg_roteiro_status() from public, anon, authenticated;

-- etiquetas já existentes fora da lista de 500 km (ex.: Londrina, PR) continuam "A planejar"
update public.contas c set planejar = 'sim'
 where c.rota = 'A planejar' and c.planejar is null
   and not exists (select 1 from public.cidades_planejar r where r.k = public.crm_chave_cidade(c.cidade) and r.uf = upper(coalesce(c.uf, '')));
