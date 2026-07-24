
/* =========================================================
   CONFIGURAÇÃO DE API (Etapa 3 da migração — backend real)
   ========================================================= */
// Ajuste este valor para a URL do backend em produção (ex.: no Render).
// Pode ser sobrescrito definindo window.CROQUI_API_BASE antes deste arquivo carregar.
const API_BASE = window.CROQUI_API_BASE || 'https://croqui-people.onrender.com';

/* =========================================================
   ESTRUTURA ORGANIZACIONAL — agora vem do backend (não mais
   hardcoded aqui), para que o mesmo frontend sirva qualquer
   cliente. Populada em carregarDiretorioPublico()/pós-login.
   ========================================================= */
let CARGO_DATA = {};              // { roleKey: {titulo, area, departamento, organizacionais, comportamentais, tecnicas} }
let DIRETORIO_PUBLICO = [];       // [{nome, cargoTitulo, roleKey, ehGestor}]
let MINHA_EQUIPE = [];            // preenchido após login de gestor: [{nome, cargoTitulo, roleKey, relacao}]
let TODOS_COLABORADORES = [];     // [nome, ...] — derivado de DIRETORIO_PUBLICO
let CARGO_POR_COLABORADOR = {};   // nome -> cargoTitulo — derivado de DIRETORIO_PUBLICO
let ROLEKEY_POR_COLABORADOR = {}; // nome -> roleKey — derivado de DIRETORIO_PUBLICO

const GRAU_LEGENDA = [
  {v:0,l:'Não sabe',p:'0%'}, {v:1,l:'Sabe o que é',p:'20%'}, {v:2,l:'Aplica c/ ajuda',p:'40%'},
  {v:3,l:'Domina sozinho',p:'60%'}, {v:4,l:'Ensina e multiplica',p:'80%'}, {v:5,l:'Todas as vezes',p:'100%'}
];
const NIVEL_REQUERIDO = 4;

const POTENCIAL_PERGUNTAS = [
  "Aprende novas competências e processos com rapidez, aplicando o conhecimento sem necessidade de repetição constante.",
  "Demonstra desejo genuíno de crescer, buscando ativamente novos desafios, responsabilidades ou conhecimentos.",
  "Tem facilidade para lidar com mudanças, ambiguidade e problemas mais complexos que os do seu dia a dia atual.",
  "Já demonstra, mesmo informalmente, comportamentos de um nível hierárquico ou de responsabilidade acima do atual.",
  "É respeitado(a) e influencia positivamente colegas, mesmo sem autoridade formal sobre eles.",
  "Está disponível e motivado(a) para assumir maiores responsabilidades no curto/médio prazo.",
];

/* =========================================================
   CÁLCULOS DE DESEMPENHO
   ========================================================= */
function desempenhoPergunta(nota){ return Math.max(0, Math.min(nota / NIVEL_REQUERIDO, 1)); }
function media(arr){ return arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0; }

function calcularOrganizacionais(role, respostas){
  const comps = role.organizacionais.map((c, ci) => {
    const notas = c.perguntas.map((_,qi)=> respostas.org[ci][qi]);
    const des = notas.map(desempenhoPergunta);
    return { nome:c.nome, media: media(des) };
  });
  return { comps, pilar: media(comps.map(c=>c.media)) };
}
function calcularComportamentais(role, respostas){
  const grupos = {};
  const allComps = [];
  ['grupo1','grupo2','grupo3','grupo4'].forEach(gk=>{
    const list = role.comportamentais[gk];
    const comps = list.map((c, ci) => {
      const notas = c.perguntas.map((_,qi)=> respostas.comp[gk][ci][qi]);
      const des = notas.map(desempenhoPergunta);
      return { nome:c.nome, media: media(des) };
    });
    allComps.push(...comps);
    grupos[gk] = media(comps.map(c=>c.media));
  });
  return { comps: allComps, grupos, pilar: media(Object.values(grupos)) };
}
function calcularTecnicas(role, respostas){
  const notas = role.tecnicas.perguntas.map((_,qi)=> respostas.tec[qi]);
  const des = notas.map(desempenhoPergunta);
  return { comps:[{nome:role.tecnicas.nome, media:media(des)}], pilar: media(des) };
}
function classificarDesempenho(nota10){
  if(nota10 >= 9) return 'Acima do esperado';
  if(nota10 >= 6) return 'Dentro do esperado';
  return 'Abaixo do esperado';
}
function classificarPotencial(mediaPot){
  if(mediaPot >= 3.68) return 'Alto';
  if(mediaPot >= 2.34) return 'Médio';
  return 'Baixo';
}
const QUADRANTES = {
  'Alto|Acima do esperado': {nome:'Estrela', cor:'#16A34A'},
  'Alto|Dentro do esperado': {nome:'Alto Potencial', cor:'#22C55E'},
  'Alto|Abaixo do esperado': {nome:'Enigma / Dilema', cor:'#2563EB'},
  'Médio|Acima do esperado': {nome:'Profissional Sólido', cor:'#0D9488'},
  'Médio|Dentro do esperado': {nome:'Profissional de Confiança', cor:'#0EA5E9'},
  'Médio|Abaixo do esperado': {nome:'Eficácia Contínua', cor:'#F59E0B'},
  'Baixo|Acima do esperado': {nome:'Valor Sólido', cor:'#7C3AED'},
  'Baixo|Dentro do esperado': {nome:'Dilema de Desempenho', cor:'#CA8A04'},
  'Baixo|Abaixo do esperado': {nome:'Risco', cor:'#DC2626'},
};
const QUADRANTE_CURTO = {
  'Estrela':'Alto desempenho + alto potencial',
  'Alto Potencial':'Esperado + alto potencial',
  'Enigma / Dilema':'Baixo desempenho + alto potencial',
  'Profissional Sólido':'Alto desempenho + potencial médio',
  'Profissional de Confiança':'Esperado + potencial médio',
  'Eficácia Contínua':'Baixo desempenho + potencial médio',
  'Valor Sólido':'Alto desempenho + potencial baixo',
  'Dilema de Desempenho':'Esperado + potencial baixo',
  'Risco':'Baixo desempenho + potencial baixo',
};
const QUADRANTE_DESC = {
  'Estrela':'Alto desempenho e alto potencial. Destaque da organização — candidato natural a sucessão e liderança.',
  'Alto Potencial':'Desempenho dentro do esperado com alto potencial. Investir em desenvolvimento para atingir desempenho superior.',
  'Enigma / Dilema':'Baixo desempenho com alto potencial. Vale investigar causas de contexto: adaptação, treinamento, motivação, clareza de papel ou recursos.',
  'Profissional Sólido':'Alto desempenho e potencial médio. Forte contribuição atual para os resultados.',
  'Profissional de Confiança':'Desempenho dentro do esperado e potencial médio. Consistente e importante para a operação.',
  'Eficácia Contínua':'Baixo desempenho e potencial médio. Requer acompanhamento e plano de desenvolvimento.',
  'Valor Sólido':'Alto desempenho e potencial mais limitado para crescer de posição. Deve ser valorizado pela excelência no cargo atual.',
  'Dilema de Desempenho':'Desempenho dentro do esperado e potencial mais limitado. Avaliar contexto e necessidade de desenvolvimento.',
  'Risco':'Baixo desempenho e baixo potencial. Requer intervenção, plano de melhoria e acompanhamento sistemático.',
};

/* =========================================================
   PERSISTÊNCIA — chamadas reais ao backend (Etapa 3 da migração)
   Substitui inteiramente o window.storage do artefato original.
   ========================================================= */
function getToken(){ return sessionStorage.getItem('cq_token'); }

async function apiFetch(path, options){
  options = options || {};
  const headers = Object.assign({'Content-Type':'application/json'}, options.headers||{});
  const token = getToken();
  if(token) headers['Authorization'] = 'Bearer ' + token;
  let resp;
  try{
    resp = await fetch(API_BASE + path, Object.assign({}, options, {headers}));
  }catch(e){
    showToast('Não foi possível conectar ao servidor. Verifique sua conexão.', 'error');
    throw e;
  }
  if(resp.status === 401){
    // sessão expirada/inválida — força novo login
    sessionStorage.removeItem('cq_token'); sessionStorage.removeItem('cq_session');
    state.session = null; state.admin = false;
    showToast('Sua sessão expirou. Faça login novamente.', 'error');
    go('landing');
    throw new Error('401 não autenticado');
  }
  if(resp.status === 403){
    let msg = 'Acesso negado.';
    try{ msg = (await resp.json()).detail || msg; }catch(e){}
    negarAcesso(msg);
    throw new Error('403: ' + msg);
  }
  if(!resp.ok){
    let msg = 'Erro ao comunicar com o servidor.';
    try{ msg = (await resp.json()).detail || msg; }catch(e){}
    showToast(msg, 'error');
    throw new Error(msg);
  }
  if(resp.status === 204) return null;
  return await resp.json();
}

async function saveAvaliacao(payload){
  // payload já vem no formato aceito pela API: {avaliado_nome, periodo, tipo, comentario, respostas}
  return await apiFetch('/avaliacoes', { method:'POST', body: JSON.stringify(payload) });
}
async function savePotencial(payload){
  return await apiFetch('/potenciais', { method:'POST', body: JSON.stringify(payload) });
}
async function listAvaliacoes(colaboradorNome){
  const qs = colaboradorNome ? ('?colaborador=' + encodeURIComponent(colaboradorNome)) : '';
  try{ return await apiFetch('/avaliacoes' + qs); }catch(e){ return []; }
}
async function listPotenciais(colaboradorNome){
  const qs = colaboradorNome ? ('?colaborador=' + encodeURIComponent(colaboradorNome)) : '';
  try{ return await apiFetch('/potenciais' + qs); }catch(e){ return []; }
}
async function savePdi(rec){
  return await apiFetch('/pdis/' + encodeURIComponent(rec.nome), { method:'PUT', body: JSON.stringify({itens: rec.itens}) });
}
async function getPdi(nome){
  try{ return await apiFetch('/pdis/' + encodeURIComponent(nome)); }catch(e){ return null; }
}
async function listPdis(nomes){
  // não existe mais um "listar todos os PDIs" — cada PDI é buscado pelo nome,
  // dentro do conjunto de nomes que a sessão atual já está autorizada a ver.
  const alvo = nomes || (state.session ? [state.session.nome] : []);
  const out = [];
  for(const nome of alvo){
    try{ const p = await getPdi(nome); if(p && p.itens && p.itens.length) out.push(p); }catch(e){}
  }
  return out;
}
function uid(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,8); }

/* ---------- Diretório organizacional (substitui as constantes fixas) ---------- */
async function carregarDiretorioPublico(){
  try{
    DIRETORIO_PUBLICO = await apiFetch('/colaboradores/publico');
  }catch(e){ DIRETORIO_PUBLICO = []; }
  TODOS_COLABORADORES = DIRETORIO_PUBLICO.map(c=>c.nome);
  CARGO_POR_COLABORADOR = {}; ROLEKEY_POR_COLABORADOR = {};
  DIRETORIO_PUBLICO.forEach(c=>{ CARGO_POR_COLABORADOR[c.nome]=c.cargoTitulo; ROLEKEY_POR_COLABORADOR[c.nome]=c.roleKey; });
}
async function carregarCargos(){
  try{ CARGO_DATA = await apiFetch('/cargos'); }catch(e){ CARGO_DATA = {}; }
}
async function carregarMinhaEquipe(){
  try{ MINHA_EQUIPE = await apiFetch('/equipe/minha'); }catch(e){ MINHA_EQUIPE = []; }
}

/* =========================================================
   ESTADO GLOBAL & ROTEAMENTO
   ========================================================= */
/* =========================================================
   ÍCONES (SVG flat/minimalistas — substituem emojis nos acessos principais)
   ========================================================= */
const ICON_COLAB = `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M19.5 20.5v-1.8a4.2 4.2 0 0 0-4.2-4.2H8.7a4.2 4.2 0 0 0-4.2 4.2v1.8"/><circle cx="12" cy="7.2" r="3.7"/></svg>`;
const ICON_GESTOR = `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M15.5 20.5v-1.6a3.8 3.8 0 0 0-3.8-3.8H6.3a3.8 3.8 0 0 0-3.8 3.8v1.6"/><circle cx="9.1" cy="6.9" r="3.4"/><path d="M21.5 20.5v-1.6a3.8 3.8 0 0 0-2.7-3.64"/><path d="M15.3 3.4a3.4 3.4 0 0 1 0 6.6"/></svg>`;
const ICON_ADMIN = `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3.5" width="7.2" height="8.6" rx="1.4"/><rect x="13.8" y="3.5" width="7.2" height="4.8" rx="1.4"/><rect x="13.8" y="11.3" width="7.2" height="9.2" rx="1.4"/><rect x="3" y="15.1" width="7.2" height="5.4" rx="1.4"/></svg>`;

const state = {
  view: 'landing',
  admin: false,
  session: null,   // {role:'colaborador'|'gestor', nome}
  form: null,
  filters: {},
  cache: { avaliacoes:[], potenciais:[], pdis:[] },
};

function go(view, extra){
  state.view = view;
  if(extra) Object.assign(state, extra);
  render();
  window.scrollTo({top:0,behavior:'smooth'});
}

function el(html){ const d=document.createElement('div'); d.innerHTML=html; return d.firstElementChild; }
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

/* =========================================================
   SISTEMA DE MENSAGENS (toast/modal) — substitui alert/confirm/prompt
   nativos do navegador, que são bloqueados ou não confiáveis dentro do
   iframe isolado (sandbox) onde este artefato roda.
   ========================================================= */
function ensureOverlayRoot(){
  let root = document.getElementById('cq-overlay-root');
  if(!root){ root = document.createElement('div'); root.id='cq-overlay-root'; document.body.appendChild(root); }
  return root;
}
function showToast(message, type){
  type = type || 'success';
  let box = document.getElementById('cq-toast-box');
  if(!box){
    box = document.createElement('div');
    box.id = 'cq-toast-box';
    box.style.cssText = 'position:fixed;top:16px;right:16px;z-index:99999;display:flex;flex-direction:column;gap:8px;max-width:340px;';
    document.body.appendChild(box);
  }
  const colors = { success:'#3E8E63', error:'#B23A48', info:'#0F2A47' };
  const t = document.createElement('div');
  t.textContent = message;
  t.style.cssText = `background:${colors[type]||colors.success};color:#fff;padding:12px 16px;border-radius:10px;font-family:'Manrope',sans-serif;font-size:13.5px;font-weight:700;box-shadow:0 8px 24px rgba(15,42,71,.25);opacity:0;transform:translateY(-8px);transition:opacity .2s ease, transform .2s ease;`;
  box.appendChild(t);
  const raf = window.requestAnimationFrame || function(cb){ setTimeout(cb, 16); };
  raf(()=>{ t.style.opacity='1'; t.style.transform='translateY(0)'; });
  setTimeout(()=>{ t.style.opacity='0'; t.style.transform='translateY(-8px)'; setTimeout(()=>t.remove(), 250); }, 3800);
}
function closeOverlay(){
  const root = document.getElementById('cq-overlay-root');
  if(root) root.innerHTML = '';
}
function showConfirmModal(message, onConfirm, opts){
  opts = opts || {};
  const root = ensureOverlayRoot();
  root.innerHTML = `
  <div style="position:fixed;inset:0;background:rgba(15,42,71,.55);z-index:99998;display:flex;align-items:center;justify-content:center;padding:20px;">
    <div style="background:#fff;border-radius:16px;padding:26px;max-width:420px;width:100%;box-shadow:0 24px 60px rgba(15,42,71,.35);">
      <h3 style="margin:0 0 10px;font-family:'Fraunces',serif;color:#0F2A47;font-size:19px;">${opts.title||'Confirmar ação'}</h3>
      <p style="font-size:13.5px;color:#444;margin:0 0 22px;line-height:1.5;">${message}</p>
      <div style="display:flex;justify-content:flex-end;gap:10px;">
        <button class="btn btn-ghost btn-sm" id="cq-modal-cancel">Cancelar</button>
        <button class="btn ${opts.danger?'btn-rose':'btn-primary'} btn-sm" id="cq-modal-ok">${opts.okLabel||'Confirmar'}</button>
      </div>
    </div>
  </div>`;
  document.getElementById('cq-modal-cancel').onclick = closeOverlay;
  document.getElementById('cq-modal-ok').onclick = () => { closeOverlay(); onConfirm(); };
}
function showPromptModal(message, defaultValue, onSubmit, opts){
  opts = opts || {};
  const root = ensureOverlayRoot();
  root.innerHTML = `
  <div style="position:fixed;inset:0;background:rgba(15,42,71,.55);z-index:99998;display:flex;align-items:center;justify-content:center;padding:20px;">
    <div style="background:#fff;border-radius:16px;padding:26px;max-width:420px;width:100%;box-shadow:0 24px 60px rgba(15,42,71,.35);">
      <h3 style="margin:0 0 10px;font-family:'Fraunces',serif;color:#0F2A47;font-size:19px;">${opts.title||'Informe um valor'}</h3>
      <p style="font-size:13.5px;color:#444;margin:0 0 14px;line-height:1.5;">${message}</p>
      <input id="cq-modal-input" type="text" value="${escapeHtml(defaultValue||'')}" style="width:100%;padding:10px 12px;border-radius:9px;border:1.6px solid #E7E9EC;font-family:'Manrope',sans-serif;font-size:14px;margin-bottom:22px;box-sizing:border-box;" />
      <div style="display:flex;justify-content:flex-end;gap:10px;">
        <button class="btn btn-ghost btn-sm" id="cq-modal-cancel">Cancelar</button>
        <button class="btn btn-primary btn-sm" id="cq-modal-ok">Continuar</button>
      </div>
    </div>
  </div>`;
  const input = document.getElementById('cq-modal-input');
  document.getElementById('cq-modal-cancel').onclick = closeOverlay;
  document.getElementById('cq-modal-ok').onclick = () => { const v = input.value.trim() || defaultValue; closeOverlay(); onSubmit(v); };
  input.focus();
  input.onkeydown = (e) => { if(e.key==='Enter') document.getElementById('cq-modal-ok').click(); };
}

function logout(){
  state.admin=false; state.session=null; state.cache={avaliacoes:[],potenciais:[],pdis:[]};
  sessionStorage.removeItem('cq_token'); sessionStorage.removeItem('cq_session'); sessionStorage.removeItem('cq_admin');
  go('landing');
}

/* =========================================================
   CONTROLE DE ACESSO — verificação na LÓGICA da aplicação
   (não apenas ocultar botões: toda função que expõe dados de um
   colaborador específico chama podeVerDadosDe() antes de renderizar)
   ========================================================= */
function podeVerDadosDe(nomeAlvo){
  // Camada client-side para BOA EXPERIÊNCIA (evita telas quebradas/piscando) —
  // a imposição real e inescapável acontece no backend (ver app/permissions.py),
  // que reaplica exatamente esta mesma regra a cada requisição.
  if(state.admin) return true; // Consultoria/Administração vê todos
  if(!state.session) return false; // ninguém autenticado
  if(state.session.role === 'colaborador') return state.session.nome === nomeAlvo; // só os próprios dados
  if(state.session.role === 'gestor'){
    if(state.session.nome === nomeAlvo) return true; // gestor também é "dono" dos seus próprios dados
    return MINHA_EQUIPE.some(t=>t.nome===nomeAlvo); // só sua equipe direta
  }
  return false;
}
function negarAcesso(mensagem){
  showToast(mensagem || 'Acesso negado: você não tem permissão para visualizar estes dados.', 'error');
}

function Topbar(){
  let sessionTag = '';
  if(state.admin) sessionTag = `<span class="badge-role" style="background:var(--navy);color:#fff;">Consultoria/RH</span>`;
  else if(state.session) sessionTag = `<span class="badge-role" style="background:var(--rose-light);color:var(--navy);">${state.session.nome} · ${state.session.role==='gestor'?'Gestor':'Colaborador'}</span>`;
  return `
  <div class="topbar">
    <div class="brand">
      <div class="mark">GD</div>
      <div class="brand-text">
        <div class="name">MOVA Gestão de Desempenho</div>
        <div class="tag">Avaliação de Desempenho · People Analytics</div>
      </div>
    </div>
    <div class="nav-actions">
      ${sessionTag}
      ${state.view!=='landing' ? `<button class="btn btn-ghost btn-sm" onclick="go('landing')">🏠 Início</button>`:''}
      ${(state.admin||state.session) ? `<button class="btn btn-ghost btn-sm" onclick="logout()">Sair</button>` : ''}
    </div>
  </div>`;
}

function render(){
  const app = document.getElementById('app');
  // Preserva a posição de rolagem: sem isso, toda vez que alguém responde uma
  // pergunta, a tela inteira é reconstruída e o navegador pode "pular" de
  // lugar — dando a falsa impressão de que a resposta sumiu, quando na
  // verdade ela foi salva normalmente, só a tela deslocou.
  const scrollAntes = window.scrollY;
  let body = '';
  if(state.view==='landing') body = ViewLanding();
  else if(state.view==='gate') body = ViewGate();
  else if(state.view==='login-colab') body = ViewLoginColab();
  else if(state.view==='login-gestor') body = ViewLoginGestor();
  else if(state.view==='colab-home') body = ViewColabHomeLoading();
  else if(state.view==='gestor-home') body = ViewGestorHomeLoading();
  else if(state.view==='pick-avaliador') body = ViewPickAvaliador();
  else if(state.view==='pick-avaliado') body = ViewPickAvaliado();
  else if(state.view==='form') body = ViewForm();
  else if(state.view==='potencial') body = ViewPotencial();
  else if(state.view==='done') body = ViewDone();
  else if(state.view==='pdi-editor') body = ViewPdiEditorLoading();
  else if(state.view==='dashboard') body = ViewDashboardLoading();
  app.innerHTML = Topbar() + body;
  window.scrollTo({top: scrollAntes, behavior:'auto'});
  if(state.view==='dashboard') initDashboard();
  else if(state.view==='colab-home') initColabHome();
  else if(state.view==='gestor-home') initGestorHome();
  else if(state.view==='pdi-editor') initPdiEditor();
}

/* =========================================================
   VIEW: LANDING
   ========================================================= */
function ViewLanding(){
  return `
  <div class="hero">
    <div class="eyebrow">Consultoria de RH · Ciclo de Avaliação</div>
    <h1>Avaliação de Desempenho, People Analytics e Matriz 9 Box em um só lugar.</h1>
    <p>Todo colaborador faz sua autoavaliação, todo gestor avalia sua equipe, e a consultoria acompanha tudo em um painel único — com comparação automática entre autoavaliação e avaliação do gestor.</p>
  </div>
  <div class="choice-row">
    <div class="choice-card a" onclick="go('login-colab')">
      <div class="icon icon-colab">${ICON_COLAB}</div>
      <h3>Sou Colaborador</h3>
      <p>Faça sua autoavaliação obrigatória, veja como ela se compara à avaliação do seu gestor e acompanhe seu PDI.</p>
      <span class="btn btn-primary btn-sm" style="align-self:flex-start;">Entrar como colaborador →</span>
    </div>
    <div class="choice-card a" onclick="go('login-gestor')">
      <div class="icon icon-gestor">${ICON_GESTOR}</div>
      <h3>Sou Gestor</h3>
      <p>Avalie sua equipe, acompanhe pendências, veja os gaps entre autoavaliação e sua avaliação, e monte PDIs.</p>
      <span class="btn btn-primary btn-sm" style="align-self:flex-start;">Entrar como gestor →</span>
    </div>
    <div class="choice-card b" onclick="go('gate')">
      <div class="icon icon-admin">${ICON_ADMIN}</div>
      <h3>Painel da Consultoria</h3>
      <p>Acesso completo: todos os colaboradores, setores, indicadores, matriz 9 box, comparações e exportação.</p>
      <span class="btn btn-accent btn-sm" style="align-self:flex-start;">Acessar painel →</span>
    </div>
  </div>`;
}

/* =========================================================
   NÍVEIS DE ACESSO — login real contra o backend (Etapa 3)
   Os PINs nunca ficam no código do frontend; a validação inteira
   acontece no servidor (ver app/routers/auth.py no backend).
   ========================================================= */
async function garantirDiretorioCarregado(){
  if(TODOS_COLABORADORES.length === 0) await carregarDiretorioPublico();
}
function ViewLoginColab(){
  const opts = TODOS_COLABORADORES.map(n=>`<option value="${n}">${n} — ${CARGO_POR_COLABORADOR[n]}</option>`).join('');
  return `
  <div class="gate-box card">
    <h2>Área do Colaborador</h2>
    <p style="color:var(--gray);font-size:13.5px;margin:10px 0 18px;">Selecione seu nome e informe seu PIN pessoal para acessar sua autoavaliação e seus resultados. Seu PIN é individual — apenas você deve conhecê-lo.</p>
    <div class="field"><label class="field-label">Colaborador</label><select id="colab-nome">${opts}</select></div>
    <input id="colab-pin" type="password" placeholder="Seu PIN pessoal" maxlength="12" />
    <div id="colab-err"></div>
    <button class="btn btn-primary" style="width:100%;margin-top:14px;" onclick="checkLoginColab()">Entrar</button>
  </div>`;
}
async function checkLoginColab(){
  const nome = document.getElementById('colab-nome').value;
  const pin = document.getElementById('colab-pin').value.trim();
  const errBox = document.getElementById('colab-err');
  errBox.innerHTML = '';
  if(!pin){ errBox.innerHTML = `<div class="error-box">Informe seu PIN.</div>`; return; }
  try{
    const resp = await fetch(API_BASE + '/auth/login/colaborador', {
      method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({nome, pin})
    });
    if(!resp.ok){ errBox.innerHTML = `<div class="error-box">PIN incorreto para este colaborador.</div>`; return; }
    const data = await resp.json();
    sessionStorage.setItem('cq_token', data.access_token);
    state.session = { role:'colaborador', nome: data.nome };
    sessionStorage.setItem('cq_session', JSON.stringify(state.session));
    await carregarCargos();
    go('colab-home');
  }catch(e){ errBox.innerHTML = `<div class="error-box">Não foi possível conectar ao servidor.</div>`; }
}
function ViewLoginGestor(){
  const gestores = DIRETORIO_PUBLICO.filter(c=>c.ehGestor);
  const opts = gestores.map(c=>`<option value="${c.nome}">${c.nome} — ${c.cargoTitulo}</option>`).join('');
  return `
  <div class="gate-box card">
    <h2>Área do Gestor</h2>
    <p style="color:var(--gray);font-size:13.5px;margin:10px 0 18px;">Selecione seu nome e informe seu PIN pessoal para avaliar sua equipe e acompanhar resultados. Seu PIN é individual — apenas você deve conhecê-lo.</p>
    <div class="field"><label class="field-label">Gestor</label><select id="gestor-nome">${opts}</select></div>
    <input id="gestor-pin" type="password" placeholder="Seu PIN pessoal" maxlength="12" />
    <div id="gestor-err"></div>
    <button class="btn btn-primary" style="width:100%;margin-top:14px;" onclick="checkLoginGestor()">Entrar</button>
  </div>`;
}
async function checkLoginGestor(){
  const nome = document.getElementById('gestor-nome').value;
  const pin = document.getElementById('gestor-pin').value.trim();
  const errBox = document.getElementById('gestor-err');
  errBox.innerHTML = '';
  if(!pin){ errBox.innerHTML = `<div class="error-box">Informe seu PIN.</div>`; return; }
  try{
    const resp = await fetch(API_BASE + '/auth/login/gestor', {
      method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({nome, pin})
    });
    if(!resp.ok){ errBox.innerHTML = `<div class="error-box">PIN incorreto para este gestor.</div>`; return; }
    const data = await resp.json();
    sessionStorage.setItem('cq_token', data.access_token);
    state.session = { role:'gestor', nome: data.nome };
    sessionStorage.setItem('cq_session', JSON.stringify(state.session));
    await carregarCargos();
    await carregarMinhaEquipe();
    go('gestor-home');
  }catch(e){ errBox.innerHTML = `<div class="error-box">Não foi possível conectar ao servidor.</div>`; }
}

/* =========================================================
   VIEW: GATE DO ADMIN — login real (usuário + senha com hash no backend)
   ========================================================= */
function ViewGate(){
  return `
  <div class="gate-box card">
    <h2>Painel Administrativo</h2>
    <p style="color:var(--gray);font-size:13.5px;margin:10px 0 18px;">Acesso da Consultoria/RH — autenticado contra o backend, com senha armazenada como hash (nunca em texto puro).</p>
    <input id="gate-usuario" type="text" placeholder="Usuário" style="margin-bottom:10px;" />
    <input id="gate-pin" type="password" placeholder="Senha" maxlength="40" />
    <div id="gate-err"></div>
    <button class="btn btn-primary" style="width:100%;margin-top:14px;" onclick="checkGate()">Entrar no painel</button>
    <p class="hint" style="margin-top:14px;">Usuário de demonstração: <b>consultoria</b> · Senha padrão: <b>RH2026</b> (troque após o primeiro acesso).</p>
  </div>`;
}
async function checkGate(){
  const usuario = document.getElementById('gate-usuario').value.trim();
  const senha = document.getElementById('gate-pin').value;
  const errBox = document.getElementById('gate-err');
  errBox.innerHTML = '';
  try{
    const resp = await fetch(API_BASE + '/auth/login/admin', {
      method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({usuario, senha})
    });
    if(!resp.ok){ errBox.innerHTML = `<div class="error-box">Usuário ou senha incorretos.</div>`; return; }
    const data = await resp.json();
    sessionStorage.setItem('cq_token', data.access_token);
    state.admin = true;
    sessionStorage.setItem('cq_admin', '1');
    await carregarCargos();
    go('dashboard');
  }catch(e){ errBox.innerHTML = `<div class="error-box">Não foi possível conectar ao servidor.</div>`; }
}

/* =========================================================
   VIEW: ESCOLHER AVALIADOR
   ========================================================= */
function ViewPickAvaliador(){
  const gestores = DIRETORIO_PUBLICO.filter(c=>c.ehGestor);
  const opts = gestores.map(c=>`<option value="${c.nome}">${c.nome} — ${c.cargoTitulo}</option>`).join('');
  return `
  <div class="card" style="max-width:560px;margin:0 auto;">
    <div class="progress-wrap">
      <div class="progress-top"><span class="step-label">Etapa 1 de 6 — Identificação</span><span class="pct">17%</span></div>
      <div class="progress-bar"><div style="width:17%"></div></div>
    </div>
    <h2>Quem está avaliando?</h2>
    <p style="color:var(--gray);font-size:13.5px;margin:8px 0 20px;">Lançamento manual (Consultoria). Selecione o avaliador. O sistema mostrará automaticamente apenas os colaboradores que ele pode avaliar.</p>
    <div class="field">
      <label class="field-label">Avaliador</label>
      <select id="sel-avaliador">
        <option value="">Selecione...</option>
        ${opts}
      </select>
    </div>
    <div class="nav-buttons">
      <span></span>
      <button class="btn btn-primary" onclick="confirmAvaliador()">Continuar →</button>
    </div>
  </div>`;
}
async function confirmAvaliador(){
  const nome = document.getElementById('sel-avaliador').value;
  if(!nome){ showToast('Selecione o avaliador para continuar.','error'); return; }
  state.pendingAvaliador = nome;
  state.vinculosTodos = await apiFetch('/admin/vinculos');
  go('pick-avaliado');
}

/* =========================================================
   VIEW: ESCOLHER AVALIADO (apenas combinações válidas — vínculos reais do banco)
   ========================================================= */
function ViewPickAvaliado(){
  const avaliador = state.pendingAvaliador;
  const targets = (state.vinculosTodos||[]).filter(v=>v.avaliadorNome===avaliador);
  const opts = targets.map(t=> `<option value="${t.avaliadoNome}">${t.avaliadoNome} — ${t.avaliadoCargo}</option>`).join('');
  return `
  <div class="card" style="max-width:560px;margin:0 auto;">
    <div class="progress-wrap">
      <div class="progress-top"><span class="step-label">Etapa 1 de 6 — Identificação</span><span class="pct">17%</span></div>
      <div class="progress-bar"><div style="width:17%"></div></div>
    </div>
    <h2>Quem você vai avaliar, ${avaliador}?</h2>
    <p style="color:var(--gray);font-size:13.5px;margin:8px 0 20px;">Apenas colaboradores com vínculo cadastrado para este avaliador aparecem na lista.</p>
    <div class="field">
      <label class="field-label">Colaborador avaliado</label>
      <select id="sel-avaliado">
        <option value="">Selecione...</option>
        ${opts}
      </select>
    </div>
    <div class="field">
      <label class="field-label">Período de referência</label>
      <input type="text" id="periodo-ref" placeholder="Ex.: 2º Semestre 2026" />
    </div>
    <div class="nav-buttons">
      <button class="btn btn-ghost" onclick="go('pick-avaliador')">← Voltar</button>
      <button class="btn btn-primary" onclick="confirmAvaliado()">Continuar →</button>
    </div>
  </div>`;
}
function confirmAvaliado(){
  const nomeAvaliado = document.getElementById('sel-avaliado').value;
  const periodo = document.getElementById('periodo-ref').value.trim() || 'Não informado';
  if(!nomeAvaliado){ showToast('Selecione o colaborador avaliado para continuar.','error'); return; }
  const avaliador = state.pendingAvaliador;
  const target = (state.vinculosTodos||[]).find(t=>t.avaliadorNome===avaliador && t.avaliadoNome===nomeAvaliado);
  if(!target){ showToast('Combinação inválida entre avaliador e avaliado.','error'); return; }
  iniciarAvaliacao({
    avaliador, cargoAvaliador: DIRETORIO_PUBLICO.find(c=>c.nome===avaliador)?.cargoTitulo || '',
    avaliado: nomeAvaliado, cargoAvaliado: target.avaliadoCargo, roleKey: target.avaliadoRoleKey,
    relacao: target.relacao, periodo, tipo: 'gestor', voltarView: 'pick-avaliado', manual: true,
  });
}

// Função central que monta o formulário de avaliação em branco — usada tanto pelo
// fluxo de lançamento manual (admin) quanto pelas áreas de colaborador/gestor logadas.
function iniciarAvaliacao({avaliador, cargoAvaliador, avaliado, cargoAvaliado, roleKey, relacao, periodo, tipo, voltarView, manual}){
  const role = CARGO_DATA[roleKey];
  const respostas = { org:[], comp:{grupo1:[],grupo2:[],grupo3:[],grupo4:[]}, tec:[] };
  role.organizacionais.forEach(c=> respostas.org.push(c.perguntas.map(()=>null)));
  ['grupo1','grupo2','grupo3','grupo4'].forEach(gk=>{
    role.comportamentais[gk].forEach(c=> respostas.comp[gk].push(c.perguntas.map(()=>null)));
  });
  role.tecnicas.perguntas.forEach(()=> respostas.tec.push(null));

  state.form = {
    id: uid(),
    avaliador, cargoAvaliador,
    avaliado, cargoAvaliado, roleKey,
    relacao, periodo, tipo: tipo || 'gestor',
    comentario: '',
    voltarView: voltarView || 'landing',
    manual: !!manual, // true = lançamento manual pelo admin (usa /admin/avaliacoes-manual)
    step: 1,
    respostas
  };
  go('form');
}

/* ---------- Atalhos de início de avaliação (áreas logadas) ---------- */
function startGestorEval(avaliadoNome){
  const avaliadorNome = state.session.nome;
  const target = MINHA_EQUIPE.find(t=>t.nome===avaliadoNome);
  if(!target){ showToast('Você não tem permissão para avaliar este colaborador.','error'); return; }
  showPromptModal('Informe o período de referência desta avaliação (ex.: 2º Semestre 2026).', 'Ciclo Atual', (periodo)=>{
    iniciarAvaliacao({
      avaliador: avaliadorNome, cargoAvaliador: CARGO_POR_COLABORADOR[avaliadorNome],
      avaliado: avaliadoNome, cargoAvaliado: target.cargoTitulo, roleKey: target.roleKey,
      relacao: target.relacao, periodo, tipo:'gestor', voltarView:'gestor-home'
    });
  }, {title:'Período de referência'});
}
function startAutoAvaliacao(){
  const nome = state.session.nome;
  const roleKey = ROLEKEY_POR_COLABORADOR[nome];
  const cargo = CARGO_POR_COLABORADOR[nome];
  showPromptModal('Informe o período de referência desta autoavaliação (ex.: 2º Semestre 2026).', 'Ciclo Atual', (periodo)=>{
    iniciarAvaliacao({
      avaliador: nome, cargoAvaliador: cargo,
      avaliado: nome, cargoAvaliado: cargo, roleKey,
      relacao: 'Autoavaliação', periodo, tipo:'auto', voltarView:'colab-home'
    });
  }, {title:'Período de referência'});
}

/* =========================================================
   VIEW: FORMULÁRIO DE AVALIAÇÃO (etapas 2,3,4 = org/comp/tec; 5=revisão)
   ========================================================= */
const STEP_LABELS = ['Identificação','Organizacionais','Comportamentais','Técnicas','Revisão','Envio'];
function stepPct(step){ return Math.round((step+1)/6*100); } // step 1..4 mapeados dentro de 6 etapas totais

function ScaleButtons(name, currentVal, onSelectFn){
  return `<div class="scale">${GRAU_LEGENDA.map(g=>`
    <button type="button" class="${currentVal===g.v?'sel':''}" onclick="${onSelectFn}(${g.v})">${g.v} · ${g.l}</button>
  `).join('')}</div>`;
}

function ProgressHeader(step){
  const pct = stepPct(step);
  const names = STEP_LABELS;
  return `
  <div class="progress-wrap">
    <div class="progress-top"><span class="step-label">Etapa ${step+1} de 6 — ${names[step]}</span><span class="pct">${pct}%</span></div>
    <div class="progress-bar"><div style="width:${pct}%"></div></div>
    <div class="steps-mini">${names.map((n,i)=>`<span class="${i===step?'active':(i<step?'done':'')}">${i+1}. ${n}</span>`).join('')}</div>
  </div>`;
}

function ViewForm(){
  const f = state.form;
  const role = CARGO_DATA[f.roleKey];
  let content = '';
  if(f.step===1) content = FormOrg(role, f);
  else if(f.step===2) content = FormComp(role, f);
  else if(f.step===3) content = FormTec(role, f);
  else if(f.step===4) content = FormReview(role, f);
  const tipoBadge = f.tipo==='auto'
    ? `<span class="badge" style="background:var(--yellow);color:var(--navy);">Autoavaliação</span>`
    : `<span class="badge" style="background:var(--navy);color:#fff;">Avaliação do Gestor</span>`;
  return `
  <div class="card">
    ${ProgressHeader(f.step)}
    <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px;flex-wrap:wrap;gap:8px;">
      <div><b>${f.avaliado}</b> <span class="badge-role">${f.cargoAvaliado}</span> ${tipoBadge}</div>
      <div style="font-size:12.5px;color:var(--gray);">Avaliador: ${f.avaliador} · ${f.relacao}</div>
    </div>
    ${content}
  </div>`;
}

function FormOrg(role, f){
  const html = role.organizacionais.map((c, ci)=>{
    const qs = c.perguntas.map((q,qi)=>{
      const val = f.respostas.org[ci][qi];
      return `<div class="q-row">
        <div class="q-text">${qi+1}. ${escapeHtml(q)}</div>
        ${ScaleButtons('org', val, `setOrg(${ci},${qi},`)}
      </div>`;
    }).join('');
    return `<div class="comp-block">
      <h4>${escapeHtml(c.nome)}</h4>
      <div class="comp-desc">${escapeHtml(c.desc)}</div>
      ${qs}
    </div>`;
  }).join('');
  return `
  <div class="group-title">Competências Organizacionais</div>
  ${html}
  <div class="nav-buttons">
    <button class="btn btn-ghost" onclick="go(state.form.voltarView)">← Voltar</button>
    <button class="btn btn-primary" onclick="nextStep(1)">Continuar →</button>
  </div>`;
}
function setOrg(ci,qi,val){ state.form.respostas.org[ci][qi] = val; render(); }

function FormComp(role, f){
  const groupTitles = {grupo1:'Grupo 01', grupo2:'Grupo 02', grupo3:'Grupo 03', grupo4:'Grupo 04'};
  const html = ['grupo1','grupo2','grupo3','grupo4'].map(gk=>{
    const comps = role.comportamentais[gk].map((c,ci)=>{
      const qs = c.perguntas.map((q,qi)=>{
        const val = f.respostas.comp[gk][ci][qi];
        return `<div class="q-row">
          <div class="q-text">${qi+1}. ${escapeHtml(q)}</div>
          ${ScaleButtons('comp', val, `setComp('${gk}',${ci},${qi},`)}
        </div>`;
      }).join('');
      return `<div class="comp-block">
        <h4>${escapeHtml(c.nome)}</h4>
        <div class="comp-desc">${escapeHtml(c.desc)}</div>
        ${qs}
      </div>`;
    }).join('');
    return `<div class="group-title">${groupTitles[gk]}</div>${comps}`;
  }).join('');
  return `
  ${html}
  <div class="nav-buttons">
    <button class="btn btn-ghost" onclick="prevStep(2)">← Voltar</button>
    <button class="btn btn-primary" onclick="nextStep(2)">Continuar →</button>
  </div>`;
}
function setComp(gk,ci,qi,val){ state.form.respostas.comp[gk][ci][qi] = val; render(); }

function FormTec(role, f){
  const qs = role.tecnicas.perguntas.map((q,qi)=>{
    const val = f.respostas.tec[qi];
    return `<div class="q-row">
      <div class="q-text">${qi+1}. ${escapeHtml(q)}</div>
      ${ScaleButtons('tec', val, `setTec(${qi},`)}
    </div>`;
  }).join('');
  return `
  <div class="group-title">Competências Técnicas</div>
  <div class="comp-block">
    <h4>${escapeHtml(role.tecnicas.nome)}</h4>
    <div class="comp-desc">${escapeHtml(role.tecnicas.desc)}</div>
    ${qs}
  </div>
  <div class="nav-buttons">
    <button class="btn btn-ghost" onclick="prevStep(3)">← Voltar</button>
    <button class="btn btn-primary" onclick="nextStep(3)">Continuar →</button>
  </div>`;
}
function setTec(qi,val){ state.form.respostas.tec[qi] = val; render(); }

function formIsComplete(role, f){
  for(const arr of f.respostas.org) for(const v of arr) if(v===null) return false;
  for(const gk of ['grupo1','grupo2','grupo3','grupo4']) for(const arr of f.respostas.comp[gk]) for(const v of arr) if(v===null) return false;
  for(const v of f.respostas.tec) if(v===null) return false;
  return true;
}

function nextStep(fromStep){
  const f = state.form;
  const role = CARGO_DATA[f.roleKey];
  // valida etapa atual antes de avançar
  let incomplete = false;
  if(fromStep===1){ f.respostas.org.forEach(arr=>arr.forEach(v=>{ if(v===null) incomplete=true; })); }
  if(fromStep===2){ ['grupo1','grupo2','grupo3','grupo4'].forEach(gk=> f.respostas.comp[gk].forEach(arr=>arr.forEach(v=>{ if(v===null) incomplete=true; }))); }
  if(fromStep===3){ f.respostas.tec.forEach(v=>{ if(v===null) incomplete=true; }); }
  if(incomplete){ showToast('Responda todas as perguntas desta etapa antes de continuar.','error'); return; }
  f.step = fromStep+1;
  render();
}
function prevStep(fromStep){ state.form.step = fromStep-1; render(); }

function FormReview(role, f){
  if(!formIsComplete(role, f)){
    return `<div class="error-box">Existem perguntas não respondidas. Volte às etapas anteriores para completar a avaliação.</div>
    <div class="nav-buttons"><button class="btn btn-ghost" onclick="prevStep(4)">← Voltar</button><span></span></div>`;
  }
  const calc = computeScores(role, f.respostas);
  const rows = (title, comps) => `
    <div class="review-sec"><h4>${title}</h4>
    ${comps.map(c=>`<div class="review-item"><span class="q">${escapeHtml(c.nome)}</span><span class="a">${(c.media*10).toFixed(1)}</span></div>`).join('')}
    </div>`;
  return `
  <div class="review-sec">
    <h4>Identificação</h4>
    <div class="review-item"><span class="q">Colaborador avaliado</span><span class="a">${f.avaliado} (${f.cargoAvaliado})</span></div>
    <div class="review-item"><span class="q">Avaliador</span><span class="a">${f.avaliador} (${f.cargoAvaliador})</span></div>
    <div class="review-item"><span class="q">Relação</span><span class="a">${f.relacao}</span></div>
    <div class="review-item"><span class="q">Período</span><span class="a">${f.periodo}</span></div>
  </div>
  ${rows('Competências Organizacionais', calc.org.comps)}
  ${rows('Competências Comportamentais', calc.comp.comps)}
  ${rows('Competências Técnicas', calc.tec.comps)}
  <div class="review-sec">
    <h4>Resultado consolidado</h4>
    <div class="review-item"><span class="q">Nota Competências Organizacionais</span><span class="a">${calc.notaOrg.toFixed(1)}</span></div>
    <div class="review-item"><span class="q">Nota Competências Comportamentais</span><span class="a">${calc.notaComp.toFixed(1)}</span></div>
    <div class="review-item"><span class="q">Nota Competências Técnicas</span><span class="a">${calc.notaTec.toFixed(1)}</span></div>
    <div class="review-item" style="border-top:2px solid var(--navy);padding-top:10px;"><span class="q" style="font-weight:800;">NOTA FINAL</span><span class="a" style="font-size:16px;">${calc.notaFinal.toFixed(1)} — ${classificarDesempenho(calc.notaFinal)}</span></div>
  </div>
  <div class="field">
    <label class="field-label">${f.tipo==='auto' ? 'Comentários / justificativas do colaborador (opcional)' : 'Comentários do gestor (opcional)'}</label>
    <textarea id="comentario-final" rows="4" oninput="state.form.comentario=this.value" style="width:100%;padding:11px 12px;border-radius:9px;border:1.6px solid var(--gray-light);font-family:'Manrope',sans-serif;font-size:13.5px;" placeholder="Justifique notas, registre contexto ou combine próximos passos...">${escapeHtml(f.comentario||'')}</textarea>
  </div>
  <div class="nav-buttons">
    <button class="btn btn-ghost" onclick="prevStep(4)">← Voltar</button>
    <button class="btn btn-accent" onclick="submitAvaliacao()">Enviar Avaliação ✓</button>
  </div>`;
}

function computeScores(role, respostas){
  const org = calcularOrganizacionais(role, respostas);
  const comp = calcularComportamentais(role, respostas);
  const tec = calcularTecnicas(role, respostas);
  const notaOrg = Math.min(org.pilar*10, 10);
  const notaComp = Math.min(comp.pilar*10, 10);
  const notaTec = Math.min(tec.pilar*10, 10);
  const notaFinal = (notaOrg + notaComp + notaTec) / 3; // pesos iguais (ver observação metodológica)
  return { org, comp, tec, notaOrg, notaComp, notaTec, notaFinal };
}

async function submitAvaliacao(){
  const f = state.form;
  const payload = {
    avaliado_nome: f.avaliado, periodo: f.periodo, tipo: f.tipo || 'gestor',
    comentario: f.comentario || '', respostas: f.respostas,
  };
  let rec;
  try{
    if(f.manual){
      // Lançamento manual pela Consultoria — avaliador especificado explicitamente
      rec = await apiFetch('/admin/avaliacoes-manual?avaliador_nome=' + encodeURIComponent(f.avaliador), {
        method:'POST', body: JSON.stringify(payload),
      });
    } else {
      rec = await saveAvaliacao(payload); // avaliador vem do token da sessão, no servidor
    }
  }catch(e){
    return; // apiFetch já mostrou o toast de erro apropriado (inclusive 403 de permissão)
  }
  state.lastRec = rec;
  // Potencial só é coletado quando o avaliador é o líder do avaliado (conforme metodologia) — nunca na autoavaliação
  if(f.relacao === 'Líder avaliando liderado' && f.tipo !== 'auto'){
    state.potForm = { id: uid(), avaliado: f.avaliado, avaliador: f.avaliador, respostas: POTENCIAL_PERGUNTAS.map(()=>null) };
    go('potencial');
  } else {
    go('done');
  }
}

/* =========================================================
   VIEW: AVALIAÇÃO DE POTENCIAL (estrutura separada do desempenho)
   ========================================================= */
function ViewPotencial(){
  const f = state.potForm;
  const qs = POTENCIAL_PERGUNTAS.map((q,qi)=>{
    const val = f.respostas[qi];
    const scale = [1,2,3,4,5].map(v=>`<button type="button" class="${val===v?'sel':''}" onclick="setPot(${qi},${v})">${v}</button>`).join('');
    return `<div class="q-row">
      <div class="q-text">${qi+1}. ${escapeHtml(q)}</div>
      <div class="scale">${scale}</div>
    </div>`;
  }).join('');
  return `
  <div class="card">
    <div class="disclosure">Avaliação enviada com sucesso ✓ — Esta etapa adicional mede <b>potencial</b>, uma dimensão diferente do desempenho, preenchida pelo gestor responsável.</div>
    <h2>Avaliação de Potencial — ${f.avaliado}</h2>
    <p style="color:var(--gray);font-size:13.5px;margin:8px 0 20px;">Responda considerando capacidade de crescimento, aprendizagem e prontidão para maiores responsabilidades. Escala de 1 (baixo) a 5 (alto).</p>
    ${qs}
    <div class="nav-buttons">
      <button class="btn btn-ghost" onclick="skipPotencial()">Pular esta etapa</button>
      <button class="btn btn-accent" onclick="submitPotencial()">Concluir ✓</button>
    </div>
  </div>`;
}
function setPot(qi,val){ state.potForm.respostas[qi]=val; render(); }
function skipPotencial(){ go('done'); }
async function submitPotencial(){
  const f = state.potForm;
  if(f.respostas.some(v=>v===null)){ showToast('Responda todas as perguntas ou clique em "Pular esta etapa".','error'); return; }
  try{ await savePotencial({ avaliado_nome: f.avaliado, respostas: f.respostas }); }
  catch(e){ return; } // apiFetch já mostrou o toast de erro apropriado
  go('done');
}

/* =========================================================
   VIEW: CONCLUSÃO
   ========================================================= */
function ViewDone(){
  const r = state.lastRec;
  const voltar = (state.form && state.form.voltarView) || 'landing';
  const voltarLabel = voltar==='colab-home' ? 'Voltar à minha área' : (voltar==='gestor-home' ? 'Voltar à minha equipe' : 'Realizar outra avaliação');
  return `
  <div class="card" style="max-width:560px;margin:0 auto;text-align:center;">
    <div style="font-size:46px;">✅</div>
    <h2>Avaliação enviada com sucesso!</h2>
    <p style="color:var(--gray);font-size:14px;margin:10px 0 20px;">Obrigado, ${r?r.avaliador:''}. A avaliação de <b>${r?r.avaliado:''}</b> foi registrada e os resultados do painel administrativo já foram atualizados.</p>
    ${r?`<div class="badge" style="background:var(--rose-light);color:var(--navy);font-size:14px;padding:8px 16px;">Nota final: ${r.notaFinal.toFixed(1)} · ${r.classificacaoDesempenho}</div>`:''}
    <div style="margin-top:24px;display:flex;gap:10px;justify-content:center;">
      <button class="btn btn-primary" onclick="go('${voltar}')">${voltarLabel}</button>
      <button class="btn btn-ghost" onclick="go('landing')">Voltar ao início</button>
    </div>
  </div>`;
}

/* =========================================================
   DASHBOARD ADMINISTRATIVO
   ========================================================= */
let TOTAL_PARES_ESPERADOS = 0; // calculado em initDashboard() a partir de /admin/vinculos (dado real do banco)
let chartRefs = {};

function ViewDashboardLoading(){
  return `<div class="empty-state"><div class="big">⏳</div>Carregando dados do painel...</div>`;
}

async function initDashboard(){
  // Barreira de lógica (não apenas visual): mesmo se esta função for chamada
  // diretamente sem passar pela tela de PIN da consultoria, ela recusa buscar e
  // expor os dados completos da organização caso a sessão não seja admin.
  // O backend também recusa (dupla camada) — ver GET /avaliacoes no servidor.
  if(!state.admin){
    negarAcesso('Acesso restrito à Consultoria/Administração.');
    go(state.session ? (state.session.role==='gestor'?'gestor-home':'colab-home') : 'landing');
    return;
  }
  if(Object.keys(CARGO_DATA).length === 0) await carregarCargos();
  if(TODOS_COLABORADORES.length === 0) await carregarDiretorioPublico();
  try{ state.vinculosTodos = await apiFetch('/admin/vinculos'); TOTAL_PARES_ESPERADOS = state.vinculosTodos.length; }catch(e){ TOTAL_PARES_ESPERADOS = 0; }
  // Sem filtro de nome: o backend já devolve TUDO para uma sessão admin —
  // não filtramos nada aqui, o escopo é decidido no servidor pelo token.
  const [avaliacoes, potenciais, pdis] = await Promise.all([
    listAvaliacoes(), listPotenciais(), listPdis(TODOS_COLABORADORES),
  ]);
  state.cache.avaliacoes = avaliacoes;
  state.cache.potenciais = potenciais;
  state.cache.pdis = pdis;
  renderDashboardBody();
}

function latestByAvaliado(list){
  const map = {};
  list.forEach(r=>{
    if(!map[r.avaliado] || new Date(r.timestamp) > new Date(map[r.avaliado].timestamp)) map[r.avaliado]=r;
  });
  return map;
}

function applyFilters(avaliacoes){
  const f = state.filters;
  return avaliacoes.filter(r=>{
    if(f.cargo && r.cargoAvaliado !== f.cargo) return false;
    if(f.setor && r.area !== f.setor) return false;
    if(f.colaborador && r.avaliado !== f.colaborador) return false;
    if(f.avaliador && r.avaliador !== f.avaliador) return false;
    if(f.periodo && r.periodo !== f.periodo) return false;
    if(f.tipo && (r.tipo||'gestor') !== f.tipo) return false;
    return true;
  });
}

function computeQuadrantes(avaliacoesFiltradas, potenciaisAll){
  const latestPerf = latestByAvaliado(avaliacoesFiltradas);
  const latestPot = latestByAvaliado(potenciaisAll);
  const out = [];
  Object.keys(latestPerf).forEach(nome=>{
    const perf = latestPerf[nome];
    const pot = latestPot[nome];
    const potClass = pot ? pot.classificacaoPotencial : 'Médio'; // padrão neutro se ainda não avaliado
    const key = potClass+'|'+perf.classificacaoDesempenho;
    const quad = QUADRANTES[key] || {nome:'Não classificado', cor:'#999'};
    out.push({ nome, cargo: perf.cargoAvaliado, perf, pot, potClass, quadrante: quad.nome, cor: quad.cor });
  });
  return out;
}

/* =========================================================
   CONSOLIDAÇÃO AUTOAVALIAÇÃO × AVALIAÇÃO DO GESTOR + GAPS
   ========================================================= */
// Nota: a Matriz 9 Box e os indicadores oficiais de desempenho usam SEMPRE a
// avaliação do GESTOR (tipo:'gestor'), nunca a autoavaliação isoladamente —
// a autoavaliação serve para autoconhecimento e para o cálculo de gaps de percepção.
function consolidarColaborador(nome, todasAvaliacoes){
  const doColab = todasAvaliacoes.filter(r=>r.avaliado===nome);
  const autos = doColab.filter(r=>r.tipo==='auto').sort((a,b)=>new Date(b.timestamp)-new Date(a.timestamp));
  const gestores = doColab.filter(r=>r.tipo!=='auto').sort((a,b)=>new Date(b.timestamp)-new Date(a.timestamp));
  const auto = autos[0] || null;
  const gestor = gestores[0] || null;
  let notaConsolidada = null;
  if(auto && gestor) notaConsolidada = (auto.notaFinal + gestor.notaFinal)/2;
  else if(gestor) notaConsolidada = gestor.notaFinal;
  else if(auto) notaConsolidada = auto.notaFinal;

  // gaps por competência (casando pelo nome da competência entre as duas avaliações)
  let gaps = [];
  if(auto && gestor){
    const compsAuto = [...auto.competenciasOrg, ...auto.competenciasComp, ...auto.competenciasTec];
    const compsGestor = [...gestor.competenciasOrg, ...gestor.competenciasComp, ...gestor.competenciasTec];
    gaps = compsGestor.map(cg=>{
      const ca = compsAuto.find(x=>x.nome===cg.nome);
      const notaG = cg.media*10, notaA = ca ? ca.media*10 : null;
      return { nome: cg.nome, notaGestor: notaG, notaAuto: notaA, gap: notaA!==null ? +(notaG-notaA).toFixed(1) : null };
    });
  }
  return { nome, auto, gestor, notaConsolidada, gaps };
}
function maioresGaps(gaps, n=3){
  return gaps.filter(g=>g.gap!==null).slice().sort((a,b)=>Math.abs(b.gap)-Math.abs(a.gap)).slice(0,n);
}

function renderDashboardBody(){
  const all = state.cache.avaliacoes;
  const filtered = applyFilters(all);
  const cargos = [...new Set(all.map(r=>r.cargoAvaliado))];
  const setores = [...new Set(all.map(r=>r.area).filter(Boolean))];
  const colaboradoresList = [...new Set(all.map(r=>r.avaliado))];
  const avaliadoresList = [...new Set(all.map(r=>r.avaliador))];
  const periodosList = [...new Set(all.map(r=>r.periodo))];
  // A Matriz 9 Box usa sempre a avaliação do GESTOR (nunca a autoavaliação) como nota oficial de desempenho
  const filteredGestorOnly = filtered.filter(r=>(r.tipo||'gestor')==='gestor');
  let quadrantes = computeQuadrantes(filteredGestorOnly, state.cache.potenciais);
  if(state.filters.quadrante) quadrantes = quadrantes.filter(q=>q.quadrante===state.filters.quadrante);

  const distinctColabAvaliados = new Set(filtered.map(r=>r.avaliado)).size;
  const totalAvaliacoes = filtered.length;
  const mediaGeral = filteredGestorOnly.length ? media(filteredGestorOnly.map(r=>r.notaFinal)) : 0;
  const paresPreenchidos = new Set(all.filter(r=>(r.tipo||'gestor')==='gestor').map(r=>r.avaliador+'→'+r.avaliado)).size;
  const pctConcluido = Math.min(100, Math.round(paresPreenchidos/TOTAL_PARES_ESPERADOS*100));
  const colabsComAuto = new Set(all.filter(r=>r.tipo==='auto').map(r=>r.avaliado)).size;
  const pctAutoConcluida = Math.min(100, Math.round(colabsComAuto/TODOS_COLABORADORES.length*100));

  const mediaPorCargo = {};
  cargos.forEach(c=>{
    const rs = filteredGestorOnly.filter(r=>r.cargoAvaliado===c);
    mediaPorCargo[c] = rs.length ? media(rs.map(r=>r.notaFinal)) : null;
  });

  const distCounts = {'Abaixo do esperado':0,'Dentro do esperado':0,'Acima do esperado':0};
  filteredGestorOnly.forEach(r=> distCounts[r.classificacaoDesempenho] = (distCounts[r.classificacaoDesempenho]||0)+1);

  const demoCount = all.filter(r=>r.demo===true).length;
  const realCount = all.length - demoCount;

  const app = document.getElementById('app');
  const dashHtml = `
    <div class="disclosure">Painel calculado automaticamente a partir de ${all.length} avaliação(ões) registradas (gestor + autoavaliação). A Matriz 9 Box e os indicadores de desempenho usam sempre a <b>avaliação do gestor</b> como nota oficial; a autoavaliação alimenta a comparação de gaps. Autenticado contra um backend real (FastAPI + Postgres) — cada requisição é validada no servidor, não apenas na tela.</div>

    <div class="card" style="margin-bottom:20px;">
      <h3 style="font-size:15px;margin-bottom:2px;">Gerenciamento de dados</h3>
      <div class="sub" style="margin-bottom:14px;">
        <span class="badge" style="background:#FCEFC0;color:#8a6d0b;">🧪 ${demoCount} registro(s) de demonstração</span>
        <span class="badge" style="background:var(--gray-light);color:var(--navy);margin-left:6px;">📋 ${realCount} registro(s) reais</span>
      </div>
      <div class="export-row">
        <button class="btn btn-accent btn-sm" onclick="confirmSeedDemoData()">🧪 Carregar dados de demonstração</button>
        <button class="btn btn-ghost btn-sm" onclick="confirmCleanupDemoData()" ${demoCount===0?'disabled':''}>🧹 Limpar apenas dados de demonstração</button>
        <button class="btn btn-ghost btn-sm" onclick="go('pick-avaliador')">➕ Registrar avaliação manual</button>
      </div>
      <p class="hint" style="margin-top:12px;">"Limpar apenas dados de demonstração" remove <b>somente</b> os registros marcados como fictícios (🧪) — os dados reais preenchidos pelos colaboradores nunca são afetados por essa ação.</p>
      <div style="border-top:1px solid var(--gray-light);margin-top:14px;padding-top:14px;">
        <button class="btn btn-rose btn-sm" onclick="confirmResetAllData()">🗑️ Apagar TODOS os dados (inclusive reais)</button>
        <p class="hint" style="margin-top:8px;">Use apenas para reiniciar o sistema do zero. Esta ação apaga <b>tudo</b> — demonstração e reais — e não pode ser desfeita.</p>
      </div>
    </div>

    <div class="filters-bar">
      <div class="field"><label>Cargo</label><select onchange="setFilter('cargo', this.value)">
        <option value="">Todos</option>${cargos.map(c=>`<option value="${c}" ${state.filters.cargo===c?'selected':''}>${c}</option>`).join('')}
      </select></div>
      <div class="field"><label>Setor</label><select onchange="setFilter('setor', this.value)">
        <option value="">Todos</option>${setores.map(c=>`<option value="${c}" ${state.filters.setor===c?'selected':''}>${c}</option>`).join('')}
      </select></div>
      <div class="field"><label>Colaborador</label><select onchange="setFilter('colaborador', this.value)">
        <option value="">Todos</option>${colaboradoresList.map(c=>`<option value="${c}" ${state.filters.colaborador===c?'selected':''}>${c}</option>`).join('')}
      </select></div>
      <div class="field"><label>Avaliador/Gestor</label><select onchange="setFilter('avaliador', this.value)">
        <option value="">Todos</option>${avaliadoresList.map(c=>`<option value="${c}" ${state.filters.avaliador===c?'selected':''}>${c}</option>`).join('')}
      </select></div>
      <div class="field"><label>Tipo</label><select onchange="setFilter('tipo', this.value)">
        <option value="">Gestor + Auto</option>
        <option value="gestor" ${state.filters.tipo==='gestor'?'selected':''}>Somente Gestor</option>
        <option value="auto" ${state.filters.tipo==='auto'?'selected':''}>Somente Autoavaliação</option>
      </select></div>
      <div class="field"><label>Período</label><select onchange="setFilter('periodo', this.value)">
        <option value="">Todos</option>${periodosList.map(c=>`<option value="${c}" ${state.filters.periodo===c?'selected':''}>${c}</option>`).join('')}
      </select></div>
      <div class="field"><label>Quadrante 9-Box</label><select onchange="setFilter('quadrante', this.value)">
        <option value="">Todos</option>${[...new Set(Object.values(QUADRANTES).map(q=>q.nome))].map(q=>`<option value="${q}" ${state.filters.quadrante===q?'selected':''}>${q}</option>`).join('')}
      </select></div>
      <button class="btn btn-ghost btn-sm" onclick="clearFilters()">✕ Limpar filtros</button>
    </div>

    <div class="kpi-grid">
      <div class="kpi"><div class="val">${distinctColabAvaliados}</div><div class="lbl">Colaboradores avaliados</div></div>
      <div class="kpi"><div class="val">${totalAvaliacoes}</div><div class="lbl">Avaliações realizadas</div></div>
      <div class="kpi"><div class="val">${mediaGeral.toFixed(1)}</div><div class="lbl">Média geral (gestor)</div></div>
      <div class="kpi"><div class="val">${pctConcluido}%</div><div class="lbl">Ciclo do gestor concluído</div><div class="sub">${paresPreenchidos}/${TOTAL_PARES_ESPERADOS} vínculos avaliados</div></div>
    </div>
    <div class="kpi-grid">
      <div class="kpi"><div class="val">${pctAutoConcluida}%</div><div class="lbl">Autoavaliações concluídas</div><div class="sub">${colabsComAuto}/${TODOS_COLABORADORES.length} colaboradores</div></div>
    </div>

    ${all.length===0 ? `<div class="empty-state card"><div class="big">🗂️</div>Nenhuma avaliação registrada ainda. Assim que os líderes enviarem avaliações, este painel será atualizado automaticamente.</div>` : `

    <div class="section-title"><span class="dot"></span>Matriz 9 Box</div>
    <div class="card box9-wrap">
      <div style="display:flex;">
        <div class="box9-axis-y">POTENCIAL</div>
        <div>
          <div class="box9-table" id="box9grid"></div>
          <div class="box9-axis-x">DESEMPENHO →</div>
        </div>
      </div>
      <div class="box9-legend">
        <h4>Quadrantes</h4>
        ${Object.values(QUADRANTES).filter((v,i,a)=>a.findIndex(x=>x.nome===v.nome)===i).map(q=>`
          <div class="quad-tag" style="background:${q.cor}1A;color:${q.cor};" title="${escapeHtml(QUADRANTE_DESC[q.nome]||'')}">
            <span class="swatch" style="background:${q.cor};"></span>
            <span class="txt" style="color:var(--navy);">${q.nome}<small>${QUADRANTE_CURTO[q.nome]||''}</small></span>
          </div>`).join('')}
        <p class="hint" style="margin-top:12px;">Clique em um colaborador na matriz para ver detalhes, competências fortes, pontos de desenvolvimento e recomendações. Passe o mouse sobre um quadrante ou sobre um colaborador para ver mais informações. Colaboradores sem avaliação de potencial aparecem na linha "Médio" até que essa etapa seja preenchida pelo gestor.</p>
      </div>
    </div>
    <div id="person-detail"></div>

    <div class="section-title"><span class="dot"></span>Distribuição dos resultados</div>
    <div class="grid-2">
      <div class="chart-card"><h3>Distribuição dos resultados</h3><div class="sub">Quantidade de avaliações por classificação de desempenho</div><canvas id="chartDist" height="220"></canvas></div>
      <div class="chart-card"><h3>Distribuição percentual</h3><div class="sub">Proporção de avaliações em cada faixa</div><canvas id="chartDistPct" height="220"></canvas></div>
    </div>

    <div class="section-title"><span class="dot"></span>Força dos critérios de avaliação</div>
    <div class="chart-card">
      <h3>Média por competência</h3><div class="sub">Notas médias (0–10) — identifique pontos fortes e oportunidades de desenvolvimento</div>
      <canvas id="chartForca" height="140"></canvas>
    </div>

    <div class="section-title"><span class="dot"></span>Ranking de resultados</div>
    <div class="chart-card" id="rankingBox"></div>

    <div class="section-title"><span class="dot"></span>Resultados por cargo</div>
    <div class="chart-card"><canvas id="chartCargo" height="150"></canvas></div>

    <div class="section-title"><span class="dot"></span>Resultados por tipo de competência</div>
    <div class="chart-card"><canvas id="chartTipo" height="150"></canvas></div>

    <div class="section-title"><span class="dot"></span>Base de dados e exportação</div>
    <div class="card">
      <p style="font-size:13px;color:var(--gray);margin-bottom:10px;">Exporte os dados brutos de respostas ou os resultados consolidados. Formatos CSV e XLSX são gerados diretamente no navegador; o relatório em PDF abre uma versão para impressão/"Salvar como PDF" do navegador.</p>
      <div class="export-row">
        <button class="btn btn-primary btn-sm" onclick="exportRespostasCSV()">⬇ Respostas (CSV)</button>
        <button class="btn btn-primary btn-sm" onclick="exportConsolidadoCSV()">⬇ Consolidado (CSV)</button>
        <button class="btn btn-accent btn-sm" onclick="exportXLSX()">⬇ Exportar (XLSX)</button>
        <button class="btn btn-rose btn-sm" onclick="exportMatriz9BoxCSV()">⬇ Matriz 9 Box (CSV)</button>
        <button class="btn btn-ghost btn-sm" onclick="exportRelatorioPDF()">🖨 Relatório (PDF/Impressão)</button>
      </div>
    </div>

    <div class="section-title"><span class="dot"></span>Avaliações registradas</div>
    <div class="card" style="overflow:auto;">
      <table class="data-table">
        <thead><tr><th>Data</th><th>Origem</th><th>Avaliado</th><th>Cargo</th><th>Avaliador</th><th>Tipo</th><th>Relação</th><th>Período</th><th>Nota Final</th><th>Classificação</th></tr></thead>
        <tbody>
          ${filtered.slice().sort((a,b)=>new Date(b.timestamp)-new Date(a.timestamp)).map(r=>`
            <tr><td>${new Date(r.timestamp).toLocaleDateString('pt-BR')}</td><td>${r.demo===true?'<span class="badge" style="background:#FCEFC0;color:#8a6d0b;">🧪 Demo</span>':'<span class="badge" style="background:var(--gray-light);color:var(--navy);">Real</span>'}</td><td>${r.avaliado}</td><td>${r.cargoAvaliado}</td><td>${r.avaliador}</td><td>${(r.tipo||'gestor')==='auto'?'Autoavaliação':'Gestor'}</td><td>${r.relacao}</td><td>${r.periodo}</td><td><b>${r.notaFinal.toFixed(1)}</b></td><td>${r.classificacaoDesempenho}</td></tr>
          `).join('') || '<tr><td colspan="10" style="text-align:center;color:var(--gray);">Nenhum registro para os filtros selecionados.</td></tr>'}
        </tbody>
      </table>
    </div>
    `}
  `;
  app.innerHTML = Topbar() + dashHtml;
  const chartDataSet = state.filters.tipo === 'auto' ? filtered : filteredGestorOnly;
  if(all.length>0){
    renderBox9(quadrantes);
    renderCharts(chartDataSet, mediaPorCargo, distCounts);
    renderRanking(chartDataSet);
  }
}

function setFilter(key, val){ state.filters[key]=val || undefined; renderDashboardBody(); }
function clearFilters(){ state.filters = {}; renderDashboardBody(); }

/* ---------- MATRIZ 9 BOX ---------- */
const POT_ROWS = ['Alto','Médio','Baixo']; // topo->base
const DES_COLS = ['Abaixo do esperado','Dentro do esperado','Acima do esperado'];
const DES_COLS_CURTO = {'Abaixo do esperado':'Abaixo','Dentro do esperado':'Esperado','Acima do esperado':'Acima'};
function renderBox9(quadrantes){
  const grid = document.getElementById('box9grid');
  if(!grid) return;
  grid.innerHTML = '';
  // canto vazio + rótulos de coluna (desempenho)
  grid.appendChild(el(`<div class="box9-corner"></div>`));
  DES_COLS.forEach(des=> grid.appendChild(el(`<div class="box9-collabel">${DES_COLS_CURTO[des]}</div>`)));
  POT_ROWS.forEach(pot=>{
    grid.appendChild(el(`<div class="box9-rowlabel">${pot}</div>`));
    DES_COLS.forEach(des=>{
      const key = pot+'|'+des;
      const q = QUADRANTES[key];
      const people = quadrantes.filter(p=> p.potClass===pot && p.perf.classificacaoDesempenho===des);
      const cell = document.createElement('div');
      cell.className='box9-cell';
      cell.style.background = q.cor+'26';
      cell.style.color = q.cor;
      cell.title = `${q.nome} — Desempenho: ${des} · Potencial: ${pot}\n${QUADRANTE_DESC[q.nome]||''}`;
      cell.innerHTML = `<div class="cell-label">${q.nome}</div><div class="box9-dots">${people.map(p=>`<div class="dot-person" style="background:${q.cor}" data-nome="${escapeHtml(p.nome)}" title="${p.nome} — ${q.nome} (Desempenho ${p.perf.notaFinal.toFixed(1)}, Potencial ${p.potClass}${p.pot?'':' — ainda não avaliado'})" onclick="showPerson('${p.nome.replace(/'/g,"")}')">${p.nome.slice(0,2).toUpperCase()}</div>`).join('')}</div>`;
      grid.appendChild(cell);
    });
  });
}

function showPerson(nome){
  if(!state.admin){ negarAcesso('Apenas a Consultoria/Administração pode visualizar o detalhe de outro colaborador.'); return; }
  const all = state.cache.avaliacoes;
  const filtered = applyFilters(all);
  const filteredGestorOnly = filtered.filter(r=>(r.tipo||'gestor')==='gestor');
  const quadrantes = computeQuadrantes(filteredGestorOnly, state.cache.potenciais);
  const p = quadrantes.find(q=>q.nome===nome);
  const panel = document.getElementById('person-detail');
  if(!p || !panel) return;
  const comps = [...p.perf.competenciasOrg, ...p.perf.competenciasComp, ...p.perf.competenciasTec].sort((a,b)=>b.media-a.media);
  const fortes = comps.slice(0,3);
  const dev = comps.slice(-3).reverse();
  const consolidado = consolidarColaborador(nome, all);
  let gapHtml = '';
  if(consolidado.auto && consolidado.gestor){
    const maiores = maioresGaps(consolidado.gaps, 4);
    gapHtml = `
    <div class="review-sec" style="margin-top:14px;">
      <h4>Autoavaliação × Avaliação do Gestor</h4>
      <div class="review-item"><span class="q">Nota autoavaliação</span><span class="a">${consolidado.auto.notaFinal.toFixed(1)}</span></div>
      <div class="review-item"><span class="q">Nota do gestor</span><span class="a">${consolidado.gestor.notaFinal.toFixed(1)}</span></div>
      <div class="review-item"><span class="q" style="font-weight:800;">Nota consolidada</span><span class="a" style="font-size:15px;">${consolidado.notaConsolidada.toFixed(1)}</span></div>
      <h4 style="margin-top:14px;">Maiores gaps de percepção</h4>
      ${maiores.map(g=>`<div class="review-item"><span class="q">${g.nome}</span><span class="a" style="color:${Math.abs(g.gap)>=2?'var(--danger)':'var(--gray)'};">${g.gap>0?'+':''}${g.gap} (gestor ${g.notaGestor.toFixed(1)} vs auto ${g.notaAuto.toFixed(1)})</span></div>`).join('')}
      ${consolidado.gestor.comentario?`<p class="hint" style="margin-top:8px;"><b>Comentário do gestor:</b> ${escapeHtml(consolidado.gestor.comentario)}</p>`:''}
      ${consolidado.auto.comentario?`<p class="hint"><b>Comentário do colaborador:</b> ${escapeHtml(consolidado.auto.comentario)}</p>`:''}
    </div>`;
  } else {
    gapHtml = `<div class="hint" style="margin-top:14px;">${consolidado.auto ? 'Ainda sem avaliação do gestor para comparar.' : 'Colaborador ainda não realizou a autoavaliação — comparação de gaps indisponível.'}</div>`;
  }
  panel.innerHTML = `
  <div class="person-panel">
    <h3>${p.nome} <span class="badge-role">${p.cargo}</span></h3>
    <div class="meta">Última avaliação: ${new Date(p.perf.timestamp).toLocaleDateString('pt-BR')} · Avaliador: ${p.perf.avaliador}</div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px;">
      <span class="badge" style="background:var(--navy);color:#fff;">Desempenho: ${p.perf.notaFinal.toFixed(1)} (${p.perf.classificacaoDesempenho})</span>
      <span class="badge" style="background:${p.cor};color:#fff;">Potencial: ${p.potClass}${p.pot?'':' (não avaliado ainda)'}</span>
      <span class="badge" style="background:var(--yellow);color:var(--navy);">Quadrante: ${p.quadrante}</span>
    </div>
    <p style="font-size:13.5px;color:var(--navy);background:var(--bg);padding:12px 14px;border-radius:10px;">${QUADRANTE_DESC[p.quadrante]||''}</p>
    <div class="grid-2" style="margin-top:14px;">
      <div>
        <h4 style="font-size:12.5px;text-transform:uppercase;color:var(--ok);margin-bottom:8px;">Competências fortes</h4>
        ${fortes.map(c=>`<div class="review-item"><span class="q">${c.nome}</span><span class="a tag-strong badge">${(c.media*10).toFixed(1)}</span></div>`).join('')}
      </div>
      <div>
        <h4 style="font-size:12.5px;text-transform:uppercase;color:var(--danger);margin-bottom:8px;">Oportunidades de desenvolvimento</h4>
        ${dev.map(c=>`<div class="review-item"><span class="q">${c.nome}</span><span class="a tag-dev badge">${(c.media*10).toFixed(1)}</span></div>`).join('')}
      </div>
    </div>
    ${gapHtml}
    <div class="export-row" style="margin-top:16px;">
      <button class="btn btn-primary btn-sm" onclick="go('pdi-editor',{pdiTarget:'${p.nome.replace(/'/g,"")}', pdiReturn:'dashboard'})">📋 Ver/editar PDI</button>
      <button class="btn btn-ghost btn-sm" onclick="printAvaliacaoIndividual('${p.nome.replace(/'/g,"")}')">🖨 Imprimir avaliação individual</button>
    </div>
  </div>`;
  panel.scrollIntoView({behavior:'smooth', block:'center'});
}

/* ---------- GRÁFICOS ---------- */
function destroyChart(key){ if(chartRefs[key]){ chartRefs[key].destroy(); delete chartRefs[key]; } }
function chartPalette(){ return ['#0F2A47','#C98A96','#F5C518','#6B7280','#3E8E63','#4C86C9']; }

function renderCharts(filtered, mediaPorCargo, distCounts){
  ['chartDist','chartDistPct','chartForca','chartCargo','chartTipo'].forEach(destroyChart);
  const ctxDist = document.getElementById('chartDist');
  if(ctxDist){
    chartRefs.chartDist = new Chart(ctxDist, { type:'bar', data:{
      labels:Object.keys(distCounts),
      datasets:[{ data:Object.values(distCounts), backgroundColor:['#B23A48','#F5C518','#3E8E63'], borderRadius:8 }]
    }, options:{ plugins:{legend:{display:false}}, scales:{y:{beginAtZero:true,ticks:{precision:0}}} }});
  }
  const ctxPct = document.getElementById('chartDistPct');
  if(ctxPct){
    const total = Object.values(distCounts).reduce((a,b)=>a+b,0)||1;
    chartRefs.chartDistPct = new Chart(ctxPct, { type:'doughnut', data:{
      labels:Object.keys(distCounts).map(k=>`${k} (${Math.round(distCounts[k]/total*100)}%)`),
      datasets:[{ data:Object.values(distCounts), backgroundColor:['#B23A48','#F5C518','#3E8E63'] }]
    }, options:{ plugins:{legend:{position:'bottom', labels:{font:{size:10.5}}}} }});
  }
  // força dos critérios: agrega todas competências (org+comp+tec) por nome
  const compAgg = {};
  filtered.forEach(r=>{
    [...r.competenciasOrg, ...r.competenciasComp, ...r.competenciasTec].forEach(c=>{
      if(!compAgg[c.nome]) compAgg[c.nome]=[];
      compAgg[c.nome].push(c.media*10);
    });
  });
  const compNames = Object.keys(compAgg).sort((a,b)=> media(compAgg[b])-media(compAgg[a]));
  const ctxForca = document.getElementById('chartForca');
  if(ctxForca){
    chartRefs.chartForca = new Chart(ctxForca, { type:'bar', data:{
      labels:compNames,
      datasets:[{ label:'Média (0-10)', data:compNames.map(n=>media(compAgg[n])), backgroundColor:compNames.map(n=> media(compAgg[n])>=8?'#3E8E63':media(compAgg[n])>=6?'#F5C518':'#B23A48'), borderRadius:6 }]
    }, options:{ indexAxis:'y', plugins:{legend:{display:false}}, scales:{x:{beginAtZero:true,max:10}} }});
  }
  const ctxCargo = document.getElementById('chartCargo');
  if(ctxCargo){
    const cargos = Object.keys(mediaPorCargo);
    chartRefs.chartCargo = new Chart(ctxCargo, { type:'bar', data:{
      labels:cargos, datasets:[{ label:'Média de desempenho', data:cargos.map(c=>mediaPorCargo[c]||0), backgroundColor:'#0F2A47', borderRadius:8 }]
    }, options:{ plugins:{legend:{display:false}}, scales:{y:{beginAtZero:true,max:10}} }});
  }
  const ctxTipo = document.getElementById('chartTipo');
  if(ctxTipo){
    chartRefs.chartTipo = new Chart(ctxTipo, { type:'bar', data:{
      labels:['Organizacionais','Comportamentais','Técnicas'],
      datasets:[{ data:[media(filtered.map(r=>r.notaOrg)), media(filtered.map(r=>r.notaComp)), media(filtered.map(r=>r.notaTec))], backgroundColor:['#C98A96','#0F2A47','#F5C518'], borderRadius:8 }]
    }, options:{ plugins:{legend:{display:false}}, scales:{y:{beginAtZero:true,max:10}} }});
  }
}

function renderRanking(filtered){
  const box = document.getElementById('rankingBox');
  if(!box) return;
  const latest = Object.values(latestByAvaliado(filtered)).sort((a,b)=>b.notaFinal-a.notaFinal);
  box.innerHTML = latest.length ? latest.map(r=>`
    <div class="rank-bar-row">
      <div class="rname">${r.avaliado}</div>
      <div class="rank-bar-track"><div class="rank-bar-fill" style="width:${r.notaFinal*10}%"></div></div>
      <div class="rank-bar-val">${r.notaFinal.toFixed(1)}</div>
    </div>`).join('') : '<p class="hint">Sem dados para os filtros selecionados.</p>';
}

/* ---------- EXPORTAÇÃO ---------- */
function csvEscape(v){ v=String(v??''); if(/[",\n;]/.test(v)) return '"'+v.replace(/"/g,'""')+'"'; return v; }
function downloadBlob(content, filename, type){
  const blob = new Blob([content], {type});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download=filename; a.click();
  URL.revokeObjectURL(url);
}
function respostasRows(){
  const rows = [['ID Avaliação','Data','Origem','Avaliado','Cargo Avaliado','Avaliador','Cargo Avaliador','Relação','Período','Tipo Competência','Competência','Pergunta (índice)','Nota (0-5)','Peso/Nível Requerido','Pontuação Ponderada']];
  const all = applyFilters(state.cache.avaliacoes);
  all.forEach(r=>{
    const origem = r.demo===true ? 'Demonstração' : 'Real';
    const role = CARGO_DATA[r.roleKey];
    role.organizacionais.forEach((c,ci)=> c.perguntas.forEach((q,qi)=>{
      const nota = r.respostas.org[ci][qi];
      rows.push([r.id,r.timestamp,origem,r.avaliado,r.cargoAvaliado,r.avaliador,r.cargoAvaliador2,r.relacao,r.periodo,'Organizacional',c.nome,qi+1,nota,NIVEL_REQUERIDO,(desempenhoPergunta(nota)*10).toFixed(2)]);
    }));
    ['grupo1','grupo2','grupo3','grupo4'].forEach(gk=> role.comportamentais[gk].forEach((c,ci)=> c.perguntas.forEach((q,qi)=>{
      const nota = r.respostas.comp[gk][ci][qi];
      rows.push([r.id,r.timestamp,origem,r.avaliado,r.cargoAvaliado,r.avaliador,r.cargoAvaliador2,r.relacao,r.periodo,'Comportamental',c.nome,qi+1,nota,NIVEL_REQUERIDO,(desempenhoPergunta(nota)*10).toFixed(2)]);
    })));
    role.tecnicas.perguntas.forEach((q,qi)=>{
      const nota = r.respostas.tec[qi];
      rows.push([r.id,r.timestamp,origem,r.avaliado,r.cargoAvaliado,r.avaliador,r.cargoAvaliador2,r.relacao,r.periodo,'Técnica',role.tecnicas.nome,qi+1,nota,NIVEL_REQUERIDO,(desempenhoPergunta(nota)*10).toFixed(2)]);
    });
  });
  return rows;
}
function consolidadoRows(){
  const rows = [['ID','Data','Origem','Avaliado','Cargo','Avaliador','Tipo','Relação','Período','Nota Organizacionais','Nota Comportamentais','Nota Técnicas','Nota Final','Classificação Desempenho']];
  applyFilters(state.cache.avaliacoes).forEach(r=> rows.push([r.id,r.timestamp,r.demo===true?'Demonstração':'Real',r.avaliado,r.cargoAvaliado,r.avaliador,(r.tipo||'gestor')==='auto'?'Autoavaliação':'Gestor',r.relacao,r.periodo,r.notaOrg.toFixed(2),r.notaComp.toFixed(2),r.notaTec.toFixed(2),r.notaFinal.toFixed(2),r.classificacaoDesempenho]));
  return rows;
}
function matriz9BoxRows(){
  const filtered = applyFilters(state.cache.avaliacoes).filter(r=>(r.tipo||'gestor')==='gestor');
  const q = computeQuadrantes(filtered, state.cache.potenciais);
  const rows = [['Colaborador','Cargo','Origem','Nota Desempenho','Classificação Desempenho','Potencial','Quadrante 9 Box']];
  q.forEach(p=> rows.push([p.nome,p.cargo,p.perf.demo===true?'Demonstração':'Real',p.perf.notaFinal.toFixed(2),p.perf.classificacaoDesempenho,p.potClass,p.quadrante]));
  return rows;
}
function toCSV(rows){ return rows.map(r=>r.map(csvEscape).join(',')).join('\n'); }
function exportRespostasCSV(){ downloadBlob(toCSV(respostasRows()),'respostas_avaliacao.csv','text/csv;charset=utf-8'); }
function exportConsolidadoCSV(){ downloadBlob(toCSV(consolidadoRows()),'resultados_consolidados.csv','text/csv;charset=utf-8'); }
function exportMatriz9BoxCSV(){ downloadBlob(toCSV(matriz9BoxRows()),'matriz_9box.csv','text/csv;charset=utf-8'); }
function exportXLSX(){
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(consolidadoRows()), 'Consolidado');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(respostasRows()), 'Respostas');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(matriz9BoxRows()), 'Matriz 9 Box');
  XLSX.writeFile(wb, 'avaliacao_desempenho.xlsx');
}
function exportRelatorioPDF(){
  const filtered = applyFilters(state.cache.avaliacoes);
  const q = computeQuadrantes(filtered.filter(r=>(r.tipo||'gestor')==='gestor'), state.cache.potenciais);
  const w = window.open('', '_blank');
  w.document.write(`<html><head><title>Relatório de Avaliação de Desempenho</title>
  <style>body{font-family:Arial,sans-serif;padding:30px;color:#0F2A47;} h1{color:#0F2A47;} table{width:100%;border-collapse:collapse;margin-top:14px;} th,td{border:1px solid #ccc;padding:6px 8px;font-size:12px;text-align:left;} th{background:#f0f0f0;}</style>
  </head><body>
  <h1>Relatório de Avaliação de Desempenho</h1>
  <p>Gerado em ${new Date().toLocaleString('pt-BR')}</p>
  <table><thead><tr>${consolidadoRows()[0].map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>
  ${consolidadoRows().slice(1).map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}
  </tbody></table>
  <h2>Matriz 9 Box</h2>
  <table><thead><tr>${matriz9BoxRows()[0].map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>
  ${matriz9BoxRows().slice(1).map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}
  </tbody></table>
  </body></html>`);
  w.document.close();
  setTimeout(()=>w.print(), 400);
}

/* =========================================================
   IMPRESSÃO — avaliação individual e PDI
   ========================================================= */
const PRINT_STYLE = `body{font-family:Arial,sans-serif;padding:30px;color:#0F2A47;max-width:900px;margin:0 auto;}
  h1{color:#0F2A47;font-size:22px;} h2{font-size:16px;margin-top:24px;border-bottom:2px solid #0F2A47;padding-bottom:4px;}
  table{width:100%;border-collapse:collapse;margin-top:10px;} th,td{border:1px solid #ccc;padding:6px 8px;font-size:12px;text-align:left;}
  th{background:#f0f0f0;} .meta{color:#555;font-size:12.5px;margin-bottom:14px;} .badge{display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;background:#eee;margin-right:6px;}`;

function printAvaliacaoIndividual(nome){
  if(!podeVerDadosDe(nome)){ negarAcesso('Você não tem permissão para imprimir a avaliação deste colaborador.'); return; }
  const all = state.cache.avaliacoes;
  const consolidado = consolidarColaborador(nome, all);
  const pot = latestByAvaliado(state.cache.potenciais)[nome];
  const g = consolidado.gestor, a = consolidado.auto;
  const compRows = (rec) => rec ? [...rec.competenciasOrg, ...rec.competenciasComp, ...rec.competenciasTec]
    .map(c=>`<tr><td>${c.nome}</td><td>${(c.media*10).toFixed(1)}</td></tr>`).join('') : '<tr><td colspan="2">Não realizada</td></tr>';
  const w = window.open('', '_blank');
  w.document.write(`<html><head><title>Avaliação Individual — ${nome}</title><style>${PRINT_STYLE}</style></head><body>
  <h1>Avaliação de Desempenho Individual</h1>
  <div class="meta">Colaborador: <b>${nome}</b> · Cargo: ${CARGO_POR_COLABORADOR[nome]||''} · Gerado em ${new Date().toLocaleString('pt-BR')}</div>
  <div>
    ${g?`<span class="badge">Nota Gestor: ${g.notaFinal.toFixed(1)} (${g.classificacaoDesempenho})</span>`:''}
    ${a?`<span class="badge">Nota Autoavaliação: ${a.notaFinal.toFixed(1)}</span>`:''}
    ${consolidado.notaConsolidada!==null?`<span class="badge">Nota Consolidada: ${consolidado.notaConsolidada.toFixed(1)}</span>`:''}
    ${pot?`<span class="badge">Potencial: ${pot.classificacaoPotencial}</span>`:''}
  </div>
  <h2>Avaliação do Gestor por competência</h2>
  <table><thead><tr><th>Competência</th><th>Nota (0-10)</th></tr></thead><tbody>${compRows(g)}</tbody></table>
  <h2>Autoavaliação por competência</h2>
  <table><thead><tr><th>Competência</th><th>Nota (0-10)</th></tr></thead><tbody>${compRows(a)}</tbody></table>
  ${consolidado.gaps.length? `<h2>Gaps de percepção (Gestor − Autoavaliação)</h2>
  <table><thead><tr><th>Competência</th><th>Gestor</th><th>Auto</th><th>Gap</th></tr></thead><tbody>
  ${consolidado.gaps.map(gp=>`<tr><td>${gp.nome}</td><td>${gp.notaGestor.toFixed(1)}</td><td>${gp.notaAuto!==null?gp.notaAuto.toFixed(1):'-'}</td><td>${gp.gap!==null?gp.gap:'-'}</td></tr>`).join('')}
  </tbody></table>` : ''}
  ${g&&g.comentario? `<h2>Comentários do gestor</h2><p>${escapeHtml(g.comentario)}</p>`:''}
  ${a&&a.comentario? `<h2>Comentários do colaborador</h2><p>${escapeHtml(a.comentario)}</p>`:''}
  </body></html>`);
  w.document.close();
  setTimeout(()=>w.print(), 400);
}

function printPDI(nome){
  if(!podeVerDadosDe(nome)){ negarAcesso('Você não tem permissão para imprimir o PDI deste colaborador.'); return; }
  const pdi = state.cache.pdis.find(p=>p.nome===nome);
  const w = window.open('', '_blank');
  w.document.write(`<html><head><title>PDI — ${nome}</title><style>${PRINT_STYLE}</style></head><body>
  <h1>Plano de Desenvolvimento Individual (PDI)</h1>
  <div class="meta">Colaborador: <b>${nome}</b> · Cargo: ${CARGO_POR_COLABORADOR[nome]||''} · Gerado em ${new Date().toLocaleString('pt-BR')}</div>
  <table><thead><tr><th>Competência</th><th>Ação de desenvolvimento</th><th>Prazo</th><th>Responsável</th><th>Status</th></tr></thead><tbody>
  ${(pdi&&pdi.itens.length) ? pdi.itens.map(it=>`<tr><td>${escapeHtml(it.competencia)}</td><td>${escapeHtml(it.acao)}</td><td>${escapeHtml(it.prazo)}</td><td>${escapeHtml(it.responsavel)}</td><td>${escapeHtml(it.status)}</td></tr>`).join('') : '<tr><td colspan="5">Nenhum item cadastrado ainda.</td></tr>'}
  </tbody></table>
  </body></html>`);
  w.document.close();
  setTimeout(()=>w.print(), 400);
}

/* =========================================================
   ÁREA DO COLABORADOR (autoavaliação obrigatória)
   ========================================================= */
function ViewColabHomeLoading(){ return `<div class="empty-state"><div class="big">⏳</div>Carregando sua área...</div>`; }
async function initColabHome(){
  const nome = state.session.nome;
  if(Object.keys(CARGO_DATA).length === 0) await carregarCargos();
  // O backend já devolve SOMENTE os dados deste colaborador para uma sessão
  // do tipo "colaborador" (verificado no servidor a cada requisição — ver
  // GET /avaliacoes em app/routers/avaliacoes.py). Não há filtro a fazer aqui.
  const [avaliacoes, potenciais, pdis] = await Promise.all([
    listAvaliacoes(), listPotenciais(), listPdis([nome]),
  ]);
  state.cache.avaliacoes = avaliacoes;
  state.cache.potenciais = potenciais;
  state.cache.pdis = pdis;
  renderColabHome();
}
function renderColabHome(){
  const nome = state.session.nome;
  const cargo = CARGO_POR_COLABORADOR[nome];
  const consolidado = consolidarColaborador(nome, state.cache.avaliacoes);
  const pdi = state.cache.pdis.find(p=>p.nome===nome);
  const app = document.getElementById('app');
  let gapBlock = '';
  if(consolidado.auto && consolidado.gestor){
    const maiores = maioresGaps(consolidado.gaps, 5);
    gapBlock = `
    <div class="chart-card">
      <h3>Sua autoavaliação × avaliação do seu gestor</h3>
      <div class="sub">Nota consolidada: <b>${consolidado.notaConsolidada.toFixed(1)}</b> (média entre autoavaliação e avaliação do gestor)</div>
      <div class="review-item"><span class="q">Nota que você deu a si mesmo</span><span class="a">${consolidado.auto.notaFinal.toFixed(1)}</span></div>
      <div class="review-item"><span class="q">Nota do seu gestor</span><span class="a">${consolidado.gestor.notaFinal.toFixed(1)} (${consolidado.gestor.classificacaoDesempenho})</span></div>
      <h4 style="margin-top:12px;font-size:12.5px;text-transform:uppercase;color:var(--gray);">Maiores diferenças de percepção</h4>
      ${maiores.map(g=>`<div class="review-item"><span class="q">${g.nome}</span><span class="a">${g.gap>0?'+':''}${g.gap}</span></div>`).join('')}
      ${consolidado.gestor.comentario?`<p class="hint" style="margin-top:8px;"><b>Comentário do gestor:</b> ${escapeHtml(consolidado.gestor.comentario)}</p>`:''}
    </div>`;
  } else if(consolidado.auto && !consolidado.gestor){
    gapBlock = `<div class="disclosure">Sua autoavaliação foi registrada. Assim que seu gestor concluir a avaliação, a comparação de gaps aparecerá aqui.</div>`;
  } else {
    gapBlock = `<div class="disclosure">Você ainda não fez sua autoavaliação neste ciclo. Ela é <b>obrigatória</b> — clique no botão abaixo para começar.</div>`;
  }
  app.innerHTML = Topbar() + `
    <h2>Minha área — ${nome} <span class="badge-role">${cargo}</span></h2>
    <p style="color:var(--gray);font-size:13.5px;margin:8px 0 20px;">Aqui você realiza sua autoavaliação obrigatória e acompanha como ela se compara à avaliação do seu gestor.</p>
    <div class="export-row" style="margin-bottom:20px;">
      <button class="btn btn-accent" onclick="startAutoAvaliacao()">${consolidado.auto? '🔁 Refazer autoavaliação (novo ciclo)' : '📝 Fazer minha autoavaliação (obrigatória)'}</button>
      ${consolidado.gestor? `<button class="btn btn-ghost btn-sm" onclick="printAvaliacaoIndividual('${nome}')">🖨 Imprimir minha avaliação</button>`:''}
    </div>
    ${gapBlock}
    <div class="section-title"><span class="dot"></span>Meu Plano de Desenvolvimento Individual (PDI)</div>
    <div class="card">
      ${(pdi && pdi.itens.length) ? `<table class="data-table"><thead><tr><th>Competência</th><th>Ação</th><th>Prazo</th><th>Responsável</th><th>Status</th></tr></thead><tbody>
        ${pdi.itens.map(it=>`<tr><td>${escapeHtml(it.competencia)}</td><td>${escapeHtml(it.acao)}</td><td>${escapeHtml(it.prazo)}</td><td>${escapeHtml(it.responsavel)}</td><td>${escapeHtml(it.status)}</td></tr>`).join('')}
      </tbody></table>` : `<p class="hint">Seu gestor ainda não registrou um PDI para você.</p>`}
    </div>
  `;
}

/* =========================================================
   ÁREA DO GESTOR (avaliar equipe + acompanhar gaps)
   ========================================================= */
function ViewGestorHomeLoading(){ return `<div class="empty-state"><div class="big">⏳</div>Carregando sua equipe...</div>`; }
async function initGestorHome(){
  const nome = state.session.nome;
  if(Object.keys(CARGO_DATA).length === 0) await carregarCargos();
  if(MINHA_EQUIPE.length === 0) await carregarMinhaEquipe();
  // O backend já devolve apenas os dados da equipe deste gestor (verificado
  // no servidor via tabela vinculos_avaliacao a cada requisição).
  const [avaliacoes, potenciais, pdis] = await Promise.all([
    listAvaliacoes(), listPotenciais(), listPdis(MINHA_EQUIPE.map(t=>t.nome)),
  ]);
  state.cache.avaliacoes = avaliacoes;
  state.cache.potenciais = potenciais;
  state.cache.pdis = pdis;
  renderGestorHome();
}
function renderGestorHome(){
  const nome = state.session.nome;
  const cargoNome = CARGO_POR_COLABORADOR[nome] || '';
  const app = document.getElementById('app');
  const rows = MINHA_EQUIPE.map(t=>{
    const consolidado = consolidarColaborador(t.nome, state.cache.avaliacoes);
    const statusGestor = consolidado.gestor ? `<span class="badge tag-strong">Avaliado (${consolidado.gestor.notaFinal.toFixed(1)})</span>` : `<span class="badge tag-dev">Pendente</span>`;
    const statusAuto = consolidado.auto ? `<span class="badge tag-strong">Feita</span>` : `<span class="badge tag-dev">Pendente</span>`;
    return `<tr>
      <td><b>${t.nome}</b><div class="hint">${t.cargoTitulo}</div></td>
      <td>${statusAuto}</td>
      <td>${statusGestor}</td>
      <td>${consolidado.notaConsolidada!==null?consolidado.notaConsolidada.toFixed(1):'—'}</td>
      <td>
        <button class="btn btn-primary btn-sm" onclick="startGestorEval('${t.nome}')">${consolidado.gestor?'🔁 Reavaliar':'📝 Avaliar'}</button>
        <button class="btn btn-ghost btn-sm" onclick="go('pdi-editor',{pdiTarget:'${t.nome}', pdiReturn:'gestor-home'})">📋 PDI</button>
      </td>
    </tr>`;
  }).join('');
  app.innerHTML = Topbar() + `
    <h2>Minha equipe — ${nome} <span class="badge-role">${cargoNome}</span></h2>
    <p style="color:var(--gray);font-size:13.5px;margin:8px 0 20px;">Avalie cada colaborador, acompanhe pendências e monte planos de desenvolvimento.</p>
    <div class="card" style="overflow:auto;">
      <table class="data-table">
        <thead><tr><th>Colaborador</th><th>Autoavaliação</th><th>Avaliação do Gestor</th><th>Nota Consolidada</th><th>Ações</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

/* =========================================================
   EDITOR DE PDI (Plano de Desenvolvimento Individual)
   ========================================================= */
function ViewPdiEditorLoading(){ return `<div class="empty-state"><div class="big">⏳</div>Carregando PDI...</div>`; }
async function initPdiEditor(){
  const nome = state.pdiTarget;
  if(!podeVerDadosDe(nome)){
    negarAcesso('Você não tem permissão para acessar o PDI deste colaborador.');
    go(state.admin ? 'dashboard' : (state.session && state.session.role==='gestor' ? 'gestor-home' : 'landing'));
    return;
  }
  let pdi = await getPdi(nome);
  if(!pdi || !pdi.itens || pdi.itens.length === 0){
    // sugere itens iniciais com base nas competências de menor nota (avaliação do gestor mais recente)
    const avaliacoes = await listAvaliacoes();
    const gestorEval = latestByAvaliado(avaliacoes.filter(r=>r.avaliado===nome && (r.tipo||'gestor')==='gestor'))[nome];
    let sugestoes = [];
    if(gestorEval){
      const comps = [...gestorEval.competenciasOrg, ...gestorEval.competenciasComp, ...gestorEval.competenciasTec].sort((a,b)=>a.media-b.media);
      sugestoes = comps.slice(0,2).map(c=>({competencia:c.nome, acao:'', prazo:'', responsavel: gestorEval.avaliador, status:'Planejado'}));
    }
    pdi = { nome, itens: sugestoes, updatedAt: new Date().toISOString() };
  }
  state.pdiForm = pdi;
  renderPdiEditor();
}
function renderPdiEditor(){
  const pdi = state.pdiForm;
  const app = document.getElementById('app');
  // Edição permitida para: Consultoria/Administração (qualquer PDI), ou Gestor — mas
  // somente para colaboradores da própria equipe direta (nunca de outra equipe).
  const podeEditar = state.admin || (state.session && state.session.role==='gestor' && podeVerDadosDe(pdi.nome));
  app.innerHTML = Topbar() + `
    <div class="card">
      <h2>PDI — ${pdi.nome} <span class="badge-role">${CARGO_POR_COLABORADOR[pdi.nome]||''}</span></h2>
      <p style="color:var(--gray);font-size:13.5px;margin:8px 0 18px;">Plano de Desenvolvimento Individual. ${podeEditar?'Adicione ações de desenvolvimento vinculadas às competências com maior oportunidade de melhoria.':'Visualização somente leitura.'}</p>
      <div id="pdi-itens">${pdi.itens.map((it,i)=>PdiItemRow(it,i,podeEditar)).join('') || '<p class="hint">Nenhum item ainda.</p>'}</div>
      ${podeEditar? `<button class="btn btn-ghost btn-sm" style="margin-top:10px;" onclick="addPdiItem()">+ Adicionar item</button>` : ''}
      <div class="nav-buttons">
        <button class="btn btn-ghost" onclick="go(state.pdiReturn||'dashboard')">← Voltar</button>
        <div class="export-row">
          <button class="btn btn-ghost btn-sm" onclick="printPDI('${pdi.nome}')">🖨 Imprimir PDI</button>
          ${podeEditar? `<button class="btn btn-accent btn-sm" onclick="savePdiForm()">💾 Salvar PDI</button>` : ''}
        </div>
      </div>
    </div>`;
}
function PdiItemRow(it, i, editable){
  if(!editable){
    return `<div class="comp-block"><b>${escapeHtml(it.competencia)}</b><p class="hint">${escapeHtml(it.acao||'(sem ação definida)')} — Prazo: ${escapeHtml(it.prazo||'-')} · Responsável: ${escapeHtml(it.responsavel||'-')} · Status: ${escapeHtml(it.status||'-')}</p></div>`;
  }
  return `<div class="comp-block">
    <div class="field"><label class="field-label">Competência</label><input type="text" value="${escapeHtml(it.competencia)}" oninput="updatePdiItem(${i},'competencia',this.value)"/></div>
    <div class="field"><label class="field-label">Ação de desenvolvimento</label><input type="text" value="${escapeHtml(it.acao)}" oninput="updatePdiItem(${i},'acao',this.value)" placeholder="Ex.: Treinamento, mentoria, curso..."/></div>
    <div class="grid-3">
      <div class="field"><label class="field-label">Prazo</label><input type="text" value="${escapeHtml(it.prazo)}" oninput="updatePdiItem(${i},'prazo',this.value)" placeholder="Ex.: 90 dias"/></div>
      <div class="field"><label class="field-label">Responsável</label><input type="text" value="${escapeHtml(it.responsavel)}" oninput="updatePdiItem(${i},'responsavel',this.value)"/></div>
      <div class="field"><label class="field-label">Status</label><select oninput="updatePdiItem(${i},'status',this.value)">
        ${['Planejado','Em andamento','Concluído'].map(s=>`<option value="${s}" ${it.status===s?'selected':''}>${s}</option>`).join('')}
      </select></div>
    </div>
    <button class="btn btn-ghost btn-sm" onclick="removePdiItem(${i})">✕ Remover item</button>
  </div>`;
}
function addPdiItem(){ state.pdiForm.itens.push({competencia:'',acao:'',prazo:'',responsavel:'',status:'Planejado'}); renderPdiEditor(); }
function updatePdiItem(i,field,val){ state.pdiForm.itens[i][field]=val; }
function removePdiItem(i){ state.pdiForm.itens.splice(i,1); renderPdiEditor(); }
async function savePdiForm(){
  try{ await savePdi(state.pdiForm); showToast('PDI salvo com sucesso.','success'); }
  catch(e){ /* apiFetch já mostrou o toast de erro apropriado (inclusive 403 de permissão) */ }
}

/* =========================================================
   DADOS DE DEMONSTRAÇÃO (simulação completa preenchida)
   ========================================================= */
const DEMO_PERIODO = '2º Semestre 2026 (demo)';

function confirmSeedDemoData(){
  showConfirmModal(
    'Isso irá gerar avaliações fictícias (autoavaliação + gestor + potencial + PDI) para os colaboradores cadastrados, marcadas com a etiqueta 🧪 "demonstração". Você poderá removê-las depois, a qualquer momento, com o botão "Limpar apenas dados de demonstração" — sem afetar dados reais.',
    () => seedDemoData(),
    { title:'Carregar dados de demonstração', okLabel:'Carregar dados' }
  );
}
function confirmResetAllData(){
  showConfirmModal(
    'Isso apaga TODAS as avaliações, potenciais e PDIs salvos (inclusive dados reais, se houver). Esta ação não pode ser desfeita.',
    () => resetAllData(),
    { title:'Limpar todos os dados', okLabel:'Sim, apagar tudo', danger:true }
  );
}
function confirmCleanupDemoData(){
  showConfirmModal(
    'Atenção: esta ação removerá todos os dados de demonstração (avaliações, autoavaliações, potenciais e PDIs marcados como fictícios) e não poderá ser desfeita. Os dados reais preenchidos pelos colaboradores NÃO serão afetados. Deseja continuar?',
    () => cleanupDemoData(),
    { title:'Limpar dados de demonstração', okLabel:'Sim, limpar demonstração', danger:true }
  );
}

/* =========================================================
   DADOS DE DEMONSTRAÇÃO — agora gerados pelo BACKEND (endpoints
   /admin/seed-demo, /admin/cleanup-demo, /admin/reset-all), que
   já são genéricos o suficiente para qualquer organograma de
   cliente cadastrado no banco (ver app/routers/admin.py).
   ========================================================= */
async function seedDemoData(){
  showToast('Carregando dados de demonstração...', 'info');
  try{
    const resp = await apiFetch('/admin/seed-demo', { method:'POST' });
    showToast(resp.mensagem, 'success');
  }catch(e){ return; }
  await initDashboard();
}
async function cleanupDemoData(){
  try{
    const resp = await apiFetch('/admin/cleanup-demo', { method:'POST' });
    showToast(resp.mensagem, 'success');
  }catch(e){ return; }
  await initDashboard();
}
async function resetAllData(){
  try{
    const resp = await apiFetch('/admin/reset-all', { method:'POST' });
    showToast(resp.mensagem, 'success');
  }catch(e){ return; }
  await initDashboard();
}

/* =========================================================
   INICIALIZAÇÃO
   ========================================================= */
async function iniciarApp(){
  // Diretório público é necessário para montar as telas de login — carrega
  // sempre, mesmo antes de qualquer autenticação (é informação não sensível).
  render(); // mostra a landing imediatamente enquanto carrega em segundo plano
  await carregarDiretorioPublico();

  // Restaura sessão de uma recarga de página (o token continua válido no
  // backend até expirar — não precisamos derrubar o usuário a cada F5).
  const token = sessionStorage.getItem('cq_token');
  if(token){
    if(sessionStorage.getItem('cq_admin') === '1'){
      state.admin = true;
      await carregarCargos();
      go('dashboard');
    }else{
      const sess = sessionStorage.getItem('cq_session');
      if(sess){
        state.session = JSON.parse(sess);
        await carregarCargos();
        if(state.session.role === 'gestor'){ await carregarMinhaEquipe(); go('gestor-home'); }
        else { go('colab-home'); }
      }
    }
  }else{
    render();
  }
}
iniciarApp();
