// --- GESTIONE TASKS (Creazione, Modifica, Eliminazione, Completamento & Vincoli) ---
function openMobileQuickAdd() {
    const ctxValue = state.ui.tmView.startsWith('p_') || state.ui.tmView.startsWith('sp_') || state.ui.tmView.startsWith('s_') ? state.ui.tmView.replace(/^[ps_]+/, '') : '';
    const ctxOpts = generateCtxOpts(ctxValue);
    document.getElementById('mobileCtxContainer').innerHTML = `<select id="gtCtxMobile" class="input-base text-xs font-bold py-3.5 flex-1 bg-slate-50 dark:bg-slate-800/50 border-transparent transition focus:bg-white dark:focus:bg-darkbg mt-3">${ctxOpts}</select>`;
    
    document.getElementById('mobileQuickAddModal').classList.remove('hidden');
    document.getElementById('mobileQuickAddModal').classList.add('flex');
    setTimeout(() => document.getElementById('gtInMobile').focus(), 100);
}
function closeMobileQuickAdd() {
    document.getElementById('mobileQuickAddModal').classList.add('hidden');
    document.getElementById('mobileQuickAddModal').classList.remove('flex');
}

// Inserimento rapido di tag e smart-token da chip touch
function insertMobileChip(token) {
    const el = document.getElementById('gtInMobile');
    if (!el) return;
    let v = el.value.trim();
    if (token === '#') {
        el.value = v ? v + ' #' : '#';
    } else {
        el.value = v ? v + ' ' + token : token;
    }
    el.focus();
    if (typeof handleSmartInput === 'function') {
        handleSmartInput(el, '');
    }
}
function addTaskFromGlobalMobile() {
    if (window._justAppliedAutocomplete) return;
    const tIn = document.getElementById('gtInMobile'), pIn = document.getElementById('gtPriMobile'), dIn = document.getElementById('gtDateMobile'), cIn = document.getElementById('gtCtxMobile');
    let ctxValue = cIn ? cIn.value : '';
    
    if(!tIn.value.trim()) return;
    const parsed = parseSmartInput(tIn.value.trim(), ctxValue);
    const finalPri = parsed.priority > 0 ? parsed.priority : parseInt(pIn.value);
    const finalDate = parsed.date || dIn.value;
    state.data.tasks.push({ id: 't_'+Date.now(), title: parsed.title, completed: false, priority: finalPri, dueDate: finalDate, contextId: parsed.contextId, subtasks: [], dependsOn: [] });
    
    tIn.value = ''; dIn.value = ''; pIn.value = '0';
    closeMobileQuickAdd();
    showToast("Task creata", "success");
    AppData.triggerSave(); render();
}

function toggleTmSidebar() {
    const sidebar = document.getElementById('tmSidebar');
    const overlay = document.getElementById('tmOverlayInner');
    
    if (sidebar.classList.contains('open')) {
        sidebar.classList.remove('open');
        if(overlay) overlay.classList.remove('open');
    } else {
        sidebar.classList.add('open');
        if(overlay) overlay.classList.add('open');
    }
}

function setListSetting(key, value) {
    const listId = state.ui.tmView;
    if(!tmListSettings[listId]) tmListSettings[listId] = { groupBy: 'priority', sortBy: 'priority' };
    tmListSettings[listId][key] = value;
    localStorage.setItem('hub_tm_settings', JSON.stringify(tmListSettings));
    render();
}

// Helper per vincoli e dipendenze tra task
function getTaskDependencies(task) {
    if (!task || !task.dependsOn || task.dependsOn.length === 0) return [];
    return task.dependsOn.map(id => state.data.tasks.find(x => x.id === id)).filter(Boolean);
}

// Trova tutte le task che dipendono da una specifica task (questa task è prerequisito per...)
function getTasksDependentOn(taskId) {
    if (!taskId) return [];
    return state.data.tasks.filter(t => t.dependsOn && t.dependsOn.includes(taskId));
}

function isTaskBlocked(task) {
    if (!task || task.completed) return false;
    const deps = getTaskDependencies(task);
    return deps.some(d => !d.completed);
}

function getTaskBlockingReasons(task) {
    return getTaskDependencies(task).filter(d => !d.completed).map(d => d.title);
}

// Rilevamento cicli nelle dipendenze (evita loop ricorsivi A -> B -> A)
function wouldCreateCycle(taskId, targetDepId) {
    if (!taskId || !targetDepId) return false;
    if (taskId === targetDepId) return true;
    const visited = new Set();
    function dfs(currId) {
        if (currId === taskId) return true;
        visited.add(currId);
        const curr = state.data.tasks.find(x => x.id === currId);
        if (!curr || !curr.dependsOn) return false;
        for (let d of curr.dependsOn) {
            if (!visited.has(d)) {
                if (dfs(d)) return true;
            }
        }
        return false;
    }
    return dfs(targetDepId);
}

function addDependency(taskId, depId) {
    if (!depId || taskId === depId) return;
    const t = state.data.tasks.find(x => x.id === taskId);
    if (!t) return;
    
    if (wouldCreateCycle(taskId, depId)) {
        showToast("Impossibile collegare: creerebbe una dipendenza circolare!", "error");
        return;
    }
    
    // Preserva eventuali modifiche in corso nei campi input della task aperta
    const titleInput = document.getElementById('etTitle_' + taskId);
    if (titleInput && titleInput.value.trim()) t.title = titleInput.value.trim();
    const priInput = document.getElementById('etPri_' + taskId);
    if (priInput) t.priority = parseInt(priInput.value);
    const dateInput = document.getElementById('etDate_' + taskId);
    if (dateInput) t.dueDate = dateInput.value;
    const ctxInput = document.getElementById('etCtx_' + taskId);
    if (ctxInput) t.contextId = ctxInput.value;

    if (!t.dependsOn) t.dependsOn = [];
    if (!t.dependsOn.includes(depId)) {
        t.dependsOn.push(depId);
        AppData.triggerSave();
        render();
        showToast("Vincolo aggiunto con successo", "success");
    }
}

function removeDependency(taskId, depId) {
    const t = state.data.tasks.find(x => x.id === taskId);
    if (!t || !t.dependsOn) return;
    
    // Preserva eventuali modifiche in corso nei campi input
    const titleInput = document.getElementById('etTitle_' + taskId);
    if (titleInput && titleInput.value.trim()) t.title = titleInput.value.trim();
    const priInput = document.getElementById('etPri_' + taskId);
    if (priInput) t.priority = parseInt(priInput.value);
    const dateInput = document.getElementById('etDate_' + taskId);
    if (dateInput) t.dueDate = dateInput.value;
    const ctxInput = document.getElementById('etCtx_' + taskId);
    if (ctxInput) t.contextId = ctxInput.value;

    t.dependsOn = t.dependsOn.filter(id => id !== depId);
    AppData.triggerSave();
    render();
    showToast("Vincolo rimosso", "success");
}

function getAvailablePrerequisites(taskId, searchQuery = '') {
    const t = state.data.tasks.find(x => x.id === taskId);
    if (!t) return [];
    let candidates = state.data.tasks.filter(x => 
        !x.completed && 
        x.id !== taskId && 
        (!t.dependsOn || !t.dependsOn.includes(x.id)) && 
        !wouldCreateCycle(taskId, x.id)
    );
    if (searchQuery && searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        candidates = candidates.filter(x => {
            const titleMatch = x.title && x.title.toLowerCase().includes(q);
            const ctx = getContextInfo(x.contextId);
            const ctxMatch = ctx && ctx.name && ctx.name.toLowerCase().includes(q);
            return titleMatch || ctxMatch;
        });
    }
    return candidates;
}

function renderDependencyCandidatesHtml(taskId, searchQuery = '') {
    const candidates = getAvailablePrerequisites(taskId, searchQuery);
    if (candidates.length === 0) {
        return `<p class="text-[11px] text-slate-400 italic p-3 text-center">Nessuna task attiva disponibile da vincolare ${searchQuery ? 'con questo nome' : ''}.</p>`;
    }

    // Raggruppa per contesto (Progetto / Sfera / Senza contesto) per ordine visivo pulito
    const grouped = {};
    candidates.forEach(cand => {
        const ctxKey = cand.contextId || 'inbox';
        if (!grouped[ctxKey]) grouped[ctxKey] = [];
        grouped[ctxKey].push(cand);
    });

    let html = '';
    for (const [ctxKey, list] of Object.entries(grouped)) {
        const ctx = getContextInfo(ctxKey === 'inbox' ? '' : ctxKey);
        html += `
            <div class="mb-2">
                <div class="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-2 py-0.5 flex items-center gap-1.5 border-b border-slate-100 dark:border-slate-800">
                    <i class="fas ${ctx.icon || 'fa-folder'} text-[9px]" style="color:${ctx.color || '#94a3b8'}"></i>
                    <span>${ctx.name || 'Posta in arrivo / Senza Contesto'}</span>
                </div>
                <div class="space-y-1 mt-1">`;
        list.forEach(c => {
            let priDot = '';
            if (c.priority === 3) priDot = '<span class="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0"></span>';
            else if (c.priority === 2) priDot = '<span class="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"></span>';
            else if (c.priority === 1) priDot = '<span class="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0"></span>';

            html += `
                <div onclick="addDependency('${taskId}', '${c.id}')" 
                     class="flex items-center justify-between p-1.5 px-2.5 rounded-lg hover:bg-blue-50 dark:hover:bg-slate-800 border border-transparent hover:border-blue-200 dark:hover:border-slate-700 cursor-pointer transition text-xs group">
                    <div class="flex items-center gap-2 min-w-0">
                        ${priDot}
                        <span class="font-semibold text-slate-700 dark:text-slate-200 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400">${c.title}</span>
                        ${c.dueDate ? `<span class="text-[9px] text-slate-400 font-normal shrink-0"><i class="far fa-calendar-alt text-[8px] mr-0.5"></i>${formatDisplayDate(c.dueDate)}</span>` : ''}
                    </div>
                    <span class="text-[10px] font-bold text-blue-600 dark:text-blue-400 opacity-0 group-hover:opacity-100 transition shrink-0 ml-2">
                        <i class="fas fa-link text-[9px] mr-1"></i>+ Vincola
                    </span>
                </div>`;
        });
        html += `</div></div>`;
    }
    return html;
}

function filterDependencyCandidates(taskId, query) {
    const listEl = document.getElementById('depCandList_' + taskId);
    if (!listEl) return;
    listEl.innerHTML = renderDependencyCandidatesHtml(taskId, query);
}

function renderTaskDependencySection(t) {
    if (!t.dependsOn) t.dependsOn = [];
    const allDeps = getTaskDependencies(t);
    const dependents = getTasksDependentOn(t.id);
    
    let dHtml = '';
    
    // 1. Prerequisiti attivi di questa task
    if (allDeps.length > 0) {
        dHtml += '<div class="mb-3"><div class="text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1.5">Prerequisiti attivi (devi completare prima per sbloccarla):</div><div class="flex flex-wrap gap-1.5">';
        allDeps.forEach(d => {
            const badgeBg = d.completed 
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300' 
                : 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300';
            const icon = d.completed ? 'fa-check-circle text-emerald-500' : 'fa-lock text-amber-500';
            dHtml += `
                <span class="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border ${badgeBg} font-semibold shadow-2xs">
                    <i class="fas ${icon} text-[10px]"></i>
                    <span class="truncate max-w-[200px]">${d.title}</span>
                    <button type="button" onclick="event.stopPropagation(); removeDependency('${t.id}', '${d.id}')" class="text-slate-400 hover:text-red-500 ml-1.5 font-bold transition p-0.5" title="Rimuovi vincolo"><i class="fas fa-times text-[10px]"></i></button>
                </span>`;
        });
        dHtml += '</div></div>';
    }

    // Selettore avanzato ricercabile per aggiungere prerequisiti (mostra SOLO task attive non completate)
    const initialCandidatesHtml = renderDependencyCandidatesHtml(t.id, '');
    const totalAvail = getAvailablePrerequisites(t.id, '').length;

    if (totalAvail > 0) {
        dHtml += `
            <div class="mt-2 bg-slate-50 dark:bg-slate-900/40 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700/80">
                <div class="flex justify-between items-center mb-1.5">
                    <span class="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                        <i class="fas fa-plus-circle text-blue-500"></i> Aggiungi Prerequisito (${totalAvail} disponibili)
                    </span>
                    <span class="text-[9px] text-slate-400 italic">Clicca su una task per vincolarla</span>
                </div>
                <div class="relative mb-2">
                    <i class="fas fa-search absolute left-2.5 top-2 text-xs text-slate-400"></i>
                    <input type="text" id="depSearch_${t.id}" 
                           placeholder="Cerca per titolo o progetto..." 
                           oninput="filterDependencyCandidates('${t.id}', this.value)" 
                           class="input-base pl-8 py-1 text-xs font-semibold bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-lg">
                </div>
                <div id="depCandList_${t.id}" class="max-h-36 overflow-y-auto space-y-1 bg-white dark:bg-slate-900/60 p-1.5 rounded-lg border border-slate-100 dark:border-slate-800">
                    ${initialCandidatesHtml}
                </div>
            </div>`;
    } else {
        dHtml += '<p class="text-[10px] text-slate-400 italic mt-1">Nessun\'altra task attiva disponibile a cui vincolare.</p>';
    }

    // 2. Mostra se questa task sblocca altre task
    if (dependents.length > 0) {
        dHtml += `
            <div class="mt-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                <div class="text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1.5">
                    <i class="fas fa-key text-blue-500"></i> Questa task sblocca (${dependents.length}):
                </div>
                <div class="flex flex-wrap gap-1.5">
                    ${dependents.map(dp => `
                        <span class="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 font-medium">
                            <i class="fas fa-arrow-right text-[8px] opacity-70"></i> ${dp.title}
                            <button type="button" onclick="event.stopPropagation(); removeDependency('${dp.id}', '${t.id}')" class="text-slate-400 hover:text-red-500 ml-1" title="Scollega vincolo"><i class="fas fa-times text-[9px]"></i></button>
                        </span>
                    `).join('')}
                </div>
            </div>`;
    }

    return `
        <div class="mt-2.5 pt-2.5 border-t border-slate-200/80 dark:border-slate-700/80">
            <div class="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1.5 tracking-wider">
                <i class="fas fa-link text-blue-500"></i> Vincoli & Prerequisiti
            </div>
            ${dHtml}
        </div>`;
}

function getTaskLockAndDueHtml(t) {
    const isBlocked = isTaskBlocked(t);
    const blockers = getTaskBlockingReasons(t);
    const allDeps = getTaskDependencies(t);
    const hasDeps = allDeps.length > 0;
    const dueStatus = getDueDateStatus(t.dueDate);
    
    // Tasks che dipendono da questa task
    const dependents = getTasksDependentOn(t.id);
    const hasDependents = dependents.length > 0;

    let lockBadge = '';
    if (isBlocked) {
        const uncompletedBlockers = (t.dependsOn || []).map(id => state.data.tasks.find(x => x.id === id)).filter(x => x && !x.completed);
        const blockerChips = uncompletedBlockers.map(b => `<button type="button" onclick="event.stopPropagation(); jumpToTask('${b.id}')" class="underline font-bold hover:text-blue-600 dark:hover:text-blue-300 transition" title="Vai a: ${b.title}">${b.title}</button>`).join(', ');
        lockBadge = `<span class="inline-flex items-center gap-1.5 text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 dark:bg-amber-950/70 dark:text-amber-200 border border-amber-300 dark:border-amber-700 shadow-2xs" title="Clicca su una task per evidenziarla"><i class="fas fa-lock text-[9px] text-amber-600 dark:text-amber-400"></i> Richiede: <span class="font-extrabold">${blockerChips || blockers.join(', ')}</span></span>`;
    } else if (hasDeps) {
        lockBadge = `<span class="inline-flex items-center gap-1 text-[9px] font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shadow-2xs" title="Tutti i vincoli sono stati completati"><i class="fas fa-check-circle text-emerald-500 text-[8px]"></i> Sbloccata</span>`;
    }

    let unlocksBadge = '';
    if (hasDependents) {
        const depChips = dependents.map(d => `<button type="button" onclick="event.stopPropagation(); jumpToTask('${d.id}')" class="underline font-bold hover:text-blue-600 dark:hover:text-blue-300 transition" title="Vai a: ${d.title}">${(d.completed ? '✔ ' : '') + d.title}</button>`).join(', ');
        const anyUncompleted = dependents.some(d => !d.completed);
        const uBg = anyUncompleted 
            ? 'bg-blue-50 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800' 
            : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700 opacity-80';
        unlocksBadge = `<span class="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md border shadow-2xs ${uBg}" title="Clicca su una task per evidenziarla"><i class="fas fa-key text-blue-500 text-[8px]"></i> Sblocca: <span class="font-extrabold">${depChips}</span></span>`;
    }

    let duePill = '';
    if (dueStatus) {
        duePill = `<span class="inline-flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded-md border shadow-2xs ${dueStatus.colorClass}" title="Scadenza: ${t.dueDate}"><i class="fas ${dueStatus.icon} text-[9px]"></i>${dueStatus.label}</span>`;
    }

    return {
        isBlocked,
        blockers,
        lockBadge,
        unlocksBadge,
        duePill
    };
}

function addTask(cId) {
    if (window._justAppliedAutocomplete) return;
    const tIn = document.getElementById(`tIn_${cId||'g'}`);
    const ctxSelect = document.getElementById(`tCtx_${cId||'g'}`);
    if(!tIn.value.trim()) return;
    const finalCtx = ctxSelect ? ctxSelect.value : (cId || '');
    
    const parsed = parseSmartInput(tIn.value.trim(), finalCtx);
    state.data.tasks.push({ id: 't_'+Date.now(), title: parsed.title, completed: false, priority: parsed.priority, dueDate: parsed.date, contextId: parsed.contextId, subtasks: [], dependsOn: [] });
    
    showToast("Task creata", "success");
    AppData.triggerSave(); render();
}

function addTaskFromGlobal() {
    if (window._justAppliedAutocomplete) return;
    const tIn = document.getElementById('gtIn'), pIn = document.getElementById('gtPri'), dIn = document.getElementById('gtDate'), cIn = document.getElementById('gtCtx'); 
    const fallbackCtx = cIn ? cIn.value : (state.ui.tmView.startsWith('p_') || state.ui.tmView.startsWith('sp_') || state.ui.tmView.startsWith('s_') ? state.ui.tmView.replace(/^[ps_]+/, '') : '');
    
    if(!tIn.value.trim()) return;
    const parsed = parseSmartInput(tIn.value.trim(), fallbackCtx);
    
    const finalPri = parsed.priority > 0 ? parsed.priority : parseInt(pIn.value);
    const finalDate = parsed.date || dIn.value;
    
    state.data.tasks.push({ id: 't_'+Date.now(), title: parsed.title, completed: false, priority: finalPri, dueDate: finalDate, contextId: parsed.contextId, subtasks: [], dependsOn: [] });
    
    showToast("Task creata", "success");
    AppData.triggerSave(); render();
}

function toggleTask(id) { 
    const t = state.data.tasks.find(x => x.id === id); 
    if(!t) return; 
    
    // Controllo vincoli: impedisci completamento se vi sono prerequisiti non completati
    if(!t.completed && isTaskBlocked(t)) {
        const blockers = getTaskBlockingReasons(t);
        const taskEl = document.getElementById('taskRow_' + id);
        if(taskEl) {
            // Revert immediato dello stato del checkbox nel DOM per non ingannare l'utente
            const chk = taskEl.querySelector('input[type="checkbox"]');
            if(chk) chk.checked = false;
            
            taskEl.classList.remove('shake-anim');
            void taskEl.offsetWidth;
            taskEl.classList.add('shake-anim');
        }
        showToast(`🔒 Task bloccata! Devi prima completare: "${blockers.join('", "')}"`, "error");
        setTimeout(() => render(), 200);
        return;
    }

    const taskEl = document.getElementById('taskRow_' + id);
    if(taskEl) {
        if(!t.completed) taskEl.classList.add('task-completing-anim');
        setTimeout(() => {
            t.completed = !t.completed; 
            AppData.triggerSave(); 
            render();
        }, 250);
    } else {
        t.completed = !t.completed; 
        AppData.triggerSave(); 
        render(); 
    }
}



function editTask(id) { editingTaskId = id; render(); }

function saveTaskEdit(id, contextElementId) {
    const t = state.data.tasks.find(x => x.id === id);
    if(!t) return;
    const titleInput = document.getElementById('etTitle_' + id);
    if(titleInput && titleInput.value.trim()) t.title = titleInput.value.trim();
    const priInput = document.getElementById('etPri_' + id);
    if(priInput) t.priority = parseInt(priInput.value);
    const dateInput = document.getElementById('etDate_' + id);
    if(dateInput) t.dueDate = dateInput.value;
    if(contextElementId) { 
        const ctxEl = document.getElementById(contextElementId);
        if(ctxEl) t.contextId = ctxEl.value; 
    }
    
    // Salva eventuale vincolo ancora selezionato nel dropdown per non perderlo al salvataggio
    const depSelect = document.getElementById('selDep_' + id);
    if (depSelect && depSelect.value) {
        if (!t.dependsOn) t.dependsOn = [];
        if (!t.dependsOn.includes(depSelect.value)) {
            t.dependsOn.push(depSelect.value);
        }
    }

    editingTaskId = null;
    showToast("Modifiche salvate", "success");
    AppData.triggerSave(); render();
}


// --- SALTO VISIVO INTERATTIVO & DUPLICAZIONE ---
function jumpToTask(taskId) {
    let el = document.getElementById('taskRow_' + taskId);
    if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('task-highlight-glow');
        setTimeout(() => el.classList.remove('task-highlight-glow'), 1800);
        return;
    }
    state.ui.tmView = 'all';
    state.ui.taskSearchQuery = '';
    render();
    setTimeout(() => {
        el = document.getElementById('taskRow_' + taskId);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.classList.add('task-highlight-glow');
            setTimeout(() => el.classList.remove('task-highlight-glow'), 1800);
        }
    }, 150);
}

let lastDeletedTask = null;
let lastDeletedTaskIndex = -1;

function deleteTask(id) { 
    const idx = state.data.tasks.findIndex(x => x.id === id);
    if (idx === -1) return;
    lastDeletedTask = JSON.parse(JSON.stringify(state.data.tasks[idx]));
    lastDeletedTaskIndex = idx;

    state.data.tasks.splice(idx, 1);
    state.data.tasks.forEach(t => {
        if (t.dependsOn && t.dependsOn.includes(id)) {
            t.dependsOn = t.dependsOn.filter(d => d !== id);
        }
    });
    AppData.triggerSave(); 
    render(); 
    showToast(`Task eliminata <button onclick="undoDeleteTask()" class="ml-2 font-bold underline bg-white/20 hover:bg-white/30 px-2 py-0.5 rounded text-xs transition">Annulla</button>`, "info");
}

function undoDeleteTask() {
    if (!lastDeletedTask) return;
    const taskToRestore = lastDeletedTask;
    lastDeletedTask = null;
    const insertAt = (lastDeletedTaskIndex >= 0 && lastDeletedTaskIndex <= state.data.tasks.length) ? lastDeletedTaskIndex : state.data.tasks.length;
    state.data.tasks.splice(insertAt, 0, taskToRestore);
    AppData.triggerSave();
    render();
    showToast("Task ripristinata con successo!", "success");
}

function duplicateTask(id) {
    const t = state.data.tasks.find(x => x.id === id);
    if (!t) return;
    const clone = JSON.parse(JSON.stringify(t));
    clone.id = 't_' + Date.now();
    clone.title = clone.title + ' (Copia)';
    clone.completed = false;
    if (clone.subtasks) {
        clone.subtasks.forEach(st => {
            st.id = 'st_' + Math.random().toString(36).substr(2, 9);
            st.completed = false;
        });
    }
    state.data.tasks.push(clone);
    AppData.triggerSave();
    render();
    showToast("Task duplicata con successo", "success");
    setTimeout(() => jumpToTask(clone.id), 100);
}
