-- CRM v3.1: rotas de visita como dados (R1 e R1.1–R1.5 do Yuri, 16/11/2026)
-- Uma rota é uma sequência de cidades (e de lojas avulsas) organizada por dia, no máximo 3 cidades por dia.
-- A loja entra na rota pela cidade dela ou porque foi incluída avulsa. contas.rota guarda a etiqueta principal
-- (a primeira rota da loja, ou "A planejar" para as que tinham rota antiga e não entram nas novas).

create or replace function public.crm_chave_cidade(t text) returns text language sql immutable set search_path = '' as $$
  select nullif(lower(extensions.unaccent(btrim(regexp_replace(coalesce(t, ''), '\s*\(.*\)\s*$', '')))), '') $$;

create table if not exists public.rotas (
  codigo text primary key,
  nome text not null,
  ordem int not null default 100,
  partida text, partida_lat double precision, partida_lng double precision,
  chegada text, chegada_lat double precision, chegada_lng double precision,
  observacao text,
  ativa boolean not null default true,
  criado_em timestamptz not null default now()
);
create table if not exists public.rota_paradas (
  id uuid primary key default gen_random_uuid(),
  rota text not null references public.rotas(codigo) on update cascade on delete cascade,
  dia int not null default 1 check (dia between 1 and 30),
  ordem int not null default 100,
  cidade text, uf text, lat double precision, lng double precision,
  conta_id uuid references public.contas(id) on delete cascade,
  sugerida boolean not null default false,
  motivo text,
  criado_por text, criado_em timestamptz not null default now(),
  constraint rota_paradas_alvo_chk check (conta_id is not null or nullif(btrim(cidade), '') is not null)
);
create unique index if not exists rota_paradas_cidade_uq on public.rota_paradas (rota, public.crm_chave_cidade(cidade), coalesce(upper(uf), '')) where conta_id is null;
create unique index if not exists rota_paradas_conta_uq on public.rota_paradas (rota, conta_id) where conta_id is not null;
create index if not exists rota_paradas_rota_idx on public.rota_paradas (rota, dia, ordem);

alter table public.rotas enable row level security;
alter table public.rota_paradas enable row level security;
create policy rotas_ler on public.rotas for select to authenticated using (public.meu_papel() is not null);
create policy rotas_escrever on public.rotas for all to authenticated using (public.meu_papel() in ('gestor', 'vendas')) with check (public.meu_papel() in ('gestor', 'vendas'));
create policy paradas_ler on public.rota_paradas for select to authenticated using (public.meu_papel() is not null);
create policy paradas_escrever on public.rota_paradas for all to authenticated using (public.meu_papel() in ('gestor', 'vendas')) with check (public.meu_papel() in ('gestor', 'vendas'));
grant select, insert, update, delete on public.rotas, public.rota_paradas to authenticated;
grant all on public.rotas, public.rota_paradas to service_role;

-- rota antiga guardada para consulta; a etiqueta passa a apontar para a tabela de rotas
alter table public.contas add column if not exists rota_anterior text;
alter table public.contas drop constraint if exists contas_rota_chk;

-- primeira rota (pela ordem) em que a loja entra: cidade confirmada na rota ou loja incluída avulsa
create or replace function public.crm_rota_membro(p_conta uuid, p_cidade text, p_uf text) returns text
language sql stable security definer set search_path = public as $$
  select r.codigo from rotas r
   where r.ativa and r.codigo <> 'A planejar' and exists (
     select 1 from rota_paradas p
      where p.rota = r.codigo and not p.sugerida
        and (p.conta_id = p_conta
             or (p.conta_id is null and crm_chave_cidade(p.cidade) = crm_chave_cidade(p_cidade)
                 and (coalesce(p.uf, '') = '' or coalesce(p_uf, '') = '' or upper(p.uf) = upper(p_uf)))))
   order by r.ordem, r.codigo limit 1 $$;

-- recalcula a etiqueta de todas as lojas: rota em que entra; senão, quem já tinha etiqueta fica "A planejar"
create or replace function public.crm_rotas_recalcular() returns integer language plpgsql security definer set search_path = public as $$
declare n int;
begin
  with novo as (
    select c.id, coalesce(crm_rota_membro(c.id, c.cidade, c.uf), case when c.rota is not null then 'A planejar' end) as r
      from contas c)
  update contas c set rota = novo.r from novo where novo.id = c.id and c.rota is distinct from novo.r;
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.tg_conta_rota() returns trigger language plpgsql security definer set search_path = public as $$
declare m text;
begin
  m := crm_rota_membro(new.id, new.cidade, new.uf);
  if m is not null then new.rota := m;
  elsif tg_op = 'UPDATE' and old.rota is not null and old.rota <> 'A planejar' and new.rota is not distinct from old.rota then new.rota := 'A planejar';
  end if;
  return new;
end $$;

create or replace function public.tg_paradas_recalc() returns trigger language plpgsql security definer set search_path = public as $$
begin perform crm_rotas_recalcular(); return null; end $$;

-- regra do Yuri: no máximo 3 cidades por dia (sugestões não contam até serem confirmadas)
create or replace function public.tg_parada_capacidade() returns trigger language plpgsql security definer set search_path = public as $$
declare v_chave text; n int;
begin
  if new.sugerida then return new; end if;
  v_chave := coalesce(crm_chave_cidade(new.cidade), (select crm_chave_cidade(cidade) from contas where id = new.conta_id));
  select count(distinct k) into n from (
    select coalesce(crm_chave_cidade(p.cidade), crm_chave_cidade(c.cidade)) as k
      from rota_paradas p left join contas c on c.id = p.conta_id
     where p.rota = new.rota and p.dia = new.dia and not p.sugerida and p.id <> new.id
    union select v_chave) s where k is not null;
  if n > 3 then
    raise exception 'O dia % da % já tem 3 cidades. Coloque em outro dia (regra: no máximo 3 cidades por dia).', new.dia, new.rota;
  end if;
  return new;
end $$;

drop trigger if exists t_conta_rota on public.contas;
create trigger t_conta_rota before insert or update of cidade, uf on public.contas for each row execute function public.tg_conta_rota();
drop trigger if exists t_paradas_recalc on public.rota_paradas;
create trigger t_paradas_recalc after insert or update or delete on public.rota_paradas for each statement execute function public.tg_paradas_recalc();
drop trigger if exists t_parada_capacidade on public.rota_paradas;
create trigger t_parada_capacidade before insert or update of dia, sugerida, cidade, conta_id, rota on public.rota_paradas for each row execute function public.tg_parada_capacidade();

-- lojas de uma rota (pela cidade ou avulsas), com a situação no CRM; "A planejar" lista as etiquetadas
create or replace function public.crm_rota_lojas(p_rota text) returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if meu_papel() is null then raise exception 'Acesso não liberado.'; end if;
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

-- incluir ou tirar uma loja de uma rota pela ficha (vale para quem pode editar a loja: gestor, vendas ou o SDR dela)
create or replace function public.crm_rota_conta(p_conta uuid, p_rota text, p_dia int default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_papel text := meu_papel(); v_me text := meu_nome(); c contas; v_dia int; v_k text; v_msg text := ''; v_membro text;
begin
  if v_papel is null then raise exception 'Acesso não liberado.'; end if;
  select * into c from contas where id = p_conta;
  if not found then raise exception 'Loja não encontrada.'; end if;
  if v_papel not in ('gestor', 'vendas') and not exists (
       select 1 from prospeccoes p where p.conta_id = p_conta and (p.sdr = v_me or coalesce(p.sdr, '') = '')) then
    raise exception 'Só o gestor, vendas ou o SDR da loja mudam a rota.';
  end if;
  v_k := crm_chave_cidade(c.cidade);
  if coalesce(p_rota, '') in ('', 'A planejar') then
    delete from rota_paradas where conta_id = p_conta;
    v_membro := crm_rota_membro(p_conta, c.cidade, c.uf);
    if v_membro is not null then
      v_msg := 'A cidade ' || coalesce(c.cidade, '') || ' está na ' || v_membro || ': a loja continua nessa rota.';
    else
      update contas set rota = nullif(p_rota, '') where id = p_conta;
    end if;
  else
    if not exists (select 1 from rotas where codigo = p_rota and ativa) then raise exception 'Rota % não existe.', p_rota; end if;
    if exists (select 1 from rota_paradas p where p.rota = p_rota and p.conta_id is null and not p.sugerida and crm_chave_cidade(p.cidade) = v_k
                  and (coalesce(p.uf, '') = '' or coalesce(c.uf, '') = '' or upper(p.uf) = upper(c.uf))) then
      v_msg := 'A cidade ' || c.cidade || ' já está na ' || p_rota || ': a loja já entra nessa rota.';
    elsif not exists (select 1 from rota_paradas where rota = p_rota and conta_id = p_conta) then
      -- dia: o pedido; senão o primeiro dia com menos de 3 cidades; senão um dia novo
      v_dia := p_dia;
      if v_dia is null then
        select d into v_dia from (
          select p.dia as d, count(distinct coalesce(crm_chave_cidade(p.cidade), crm_chave_cidade(cc.cidade))) as n
            from rota_paradas p left join contas cc on cc.id = p.conta_id
           where p.rota = p_rota and not p.sugerida group by p.dia) s
         where n < 3 order by d limit 1;
        if v_dia is null then select coalesce(max(dia), 0) + 1 into v_dia from rota_paradas where rota = p_rota; end if;
      end if;
      insert into rota_paradas (rota, dia, ordem, conta_id, criado_por)
      values (p_rota, v_dia, (select coalesce(max(ordem), 0) + 1 from rota_paradas where rota = p_rota and dia = v_dia), p_conta, auth.jwt() ->> 'email');
      v_msg := c.nome || ' incluída na ' || p_rota || ' (dia ' || v_dia || ').';
    end if;
  end if;
  return jsonb_build_object('rota', (select coalesce(rota, '') from contas where id = p_conta), 'msg', v_msg,
    'rotas', coalesce((select jsonb_agg(distinct p.rota) from rota_paradas p where not p.sugerida and (p.conta_id = p_conta
        or (p.conta_id is null and crm_chave_cidade(p.cidade) = v_k and (coalesce(p.uf, '') = '' or coalesce(c.uf, '') = '' or upper(p.uf) = upper(c.uf))))), '[]'::jsonb));
end $$;

-- rotas da loja (para a ficha): em quais entra e em que dia
create or replace function public.crm_rotas_da_conta(p_conta uuid) returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('rota', p.rota, 'dia', p.dia, 'via', case when p.conta_id is null then 'cidade' else 'avulsa' end, 'sugerida', p.sugerida)
                            order by r.ordem, p.dia), '[]'::jsonb)
    from contas c join rota_paradas p on (p.conta_id = c.id or (p.conta_id is null and crm_chave_cidade(p.cidade) = crm_chave_cidade(c.cidade)
                                          and (coalesce(p.uf, '') = '' or coalesce(c.uf, '') = '' or upper(p.uf) = upper(c.uf))))
    join rotas r on r.codigo = p.rota
   where c.id = p_conta and meu_papel() is not null $$;

revoke all on function public.crm_rota_lojas(text) from public, anon;
revoke all on function public.crm_rota_conta(uuid, text, int) from public, anon;
revoke all on function public.crm_rotas_da_conta(uuid) from public, anon;
grant execute on function public.crm_rota_lojas(text), public.crm_rota_conta(uuid, text, int), public.crm_rotas_da_conta(uuid) to authenticated, service_role;
revoke all on function public.crm_rotas_recalcular() from public, anon, authenticated;
revoke all on function public.crm_rota_membro(uuid, text, text) from public, anon;
revoke all on function public.tg_conta_rota() from public, anon, authenticated;
revoke all on function public.tg_paradas_recalc() from public, anon, authenticated;
revoke all on function public.tg_parada_capacidade() from public, anon, authenticated;
