import {useEffect,useState} from 'react';
import {Layers3,LayoutDashboard,FileText,ReceiptText,Users,Package,Wallet,ChartNoAxesCombined,Settings,Sun,Moon,Plus,Search,Download,Trash2,X,Menu,ArrowUpRight,Check,Clock3,CircleDollarSign} from 'lucide-react';
const initialClients=[{id:1,name:'Thabo Mokoena',company:'Mokoena Electrical',email:'thabo@example.co.za',phone:'071 234 5678'},{id:2,name:'Naledi Projects',company:'Naledi Projects (Pty) Ltd',email:'accounts@example.co.za',phone:'082 555 0142'},{id:3,name:'Lerato Design Studio',company:'Lerato Design Studio',email:'hello@example.co.za',phone:'079 111 2233'}];
const initialDocs=[{id:'Q-2026-001',kind:'Quote',client:'Mokoena Electrical',date:'2026-10-24',amount:12500,status:'Sent'},{id:'INV-2026-014',kind:'Invoice',client:'Naledi Projects (Pty) Ltd',date:'2026-10-22',amount:8750,status:'Paid'},{id:'INV-2026-013',kind:'Invoice',client:'Lerato Design Studio',date:'2026-10-20',amount:4200,status:'Overdue'},{id:'Q-2026-002',kind:'Quote',client:'Mokoena Electrical',date:'2026-10-18',amount:18600,status:'Draft'}];
const money=n=>new Intl.NumberFormat('en-ZA',{style:'currency',currency:'ZAR',maximumFractionDigits:0}).format(n);
const read=(k,f)=>{try{return JSON.parse(localStorage.getItem(k))||f}catch{return f}};
const nav=[['Dashboard',LayoutDashboard],['Quotes',FileText],['Invoices',ReceiptText],['Clients',Users],['Products & services',Package],['Payments',Wallet],['Reports',ChartNoAxesCombined],['Settings',Settings]];
export default function App(){
const [user,setUser]=useState(null);
const [authLoading,setAuthLoading]=useState(true);
const [authMode,setAuthMode]=useState('login');
const [authError,setAuthError]=useState('');
const [authBusy,setAuthBusy]=useState(false);

const[theme,setTheme]=useState(()=>localStorage.getItem('afs-theme')|| (matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'));
const[active,setActive]=useState('Dashboard'),[clients,setClients]=useState([]),[docs,setDocs]=useState([]),[products,setProducts]=useState([]);
const[q,setQ]=useState(''),[modal,setModal]=useState(''),[toast,setToast]=useState(''),[mobile,setMobile]=useState(false);const[clientsLoading,setClientsLoading]=useState(true),[clientError,setClientError]=useState('');
useEffect(()=>{document.documentElement.dataset.theme=theme;localStorage.setItem('afs-theme',theme)},[theme]);
useEffect(()=>{
 let cancelled=false;
 async function checkSession(){
  try{
   const r=await fetch('/api/auth/me',{credentials:'include'});
   const d=await r.json();
   if(!r.ok)throw new Error(d.error||'Not signed in');
   if(!cancelled)setUser(d.user);
  }catch{
   if(!cancelled)setUser(null);
  }finally{
   if(!cancelled)setAuthLoading(false);
  }
 }
 checkSession();
 return()=>{cancelled=true};
},[]);
async function submitAuth(e){
 e.preventDefault();
 setAuthBusy(true);
 setAuthError('');
 const f=new FormData(e.currentTarget);
 const payload={email:f.get('email'),password:f.get('password')};
 if(authMode==='register'){
  payload.name=f.get('name');
  payload.business_name=f.get('business_name');
 }
 try{
  const endpoint=authMode==='register'?'register':'login';
  const r=await fetch('/api/auth/'+endpoint,{
   method:'POST',
   headers:{'Content-Type':'application/json'},
   credentials:'include',
   body:JSON.stringify(payload)
  });
  const d=await r.json();
  if(!r.ok)throw new Error(d.error||'Authentication failed');
  setUser(d.user);
  setActive('Dashboard');
 }catch(err){
  setAuthError(err.message||'Could not sign in. Please try again.');
 }finally{
  setAuthBusy(false);
 }
}
async function logout(){
 try{
  await fetch('/api/auth/logout',{method:'POST',credentials:'include'});
 }finally{
  setUser(null);
  setDocs([]);
  setClients([]);
  setProducts([]);
  setAuthMode('login');
  setAuthError('');
  setActive('Dashboard');
 }
}

useEffect(()=>{let cancelled=false;async function loadClients(){try{const r=await fetch('/api/clients');const data=await r.json();if(!r.ok)throw new Error(data.error||'Could not load clients');if(!Array.isArray(data))throw new Error('Unexpected response from the clients API');if(!cancelled){setClients(data);setClientError('')}}catch(err){if(!cancelled)setClientError('Could not load clients from the server. Check that the Flask API is running, then refresh.')}finally{if(!cancelled)setClientsLoading(false)}}loadClients();return()=>{cancelled=true}},[]);const[recordsLoading,setRecordsLoading]=useState(true),[recordsError,setRecordsError]=useState('');
useEffect(()=>{
 let cancelled=false;
 async function loadRecords(){
  try {
   const [remoteDocs,remoteProducts]=await Promise.all([
    fetch('/api/documents',{credentials:'include'}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error||'Documents request failed');return d;}),
    fetch('/api/products',{credentials:'include'}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error||'Products request failed');return d;})
   ]);
   if(!cancelled){setDocs(remoteDocs);setProducts(remoteProducts);setRecordsError('');}
  }catch(err){
   if(!cancelled)setRecordsError('Could not load workspace records. '+(err.message||'Check the API connection.'));
  }finally{if(!cancelled)setRecordsLoading(false);}
 }
 loadRecords();
 return()=>{cancelled=true};
},[]);
useEffect(()=>{if(!toast)return;const t=setTimeout(()=>setToast(''),2400);return()=>clearTimeout(t)},[toast]);
const invoices=docs.filter(d=>d.kind==='Invoice'),quotes=docs.filter(d=>d.kind==='Quote'),paid=invoices.filter(d=>d.status==='Paid').reduce((s,d)=>s+d.amount,0),outstanding=invoices.filter(d=>d.status!=='Paid').reduce((s,d)=>s+d.amount,0);
const shownDocs=docs.filter(d=>(active==='Quotes'?d.kind==='Quote':active==='Invoices'||active==='Payments'?d.kind==='Invoice':true)&&`${d.id} ${d.client} ${d.status}`.toLowerCase().includes(q.toLowerCase()));
async function saveClient(e){e.preventDefault();const f=new FormData(e.currentTarget);const payload={name:f.get('name'),company:f.get('company'),email:f.get('email'),phone:f.get('phone')};try{const r=await fetch('/api/clients',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const data=await r.json();if(!r.ok)throw new Error(data.error||'Could not save client');setClients(cs=>[data,...cs]);setClientError('');setModal('');setToast('Client saved to database')}catch(err){setClientError(err.message==='Failed to fetch'?'Could not reach the server. Check that the Flask API is running.':err.message||'Could not save client')}}
async function deleteClient(id){try{const r=await fetch('/api/clients/'+id,{method:'DELETE'});const data=await r.json();if(!r.ok)throw new Error(data.error||'Could not delete client');setClients(cs=>cs.filter(c=>c.id!==id));setClientError('');setToast('Client deleted from database')}catch(err){setClientError(err.message==='Failed to fetch'?'Could not reach the server. Check that the Flask API is running.':err.message||'Could not delete client')}}
async function saveDoc(e){
 e.preventDefault();
 const f=new FormData(e.currentTarget),kind=f.get('kind');
 const payload={id:(kind==='Quote'?'Q':'INV')+'-'+Date.now().toString().slice(-7),kind,client:f.get('client'),date:new Date().toISOString().slice(0,10),amount:Number(f.get('amount'))};
 try{
  const r=await fetch('/api/documents',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  const data=await r.json();if(!r.ok)throw new Error(data.error||'Could not save document');
  setDocs(ds=>[data,...ds]);setModal('');setToast(kind+' saved to database');setRecordsError('');
 }catch(err){setRecordsError('Could not save document: '+(err.message||'Check the API connection.'))}
}
async function updateDocument(id,status){
 try{
  const r=await fetch('/api/documents/'+encodeURIComponent(id),{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status})});
  const data=await r.json();if(!r.ok)throw new Error(data.error||'Could not update status');
  setDocs(ds=>ds.map(d=>d.id===id?{...d,status:data.status}:d));setToast('Status saved to database');setRecordsError('');
 }catch(err){setRecordsError('Could not update document: '+(err.message||'Check the API connection.'))}
}
async function saveProduct(e){
 e.preventDefault();const form=e.currentTarget;const f=new FormData(form);
 try{
  const r=await fetch('/api/products',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:f.get('name'),price:Number(f.get('price'))})});
  const data=await r.json();if(!r.ok)throw new Error(data.error||'Could not save product');
  setProducts(ps=>[data,...ps]);form.reset();setToast('Catalogue item saved to database');setRecordsError('');
 }catch(err){setRecordsError('Could not save product: '+(err.message||'Check the API connection.'))}
}
async function deleteProduct(id){
 try{
  const r=await fetch('/api/products/'+id,{method:'DELETE'});const data=await r.json();
  if(!r.ok)throw new Error(data.error||'Could not delete product');
  setProducts(ps=>ps.filter(p=>p.id!==id));setToast('Catalogue item deleted from database');setRecordsError('');
 }catch(err){setRecordsError('Could not delete product: '+(err.message||'Check the API connection.'))}
}
function exportCsv(){const rows=[['Reference','Type','Client','Date','Amount ZAR','Status'],...docs.map(d=>[d.id,d.kind,d.client,d.date,d.amount,d.status])];const csv=rows.map(r=>r.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='afromindstack-report.csv';a.click();URL.revokeObjectURL(a.href);setToast('CSV downloaded')}
if(authLoading)return <div className="auth-screen"><section className="auth-card"><div className="auth-intro"><label>AFROMINDSTACK</label><h1>Checking your session…</h1><p>Connecting to your workspace.</p></div></section></div>;
if(!user)return <div className="auth-screen"><section className="auth-card"><div className="brand"><div className="brand-icon"><Layers3/></div><div><b>afromind<span>stack</span></b><small>BUSINESS OS</small></div></div><div className="auth-intro"><label>YOUR BUSINESS WORKSPACE</label><h1>{authMode==='login'?'Welcome back':'Create your workspace'}</h1><p>{authMode==='login'?'Sign in to access your clients, documents and products.':'Create an account to get started with AfromindStack.'}</p></div>{authError&&<p className="auth-notice" role="alert">{authError}</p>}<form className="auth-form" onSubmit={submitAuth}>{authMode==='register'&&<><label>Your name<input name="name" autoComplete="name" required maxLength={160}/></label><label>Business name<input name="business_name" autoComplete="organization" maxLength={180} placeholder="Your business name"/></label></>}<label>Email address<input name="email" type="email" autoComplete="email" required/></label><label>Password<input name="password" type="password" minLength={authMode==='register'?10:1} autoComplete={authMode==='register'?'new-password':'current-password'} required/></label><button className="primary auth-submit" disabled={authBusy}>{authBusy?'Please wait…':authMode==='login'?'Sign in':'Create account'}</button></form><p className="auth-switch">{authMode==='login'?'New to AfromindStack?':'Already have an account?'} <button type="button" onClick={()=>{setAuthMode(authMode==='login'?'register':'login');setAuthError('')}}>{authMode==='login'?'Create account':'Sign in'}</button></p><p className="auth-foot">Your workspace data is linked to your account.</p></section></div>;
return <div className="shell">{recordsError&&<div className="notice" role="alert">{recordsError}</div>}
<aside className={'sidebar '+(mobile?'open':'')}><div className="brand"><div className="brand-icon"><Layers3/></div><div><b>afromind<span>stack</span></b><small>BUSINESS OS</small></div><button className="mobile-close icon" onClick={()=>setMobile(false)}><X/></button></div>
<div className="workspace"><div className="workspace-logo">A</div><div><b>Afromind Studio</b><small>Free workspace</small></div><span>⌄</span></div>
<div className="nav-label">WORKSPACE</div>{nav.slice(0,5).map(([name,Icon])=><button key={name} className={'nav '+(active===name?'selected':'')} onClick={()=>{setActive(name);setMobile(false);setQ('')}}><Icon size={18}/>{name}{name==='Quotes'&&<small>{quotes.length}</small>}</button>)}
<div className="nav-label">MANAGE</div>{nav.slice(5).map(([name,Icon])=><button key={name} className={'nav '+(active===name?'selected':'')} onClick={()=>{setActive(name);setMobile(false);setQ('')}}><Icon size={18}/>{name}</button>)}
<div className="side-bottom"><div className="upgrade"><div className="upgrade-icon"><Layers3 size={17}/></div><b>Make work flow.</b><p>Keep your business organised from one place.</p><button onClick={()=>setToast('Plans will be added after the pilot')}>Explore plans ↗</button></div><div className="profile"><div className="avatar">SK</div><div><b>Workspace owner</b><small>Afromind Tech</small></div></div></div></aside>
{mobile&&<button className="scrim" onClick={()=>setMobile(false)} aria-label="Close menu"/>}
<main><header><div className="crumb"><button className="mobile-menu icon" onClick={()=>setMobile(true)}><Menu/></button>Workspace <span>/</span> <b>{active}</b></div><div className="head-actions"><label className="search"><Search size={16}/><input placeholder="Search records..." value={q} onChange={e=>setQ(e.target.value)}/></label><button className="theme icon" title="Toggle light/dark mode" onClick={()=>setTheme(t=>t==='dark'?'light':'dark')}>{theme==='dark'?<Sun/>:<Moon/>}</button><div className="avatar">SK</div></div></header>
<div className="content">
{active==='Dashboard'&&<><div className="heading"><div><label>YOUR WORKSPACE</label><h1>Good afternoon, Sello</h1><p>Here's what's happening with your business today.</p></div><button className="primary" onClick={()=>setModal('doc')}><Plus size={16}/> Create new</button></div>
<div className="welcome"><div className="welcome-icon"><ChartNoAxesCombined/></div><div><b>Your business, at a glance.</b><p>Stay on top of cash flow, clients and the work that moves you forward.</p></div><button onClick={()=>setActive('Reports')}>View insights ↗</button></div>
<div className="section-head"><div><h2>Overview</h2><p>Your business performance</p></div><button className="secondary" onClick={exportCsv}><Download size={15}/> Export report</button></div>
<div className="metrics"><Metric icon={CircleDollarSign} label="Collected revenue" value={money(paid)} hint="Paid invoices"/><Metric icon={Wallet} label="Outstanding" value={money(outstanding)} hint="Awaiting payment"/><Metric icon={Users} label="Active clients" value={clients.length} hint="In your workspace"/><Metric icon={FileText} label="Open quotes" value={quotes.filter(x=>x.status!=='Accepted').length} hint="Across all quotes"/></div>
<div className="dashboard-grid"><section className="panel"><div className="panel-head"><div><h2>Revenue overview</h2><p>Illustrative monthly activity · ZAR</p></div><span className="pill">2026</span></div><div className="legend"><span>● Collected</span><span>● Outstanding</span></div><div className="chart">{[38,55,43,68,60,79,65,92,74,86,67,100].map((h,i)=><div className="bar-col" key={i}><div className="bar" style={{height:h+'%'}}/><small>{['J','F','M','A','M','J','J','A','S','O','N','D'][i]}</small></div>)}</div><p className="fine">Sample chart preview — real reporting will use saved transactions.</p></section>
<section className="panel cash"><div className="panel-head"><div><h2>Cash flow snapshot</h2><p>Based on sample records</p></div></div><h2 className="cash-total">{money(paid+outstanding)}</h2><p className="muted">Total invoice value</p><div className="progress"><span style={{width:(paid+outstanding?paid/(paid+outstanding)*100:0)+'%'}}/></div><div className="cash-row"><span>● Collected</span><b>{money(paid)}</b></div><div className="cash-row"><span>● Outstanding</span><b>{money(outstanding)}</b></div><div className="alert"><Clock3 size={17}/><span><b>{money(invoices.filter(d=>d.status==='Overdue').reduce((s,d)=>s+d.amount,0))} overdue</b><small>Review invoices needing attention.</small></span><button onClick={()=>setActive('Invoices')}>↗</button></div></section></div>
<section className="panel table-panel"><div className="panel-head"><div><h2>Recent documents</h2><p>Your latest quotes and invoices</p></div><button className="secondary" onClick={()=>setActive('Invoices')}>View invoices ↗</button></div><Documents docs={docs.slice(0,5)} update={updateDocument}/></section>
</>}
{active==='Clients'&&<><div className="heading"><div><label>RELATIONSHIPS</label><h1>Clients</h1><p>Keep every customer relationship organised.</p></div><button className="primary" onClick={()=>setModal('client')}><Plus size={16}/> Add client</button></div>{clientError&&<p className="notice">{clientError}</p>}{clientsLoading?<div className="empty">Loading clients from the database...</div>:<><div className="client-grid">{clients.filter(c=>(c.name+' '+c.company+' '+c.email).toLowerCase().includes(q.toLowerCase())).map(c=><article className="client-card" key={c.id}><div className="client-card-top"><div className="avatar">{c.name.split(' ').map(s=>s[0]).slice(0,2).join('').toUpperCase()}</div><button className="icon" onClick={()=>deleteClient(c.id)}><Trash2 size={16}/></button></div><h3>{c.name}</h3><p>{c.company}</p><small>{c.email||'No email provided'}</small><small>{c.phone||'No phone provided'}</small><div className="client-tag">SAVED IN WORKSPACE</div></article>)}</div>{!clients.length&&!clientError&&<div className="empty">No clients yet. Add your first client.</div>}</>}</>}
{['Quotes','Invoices','Payments'].includes(active)&&<><div className="heading"><div><label>{active==='Quotes'?'ESTIMATES & PROPOSALS':'BILLING & COLLECTIONS'}</label><h1>{active}</h1><p>{active==='Quotes'?'Create and track quotes before work begins.':'Track invoice statuses and outstanding amounts.'}</p></div><button className="primary" onClick={()=>setModal('doc')}><Plus size={16}/> Create {active==='Quotes'?'quote':'invoice'}</button></div><div className="metrics three"><Metric icon={FileText} label="Records" value={shownDocs.length} hint="Matching records"/><Metric icon={Wallet} label="Outstanding" value={money(shownDocs.filter(d=>d.status!=='Paid').reduce((s,d)=>s+d.amount,0))} hint="Unpaid record value"/><Metric icon={Check} label="Paid" value={shownDocs.filter(d=>d.status==='Paid').length} hint="Marked paid"/></div><section className="panel table-panel"><div className="panel-head"><div><h2>All {active.toLowerCase()}</h2><p>Change a status using the dropdown.</p></div><button className="secondary" onClick={exportCsv}><Download size={15}/> CSV</button></div><Documents docs={shownDocs} update={updateDocument}/></section><p className="notice">Quotes and invoices are stored in the workspace database.</p></>}
{active==='Reports'&&<><div className="heading"><div><label>BUSINESS INTELLIGENCE</label><h1>Reports</h1><p>A clear view of recorded cash flow and documents.</p></div><button className="secondary" onClick={exportCsv}><Download size={15}/> Export CSV</button></div><div className="metrics three"><Metric icon={CircleDollarSign} label="Collected revenue" value={money(paid)} hint="Paid invoice records"/><Metric icon={Wallet} label="Outstanding" value={money(outstanding)} hint="Unpaid invoice records"/><Metric icon={Users} label="Client base" value={clients.length} hint="Local demo records"/></div><section className="panel"><div className="panel-head"><div><h2>Document summary</h2><p>Totals from this browser's demo data.</p></div></div>{['Quote','Invoice'].map(kind=><div className="report-row" key={kind}><b>{kind==='Quote'?'Quotes':'Invoices'}</b><div className="progress"><span style={{width:(docs.length?docs.filter(d=>d.kind===kind).length/docs.length*100:0)+'%'}}/></div><b>{money(docs.filter(d=>d.kind===kind).reduce((s,d)=>s+d.amount,0))}</b></div>)}</section></>}
{active==='Products & services'&&<><div className="heading"><div><label>CATALOGUE</label><h1>Products & services</h1><p>Keep the items you sell in one place.</p></div></div><form className="product-form" onSubmit={saveProduct}><input name="name" required placeholder="Product or service name"/><input name="price" type="number" min="0" step=".01" required placeholder="Price in ZAR"/><button className="primary"><Plus size={16}/> Add item</button></form><section className="panel">{products.map(p=><div className="product-row" key={p.id}><Package/><b>{p.name}</b><span>{money(p.price)}</span><button className="icon" onClick={()=>deleteProduct(p.id)}><Trash2 size={16}/></button></div>)}{!products.length&&<div className="empty">Your catalogue is empty. Add a product or service above.</div>}</section></>}
{active==='Settings'&&<><div className="heading"><div><label>PREFERENCES</label><h1>Settings</h1><p>Personalise your AfromindStack workspace.</p></div></div><section className="panel settings"><h2>Appearance</h2><p>Choose the look that feels right for you. Your preference is saved in this browser.</p><div className="theme-options"><button className={theme==='dark'?'chosen':''} onClick={()=>setTheme('dark')}><div className="preview dark-preview"><i/><i/><i/></div><span><Moon/> <b>Dark mode</b><small>Dark surfaces and green accents</small></span>{theme==='dark'&&<Check className="check"/>}</button><button className={theme==='light'?'chosen':''} onClick={()=>setTheme('light')}><div className="preview light-preview"><i/><i/><i/></div><span><Sun/> <b>Light mode</b><small>Bright surfaces and dark text</small></span>{theme==='light'&&<Check className="check"/>}</button></div><div className="settings-divider"/><h2>Data & privacy</h2><p>Clients, quotes, invoices, and products are stored in the workspace database. Account sign-in and private workspace access controls still need to be implemented before using sensitive customer data.</p></section></>}
<footer>© 2026 AfromindStack <span><i/> All systems operational · MVP preview</span></footer>
</div></main>
{modal&&<div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&setModal('')}><section className="modal"><div className="modal-head"><div><h2>{modal==='client'?'Add a client':'Create a document'}</h2><p>{modal==='client'?'Create a customer record.':'Start a quote or invoice.'}</p></div><button className="icon" onClick={()=>setModal('')}><X/></button></div>{modal==='client'?<form onSubmit={saveClient}><label>Contact name<input name="name" required placeholder="e.g. Thabo Mokoena"/></label><label>Business name<input name="company" required placeholder="Business or trading name"/></label><label>Email<input name="email" type="email" placeholder="name@business.co.za"/></label><label>Phone<input name="phone" placeholder="082 000 0000"/></label><div className="modal-actions"><button type="button" className="secondary" onClick={()=>setModal('')}>Cancel</button><button className="primary"><Plus size={15}/> Save client</button></div></form>:<form onSubmit={saveDoc}><label>Document type<select name="kind"><option>Invoice</option><option>Quote</option></select></label><label>Client<select name="client" required>{clients.map(c=><option key={c.id}>{c.company}</option>)}</select></label><label>Amount (ZAR)<input name="amount" type="number" min=".01" step=".01" required placeholder="2500"/></label><div className="modal-actions"><button type="button" className="secondary" onClick={()=>setModal('')}>Cancel</button><button className="primary"><Plus size={15}/> Create</button></div></form>}</section></div>}
{toast&&<div className="toast"><Check size={17}/>{toast}</div>}</div>
}
function Metric({icon:Icon,label,value,hint}){return <div className="metric"><div className="metric-top"><span>{label}</span><Icon size={18}/></div><strong>{value}</strong><small>{hint}</small></div>}
function Documents({docs,update}){return <div className="table-scroll"><table><thead><tr><th>DOCUMENT</th><th>CLIENT</th><th>DATE</th><th>AMOUNT</th><th>STATUS</th></tr></thead><tbody>{docs.map(d=><tr key={d.id}><td><b>{d.id}</b><small>{d.kind}</small></td><td>{d.client}</td><td>{d.date}</td><td><b>{money(d.amount)}</b></td><td><select className={'status '+d.status.toLowerCase()} value={d.status} onChange={e=>update(d.id,e.target.value)}><option>Draft</option><option>Sent</option><option>Paid</option><option>Overdue</option><option>Accepted</option><option>Declined</option></select></td></tr>)}</tbody></table>{!docs.length&&<div className="empty">No matching records found.</div>}</div>}
