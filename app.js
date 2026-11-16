// CRM Indião Store v2 — Supabase + GitHub Pages
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';

const SUPABASE_URL = 'https://lnihrsdpogrtoqodbmtu.supabase.co';
const SUPABASE_KEY = 'sb_publishable_4IH9InQvatRxrUMX34yrZg_s8bzaEFS';
const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });

const BASE = { nome: 'Jaguariúna, SP', lat: -22.7056, lng: -46.9858 };
const ROTAS = {
  R1: 'Rota da Porteira · RMC e Bragantina', R2: 'Rota da Serra · Sul de Minas', R3: 'Rota do Peão · Ribeirão, Franca, Barretos',
  R4: 'Rota do Triângulo · Uberaba, Uberlândia', R5: 'Rota do Noroeste · Rio Preto, Araçatuba', R6: 'Rota da Alta Paulista · Bauru, Marília, Prudente',
  R7: 'Rota do Paranapanema · Sorocaba, Itapeva, Londrina', R8: 'Rota das Araucárias · Curitiba, Ponta Grossa',
  R9: 'Rota da Washington Luís · Jaguariúna → Rio Preto + 50 km',
};
const ST_PROSP = ['1. A abordar', '2. Contatado', '3. Respondeu', '4. Sem retorno (pausa 60d)', '5. Sem interesse', '6. Fora do ICP', '7. Já é lead', '8. Qualificado → Pedro', '9. Virou cliente', '0. Já é cliente'];
const ST_LEAD = ['Novo', 'Em contato', 'Qualificado', 'Catálogo enviado', 'Negociação', 'Pedido fechado', 'Nutrição', 'Perdido', 'Descartado'];
const MOTIVOS = ['', 'Preço / margem', 'Grade fechada não serve', 'Sem retorno', 'Comprou de concorrente', 'Fora do perfil', 'Sem CNPJ / não é lojista', 'Timing (voltar depois)', 'Outro'];
const CANAIS = ['WhatsApp', 'Telefone', 'Instagram', 'E-mail', 'Visita'];
const SEGMENTOS = ['Multimarca country', 'Selaria / agro com vestuário', 'Boutique feminina country', 'Loja de rodeio / eventos', 'Outro'];
const ORIGENS = ['Google Maps', 'Instagram', 'Indicação', 'Feira / Evento', 'Show Us Agroboy', 'Outro'];

const S = { user: null, papel: null, nome: null, perfis: [], aba: 'inicio', cache: {} };

// ---------- utilidades ----------
const $ = (s, el = document) => el.querySelector(s);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Datas sempre no horário de Brasília (toISOString usa UTC e vira o dia depois das 21h)
const hoje = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
const somaDias = (n) => { const d = new Date(hoje() + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const dataBR = (d) => (d ? new Date(d.length === 10 ? d + 'T12:00:00' : d).toLocaleDateString('pt-BR') : '');
const dataHoraBR = (d) => (d ? new Date(d).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '');
const brl = (v) => (v == null || v === '' ? '' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
const digitos = (v) => String(v ?? '').replace(/\D/g, '');
function waLink(conta) {
  let d = digitos(conta.whatsapp) || digitos(conta.telefone);
  if (!d) return '';
  if (d.length <= 11) d = '55' + d;
  return `https://wa.me/${d}`;
}
function instaLink(i) { const u = String(i || '').replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/\/.*$/, '').trim(); return u ? `https://instagram.com/${encodeURIComponent(u)}` : ''; }
function mapsLink(c) {
  if (/^https:\/\//i.test(c.maps_url || '')) return c.maps_url;
  return c.endereco || c.cidade ? `https://www.google.com/maps/search/${encodeURIComponent([c.nome, c.endereco, c.cidade, c.uf].filter(Boolean).join(', '))}` : '';
}
function aviso(t, erro = false, ms = 3500) { const a = $('#aviso'); a.textContent = t; a.className = 'aviso' + (erro ? ' erro' : ''); a.hidden = false; clearTimeout(aviso.t); if (ms) aviso.t = setTimeout(() => (a.hidden = true), ms); }
// Sempre inclui o valor atual nas opções, para não apagar dado que não está na lista (perfil inativo, segmento antigo etc.)
function opts(lista, atual) {
  const l = atual && !lista.includes(atual) ? [...lista, atual] : lista;
  return l.map((o) => `<option ${o === atual ? 'selected' : ''} value="${esc(o)}">${esc(o || '—')}</option>`).join('');
}
function seloAlerta(a) { if (!a) return ''; const cls = /hoje/i.test(a) ? 'hoje' : (/abordar/i.test(a) ? '' : 'alerta'); return `<span class="selo ${cls}">${esc(a)}</span>`; }
function seloStatus(s) { return `<span class="selo ${s === 'Pedido fechado' || s === '9. Virou cliente' || s === '0. Já é cliente' ? 'ganho' : ''}">${esc(s)}</span>`; }
async function q(promise) { const { data, error } = await promise; if (error) { console.error(error); aviso(traduzErro(error), true); throw error; } return data; }
function traduzErro(e) {
  if (/row-level security|violates row-level/i.test(e.message)) return 'Você não tem permissão para essa alteração.';
  if (/leads_um_aberto_por_conta/.test(e.message)) return 'Esta loja já tem um lead aberto.';
  return e.message;
}
// Update que confere se alguma linha mudou (o RLS bloqueia em silêncio, sem erro)
async function atualizar(tabela, dados, id) {
  const r = await q(sb.from(tabela).update(dados).eq('id', id).select('id'));
  if (!r.length) { aviso('Você não tem permissão para alterar este registro.', true); throw new Error('sem-permissao'); }
  return r;
}
// Evita envio duplo: desabilita o botão do formulário enquanto grava
function aoEnviar(form, fn) {
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const bt = form.querySelector('button[type=submit], button:not([type])');
    if (bt?.disabled) return;
    if (bt) bt.disabled = true;
    try { await fn(e); S.sujo = true; } catch (err) { console.warn(err); } finally { if (bt) bt.disabled = false; }
  });
}
// Célula de CSV segura para o Excel em português (sem fórmula injetada, números com vírgula)
function celulaCSV(v) {
  if (v == null) return '""';
  let s = typeof v === 'number' ? String(v).replace('.', ',') : String(v);
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) s = new Date(s).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  if (/^[=+@\t\r]/.test(s) || /^-[^0-9]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
}
const podeEditarProsp = (p) => S.papel !== 'sdr' || !p.sdr || p.sdr === S.nome;
const podeEditarLead = (l) => S.papel !== 'sdr' || l.responsavel === S.nome;
// Guarda os filtros de cada lista para voltarem iguais depois de abrir e fechar uma ficha
function lembrarFiltros(chave, seletores, render) {
  S.filtros = S.filtros || {};
  const salvos = S.filtros[chave] || {};
  seletores.forEach((s) => {
    const el = $(s);
    if (s in salvos) el.value = salvos[s];
    el.addEventListener('input', () => { (S.filtros[chave] ||= {})[s] = el.value; render(); });
  });
}
const ehGestor = () => S.papel === 'gestor';
const sdrs = () => S.perfis.filter((p) => p.ativo).map((p) => p.nome);

// ---------- login ----------
{
  const hp = new URLSearchParams(location.hash.slice(1));
  if (hp.get('error_description') || hp.get('error')) {
    $('#login-msg').textContent = 'O link de acesso expirou ou já foi usado. Peça um novo link (ou use o código do e-mail).';
    history.replaceState(null, '', location.pathname);
  }
}
$('#form-login').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = $('#login-email').value.trim().toLowerCase();
  $('#login-msg').textContent = 'Enviando…';
  const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname, shouldCreateUser: true } });
  if (error) { $('#login-msg').textContent = 'Não foi possível enviar: ' + (/rate|seconds/i.test(error.message) ? 'muitos pedidos seguidos, espere alguns minutos.' : error.message); return; }
  $('#login-msg').innerHTML = 'Pronto! Abra o e-mail e toque no link de acesso. <br>No app instalado no celular, digite aqui o código de 6 dígitos do e-mail:';
  $('#form-codigo').hidden = false;
});
$('#form-codigo').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = $('#login-email').value.trim().toLowerCase();
  const token = $('#login-codigo').value.replace(/\D/g, '');
  const { error } = await sb.auth.verifyOtp({ email, token, type: 'email' });
  if (error) $('#login-msg').textContent = 'Código inválido ou expirado. Peça um novo.';
});

let iniciado = false;
sb.auth.onAuthStateChange((_ev, session) => {
  if (session?.user && !iniciado) { iniciado = true; if (location.hash.includes('access_token')) history.replaceState(null, '', location.pathname); iniciar(session.user); }
});

async function iniciar(user) {
  S.user = user;
  const [{ data: papel }, { data: nome }] = await Promise.all([sb.rpc('meu_papel'), sb.rpc('meu_nome')]);
  if (!papel) {
    $('#app').innerHTML = `<section class="cartao login"><h1>Acesso não liberado</h1><p>O e-mail <b>${esc(user.email)}</b> entrou, mas ainda não tem perfil no CRM. Peça ao gestor para liberar.</p><button class="botao" id="sair2">Sair</button></section>`;
    $('#sair2').onclick = sair; return;
  }
  S.papel = papel; S.nome = nome;
  S.perfis = await q(sb.from('perfis').select('*').order('nome'));
  $('#quem').innerHTML = `${esc(nome)} · ${esc({ gestor: 'Gestor', vendas: 'Vendas', sdr: 'Prospecção' }[papel])} <button id="sair">Sair</button>`;
  $('#sair').onclick = sair;
  $('#abas').hidden = false;
  document.querySelectorAll('#abas [data-so]').forEach((b) => (b.hidden = b.dataset.so !== papel));
  document.querySelectorAll('#abas button').forEach((b) => (b.onclick = () => irPara(b.dataset.aba)));
  irPara(location.hash.slice(1) || 'inicio');
}
async function sair() { await sb.auth.signOut(); location.hash = ''; location.reload(); }

function irPara(aba) {
  if (aba === 'usuarios' && !ehGestor()) aba = 'inicio';
  S.aba = aba; location.hash = aba;
  document.querySelectorAll('#abas button').forEach((b) => b.classList.toggle('ativa', b.dataset.aba === aba));
  ({ inicio: telaInicio, prospeccao: telaProspeccao, leads: telaLeads, visitas: telaVisitas, usuarios: telaUsuarios }[aba] || telaInicio)();
}

// ---------- Início ----------
async function telaInicio() {
  const app = $('#app'); app.innerHTML = '<div class="cartao">Carregando…</div>';
  const eu = S.nome;
  const [pros, leads, vis] = await Promise.all([
    q(sb.from('v_prospeccoes').select('id,codigo,loja,cidade,uf,status,sdr,alerta,proximo_toque,conta_id').not('alerta', 'is', null)),
    q(sb.from('v_leads').select('id,codigo,loja,cidade,uf,status,responsavel,alerta,proxima_acao,data_proxima_acao,conta_id,tipo_status')),
    q(sb.from('visitas').select('id,situacao,data_visita,conta_id,contas(nome,cidade)').in('situacao', ['agendada', 'a agendar', 'reagendar']).order('data_visita')),
  ]);
  const minhasP = pros.filter((p) => (ehGestor() ? true : p.sdr === eu || (!p.sdr && S.papel === 'sdr')) && p.alerta !== 'A abordar');
  const aAbordar = pros.filter((p) => p.alerta === 'A abordar' && (ehGestor() || p.sdr === eu || !p.sdr));
  const meusL = leads.filter((l) => l.tipo_status === 'Aberto' && (ehGestor() || l.responsavel === eu));
  const atrasL = meusL.filter((l) => l.alerta);
  const qualif = leads.filter((l) => l.status === 'Qualificado');
  app.innerHTML = `
    <div class="kpis">
      <div class="kpi"><b>${minhasP.length}</b><span>Toques atrasados / hoje</span></div>
      <div class="kpi"><b>${aAbordar.length}</b><span>Lojas a abordar</span></div>
      <div class="kpi"><b>${atrasL.length}</b><span>Leads com ação atrasada / hoje</span></div>
      <div class="kpi"><b>${qualif.length}</b><span>Qualificados aguardando o Pedro</span></div>
      <div class="kpi"><b>${vis.length}</b><span>Visitas a agendar / agendadas</span></div>
    </div>
    <div class="colunas">
      <div class="cartao"><h2>Meus leads para agir</h2>${listaSimples(atrasL.slice(0, 40), (l) => `${seloAlerta(l.alerta)} <b>${esc(l.loja)}</b> · ${esc(l.cidade || '')} <small>${esc(l.status)} · ${esc(l.proxima_acao || '')} (${dataBR(l.data_proxima_acao)})</small>`)}</div>
      <div class="cartao"><h2>Minhas prospecções para tocar</h2>${listaSimples(minhasP.slice(0, 40), (p) => `${seloAlerta(p.alerta)} <b>${esc(p.loja)}</b> · ${esc(p.cidade || '')} <small>${esc(p.status)} · ${esc(p.sdr || 'sem SDR')} · próximo toque ${dataBR(p.proximo_toque)}</small>`)}</div>
      <div class="cartao"><h2>Qualificados → Pedro</h2>${listaSimples(qualif, (l) => `<b>${esc(l.loja)}</b> · ${esc(l.cidade || '')} <small>${esc(l.proxima_acao || '')}</small>`)}</div>
      <div class="cartao"><h2>Visitas</h2>${listaSimples(vis, (v) => `<b>${esc(v.contas?.nome)}</b> · ${esc(v.contas?.cidade || '')} <small>${esc(v.situacao)} ${v.data_visita ? '· ' + dataBR(v.data_visita) : ''}</small>`)}</div>
    </div>`;
  app.querySelectorAll('[data-conta]').forEach((el) => (el.onclick = () => abrirConta(el.dataset.conta)));
}
function listaSimples(itens, fmt) {
  if (!itens.length) return '<p class="vazio">Nada por aqui 👍</p>';
  return `<ul class="linha-tempo">${itens.map((i) => `<li data-conta="${i.conta_id}" style="cursor:pointer">${fmt(i)}</li>`).join('')}</ul>`;
}

// ---------- Prospecção ----------
async function telaProspeccao() {
  const app = $('#app');
  const filtroSdr = S.papel === 'sdr' ? S.nome : '';
  app.innerHTML = `
    <div class="cartao">
      <div class="barra">
        <div><label>Buscar</label><input id="f-busca" placeholder="loja, cidade, @, telefone"></div>
        <div><label>Status</label><select id="f-status"><option value="">Todos (abertos)</option><option value="*">Todos</option>${opts(ST_PROSP)}</select></div>
        <div><label>SDR</label><select id="f-sdr"><option value="">Todos</option><option value="-">Sem SDR</option>${opts(sdrs(), filtroSdr)}</select></div>
        <div><label>Rota</label><select id="f-rota"><option value="">Todas</option>${Object.keys(ROTAS).map((r) => `<option value="${r}">${r} · ${esc(ROTAS[r].split(' · ')[0])}</option>`).join('')}</select></div>
        <div><label>Alerta</label><select id="f-alerta"><option value="">Todos</option><option>Toque atrasado</option><option>Toque hoje</option><option>A abordar</option><option>Voltar a abordar</option></select></div>
        <div class="acoes"><button class="primario" id="nova-prosp">+ Nova prospecção</button></div>
      </div>
    </div>
    <div class="contagem" id="cont"></div><div id="lista">Carregando…</div>`;
  const dados = await q(sb.from('v_prospeccoes').select('*').order('proximo_toque', { ascending: true, nullsFirst: false }));
  S.cache.prosp = dados;
  const render = () => {
    const b = $('#f-busca').value.toLowerCase(); const st = $('#f-status').value; const sd = $('#f-sdr').value; const ro = $('#f-rota').value; const al = $('#f-alerta').value;
    const fech = ['5. Sem interesse', '6. Fora do ICP', '7. Já é lead', '9. Virou cliente', '0. Já é cliente'];
    const f = dados.filter((p) => (st === '*' ? true : st ? p.status === st : !fech.includes(p.status))
      && (!sd || (sd === '-' ? !p.sdr : p.sdr === sd)) && (!ro || p.rota === ro) && (!al || p.alerta === al)
      && (!b || [p.loja, p.cidade, p.instagram, p.telefone, p.whatsapp, p.codigo, p.decisor].join(' ').toLowerCase().includes(b)));
    $('#cont').textContent = `${f.length} prospecções`;
    $('#lista').innerHTML = f.length ? `<div class="rolagem"><table class="tabela"><thead><tr><th>Loja</th><th>Cidade</th><th>Status</th><th class="oculta-cel">SDR</th><th class="oculta-cel">Próximo toque</th><th>Alerta</th><th class="oculta-cel">Rota</th></tr></thead><tbody>
      ${f.map((p) => `<tr class="clicavel" data-conta="${esc(p.conta_id)}"><td><b>${esc(p.loja)}</b><br><small>${esc(p.codigo)} · ${esc(p.tier || '')} ${esc(p.segmento || '')}</small></td><td>${esc(p.cidade || '')}/${esc(p.uf || '')}</td><td>${seloStatus(p.status)}</td><td class="oculta-cel">${esc(p.sdr || '—')}</td><td class="oculta-cel">${dataBR(p.proximo_toque)}</td><td>${seloAlerta(p.alerta)}</td><td class="oculta-cel">${p.rota ? `<span class="selo r">${esc(p.rota)}</span>` : ''}</td></tr>`).join('')}
      </tbody></table></div>` : '<div class="cartao vazio">Nenhuma prospecção com esses filtros.</div>';
    $('#lista').querySelectorAll('[data-conta]').forEach((tr) => (tr.onclick = () => abrirConta(tr.dataset.conta)));
  };
  lembrarFiltros('prosp', ['#f-busca', '#f-status', '#f-sdr', '#f-rota', '#f-alerta'], render);
  $('#nova-prosp').onclick = novaProspeccao;
  render();
}

async function novaProspeccao() {
  abrirModal(`
    <h2>+ Nova prospecção</h2>
    <form id="fnp" class="grade">
      <div class="largo"><label>Nome da loja *</label><input name="nome" required></div>
      <div><label>Cidade *</label><input name="cidade" required></div>
      <div><label>UF *</label><input name="uf" maxlength="2" required></div>
      <div><label>WhatsApp</label><input name="whatsapp" placeholder="(17) 99999-9999"></div>
      <div><label>Telefone fixo</label><input name="telefone"></div>
      <div><label>Instagram</label><input name="instagram" placeholder="@loja"></div>
      <div><label>CNPJ</label><input name="cnpj"></div>
      <div class="largo"><label>Endereço</label><input name="endereco"></div>
      <div><label>Segmento</label><select name="segmento">${opts(SEGMENTOS, 'Multimarca country')}</select></div>
      <div><label>Tier</label><select name="tier">${opts(['A', 'B', 'C'], 'B')}</select></div>
      <div><label>Origem</label><select name="origem">${opts(ORIGENS, 'Google Maps')}</select></div>
      <div><label>Rota</label><select name="rota"><option value="">—</option>${Object.keys(ROTAS).map((r) => `<option value="${r}">${r} · ${esc(ROTAS[r].split(' · ')[0])}</option>`).join('')}</select></div>
      <div><label>SDR responsável</label><select name="sdr">${opts(S.papel === 'sdr' ? [S.nome] : sdrs(), S.nome)}</select></div>
      <div class="largo"><label>Link do Google Maps (opcional)</label><input name="maps_url"></div>
      <div class="largo"><label>Anotações</label><textarea name="anotacoes"></textarea></div>
      <div class="largo" id="dup"></div>
      <div class="largo"><button class="primario" type="submit">Salvar prospecção</button></div>
    </form>`);
  const f = $('#fnp');
  const checar = async () => {
    const wa = digitos(f.whatsapp.value); const ig = f.instagram.value.replace('@', '').trim(); const nome = f.nome.value.trim();
    // valores entre aspas: vírgula ou parênteses no nome não quebram o filtro
    const lit = (s) => '"' + String(s).replace(/["\\%_]/g, '') + '"';
    const filtros = [];
    const contem = (s) => '"%' + lit(s).slice(1, -1) + '%"';
    if (wa.length >= 10) {
      const f8 = wa.slice(-8); // WhatsApp guardado só com dígitos; telefone guardado formatado "(17) 99145-9265"
      filtros.push(`whatsapp.ilike.${contem(f8)}`, `telefone.ilike.${contem(f8.slice(0, 4) + '-' + f8.slice(4))}`);
    }
    if (ig) filtros.push(`instagram.ilike.${contem(ig)}`);
    if (nome.length >= 4) filtros.push(`nome.ilike.${contem(nome)}`);
    if (!filtros.length) { $('#dup').innerHTML = ''; return []; }
    const { data, error } = await sb.from('contas').select('id,nome,cidade,uf').or(filtros.join(',')).limit(5);
    if (error) { $('#dup').innerHTML = '<div class="dup">Não foi possível checar duplicatas. Confira antes de salvar.</div>'; return []; }
    $('#dup').innerHTML = data?.length ? `<div class="dup">⚠️ Possível duplicata: ${data.map((d) => `<a href="#" data-conta="${d.id}">${esc(d.nome)} (${esc(d.cidade || '')})</a>`).join(', ')}. Confira antes de salvar.</div>` : '';
    $('#dup').querySelectorAll('[data-conta]').forEach((a) => (a.onclick = (e) => { e.preventDefault(); abrirConta(a.dataset.conta); }));
    return data || [];
  };
  ['nome', 'whatsapp', 'instagram'].forEach((n) => f[n].addEventListener('change', checar));
  aoEnviar(f, async () => {
    const d = Object.fromEntries(new FormData(f));
    let wa = digitos(d.whatsapp); if (wa && wa.length <= 11) wa = '55' + wa;
    const conta = await q(sb.from('contas').insert({ nome: d.nome.trim(), cidade: d.cidade.trim(), uf: d.uf.trim().toUpperCase(), whatsapp: wa || null, telefone: d.telefone || null, instagram: d.instagram || null, cnpj: d.cnpj || null, endereco: d.endereco || null, segmento: d.segmento, tier: d.tier, origem: d.origem, rota: d.rota || null, maps_url: d.maps_url || null, criado_por: S.user.email }).select('id').single());
    await q(sb.from('prospeccoes').insert({ conta_id: conta.id, status: '1. A abordar', sdr: d.sdr, anotacoes: d.anotacoes || null, proximo_toque: hoje(), incluida_em: `${S.nome} · ${dataBR(hoje())}`, criado_por: S.user.email }));
    aviso('Prospecção criada.'); S.sujo = true; abrirConta(conta.id);
  });
}

// ---------- Leads ----------
async function telaLeads() {
  const app = $('#app');
  app.innerHTML = `
    <div class="cartao"><div class="barra">
      <div><label>Buscar</label><input id="f-busca" placeholder="loja, contato, cidade, telefone"></div>
      <div><label>Status</label><select id="f-status"><option value="">Abertos</option><option value="*">Todos</option>${opts(ST_LEAD)}</select></div>
      <div><label>Responsável</label><select id="f-resp"><option value="">Todos</option>${opts(sdrs(), S.papel === 'vendas' ? S.nome : '')}</select></div>
      <div><label>Alerta</label><select id="f-alerta"><option value="">Todos</option><option>Ação atrasada</option><option>Ação hoje</option><option>Sem 1º contato</option></select></div>
      <div class="acoes"><button class="primario" id="novo-lead">+ Novo lead</button></div>
    </div></div>
    <div class="contagem" id="cont"></div><div id="lista">Carregando…</div>`;
  const dados = await q(sb.from('v_leads').select('*').order('data_proxima_acao', { ascending: true, nullsFirst: false }));
  const render = () => {
    const b = $('#f-busca').value.toLowerCase(); const st = $('#f-status').value; const rs = $('#f-resp').value; const al = $('#f-alerta').value;
    const f = dados.filter((l) => (st === '*' ? true : st ? l.status === st : l.tipo_status === 'Aberto') && (!rs || l.responsavel === rs) && (!al || l.alerta === al)
      && (!b || [l.loja, l.contato_nome, l.cidade, l.whatsapp, l.telefone, l.codigo, l.email].join(' ').toLowerCase().includes(b)));
    $('#cont').textContent = `${f.length} leads`;
    $('#lista').innerHTML = f.length ? `<div class="rolagem"><table class="tabela"><thead><tr><th>Loja / contato</th><th>Status</th><th class="oculta-cel">Responsável</th><th>Próxima ação</th><th>Alerta</th><th class="oculta-cel">Temperatura</th><th class="oculta-cel">Origem</th></tr></thead><tbody>
      ${f.map((l) => `<tr class="clicavel" data-conta="${esc(l.conta_id)}"><td><b>${esc(l.loja)}</b><br><small>${esc(l.codigo)} · ${esc(l.contato_nome || '')} · ${esc(l.cidade || '')}${l.uf ? '/' + esc(l.uf) : ''}</small></td><td>${seloStatus(l.status)}</td><td class="oculta-cel">${esc(l.responsavel || '')}</td><td>${esc(l.proxima_acao || '')}<br><small>${dataBR(l.data_proxima_acao)}</small></td><td>${seloAlerta(l.alerta)}</td><td class="oculta-cel">${l.temperatura ? `<span class="selo ${l.temperatura === 'Quente' ? 'quente' : ''}">${esc(l.temperatura)}</span>` : ''}</td><td class="oculta-cel"><small>${esc(l.origem || '')}</small></td></tr>`).join('')}
      </tbody></table></div>` : '<div class="cartao vazio">Nenhum lead com esses filtros.</div>';
    $('#lista').querySelectorAll('[data-conta]').forEach((tr) => (tr.onclick = () => abrirConta(tr.dataset.conta)));
  };
  lembrarFiltros('leads', ['#f-busca', '#f-status', '#f-resp', '#f-alerta'], render);
  $('#novo-lead').onclick = novoLead;
  render();
}
function novoLead() {
  abrirModal(`<h2>+ Novo lead</h2><form id="fnl" class="grade">
    <div class="largo"><label>Loja *</label><input name="nome" required></div>
    <div><label>Contato</label><input name="contato"></div><div><label>WhatsApp</label><input name="whatsapp"></div>
    <div><label>E-mail</label><input name="email" type="email"></div><div><label>Cidade</label><input name="cidade"></div><div><label>UF</label><input name="uf" maxlength="2"></div>
    <div><label>Origem</label><select name="origem">${opts(['WhatsApp', 'Instagram', 'Indicação', 'Representante', 'Feira / Evento', 'Site – LP B2B', 'Outro'], 'WhatsApp')}</select></div>
    <div><label>Responsável</label><select name="resp">${opts(S.papel === 'sdr' ? [S.nome] : sdrs(), S.nome)}</select></div>
    <div class="largo"><label>Observações</label><textarea name="obs"></textarea></div>
    <div class="largo"><button class="primario">Salvar lead</button></div></form>`);
  aoEnviar($('#fnl'), async (e) => {
    const d = Object.fromEntries(new FormData(e.target));
    let wa = digitos(d.whatsapp); if (wa && wa.length <= 11) wa = '55' + wa;
    const c = await q(sb.from('contas').insert({ nome: d.nome, cidade: d.cidade || null, uf: (d.uf || '').toUpperCase() || null, whatsapp: wa || null, email: d.email || null, origem: d.origem, criado_por: S.user.email }).select('id').single());
    await q(sb.from('leads').insert({ conta_id: c.id, contato_nome: d.contato || null, email: d.email || null, origem: d.origem, responsavel: d.resp, status: 'Novo', observacoes: d.obs || null, proxima_acao: 'Fazer 1º contato', data_proxima_acao: hoje(), criado_por: S.user.email }));
    aviso('Lead criado.'); S.sujo = true; abrirConta(c.id);
  });
}

// ---------- Ficha da conta ----------
async function abrirConta(contaId) {
  abrirModal('<p>Carregando…</p>');
  const [c, pros, leads, inter, vis] = await Promise.all([
    q(sb.from('contas').select('*').eq('id', contaId).single()),
    q(sb.from('prospeccoes').select('*').eq('conta_id', contaId).order('criado_em', { ascending: false })),
    q(sb.from('leads').select('*').eq('conta_id', contaId).order('criado_em', { ascending: false })),
    q(sb.from('interacoes').select('*').eq('conta_id', contaId).order('quando', { ascending: false }).limit(200)),
    q(sb.from('visitas').select('*').eq('conta_id', contaId).order('criado_em', { ascending: false })),
  ]);
  const p = pros[0]; const l = leads[0];
  // O SDR não enxerga leads de outros: avisa que a loja já tem lead em vez de oferecer criar outro
  let leadOculto = null;
  if (!l) { const { data } = await sb.rpc('lead_aberto_da_conta', { p_conta: contaId }); leadOculto = data?.[0] || null; }
  const links = [
    waLink(c) && `<a target="_blank" rel="noopener" href="${esc(waLink(c))}">💬 WhatsApp</a>`,
    c.telefone && `<a href="tel:${esc(digitos(c.telefone))}">📞 ${esc(c.telefone)}</a>`,
    instaLink(c.instagram) && `<a target="_blank" rel="noopener" href="${esc(instaLink(c.instagram))}">📸 ${esc(c.instagram)}</a>`,
    mapsLink(c) && `<a target="_blank" rel="noopener" href="${esc(mapsLink(c))}">📍 Maps</a>`,
  ].filter(Boolean).join('');
  const blocoLead = l ? fichaLead(l)
    : leadOculto ? `<div class="cartao"><h2>Lead ${esc(leadOculto.codigo)}</h2><p>Esta loja já tem lead aberto com <b>${esc(leadOculto.responsavel || '—')}</b> (${esc(leadOculto.status)}).</p></div>`
    : S.papel === 'sdr' ? '' : `<div class="cartao"><button class="botao" id="criar-lead">Criar lead para esta loja</button></div>`;
  $('#modal-corpo').innerHTML = `
    <h1>${esc(c.nome)}</h1>
    <div>${esc(c.cidade || '')}${c.uf ? '/' + esc(c.uf) : ''} ${c.rota ? `· <span class="selo r">${esc(c.rota)}</span> ${esc(ROTAS[c.rota] || '')}` : ''} ${c.nota_google ? `· ⭐ ${esc(c.nota_google)} (${esc(c.avaliacoes || 0)})` : ''}</div>
    <div class="links">${links}</div>
    <div class="colunas">
      <div>
        <div class="cartao"><h2>Registrar contato</h2>
          <form id="f-toque" class="grade">
            <div><label>Canal</label><select name="canal">${opts(CANAIS, S.papel === 'vendas' ? 'Telefone' : 'WhatsApp')}</select></div>
            <div><label>Próximo contato</label><input type="date" name="proximo" value="${somaDias(3)}"></div>
            <div class="largo"><label>O que aconteceu</label><textarea name="texto" required placeholder="Ex.: falei com o dono, pediu catálogo; volta segunda"></textarea></div>
            <div class="largo"><button class="primario">Salvar contato</button></div>
          </form>
        </div>
        ${p ? fichaProsp(p) : `<div class="cartao"><button class="botao" id="criar-prosp">Criar prospecção para esta loja</button></div>`}
        ${blocoLead}
      </div>
      <div>
        ${fichaVisitas(vis)}
        <div class="cartao"><h2>Histórico</h2><ul class="linha-tempo">${inter.map((i) => `<li><b>${esc(i.evento || i.canal || i.tipo)}</b>${i.de || i.para ? ` · ${esc(i.de || '')} → ${esc(i.para || '')}` : ''}${i.texto ? `<br>${esc(i.texto)}` : ''}<small>${dataHoraBR(i.quando)} · ${esc(i.por || '')}${i.canal ? ' · ' + esc(i.canal) : ''}</small></li>`).join('') || '<li class="vazio">Sem histórico</li>'}</ul></div>
        ${fichaConta(c, p)}
      </div>
    </div>`;
  ligarFicha(c, p, l, vis);
}
function somenteLeitura(pode, aviso) { return pode ? '' : `<p class="dup">${aviso}</p>`; }
function fichaProsp(p) {
  const pode = podeEditarProsp(p);
  const opcoesSdr = S.papel === 'sdr' ? [S.nome] : sdrs();
  return `<div class="cartao"><h2>Prospecção ${esc(p.codigo)}</h2>${somenteLeitura(pode, `Prospecção do SDR ${esc(p.sdr)}: só leitura para você.`)}
  <form id="f-prosp" class="grade"><fieldset ${pode ? '' : 'disabled'} style="border:0;padding:0;margin:0;display:contents">
    <div class="largo"><label>Status</label><select name="status">${opts(ST_PROSP, p.status)}</select></div>
    <div><label>SDR</label><select name="sdr"><option value="">—</option>${opts(opcoesSdr, p.sdr)}</select></div>
    <div><label>Próximo toque</label><input type="date" name="proximo_toque" value="${esc(p.proximo_toque || '')}"></div>
    <div><label>Último toque</label><input type="date" name="ultimo_toque" value="${esc(p.ultimo_toque || '')}"></div>
    <div><label>Decisor</label><input name="decisor" value="${esc(p.decisor)}"></div>
    <div><label>Marcas que trabalha</label><input name="marcas" value="${esc(p.marcas)}"></div>
    <div><label>Público</label><input name="publico" value="${esc(p.publico)}"></div>
    <div><label>Época de compra</label><input name="epoca_compra" value="${esc(p.epoca_compra)}"></div>
    <div><label>Respondeu por</label><select name="respondeu_por">${opts(['', ...CANAIS], p.respondeu_por || '')}</select></div>
    <div class="largo"><label>Próximo passo</label><input name="proximo_passo" value="${esc(p.proximo_passo)}"></div>
    <div class="largo"><label>Anotações</label><textarea name="anotacoes">${esc(p.anotacoes)}</textarea></div>
    ${pode ? '<div class="largo"><button class="primario">Salvar prospecção</button> <small>“8. Qualificado → Pedro” cria ou atualiza o lead do Pedro automaticamente.</small></div>' : ''}
  </fieldset></form></div>`;
}
function fichaLead(l) {
  const pode = podeEditarLead(l);
  const opcoesResp = S.papel === 'sdr' ? [...new Set([S.nome, 'Pedro'])] : sdrs();
  return `<div class="cartao"><h2>Lead ${esc(l.codigo)}</h2>${somenteLeitura(pode, `Lead com ${esc(l.responsavel || '—')}: só leitura para você.`)}
  <form id="f-lead" class="grade"><fieldset ${pode ? '' : 'disabled'} style="border:0;padding:0;margin:0;display:contents">
    <div><label>Status</label><select name="status">${opts(ST_LEAD, l.status)}</select></div>
    <div><label>Responsável</label><select name="responsavel">${opts(opcoesResp, l.responsavel)}</select></div>
    <div><label>Temperatura</label><select name="temperatura">${opts(['', 'Quente', 'Morno', 'Frio'], l.temperatura || '')}</select></div>
    <div><label>Contato</label><input name="contato_nome" value="${esc(l.contato_nome)}"></div>
    <div class="largo"><label>Próxima ação</label><input name="proxima_acao" value="${esc(l.proxima_acao)}"></div>
    <div><label>Data da próxima ação</label><input type="date" name="data_proxima_acao" value="${esc(l.data_proxima_acao || '')}"></div>
    <div><label>Potencial (R$)</label><input type="number" step="0.01" name="potencial" value="${esc(l.potencial ?? '')}"></div>
    <div><label>Valor 1º pedido (R$)</label><input type="number" step="0.01" name="valor_primeiro_pedido" value="${esc(l.valor_primeiro_pedido ?? '')}"></div>
    <div><label>Motivo de perda</label><select name="motivo_perda">${opts(MOTIVOS, l.motivo_perda || '')}</select></div>
    <div class="largo"><label>Observações</label><textarea name="observacoes">${esc(l.observacoes)}</textarea></div>
    <div class="largo"><small>Origem: ${esc(l.origem || '')} · entrada ${dataBR(l.data_entrada)} ${l.pedidos_erp ? `· ERP: ${esc(l.pedidos_erp)} pedido(s), ${brl(l.total_comprado_erp)} (último ${dataBR(l.ultimo_pedido_erp)})` : ''} ${l.utm ? '· ' + esc(l.utm) : ''}</small></div>
    ${pode ? '<div class="largo"><button class="primario">Salvar lead</button></div>' : ''}
  </fieldset></form></div>`;
}
function fichaVisitas(vis) {
  return `<div class="cartao"><h2>Visitas</h2>
    ${vis.length ? `<ul class="linha-tempo">${vis.map((v) => `<li><b>${esc(v.situacao)}</b> ${v.data_visita ? '· ' + dataBR(v.data_visita) : ''} ${v.hora ? esc(v.hora) : ''} ${v.resultado ? '· ' + esc(v.resultado) : ''} ${v.valor_pedido ? '· ' + brl(v.valor_pedido) : ''}<small>${esc(v.observacoes || '')} ${v.agendado_por ? '· agendada por ' + esc(v.agendado_por) : ''}</small>
      <button class="botao pequeno" data-vis="${esc(v.id)}">Atualizar</button></li>`).join('')}</ul>` : '<p class="vazio">Nenhuma visita.</p>'}
    <form id="f-visita" class="grade"><div><label>Situação</label><select name="situacao">${opts(['a agendar', 'agendada'], 'agendada')}</select></div>
      <div><label>Data</label><input type="date" name="data_visita"></div><div><label>Hora</label><input name="hora" placeholder="10:30"></div>
      <div class="largo"><button class="botao verde">+ Agendar visita</button></div></form></div>`;
}
function fichaConta(c, p) {
  const pode = S.papel !== 'sdr' || (p && podeEditarProsp(p));
  return `<div class="cartao"><h2>Dados da loja</h2>${somenteLeitura(pode, 'Só o SDR da prospecção, o gestor e vendas editam estes dados.')}
  <form id="f-conta" class="grade"><fieldset ${pode ? '' : 'disabled'} style="border:0;padding:0;margin:0;display:contents">
    <div class="largo"><label>Nome</label><input name="nome" value="${esc(c.nome)}" required></div>
    <div><label>Cidade</label><input name="cidade" value="${esc(c.cidade)}"></div><div><label>UF</label><input name="uf" maxlength="2" value="${esc(c.uf)}"></div>
    <div><label>WhatsApp</label><input name="whatsapp" value="${esc(c.whatsapp)}"></div><div><label>Telefone</label><input name="telefone" value="${esc(c.telefone)}"></div>
    <div><label>Instagram</label><input name="instagram" value="${esc(c.instagram)}"></div><div><label>E-mail</label><input name="email" value="${esc(c.email)}"></div>
    <div><label>CNPJ</label><input name="cnpj" value="${esc(c.cnpj)}"></div><div><label>CEP</label><input name="cep" value="${esc(c.cep)}"></div>
    <div class="largo"><label>Endereço</label><input name="endereco" value="${esc(c.endereco)}"></div>
    <div><label>Segmento</label><select name="segmento">${opts(['', ...SEGMENTOS], c.segmento || '')}</select></div>
    <div><label>Tier</label><select name="tier">${opts(['', 'A', 'B', 'C', 'Fora do ICP'], c.tier || '')}</select></div>
    <div><label>Rota</label><select name="rota">${opts(['', ...Object.keys(ROTAS)], c.rota || '')}</select></div>
    <div class="largo"><small>Origem: ${esc(c.origem || '')} · criada ${dataBR(c.criado_em)} ${c.criado_por ? 'por ' + esc(c.criado_por) : ''}</small></div>
    ${pode ? '<div class="largo"><button class="botao">Salvar dados da loja</button></div>' : ''}
  </fieldset></form></div>`;
}
function ligarFicha(c, p, l, vis) {
  const recarregar = () => abrirConta(c.id);
  aoEnviar($('#f-toque'), async (e) => {
    const d = Object.fromEntries(new FormData(e.target));
    await q(sb.from('interacoes').insert({ conta_id: c.id, lead_id: l?.id || null, prospeccao_id: p?.id || null, tipo: 'toque', canal: d.canal, evento: 'Contato · ' + d.canal, texto: d.texto, por: S.nome }));
    const avisos = ['Contato registrado.'];
    // A prospecção só anda enquanto está com o SDR (status 1 a 4); depois de passar ao Pedro, não volta a gerar alerta
    if (p && ['1. A abordar', '2. Contatado', '3. Respondeu', '4. Sem retorno (pausa 60d)'].includes(p.status)) {
      if (podeEditarProsp(p)) {
        const upd = { ultimo_toque: hoje(), proximo_toque: d.proximo || null };
        if (p.status === '1. A abordar') upd.status = '2. Contatado';
        if (!p.sdr && S.papel === 'sdr') upd.sdr = S.nome;
        await atualizar('prospeccoes', upd, p.id);
      } else avisos.push(`A prospecção é do ${p.sdr}: o próximo toque dela não mudou.`);
    }
    // O prazo do lead só muda quando quem registra é o responsável (ou gestor/vendas)
    if (l && !['Pedido fechado', 'Perdido', 'Descartado'].includes(l.status)) {
      if (podeEditarLead(l)) {
        const upd = { ultimo_contato: hoje(), data_proxima_acao: d.proximo || null };
        if (l.status === 'Novo') upd.status = 'Em contato';
        await atualizar('leads', upd, l.id);
      } else avisos.push(`O lead é do ${l.responsavel}: o prazo dele não mudou.`);
    }
    aviso(avisos.join(' ')); recarregar();
  });
  if (p && podeEditarProsp(p)) aoEnviar($('#f-prosp'), async (e) => {
    const d = Object.fromEntries(new FormData(e.target));
    for (const k of ['proximo_toque', 'ultimo_toque', 'sdr', 'respondeu_por']) if (!d[k]) d[k] = null;
    await atualizar('prospeccoes', d, p.id); aviso('Prospecção salva.'); recarregar();
  });
  if (l && podeEditarLead(l)) aoEnviar($('#f-lead'), async (e) => {
    const d = Object.fromEntries(new FormData(e.target));
    for (const k of ['data_proxima_acao', 'potencial', 'valor_primeiro_pedido', 'temperatura', 'motivo_perda', 'responsavel']) if (d[k] === '') d[k] = null;
    if (d.status === 'Perdido' && !d.motivo_perda) { aviso('Informe o motivo de perda.', true); return; }
    // Passar para o Pedro: o banco troca o responsável e a próxima ação quando o status vira "Qualificado"
    const passouProPedro = S.papel === 'sdr' && (d.status === 'Qualificado' || d.responsavel === 'Pedro');
    if (passouProPedro) { d.status = 'Qualificado'; d.responsavel = 'Pedro'; }
    if (passouProPedro) await q(sb.from('leads').update(d).eq('id', l.id)); else await atualizar('leads', d, l.id);
    aviso(passouProPedro ? 'Lead passado para o Pedro.' : 'Lead salvo.'); recarregar();
  });
  $('#criar-prosp')?.addEventListener('click', async (e) => {
    e.target.disabled = true;
    try { await q(sb.from('prospeccoes').insert({ conta_id: c.id, sdr: S.papel === 'sdr' ? S.nome : null, proximo_toque: hoje(), criado_por: S.user.email })); S.sujo = true; recarregar(); } catch { e.target.disabled = false; }
  });
  $('#criar-lead')?.addEventListener('click', async (e) => {
    e.target.disabled = true;
    try { await q(sb.from('leads').insert({ conta_id: c.id, prospeccao_id: p?.id || null, responsavel: S.nome, origem: c.origem, status: 'Em contato', proxima_acao: 'Retomar conversa', data_proxima_acao: hoje(), criado_por: S.user.email })); S.sujo = true; recarregar(); } catch { e.target.disabled = false; }
  });
  aoEnviar($('#f-conta'), async (e) => {
    const d = Object.fromEntries(new FormData(e.target)); for (const k in d) if (d[k] === '') d[k] = null;
    if (d.whatsapp) { let wa = digitos(d.whatsapp); if (wa.length <= 11) wa = '55' + wa; d.whatsapp = wa; }
    if (d.uf) d.uf = d.uf.toUpperCase();
    if (d.email) d.email = d.email.toLowerCase();
    if (d.endereco !== c.endereco || d.cidade !== c.cidade) { d.lat = null; d.lng = null; }
    await atualizar('contas', d, c.id); aviso('Dados salvos.'); recarregar();
  });
  aoEnviar($('#f-visita'), async (e) => {
    const d = Object.fromEntries(new FormData(e.target));
    await q(sb.from('visitas').insert({ conta_id: c.id, situacao: d.situacao, data_visita: d.data_visita || null, hora: d.hora || null, agendado_por: S.nome, criado_por: S.user.email }));
    aviso('Visita registrada.'); recarregar();
  });
  document.querySelectorAll('[data-vis]').forEach((b) => (b.onclick = () => resultadoVisita(vis.find((v) => v.id === b.dataset.vis), recarregar)));
}

function resultadoVisita(v, depois) {
  if (!v) return;
  $('#f-res')?.closest('.cartao')?.remove();
  const box = document.createElement('div');
  box.className = 'cartao';
  box.innerHTML = `<h2>Atualizar visita</h2><form class="grade" id="f-res">
    <div><label>Situação</label><select name="situacao">${opts(['agendada', 'realizada', 'reagendar', 'cancelada', 'a agendar'], v.situacao)}</select></div>
    <div><label>Resultado</label><select name="resultado">${opts(['', 'pedido', 'catálogo / retorno', 'sem interesse', 'reagendar', 'loja fechada'], v.resultado || '')}</select></div>
    <div><label>Valor do pedido (R$)</label><input type="number" step="0.01" name="valor_pedido" value="${esc(v.valor_pedido ?? '')}"></div>
    <div><label>Data da visita</label><input type="date" name="data_visita" value="${esc(v.data_visita || '')}"></div>
    <div><label>Hora</label><input name="hora" value="${esc(v.hora || '')}"></div>
    <div class="largo"><label>Observações</label><textarea name="observacoes">${esc(v.observacoes)}</textarea></div>
    <div class="largo"><button class="primario">Salvar</button></div></form>`;
  $('#modal-corpo').prepend(box); box.scrollIntoView({ behavior: 'smooth' });
  aoEnviar($('#f-res'), async (e) => {
    const d = Object.fromEntries(new FormData(e.target));
    const upd = { situacao: d.situacao, resultado: d.resultado || null, valor_pedido: d.valor_pedido === '' ? null : +d.valor_pedido, observacoes: d.observacoes || null, data_visita: d.data_visita || null, hora: d.hora || null };
    if (d.situacao === 'realizada' && v.situacao !== 'realizada') upd.checkin_em = new Date().toISOString();
    // Reagendar com nova data volta a ser uma visita agendada
    if (d.situacao === 'reagendar' && d.data_visita && d.data_visita !== v.data_visita) upd.situacao = 'agendada';
    await atualizar('visitas', upd, v.id); aviso('Visita atualizada.'); depois();
  });
}

// ---------- Visitas / roteirizador ----------
const podeMontarRoteiro = () => ['gestor', 'vendas'].includes(S.papel);
async function telaVisitas() {
  const app = $('#app');
  const rotaAtual = S.rota || 'R9';
  app.innerHTML = `<div class="cartao"><div class="barra">
      <div><label>Rota</label><select id="v-rota">${Object.keys(ROTAS).map((r) => `<option ${r === rotaAtual ? 'selected' : ''} value="${r}">${r} · ${esc(ROTAS[r])}</option>`).join('')}</select></div>
      <div><label>Mostrar</label><select id="v-filtro">${opts(['todas', 'agendadas', 'quentes'], S.filtroVis || 'todas').replace('>todas<', '>Todas as lojas da rota<').replace('>agendadas<', '>Só com visita agendada<').replace('>quentes<', '>Clientes, qualificados e leads abertos<')}</select></div>
      ${podeMontarRoteiro() ? '<div class="acoes"><button class="primario" id="v-montar">Montar roteiro com as marcadas</button></div>' : ''}
    </div><small>${podeMontarRoteiro()
      ? 'Marque as lojas e monte o roteiro: a ordem sai de Jaguariúna pela loja mais próxima. Endereços sem coordenada são localizados uma vez (OpenStreetMap, ~1 por segundo) e ficam salvos.'
      : 'Agende as visitas pela ficha de cada loja; o Pedro monta o roteiro.'}</small></div>
    <div id="v-lista">Carregando…</div><div id="v-roteiros"></div>`;
  const carregar = async () => {
    const rota = $('#v-rota').value; const filtro = $('#v-filtro').value;
    S.rota = rota; S.filtroVis = filtro;
    const [contas, pros, leads, vis] = await Promise.all([
      q(sb.from('contas').select('*').eq('rota', rota).order('cidade')),
      q(sb.from('v_prospeccoes').select('conta_id,codigo,status,sdr,alerta').eq('rota', rota)),
      q(sb.from('v_leads').select('conta_id,codigo,status,tipo_status').eq('rota', rota)),
      q(sb.from('visitas').select('*').in('situacao', ['a agendar', 'agendada', 'reagendar'])),
    ]);
    const mp = Object.fromEntries(pros.map((p) => [p.conta_id, p])); const ml = Object.fromEntries(leads.map((l) => [l.conta_id, l])); const mv = {};
    vis.forEach((v) => { if (!mv[v.conta_id] || !v.roteiro_id) mv[v.conta_id] = v; });
    let lista = contas.filter((c) => !['6. Fora do ICP', '5. Sem interesse'].includes(mp[c.id]?.status));
    if (filtro === 'agendadas') lista = lista.filter((c) => mv[c.id]);
    if (filtro === 'quentes') lista = lista.filter((c) => ml[c.id]?.tipo_status === 'Aberto' || ml[c.id]?.status === 'Pedido fechado' || ['8. Qualificado → Pedro', '0. Já é cliente', '9. Virou cliente'].includes(mp[c.id]?.status));
    S.cache.vis = { lista };
    $('#v-lista').innerHTML = lista.length ? `<div class="rolagem"><table class="tabela"><thead><tr>${podeMontarRoteiro() ? '<th></th>' : ''}<th>Loja</th><th>Cidade</th><th>Situação no CRM</th><th class="oculta-cel">Visita</th></tr></thead><tbody>
      ${lista.map((c) => { const p = mp[c.id]; const l = ml[c.id]; const v = mv[c.id];
        // marca sozinho só a visita pendente que ainda não está em outro roteiro
        return `<tr>${podeMontarRoteiro() ? `<td><input type="checkbox" class="v-marca" value="${esc(c.id)}" ${v && !v.roteiro_id ? 'checked' : ''}></td>` : ''}<td class="clicavel" data-conta="${esc(c.id)}"><b>${esc(c.nome)}</b><br><small>${esc(c.endereco || '')}</small></td><td>${esc(c.cidade || '')}</td>
        <td>${p ? seloStatus(p.status) : ''} ${l ? seloStatus(l.status) : ''}<br><small>${p?.sdr ? 'SDR ' + esc(p.sdr) : ''}</small></td><td class="oculta-cel">${v ? `${esc(v.situacao)} ${dataBR(v.data_visita)} ${esc(v.hora || '')}${v.roteiro_id ? ' · em roteiro' : ''}` : ''}</td></tr>`; }).join('')}
      </tbody></table></div>` : '<div class="cartao vazio">Nenhuma loja nesta rota com esse filtro.</div>';
    $('#v-lista').querySelectorAll('[data-conta]').forEach((td) => (td.onclick = () => abrirConta(td.dataset.conta)));
    listarRoteiros();
  };
  $('#v-rota').onchange = carregar; $('#v-filtro').onchange = carregar;
  if ($('#v-montar')) $('#v-montar').onclick = montarRoteiro;
  carregar();
}

async function geocodificar(c) {
  if (c.lat && c.lng) return c;
  const consulta = [c.endereco, c.cidade, c.uf, 'Brasil'].filter(Boolean).join(', ');
  try {
    await new Promise((r) => setTimeout(r, 1100)); // respeita o limite do OpenStreetMap (1 por segundo)
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(consulta)}`);
    let js = await res.json();
    let porCidade = false;
    if (!js.length && c.cidade) {
      await new Promise((r) => setTimeout(r, 1100));
      js = await (await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent([c.cidade, c.uf, 'Brasil'].join(', '))}`)).json();
      porCidade = true;
    }
    if (js.length) {
      c.lat = +js[0].lat; c.lng = +js[0].lon;
      // só grava a coordenada exata do endereço; a do centro da cidade serve só para ordenar este roteiro
      if (!porCidade) await sb.from('contas').update({ lat: c.lat, lng: c.lng }).eq('id', c.id);
    }
  } catch (e) { console.warn('geocodificação falhou', c.nome, e); }
  return c;
}
const distKm = (a, b) => { const R = 6371, rad = Math.PI / 180; const dLa = (b.lat - a.lat) * rad, dLo = (b.lng - a.lng) * rad; const h = Math.sin(dLa / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLo / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };

async function montarRoteiro() {
  if (!podeMontarRoteiro()) return aviso('Só o gestor e vendas montam roteiros.', true);
  const bt = $('#v-montar'); if (bt.disabled) return;
  const ids = [...document.querySelectorAll('.v-marca:checked')].map((i) => i.value);
  if (!ids.length) return aviso('Marque as lojas do roteiro.', true);
  bt.disabled = true;
  try {
    const contas = S.cache.vis.lista.filter((c) => ids.includes(c.id)).map((c) => ({ ...c }));
    const falta = contas.filter((c) => !c.lat);
    let i = 0;
    for (const c of contas) { if (!c.lat) aviso(`Localizando endereços: ${++i} de ${falta.length}…`, false, 0); await geocodificar(c); }
    $('#aviso').hidden = true;
    const comCoord = contas.filter((c) => c.lat); const semCoord = contas.filter((c) => !c.lat);
    const ordem = []; let atual = BASE; const resto = [...comCoord]; let km = 0;
    while (resto.length) { resto.sort((a, b) => distKm(atual, a) - distKm(atual, b)); const prox = resto.shift(); km += distKm(atual, prox); ordem.push(prox); atual = prox; }
    km += ordem.length ? distKm(atual, BASE) : 0;
    const final = [...ordem, ...semCoord];
    const pontos = final.map((c) => [c.endereco, c.cidade, c.uf].filter(Boolean).join(', ') || c.nome);
    const trechos = []; const todos = [BASE.nome, ...pontos, BASE.nome];
    for (let k = 0; k < todos.length - 1; k += 9) trechos.push(todos.slice(k, k + 10));
    const rota = $('#v-rota').value;
    abrirModal(`<h2>Roteiro · ${esc(ROTAS[rota])}</h2>
      <p>${final.length} paradas · ~${Math.round(km * 1.25)} km rodoviários estimados (linha reta × 1,25) ${semCoord.length ? `· ${semCoord.length} sem localização (no fim da lista)` : ''}</p>
      <div class="links">${trechos.map((t, k) => `<a target="_blank" rel="noopener" href="${esc('https://www.google.com/maps/dir/' + t.map(encodeURIComponent).join('/'))}">🗺️ Trecho ${k + 1} no Google Maps</a>`).join('')}</div>
      <div>${final.map((c, k) => `<div class="parada"><div class="n">${k + 1}</div><div><b>${esc(c.nome)}</b><small>${esc(c.endereco || '')} · ${esc(c.cidade || '')}</small></div><div>${waLink(c) ? `<a class="botao pequeno" target="_blank" rel="noopener" href="${esc(waLink(c))}">💬</a>` : ''}</div></div>`).join('')}</div>
      <form id="f-rot" class="grade" style="margin-top:12px"><div class="largo"><label>Nome do roteiro</label><input name="nome" value="${esc(rota)} · ${dataBR(hoje())}"></div>
        <div><label>Início</label><input type="date" name="data_inicio"></div><div><label>Fim</label><input type="date" name="data_fim"></div>
        <div><label>Custo previsto (R$)</label><input type="number" name="custo" value="${Math.round(km * 1.25 * 1.12 + 270)}"></div>
        <div class="largo"><button class="primario">Salvar roteiro e marcar visitas</button></div></form>`);
    aoEnviar($('#f-rot'), async (e) => {
      const d = Object.fromEntries(new FormData(e.target));
      // visitas pendentes lidas agora (não do cache), para não duplicar nem tirar paradas de outro roteiro
      const pend = await q(sb.from('visitas').select('id,conta_id,roteiro_id').in('conta_id', final.map((c) => c.id)).in('situacao', ['a agendar', 'agendada', 'reagendar']));
      const livres = Object.fromEntries(pend.filter((v) => !v.roteiro_id).map((v) => [v.conta_id, v]));
      const r = await q(sb.from('roteiros').insert({ nome: d.nome, rota, data_inicio: d.data_inicio || null, data_fim: d.data_fim || null, km_previsto: Math.round(km * 1.25), custo_previsto: d.custo || null, criado_por: S.user.email }).select('id').single());
      for (const [k, c] of final.entries()) {
        const v = livres[c.id];
        if (v) await atualizar('visitas', { roteiro_id: r.id, ordem: k + 1 }, v.id);
        else await q(sb.from('visitas').insert({ conta_id: c.id, roteiro_id: r.id, ordem: k + 1, situacao: 'a agendar', agendado_por: S.nome, criado_por: S.user.email }));
      }
      aviso('Roteiro salvo.'); S.sujo = true; fecharModal();
    });
  } finally { bt.disabled = false; }
}

async function listarRoteiros() {
  const rots = await q(sb.from('roteiros').select('*, visitas(id,ordem,situacao,resultado,valor_pedido,data_visita,hora,conta_id,contas(nome,cidade,endereco,whatsapp,telefone))').order('criado_em', { ascending: false }).limit(20));
  $('#v-roteiros').innerHTML = rots.length ? `<h2 style="margin-top:16px">Roteiros</h2>${rots.map((r) => {
    const vs = (r.visitas || []).sort((a, b) => (a.ordem || 99) - (b.ordem || 99));
    const feitas = vs.filter((v) => v.situacao === 'realizada').length; const pedidos = vs.reduce((s, v) => s + (+v.valor_pedido || 0), 0);
    return `<div class="cartao"><h3>${esc(r.nome)} · ${esc(r.status)}</h3><small>${dataBR(r.data_inicio)} a ${dataBR(r.data_fim)} · ${vs.length} paradas · ${feitas} realizadas · pedidos ${brl(pedidos)} · ~${r.km_previsto || '?'} km · custo previsto ${brl(r.custo_previsto)}${r.custo_real ? ' · custo real ' + brl(r.custo_real) : ''}</small>
      <div class="links"><button class="botao pequeno" data-prestacao="${esc(r.id)}">🧾 Prestação de contas</button></div>
      <div>${vs.map((v) => `<div class="parada"><div class="n">${v.ordem || '-'}</div><div class="clicavel" data-conta="${v.conta_id}"><b>${esc(v.contas?.nome)}</b><small>${esc(v.contas?.cidade || '')} · ${esc(v.situacao)} ${v.data_visita ? dataBR(v.data_visita) : ''} ${esc(v.hora || '')} ${v.resultado ? '· ' + esc(v.resultado) : ''}</small></div>
        <div>${waLink(v.contas || {}) ? `<a class="botao pequeno" target="_blank" href="${waLink(v.contas)}">💬</a>` : ''}</div></div>`).join('')}</div></div>`; }).join('')}` : '';
  $('#v-roteiros').querySelectorAll('[data-conta]').forEach((el) => (el.onclick = () => abrirConta(el.dataset.conta)));
  $('#v-roteiros').querySelectorAll('[data-prestacao]').forEach((b) => (b.onclick = () => prestacaoContas(rots.find((r) => r.id === b.dataset.prestacao))));
}

// ---------- Prestação de contas da viagem (formato do Financeiro, 16/11/2026) ----------
const CATEGORIAS_DESP = ['Combustível', 'Hotel, pedágio e estacionamento', 'Alimentação', 'Manutenção do veículo'];
const FORMAS_PAG = ['Cartão da empresa', 'Pix da empresa', 'Pago pelo Pedro (reembolso)'];
const PRIMEIRO_PEDIDO_BASE = 3000; // Financeiro, 16/11: base R$ 3,0 mil (R$ 3,9 mil = cenário otimista)
const MER_MIN_B2B = 6.5; // custo de visita por 1º pedido ≤ 1º pedido ÷ 6,5
const marcadorViagem = (r) => `VIAGEM-${(r.data_inicio || hoje()).replaceAll('-', '')}-${r.rota || 'SEM-ROTA'}`;

async function prestacaoContas(r) {
  if (!r) return;
  const podeEditar = ['gestor', 'vendas'].includes(S.papel);
  const desp = await q(sb.from('despesas_viagem').select('*').eq('roteiro_id', r.id).order('data'));
  const vs = (r.visitas || []).sort((a, b) => (a.ordem || 99) - (b.ordem || 99));
  const total = desp.reduce((s, d) => s + +d.valor, 0);
  const porCat = CATEGORIAS_DESP.map((c) => [c, desp.filter((d) => d.categoria === c).reduce((s, d) => s + +d.valor, 0)]);
  const reembolso = desp.filter((d) => d.forma_pagamento === 'Pago pelo Pedro (reembolso)').reduce((s, d) => s + +d.valor, 0);
  const pedidos = vs.filter((v) => v.resultado === 'pedido');
  const km = r.km_saida != null && r.km_volta != null ? r.km_volta - r.km_saida : null;
  const teto = PRIMEIRO_PEDIDO_BASE / MER_MIN_B2B;
  const custoPorPedido = pedidos.length ? total / pedidos.length : null;
  const marcador = r.marcador_tiny || marcadorViagem(r);
  abrirModal(`<h2>Prestação de contas · ${esc(r.nome)}</h2>
    <p>Marcador no Tiny: <b>${esc(marcador)}</b> · ${vs.length} paradas · ${vs.filter((v) => v.situacao === 'realizada').length} visitas realizadas · ${pedidos.length} pedido(s) ${brl(pedidos.reduce((s, v) => s + (+v.valor_pedido || 0), 0))}</p>
    <div class="kpis">
      <div class="kpi"><b>${brl(total)}</b><span>Total de despesas</span></div>
      <div class="kpi"><b>${km != null ? km.toLocaleString('pt-BR') + ' km' : '—'}</b><span>Km rodados (odômetro)</span></div>
      <div class="kpi"><b>${brl(reembolso)}</b><span>A reembolsar ao Pedro</span></div>
      <div class="kpi"><b>${custoPorPedido != null ? brl(custoPorPedido) : '—'}</b><span>Custo por pedido · teto ${brl(teto)} (1º pedido ÷ ${String(MER_MIN_B2B).replace('.', ',')})</span></div>
    </div>
    <div class="cartao"><h3>Viagem</h3><form id="f-viagem" class="grade">
      <div><label>Saída</label><input type="date" name="data_inicio" value="${r.data_inicio || ''}" ${podeEditar ? '' : 'disabled'}></div>
      <div><label>Volta</label><input type="date" name="data_fim" value="${r.data_fim || ''}" ${podeEditar ? '' : 'disabled'}></div>
      <div><label>Odômetro na saída (km)</label><input type="number" name="km_saida" value="${r.km_saida ?? ''}" ${podeEditar ? '' : 'disabled'}></div>
      <div><label>Odômetro na volta (km)</label><input type="number" name="km_volta" value="${r.km_volta ?? ''}" ${podeEditar ? '' : 'disabled'}></div>
      <div><label>Situação</label><select name="status" ${podeEditar ? '' : 'disabled'}>${opts(['planejado', 'em andamento', 'concluído', 'cancelado'], r.status)}</select></div>
      ${podeEditar ? '<div class="largo"><button class="botao">Salvar dados da viagem</button></div>' : ''}</form></div>
    <div class="cartao"><h3>Despesas</h3>
      ${desp.length ? `<table class="tabela"><thead><tr><th>Data</th><th>Categoria</th><th>Valor</th><th class="oculta-cel">Fornecedor</th><th class="oculta-cel">Pagamento</th><th>Comprovante</th>${podeEditar ? '<th></th>' : ''}</tr></thead><tbody>
        ${desp.map((d) => `<tr><td>${dataBR(d.data)}</td><td>${esc(d.categoria)}<br><small>${esc(d.conta_tiny)}</small></td><td>${brl(d.valor)}</td><td class="oculta-cel">${esc(d.fornecedor || '')}<br><small>${esc(d.cnpj_fornecedor || '')}${d.nota_cnpj_indiao ? ' · nota no CNPJ da Indião' : ''}</small></td><td class="oculta-cel">${esc(d.forma_pagamento)}</td>
          <td>${d.comprovante_path ? `<a href="#" data-comp="${esc(d.comprovante_path)}">ver</a>` : '<span class="selo alerta">falta</span>'}</td>${podeEditar ? `<td><button class="botao pequeno" data-apaga-desp="${esc(d.id)}">apagar</button></td>` : ''}</tr>`).join('')}
      </tbody></table>` : '<p class="vazio">Nenhuma despesa lançada.</p>'}
      <p><small>${porCat.filter(([, v]) => v).map(([c, v]) => `${esc(c)}: ${brl(v)}`).join(' · ')}</small></p>
      ${podeEditar ? `<h3>+ Lançar despesa</h3><form id="f-desp" class="grade">
        <div><label>Data</label><input type="date" name="data" value="${hoje()}" required></div>
        <div><label>Categoria</label><select name="categoria">${opts(CATEGORIAS_DESP, 'Combustível')}</select></div>
        <div><label>Valor (R$)</label><input type="number" step="0.01" min="0.01" name="valor" required></div>
        <div><label>Forma de pagamento</label><select name="forma_pagamento">${opts(FORMAS_PAG, 'Cartão da empresa')}</select></div>
        <div><label>Fornecedor</label><input name="fornecedor"></div>
        <div><label>CNPJ do fornecedor</label><input name="cnpj_fornecedor"></div>
        <div class="largo"><label><input type="checkbox" name="nota_cnpj_indiao" style="width:auto"> Nota/cupom emitido no CNPJ da Indião (61.168.071/0001-92)</label></div>
        <div class="largo"><label>Foto do comprovante</label><input type="file" name="foto" accept="image/*,application/pdf" capture="environment"></div>
        <div class="largo"><label>Observações</label><input name="observacoes"></div>
        <div class="largo"><button class="primario">Lançar despesa</button></div></form>` : ''}
    </div>
    <div class="links"><button class="botao" id="exp-prest">⬇️ Exportar prestação de contas (CSV)</button></div>`);

  const recarregar = async () => { const nr = await q(sb.from('roteiros').select('*, visitas(id,ordem,situacao,resultado,valor_pedido,data_visita,hora,conta_id,contas(nome,cidade,endereco,whatsapp,telefone))').eq('id', r.id).single()); prestacaoContas(nr); };
  aoEnviar($('#f-viagem'), async (e) => {
    const d = Object.fromEntries(new FormData(e.target));
    const upd = { data_inicio: d.data_inicio || null, data_fim: d.data_fim || null, km_saida: d.km_saida === '' ? null : +d.km_saida, km_volta: d.km_volta === '' ? null : +d.km_volta, status: d.status };
    if (upd.km_saida != null && upd.km_volta != null && upd.km_volta < upd.km_saida) { aviso('O odômetro da volta está menor que o da saída.', true); return; }
    upd.marcador_tiny = marcadorViagem({ ...r, ...upd });
    await atualizar('roteiros', upd, r.id); aviso('Viagem salva.'); recarregar();
  });
  aoEnviar($('#f-desp'), async (e) => {
    const f = e.target; const d = Object.fromEntries(new FormData(f));
    let caminho = null; const arq = f.foto.files[0];
    if (arq) {
      const ext = (arq.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
      caminho = `${r.id}/${Date.now()}-${d.categoria.slice(0, 4).toLowerCase()}.${ext}`;
      const { error } = await sb.storage.from('comprovantes').upload(caminho, arq, { contentType: arq.type || undefined });
      if (error) { aviso('Falha ao enviar a foto: ' + error.message, true); return; }
    }
    await q(sb.from('despesas_viagem').insert({ roteiro_id: r.id, data: d.data, categoria: d.categoria, valor: +d.valor, forma_pagamento: d.forma_pagamento, fornecedor: d.fornecedor || null, cnpj_fornecedor: d.cnpj_fornecedor || null, nota_cnpj_indiao: !!d.nota_cnpj_indiao, comprovante_path: caminho, observacoes: d.observacoes || null, criado_por: S.user.email }));
    aviso('Despesa lançada.'); recarregar(); // o total da viagem (custo_real) é recalculado pelo banco
  });
  document.querySelectorAll('[data-apaga-desp]').forEach((b) => (b.onclick = async () => {
    const d = desp.find((x) => x.id === b.dataset.apagaDesp); if (!d) return;
    if (!confirm(`Apagar ${d.categoria} de ${dataBR(d.data)} (${brl(d.valor)})? A foto do comprovante também será apagada.`)) return;
    b.disabled = true;
    await q(sb.from('despesas_viagem').delete().eq('id', d.id));
    if (d.comprovante_path) await sb.storage.from('comprovantes').remove([d.comprovante_path]);
    aviso('Despesa apagada.'); recarregar();
  }));
  document.querySelectorAll('[data-comp]').forEach((a) => (a.onclick = async (e) => {
    e.preventDefault();
    const { data, error } = await sb.storage.from('comprovantes').createSignedUrl(a.dataset.comp, 600);
    if (error) return aviso(error.message, true);
    window.open(data.signedUrl, '_blank');
  }));
  $('#exp-prest').onclick = () => {
    const cab = [
      ['Marcador Tiny', marcador], ['Roteiro', r.nome], ['Rota', r.rota || ''], ['Saída', dataBR(r.data_inicio)], ['Volta', dataBR(r.data_fim)],
      ['Odômetro saída', r.km_saida ?? ''], ['Odômetro volta', r.km_volta ?? ''], ['Km rodados', km ?? ''],
      ['Lojistas visitados (ID CRM)', vs.filter((v) => v.situacao === 'realizada').map((v) => v.contas?.nome).join(' | ')],
      ['Total de despesas', total.toFixed(2).replace('.', ',')], ['A reembolsar ao Pedro', reembolso.toFixed(2).replace('.', ',')],
    ];
    const linhas = desp.map((d) => ({ data: dataBR(d.data), categoria: d.categoria, conta_tiny: d.conta_tiny, valor: String(d.valor).replace('.', ','), fornecedor: d.fornecedor || '', cnpj_fornecedor: d.cnpj_fornecedor || '', forma_pagamento: d.forma_pagamento, nota_cnpj_indiao: d.nota_cnpj_indiao ? 'sim' : 'não', comprovante: d.comprovante_path ? 'sim' : 'FALTA', observacoes: d.observacoes || '' }));
    const csvCab = cab.map(([k, v]) => `${celulaCSV(k)};${celulaCSV(v)}`).join('\n');
    const cols = ['data', 'categoria', 'conta_tiny', 'valor', 'fornecedor', 'cnpj_fornecedor', 'forma_pagamento', 'nota_cnpj_indiao', 'comprovante', 'observacoes'];
    const csvDesp = [cols.join(';'), ...linhas.map((l) => cols.map((c) => celulaCSV(l[c])).join(';'))].join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + csvCab + '\n\n' + csvDesp], { type: 'text/csv;charset=utf-8' })); a.download = `${marcador}.csv`; a.click();
  };
}

// ---------- Usuários (gestor) ----------
async function telaUsuarios() {
  const app = $('#app');
  const perfis = await q(sb.from('perfis').select('*').order('nome'));
  app.innerHTML = `<div class="cartao"><h2>Usuários do CRM</h2>
    <table class="tabela"><thead><tr><th>Nome</th><th>E-mail</th><th>Papel</th><th>Ativo</th></tr></thead><tbody>
    ${perfis.map((p) => `<tr><td>${esc(p.nome)}</td><td>${esc(p.email)}</td><td><select data-papel="${esc(p.email)}">${opts(['gestor', 'vendas', 'sdr'], p.papel)}</select></td><td><input type="checkbox" data-ativo="${esc(p.email)}" ${p.ativo ? 'checked' : ''}></td></tr>`).join('')}
    </tbody></table>
    <h3>Adicionar usuário</h3>
    <form id="f-user" class="grade"><div><label>Nome (como aparece no CRM: Pedro, Lucas, Ian…)</label><input name="nome" required></div>
      <div><label>E-mail</label><input name="email" type="email" required></div>
      <div><label>Papel</label><select name="papel">${opts(['sdr', 'vendas', 'gestor'], 'sdr')}</select></div>
      <div><label>Nome no Olist Tiny</label><input name="nome_tiny"></div>
      <div class="largo"><button class="primario">Liberar acesso</button> <small>A pessoa entra em crm.indiaostore.com.br com esse e-mail.</small></div></form>
    <h3>Exportar</h3><div class="links"><a href="#" id="exp-p">⬇️ Prospecção (CSV)</a><a href="#" id="exp-l">⬇️ Leads (CSV)</a></div></div>`;
  app.querySelectorAll('[data-papel]').forEach((s) => (s.onchange = async () => { await q(sb.from('perfis').update({ papel: s.value }).eq('email', s.dataset.papel)); aviso('Papel atualizado.'); }));
  app.querySelectorAll('[data-ativo]').forEach((c) => (c.onchange = async () => { await q(sb.from('perfis').update({ ativo: c.checked }).eq('email', c.dataset.ativo)); aviso('Atualizado.'); }));
  aoEnviar($('#f-user'), async (e) => {
    const d = Object.fromEntries(new FormData(e.target)); d.email = d.email.toLowerCase().trim(); d.nome = d.nome.trim(); if (!d.nome_tiny) d.nome_tiny = null;
    await q(sb.from('perfis').insert(d)); aviso(`Acesso liberado para ${d.nome}. O nome precisa ser igual ao usado no CRM (ex.: Lucas, Ian).`); telaUsuarios();
  });
  $('#exp-p').onclick = async (e) => { e.preventDefault(); baixarCSV('prospeccao.csv', await q(sb.from('v_prospeccoes').select('*'))); };
  $('#exp-l').onclick = async (e) => { e.preventDefault(); baixarCSV('leads.csv', await q(sb.from('v_leads').select('*'))); };
}
function baixarCSV(nome, linhas) {
  if (!linhas.length) return;
  const cols = Object.keys(linhas[0]);
  const csv = [cols.join(';'), ...linhas.map((l) => cols.map((c) => celulaCSV(l[c])).join(';'))].join('\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })); a.download = nome; a.click();
}

// ---------- modal ----------
function abrirModal(html) { $('#modal-corpo').innerHTML = html; $('#modal').hidden = false; document.body.style.overflow = 'hidden'; }
// Ao fechar a ficha, recarrega a tela atual se algo foi gravado (os filtros são restaurados)
function fecharModal() {
  $('#modal').hidden = true; document.body.style.overflow = '';
  if (S.sujo || S.aba === 'inicio') { S.sujo = false; irPara(S.aba); }
}
$('#modal-fechar').onclick = fecharModal;
$('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal') fecharModal(); });
window.addEventListener('hashchange', () => { if (S.papel && location.hash.slice(1) !== S.aba) irPara(location.hash.slice(1)); });
