// CRM Indião Store v3 — o painel do Apps Script (crm.html) portado para o Supabase, 16/11/2026.
// As telas, cartões, regras de alerta e roteiros são os do painel antigo; o que mudou é de onde vêm os dados:
// as funções google.script.run (CRM.gs) viraram funções do banco (crm_boot, crm_update_lead etc.).
// Novidades da v3: login por e-mail, aba Visitas (roteiros e prestação de contas) e "Nova loja" para os SDRs.
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';

var SUPABASE_URL = 'https://lnihrsdpogrtoqodbmtu.supabase.co';
var SUPABASE_KEY = 'sb_publishable_4IH9InQvatRxrUMX34yrZg_s8bzaEFS';
var sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });

var LOGADO = false;
// Dados do painel (mesmo formato do bootstrap antigo). Começa vazio até o login.
var D = { me: '', admin: false, papel: '', today: new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' }), status: [], pvStatus: [], sellers: [], origens: [], temps: [], motivos: [], ufs: [], fuTipos: [], leads: [], pv: [], prosp: null };

// Mesmas chamadas do painel antigo, agora no Supabase
var RPC = {
  crmReload: function () { return ['crm_boot', {}]; },
  crmUpdateLead: function (id, ch) { return ['crm_update_lead', { p_id: id, ch: ch }]; },
  crmUpdateProsp: function (id, ch) { return ['crm_update_prosp', { p_id: id, ch: ch }]; },
  crmUpdatePV: function (id, ch) { return ['crm_update_pv', { p_id: id, ch: ch }]; },
  crmAddLead: function (f) { return ['crm_add_lead', { f: f }]; },
  crmAddProsp: function (f) { return ['crm_add_prosp', { f: f }]; },
  crmHistory: function (id) { return ['crm_history', { p_id: id }]; }
};
function traduzErro(m) {
  m = String(m || '');
  if (/JWT|token/i.test(m)) return 'Sua sessão expirou. Recarregue a página e entre de novo.';
  if (/Failed to fetch|NetworkError|network/i.test(m)) return 'Sem conexão com a internet. Tente de novo.';
  if (/row-level security/i.test(m)) return 'Você não tem permissão para essa alteração.';
  if (/leads_um_aberto_por_conta/.test(m)) return 'Esta loja já tem um lead aberto.';
  return m;
}

/* ===================== painel (crm.html do Apps Script) ===================== */
var PENA = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 19.0 58.0"><path fill="currentColor" d="M16.5 0.4 L14.8 1.2 L12.4 3.0 L10.5 4.9 L8.7 7.2 L8.5 7.6 L9.3 9.0 L10.1 9.9 L9.9 10.1 L9.1 10.0 L7.5 9.3 L7.2 9.6 L5.8 12.4 L5.0 14.5 L6.2 16.2 L7.6 17.5 L7.3 17.6 L6.4 17.3 L4.4 16.1 L2.8 21.3 L4.0 23.0 L6.0 24.9 L6.0 25.1 L5.8 25.2 L4.2 24.8 L2.3 23.9 L1.9 25.6 L1.9 26.3 L1.7 26.7 L1.8 26.9 L1.3 29.6 L1.4 29.9 L2.7 31.8 L5.1 34.2 L4.7 34.3 L3.4 33.6 L1.1 31.7 L0.8 34.9 L5.0 39.0 L4.7 39.1 L0.7 37.2 L0.6 37.8 L4.8 40.7 L4.9 40.9 L4.8 41.0 L0.8 39.8 L0.5 39.9 L0.5 40.4 L5.0 42.9 L4.2 43.0 L3.7 42.8 L3.0 42.8 L0.5 42.3 L0.4 42.6 L0.7 43.0 L4.6 44.9 L5.1 45.3 L4.5 45.4 L0.5 44.8 L0.5 45.5 L4.7 47.4 L5.3 47.8 L4.6 47.9 L3.9 47.7 L3.5 47.8 L1.4 47.5 L0.5 47.5 L0.4 47.8 L0.5 48.1 L3.2 49.4 L4.8 49.9 L6.6 50.2 L6.8 51.7 L6.7 51.9 L7.5 57.5 L9.8 57.1 L9.2 53.4 L9.3 53.3 L9.1 52.7 L9.2 52.5 L9.0 51.8 L9.1 51.4 L8.9 50.3 L9.1 50.1 L10.7 49.9 L12.9 49.2 L14.9 48.2 L15.0 47.7 L12.9 47.7 L10.7 47.9 L10.6 47.7 L11.3 47.3 L15.3 45.8 L15.3 45.2 L14.1 45.2 L13.4 45.4 L13.0 45.3 L12.2 45.5 L11.8 45.4 L11.1 45.6 L10.9 45.4 L11.7 44.9 L15.7 43.2 L15.8 42.6 L14.8 42.6 L12.5 43.0 L12.3 42.9 L11.7 43.1 L11.1 43.0 L13.7 41.6 L16.0 40.6 L16.1 39.9 L14.2 40.3 L11.6 41.1 L11.3 41.0 L16.3 38.2 L16.4 37.5 L11.6 39.4 L11.4 39.2 L16.8 34.7 L17.0 32.7 L14.4 34.0 L11.6 34.8 L11.0 34.8 L10.8 34.6 L11.1 34.3 L14.9 32.4 L17.2 30.9 L17.3 30.6 L17.2 30.5 L17.4 29.7 L17.3 29.5 L17.5 28.7 L17.5 27.5 L17.9 24.4 L16.1 25.0 L13.9 25.5 L11.9 25.7 L11.7 25.5 L11.8 25.3 L15.6 23.2 L18.1 21.4 L18.4 16.6 L16.5 17.4 L14.8 17.9 L13.1 18.2 L12.9 18.0 L13.2 17.7 L14.6 17.1 L16.1 16.2 L17.3 15.3 L18.5 14.1 L18.4 10.6 L18.1 10.8 L18.0 10.7 L16.6 11.1 L14.8 11.1 L14.5 10.9 L14.8 10.5 L16.0 9.9 L17.1 9.1 L18.2 8.0 L18.4 7.6 L18.0 4.5 L18.1 4.4 L17.8 3.2 L17.9 3.1 L17.3 0.7 L14.5 6.2 L12.8 10.5 L11.5 14.6 L11.6 14.7 L11.4 15.4 L11.2 15.7 L11.3 15.8 L10.7 17.7 L10.8 17.8 L10.4 19.0 L10.5 19.1 L9.9 21.5 L10.0 21.6 L9.6 23.3 L9.0 27.8 L9.1 28.0 L8.9 28.7 L9.0 28.9 L8.8 29.8 L8.9 30.1 L8.7 31.1 L8.7 33.1 L8.5 34.4 L8.5 43.6 L8.8 46.9 L8.7 47.4 L8.9 48.4 L8.8 48.8 L9.0 50.1 L8.6 50.3 L6.8 50.3 L6.5 49.9 L6.6 49.2 L6.4 47.4 L6.4 38.9 L6.7 35.2 L6.6 34.8 L6.8 33.7 L6.7 33.4 L6.9 32.5 L6.8 32.2 L7.3 28.7 L7.3 27.7 L7.5 27.2 L7.4 27.0 L8.1 22.9 L8.3 22.4 L8.2 22.3 L9.3 17.6 L10.9 12.4 L12.8 7.5 L15.1 2.7Z"/></svg>';

var S = { tab: 'hoje', vend: 'Todos', q: '', closed: false, sheet: null, pmode: 'hoje', pmore: 0 };
var ST = {}, PST = {}, XST = {}, GANHO = 'Pedido fechado', PERDIDO = 'Perdido';
var PSK = {};

/* Cores de status na identidade Indião (a planilha continua com as dela) */
var BRAND_ST = {
  'Novo': ['#F6E3DC', '#A2452A'], 'Em contato': ['#ECE7E6', '#261915'], 'Qualificado': ['#E8DCD5', '#3A2822'],
  'Catálogo enviado': ['#DCCAC0', '#261915'], 'Negociação': ['#BD5535', '#FFFFFF'], 'Pedido fechado': ['#2F5D3A', '#FFFFFF'],
  'Nutrição': ['#E4E8DF', '#3E5530'], 'Perdido': ['#D1C9C9', '#261915'], 'Descartado': ['#F1EEEE', '#7D706B'],
  'Onboarding': ['#F6E3DC', '#A2452A'], 'Ativo': ['#2F5D3A', '#FFFFFF'], 'Recompra próxima': ['#FBEEDB', '#8A5200'],
  'Em risco': ['#F8E1DF', '#9B1C1C'], 'Inativo': ['#D1C9C9', '#261915'], 'Encerrado': ['#F1EEEE', '#7D706B']
};
var BRAND_PS = { ABORDAR: ['#FFFFFF', '#5F524D'], CADENCIA: ['#ECE7E6', '#261915'], RESPONDEU: ['#F6E3DC', '#A2452A'],
  SEM_RETORNO: ['#E9DFD9', '#5A463F'], SEM_INTERESSE: ['#D1C9C9', '#261915'], FORA: ['#F1EEEE', '#7D706B'],
  JA_LEAD: ['#E4E8DF', '#3E5530'], JA_CLIENTE: ['#E4E8DF', '#3E5530'], QUALIFICADO: ['#BD5535', '#FFFFFF'], CLIENTE: ['#2F5D3A', '#FFFFFF'] };

function indexLists() {
  ST = {}; PST = {}; XST = {}; PSK = {};
  D.status.forEach(function (s) { var b = BRAND_ST[s.s]; ST[s.s] = { s: s.s, t: s.t, bg: b ? b[0] : s.bg, fg: b ? b[1] : s.fg }; if (s.t === 'Ganho') GANHO = s.s; if (s.t === 'Perdido') PERDIDO = s.s; });
  D.pvStatus.forEach(function (s) { var b = BRAND_ST[s.s]; PST[s.s] = { s: s.s, bg: b ? b[0] : s.bg, fg: b ? b[1] : s.fg }; });
  if (D.prosp) {
    PSK = D.prosp.PS || {};
    Object.keys(PSK).forEach(function (k) { var b = BRAND_PS[k]; if (b) XST[PSK[k]] = { bg: b[0], fg: b[1] }; });
    D.prosp.status.forEach(function (s) { if (!XST[s.s]) XST[s.s] = { bg: s.bg, fg: s.fg }; XST[s.s].d = s.d; });
  }
}
indexLists();

/* ---------- utilidades ---------- */
var ICON = {
  chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8.5 8.5 0 0 1-12.6 7.4L3 21l1.6-5.2A8.5 8.5 0 1 1 21 12z"/></svg>',
  phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/></svg>',
  mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>',
  ig: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>',
  pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
  sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  cols: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="5" height="16" rx="1.5"/><rect x="10" y="4" width="5" height="11" rx="1.5"/><rect x="17" y="4" width="4" height="7" rx="1.5"/></svg>',
  target: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/></svg>',
  chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
  users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6.5 6.5 0 0 1 3.5 5.5"/></svg>'
};
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function dU(iso) { var p = iso.split('-'); return Date.UTC(+p[0], +p[1] - 1, +p[2]); }
function addDays(iso, n) { return new Date(dU(iso) + n * 864e5).toISOString().slice(0, 10); }
// Cadência conta dias úteis (sem sábado, domingo e feriados nacionais); pausas longas contam corrido e caem num dia útil
function diaUtil(iso) { var w = new Date(dU(iso)).getUTCDay(), f = (D.prosp && D.prosp.feriados) || []; return w !== 0 && w !== 6 && f.indexOf(iso) < 0 && f.indexOf(iso.slice(5)) < 0; }
function proxUtil(iso) { while (!diaUtil(iso)) iso = addDays(iso, 1); return iso; }
function addUteis(iso, n) { var k = 0; while (k < n) { iso = addDays(iso, 1); if (diaUtil(iso)) k++; } return iso; }
function dataToque(iso, n) { return n >= 30 ? proxUtil(addDays(iso, n)) : addUteis(iso, n); }
function days(a, b) { return Math.round((dU(b) - dU(a)) / 864e5); }
function br(iso) { if (!iso) return ''; var p = iso.split('-'); return p[2] + '/' + p[1]; }
function msIso(ms) { var d = new Date(ms); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
function rel(iso) {
  if (!iso) return '';
  var n = days(D.today, iso);
  if (n === 0) return 'hoje'; if (n === 1) return 'amanhã'; if (n === -1) return 'ontem';
  if (n > 1 && n < 7) return 'em ' + n + ' dias';
  if (n < -1) return 'há ' + (-n) + ' dias';
  return br(iso);
}
function money(v) { return v === '' || v == null ? '' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }); }
function first(n) { return String(n || '').trim().split(/\s+/)[0] || ''; }
function digits(p) { return String(p || '').replace(/\D/g, ''); }
function euSou(resp) { var n = String(resp || '').trim() || (D.admin ? '' : D.me); return n; }
function waUrl(phone, msg) {
  var d = digits(phone); if (d.length < 10) return '';
  if (d.length <= 11) d = '55' + d;
  return 'https://wa.me/' + d + (msg ? '?text=' + encodeURIComponent(msg) : '');
}
function waLead(phone, nome, resp) {
  var eu = euSou(resp);
  return waUrl(phone, 'Oi' + (first(nome) ? ', ' + first(nome) : '') + '! Tudo bem? ' + (eu ? 'Aqui é ' + eu + ', da Indião Store.' : 'Aqui é da Indião Store.'));
}
function mapUrl(nome, cidade, uf) { var q = [nome, cidade, uf].filter(Boolean).join(' '); return q ? 'https://www.google.com/maps/search/' + encodeURIComponent(q) : ''; }
// Instagram direto no perfil (instagram.com/perfil); sem perfil conhecido, o botão não aparece
function igFind(insta) { return igUrl(insta); }
function quick(wa, ig, map, dataAttr) {
  return '<div class="qa">' + (wa ? '<a class="qb w" href="' + wa + '" target="_blank" rel="noopener" ' + dataAttr + '>' + ICON.chat + '<span>WhatsApp</span></a>' : '') +
    (ig ? '<a class="qb i" href="' + ig + '" target="_blank" rel="noopener">' + ICON.ig + '<span>Instagram</span></a>' : '') +
    (map ? '<a class="qb" href="' + map + '" target="_blank" rel="noopener">' + ICON.pin + '<span>Mapa</span></a>' : '') + '</div>';
}
function igUrl(h) { h = String(h || '').replace(/^@/, '').trim(); return h ? 'https://instagram.com/' + encodeURIComponent(h) : ''; }
function pill(st, map) { var s = (map || ST)[st] || { bg: '#F1EEEE', fg: '#5F524D' }; return st ? '<span class="pill" style="background:' + s.bg + ';color:' + s.fg + (s.bg === '#FFFFFF' ? ';border-color:#D1C9C9' : '') + '">' + esc(st) + '</span>' : ''; }
function sev(a) { return !a ? 9 : a.c === 'red' ? 0 : a.c === 'orange' ? 1 : a.c === 'yellow' ? 2 : 3; }
function penaSvg(cls) { return PENA.replace('<svg ', '<svg class="pena ' + (cls || '') + '" '); }
function toast(msg, err) {
  var t = document.getElementById('toast'); t.textContent = msg; t.className = 'show' + (err ? ' err' : '');
  clearTimeout(toast.h); toast.h = setTimeout(function () { t.className = ''; }, err ? 5000 : 2800);
}
// Antes: google.script.run (CRM.gs). Agora: funções do Supabase com as mesmas regras
function call(fn) {
  var args = [].slice.call(arguments, 1), m = RPC[fn].apply(null, args);
  return sb.rpc(m[0], m[1]).then(function (r) {
    if (r.error) throw new Error(traduzErro(r.error.message));
    return r.data;
  }, function (e) { throw new Error(traduzErro(e && e.message)); });
}

/* ---------- regras de alerta (iguais às da planilha) ---------- */
function leadAlert(l) {
  if (l.tipo !== 'Aberto') return null;
  if (l.status === 'Novo') {
    var h = l.entrada ? (Date.now() - l.entrada) / 36e5 : 0;
    return h > 24 ? { c: 'red', t: 'Sem 1º contato · chegou ' + rel(msIso(l.entrada)) } : { c: 'orange', t: 'Lead novo · responder' };
  }
  if (!l.dataAcao) return { c: 'yellow', t: 'Definir próximo passo' };
  if (l.dataAcao < D.today) return { c: 'red', t: (l.acao || 'Ação') + ' · atrasada (' + rel(l.dataAcao) + ')' };
  if (l.dataAcao === D.today) return { c: 'orange', t: (l.acao || 'Ação') + ' · hoje' };
  return { c: '', t: (l.acao || 'Próximo passo') + ' · ' + rel(l.dataAcao) };
}
function semCompra(p) { return p.ultPed ? days(p.ultPed, D.today) : null; }
// Crédito por vendedor (ERP): o valor do mês só vale se a linha foi atualizada neste mês
function noMes(p, k) { return String(p.atualERP || '').slice(0, 7) === String(D.today).slice(0, 7) ? (Number(p[k]) || 0) : 0; }
function soma(arr, f) { return arr.reduce(function (s, p) { return s + (f(p) || 0); }, 0); }
function pvShareNote(p) {
  if (!p.nPed || !p.total || p.vendTotal === '' || p.vendTotal == null) return '';
  var v = Number(p.vendTotal) || 0, quem = D.admin ? esc(p.vend) : 'você', m = noMes(p, 'vendMes');
  var txt = v >= p.total - 0.5 ? 'Todos os pedidos desta loja foram vendidos por ' + quem + ' (' + money(v) + ').'
    : 'Vendido por ' + quem + ': <b>' + money(v) + '</b> de ' + money(p.total) + '. O resto foi vendido por outra pessoa ou está sem vendedor no Tiny.';
  return '<div class="note">' + txt + (m ? ' Este mês: ' + money(m) + '.' : '') + '</div>';
}
function pvShare(p) {
  if (!p.nPed || !p.total || p.vendTotal === '' || p.vendTotal == null) return '';
  var v = Number(p.vendTotal) || 0, q = D.admin ? ' por ' + p.vend : ' seu';
  if (v >= p.total - 0.5) return 'tudo' + q;
  return v ? money(v) + q : 'nada' + q;
}
function pvAlert(p) {
  if (p.status === 'Encerrado') return null;
  var ds = semCompra(p);
  if (!p.proxFU) return { c: 'yellow', t: 'Agendar follow-up' };
  if (p.proxFU < D.today) return { c: 'red', t: (p.tipoFU || 'Follow-up') + ' · atrasado (' + rel(p.proxFU) + ')' };
  if (p.proxFU === D.today) return { c: 'orange', t: (p.tipoFU || 'Follow-up') + ' · hoje' };
  if (ds > 90) return { c: 'red', t: 'Sem comprar há ' + ds + ' dias' };
  if (ds > 60) return { c: 'yellow', t: 'Sem comprar há ' + ds + ' dias' };
  return { c: '', t: (p.tipoFU || 'Follow-up') + ' · ' + rel(p.proxFU) };
}
function xAlert(x) {
  var st = x.status;
  if (x.proxPasso === 'Retorno solicitado' && x.prox && st !== PSK.QUALIFICADO && st !== PSK.CLIENTE) {
    if (x.prox < D.today) return { c: 'red', t: 'Retorno combinado · atrasado (' + rel(x.prox) + ')' };
    if (x.prox === D.today) return { c: 'orange', t: 'Retorno combinado · hoje' };
    return { c: '', t: 'Retorno combinado · ' + rel(x.prox) + ' (' + br(x.prox) + ')' };
  }
  if (st === PSK.RESPONDEU) {
    var d = x.ultToque ? days(x.ultToque, D.today) : 0;
    return { c: d > 2 ? 'red' : 'orange', t: 'Qualificar e passar ao ' + (D.prosp.closer || 'closer') + (d > 2 ? ' (respondeu há ' + d + ' dias)' : '') };
  }
  if (st === PSK.CADENCIA || st === PSK.SEM_RETORNO) {
    var passo = x.proxPasso || 'Próximo toque';
    if (!x.prox) return { c: 'yellow', t: 'Agendar próximo toque' };
    if (x.prox < D.today) return { c: 'red', t: passo + ' · atrasado (' + rel(x.prox) + ')' };
    if (x.prox === D.today) return { c: 'orange', t: passo + ' · hoje' };
    return { c: '', t: passo + ' · ' + rel(x.prox) };
  }
  if (st === PSK.ABORDAR || !st) return { c: '', t: 'Nova · começar pelo 1º WhatsApp' };
  if (st === PSK.QUALIFICADO) return { c: '', t: 'Com o ' + (D.prosp.closer || 'closer') + (x.lead ? ' · ' + x.lead : '') };
  return null;
}

/* ---------- playbook e roteiros de mensagem ---------- */
var PB_TXT = [];
function copyTxt(t) {
  var fb = function () {
    var ta = document.createElement('textarea'); ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); toast('Mensagem copiada ✓'); } catch (e) { toast('Não consegui copiar. Selecione o texto e copie.', true); }
    document.body.removeChild(ta);
  };
  try { navigator.clipboard.writeText(t).then(function () { toast('Mensagem copiada ✓'); }, fb); } catch (e) { fb(); }
}
function openPlaybook() {
  F = { id: 'playbook' }; S.sheet = { type: 'pb' };
  var x = { resp: D.admin ? '[seu nome]' : D.me, loja: '[nome da loja]', cidade: '[cidade]' };
  var closer = (D.prosp && D.prosp.closer) || 'closer';
  var et = (D.prosp && D.prosp.etapas) || [];
  var prox = function (e) { var r = et.filter(function (z) { return z.e === e; })[0]; return r && r.prox ? ' · depois: ' + r.prox + ' em ' + r.dias + (r.dias === 1 ? ' dia útil' : r.dias < 30 ? ' dias úteis' : ' dias') : ''; };
  var itens = [
    ['D0 WhatsApp', 'Primeiro toque, para lojas novas da fila.', 'D0 WhatsApp'],
    ['D2 WhatsApp', 'Lembrete curto, se a loja não respondeu ao D0.', 'D2 WhatsApp'],
    ['D4 Instagram', 'Direct no perfil da loja (o botão Instagram abre o perfil).', 'D4 Instagram'],
    ['D7 Ligação', 'Ligação para o telefone da loja. Peça o decisor.', 'D7 Ligação'],
    ['D10 WhatsApp', 'Última tentativa, sem insistir.', 'D10 WhatsApp'],
    ['D14 Encerramento', 'Encerra a cadência com a porta aberta.', 'D14 Encerramento'],
    ['Reativação', 'Para lojas que não responderam, depois da pausa de 60 dias.', 'Reativação'],
    ['Retorno combinado', 'Quando a loja pediu para falar numa data.', 'Retorno solicitado'],
    ['Respondeu → qualificar', 'A loja respondeu com interesse. Colete o que o ' + closer + ' precisa para fechar.', 'qualif'],
    ['Lead do site (cadastro de lojista)', 'Primeiro contato com quem preencheu o formulário de lojistas.', 'site']
  ];
  PB_TXT = itens.map(function (it) { return roteiro(x, it[2]); });
  var url = D.prosp && D.prosp.playbook;
  var h = head('Playbook e roteiros', 'Abertura e qualificação de lojistas') + '<div class="pb">' +
    (url ? '<a class="btn dark" style="display:block;text-align:center;text-decoration:none" href="' + esc(url) + '" target="_blank" rel="noopener">📘 Abrir o playbook completo (PDF)</a>' : '') +
    '<div class="lbl">Regras do jogo</div><ul style="margin:0;padding-left:18px;font-size:14px;color:var(--brown3);line-height:1.5">' +
    '<li>Quem abre o contato desperta interesse e qualifica. <b>Catálogo e condições ficam com o ' + esc(closer) + '.</b></li>' +
    '<li>Só diga o que é verdade: a loja foi encontrada numa busca por lojas country na cidade.</li>' +
    '<li>Um toque por vez, na ordem da cadência. Depois de cada toque, registre no CRM: o próximo passo é agendado sozinho.</li>' +
    '<li>Respondeu? Qualifique (decisor, CNPJ, marcas, época de compra) e use "Passar para o ' + esc(closer) + '".</li>' +
    '<li>Na ficha da loja, o botão WhatsApp já abre com a mensagem da etapa e o nome da loja preenchidos.</li></ul>' +
    '<div class="lbl">Roteiros <small>troque o que está entre colchetes</small></div>' +
    itens.map(function (it, i) {
      return '<div class="rt"><h3>' + esc(it[0]) + '</h3><p class="quando">' + esc(it[1]) + esc(prox(it[2])) + '</p>' +
        '<div class="script">' + esc(PB_TXT[i]) + '</div><button class="cp" data-act="copy" data-i="' + i + '">Copiar texto</button></div>';
    }).join('') +
    '<div class="rt"><h3>Perguntas de qualificação</h3><p class="quando">O que precisa estar preenchido antes de passar ao ' + esc(closer) + '.</p>' +
    '<ul><li><b>Decisor:</b> quem decide as compras (nome) *</li><li><b>CNPJ</b> da loja *</li><li><b>Marcas</b> que trabalha hoje</li><li><b>Público</b> (feminino, masculino, infantil, peão de rodeio…)</li><li><b>Época de compra</b> (quando costuma fazer pedidos)</li></ul></div>' +
    '</div>';
  openSheet(h);
}

/* ---------- painel do gestor (só o link de gestor vê) ---------- */
function pct(a, b) { return b ? Math.round(100 * a / b) + '%' : '—'; }
function nf(v) { return Number(v || 0).toLocaleString('pt-BR'); }
function barRows(rows, opt) {
  opt = opt || {};
  var max = Math.max.apply(null, rows.map(function (r) { return r[1]; }).concat([1]));
  return '<div class="bars">' + rows.map(function (r) {
    return '<div class="br" title="' + esc(r[0] + ': ' + r[1] + (r[2] ? ' · ' + r[2] : '')) + '"><span>' + esc(r[0]) + '</span>' +
      '<div class="pbar' + (opt.ok ? ' ok' : '') + '"><i style="width:' + Math.max(r[1] ? 2 : 0, Math.round(100 * r[1] / max)) + '%"></i></div>' +
      '<em><b style="color:var(--brown)">' + nf(r[1]) + '</b>' + (r[2] ? ' · ' + esc(r[2]) : '') + '</em></div>';
  }).join('') + '</div>';
}
function viewPainel() {
  var hoje = D.today, mes = hoje.slice(0, 7), sem7 = addDays(hoje, -6);
  var L = D.leads, P = D.pv, X = D.prosp ? D.prosp.rows : [];
  var mesDe = function (ms) { return ms ? msIso(ms).slice(0, 7) === mes : false; };
  var pessoas = D.sellers.slice();
  if (L.some(function (l) { return !l.resp && l.tipo === 'Aberto'; })) pessoas.push('');

  // ---- números gerais
  var abertos = L.filter(function (l) { return l.tipo === 'Aberto'; });
  var ganhos = L.filter(function (l) { return l.tipo === 'Ganho'; }), perdidos = L.filter(function (l) { return l.tipo === 'Perdido'; });
  var ganhosMes = ganhos.filter(function (l) { return mesDe(l.mudStatus); });
  var entradasMes = L.filter(function (l) { return mesDe(l.entrada); });
  var rec = soma(P, function (p) { return Number(p.total); }), recMes = soma(P, function (p) { return noMes(p, 'mesTotal'); });
  var sdrs = (D.prosp && D.prosp.sdrs) || [], meta = (D.prosp && D.prosp.meta) || 40;
  var toquesHoje = X.filter(function (x) { return x.ultToque === hoje; }).length;
  var vermelhos = L.filter(function (l) { return (leadAlert(l) || {}).c === 'red'; }).length + P.filter(function (p) { return (pvAlert(p) || {}).c === 'red'; }).length +
    X.filter(function (x) { return (xAlert(x) || {}).c === 'red'; }).length;
  var kpi = function (v, t, i) { return '<div class="kpi"><b>' + v + '</b><span>' + t + '</span>' + (i ? '<i>' + i + '</i>' : '') + '</div>'; };
  var out = '<h1>Painel do gestor</h1><div class="date">Visão geral da equipe · ' + new Date(dU(hoje) + 12 * 36e5).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }) + '</div>' +
    '<div class="kpis">' +
    kpi(rec ? money(rec) : '—', 'Receita dos clientes (ERP)', recMes ? money(recMes) + ' este mês' : 'nada este mês ainda') +
    kpi(nf(abertos.length), 'Leads em aberto', entradasMes.length + ' entraram este mês') +
    kpi(nf(ganhosMes.length), 'Pedidos fechados no mês', 'conversão geral ' + pct(ganhos.length, ganhos.length + perdidos.length)) +
    kpi(nf(toquesHoje), 'Toques de prospecção hoje', 'meta da equipe ' + nf(meta * sdrs.length)) +
    '</div>';

  // ---- precisa de atenção
  var att = [];
  L.forEach(function (l) { var a = leadAlert(l); if (a && a.c === 'red') att.push({ o: 0, k: 'Lead', id: 'data-lead="' + esc(l.id) + '"', n: l.loja || l.nome, q: l.resp || 'sem responsável', t: a.t }); });
  X.forEach(function (x) { var a = xAlert(x); if (x.status === PSK.RESPONDEU && a && a.c === 'red') att.push({ o: 1, k: 'Prospecção', id: 'data-x="' + esc(x.id) + '"', n: x.loja, q: x.resp || '—', t: a.t }); });
  P.forEach(function (p) { var a = pvAlert(p); if (a && a.c === 'red') att.push({ o: 2, k: 'Cliente', id: 'data-pv="' + esc(p.id) + '"', n: p.cliente, q: p.vend, t: a.t }); });
  att.sort(function (a, b) { return a.o - b.o; });

  // ---- equipe (vendas)
  var eq = pessoas.map(function (s) {
    var mineL = L.filter(function (l) { return (l.resp || '') === s; }), mineP = P.filter(function (p) { return p.vend === s; });
    var g = mineL.filter(function (l) { return l.tipo === 'Ganho'; }).length, pe = mineL.filter(function (l) { return l.tipo === 'Perdido'; }).length;
    return {
      s: s || 'Sem responsável',
      ab: mineL.filter(function (l) { return l.tipo === 'Aberto'; }).length,
      novo: mineL.filter(function (l) { return (leadAlert(l) || {}).t && l.status === 'Novo' && (leadAlert(l) || {}).c === 'red'; }).length,
      atr: mineL.filter(function (l) { return l.tipo === 'Aberto' && l.dataAcao && l.dataAcao < hoje; }).length,
      pot: soma(mineL.filter(function (l) { return l.tipo === 'Aberto'; }), function (l) { return Number(l.potencial); }),
      gm: mineL.filter(function (l) { return l.tipo === 'Ganho' && mesDe(l.mudStatus); }).length,
      g: g, conv: pct(g, g + pe),
      vend: soma(mineP, function (p) { return Number(p.vendTotal); }), vendMes: soma(mineP, function (p) { return noMes(p, 'vendMes'); }),
      cli: mineP.filter(function (p) { return p.status !== 'Encerrado'; }).length,
      cliA: mineP.filter(function (p) { return (pvAlert(p) || {}).c === 'red'; }).length
    };
  });
  var tot = function (k) { return soma(eq, function (r) { return r[k]; }); };
  var td = function (v, bad) { return '<td' + (bad && v ? ' class="bad"' : !v ? ' class="mu"' : '') + '>' + v + '</td>'; };
  var tEq = '<div class="tw"><table class="pt"><thead><tr><th>Vendedor</th><th>Leads abertos</th><th>Novos parados +24h</th><th>Ações atrasadas</th><th>Potencial aberto</th><th>Fechados no mês</th><th>Conversão</th><th>Vendido (ERP)</th><th>Vendido no mês</th><th>Clientes ativos</th><th>Clientes em alerta</th></tr></thead><tbody>' +
    eq.map(function (r) { return '<tr><td>' + esc(r.s) + '</td>' + td(r.ab) + td(r.novo, 1) + td(r.atr, 1) + td(r.pot ? money(r.pot) : 0) + td(r.gm) + '<td>' + r.conv + '</td>' + td(r.vend ? money(r.vend) : 0) + td(r.vendMes ? money(r.vendMes) : 0) + td(r.cli) + td(r.cliA, 1) + '</tr>'; }).join('') +
    '<tr class="tot"><td>Equipe</td><td>' + tot('ab') + '</td><td>' + tot('novo') + '</td><td>' + tot('atr') + '</td><td>' + (tot('pot') ? money(tot('pot')) : '—') + '</td><td>' + tot('gm') + '</td><td>' + pct(ganhos.length, ganhos.length + perdidos.length) + '</td><td>' + money(tot('vend')) + '</td><td>' + money(tot('vendMes')) + '</td><td>' + tot('cli') + '</td><td>' + tot('cliA') + '</td></tr>' +
    '</tbody></table></div>';

  // ---- placar da prospecção
  var tPl = '';
  if (D.prosp) {
    var pl = sdrs.map(function (s) {
      var m = X.filter(function (x) { return x.resp === s; });
      var c = function (st) { return m.filter(function (x) { return x.status === st; }).length; };
      var ab = m.length - c(PSK.ABORDAR) - c(PSK.FORA) - c(PSK.JA_LEAD) - c(PSK.JA_CLIENTE);
      var resp = c(PSK.RESPONDEU) + c(PSK.QUALIFICADO) + c(PSK.CLIENTE), qual = c(PSK.QUALIFICADO) + c(PSK.CLIENTE);
      return {
        s: s, hoje: m.filter(function (x) { return x.ultToque === hoje; }).length,
        sem: m.filter(function (x) { return x.ultToque && x.ultToque >= sem7; }).length,
        agir: m.filter(function (x) { var a = xAlert(x); return a && (a.c === 'red' || a.c === 'orange'); }).length,
        fila: c(PSK.ABORDAR), ab: ab, resp: resp, qual: qual, cli: c(PSK.CLIENTE)
      };
    });
    var ptot = function (k) { return soma(pl, function (r) { return r[k]; }); };
    var metaCell = function (v, m) { return '<td><span class="mtr"><span class="pbar ok" style="display:block"><i style="width:' + Math.min(100, Math.round(100 * v / (m || 1))) + '%"></i></span>' + v + '/' + m + '</span></td>'; };
    tPl = '<div class="tw"><table class="pt"><thead><tr><th>SDR</th><th>Toques hoje</th><th>Lojas tocadas 7 dias</th><th>Para agir hoje</th><th>Fila nova</th><th>Abordadas</th><th>Responderam</th><th>Qualificadas → ' + esc(D.prosp.closer || 'closer') + '</th><th>Viraram cliente</th><th>Taxa de resposta</th><th>Taxa de qualificação</th></tr></thead><tbody>' +
      pl.map(function (r) { return '<tr><td>' + esc(r.s) + '</td>' + metaCell(r.hoje, meta) + td(r.sem) + td(r.agir, 1) + td(r.fila) + td(r.ab) + td(r.resp) + td(r.qual) + td(r.cli) + '<td>' + pct(r.resp, r.ab) + '</td><td>' + pct(r.qual, r.resp) + '</td></tr>'; }).join('') +
      '<tr class="tot"><td>Equipe</td>' + metaCell(ptot('hoje'), meta * pl.length) + '<td>' + ptot('sem') + '</td><td>' + ptot('agir') + '</td><td>' + ptot('fila') + '</td><td>' + ptot('ab') + '</td><td>' + ptot('resp') + '</td><td>' + ptot('qual') + '</td><td>' + ptot('cli') + '</td><td>' + pct(ptot('resp'), ptot('ab')) + '</td><td>' + pct(ptot('qual'), ptot('resp')) + '</td></tr>' +
      '</tbody></table></div>';
  }

  // ---- funil, origem, perdas, entradas, pós-venda
  var porStatus = D.status.map(function (st) { return [st.s, L.filter(function (l) { return l.status === st.s; }).length, st.t === 'Aberto' ? '' : st.t.toLowerCase()]; }).filter(function (r) { return r[1]; });
  var orig = {};
  L.forEach(function (l) { var o = l.origem || 'Sem origem'; orig[o] = orig[o] || [0, 0, 0]; orig[o][0]++; if (l.tipo === 'Ganho') orig[o][1]++; if (l.tipo === 'Perdido') orig[o][2]++; });
  var porOrig = Object.keys(orig).sort(function (a, b) { return orig[b][0] - orig[a][0]; }).map(function (o) { return [o, orig[o][0], orig[o][1] + ' fechado' + (orig[o][1] === 1 ? '' : 's') + ' (' + pct(orig[o][1], orig[o][1] + orig[o][2]) + ')']; });
  var mot = {};
  perdidos.forEach(function (l) { var m = l.motivo || 'Sem motivo informado'; mot[m] = (mot[m] || 0) + 1; });
  var porMot = Object.keys(mot).sort(function (a, b) { return mot[b] - mot[a]; }).map(function (m) { return [m, mot[m], pct(mot[m], perdidos.length)]; });
  var seg = addDays(hoje, -((new Date(dU(hoje)).getUTCDay() + 6) % 7)), semanas = [];
  for (var i = 7; i >= 0; i--) {
    var ini = addDays(seg, -7 * i), fim = addDays(ini, 7);
    semanas.push([ini, L.filter(function (l) { var d = l.entrada ? msIso(l.entrada) : ''; return d >= ini && d < fim; }).length]);
  }
  var smax = Math.max.apply(null, semanas.map(function (w) { return w[1]; }).concat([1]));
  var vb = '<div class="vbars">' + semanas.map(function (w) { return '<div class="vb" title="' + esc('Semana de ' + br(w[0]) + ': ' + w[1] + ' leads') + '"><b>' + w[1] + '</b><i style="height:' + Math.round(96 * w[1] / smax) + 'px"></i><small>' + br(w[0]) + '</small></div>'; }).join('') + '</div>';
  var porPV = D.pvStatus.map(function (st) { return [st.s, P.filter(function (p) { return p.status === st.s; }).length]; }).filter(function (r) { return r[1]; });
  var nPed = soma(P, function (p) { return Number(p.nPed); });
  var fuAtr = P.filter(function (p) { return p.status !== 'Encerrado' && p.proxFU && p.proxFU < hoje; }).length;
  var sem60 = P.filter(function (p) { var d = semCompra(p); return p.status !== 'Encerrado' && d != null && d > 60; }).length;
  var outros = rec - soma(P, function (p) { return Number(p.vendTotal); });

  out += '<div class="links" style="margin:-6px 0 14px"><button data-act="acessos">👥 Acessos ao CRM</button><button data-act="expL">⬇️ Leads (CSV)</button><button data-act="expX">⬇️ Prospecção (CSV)</button><button data-act="expPV">⬇️ Pós-venda (CSV)</button></div>';
  out += '<div class="pn">' +
    '<section class="pc full"><div class="lbl">Precisa de atenção agora <span class="n" style="color:var(--late)">' + att.length + '</span></div>' +
    '<p class="hint">Leads novos sem resposta há mais de 24h, ações atrasadas, lojas que responderam e ainda não foram qualificadas e clientes com follow-up atrasado. Toque para abrir.</p>' +
    (att.length ? '<div class="att">' + att.slice(0, 12).map(function (a) { return '<a ' + a.id + '><span class="k">' + a.k + '</span><b>' + esc(a.n) + ' · ' + esc(a.q) + '</b><small>' + esc(a.t) + '</small></a>'; }).join('') + '</div>' +
      (att.length > 12 ? '<p class="hint" style="margin:8px 0 0">+ ' + (att.length - 12) + ' itens. Use o filtro de vendedor nas abas para ver todos.</p>' : '') : '<p class="hint" style="margin:0">Nada atrasado. 👏</p>') + '</section>' +
    '<section class="pc full"><div class="lbl">Equipe · vendas e carteira</div><p class="hint">Vendido = pedidos no Olist Tiny com o vendedor no pedido. Conversão = fechados ÷ (fechados + perdidos).</p>' + tEq + '</section>' +
    (tPl ? '<section class="pc full"><div class="lbl">Placar da prospecção</div><p class="hint">Meta de ' + meta + ' toques por dia por pessoa. "Lojas tocadas" conta cada loja uma vez pelo último toque.</p>' + tPl + '</section>' : '') +
    '<section class="pc"><div class="lbl">Funil por status</div><p class="hint">Todos os leads do CRM.</p>' + barRows(porStatus) + '</section>' +
    '<section class="pc"><div class="lbl">Entradas por semana</div><p class="hint">Leads novos nas últimas 8 semanas (semana começa na segunda).</p>' + vb + '</section>' +
    '<section class="pc"><div class="lbl">Origem dos leads</div><p class="hint">Quantos entraram por canal e quantos fecharam.</p>' + barRows(porOrig) + '</section>' +
    '<section class="pc"><div class="lbl">Motivos de perda</div><p class="hint">' + perdidos.length + ' leads perdidos.</p>' + (porMot.length ? barRows(porMot) : '<p class="hint">Nenhum lead perdido.</p>') + '</section>' +
    '<section class="pc full"><div class="lbl">Pós-venda</div>' +
    '<div class="kpis" style="margin:6px 0 14px">' + kpi(nf(P.length), 'Clientes na carteira', P.filter(function (p) { return p.status !== 'Encerrado'; }).length + ' ativos ou em acompanhamento') +
    kpi(nPed ? money(rec / nPed) : '—', 'Ticket médio por pedido', nf(nPed) + ' pedidos no ERP') + kpi(nf(fuAtr), 'Follow-ups atrasados', '') + kpi(nf(sem60), 'Sem comprar há +60 dias', '') + '</div>' +
    barRows(porPV) +
    (outros > 0.5 ? '<p class="hint" style="margin:10px 0 0">' + money(outros) + ' da receita dos clientes foi vendida por outras pessoas ou está sem vendedor no Tiny.</p>' : '') + '</section>' +
    '</div>';
  return out;
}

/* ---------- filtros ---------- */
function mesmoNome(a, b) { return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase(); }
function mine(resp) { return S.vend === 'Todos' || !String(resp || '').trim() || mesmoNome(resp, S.vend); }
function leads() { return D.leads.filter(function (l) { return mine(l.resp); }); }
function pvs() { return D.pv.filter(function (p) { return S.vend === 'Todos' || mesmoNome(p.vend, S.vend); }); }
function xs() { return D.prosp ? D.prosp.rows.filter(function (x) { return mine(x.resp); }) : []; }
function hasProsp() { return !!(D.prosp && (D.admin || D.prosp.rows.length)); }
function match(o, fields) {
  if (!S.q) return true;
  var q = S.q.toLowerCase();
  return fields.some(function (k) { return String(o[k] || '').toLowerCase().indexOf(q) >= 0; }) || (digits(S.q).length >= 4 && digits(o.whats).indexOf(digits(S.q)) >= 0);
}

/* ---------- cartões ---------- */
function leadCard(l, compact) {
  var a = leadAlert(l);
  var sub = [l.loja, [l.cidade, l.uf].filter(Boolean).join('/')].filter(Boolean).join(' · ');
  var wa = waLead(l.whats, l.nome, l.resp);
  var line = a ? '<div class="cn ' + (a.c ? 't-' + a.c : 't-muted') + '">' + esc(a.t) + '</div>'
    : l.tipo === 'Ganho' ? '<div class="cn t-muted">' + (l.pedido ? '1º pedido ' + money(l.pedido) : 'Cliente') + (l.mudStatus ? ' · ' + br(msIso(l.mudStatus)) : '') + '</div>'
    : l.motivo ? '<div class="cn t-muted">' + esc(l.motivo) + '</div>' : '';
  return '<article class="card ' + (a && a.c ? 'c-' + a.c : '') + '" data-lead="' + esc(l.id) + '"' + (compact ? ' draggable="true"' : '') + '>' +
    '<div class="cm"><div class="ct">' + (l.temp ? '<span class="temp ' + esc(l.temp) + '" title="' + esc(l.temp) + '"></span>' : '') +
    '<b>' + esc(l.nome || l.loja || l.id) + '</b>' + (compact ? '' : pill(l.status)) + '</div>' +
    (sub ? '<div class="cs">' + esc(sub) + (S.vend === 'Todos' && l.resp && !compact ? ' · ' + esc(l.resp) : '') + '</div>' : '') + line +
    (compact ? '' : quick(wa, igFind(l.insta, l.loja || l.nome, l.cidade), mapUrl(l.loja || l.nome, l.cidade, l.uf), 'data-wa="' + esc(l.id) + '"')) + '</div>' +
    '</article>';
}
function pvCard(p) {
  var a = pvAlert(p), ds = semCompra(p);
  var wa = waLead(p.whats, p.contato, p.vend);
  var sh = pvShare(p);
  var buy = p.nPed ? p.nPed + (p.nPed > 1 ? ' pedidos' : ' pedido') + ' · ' + money(p.total) + (sh ? ' (' + sh + ')' : '') + (ds != null ? ' · último há ' + ds + 'd' : '') : 'Sem pedido no ERP ainda';
  return '<article class="card ' + (a && a.c ? 'c-' + a.c : '') + '" data-pv="' + esc(p.id) + '">' +
    '<div class="cm"><div class="ct"><b>' + esc(p.cliente || p.contato) + '</b>' + pill(p.status, PST) + '</div>' +
    '<div class="cs">' + esc([p.contato, p.cidade].filter(Boolean).join(' · ')) + (S.vend === 'Todos' ? ' · ' + esc(p.vend) : '') + '</div>' +
    '<div class="cn t-muted">' + esc(buy) + '</div>' +
    (a ? '<div class="cn ' + (a.c ? 't-' + a.c : 't-muted') + '">' + esc(a.t) + '</div>' : '') +
    quick(wa, igFind(p.insta, p.cliente, String(p.cidade || '').split('/')[0]), mapUrl(p.cliente, p.cidade, ''), 'data-wapv="' + esc(p.id) + '"') + '</div>' +
    '</article>';
}
/* canal do próximo toque da cadência */
function canal(passo) { var s = String(passo || ''); return /insta/i.test(s) ? 'ig' : /liga/i.test(s) ? 'tel' : 'wa'; }
function etapaSugerida(x) {
  if (x.status === PSK.ABORDAR || !x.status || !x.etapa) return (D.prosp.etapas[0] || {}).e || 'D0 WhatsApp';
  if (x.proxPasso && D.prosp.etapas.some(function (e) { return e.e === x.proxPasso; })) return x.proxPasso;
  return '';
}
function roteiro(x, etapa) {
  // Quem abre o contato desperta interesse e qualifica; catálogo e condições ficam com o closer
  var nome = euSou(x.resp), eu = nome ? 'Aqui é ' + nome + ', da Indião Store' : 'Aqui é da Indião Store';
  // Só afirmações verdadeiras: a loja foi encontrada numa busca online por lojas country na cidade
  var loja = x.loja || 'sua loja';
  var cidade = String(x.cidade || '').split('/')[0].trim();
  var onde = cidade ? ' em ' + cidade : '';
  var achei = 'Estou procurando lojas country' + onde + ' para o nosso programa de lojistas parceiros e encontrei a ' + (x.loja || 'loja de vocês') + '.';
  var e = String(etapa || '');
  if (/^D0/.test(e)) return 'Oi, tudo bem? ' + eu + ', marca de moda country. ' + achei + ' Acho que a Indião tem tudo a ver com o público de vocês. Vocês trabalham com marcas country na loja?';
  if (/^D2/.test(e)) return 'Oi! Passando para saber se você viu minha mensagem. Se fizer sentido, te conto rapidinho como funciona a parceria da Indião para lojistas.';
  if (/insta/i.test(e)) return 'Oi! ' + eu + ', marca de moda country. Estou procurando lojas country' + onde + ' para o nosso programa de lojistas parceiros e encontrei o perfil de vocês. Acho que a Indião combina com o público da loja. Posso te contar como funciona a parceria?';
  if (/liga/i.test(e)) return 'Oi, tudo bem? ' + eu + ', marca de moda country. Falo com quem cuida das compras da ' + loja + '? (Se não for a pessoa: qual o nome de quem decide e o melhor horário para falar?) Estou procurando lojas country' + onde + ' para o nosso programa de lojistas parceiros e encontrei vocês. Vocês trabalham com marcas country? Posso pedir para o nosso consultor comercial te mandar o catálogo e as condições pelo WhatsApp? Qual o melhor número?';
  if (/qualif/i.test(e)) return 'Que bom! Para eu já deixar tudo certo com o nosso consultor comercial: quem decide as compras aí na loja? Vocês têm CNPJ? Quais marcas trabalham hoje e em que época costumam fazer os pedidos?';
  if (/site|inbound/i.test(e)) return 'Oi, tudo bem? ' + eu + '. Recebi seu cadastro no programa de lojistas parceiros da Indião. Para eu te passar as condições certinhas: qual o nome da loja e a cidade? Vocês já trabalham com moda country?';
  if (/^D10/.test(e)) return 'Oi! Última mensagem por aqui para não incomodar. Se em algum momento fizer sentido para a ' + loja + ' conhecer a Indião para revenda, é só me chamar.';
  if (/^D14|encerr/i.test(e)) return 'Oi! Vou encerrar o contato por aqui. Quando quiser conhecer a parceria de lojistas da Indião Store, é só me chamar. Abraço!';
  if (/reativ/i.test(e)) return 'Oi, tudo bem? ' + eu + '. Entrei em contato um tempo atrás sobre o programa de lojistas parceiros da Indião. Queria saber se agora faz sentido para a ' + loja + ' conhecer a marca.';
  if (/retorno/i.test(e)) return 'Oi, tudo bem? ' + eu + '. Combinamos de falar hoje. Podemos seguir com a conversa sobre a parceria da Indião para a ' + loja + '?';
  return 'Oi! ' + eu + '.';
}
function xGo(x) {
  var et = etapaSugerida(x) || x.proxPasso, c = canal(et);
  if (x.status === PSK.RESPONDEU) c = 'wa';
  if (c === 'ig' && x.insta) return '<a class="go ig" href="' + igUrl(x.insta) + '" target="_blank" rel="noopener" data-wax="' + esc(x.id) + '" aria-label="Instagram">' + ICON.ig + '<span>Instagram</span></a>';
  if (c === 'tel' && digits(x.whats).length >= 10) return '<a class="go tel" href="tel:+55' + digits(x.whats) + '" data-wax="' + esc(x.id) + '" aria-label="Ligar">' + ICON.phone + '<span>Ligar</span></a>';
  var wa = waUrl(x.whats, x.status === PSK.RESPONDEU ? '' : roteiro(x, et));
  return wa ? '<a class="go" href="' + wa + '" target="_blank" rel="noopener" data-wax="' + esc(x.id) + '" aria-label="WhatsApp">' + ICON.chat + '<span>WhatsApp</span></a>' : '';
}
function xCard(x) {
  var a = xAlert(x);
  var sub = [[x.cidade, x.uf].filter(Boolean).join('/'), x.segmento].filter(Boolean).join(' · ');
  return '<article class="card ' + (a && a.c ? 'c-' + a.c : '') + '" data-x="' + esc(x.id) + '">' +
    '<div class="cm"><div class="ct">' + (x.tier && x.tier.length <= 2 ? '<span class="tier ' + esc(x.tier) + '">' + esc(x.tier) + '</span>' : '') +
    '<b>' + esc(x.loja) + '</b>' + (x.status !== PSK.ABORDAR && x.status !== PSK.CADENCIA ? pill(x.status, XST) : '') + '</div>' +
    '<div class="cs">' + esc(sub) + (S.vend === 'Todos' && x.resp ? ' · ' + esc(x.resp) : '') + '</div>' +
    (a ? '<div class="cn ' + (a.c ? 't-' + a.c : 't-muted') + '">' + esc(a.t) + '</div>' : '') + '</div>' + xGo(x) + '</article>';
}
function section(title, hint, items, fn, two, limit) {
  if (!items.length) return '';
  var shown = limit ? items.slice(0, limit) : items;
  return '<section class="sec"><h2>' + title + ' <span class="n">' + items.length + '</span></h2>' + (hint ? '<p class="hint">' + hint + '</p>' : '') +
    '<div class="list' + (two ? ' two' : '') + '">' + shown.map(function (x) { return fn(x); }).join('') + '</div>' +
    (limit && items.length > limit ? '<div style="margin-top:8px"><button class="more" data-act="more">Ver mais ' + Math.min(20, items.length - limit) + '</button></div>' : '') + '</section>';
}

/* ---------- telas ---------- */
function todayBuckets() {
  var L = leads().filter(function (l) { return l.tipo === 'Aberto'; });
  var by = function (k) { return function (a, b) { return String(a[k]).localeCompare(String(b[k])); }; };
  var b = {
    novos: L.filter(function (l) { return l.status === 'Novo'; }).sort(function (a, b) { return (a.entrada || 0) - (b.entrada || 0); }),
    atras: L.filter(function (l) { return l.status !== 'Novo' && l.dataAcao && l.dataAcao < D.today; }).sort(by('dataAcao')),
    hoje: L.filter(function (l) { return l.status !== 'Novo' && l.dataAcao === D.today; }),
    semPasso: L.filter(function (l) { return l.status !== 'Novo' && !l.dataAcao; }),
    pv: pvs().filter(function (p) { var a = pvAlert(p); return a && a.c; }).sort(function (a, b) { return sev(pvAlert(a)) - sev(pvAlert(b)) || String(a.proxFU).localeCompare(String(b.proxFU)); }),
    abertos: L
  };
  b.total = b.novos.length + b.atras.length + b.hoje.length + b.pv.filter(function (p) { return sev(pvAlert(p)) < 2; }).length;
  return b;
}
function prospBuckets() {
  var X = xs(), r = { qualif: [], atras: [], hoje: [], reativar: [], semData: [], novas: [], cad: [], ret: [], agenda: [], feitos: 0, resp: 0, quali: 0 };
  X.forEach(function (x) {
    if (x.ultToque === D.today) r.feitos++;
    var fechado = x.status === PSK.QUALIFICADO || x.status === PSK.CLIENTE || x.status === PSK.SEM_INTERESSE || x.status === PSK.FORA || x.status === PSK.JA_LEAD || x.status === PSK.JA_CLIENTE;
    if (x.prox && !fechado) r.agenda.push(x);
    if (x.proxPasso === 'Retorno solicitado' && x.prox && !fechado) {
      if (x.status === PSK.RESPONDEU) r.resp++;
      if (x.prox <= D.today) r.ret.push(x);
      return;
    }
    if (x.status === PSK.RESPONDEU) { r.qualif.push(x); r.resp++; return; }
    if (x.status === PSK.QUALIFICADO) r.quali++;
    if (x.status === PSK.ABORDAR || !x.status) { r.novas.push(x); return; }
    if (x.status === PSK.CADENCIA || x.status === PSK.SEM_RETORNO) {
      if (!x.prox) r.semData.push(x);
      else if (x.prox < D.today) (x.status === PSK.SEM_RETORNO ? r.reativar : r.atras).push(x);
      else if (x.prox === D.today) (x.status === PSK.SEM_RETORNO ? r.reativar : r.hoje).push(x);
      else if (x.status === PSK.CADENCIA) r.cad.push(x);
    }
  });
  var byProx = function (a, b) { return String(a.prox).localeCompare(String(b.prox)); };
  var tierN = function (t) { return { A: 0, B: 1, C: 2 }[t] != null ? { A: 0, B: 1, C: 2 }[t] : 3; };
  r.atras.sort(byProx); r.reativar.sort(byProx); r.cad.sort(byProx); r.ret.sort(byProx); r.agenda.sort(byProx);
  r.novas.sort(function (a, b) { return tierN(a.tier) - tierN(b.tier) || (Number(b.score) || 0) - (Number(a.score) || 0); });
  r.agir = r.qualif.length + r.ret.length + r.atras.length + r.hoje.length + r.reativar.length;
  return r;
}
function viewHoje() {
  var b = todayBuckets();
  var h = new Date().getHours();
  var oi = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
  var nome = S.vend === 'Todos' ? '' : ', ' + S.vend;
  var mes = D.today.slice(0, 7);
  var ganhos = leads().filter(function (l) { return l.tipo === 'Ganho' && l.mudStatus && msIso(l.mudStatus).slice(0, 7) === mes; });
  var pot = b.abertos.reduce(function (s, l) { return s + (Number(l.potencial) || 0); }, 0);
  var dt = new Date(dU(D.today) + 12 * 36e5).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
  dt = dt.charAt(0).toUpperCase() + dt.slice(1);
  var pb = hasProsp() ? prospBuckets() : null;
  var out = '<h1>' + oi + nome + '</h1><div class="date">' + dt + '</div>' + '<button class="pbk" data-act="playbook">📘 Playbook e roteiros de mensagem</button>' +
    '<div class="hero">' + penaSvg() + '<div class="row"><div><b>' + (b.total + (pb ? pb.agir : 0)) + '</b><span>Para fazer hoje</span></div>' +
    (pb ? '<div class="mini"><b>' + pb.feitos + '/' + D.prosp.meta + '</b><span>Toques de prospecção</span></div>' : '') + '</div>' +
    (pb ? '<div class="prog"><i style="width:' + Math.min(100, Math.round(pb.feitos / (D.prosp.meta || 1) * 100)) + '%"></i></div>' : '') + '</div>' +
    '<div class="kpis">' +
    '<div class="kpi"><b>' + b.abertos.length + '</b><span>Leads em aberto</span></div>' +
    '<div class="kpi"><b>' + (pot ? money(pot) : '—') + '</b><span>Potencial em aberto</span></div>' +
    '<div class="kpi"><b>' + ganhos.length + '</b><span>Fechados no mês</span></div>' +
    '<div class="kpi"><b>' + pvs().length + '</b><span>Clientes na carteira</span></div></div>';
  var prospSec = '';
  if (pb && (pb.agir || pb.novas.length)) {
    prospSec = '<section class="sec"><h2>Prospecção <span class="n">' + pb.agir + '</span></h2>' +
      '<p class="hint">' + [pb.ret.length ? pb.ret.length + ' retornos combinados' : '', pb.qualif.length ? pb.qualif.length + ' para qualificar' : '', (pb.atras.length + pb.hoje.length) ? (pb.atras.length + pb.hoje.length) + ' toques para hoje' : '', pb.reativar.length ? pb.reativar.length + ' para reativar' : '', pb.novas.length ? pb.novas.length + ' lojas novas na fila' : ''].filter(Boolean).join(' · ') + '</p>' +
      '<div class="list two">' + pb.ret.concat(pb.qualif, pb.atras, pb.hoje).slice(0, 4).map(xCard).join('') + '</div>' +
      '<div style="margin-top:8px"><button class="btn dark" style="width:100%" data-tab="prosp">Abrir minha prospecção</button></div></section>';
  }
  var body =
    section('Responder agora', 'Leads novos. Quanto antes o primeiro contato, maior a chance de fechar.', b.novos, leadCard, true) +
    section('Atrasados', '', b.atras, leadCard, true) +
    section('Para hoje', '', b.hoje, leadCard, true) +
    prospSec +
    section('Pós-venda', 'Clientes com follow-up para fazer.', b.pv, pvCard, true) +
    section('Sem próximo passo', 'Abra e marque quando falar de novo.', b.semPasso, leadCard, true);
  if (!body) body = '<div class="empty">' + penaSvg() + '<p><b>Tudo em dia.</b><br>Nenhuma pendência para hoje.</p><button class="btn" data-tab="funil">Ver o funil</button></div>';
  return out + body;
}
function viewFunil() {
  var cols = D.status.filter(function (s) { return s.t === 'Aberto'; }).map(function (s) { return s.s; });
  cols.push(GANHO);
  if (S.closed) D.status.forEach(function (s) { if (s.t !== 'Aberto' && s.t !== 'Ganho') cols.push(s.s); });
  var L = leads().filter(function (l) { return match(l, ['nome', 'loja', 'cidade', 'email', 'id']); });
  var out = '<h1>Funil</h1><div class="bar"><input class="search" id="q" placeholder="Buscar nome, loja, cidade ou WhatsApp" value="' + esc(S.q) + '">' +
    '<button class="chip' + (S.closed ? ' on' : '') + '" data-act="closed">Perdidos e descartados</button></div><div class="board">';
  cols.forEach(function (c) {
    var items = L.filter(function (l) { return l.status === c; }).sort(function (a, b) { return sev(leadAlert(a)) - sev(leadAlert(b)) || String(a.dataAcao || '9').localeCompare(String(b.dataAcao || '9')); });
    var sum = items.reduce(function (s, l) { return s + (Number(c === GANHO ? l.pedido : l.potencial) || 0); }, 0);
    out += '<section class="col" data-drop="' + esc(c) + '"><header>' + pill(c) + '<span class="cnt">' + items.length + '</span>' +
      (sum ? '<span class="sum">' + money(sum) + '</span>' : '') + '</header><div class="list">' +
      (items.length ? items.map(function (l) { return leadCard(l, true); }).join('') : '<div class="none">Nenhum lead</div>') + '</div></section>';
  });
  return out + '</div><p class="note">Deslize para o lado para ver as etapas. No computador, arraste o cartão para mudar de etapa.</p>';
}
function viewProsp() {
  if (!D.prosp) return '<div class="empty">' + penaSvg() + '<p>A aba Prospecção não foi encontrada na planilha.</p></div>';
  var pb = prospBuckets(), X = xs();
  var modes = [['hoje', 'Para hoje', pb.agir], ['agenda', 'Agenda', pb.agenda.length], ['novas', 'Lojas novas', pb.novas.length], ['todas', 'Todas', X.length]];
  var out = '<h1>Prospecção</h1><div class="date">Abertura e qualificação de lojistas · fechamento com o ' + esc(D.prosp.closer || 'closer') + '</div>' +
    '<button class="pbk" data-act="playbook">📘 Playbook e roteiros de mensagem</button> <button class="pbk" data-act="newx">＋ Nova loja para prospectar</button>' +
    '<div class="hero">' + penaSvg() + '<div class="row"><div><b>' + pb.feitos + '<small style="font-size:22px;color:var(--gray)">/' + D.prosp.meta + '</small></b><span>Toques hoje</span></div>' +
    '<div class="mini"><b>' + pb.agir + '</b><span>Para agir</span></div><div class="mini"><b>' + pb.resp + '</b><span>Responderam</span></div><div class="mini"><b>' + pb.quali + '</b><span>Com o ' + esc(D.prosp.closer || 'closer') + '</span></div></div>' +
    '<div class="prog"><i style="width:' + Math.min(100, Math.round(pb.feitos / (D.prosp.meta || 1) * 100)) + '%"></i></div></div>' +
    '<div class="seg">' + modes.map(function (m) { return '<button data-pmode="' + m[0] + '" class="' + (S.pmode === m[0] ? 'on' : '') + '">' + m[1] + '<span class="c">' + m[2] + '</span></button>'; }).join('') + '</div>';
  out += '<div class="bar"><input class="search" id="q" type="search" enterkeyhint="search" placeholder="🔎 Buscar loja pelo nome, cidade ou telefone" value="' + esc(S.q) + '"></div>';
  var lim = 15 + S.pmore;
  if (S.q) {
    var achou = X.filter(function (x) { return match(x, ['loja', 'cidade', 'uf', 'id', 'insta', 'segmento']); })
      .sort(function (a, b) { return sev(xAlert(a)) - sev(xAlert(b)) || String(a.loja).localeCompare(String(b.loja)); });
    if (!achou.length) return out + '<div class="empty">' + penaSvg() + '<p>Nenhuma loja encontrada para “' + esc(S.q) + '”.</p></div>';
    return out + '<p class="hint" style="color:var(--muted);font-size:13px;margin:-4px 0 10px">' + achou.length + (achou.length > 1 ? ' lojas encontradas' : ' loja encontrada') + '</p><div class="list two">' + achou.slice(0, lim).map(xCard).join('') + '</div>' +
      (achou.length > lim ? '<div style="margin-top:10px"><button class="more" data-act="more">Ver mais</button></div>' : '');
  }
  if (S.pmode === 'agenda') {
    if (!pb.agenda.length) return out + '<div class="empty">' + penaSvg() + '<p>Nenhum toque ou retorno agendado.</p></div>';
    var grupos = {}, ordem = [];
    pb.agenda.forEach(function (x) { var k = x.prox < D.today ? 'atrasados' : x.prox; if (!grupos[k]) { grupos[k] = []; ordem.push(k); } grupos[k].push(x); });
    ordem.sort(function (a, b) { return a === 'atrasados' ? -1 : b === 'atrasados' ? 1 : a.localeCompare(b); });
    return out + ordem.slice(0, 20 + Math.floor(S.pmore / 20) * 10).map(function (k) {
      var titulo = k === 'atrasados' ? 'Atrasados' : k === D.today ? 'Hoje' : (rel(k) === br(k) ? '' : rel(k).charAt(0).toUpperCase() + rel(k).slice(1) + ' · ') + new Date(dU(k) + 12 * 36e5).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: 'UTC' });
      return section(titulo, '', grupos[k], xCard, true);
    }).join('');
  }
  if (S.pmode === 'hoje') {
    var falta = Math.max(0, D.prosp.meta - pb.feitos - pb.atras.length - pb.hoje.length - pb.reativar.length);
    var body = section('Retornos combinados', 'A loja pediu para falar nesta data.', pb.ret, xCard, true) +
      section('Qualificar e passar ao ' + esc(D.prosp.closer || 'closer'), 'Responderam. Descubra decisor, CNPJ, marcas e época de compra.', pb.qualif, xCard, true) +
      section('Toques atrasados', '', pb.atras, xCard, true) +
      section('Toques de hoje', '', pb.hoje, xCard, true) +
      section('Reativar', 'Terminaram a cadência há 60 dias sem resposta.', pb.reativar, xCard, true) +
      section('Comece pelas novas', falta ? 'Faltam ' + falta + ' toques para a meta de hoje. A lista está por prioridade (tier e score).' : 'Meta do dia batida. Se sobrar tempo, siga pela lista.', pb.novas, xCard, true, Math.max(5, Math.min(falta || 5, 15)) + S.pmore);
    return out + (body || '<div class="empty">' + penaSvg() + '<p><b>Nada pendente.</b><br>Sem lojas na sua fila hoje.</p></div>');
  }
  var arr = S.pmode === 'novas' ? pb.novas : X.slice().sort(function (a, b) { return sev(xAlert(a)) - sev(xAlert(b)) || String(a.loja).localeCompare(String(b.loja)); });
  arr = arr.filter(function (x) { return match(x, ['loja', 'cidade', 'uf', 'id', 'insta', 'segmento']); });
  if (!arr.length) return out + '<div class="empty">' + penaSvg() + '<p>Nenhuma loja aqui.</p></div>';
  return out + '<div class="list two">' + arr.slice(0, lim).map(xCard).join('') + '</div>' +
    (arr.length > lim ? '<div style="margin-top:10px"><button class="more" data-act="more">Ver mais ' + Math.min(20, arr.length - lim) + ' de ' + (arr.length - lim) + '</button></div>' : '');
}
function viewClientes() {
  var P = pvs().filter(function (p) { return match(p, ['cliente', 'contato', 'cidade', 'id']); })
    .sort(function (a, b) { return sev(pvAlert(a)) - sev(pvAlert(b)) || String(a.proxFU || '9').localeCompare(String(b.proxFU || '9')); });
  var all = pvs();
  var ativos = all.filter(function (p) { return p.status !== 'Encerrado' && p.status !== 'Inativo'; }).length;
  var risco = all.filter(function (p) { return p.status === 'Em risco' || (pvAlert(p) || {}).c === 'red'; }).length;
  var geral = D.admin && S.vend === 'Todos';
  var rec = soma(all, function (p) { return Number(p.total); }), recMes = soma(all, function (p) { return noMes(p, 'mesTotal'); });
  var vend = soma(all, function (p) { return Number(p.vendTotal); }), vendMes = soma(all, function (p) { return noMes(p, 'vendMes'); });
  var mesTxt = function (v) { return v ? money(v) + ' este mês' : 'nada este mês ainda'; };
  var kpiVenda = geral
    ? '<div class="kpi"><b>' + (rec ? money(rec) : '—') + '</b><span>Receita dos clientes (ERP)</span><i>' + mesTxt(recMes) + '</i></div>'
    : '<div class="kpi"><b>' + money(vend) + '</b><span>' + (D.admin ? 'Vendido por ' + esc(S.vend) : 'Vendido por você') + '</span><i>' + mesTxt(vendMes) + '</i></div>';
  var out = '<h1>Clientes</h1><div class="date">Pós-venda: cuide de quem já comprou</div>' +
    '<div class="kpis"><div class="kpi"><b>' + all.length + '</b><span>Clientes</span></div>' +
    '<div class="kpi"><b>' + ativos + '</b><span>Ativos</span></div>' +
    '<div class="kpi"><b>' + risco + '</b><span>Precisam de atenção</span></div>' + kpiVenda + '</div>';
  if (geral && rec) {
    // Receita dividida por quem vendeu (vendedor no Tiny); o resto é de outros vendedores ou sem vendedor no ERP
    var linhas = D.sellers.map(function (v) {
      var dele = all.filter(function (p) { return p.vend === v; });
      return [v, soma(dele, function (p) { return Number(p.vendTotal); }), soma(dele, function (p) { return noMes(p, 'vendMes'); })];
    });
    var outros = rec - vend, outrosMes = recMes - vendMes;
    out += '<div class="lbl" style="margin-top:0">Vendas por vendedor (Olist Tiny)</div><div class="vt">' +
      linhas.map(function (l) { return '<div><span>' + esc(l[0]) + '</span><b>' + money(l[1]) + '</b><small>' + (l[2] ? money(l[2]) + ' no mês' : '—') + '</small></div>'; }).join('') +
      (outros > 0.5 ? '<div class="o"><span>Outros ou sem vendedor</span><b>' + money(outros) + '</b><small>' + (outrosMes > 0.5 ? money(outrosMes) + ' no mês' : '—') + '</small></div>' : '') +
      '</div>';
  }
  out += '<div class="bar"><input class="search" id="q" placeholder="Buscar cliente ou cidade" value="' + esc(S.q) + '"></div>';
  if (!all.length) return out + '<div class="empty">' + penaSvg() + '<p>Quando um lead vira <b>' + esc(GANHO) + '</b>, ele aparece aqui para o pós-venda.</p></div>';
  return out + '<div class="list two">' + P.map(pvCard).join('') + '</div>';
}

/* ---------- ficha do lead ---------- */
var F = null;
var QUICK = [
  { k: 'falei', t: '💬 Conversamos', st: function (l) { return l.status === 'Novo' ? 'Em contato' : l.status; }, acao: 'Retomar conversa', d: 2 },
  { k: 'semresp', t: '📵 Não respondeu', st: function (l) { return l.status === 'Novo' ? 'Em contato' : l.status; }, acao: 'Tentar contato de novo', d: 2, nota: 'Sem resposta.' },
  { k: 'catalogo', t: '📘 Enviei catálogo', st: function () { return 'Catálogo enviado'; }, acao: 'Cobrar retorno do catálogo', d: 3 },
  { k: 'negoc', t: '🤝 Negociando', st: function () { return 'Negociação'; }, acao: 'Fechar pedido', d: 2 },
  { k: 'fechou', t: '🎉 Fechou pedido', st: function () { return GANHO; }, acao: '', d: null },
  { k: 'depois', t: '⏳ Agora não', st: function () { return 'Nutrição'; }, acao: 'Retomar contato', d: 30 },
  { k: 'perdeu', t: '✖ Não vai comprar', st: function () { return PERDIDO; }, acao: '', d: null }
];
function getLead(id) { return D.leads.filter(function (l) { return l.id === id; })[0]; }
function getPV(id) { return D.pv.filter(function (p) { return p.id === id; })[0]; }
function getX(id) { return D.prosp ? D.prosp.rows.filter(function (x) { return x.id === id; })[0] : null; }
function openSheet(html) {
  var sh = document.getElementById('sheet'), p = document.getElementById('panel');
  p.innerHTML = html; sh.classList.remove('hidden'); document.body.style.overflow = 'hidden';
}
function closeSheet() { document.getElementById('sheet').classList.add('hidden'); document.getElementById('panel').classList.remove('wide'); document.body.style.overflow = ''; F = null; S.sheet = null; }
function paint(h) {
  var pb = document.querySelector('.pb'), top = pb ? pb.scrollTop : 0;
  if (document.querySelector('#panel .ph') && S.sheet && S.sheet.rendered === F.id) {
    var open = [].map.call(document.querySelectorAll('#panel details'), function (d) { return d.open; });
    var guarda = {}; [].forEach.call(document.querySelectorAll('#visBox [id^="vn-"], #visBox [id^="ve-"]'), function (el) { guarda[el.id] = el.value; });
    document.getElementById('panel').innerHTML = h;
    [].forEach.call(document.querySelectorAll('#panel details'), function (d, i) { if (open[i]) d.open = true; });
    Object.keys(guarda).forEach(function (k) { var el = document.getElementById(k); if (el) el.value = guarda[k]; });
    document.querySelector('.pb').scrollTop = top;
  } else { openSheet(h); S.sheet.rendered = F.id; }
}
function head(title, sub) {
  return '<div class="ph"><div style="min-width:0"><h2>' + esc(title) + '</h2><div class="sub">' + esc(sub) + '</div></div><button class="x" data-act="close" aria-label="Fechar">×</button></div>';
}
function contactRow(phone, nome, email, msgUrl, ig, map) {
  var wa = msgUrl || waLead(phone, nome), d = digits(phone);
  return '<div class="acts five">' +
    '<a class="act w' + (wa ? '' : ' off') + '" href="' + (wa || '#') + '" target="_blank" rel="noopener">' + ICON.chat + 'WhatsApp</a>' +
    '<a class="act' + (d.length >= 10 ? '' : ' off') + '" href="tel:+55' + d + '">' + ICON.phone + 'Ligar</a>' +
    '<a class="act i' + (ig ? '' : ' off') + '" href="' + (ig || '#') + '" target="_blank" rel="noopener">' + ICON.ig + 'Instagram</a>' +
    '<a class="act' + (map ? '' : ' off') + '" href="' + (map || '#') + '" target="_blank" rel="noopener">' + ICON.pin + 'Mapa</a>' +
    '<a class="act' + (email ? '' : ' off') + '" href="mailto:' + esc(email) + '">' + ICON.mail + 'E-mail</a></div>';
}
function dateChips(cur, presets, field) {
  var h = presets.map(function (p) {
    var v = addDays(D.today, p[1]);
    return '<button class="chip' + (cur === v ? ' on' : '') + '" data-date="' + v + '" data-field="' + field + '">' + p[0] + '</button>';
  }).join('');
  var custom = cur && !presets.some(function (p) { return addDays(D.today, p[1]) === cur; });
  // "Outra data" mostra um campo de data visível (o seletor escondido não abre no computador dentro do Apps Script)
  var aberto = custom || (F && F.dtOpen === field);
  return '<div class="chips">' + h +
    '<button class="chip' + (custom ? ' on' : '') + '" data-dtopen="' + field + '">📅 ' + (custom ? br(cur) : 'Outra data') + '</button>' +
    (cur ? '<button class="chip" data-date="" data-field="' + field + '">Sem data</button>' : '') + '</div>' +
    (aberto ? '<div class="dtrow"><input type="date" class="fld" data-datein="' + field + '" min="' + D.today + '" value="' + esc(cur || '') + '" aria-label="Escolher data"><span>Toque no calendário ou digite a data</span></div>' : '');
}
function openLead(id, preset) {
  var l = getLead(id); if (!l) return;
  S.sheet = { type: 'lead', id: id };
  F = { id: id, status: l.status, acao: l.acao, dataAcao: l.dataAcao, temp: l.temp, motivo: l.motivo, pedido: '', nota: '', contato: false, quick: null, resp: l.resp, dados: {}, hist: null, conta: l.conta, vis: null };
  if (preset && preset !== l.status) applyStatus(preset);
  renderLead();
}
function applyQuick(k) {
  var l = getLead(F.id), q = QUICK.filter(function (x) { return x.k === k; })[0];
  if (F.quick === k) { F.quick = null; F.status = l.status; F.acao = l.acao; F.dataAcao = l.dataAcao; F.contato = false; return; }
  F.quick = k; F.contato = true;
  var st = q.st(l); if (ST[st]) F.status = st;
  F.acao = q.acao; F.dataAcao = q.d == null ? '' : addDays(D.today, q.d);
  if (q.nota && !F.nota) F.nota = q.nota;
}
function applyStatus(st) {
  F.status = st;
  var t = (ST[st] || {}).t;
  if (t && t !== 'Aberto') { F.acao = ''; F.dataAcao = ''; }
}
function renderLead() {
  var l = getLead(F.id);
  var tipo = (ST[F.status] || {}).t || 'Aberto';
  var sub = [l.loja, [l.cidade, l.uf].filter(Boolean).join('/')].filter(Boolean).join(' · ');
  var a = leadAlert(l);
  var meta = '<div class="meta">' + pill(l.status) +
    (l.origem ? '<span class="tag">' + esc(l.origem) + '</span>' : '') +
    (l.entrada ? '<span class="tag">Entrou ' + rel(msIso(l.entrada)) + '</span>' : '') +
    (l.ultContato ? '<span class="tag">Último contato ' + rel(l.ultContato) + '</span>' : '') +
    (a && a.c === 'red' ? '<span class="tag red">' + esc(a.t) + '</span>' : '') + '</div>';
  var h = head(l.nome || l.loja, sub || l.id) + '<div class="pb">' + contactRow(l.whats, l.nome, l.email, waLead(l.whats, l.nome, l.resp), igFind(l.insta, l.loja || l.nome, l.cidade), mapUrl(l.loja || l.nome, l.cidade, l.uf)) + meta +
    '<div class="lbl">O que aconteceu?</div><div class="chips">' +
    QUICK.filter(function (q) { return ST[q.st(l)]; }).map(function (q) { return '<button class="chip q' + (F.quick === q.k ? ' on' : '') + '" data-quick="' + q.k + '">' + q.t + '</button>'; }).join('') + '</div>' +
    '<textarea class="fld" id="f-nota" style="margin-top:8px" placeholder="Anote o que conversaram (opcional)">' + esc(F.nota) + '</textarea>' +
    '<div class="lbl">Etapa</div><div class="chips scroll">' +
    D.status.map(function (s) { return '<button class="chip' + (F.status === s.s ? ' on' : '') + '" data-st="' + esc(s.s) + '">' + esc(s.s) + '</button>'; }).join('') + '</div>';
  if (F.status === PERDIDO) {
    h += '<div class="lbl">Por que não vai comprar?</div><select class="fld" id="f-motivo"><option value="">Escolha o motivo</option>' +
      D.motivos.map(function (m) { return '<option' + (F.motivo === m ? ' selected' : '') + '>' + esc(m) + '</option>'; }).join('') + '</select>';
  }
  if (tipo === 'Ganho' && l.status !== F.status) {
    h += '<div class="lbl">Valor do 1º pedido <small>opcional</small></div><input class="fld" id="f-pedido" inputmode="decimal" placeholder="R$ 0,00" value="' + esc(F.pedido) + '">' +
      '<div class="note">O cliente vai para o pós-venda (aba Clientes) com o primeiro follow-up agendado.</div>';
  }
  if (tipo === 'Aberto') {
    h += '<div class="lbl">Próximo passo</div><input class="fld" id="f-acao" list="acoes" placeholder="Ex.: Cobrar retorno do catálogo" value="' + esc(F.acao) + '">' +
      '<datalist id="acoes"><option>Fazer 1º contato</option><option>Enviar catálogo</option><option>Cobrar retorno do catálogo</option><option>Enviar proposta</option><option>Fechar pedido</option><option>Ligar</option><option>Retomar contato</option></datalist>' +
      '<div style="margin-top:8px">' + dateChips(F.dataAcao, [['Hoje', 0], ['Amanhã', 1], ['+3 dias', 3], ['+7 dias', 7], ['+15 dias', 15]], 'dataAcao') + '</div>' +
      '<div class="lbl">Temperatura</div><div class="chips">' + D.temps.map(function (t) { return '<button class="chip' + (F.temp === t ? ' on' : '') + '" data-temp="' + esc(t) + '"><span class="temp ' + esc(t) + '" style="display:inline-block;margin-right:6px"></span>' + esc(t) + '</button>'; }).join('') + '</div>';
  }
  if (D.admin) {
    h += '<div class="lbl">Responsável</div><select class="fld" id="f-resp"><option value="">— sem responsável —</option>' +
      D.sellers.map(function (s) { return '<option' + (F.resp === s ? ' selected' : '') + '>' + esc(s) + '</option>'; }).join('') + '</select>';
  }
  if (l.pedERP) {
    h += '<div class="lbl">No ERP (Olist Tiny)</div><div class="mx"><div><b>' + l.pedERP + '</b><span>Pedidos</span></div><div><b>' + money(l.totalERP) + '</b><span>Total comprado</span></div></div>' +
      (l.ultPedERP ? '<div class="note">Último pedido ' + rel(l.ultPedERP) + ' (' + br(l.ultPedERP) + ')</div>' : '');
  }
  var dv = function (k) { return F.dados[k] !== undefined ? F.dados[k] : (l[k] === '' || l[k] == null ? '' : l[k]); };
  h += '<details><summary>Dados do lead</summary>' +
    '<div class="grid2"><div class="f"><label>Nome</label><input class="fld" data-dado="nome" value="' + esc(dv('nome')) + '"></div>' +
    '<div class="f"><label>Loja</label><input class="fld" data-dado="loja" value="' + esc(dv('loja')) + '"></div>' +
    '<div class="f"><label>WhatsApp</label><input class="fld" data-dado="whats" inputmode="tel" value="' + esc(dv('whats')) + '"></div>' +
    '<div class="f"><label>E-mail</label><input class="fld" data-dado="email" inputmode="email" value="' + esc(dv('email')) + '"></div>' +
    '<div class="f"><label>Cidade</label><input class="fld" data-dado="cidade" value="' + esc(dv('cidade')) + '"></div>' +
    '<div class="f"><label>UF</label><select class="fld" data-dado="uf"><option></option>' + D.ufs.map(function (u) { return '<option' + (dv('uf') === u ? ' selected' : '') + '>' + u + '</option>'; }).join('') + '</select></div>' +
    '<div class="f"><label>CNPJ / CPF</label><input class="fld" data-dado="doc" value="' + esc(dv('doc')) + '"></div>' +
    '<div class="f"><label>Instagram</label><input class="fld" data-dado="insta" autocapitalize="off" value="' + esc(dv('insta')) + '" placeholder="@perfildaloja"></div>' +
    '<div class="f"><label>Potencial (R$)</label><input class="fld" data-dado="potencial" inputmode="decimal" value="' + esc(dv('potencial')) + '"></div></div>' +
    '<div class="note">' + esc(l.id) + (l.resp ? ' · responsável: ' + esc(l.resp) : ' · sem responsável (ao salvar, fica com você)') + '</div></details>' +
    '<details id="d-hist"><summary>Anotações e histórico</summary>' + (l.obs ? '<div class="obs">' + esc(l.obs) + '</div>' : '') +
    '<ul class="hist" id="histList">' + histHtml() + '</ul></details>' + visBlock();
  h += '</div><div class="pf"><button class="btn primary" data-act="saveLead" id="btnSave">Salvar</button></div>';
  paint(h);
}
function histHtml() {
  if (!F || F.hist === null) return '<li><small>Toque para carregar…</small></li>';
  if (!F.hist.length) return '<li><small>Sem registros.</small></li>';
  return F.hist.map(function (x) {
    var d = new Date(x.t);
    return '<li>' + esc(x.ev) + (x.para && x.de !== x.para ? ' <small>(' + esc(x.de || '—') + ' → ' + esc(x.para) + ')</small>' : '') +
      '<br><small>' + d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) + '</small></li>';
  }).join('');
}
function loadHist() {
  if (!F || F.hist !== null || S.sheet.type !== 'lead') return;
  var id = F.id;
  call('crmHistory', id).then(function (h) { if (F && F.id === id) { F.hist = h; var el = document.getElementById('histList'); if (el) el.innerHTML = histHtml(); } })
    .catch(function (e) { toast(e.message, true); });
}
function readLeadInputs() {
  var g = function (id) { var el = document.getElementById(id); return el ? el.value : undefined; };
  if (g('f-nota') !== undefined) F.nota = g('f-nota');
  if (g('f-acao') !== undefined) F.acao = g('f-acao');
  if (g('f-motivo') !== undefined) F.motivo = g('f-motivo');
  if (g('f-pedido') !== undefined) F.pedido = g('f-pedido');
  if (g('f-resp') !== undefined) F.resp = g('f-resp');
  document.querySelectorAll('[data-dado]').forEach(function (el) { F.dados[el.getAttribute('data-dado')] = el.value; });
}
function busy(btn, on, txt) { btn.disabled = on; btn.textContent = on ? 'Salvando…' : txt; }
// pedido de visita preenchido e não registrado: o Salvar da ficha avisa em vez de perder
function visitaPendente() {
  var d = document.getElementById('vn-data'), h = document.getElementById('vn-hora'), o = document.getElementById('vn-obs');
  return !!((d && d.value) || (h && h.value.trim()) || (o && o.value.trim()));
}
function avisaVisita() {
  if (!visitaPendente()) return false;
  toast('Você preencheu um pedido de visita. Toque em “+ Registrar pedido de visita” ou apague os campos antes de salvar.', true);
  var dv = document.getElementById('d-vis'); if (dv) dv.open = true;
  var b = document.querySelector('[data-act="visNew"]'); if (b) b.scrollIntoView({ behavior: 'smooth', block: 'center' });
  return true;
}
function saveLead() {
  if (avisaVisita()) return;
  readLeadInputs();
  var l = getLead(F.id), ch = {};
  var tipo = (ST[F.status] || {}).t;
  if (F.status !== l.status) ch.status = F.status;
  if (F.status === PERDIDO && !F.motivo) { toast('Escolha o motivo de perda.', true); return; }
  if (F.status === PERDIDO && F.motivo !== l.motivo) ch.motivo = F.motivo;
  if ((F.acao || '') !== (l.acao || '')) ch.acao = F.acao || '';
  if ((F.dataAcao || '') !== (l.dataAcao || '')) ch.dataAcao = F.dataAcao || '';
  if ((F.temp || '') !== (l.temp || '')) ch.temp = F.temp || '';
  if (tipo === 'Ganho' && F.pedido) ch.pedido = F.pedido;
  if (F.nota && F.nota.trim()) { ch.nota = F.nota.trim(); ch.contato = true; }
  if (F.contato) ch.contato = true;
  if (D.admin && (F.resp || '') !== (l.resp || '')) ch.resp = F.resp || '';
  Object.keys(F.dados).forEach(function (k) { if (String(F.dados[k]) !== String(l[k] == null ? '' : l[k])) ch[k] = F.dados[k]; });
  if (!Object.keys(ch).length) { closeSheet(); return; }
  var btn = document.getElementById('btnSave'); busy(btn, true);
  call('crmUpdateLead', F.id, ch).then(function (res) {
    var saiu = replaceLead(res.lead);
    if (res.pv) upsertPV(res.pv);
    syncProspFromLead(res.lead, !!ch.status);
    closeSheet(); render();
    toast(res.pv && ch.status ? '🎉 Pedido fechado! O cliente foi para o pós-venda.' : saiu ? 'Salvo ✓ O lead passou para ' + res.lead.resp + '.' : 'Salvo ✓');
  }).catch(function (e) { busy(btn, false, 'Salvar'); toast(e.message || 'Não consegui salvar', true); });
}
/* devolve true se o lead saiu da carteira de quem está usando (ex.: passou para o closer) */
function replaceLead(nl) {
  if (!nl) return false;
  var fora = !D.admin && nl.resp && !mesmoNome(nl.resp, D.me);
  for (var i = 0; i < D.leads.length; i++) if (D.leads[i].id === nl.id) { if (fora) D.leads.splice(i, 1); else D.leads[i] = nl; return fora; }
  if (!fora) D.leads.push(nl);
  return fora;
}
function upsertPV(p) { for (var i = 0; i < D.pv.length; i++) if (D.pv[i].id === p.id) { if (!p.insta) p.insta = D.pv[i].insta; D.pv[i] = p; return; } D.pv.push(p); }
function upsertX(x) { if (!D.prosp) return; for (var i = 0; i < D.prosp.rows.length; i++) if (D.prosp.rows[i].id === x.id) { D.prosp.rows[i] = x; return; } D.prosp.rows.push(x); }
function syncProspFromLead(l, mudou) {
  if (!D.prosp || !l || !mudou) return;
  D.prosp.rows.forEach(function (x) {
    if (x.lead !== l.id) return;
    var doSdr = x.status === PSK.RESPONDEU || x.status === PSK.QUALIFICADO;
    var fila = [PSK.ABORDAR, PSK.CADENCIA, PSK.SEM_RETORNO, PSK.JA_LEAD].indexOf(x.status) >= 0;
    if (l.tipo === 'Ganho') { if (doSdr || fila) { x.status = doSdr ? PSK.CLIENTE : PSK.JA_CLIENTE; x.proxPasso = 'Cliente'; x.prox = ''; } }
    else if (x.status === PSK.RESPONDEU && ['Qualificado', 'Catálogo enviado', 'Negociação'].indexOf(l.status) >= 0 && mesmoNome(l.resp, D.prosp.closer)
             && String(x.decisor || '').trim() && String(x.cnpj || '').trim()) { x.status = PSK.QUALIFICADO; x.proxPasso = 'Com o ' + D.prosp.closer; x.prox = ''; }
  });
}

/* ---------- ficha da loja (prospecção) ---------- */
function openX(id, viaContato) {
  var x = getX(id); if (!x) return;
  S.sheet = { type: 'x', id: id };
  F = { id: id, etapa: viaContato ? etapaSugerida(x) : '', res: '', nota: '', q: {}, ret: x.proxPasso === 'Retorno solicitado' ? x.prox : '', xresp: x.resp || '', conta: x.conta, vis: null };
  renderX();
}
function renderX() {
  var x = getX(F.id), sug = etapaSugerida(x), etapaRot = F.etapa || sug || x.proxPasso;
  var a = xAlert(x), closer = D.prosp.closer || 'closer';
  var resp = x.status === PSK.RESPONDEU || F.res === 'resp';
  var jaCli = !!PSK.JA_CLIENTE && x.status === PSK.JA_CLIENTE;
  var jaLead = !!PSK.JA_LEAD && x.status === PSK.JA_LEAD;
  var fech = x.status === PSK.QUALIFICADO || x.status === PSK.CLIENTE || jaCli || jaLead;
  var sub = [[x.cidade, x.uf].filter(Boolean).join('/'), x.tier ? 'Tier ' + x.tier : '', x.score !== '' ? 'score ' + x.score : ''].filter(Boolean).join(' · ');
  var wa = waUrl(x.whats, resp ? '' : roteiro(x, etapaRot));
  var d = digits(x.whats);
  var h = head(x.loja, sub) + '<div class="pb">' +
    '<div class="acts four">' +
    '<a class="act w' + (wa ? '' : ' off') + '" href="' + (wa || '#') + '" target="_blank" rel="noopener" data-xc="wa">' + ICON.chat + 'WhatsApp</a>' +
    '<a class="act i' + (x.insta ? '' : ' off') + '" href="' + (igUrl(x.insta) || '#') + '" target="_blank" rel="noopener" data-xc="ig">' + ICON.ig + 'Instagram</a>' +
    '<a class="act' + (d.length >= 10 ? '' : ' off') + '" href="tel:+55' + d + '" data-xc="tel">' + ICON.phone + 'Ligar</a>' +
    '<a class="act" href="https://www.google.com/maps/search/' + encodeURIComponent([x.loja, x.cidade, x.uf].join(' ')) + '" target="_blank" rel="noopener">' + ICON.pin + 'Mapa</a></div>' +
    '<div class="meta">' + pill(x.status, XST) + (x.segmento ? '<span class="tag">' + esc(x.segmento) + '</span>' : '') +
    (x.ultToque ? '<span class="tag">Último toque ' + rel(x.ultToque) + '</span>' : '') + (x.wa === 'Não' ? '<span class="tag">Telefone fixo</span>' : '') +
    (a && a.c === 'red' ? '<span class="tag red">' + esc(a.t) + '</span>' : '') + '</div>';
  if (!resp && !fech && F.res !== 'cliente') {
    h += '<div class="lbl">Mensagem do toque <small>' + esc(etapaRot || '') + '</small></div><div class="script">' + esc(roteiro(x, etapaRot)) + '</div>' +
      '<div class="note">O botão WhatsApp já abre com essa mensagem. Revise antes de enviar.</div>' +
      '<div class="lbl">Qual toque você fez agora?</div><div class="chips">' +
      D.prosp.etapas.map(function (e) { return '<button class="chip' + (e.e === sug ? ' sug' : '') + (F.etapa === e.e ? ' on' : '') + '" data-etapa="' + esc(e.e) + '">' + esc(e.e) + '</button>'; }).join('') + '</div>' +
      (F.etapa ? '<div class="note">Próximo toque agendado sozinho: ' + esc(((D.prosp.etapas.filter(function (e) { return e.e === F.etapa; })[0]) || {}).prox || '') + ' ' + (function (dt) { return rel(dt) + (/^em /.test(rel(dt)) ? ' (' + ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'][new Date(dU(dt)).getUTCDay()] + ', ' + br(dt) + ')' : ''); })(dataToque(D.today, ((D.prosp.etapas.filter(function (e) { return e.e === F.etapa; })[0]) || {}).dias || 0)) + ', contando só dias úteis.</div>' : '');
  }
  if (!fech) {
    h += '<div class="lbl">Resultado</div><div class="chips">' +
      (x.status !== PSK.RESPONDEU ? '<button class="chip q' + (F.res === 'resp' ? ' on' : '') + '" data-res="resp">🎉 Respondeu</button>' : '') +
      '<button class="chip q' + (F.res === 'semint' ? ' on' : '') + '" data-res="semint">✖ Sem interesse</button>' +
      '<button class="chip q' + (F.res === 'fora' ? ' on' : '') + '" data-res="fora">Fora do perfil</button>' +
      (PSK.JA_CLIENTE ? '<button class="chip q' + (F.res === 'cliente' ? ' on' : '') + '" data-res="cliente">⭐ Já é cliente</button>' : '') + '</div>' +
      (F.res === 'cliente' ? '<div class="note">A loja já compra da Indião: sai da cadência e da fila, não conta no Placar como prospecção nova. Se puder, anote com quem ela compra (Pedro, site, representante).</div>' : '');
  }
  if (resp) {
    var q = function (k) { return F.q[k] !== undefined ? F.q[k] : (x[k] || ''); };
    h += '<div class="lbl">Qualificação <small>para passar ao ' + esc(closer) + '</small></div><div class="qbox">' +
      '<div class="f"><label>Quem decide as compras? *</label><input class="fld" data-q="decisor" value="' + esc(q('decisor')) + '" placeholder="Nome do decisor"></div>' +
      '<div class="f"><label>CNPJ *</label><input class="fld" data-q="cnpj" inputmode="numeric" value="' + esc(q('cnpj')) + '" placeholder="00.000.000/0000-00"></div>' +
      '<div class="f"><label>Marcas que trabalha</label><input class="fld" data-q="marcas" value="' + esc(q('marcas')) + '"></div>' +
      '<div class="grid2"><div class="f"><label>Público</label><input class="fld" data-q="publico" value="' + esc(q('publico')) + '"></div>' +
      '<div class="f"><label>Época de compra</label><input class="fld" data-q="epoca" value="' + esc(q('epoca')) + '"></div></div>' +
      '<button class="btn dark" style="width:100%;margin-top:4px" data-act="passar">Passar para o ' + esc(closer) + ' →</button>' +
      '<div class="note">Com decisor e CNPJ, o lead vai para o ' + esc(closer) + ' com tudo anotado. Avise o ' + esc(closer) + ' pelo WhatsApp: o aviso automático ainda não está ligado.</div></div>';
  }
  if (fech) {
    h += '<div class="warn" style="background:var(--wa-soft);color:var(--wa)">' + (jaCli ? '⭐ Já era cliente da Indião. Fora da cadência de prospecção.' : jaLead ? 'A loja já é lead (' + esc(x.proxPasso || 'com outro vendedor') + '). Fora da cadência de prospecção.' : x.status === PSK.CLIENTE ? 'Virou cliente 🎉' : 'Já está com o ' + esc(closer) + ' para fechar.') + (x.lead ? ' Lead ' + esc(x.lead) + '.' : '') + '</div>' +
      (jaCli ? '<div class="note">Marcou por engano? ' + (D.admin ? 'Corrija o status em "Dados da loja", logo abaixo.' : 'Avise o gestor para corrigir.') + '</div>' : '');
  }
  if (!fech && F.res !== 'semint' && F.res !== 'fora' && F.res !== 'cliente') {
    h += '<div class="lbl">Retorno pedido pela loja <small>opcional</small></div>' +
      dateChips(F.ret, [['Amanhã', 1], ['+3 dias', 3], ['+7 dias', 7], ['+15 dias', 15], ['+30 dias', 30]], 'ret') +
      '<div class="note">A loja pediu para falar depois? Marque a data: ela sai da fila de hoje e volta na Agenda no dia certo.</div>';
  }
  h += '<div class="lbl">Anotação <small>opcional</small></div><textarea class="fld" id="f-nota" placeholder="Ex.: falei com a dona, pediu retorno depois do dia 10">' + esc(F.nota) + '</textarea>';
  // Gestor pode trocar quem aborda a loja (a divisão automática não impede ajuste manual)
  if (D.admin) {
    h += '<div class="lbl">Quem aborda esta loja</div><select class="fld" id="f-xresp"><option value="">— sem responsável —</option>' +
      D.sellers.map(function (s) { return '<option' + (F.xresp === s ? ' selected' : '') + '>' + esc(s) + '</option>'; }).join('') + '</select>';
  }
  h += '<details><summary>Dados da loja</summary><div class="grid2">' +
    '<div class="f"><label>Telefone</label><input class="fld" data-q="whats" inputmode="tel" value="' + esc(F.q.whats !== undefined ? F.q.whats : x.whats) + '"></div>' +
    '<div class="f"><label>Instagram</label><input class="fld" data-q="insta" value="' + esc(F.q.insta !== undefined ? F.q.insta : x.insta) + '" placeholder="@loja"></div></div>' +
    (D.admin ? '<div class="f"><label>Status (correção do gestor)</label><select class="fld" id="f-xstatus">' + D.prosp.status.map(function (s) { return '<option' + ((F.xstatus || x.status) === s.s ? ' selected' : '') + '>' + esc(s.s) + '</option>'; }).join('') + '</select></div>' : '') +
    (x.sinais ? '<div class="note"><b>Levantamento:</b> ' + esc(x.sinais) + '</div>' : '') +
    (x.endereco ? '<div class="note"><b>Endereço:</b> ' + esc(x.endereco) + '</div>' : '') +
    (x.nota !== '' && x.nota != null ? '<div class="note"><b>Google:</b> nota ' + esc(x.nota) + (x.aval ? ' · ' + esc(x.aval) + ' avaliações' : '') + '</div>' : '') +
    '<div class="note">' + esc(x.id) + (x.resp ? ' · com ' + esc(x.resp) : '') + (x.lead ? ' · lead ' + esc(x.lead) : '') + '</div></details>' +
    (x.obs ? '<details><summary>Anotações anteriores</summary><div class="obs">' + esc(x.obs) + '</div></details>' : '') +
    visBlock() + '</div><div class="pf"><button class="btn primary" data-act="saveX" id="btnSave">Salvar</button></div>';
  paint(h);
}
function readX() {
  var n = document.getElementById('f-nota'); if (n) F.nota = n.value;
  var xr = document.getElementById('f-xresp'); if (xr) F.xresp = xr.value;
  var xs = document.getElementById('f-xstatus'); if (xs) F.xstatus = xs.value;
  document.querySelectorAll('[data-q]').forEach(function (el) { F.q[el.getAttribute('data-q')] = el.value; });
}
function saveX(passar) {
  if (avisaVisita()) return;
  readX();
  var x = getX(F.id), ch = {};
  Object.keys(F.q).forEach(function (k) { if (String(F.q[k]) !== String(x[k] || '')) ch[k] = F.q[k]; });
  if (F.etapa) ch.etapa = F.etapa;
  if (D.admin && (F.xresp || '') !== (x.resp || '')) ch.resp = F.xresp || '';
  if (D.admin && F.xstatus && F.xstatus !== x.status) ch.status = F.xstatus;
  if (F.nota.trim()) ch.nota = F.nota.trim();
  if (F.res === 'resp') ch.status = PSK.RESPONDEU;
  if (F.res === 'semint') ch.status = PSK.SEM_INTERESSE;
  if (F.res === 'fora') ch.status = PSK.FORA;
  if (F.res === 'cliente' && PSK.JA_CLIENTE) { ch.status = PSK.JA_CLIENTE; delete ch.etapa; }
  var retAntes = x.proxPasso === 'Retorno solicitado' ? x.prox : '';
  if ((F.ret || '') !== (retAntes || '') && F.res !== 'semint' && F.res !== 'fora' && F.res !== 'cliente') {
    if (F.ret) { ch.prox = F.ret; ch.proxPasso = 'Retorno solicitado'; }
    else if (retAntes) { ch.prox = ''; ch.proxPasso = ''; }
  }
  if (passar) {
    var dec = F.q.decisor !== undefined ? F.q.decisor : x.decisor, cnpj = F.q.cnpj !== undefined ? F.q.cnpj : x.cnpj;
    if (!String(dec || '').trim() || !String(cnpj || '').trim()) { toast('Preencha quem decide e o CNPJ para passar ao ' + D.prosp.closer + '.', true); return; }
    if (x.status !== PSK.RESPONDEU && !ch.status) ch.status = PSK.RESPONDEU;
    ch.passar = true;
  }
  if (!Object.keys(ch).length) { closeSheet(); return; }
  var btn = document.getElementById('btnSave'); busy(btn, true);
  var id = F.id;
  var go = function (c) { return call('crmUpdateProsp', id, c); };
  var p;
  if (ch.passar) {
    delete ch.passar;
    p = (ch.status === PSK.RESPONDEU || Object.keys(ch).length ? go(ch) : Promise.resolve(null)).then(function () { return go({ status: PSK.QUALIFICADO }); });
  } else p = go(ch);
  p.then(function (res) {
    upsertX(res.prosp);
    if (res.lead) replaceLead(res.lead);
    closeSheet(); render();
    toast(res.aviso ? '✓ ' + res.prosp.loja + ' ' + res.aviso + '.' : ch.status && ch.status === PSK.JA_CLIENTE ? '⭐ ' + res.prosp.loja + ' marcada como já cliente ✓' : ch.resp !== undefined && !ch.etapa && !ch.status ? (ch.resp ? 'Loja passada para ' + ch.resp + ' ✓' : 'Loja ficou sem responsável ✓') : ch.proxPasso === 'Retorno solicitado' ? 'Retorno agendado para ' + br(res.prosp.prox) + ' ✓' : ch.etapa ? 'Toque registrado ✓ Próximo: ' + (res.prosp.proxPasso || '—') + ' ' + rel(res.prosp.prox) : 'Salvo ✓');
  }).catch(function (e) { busy(btn, false, 'Salvar'); toast(e.message || 'Não consegui salvar', true); });
}

/* ---------- ficha do cliente (pós-venda) ---------- */
var PQUICK = [
  { k: 'falei', t: '💬 Falei com o cliente', contato: true, d: 30 },
  { k: 'semresp', t: '📵 Não respondeu', contato: false, d: 2, nota: 'Tentativa sem resposta.' },
  { k: 'problema', t: '⚠️ Tem um problema', contato: true, d: 2, tipo: 'Resolver problema' },
  { k: 'repor', t: '📦 Vai repor estoque', contato: true, d: 7, tipo: 'Giro de vendas / reposição' }
];
function openPV(id) {
  var p = getPV(id); if (!p) return;
  S.sheet = { type: 'pv', id: id };
  F = { id: id, status: p.status, proxFU: p.proxFU, tipoFU: p.tipoFU, satisf: p.satisf, nota: '', contato: false, quick: null, conta: p.conta, vis: null };
  renderPV();
}
function renderPV() {
  var p = getPV(F.id);
  var ds = semCompra(p), ticket = p.nPed ? p.total / p.nPed : '';
  var h = head(p.cliente, [p.contato, p.cidade].filter(Boolean).join(' · ')) +
    '<div class="pb">' + contactRow(p.whats, p.contato, '', waLead(p.whats, p.contato, p.vend), igFind(p.insta, p.cliente, String(p.cidade || '').split('/')[0]), mapUrl(p.cliente, p.cidade, '')) +
    '<div class="mx"><div><b>' + (p.nPed || 0) + '</b><span>Pedidos</span></div><div><b>' + (p.total ? money(p.total) : '—') + '</b><span>Total comprado</span></div>' +
    '<div><b>' + (ticket ? money(ticket) : '—') + '</b><span>Ticket médio</span></div><div><b>' + (ds != null ? ds + ' dias' : '—') + '</b><span>Sem comprar</span></div></div>' +
    pvShareNote(p) +
    (p.ultContato ? '<div class="note">Último contato ' + rel(p.ultContato) + (p.resultado ? ': ' + esc(p.resultado) : '') + '</div>' : '') +
    '<div class="lbl">Registrar follow-up</div><div class="chips">' +
    PQUICK.map(function (q) { return '<button class="chip q' + (F.quick === q.k ? ' on' : '') + '" data-pquick="' + q.k + '">' + q.t + '</button>'; }).join('') + '</div>' +
    '<textarea class="fld" id="f-nota" style="margin-top:8px" placeholder="Como foi? (vira o resultado do último contato)">' + esc(F.nota) + '</textarea>' +
    '<div class="lbl">Próximo follow-up</div>' + dateChips(F.proxFU, [['+7 dias', 7], ['+15 dias', 15], ['+30 dias', 30], ['+60 dias', 60]], 'proxFU') +
    '<select class="fld" id="f-tipo" style="margin-top:8px">' + D.fuTipos.map(function (t) { return '<option' + (F.tipoFU === t ? ' selected' : '') + '>' + esc(t) + '</option>'; }).join('') + '</select>' +
    '<div class="lbl">Situação</div><div class="chips">' + D.pvStatus.map(function (s) { return '<button class="chip' + (F.status === s.s ? ' on' : '') + '" data-pst="' + esc(s.s) + '">' + esc(s.s) + '</button>'; }).join('') + '</div>' +
    '<div class="lbl">Satisfação</div><div class="chips stars">' + [1, 2, 3, 4, 5].map(function (n) { return '<button class="' + (String(F.satisf) === String(n) ? 'on' : '') + '" data-sat="' + n + '">' + n + '★</button>'; }).join('') + '</div>' +
    (p.obs ? '<details><summary>Anotações</summary><div class="obs">' + esc(p.obs) + '</div></details>' : '') +
    '<div class="note">' + esc(p.id) + ' · carteira de ' + esc(p.vend) + (p.primPed ? ' · cliente desde ' + br(p.primPed) : '') + '</div>' +
    visBlock() + '</div><div class="pf"><button class="btn primary" data-act="savePV" id="btnSave">Salvar</button></div>';
  paint(h);
}
function readPV() { F.nota = document.getElementById('f-nota').value; F.tipoFU = document.getElementById('f-tipo').value; }
function savePV() {
  if (avisaVisita()) return;
  var p = getPV(F.id), ch = {};
  readPV();
  if (F.status !== p.status) ch.status = F.status;
  if ((F.proxFU || '') !== (p.proxFU || '')) ch.proxFU = F.proxFU || '';
  if (F.tipoFU !== p.tipoFU) ch.tipoFU = F.tipoFU;
  if (String(F.satisf || '') !== String(p.satisf || '')) ch.satisf = F.satisf || '';
  if (F.nota.trim()) ch.nota = F.nota.trim();
  if (F.contato) ch.contato = true;
  if (!Object.keys(ch).length) { closeSheet(); return; }
  var btn = document.getElementById('btnSave'); busy(btn, true);
  call('crmUpdatePV', F.id, ch).then(function (np) { upsertPV(np); closeSheet(); render(); toast('Salvo ✓'); })
    .catch(function (e) { busy(btn, false, 'Salvar'); toast(e.message || 'Não consegui salvar', true); });
}

/* ---------- novo lead ---------- */
function openNew() {
  S.sheet = { type: 'new' };
  var opt = function (arr, sel) { return arr.map(function (x) { return '<option' + (x === sel ? ' selected' : '') + '>' + esc(x) + '</option>'; }).join(''); };
  var h = head('Novo lead', 'Lojista que chegou por fora do site') +
    '<form class="pb" id="fNew" autocomplete="off">' +
    '<div class="f"><label>Nome do contato *</label><input class="fld" name="nome" required></div>' +
    '<div class="f"><label>Loja / empresa</label><input class="fld" name="loja"></div>' +
    '<div class="f"><label>WhatsApp *</label><input class="fld" name="whatsapp" inputmode="tel" placeholder="(11) 99999-9999"></div>' +
    '<div class="f"><label>E-mail</label><input class="fld" name="email" inputmode="email"></div>' +
    '<div class="grid2"><div class="f"><label>Cidade</label><input class="fld" name="cidade"></div>' +
    '<div class="f"><label>UF</label><select class="fld" name="uf"><option></option>' + opt(D.ufs) + '</select></div>' +
    '<div class="f"><label>Origem</label><select class="fld" name="origem">' + opt(D.origens.filter(function (o) { return o.indexOf('RD Station') < 0; }), 'WhatsApp') + '</select></div>' +
    '<div class="f"><label>Temperatura</label><select class="fld" name="temperatura"><option></option>' + opt(D.temps) + '</select></div></div>' +
    (D.admin ? '<div class="f"><label>Responsável</label><select class="fld" name="responsavel">' + opt(D.sellers, D.sellers[0]) + '</select></div>' : '') +
    '<div class="f"><label>CNPJ / CPF</label><input class="fld" name="cnpj" inputmode="numeric"></div>' +
    '<div class="f"><label>Próximo passo</label><input class="fld" name="proxima_acao" value="Fazer 1º contato"></div>' +
    '<div class="f"><label>Quando</label><input class="fld" type="date" name="data_proxima_acao" value="' + D.today + '"></div>' +
    '<div class="f"><label>Observações</label><textarea class="fld" name="obs"></textarea></div>' +
    '<div id="dupBox"></div></form>' +
    '<div class="pf"><button class="btn" data-act="close">Cancelar</button><button class="btn primary" data-act="saveNew" id="btnSave">Salvar lead</button></div>';
  openSheet(h);
}
function saveNew(force) {
  var f = {}; new FormData(document.getElementById('fNew')).forEach(function (v, k) { f[k] = String(v).trim(); });
  if (!f.nome && !f.loja) { toast('Informe o nome do contato ou da loja.', true); return; }
  if (!f.whatsapp && !f.email) { toast('Informe o WhatsApp ou o e-mail.', true); return; }
  if (force) f.forcar = true;
  var btn = document.getElementById('btnSave'); busy(btn, true);
  call('crmAddLead', f).then(function (res) {
    busy(btn, false, 'Salvar lead');
    if (res.duplicate) {
      document.getElementById('dupBox').innerHTML = '<div class="warn">Esse contato já existe: <b>' + esc(res.id) + ' · ' + esc(res.nome) + '</b>' +
        (res.resp ? ' (com ' + esc(res.resp) + ')' : '') + '.<div class="chips" style="margin-top:8px">' +
        (res.visivel && getLead(res.id) ? '<button class="chip" data-lead-open="' + esc(res.id) + '">Abrir a ficha</button>' : '') +
        '<button class="chip" data-act="forceNew">Salvar mesmo assim</button></div></div>';
      document.getElementById('dupBox').scrollIntoView({ behavior: 'smooth' });
      return;
    }
    if (res.lead) replaceLead(res.lead);
    closeSheet(); S.tab = 'hoje'; render(); toast('Lead ' + res.id + ' criado ✓');
  }).catch(function (e) { busy(btn, false, 'Salvar lead'); toast(e.message || 'Não consegui salvar', true); });
}

/* ---------- moldura ---------- */
function nav() {
  var b = todayBuckets(), pb = hasProsp() ? prospBuckets() : null;
  var pvN = pvs().filter(function (p) { return sev(pvAlert(p)) < 2; }).length;
  var tabs = [['hoje', 'Hoje', ICON.sun, b.total], ['funil', 'Funil', ICON.cols, 0]];
  if (pb) tabs.push(['prosp', 'Prospectar', ICON.target, pb.agir]);
  tabs.push(['clientes', 'Clientes', ICON.users, pvN]);
  if (D.papel === 'gestor' || D.papel === 'vendas') tabs.push(['visitas', 'Visitas', ICON.pin, 0]);
  if (D.admin) tabs.push(['painel', 'Painel', ICON.chart, 0]);
  if (S.tab === 'visitas' && !(D.papel === 'gestor' || D.papel === 'vendas')) S.tab = 'hoje';
  if (S.tab === 'prosp' && !pb) S.tab = 'hoje';
  if (S.tab === 'painel' && !D.admin) S.tab = 'hoje';
  document.getElementById('tabsD').innerHTML = tabs.map(function (t) { return '<button data-tab="' + t[0] + '" class="' + (S.tab === t[0] ? 'on' : '') + '">' + t[1] + (t[3] ? '<span class="n">' + t[3] + '</span>' : '') + '</button>'; }).join('');
  var bt = function (t) { return '<button data-tab="' + t[0] + '" class="' + (S.tab === t[0] ? 'on' : '') + '">' + t[2] + t[1] + (t[3] ? '<span class="badge">' + t[3] + '</span>' : '') + '</button>'; };
  var bn = document.getElementById('bnav');
  bn.style.gridTemplateColumns = tabs.length >= 6 ? '1fr 1fr 50px 1fr 1fr 1fr 1fr' : tabs.length >= 5 ? '1fr 1fr 56px 1fr 1fr 1fr' : tabs.length === 4 ? '1fr 1fr 64px 1fr 1fr' : '1fr 1fr 72px 1fr';
  bn.classList.toggle('six', tabs.length >= 5);
  var nd = document.getElementById('newd'); if (nd) nd.textContent = S.tab === 'prosp' ? '+ Nova loja' : '+ Novo lead';
  bn.innerHTML = bt(tabs[0]) + bt(tabs[1]) + '<button class="plus" data-act="new" aria-label="Novo lead"><span>+</span></button>' + tabs.slice(2).map(bt).join('');
  document.getElementById('whoBox').innerHTML = D.admin
    ? '<select id="vend" aria-label="Vendedor"><option>Todos</option>' + D.sellers.map(function (s) { return '<option' + (S.vend === s ? ' selected' : '') + '>' + esc(s) + '</option>'; }).join('') + '</select>'
    : '<span class="chipme">' + esc(D.me) + '</span>';
  if (D.admin) document.getElementById('vend').value = S.vend;
}
function render() {
  nav();
  var v = document.getElementById('view');
  var focus = document.activeElement && document.activeElement.id === 'q';
  v.className = S.tab === 'funil' ? 'wide' : '';
  v.innerHTML = S.tab === 'funil' ? viewFunil() : S.tab === 'clientes' ? viewClientes() : S.tab === 'prosp' ? viewProsp() : S.tab === 'painel' && D.admin ? viewPainel() : S.tab === 'visitas' ? viewVisitas() : viewHoje();
  if (S.tab === 'visitas') loadVisitas();
  try { history.replaceState(null, '', '#' + S.tab); } catch (e) { /* sem histórico */ }
  if (focus) { var q = document.getElementById('q'); if (q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); } }
}
function refresh(silent) {
  if (!LOGADO) return Promise.resolve();
  var b = document.getElementById('refresh'); b.classList.add('spin');
  return call('crmReload').then(function (nd) {
    D = nd; indexLists(); b.classList.remove('spin');
    if (!S.sheet && !(silent && S.tab === 'visitas')) render(); else nav();
    if (!S.sheet && silent && S.tab === 'visitas') {
      var raiz = document.getElementById('visRoot'), foco = document.activeElement;
      if (raiz && !(foco && raiz.contains(foco) && /INPUT|SELECT|TEXTAREA/.test(foco.tagName)) && !raiz.querySelector('details[open]')) loadVisitas();
    }
    if (!silent) toast('Atualizado ✓');
  }).catch(function (e) { b.classList.remove('spin'); if (!silent) toast(e.message, true); });
}

/* ---------- eventos ---------- */
document.addEventListener('click', function (e) {
  if (e.target.matches && e.target.matches('input[type=date]') && e.target.showPicker) { try { e.target.showPicker(); } catch (x) { /* celular abre sozinho */ } }
  var t = e.target.closest('[data-tab],[data-act],[data-lead],[data-pv],[data-x],[data-wa],[data-wapv],[data-wax],[data-quick],[data-st],[data-temp],[data-date],[data-pquick],[data-pst],[data-sat],[data-lead-open],[data-pmode],[data-etapa],[data-res],[data-xc],[data-dtopen]');
  if (!t) return;
  var d = t.dataset;
  if (d.wa) { setTimeout(function () { openLead(d.wa); toast('Depois da conversa, registre aqui o que aconteceu.'); }, 400); return; }
  if (d.wapv) { setTimeout(function () { openPV(d.wapv); }, 400); return; }
  if (d.wax) { setTimeout(function () { openX(d.wax, true); toast('Toque feito? É só tocar em Salvar.'); }, 400); return; }
  if (d.xc) { if (S.sheet && S.sheet.type === 'x' && !F.etapa) { var xx = getX(F.id); var sg = etapaSugerida(xx); if (sg && xx.status !== PSK.RESPONDEU) { readX(); F.etapa = sg; setTimeout(renderX, 300); } } return; }
  if (d.tab) { S.tab = d.tab; S.q = ''; S.pmore = 0; closeSheet(); render(); window.scrollTo(0, 0); return; }
  if (d.pmode) { S.pmode = d.pmode; S.pmore = 0; render(); return; }
  if (d.leadOpen) { openLead(d.leadOpen); return; }
  if (d.lead) { openLead(d.lead); return; }
  if (d.x && !S.sheet) { openX(d.x); return; }
  if (d.pv && !S.sheet) { openPV(d.pv); return; }
  if (d.quick) { readLeadInputs(); applyQuick(d.quick); renderLead(); return; }
  if (d.st) { readLeadInputs(); F.quick = null; applyStatus(d.st); renderLead(); return; }
  if (d.temp) { readLeadInputs(); F.temp = F.temp === d.temp ? '' : d.temp; renderLead(); return; }
  if (d.etapa) { readX(); F.etapa = F.etapa === d.etapa ? '' : d.etapa; renderX(); return; }
  if (d.res) { readX(); F.res = F.res === d.res ? '' : d.res; renderX(); return; }
  if (d.dtopen) {
    if (S.sheet.type === 'lead') { readLeadInputs(); F.dtOpen = d.dtopen; renderLead(); }
    else if (S.sheet.type === 'x') { readX(); F.dtOpen = d.dtopen; renderX(); }
    else { readPV(); F.dtOpen = d.dtopen; renderPV(); }
    var di = document.querySelector('[data-datein="' + d.dtopen + '"]');
    if (di) { di.focus(); try { di.showPicker(); } catch (x) { /* fora do clique direto o navegador não abre: o campo fica visível */ } }
    return;
  }
  if (d.date !== undefined && d.field) {
    if (S.sheet.type === 'lead') { readLeadInputs(); F[d.field] = d.date; renderLead(); }
    else if (S.sheet.type === 'x') { readX(); F[d.field] = d.date; renderX(); }
    else { readPV(); F[d.field] = d.date; renderPV(); }
    return;
  }
  if (d.pquick) {
    readPV();
    var q = PQUICK.filter(function (x) { return x.k === d.pquick; })[0], p = getPV(F.id);
    if (F.quick === q.k) { F.quick = null; F.contato = false; F.proxFU = p.proxFU; F.tipoFU = p.tipoFU; F.status = p.status; }
    else {
      F.quick = q.k; F.contato = q.contato; F.proxFU = addDays(D.today, q.d);
      if (q.tipo) F.tipoFU = q.tipo; else if (q.contato && (!F.tipoFU || F.tipoFU === D.fuTipos[0])) F.tipoFU = D.fuTipos[1] || F.tipoFU;
      if (q.contato && F.status === 'Onboarding') F.status = 'Ativo';
      if (q.k === 'problema') F.status = 'Em risco';
      if (q.nota && !F.nota) F.nota = q.nota;
    }
    renderPV(); return;
  }
  if (d.pst) { readPV(); F.status = d.pst; renderPV(); return; }
  if (d.sat) { readPV(); F.satisf = String(F.satisf) === d.sat ? '' : d.sat; renderPV(); return; }
  switch (d.act) {
    case 'close': closeSheet(); break;
    case 'new': if (S.tab === 'prosp') openNewX(); else openNew(); break;
    case 'saveLead': saveLead(); break;
    case 'savePV': savePV(); break;
    case 'saveX': saveX(false); break;
    case 'passar': saveX(true); break;
    case 'saveNew': saveNew(false); break;
    case 'forceNew': saveNew(true); break;
    case 'closed': S.closed = !S.closed; render(); break;
    case 'more': S.pmore += 20; render(); break;
    case 'playbook': openPlaybook(); break;
    case 'copy': copyTxt(PB_TXT[+d.i] || ''); break;
  }
});
document.addEventListener('change', function (e) {
  if (e.target.id === 'vend') { S.vend = e.target.value; render(); }
  if (e.target.dataset && e.target.dataset.datein) {
    var f = e.target.dataset.datein;
    // enquanto digita o ano (ex.: 0002), espera a data completa para não redesenhar no meio
    if (e.target.value && e.target.value.slice(0, 4) < D.today.slice(0, 4)) return;
    if (S.sheet.type === 'lead') { readLeadInputs(); F[f] = e.target.value; renderLead(); }
    else if (S.sheet.type === 'x') { readX(); F[f] = e.target.value; renderX(); }
    else { readPV(); F[f] = e.target.value; renderPV(); }
  }
});
document.addEventListener('input', function (e) { if (e.target.id === 'q') { S.q = e.target.value; render(); } });
document.addEventListener('toggle', function (e) { if (e.target.id === 'd-hist' && e.target.open) loadHist(); }, true);
document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && S.sheet) closeSheet(); });
document.getElementById('refresh').addEventListener('click', function () { refresh(false); });

// arrastar entre etapas (computador)
var dragId = null;
document.addEventListener('dragstart', function (e) { var c = e.target.closest && e.target.closest('[data-lead]'); if (c) { dragId = c.dataset.lead; e.dataTransfer.setData('text/plain', dragId); } });
document.addEventListener('dragover', function (e) { var c = e.target.closest && e.target.closest('[data-drop]'); if (c && dragId) { e.preventDefault(); c.classList.add('over'); } });
document.addEventListener('dragleave', function (e) { var c = e.target.closest && e.target.closest('[data-drop]'); if (c) c.classList.remove('over'); });
document.addEventListener('drop', function (e) {
  var c = e.target.closest && e.target.closest('[data-drop]'); if (!c || !dragId) return;
  e.preventDefault(); c.classList.remove('over');
  var id = dragId, st = c.dataset.drop, l = getLead(id); dragId = null;
  if (!l || l.status === st) return;
  var t = (ST[st] || {}).t;
  if (st === PERDIDO || t === 'Ganho') { openLead(id, st); return; }
  var old = l.status; l.status = st; l.tipo = t || 'Aberto'; render();
  call('crmUpdateLead', id, { status: st }).then(function (res) { var saiu = replaceLead(res.lead); syncProspFromLead(res.lead, true); render(); toast(l.nome + ' → ' + st + (saiu ? ' (passou para ' + res.lead.resp + ')' : '')); })
    .catch(function (err) { l.status = old; render(); toast(err.message, true); });
});

// atualiza sozinho a cada 5 min e quando volta para a aba
setInterval(function () { if (!S.sheet && document.visibilityState === 'visible') refresh(true); }, 300000);
document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible' && !S.sheet) refresh(true); });

// a primeira tela é desenhada por iniciar(), depois do login

/* =====================================================================
 * v3 · login, nova loja (prospecção), visitas, prestação de contas e acessos
 * ===================================================================== */
var BASE = { nome: 'Jaguariúna, SP', lat: -22.7056, lng: -46.9858 };
var SEGMENTOS = ['Multimarca country', 'Selaria / agro com vestuário', 'Boutique feminina country', 'Loja de rodeio / eventos', 'Outro'];
var ORIGENS_X = ['Google Maps', 'Instagram', 'Indicação', 'Feira / Evento', 'Show Us Agroboy', 'Visita presencial', 'Outro'];
var CATEGORIAS_DESP = ['Combustível', 'Hotel, pedágio e estacionamento', 'Alimentação', 'Manutenção do veículo'];
var FORMAS_PAG = ['Cartão da empresa', 'Pix da empresa', 'Pago pelo Pedro (reembolso)'];
var PRIMEIRO_PEDIDO_BASE = 3000; // Financeiro, 16/11: base R$ 3,0 mil (R$ 3,9 mil = cenário otimista)
var MER_MIN_B2B = 6.5;           // custo de visita por 1º pedido ≤ 1º pedido ÷ 6,5
var SIT_VISITA = ['a agendar', 'agendada', 'realizada', 'reagendar', 'cancelada'];
var RES_VISITA = ['pedido', 'catálogo / retorno', 'sem interesse', 'reagendar', 'loja fechada'];

function podeRoteiro() { return D.papel === 'gestor' || D.papel === 'vendas'; }
function optList(arr, sel, vazio) { return (vazio !== undefined ? '<option value="">' + esc(vazio) + '</option>' : '') + arr.map(function (x) { return '<option' + (x === sel ? ' selected' : '') + '>' + esc(x) + '</option>'; }).join(''); }
function dataBR(iso) { if (!iso) return ''; var p = String(iso).slice(0, 10).split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }
function moneyC(v) { return v == null || v === '' ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function q(res) { if (res.error) throw new Error(traduzErro(res.error.message)); return res.data; }
function openWide(h) { openSheet(h); document.getElementById('panel').classList.add('wide'); }
function logoSvg() { var l = document.querySelector('.brand svg.logo'); return l ? l.outerHTML : ''; }
function celulaCSV(v) {
  if (v == null) return '""';
  var s = typeof v === 'number' ? String(v).replace('.', ',') : String(v);
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) s = new Date(s).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  if (/^[=+@\t\r]/.test(s) || /^-[^0-9]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
}
function baixarCSV(nome, linhas, cab) {
  if (!linhas.length) { toast('Nada para exportar.', true); return; }
  var cols = Object.keys(linhas[0]);
  var csv = (cab ? cab + '\n\n' : '') + [cols.join(';')].concat(linhas.map(function (l) { return cols.map(function (c) { return celulaCSV(l[c]); }).join(';'); })).join('\n');
  var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })); a.download = nome; a.click();
}

/* ---------- login ---------- */
function telaLogin(msg) {
  LOGADO = false;
  document.getElementById('top').classList.add('anon');
  document.getElementById('bnav').classList.add('hidden');
  var v = document.getElementById('view'); v.className = '';
  v.innerHTML = '<div class="login-wrap"><div class="lg-box">' + penaSvg() + logoSvg() +
    '<h1>CRM Atacado</h1><p>Digite o seu e-mail de acesso. Você recebe um link para entrar: toque nele no mesmo navegador em que você usa o CRM.</p>' +
    (window.navigator.standalone ? '<p><b>iPhone:</b> este ícone antigo não recebe o login do e-mail. Apague o ícone e, no Safari, abra crm.indiaostore.com.br › Compartilhar › Adicionar à Tela de Início. O novo ícone abre no Safari e o link do e-mail funciona.</p>' : '') +
    '<form id="fLogin" autocomplete="on"><label for="lgEmail">E-mail</label><input class="fld" id="lgEmail" type="email" autocomplete="email" required placeholder="nome@exemplo.com">' +
    '<button class="btn primary" id="lgBtn">Receber link de acesso</button></form><div class="lg-msg" id="lgMsg">' + esc(msg || '') + '</div></div></div>';
  document.getElementById('fLogin').addEventListener('submit', function (e) {
    e.preventDefault();
    var email = document.getElementById('lgEmail').value.trim().toLowerCase(), bt = document.getElementById('lgBtn'), m = document.getElementById('lgMsg');
    bt.disabled = true; m.textContent = 'Enviando…';
    sb.auth.signInWithOtp({ email: email, options: { emailRedirectTo: location.origin + location.pathname, shouldCreateUser: true } }).then(function (r) {
      bt.disabled = false;
      if (r.error) { m.textContent = 'Não foi possível enviar: ' + (/rate|seconds/i.test(r.error.message) ? 'muitos pedidos seguidos, espere alguns minutos.' : r.error.message); return; }
      m.innerHTML = '✓ Pronto! Abra o e-mail <b>' + esc(email) + '</b> e toque em <b>Log In</b>. Não chegou? Veja o spam.';
    });
  });
}
function semAcesso(msg) {
  var v = document.getElementById('view');
  v.innerHTML = '<div class="login-wrap"><div class="lg-box">' + penaSvg() + logoSvg() + '<h1>Acesso não liberado</h1><p>' + esc(msg) + '</p>' +
    '<button class="btn primary" id="sair2">Sair e entrar com outro e-mail</button></div></div>';
  document.getElementById('sair2').onclick = sair;
}
function falhaCarga(msg) {
  var v = document.getElementById('view');
  v.innerHTML = '<div class="login-wrap"><div class="lg-box">' + penaSvg() + logoSvg() + '<h1>Não consegui carregar o CRM</h1><p>' + esc(msg) + '</p>' +
    '<button class="btn primary" id="tentar">Tentar de novo</button><button class="btn" id="sair2">Sair</button></div></div>';
  document.getElementById('tentar').onclick = iniciar; document.getElementById('sair2').onclick = sair;
}
function sair() { sb.auth.signOut().then(function () { location.hash = ''; location.reload(); }); }
document.getElementById('sair').addEventListener('click', sair);

function iniciar() {
  document.getElementById('view').innerHTML = '<div class="boot"><div>' + penaSvg() + '<p>Carregando o CRM…</p></div></div>';
  Promise.all([call('crmReload'), carregarRotas().catch(function () { return []; })]).then(function (res) {
    var nd = res[0];
    D = nd; indexLists(); LOGADO = true;
    S.vend = D.admin ? 'Todos' : D.me;
    document.getElementById('top').classList.remove('anon');
    document.getElementById('bnav').classList.remove('hidden');
    var h = location.hash.slice(1);
    if (['hoje', 'funil', 'prosp', 'clientes', 'painel', 'visitas'].indexOf(h) >= 0) S.tab = h;
    else if (hasProsp() && D.prosp.sdrs.indexOf(D.me) >= 0 && !leads().filter(function (l) { return l.tipo === 'Aberto'; }).length) S.tab = 'prosp';
    render();
  }).catch(function (e) {
    var m = (e && e.message) || '';
    if (/Acesso não liberado/i.test(m)) semAcesso(m); else falhaCarga(m || 'Não foi possível carregar o CRM.');
  });
}
(function () {
  var hp = new URLSearchParams(location.hash.slice(1)), erro = '';
  if (hp.get('error_description') || hp.get('error')) { erro = 'O link de acesso expirou ou já foi usado. Peça um novo abaixo.'; history.replaceState(null, '', location.pathname); }
  var iniciado = false;
  sb.auth.onAuthStateChange(function (ev, session) {
    if (session && session.user) {
      if (!iniciado) { iniciado = true; if (location.hash.indexOf('access_token') >= 0) history.replaceState(null, '', location.pathname); setTimeout(iniciar, 0); }
    } else if (ev === 'INITIAL_SESSION' || ev === 'SIGNED_OUT') { iniciado = false; telaLogin(erro); }
  });
})();

/* ---------- nova loja para prospectar (SDRs) ---------- */
function openNewX() {
  S.sheet = { type: 'newx' };
  var h = head('Nova loja para prospectar', 'Entra na fila como "1. A abordar"') +
    '<form class="pb" id="fNewX" autocomplete="off">' +
    '<div class="f"><label>Nome da loja *</label><input class="fld" name="loja" required></div>' +
    '<div class="grid2"><div class="f"><label>Cidade</label><input class="fld" name="cidade"></div>' +
    '<div class="f"><label>UF</label><select class="fld" name="uf">' + optList(D.ufs, '', '') + '</select></div></div>' +
    '<div class="f"><label>Telefone / WhatsApp</label><input class="fld" name="whatsapp" inputmode="tel" placeholder="(16) 99999-9999"></div>' +
    '<div class="f"><label>Instagram</label><input class="fld" name="insta" autocapitalize="off" placeholder="@perfildaloja"></div>' +
    '<div class="grid2"><div class="f"><label>Segmento</label><select class="fld" name="segmento">' + optList(SEGMENTOS, '', '') + '</select></div>' +
    '<div class="f"><label>Onde encontrou</label><select class="fld" name="origem">' + optList(ORIGENS_X, 'Google Maps') + '</select></div></div>' +
    '<div class="f"><label>Endereço</label><input class="fld" name="endereco" placeholder="Rua, número, bairro (ajuda a montar as rotas de visita)"></div>' +
    (D.admin ? '<div class="f"><label>Quem aborda</label><select class="fld" name="sdr">' + optList(D.sellers, D.me === 'Gestor' ? '' : D.me, '— sem responsável —') + '</select></div>' : '') +
    '<div class="f"><label>Anotação</label><textarea class="fld" name="obs" placeholder="Ex.: loja grande, trabalha com Ariat e TXC"></textarea></div>' +
    '<div class="note">Informe o telefone ou o Instagram. Se a loja já estiver no CRM, aparece um aviso.</div><div id="dupBox"></div></form>' +
    '<div class="pf"><button class="btn" data-act="close">Cancelar</button><button class="btn primary" data-act="saveNewX" id="btnSave">Salvar loja</button></div>';
  openSheet(h);
}
function saveNewX(force) {
  var f = {}; new FormData(document.getElementById('fNewX')).forEach(function (v, k) { f[k] = String(v).trim(); });
  if (!f.loja) { toast('Informe o nome da loja.', true); return; }
  if (!f.whatsapp && !f.insta) { toast('Informe o telefone ou o Instagram da loja.', true); return; }
  if (force) f.forcar = true;
  var btn = document.getElementById('btnSave'); busy(btn, true);
  call('crmAddProsp', f).then(function (res) {
    busy(btn, false, 'Salvar loja');
    if (res.duplicate) {
      var abre = res.visivel && (res.tipo === 'prosp' ? getX(res.id) : res.tipo === 'cliente' ? getPV(res.id) : getLead(res.id));
      document.getElementById('dupBox').innerHTML = '<div class="warn">Essa loja já está no CRM: <b>' + esc(res.id) + ' · ' + esc(res.loja) + '</b> (' + esc(res.status) + (res.resp ? ', com ' + esc(res.resp) : '') + ').' +
        '<div class="chips" style="margin-top:8px">' + (abre ? '<button class="chip" data-abre="' + esc(res.tipo) + ':' + esc(res.id) + '">Abrir a ficha</button>' : '') +
        (res.tipo === 'cliente' && !D.admin ? '' : '<button class="chip" type="button" data-act="forceNewX">Salvar mesmo assim</button>') + '</div>' +
        (res.tipo === 'cliente' ? '<div class="note">É cliente da carteira de ' + esc(res.resp || '—') + '. ' + (D.admin ? 'Se salvar, entra como "0. Já é cliente", fora da cadência.' : 'Fale com quem cuida da loja em vez de prospectar.') + '</div>' : '') + '</div>';
      document.getElementById('dupBox').scrollIntoView({ behavior: 'smooth' });
      return;
    }
    upsertX(res.prosp); closeSheet(); S.tab = 'prosp'; S.pmode = 'novas'; S.q = ''; render();
    toast('Loja ' + res.id + ' incluída na fila ✓');
  }).catch(function (e) { busy(btn, false, 'Salvar loja'); toast(e.message || 'Não consegui salvar', true); });
}

/* ---------- rotas (tabela rotas + rota_paradas no Supabase) ---------- */
var ROTAS_DB = [];
var UFS_ROTA = ['SP', 'MG', 'PR', 'GO', 'MS', 'MT', 'RO', 'RJ', 'SC', 'RS'];
function carregarRotas() { return sb.from('rotas').select('*').eq('ativa', true).order('ordem').then(function (r) { ROTAS_DB = q(r) || []; return ROTAS_DB; }); }
function rotaInfo(cod) { return ROTAS_DB.filter(function (r) { return r.codigo === cod; })[0]; }
function rotasVisita() { return ROTAS_DB.filter(function (r) { return r.codigo !== 'A planejar'; }); }
function chaveCidade(t) { return String(t || '').replace(/\s*\(.*\)\s*$/, '').trim().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
function rotaOpts(sel, vazio) {
  return (vazio !== undefined ? '<option value="">' + esc(vazio) + '</option>' : '') +
    rotasVisita().map(function (r) { return '<option value="' + esc(r.codigo) + '"' + (r.codigo === sel ? ' selected' : '') + '>' + esc(r.codigo + ' · ' + r.nome) + '</option>'; }).join('') +
    '<option value="A planejar"' + (sel === 'A planejar' ? ' selected' : '') + '>A planejar</option>';
}

/* ---------- visita presencial e rota, dentro da ficha ---------- */
function visBlock() { return '<details id="d-vis"><summary>📍 Visita presencial e rota</summary><div id="visBox">' + visHtml() + '</div></details>'; }
function visHtml() {
  if (!F || !F.conta) return '';
  if (!F.vis) return '<p class="note">Toque para carregar…</p>';
  var c = F.vis.conta || {}, rows = F.vis.rows || [], rr = F.vis.rotas || [];
  var h = (podeRoteiro() ? '<div class="f"><label>Rota de visita</label><select class="fld" id="vis-rota">' + rotaOpts(c.rota || '', '— fora das rotas —') + '</select></div>'
                         : '<div class="f"><label>Rota de visita</label><div class="tag">' + esc(c.rota || 'fora das rotas') + '</div></div>') +
    (rr.length ? '<div class="note">Entra em: ' + rr.map(function (x) {
      return '<b>' + esc(x.rota) + '</b> dia ' + x.dia + (x.via === 'avulsa' ? ' (incluída avulsa)' : '') + (x.sugerida ? ' (cidade sugerida, falta confirmar)' : '');
    }).join(' · ') + '</div>' : (c.rota === 'A planejar' ? '<div class="note">Etiqueta <b>A planejar</b>: ainda não entra em nenhuma rota.' + (c.rota_anterior ? ' Rota antiga: ' + esc(c.rota_anterior) + '.' : '') + '</div>' : '')) +
    (c.endereco ? '<div class="note"><b>Endereço:</b> ' + esc(c.endereco) + '</div>' : '<div class="note">Sem endereço: o roteiro usa o centro da cidade. Anote o endereço para o roteiro ficar certo.</div>');
  h += '<div class="lbl">Visitas</div>' + (rows.length ? rows.map(function (v) {
    var edit = F.visEdit === v.id;
    return '<div class="vrow"><div><b>' + esc(v.situacao) + '</b> ' + (v.data_visita ? dataBR(v.data_visita) : '') + ' ' + esc(v.hora || '') +
      (v.resultado ? ' · ' + esc(v.resultado) : '') + (v.valor_pedido ? ' · ' + moneyC(v.valor_pedido) : '') + (v.roteiro_id ? ' · em roteiro' : '') +
      '<br><small>' + esc(v.observacoes || '') + (v.agendado_por ? ' · pedida por ' + esc(v.agendado_por) : '') + '</small></div>' +
      '<button class="chip" data-visedit="' + esc(v.id) + '">' + (edit ? 'Fechar' : 'Atualizar') + '</button></div>' +
      (edit ? '<div class="qbox"><div class="fgrid">' +
        '<div><label>Situação</label><select class="fld" id="ve-sit">' + optList(SIT_VISITA, v.situacao) + '</select></div>' +
        '<div><label>Resultado</label><select class="fld" id="ve-res">' + optList(RES_VISITA, v.resultado || '', '—') + '</select></div>' +
        '<div><label>Data</label><input class="fld" type="date" id="ve-data" value="' + esc(v.data_visita || '') + '"></div>' +
        '<div><label>Hora</label><input class="fld" id="ve-hora" value="' + esc(v.hora || '') + '" placeholder="10:30"></div>' +
        '<div class="full"><label>Valor do pedido (R$)</label><input class="fld" id="ve-valor" inputmode="decimal" value="' + esc(numTxt(v.valor_pedido)) + '"></div>' +
        '<div class="full"><label>Observações</label><input class="fld" id="ve-obs" value="' + esc(v.observacoes || '') + '"></div></div>' +
        '<button class="btn dark" style="width:100%;margin-top:8px" data-act="visEditSave" data-id="' + esc(v.id) + '">Salvar visita</button></div>' : '');
  }).join('') : '<p class="note">Nenhuma visita ainda.</p>');
  h += '<div class="lbl">Pedir ou agendar visita</div><div class="fgrid">' +
    '<div><label>Situação</label><select class="fld" id="vn-sit">' + optList(['a agendar', 'agendada'], 'a agendar') + '</select></div>' +
    '<div><label>Data</label><input class="fld" type="date" id="vn-data" min="' + D.today + '"></div>' +
    '<div><label>Hora</label><input class="fld" id="vn-hora" placeholder="10:30"></div>' +
    '<div><label>Observação</label><input class="fld" id="vn-obs" placeholder="Ex.: dona atende à tarde"></div></div>' +
    '<button class="btn" style="width:100%;margin-top:8px" data-act="visNew">+ Registrar pedido de visita</button>' +
    '<div class="note">O ' + esc((D.prosp && D.prosp.closer) || 'Pedro') + ' vê o pedido na aba Visitas e encaixa no roteiro da rota.</div>';
  return h;
}
function loadVis(force) {
  if (!F || !F.conta || (F.vis && !force)) return;
  var conta = F.conta, fid = F.id;
  Promise.all([
    sb.from('visitas').select('*').eq('conta_id', conta).order('criado_em', { ascending: false }),
    sb.from('contas').select('id,nome,rota,rota_anterior,endereco,cidade,uf').eq('id', conta).single(),
    sb.rpc('crm_rotas_da_conta', { p_conta: conta }),
    ROTAS_DB.length ? Promise.resolve(null) : carregarRotas()
  ]).then(function (r) {
    if (!F || F.id !== fid) return;
    F.vis = { rows: q(r[0]), conta: q(r[1]), rotas: q(r[2]) || [] };
    var el = document.getElementById('visBox'); if (el) el.innerHTML = visHtml();
  }).catch(function (e) { toast(e.message, true); });
}
function visRefresh() { var el = document.getElementById('visBox'); if (el) el.innerHTML = visHtml(); }
// a etiqueta de rota que aparece nas fichas carregadas (D) acompanha a mudança
function atualizarRotaLocal(conta, rota) {
  D.leads.concat(D.pv, D.prosp ? D.prosp.rows : []).forEach(function (o) { if (o.conta === conta) o.rota = rota; });
}

/* ---------- loja sem ficha na sua carteira (ex.: aba Visitas) ---------- */
function openConta(id) {
  var aberto = D.leads.filter(function (l) { return l.conta === id && l.tipo === 'Aberto'; })[0];
  var lead = aberto || D.leads.filter(function (l) { return l.conta === id; })[0];
  var x = D.prosp ? D.prosp.rows.filter(function (z) { return z.conta === id; })[0] : null;
  var p = D.pv.filter(function (z) { return z.conta === id; })[0];
  closeSheet();
  if (aberto) return openLead(aberto.id);
  if (p) return openPV(p.id);
  if (x) return openX(x.id);
  if (lead) return openLead(lead.id);
  sb.from('contas').select('*').eq('id', id).single().then(function (r) {
    var c = q(r), loja = ((S.vcache || {}).lista || []).filter(function (z) { return z.id === id; })[0] || {}, px = loja.prosp, lx = loja.lead;
    S.sheet = { type: 'conta', id: id };
    F = { id: 'conta:' + id, conta: id, vis: null };
    var h = head(c.nome, [c.cidade, c.uf].filter(Boolean).join('/')) + '<div class="pb">' +
      contactRow(c.whatsapp || c.telefone, '', c.email, waUrl(c.whatsapp || c.telefone, ''), igUrl(c.instagram), mapUrl(c.nome, c.cidade, c.uf)) +
      '<div class="meta">' + (px ? pill(px.status, XST) : '') + (lx ? pill(lx.status) : '') + (c.segmento ? '<span class="tag">' + esc(c.segmento) + '</span>' : '') + '</div>' +
      '<div class="note">' + (px && px.sdr ? 'Prospecção ' + esc(px.codigo) + ' com ' + esc(px.sdr) + '. ' : '') + (lx ? 'Lead ' + esc(lx.codigo) + (lx.resp ? ' com ' + esc(lx.resp) : '') + '. ' : '') +
      (px || lx ? 'A ficha completa fica com quem cuida da loja.' : 'Loja sem prospecção nem lead ativo no CRM.') + '</div>' + visBlock() + '</div>';
    openSheet(h);
    var d = document.getElementById('d-vis'); if (d) { d.open = true; loadVis(); }
  }).catch(function (e) { toast(e.message, true); });
}

/* ---------- aba Visitas: percurso por dia, lojas da rota, roteiro e prestação de contas ---------- */
function viewVisitas() {
  return '<h1>Visitas</h1><div class="date">Rotas presenciais do ' + esc((D.prosp && D.prosp.closer) || 'Pedro') + ' · no máximo 3 cidades por dia</div><div id="visRoot"><div class="boot"><div>' + penaSvg() + '<p>Carregando a rota…</p></div></div></div>';
}
// km de cada dia: rotas com base (saída = chegada) voltam para a base todo dia; as outras seguem de onde pararam
function kmDias(rota, paradas) {
  var base = rota.partida_lat ? { lat: rota.partida_lat, lng: rota.partida_lng } : BASE;
  var fim = rota.chegada_lat ? { lat: rota.chegada_lat, lng: rota.chegada_lng } : base;
  var idaVolta = mesmaBase(rota);
  var dias = {}, ult = 0;
  paradas.filter(function (p) { return !p.sugerida && p.lat; }).forEach(function (p) { (dias[p.dia] = dias[p.dia] || []).push(p); ult = Math.max(ult, p.dia); });
  var out = {}, atual = base;
  out.semLocal = {}; paradas.forEach(function (p) { if (!p.sugerida && !p.lat) out.semLocal[p.dia] = (out.semLocal[p.dia] || 0) + 1; });
  Object.keys(dias).map(Number).sort(function (a, b) { return a - b; }).forEach(function (d) {
    var km = 0; if (idaVolta) atual = base;
    dias[d].sort(function (a, b) { return a.ordem - b.ordem; }).forEach(function (p) { km += distKm(atual, p); atual = p; });
    if (idaVolta) km += distKm(atual, base); else if (d === ult) km += distKm(atual, fim);
    out[d] = Math.round(km * 1.25);
  });
  return out;
}
function mesmaBase(r) {
  if (r.partida_lat && r.chegada_lat) return distKm({ lat: r.partida_lat, lng: r.partida_lng }, { lat: r.chegada_lat, lng: r.chegada_lng }) < 5;
  return (r.partida || '') === (r.chegada || '');
}
function cidadesNoDia(paradas, dia) {
  var k = {};
  paradas.filter(function (p) { return !p.sugerida && p.dia === dia; }).forEach(function (p) { k[chaveCidade(p.cidade || (p.contas || {}).cidade)] = 1; });
  return Object.keys(k).length;
}
function statusLoja(c) {
  if (c.cliente) return 'cliente';
  if (c.lead && c.lead.tipo === 'Aberto') return 'lead';
  if (c.prosp && ['8. Qualificado → Pedro', '9. Virou cliente', '0. Já é cliente'].indexOf(c.prosp.status) >= 0) return 'lead';
  if (c.prosp && ['5. Sem interesse', '6. Fora do ICP'].indexOf(c.prosp.status) >= 0) return 'fora';
  if (c.prosp) return 'prosp';
  return 'historico';
}
async function loadVisitas() {
  try {
    if (!ROTAS_DB.length) await carregarRotas();
    var rota = S.rota && rotaInfo(S.rota) ? S.rota : ((rotasVisita()[0] || {}).codigo || 'A planejar');
    var filtro = S.vfiltro || 'ativas', info = rotaInfo(rota) || { codigo: rota, nome: rota };
    S.rota = rota;
    var r = await Promise.all([
      sb.rpc('crm_rota_lojas', { p_rota: rota }),
      rota === 'A planejar' ? Promise.resolve({ data: [] }) : sb.from('rota_paradas').select('*, contas(nome,cidade,uf)').eq('rota', rota).order('dia').order('ordem'),
      sb.from('visitas').select('*').in('situacao', ['a agendar', 'agendada', 'reagendar'])
    ]);
    var root = document.getElementById('visRoot'); if (!root || S.tab !== 'visitas' || S.rota !== rota) return;
    var lojas = q(r[0]) || [], paradas = q(r[1]) || [], vis = q(r[2]) || [];
    var mv = {}; vis.forEach(function (v) { if (!mv[v.conta_id] || !v.roteiro_id) mv[v.conta_id] = v; });
    var lista = lojas.filter(function (c) { return statusLoja(c) !== 'fora'; });
    if (filtro === 'ativas') lista = lista.filter(function (c) { return statusLoja(c) !== 'historico' || mv[c.id]; });
    if (filtro === 'agendadas') lista = lista.filter(function (c) { return mv[c.id]; });
    if (filtro === 'quentes') lista = lista.filter(function (c) { var s = statusLoja(c); return s === 'lead' || s === 'cliente'; });
    S.vcache = { lista: lista, mv: mv, paradas: paradas, rota: info };
    var pode = podeRoteiro();
    var nPlanejar = '';
    var h = '<div class="vis-bar"><div><label>Rota</label><select class="fld" id="vRota">' + rotaOpts(rota) + '</select></div>' +
      '<div><label>Mostrar</label><select class="fld" id="vFiltro">' +
      [['ativas', 'Lojas em prospecção, leads e clientes'], ['todas', 'Todas, inclusive histórico do RD'], ['agendadas', 'Só com visita pedida ou agendada'], ['quentes', 'Clientes, qualificados e leads abertos']]
        .map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === filtro ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></div>' +
      (pode && rota !== 'A planejar' ? '<div><button class="btn primary" data-act="montar" id="btnMontar">Montar roteiro com as marcadas</button></div>' : '') + '</div>' +
      (pode ? '<div class="links" style="margin:-4px 0 12px"><button data-act="rotaNova">＋ Nova rota</button></div>' : '');
    if (rota !== 'A planejar') h += percursoHtml(info, paradas, lojas, pode);
    else h += '<p class="hint" style="color:var(--muted);font-size:13px;margin:-4px 0 12px">Lojas ativas fora das rotas: em SP, nas cidades vizinhas de outros estados ou marcadas na ficha. ' + (pode ? 'Use “Incluir em” para colocar a loja no percurso de uma rota, ou inclua a cidade dela numa rota.' : 'O gestor e o Pedro incluem essas lojas nas rotas.') + '</p>';
    h += lojasHtml(rota, lista, mv, pode);
    h += '<div id="vRots"></div>';
    root.innerHTML = h;
    loadRoteiros();
  } catch (e) { toast(e.message, true); }
}
function percursoHtml(info, paradas, lojas, pode) {
  var porCidade = {};
  lojas.forEach(function (c) { if (statusLoja(c) !== 'fora' && statusLoja(c) !== 'historico') { var k = chaveCidade(c.cidade); porCidade[k] = (porCidade[k] || 0) + 1; } });
  var km = kmDias(info, paradas), maxDia = paradas.reduce(function (m, p) { return Math.max(m, p.dia); }, 0);
  var dias = []; for (var d = 1; d <= maxDia; d++) if (paradas.some(function (p) { return p.dia === d; })) dias.push(d);
  var diaOpts = function (sel) { var o = ''; for (var i = 1; i <= maxDia + 1; i++) o += '<option value="' + i + '"' + (i === sel ? ' selected' : '') + '>Dia ' + i + (i > maxDia ? ' (novo)' : '') + '</option>'; return o; };
  var h = '<div class="rot"><h3>' + esc(info.codigo + ' · ' + info.nome) + '</h3><p class="quando">Saída: ' + esc(info.partida || '—') + ' · chegada: ' + esc(info.chegada || '—') +
    (info.observacao ? '<br>' + esc(info.observacao) : '') + '</p>' +
    (pode ? '<details style="margin:0 0 8px"><summary>✏️ Editar nome, saída, chegada e observação</summary><div class="fgrid">' +
      '<div class="full"><label>Nome</label><input class="fld" id="re-nome" value="' + esc(info.nome) + '"></div>' +
      '<div><label>Saída</label><input class="fld" id="re-ini" value="' + esc(info.partida || '') + '" placeholder="Cidade, UF"></div>' +
      '<div><label>Chegada</label><input class="fld" id="re-fim" value="' + esc(info.chegada || '') + '" placeholder="Cidade, UF"></div>' +
      '<div class="full"><label>Observação</label><textarea class="fld" id="re-obs">' + esc(info.observacao || '') + '</textarea></div></div>' +
      '<button class="btn dark" style="width:100%;margin-top:8px" data-act="rotaEditar">Salvar a rota</button></details>' : '');
  dias.forEach(function (d) {
    var ps = paradas.filter(function (p) { return p.dia === d; }), n = cidadesNoDia(paradas, d);
    h += '<div class="lbl">Dia ' + d + ' <small>' + n + ' de 3 cidades' + (km[d] ? ' · ~' + km[d] + ' km' + (km.semLocal[d] ? ' (parcial: ' + km.semLocal[d] + ' sem localização)' : '') : (km.semLocal[d] ? ' · km sem localização' : '')) + '</small></div>';
    h += ps.map(function (p) {
      var nome = p.conta_id ? '🏬 ' + ((p.contas || {}).nome || 'Loja') + ' · ' + ((p.contas || {}).cidade || '') : (p.cidade + (p.uf && p.uf !== 'SP' ? '/' + p.uf : ''));
      var nl = p.conta_id ? '' : (porCidade[chaveCidade(p.cidade)] || 0);
      return '<div class="vrow"><div><b>' + esc(nome) + '</b>' + (p.sugerida ? ' <span class="tag red">sugestão</span>' : '') +
        (p.conta_id ? ' <span class="tag">loja avulsa</span>' : ' <small>' + (nl ? nl + (nl > 1 ? ' lojas' : ' loja') + ' no CRM' : 'sem lojas no CRM ainda') + '</small>') +
        (p.motivo ? '<br><small>' + esc(p.motivo) + '</small>' : '') + '</div>' +
        (pode ? '<div style="display:flex;gap:6px;align-items:center;flex:none"><select class="fld" style="width:auto;padding:6px 8px;font-size:13px" data-pdia="' + esc(p.id) + '">' + diaOpts(p.dia) + '</select>' +
          (p.sugerida ? '<button class="chip" data-pok="' + esc(p.id) + '" title="Confirmar na rota">✓</button>' : '') +
          '<button class="chip" data-pdel="' + esc(p.id) + '" title="Tirar da rota">×</button></div>' : '') + '</div>';
    }).join('');
  });
  if (!dias.length) h += '<p class="note">Rota sem cidades ainda.</p>';
  if (pode) {
    var livre = 1; while (livre <= maxDia && cidadesNoDia(paradas, livre) >= 3) livre++;
    h += '<details style="margin-top:12px"><summary>+ Incluir cidade ou loja no percurso</summary>' +
      '<div class="lbl">Cidade</div><div class="fgrid"><div class="full"><label>Cidade</label><input class="fld" id="pc-cidade" placeholder="Ex.: Votuporanga"></div>' +
      '<div><label>UF</label><select class="fld" id="pc-uf">' + optList(UFS_ROTA, 'SP') + '</select></div>' +
      '<div><label>Dia</label><select class="fld" id="pc-dia">' + diaOpts(livre) + '</select></div></div>' +
      '<button class="btn dark" style="width:100%;margin-top:8px" data-act="paradaCidade">Incluir cidade</button>' +
      '<div class="lbl">Loja (cliente ou prospect de outra cidade)</div><div class="fgrid"><div class="full"><label>Nome da loja</label><input class="fld" id="pc-busca" placeholder="Digite 3 letras do nome"></div>' +
      '<div><label>Dia</label><select class="fld" id="pc-dia2">' + diaOpts(livre) + '</select></div></div><div id="pc-res"></div>' +
      '<div class="note">Máximo de 3 cidades por dia. Uma loja de cidade que já está no dia não conta como cidade nova.</div></details>';
  }
  return h + '</div>';
}
function marcada(id, v) { var m = S.vmarc || {}; return id in m ? m[id] : !!(v && !v.roteiro_id); }
function lojasHtml(rota, lista, mv, pode) {
  if (!lista.length) return '<div class="empty">' + penaSvg() + '<p>Nenhuma loja com esse filtro.' + (rota !== 'A planejar' ? ' Inclua cidades ou lojas no percurso acima.' : '') + '</p></div>';
  var grupos = [], idx = {};
  lista.forEach(function (c) {
    var g = rota === 'A planejar' ? (c.uf || '—') + ' · ' + (c.cidade || 'sem cidade') : (c.sugerida ? 'Cidades sugeridas (confirmar no percurso)' : 'Dia ' + c.dia + ' · ' + (c.via === 'avulsa' ? 'lojas avulsas' : c.cidade));
    if (!(g in idx)) { idx[g] = grupos.length; grupos.push([g, []]); }
    grupos[idx[g]][1].push(c);
  });
  return '<section class="sec"><h2>' + (rota === 'A planejar' ? 'A planejar' : 'Lojas da rota') + ' <span class="n">' + lista.length + '</span></h2>' + grupos.map(function (g) {
    return '<div class="lbl">' + esc(g[0]) + ' <small>' + g[1].length + '</small></div><div class="list two">' + g[1].map(function (c) {
      var v = mv[c.id], st = c.lead && c.lead.tipo === 'Aberto' ? pill(c.lead.status) : c.prosp ? pill(c.prosp.status, XST) : c.cliente ? pill('Ativo', PST) : '';
      var quem = [c.prosp && c.prosp.sdr ? 'SDR ' + c.prosp.sdr : '', c.lead && c.lead.resp && c.lead.tipo === 'Aberto' ? 'lead com ' + c.lead.resp : '', c.cliente ? 'cliente' : ''].filter(Boolean).join(' · ');
      return '<article class="card' + (v && !v.roteiro_id ? ' c-orange' : '') + '" data-vconta="' + esc(c.id) + '">' +
        (pode && rota !== 'A planejar' ? '<input type="checkbox" class="ck v-marca" value="' + esc(c.id) + '"' + (marcada(c.id, v) ? ' checked' : '') + ' aria-label="Incluir no roteiro">' : '') +
        '<div class="cm"><div class="ct"><b>' + esc(c.nome) + '</b>' + st + '</div>' +
        '<div class="cs">' + esc([c.cidade, c.uf].filter(Boolean).join('/')) + (c.endereco ? ' · ' + esc(c.endereco) : ' · sem endereço') + '</div>' +
        '<div class="cn ' + (v ? 't-orange' : 't-muted') + '">' + (v ? 'Visita ' + esc(v.situacao) + (v.data_visita ? ' · ' + br(v.data_visita) : '') + (v.hora ? ' ' + esc(v.hora) : '') + (v.roteiro_id ? ' · em roteiro' : '') : esc(quem || (c.prosp ? 'prospecção sem SDR' : c.lead ? 'lead ' + c.lead.status : 'histórico do RD'))) +
        (rota === 'A planejar' && c.rota_anterior ? ' · rota antiga ' + esc(c.rota_anterior) : '') + '</div>' +
        (pode && rota === 'A planejar' ? '<div class="qa"><select class="fld" style="width:auto;padding:6px 10px;font-size:13px" data-incluir="' + esc(c.id) + '"><option value="">Incluir em…</option>' +
          rotasVisita().map(function (r) { return '<option value="' + esc(r.codigo) + '">' + esc(r.codigo) + '</option>'; }).join('') + '</select></div>' : '') +
        '</div></article>';
    }).join('') + '</div>';
  }).join('') + '</section>';
}
var ROT_SEL = '*, visitas(id,ordem,situacao,resultado,valor_pedido,data_visita,hora,conta_id,contas(nome,cidade,uf,endereco,whatsapp,telefone))';
function loadRoteiros() {
  sb.from('roteiros').select(ROT_SEL).order('criado_em', { ascending: false }).limit(20).then(function (r) {
    var rots = q(r), el = document.getElementById('vRots'); if (!el) return;
    S.vrots = rots;
    el.innerHTML = rots.length ? '<section class="sec"><h2>Roteiros <span class="n">' + rots.length + '</span></h2>' + rots.map(function (rt) {
      var vs = (rt.visitas || []).slice().sort(function (a, b) { return (a.ordem || 99) - (b.ordem || 99); });
      var feitas = vs.filter(function (v) { return v.situacao === 'realizada'; }).length;
      var ped = vs.reduce(function (s, v) { return s + (Number(v.valor_pedido) || 0); }, 0);
      return '<div class="rot"><h3>' + esc(rt.nome) + ' ' + pill(rt.status) + '</h3><p class="quando">' + (rt.data_inicio ? dataBR(rt.data_inicio) + ' a ' + dataBR(rt.data_fim) + ' · ' : '') +
        vs.length + ' paradas · ' + feitas + ' realizadas · pedidos ' + money(ped || 0) + ' · ~' + (rt.km_previsto || '?') + ' km · previsto ' + moneyC(rt.custo_previsto) + (rt.custo_real ? ' · real ' + moneyC(rt.custo_real) : '') + '</p>' +
        '<div class="links"><button data-prest="' + esc(rt.id) + '">🧾 Prestação de contas</button>' + mapsTrechos(vs.map(function (v) { return v.contas || {}; }), rotaInfo(rt.rota)).map(function (u, k) { return '<a target="_blank" rel="noopener" href="' + esc(u) + '">🗺️ Trecho ' + (k + 1) + '</a>'; }).join('') + '</div>' +
        vs.map(function (v) { var c = v.contas || {}; return '<div class="parada clic" data-vconta="' + esc(v.conta_id) + '"><div class="n">' + (v.ordem || '-') + '</div><div><b>' + esc(c.nome) + '</b><small>' + esc(c.cidade || '') + ' · ' + esc(v.situacao) + (v.data_visita ? ' ' + br(v.data_visita) : '') + ' ' + esc(v.hora || '') + (v.resultado ? ' · ' + esc(v.resultado) : '') + '</small></div>' +
          (waUrl(c.whatsapp || c.telefone, '') ? '<a class="go" target="_blank" rel="noopener" href="' + esc(waUrl(c.whatsapp || c.telefone, '')) + '" aria-label="WhatsApp">' + ICON.chat + '</a>' : '<span></span>') + '</div>'; }).join('') + '</div>';
    }).join('') + '</section>' : '';
  }).catch(function (e) { toast(e.message, true); });
}
// links do Google Maps: da saída da rota até a chegada, em trechos de até 10 pontos
function mapsTrechos(contas, rota) {
  var ini = rota && rota.partida ? rota.partida : BASE.nome, fim = rota && rota.chegada ? rota.chegada : ini;
  var pts = contas.map(function (c) { return [c.endereco, c.cidade, c.uf].filter(Boolean).join(', ') || c.nome; });
  var todos = [ini].concat(pts, [fim]), out = [];
  for (var k = 0; k < todos.length - 1; k += 9) out.push('https://www.google.com/maps/dir/' + todos.slice(k, k + 10).map(encodeURIComponent).join('/'));
  return out;
}
function distKm(a, b) { var R = 6371, rad = Math.PI / 180, dLa = (b.lat - a.lat) * rad, dLo = (b.lng - a.lng) * rad; var h = Math.pow(Math.sin(dLa / 2), 2) + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.pow(Math.sin(dLo / 2), 2); return 2 * R * Math.asin(Math.sqrt(h)); }
function esperar(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
async function geocodificar(c) {
  if (c.lat && c.lng) return c;
  if (!c.endereco) return c; // sem endereço: usa o centro da cidade da rota
  try {
    await esperar(1100); // limite do OpenStreetMap: 1 consulta por segundo
    var js = await (await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=' + encodeURIComponent([c.endereco, c.cidade, c.uf, 'Brasil'].filter(Boolean).join(', ')))).json();
    if (js.length) { c.lat = +js[0].lat; c.lng = +js[0].lon; await sb.from('contas').update({ lat: c.lat, lng: c.lng }).eq('id', c.id); }
  } catch (e) { console.warn('geocodificação falhou', c.nome, e); }
  return c;
}
async function geoCidade(cidade, uf) {
  try {
    var js = await (await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=' + encodeURIComponent([cidade, uf, 'Brasil'].join(', ')))).json();
    return js.length ? { lat: +js[0].lat, lng: +js[0].lon } : null;
  } catch (e) { return null; }
}
// roteiro na ordem do percurso (dia e ordem das cidades); dentro de cada cidade, da loja mais próxima para a seguinte
async function montarRoteiro() {
  if (!podeRoteiro()) { toast('Só o gestor e vendas montam roteiros.', true); return; }
  var bt = document.getElementById('btnMontar'); if (!bt || bt.disabled) return;
  var ids = [].map.call(document.querySelectorAll('.v-marca:checked'), function (i) { return i.value; });
  if (!ids.length) { toast('Marque as lojas do roteiro.', true); return; }
  bt.disabled = true;
  try {
    var vc = S.vcache, info = vc.rota, paradas = vc.paradas || [];
    var coordCidade = {}; paradas.forEach(function (p) { if (p.lat && p.cidade) coordCidade[chaveCidade(p.cidade)] = { lat: p.lat, lng: p.lng }; });
    var contas = vc.lista.filter(function (c) { return ids.indexOf(c.id) >= 0; }).map(function (c) { return Object.assign({}, c); });
    var falta = contas.filter(function (c) { return !c.lat && c.endereco; }).length, i = 0;
    for (var c of contas) { if (!c.lat && c.endereco) { bt.textContent = 'Localizando ' + (++i) + ' de ' + falta + '…'; await geocodificar(c); } }
    for (var c2 of contas) {
      var k2 = chaveCidade(c2.cidade);
      if (!c2.lat && k2 && !coordCidade[k2]) { bt.textContent = 'Localizando ' + c2.cidade + '…'; await esperar(1100); var gc = await geoCidade(c2.cidade, c2.uf); if (gc) coordCidade[k2] = gc; }
    }
    contas.forEach(function (c) { var cc = coordCidade[chaveCidade(c.cidade)]; c._p = c.lat ? { lat: c.lat, lng: c.lng } : cc || null; });
    var base = info.partida_lat ? { lat: info.partida_lat, lng: info.partida_lng } : BASE;
    var fim = info.chegada_lat ? { lat: info.chegada_lat, lng: info.chegada_lng } : base;
    var idaVolta = mesmaBase(info);
    var grupos = {}; contas.forEach(function (c) { var g = (c.dia || 98) * 1000 + (c.pordem || 0); (grupos[g] = grupos[g] || []).push(c); });
    var ordem = [], atual = base, km = 0, diaAnt = null;
    Object.keys(grupos).map(Number).sort(function (a, b) { return a - b; }).forEach(function (g) {
      var dia = Math.floor(g / 1000);
      if (idaVolta && diaAnt !== null && dia !== diaAnt) { km += distKm(atual, base); atual = base; }
      diaAnt = dia;
      var resto = grupos[g].filter(function (c) { return c._p; }), sem = grupos[g].filter(function (c) { return !c._p; });
      while (resto.length) { resto.sort(function (a, b) { return distKm(atual, a._p) - distKm(atual, b._p); }); var prox = resto.shift(); km += distKm(atual, prox._p); ordem.push(prox); atual = prox._p; }
      ordem = ordem.concat(sem);
    });
    km += distKm(atual, fim);
    var kmR = Math.round(km * 1.25), semLocal = ordem.filter(function (c) { return !c._p; }).length;
    S.rotDraft = { fin: ordem, rota: info.codigo, km: kmR };
    S.sheet = { type: 'rot' };
    openWide(head('Roteiro · ' + info.codigo, info.nome) + '<div class="pb">' +
      '<p class="note" style="margin-top:0">' + ordem.length + ' paradas · ~' + kmR + ' km rodoviários estimados (linha reta × 1,25), de ' + esc(info.partida || BASE.nome) + ' a ' + esc(info.chegada || info.partida || BASE.nome) +
      (semLocal ? ' · ' + semLocal + ' sem localização' : '') + '</p>' +
      '<div class="links">' + mapsTrechos(ordem, info).map(function (u, k) { return '<a target="_blank" rel="noopener" href="' + esc(u) + '">🗺️ Trecho ' + (k + 1) + ' no Google Maps</a>'; }).join('') + '</div>' +
      '<div class="pc">' + ordem.map(function (c, k) { return '<div class="parada"><div class="n">' + (k + 1) + '</div><div><b>' + esc(c.nome) + '</b><small>' + (c.dia ? 'Dia ' + c.dia + ' · ' : '') + esc(c.endereco || '') + ' · ' + esc(c.cidade || '') + '</small></div>' +
        (waUrl(c.whatsapp || c.telefone, '') ? '<a class="go" target="_blank" rel="noopener" href="' + esc(waUrl(c.whatsapp || c.telefone, '')) + '">' + ICON.chat + '</a>' : '<span></span>') + '</div>'; }).join('') + '</div>' +
      '<div class="lbl">Dados do roteiro</div><div class="fgrid"><div class="full"><label>Nome</label><input class="fld" id="rt-nome" value="' + esc(info.codigo + ' · ' + br(D.today)) + '"></div>' +
      '<div><label>Saída</label><input class="fld" type="date" id="rt-ini"></div><div><label>Volta</label><input class="fld" type="date" id="rt-fim"></div>' +
      '<div class="full"><label>Custo previsto (R$)</label><input class="fld" id="rt-custo" inputmode="decimal" value="' + Math.round(kmR * 1.12 + 270) + '"></div></div>' +
      '<div class="note">Custo previsto = km × R$ 1,12 + hotel e diária (R$ 270). Teto por 1º pedido: ' + moneyC(PRIMEIRO_PEDIDO_BASE / MER_MIN_B2B) + ' (1º pedido ÷ ' + String(MER_MIN_B2B).replace('.', ',') + ').</div>' +
      '</div><div class="pf"><button class="btn" data-act="close">Cancelar</button><button class="btn primary" data-act="rotSave" id="btnSave">Salvar roteiro e marcar visitas</button></div>');
  } finally { bt.disabled = false; bt.textContent = 'Montar roteiro com as marcadas'; }
}
async function salvarRoteiro() {
  var dr = S.rotDraft; if (!dr) return;
  var btn = document.getElementById('btnSave'); if (btn.disabled) return; busy(btn, true);
  try {
    if (!dr.id) dr.id = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (ch) { var r = crypto.getRandomValues(new Uint8Array(1))[0] & 15; return (ch === 'x' ? r : (r & 3 | 8)).toString(16); });
    q(await sb.rpc('crm_salvar_roteiro', { p_id: dr.id, p_rota: dr.rota, p_nome: document.getElementById('rt-nome').value || dr.rota,
      p_ini: document.getElementById('rt-ini').value || null, p_fim: document.getElementById('rt-fim').value || null,
      p_km: dr.km, p_custo: numBR(document.getElementById('rt-custo').value), p_contas: dr.fin.map(function (c) { return c.id; }) }));
    S.vmarc = {}; closeSheet(); toast('Roteiro salvo ✓'); if (S.tab === 'visitas') loadVisitas();
  } catch (e) { busy(btn, false, 'Salvar roteiro e marcar visitas'); toast(e.message, true); }
}
// editar e criar rotas (gestor e vendas)
async function ponto(txt) {
  var t = String(txt || '').trim(); if (!t) return { nome: null, lat: null, lng: null };
  var js = null;
  try { var res = await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=' + encodeURIComponent(t + ', Brasil')); js = res.ok ? await res.json() : null; } catch (e) { js = null; }
  return { nome: t, lat: js && js.length ? +js[0].lat : null, lng: js && js.length ? +js[0].lon : null };
}
async function salvarRota() {
  var info = S.vcache.rota, g = function (id) { return document.getElementById(id).value.trim(); }, bt = document.querySelector('[data-act="rotaEditar"]');
  var upd = { nome: g('re-nome') || info.nome, observacao: g('re-obs') || null };
  bt.disabled = true;
  try {
    if (g('re-ini') !== (info.partida || '')) { var a = await ponto(g('re-ini')); if (a.nome && a.lat == null) throw new Error('Não achei a saída "' + a.nome + '" no mapa. Escreva como "Cidade, UF".'); upd.partida = a.nome; upd.partida_lat = a.lat; upd.partida_lng = a.lng; await esperar(1100); }
    if (g('re-fim') !== (info.chegada || '')) { var b = await ponto(g('re-fim')); if (b.nome && b.lat == null) throw new Error('Não achei a chegada "' + b.nome + '" no mapa. Escreva como "Cidade, UF".'); upd.chegada = b.nome; upd.chegada_lat = b.lat; upd.chegada_lng = b.lng; }
    var r = q(await sb.from('rotas').update(upd).eq('codigo', info.codigo).select('codigo'));
    if (!r.length) throw new Error('Sem permissão para alterar a rota.');
    await carregarRotas(); toast('Rota ' + info.codigo + ' salva ✓'); loadVisitas();
  } catch (e) { bt.disabled = false; toast(e.message, true); }
}
function abrirNovaRota() {
  S.sheet = { type: 'novarota' };
  openSheet(head('Nova rota', 'Depois inclua as cidades por dia (no máximo 3 por dia)') + '<div class="pb"><div class="fgrid">' +
    '<div><label>Código *</label><input class="fld" id="nr-cod" placeholder="Ex.: R2 ou R1.6"></div>' +
    '<div><label>Nome *</label><input class="fld" id="nr-nome" placeholder="Ex.: Triângulo · Uberaba e Uberlândia"></div>' +
    '<div><label>Saída</label><input class="fld" id="nr-ini" value="Jaguariúna, SP"></div>' +
    '<div><label>Chegada</label><input class="fld" id="nr-fim" value="Jaguariúna, SP"></div>' +
    '<div class="full"><label>Observação</label><textarea class="fld" id="nr-obs"></textarea></div></div>' +
    '<div class="note">Quando a saída é igual à chegada, o CRM conta cada dia saindo e voltando para a base. Se forem diferentes, os dias seguem em sequência.</div></div>' +
    '<div class="pf"><button class="btn" data-act="close">Cancelar</button><button class="btn primary" data-act="rotaCriar" id="btnSave">Criar rota</button></div>');
}
async function criarRota() {
  var g = function (id) { return document.getElementById(id).value.trim(); }, btn = document.getElementById('btnSave');
  var cod = g('nr-cod').toUpperCase(), nome = g('nr-nome');
  if (!/^R\d+(\.\d+)?$/.test(cod)) { toast('Use um código como R2 ou R1.6.', true); return; }
  if (!nome) { toast('Dê um nome para a rota.', true); return; }
  if (rotaInfo(cod)) { toast('Já existe a rota ' + cod + '.', true); return; }
  busy(btn, true);
  try {
    var a = await ponto(g('nr-ini')); await esperar(1100); var b = await ponto(g('nr-fim'));
    if ((a.nome && a.lat == null) || (b.nome && b.lat == null)) throw new Error('Não achei a saída ou a chegada no mapa. Escreva como "Cidade, UF".');
    var ordem = ROTAS_DB.filter(function (r) { return r.codigo !== 'A planejar'; }).reduce(function (m, r) { return Math.max(m, r.ordem || 0); }, 0) + 10;
    q(await sb.from('rotas').insert({ codigo: cod, nome: nome, ordem: ordem, partida: a.nome, partida_lat: a.lat, partida_lng: a.lng,
      chegada: b.nome, chegada_lat: b.lat, chegada_lng: b.lng, observacao: g('nr-obs') || null }));
    await carregarRotas(); S.rota = cod; closeSheet(); toast('Rota ' + cod + ' criada ✓ Agora inclua as cidades.'); if (S.tab === 'visitas') loadVisitas();
  } catch (e) { busy(btn, false, 'Criar rota'); toast(e.message, true); }
}
// incluir cidade no percurso (com coordenada para estimar os km do dia)
async function incluirCidade() {
  var cid = document.getElementById('pc-cidade').value.trim(), uf = document.getElementById('pc-uf').value, dia = Number(document.getElementById('pc-dia').value);
  if (!cid) { toast('Digite a cidade.', true); return; }
  var vc = S.vcache, bt = document.querySelector('[data-act="paradaCidade"]'); bt.disabled = true;
  try {
    var g = await geoCidade(cid, uf), user = (await sb.auth.getUser()).data.user;
    var ordem = (vc.paradas || []).filter(function (p) { return p.dia === dia; }).reduce(function (m, p) { return Math.max(m, p.ordem); }, 0) + 1;
    q(await sb.from('rota_paradas').insert({ rota: vc.rota.codigo, dia: dia, ordem: ordem, cidade: cid, uf: uf, lat: g ? g.lat : null, lng: g ? g.lng : null, criado_por: user.email }));
    toast(cid + ' incluída no dia ' + dia + ' da ' + vc.rota.codigo + ' ✓' + (g ? '' : ' (sem localização no mapa)'));
    loadVisitas();
  } catch (e) { bt.disabled = false; toast(/duplicate|unique/i.test(e.message) ? 'Essa cidade já está na rota.' : e.message, true); }
}
var BUSCA_T = null;
function buscarLoja(t) {
  clearTimeout(BUSCA_T);
  var el = document.getElementById('pc-res'); if (!el) return;
  if (t.trim().length < 3) { el.innerHTML = ''; return; }
  BUSCA_T = setTimeout(function () {
    sb.from('contas').select('id,nome,cidade,uf').ilike('nome', '%' + t.trim().replace(/[%_,()]/g, ' ') + '%').order('nome').limit(8).then(function (r) {
      var rows = q(r) || [];
      el.innerHTML = rows.length ? rows.map(function (c) {
        return '<div class="vrow"><div><b>' + esc(c.nome) + '</b><br><small>' + esc([c.cidade, c.uf].filter(Boolean).join('/')) + '</small></div><button class="chip" data-pconta="' + esc(c.id) + '">Incluir</button></div>';
      }).join('') : '<p class="note">Nenhuma loja com esse nome.</p>';
    }).catch(function (e) { toast(e.message, true); });
  }, 300);
}
async function incluirConta(conta, rota, dia, el) {
  if (el) el.disabled = true;
  try {
    var r = q(await sb.rpc('crm_rota_conta', { p_conta: conta, p_rota: rota, p_dia: dia || null }));
    if (rota && rota !== 'A planejar') {
      var par = q(await sb.from('rota_paradas').select('id,lat,contas(cidade,uf)').eq('rota', rota).eq('conta_id', conta)) || [];
      if (par.length && !par[0].lat && par[0].contas && par[0].contas.cidade) {
        var gc = await geoCidade(par[0].contas.cidade, par[0].contas.uf);
        if (gc) await sb.from('rota_paradas').update({ lat: gc.lat, lng: gc.lng }).eq('id', par[0].id);
      }
    }
    atualizarRotaLocal(conta, r.rota);
    toast(r.msg || 'Feito ✓');
    if (S.tab === 'visitas') loadVisitas();
    return r;
  } catch (e) { if (el) el.disabled = false; toast(e.message, true); }
}
async function alterarParada(id, upd) {
  try {
    var r = q(await sb.from('rota_paradas').update(upd).eq('id', id).select('id'));
    if (!r.length) throw new Error('Sem permissão para alterar a rota.');
    loadVisitas();
  } catch (e) { toast(e.message, true); loadVisitas(); }
}
async function tirarParada(id) {
  var p = (S.vcache.paradas || []).filter(function (x) { return x.id === id; })[0]; if (!p) return;
  var nome = p.conta_id ? (p.contas || {}).nome : p.cidade;
  if (!confirm('Tirar ' + nome + ' da ' + p.rota + '? As lojas dessa cidade saem da rota (as ativas ficam “A planejar” se não estiverem em outra).')) return;
  try { q(await sb.from('rota_paradas').delete().eq('id', id)); toast(nome + ' saiu da ' + p.rota + ' ✓'); loadVisitas(); } catch (e) { toast(e.message, true); }
}

function marcadorViagem(r) { return 'VIAGEM-' + String(r.data_inicio || D.today).replace(/-/g, '') + '-' + (r.rota || 'SEM-ROTA'); }
async function prestacaoContas(id) {
  var r = q(await sb.from('roteiros').select(ROT_SEL).eq('id', id).single());
  var desp = q(await sb.from('despesas_viagem').select('*').eq('roteiro_id', id).order('data'));
  var pode = podeRoteiro();
  var vs = (r.visitas || []).slice().sort(function (a, b) { return (a.ordem || 99) - (b.ordem || 99); });
  var total = desp.reduce(function (s, d) { return s + Number(d.valor); }, 0);
  var reemb = desp.filter(function (d) { return d.forma_pagamento === 'Pago pelo Pedro (reembolso)'; }).reduce(function (s, d) { return s + Number(d.valor); }, 0);
  var pedidos = vs.filter(function (v) { return v.resultado === 'pedido'; });
  var km = r.km_saida != null && r.km_volta != null ? r.km_volta - r.km_saida : null;
  var teto = PRIMEIRO_PEDIDO_BASE / MER_MIN_B2B, cpp = pedidos.length ? total / pedidos.length : null;
  var marcador = r.marcador_tiny || marcadorViagem(r), dis = pode ? '' : ' disabled';
  S.sheet = { type: 'prest', id: id }; S.prest = { r: r, desp: desp, vs: vs, total: total, reemb: reemb, km: km, marcador: marcador };
  var kpi = function (v, t, i) { return '<div class="kpi"><b>' + v + '</b><span>' + t + '</span>' + (i ? '<i>' + i + '</i>' : '') + '</div>'; };
  openWide(head('Prestação de contas', r.nome) + '<div class="pb">' +
    '<p class="note" style="margin-top:0">Marcador no Tiny: <b>' + esc(marcador) + '</b> · ' + vs.length + ' paradas · ' + vs.filter(function (v) { return v.situacao === 'realizada'; }).length + ' visitas realizadas · ' + pedidos.length + ' pedido(s) ' + moneyC(pedidos.reduce(function (s, v) { return s + (Number(v.valor_pedido) || 0); }, 0)) + '</p>' +
    '<div class="kpis">' + kpi(moneyC(total), 'Total de despesas') + kpi(km != null ? km.toLocaleString('pt-BR') + ' km' : '—', 'Km rodados') + kpi(moneyC(reemb), 'A reembolsar ao Pedro') +
    kpi(cpp != null ? moneyC(cpp) : '—', 'Custo por pedido', 'teto ' + moneyC(teto)) + '</div>' +
    '<div class="lbl">Viagem</div><div class="fgrid">' +
    '<div><label>Saída</label><input class="fld" type="date" id="pv-ini" value="' + esc(r.data_inicio || '') + '"' + dis + '></div>' +
    '<div><label>Volta</label><input class="fld" type="date" id="pv-fim" value="' + esc(r.data_fim || '') + '"' + dis + '></div>' +
    '<div><label>Odômetro na saída (km)</label><input class="fld" id="pv-kms" inputmode="numeric" value="' + esc(r.km_saida == null ? '' : r.km_saida) + '"' + dis + '></div>' +
    '<div><label>Odômetro na volta (km)</label><input class="fld" id="pv-kmv" inputmode="numeric" value="' + esc(r.km_volta == null ? '' : r.km_volta) + '"' + dis + '></div>' +
    '<div class="full"><label>Situação</label><select class="fld" id="pv-st"' + dis + '>' + optList(['planejado', 'em andamento', 'concluído', 'cancelado'], r.status) + '</select></div></div>' +
    (pode ? '<button class="btn dark" style="width:100%;margin-top:8px" data-act="viagemSave">Salvar dados da viagem</button>' : '') +
    '<div class="lbl">Despesas</div>' + (desp.length ? '<div class="tw"><table class="pt left"><thead><tr><th>Data</th><th>Categoria</th><th>Valor</th><th>Pagamento</th><th>Comprovante</th>' + (pode ? '<th></th>' : '') + '</tr></thead><tbody>' +
      desp.map(function (d) { return '<tr><td>' + dataBR(d.data) + '</td><td>' + esc(d.categoria) + '<br><small class="t-muted">' + esc(d.conta_tiny || '') + (d.fornecedor ? ' · ' + esc(d.fornecedor) : '') + (d.nota_cnpj_indiao ? ' · nota no CNPJ da Indião' : '') + '</small></td><td>' + moneyC(d.valor) + '</td><td>' + esc(d.forma_pagamento) + '</td>' +
        '<td>' + (d.comprovante_path ? '<a href="#" data-comp="' + esc(d.comprovante_path) + '">ver</a>' : '<span class="tag red">falta</span>') + '</td>' + (pode ? '<td><button class="chip" data-apagadesp="' + esc(d.id) + '">apagar</button></td>' : '') + '</tr>'; }).join('') +
      '</tbody></table></div>' : '<p class="note">Nenhuma despesa lançada.</p>') +
    (pode ? '<div class="lbl">+ Lançar despesa</div><div class="qbox"><div class="fgrid">' +
      '<div><label>Data</label><input class="fld" type="date" id="dp-data" value="' + D.today + '"></div>' +
      '<div><label>Categoria</label><select class="fld" id="dp-cat">' + optList(CATEGORIAS_DESP, 'Combustível') + '</select></div>' +
      '<div><label>Valor (R$)</label><input class="fld" id="dp-valor" inputmode="decimal" placeholder="0,00"></div>' +
      '<div><label>Pagamento</label><select class="fld" id="dp-forma">' + optList(FORMAS_PAG, 'Cartão da empresa') + '</select></div>' +
      '<div><label>Fornecedor</label><input class="fld" id="dp-forn"></div><div><label>CNPJ do fornecedor</label><input class="fld" id="dp-cnpj" inputmode="numeric"></div>' +
      '<div class="full"><label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="dp-nota" style="width:20px;height:20px"> Nota/cupom no CNPJ da Indião (61.168.071/0001-92)</label></div>' +
      '<div class="full"><label>Foto do comprovante</label><input class="fld" type="file" id="dp-foto" accept="image/*,application/pdf" capture="environment"></div>' +
      '<div class="full"><label>Observações</label><input class="fld" id="dp-obs"></div></div>' +
      '<button class="btn primary" style="width:100%;margin-top:8px" data-act="despSave" id="btnDesp">Lançar despesa</button></div>' : '') +
    '<div class="links" style="margin-top:14px"><button data-act="prestCSV">⬇️ Exportar prestação de contas (CSV)</button></div></div>');
}
function numBR(v) {
  var t = String(v == null ? '' : v).replace(/R\$|\s/g, '');
  if (!t) return null;
  if (/,/.test(t)) t = t.replace(/\./g, '').replace(',', '.');
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
  var n = Number(t); return isNaN(n) ? null : n;
}
function intBR(v) { var n = numBR(v); return n == null ? null : Math.round(n); }
function numTxt(v) { return v == null || v === '' ? '' : Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 2 }); }
async function salvarViagem() {
  var p = S.prest, g = function (id) { return document.getElementById(id).value; };
  var upd = { data_inicio: g('pv-ini') || null, data_fim: g('pv-fim') || null, km_saida: intBR(g('pv-kms')), km_volta: intBR(g('pv-kmv')), status: g('pv-st') };
  if (upd.km_saida != null && upd.km_volta != null && upd.km_volta < upd.km_saida) { toast('O odômetro da volta está menor que o da saída.', true); return; }
  upd.marcador_tiny = marcadorViagem(Object.assign({}, p.r, upd));
  try { var r = q(await sb.from('roteiros').update(upd).eq('id', p.r.id).select('id')); if (!r.length) throw new Error('Sem permissão para alterar este roteiro.'); toast('Viagem salva ✓'); prestacaoContas(p.r.id); }
  catch (e) { toast(e.message, true); }
}
async function salvarDespesa() {
  var p = S.prest, g = function (id) { return document.getElementById(id); }, btn = g('btnDesp');
  var valor = numBR(g('dp-valor').value);
  if (!valor || valor <= 0) { toast('Informe o valor da despesa.', true); return; }
  if (btn.disabled) return; busy(btn, true);
  try {
    var caminho = null, arq = g('dp-foto').files[0];
    if (arq) {
      var ext = (arq.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
      caminho = p.r.id + '/' + Date.now() + '-' + g('dp-cat').value.slice(0, 4).toLowerCase() + '.' + ext;
      var up = await sb.storage.from('comprovantes').upload(caminho, arq, { contentType: arq.type || undefined });
      if (up.error) throw new Error('Falha ao enviar a foto: ' + up.error.message);
    }
    var user = (await sb.auth.getUser()).data.user;
    q(await sb.from('despesas_viagem').insert({ roteiro_id: p.r.id, data: g('dp-data').value, categoria: g('dp-cat').value, valor: valor, forma_pagamento: g('dp-forma').value,
      fornecedor: g('dp-forn').value || null, cnpj_fornecedor: g('dp-cnpj').value || null, nota_cnpj_indiao: g('dp-nota').checked, comprovante_path: caminho, observacoes: g('dp-obs').value || null, criado_por: user.email }));
    toast('Despesa lançada ✓'); prestacaoContas(p.r.id); // o total da viagem (custo_real) é recalculado pelo banco
  } catch (e) { busy(btn, false, 'Lançar despesa'); toast(e.message, true); }
}
function prestCSV() {
  var p = S.prest, r = p.r;
  var cab = [['Marcador Tiny', p.marcador], ['Roteiro', r.nome], ['Rota', r.rota || ''], ['Saída', dataBR(r.data_inicio)], ['Volta', dataBR(r.data_fim)],
    ['Odômetro saída', r.km_saida == null ? '' : r.km_saida], ['Odômetro volta', r.km_volta == null ? '' : r.km_volta], ['Km rodados', p.km == null ? '' : p.km],
    ['Lojistas visitados', p.vs.filter(function (v) { return v.situacao === 'realizada'; }).map(function (v) { return (v.contas || {}).nome; }).join(' | ')],
    ['Total de despesas', p.total.toFixed(2).replace('.', ',')], ['A reembolsar ao Pedro', p.reemb.toFixed(2).replace('.', ',')]]
    .map(function (x) { return celulaCSV(x[0]) + ';' + celulaCSV(x[1]); }).join('\n');
  baixarCSV(p.marcador + '.csv', p.desp.map(function (d) {
    return { data: dataBR(d.data), categoria: d.categoria, conta_tiny: d.conta_tiny, valor: String(d.valor).replace('.', ','), fornecedor: d.fornecedor || '', cnpj_fornecedor: d.cnpj_fornecedor || '',
      forma_pagamento: d.forma_pagamento, nota_cnpj_indiao: d.nota_cnpj_indiao ? 'sim' : 'não', comprovante: d.comprovante_path ? 'sim' : 'FALTA', observacoes: d.observacoes || '' };
  }), cab);
}

/* ---------- acessos ao CRM (gestor) ---------- */
async function openAcessos() {
  var perfis = q(await sb.from('perfis').select('*').order('nome'));
  S.sheet = { type: 'acessos' };
  openWide(head('Acessos ao CRM', 'Quem entra com qual e-mail') + '<div class="pb">' +
    '<div class="tw"><table class="pt left"><thead><tr><th>Nome</th><th>E-mail</th><th>Papel</th><th>Ativo</th></tr></thead><tbody>' +
    perfis.map(function (p) { return '<tr><td>' + esc(p.nome) + '</td><td>' + esc(p.email) + '</td><td><select class="fld" data-papel="' + esc(p.email) + '">' + optList(['gestor', 'vendas', 'sdr'], p.papel) + '</select></td>' +
      '<td><input type="checkbox" data-ativo="' + esc(p.email) + '"' + (p.ativo ? ' checked' : '') + ' style="width:22px;height:22px"></td></tr>'; }).join('') + '</tbody></table></div>' +
    '<p class="note">gestor vê e edita tudo · vendas vê os leads e clientes dele e monta roteiros · sdr vê a prospecção e os leads dele.</p>' +
    '<div class="lbl">Liberar acesso</div><div class="fgrid">' +
    '<div><label>Nome no CRM (ex.: Lucas)</label><input class="fld" id="us-nome"></div><div><label>E-mail</label><input class="fld" id="us-email" type="email"></div>' +
    '<div><label>Papel</label><select class="fld" id="us-papel">' + optList(['sdr', 'vendas', 'gestor'], 'sdr') + '</select></div><div><label>Nome no Olist Tiny</label><input class="fld" id="us-tiny"></div></div>' +
    '<button class="btn primary" style="width:100%;margin-top:8px" data-act="userSave">Liberar acesso</button>' +
    '<div class="note">O nome tem que ser igual ao usado nas lojas e leads (Pedro, Lucas, Ian, Yuri). A pessoa entra em crm.indiaostore.com.br com esse e-mail.</div></div>');
}
async function salvarUsuario() {
  var g = function (id) { return document.getElementById(id).value.trim(); };
  var d = { nome: g('us-nome'), email: g('us-email').toLowerCase(), papel: g('us-papel'), nome_tiny: g('us-tiny') || null };
  if (!d.nome || !d.email) { toast('Informe o nome e o e-mail.', true); return; }
  var igual = (D.sellers || []).filter(function (s) { return mesmoNome(s, d.nome); })[0];
  if (igual) d.nome = igual;
  else if (!confirm('O nome "' + d.nome + '" ainda não aparece em nenhuma loja ou lead do CRM. Confirma essa grafia?')) return;
  try { q(await sb.from('perfis').insert(d)); toast('Acesso liberado para ' + d.nome + ' ✓'); openAcessos(); } catch (e) { toast(e.message, true); }
}
async function exportar(qual) {
  try {
    if (qual === 'expL') baixarCSV('leads.csv', q(await sb.from('v_leads').select('*')));
    if (qual === 'expX') baixarCSV('prospeccao.csv', q(await sb.from('v_prospeccoes').select('*')));
    if (qual === 'expPV') baixarCSV('pos-venda.csv', q(await sb.from('pos_venda').select('*')));
  } catch (e) { toast(e.message, true); }
}

/* ---------- eventos da v3 ---------- */
document.addEventListener('submit', function (e) { if (e.target && (e.target.id === 'fNew' || e.target.id === 'fNewX')) e.preventDefault(); });
document.addEventListener('click', function (e) {
  var t = e.target;
  if (t.matches && t.matches('.ck')) return; // marcar loja no roteiro não abre a ficha
  var vc = t.closest && t.closest('[data-vconta]');
  if (vc && !t.closest('a, select, option, input, .chip')) { openConta(vc.dataset.vconta); return; }
  var el = t.closest && t.closest('[data-act],[data-abre],[data-visedit],[data-prest],[data-apagadesp],[data-comp],[data-pok],[data-pdel],[data-pconta]');
  if (!el) return;
  var d = el.dataset;
  if (d.abre) { var p = d.abre.split(':'); closeSheet(); if (p[0] === 'prosp') openX(p[1]); else if (p[0] === 'cliente') openPV(p[1]); else openLead(p[1]); return; }
  if (d.pok) { alterarParada(d.pok, { sugerida: false }); return; }
  if (d.pdel) { tirarParada(d.pdel); return; }
  if (d.pconta) { incluirConta(d.pconta, S.vcache.rota.codigo, Number((document.getElementById('pc-dia2') || {}).value) || null, el); return; }
  if (d.visedit) { F.visEdit = F.visEdit === d.visedit ? null : d.visedit; visRefresh(); return; }
  if (d.prest) { prestacaoContas(d.prest).catch(function (er) { toast(er.message, true); }); return; }
  if (d.comp) { e.preventDefault(); sb.storage.from('comprovantes').createSignedUrl(d.comp, 600).then(function (r) { if (r.error) toast(r.error.message, true); else window.open(r.data.signedUrl, '_blank'); }); return; }
  if (d.apagadesp) {
    var dp = (S.prest.desp || []).filter(function (x) { return x.id === d.apagadesp; })[0]; if (!dp) return;
    if (!confirm('Apagar ' + dp.categoria + ' de ' + dataBR(dp.data) + ' (' + moneyC(dp.valor) + ')? A foto do comprovante também será apagada.')) return;
    el.disabled = true;
    sb.from('despesas_viagem').delete().eq('id', dp.id).then(function (r) {
      if (r.error) { toast(r.error.message, true); return; }
      if (dp.comprovante_path) sb.storage.from('comprovantes').remove([dp.comprovante_path]);
      toast('Despesa apagada.'); prestacaoContas(S.prest.r.id);
    });
    return;
  }
  switch (d.act) {
    case 'newx': openNewX(); break;
    case 'saveNewX': saveNewX(false); break;
    case 'forceNewX': saveNewX(true); break;
    case 'montar': montarRoteiro(); break;
    case 'paradaCidade': incluirCidade(); break;
    case 'rotaEditar': salvarRota(); break;
    case 'rotaNova': abrirNovaRota(); break;
    case 'rotaCriar': criarRota(); break;
    case 'rotSave': salvarRoteiro(); break;
    case 'viagemSave': salvarViagem(); break;
    case 'despSave': salvarDespesa(); break;
    case 'prestCSV': prestCSV(); break;
    case 'acessos': openAcessos().catch(function (er) { toast(er.message, true); }); break;
    case 'userSave': salvarUsuario(); break;
    case 'expL': case 'expX': case 'expPV': exportar(d.act); break;
    case 'visNew': (async function () {
      var g = function (id) { return document.getElementById(id).value; };
      el.disabled = true;
      try {
        var user = (await sb.auth.getUser()).data.user;
        q(await sb.from('visitas').insert({ conta_id: F.conta, situacao: g('vn-sit'), data_visita: g('vn-data') || null, hora: g('vn-hora') || null, observacoes: g('vn-obs') || null, agendado_por: D.me, criado_por: user.email }));
        ['vn-data', 'vn-hora', 'vn-obs'].forEach(function (id) { var x = document.getElementById(id); if (x) x.value = ''; });
        toast('Pedido de visita registrado ✓'); F.vis = null; loadVis();
      } catch (er) { el.disabled = false; toast(er.message, true); }
    })(); break;
    case 'visEditSave': (async function () {
      var g = function (id) { return document.getElementById(id).value; }, v = ((F.vis && F.vis.rows) || []).filter(function (x) { return x.id === d.id; })[0];
      var upd = { situacao: g('ve-sit'), resultado: g('ve-res') || null, valor_pedido: numBR(g('ve-valor')), observacoes: g('ve-obs') || null, data_visita: g('ve-data') || null, hora: g('ve-hora') || null };
      if (upd.situacao === 'realizada' && v && v.situacao !== 'realizada') upd.checkin_em = new Date().toISOString();
      if (upd.situacao === 'reagendar' && upd.data_visita && v && upd.data_visita !== v.data_visita) upd.situacao = 'agendada'; // nova data volta a ser visita agendada
      el.disabled = true;
      try { var r = q(await sb.from('visitas').update(upd).eq('id', d.id).select('id')); if (!r.length) throw new Error('Sem permissão para alterar esta visita.'); toast('Visita atualizada ✓'); F.visEdit = null; F.vis = null; loadVis(); }
      catch (er) { el.disabled = false; toast(er.message, true); }
    })(); break;
  }
});
document.addEventListener('change', function (e) {
  var t = e.target;
  if (t.classList && t.classList.contains('v-marca')) { S.vmarc = S.vmarc || {}; S.vmarc[t.value] = t.checked; }
  if (t.id === 'vRota') { S.rota = t.value; S.vmarc = {}; loadVisitas(); }
  if (t.id === 'vFiltro') { S.vfiltro = t.value; loadVisitas(); }
  if (t.id === 'vis-rota') {
    var conta = F.conta;
    sb.rpc('crm_rota_conta', { p_conta: conta, p_rota: t.value || null }).then(function (r) {
      if (r.error) { toast(traduzErro(r.error.message), true); if (F && F.conta === conta) loadVis(true); return; }
      atualizarRotaLocal(conta, r.data.rota);
      toast(r.data.msg || (t.value === 'A planejar' ? 'Loja marcada “A planejar” ✓' : t.value ? 'Loja incluída na ' + t.value + ' ✓' : 'Loja tirada das rotas ✓'));
      if (F && F.conta === conta) loadVis(true);
    });
  }
  if (t.dataset && t.dataset.pdia) alterarParada(t.dataset.pdia, { dia: Number(t.value) });
  if (t.dataset && t.dataset.incluir && t.value) incluirConta(t.dataset.incluir, t.value, null, t);
  if (t.dataset && t.dataset.papel) sb.from('perfis').update({ papel: t.value }).eq('email', t.dataset.papel).then(function (r) { toast(r.error ? r.error.message : 'Papel atualizado ✓', !!r.error); });
  if (t.dataset && t.dataset.ativo) sb.from('perfis').update({ ativo: t.checked }).eq('email', t.dataset.ativo).then(function (r) { toast(r.error ? r.error.message : (t.checked ? 'Acesso ativado ✓' : 'Acesso desativado ✓'), !!r.error); });
});
document.addEventListener('toggle', function (e) { if (e.target.id === 'd-vis' && e.target.open) loadVis(); }, true);
document.addEventListener('input', function (e) { if (e.target.id === 'pc-busca') buscarLoja(e.target.value); });
