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
            const chk = taskEl.querySelector('input[type="checkbox"]');
            if(chk) chk.checked = false;
            taskEl.classList.remove('shake-anim');
            void taskEl.offsetWidth;
            taskEl.classList.add('shake-anim');
        }
        triggerHaptic('error');
        showToast(`🔒 Task bloccata! Devi prima completare: "${blockers.join('", "')}"`, "error");
        setTimeout(() => render(), 200);
        return;
    }

    const prevCompleted = t.completed;
    const taskEl = document.getElementById('taskRow_' + id);
    if(taskEl && !t.completed) taskEl.classList.add('task-completing-anim');
    
    setTimeout(() => {
        t.completed = !prevCompleted; 
        if (t.completed) {
            triggerHaptic('success');
            // Gestione ricorrenza automatica
            if (t.recurrence && t.recurrence.frequency && t.recurrence.frequency !== 'none') {
                const nextDate = calculateNextRecurrenceDate(t.dueDate, t.recurrence);
                const nextTask = {
                    id: 't_' + Date.now(),
                    title: t.title,
                    completed: false,
                    priority: t.priority,
                    dueDate: nextDate,
                    contextId: t.contextId,
                    recurrence: { ...t.recurrence },
                    estimatedMinutes: t.estimatedMinutes || 0,
                    spentMinutes: 0,
                    eisenhower: t.eisenhower || 'auto',
                    subtasks: (t.subtasks || []).map(st => ({ id: 'st_' + Date.now() + '_' + Math.random().toString(36).substr(2, 3), title: st.title, completed: false })),
                    dependsOn: []
                };
                state.data.tasks.push(nextTask);
                showToast(`Task completata! Prossima ricorrenza creata per il ${formatDisplayDate(nextDate)}`, "success");
            }
        }
        
        if (typeof UndoManager !== 'undefined') {
            UndoManager.push({
                label: `${t.completed ? 'Completata' : 'Riaperta'}: ${t.title}`,
                undo: () => {
                    t.completed = prevCompleted;
                }
            });
        }

        AppData.triggerSave(); 
        render();
    }, taskEl && !prevCompleted ? 250 : 0);
}

function editTask(id) { 
    openTaskModal(id);
}

function openTaskModal(id) {
    const t = (state.data.tasks || []).find(x => x.id === id);
    if (!t) return;
    const modal = document.getElementById('taskEditModal');
    if (!modal) return;

    document.getElementById('temId').value = t.id;
    document.getElementById('temTitleInput').value = t.title || t.text || '';
    document.getElementById('temPriority').value = t.priority !== undefined ? t.priority : 0;
    document.getElementById('temDueDate').value = t.dueDate || '';
    document.getElementById('temStartDate').value = t.startDate || '';
    
    // Contesto
    const ctxSelect = document.getElementById('temContext');
    if (ctxSelect && typeof generateCtxOpts === 'function') {
        ctxSelect.innerHTML = generateCtxOpts(t.contextId);
    }
    
    // Ricorrenza
    document.getElementById('temRecurrence').value = t.recurrence?.frequency || 'none';
    
    // Eisenhower
    document.getElementById('temEisenhower').value = t.eisenhower || 'auto';
    
    document.getElementById('temNotes').value = t.notes || '';
    
    // Subtasks
    renderModalSubtasks(t);

    // Vincoli & Dipendenze
    renderModalDependencies(t);

    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function closeTaskModal() {
    const modal = document.getElementById('taskEditModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

function renderModalSubtasks(task) {
    const list = document.getElementById('temSubtaskList');
    const count = document.getElementById('temSubtaskCount');
    if (!list) return;
    const subtasks = task.subtasks || [];
    if (count) count.innerText = `${subtasks.filter(s => s.completed).length}/${subtasks.length}`;

    if (subtasks.length === 0) {
        list.innerHTML = `<p class="text-xs text-slate-400 italic py-2">Nessuna sotto-attività inserita.</p>`;
        return;
    }

    list.innerHTML = subtasks.map(s => `
        <div class="flex items-center gap-2 p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
            <input type="checkbox" class="w-3.5 h-3.5 rounded text-blue-600 cursor-pointer" ${s.completed ? 'checked' : ''} onchange="toggleModalSubtask('${task.id}', '${s.id}')">
            <input type="text" value="${escapeNoteHtml(s.title)}" class="bg-transparent text-xs flex-1 border-none focus:outline-none ${s.completed ? 'line-through text-slate-400' : 'text-slate-800 dark:text-slate-200'}" onchange="updateModalSubtaskTitle('${task.id}', '${s.id}', this.value)">
            <button type="button" onclick="deleteModalSubtask('${task.id}', '${s.id}')" class="text-slate-400 hover:text-rose-500 p-1 rounded transition"><i class="fas fa-times text-xs"></i></button>
        </div>
    `).join('');
}

function addSubtaskFromModal() {
    const id = document.getElementById('temId').value;
    const input = document.getElementById('temNewSubtask');
    if (!id || !input || !input.value.trim()) return;
    const t = (state.data.tasks || []).find(x => x.id === id);
    if (!t) return;
    if (!t.subtasks) t.subtasks = [];
    t.subtasks.push({
        id: 'st_' + Date.now(),
        title: input.value.trim(),
        completed: false
    });
    input.value = '';
    AppData.triggerSave();
    renderModalSubtasks(t);
}

function toggleModalSubtask(taskId, subId) {
    const t = (state.data.tasks || []).find(x => x.id === taskId);
    if (!t || !t.subtasks) return;
    const s = t.subtasks.find(x => x.id === subId);
    if (s) {
        s.completed = !s.completed;
        AppData.triggerSave();
        renderModalSubtasks(t);
    }
}

function updateModalSubtaskTitle(taskId, subId, newTitle) {
    const t = (state.data.tasks || []).find(x => x.id === taskId);
    if (!t || !t.subtasks) return;
    const s = t.subtasks.find(x => x.id === subId);
    if (s) {
        s.title = newTitle.trim();
        AppData.triggerSave();
    }
}

function deleteModalSubtask(taskId, subId) {
    const t = (state.data.tasks || []).find(x => x.id === taskId);
    if (!t || !t.subtasks) return;
    t.subtasks = t.subtasks.filter(x => x.id !== subId);
    AppData.triggerSave();
    renderModalSubtasks(t);
}

function saveTaskModal() {
    const id = document.getElementById('temId').value;
    const t = (state.data.tasks || []).find(x => x.id === id);
    if (!t) return;

    let rawTitle = document.getElementById('temTitleInput').value.trim();
    if (!rawTitle) {
        showToast("Inserisci un titolo per la task", "error");
        return;
    }

    // Se l'utente ha inserito tag intelligenti tipo 'Fare spesa p3 @domani #Progetto', pulisci il testo e applica i parametri
    const parsed = parseSmartInput(rawTitle, t.contextId);
    t.title = parsed.title || rawTitle;

    if (parsed.priority > 0) t.priority = parsed.priority;
    else t.priority = parseInt(document.getElementById('temPriority').value) || 0;

    if (parsed.date) t.dueDate = parsed.date;
    else t.dueDate = document.getElementById('temDueDate').value || '';

    if (parsed.contextId) t.contextId = parsed.contextId;
    else t.contextId = document.getElementById('temContext')?.value || t.contextId || null;

    t.startDate = document.getElementById('temStartDate').value || '';

    const rec = document.getElementById('temRecurrence').value;
    t.recurrence = (rec === 'none') ? { frequency: 'none' } : { frequency: rec, interval: 1 };

    t.eisenhower = document.getElementById('temEisenhower').value || 'auto';
    t.notes = document.getElementById('temNotes').value.trim();

    AppData.triggerSave();
    closeTaskModal();
    showToast("Task aggiornata con successo", "success");

    // Aggiorna eventuale pillola presente nel quaderno attivo
    const pill = document.querySelector(`.note-task-pill[data-task-id="${id}"]`);
    if (pill) {
        const titleSpan = pill.querySelector('.note-task-title');
        if (titleSpan) titleSpan.textContent = t.title;
    } else {
        render();
    }
}

// --- GESTIONE VINCOLI E DIPENDENZE NEL MODAL TASK ---
function renderModalDependencies(task) {
    const blockersList = document.getElementById('temBlockersList');
    const blockersCount = document.getElementById('temBlockersCount');
    const blockerSelect = document.getElementById('temAddBlockerSelect');
    
    const dependentsList = document.getElementById('temDependentsList');
    const dependentsCount = document.getElementById('temDependentsCount');
    const dependentSelect = document.getElementById('temAddDependentSelect');

    const blockers = getTaskDependencies(task);
    const dependents = getTasksDependentOn(task.id);

    if (blockersCount) blockersCount.textContent = blockers.length;
    if (dependentsCount) dependentsCount.textContent = dependents.length;

    // 1. Blockers (prerequisiti)
    if (blockersList) {
        if (blockers.length === 0) {
            blockersList.innerHTML = `<p class="text-[11px] text-slate-400 italic py-1">Nessun prerequisito (questa task è pronta per essere svolta).</p>`;
        } else {
            blockersList.innerHTML = blockers.map(b => `
                <div class="flex items-center justify-between gap-2 p-1.5 rounded-lg ${b.completed ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-300' : 'bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 text-amber-800 dark:text-amber-300'} text-xs font-semibold">
                    <div class="flex items-center gap-1.5 truncate">
                        <i class="fas ${b.completed ? 'fa-check-circle text-emerald-500' : 'fa-lock text-amber-500'} text-xs shrink-0"></i>
                        <span class="truncate ${b.completed ? 'line-through opacity-70' : ''}">${escapeHtml(b.title)}</span>
                    </div>
                    <button type="button" onclick="removeModalBlocker('${b.id}')" class="text-slate-400 hover:text-rose-500 p-1 rounded transition shrink-0" title="Rimuovi vincolo"><i class="fas fa-times text-xs"></i></button>
                </div>
            `).join('');
        }
    }

    // 2. Dependents (sbloccate da questa task)
    if (dependentsList) {
        if (dependents.length === 0) {
            dependentsList.innerHTML = `<p class="text-[11px] text-slate-400 italic py-1">Nessuna task dipende da questa (non vincola altre attività).</p>`;
        } else {
            dependentsList.innerHTML = dependents.map(d => `
                <div class="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-300 text-xs font-semibold">
                    <div class="flex items-center gap-1.5 truncate">
                        <i class="fas fa-key text-emerald-500 text-xs shrink-0"></i>
                        <span class="truncate">${escapeHtml(d.title)}</span>
                    </div>
                    <button type="button" onclick="removeModalDependent('${d.id}')" class="text-slate-400 hover:text-rose-500 p-1 rounded transition shrink-0" title="Rimuovi dipendenza"><i class="fas fa-times text-xs"></i></button>
                </div>
            `).join('');
        }
    }

    // 3. Dropdowns per aggiungere nuovi vincoli
    const otherTasks = (state.data.tasks || []).filter(x => x.id !== task.id && !x.completed);

    if (blockerSelect) {
        const availableBlockers = otherTasks.filter(x => !(task.dependsOn || []).includes(x.id) && !wouldCreateCycle(task.id, x.id));
        blockerSelect.innerHTML = `<option value="">-- Seleziona una task prerequisito --</option>` + 
            availableBlockers.map(x => `<option value="${x.id}">${escapeHtml(x.title)}</option>`).join('');
    }

    if (dependentSelect) {
        const availableDependents = otherTasks.filter(x => !(x.dependsOn || []).includes(task.id) && !wouldCreateCycle(x.id, task.id));
        dependentSelect.innerHTML = `<option value="">-- Seleziona una task da sbloccare --</option>` + 
            availableDependents.map(x => `<option value="${x.id}">${escapeHtml(x.title)}</option>`).join('');
    }
}

function addModalBlocker() {
    const taskId = document.getElementById('temId').value;
    const blockerId = document.getElementById('temAddBlockerSelect')?.value;
    if (!taskId || !blockerId) return;
    addDependency(taskId, blockerId);
    const task = (state.data.tasks || []).find(x => x.id === taskId);
    if (task) renderModalDependencies(task);
}

function removeModalBlocker(blockerId) {
    const taskId = document.getElementById('temId').value;
    if (!taskId || !blockerId) return;
    removeDependency(taskId, blockerId);
    const task = (state.data.tasks || []).find(x => x.id === taskId);
    if (task) renderModalDependencies(task);
}

function addModalDependent() {
    const taskId = document.getElementById('temId').value;
    const dependentId = document.getElementById('temAddDependentSelect')?.value;
    if (!taskId || !dependentId) return;
    addDependency(dependentId, taskId);
    const task = (state.data.tasks || []).find(x => x.id === taskId);
    if (task) renderModalDependencies(task);
}

function removeModalDependent(dependentId) {
    const taskId = document.getElementById('temId').value;
    if (!taskId || !dependentId) return;
    removeDependency(dependentId, taskId);
    const task = (state.data.tasks || []).find(x => x.id === taskId);
    if (task) renderModalDependencies(task);
}

function insertEditModalChip(text) {
    const input = document.getElementById('temTitleInput');
    if (!input) return;
    input.value = (input.value ? input.value + ' ' : '') + text + ' ';
    input.focus();
    if (typeof handleSmartInput === 'function') {
        handleSmartInput(input, 'editModal');
    }
}

window.renderModalDependencies = renderModalDependencies;
window.addModalBlocker = addModalBlocker;
window.removeModalBlocker = removeModalBlocker;
window.addModalDependent = addModalDependent;
window.removeModalDependent = removeModalDependent;
window.insertEditModalChip = insertEditModalChip;

function deleteTaskFromModal() {
    const id = document.getElementById('temId').value;
    if (!id) return;
    if (!confirm("Eliminare questa task?")) return;

    deleteTask(id);
    closeTaskModal();
}

function toggleTaskFromPill(taskId, chkEl) {
    const task = (state.data.tasks || []).find(t => t.id === taskId);
    if (!task) return;
    task.completed = chkEl ? chkEl.checked : !task.completed;
    if (task.completed) {
        task.completedAt = getISODate(new Date());
    } else {
        delete task.completedAt;
    }
    AppData.triggerSave();

    const pill = chkEl ? chkEl.closest('.note-task-pill') : document.querySelector(`.note-task-pill[data-task-id="${taskId}"]`);
    if (pill) {
        pill.classList.toggle('is-completed', task.completed);
        const titleSpan = pill.querySelector('.note-task-title');
        if (titleSpan) {
            titleSpan.classList.toggle('line-through', task.completed);
            titleSpan.classList.toggle('opacity-60', task.completed);
        }
    }
    showToast(task.completed ? "Task completata! 🎉" : "Task riaperta", "default");
}

function saveTaskEdit(id, contextElementId) {
    const t = state.data.tasks.find(x => x.id === id);
    if(!t) return;
    const titleInput = document.getElementById('etTitle_' + id);
    if(titleInput && titleInput.value.trim()) t.title = titleInput.value.trim();
    const priInput = document.getElementById('etPri_' + id);
    if(priInput) t.priority = parseInt(priInput.value);
    const dateInput = document.getElementById('etDate_' + id);
    if(dateInput) t.dueDate = dateInput.value;
    const startDateInput = document.getElementById('etStartDate_' + id);
    if(startDateInput) t.startDate = startDateInput.value || '';
    if(contextElementId) { 
        const ctxEl = document.getElementById(contextElementId);
        if(ctxEl) t.contextId = ctxEl.value; 
    }
    
    // Ricorrenza
    const recInput = document.getElementById('etRec_' + id);
    if (recInput) {
        if (recInput.value === 'none') {
            t.recurrence = { frequency: 'none' };
        } else {
            t.recurrence = { frequency: recInput.value, interval: 1 };
        }
    }
    
    // Stima e Tempo Impiegato
    const estInput = document.getElementById('etEst_' + id);
    if (estInput) t.estimatedMinutes = Math.max(0, parseInt(estInput.value) || 0);
    const spentInput = document.getElementById('etSpent_' + id);
    if (spentInput) t.spentMinutes = Math.max(0, parseInt(spentInput.value) || 0);

    // Eisenhower Quadrant
    const eisenInput = document.getElementById('etEisen_' + id);
    if (eisenInput) t.eisenhower = eisenInput.value || 'auto';

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

// --- MATRICE DI EISENHOWER (2X2) LOGIC ---
function getTaskEisenhowerQuadrant(t) {
    if (t.eisenhower && t.eisenhower !== 'auto') return t.eisenhower;
    const todayIso = getISODate(new Date());
    const isDueSoon = t.dueDate && t.dueDate <= todayIso;
    if (t.priority === 3) {
        return isDueSoon ? 'q1' : 'q2';
    } else if (t.priority === 2) {
        return isDueSoon ? 'q1' : 'q2';
    } else if (t.priority === 1) {
        return isDueSoon ? 'q3' : 'q4';
    }
    return 'q4';
}

function setTaskEisenhowerQuadrant(taskId, quadrant) {
    const t = state.data.tasks.find(x => x.id === taskId);
    if (!t) return;
    t.eisenhower = quadrant;
    AppData.triggerSave();
    showToast(`Task spostata nel quadrante ${quadrant.toUpperCase()}`, "success");
    render();
}

function renderEisenhowerMatrix() {
    const activeTasks = (state.data.tasks || []).filter(t => !t.completed);
    const q1Tasks = activeTasks.filter(t => getTaskEisenhowerQuadrant(t) === 'q1');
    const q2Tasks = activeTasks.filter(t => getTaskEisenhowerQuadrant(t) === 'q2');
    const q3Tasks = activeTasks.filter(t => getTaskEisenhowerQuadrant(t) === 'q3');
    const q4Tasks = activeTasks.filter(t => getTaskEisenhowerQuadrant(t) === 'q4');

    const renderQuadrantBox = (id, title, subtitle, icon, colorTheme, tasks) => `
        <div class="eisenhower-quadrant ${colorTheme.border} ${colorTheme.bg} rounded-2xl p-4 flex flex-col border shadow-xs min-h-[300px]">
            <div class="flex items-center justify-between pb-3 mb-3 border-b ${colorTheme.borderB}">
                <div class="flex items-center gap-2">
                    <span class="w-7 h-7 rounded-lg ${colorTheme.badge} flex items-center justify-center text-xs font-bold shrink-0">
                        <i class="fas ${icon}"></i>
                    </span>
                    <div>
                        <h4 class="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">${title}</h4>
                        <p class="text-[10px] text-slate-500 dark:text-slate-400">${subtitle}</p>
                    </div>
                </div>
                <span class="text-xs font-bold px-2 py-0.5 rounded-full ${colorTheme.countBadge}">${tasks.length}</span>
            </div>
            <div class="flex-1 space-y-2 overflow-y-auto max-h-[380px] pr-1">
                ${tasks.length === 0 ? `<p class="text-xs text-slate-400 italic py-8 text-center">Nessun task in questo quadrante</p>` : ''}
                ${tasks.map(t => {
                    const ctx = typeof getContextInfo === 'function' ? getContextInfo(t.contextId) : { name: '' };
                    return `
                        <div class="p-2.5 bg-white dark:bg-darkpanel border border-slate-200 dark:border-darkborder rounded-xl shadow-2xs hover:shadow transition group flex items-start justify-between gap-2">
                            <div class="flex items-start gap-2.5 min-w-0 flex-1">
                                <input type="checkbox" onchange="toggleTask('${t.id}')" class="task-checkbox mt-0.5 shrink-0">
                                <div class="min-w-0 cursor-pointer" onclick="editTask('${t.id}')">
                                    <p class="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-snug truncate">${escapeHtml(t.title)}</p>
                                    <div class="flex items-center gap-1.5 mt-1 text-[10px] text-slate-400">
                                        ${t.dueDate ? `<span class="font-mono ${t.dueDate <= getISODate(new Date()) ? 'text-red-500 font-bold' : ''}"><i class="far fa-calendar-alt mr-1"></i>${formatDisplayDate(t.dueDate)}</span>` : ''}
                                        ${ctx.name ? `<span class="truncate max-w-[90px]"><i class="fas ${ctx.icon || 'fa-folder'} mr-1 opacity-50"></i>${ctx.name}</span>` : ''}
                                    </div>
                                </div>
                            </div>
                            <div class="relative shrink-0 opacity-0 group-hover:opacity-100 transition">
                                <select onchange="setTaskEisenhowerQuadrant('${t.id}', this.value)" class="text-[9px] font-bold py-1 px-1.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 cursor-pointer">
                                    <option value="" disabled selected>Sposta...</option>
                                    <option value="q1">Q1: Urgente & Importante</option>
                                    <option value="q2">Q2: Non Urg. ma Importante</option>
                                    <option value="q3">Q3: Urg. non Importante</option>
                                    <option value="q4">Q4: Né Urg. né Importante</option>
                                </select>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;

    return `
        <div class="p-4 md:p-6">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                ${renderQuadrantBox('q1', 'Q1: Fai Subito', 'Urgente & Importante (Crisi, Scadenze oggi)', 'fa-fire', {
                    border: 'border-red-200 dark:border-red-900/50',
                    bg: 'bg-red-50/40 dark:bg-red-950/20',
                    borderB: 'border-red-100 dark:border-red-900/40',
                    badge: 'bg-red-500 text-white',
                    countBadge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                }, q1Tasks)}

                ${renderQuadrantBox('q2', 'Q2: Pianifica', 'Non Urgente ma Importante (Strategia, Crescita)', 'fa-gem', {
                    border: 'border-blue-200 dark:border-blue-900/50',
                    bg: 'bg-blue-50/40 dark:bg-blue-950/20',
                    borderB: 'border-blue-100 dark:border-blue-900/40',
                    badge: 'bg-blue-500 text-white',
                    countBadge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                }, q2Tasks)}

                ${renderQuadrantBox('q3', 'Q3: Delega / Riduci', 'Urgente ma Non Importante (Interruzioni, Richieste)', 'fa-bolt', {
                    border: 'border-amber-200 dark:border-amber-900/50',
                    bg: 'bg-amber-50/40 dark:bg-amber-950/20',
                    borderB: 'border-amber-100 dark:border-amber-900/40',
                    badge: 'bg-amber-500 text-white',
                    countBadge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                }, q3Tasks)}

                ${renderQuadrantBox('q4', 'Q4: Elimina / Rivedi', 'Né Urgente né Importante (Distrazioni, Bassa priorità)', 'fa-seedling', {
                    border: 'border-slate-200 dark:border-slate-700',
                    bg: 'bg-slate-50 dark:bg-[#1a2333]/50',
                    borderB: 'border-slate-200 dark:border-slate-700',
                    badge: 'bg-slate-500 text-white',
                    countBadge: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                }, q4Tasks)}
            </div>
        </div>
    `;
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
    const taskToDelete = state.data.tasks[idx];
    lastDeletedTask = JSON.parse(JSON.stringify(taskToDelete));
    lastDeletedTaskIndex = idx;

    if (typeof moveToTrash === 'function') {
        moveToTrash('task', taskToDelete);
    }

    state.data.tasks.splice(idx, 1);
    state.data.tasks.forEach(t => {
        if (t.dependsOn && t.dependsOn.includes(id)) {
            t.dependsOn = t.dependsOn.filter(d => d !== id);
        }
    });
    triggerHaptic('medium');
    AppData.triggerSave(); 
    render(); 
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

function renderTaskBadges(t) {
    if (!t) return '';
    let badges = '';
    if (t.recurrence && t.recurrence !== 'none') {
        const recLabels = { daily: 'Ogni giorno', weekly: 'Settimanale', monthly: 'Mensile', yearly: 'Annuale' };
        badges += `<span class="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-purple-50 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300 border border-purple-200 dark:border-purple-800" title="Ricorrenza: ${recLabels[t.recurrence] || t.recurrence}">
            <i class="fas fa-redo-alt text-[8px]"></i>
            <span>${recLabels[t.recurrence] || t.recurrence}</span>
        </span>`;
    }
    if ((t.estimatedMinutes && t.estimatedMinutes > 0) || (t.spentMinutes && t.spentMinutes > 0)) {
        const isOver = t.spentMinutes > (t.estimatedMinutes || 0) && t.estimatedMinutes > 0;
        badges += `<span class="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-md ${isOver ? 'bg-rose-50 dark:bg-rose-900/40 text-rose-600 dark:text-rose-300 border border-rose-200 dark:border-rose-800' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'}" title="Tempo: ${t.spentMinutes||0}m spesi / ${t.estimatedMinutes||0}m stimati">
            <i class="far fa-clock text-[8px]"></i>
            <span>${t.spentMinutes||0}m/${t.estimatedMinutes||0}m</span>
        </span>`;
    }
    if (t.eisenhower && t.eisenhower !== 'auto') {
        const qColors = {
            q1: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border-red-200 dark:border-red-800',
            q2: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 dark:border-blue-800',
            q3: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800',
            q4: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700'
        };
        badges += `<span class="inline-flex items-center gap-0.5 text-[9px] font-black uppercase px-1.5 py-0.5 rounded border ${qColors[t.eisenhower] || ''}" title="Eisenhower: ${t.eisenhower.toUpperCase()}">
            ${t.eisenhower.toUpperCase()}
        </span>`;
    }
    if (t.startDate) {
        const isFuture = t.startDate > getISODate(new Date());
        badges += `<span class="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-md ${isFuture ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700'}" title="Attiva dal: ${formatDisplayDate(t.startDate)}">
            <i class="fas fa-hourglass-start text-[8px]"></i>
            <span>${isFuture ? 'Attiva dal ' : 'Dal '}${formatDisplayDate(t.startDate)}</span>
        </span>`;
    }
    return badges;
}
