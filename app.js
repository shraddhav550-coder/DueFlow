const K='dueflow.v1',TK='dueflow.theme';
const empty=()=>({customers:[],invoices:[]});
function load(){try{const d=JSON.parse(localStorage.getItem(K));return d&&d.customers&&d.invoices?d:empty()}catch(e){return empty()}}
let S=load(),view='dash',flt='all',q='',cid=null;
const save=()=>{try{localStorage.setItem(K,JSON.stringify(S))}catch(e){toast('Could not save in this browser')}};
const $=s=>document.querySelector(s);
const uid=()=>Math.random().toString(36).slice(2,10);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const iso=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const T=()=>iso(new Date());
const addDays=n=>{const d=new Date();d.setDate(d.getDate()+n);return iso(d)};
const money=n=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:2}).format(n||0);
const fd=d=>d?new Date(d+'T00:00').toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}):'';
const days=(a,b)=>Math.round((new Date(a+'T00:00')-new Date(b+'T00:00'))/864e5);
const paid=i=>i.pay.reduce((a,p)=>a+p.amt,0),bal=i=>Math.max(0,+(i.amt-paid(i)).toFixed(2));
const sum=(l,f)=>l.reduce((a,x)=>a+f(x),0);
const cust=id=>S.customers.find(c=>c.id===id)||{name:'(deleted)',phone:'',email:''};
function st(i){if(bal(i)===0)return'paid';if(i.due<T())return'overdue';if(i.due===T())return'today';return paid(i)>0?'partial':'pending'}
const label={paid:'Paid',overdue:'Overdue',today:'Due today',partial:'Partial',pending:'Pending'};
const badge=i=>{const s=st(i);return`<span class="badge s-${s}">${label[s]}</span>`+(paid(i)>0&&s!=='paid'?`<div class="mute">${money(paid(i))} paid</div>`:'')};
const nameLink=c=>`<button class="link" data-a="opencust" data-id="${c.id}">${esc(c.name)}</button>`;
function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('on');clearTimeout(toast.h);toast.h=setTimeout(()=>t.classList.remove('on'),2400)}

function modal(title,body,onSave,lbl='Save'){
  const d=$('#dlg');d.innerHTML=`<form><h3>${title}</h3>${body}<div class="row"><button type="button" class="btn" data-x>Cancel</button>${onSave?`<button class="btn pri">${lbl}</button>`:''}</div></form>`;
  const f=d.querySelector('form');f.onsubmit=e=>{e.preventDefault();if(onSave&&onSave(new FormData(f))===false)return;d.close()};
  f.querySelector('[data-x]').onclick=()=>d.close();if(!d.open)d.showModal();
}
const fld=(l,n,v='',t='text',x='')=>`<label>${l}<input name="${n}" type="${t}" value="${esc(v)}" ${x}></label>`;

/* ---------- customers ---------- */
function custForm(id){
  const c=id?S.customers.find(x=>x.id===id):{name:'',phone:'',email:''};
  modal(id?'Edit customer':'Add customer',fld('Name','name',c.name,'text','required')+fld('WhatsApp number (with country code, or 10-digit Indian number)','phone',c.phone,'tel')+fld('Email','email',c.email,'email'),fd=>{
    const o={name:fd.get('name').trim(),phone:fd.get('phone').trim(),email:fd.get('email').trim()};
    if(!o.name)return false;
    if(id)Object.assign(c,o);else S.customers.push({id:uid(),...o});
    save();render();toast('Customer saved');
  });
}
function delCust(id){
  if(S.invoices.some(i=>i.cust===id))return toast('Delete this customer\'s invoices first');
  if(confirm('Delete this customer?')){S.customers=S.customers.filter(c=>c.id!==id);if(cid===id){cid=null;view='cust'}save();render()}
}
/* ---------- invoices (customer + invoice in one form) ---------- */
function invForm(id,preCust){
  const i=id?S.invoices.find(x=>x.id===id):{no:'INV-'+String(S.invoices.length+1).padStart(3,'0'),cust:preCust||'',amt:'',issue:T(),due:addDays(14),notes:'',pay:[]};
  const c=i.cust?cust(i.cust):{name:'',email:'',phone:''};
  const list=S.customers.map(x=>`<option value="${esc(x.name)}">`).join('');
  modal(id?'Edit invoice':'Add invoice',
    `<label>Customer name<input name="cname" list="clist" value="${esc(c.name)}" required autocomplete="off"></label><datalist id="clist">${list}</datalist>`+
    fld('Email','email',c.email,'email')+
    fld('WhatsApp number','phone',c.phone,'tel')+
    fld('Invoice number','no',i.no,'text','required')+
    fld('Amount (₹)','amt',i.amt,'number','required min="0.01" step="0.01"')+
    fld('Start date','issue',i.issue,'date','required')+
    fld('Final date (due)','due',i.due,'date','required')+
    `<label>Notes<textarea name="notes" rows="2">${esc(i.notes)}</textarea></label>`,
  fd=>{
    const name=fd.get('cname').trim();
    const o={no:fd.get('no').trim(),amt:parseFloat(fd.get('amt')),issue:fd.get('issue'),due:fd.get('due'),notes:fd.get('notes').trim()};
    if(!name||!o.no||!(o.amt>0)||!o.issue||!o.due)return false;
    if(o.due<o.issue){toast('Final date is before the start date');return false}
    let cu=S.customers.find(x=>x.name.toLowerCase()===name.toLowerCase());
    if(!cu){
      const old=id?S.customers.find(x=>x.id===i.cust):null;
      if(old&&S.invoices.filter(x=>x.cust===old.id).length===1){cu=old;cu.name=name}
      else{cu={id:uid(),name,email:'',phone:''};S.customers.push(cu)}
    }
    cu.email=fd.get('email').trim();cu.phone=fd.get('phone').trim();
    o.cust=cu.id;
    if(id)Object.assign(i,o);else S.invoices.push({id:uid(),pay:[],...o});
    save();render();toast('Invoice saved');
  });
  $('#dlg [name=cname]').addEventListener('change',e=>{
    const m=S.customers.find(x=>x.name.toLowerCase()===e.target.value.trim().toLowerCase());
    if(m){const f=e.target.form;if(!f.email.value)f.email.value=m.email||'';if(!f.phone.value)f.phone.value=m.phone||''}
  });
}
function delInv(id){if(confirm('Delete this invoice and its payments?')){S.invoices=S.invoices.filter(i=>i.id!==id);save();render()}}
function payForm(id){
  const i=S.invoices.find(x=>x.id===id),b=bal(i);
  const hist=i.pay.length?`<h3 style="margin-top:16px">Payment history</h3>`+i.pay.map(p=>`<div class="owe"><div class="who"><b>${money(p.amt)}</b><small>${fd(p.date)}${p.note?' · '+esc(p.note):''}</small></div><button type="button" class="btn sm del" data-a="delpay" data-id="${i.id}" data-p="${p.id}">Remove</button></div>`).join(''):'';
  modal(`Payment for ${esc(i.no)}`,`<div class="mute">${esc(cust(i.cust).name)} · Total ${money(i.amt)} · Balance ${money(b)}</div>`+(b>0?fld('Amount received (₹)','amt',b,'number',`required min="0.01" max="${b}" step="0.01"`)+fld('Date','date',T(),'date','required')+fld('Note (optional)','note',''):'<p>This invoice is fully paid.</p>')+hist,b>0?fd=>{
    const a=parseFloat(fd.get('amt'));if(!(a>0)||a>b+0.001){toast('Enter an amount up to the balance');return false}
    i.pay.push({id:uid(),amt:a,date:fd.get('date'),note:fd.get('note').trim()});save();render();toast(bal(i)===0?'Invoice fully paid':'Partial payment recorded');
  }:null,'Record payment');
}
/* ---------- reminders ---------- */
function dueList(){
  const m={};S.invoices.forEach(i=>{const s=st(i);if(s==='overdue'||s==='today'){(m[i.cust]=m[i.cust]||[]).push(i)}});
  return Object.entries(m).map(([id,l])=>({c:{...cust(id),id},id,l,total:sum(l,bal),late:Math.max(0,...l.map(i=>days(T(),i.due)))})).sort((a,b)=>b.late-a.late||b.total-a.total);
}
function remind(id){
  const c=S.customers.find(x=>x.id===id);let p=(c.phone||'').replace(/\D/g,'').replace(/^0+/,'');
  if(!p)return toast('Add a phone number for this customer first');
  if(p.length===10)p='91'+p;
  const l=S.invoices.filter(i=>i.cust===id&&['overdue','today'].includes(st(i)));
  const lines=l.map(i=>`• ${i.no}: ${money(bal(i))} (due ${fd(i.due)})`).join('\n');
  const msg=`Hi ${c.name}, a friendly reminder about ${l.length>1?'these pending invoices':'a pending invoice'}:\n${lines}\nTotal: ${money(sum(l,bal))}. Please let us know when we can expect the payment. Thank you!`;
  window.open('https://wa.me/'+p+'?text='+encodeURIComponent(msg),'_blank','noopener');
  c.lastRem=T();save();render();
}
/* ---------- CSV ---------- */
function csv(){
  const r=[['Invoice','Customer','Email','Phone','Start date','Final date','Amount','Paid','Balance','Status','Notes']];
  S.invoices.forEach(i=>{const c=cust(i.cust);r.push([i.no,c.name,c.email,c.phone,i.issue,i.due,i.amt,paid(i),bal(i),label[st(i)],i.notes])});
  return r.map(x=>x.map(v=>{v=String(v??'');if(/^[=+\-@]/.test(v))v="'"+v;return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v}).join(',')).join('\n');
}
function exportCsv(){
  if(!S.invoices.length)return toast('No invoices to export');
  const url=URL.createObjectURL(new Blob(['\ufeff'+csv()],{type:'text/csv;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download='dueflow-invoices-'+T()+'.csv';
  document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
}
/* ---------- shared view pieces ---------- */
function statCards(l){
  const ov=l.filter(i=>st(i)==='overdue'),td=l.filter(i=>st(i)==='today');
  return`<div class="stats"><div class="stat"><span>Total outstanding</span><b>${money(sum(l,bal))}</b></div><div class="stat bad"><span>Overdue (${ov.length})</span><b>${money(sum(ov,bal))}</b></div><div class="stat"><span>Due today (${td.length})</span><b>${money(sum(td,bal))}</b></div><div class="stat ok"><span>Collected</span><b>${money(sum(l,paid))}</b></div></div>`;
}
function chartHTML(l){
  const ms=[];for(let k=5;k>=0;k--){const d=new Date();d.setDate(1);d.setMonth(d.getMonth()-k);ms.push(iso(d).slice(0,7))}
  const pays=l.flatMap(i=>i.pay);
  const inv=ms.map(m=>sum(l.filter(i=>i.issue.startsWith(m)),i=>i.amt)),col=ms.map(m=>sum(pays.filter(p=>p.date.startsWith(m)),p=>p.amt));
  const mx=Math.max(1,...inv,...col);
  return`<h3>Last 6 months</h3><div class="chart">${ms.map((m,k)=>`<div class="c"><div class="pair"><i class="i1" style="height:${inv[k]/mx*100}%" title="Invoiced ${money(inv[k])}"></i><i class="i2" style="height:${col[k]/mx*100}%" title="Collected ${money(col[k])}"></i></div><small class="mute">${new Date(m+'-01T00:00').toLocaleDateString('en-IN',{month:'short'})}</small></div>`).join('')}</div><div class="leg" style="margin-top:8px"><span><span class="dot" style="background:var(--info)"></span>Invoiced</span><span><span class="dot" style="background:var(--acc)"></span>Collected</span></div>`;
}
function statusHTML(l){
  const cnt={};l.forEach(i=>{const s=st(i);cnt[s]=(cnt[s]||0)+1});
  const colr={paid:'var(--ok)',overdue:'var(--bad)',today:'var(--warn)',partial:'#d4a017',pending:'var(--info)'};
  return`<h3>Invoice status</h3><div class="seg">${Object.entries(cnt).map(([s,n])=>`<div style="width:${n/l.length*100}%;background:${colr[s]}"></div>`).join('')}</div><div class="leg">${Object.entries(cnt).map(([s,n])=>`<span><span class="dot" style="background:${colr[s]}"></span>${label[s]} <b>${n}</b></span>`).join('')}</div>`;
}
function invTable(l,showCust){
  return`<div class="panel tw" style="padding:6px 10px"><table><tr><th>Invoice</th>${showCust?'<th>Customer</th>':''}<th>Start</th><th>Final date</th><th class="n">Amount</th><th class="n">Balance</th><th>Status</th><th></th></tr>${l.map(i=>`<tr><td><b>${esc(i.no)}</b></td>${showCust?`<td>${nameLink({id:i.cust,name:cust(i.cust).name})}</td>`:''}<td>${fd(i.issue)}</td><td>${fd(i.due)}</td><td class="n">${money(i.amt)}</td><td class="n">${money(bal(i))}</td><td>${badge(i)}</td><td style="white-space:nowrap"><button class="btn sm" data-a="pay" data-id="${i.id}">${bal(i)?'Pay':'History'}</button> <button class="btn sm" data-a="editinv" data-id="${i.id}">Edit</button> <button class="btn sm del" data-a="delinv" data-id="${i.id}">Delete</button></td></tr>`).join('')}</table></div>`;
}
function seedBtn(){return`<div class="panel empty"><b>No invoices yet</b><div>Create your first invoice. The customer is added automatically.</div><button class="btn pri" data-a="addinv">Add invoice</button> <button class="btn" data-a="seed">Load sample data</button></div>`}
function owedRow(d){return`<div class="owe"><div class="who"><b>${nameLink(d.c)}</b><small>${d.l.length} invoice${d.l.length>1?'s':''} · ${d.late>0?d.late+' day'+(d.late>1?'s':'')+' late':'due today'}${d.c.lastRem?' · reminded '+fd(d.c.lastRem):''}</small></div><div class="amt">${money(d.total)}</div><button class="btn sm pri" data-a="wa" data-id="${d.id}">WhatsApp</button></div>`}
/* ---------- views ---------- */
function vDash(){
  if(!S.invoices.length)return statCards([])+seedBtn();
  const d=dueList().slice(0,5),rp=S.invoices.flatMap(i=>i.pay.map(p=>({...p,i}))).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5);
  return statCards(S.invoices)+`<div class="cols"><div class="panel"><h3>Who needs a reminder</h3>${d.length?d.map(owedRow).join(''):'<div class="empty">Nobody is overdue. Nice.</div>'}</div><div class="panel"><h3>Recent payments</h3>${rp.length?rp.map(p=>`<div class="owe"><div class="who"><b>${esc(cust(p.i.cust).name)}</b><small>${esc(p.i.no)} · ${fd(p.date)}</small></div><div class="amt">${money(p.amt)}</div></div>`).join(''):'<div class="empty">No payments recorded yet.</div>'}</div></div>`;
}
function vInv(){
  const fs=['all','pending','overdue','partial','paid'];
  const l=S.invoices.filter(i=>{const s=st(i);return(flt==='all'||s===flt||(flt==='pending'&&s==='today'))&&(!q||(i.no+cust(i.cust).name).toLowerCase().includes(q.toLowerCase()))}).sort((a,b)=>a.due.localeCompare(b.due));
  return`<div class="bar"><h2>Invoices</h2><div><button class="btn" data-a="csv">Export CSV</button> <button class="btn pri" data-a="addinv">Add invoice</button></div></div>
  <div class="bar"><div class="chips">${fs.map(f=>`<button class="chip ${flt===f?'on':''}" data-a="flt" data-id="${f}">${f[0].toUpperCase()+f.slice(1)}</button>`).join('')}</div><input id="q" placeholder="Search invoice or customer" value="${esc(q)}" style="max-width:260px"></div>
  ${l.length?invTable(l,true):(S.invoices.length?'<div class="panel empty">No invoices match.</div>':seedBtn())}`;
}
function vCust(){
  return`<div class="bar"><h2>Customers</h2><button class="btn pri" data-a="addcust">Add customer</button></div>`+(S.customers.length?`<div class="panel">${S.customers.map(c=>{const o=sum(S.invoices.filter(i=>i.cust===c.id),bal);return`<div class="owe"><div class="who"><b>${nameLink(c)}</b><small>${esc(c.phone||'No phone')}${c.email?' · '+esc(c.email):''}</small></div><div class="amt">${money(o)}<div class="mute">owed</div></div><button class="btn sm pri" data-a="opencust" data-id="${c.id}">Analyse</button><button class="btn sm" data-a="editcust" data-id="${c.id}">Edit</button><button class="btn sm del" data-a="delcust" data-id="${c.id}">Delete</button></div>`}).join('')}</div>`:'<div class="panel empty">No customers yet.<br><button class="btn pri" data-a="addinv">Add your first invoice</button></div>');
}
function vCview(){
  const c=S.customers.find(x=>x.id===cid);if(!c){view='cust';return vCust()}
  const l=S.invoices.filter(i=>i.cust===cid).sort((a,b)=>b.due.localeCompare(a.due));
  const tot=sum(l,i=>i.amt),cl=sum(l,paid),ovList=l.filter(i=>st(i)==='overdue');
  const done=l.filter(i=>st(i)==='paid');
  const delays=done.map(i=>days(i.pay.map(p=>p.date).sort().pop(),i.due));
  const onTime=delays.filter(d=>d<=0).length,avg=delays.length?Math.round(sum(delays,d=>d)/delays.length):null;
  const rate=done.length?Math.round(onTime/done.length*100):null;
  let tag='<span class="tag s-pending">No history yet</span>';
  if(rate!==null)tag=rate>=80?'<span class="tag s-paid">Reliable payer</span>':rate>=50?'<span class="tag s-partial">Sometimes late</span>':'<span class="tag s-overdue">Often late</span>';
  if(ovList.length&&rate!==null&&rate>=80)tag='<span class="tag s-partial">Reliable, but has overdue</span>';
  const pays=l.flatMap(i=>i.pay.map(p=>({...p,i}))).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,8);
  const avgTxt=avg===null?'No paid invoices yet':avg<0?`${-avg} day${avg<-1?'s':''} early on average`:avg===0?'On the due date on average':`${avg} day${avg>1?'s':''} late on average`;
  return`<div class="bar"><button class="btn sm" data-a="nav" data-id="cust">‹ All customers</button></div>
  <div class="cv-head"><div><h2>${esc(c.name)}${tag}</h2><div class="mute">${esc(c.phone||'No phone')}${c.email?' · '+esc(c.email):''}</div></div><div><button class="btn" data-a="editcust" data-id="${c.id}">Edit customer</button> <button class="btn" data-a="addinvfor" data-id="${c.id}">Add invoice</button> ${ovList.length||l.some(i=>st(i)==='today')?`<button class="btn pri" data-a="wa" data-id="${c.id}">WhatsApp reminder</button>`:''}</div></div>
  ${l.length?`${statCards(l)}
  <div class="stats"><div class="stat"><span>Invoices</span><b>${l.length}</b></div><div class="stat"><span>Total invoiced</span><b>${money(tot)}</b></div><div class="stat"><span>Collection rate</span><b>${tot?Math.round(cl/tot*100):0}%</b></div><div class="stat"><span>Paid on time</span><b>${rate===null?'–':rate+'%'}</b><span>${avgTxt}</span></div></div>
  <div class="cols"><div class="panel">${chartHTML(l)}</div><div class="panel">${statusHTML(l)}<h3 style="margin-top:18px">Recent payments</h3>${pays.length?pays.map(p=>`<div class="owe"><div class="who"><b>${money(p.amt)}</b><small>${esc(p.i.no)} · ${fd(p.date)}</small></div></div>`).join(''):'<div class="mute">No payments yet.</div>'}</div></div>
  <h3>All invoices</h3>${invTable(l,false)}`:'<div class="panel empty">No invoices for this customer yet.</div>'}`;
}
function vFol(){
  const d=dueList();
  return`<div class="bar"><h2>Follow-ups</h2></div><p class="mute" style="margin-top:-6px">Customers with overdue or due-today balances. WhatsApp opens with a message ready; you press send yourself.</p><div class="panel">${d.length?d.map(owedRow).join(''):'<div class="empty">No follow-ups needed right now.</div>'}</div>`;
}
function vAna(){
  const l=S.invoices;
  if(!l.length)return`<div class="bar"><h2>Analytics</h2></div>`+seedBtn();
  const tot=sum(l,i=>i.amt),cl=sum(l,paid);
  const top=S.customers.map(c=>({c,o:sum(l.filter(i=>i.cust===c.id),bal)})).filter(x=>x.o>0).sort((a,b)=>b.o-a.o).slice(0,5);
  return`<div class="bar"><h2>Analytics</h2></div>
  <div class="stats"><div class="stat"><span>Total invoiced</span><b>${money(tot)}</b></div><div class="stat ok"><span>Collected</span><b>${money(cl)}</b></div><div class="stat"><span>Collection rate</span><b>${tot?Math.round(cl/tot*100):0}%</b></div><div class="stat"><span>Invoices</span><b>${l.length}</b></div></div>
  <div class="cols"><div class="panel">${chartHTML(l)}</div><div class="panel">${statusHTML(l)}<h3 style="margin-top:18px">Biggest balances</h3>${top.length?top.map(x=>`<div class="owe"><div class="who"><b>${nameLink(x.c)}</b></div><div class="amt">${money(x.o)}</div></div>`).join(''):'<div class="mute">Nothing outstanding.</div>'}</div></div>`;
}
const tabs=[['dash','Dashboard'],['inv','Invoices'],['cust','Customers'],['fol','Follow-ups'],['ana','Analytics']];
function render(){
  const cur=view==='cview'?'cust':view;
  $('#nav').innerHTML=tabs.map(([k,n])=>`<button class="${cur===k?'on':''}" data-a="nav" data-id="${k}">${n}</button>`).join('');
  $('#main').innerHTML={dash:vDash,inv:vInv,cust:vCust,cview:vCview,fol:vFol,ana:vAna}[view]();
  const qi=$('#q');if(qi)qi.oninput=e=>{q=e.target.value;const p=e.target.selectionStart;render();const n=$('#q');n.focus();n.setSelectionRange(p,p)};
}
function seed(){
  const a=uid(),b=uid(),c=uid();
  S.customers.push({id:a,name:'Sharma Traders',phone:'9876543210',email:'sharma@example.com'},{id:b,name:'Patel Hardware',phone:'9123456780',email:''},{id:c,name:'Greenleaf Cafe',phone:'',email:''});
  const mk=(n,cu,amt,iss,due,pay=[])=>S.invoices.push({id:uid(),no:n,cust:cu,amt,issue:addDays(iss),due:addDays(due),notes:'',pay:pay.map(([x,d])=>({id:uid(),amt:x,date:addDays(d),note:''}))});
  mk('INV-001',a,25000,-40,-25,[[10000,-20]]);mk('INV-002',b,12500,-20,-5);mk('INV-003',c,8000,-10,0);mk('INV-004',a,18000,-5,20);mk('INV-005',b,6400,-60,-45,[[6400,-40]]);mk('INV-006',a,9000,-90,-75,[[9000,-80]]);
  save();render();
}
const act={
  nav:id=>{view=id;render();scrollTo(0,0)},
  theme:()=>{const r=document.documentElement,dk=r.dataset.theme?r.dataset.theme==='dark':matchMedia('(prefers-color-scheme:dark)').matches;setTheme(dk?'light':'dark')},
  opencust:id=>{cid=id;view='cview';render();scrollTo(0,0)},
  addinv:()=>invForm(),addinvfor:id=>invForm(null,id),editinv:id=>invForm(id),delinv:delInv,pay:payForm,
  delpay:(id,e)=>{const i=S.invoices.find(x=>x.id===id);i.pay=i.pay.filter(p=>p.id!==e.dataset.p);save();render();payForm(id)},
  addcust:()=>custForm(),editcust:id=>custForm(id),delcust:delCust,wa:remind,csv:exportCsv,seed,flt:id=>{flt=id;render()}
};
document.addEventListener('click',e=>{const t=e.target.closest('[data-a]');if(t&&act[t.dataset.a])act[t.dataset.a](t.dataset.id,t)});
function setTheme(t){document.documentElement.dataset.theme=t;try{localStorage.setItem(TK,t)}catch(e){}$('#tbtn').textContent=t==='dark'?'Light mode':'Dark mode'}
try{const t=localStorage.getItem(TK);if(t)setTheme(t);else if(matchMedia('(prefers-color-scheme:dark)').matches)$('#tbtn').textContent='Light mode'}catch(e){}
render();