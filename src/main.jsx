import React,{useEffect,useMemo,useState} from 'react';
import{createRoot}from'react-dom/client';
import{createClient}from'@supabase/supabase-js';
import{LayoutDashboard,MessagesSquare,Kanban,CalendarClock,Users,ChartNoAxesCombined,LogOut,Search,Send,RefreshCw,Menu,Plus,CheckCircle2}from'lucide-react';
import './style.css';
const url=import.meta.env.VITE_SUPABASE_URL,key=import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase=url&&key?createClient(url,key):null;
const STAGES=[['new','Novo lead'],['contacted','Contato iniciado'],['interested','Interessado'],['registered','Cadastrado'],['trial','Em teste'],['won','Pagante'],['lost','Perdido']];
function App(){
 const[session,setSession]=useState(null),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[authError,setAuthError]=useState(''),[tab,setTab]=useState('dashboard'),[leads,setLeads]=useState([]),[messages,setMessages]=useState([]),[fups,setFups]=useState([]),[subscriptions,setSubscriptions]=useState([]),[active,setActive]=useState(null),[query,setQuery]=useState(''),[draft,setDraft]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[newLead,setNewLead]=useState(false),[form,setForm]=useState({name:'',phone:''});
 useEffect(()=>{if(!supabase)return;supabase.auth.getSession().then(({data})=>setSession(data.session));const{data:{subscription}}=supabase.auth.onAuthStateChange((_evt,s)=>setSession(s));return()=>subscription.unsubscribe()},[]);
 async function refresh(){if(!session)return;const results=await Promise.all(['crm_leads','crm_messages','crm_followups','crm_subscriptions'].map(t=>supabase.from(t).select('*').order('created_at',{ascending:false}).limit(1000)));const bad=results.find(x=>x.error);if(bad){setError(bad.error.message);return}setError('');setLeads(results[0].data||[]);setMessages(results[1].data||[]);setFups(results[2].data||[]);setSubscriptions(results[3].data||[])}
 useEffect(()=>{if(!session)return;refresh();const channel=supabase.channel('crm-updates').on('postgres_changes',{event:'*',schema:'public',table:'crm_leads'},refresh).on('postgres_changes',{event:'*',schema:'public',table:'crm_messages'},refresh).on('postgres_changes',{event:'*',schema:'public',table:'crm_followups'},refresh).on('postgres_changes',{event:'*',schema:'public',table:'crm_subscriptions'},refresh).subscribe();return()=>supabase.removeChannel(channel)},[session]);
 const selected=leads.find(l=>l.id===active),conv=messages.filter(m=>m.lead_id===active).sort((a,b)=>new Date(a.sent_at)-new Date(b.sent_at));
 const registered=leads.filter(l=>l.registered_at),paidIds=new Set(subscriptions.filter(s=>s.status==='active'&&s.first_paid_at).map(s=>s.lead_id));const initiated=leads.filter(l=>l.first_contact_at);const paidLeads=leads.filter(l=>paidIds.has(l.id));
 const metrics=[['Conversas iniciadas',initiated.length],['Cadastros confirmados',registered.length],['Assinantes pagantes',paidLeads.length],['Conversão em assinantes',initiated.length?(paidLeads.length/initiated.length*100).toFixed(1).replace('.',',')+'%':'0%']];
 const filtered=leads.filter(l=>(l.name+' '+l.phone).toLowerCase().includes(query.toLowerCase()));
 async function patchLead(id,values){const{error:e}=await supabase.from('crm_leads').update(values).eq('id',id);if(e)alert(e.message);else refresh()}
 async function addFollowup(id){const date=prompt('Data e hora do próximo contato (AAAA-MM-DD HH:MM):');if(!date)return;const parsed=new Date(date.replace(' ','T'));if(Number.isNaN(parsed.getTime()))return alert('Data inválida');const{error:e}=await supabase.from('crm_followups').insert({lead_id:id,due_at:parsed.toISOString(),status:'pending',note:'Contato agendado manualmente'});if(e)alert(e.message);else refresh()}
 async function createLead(e){e.preventDefault();if(!form.name.trim()||!form.phone.trim())return;const{error:er}=await supabase.from('crm_leads').insert({name:form.name.trim(),phone:form.phone.replace(/\D/g,''),stage:'new',source:'manual'});if(er)alert(er.message);else{setForm({name:'',phone:''});setNewLead(false);refresh()}}
 async function markDone(id){const{error:e}=await supabase.from('crm_followups').update({status:'done',completed_at:new Date().toISOString()}).eq('id',id);if(e)alert(e.message);else refresh()}
 async function sendMessage(){if(!selected||!draft.trim()||busy)return;setBusy(true);const body=draft.trim();setDraft('');const{error:e}=await supabase.functions.invoke('crm-send-message',{body:{lead_id:selected.id,text:body}});setBusy(false);if(e){setDraft(body);alert('Não enviada: '+e.message)}else refresh()}
 if(!supabase)return <div className="login"><h1>LS CRM</h1><p>Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env para conectar.</p></div>;
 if(!session)return <div className="login"><form onSubmit={async e=>{e.preventDefault();setAuthError('');const{error:e2}=await supabase.auth.signInWithPassword({email,password});if(e2)setAuthError(e2.message)}}><h1>LS CRM</h1><p>Inteligência comercial do AutoPrime</p><input type="email" placeholder="E-mail" value={email} onChange={e=>setEmail(e.target.value)} required/><input type="password" placeholder="Senha" value={password} onChange={e=>setPassword(e.target.value)} required/><button>Entrar</button>{authError&&<p className="warn">{authError}</p>}</form></div>;
 const tabs=[['dashboard','Dashboard',LayoutDashboard],['conversas','Conversas',MessagesSquare],['funil','Funil de vendas',Kanban],['followups','Follow-ups',CalendarClock],['clientes','Assinantes',Users]];
 return <div className="app"><aside><div className="brand"><span className="brandicon">LS</span><div><b>LS CRM</b><small>Inteligência Comercial</small></div></div><div className="navigation">{tabs.map(([id,label,Icon])=><button key={id} onClick={()=>setTab(id)} className={tab===id?'on':''}><Icon size={19}/>{label}</button>)}</div><div className="asidebottom"><button onClick={()=>supabase.auth.signOut()}><LogOut size={18}/>Sair</button></div></aside><main><header><div><h1>{tabs.find(t=>t[0]===tab)?.[1]}</h1><p>AutoPrime · CRM conectado</p></div><div className="actions"><button className="secondary" onClick={refresh}><RefreshCw size={17}/>Atualizar</button><button onClick={()=>setNewLead(true)}><Plus size={17}/>Novo lead</button></div></header>{error&&<div className="warning">Falha ao carregar dados: {error}. Confira SQL, permissões e conexão.</div>}
 {tab==='dashboard'&&<><section className="metrics">{metrics.map(([label,value])=><div className="metric" key={label}><small>{label}</small><strong>{value}</strong></div>)}</section><div className="twocol"><section className="panel"><h2>Funil comercial</h2>{STAGES.map(([code,label])=>{const n=leads.filter(l=>l.stage===code).length;return <div className="funnelrow" key={code}><span>{label}</span><div className="track"><div style={{width:`${leads.length?n/leads.length*100:0}%`}}/></div><b>{n}</b></div>})}</section><section className="panel"><h2>Prioridades de hoje</h2><p className="muted">Contatos pendentes até agora</p>{fups.filter(f=>f.status==='pending'&&new Date(f.due_at)<=new Date()).slice(0,8).map(f=><div className="priority" key={f.id}><span>{leads.find(l=>l.id===f.lead_id)?.name||'Contato'}<small>{new Date(f.due_at).toLocaleString('pt-BR')}</small></span><button className="small secondary" onClick={()=>{setActive(f.lead_id);setTab('conversas')}}>Abrir</button></div>)}{!fups.some(f=>f.status==='pending'&&new Date(f.due_at)<=new Date())&&<p className="muted">Nenhum follow-up vencido.</p>}</section></div><section className="panel"><h2>Indicadores adicionais</h2><div className="metrics mini"><div><small>Conversão em cadastro</small><strong>{initiated.length?(registered.length/initiated.length*100).toFixed(1):0}%</strong></div><div><small>Cadastro → assinante</small><strong>{registered.length?(paidLeads.length/registered.length*100).toFixed(1):0}%</strong></div><div><small>Follow-ups pendentes</small><strong>{fups.filter(f=>f.status==='pending').length}</strong></div></div></section></>}
 {tab==='conversas'&&<section className="inbox ls-inbox-scroll"><div className="inboxleft"><div className="inboxsearch"><Search size={16}/><input placeholder="Buscar nome ou telefone" value={query} onChange={e=>setQuery(e.target.value)}/></div>{filtered.map(l=><button key={l.id} onClick={()=>setActive(l.id)} className={'contact '+(l.id===active?'selected':'')}><strong>{l.name||l.phone}</strong><small>{l.phone} · {STAGES.find(s=>s[0]===l.stage)?.[1]}</small></button>)}</div><div className="chat">{selected?<><div className="chatheader"><div><strong>{selected.name}</strong><small>{selected.phone}</small></div><select value={selected.stage} onChange={e=>patchLead(selected.id,{stage:e.target.value})}>{STAGES.map(([s,l])=><option key={s} value={s}>{l}</option>)}</select></div><div className="bubbles">{conv.map(m=><div key={m.id} className={'bubble '+(m.direction==='out'?'out':'in')}><span>{m.body||'[Mensagem sem texto / mídia]'}</span><small>{new Date(m.sent_at).toLocaleString('pt-BR')} · {m.status||'registrada'}</small></div>)}{!conv.length&&<p className="muted">Nenhuma mensagem registrada para este contato.</p>}</div><div className="compose"><input placeholder="Mensagem para o WhatsApp..." value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>e.key==='Enter'&&sendMessage()}/><button disabled={busy} onClick={sendMessage}><Send size={18}/></button></div></>:<div className="empty">Selecione um contato para ler as conversas.</div>}</div><div className="details">{selected&&<><h2>Detalhes do lead</h2><p><b>Origem</b><br/>{selected.source||'-'}</p><p><b>Cadastro</b><br/>{selected.registered_at?new Date(selected.registered_at).toLocaleDateString('pt-BR'):'Não confirmado'}</p><p><b>Responsável</b><br/>{selected.owner_name||'Manuella'}</p><label>Anotações</label><textarea defaultValue={selected.notes||''} key={selected.id} onBlur={e=>patchLead(selected.id,{notes:e.target.value})}/><button className="secondary" onClick={()=>addFollowup(selected.id)}>Agendar follow-up</button><button className="secondary" onClick={()=>patchLead(selected.id,{human_takeover:!selected.human_takeover})}>{selected.human_takeover?'Devolver à Manuella':'Assumir atendimento'}</button></>}</div></section>}
 {tab==='funil'&&<div className="kanban">{STAGES.map(([s,l])=><section className="kanbancol" key={s}><h3>{l} <span>{leads.filter(x=>x.stage===s).length}</span></h3>{leads.filter(x=>x.stage===s).map(x=><article key={x.id}><b>{x.name||x.phone}</b><small>{x.phone}</small><select value={x.stage} onChange={e=>patchLead(x.id,{stage:e.target.value})}>{STAGES.map(([code,label])=><option key={code} value={code}>{label}</option>)}</select><button className="small secondary" onClick={()=>{setActive(x.id);setTab('conversas')}}>Ver conversa</button></article>)}</section>)}</div>}
 {tab==='followups'&&<section className="panel"><h2>Agenda de follow-ups</h2><table><thead><tr><th>Contato</th><th>Data</th><th>Observação</th><th>Status</th><th>Ação</th></tr></thead><tbody>{fups.sort((a,b)=>new Date(a.due_at)-new Date(b.due_at)).map(f=><tr key={f.id}><td>{leads.find(l=>l.id===f.lead_id)?.name||'Contato'}</td><td>{new Date(f.due_at).toLocaleString('pt-BR')}</td><td>{f.note}</td><td>{f.status==='done'?'Concluído':new Date(f.due_at)<new Date()?'Atrasado':'Pendente'}</td><td>{f.status!=='done'&&<button className="small" onClick={()=>markDone(f.id)}><CheckCircle2 size={15}/>Concluir</button>}</td></tr>)}</tbody></table></section>}
 {tab==='clientes'&&<section className="panel"><h2>Assinaturas e pagamentos</h2><table><thead><tr><th>Cliente</th><th>Plano</th><th>Status</th><th>Primeiro pagamento</th><th>Valor mensal</th></tr></thead><tbody>{subscriptions.map(s=><tr key={s.id}><td>{leads.find(l=>l.id===s.lead_id)?.name||s.asaas_customer_id||'-'}</td><td>{s.plan_name||'-'}</td><td><span className="pill">{s.status}</span></td><td>{s.first_paid_at?new Date(s.first_paid_at).toLocaleDateString('pt-BR'):'Aguardando'}</td><td>{s.amount!=null?Number(s.amount).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):'-'}</td></tr>)}</tbody></table>{!subscriptions.length&&<p className="muted">As assinaturas aparecerão aqui após a integração do Asaas.</p>}</section>}</main>
 {newLead&&<div className="overlay"><form className="modal" onSubmit={createLead}><h2>Novo lead</h2><label>Nome</label><input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/><label>WhatsApp com DDD</label><input required value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/><div className="actions"><button type="button" className="secondary" onClick={()=>setNewLead(false)}>Cancelar</button><button>Salvar</button></div></form></div>}</div>;
}
createRoot(document.getElementById('root')).render(<App/>);
/* Corrigir rolagem das conversas */
.inbox.ls-inbox-scroll {
  height: calc(100dvh - 195px) !important;
  min-height: 400px;
  overflow: hidden !important;
}

.inbox.ls-inbox-scroll .chat {
  min-height: 0 !important;
  overflow: hidden !important;
}

.inbox.ls-inbox-scroll .bubbles {
  flex: 1 1 0 !important;
  height: 0 !important;
  min-height: 0 !important;
  overflow-y: scroll !important;
  scrollbar-width: auto !important;
  scrollbar-color: #64748b #e2e8f0 !important;
}

.inbox.ls-inbox-scroll .bubbles::-webkit-scrollbar {
  width: 12px;
}

.inbox.ls-inbox-scroll .bubbles::-webkit-scrollbar-thumb {
  background: #64748b;
  border-radius: 10px;
}

.inbox.ls-inbox-scroll .bubbles::-webkit-scrollbar-track {
  background: #e2e8f0;
}

@media (max-width: 900px) {
  .inbox.ls-inbox-scroll {
    height: auto !important;
  }

  .inbox.ls-inbox-scroll .chat {
    height: 65dvh !important;
  }
}
