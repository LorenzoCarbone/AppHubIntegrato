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
    const maxOrderMobile = (state.data.tasks || []).reduce((max, x) => Math.max(max, x.order || 0), 0);
    state.data.tasks.push({ 
        id: 't_' + Date.now(), 
        title: parsed.title, 
        completed: false, 
        priority: finalPri, 
        dueDate: finalDate, 
        startDate: parsed.startDate || '',
        contextId: parsed.contextId, 
        order: maxOrderMobile + 10,
        subtasks: [] 
    });
    
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

// Helper di visualizzazione per data di scadenza
function getTaskLockAndDueHtml(t) {
    const dueStatus = getDueDateStatus(t.dueDate);
    let duePill = '';
    if (dueStatus) {
        duePill = `<span class="inline-flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded-md border shadow-2xs ${dueStatus.colorClass}" title="Scadenza: ${t.dueDate}"><i class="fas ${dueStatus.icon} text-[9px]"></i>${dueStatus.label}</span>`;
    }
    return {
        isBlocked: false,
        blockers: [],
        lockBadge: '',
        unlocksBadge: '',
        duePill
    };
}

function isTaskBlocked(task) {
    return false;
}

function getTaskBlockingReasons(task) {
    return [];
}

function getTaskDependencies(task) {
    return [];
}

function getTasksDependentOn(taskId) {
    return [];
}

function renderTaskDependencySection(t) {
    return '';
}

function addTask(cId) {
    if (window._justAppliedAutocomplete) return;
    const tIn = document.getElementById(`tIn_${cId||'g'}`);
    const ctxSelect = document.getElementById(`tCtx_${cId||'g'}`);
    if(!tIn.value.trim()) return;
    const finalCtx = ctxSelect ? ctxSelect.value : (cId || '');
    
    const parsed = parseSmartInput(tIn.value.trim(), finalCtx);
    const maxOrderCtx = (state.data.tasks || []).reduce((max, x) => Math.max(max, x.order || 0), 0);
    state.data.tasks.push({ 
        id: 't_' + Date.now(), 
        title: parsed.title, 
        completed: false, 
        priority: parsed.priority, 
        dueDate: parsed.date, 
        startDate: parsed.startDate || '',
        contextId: parsed.contextId, 
        order: maxOrderCtx + 10,
        subtasks: [] 
    });
    
    tIn.value = '';
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
    
    const maxOrderMobile = (state.data.tasks || []).reduce((max, x) => Math.max(max, x.order || 0), 0);
    state.data.tasks.push({ 
        id: 't_' + Date.now(), 
        title: parsed.title, 
        completed: false, 
        priority: finalPri, 
        dueDate: finalDate, 
        startDate: parsed.startDate || '',
        contextId: parsed.contextId, 
        order: maxOrderMobile + 10,
        subtasks: [] 
    });
    
    tIn.value = '';
    showToast("Task creata", "success");
    AppData.triggerSave(); render();
}

function toggleTask(id) { 
    const t = state.data.tasks.find(x => x.id === id); 
    if(!t) return; 

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
                    startDate: '',
                    contextId: t.contextId,
                    recurrence: { ...t.recurrence },
                    estimatedMinutes: t.estimatedMinutes || 0,
                    spentMinutes: 0,
                    subtasks: (t.subtasks || []).map(st => ({ id: 'st_' + Date.now() + '_' + Math.random().toString(36).substr(2, 3), title: st.title, completed: false }))
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
    try {
        const t = (state.data.tasks || []).find(x => String(x.id) === String(id));
        if (!t) return;
        const modal = document.getElementById('taskEditModal');
        if (!modal) return;

        const idEl = document.getElementById('temId');
        if (idEl) idEl.value = t.id;
        const titleEl = document.getElementById('temTitleInput');
        if (titleEl) titleEl.value = t.title || t.text || '';
        const priEl = document.getElementById('temPriority');
        if (priEl) priEl.value = t.priority !== undefined ? t.priority : 0;
        const dueEl = document.getElementById('temDueDate');
        if (dueEl) dueEl.value = t.dueDate || '';
        const startEl = document.getElementById('temStartDate');
        if (startEl) startEl.value = t.startDate || '';
        
        // Contesto
        const ctxSelect = document.getElementById('temContext');
        if (ctxSelect && typeof generateCtxOpts === 'function') {
            ctxSelect.innerHTML = generateCtxOpts(t.contextId);
        }
        
        // Ricorrenza
        const recEl = document.getElementById('temRecurrence');
        if (recEl) {
            let recVal = 'none';
            if (typeof t.recurrence === 'string') recVal = t.recurrence;
            else if (t.recurrence && t.recurrence.frequency) recVal = t.recurrence.frequency;
            recEl.value = recVal;
        }
        
        const notesEl = document.getElementById('temNotes');
        if (notesEl) notesEl.value = t.notes || '';
        
        // Subtasks
        if (typeof renderModalSubtasks === 'function') {
            renderModalSubtasks(t);
        }

        modal.classList.remove('hidden');
        modal.style.display = 'flex';
    } catch(err) {
        console.error("Error in openTaskModal:", err);
    }
}

function closeTaskModal() {
    const modal = document.getElementById('taskEditModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
    }
}

window.editTask = editTask;
window.openTaskModal = openTaskModal;
window.closeTaskModal = closeTaskModal;

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

    t.startDate = parsed.startDate || document.getElementById('temStartDate')?.value || '';

    const rec = document.getElementById('temRecurrence').value;
    t.recurrence = (rec === 'none') ? { frequency: 'none' } : { frequency: rec, interval: 1 };

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

function insertEditModalChip(text) {
    const input = document.getElementById('temTitleInput');
    if (!input) return;
    input.value = (input.value ? input.value + ' ' : '') + text + ' ';
    input.focus();
    if (typeof handleSmartInput === 'function') {
        handleSmartInput(input, 'editModal');
    }
}

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
    const taskToDelete = state.data.tasks[idx];
    lastDeletedTask = JSON.parse(JSON.stringify(taskToDelete));
    lastDeletedTaskIndex = idx;

    if (typeof moveToTrash === 'function') {
        moveToTrash('task', taskToDelete);
    }

    state.data.tasks.splice(idx, 1);
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
    clone.order = (t.order !== undefined ? t.order : 0) + 1;
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
    let recFreq = null;
    if (typeof t.recurrence === 'string' && t.recurrence !== 'none') {
        recFreq = t.recurrence;
    } else if (t.recurrence && typeof t.recurrence === 'object' && t.recurrence.frequency && t.recurrence.frequency !== 'none') {
        recFreq = t.recurrence.frequency;
    }
    if (recFreq) {
        const recLabels = { daily: 'Giornaliera', weekdays: 'Lun-Ven', weekly: 'Settimanale', monthly: 'Mensile', yearly: 'Annuale' };
        const recLabel = recLabels[recFreq] || recFreq;
        badges += `<span class="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-purple-50 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300 border border-purple-200 dark:border-purple-800" title="Ricorrenza: ${recLabel}">
            <i class="fas fa-redo-alt text-[8px]"></i>
            <span>${recLabel}</span>
        </span>`;
    }
    if ((t.estimatedMinutes && t.estimatedMinutes > 0) || (t.spentMinutes && t.spentMinutes > 0)) {
        const isOver = t.spentMinutes > (t.estimatedMinutes || 0) && t.estimatedMinutes > 0;
        badges += `<span class="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-md ${isOver ? 'bg-rose-50 dark:bg-rose-900/40 text-rose-600 dark:text-rose-300 border border-rose-200 dark:border-rose-800' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'}" title="Tempo: ${t.spentMinutes||0}m spesi / ${t.estimatedMinutes||0}m stimati">
            <i class="far fa-clock text-[8px]"></i>
            <span>${t.spentMinutes||0}m/${t.estimatedMinutes||0}m</span>
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

// --- GESTIONE DRAG & DROP E RIORDINAMENTO MANUALE DELLE TASK ---
let draggedTaskId = null;
let draggedTaskGroupName = null;

function onTaskDragStart(e, taskId, groupName) {
    draggedTaskId = taskId;
    draggedTaskGroupName = groupName;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', taskId);
    document.body.classList.add('is-dragging');
    const row = document.getElementById('taskRow_' + taskId);
    if (row) {
        setTimeout(() => row.classList.add('task-row-dragging'), 0);
    }
}

function onTaskDragEnd(e) {
    document.body.classList.remove('is-dragging');
    document.querySelectorAll('.task-drag-over-top, .task-drag-over-bottom').forEach(el => {
        el.classList.remove('task-drag-over-top', 'task-drag-over-bottom');
    });
    if (draggedTaskId) {
        const row = document.getElementById('taskRow_' + draggedTaskId);
        if (row) {
            row.classList.remove('task-row-dragging');
        }
    }
    draggedTaskId = null;
    draggedTaskGroupName = null;
}

function onTaskDragOver(e) {
    if (!draggedTaskId) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';

    const row = e.currentTarget;
    if (row.id === 'taskRow_' + draggedTaskId) return;

    const rect = row.getBoundingClientRect();
    const isTopHalf = (e.clientY - rect.top) < (rect.height / 2);

    if (isTopHalf) {
        row.classList.add('task-drag-over-top');
        row.classList.remove('task-drag-over-bottom');
    } else {
        row.classList.add('task-drag-over-bottom');
        row.classList.remove('task-drag-over-top');
    }
}

function onTaskDragLeave(e) {
    const row = e.currentTarget;
    row.classList.remove('task-drag-over-top', 'task-drag-over-bottom');
}

function onTaskDrop(e, targetTaskId, targetGroupName) {
    e.preventDefault();
    e.stopPropagation();

    const row = e.currentTarget;
    row.classList.remove('task-drag-over-top', 'task-drag-over-bottom');
    document.body.classList.remove('is-dragging');

    if (!draggedTaskId || draggedTaskId === targetTaskId) {
        onTaskDragEnd(e);
        return;
    }

    const rect = row.getBoundingClientRect();
    const dropBefore = (e.clientY - rect.top) < (rect.height / 2);

    const draggedTask = (state.data.tasks || []).find(t => t.id === draggedTaskId);
    const targetTask = (state.data.tasks || []).find(t => t.id === targetTaskId);
    if (!draggedTask || !targetTask) {
        onTaskDragEnd(e);
        return;
    }

    const listConf = tmListSettings[state.ui.tmView] || { groupBy: 'priority', sortBy: 'priority' };

    // Se spostata tra gruppi diversi (es. da P2 a P3), adegua la proprietà corrispondente
    if (listConf.groupBy === 'priority') {
        draggedTask.priority = targetTask.priority;
    } else if (listConf.groupBy === 'date') {
        draggedTask.dueDate = targetTask.dueDate;
    }

    // Assicura che ogni task abbia un order numerico
    state.data.tasks.forEach((t, i) => {
        if (typeof t.order !== 'number' || isNaN(t.order)) t.order = i * 10;
    });

    // Isola il gruppo di task pertinente
    let groupTasks = [];
    if (listConf.groupBy === 'priority') {
        groupTasks = state.data.tasks.filter(t => t.priority === targetTask.priority && t.completed === targetTask.completed);
    } else if (listConf.groupBy === 'date') {
        const todayStr = getISODate(new Date());
        if (!targetTask.dueDate) {
            groupTasks = state.data.tasks.filter(t => !t.dueDate && t.completed === targetTask.completed);
        } else if (targetTask.dueDate === todayStr) {
            groupTasks = state.data.tasks.filter(t => t.dueDate === todayStr && t.completed === targetTask.completed);
        } else {
            groupTasks = state.data.tasks.filter(t => t.dueDate && t.dueDate !== todayStr && t.completed === targetTask.completed);
        }
    } else {
        groupTasks = state.data.tasks.filter(t => t.completed === targetTask.completed);
    }

    // Ordina il gruppo secondo il loro ordine attuale
    groupTasks.sort((a, b) => (a.order || 0) - (b.order || 0));

    // Rimuovi draggedTask dal gruppo
    groupTasks = groupTasks.filter(t => t.id !== draggedTaskId);

    // Inserisci draggedTask nella nuova posizione prima o dopo targetTask
    const targetIdx = groupTasks.findIndex(t => t.id === targetTaskId);
    if (targetIdx !== -1) {
        const insertIdx = dropBefore ? targetIdx : targetIdx + 1;
        groupTasks.splice(insertIdx, 0, draggedTask);
    } else {
        groupTasks.push(draggedTask);
    }

    // Riassegna valori di order sequenziali puliti (0, 10, 20...)
    groupTasks.forEach((t, idx) => {
        t.order = idx * 10;
    });

    AppData.triggerSave();
    onTaskDragEnd(e);
    render();
    showToast("Posizione task salvata", "info");
}

function onTaskGroupDragOver(e) {
    if (!draggedTaskId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
}

function onTaskGroupDragLeave(e) {
    // No-op
}

function onTaskGroupDrop(e, groupName) {
    e.preventDefault();
    document.body.classList.remove('is-dragging');

    if (!draggedTaskId) return;
    const draggedTask = (state.data.tasks || []).find(t => t.id === draggedTaskId);
    if (!draggedTask) {
        onTaskDragEnd(e);
        return;
    }

    const listConf = tmListSettings[state.ui.tmView] || { groupBy: 'priority', sortBy: 'priority' };

    // Se rilasciato sullo sfondo del gruppo
    if (listConf.groupBy === 'priority') {
        if (groupName === 'Alta') draggedTask.priority = 3;
        else if (groupName === 'Media') draggedTask.priority = 2;
        else if (groupName === 'Bassa') draggedTask.priority = 1;
        else if (groupName === 'Nessuna') draggedTask.priority = 0;
    } else if (listConf.groupBy === 'date') {
        const todayStr = getISODate(new Date());
        if (groupName === 'Oggi') draggedTask.dueDate = todayStr;
        else if (groupName === 'Senza Data') draggedTask.dueDate = '';
        else if (groupName === 'Prossimamente') {
            if (!draggedTask.dueDate || draggedTask.dueDate === todayStr) {
                const tmr = new Date();
                tmr.setDate(tmr.getDate() + 1);
                draggedTask.dueDate = getISODate(tmr);
            }
        }
    }

    // Posiziona in fondo al gruppo corrispondente
    let groupTasks = [];
    if (listConf.groupBy === 'priority') {
        groupTasks = state.data.tasks.filter(t => t.priority === draggedTask.priority && !t.completed && t.id !== draggedTaskId);
    } else if (listConf.groupBy === 'date') {
        const todayStr = getISODate(new Date());
        if (!draggedTask.dueDate) {
            groupTasks = state.data.tasks.filter(t => !t.dueDate && !t.completed && t.id !== draggedTaskId);
        } else if (draggedTask.dueDate === todayStr) {
            groupTasks = state.data.tasks.filter(t => t.dueDate === todayStr && !t.completed && t.id !== draggedTaskId);
        } else {
            groupTasks = state.data.tasks.filter(t => t.dueDate && t.dueDate !== todayStr && !t.completed && t.id !== draggedTaskId);
        }
    } else {
        groupTasks = state.data.tasks.filter(t => !t.completed && t.id !== draggedTaskId);
    }

    const maxOrder = groupTasks.reduce((max, t) => Math.max(max, t.order || 0), 0);
    draggedTask.order = maxOrder + 10;

    AppData.triggerSave();
    onTaskDragEnd(e);
    render();
    showToast("Task spostata", "info");
}

window.onTaskDragStart = onTaskDragStart;
window.onTaskDragEnd = onTaskDragEnd;
window.onTaskDragOver = onTaskDragOver;
window.onTaskDragLeave = onTaskDragLeave;
window.onTaskDrop = onTaskDrop;
window.onTaskGroupDragOver = onTaskGroupDragOver;
window.onTaskGroupDragLeave = onTaskGroupDragLeave;
window.onTaskGroupDrop = onTaskGroupDrop;
