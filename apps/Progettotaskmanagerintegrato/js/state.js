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
        expandedTasks: {},
        pagesViewMode: 'table',
        pagesGroupBy: 'none',
        selectedPageSphere: 'all',
        selectedPageContext: 'all',
        selectedPageTipologia: 'all',
        selectedPageTag: 'all',
        pageSearchQuery: '',
        selectedPageIds: [] 
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

function switchSettingsTab(tabName) {
    const tabs = ['features', 'cloud', 'data'];
    tabs.forEach(t => {
        const el = document.getElementById('setTab_' + t);
        const btn = document.getElementById('setTabBtn_' + t);
        if (el) {
            if (t === tabName) el.classList.remove('hidden');
            else el.classList.add('hidden');
        }
        if (btn) {
            if (t === tabName) {
                btn.className = 'pb-2.5 px-3 text-xs font-bold border-b-2 border-blue-600 text-blue-600 dark:text-blue-400 flex items-center gap-1.5 transition';
            } else {
                btn.className = 'pb-2.5 px-3 text-xs font-bold border-b-2 border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 flex items-center gap-1.5 transition';
            }
        }
    });
}

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

        // Popola i toggle delle funzionalità
        const feats = (state.data && state.data.features) ? state.data.features : {
            dashboardAgenda: true,
            eisenhowerMatrix: true,
            habitsTracker: true,
            contacts: true,
            timeBlocks: true,
            projectTimeline: true
        };
        ['dashboardAgenda', 'eisenhowerMatrix', 'habitsTracker', 'contacts', 'timeBlocks', 'projectTimeline'].forEach(k => {
            const chk = document.getElementById('feat_' + k);
            if (chk) chk.checked = feats[k] !== false;
        });

        const st = document.getElementById('gcalTestStatus');
        const dt = document.getElementById('gcalTestDetails');
        if (st) st.innerHTML = '';
        if (dt) { dt.innerHTML = ''; dt.classList.add('hidden'); }

        switchSettingsTab('features');
        m.classList.remove('hidden');
        m.style.display = 'flex';
    } else {
        m.classList.add('hidden');
        m.style.display = 'none';
    }
}

function toggleFeatureSetting(key, enabled) {
    if (!state.data.features) {
        state.data.features = {
            dashboardAgenda: true,
            eisenhowerMatrix: true,
            habitsTracker: true,
            contacts: true,
            timeBlocks: true,
            projectTimeline: true
        };
    }
    state.data.features[key] = !!enabled;
    localStorage.setItem('hub_features', JSON.stringify(state.data.features));
    AppData.saveLocal();
    AppData.pushToCloud();
    if (typeof render === 'function') render();
    showToast(`Modulo ${enabled ? 'attivato' : 'disattivato'}`, "default");
}

function openSettingsModal() {
    toggleSettings(true);
}

async function testGCalSettings() {
    const btn = document.getElementById('testGcalBtn');
    const statusEl = document.getElementById('gcalTestStatus');
    const detailsEl = document.getElementById('gcalTestDetails');
    const gId = (document.getElementById('gcalIdSettings')?.value || '').trim();
    const gKey = (document.getElementById('gcalApiSettings')?.value || '').trim();
    
    if (!gKey) {
        showToast("Inserisci prima l'API Key di Google Calendar", "error");
        return;
    }
    if (!gId) {
        showToast("Inserisci almeno un ID calendario", "error");
        return;
    }
    
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Verifica in corso...';
    btn.disabled = true;
    if (statusEl) statusEl.innerHTML = '';
    if (detailsEl) detailsEl.classList.add('hidden');
    
    try {
        const results = await AppData.testGCalConnection(gId, gKey);
        const allOk = results.every(r => r.ok);
        if (allOk) {
            if (statusEl) statusEl.innerHTML = '<span class="text-green-600 dark:text-green-400 font-bold ml-1.5 flex items-center gap-1"><i class="fas fa-check-circle"></i> Connessione riuscita!</span>';
            if (detailsEl) {
                detailsEl.innerHTML = `<div class="text-green-700 dark:text-green-300 font-medium">Tutti i calendari configurati (${results.length}) sono stati contattati con successo via API.</div>`;
                detailsEl.classList.remove('hidden');
            }
        } else {
            if (statusEl) statusEl.innerHTML = '<span class="text-red-500 font-bold ml-1.5 flex items-center gap-1"><i class="fas fa-times-circle"></i> Errore rilevato</span>';
            if (detailsEl) {
                let html = '<div class="space-y-2">';
                results.forEach(r => {
                    if (r.ok) {
                        html += `<div class="text-green-600 dark:text-green-400 font-medium"><i class="fas fa-check mr-1"></i> <b>${r.calId}</b>: OK</div>`;
                    } else {
                        html += `<div class="text-red-600 dark:text-red-400 font-semibold"><i class="fas fa-exclamation-triangle mr-1"></i> <b>${r.calId}</b>: ${r.error}</div>`;
                        if (r.hint) {
                            html += `<div class="text-slate-600 dark:text-slate-400 pl-4 text-[11px] leading-tight">👉 <i>${r.hint}</i></div>`;
                        }
                    }
                });
                html += '</div>';
                detailsEl.innerHTML = html;
                detailsEl.classList.remove('hidden');
            }
        }
    } catch(err) {
        if (statusEl) statusEl.innerHTML = `<span class="text-red-500 font-bold ml-1.5"><i class="fas fa-times-circle"></i> ${err.message}</span>`;
    } finally {
        btn.innerHTML = '<i class="fas fa-plug"></i> Testa Connessione Google Calendar';
        btn.disabled = false;
    }
}

// Controller Bottom Sheet Mobile
function openMobileUniversalAdd() {
    if (state.view === 'global_calendar') {
        openBlockModal(null, state.ui.calSelectedDate || getISODate(new Date()));
        return;
    }
    if (state.view === 'global_tasks') {
        openMobileQuickAdd();
        return;
    }
    const m = document.getElementById('mobileUniversalAddModal');
    if (m) { m.classList.remove('hidden'); m.classList.add('flex'); }
}
function closeMobileUniversalAdd() {
    const m = document.getElementById('mobileUniversalAddModal');
    if (m) { m.classList.add('hidden'); m.classList.remove('flex'); }
}

function openMobileMoreSheet() {
    const m = document.getElementById('mobileMoreSheet');
    if (m) { m.classList.remove('hidden'); m.classList.add('flex'); }
}
function closeMobileMoreSheet() {
    const m = document.getElementById('mobileMoreSheet');
    if (m) { m.classList.add('hidden'); m.classList.remove('flex'); }
}

// Aggiorna indicatore attivo nella barra di navigazione mobile
function updateMobileBottomNav() {
    const nav = document.getElementById('mobileBottomNav');
    if (!nav) return;
    const homeBtn = document.getElementById('bottomNavHome');
    const calBtn = document.getElementById('bottomNavCal');
    const tasksBtn = document.getElementById('bottomNavTasks');
    const moreBtn = document.getElementById('bottomNavMore');
    
    [homeBtn, calBtn, tasksBtn, moreBtn].forEach(b => {
        if (!b) return;
        b.classList.remove('text-blue-600', 'dark:text-blue-400', 'text-emerald-600', 'dark:text-emerald-400', 'text-purple-600', 'dark:text-purple-400', 'font-black');
        b.classList.add('text-slate-500', 'dark:text-slate-400');
    });

    if (state.view === 'home') {
        if (homeBtn) { homeBtn.classList.remove('text-slate-500', 'dark:text-slate-400'); homeBtn.classList.add('text-blue-600', 'dark:text-blue-400', 'font-black'); }
    } else if (state.view === 'global_calendar') {
        if (calBtn) { calBtn.classList.remove('text-slate-500', 'dark:text-slate-400'); calBtn.classList.add('text-emerald-600', 'dark:text-emerald-400', 'font-black'); }
    } else if (state.view === 'global_tasks') {
        if (tasksBtn) { tasksBtn.classList.remove('text-slate-500', 'dark:text-slate-400'); tasksBtn.classList.add('text-blue-600', 'dark:text-blue-400', 'font-black'); }
    } else if (['global_contacts', 'global_pages'].includes(state.view)) {
        if (moreBtn) { moreBtn.classList.remove('text-slate-500', 'dark:text-slate-400'); moreBtn.classList.add('text-purple-600', 'dark:text-purple-400', 'font-black'); }
    }
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

    // Salva impostazioni delle funzionalità
    if (!state.data.features) state.data.features = {};
    ['dashboardAgenda', 'eisenhowerMatrix', 'habitsTracker', 'contacts', 'timeBlocks', 'projectTimeline'].forEach(k => {
        const chk = document.getElementById('feat_' + k);
        if (chk) state.data.features[k] = chk.checked;
    });
    localStorage.setItem('hub_features', JSON.stringify(state.data.features));
    
    AppData.saveLocal();
    AppData.pushToCloud();
    toggleSettings(false);
    showToast("Impostazioni salvate con successo!", "success");
    if (typeof render === 'function') render();

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

function openImportModal() { 
    const m = document.getElementById('importModal');
    if (!m) return;
    const a = document.getElementById('importDataArea');
    if (a) a.value = '';
    m.classList.remove('hidden');
    m.style.display = 'flex';
}

function closeImportModal() { 
    const m = document.getElementById('importModal');
    if (!m) return;
    m.classList.add('hidden');
    m.style.display = 'none';
}

function executeImport() {
    const txt = document.getElementById('importDataArea')?.value.trim();
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

// Esponi helper su window per chiamate inline
window.toggleSettings = toggleSettings;
window.switchSettingsTab = switchSettingsTab;
window.toggleFeatureSetting = toggleFeatureSetting;
window.saveSettings = saveSettings;
window.openImportModal = openImportModal;
window.closeImportModal = closeImportModal;
window.executeImport = executeImport;

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
    updateMobileBottomNav();

    if(view === 'global_calendar' && AppData.gcalApiKey && AppData.gcalId) {
        await AppData.fetchGCalEvents();
        render();
        updateMobileBottomNav();
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
