const state = { 
    view: 'home', 
    path: { sphereId: null, projId: null, subprojId: null }, 
    ui: { 
        showArchived: false, 
        tmView: 'all', 
        showCompletedTasks: false, 
        homeTaskFilter: 'all', 
        homeContextFilter: 'all', 
        calSelectedDate: getISODate(new Date()), 
        calAnchorDate: null,
        calViewMode: 'normal', 
        calFilters: { task: true, focus: true, routine: true, break: true, gcal: true }, 
        taskSearchQuery: '',
        tmDependencyFilter: 'all',
        expandedTasks: {} 
    },
    get data() { return AppData.data; },
    set data(val) { AppData.data = val; }
};

let tmListSettings = {};
try {
    const rawSettings = localStorage.getItem('hub_tm_settings');
    if (rawSettings) tmListSettings = JSON.parse(rawSettings) || {};
} catch(e) {
    tmListSettings = {};
}
let editState = { mode: 'create', type: 'sphere', id: null, sId: null, pId: null };
let contactEditId = null;
let editingTaskId = null;
let currentArchiveEdit = { type: null, entityId: null, updateId: null };
let archiveQuill = null;
let dragSource = null;
let blockEditId = null;
let blockEditDate = null;

function toggleCalFilter(key) {
    state.ui.calFilters[key] = !state.ui.calFilters[key];
    render();
}

function toggleNavFolder(e, id) {
    e.stopPropagation();
    const folder = document.getElementById(id);
    const icon = e.currentTarget.querySelector('.folder-chevron');
    if(folder) folder.classList.toggle('hidden');
    if(icon) icon.classList.toggle('rotate-90');
}

function toggleArchivedView() { state.ui.showArchived = !state.ui.showArchived; render(); }

function toggleSettings(forceOpen) {
    const m = document.getElementById('settingsModal');
    if (!m) return;
    const shouldOpen = (typeof forceOpen === 'boolean') ? forceOpen : m.classList.contains('hidden');
    if (shouldOpen) {
        const sUrl = document.getElementById('supabaseUrl');
        const aKey = document.getElementById('anonKey');
        const gId = document.getElementById('gcalIdSettings');
        const gApi = document.getElementById('gcalApiSettings');
        if (sUrl) sUrl.value = AppData.supabaseUrl || '';
        if (aKey) aKey.value = AppData.anonKey || '';
        if (gId) gId.value = AppData.gcalId || '';
        if (gApi) gApi.value = AppData.gcalApiKey || '';
        m.classList.remove('hidden');
        m.style.display = 'flex';
    } else {
        m.classList.add('hidden');
        m.style.display = 'none';
    }
}

function openSettingsModal() {
    toggleSettings(true);
}

function saveSettings() {
    const sUrl = (document.getElementById('supabaseUrl')?.value || '').trim();
    const aKey = (document.getElementById('anonKey')?.value || '').trim();
    const gId = (document.getElementById('gcalIdSettings')?.value || '').trim();
    const gKey = (document.getElementById('gcalApiSettings')?.value || '').trim();
    
    AppData.supabaseUrl = sUrl;
    AppData.anonKey = aKey;
    AppData.gcalId = gId;
    AppData.gcalApiKey = gKey;
    
    localStorage.setItem('hub_supabase_url', sUrl);
    localStorage.setItem('hub_anon_key', aKey);
    localStorage.setItem('hub_gcal_id', gId);
    localStorage.setItem('hub_gcal_apikey', gKey);
    
    toggleSettings(false);
    showToast("Impostazioni salvate! Sincronizzazione in corso...", "success");
    AppData.initialize();
    if (AppData.gcalApiKey && AppData.gcalId) {
        AppData.fetchGCalEvents().then(() => {
            if (typeof render === 'function') render();
        });
    }
}

function factoryReset() {
    if(confirm("ATTENZIONE: Questa azione cancellerà TUTTI i dati sia in locale che sul cloud. Procedere?")) {
        AppData.reset();
        localStorage.clear();
        location.reload();
    }
}

function openImportModal() { document.getElementById('importDataArea').value = ''; document.getElementById('importModal').classList.remove('hidden'); }
function closeImportModal() { document.getElementById('importModal').classList.add('hidden'); }
function executeImport() {
    const txt = document.getElementById('importDataArea').value.trim();
    if(!txt) return;
    const overwrite = document.getElementById('importOverwriteChk')?.checked || false;
    try {
        AppData.importJSON(txt, overwrite);
        closeImportModal();
        showToast(overwrite ? "Dati ripristinati e salvati" : "Dati uniti e salvati con successo", "success");
        render();
    } catch(e) {
        showToast("Errore formato JSON: " + e.message, "error");
    }
}

async function navigate(view, sId=null, pId=null, spId=null) { 
    state.view = view; 
    state.path = { sphereId: sId, projId: pId, subprojId: spId }; 
    editingTaskId = null; 
    
    const headers = document.querySelectorAll('.hidden-in-tm');
    headers.forEach(h => {
        if(['global_tasks', 'global_calendar'].includes(view)) h.classList.add('hidden', 'md:flex');
        else h.classList.remove('hidden', 'md:flex');
    });
    
    render(); 

    if(view === 'global_calendar' && AppData.gcalApiKey && AppData.gcalId) {
        await AppData.fetchGCalEvents();
        render();
    }
}

function getEntity(type, id) { 
    if (!state.data[type + 's']) return null;
    return state.data[type + 's'].find(x => x.id === id) || null; 
}

function getChildren(parentType, parentId, sortProp = 'order') { 
    if(parentType === 'sphere') return state.data.projects.filter(p => p.sphereId === parentId).sort((a,b)=>(a[sortProp]||0)-(b[sortProp]||0));
    if(parentType === 'project') return state.data.subprojects.filter(sp => sp.projectId === parentId).sort((a,b)=>(a[sortProp]||0)-(b[sortProp]||0));
    return [];
}

function getContextInfo(cId) {
    if (!cId) return { name: '', icon: 'fa-folder', color: '#94a3b8' };
    const s = getEntity('sphere', cId);
    if (s) return { name: s.name, icon: s.icon || 'fa-folder', color: s.color };
    const p = getEntity('project', cId);
    if (p) return { name: p.name, icon: p.icon || 'fa-folder', color: p.color };
    const sp = getEntity('subproject', cId);
    if (sp) return { name: sp.name, icon: sp.icon || 'fa-file-alt', color: sp.color };
    return { name: 'Contesto Eliminato', icon: 'fa-question', color: '#94a3b8' };
}

function generateCtxOpts(selectedId) {
    let opts = '<option value="">Nessun contesto (Inbox)</option>';
    state.data.spheres.forEach(s => {
        opts += `<option value="${s.id}" ${selectedId === s.id ? 'selected' : ''}>${s.name} (Sfera)</option>`;
        getChildren('sphere', s.id).forEach(p => {
            opts += `<option value="${p.id}" ${selectedId === p.id ? 'selected' : ''}>-- ${p.name}</option>`;
            getChildren('project', p.id).forEach(sp => {
                opts += `<option value="${sp.id}" ${selectedId === sp.id ? 'selected' : ''}>---- ${sp.name}</option>`;
            });
        });
    });
    return opts;
}

function renderBreadcrumbs() {
    const nav = document.getElementById('breadcrumbs');
    let html = `<span class="cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1.5 transition" onclick="navigate('home')"><i class="fas fa-home text-xs mb-[1px]"></i> Home</span>`;
    if (['global_contacts','global_tasks', 'global_calendar'].includes(state.view)) {
        const labels = { global_tasks: 'Task Manager', global_contacts: 'Rubrica', global_calendar: 'Time Management' };
        html += ` <i class="fas fa-chevron-right text-[9px] opacity-40 mx-1.5"></i> <span class="text-slate-800 dark:text-slate-200 font-bold">${labels[state.view]}</span>`;
    } else if (state.path.sphereId) {
        const s = getEntity('sphere', state.path.sphereId);
        if (s) {
            html += ` <i class="fas fa-chevron-right text-[9px] opacity-40 mx-1.5"></i> <span class="cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition" onclick="navigate('sphere', '${s.id}')">${s.name}</span>`;
            if (state.path.projId) {
                const p = getEntity('project', state.path.projId);
                if (p) {
                    html += ` <i class="fas fa-chevron-right text-[9px] opacity-40 mx-1.5"></i> <span class="cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition" onclick="navigate('project', '${s.id}', '${p.id}')">${p.name}</span>`;
                    if (state.path.subprojId) {
                        const sp = getEntity('subproject', state.path.subprojId);
                        if (sp) html += ` <i class="fas fa-chevron-right text-[9px] opacity-40 mx-1.5"></i> <span class="text-slate-800 dark:text-slate-200 font-bold">${sp.name}</span>`;
                    }
                }
            }
        }
    }
    nav.innerHTML = html;
}
