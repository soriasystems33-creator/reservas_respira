console.log("🚀 TFM UNIR — PANEL GESTIÓN CARGADO [2026-06-20]");
const AID="magic-studio-default";
var db,auth;
var appointments=[];
var currentTab='calendar_all';
var editingId=null;
var config={start:"09:00",end:"20:00",specialDays:{}};
var currentViewDate=new Date();
var configEntity='global';
var selectedDayInModal='';
var selectedTime=null;
var tmpLocal={type:'standard',start:'09:00',end:'20:00'};
var tmpClosedHours=[];
var specialistViewLevel='month';
var blocksDB=[];
var rangeStart=null;
var incomeChart=null;

var empInApt=function(a,en){if(!en)return false;var el=en.toLowerCase();var aEmp=(a.employee||'').toLowerCase();if(aEmp==='todas'||aEmp==='cualquiera'||aEmp==='ambos'||aEmp===''||aEmp==='automático')return true;return aEmp===el||aEmp.split(',').map(function(e){return e.trim()}).includes(el)||(a.services&&a.services.some(function(s){var se=(s.employee||'').toLowerCase();return se===el||se==='todas'||se==='cualquiera'||se==='ambos'||se===''||se==='automático'}))};

var servicesDB=[],employeesDB=[],categoriesDB=[],expensesDB=[],editingServiceId=null,editingEmployeeId=null;
const parseDate=s=>{if(!s)return new Date();const[y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d)};
const getLD=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const t2m=t=>{if(!t||typeof t!=='string')return 0;const p=t.split(':').map(Number);return(p[0]||0)*60+(p[1]||0)};
const m2t=m=>`${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
const esc=s=>typeof s!=='string'?s:s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
const statusColors={'pending':'bg-yellow-100 border-yellow-300 text-yellow-800','confirmed':'bg-blue-100 border-blue-300 text-blue-800','completed':'bg-green-100 border-green-300 text-green-800','cancelled':'bg-red-100 border-red-300 text-red-800 opacity-60'};
const getAptServiceBlocks = (apt) => {
  const blocks = [];
  const svcs = apt.services || [];
  if (svcs.length === 0) {
    blocks.push({
      apt,
      serviceName: apt.service || '',
      employee: apt.employee || '',
      time: apt.time,
      duration: parseInt(apt.duration || 15, 10),
      index: 0,
      totalServices: 1
    });
    return blocks;
  }
  const uniqueEmps = [...new Set(svcs.map(s => s.employee).filter(Boolean))];
  const isMultiEmp = uniqueEmps.length > 1;
  let currentStart = t2m(apt.time);
  svcs.forEach((svc, index) => {
    const svcDur = parseInt(svc.duration || 15, 10);
    const svcTime = isMultiEmp ? apt.time : m2t(currentStart);
    blocks.push({
      apt,
      serviceName: svc.name,
      employee: svc.employee || apt.employee || '',
      time: svcTime,
      duration: svcDur,
      index: index,
      totalServices: svcs.length
    });
    if (!isMultiEmp) {
      currentStart += svcDur;
    }
  });
  return blocks;
};
const WEBHOOK_URL="https://n8nyt.soriasystems.site/webhook/73794b5a-65e9-494f-bd50-9c461b78d93e";
const notifyWebhook=(event,data)=>{if(!WEBHOOK_URL)return;try{fetch(WEBHOOK_URL,{method:'POST',mode:'no-cors',headers:{'Content-Type':'text/plain'},body:JSON.stringify({event,...data})})}catch(e){console.error('[webhook]',e)}};
const setStatus=(s,t)=>{const d=document.getElementById('status-dot');if(d)d.className=`w-2.5 h-2.5 rounded-full ${s==='ok'?'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]':s==='loading'?'bg-yellow-400 animate-pulse':'bg-red-500'}`;const l=document.getElementById('status-text');if(l)l.innerText=t};


const getEmpById=id=>employeesDB.find(e=>e.id===id);
const getEmpByName=name=>employeesDB.find(e=>e.name===name);
const getSvcById=id=>servicesDB.find(s=>s.id===id);
const getSvcByName=name=>servicesDB.find(s=>s.name===name);
// ---- CLOSE/OPEN MODALS ----
window.closeModal=()=>document.getElementById('modal').classList.add('hidden');
window.closeDayModal=()=>document.getElementById('day-modal').classList.add('hidden');
window.closeConfigDayModal=()=>document.getElementById('config-day-modal').classList.add('hidden');
window.openClosuresInfoModal=()=>{
  document.getElementById('closures-info-modal').classList.remove('hidden');
  if(window.lucide)lucide.createIcons();
};
window.closeClosuresInfoModal=()=>document.getElementById('closures-info-modal').classList.add('hidden');

// ---- SERVICES CRUD ----
window.openServiceModal=(id=null)=>{editingServiceId=id;document.getElementById('service-modal').classList.remove('hidden');
const t=document.getElementById('service-modal-title');t.innerText=id?'Editar Servicio':'Nuevo Servicio';
const cs=document.getElementById('svc-category');cs.innerHTML=categoriesDB.map(c=>`<option value="${c.name}">${c.name}</option>`).join('');
const es=document.getElementById('svc-employee');es.innerHTML='<option value="Todas">Todas</option>'+employeesDB.map(e=>`<option value="${e.name}">${e.name}</option>`).join('');
if(id){const s=getSvcById(id);if(s){document.getElementById('svc-name').value=s.name;document.getElementById('svc-price').value=s.price;document.getElementById('svc-duration').value=s.duration;document.getElementById('svc-desc').value=s.desc||'';cs.value=s.category;
const saved=s.employee||'Todas';if(saved==='Todas'||saved==='Ambos'||saved==='Cualquiera'||!saved){es.value=['Todas']}else{const vals=saved.split(',').map(v=>v.trim());es.value=vals;}}}
else{['svc-name','svc-price','svc-duration','svc-desc'].forEach(i=>document.getElementById(i).value='');es.value=['Todas']}};
window.saveService=async()=>{const es=document.getElementById('svc-employee');const selected=[...es.selectedOptions].map(o=>o.value);const empVal=selected.includes('Todas')||selected.length===0?'Todas':selected.join(',');const d={name:document.getElementById('svc-name').value.trim(),price:parseFloat(document.getElementById('svc-price').value),duration:parseInt(document.getElementById('svc-duration').value),desc:document.getElementById('svc-desc').value.trim(),category:document.getElementById('svc-category').value,employee:empVal,updatedAt:new Date().toISOString()};
if(!d.name||!d.price||!d.duration)return alert('Completa nombre, precio y duración');
if(editingServiceId)await updateDoc(doc(db,'artifacts',AID,'public','data','services',editingServiceId),d);
else{d.createdAt=new Date().toISOString();await addDoc(collection(db,'artifacts',AID,'public','data','services'),d)}
document.getElementById('service-modal').classList.add('hidden')};
window.deleteService=async id=>{if(!confirm('¿Eliminar este servicio?'))return;await deleteDoc(doc(db,'artifacts',AID,'public','data','services',id))};
let editingCategoryId=null;
let selectedConfigDays = new Set();
let isDraggingSelect = false;
let dragSelectMode = true; // true to select, false to unselect
let isConfigMode = false;
const ICONS=['sparkles','scissors','palette','eye','wand-2','heart','star','sun','moon','droplets','flame','snowflake','feather','flower-2','gem','shield','crown','target','zap','shield-check','medal','award','trophy','smile','frown','meh','thumbs-up','thumbs-down','check','x','plus','minus','search','eye-off','bell','bell-off','clock','calendar','calendar-check','calendar-x','calendar-plus','calendar-days','map-pin','map','phone','mail','message-circle','message-square','send','share-2','home','menu','settings','user','users','user-plus','user-check','user-x','user-cog','user-minus','camera','image','video','film','music','volume-2','volume-x','headphones','play','pause','skip-forward','skip-back','shuffle','repeat','refresh-cw','undo','redo','rotate-cw','rotate-ccw','download','upload','cloud','cloud-rain','cloud-snow','cloud-lightning','wind','umbrella','sunrise','sunset','tool','wrench','hammer','trash-2','edit-3','copy','clipboard','clipboard-check','clipboard-x','save','file','file-text','folder','folder-plus','folder-minus','tag','tags','bookmark','bookmark-check','bookmark-x','briefcase','shopping-cart','shopping-bag','credit-card','banknote','dollar-sign','euro','trending-up','trending-down','bar-chart-3','pie-chart','activity','sliders','list','grid-3x3','layout','columns','rows','inbox','archive','package','box','layers','paintbrush','pencil','eraser','highlighter','palette','swatch-book','cone','cigarette','utensils','cup-soda','coffee','beer','wine','cake','cookie','candy','pizza','apple','orange','banana','cherry','nut','sandwich','salad','chef-hat','microwave-oven','refrigerator-2','washing-machine','tv','laptop','smartphone','tablet','watch','glasses','contact','bluetooth','wifi','plus-circle','x-circle','check-circle','info','alert-triangle','alert-circle','alert-octagon','help-circle','external-link','lock','unlock','fingerprint','key','rocket','plane','car','bus','bike','truck','train','ship','walking','running','airplay'];
window.openCategoryModal=(id=null)=>{editingCategoryId=id;document.getElementById('category-modal').classList.remove('hidden');const t=document.querySelector('#category-modal h3');if(t)t.innerText=id?'Editar Categoría':'Nueva Categoría';if(id){const c=categoriesDB.find(cat=>cat.id===id);if(c){document.getElementById('cat-name').value=c.name;var icon=c.icon||'sparkles';document.getElementById('cat-icon').value=icon;document.getElementById('cat-icon-preview').innerHTML='<i data-lucide="'+icon+'" class="w-5 h-5"></i>';if(window.lucide)lucide.createIcons();}}else{document.getElementById('cat-name').value='';var defIcon='sparkles';document.getElementById('cat-icon').value=defIcon;document.getElementById('cat-icon-preview').innerHTML='<i data-lucide="'+defIcon+'" class="w-5 h-5"></i>';if(window.lucide)lucide.createIcons();}};
window.openIconPicker=()=>{const grid=document.getElementById('icon-picker-grid');if(!grid)return;document.getElementById('icon-picker-modal').classList.remove('hidden');grid.innerHTML=ICONS.map(ic=>'<div class="flex flex-col items-center gap-1 p-2 rounded-xl cursor-pointer border-2 border-transparent hover:border-[var(--blue-deep)] hover:bg-[var(--cream)] transition-all" onclick="window.selectIcon(\''+ic+'\')"><i data-lucide="'+ic+'" class="w-5 h-5" style="color:var(--brown)"></i><span class="text-[6px] font-bold truncate w-full text-center" style="color:var(--brown-mid)">'+ic+'</span></div>').join('');if(window.lucide)setTimeout(()=>lucide.createIcons(),50)};
window.selectIcon=(ic)=>{document.getElementById('cat-icon').value=ic;document.getElementById('cat-icon-preview').innerHTML='<i data-lucide="'+ic+'" class="w-5 h-5"></i>';if(window.lucide)lucide.createIcons();document.getElementById('icon-picker-modal').classList.add('hidden')};
window.saveCategory=async()=>{const n=document.getElementById('cat-name').value.trim();const i=document.getElementById('cat-icon').value.trim()||'sparkles';
if(!n)return alert('Escribe un nombre');try{if(editingCategoryId){await updateDoc(doc(db,'artifacts',AID,'public','data','categories',editingCategoryId),{name:n,icon:i,updatedAt:new Date().toISOString()});}else{await addDoc(collection(db,'artifacts',AID,'public','data','categories'),{name:n,icon:i,createdAt:new Date().toISOString()});}document.getElementById('category-modal').classList.add('hidden');}catch(e){alert('Error: '+e.message);}};
window.deleteCategory=async id=>{if(!confirm('¿Eliminar esta categoría? Los servicios asociados NO se eliminarán.'))return;await deleteDoc(doc(db,'artifacts',AID,'public','data','categories',id))};
window.renderServicesMgmt=()=>{const c=document.getElementById('services-mgmt-list');if(!c)return;c.innerHTML='';
if(categoriesDB.length===0){c.innerHTML='<div class="bg-white p-12 rounded-3xl border text-center text-slate-400"><p class="font-black uppercase mb-4">No hay categorías</p><p class="text-xs">Crea una categoría primero para poder añadir servicios.</p></div>';return}
categoriesDB.forEach(cat=>{const svcs=servicesDB.filter(s=>s.category===cat.name);
let html=`<div class="bg-white rounded-3xl border shadow-sm overflow-hidden"><div class="p-4 bg-slate-50 border-b flex justify-between items-center"><div class="flex items-center gap-2"><i data-lucide="${cat.icon||'sparkles'}" class="w-5 h-5 text-teal-600"></i><h4 class="font-black uppercase text-sm">${esc(cat.name)}</h4><span class="text-[10px] bg-slate-200 px-2 py-0.5 rounded-full font-bold">${svcs.length} servicios</span></div><div class="flex items-center gap-1"><button onclick="window.openCategoryModal('${cat.id}')" class="text-blue-400 hover:text-blue-600 p-1 rounded hover:bg-blue-50 transition-colors"><i data-lucide="edit-3" class="w-4 h-4"></i></button><button onclick="window.deleteCategory('${cat.id}')" class="text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors"><i data-lucide="trash-2" class="w-4 h-4"></i></button></div></div>`;
if(svcs.length===0)html+='<div class="p-6 text-center text-slate-300 text-xs italic">Sin servicios en esta categoría</div>';
else{html+='<div class="divide-y">';svcs.forEach(s=>{const empDisplay=!s.employee||s.employee==='Todas'||s.employee==='Ambos'||s.employee==='Cualquiera'?'Todas':s.employee.split(',').map(esc).join(', ');
html+=`<div class="p-4 flex justify-between items-center hover:bg-slate-50"><div><h5 class="font-black text-xs uppercase">${esc(s.name)}</h5><p class="text-[10px] text-slate-400">${s.duration} min · ${empDisplay} · ${s.desc||''}</p></div><div class="flex items-center gap-3"><span class="font-black text-teal-600">${s.price}€</span><button onclick="window.openServiceModal('${s.id}')" class="p-1 text-blue-500 hover:bg-blue-50 rounded"><i data-lucide="edit-3" class="w-4 h-4"></i></button><button onclick="window.deleteService('${s.id}')" class="p-1 text-red-400 hover:bg-red-50 rounded"><i data-lucide="trash-2" class="w-4 h-4"></i></button></div></div>`});html+='</div>'}
html+='</div>';c.innerHTML+=html});
window.borrarSinCategoria=async()=>{if(!confirm('¿Borrar TODOS los servicios sin categoría?'))return;const uncatL=servicesDB.filter(s=>!categoriesDB.find(c=>c.name===s.category));for(const s of uncatL){try{await deleteDoc(doc(db,'artifacts',AID,'public','data','services',s.id))}catch(e){}}};
const uncat=servicesDB.filter(s=>!categoriesDB.find(c=>c.name===s.category));
if(uncat.length>0){let html='<div class="bg-white rounded-3xl border shadow-sm overflow-hidden"><div class="p-4 bg-amber-50 border-b flex justify-between items-center"><span class="font-black uppercase text-sm text-amber-700">Sin categoría</span><button onclick="window.borrarSinCategoria()" class="text-[10px] bg-red-100 text-red-600 px-2 py-1 rounded-lg font-bold uppercase hover:bg-red-200 transition-colors cursor-pointer border border-red-200 flex items-center gap-1"><i data-lucide="trash-2" class="w-3 h-3"></i> Borrar Todos ('+uncat.length+')</button></div><div class="divide-y">';
uncat.forEach(s=>{html+=`<div class="p-4 flex justify-between items-center"><div><h5 class="font-black text-xs uppercase">${esc(s.name)}</h5></div><div class="flex items-center gap-3"><span class="font-black text-teal-600">${s.price}€</span><button onclick="window.openServiceModal('${s.id}')" class="p-1 text-blue-500 hover:bg-blue-50 rounded"><i data-lucide="edit-3" class="w-4 h-4"></i></button><button onclick="window.deleteService('${s.id}')" class="p-1 text-red-400 hover:bg-red-50 rounded"><i data-lucide="trash-2" class="w-4 h-4"></i></button></div></div>`});
html+='</div></div>';c.innerHTML+=html}lucide.createIcons()};
// ---- EMPLOYEES CRUD ----
window.openEmployeeModal=(id=null)=>{editingEmployeeId=id;document.getElementById('employee-modal').classList.remove('hidden');
document.getElementById('employee-modal-title').innerText=id?'Editar Empleado':'Nuevo Empleado';
const sel=document.getElementById('emp-specialty');const cur=sel.value;
sel.innerHTML='<option value="">— Sin especialidad —</option>'+categoriesDB.map(c=>'<option value="'+esc(c.name)+'">'+esc(c.name)+'</option>').join('');
if(id){const e=getEmpById(id);if(e){document.getElementById('emp-name').value=e.name;sel.value=e.specialty||'';document.getElementById('emp-color').value=e.color||'#a78bfa'}}
else{['emp-name'].forEach(i=>document.getElementById(i).value='');sel.value='';document.getElementById('emp-color').value='#a78bfa'}};
window.saveEmployee=async()=>{const d={name:document.getElementById('emp-name').value.trim(),specialty:document.getElementById('emp-specialty').value.trim(),color:document.getElementById('emp-color').value,updatedAt:new Date().toISOString()};
if(!d.name)return alert('Escribe un nombre');
if(editingEmployeeId)await updateDoc(doc(db,'artifacts',AID,'public','data','employees',editingEmployeeId),d);
else{d.createdAt=new Date().toISOString();await addDoc(collection(db,'artifacts',AID,'public','data','employees'),d)}
document.getElementById('employee-modal').classList.add('hidden')};
window.deleteEmployee=async id=>{if(!confirm('¿Eliminar este empleado?'))return;await deleteDoc(doc(db,'artifacts',AID,'public','data','employees',id))};
window.renderEmployeesMgmt=()=>{const c=document.getElementById('employees-mgmt-list');if(!c)return;c.innerHTML='';
if(employeesDB.length===0){c.innerHTML='<div class="col-span-full bg-white p-12 rounded-3xl border text-center text-slate-400"><p class="font-black uppercase">No hay empleados</p><p class="text-xs mt-2">Añade al menos un empleado para empezar.</p></div>';return}
employeesDB.forEach(e=>{c.innerHTML+=`<div class="bg-white rounded-3xl border shadow-sm p-6 flex flex-col items-center gap-4 hover:shadow-md transition-shadow"><div class="w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-black" style="background:${e.color||'#7c3aed'}">${e.name.substring(0,1).toUpperCase()}</div><div class="text-center"><h4 class="font-black uppercase text-sm">${esc(e.name)}</h4><p class="text-[10px] text-slate-400">${esc(e.specialty||'')}</p></div><div class="flex gap-2"><button onclick="window.openEmployeeModal('${e.id}')" class="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-black uppercase hover:bg-blue-100"><i data-lucide="edit-3" class="w-3 h-3 inline"></i> Editar</button><button onclick="window.deleteEmployee('${e.id}')" class="px-3 py-1.5 bg-red-50 text-red-500 rounded-lg text-[10px] font-black uppercase hover:bg-red-100"><i data-lucide="trash-2" class="w-3 h-3 inline"></i></button></div></div>`});
lucide.createIcons()};
window.renderSidebarEmployees=()=>{const c=document.getElementById('sidebar-employee-buttons');if(!c)return;c.innerHTML='';
employeesDB.forEach(e=>{c.innerHTML+=`<button onclick="window.setTab('calendar_emp_${e.id}')" id="tab-calendar_emp_${e.id}" class="w-full text-left p-3 rounded-xl hover:bg-white/40 flex items-center gap-3 transition-all text-slate-700 font-bold"><div class="w-5 h-5 rounded-full" style="background:${e.color||'#7c3aed'}"></div> ${esc(e.name)}</button>`})};
// ---- POPULATE MODAL SELECTS ----

const populateModalSelects=()=>{
    const ss=document.getElementById('m-service');
    if(ss){
        const cv=ss.value;ss.innerHTML='<option value="">Selecciona...</option>';
        const groups={};servicesDB.forEach(s=>{const cat=s.category||'Otros';if(!groups[cat])groups[cat]=[];groups[cat].push(s)});
        Object.keys(groups).forEach(g=>{let og=`<optgroup label="${g}">`;groups[g].forEach(s=>{og+=`<option value="${s.name}">${s.name} (${s.duration} min)</option>`});og+='</optgroup>';ss.innerHTML+=og});
        if(cv)ss.value=cv;
    }
    
    const es=document.getElementById('m-employee');
    if(es){
        const ev=es.value;es.innerHTML='';
        employeesDB.forEach(e=>{es.innerHTML+=`<option value="${e.name}">${e.name}</option>`});
        if(ev)es.value=ev;
    }

};



// admin-views.js — Calendar, Agenda, List, Clients, Billing, Config views
// This file is concatenated after admin-core.js into admin.js

// ---- DAILY CONFIG HELPER ----
const getDailyConfig=(dateStr,entity='global')=>{try{
    const sd=config.specialDays?.[dateStr];
    // 1) Override MANUAL de la empleada (por ID o por Nombre)
    let empOverride = null;
    if (entity !== 'global' && sd) {
        if (sd[entity] && !sd[entity]._auto) {
            empOverride = sd[entity];
        } else {
            const empByName = employeesDB.find(e => e.name.toLowerCase() === entity.toLowerCase());
            if (empByName && sd[empByName.id] && !sd[empByName.id]._auto) {
                empOverride = sd[empByName.id];
            } else {
                const empById = employeesDB.find(e => e.id === entity || String(e.id) === String(entity));
                if (empById && sd[empById.name] && !sd[empById.name]._auto) {
                    empOverride = sd[empById.name];
                }
            }
        }
    }
    if (empOverride) {
        console.log(`[DEBUG] Día ${dateStr} (${entity}): Override manual. Tipo: ${empOverride.type}`);
        return empOverride;
    }
    // 2) Estado del día especial global (si está configurado, sobrescribe horarios semanales o generales)
    if(sd?.global){
        if(sd.global.type==='closed') {
            console.log(`[DEBUG] Día ${dateStr} (${entity}): CERRADO por día especial GLOBAL.`);
            return {type:'closed'};
        } else if(sd.global.type==='split') {
            console.log(`[DEBUG] Día ${dateStr} (${entity}): Usando jornada partida especial GLOBAL del día.`);
            return {
                type: 'split',
                start: sd.global.start,
                end: sd.global.end,
                start2: sd.global.start2,
                end2: sd.global.end2
            };
        } else if(sd.global.type==='custom') {
            console.log(`[DEBUG] Día ${dateStr} (${entity}): Usando horario especial GLOBAL del día: ${sd.global.start}-${sd.global.end}`);
            return {
                type: 'custom',
                start: sd.global.start,
                end: sd.global.end,
                closedHours: sd.global.closedHours || []
            };
        }
    }
    let globalClosed=false, globalStart=null, globalEnd=null;
    const d=parseDate(dateStr);const day=d.getDay();
    // 2.5) Si el día de la semana está cerrado en el horario semanal general, se cierra para todos
    if (config?.weekly && config.weekly[day] && config.weekly[day].closed) {
        return { type: 'closed' };
    }
    // 3) Horario semanal individual
    let hasWeekly=false, weeklyClosed=false, weeklyStart=null, weeklyEnd=null, weeklyType=null, weeklyStart2=null, weeklyEnd2=null;
    if(entity!=='global'){
        const ew=config[`weekly_${entity}`];
        if(ew && ew[day]){
            hasWeekly=true;
            if(ew[day].closed) weeklyClosed=true;
            else{
                weeklyType=ew[day].type || 'standard';
                weeklyStart=ew[day].start;
                weeklyEnd=ew[day].end;
                if(weeklyType==='split'){
                    weeklyStart2=ew[day].start2;
                    weeklyEnd2=ew[day].end2;
                }
            }
        }
    }
    // 4) Global "Cerrado" → cierra a TODOS (festivo, etc)
    if(globalClosed){
        console.log(`[DEBUG] Día ${dateStr} (${entity}): CERRADO por día especial GLOBAL.`);
        return{type:'closed'};
    }
    // 5) Empleada con horario semanal → intersectar con global custom / global weekly
    if(hasWeekly){
        if(weeklyClosed){
            console.log(`[DEBUG] Día ${dateStr} (${entity}): Cerrado por horario SEMANAL del empleado (día ${day}).`);
            return{type:'closed'};
        }
        const gWeekly = config?.weekly?.[day];
        if (weeklyType === 'split') {
            let s1 = weeklyStart, e1 = weeklyEnd, s2 = weeklyStart2, e2 = weeklyEnd2;
            if (globalStart) {
                s1 = t2m(weeklyStart) > t2m(globalStart) ? weeklyStart : globalStart;
                e1 = t2m(weeklyEnd) < t2m(globalEnd) ? weeklyEnd : globalEnd;
                s2 = t2m(weeklyStart2) > t2m(globalStart) ? weeklyStart2 : globalStart;
                e2 = t2m(weeklyEnd2) < t2m(globalEnd) ? weeklyEnd2 : globalEnd;
            } else if (gWeekly && gWeekly.type === 'split') {
                s1 = t2m(weeklyStart) > t2m(gWeekly.start) ? weeklyStart : gWeekly.start;
                e1 = t2m(weeklyEnd) < t2m(gWeekly.end) ? weeklyEnd : gWeekly.end;
                s2 = t2m(weeklyStart2) > t2m(gWeekly.start2) ? weeklyStart2 : gWeekly.start2;
                e2 = t2m(weeklyEnd2) < t2m(gWeekly.end2) ? weeklyEnd2 : gWeekly.end2;
            }
            return { type: 'split', start: s1, end: e1, start2: s2, end2: e2 };
        }
        if (gWeekly && gWeekly.type === 'split' && !globalStart) {
            const s1 = t2m(weeklyStart) > t2m(gWeekly.start) ? weeklyStart : gWeekly.start;
            const e1 = t2m(weeklyEnd) < t2m(gWeekly.end) ? weeklyEnd : gWeekly.end;
            const s2 = t2m(weeklyStart) > t2m(gWeekly.start2) ? weeklyStart : gWeekly.start2;
            const e2 = t2m(weeklyEnd) < t2m(gWeekly.end2) ? weeklyEnd : gWeekly.end2;
            if (t2m(s2) < t2m(e2)) {
                return { type: 'split', start: s1, end: e1, start2: s2, end2: e2 };
            } else {
                return { type: 'standard', start: s1, end: e1 };
            }
        }
        const start = globalStart ? (t2m(weeklyStart)>t2m(globalStart)?weeklyStart:globalStart) : weeklyStart;
        const end = globalEnd ? (t2m(weeklyEnd)<t2m(globalEnd)?weeklyEnd:globalEnd) : weeklyEnd;
        return{type:'standard',start,end};
    }
    // 6) Global custom (empleada sin weekly)
    if(globalStart){
        console.log(`[DEBUG] Día ${dateStr} (${entity}): Usando cierre GLOBAL del día. ${globalStart}-${globalEnd}`);
        return{type:'standard',start:globalStart,end:globalEnd};
    }
    // 7) Horario semanal global
    if(config.weekly){
        const w=config.weekly[day];
        if(w){
            if(w.closed){
                console.log(`[DEBUG] Día ${dateStr} (${entity}): Cerrado por horario SEMANAL GLOBAL (día ${day}).`);
                return{type:'closed'};
            }
            if(w.type === 'split') {
                return { type: 'split', start: w.start, end: w.end, start2: w.start2, end2: w.end2 };
            }
            console.log(`[DEBUG] Día ${dateStr} (${entity}): Horario semanal global ${w.start}-${w.end}`);
            return{type:'standard',start:w.start,end:w.end};
        }
    }
    // 8) Por defecto
    console.log(`[DEBUG] Día ${dateStr} (${entity}): Abierto por defecto ${config.start||"09:00"}-${config.end||"20:00"}.`);
    return{type:'standard',start:config.start||"09:00",end:config.end||"20:00"}
}catch(err){console.error("❌ ERROR EN getDailyConfig:",err, {dateStr,entity});return{type:'standard',start:'09:00',end:'20:00'}}};

// ---- NAV & TAB ----
window.changeDate=offset=>{if(typeof offset!=='number')return;if(specialistViewLevel==='month'||specialistViewLevel==='global-day')currentViewDate.setMonth(currentViewDate.getMonth()+offset);else currentViewDate.setDate(currentViewDate.getDate()+offset);currentViewDate=new Date(currentViewDate.getTime());if(specialistViewLevel==='global-day')window.renderGlobalDay();else window.render()};
window.setTab=tab=>{window.closeSidebar();currentTab=tab;['calendar','appointments','billing','config','clients','global-day','services_mgmt','employees_mgmt','gastos','notifications','tpv'].forEach(v=>{const el=document.getElementById(`view-${v}`);if(el)el.classList.add('hidden')});
const nc=document.getElementById('nav-controls');
if(tab==='calendar_all'){specialistViewLevel='month';document.getElementById('view-calendar').classList.remove('hidden');nc.classList.remove('hidden')}
else if(tab.startsWith('calendar_emp_')){specialistViewLevel='month';document.getElementById('view-calendar').classList.remove('hidden');nc.classList.remove('hidden')}
else if(tab.startsWith('calendar_')){specialistViewLevel='month';document.getElementById('view-calendar').classList.remove('hidden');nc.classList.remove('hidden')}
else{const el=document.getElementById(`view-${tab}`);if(el)el.classList.remove('hidden');if(tab==='config')nc.classList.remove('hidden');else nc.classList.add('hidden')}
document.querySelectorAll('nav button').forEach(b=>{b.style.background='';b.style.color='';b.style.boxShadow='';b.style.fontWeight='';});
const ab=document.getElementById(`tab-${tab}`);if(ab){ab.style.background='white';ab.style.color='var(--blue-deep)';ab.style.boxShadow='0 2px 12px rgba(91,143,160,.15)';ab.style.fontWeight='800';}
document.getElementById('btn-back-to-month').classList.add('hidden');
if(tab==='config'){
  // Delay rendering config until next tick so DOM is ready
  setTimeout(()=>{window.renderStandardInputs();window.renderConfigEntityTabs();renderMonthGrid('config-calendar-body',true)},0);
}
if(tab==='clients')window.renderClients();
if(tab==='services_mgmt')window.renderServicesMgmt();
if(tab==='employees_mgmt')window.renderEmployeesMgmt();
if(tab==='gastos')window.renderExpenses();
if(tab==='notifications')renderLocalNotifs();
window.render()};
window.backToMonth=()=>{specialistViewLevel='month';document.getElementById('view-calendar').classList.remove('hidden');document.getElementById('btn-back-to-month').classList.add('hidden');window.render()};
window.showMonthView=()=>{specialistViewLevel='month';document.getElementById('view-global-day').classList.add('hidden');document.getElementById('view-calendar').classList.remove('hidden');window.render()};

// ---- RENDER SPECIALIST DAY VIEW — Google Calendar style ----
window.renderSpecialistDayView=()=>{
try{
    const eid=currentTab.replace('calendar_emp_','');
    const emp=getEmpById(eid);
    if(!emp)return;

    const ds=getLD(currentViewDate);
    if(document.getElementById('current-view-label'))
        document.getElementById('current-view-label').innerText=
            currentViewDate.toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
    if(document.getElementById('view-title'))
        document.getElementById('view-title').innerText='Agenda: '+emp.name;

    const container=document.getElementById('timeline-container');
    if(!container)return;

    const empColor=emp.color||'#7c3aed';
    const dc=getDailyConfig(ds,emp.name);

    // Horario del día
    const openStr  = dc.type==='closed'?'09:00':(dc.start||config.start||'09:00');
    const closeStr = dc.type==='closed'?'20:00':(dc.end  ||config.end  ||'20:00');
    const gStartH = parseInt(config.start||'09:00',10);
    const gEndH = Math.ceil(parseInt(config.end||'20:00',10));
    const eStartH = parseInt(openStr.split(':')[0],10);
    const eEndH = Math.ceil(parseInt(closeStr.split(':')[0],10)+(parseInt(closeStr.split(':')[1]||'0',10)>0?1:0));
    const startH = Math.min(gStartH, eStartH, 9);
    const endH = Math.max(gEndH, eEndH, 20);
    const startMin = startH * 60;
    const endMin = endH * 60;

    const PX_PER_MIN = 1.2; // 72px por hora → 1.2px por minuto
    const HOUR_PX    = 60 * PX_PER_MIN;
    const totalHours = endH - startH;
    const totalPx    = totalHours * HOUR_PX;

    // Citas del empleado ese día
    const dayApts=appointments
        .filter(function(a){return a.date===ds&&(a.employee===emp.name||(a.services&&a.services.some(function(s){return s.employee===emp.name}))||(a.employee||'').split(',').map(function(e){return e.trim()}).includes(emp.name))})
        .sort(function(a,b){return a.time.localeCompare(b.time)});
    const activeCount=dayApts.filter(a=>a.status!=='cancelled').length;

    // ── CABECERA ──────────────────────────────────────────────────────────────
    let html=`
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;padding-bottom:14px;border-bottom:2px solid #f0ebe6">
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
                <div style="width:12px;height:12px;border-radius:50%;background:${empColor};flex-shrink:0"></div>
                <span style="font-size:15px;font-weight:800;color:#2e2826;letter-spacing:.5px;text-transform:uppercase">${esc(emp.name)}</span>
                <span style="font-size:11px;font-weight:700;padding:3px 10px;border-radius:99px;background:#f0ebe6;color:#7a6b67">${openStr} – ${closeStr}</span>
                <span style="font-size:11px;font-weight:700;padding:3px 10px;border-radius:99px;color:white;background:${empColor}">${activeCount} citas</span>
            </div>
            <div style="display:flex;gap:8px;flex-shrink:0">
              <button onclick="window.openBlockModal('${emp.name.replace(/'/g,"\\'")}','${ds}')"
                  style="background:#f97316;color:white;border:none;padding:8px 14px;border-radius:10px;font-size:11px;font-weight:700;cursor:pointer">
                  🔒 Bloquear
              </button>
              <button onclick="window.openNewAptForDay('${ds}','${emp.name.replace(/'/g,"\\'")}')"
                  style="background:${empColor};color:white;border:none;padding:8px 16px;border-radius:10px;font-size:12px;font-weight:700;cursor:pointer">
                  + Nueva cita
              </button>
            </div>
        </div>`;

    if(dc.type==='closed'){
        html+=`<div style="text-align:center;padding:60px 20px">
            <div style="font-size:36px;margin-bottom:10px">🔒</div>
            <p style="font-size:16px;font-weight:700;color:#2e2826">Día cerrado</p>
            <p style="font-size:13px;margin-top:6px;color:#7a6b67">${esc(emp.name)} no trabaja este día</p>
        </div>`;
        container.innerHTML=html;
        return;
    }

    // ── TIMELINE GOOGLE CALENDAR ───────────────────────────────────────────────
    // Estructura: columna de horas (fija 52px) + columna de eventos (flex)
    // El wrapper de eventos tiene height explícita en px — esto es lo que siempre faltaba
    html+=`
        <div style="display:flex;gap:0;font-family:monospace">
            <!-- Columna horas -->
            <div style="width:52px;flex-shrink:0;position:relative;height:${totalPx}px">`;

    for(let h=startH;h<endH;h++){
        const topPx=(h-startH)*HOUR_PX;
        html+=`<div style="position:absolute;top:${topPx}px;left:0;width:44px;text-align:right;font-size:10px;font-weight:700;color:#7a6b67;padding-right:6px;line-height:1">
            ${String(h).padStart(2,'0')}:00
        </div>`;
    }

    html+=`</div>
            <!-- Columna eventos -->
            <div style="flex:1;position:relative;height:${totalPx}px;border-left:1px solid #e0d8d5">`;

    // Líneas de hora
    for(let h=startH;h<endH;h++){
        const topPx=(h-startH)*HOUR_PX;
        html+=`<div style="position:absolute;top:${topPx}px;left:0;right:0;border-top:1px solid #e0d8d5;pointer-events:none"></div>`;
        // Media hora
        html+=`<div style="position:absolute;top:${topPx+HOUR_PX/2}px;left:0;right:0;border-top:1px dashed #f0ebe6;pointer-events:none"></div>`;
    }

    // Línea de hora actual (si es hoy)
    const todayStr=getLD(new Date());
    if(ds===todayStr){
        const now=new Date();
        const nowMin=now.getHours()*60+now.getMinutes();
        if(nowMin>=startMin&&nowMin<=endMin){
            const nowPx=(nowMin-startMin)*PX_PER_MIN;
            html+=`<div style="position:absolute;top:${nowPx}px;left:0;right:0;height:2px;background:#ef4444;z-index:30">
                <div style="position:absolute;left:-5px;top:-4px;width:10px;height:10px;border-radius:50%;background:#ef4444"></div>
            </div>`;
        }
    }

    // Bloques de horario (blocks) — se muestran como "citas" naranjas
    const empBlocks=window.loadBlocksForDate(ds,emp.name);
    empBlocks.forEach(bl=>{
      const blStart=t2m(bl.startTime);
      const blEnd=t2m(bl.endTime);
      const blTopPx=(blStart-startMin)*PX_PER_MIN;
      const blHeightPx=Math.max((blEnd-blStart)*PX_PER_MIN-2,24);
      const recLabel = bl.recurrence==='daily'?'Diario':bl.recurrence==='weekly'?'Semanal':bl.recurrence==='biweekly'?'Bisemanal':'';
      html+=`<div title="🔒 ${esc(bl.reason)} (${bl.startTime}–${bl.endTime})${recLabel?' — '+recLabel:''}"
        style="position:absolute;top:${blTopPx}px;left:4px;right:4px;height:${blHeightPx}px;
          background:repeating-linear-gradient(135deg,#fff7ed,#fff7ed 8px,#ffedd5 8px,#ffedd5 16px);
          border-left:4px solid #f97316;border-radius:8px;
          padding:4px 8px;overflow:hidden;z-index:8;
          box-shadow:0 2px 6px rgba(249,115,22,.18);cursor:default;
          display:flex;flex-direction:column;justify-content:flex-start">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:4px">
          <span style="font-size:11px;font-weight:900;color:#c2410c;font-family:monospace">${bl.startTime} – ${bl.endTime}</span>
          <button onclick="event.stopPropagation();window.deleteBlock('${bl.id}')" style="background:#fef2f2;border:1px solid #fca5a5;color:#dc2626;font-size:9px;font-weight:800;padding:2px 6px;border-radius:6px;cursor:pointer;line-height:1" title="Eliminar bloqueo">✕</button>
        </div>
        ${blHeightPx>28?`<div style="font-size:10px;font-weight:800;color:#ea580c;text-transform:uppercase;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:2px">🔒 ${esc(bl.reason)}</div>`:''}
        ${blHeightPx>44&&recLabel?`<div style="font-size:8px;color:#c2410c;opacity:.75">${recLabel}</div>`:''}
      </div>`;
    });

    // Citas
    const visualBlocks = [];
    dayApts.forEach(apt => {
        visualBlocks.push(...getAptServiceBlocks(apt));
    });
    const filteredBlocks = visualBlocks.filter(b => {
        const bEmp = (b.employee || '').toLowerCase();
        const curEmp = emp.name.toLowerCase();
        return bEmp === curEmp || bEmp === 'todas' || bEmp === 'cualquiera' || bEmp === 'ambos';
    });

    filteredBlocks.forEach(b=>{
        const apt=b.apt;
        const aptStart=t2m(b.time);
        const aptDur=b.duration;
        const topPx=(aptStart-startMin)*PX_PER_MIN;
        const heightPx=Math.max(aptDur*PX_PER_MIN-2, 24);

        let bg,border,textCol='#2e2826';
        if(apt.status==='cancelled')    {bg='#fef2f2';border='#ef4444';textCol='#991b1b';}
        else if(apt.status==='completed'){bg='#f0fdf4';border='#22c55e';}
        else if(apt.status==='confirmed'){bg=empColor+'22';border=empColor;}
        else                            {bg='#fffbeb';border='#f59e0b';}

        const paidDot=apt.isPaid?`<span style="font-size:8px;background:rgba(34,197,94,.2);color:#166534;padding:1px 5px;border-radius:99px;font-weight:700">✓</span>`:'';
        const svcLabel = b.totalServices > 1 ? `<span style="font-size:8px;opacity:.7;font-weight:bold;margin-left:4px">(${b.index + 1}/${b.totalServices})</span>` : '';

        html+=`<div onclick="window.openModal('${apt.id}')"
            title="${esc(apt.clientName)} — ${esc(b.serviceName)} (${b.time}, ${aptDur}min)"
            style="
                position:absolute;
                top:${topPx}px;
                left:4px;right:4px;
                height:${heightPx}px;
                background:${bg};
                border-left:4px solid ${border};
                border-radius:8px;
                padding:4px 8px;
                cursor:pointer;
                overflow:hidden;
                box-shadow:0 2px 6px rgba(0,0,0,.08);
                z-index:10;
                transition:box-shadow .15s,transform .1s;
                display:flex;flex-direction:column;justify-content:flex-start"
            onmouseover="this.style.boxShadow='0 4px 14px rgba(0,0,0,.18)';this.style.transform='scale(1.01)';this.style.zIndex='20'"
            onmouseout="this.style.boxShadow='0 2px 6px rgba(0,0,0,.08)';this.style.transform='';this.style.zIndex='10'">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:4px">
                <span style="font-size:11px;font-weight:900;color:${textCol};font-family:monospace">${b.time}</span>
                <span style="font-size:9px;font-weight:600;color:${textCol};opacity:.7">${aptDur}m${svcLabel}</span>
                ${paidDot}
            </div>
            ${heightPx>26?`<div style="font-size:11px;font-weight:800;color:${textCol};text-transform:uppercase;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:1px">${esc(apt.clientName||apt.name||'?')}</div>`:''}
            ${heightPx>44?`<div style="font-size:9px;color:${textCol};opacity:.75;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(b.serviceName)}</div>`:''}
        </div>`;
    });

    html+=`</div></div>`; // cierra columna eventos + flex wrapper

    container.innerHTML=html;
    if(window.lucide)lucide.createIcons();

}catch(err){
    console.error('❌ renderSpecialistDayView:',err);
    const c=document.getElementById('timeline-container');
    if(c)c.innerHTML='<div style="padding:40px;text-align:center;color:#ef4444;font-weight:700">Error: '+err.message+'</div>';
}
};

// Abrir modal de nueva cita preseleccionando empleado y fecha
window.openNewAptForDay=(ds,empName)=>{
    selectedDayInModal=ds;
    window.openModal(null);
    setTimeout(()=>{
        const dateInput=document.getElementById('m-date');
        const empSelect=document.getElementById('m-employee');
        if(dateInput)dateInput.value=ds;
        if(empSelect)empSelect.value=empName;
        window.updateAvailability();
    },50);
};

// ---- RENDER GLOBAL DAY ----
window.renderGlobalDay=()=>{const ds=getLD(currentViewDate);const label=document.getElementById('current-view-label');if(label)label.innerText=currentViewDate.toLocaleDateString('es-ES',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
const title=document.getElementById('view-title');if(title)title.innerText="Agenda Global (Hoy)";
const cols=document.getElementById('global-day-columns');if(!cols)return;cols.innerHTML='';
const gc=getDailyConfig(ds,'global');if(gc.type==='closed'){cols.innerHTML='<div class="col-span-full text-center py-20 text-slate-400 font-black uppercase">Centro cerrado hoy</div>';return}
const todayApts=appointments.filter(a=>a.date===ds&&a.status!=='cancelled');
window.renderMultiEmpTimeline(ds, todayApts, cols);
if(employeesDB.length===0)cols.innerHTML='<div class="col-span-full text-center py-20 text-slate-400"><p class="font-black uppercase">Añade empleados primero</p></div>';
lucide.createIcons()};

// ---- OPEN DAY MODAL ----
window.openDayModal=(ds,empFilter=null)=>{
if(!/^\d{4}-\d{2}-\d{2}$/.test(ds))return;
selectedDayInModal=ds;
document.getElementById('day-modal').classList.remove('hidden');
const[y,mo,d]=ds.split('-').map(Number);
const f=new Date(y,mo-1,d);
const dateStr=f.toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'});
document.getElementById('day-modal-title').innerText=dateStr.charAt(0).toUpperCase()+dateStr.slice(1);

const cols=document.getElementById('day-modal-columns');
cols.innerHTML='';
cols.style.gridTemplateColumns='';

const dayApts=appointments
  .filter(a=>a.date===ds&&a.status!=='cancelled')
  .sort((a,b)=>a.time.localeCompare(b.time));

// ── SINGLE EMPLOYEE — Google Calendar style ───────────────────────────────
if(empFilter){
  const emp=employeesDB.find(e=>e.name===empFilter)||{name:empFilter,color:'#7c3aed'};
  const dc=getDailyConfig(ds,emp.name);
  const openStr=dc.type==='closed'?'09:00':(dc.start||config.start||'09:00');
  const closeStr=dc.type==='closed'?'20:00':(dc.end||config.end||'20:00');
  const empApts=dayApts.filter(function(a){return empInApt(a,emp.name)});
  let empServicesCount = 0;
  empApts.forEach(a => {
    if (a.services && Array.isArray(a.services) && a.services.length > 0) {
      const svcs = a.services.filter(s => (s.employee || '').toLowerCase() === emp.name.toLowerCase() || !s.employee || s.employee === 'Todas' || s.employee === 'Cualquiera');
      empServicesCount += (svcs.length > 0 ? svcs.length : 1);
    } else {
      empServicesCount += 1;
    }
  });
  const empAptsLabel = empServicesCount === 1 ? '1 cita' : `${empServicesCount} citas`;
  const startH=parseInt(openStr.split(':')[0],10);
  const endH=Math.ceil(parseInt(closeStr.split(':')[0],10)+(parseInt(closeStr.split(':')[1]||'0',10)>0?1:0));
  const PX=64; // px per hour
  const totalPx=(endH-startH)*PX;
  const empColor=emp.color||'#7c3aed';
  const empBlocks=window.loadBlocksForDate(ds,emp.name);
  const empOverride = config.specialDays?.[ds]?.[emp.id] || config.specialDays?.[ds]?.[emp.name];
  const hasBlocks = empBlocks.length > 0;
  const hasOverride = empOverride && !empOverride._auto;
  const showRestore = hasBlocks || hasOverride;

  cols.style.gridTemplateColumns='1fr';

  let html='<div style="display:flex;flex-direction:column;height:100%">';

  // Header
  html+=`<div style="display:flex;align-items:center;justify-content:space-between;padding:0 0 16px 0;border-bottom:1px solid #f0ebe6;margin-bottom:16px">
    <div style="display:flex;align-items:center;gap:10px">
      <div style="width:12px;height:12px;border-radius:50%;background:${empColor}"></div>
      <span style="font-size:14px;font-weight:800;color:#2e2826;text-transform:uppercase;letter-spacing:.5px">${esc(emp.name)}</span>
      <span style="font-size:11px;font-weight:600;padding:2px 10px;border-radius:99px;background:#f0ebe6;color:#7a6b67">${openStr} – ${closeStr}</span>
      <span style="font-size:11px;font-weight:700;padding:2px 10px;border-radius:99px;color:white;background:${empColor}">${empAptsLabel}</span>
    </div>
    <div style="display:flex;gap:8px">
      ${showRestore ? `
      <button onclick="window.restoreDayForEmp('${ds}','${emp.name.replace(/'/g,"\\'")}');"
        style="background:#ea580c;color:white;border:none;padding:7px 14px;border-radius:10px;font-size:11px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:4px">
        🔁 Restaurar horario
      </button>
      ` : ''}
      <button onclick="window.closeDayModal();window.openBlockModal('${emp.name.replace(/'/g,"\\'")}','${ds}')"
        style="background:#f97316;color:white;border:none;padding:7px 14px;border-radius:10px;font-size:11px;font-weight:700;cursor:pointer">
        🔒 Bloquear
      </button>
      <button onclick="window.closeDayModal();window.openNewAptForDay('${ds}','${emp.name.replace(/'/g,"\\'")}');"
        style="background:${empColor};color:white;border:none;padding:7px 14px;border-radius:10px;font-size:12px;font-weight:700;cursor:pointer">
        + Nueva cita
      </button>
    </div>
  </div>`;

  if(dc.type==='closed'){
    html+=`<div style="flex:1;display:flex;align-items:center;justify-content:center;color:#7a6b67">
      <div style="text-align:center">
        <div style="font-size:32px;margin-bottom:8px">🚫</div>
        <p style="font-weight:700;font-size:14px;color:#ef4444;margin-bottom:12px">Este día está cerrado</p>
        ${showRestore ? `
        <button onclick="window.restoreDayForEmp('${ds}','${emp.name.replace(/'/g,"\\'")}');"
          style="background:#ef4444;color:white;border:none;padding:8px 16px;border-radius:12px;font-size:11px;font-weight:800;cursor:pointer;text-transform:uppercase;box-shadow:0 4px 12px rgba(239,68,68,0.2)">
          Restaurar horario normal
        </button>
        ` : ''}
      </div>
    </div>`;
  } else {
    // Determine bounds
    const gStartH=parseInt(config.start||'09:00',10);
    const gEndH=Math.ceil(parseInt(config.end||'20:00',10));
    const eStartH=parseInt(openStr.split(':')[0],10);
    const eEndH=Math.ceil(parseInt(closeStr.split(':')[0],10)+(parseInt(closeStr.split(':')[1]||'0',10)>0?1:0));
    const startH=Math.min(gStartH,eStartH,9);
    const endH=Math.max(gEndH,eEndH,20);
    const totalPx=(endH-startH)*PX;

    // Google Calendar timeline
    html+=`<div style="display:flex;flex:1;overflow-y:auto">
      <div style="width:54px;flex-shrink:0;position:relative;height:${totalPx}px">`;
    for(let h=startH;h<endH;h++){
      html+=`<div style="position:absolute;top:${(h-startH)*PX}px;right:6px;font-size:10px;font-weight:700;color:#7a6b67;line-height:1;white-space:nowrap">${String(h).padStart(2,'0')}:00</div>`;
    }
    html+=`</div><div style="flex:1;position:relative;height:${totalPx}px;border-left:1px solid #e0d8d5">`;

    // Hour lines
    for(let h=startH;h<endH;h++){
      html+=`<div style="position:absolute;top:${(h-startH)*PX}px;left:0;right:0;border-top:1px solid #e0d8d5;pointer-events:none"></div>`;
      html+=`<div style="position:absolute;top:${(h-startH)*PX+PX/2}px;left:0;right:0;border-top:1px dashed #f0ebe6;pointer-events:none"></div>`;
    }

    // Current time line (if today)
    const todayStr=getLD(new Date());
    if(ds===todayStr){
      const now=new Date();const nm=now.getHours()*60+now.getMinutes();const sm=startH*60;
      if(nm>=sm&&nm<=endH*60){
        const tp=(nm-sm)/60*PX;
        html+=`<div style="position:absolute;top:${tp}px;left:0;right:0;height:2px;background:#ef4444;z-index:30"><div style="position:absolute;left:-4px;top:-4px;width:8px;height:8px;border-radius:50%;background:#ef4444"></div></div>`;
      }
    }

    // Blocks
    const empBlocks=window.loadBlocksForDate(ds,emp.name);
    empBlocks.forEach(bl=>{
      const rawStart = parseInt(bl.startTime.split(':')[0],10)*60 + parseInt(bl.startTime.split(':')[1],10);
      const rawEnd = parseInt(bl.endTime.split(':')[0],10)*60 + parseInt(bl.endTime.split(':')[1],10);
      const sm2 = startH * 60;
      const blStartM = Math.max(rawStart, sm2);
      const blEndM = Math.min(rawEnd, endH * 60);
      const blTopPx = (blStartM - sm2)/60*PX;
      const blHeightPx = Math.max((blEndM - blStartM)/60*PX - 2, 24);
      const recLabel = bl.recurrence==='daily'?'Diario':bl.recurrence==='weekly'?'Semanal':bl.recurrence==='biweekly'?'Bisemanal':'';
      html+=`<div onclick="window.deleteBlock('${bl.id}')" title="Haga clic para eliminar. 🔒 ${esc(bl.reason)} (${bl.startTime}-${bl.endTime})${recLabel?' - '+recLabel:''}"
        style="position:absolute;top:${blTopPx}px;left:4px;right:4px;height:${blHeightPx}px;
          background:repeating-linear-gradient(135deg,#fff7ed,#fff7ed 8px,#ffedd5 8px,#ffedd5 16px);
          border-left:4px solid #f97316;border-radius:8px;
          padding:3px 8px;cursor:pointer;overflow:hidden;z-index:5;
          box-shadow:0 2px 6px rgba(0,0,0,.04);"
        onmouseover="this.style.boxShadow='0 4px 12px rgba(249,115,22,0.2)';this.style.transform='scaleX(1.02)'"
        onmouseout="this.style.boxShadow='0 2px 6px rgba(0,0,0,.04)';this.style.transform=''">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:5px;width:100%">
          <div style="display:flex;align-items:center;gap:5px">
            <span style="font-size:11px;font-weight:900;font-family:monospace;color:#c2410c">${bl.startTime}</span>
            <span style="font-size:9px;color:#f97316;font-weight:bold">🔒 BLOQUEADO</span>
          </div>
          <button onclick="event.stopPropagation(); window.deleteBlock('${bl.id}')"
            style="background:#ea580c;color:white;border:none;padding:2px 6px;border-radius:4px;font-size:9px;font-weight:800;cursor:pointer;display:inline-flex;align-items:center;gap:3px;margin-left:auto;z-index:20;box-shadow:0 1px 2px rgba(0,0,0,0.1)">
            Restaurar horario
          </button>
        </div>
        <div style="font-size:11px;font-weight:800;color:#c2410c;text-transform:uppercase;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:2px">${esc(bl.reason)}</div>
      </div>`;
    });

    // Appointments
    const visualBlocks = [];
    empApts.forEach(apt => {
      visualBlocks.push(...getAptServiceBlocks(apt));
    });
    const filteredBlocks = visualBlocks.filter(b => {
      const bEmp = (b.employee || '').toLowerCase();
      const curEmp = emp.name.toLowerCase();
      return bEmp === curEmp || bEmp === 'todas' || bEmp === 'cualquiera' || bEmp === 'ambos';
    });

    filteredBlocks.forEach(b=>{
      const apt = b.apt;
      const sm2=startH*60;
      const aptM=parseInt((b.time||'00:00').split(':')[0],10)*60+parseInt((b.time||'00:00').split(':')[1]||'0',10);
      const dur=b.duration;
      const topPx=(aptM-sm2)/60*PX;
      const hPx=Math.max(dur/60*PX-2,22);
      let bg,bord;
      if(apt.status==='cancelled'){bg='#fef2f2';bord='#ef4444';}
      else if(apt.status==='completed'){bg='#f0fdf4';bord='#22c55e';}
      else if(apt.status==='confirmed'){bg=empColor+'20';bord=empColor;}
      else{bg='#fffbeb';bord='#f59e0b';}
      const paid=apt.isPaid?'<span style="font-size:8px;font-weight:700;background:rgba(34,197,94,.2);color:#166534;padding:1px 5px;border-radius:99px">✓</span>':'';
      const svcLabel = b.totalServices > 1 ? `<span style="font-size:8px;opacity:.7;font-weight:bold;margin-left:4px">(${b.index + 1}/${b.totalServices})</span>` : '';

      html+=`<div onclick="window.openModal('${apt.id}')"
        title="${esc(apt.clientName)} · ${esc(b.serviceName)} (${b.time}, ${dur}min)"
        style="position:absolute;top:${topPx}px;left:4px;right:4px;height:${hPx}px;
          background:${bg};border-left:4px solid ${bord};border-radius:8px;
          padding:3px 8px;cursor:pointer;overflow:hidden;z-index:10;
          box-shadow:0 2px 6px rgba(0,0,0,.08);transition:box-shadow .15s,transform .1s"
        onmouseover="this.style.boxShadow='0 4px 14px rgba(0,0,0,.18)';this.style.transform='scaleX(1.01)';this.style.zIndex=20"
        onmouseout="this.style.boxShadow='0 2px 6px rgba(0,0,0,.08)';this.style.transform='';this.style.zIndex=10">
        <div style="display:flex;align-items:center;gap:5px">
          <span style="font-size:11px;font-weight:900;font-family:monospace;color:#2e2826">${b.time}</span>
          <span style="font-size:9px;color:#7a6b67">${dur}m${svcLabel}</span>${paid}
        </div>
        ${hPx>26?`<div style="font-size:11px;font-weight:800;color:#2e2826;text-transform:uppercase;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(apt.clientName||apt.name||'?')}</div>`:''}
        ${hPx>44?`<div style="font-size:9px;color:#7a6b67;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(b.serviceName)}</div>`:''}
      </div>`;
    });

    html+=`</div></div>`; // close timeline
  }
  html+='</div>';
  cols.innerHTML=html;

// ── ALL EMPLOYEES — classic column layout ────────────────────────────────
} else {
  const empsToShow=employeesDB;
  cols.style.gridTemplateColumns=`repeat(${Math.max(empsToShow.length,1)},1fr)`;
  empsToShow.forEach(emp=>{
    const ea=dayApts.filter(function(a){return empInApt(a,emp.name)});
    let html=`<div class="bg-white rounded-2xl shadow-sm border overflow-hidden flex flex-col">
      <div class="p-3 border-b flex items-center justify-center gap-2 sticky top-0 z-20" style="background:${emp.color}10">
        <div class="w-2 h-2 rounded-full" style="background:${emp.color}"></div>
        <span class="font-black uppercase tracking-widest text-xs" style="color:${emp.color}">${esc(emp.name)}</span>
      </div>
      <div class="flex flex-col gap-3 p-4 overflow-y-auto" style="max-height:780px">`;
    if(ea.length===0)html+='<div class="text-center text-slate-400 mt-10 text-xs italic">Sin citas</div>';
    else {
      const visualBlocks = [];
      ea.forEach(apt => {
        visualBlocks.push(...getAptServiceBlocks(apt));
      });
      const filteredBlocks = visualBlocks.filter(b => {
        const bEmp = (b.employee || '').toLowerCase();
        const curEmp = emp.name.toLowerCase();
        return bEmp === curEmp || bEmp === 'todas' || bEmp === 'cualquiera' || bEmp === 'ambos';
      });

      filteredBlocks.forEach(b => {
        const apt = b.apt;
        let cc='bg-white border-l-4 border-slate-300';
        if(apt.status==='confirmed')cc='border-l-4';
        else if(apt.status==='completed')cc='bg-emerald-50 border-emerald-500';
        else if(apt.status==='pending')cc='bg-amber-50 border-amber-400';

        const svcLabel = b.totalServices > 1 ? `<span style="font-size:10px;opacity:.7;font-weight:bold;margin-left:4px">(${b.index + 1}/${b.totalServices})</span>` : '';

        html+=`<div onclick="window.openModal('${apt.id}')" class="p-3 rounded-xl shadow-sm hover:shadow-md cursor-pointer transition-all ${cc}" style="border-color:${emp.color}">
          <div class="flex justify-between items-center mb-1">
            <span class="font-black text-lg text-slate-800">${b.time}</span>
            <span class="text-[10px] uppercase font-bold text-slate-500 bg-white px-2 py-0.5 rounded-full shadow-sm">${b.duration} min${svcLabel}</span>
          </div>
          <div class="font-black text-sm uppercase text-slate-700 truncate">${esc(apt.clientName||apt.name)}</div>
          <div class="text-xs text-slate-500 truncate">${esc(b.serviceName)}</div>
        </div>`;
      });
    }
    html+='</div></div>';
    cols.innerHTML+=html;
  });
  if(empsToShow.length===0)cols.innerHTML='<div class="col-span-full text-center py-20 text-slate-400 font-black uppercase">No hay empleados</div>';
}
if(window.lucide) lucide.createIcons();
};

window.renderMultiEmpTimeline = (ds, dayApts, container) => {
  const gStartH=parseInt(config.start||'09:00',10);
  const gEndH=Math.ceil(parseInt(config.end||'20:00',10));
  
  let eStartH = 24, eEndH = 0;
  employeesDB.forEach(emp => {
    const dc = getDailyConfig(ds, emp.name);
    const os = dc.type==='closed' ? gStartH : parseInt((dc.start||config.start||'09:00').split(':')[0],10);
    const cs = dc.type==='closed' ? gEndH : Math.ceil(parseInt((dc.end||config.end||'20:00').split(':')[0],10)+(parseInt((dc.end||config.end||'20:00').split(':')[1]||'0',10)>0?1:0));
    if(os < eStartH) eStartH = os;
    if(cs > eEndH) eEndH = cs;
  });
  
  const startH = Math.min(gStartH, eStartH, 9);
  const endH = Math.max(gEndH, eEndH, 20);
  const PX = 64;
  const totalPx = (endH - startH) * PX;
  
  container.style.gridTemplateColumns = '1fr';
  
  let html = `<div style="display:flex;flex-direction:column;height:100%;min-width:${employeesDB.length * 120}px">`;
  
  html += `<div style="display:flex;padding-bottom:12px;border-bottom:1px solid #f0ebe6;margin-bottom:12px;position:sticky;top:0;background:white;z-index:40">
    <div style="width:54px;flex-shrink:0"></div>`; 
  
  employeesDB.forEach(emp => {
    html += `<div style="flex:1;text-align:center;border-left:1px solid #e0d8d5">
      <div style="display:inline-flex;align-items:center;gap:6px">
        <div style="width:10px;height:10px;border-radius:50%;background:${emp.color||'#7c3aed'}"></div>
        <span style="font-size:12px;font-weight:800;color:#2e2826;text-transform:uppercase">${esc(emp.name)}</span>
      </div>
    </div>`;
  });
  html += `</div>`;

  html += `<div style="display:flex;flex:1;position:relative">
    <div style="width:54px;flex-shrink:0;position:relative;height:${totalPx}px">`;
  for(let h=startH;h<endH;h++){
    html+=`<div style="position:absolute;top:${(h-startH)*PX}px;right:6px;font-size:10px;font-weight:700;color:#7a6b67;line-height:1;margin-top:-5px">${String(h).padStart(2,'0')}:00</div>`;
  }
  html+=`</div>`;

  employeesDB.forEach(emp => {
    html += `<div style="flex:1;position:relative;height:${totalPx}px;border-left:1px solid #e0d8d5">`;
    
    for(let h=startH;h<endH;h++){
      html+=`<div style="position:absolute;top:${(h-startH)*PX}px;left:0;right:0;border-top:1px solid #e0d8d5;pointer-events:none"></div>`;
      html+=`<div style="position:absolute;top:${(h-startH)*PX+PX/2}px;left:0;right:0;border-top:1px dashed #f0ebe6;pointer-events:none"></div>`;
    }

    const todayStr=getLD(new Date());
    if(ds===todayStr){
      const now=new Date();const nm=now.getHours()*60+now.getMinutes();const sm=startH*60;
      if(nm>=sm&&nm<=endH*60){
        const tp=(nm-sm)/60*PX;
        html+=`<div style="position:absolute;top:${tp}px;left:0;right:0;height:2px;background:#ef4444;z-index:30"></div>`;
      }
    }

    const empBlocks=window.loadBlocksForDate(ds,emp.name);
    empBlocks.forEach(bl=>{
      const blStartM = parseInt(bl.startTime.split(':')[0],10)*60 + parseInt(bl.startTime.split(':')[1],10);
      const blEndM = parseInt(bl.endTime.split(':')[0],10)*60 + parseInt(bl.endTime.split(':')[1],10);
      const sm2 = startH * 60;
      const blTopPx = (blStartM - sm2)/60*PX;
      const blHeightPx = Math.max((blEndM - blStartM)/60*PX - 2, 16);
      html+=`<div onclick="window.deleteBlock('${bl.id}')" title="Haga clic para eliminar. 🔒 ${esc(bl.reason)} (${bl.startTime}-${bl.endTime})"
        style="position:absolute;top:${blTopPx}px;left:2px;right:2px;height:${blHeightPx}px;
          background:repeating-linear-gradient(135deg,#fff7ed,#fff7ed 8px,#ffedd5 8px,#ffedd5 16px);
          border-left:3px solid #f97316;border-radius:6px;
          padding:2px 4px;cursor:pointer;overflow:hidden;z-index:5;transition:transform 0.1s;"
        onmouseover="this.style.transform='scaleX(1.02)'" onmouseout="this.style.transform=''">
        <div style="font-size:9px;font-weight:900;color:#c2410c">${bl.startTime} 🔒</div>
      </div>`;
    });

    const ea=dayApts.filter(function(a){return empInApt(a,emp.name)});
    const visualBlocks = [];
    ea.forEach(apt => {
      visualBlocks.push(...getAptServiceBlocks(apt));
    });
    const filteredBlocks = visualBlocks.filter(b => {
      const bEmp = (b.employee || '').toLowerCase();
      const curEmp = emp.name.toLowerCase();
      return bEmp === curEmp || bEmp === 'todas' || bEmp === 'cualquiera' || bEmp === 'ambos';
    });

    filteredBlocks.forEach(b=>{
      const apt = b.apt;
      const sm2=startH*60;
      const aptM=parseInt((b.time||'00:00').split(':')[0],10)*60+parseInt((b.time||'00:00').split(':')[1]||'0',10);
      const dur=b.duration;
      const topPx=(aptM-sm2)/60*PX;
      const hPx=Math.max(dur/60*PX-2,20);
      let bg,bord;
      const empColor = emp.color || '#7c3aed';
      if(apt.status==='cancelled'){bg='#fef2f2';bord='#ef4444';}
      else if(apt.status==='completed'){bg='#f0fdf4';bord='#22c55e';}
      else if(apt.status==='confirmed'){bg=empColor+'20';bord=empColor;}
      else{bg='#fffbeb';bord='#f59e0b';}
      const svcLabel = b.totalServices > 1 ? `<span style="font-size:8px;opacity:.7;font-weight:bold;margin-left:2px">(${b.index + 1}/${b.totalServices})</span>` : '';

      html+=`<div onclick="window.openModal('${apt.id}')"
        title="${esc(apt.clientName)} · ${esc(b.serviceName)} (${b.time}, ${dur}min)"
        style="position:absolute;top:${topPx}px;left:2px;right:2px;height:${hPx}px;
          background:${bg};border-left:3px solid ${bord};border-radius:6px;
          padding:2px 4px;cursor:pointer;overflow:hidden;z-index:10;box-shadow:0 2px 4px rgba(0,0,0,0.05)">
        <div style="font-size:9px;font-weight:900;color:#2e2826;line-height:1">${b.time}${svcLabel}</div>
        ${hPx>20?`<div style="font-size:9px;font-weight:800;color:#2e2826;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:2px">${esc(apt.clientName||apt.name||'?')}</div>`:''}
        ${hPx>34?`<div style="font-size:8px;color:#2e2826;opacity:.75;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:1px">${esc(b.serviceName)}</div>`:''}
      </div>`;
    });

    html+=`</div>`;
  });
  
  html+=`</div></div>`;
  container.innerHTML = html;
};

// ---- RENDER MONTH GRID ----
const renderMonthGrid=(cid,isConfig)=>{try{const body=document.getElementById(cid);if(!body){console.warn('renderMonthGrid: Element not found',cid);return}body.innerHTML='';
if(!config)config={start:'09:00',end:'20:00',specialDays:{}};
if(!config.specialDays)config.specialDays={};
const y=currentViewDate.getFullYear(),mo=currentViewDate.getMonth();const fd=new Date(y,mo,1);const off=(fd.getDay()+6)%7;
for(let i=0;i<off;i++)body.appendChild(document.createElement('div'));
const dim=new Date(y,mo+1,0).getDate();const frag=document.createDocumentFragment();const today=new Date();
// determine current employee for filter
let empFilter=null;if(currentTab.startsWith('calendar_emp_')){const eid=currentTab.replace('calendar_emp_','');const emp=getEmpById(eid);if(emp)empFilter=emp.name}
console.log(`renderMonthGrid: Rendering ${dim} days for ${cid}, config=${isConfig}, empFilter=${empFilter}, month=${mo+1}/${y}`);
for(let d=1;d<=dim;d++){const ds=`${y}-${String(mo+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
let entity='global';if(isConfig)entity='global';else if(empFilter)entity=empFilter;
const dc=getDailyConfig(ds,entity);
const isToday=d===today.getDate()&&mo===today.getMonth()&&y===today.getFullYear();
const div=document.createElement('div');
if(isConfig){
  const se=config.specialDays?.[ds]?.[entity];
  const isAuto=se?._auto===true;
  const closed=dc.type==='closed';
  const custom=se?.type==='custom'||se?.type==='split';
  const hasClosedHours=(config.specialDays?.[ds]?.closedHours||[]).length>0;
  div.className=`calendar-day ${closed?'closed':''} ${custom&&!isAuto?'custom-hours':''} ${custom&&isAuto?'border-2 border-dashed border-indigo-300 bg-indigo-50/50':''} ${isToday?'ring-2 ring-teal-500 bg-teal-50 shadow-md z-10':''}`;
  let icon='';
  if(closed)icon=isAuto?'<i data-lucide="lock" class="w-3 h-3 text-red-300"></i>':'<i data-lucide="lock" class="w-3 h-3 text-red-500"></i>';
  else if(custom)icon=isAuto?'<i data-lucide="clock" class="w-3 h-3 text-indigo-300"></i>':'<i data-lucide="clock" class="w-3 h-3 text-indigo-500"></i>';
  else icon='<i data-lucide="unlock" class="w-3 h-3 text-slate-200"></i>';
  const chBadge=hasClosedHours?`<div class="text-[7px] font-black mt-1 uppercase" style="color:var(--rose)">⏰ ${config.specialDays[ds].closedHours.length} cierre${config.specialDays[ds].closedHours.length>1?'s':''}</div>`:'';
  div.innerHTML=`<div class="flex justify-between font-black"><span class="${isAuto?'text-slate-400':''}">${d}</span>${icon}</div>${isAuto?'<div class="text-[7px] text-indigo-300 font-bold mt-1 uppercase">↑ Global</div>':''}${chBadge}`;
  
  div.onmousedown = () => {
    isDraggingSelect = true;
    dragSelectMode = !selectedConfigDays.has(ds);
    window.toggleConfigDaySelection(ds, dragSelectMode);
  };
  div.onmouseenter = () => {
    if(isDraggingSelect) window.toggleConfigDaySelection(ds, dragSelectMode);
  };
}else{
  const closed=dc.type==='closed';
  let empBlocks = [];
  let hasFullDayBlock = false;
  let hasPartialBlocks = false;
  if(empFilter) {
    empBlocks = window.loadBlocksForDate(ds, empFilter);
    hasFullDayBlock = empBlocks.some(b => b.startTime === '00:00' && b.endTime === '23:59');
    hasPartialBlocks = empBlocks.some(b => b.startTime !== '00:00' || b.endTime !== '23:59');
  }

  let dayApts=appointments.filter(a=>a.date===ds);if(empFilter)dayApts=dayApts.filter(function(a){return empInApt(a,empFilter)});
  const active=dayApts.filter(a=>a.status!=='cancelled');const pend=active.filter(a=>a.status==='pending').length;
  
  let totalServicesCount = 0;
  active.forEach(a => {
    if (a.services && Array.isArray(a.services) && a.services.length > 0) {
      if (empFilter) {
        const empSvcs = a.services.filter(s => (s.employee || '').toLowerCase() === empFilter.toLowerCase() || !s.employee || s.employee === 'Todas' || s.employee === 'Cualquiera');
        totalServicesCount += (empSvcs.length > 0 ? empSvcs.length : 1);
      } else {
        totalServicesCount += a.services.length;
      }
    } else {
      totalServicesCount += 1;
    }
  });
  const aptsLabel = totalServicesCount === 1 ? '1 Cita' : `${totalServicesCount} Citas`;

  const pi=pend>0?`<div class="absolute top-1 right-1 w-2.5 h-2.5 bg-yellow-400 rounded-full animate-pulse shadow-sm border border-white"></div>`:'';
  
  if (closed) {
    div.className=`calendar-day bg-slate-200/60 border-slate-300 flex flex-col ${isToday?'ring-2 ring-teal-500 z-10':''}`;
    div.innerHTML=`
      <div class="font-black text-slate-400 text-lg relative flex items-center">${d} ${pi}</div>
      <div class="text-red-400 text-[10px] font-black uppercase italic flex items-center gap-1 mt-2">
        <i data-lucide="ban" class="w-3 h-3"></i> CERRADO
      </div>
      <div class="flex-grow"></div>
      <div class="text-red-400 text-[10px] font-black uppercase text-center mb-1 tracking-widest">CERRADO</div>
    `;
  } else if (hasFullDayBlock) {
    const fdb = empBlocks.find(b => b.startTime === '00:00' && b.endTime === '23:59') || { id: '' };
    div.className=`calendar-day bg-orange-50 border-orange-200 flex flex-col ${isToday?'ring-2 ring-teal-500 z-10':''}`;
    div.innerHTML=`
      <div class="font-black text-orange-800 text-lg relative flex items-center">${d} ${pi}</div>
      <div class="text-orange-500 text-[10px] font-black uppercase italic flex items-center gap-1 mt-2">
        <i data-lucide="lock" class="w-3 h-3"></i> BLOQUEADO
      </div>
      <button onclick="event.stopPropagation(); window.deleteBlock('${fdb.id}')"
              style="margin-top: 4px; background: #ea580c; color: white; border: none; padding: 3px 6px; border-radius: 6px; font-size: 8px; font-weight: 800; cursor: pointer; text-transform: uppercase; width: fit-content; z-index: 20;"
              onmouseover="this.style.background='#c2410c'"
              onmouseout="this.style.background='#ea580c'">
        Restaurar
      </button>
      <div class="flex-1"></div>
      <div class="text-orange-500 text-[10px] font-black uppercase text-center mb-1 tracking-widest">DÍA COMPLETO</div>
    `;
  } else {
    const leftBorder = hasPartialBlocks ? 'border-left: 4px solid #f97316;' : '';
    const orangeBg = hasPartialBlocks ? 'bg-orange-50/30' : '';
    div.className=`calendar-day ${orangeBg} ${isToday?'ring-2 ring-teal-500 bg-teal-50 shadow-md z-10':''}`;
    if (leftBorder) div.setAttribute('style', leftBorder);
    
    const blocksBadge = hasPartialBlocks ? `<div class="text-[8px] text-orange-600 font-black mt-1 uppercase flex items-center gap-0.5"><i data-lucide="lock" class="w-2.5 h-2.5"></i> ${empBlocks.length} Bloqueo${empBlocks.length>1?'s':''}</div>` : '';
    
    div.innerHTML=`<div class="font-black text-slate-700 relative flex items-center">${d} ${pi}</div>
                   <div class="text-[8px] text-blue-500 font-black mt-1 uppercase">${aptsLabel}</div>
                   ${blocksBadge}
                   <div class="w-full bg-slate-100 h-1 rounded-full mt-2 overflow-hidden">
                     <div class="h-full bg-blue-500 transition-all" style="width:${Math.min(100,totalServicesCount*12)}%"></div>
                   </div>`;
  }
  
  if (isConfigMode) {
    div.onmousedown = () => {
      isDraggingSelect = true;
      dragSelectMode = !selectedConfigDays.has(ds);
      window.toggleConfigDaySelection(ds, dragSelectMode);
    };
    div.onmouseenter = () => {
      if(isDraggingSelect) window.toggleConfigDaySelection(ds, dragSelectMode);
    };
  } else {
    div.onclick=()=>window.openDayModal(ds, empFilter);
  }
}
div.setAttribute('data-ds', ds);
if(selectedConfigDays.has(ds)) {
    div.style.boxShadow = "inset 0 0 0 4px #f97316";
    div.style.backgroundColor = "#fff7ed";
}
frag.appendChild(div)}body.appendChild(frag);if(window.lucide)lucide.createIcons()}catch(err){console.error("❌ ERROR CRÍTICO EN renderMonthGrid:",err)}};

// ---- RENDER MAIN ----
window.render=()=>{try{console.log("🛠️ window.render() llamado, currentTab:",currentTab," specialistViewLevel:",specialistViewLevel);
const months=["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];const label=document.getElementById('current-view-label');const title=document.getElementById('view-title');if(!label||!title){console.warn('render: Missing DOM elements (current-view-label or view-title)');return}
const btnInfo = document.getElementById('btn-info-closures');
if (btnInfo) {
    const isCalendarOrConfig = currentTab.startsWith('calendar') || currentTab === 'config';
    btnInfo.classList.toggle('hidden', !isCalendarOrConfig);
}
if(currentTab==='billing'&&incomeChart&&typeof incomeChart.destroy==='function'){incomeChart.destroy();incomeChart=null;}
if(currentTab==='calendar_all'){if(specialistViewLevel==='global-day')window.renderGlobalDay();else{label.innerText=`${months[currentViewDate.getMonth()]} ${currentViewDate.getFullYear()}`;title.innerText="Agenda Global";document.getElementById('view-global-day').classList.add('hidden');const calView=document.getElementById('view-calendar');calView.classList.remove('hidden');renderMonthGrid('calendar-body',false)}}
else if(currentTab.startsWith('calendar_emp_')){const eid=currentTab.replace('calendar_emp_','');const emp=getEmpById(eid);label.innerText=`${months[currentViewDate.getMonth()]} ${currentViewDate.getFullYear()}`;title.innerText=`Calendario: ${emp?emp.name:''}`;renderMonthGrid('calendar-body',false)}
else if(currentTab==='appointments'){title.innerText="Listado de Citas";window.renderList()}
else if(currentTab==='billing'){title.innerText="Contabilidad";window.renderAccounting()}
else if(currentTab==='clients'){title.innerText="Clientes"}
else if(currentTab==='config'){title.innerText="Configuración";label.innerText=`${months[currentViewDate.getMonth()]} ${currentViewDate.getFullYear()}`;renderMonthGrid('config-calendar-body',true)}
else if(currentTab==='services_mgmt'){title.innerText="Servicios"}
else if(currentTab==='employees_mgmt'){title.innerText="Empleados"}

const btnConfig = document.getElementById('btn-toggle-config-mode');
if(btnConfig) {
    if(currentTab.startsWith('calendar_emp_') && specialistViewLevel === 'month') {
        btnConfig.classList.remove('hidden');
        btnConfig.classList.add('flex');
    } else {
        btnConfig.classList.add('hidden');
        btnConfig.classList.remove('flex');
        if(isConfigMode) window.toggleEmpConfigMode();
    }
}

if(window.lucide)lucide.createIcons()}catch(err){console.error("❌ ERROR CRÍTICO EN window.render():",err)}};

// ---- APPOINTMENT LIST ----
window.renderList=()=>{
    const lm=document.getElementById('list-month'),ly=document.getElementById('list-year');
    const searchInp=document.getElementById('appointment-search');
    const q=(searchInp?.value||'').trim().toLowerCase();
    const cleanQ=q.replace(/[\u200E\u200F\u200B\u200C\u200D\u202A-\u202E\uFEFF\s\-\(\)\.\+]/g,'');

    let filtered = [];
    if (q) {
        filtered = (window.appointments || appointments || []).filter(a => {
            const name = (a.clientName || a.name || '').toLowerCase();
            const phone = (a.clientPhone || a.phone || '').replace(/\D/g, '');
            const service = (a.service || '').toLowerCase();
            const emp = (a.employee || '').toLowerCase();
            const date = (a.date || '').toLowerCase();
            return name.includes(q) || 
                   (cleanQ && phone.includes(cleanQ)) || 
                   service.includes(q) || 
                   emp.includes(q) || 
                   date.includes(q);
        });
    } else {
        const now=new Date();
        let m=parseInt(lm?.value),y=parseInt(ly?.value);
        if(isNaN(m))m=now.getMonth();
        if(isNaN(y))y=now.getFullYear();
        filtered=(window.appointments || appointments || []).filter(a=>{
            if(!a.date)return false;
            const[yr,mo]=a.date.split('-').map(Number);
            return mo===(m+1)&&yr===y;
        });
    }

    const badge=document.getElementById('list-count-badge');
    if(badge)badge.innerText=`${filtered.length} Citas`;
    const tbody=document.getElementById('appointments-tbody');
    if(!tbody)return;
    if(filtered.length===0){
        tbody.innerHTML=`<tr><td colspan="6" class="p-8 text-center text-slate-400 font-bold italic uppercase">${q?'No se encontraron citas':'No hay citas en este mes'}</td></tr>`;
        return;
    }
    tbody.innerHTML='';
    const mapSt={pending:'Confirmada',confirmed:'Confirmada',completed:'Pagada',cancelled:'Cancelada'};
    filtered.sort((a,b)=>`${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`)).forEach(apt=>{
        const tr=document.createElement('tr');
        const isHighlighted = window.highlightIds && window.highlightIds.includes(apt.id);
        tr.className=`border-b hover:bg-slate-50 cursor-pointer ${isHighlighted ? 'highlight-new' : ''}`;
        tr.onclick=(e)=>{if(!e.target.closest('button')) window.openModal(apt.id)};
        const st=apt.status||'pending';
        const sc=statusColors[st]||'';
        const newBadge = isHighlighted ? '<span class="inline-block ml-2 px-1.5 py-0.5 rounded text-[8px] font-black bg-amber-400 text-white animate-pulse">NUEVA</span>' : '';
        tr.innerHTML=`<td data-label="Cliente" class="p-4"><div class="font-bold text-slate-800 uppercase text-xs">${esc(apt.clientName||apt.name)||'Sin Nombre'}</div><div class="text-[10px] text-slate-400 font-mono">${esc(apt.clientPhone||apt.phone)||''}</div></td><td data-label="Servicio" class="p-4"><div class="text-xs font-black uppercase text-blue-900">${esc(apt.service)||''}</div><span class="inline-block mt-1 px-2 py-0.5 rounded text-[9px] font-black uppercase ${sc}">${mapSt[st]||st}</span>${newBadge}</td><td data-label="Especialista" class="p-4 text-xs font-bold text-slate-600">${esc(apt.employee?apt.employee.split(',').map(function(e){return e.trim()}).filter(function(e){var l=e.toLowerCase();return l!=='todas'&&l!=='ambos'&&l!=='cualquiera'}).join(', '):'?')||'?'}</td><td data-label="Fecha/Hora" class="p-4 text-xs font-black uppercase">${apt.date}<br><span class="text-teal-600">${apt.time}</span></td><td data-label="Pagado" class="p-4 text-center">${apt.isPaid?'<span class="text-green-500 font-bold text-[10px] bg-green-50 px-2 py-1 rounded-lg border border-green-100">PAGADO</span>':(st==='cancelled'?'<span class="text-red-500 font-bold text-[10px] bg-red-50 px-2 py-1 rounded-lg border border-red-100">CANCELADA</span>':'<span class="text-amber-500 font-bold text-[10px] bg-amber-50 px-2 py-1 rounded-lg border border-amber-100">PENDIENTE</span>')}</td><td data-label="Acciones" class="p-4 text-center"><div class="flex justify-center gap-2"><button onclick="window.viewAppointment('${apt.id}')" class="p-2 border rounded-xl text-slate-500 hover:bg-slate-50" title="Ver Detalles"><i data-lucide="info" class="w-4 h-4"></i></button><button onclick="window.openModal('${apt.id}')" class="p-2 border rounded-xl text-blue-500 hover:bg-blue-50" title="Editar"><i data-lucide="edit-3" class="w-4 h-4"></i></button><button onclick="window.deleteAptFromModal('${apt.id}')" class="p-2 border rounded-xl text-red-500 hover:bg-red-50" title="Cancelar"><i data-lucide="trash-2" class="w-4 h-4"></i></button></div></td>`;
        tbody.appendChild(tr);
    });
    lucide.createIcons();
};

// ---- CLIENTS ----
window.getClientList = () => {
    const cMap = {};
    (window.appointments || appointments || []).forEach(a => {
        if (!a.clientName && !a.name) return;
        const name = (a.clientName || a.name).trim();
        const phone = (a.clientPhone || a.phone || '').trim();
        const email = (a.clientEmail || a.email || '').trim();
        
        const key = phone ? phone : name.toLowerCase();
        
        if (!cMap[key]) {
            cMap[key] = {
                name: name,
                phone: phone,
                email: email,
                totalSpent: 0,
                visits: []
            };
        }
        
        cMap[key].totalSpent += parseFloat(a.price) || 0;
        cMap[key].visits.push(a);
    });
    
    Object.values(cMap).forEach(c => {
        c.visits.sort((a, b) => new Date(b.date + 'T' + b.time) - new Date(a.date + 'T' + a.time));
    });
    
    return Object.values(cMap).sort((a, b) => a.name.localeCompare(b.name));
};

window.handleClientNameInput = (val) => {
    const dl = document.getElementById('clients-datalist');
    if (!dl) return;
    
    if (!val || val.length < 2) {
        dl.innerHTML = '';
        return;
    }
    
    const term = val.toLowerCase();
    const cl = window.getClientList().filter(c => c.name.toLowerCase().includes(term) || c.phone.includes(term));
    
    dl.innerHTML = cl.map(c => `<option value="${c.name}">${c.phone ? ' - ' + c.phone : ''}</option>`).join('');
    
    const exactMatch = cl.find(c => c.name.toLowerCase() === term);
    if (exactMatch) {
        const phoneInput = document.getElementById('m-phone');
        const emailInput = document.getElementById('m-email');
        if (phoneInput && !phoneInput.value && exactMatch.phone) phoneInput.value = exactMatch.phone;
        if (emailInput && !emailInput.value && exactMatch.email) emailInput.value = exactMatch.email;
    }
};

window.showClientDetails = (c) => {
    let modal = document.getElementById('client-details-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'client-details-modal';
        modal.className = 'fixed inset-0 bg-black/60 hidden flex items-center justify-center p-4 z-[80] backdrop-blur-sm';
        document.body.appendChild(modal);
    }
    
    const historyHtml = c.visits.map(v => {
        const parts = v.date.split('-'); 
        let formattedDate = v.date;
        if (parts.length === 3) formattedDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
        const st = v.status || 'pending';
        return `
        <div class="border-b last:border-0 py-3 border-slate-100 flex justify-between items-center">
            <div>
                <p class="text-xs font-bold text-slate-700">${formattedDate} a las ${v.time}</p>
                <p class="text-[10px] text-blue-600 font-black uppercase mt-0.5">${v.service || 'Servicio General'}</p>
            </div>
            <div class="text-right">
                <p class="text-xs font-black text-green-600">${parseFloat(v.price||0).toFixed(2)}€</p>
                <p class="text-[9px] text-slate-400 font-bold uppercase">${st}</p>
            </div>
        </div>
        `;
    }).join('');
    
    modal.innerHTML = `
        <div class="bg-white rounded-3xl w-full max-w-md flex flex-col shadow-2xl overflow-hidden modal-mobile border" style="border-color:var(--brown-light); max-height: 85vh;">
            <div class="p-6 border-b flex justify-between items-center" style="background:var(--cream); border-color:var(--brown-light)">
                <h3 class="font-serif italic font-semibold text-xl" style="color:var(--brown)">Detalles del Cliente</h3>
                <button onclick="document.getElementById('client-details-modal').classList.add('hidden')" class="p-2 rounded-full hover:bg-slate-200/50 transition-colors">
                    <i data-lucide="x" class="w-5 h-5" style="color:var(--brown-mid)"></i>
                </button>
            </div>
            <div class="p-6 overflow-y-auto flex-grow" style="background:#fff">
                <div class="flex items-center gap-4 mb-6">
                    <div class="w-14 h-14 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center font-black text-white uppercase text-xl shadow-md">${c.name.substring(0,2).toUpperCase()}</div>
                    <div>
                        <h4 class="font-black text-lg text-slate-700 uppercase leading-none">${c.name}</h4>
                        <p class="text-xs text-slate-500 font-mono mt-1"><i data-lucide="phone" class="w-3 h-3 inline"></i> ${c.phone || 'Sin teléfono'}</p>
                        ${c.email ? `<p class="text-xs text-slate-500 mt-0.5"><i data-lucide="mail" class="w-3 h-3 inline"></i> ${c.email}</p>` : ''}
                    </div>
                </div>
                
                <div class="grid grid-cols-2 gap-4 mb-6">
                    <div class="p-4 rounded-2xl bg-blue-50 border border-blue-100 text-center">
                        <p class="text-[10px] font-bold text-blue-400 uppercase tracking-wider">Total Gastado</p>
                        <p class="text-xl font-black text-blue-700 mt-1">${c.totalSpent.toFixed(2)}€</p>
                    </div>
                    <div class="p-4 rounded-2xl bg-purple-50 border border-purple-100 text-center">
                        <p class="text-[10px] font-bold text-purple-400 uppercase tracking-wider">Visitas</p>
                        <p class="text-xl font-black text-purple-700 mt-1">${c.visits.length}</p>
                    </div>
                </div>
                
                <h5 class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Historial de Citas</h5>
                <div class="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                    ${historyHtml || '<p class="text-xs text-slate-400 text-center py-4">No hay citas registradas.</p>'}
                </div>
            </div>
            <div class="p-4 border-t bg-slate-50 flex gap-2">
                <button onclick="document.getElementById('client-details-modal').classList.add('hidden')" class="flex-1 py-3 rounded-2xl font-bold uppercase text-xs border bg-white text-slate-500 hover:bg-slate-100 transition-colors">Cerrar</button>
            </div>
        </div>
    `;
    modal.classList.remove('hidden');
    if(window.lucide) window.lucide.createIcons({root: modal});
};

window.renderClients=()=>{
    const cmList = window.getClientList();
    const se=document.getElementById('client-search');
    const search=se?se.value.toLowerCase().trim():'';
    const lc=document.getElementById('clients-list');
    if(!lc)return;
    lc.innerHTML='';
    
    const fc=cmList.filter(c=>!search||c.name.toLowerCase().includes(search)||c.phone.includes(search));
    
    if(fc.length===0){
        lc.innerHTML='<div class="p-8 text-center text-slate-400"><p class="font-bold uppercase text-xs">No se encontraron clientes</p></div>';
        return;
    }
    
    fc.forEach(c=>{
        const div=document.createElement('div');
        div.className="p-3 border rounded-xl hover:bg-blue-50 cursor-pointer transition-all flex items-center gap-3";
        div.onclick=()=>window.showClientDetails(c);
        div.innerHTML=`<div class="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center font-black text-white uppercase text-sm shadow">${c.name.substring(0,2).toUpperCase()}</div><div class="flex-grow"><h4 class="font-black text-xs text-slate-700 uppercase truncate">${c.name}</h4><p class="text-[9px] text-slate-400 font-mono">${c.phone}</p></div><div class="text-right"><p class="text-xs font-black text-green-600">${c.totalSpent}€</p><p class="text-[8px] text-slate-400">${c.visits.length} vis</p></div>`;
        lc.appendChild(div);
    });
};


// ---- ACCOUNTING ----
window.renderAccounting=()=>{const sm=parseInt(document.getElementById('acc-month')?.value),sy=parseInt(document.getElementById('acc-year')?.value);if(isNaN(sm)||isNaN(sy))return;
const filtered=appointments.filter(a=>{if(!a.isPaid||!a.date||typeof a.price!=='number')return false;const[yr,mo]=a.date.split('-').map(Number);return mo===(sm+1)&&yr===sy});
const total=filtered.reduce((s,a)=>s+(a.price||0),0);const avg=filtered.length>0?total/filtered.length:0;
// KPI cards dynamic per employee
const kc=document.getElementById('acc-kpi-cards');if(kc){let html=`<div class="bg-white p-6 rounded-3xl border shadow-sm"><p class="text-[10px] text-slate-400 font-black uppercase mb-1">Ingresos Totales</p><h3 class="text-3xl font-black text-slate-800">${total.toFixed(2)}€</h3></div>`;
employeesDB.forEach(e=>{const et=filtered.filter(function(a){return empInApt(a,e.name)}).reduce(function(s,a){return s+(a.price||0)},0);const pct=total>0?Math.round(et/total*100):0;
html+=`<div class="bg-white p-6 rounded-3xl border shadow-sm"><p class="text-[10px] font-black uppercase mb-1" style="color:${e.color}">${e.name}</p><h3 class="text-3xl font-black" style="color:${e.color}">${et.toFixed(2)}€</h3><div class="text-[9px] font-bold text-slate-400 mt-1">${pct}%</div></div>`});
html+=`<div class="bg-white p-6 rounded-3xl border shadow-sm"><p class="text-[10px] text-slate-400 font-black uppercase mb-1">Ticket Medio</p><h3 class="text-3xl font-black text-slate-800">${avg.toFixed(2)}€</h3><p class="text-[10px] font-bold text-slate-400 mt-1">${filtered.length} Citas</p></div>`;kc.innerHTML=html}
// Chart
const dim=new Date(sy,sm+1,0).getDate();const labels=Array.from({length:dim},(_,i)=>i+1);const dd=new Array(dim).fill(0);
filtered.forEach(a=>{const d=parseInt(a.date.split('-')[2]);if(d>=1&&d<=dim)dd[d-1]+=a.price||0});
const ctx=document.getElementById('incomeChart');if(ctx){if(incomeChart)incomeChart.destroy();incomeChart=new Chart(ctx.getContext('2d'),{type:'line',data:{labels,datasets:[{label:'Ingresos',data:dd,borderColor:'#7c3aed',backgroundColor:'rgba(124,61,237,0.1)',fill:true,tension:0.4,pointRadius:3}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{font:{size:9},maxRotation:0}},y:{beginAtZero:true,ticks:{callback:v=>v+'€'}}}}})}
// Top services
const sMap={};filtered.forEach(a=>{const s=a.service||'?';if(!sMap[s])sMap[s]={rev:0,count:0};sMap[s].rev+=a.price||0;sMap[s].count++});
const ss=Object.entries(sMap).sort((a,b)=>b[1].rev-a[1].rev);const mr=ss.length>0?ss[0][1].rev:1;
const sl=document.getElementById('acc-services-list');if(sl)sl.innerHTML=ss.length===0?'<p class="text-center py-12 text-slate-400 italic">Sin datos</p>':ss.slice(0,5).map(([n,d])=>`<div class="space-y-1"><div class="flex justify-between text-[11px] font-black uppercase"><span class="truncate mr-4">${n}</span><span class="text-green-600">${d.rev.toFixed(2)}€</span></div><div class="flex items-center gap-3"><div class="flex-grow h-2.5 bg-slate-100 rounded-full overflow-hidden"><div class="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full" style="width:${d.rev/mr*100}%"></div></div><span class="text-[9px] text-slate-400 font-bold">${d.count}x</span></div></div>`).join('');
// Top clients
const cMap={};filtered.forEach(a=>{const p=a.clientPhone||a.phone||'?';if(!cMap[p])cMap[p]={name:a.clientName||a.name||'?',total:0,count:0};cMap[p].total+=a.price||0;cMap[p].count++});
const sc=Object.values(cMap).sort((a,b)=>b.total-a.total);const tc=document.getElementById('acc-top-clients');
if(tc)tc.innerHTML=sc.length===0?'<p class="text-center py-12 text-slate-400 italic">Sin datos</p>':sc.slice(0,5).map((c,i)=>`<div class="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border"><div class="flex items-center gap-3"><span class="w-8 h-8 flex items-center justify-center bg-gradient-to-br from-amber-400 to-orange-500 text-white rounded-full text-[11px] font-black shadow">${i+1}</span><div><p class="font-black uppercase text-xs text-slate-700 truncate max-w-[150px]">${c.name}</p><p class="text-[9px] text-slate-400 font-bold">${c.count} Visitas</p></div></div><div class="text-right"><p class="font-black text-green-600 text-sm">${c.total.toFixed(2)}€</p></div></div>`).join('');
lucide.createIcons()};
// admin-init.js — Config, Appointment modal, WhatsApp, Init

// ---- CONFIG ----
window.renderConfigEntityTabs=()=>{const c=document.getElementById('config-entity-tabs');if(!c)return;
let html=`<button onclick="window.setConfigEntity('global')" class="px-5 py-2 rounded-xl font-black text-[10px] uppercase transition-all ${configEntity==='global'?'bg-white shadow-sm':'text-slate-400 hover:bg-slate-200'}">GLOBAL</button>`;
employeesDB.forEach(e=>{
    html+=`<button onclick="window.setConfigEntity('${e.name}')" class="px-5 py-2 rounded-xl font-black text-[10px] uppercase transition-all ${configEntity===e.name?'bg-white shadow-sm':'text-slate-400 hover:bg-slate-200'}">${e.name}</button>`;
});
c.innerHTML=html;
const calendarSection = document.getElementById('config-calendar-section');
if (calendarSection) {
    if (configEntity === 'global') {
        calendarSection.classList.remove('hidden');
    } else {
        calendarSection.classList.add('hidden');
    }
}
const warningEl = document.getElementById('employee-closure-warning');
if (warningEl) {
    if (configEntity !== 'global') {
        warningEl.classList.remove('hidden');
    } else {
        warningEl.classList.add('hidden');
    }
}
};
window.setConfigEntity=e=>{configEntity=e;window.renderStandardInputs();window.renderConfigEntityTabs();renderMonthGrid('config-calendar-body',true)};
window.renderStandardInputs=()=>{const c=document.getElementById('standard-inputs-container');if(!c)return;
if(!config)config={start:'09:00',end:'20:00',specialDays:{}};
if(!config.weekly)config.weekly={};
const days=[{id:1,name:'Lunes'},{id:2,name:'Martes'},{id:3,name:'Miércoles'},{id:4,name:'Jueves'},{id:5,name:'Viernes'},{id:6,name:'Sábado'},{id:0,name:'Domingo'}];
let cw=config.weekly,title="Horario GLOBAL del Centro",bg="bg-slate-100";
if(configEntity!=='global'){const key=`weekly_${configEntity}`;if(!config[key])config[key]={};cw=config[key];title=`Horario: ${configEntity}`;bg="bg-purple-50"}
let html=`<div class="col-span-full mb-4 space-y-4"><div class="${bg} p-4 rounded-2xl border-2 text-center"><h3 class="font-black text-slate-700 uppercase">${title}</h3></div></div><div class="col-span-1 md:col-span-2 space-y-3">`;
days.forEach(d=>{let ds='09:00',de='20:00',ds2='15:00',de2='20:00',closed=false,type='complete';
if(configEntity!=='global'&&!cw[d.id]){const gd=config.weekly[d.id]||{start:'09:00',end:'20:00',closed:false,type:'complete'};ds=gd.start;de=gd.end;closed=gd.closed;type=gd.type||'complete';ds2=gd.start2||'15:00';de2=gd.end2||'20:00'}
else if(cw[d.id]){ds=cw[d.id].start;de=cw[d.id].end;closed=cw[d.id].closed;type=cw[d.id].type||'complete';ds2=cw[d.id].start2||'15:00';de2=cw[d.id].end2||'20:00'}
const dc={start:ds,end:de,closed:closed,type:type,start2:ds2,end2:de2};
const isSplit=dc.type==='split';
html+=`<div class="flex flex-wrap items-center gap-2 sm:gap-4 p-3 border rounded-xl bg-white shadow-sm">
  <div class="w-20 font-black uppercase text-xs text-slate-600">${d.name}</div>
  <label class="flex items-center gap-2 cursor-pointer bg-slate-50 px-2 py-1 rounded border shadow-sm">
    <input type="checkbox" id="w-closed-${d.id}" class="w-4 h-4 rounded text-red-500" ${dc.closed?'checked':''}
      onchange="var tg=this;var row=document.getElementById('w-times-${d.id}');var sel=document.getElementById('w-type-${d.id}');row.classList.toggle('opacity-30',tg.checked);row.classList.toggle('pointer-events-none',tg.checked);sel.classList.toggle('opacity-30',tg.checked);sel.classList.toggle('pointer-events-none',tg.checked)">
    <span class="text-[9px] font-bold text-red-400 uppercase">Cerrado</span>
  </label>
  <select id="w-type-${d.id}" class="p-1 border rounded-lg text-xs font-bold bg-white outline-none ${dc.closed?'opacity-30 pointer-events-none':''}"
    onchange="var sp=document.getElementById('w-split-${d.id}');sp.classList.toggle('hidden',this.value!=='split');if(this.value==='split'){var e=document.getElementById('w-end-${d.id}');if(e.value==='20:00')e.value='13:00';var s2=document.getElementById('w-start2-${d.id}');if(s2.value==='13:00'||s2.value==='15:00')s2.value='15:00';var e2=document.getElementById('w-end2-${d.id}');if(e2.value==='15:00'||e2.value==='20:00')e2.value='20:00'}">
    <option value="complete" ${!isSplit?'selected':''}>Jornada completa</option>
    <option value="split" ${isSplit?'selected':''}>Jornada partida</option>
  </select>
  <div id="w-times-${d.id}" class="flex flex-wrap items-center gap-2 flex-grow ${dc.closed?'opacity-30 pointer-events-none':''}">
    ${isSplit?'<span class="text-[8px] font-black uppercase text-blue-500">Mañana</span>':''}
    <input type="time" id="w-start-${d.id}" value="${isSplit?dc.start:dc.start}" class="p-1.5 border rounded-lg font-bold bg-white text-xs outline-none w-24">
    <span class="text-slate-400 font-black text-xs">–</span>
    <input type="time" id="w-end-${d.id}" value="${isSplit?dc.end:dc.end}" class="p-1.5 border rounded-lg font-bold bg-white text-xs outline-none w-24">
    <div id="w-split-${d.id}" class="flex items-center gap-1 ${!isSplit?'hidden':''}">
      <span class="text-[8px] font-black uppercase text-orange-500 ml-2">Tarde</span>
      <input type="time" id="w-start2-${d.id}" value="${dc.start2}" class="p-1.5 border border-orange-300 rounded-lg font-bold bg-orange-50 text-xs outline-none w-24">
      <span class="text-slate-400 font-black text-xs">–</span>
      <input type="time" id="w-end2-${d.id}" value="${dc.end2}" class="p-1.5 border border-orange-300 rounded-lg font-bold bg-orange-50 text-xs outline-none w-24">
    </div>
  </div>
</div>`});
html+='</div>';c.innerHTML=html};
window.saveConfig=async()=>{try{const tw={};[1,2,3,4,5,6,0].forEach(id=>{const type=document.getElementById(`w-type-${id}`)?.value||'complete';const entry={start:document.getElementById(`w-start-${id}`).value,end:document.getElementById(`w-end-${id}`).value,closed:document.getElementById(`w-closed-${id}`).checked,type:type};if(type==='split'){entry.start2=document.getElementById(`w-start2-${id}`)?.value||'';entry.end2=document.getElementById(`w-end2-${id}`)?.value||''}tw[id]=entry});
const up={};if(configEntity==='global'){up.weekly=tw;const l=tw[1];up.start=l.closed?'09:00':l.start;up.end=l.closed?'20:00':(l.type==='split'?l.end2:l.end);config.weekly=tw;config.start=up.start;config.end=up.end}else{up[`weekly_${configEntity}`]=tw;config[`weekly_${configEntity}`]=tw}
console.log('Guardando config...',up);
await setDoc(doc(db,'artifacts',AID,'public','data','settings','main'),up,{merge:true});
alert(`✅ Configuración de ${configEntity.toUpperCase()} guardada.`);
if(currentTab==='config'){window.renderStandardInputs();renderMonthGrid('config-calendar-body',true)}
}catch(e){console.error('❌ Error guardando config:',e);alert('❌ ERROR al guardar configuración:\n\n'+e.message);}};
window.openConfigDay=ds=>{
  selectedDayInModal=ds;
  const empEntry=config.specialDays?.[ds]?.[configEntity];
  const globalEntry=config.specialDays?.[ds]?.global;
  const cur=empEntry||{type:'standard'};
  tmpLocal={...cur};

  // Cargar cierres de hora existentes para este día
  tmpClosedHours=[...(config.specialDays?.[ds]?.closedHours||[])];

  // Indicar de dónde viene la config: manual, propagada del global, o sin configurar
  const entityLabel=document.getElementById('config-day-entity');
  if(entityLabel){
    if(configEntity==='global'){
      entityLabel.innerText='Configuración GLOBAL — se aplica a todas las trabajadoras';
      entityLabel.className='text-[10px] text-blue-600 mb-4 uppercase tracking-widest italic font-black';
    } else if(empEntry&&!empEntry._auto){
      entityLabel.innerText=`${configEntity} — Override manual (tiene preferencia sobre el global)`;
      entityLabel.className='text-[10px] text-purple-600 mb-4 uppercase tracking-widest italic font-black';
    } else if(empEntry&&empEntry._auto){
      entityLabel.innerText=`${configEntity} — Heredado del Global (puedes personalizar)`;
      entityLabel.className='text-[10px] text-teal-600 mb-4 uppercase tracking-widest italic font-black';
    } else {
      entityLabel.innerText=`${configEntity} — Sigue horario global`;
      entityLabel.className='text-[10px] text-slate-400 mb-4 uppercase tracking-widest italic font-black';
    }
  }

  // Cambiar texto del botón ABIERTO NORMAL según contexto
  const btnStd=document.getElementById('btn-local-standard');
  if(btnStd){
    if(configEntity!=='global'&&globalEntry){
      btnStd.innerHTML=`SEGUIR HORARIO GLOBAL <i data-lucide="refresh-cw" class="w-4 h-4"></i>`;
    } else {
      btnStd.innerHTML=`ABIERTO NORMAL <i data-lucide="unlock" class="w-4 h-4"></i>`;
    }
    if(window.lucide)lucide.createIcons();
  }

  document.getElementById('config-day-title').innerText=`Personalizar: ${ds}`;
  document.getElementById('local-start').value=tmpLocal.start||config.start||"09:00";
  document.getElementById('local-end').value=tmpLocal.end||config.end||"20:00";
  window.setLocalConfigType(tmpLocal.type);
  window.renderClosedHoursList();
  document.getElementById('config-day-modal').classList.remove('hidden');
  if(window.lucide)lucide.createIcons();
};
window.setLocalConfigType=type=>{tmpLocal.type=type;
['standard','closed','custom','split'].forEach(t=>{
  const btn=document.getElementById(`btn-local-${t}`);
  const badge=document.getElementById(`badge-local-${t}`);
  if(btn){
    if(t===type){
      btn.className='w-full p-3.5 border-2 rounded-2xl font-bold text-left flex justify-between items-center transition-all text-xs shadow-sm';
      const colors={standard:'border-blue-400 bg-blue-50 text-blue-700',closed:'border-red-400 bg-red-50 text-red-700',custom:'border-indigo-400 bg-indigo-50 text-indigo-700',split:'border-orange-400 bg-orange-50 text-orange-700'};
      btn.className+=' '+(colors[t]||'');
    } else {
      btn.className='w-full p-3.5 border-2 rounded-2xl font-bold text-left flex justify-between items-center transition-all text-xs bg-white border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-600';
    }
  }
  if(badge)badge.style.display=(t===type)?'inline':'none';
});
document.getElementById('local-custom-fields').classList.toggle('hidden',type!=='custom'&&type!=='split');
const splitFields=document.getElementById('local-split-extra');if(splitFields)splitFields.classList.toggle('hidden',type!=='split')};
// ── CIERRES DE HORA — Añadir / Eliminar / Renderizar ────────────────────────
window.addClosedHour=()=>{};
window.removeClosedHour=async(idx)=>{
  if(!confirm('¿Eliminar este cierre de horas?'))return;
  tmpClosedHours.splice(idx,1);
  let sd={...(config.specialDays||{})};
  if(!sd[selectedDayInModal])sd[selectedDayInModal]={};
  if(tmpClosedHours.length>0){
    sd[selectedDayInModal].closedHours=tmpClosedHours;
  }else{
    delete sd[selectedDayInModal].closedHours;
  }
  if(Object.keys(sd[selectedDayInModal]||{}).length===0)delete sd[selectedDayInModal];
  try {
    const docRef = doc(db, 'artifacts', AID, 'public', 'data', 'settings', 'main');
    await updateDoc(docRef, { specialDays: sd });
    config.specialDays = sd;
    window.renderClosedHoursList();
    if(currentTab === 'config') renderMonthGrid('config-calendar-body', true);
  } catch(e) {
    alert('Error al eliminar cierre: ' + e.message);
  }
};
window.renderClosedHoursList=()=>{
  const container=document.getElementById('local-closed-hours-section');
  const listEl=document.getElementById('local-closed-hours-list');
  if(!container||!listEl)return;
  if(tmpClosedHours.length===0){
    container.classList.add('hidden');
    return;
  }
  container.classList.remove('hidden');
  listEl.innerHTML=tmpClosedHours.map((ch,idx)=>{
    const chEnt=ch.entity||'global';
    const entityName=chEnt==='global'?'Global':(employeesDB.find(e=>e.id===chEnt||(e.name||'').toLowerCase()===chEnt.toLowerCase())?.name||chEnt);
    return `<div class="flex items-center justify-between p-3 rounded-2xl border bg-white text-xs font-bold" style="border-color:var(--brown-light);color:var(--brown)">
      <div class="flex items-center gap-2">
        <span class="text-rose-500">⏰</span>
        <span>${ch.from} - ${ch.to}</span>
        <span class="text-[9px] px-2 py-0.5 rounded-full uppercase font-black" style="background:#e0f2fe;color:#075985">${entityName}</span>
      </div>
      <button onclick="window.removeClosedHour(${idx})" class="p-1.5 hover:bg-red-50 rounded-xl text-red-500 transition-colors" title="Eliminar cierre">
        <i data-lucide="trash-2" class="w-4 h-4"></i>
      </button>
    </div>`;
  }).join('');
  if(window.lucide)lucide.createIcons();
};

// ── Obtener cierres de hora aplicables para un día y entidad ──────────────
window.getClosedHoursForDay=(dateStr, entity)=>{
  const list=config.specialDays?.[dateStr]?.closedHours||[];
  return list.filter(ch=>ch.entity==='global'||ch.entity.toLowerCase()===entity.toLowerCase());
};

window.saveConfigDay=async()=>{try{
let sd={...(config.specialDays||{})};
if(!sd[selectedDayInModal])sd[selectedDayInModal]={};

if(configEntity==='global'){
  // ── Guardar el global ──────────────────────────────────────────────────
  if(tmpLocal.type==='standard'){
    delete sd[selectedDayInModal].global;
    // Eliminar también las entradas _auto de cada empleada para este día
    employeesDB.forEach(emp=>{
      if(sd[selectedDayInModal]?.[emp.name]?._auto)delete sd[selectedDayInModal][emp.name];
    });
  } else {
    let val;
    if(tmpLocal.type==='closed'){val={type:'closed'};}
    else if(tmpLocal.type==='split'){val={type:'split',start:document.getElementById('local-start').value,end:document.getElementById('local-end').value,start2:document.getElementById('local-start2')?.value||'',end2:document.getElementById('local-end2')?.value||''};}
    else{val={type:'custom',start:document.getElementById('local-start').value,end:document.getElementById('local-end').value};}
    sd[selectedDayInModal].global=val;
    // ── Propagar a todas las empleadas que NO tengan override manual ──────
    employeesDB.forEach(emp=>{
      const existing=sd[selectedDayInModal]?.[emp.name];
      // Solo propagar si: no hay nada, o lo que había era _auto (propagado antes)
      if(!existing||existing._auto){
        sd[selectedDayInModal][emp.name]={...val,_auto:true};
      }
    });
  }
} else {
  // ── Guardar override manual de una empleada ────────────────────────────
  if(tmpLocal.type==='standard'){
    // Al resetear a estándar: si hay global especial, propagar ese global como _auto
    delete sd[selectedDayInModal][configEntity];
    const globalVal=sd[selectedDayInModal]?.global;
    if(globalVal){
      sd[selectedDayInModal][configEntity]={...globalVal,_auto:true};
    }
  } else {
    let val;
    if(tmpLocal.type==='closed'){val={type:'closed'};}
    else if(tmpLocal.type==='split'){val={type:'split',start:document.getElementById('local-start').value,end:document.getElementById('local-end').value,start2:document.getElementById('local-start2')?.value||'',end2:document.getElementById('local-end2')?.value||''};}
    else{val={type:'custom',start:document.getElementById('local-start').value,end:document.getElementById('local-end').value};}
    // Sin _auto → es un override manual; no se sobreescribirá cuando cambie el global
    sd[selectedDayInModal][configEntity]=val;
  }
}

    // Guardar closedHours (legacy)
    if(tmpClosedHours.length>0){
      if(!sd[selectedDayInModal]) sd[selectedDayInModal]={};
      sd[selectedDayInModal].closedHours=tmpClosedHours;
    }else{
      if(sd[selectedDayInModal]) delete sd[selectedDayInModal].closedHours;
    }

    // Limpiar día si está completamente vacío
    const dayKeys=Object.keys(sd[selectedDayInModal]||{});
    if(dayKeys.length===0)delete sd[selectedDayInModal];

    console.log('💾 Intentando guardar día especial en Firestore...', selectedDayInModal);
    console.log('📦 Datos a enviar:', sd);
    
    const docRef = doc(db, 'artifacts', AID, 'public', 'data', 'settings', 'main');
    await updateDoc(docRef, { specialDays: sd });
    
    config.specialDays = sd;
    console.log('✅ Guardado con éxito en la base de datos');
    alert('✅ ¡Día actualizado correctamente!');
    
    if(currentTab === 'config') renderMonthGrid('config-calendar-body', true);
    window.closeConfigDayModal();
} catch (e) {
    console.error('❌ ERROR FATAL al guardar día:', e);
    alert('❌ ERROR AL GUARDAR:\n' + e.message + '\n\nRevisa la consola (F12) para ver el error completo.');
}
};

// ---- RANGE MODAL (day range config) ----
// ---- RANGES (Cierre por Días) ----
let currentRangeScope = 'global';
let currentRangeType = 'closed';

window.openRangeModalStandalone = () => {
  const today = getLD(new Date());
  document.getElementById('range-start-date').value = today;
  document.getElementById('range-end-date').value = today;
  document.getElementById('range-modal-subtitle').innerText = "Personalizado";
  
  const empSelect = document.getElementById('range-emp-select');
  if(empSelect) {
    empSelect.innerHTML = employeesDB.map(e => `<option value="${e.name}">${esc(e.name)}</option>`).join('');
  }
  
  window.selectRangeScope('global');
  window.selectRangeType('closed');
  
  document.getElementById('range-modal').classList.remove('hidden');
};

window.openRangeModal = (startDate, endDate) => {
  document.getElementById('range-start-date').value = startDate;
  document.getElementById('range-end-date').value = endDate;
  
  const sd = new Date(startDate+'T12:00:00'), ed = new Date(endDate+'T12:00:00');
  const nDays = Math.round((ed-sd)/(1000*60*60*24))+1;
  document.getElementById('range-modal-subtitle').innerText = `${startDate} → ${endDate} (${nDays} días)`;
  
  const empSelect = document.getElementById('range-emp-select');
  if(empSelect) {
    empSelect.innerHTML = employeesDB.map(e => `<option value="${e.name}">${esc(e.name)}</option>`).join('');
  }
  
  window.selectRangeScope('global');
  window.selectRangeType('closed');
  
  document.getElementById('range-modal').classList.remove('hidden');
};

window.closeRangeModal = () => document.getElementById('range-modal').classList.add('hidden');

window.selectRangeScope = (scope) => {
  currentRangeScope = scope;
  const btnGlobal = document.getElementById('range-scope-global');
  const btnEmp = document.getElementById('range-scope-emp');
  const empSelectCont = document.getElementById('range-emp-select-container');
  
  if(scope === 'global') {
    btnGlobal.style.backgroundColor = 'var(--green-deep)';
    btnGlobal.style.color = 'white';
    btnEmp.style.backgroundColor = 'transparent';
    btnEmp.style.color = 'var(--brown)';
    empSelectCont.classList.add('hidden');
  } else {
    btnEmp.style.backgroundColor = 'var(--green-deep)';
    btnEmp.style.color = 'white';
    btnGlobal.style.backgroundColor = 'transparent';
    btnGlobal.style.color = 'var(--brown)';
    empSelectCont.classList.remove('hidden');
  }
};

window.selectRangeType = (type) => {
  currentRangeType = type;
  const btns = ['closed', 'custom', 'split', 'delete'];
  btns.forEach(b => {
    const el = document.getElementById('range-btn-' + (b==='closed'?'cerrado':b));
    if(!el) return;
    el.style.backgroundColor = b === type ? 'var(--cream)' : 'transparent';
    el.style.borderColor = b === type ? 'var(--brown)' : 'var(--brown-light)';
    if(b==='closed') el.style.borderColor = b === type ? 'var(--red)' : 'var(--red-light)';
    if(b==='delete') el.style.borderColor = b === type ? 'var(--green-deep)' : 'var(--green-light)';
  });
  
  const timeCont = document.getElementById('range-custom-times');
  const splitCont = document.getElementById('range-split-times');
  
  timeCont.classList.toggle('hidden', type !== 'custom' && type !== 'split');
  splitCont.classList.toggle('hidden', type !== 'split');
};

window.saveRangeConfig = async () => {
  const entity = currentRangeScope === 'global' ? 'global' : document.getElementById('range-emp-select').value;
  const type = currentRangeType;
  
  const customStart = document.getElementById('range-start').value || '09:00';
  const customEnd = document.getElementById('range-end').value || '20:00';
  const splitStart2 = document.getElementById('range-start2').value || '16:00';
  const splitEnd2 = document.getElementById('range-end2').value || '20:00';
  
  const startDate = document.getElementById('range-start-date').value;
  const endDate = document.getElementById('range-end-date').value;

  if(!startDate || !endDate || startDate > endDate) return alert('Por favor, selecciona un rango de fechas válido.');
  
  let sd = { ...(config.specialDays || {}) };
  const cur = new Date(startDate+'T12:00:00'), last = new Date(endDate+'T12:00:00');
  
  while(cur <= last) {
    const ds = getLD(cur);
    if(!sd[ds]) sd[ds] = {};
    let val;
    
    if(type === 'delete') {
      delete sd[ds][entity];
      if(entity === 'global') {
        employeesDB.forEach(e => { if(sd[ds]?.[e.name]?._auto) delete sd[ds][e.name] });
      }
    } else {
      if(type === 'closed') val = { type: 'closed' };
      else if(type === 'split') val = { type: 'split', start: customStart, end: customEnd, start2: splitStart2, end2: splitEnd2 };
      else val = { type: 'custom', start: customStart, end: customEnd };
      
      if(entity === 'global') {
        sd[ds].global = val;
        employeesDB.forEach(emp => {
          const ex = sd[ds]?.[emp.name];
          if(!ex || ex._auto) sd[ds][emp.name] = { ...val, _auto: true };
        });
      } else {
        sd[ds][entity] = val;
      }
    }
    
    if(Object.keys(sd[ds]||{}).length === 0) delete sd[ds];
    cur.setDate(cur.getDate()+1);
  }
  
  try {
    await updateDoc(doc(db,'artifacts',AID,'public','data','settings','main'), { specialDays: sd });
    config.specialDays = sd;
    alert('✅ Rango aplicado correctamente.');
    window.closeRangeModal();
    if(currentTab === 'config') renderMonthGrid('config-calendar-body', true);
  } catch(e) {
    alert('❌ Error: ' + e.message);
  }
};

// ---- BLOCKS (employee hour blocks) ----
window.loadBlocksForDate=(dateStr,empName)=>{
  const d=new Date(dateStr+'T12:00:00');
  const weekday=d.getDay();
  return blocksDB.filter(b=>{
    if(b.employee!==empName)return false;
    if(b.recurrenceEnd&&b.recurrenceEnd<dateStr)return false;
    if(b.recurrence==='none')return b.date===dateStr;
    if(b.recurrence==='daily')return true;
    if(b.recurrence==='weekly')return b.weekday===weekday;
    if(b.recurrence==='biweekly')return b.weekday===weekday;
    return false;
  });
};
window.saveBlock=async(blockData)=>{
  blockData.createdAt=new Date().toISOString();
  await addDoc(collection(db,'artifacts',AID,'public','data','blocks'),blockData);
};
window.deleteBlock=async(id)=>{
  if(!confirm('¿Eliminar este bloqueo?'))return;
  // Optimistic update to reflect in UI immediately
  blocksDB = blocksDB.filter(b => b.id !== id);
  await deleteDoc(doc(db,'artifacts',AID,'public','data','blocks',id));
  if (document.getElementById('day-modal') && !document.getElementById('day-modal').classList.contains('hidden')) {
    let empFilter = null;
    if (currentTab.startsWith('calendar_emp_')) {
      const eid = currentTab.replace('calendar_emp_','');
      const emp = getEmpById(eid);
      if (emp) empFilter = emp.name;
    }
    window.openDayModal(selectedDayInModal, empFilter);
  }
};
window.restoreDayForEmp = async (ds, empName) => {
  if (!confirm('¿Restaurar el horario por defecto para este día?')) return;
  const empBlocks = window.loadBlocksForDate(ds, empName);
  const idsToDelete = empBlocks.map(bl => bl.id);
  // Optimistic update to reflect in UI immediately
  blocksDB = blocksDB.filter(b => !idsToDelete.includes(b.id));

  const deletePromises = empBlocks.map(bl => 
    deleteDoc(doc(db, 'artifacts', AID, 'public', 'data', 'blocks', bl.id))
  );
  await Promise.all(deletePromises);
  let sd = { ...(config.specialDays || {}) };
  if (sd[ds]) {
    const emp = employeesDB.find(e => e.name.toLowerCase() === empName.toLowerCase());
    if (emp) {
      delete sd[ds][emp.id];
      delete sd[ds][emp.name];
    } else {
      delete sd[ds][empName];
    }
    const globalVal = sd[ds]?.global;
    if (globalVal && emp) {
      sd[ds][emp.id] = { ...globalVal, _auto: true };
      sd[ds][emp.name] = { ...globalVal, _auto: true };
    }
    const dayKeys = Object.keys(sd[ds] || {});
    if (dayKeys.length === 0) delete sd[ds];
    await updateDoc(doc(db, 'artifacts', AID, 'public', 'data', 'settings', 'main'), { specialDays: sd });
    config.specialDays = sd;
  }
  if (currentTab === 'config') renderMonthGrid('config-calendar-body', true);
  else window.render();
  let empFilter = null;
  if (currentTab.startsWith('calendar_emp_')) {
    const eid = currentTab.replace('calendar_emp_','');
    const emp = getEmpById(eid);
    if (emp) empFilter = emp.name;
  }
  window.openDayModal(ds, empFilter);
};
window.openBlockModal=(empName, defaultDate)=>{
  document.getElementById('block-modal-emp').innerText = empName;
  document.getElementById('block-emp-name').value = empName;
  document.getElementById('block-date').value = defaultDate || getLD(new Date());
  
  const fdCheckbox = document.getElementById('block-fullday');
  if(fdCheckbox) { fdCheckbox.checked = false; window.toggleBlockFullDay(); }
  
  const d = new Date((defaultDate || getLD(new Date())) + 'T12:00:00');
  const dayNames = ['domingos','lunes','martes','miércoles','jueves','viernes','sábados'];
  const dayName = dayNames[d.getDay()];
  const formattedDate = d.toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'});
  
  // Build dynamic recurrence select
  const recSel = document.getElementById('block-recurrence');
  if(selectedConfigDays.size > 1) {
    recSel.innerHTML = `
      <option value="none">Solo los ${selectedConfigDays.size} días seleccionados</option>
      <option value="weekly">Todos los ${dayName}</option>
      <option value="daily">Todos los días</option>
      <option value="biweekly">Cada dos semanas (${dayName})</option>
    `;
  } else {
    recSel.innerHTML = `
      <option value="none">Solo hoy (${formattedDate})</option>
      <option value="weekly">Todos los ${dayName}</option>
      <option value="daily">Todos los días</option>
      <option value="biweekly">Cada dos semanas (${dayName})</option>
    `;
  }
  recSel.value = 'none';

  // Build time selects
  let timeOptions = '';
  for(let h=7; h<=22; h++) {
    for(let m=0; m<60; m+=15) {
      const t = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
      timeOptions += `<option value="${t}">${t}</option>`;
    }
  }
  document.getElementById('block-start').innerHTML = timeOptions;
  document.getElementById('block-end').innerHTML = timeOptions;

  window.toggleBlockRecurrenceEnd();
  document.getElementById('block-modal').classList.remove('hidden');
};

window.toggleBlockRecurrenceEnd = () => {
  const val = document.getElementById('block-recurrence').value;
  const ef = document.getElementById('block-recurrence-end-container');
  if(ef) ef.classList.toggle('hidden', val === 'none');
};

window.closeBlockModal = () => document.getElementById('block-modal').classList.add('hidden');

window.toggleBlockFullDay = () => {
  const isFull = document.getElementById('block-fullday').checked;
  const container = document.getElementById('block-time-container');
  if(isFull) {
    container.style.opacity = '0.4';
    container.style.pointerEvents = 'none';
  } else {
    container.style.opacity = '1';
    container.style.pointerEvents = 'auto';
  }
};

window.saveBlockForm = async () => {
  const emp = document.getElementById('block-emp-name').value;
  const isFullDay = document.getElementById('block-fullday').checked;
  let startTime = document.getElementById('block-start').value;
  let endTime = document.getElementById('block-end').value;
  
  if(isFullDay) {
    startTime = '00:00';
    endTime = '23:59';
  }

  const reason = document.getElementById('block-reason').value || 'Otro';
  const recurrence = document.getElementById('block-recurrence').value;
  const recurrenceEnd = document.getElementById('block-recurrence-end')?.value || null;
  
  if(t2m(startTime) >= t2m(endTime)) return alert('La hora inicio debe ser anterior al fin.');
  
  try {
    const days = Array.from(selectedConfigDays);
    if (days.length > 0 && recurrence === 'none') {
      const promises = [];
      days.forEach(dStr => {
        const block = { employee: emp, startTime, endTime, reason, recurrence, date: dStr };
        promises.push(window.saveBlock(block));
      });
      await Promise.all(promises);
      window.closeBlockModal();
      window.clearConfigSelection();
      if(isConfigMode) window.toggleEmpConfigMode();
    } else {
      const block = { employee: emp, startTime, endTime, reason, recurrence };
      if(recurrence === 'none') {
        block.date = document.getElementById('block-date').value;
      } else {
        block.weekday = new Date((document.getElementById('block-date').value || getLD(new Date())) + 'T12:00:00').getDay();
      }
      if(recurrenceEnd && recurrence !== 'none') block.recurrenceEnd = recurrenceEnd;
      await window.saveBlock(block);
      window.closeBlockModal();
      window.clearConfigSelection();
      if(isConfigMode) window.toggleEmpConfigMode();
    }
    if (currentTab.startsWith('calendar_emp_')) {
      if (specialistViewLevel === 'month') {
        renderMonthGrid('calendar-body', false);
      } else {
        window.renderSpecialistDayView();
      }
    }
  } catch(e) {
    alert('❌ Error: ' + e.message);
  }
};

// ---- APPOINTMENT MODAL ----
var _aptSvcs=[];
window.addSvcToApt=()=>{
  document.getElementById('m-svc-picker').classList.remove('hidden');
  document.getElementById('m-svc-search').value='';
  filterSvcOptions();
  setTimeout(function(){document.getElementById('m-svc-search').focus()},100);
};
function filterSvcOptions(){
  var q=(document.getElementById('m-svc-search').value||'').toLowerCase().trim();
  var c=document.getElementById('m-svc-options');
  var filtered=servicesDB.filter(function(s){return(q===''||s.name.toLowerCase().includes(q))});
  if(filtered.length===0){c.innerHTML='<p class="text-xs text-center py-4 text-slate-400">Sin resultados</p>';return}
  c.innerHTML=filtered.map(function(s){return'<div onclick="window.confirmAddSvc(\''+s.id+'\')" class="p-2 rounded-xl cursor-pointer hover:bg-[var(--cream)] transition-colors border border-transparent hover:border-[var(--blue-mid)]" style="background:white"><div class="font-bold text-xs">'+esc(s.name)+'</div><div class="text-[10px] text-slate-400">'+(s.duration||0)+'min · '+(s.price||0)+'€</div></div>'}).join('');
};
window.confirmAddSvc=function(id){
  if(!id)return;
  var s=getSvcById(id);if(!s)return;
  var emp=s.employee||(employeesDB.length>0?employeesDB[0].name:'');
  if(emp==='Todas'||emp==='Cualquiera')emp=employeesDB.length>0?employeesDB[0].name:'';
  if(emp.includes(',')){var parts=emp.split(',').map(function(e){return e.trim()}).filter(Boolean);emp=parts[0]}
  _aptSvcs.push({id:s.id,name:s.name,employee:emp,duration:s.duration||15,price:s.price||0});
  document.getElementById('m-svc-picker').classList.add('hidden');
  updateAptSvcSummary();
  filterSvcOptions();
};
window.removeSvcFromApt=function(idx){_aptSvcs.splice(idx,1);updateAptSvcSummary()};
function updateAptSvcSummary(){
  var list=document.getElementById('m-svc-list');var total=document.getElementById('m-svc-total');
  list.innerHTML=_aptSvcs.map(function(s,i){
    var curEmp=s.employee||'';
    var empOpts=employeesDB.map(function(e){var sel=e.name===curEmp?' selected':'';return '<option value="'+esc(e.name)+'"'+sel+'>'+esc(e.name)+'</option>'}).join('');
    return '<div class="flex flex-col gap-1 p-2 rounded-lg bg-white border" style="border-color:var(--brown-light)">'+
      '<div class="flex items-center gap-2">'+
        '<span class="flex-1 text-xs font-medium">'+esc(s.name)+'</span>'+
        '<span class="text-[10px] font-bold" style="color:var(--blue-deep)">'+(s.price||0)+'€</span>'+
        '<button onclick="window.removeSvcFromApt('+i+')" class="text-red-400 hover:text-red-600 p-0.5"><i data-lucide="x" class="w-3 h-3"></i></button>'+
      '</div>'+
      '<div class="flex items-center gap-2 text-[10px]"><span style="color:var(--brown-mid)">Especialista:</span>'+
        '<select onchange="window.changeSvcEmp('+i+',this.value)" class="p-1 border rounded-lg text-[10px] font-medium" style="border-color:var(--brown-light);background:var(--cream);color:var(--brown)">'+empOpts+'</select>'+
      '</div>'+
    '</div>';
  }).join('');
  var tPrice=_aptSvcs.reduce(function(sum,s){return sum+parseFloat(s.price||0)},0);
  var tDur=_aptSvcs.reduce(function(sum,s){return sum+parseInt(s.duration||0, 10)},0);
  document.getElementById('m-price').value=tPrice;
  if(_aptSvcs.length>0){total.classList.remove('hidden');total.textContent='Total: '+tDur+' min · '+tPrice+'€'}else{total.classList.add('hidden')}
  var emps=[...new Set(_aptSvcs.map(function(s){return s.employee}).filter(Boolean))];
  setTimeout(function(){if(window.lucide)lucide.createIcons()},50);
  window.updateAvailability();
}
window.changeSvcEmp=function(idx,val){if(_aptSvcs[idx])_aptSvcs[idx].employee=val;updateAptSvcSummary()};
window.updateAvailability=()=>{const date=document.getElementById('m-date').value;
const grid=document.getElementById('time-grid');if(!grid)return;grid.innerHTML='';if(!date||_aptSvcs.length===0){grid.innerHTML='<p class="col-span-full text-center text-slate-400 italic py-4">Completa los datos...</p>';return}
const empNames=[];const empDurs={};
_aptSvcs.forEach(function(s){(s.employee||'').split(',').map(function(e){return e.trim()}).filter(Boolean).forEach(function(e){if(e!=='Cualquiera'){if(!empNames.includes(e))empNames.push(e);if(!empDurs[e])empDurs[e]=0;empDurs[e]+=(s.duration||0)}})});
const isMulti=empNames.length>1;
const maxDur=isMulti?Math.max(...Object.values(empDurs)):0;
const totalDur=_aptSvcs.reduce(function(sum,s){return sum+parseInt(s.duration||0, 10)},0)||15;
// Check if employee is busy for a duration block
const isEmpBusy=(empName,start,end)=>{
  return appointments.some(function(a){return a.date===date&&empInApt(a,empName)&&a.id!==editingId&&a.status!=='cancelled'&&start<t2m(a.time)+(a.duration||15)&&end>t2m(a.time)});
};
// Determine range from all involved employees
let bs=null,be=null;
const checkEmps=isMulti?empNames:(empNames.length===1?empNames:[]);
if(checkEmps.length>0){
  checkEmps.forEach(en=>{const dc=getDailyConfig(date,en);if(dc.type!=='closed'){const s=dc.start||config.start||"09:00";const e=dc.type==='split'?(dc.end2||dc.end||config.end||"20:00"):(dc.end||config.end||"20:00");if(bs===null||t2m(s)<bs)bs=t2m(s);if(be===null||t2m(e)>be)be=t2m(e)}});
}else{const dc=getDailyConfig(date,'global');if(dc.type!=='closed'){bs=t2m(dc.start||config.start||"09:00");be=t2m(dc.type==='split'?(dc.end2||dc.end||config.end||"20:00"):(dc.end||config.end||"20:00"))}}
if(bs===null){bs=t2m("09:00");be=t2m("20:00")}
const dur=isMulti?maxDur:totalDur;
for(let t=bs;t+dur<=be;t+=15){
  const ts=m2t(t);
  let free=false;
  if(isMulti){
    free=empNames.every(en=>{
      const dc=getDailyConfig(date,en);if(dc.type==='closed')return false;
      const eS=t2m(dc.start||config.start||"09:00"),eE=t2m(dc.end||config.end||"20:00");
      const eDur=empDurs[en];
      let inShift = (t>=eS && t+eDur<=eE);
      if(dc.type==='split'&&dc.start2&&dc.end2){const eS2=t2m(dc.start2),eE2=t2m(dc.end2);if(t>=eS2&&t+eDur<=eE2)inShift=true;}
      if(!inShift)return false;
      const closedH=window.getClosedHoursForDay(date,en);
      if(closedH.some(ch=>ch.entity==='global'||ch.entity===en)){const chFrom=t2m(ch.from),chTo=t2m(ch.to);if(t<chTo&&t+eDur>=chFrom)return false;}
      const empBlocks=window.loadBlocksForDate(date,en);
      if(empBlocks.some(b=>{const bFrom=t2m(b.startTime),bTo=t2m(b.endTime);return t<bTo&&t+eDur>bFrom;}))return false;
      return !isEmpBusy(en,t,t+eDur);
    });
  }else{
    const empName=empNames[0]||'';
    const dc=getDailyConfig(date,empName||'global');if(dc.type==='closed'){free=false}else{
      const eS=t2m(dc.start||config.start||"09:00"),eE=t2m(dc.end||config.end||"20:00");
      let inShift = (t>=eS && t+dur<=eE);
      if(dc.type==='split'&&dc.start2&&dc.end2){const eS2=t2m(dc.start2),eE2=t2m(dc.end2);if(t>=eS2&&t+dur<=eE2)inShift=true;}
      if(inShift){
        const closedH=window.getClosedHoursForDay(date,empName);
        var chBlocked=closedH.some(function(ch){var chFrom=t2m(ch.from),chTo=t2m(ch.to);return t<chTo&&t+dur>=chFrom});
        const empBlocks=window.loadBlocksForDate(date,empName);
        var blockBlocked=empBlocks.some(function(b){var bFrom=t2m(b.startTime),bTo=t2m(b.endTime);return t<bTo&&t+dur>bFrom;});
        if(!chBlocked&&!blockBlocked&&!isEmpBusy(empName,t,t+dur))free=true;
      }
    }
  }
  const btn=document.createElement('button');
  if(!free){
    btn.className='time-btn occupied';btn.innerText=ts;btn.disabled=true;
    if(selectedTime===ts){
      selectedTime=null;
      const lbl=document.getElementById('selected-time-label');
      if(lbl)lbl.innerText='Selecciona...';
    }
  }
  else{btn.className=`time-btn ${selectedTime===ts?'selected':'bg-white'}`;btn.innerText=ts;btn.onclick=()=>{selectedTime=ts;document.getElementById('selected-time-label').innerText=ts;window.updateAvailability()}}
  grid.appendChild(btn)
}
if(grid.innerHTML==='')grid.innerHTML='<p class="col-span-full text-center text-red-400 italic py-4 text-[10px]">Sin tiempo suficiente</p>'};
window.openModal=(id=null)=>{editingId=id;selectedTime=null;_aptSvcs=[];document.getElementById('modal').classList.remove('hidden');document.getElementById('btn-delete-apt').classList.toggle('hidden',!id);
populateModalSelects();
if(id){const apt=appointments.find(a=>a.id===id);if(!apt)return;document.getElementById('m-name').value=apt.clientName||apt.name||'';document.getElementById('m-phone').value=apt.clientPhone||apt.phone||'';document.getElementById('m-email').value=apt.clientEmail||apt.email||'';document.getElementById('m-date').value=apt.date;document.getElementById('m-price').value=apt.price||0;document.getElementById('m-status').value=apt.status||'pending';document.getElementById('m-paid').checked=apt.isPaid||false;selectedTime=apt.time;document.getElementById('selected-time-label').innerText=apt.time;
if(apt.services&&Array.isArray(apt.services)){_aptSvcs=apt.services.map(function(s){return{id:s.id||s.name,name:s.name,employee:s.employee||'',duration:s.duration||15,price:s.price||0}})}else{_aptSvcs=[{id:'',name:apt.service||'',employee:apt.employee||'',duration:apt.duration||15,price:apt.price||0}]};updateAptSvcSummary()}
else{['m-name','m-phone','m-email','m-price'].forEach(i=>document.getElementById(i).value='');document.getElementById('m-paid').checked=false;document.getElementById('m-status').value='confirmed';document.getElementById('m-date').value=selectedDayInModal||new Date().toISOString().split('T')[0];_aptSvcs=[];updateAptSvcSummary()}
window.updateAvailability()};
window.saveAppointment=async()=>{if(!selectedTime)return alert("Selecciona una hora.");
if(_aptSvcs.length===0)return alert("Añade al menos un servicio.");
var sName=_aptSvcs.map(function(s){return s.name}).join(' + ');
var empStr=_aptSvcs.map(function(s){var e=s.employee||'';if(e.includes(',')){var parts=e.split(',').map(function(p){return p.trim()}).filter(Boolean);e=parts[0]};return e}).filter(Boolean).join(', ');
var sDur=_aptSvcs.reduce(function(sum,s){return sum+parseInt(s.duration||0, 10)},0);
var sPrice=parseFloat(document.getElementById('m-price').value)||0;
var phone=document.getElementById('m-phone').value;window.cleanPhone(document.getElementById('m-phone'));phone=document.getElementById('m-phone').value;
var isCancelled = document.getElementById('m-status').value === 'cancelled';
var existing = appointments.find(function(a){return a.id===editingId});
var cancelledAt = null;
if (isCancelled) {
    cancelledAt = (existing && existing.cancelledAt) ? existing.cancelledAt : new Date().toISOString();
}
var data={clientName:document.getElementById('m-name').value.trim(),clientPhone:phone,clientEmail:document.getElementById('m-email').value.trim(),services:_aptSvcs,service:sName,employee:empStr||'Todas',date:document.getElementById('m-date').value,time:selectedTime,duration:sDur||15,price:sPrice,status:document.getElementById('m-status').value,isPaid:document.getElementById('m-paid').checked,updatedAt:new Date().toISOString()};
if(cancelledAt) {
    data.cancelledAt = cancelledAt;
} else if(existing && existing.cancelledAt && !isCancelled) {
    data.cancelledAt = null;
}
if(!data.clientName)return alert("Escribe el nombre del cliente.");
if(data.clientEmail && !data.clientEmail.includes('@')) return alert("Por favor, introduce un correo electrónico válido.");
if(!data.clientPhone || data.clientPhone.replace(/\D/g, '').length < 9) return alert("Introduce un teléfono válido (mínimo 9 dígitos) para poder enviar confirmación por WhatsApp.");
try{var isEdit=!!editingId;let res;if(isEdit){await updateDoc(doc(db,'artifacts',AID,'public','data','appointments',editingId),data);data.id=editingId;}
else{data.createdAt=new Date().toISOString();if(isCancelled) data.cancelledAt = new Date().toISOString();res=await addDoc(collection(db,'artifacts',AID,'public','data','appointments'),data);data.id=res.id;}
window.closeModal();
    window.trackNotif(data, 'new');
    var payload = {
      event: isEdit ? 'modification' : 'new',
      appointment: data,
      newAppointment: data,
      ...data,
      clientEmail: data.clientEmail || data.client_email,
      client_email: data.client_email || data.clientEmail,
      clientName: data.clientName || data.client_name,
      client_name: data.client_name || data.clientName
    };
    notifyWebhook(isEdit?'modification':'new', payload);
}catch(e){alert("Error: "+e.message)}};
window.deleteAptFromModal=async(id=null)=>{var tid=id||editingId;if(!tid)return;if(!confirm("¿Cancelar esta cita? Se marcará como cancelada."))return;
try{var apt=appointments.find(function(a){return a.id===tid});if(apt){
  window.trackNotif({...apt,id:tid,status:'cancelled'},'cancelled');
  var cancelPayload = {
    event: 'cancellation',
    appointment: {...apt, id: tid, status: 'cancelled'},
    ...apt,
    id: tid,
    status: 'cancelled',
    clientEmail: apt.clientEmail || apt.client_email,
    client_email: apt.client_email || apt.clientEmail,
    clientName: apt.clientName || apt.client_name,
    client_name: apt.client_name || apt.clientName
  };
  notifyWebhook('cancellation', cancelPayload);
}
await updateDoc(doc(db,'artifacts',AID,'public','data','appointments',tid),{
  status: 'cancelled',
  cancelledAt: new Date().toISOString(),
  cancelledBy: 'panel',
  updatedAt: new Date().toISOString()
});
var localApt = appointments.find(function(a){return a.id===tid});
if(localApt){
  localApt.status = 'cancelled';
  localApt.cancelledAt = new Date().toISOString();
  localApt.cancelledBy = 'panel';
  localApt.updatedAt = new Date().toISOString();
}
window.closeModal();
if(typeof render==='function')render();
if(typeof renderSpecialistDayView==='function'&&currentTab.startsWith('calendar_emp_'))renderSpecialistDayView();
if(typeof window.renderList==='function')window.renderList();
}catch(e){alert("Error: "+e.message)}};
window.cleanPhone=function(el){
    if(!el) return '';
    var v=(typeof el === 'string' ? el : (el.value || '')).trim();
    v = v.replace(/[\u200E\u200F\u200B\u200C\u200D\u202A-\u202E\uFEFF]/g, '');
    v = v.replace(/^\+34/,'');           // quita +34
    v = v.replace(/[\s\-\(\)\.]/g,'');   // quita espacios, guiones, etc.
    if(v.startsWith('34')&&v.length>9) v=v.slice(2); // quita 34 si es prefijo país (11+ dígitos)
    if(typeof el === 'object' && el.value !== undefined) el.value=v;
    return v;
};
// Forzar listener vía JS (script al final del body, DOM ya listo)
(function(){
    function onClean(e){var me=e.target;setTimeout(function(){window.cleanPhone(me)},10)}
    var inp=document.getElementById('m-phone');
    if(inp)inp.addEventListener('input',onClean);
    var tpv=document.getElementById('tpv-client-phone');
    if(tpv)tpv.addEventListener('input',onClean);
})();
window.sendWhatsapp=(phone,name,date,time)=>{if(!phone)return;let p=phone.replace(/\D/g,'');if(!p.startsWith('34')&&p.length===9)p='34'+p;
const msg=`Hola ${name}, te recordamos tu cita en UNIR el día ${date} a las ${time}. ¡Te esperamos!`;window.open(`https://wa.me/${p}?text=${encodeURIComponent(msg)}`,'_blank')};

// ── NOTIFICACIONES DE ACTIVIDAD ──
var g_localNotifs=[];

window.trackNotif=function(r,type){
    if(!r||!r.id)return;
    var dup=g_localNotifs.some(function(n){return n.id===r.id&&n.type===type});
    if(dup)return;
    var svc=getSvcByName(r.service);
    g_localNotifs.unshift({id:r.id,name:r.clientName||r.name||'Cliente',date:r.date,time:r.time,service:r.service,employee:r.employee,type:type});
    if(g_localNotifs.length>50)g_localNotifs.length=50;
    saveLocalNotifs();
    renderLocalNotifs();
};

function saveLocalNotifs(){
    try{localStorage.setItem('magic_notifs',JSON.stringify(g_localNotifs))}catch(e){}
}
function loadLocalNotifs(){
    try{var s=localStorage.getItem('magic_notifs');if(s)g_localNotifs=JSON.parse(s)}catch(e){}
}

function renderLocalNotifs(){
    var c=document.getElementById('view-notifications-content');
    if(!c)return;
    if(g_localNotifs.length===0){
        c.innerHTML='<div class="bg-white p-12 rounded-3xl border text-center"><i data-lucide="bell-off" class="w-12 h-12 text-slate-300 mx-auto mb-4"></i><p class="font-bold text-slate-400 uppercase text-sm">Sin notificaciones</p></div>';
        if(window.lucide)lucide.createIcons();
        return;
    }
    c.innerHTML=g_localNotifs.map(function(r){
        var dp=r.date?r.date.split('-'):[];
        var fd=dp.length===3?dp[2]+'/'+dp[1]+'/'+dp[0]:'-';
        var icon,bgCol,borderCol,label;
        if(r.type==='cancelled'||r.type==='cancellation'){icon='x-circle';bgCol='bg-red-500';borderCol='border-red-200';label='Cancelada'}
        else if(r.type==='modified'||r.type==='modification'){icon='edit-3';bgCol='bg-amber-500';borderCol='border-amber-200';label='Modificada'}
        else if(r.type==='completed'){icon='check-circle';bgCol='bg-green-500';borderCol='border-green-200';label='Pagada'}
        else{icon='bell';bgCol='bg-blue-500';borderCol='border-blue-200';label='Nueva'}
        var bg=r.type==='cancelled'||r.type==='cancellation'?'bg-red-50':r.type==='modified'||r.type==='modification'?'bg-amber-50':r.type==='completed'?'bg-green-50':'bg-blue-50';
        return '<div onclick="window.viewAppointment(\''+r.id+'\')" class="notif-new flex items-start gap-3 p-4 '+bg+' border '+borderCol+' rounded-2xl cursor-pointer hover:opacity-90 transition-all shadow-sm">'+
            '<div class="p-2.5 rounded-full '+bgCol+' text-white shrink-0 animate-pulse"><i data-lucide="'+icon+'" class="w-5 h-5"></i></div>'+
            '<div class="flex-1 min-w-0">'+
            '<div class="flex items-center gap-2"><p class="font-extrabold text-sm text-slate-800 truncate">'+(r.name||'Cliente')+'</p><span class="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded '+bgCol+' text-white">'+label+'</span></div>'+
            '<p class="text-xs font-bold text-slate-500 mt-0.5">'+fd+' · '+r.time+' · '+r.service+(r.employee?' · '+r.employee:'')+'</p>'+
            '</div>'+
            '<button onclick="event.stopPropagation();dismissLocalNotif(\''+r.id+'\',\''+r.type+'\')" class="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors shrink-0"><i data-lucide="x" class="w-4 h-4"></i></button>'+
            '</div>';
    }).join('');
    if(window.lucide)lucide.createIcons();
}

window.dismissLocalNotif=function(id,type){
    g_localNotifs=g_localNotifs.filter(function(n){return!(n.id===id&&n.type===type)});
    saveLocalNotifs();
    renderLocalNotifs();
};

// Cargar notificaciones al iniciar
loadLocalNotifs();

// ---- SUPABASE INIT ----
const init=async()=>{
setStatus('loading','Iniciando Supabase...');
try{
initializeApp();
setStatus('loading','Conectando DB...');
db=getFirestore();
auth=getAuth();
setStatus('loading','Autenticando...');
onAuthStateChanged(auth,user=>{
var btn=document.getElementById('login-btn');if(btn){btn.disabled=false;btn.textContent='Iniciar Sesión'}
if(user){
document.getElementById('login-screen').classList.add('hidden');
document.getElementById('app-container').classList.remove('hidden');
setStatus('ok','Conectado ✓');
console.log('✅ Auth OK, UID:',user.uid);
startListeners();
setTimeout(()=>window.setTab('calendar_all'),100);
} else {
document.getElementById('login-screen').classList.remove('hidden');
document.getElementById('app-container').classList.add('hidden');
setStatus('loading','Desconectado');
}
});
}catch(e){
console.error('❌ Init error:',e);
setStatus('error','Error Fatal');
alert('Error al iniciar Supabase: '+e.message);
}};
window.doLogin=()=>{var email=document.getElementById('login-email').value.trim();var pass=document.getElementById('login-password').value;var errEl=document.getElementById('login-error');var btn=document.getElementById('login-btn');if(!email||!pass){errEl.textContent='Introduce correo y contraseña';errEl.classList.remove('hidden');return}
errEl.classList.add('hidden');btn.disabled=true;btn.textContent='Entrando...';signInWithEmailAndPassword(auth,email,pass).then(function(){btn.textContent='Iniciar Sesión';btn.disabled=false}).catch(function(e){var m=e.code||'';if(m.includes('too-many-requests')){errEl.textContent='⚠️ Bloqueado por actividad inusual. Espera 10-15 min o restablece tu contraseña.'}else if(m.includes('wrong-password')||m.includes('user-not-found')||m.includes('invalid-credential')){errEl.textContent='Usuario o contraseña incorrectos'}else{errEl.textContent='Error: '+e.message};errEl.classList.remove('hidden');btn.textContent='Iniciar Sesión';btn.disabled=false})};
window.doLogout=()=>{document.getElementById('login-btn').disabled=false;document.getElementById('login-btn').textContent='Iniciar Sesión';auth.signOut().catch(function(e){console.error('Logout error:',e)})};
window.toggleSidebar=()=>{
  var s=document.getElementById('sidebar');var o=document.getElementById('sidebar-overlay');var h=document.getElementById('hamburger-btn');
  var isOpen=s.classList.toggle('open');o.classList.toggle('open',isOpen);
  if(isOpen){document.body.style.overflow='hidden'}else{document.body.style.overflow=''}};
window.closeSidebar=()=>{if(window.innerWidth>767)return;
  document.getElementById('sidebar').classList.remove('open');document.getElementById('sidebar-overlay').classList.remove('open');document.body.style.overflow=''};



window.handleBellClick = () => {
    const webApts = appointments.filter(a => a.type === 'web' || a.source === 'cliente');
    const seen = JSON.parse(localStorage.getItem('seenWebApts_' + AID) || '[]');
    const pending = webApts.filter(a => !seen.includes(a.id));
    
    window.highlightIds = pending.map(a => a.id);
    
    const allIds = webApts.map(a => a.id);
    localStorage.setItem('seenWebApts_' + AID, JSON.stringify(allIds));
    
    // Limpiar cancelledNotified de IDs que ya no existen
    const currentIds = new Set(allIds);
    const cancelledNotified = JSON.parse(localStorage.getItem('cancelledNotified_' + AID) || '[]');
    const cleaned = cancelledNotified.filter(id => currentIds.has(id));
    localStorage.setItem('cancelledNotified_' + AID, JSON.stringify(cleaned));

    const bell = document.getElementById('floating-bell');
    if(bell) bell.classList.add('hidden');

    if(pending.length === 1) {
        window.viewAppointment(pending[0].id);
    } else {
        window.setTab('appointments');
    }
};

window.viewAppointment = function(id) {
    var apt = appointments.find(function(a) { return a.id === id; });
    if(!apt) return alert('Reserva no encontrada');
    var svc = getSvcByName(apt.service);
    var dp = apt.date ? apt.date.split('-') : [];
    var fd = dp.length === 3 ? dp[2] + '/' + dp[1] + '/' + dp[0] : (apt.date || '-');
    var statusLabel = apt.status === 'confirmed' ? '🔵 Confirmada' : apt.status === 'completed' ? '🟢 Pagada' : apt.status === 'cancelled' ? '🔴 Cancelada' : apt.status || 'Pendiente';
    var sourceLabel = apt.source === 'cliente' || apt.type === 'web' ? '🌐 Web' : '📋 Panel';
    
    var createdDate = '-';
    if(apt.createdAt) {
        var d = new Date(apt.createdAt);
        if(!isNaN(d)) {
            createdDate = d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        }
    }
    var modifiedDate = '';
    if(apt.updatedAt && apt.createdAt && apt.updatedAt !== apt.createdAt) {
        var d = new Date(apt.updatedAt);
        if(!isNaN(d)) {
            modifiedDate = d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        }
    }
    var cancelledDate = '';
    if(apt.status === 'cancelled' || apt.cancelledAt) {
        var cDate = apt.cancelledAt || apt.updatedAt;
        if(cDate) {
            var d = new Date(cDate);
            if(!isNaN(d)) {
                cancelledDate = d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            }
        }
    }
    
    window._toggleAptTechInfo = function(btn) {
        var info = document.getElementById('apt-tech-info');
        if(info.classList.contains('hidden')) {
            info.classList.remove('hidden');
            btn.style.opacity = '1';
        } else {
            info.classList.add('hidden');
            btn.style.opacity = '0.3';
        }
    };

    var overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 bg-black/60 flex items-center justify-center p-2 z-[70] backdrop-blur-sm';
    overlay.onclick = function(e) { if(e.target === overlay) overlay.remove(); };
    overlay.innerHTML =
        '<div class="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden relative" style="border:1px solid var(--brown-light)">' +
            '<button onclick="window._toggleAptTechInfo(this)" class="absolute top-6 right-16 p-1 rounded-full hover:bg-slate-100 transition-all opacity-30" style="color:var(--brown-mid)"><i data-lucide="info" class="w-3 h-3"></i></button>' +
            '<div class="p-5 border-b flex justify-between items-center" style="background:var(--cream);border-color:var(--brown-light)">' +
                '<h3 class="font-serif italic font-semibold text-xl" style="color:var(--brown)">Detalle de Reserva</h3>' +
                '<button onclick="this.closest(\'.fixed\').remove()" class="p-2 rounded-full hover:bg-slate-200 transition-colors" style="color:var(--brown-mid)"><i data-lucide="x" class="w-5 h-5"></i></button>' +
            '</div>' +
            '<div class="p-6 space-y-4">' +
                '<div class="flex items-center gap-3 pb-4" style="border-bottom:1px solid var(--brown-light)">' +
                    '<div class="w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold text-white" style="background:var(--blue-deep)">' + ((apt.clientName || apt.name) ? (apt.clientName || apt.name).charAt(0).toUpperCase() : '?') + '</div>' +
                    '<div><p class="font-bold text-lg" style="color:var(--brown)">' + esc(apt.clientName || apt.name || 'Cliente') + '</p>' +
                    '<p class="text-xs font-medium" style="color:var(--brown-mid)">' + statusLabel + ' · ' + sourceLabel + '</p></div>' +
                '</div>' +
                '<div class="grid grid-cols-2 gap-3 text-sm">' +
                    '<div class="p-3 rounded-xl" style="background:var(--cream)"><p class="text-[9px] font-bold uppercase tracking-widest" style="color:var(--brown-mid)">Fecha</p><p class="font-bold mt-1" style="color:var(--brown)">' + fd + '</p></div>' +
                    '<div class="p-3 rounded-xl" style="background:var(--cream)"><p class="text-[9px] font-bold uppercase tracking-widest" style="color:var(--brown-mid)">Hora</p><p class="font-bold mt-1" style="color:var(--blue-deep)">' + (apt.time || '-') + 'h</p></div>' +
                    '<div class="p-3 rounded-xl" style="background:var(--cream)"><p class="text-[9px] font-bold uppercase tracking-widest" style="color:var(--brown-mid)">Servicio</p><p class="font-bold mt-1" style="color:var(--brown)">' + esc(apt.service || '-') + '</p></div>' +
                    '<div class="p-3 rounded-xl" style="background:var(--cream)"><p class="text-[9px] font-bold uppercase tracking-widest" style="color:var(--brown-mid)">Especialista</p><p class="font-bold mt-1" style="color:var(--brown)">' + esc(apt.employee || '-') + '</p></div>' +
                    '<div class="p-3 rounded-xl" style="background:var(--cream)"><p class="text-[9px] font-bold uppercase tracking-widest" style="color:var(--brown-mid)">Email</p><p class="font-bold mt-1 truncate" style="color:var(--brown)">' + esc(apt.clientEmail || apt.email || '-') + '</p></div>' +
                    '<div class="p-3 rounded-xl" style="background:var(--cream)"><p class="text-[9px] font-bold uppercase tracking-widest" style="color:var(--brown-mid)">Teléfono</p><p class="font-bold mt-1" style="color:var(--brown)">' + esc(apt.clientPhone || apt.phone || '-') + '</p></div>' +
                '</div>' +
                (apt.price ? '<div class="flex justify-between p-3 rounded-xl font-bold" style="background:var(--cream-dark)"><span style="color:var(--brown-mid)">Precio</span><span style="color:var(--brown)">' + parseFloat(apt.price).toFixed(2) + ' €</span></div>' : '') +
                (apt.notes ? '<div class="p-3 rounded-xl text-sm" style="background:#fff8e6"><p class="text-[9px] font-bold uppercase tracking-widest mb-1" style="color:var(--brown-mid)">Notas</p><p style="color:var(--brown)">' + esc(apt.notes) + '</p></div>' : '') +
                '<div id="apt-tech-info" class="hidden p-3 rounded-xl bg-slate-50 border border-slate-200 mt-2 text-[10px] space-y-1 font-mono text-slate-500">' +
                    '<p><strong class="text-slate-700">ID Reserva:</strong> ' + apt.id + '</p>' +
                    '<p><strong class="text-slate-700">Canal Entrada:</strong> ' + sourceLabel + '</p>' +
                    '<p><strong class="text-slate-700">Fecha Creación:</strong> ' + createdDate + '</p>' +
                    (modifiedDate ? '<p><strong class="text-slate-700">Fecha Modificación:</strong> ' + modifiedDate + '</p>' : '') +
                    (cancelledDate ? '<p><strong class="text-slate-700">Fecha Cancelación:</strong> ' + cancelledDate + '</p>' : '') +
                '</div>' +
            '</div>' +
            '<div class="p-5 border-t flex gap-3" style="background:var(--cream);border-color:var(--brown-light)">' +
                '<button onclick="this.closest(\'.fixed\').remove();window.openModal(\'' + id + '\')" class="flex-1 py-3 rounded-2xl font-bold uppercase text-xs tracking-widest shadow-md active:scale-95 transition-all text-white" style="background:var(--blue-deep)">Editar reserva</button>' +
                '<button onclick="this.closest(\'.fixed\').remove()" class="flex-1 py-3 border rounded-2xl font-bold uppercase text-xs tracking-widest" style="color:var(--brown-mid);border-color:var(--brown-light)">Cerrar</button>' +
            '</div>' +
        '</div>';
    document.body.appendChild(overlay);
    if(window.lucide) lucide.createIcons();
};

// --- MULTI SELECT LOGIC ---
window.toggleConfigDaySelection = (ds, forceSelect) => {
    if (forceSelect !== undefined) {
        if (forceSelect) selectedConfigDays.add(ds);
        else selectedConfigDays.delete(ds);
    } else {
        if (selectedConfigDays.has(ds)) selectedConfigDays.delete(ds);
        else selectedConfigDays.add(ds);
    }
    
    document.querySelectorAll(`.calendar-day[data-ds="${ds}"]`).forEach(cell => {
        if(selectedConfigDays.has(ds)) {
            cell.style.boxShadow = "inset 0 0 0 4px #f97316";
            cell.style.backgroundColor = "#fff7ed";
        } else {
            cell.style.boxShadow = "";
            cell.style.backgroundColor = "";
        }
    });
    window.updateConfigMultiActionBar();
};

window.updateConfigMultiActionBar = () => {
    let bar = document.getElementById('config-multi-action-bar');
    if(!bar) {
        bar = document.createElement('div');
        bar.id = 'config-multi-action-bar';
        bar.className = 'fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-800 text-white px-6 py-4 rounded-2xl shadow-2xl z-[100] flex items-center gap-4 transition-all duration-300 transform translate-y-20 opacity-0 pointer-events-none';
        document.body.appendChild(bar);
    }
    
    if(selectedConfigDays.size > 0) {
        const isEmpTab = currentTab.startsWith('calendar_emp_');
        let buttonHtml = '';
        if(isEmpTab) {
            const eid = currentTab.replace('calendar_emp_','');
            const emp = getEmpById(eid);
            const empName = emp ? emp.name : '';
            buttonHtml = `<button onclick="window.openBlockModal('${empName.replace(/'/g,"\\'")}', '${Array.from(selectedConfigDays)[0]}')" class="px-4 py-2 bg-orange-500 hover:bg-orange-600 rounded-xl font-bold text-xs uppercase transition-colors pointer-events-auto">🔒 Bloquear Horario</button>`;
        } else {
            buttonHtml = `<button onclick="window.openMultiDayModal()" class="px-4 py-2 bg-orange-500 hover:bg-orange-600 rounded-xl font-bold text-xs uppercase transition-colors pointer-events-auto">⚙️ Configurar</button>`;
        }

        bar.innerHTML = `
            <span class="font-bold">${selectedConfigDays.size} días</span>
            ${buttonHtml}
            <button onclick="window.clearConfigSelection()" class="p-2 hover:bg-slate-700 rounded-xl transition-colors pointer-events-auto" title="Cancelar selección"><i data-lucide="x" class="w-4 h-4"></i></button>
        `;
        if(window.lucide) window.lucide.createIcons();
        bar.classList.remove('translate-y-20', 'opacity-0', 'pointer-events-none');
    } else {
        bar.classList.add('translate-y-20', 'opacity-0', 'pointer-events-none');
    }
};

window.clearConfigSelection = () => {
    selectedConfigDays.clear();
    document.querySelectorAll('.calendar-day').forEach(el => {
        el.style.boxShadow = "";
        el.style.backgroundColor = "";
    });
    window.updateConfigMultiActionBar();
};

window.openMultiDayModal = () => {
    // Hide action bar when opening modal
    document.getElementById('config-multi-action-bar')?.classList.add('opacity-0', 'pointer-events-none');

    document.getElementById('config-multi-day-modal').classList.remove('hidden');
    setTimeout(() => document.getElementById('config-multi-day-modal').classList.remove('opacity-0'), 10);
    const entity = (currentTab === 'config') ? 'global' : currentTab.replace('calendar_emp_', '');
    document.getElementById('cmd-entity').value = entity;
    
    const days = Array.from(selectedConfigDays);
    const firstDay = days[0];
    selectedDayInModal = firstDay; // Track day for potential single day updates

    document.getElementById('cmd-title').innerText = days.length === 1 ? `Configurar Día: ${firstDay}` : `Configurar ${days.length} días`;
    const empName = entity === 'global' ? 'Global' : (getEmpById(entity)?.name || entity);
    document.getElementById('cmd-subtitle').innerText = empName;

    // Cargar cierres de hora para este día único (si aplica)
    tmpClosedHours = [];
    if (days.length === 1 && firstDay) {
        tmpClosedHours = [...(config.specialDays?.[firstDay]?.closedHours || [])];
        window.renderClosedHoursList();
    } else {
        document.getElementById('local-closed-hours-section')?.classList.add('hidden');
    }

    // Cargar horario configurado del primer día seleccionado (si existe) para no sobreescribir con valores por defecto
    let type = 'continuous';
    let s1 = '09:00', e1 = '14:00';
    let s2 = '16:00', e2 = '20:00';
    
    // Fallback: cargar del horario semanal genérico según el día de la semana
    if (firstDay) {
        const dayNum = parseDate(firstDay).getDay(); // 0: Dom, 1: Lun, ..., 6: Sáb
        let w = null;
        if (entity !== 'global') {
            const ew = config[`weekly_${entity}`];
            if (ew && ew[dayNum]) {
                w = ew[dayNum];
            }
        }
        if (!w && config.weekly && config.weekly[dayNum]) {
            w = config.weekly[dayNum];
        }
        
        if (w) {
            type = (w.type === 'split') ? 'split' : 'continuous';
            s1 = w.start || '09:00';
            e1 = w.end || (type === 'split' ? '14:00' : '20:00');
            if (w.type === 'split') {
                s2 = w.start2 || '16:00';
                e2 = w.end2 || '20:00';
            } else {
                s2 = '16:00';
                e2 = w.end || '20:00';
            }
        }
    }
    
    if (firstDay && config.specialDays?.[firstDay]?.[entity]) {
        const se = config.specialDays[firstDay][entity];
        if (se.start && se.end) {
            s1 = se.start;
            if (se.closedHours && se.closedHours.length > 0) {
                type = 'split';
                e1 = se.closedHours[0];
                const lastCh = se.closedHours[se.closedHours.length - 1];
                let m = parseInt(lastCh.split(':')[0], 10)*60 + parseInt(lastCh.split(':')[1], 10) + 15;
                let h = Math.floor(m/60);
                let mins = m%60;
                s2 = String(h).padStart(2,'0') + ':' + String(mins).padStart(2,'0');
                e2 = se.end;
            } else {
                type = 'continuous';
                e1 = se.end;
            }
        }
    }
    
    document.getElementById('cmd-shift-type').value = type;
    document.getElementById('cmd-start-1').value = s1;
    document.getElementById('cmd-end-1').value = e1;
    document.getElementById('cmd-start-2').value = s2;
    document.getElementById('cmd-end-2').value = e2;
    window.toggleCmdShiftType();
};

window.closeMultiDayModal = () => {
    document.getElementById('config-multi-day-modal').classList.add('opacity-0');
    setTimeout(() => document.getElementById('config-multi-day-modal').classList.add('hidden'), 200);
    window.clearConfigSelection();
};

window.toggleCmdShiftType = () => {
    const type = document.getElementById('cmd-shift-type').value;
    const splitContainer = document.getElementById('cmd-split-container');
    if(type === 'split') {
        splitContainer.classList.remove('hidden');
        splitContainer.classList.add('flex');
    } else {
        splitContainer.classList.add('hidden');
        splitContainer.classList.remove('flex');
    }
};

window.applyMultiDayConfig = async (action) => {
    const entity = document.getElementById('cmd-entity').value;
    const days = Array.from(selectedConfigDays);
    if(days.length === 0) return;
    
    const up = { ...config };
    if(!up.specialDays) up.specialDays = {};
    
    let specialStart = "09:00", specialEnd = "20:00", specialClosedHours = [];
    if(action === 'special') {
        const type = document.getElementById('cmd-shift-type').value;
        const s1 = document.getElementById('cmd-start-1').value || '09:00';
        const e1 = document.getElementById('cmd-end-1').value || '14:00';
        if(type === 'split') {
            const s2 = document.getElementById('cmd-start-2').value || '16:00';
            const e2 = document.getElementById('cmd-end-2').value || '20:00';
            days.forEach(ds => {
                if(!up.specialDays[ds]) up.specialDays[ds] = {};
                up.specialDays[ds][entity] = { 
                    closed: false, 
                    type: 'split', 
                    start: s1, 
                    end: e1,
                    start2: s2,
                    end2: e2
                };
            });
        } else {
            days.forEach(ds => {
                if(!up.specialDays[ds]) up.specialDays[ds] = {};
                up.specialDays[ds][entity] = { 
                    closed: false, 
                    type: 'custom', 
                    start: s1, 
                    end: e1,
                    closedHours: [] 
                };
            });
        }
    } else {
        days.forEach(ds => {
            if(!up.specialDays[ds]) up.specialDays[ds] = {};
            
            if (action === 'reset') {
                delete up.specialDays[ds][entity];
                if(Object.keys(up.specialDays[ds]).length === 0) delete up.specialDays[ds];
            } else if (action === 'closed') {
                up.specialDays[ds][entity] = { closed: true, type: 'closed' };
            }
        });
    }
    
    try {
        await updateDoc(doc(db,'artifacts',AID,'public','data','settings','main'), { specialDays: up.specialDays });
        config.specialDays = up.specialDays;
        window.closeMultiDayModal();
        window.clearConfigSelection();
        if (currentTab === 'config') renderMonthGrid('config-calendar-body', true);
        else if (currentTab.startsWith('calendar_emp_')) renderMonthGrid('calendar-body', false);

        // Mostrar modal resumen confirmación de éxito
        let typeText = '';
        if (action === 'closed') typeText = 'Configurado como 🚫 CERRADO.';
        else if (action === 'special') {
            const type = document.getElementById('cmd-shift-type').value;
            const s1 = document.getElementById('cmd-start-1').value || '09:00';
            const e1 = document.getElementById('cmd-end-1').value || '14:00';
            if (type === 'split') {
                const s2 = document.getElementById('cmd-start-2').value || '16:00';
                const e2 = document.getElementById('cmd-end-2').value || '20:00';
                typeText = `Horario especial: ⏰ ${s1} - ${e1} y ${s2} - ${e2}.`;
            } else {
                typeText = `Horario especial: ⏰ ${s1} - ${e1}.`;
            }
        }
        else if (action === 'reset') typeText = 'Restaurado al horario estándar.';

        const daysFormatted = days.map(ds => {
            const [y, m, d] = ds.split('-').map(Number);
            const dateObj = new Date(y, m - 1, d);
            return dateObj.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
        }).join(', ');

        const summaryEl = document.getElementById('config-success-summary');
        if (summaryEl) {
            summaryEl.innerHTML = `
                <div class="text-sm font-bold text-slate-800">${typeText}</div>
                <div class="text-[10px] text-slate-400 mt-2 uppercase tracking-widest">Fechas afectadas:</div>
                <div class="text-xs text-slate-600 max-h-[80px] overflow-y-auto px-2 font-medium">${daysFormatted}</div>
            `;
        }
        document.getElementById('config-success-modal')?.classList.remove('hidden');
    } catch (e) {
        alert('Error: ' + e.message);
    }
};

document.addEventListener('mouseup', () => { isDraggingSelect = false; });

window.toggleEmpConfigMode = () => {
    isConfigMode = !isConfigMode;
    const btn = document.getElementById('btn-toggle-config-mode');
    const calBody = document.getElementById('calendar-body');
    if(isConfigMode) {
        btn.classList.replace('bg-orange-100', 'bg-orange-500');
        btn.classList.replace('text-orange-700', 'text-white');
        btn.innerHTML = '<i data-lucide="check" class="w-4 h-4"></i> Finalizar Configuración';
        calBody.classList.add('ring-4', 'ring-orange-200');
        selectedConfigDays.clear();
        window.updateConfigMultiActionBar();
    } else {
        btn.classList.replace('bg-orange-500', 'bg-orange-100');
        btn.classList.replace('text-white', 'text-orange-700');
        btn.innerHTML = '<i data-lucide="settings" class="w-4 h-4"></i> Configurar Varios Días';
        calBody.classList.remove('ring-4', 'ring-orange-200');
        selectedConfigDays.clear();
        window.updateConfigMultiActionBar();
    }
    if(window.lucide) window.lucide.createIcons();
    renderMonthGrid('calendar-body', false);
};


const startListeners=()=>{try{console.log("🛠️ startListeners() iniciando...");
// Appointments
onSnapshot(collection(db,'artifacts',AID,'public','data','appointments'),snap=>{appointments=snap.docs.map(d=>({id:d.id,...d.data()}));
if(currentTab==='appointments')window.renderList();
else if(currentTab.startsWith('calendar')){if(specialistViewLevel==='global-day')window.renderGlobalDay();else window.render();}
else if(currentTab==='billing')window.renderAccounting();
else if(currentTab==='clients')window.renderClients();
populateModalSelects();});
// Settings
onSnapshot(doc(db,'artifacts',AID,'public','data','settings','main'),snap=>{
var snapExists=(typeof snap.exists==='function')?snap.exists():!!snap.exists;
if(snapExists){var d=snap.data();if(d)config=Object.assign({start:"09:00",end:"20:00",specialDays:{}},config,d);}
if(currentTab==='config'){setTimeout(function(){window.renderStandardInputs();window.renderConfigEntityTabs();renderMonthGrid('config-calendar-body',true);},0);}
if(currentTab.startsWith('calendar'))window.render();
if(specialistViewLevel==='global-day')window.renderGlobalDay();});
// Services
onSnapshot(collection(db,'artifacts',AID,'public','data','services'),snap=>{servicesDB=snap.docs.map(d=>({id:d.id,...d.data()}));
populateModalSelects();if(currentTab==='services_mgmt')window.renderServicesMgmt()});
// Expenses
onSnapshot(collection(db,'artifacts',AID,'public','data','expenses'),snap=>{
  expensesDB=snap.docs.map(d=>({id:d.id,...d.data()}));
  if(currentTab==='gastos')window.renderExpenses();
});
onSnapshot(collection(db,'artifacts',AID,'public','data','categories'),snap=>{categoriesDB=snap.docs.map(d=>({id:d.id,...d.data()}));
if(currentTab==='services_mgmt')window.renderServicesMgmt()});
// Employees
onSnapshot(collection(db,'artifacts',AID,'public','data','employees'),snap=>{
    employeesDB=snap.docs.map(d=>({id:d.id,...d.data()}));
    window.renderSidebarEmployees();
    populateModalSelects();
    if(currentTab==='employees_mgmt')window.renderEmployeesMgmt();
    if(currentTab==='config'){window.renderConfigEntityTabs();window.renderStandardInputs();renderMonthGrid('config-calendar-body',true);}
    if(currentTab.startsWith('calendar')){if(specialistViewLevel==='global-day')window.renderGlobalDay();else window.render();}
});
// Blocks
onSnapshot(collection(db,'artifacts',AID,'public','data','blocks'),snap=>{
  blocksDB=snap.docs.map(d=>({id:d.id,...d.data()}));
  if(currentTab.startsWith('calendar_emp_')&&specialistViewLevel==='day')window.renderSpecialistDayView();
  else if(currentTab.startsWith('calendar')) window.render();
  
  const dm = document.getElementById('day-modal');
  if (dm && !dm.classList.contains('hidden') && window.selectedDayInModal) {
      let empFilter = null;
      if (currentTab.startsWith('calendar_emp_')) {
          const eid = currentTab.replace('calendar_emp_', '');
          const emp = window.getEmpById ? window.getEmpById(eid) : null;
          if (emp) empFilter = emp.name;
      }
      window.openDayModal(window.selectedDayInModal, empFilter);
  }
});

}catch(err){console.error("❌ ERROR CRÍTICO EN startListeners:",err)}};




// Envolver setTab para marcar como leídas
const originalSetTab = window.setTab;
window.setTab = (tab) => {
    if(tab === 'appointments') {
        const webApts = appointments.filter(a => a.type === 'web' || a.source === 'cliente');
        const seen = webApts.map(a => a.id);
        localStorage.setItem('seenWebApts_' + AID, JSON.stringify(seen));
        const badge = document.getElementById('web-noti-badge');
        if(badge) {
            badge.classList.add('hidden');
            badge.classList.remove('badge-dancing');
        }
    }
    if(typeof originalSetTab === 'function') originalSetTab(tab);
    // Limpiar resaltados al cambiar de pestaña para evitar que se queden marcados si vuelves luego
    if(tab !== 'appointments') window.highlightIds = [];
};

// ---- BOOT ----
const now=new Date();
document.getElementById('list-month').value=now.getMonth();
document.getElementById('list-year').value=now.getFullYear();
document.getElementById('acc-month').value=now.getMonth();
document.getElementById('acc-year').value=now.getFullYear();
// Gastos: inicializar fecha y filtros
const expDateEl=document.getElementById('exp-date');
if(expDateEl)expDateEl.value=getLD(now);
const expFilterMonth=document.getElementById('exp-filter-month');
const expFilterYear=document.getElementById('exp-filter-year');
if(expFilterMonth)expFilterMonth.value=now.getMonth();
if(expFilterYear)expFilterYear.value=now.getFullYear();

// Listener foto factura
var expPhotoBase64=null;
document.getElementById('exp-photo-input')?.addEventListener('change',e=>{
  const file=e.target.files[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=ev=>{
    const img=new Image();
    img.onload=()=>{
      const canvas=document.createElement('canvas');
      const MAX=800;let w=img.width,h=img.height;
      if(w>MAX||h>MAX){if(w>h){h=Math.round(h*MAX/w);w=MAX;}else{w=Math.round(w*MAX/h);h=MAX;}}
      canvas.width=w;canvas.height=h;
      canvas.getContext('2d').drawImage(img,0,0,w,h);
      expPhotoBase64=canvas.toDataURL('image/jpeg',0.65);
      const lbl=document.getElementById('exp-photo-label');
      if(lbl)lbl.innerText='✅ Foto lista';
    };
    img.src=ev.target.result;
  };
  reader.readAsDataURL(file);
});

// Attach config button listeners directly (more reliable than onclick in HTML with ES6 modules)
document.getElementById('btn-save-config')?.addEventListener('click',()=>{console.log('btn-save-config clicked');window.saveConfig()});
document.getElementById('btn-apply-day')?.addEventListener('click',()=>{console.log('btn-apply-day clicked');window.saveConfigDay()});

// ╔══════════════════════════════════════════════════════════════╗
// ║                  TPV — PUNTO DE VENTA                       ║
// ╚══════════════════════════════════════════════════════════════╝
var tpvLines=[];          // [{name,price,qty}]
var tpvPayMethod='cash';  // 'cash' | 'card'
var tpvLinkedAptId=null;  // id cita vinculada
var lastTicketData=null;  // último ticket generado

const fmt=n=>n.toFixed(2).replace('.',',');

// ── Abrir / Cerrar ─────────────────────────────────────────────
window.openTPV=()=>{window.closeSidebar();
  tpvLines=[];tpvLinkedAptId=null;tpvPayMethod='cash';
  window.setTab('tpv');
  // fecha en cabecera
  const now=new Date();
  const dl=document.getElementById('tpv-date-label');
  if(dl)dl.innerText=now.toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  // Reset UI
  const sel=document.getElementById('tpv-apt-select');
  if(sel){sel.innerHTML='<option value="">— Cobro manual sin cita —</option>';
    const today=getLD(new Date());
    const todayApts=appointments.filter(a=>a.date===today&&a.status!=='cancelled'&&!a.isPaid);
    todayApts.sort((a,b)=>a.time.localeCompare(b.time)).forEach(a=>{
      const op=document.createElement('option');op.value=a.id;
      op.textContent=`${a.time} · ${a.clientName||a.name||'?'} · ${a.service||'?'}`;
      sel.appendChild(op);
    });
  }
  document.getElementById('tpv-client-name').value='';
  document.getElementById('tpv-client-phone').value='';
  document.getElementById('tpv-search').value='';
  document.getElementById('tpv-change-row').classList.add('hidden');
  document.getElementById('tpv-cash-given').value='';
  tpvSetPayment('cash');
  tpvRenderCategories();
  tpvRenderServices();
  tpvRenderLines();
  if(window.lucide)lucide.createIcons();
};

window.closeTPV=()=>{
  window.setTab('calendar_all');
};

// ── Vincular cita seleccionada ──────────────────────────────────
window.tpvLinkAppointment=()=>{
  const sel=document.getElementById('tpv-apt-select');
  tpvLinkedAptId=sel.value||null;
  if(tpvLinkedAptId){
    const apt=appointments.find(a=>a.id===tpvLinkedAptId);
    if(apt){
      document.getElementById('tpv-client-name').value=apt.clientName||apt.name||'';
      document.getElementById('tpv-client-phone').value=apt.clientPhone||apt.phone||'';
      // Añadir el servicio de la cita si no está ya en el ticket
      if(apt.service&&!tpvLines.find(l=>l.name===apt.service)){
        tpvLines.push({name:apt.service,price:apt.price||0,qty:1});
        tpvRenderLines();
      }
    }
  }
};

// ── Categorías filtro ───────────────────────────────────────────
var tpvActiveCat='';
window.tpvRenderCategories=()=>{
  const c=document.getElementById('tpv-cats');if(!c)return;
  const cats=['Todos',...categoriesDB.map(x=>x.name)];
  c.innerHTML=cats.map(cat=>{
    const active=(cat==='Todos'&&tpvActiveCat==='')||(cat===tpvActiveCat);
    return `<button onclick="window.tpvFilterCat('${cat==='Todos'?'':cat}')"
      class="px-3 py-1 rounded-lg text-[10px] font-bold uppercase transition-all"
      style="${active?`background:var(--blue-deep);color:white`:`background:var(--cream-dark);color:var(--brown-mid)`}"
    >${cat}</button>`;
  }).join('');
};
window.tpvFilterCat=cat=>{tpvActiveCat=cat;tpvRenderCategories();tpvRenderServices()};

// ── Grid de servicios ───────────────────────────────────────────
window.tpvRenderServices=()=>{
  const grid=document.getElementById('tpv-services-grid');if(!grid)return;
  const q=(document.getElementById('tpv-search')?.value||'').toLowerCase().trim();
  let svcs=servicesDB;
  if(tpvActiveCat)svcs=svcs.filter(s=>s.category===tpvActiveCat);
  if(q)svcs=svcs.filter(s=>(s.name||'').toLowerCase().includes(q)||(s.category||'').toLowerCase().includes(q));
  if(svcs.length===0){grid.innerHTML='<div class="col-span-full py-10 text-center text-xs font-bold uppercase opacity-40" style="color:var(--brown-mid)">Sin servicios</div>';return;}
  grid.innerHTML=svcs.map(s=>`
    <button onclick="window.tpvAddService('${s.id}')"
      class="rounded-xl p-3 md:p-3 text-left shadow-sm border border-transparent hover:shadow-md active:scale-95 transition-all flex flex-col gap-0.5"
      style="background:white;box-shadow: 0 4px 15px rgba(0,0,0,0.03);">
      <span class="text-[8px] md:text-[10px] font-bold uppercase tracking-widest opacity-60" style="color:var(--brown-mid)">${esc(s.category||'')}</span>
      <span class="font-black text-[10px] md:text-xs lg:text-sm uppercase leading-tight" style="color:var(--brown)">${esc(s.name)}</span>
      <span class="text-[11px] md:text-sm lg:text-base font-black mt-auto pt-0.5" style="color:var(--blue-deep)">${fmt(s.price||0)} €</span>
      <span class="text-[8px] md:text-[10px] font-bold tracking-widest opacity-50" style="color:var(--brown-mid)">${s.duration||0} MIN</span>
    </button>`).join('');
};

// ── Añadir servicio al ticket ───────────────────────────────────
window.tpvAddService=id=>{
  const svc=getSvcById(id);if(!svc)return;
  const existing=tpvLines.find(l=>l.name===svc.name);
  if(existing){existing.qty++;} else {tpvLines.push({name:svc.name,price:svc.price||0,qty:1});}
  tpvRenderLines();
};

// ── Render líneas del ticket ────────────────────────────────────
window.tpvRenderLines=()=>{
  const lc=document.getElementById('tpv-lines');
  const empty=document.getElementById('tpv-empty');
  if(!lc)return;
  if(tpvLines.length===0){lc.innerHTML='';if(empty)empty.classList.remove('hidden');tpvUpdateTotals();return;}
  if(empty)empty.classList.add('hidden');
  lc.innerHTML=tpvLines.map((l,i)=>`
    <div class="flex items-center gap-3 md:gap-4 bg-white rounded-2xl md:rounded-3xl px-4 py-3 md:px-5 md:py-4 shadow-sm border" style="border-color:var(--brown-light)">
      <div class="flex-grow min-w-0">
        <p class="font-black text-[11px] md:text-sm uppercase truncate" style="color:var(--brown)">${esc(l.name)}</p>
        <div class="flex items-center gap-2 md:gap-3 mt-1 md:mt-2">
            <input type="number" step="0.01" value="${l.price}" onchange="window.tpvUpdatePrice(${i}, this.value)" 
                class="w-16 md:w-24 p-1.5 md:p-2 border rounded-lg md:rounded-xl text-[10px] md:text-sm font-bold outline-none text-center" style="background:var(--cream);border-color:var(--brown-light);color:var(--brown)">
            <span class="text-[10px] md:text-xs font-bold opacity-60" style="color:var(--brown-mid)">€ × ${l.qty} = <strong class="text-xs md:text-sm text-slate-800">${fmt(l.price*l.qty)} €</strong></span>
        </div>
      </div>
      <div class="flex items-center gap-1 md:gap-2 shrink-0 bg-slate-50 p-1 md:p-1.5 rounded-xl border" style="border-color:var(--brown-light)">
        <button onclick="window.tpvQty(${i},-1)" class="w-7 h-7 md:w-9 md:h-9 rounded-lg font-black text-sm md:text-lg flex items-center justify-center hover:bg-slate-200 transition-colors" style="background:var(--cream-dark);color:var(--brown)">−</button>
        <span class="w-6 md:w-8 text-center font-black text-xs md:text-base">${l.qty}</span>
        <button onclick="window.tpvQty(${i},1)" class="w-7 h-7 md:w-9 md:h-9 rounded-lg font-black text-sm md:text-lg flex items-center justify-center hover:bg-slate-200 transition-colors" style="background:var(--cream-dark);color:var(--brown)">+</button>
        <div class="w-px h-6 md:h-8 mx-1 bg-slate-200"></div>
        <button onclick="window.tpvRemove(${i})" class="w-7 h-7 md:w-9 md:h-9 rounded-lg flex items-center justify-center hover:bg-red-100 transition-colors" style="background:#fff1f2;color:#e05c6a">
          <i data-lucide="x" class="w-3.5 h-3.5 md:w-4 md:h-4"></i>
        </button>
      </div>
    </div>`).join('');
  tpvUpdateTotals();
  if(window.lucide)lucide.createIcons();
};

window.tpvUpdatePrice = (i, newPrice) => {
    if(!tpvLines[i]) return;
    tpvLines[i].price = parseFloat(newPrice) || 0;
    tpvRenderLines();
};

window.tpvQty=(i,delta)=>{
  if(!tpvLines[i])return;
  tpvLines[i].qty+=delta;
  if(tpvLines[i].qty<=0)tpvLines.splice(i,1);
  tpvRenderLines();
};
window.tpvRemove=i=>{tpvLines.splice(i,1);tpvRenderLines();};

// ── Totales con IVA incluido ────────────────────────────────────
window.tpvUpdateTotals=()=>{
  const total=tpvLines.reduce((s,l)=>s+l.price*l.qty,0);
  const iva=total-(total/1.21);   // IVA incluido en precio
  const st=document.getElementById('tpv-subtotal');
  const si=document.getElementById('tpv-iva');
  const st2=document.getElementById('tpv-total');
  const btn=document.getElementById('tpv-charge-btn-label');
  if(st)st.innerText=fmt(total)+' €';
  if(si)si.innerText=fmt(iva)+' €';
  if(st2)st2.innerText=fmt(total)+' €';
  if(btn)btn.innerText=`Cobrar ${fmt(total)} €`;
  // Actualizar cambio si efectivo
  if(tpvPayMethod==='cash')window.tpvCalcChange();
};

// ── Método de pago ──────────────────────────────────────────────
window.tpvSetPayment=method=>{
  tpvPayMethod=method;
  const gold='var(--gold)',blue='var(--blue-deep)';
  const bc=document.getElementById('btn-pay-cash');
  const bk=document.getElementById('btn-pay-card');
  const cr=document.getElementById('tpv-change-row');
  if(bc)bc.style.cssText=method==='cash'
    ?`background:var(--gold);color:white;border-color:var(--gold);flex:1;padding:1rem;border-radius:1rem;border-width:2px;font-weight:900;font-size:14px;text-transform:uppercase;display:flex;align-items:center;justify-content:center;gap:0.5rem;transition:all .2s;box-shadow:0 4px 14px rgba(212,175,55,0.4)`
    :`border-color:var(--gold);color:var(--gold);flex:1;padding:1rem;border-radius:1rem;border-width:2px;font-weight:900;font-size:14px;text-transform:uppercase;display:flex;align-items:center;justify-content:center;gap:0.5rem;transition:all .2s;background:white`;
  if(bk)bk.style.cssText=method==='card'
    ?`background:var(--blue-deep);color:white;border-color:var(--blue-deep);flex:1;padding:1rem;border-radius:1rem;border-width:2px;font-weight:900;font-size:14px;text-transform:uppercase;display:flex;align-items:center;justify-content:center;gap:0.5rem;transition:all .2s;box-shadow:0 4px 14px rgba(44,62,80,0.4)`
    :`border-color:var(--blue-deep);color:var(--blue-deep);flex:1;padding:1rem;border-radius:1rem;border-width:2px;font-weight:900;font-size:14px;text-transform:uppercase;display:flex;align-items:center;justify-content:center;gap:0.5rem;transition:all .2s;background:white`;
  if(cr)cr.classList.toggle('hidden',method!=='cash');
  window.tpvCalcChange();
};

window.tpvCalcChange=()=>{
  const total=tpvLines.reduce((s,l)=>s+l.price*l.qty,0);
  const given=parseFloat(document.getElementById('tpv-cash-given')?.value)||0;
  const disp=document.getElementById('tpv-change-display');
  if(disp)disp.innerText=`Cambio: ${fmt(Math.max(0,given-total))} €`;
};

// ── COBRAR ──────────────────────────────────────────────────────
window.tpvCharge=async()=>{
  if(tpvLines.length===0)return alert('Añade al menos un servicio.');
  const total=tpvLines.reduce((s,l)=>s+l.price*l.qty,0);
  const iva=total-(total/1.21);
  const clientName=document.getElementById('tpv-client-name').value.trim();
  const clientPhone=document.getElementById('tpv-client-phone').value.replace(/^\+34/,'').replace(/[\s\-\(\)\.]/g,'');
  const now=new Date();
  const dateStr=getLD(now);
  const timeStr=`${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  const ticketNum='TKT-'+dateStr.replace(/-/g,'')+'-'+Math.floor(Math.random()*10000).toString().padStart(4,'0');

  // 1. Si hay cita vinculada → marcarla como pagada y completada
  if(tpvLinkedAptId){
    try{
      await updateDoc(doc(db,'artifacts',AID,'public','data','appointments',tpvLinkedAptId),{
        isPaid:true,status:'completed',
        price:total,updatedAt:now.toISOString()
      });
      const apt = appointments.find(a => a.id === tpvLinkedAptId);
      if(apt) { window.trackNotif({...apt, isPaid:true, status:'completed', id:tpvLinkedAptId, ticketRef:ticketNum}, 'completed'); notifyWebhook('completed',{...apt,isPaid:true,status:'completed',id:tpvLinkedAptId,ticketRef:ticketNum}); }
    }catch(e){console.error('Error actualizando cita:',e);}
  }

  // 2. Guardar cada línea en contabilidad
  try{
    for(const line of tpvLines){
      const lineTotal=line.price*line.qty;
      const lineIva=lineTotal-(lineTotal/1.21);
      await addDoc(collection(db,'artifacts',AID,'public','data','appointments'),{
        clientName:clientName||'Cobro TPV',clientPhone:clientPhone||'',
        service:line.name,employee:'TPV',
        date:dateStr,time:timeStr,duration:0,
        price:lineTotal,isPaid:true,status:'completed',
        payMethod:tpvPayMethod,ticketRef:ticketNum,
        ivaAmount:parseFloat(lineIva.toFixed(2)),
        ivaRate:21,
        createdAt:now.toISOString(),updatedAt:now.toISOString(),
        _tpvEntry:true
      });
    }
  }catch(e){console.error('Error guardando contabilidad:',e);}

  // 3. Generar ticket y mostrarlo
  lastTicketData={ticketNum,clientName,clientPhone,lines:tpvLines,total,iva,payMethod:tpvPayMethod,dateStr,timeStr,now};
  window.tpvShowTicket(lastTicketData);
};

// ── Mostrar ticket ──────────────────────────────────────────────
window.tpvShowTicket=(d)=>{
  const linesHtml=d.lines.map(l=>`
    <div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px dashed #e0d8d5">
      <span>${esc(l.name)} × ${l.qty}</span>
      <span>${fmt(l.price*l.qty)} €</span>
    </div>`).join('');
  const tc=document.getElementById('ticket-content');
  if(tc)tc.innerHTML=`
    <div style="text-align:center;padding-bottom:12px;border-bottom:2px solid #e0d8d5">
      <p style="font-size:18px;font-family:'Cormorant Garamond',serif;font-style:italic;font-weight:700;color:#2e2826">UNIR</p>
    </div>
    <div style="font-size:9px;color:#7a6b67;padding:8px 0;border-bottom:1px dashed #e0d8d5">
      <div style="display:flex;justify-content:space-between"><span>Ticket:</span><strong>${d.ticketNum}</strong></div>
      <div style="display:flex;justify-content:space-between"><span>Fecha:</span><span>${d.dateStr}</span></div>
      <div style="display:flex;justify-content:space-between"><span>Hora:</span><span>${d.timeStr}</span></div>
      ${d.clientName?`<div style="display:flex;justify-content:space-between"><span>Cliente:</span><span>${esc(d.clientName)}</span></div>`:''}
    </div>
    <div style="padding:8px 0;border-bottom:2px solid #e0d8d5;font-size:9px">
      ${linesHtml}
    </div>
    <div style="padding:8px 0;font-size:9px;color:#7a6b67">
      <div style="display:flex;justify-content:space-between"><span>Subtotal</span><span>${fmt(d.total)} €</span></div>
      <div style="display:flex;justify-content:space-between"><span>IVA incluido (21%)</span><span>${fmt(d.iva)} €</span></div>
      <div style="display:flex;justify-content:space-between;padding-top:6px;border-top:1px dashed #e0d8d5;font-size:13px;font-weight:900;color:#2e2826">
        <span>TOTAL</span><span>${fmt(d.total)} €</span>
      </div>
      <div style="text-align:right;font-size:9px;margin-top:4px;color:#7a6b67">${d.payMethod==='cash'?'💵 Efectivo':'💳 Tarjeta'}</div>
    </div>
    <div style="text-align:center;padding-top:10px;font-size:9px;color:#7a6b67;border-top:1px dashed #e0d8d5">
      <p>Gracias por tu visita 💛</p>
      <p style="font-size:8px;margin-top:2px">Los precios incluyen el 21% de IVA</p>
      <p style="font-size:8px">Este documento sirve como justificante de pago</p>
      <p style="font-size:8px">Este documento sirve como justificante de pago</p>
    </div>`;
  const tm=document.getElementById('ticket-modal');
  if(tm)tm.style.display='flex';
  if(window.lucide)lucide.createIcons();
};

// ── WhatsApp ────────────────────────────────────────────────────
window.tpvSendWhatsapp=()=>{
  if(!lastTicketData)return;
  let phone=lastTicketData.clientPhone||document.getElementById('tpv-client-phone')?.value||'';
  phone=phone.replace(/\D/g,'');
  if(!phone||phone.length<9){
    phone=prompt('Introduce el teléfono de la clienta (sin prefijo, 9 dígitos):','');
    if(!phone)return;
    phone=phone.replace(/\D/g,'');
  }
  if(!phone.startsWith('34')&&phone.length===9)phone='34'+phone;
  const d=lastTicketData;
  const lines=d.lines.map(l=>`  • ${l.name} × ${l.qty}  →  ${fmt(l.price*l.qty)} €`).join('\n');
  const msg=
`🌸 *UNIR* 🌸
─────────────────────
🧾 Ticket: ${d.ticketNum}
📅 ${d.dateStr} · ${d.timeStr}
${d.clientName?`👤 ${d.clientName}\n`:''}
*Servicios:*
${lines}

─────────────────────
💰 *TOTAL: ${fmt(d.total)} €* (IVA 21% incluido)
${d.payMethod==='cash'?'💵 Pagado en efectivo':'💳 Pagado con tarjeta'}

¡Gracias por tu visita! 💛`;
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`,'_blank');
};

// ── Imprimir ────────────────────────────────────────────────────
window.tpvPrintTicket=()=>{
  const content=document.getElementById('ticket-content');
  if(!content)return;
  const win=window.open('','_blank','width=400,height=600');
  win.document.write(`<!DOCTYPE html><html><head>
    <meta charset="UTF-8">
    <title>Ticket UNIR</title>
    <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;1,700&family=Nunito:wght@400;700;900&display=swap" rel="stylesheet">
    <style>
      *{margin:0;padding:0;box-sizing:border-box;font-family:'Nunito',monospace;font-size:11px}
      body{padding:12px;max-width:300px;margin:0 auto;background:white}
      @media print{body{margin:0}}
    </style>
  </head><body>${content.innerHTML}<script>window.onload=()=>{window.print();setTimeout(()=>window.close(),500)}<\/script></body></html>`);
  win.document.close();
};

// ╔══════════════════════════════════════════════════════════════╗
// ║              EXPORTACIÓN EXCEL PARA GESTOR                  ║
// ╚══════════════════════════════════════════════════════════════╝
window.exportToExcel=()=>{
  if(typeof XLSX==='undefined'){alert('Librería Excel no cargada. Comprueba la conexión a internet.');return;}

  const year=parseInt(document.getElementById('acc-year')?.value)||new Date().getFullYear();
  const monthNames=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

  // Solo citas cobradas del año seleccionado
  const paid=appointments.filter(a=>{
    if(!a.isPaid||!a.date||typeof a.price!=='number'||a.price<=0)return false;
    const yr=parseInt(a.date.split('-')[0]);
    return yr===year;
  });

  // Gastos del año
  const exp=expensesDB.filter(e=>{
    if(!e.date||typeof e.totalAmount!=='number')return false;
    const yr=parseInt(e.date.split('-')[0]);
    return yr===year;
  });

  if(paid.length===0 && exp.length===0){alert(`No hay registros contables para ${year}.`);return;}

  const wb=XLSX.utils.book_new();

  // ── HOJA RESUMEN ANUAL ─────────────────────────────────────────
  const summaryRows=[
    ['RESUMEN ANUAL DE CONTABILIDAD','','','','','','','',''],
    [`UNIR — Año ${year}`,'','','','','','','',''],
    [`Generado el ${new Date().toLocaleDateString('es-ES',{day:'2-digit',month:'long',year:'numeric'})}`,'','','','','','','',''],
    ['','','','','','','','',''],
    ['MES','INGRESOS BASE','INGRESOS IVA','INGRESOS TOTAL','','GASTOS BASE','GASTOS IVA','GASTOS TOTAL','BENEFICIO NETO'],
  ];

  let annIncBase=0,annIncIva=0,annIncTotal=0;
  let annExpBase=0,annExpIva=0,annExpTotal=0;

  for(let m=0;m<12;m++){
    const mInc=paid.filter(a=>parseInt(a.date.split('-')[1])-1===m);
    const mExp=exp.filter(e=>parseInt(e.date.split('-')[1])-1===m);

    const incTotal=mInc.reduce((s,a)=>s+(a.price||0),0);
    const incBase=incTotal/1.21;
    const incIva=incTotal-incBase;

    const expTotal=mExp.reduce((s,e)=>s+(e.totalAmount||0),0);
    const expBase=mExp.reduce((s,e)=>s+(e.baseAmount||0),0);
    const expIva=mExp.reduce((s,e)=>s+(e.ivaAmount||0),0);

    annIncBase+=incBase;annIncIva+=incIva;annIncTotal+=incTotal;
    annExpBase+=expBase;annExpIva+=expIva;annExpTotal+=expTotal;

    summaryRows.push([
      monthNames[m],
      +incBase.toFixed(2),+incIva.toFixed(2),+incTotal.toFixed(2),'',
      +expBase.toFixed(2),+expIva.toFixed(2),+expTotal.toFixed(2),
      +(incTotal-expTotal).toFixed(2)
    ]);
  }

  summaryRows.push(['','','','','','','','','']);
  summaryRows.push([
    'TOTAL ANUAL',
    +annIncBase.toFixed(2),+annIncIva.toFixed(2),+annIncTotal.toFixed(2),'',
    +annExpBase.toFixed(2),+annExpIva.toFixed(2),+annExpTotal.toFixed(2),
    +(annIncTotal-annExpTotal).toFixed(2)
  ]);

  const wsSummary=XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary['!cols']=[{wch:14},{wch:16},{wch:14},{wch:16},{wch:4},{wch:16},{wch:14},{wch:16},{wch:18}];
  XLSX.utils.book_append_sheet(wb,wsSummary,`Resumen ${year}`);

  // ── HOJAS MENSUALES DETALLADAS ────────────────────────────────
  for(let m=0;m<12;m++){
    const mInc=paid.filter(a=>parseInt(a.date.split('-')[1])-1===m);
    const mExp=exp.filter(e=>parseInt(e.date.split('-')[1])-1===m);
    
    if(mInc.length===0 && mExp.length===0) continue;

    let wsData = [];

    // INGRESOS SECTION
    if(mInc.length>0){
      const incHeader=[
        [`INGRESOS — ${monthNames[m].toUpperCase()} ${year}`,'','','','','','',''],
        [`UNIR | IVA incluido 21%`,'','','','','','',''],
        ['','','','','','','',''],
        ['FECHA','CLIENTE','TELÉFONO','SERVICIO','ESPECIALISTA','MÉTODO PAGO','BASE IMPONIBLE (€)','IVA 21% (€)','TOTAL (€)'],
      ];

      mInc.sort((a,b)=>a.date.localeCompare(b.date)||a.time.localeCompare(b.time));
      const incRows=mInc.map(a=>{
        const total=a.price||0;
        const base=total/1.21;
        const iva=total-base;
        const [yr,mo,dy]=a.date.split('-');
        const dateFormatted=`${dy}/${mo}/${yr}`;
        const method=a.payMethod==='card'?'Tarjeta':a.payMethod==='cash'?'Efectivo':'—';
        return[dateFormatted,a.clientName||'—',a.clientPhone||'—',a.service||'—',a.employee||'—',method,+base.toFixed(2),+iva.toFixed(2),+total.toFixed(2)];
      });

      const mTotal=mInc.reduce((s,a)=>s+(a.price||0),0);
      const mBase=mTotal/1.21;
      const mIva=mTotal-mBase;
      const totalsRow=['','','','','','TOTAL INGRESOS',+mBase.toFixed(2),+mIva.toFixed(2),+mTotal.toFixed(2)];

      wsData.push(...incHeader, ...incRows, [''], totalsRow, [''], ['']);
    }

    // GASTOS SECTION
    if(mExp.length>0){
      const expHeader=[
        [`GASTOS — ${monthNames[m].toUpperCase()} ${year}`,'','','','','','',''],
        [`UNIR`,'','','','','','',''],
        ['','','','','','','',''],
        ['FECHA','CONCEPTO','CATEGORÍA','','','','BASE IMPONIBLE (€)','IVA (€)','TOTAL (€)'],
      ];

      mExp.sort((a,b)=>a.date.localeCompare(b.date));
      const expRows=mExp.map(e=>{
        const [yr,mo,dy]=e.date.split('-');
        const dateFormatted=`${dy}/${mo}/${yr}`;
        return[dateFormatted,e.concept||'—',e.category||'—','','','',+(e.baseAmount||0).toFixed(2),+(e.ivaAmount||0).toFixed(2),+(e.totalAmount||0).toFixed(2)];
      });

      const eTotal=mExp.reduce((s,e)=>s+(e.totalAmount||0),0);
      const eBase=mExp.reduce((s,e)=>s+(e.baseAmount||0),0);
      const eIva=mExp.reduce((s,e)=>s+(e.ivaAmount||0),0);
      const totalsRow=['','','','','','TOTAL GASTOS',+eBase.toFixed(2),+eIva.toFixed(2),+eTotal.toFixed(2)];

      wsData.push(...expHeader, ...expRows, [''], totalsRow, [''], ['']);
    }

    // RESUMEN DEL MES
    const incTot = mInc.reduce((s,a)=>s+(a.price||0),0);
    const expTot = mExp.reduce((s,e)=>s+(e.totalAmount||0),0);
    wsData.push(
      [`RESUMEN ${monthNames[m].toUpperCase()}`],
      ['Total Ingresos', '', '', '', '', '', '', '', +incTot.toFixed(2)],
      ['Total Gastos', '', '', '', '', '', '', '', +expTot.toFixed(2)],
      ['BENEFICIO NETO', '', '', '', '', '', '', '', +(incTot-expTot).toFixed(2)]
    );

    const ws=XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols']=[{wch:12},{wch:24},{wch:14},{wch:28},{wch:16},{wch:14},{wch:22},{wch:14},{wch:14}];
    XLSX.utils.book_append_sheet(wb,ws,monthNames[m]);
  }

  // ── DESCARGAR ──────────────────────────────────────────────────
  const filename=`UNIR_Ingresos_${year}.xlsx`;
  XLSX.writeFile(wb,filename);
  console.log(`✅ Excel exportado: ${filename}`);
};

// ╔══════════════════════════════════════════════════════════════╗
// ║                   MÓDULO GASTOS                             ║
// ╚══════════════════════════════════════════════════════════════╝

// Calcula automáticamente base imponible e IVA al escribir el total
window.expCalc=()=>{
  const total=parseFloat(document.getElementById('exp-total')?.value)||0;
  const rate=parseFloat(document.getElementById('exp-iva-rate')?.value)||0;
  const base=rate>0?total/(1+rate/100):total;
  const iva=total-base;
  const bd=document.getElementById('exp-base-display');
  const id=document.getElementById('exp-iva-display');
  const td=document.getElementById('exp-total-display');
  if(bd)bd.innerText=base.toFixed(2)+' €';
  if(id)id.innerText=iva.toFixed(2)+' €';
  if(td)td.innerText=total.toFixed(2)+' €';
};

// Guardar gasto en Firestore
window.saveExpense=async()=>{
  const concept=(document.getElementById('exp-concept')?.value||'').trim();
  const total=parseFloat(document.getElementById('exp-total')?.value)||0;
  const rate=parseFloat(document.getElementById('exp-iva-rate')?.value)||0;
  const category=document.getElementById('exp-category')?.value||'Otros';
  const date=document.getElementById('exp-date')?.value||getLD(new Date());

  if(!concept)return alert('Introduce el concepto del gasto.');
  if(total<=0)return alert('Introduce un importe válido.');

  const base=rate>0?total/(1+rate/100):total;
  const iva=total-base;

  const data={
    concept,category,date,
    totalAmount:parseFloat(total.toFixed(2)),
    baseAmount:parseFloat(base.toFixed(2)),
    ivaRate:rate,
    ivaAmount:parseFloat(iva.toFixed(2)),
    invoicePhoto:expPhotoBase64||null,
    createdAt:new Date().toISOString()
  };

  try{
    await addDoc(collection(db,'artifacts',AID,'public','data','expenses'),data);
    // Reset form
    document.getElementById('exp-concept').value='';
    document.getElementById('exp-total').value='';
    document.getElementById('exp-base-display').value='';
    document.getElementById('exp-iva-display').value='';
    document.getElementById('exp-photo-input').value='';
    const lbl=document.getElementById('exp-photo-label');
    if(lbl)lbl.innerText='Cámara / Galería';
    expPhotoBase64=null;
    window.renderExpenses();
  }catch(e){console.error('Error guardando gasto:',e);alert('Error al guardar. Revisa la conexión.');}
};

// Eliminar gasto
window.deleteExpense=async(id)=>{
  if(!confirm('¿Eliminar este gasto?'))return;
  try{
    await deleteDoc(doc(db,'artifacts',AID,'public','data','expenses',id));
  }catch(e){console.error('Error eliminando gasto:',e);}
};

// Ver foto factura
window.expViewPhoto=src=>{
  const v=document.getElementById('exp-photo-viewer');
  const img=document.getElementById('exp-photo-viewer-img');
  if(v&&img){img.src=src;v.style.display='flex';}
};

// Renderizar lista de gastos del mes seleccionado
window.renderExpenses=()=>{
  const m=parseInt(document.getElementById('exp-filter-month')?.value)||0;
  const yr=parseInt(document.getElementById('exp-filter-year')?.value)||new Date().getFullYear();
  const container=document.getElementById('expenses-list');
  if(!container)return;

  const filtered=expensesDB.filter(e=>{
    if(!e.date)return false;
    const [ey,em]=e.date.split('-');
    return parseInt(ey)===yr&&parseInt(em)-1===m;
  }).sort((a,b)=>a.date.localeCompare(b.date));

  const total=filtered.reduce((s,e)=>s+(e.totalAmount||0),0);
  const totalBase=filtered.reduce((s,e)=>s+(e.baseAmount||0),0);
  const totalIva=filtered.reduce((s,e)=>s+(e.ivaAmount||0),0);

  const badge=document.getElementById('exp-total-badge');
  if(badge)badge.innerText=`Total: ${total.toFixed(2).replace('.',',')} €`;

  if(filtered.length===0){
    container.innerHTML=`<div class="py-16 text-center rounded-3xl border" style="background:white;border-color:var(--brown-light);color:var(--brown-light)">
      <i data-lucide="receipt" style="width:48px;height:48px;margin:0 auto 12px;display:block;opacity:.4"></i>
      <p style="font-weight:700;font-size:11px;text-transform:uppercase;opacity:.5;color:var(--brown-mid)">Sin gastos registrados este mes</p>
    </div>`;
    if(window.lucide)lucide.createIcons();return;
  }

  const catColors={
    'Alquiler':'#dbeafe','Material / Productos':'#dcfce7','Suministros':'#fef9c3',
    'Publicidad':'#fce7f3','Mantenimiento':'#ffedd5','Formación':'#ede9fe',
    'Seguros':'#e0f2fe','Gestoría':'#f0fdf4','Otros':'#f3f4f6'
  };

  container.innerHTML=filtered.map(e=>{
    const [yr2,mo,dy]=e.date.split('-');
    const dateStr=`${dy}/${mo}/${yr2}`;
    const bg=catColors[e.category]||'#f3f4f6';
    const photoBtn=e.invoicePhoto
      ?`<button onclick="window.expViewPhoto('${e.invoicePhoto}')" class="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold uppercase" style="background:#eff6ff;color:#1d4ed8">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
          Ver factura</button>`:'';
    return`<div class="bg-white rounded-2xl border shadow-sm px-5 py-4 flex items-center gap-4" style="border-color:var(--brown-light)">
      <div class="shrink-0 text-center" style="min-width:44px">
        <p class="text-base font-black" style="color:var(--brown)">${dy}</p>
        <p class="text-[9px] font-bold uppercase opacity-60" style="color:var(--brown-mid)">${['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][parseInt(mo)-1]}</p>
      </div>
      <div class="w-px h-10 shrink-0" style="background:var(--brown-light)"></div>
      <div class="flex-grow min-w-0">
        <p class="font-black text-sm truncate" style="color:var(--brown)">${esc(e.concept)}</p>
        <div class="flex items-center gap-2 mt-1">
          <span class="px-2 py-0.5 rounded-lg text-[9px] font-bold uppercase" style="background:${bg};color:var(--brown)">${esc(e.category)}</span>
          <span class="text-[9px] font-semibold opacity-60" style="color:var(--brown-mid)">Base: ${(e.baseAmount||0).toFixed(2)} € · IVA ${e.ivaRate||0}%: ${(e.ivaAmount||0).toFixed(2)} €</span>
        </div>
      </div>
      <div class="flex items-center gap-3 shrink-0">
        ${photoBtn}
        <p class="font-black text-base" style="color:#e05c6a">-${(e.totalAmount||0).toFixed(2).replace('.',',')} €</p>
        <button onclick="window.deleteExpense('${e.id}')" class="w-8 h-8 rounded-lg flex items-center justify-center" style="background:#fef2f2;color:#ef4444">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
        </button>
      </div>
    </div>`;
  }).join('');

  // Fila totales
  container.innerHTML+=`<div class="rounded-2xl px-5 py-4 flex justify-between items-center font-bold text-sm" style="background:#fef2f2;border:1px solid #fecaca">
    <span style="color:#e05c6a">TOTAL MES · ${filtered.length} gastos</span>
    <div class="flex gap-6 text-xs">
      <span style="color:var(--brown-mid)">Base: <strong>${totalBase.toFixed(2).replace('.',',')} €</strong></span>
      <span style="color:var(--brown-mid)">IVA: <strong>${totalIva.toFixed(2).replace('.',',')} €</strong></span>
      <span style="color:#e05c6a;font-size:14px">Total: <strong>${total.toFixed(2).replace('.',',')} €</strong></span>
    </div>
  </div>`;
};

// ── CONFIRMATION SUCCESS MODAL ACTIONS ────────────────────────────────
window.closeConfigSuccessModal = () => {
  document.getElementById('config-success-modal')?.classList.add('hidden');
};

// ── WEBPUSHR PUSH NOTIFICATIONS HELPER ────────────────────────────────
window.sendWebpushrNotification = async (title, message, url = window.location.href) => {
  try {
    const res = await fetch('https://api.webpushr.com/v1/notification/send/all', {
      method: 'POST',
      headers: {
        'webpushrKey': 'fd20f5d8102632481213e3008a79f836',
        'webpushrAuthToken': '123896',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: title || 'Magic Studio Vicén',
        message: message || 'Actualización en el panel',
        target_url: url,
        action_buttons: [{ title: 'Ver Panel', url }]
      })
    });
    const data = await res.json();
    console.log('[Webpushr] Admin Push Sent:', data);
    return data;
  } catch (e) {
    console.error('[Webpushr] Error sending admin push notification:', e);
  }
};

// ══════════════════════════════════════════════════════════════
// VERSION 2026-05-11 17:36 - LÍNEA LIMPIA PARA EVITAR CACHÉ
// ══════════════════════════════════════════════════════════════
init();






