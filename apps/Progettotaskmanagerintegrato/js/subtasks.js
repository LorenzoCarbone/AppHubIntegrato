// --- GESTIONE SOTTOTASK (Drag & Drop, Toggle, Visibilità tendina & Progress) ---
let draggedSubtaskId = null; 
let draggedSubtaskParentId = null;

function onSubtaskDragStart(e, taskId, stId) { 
    draggedSubtaskId = stId; 
    draggedSubtaskParentId = taskId; 
    e.dataTransfer.effectAllowed = 'move'; 
    setTimeout(() => e.target.classList.add('opacity-40'), 0); 
}

function onSubtaskDragEnd(e) { 
    e.target.classList.remove('opacity-40'); 
    draggedSubtaskId = null; 
    draggedSubtaskParentId = null; 
}

function onSubtaskDragOver(e) { 
    e.preventDefault(); 
    e.currentTarget.classList.add('bg-slate-200', 'dark:bg-slate-700'); 
}

function onSubtaskDragLeave(e) { 
    e.currentTarget.classList.remove('bg-slate-200', 'dark:bg-slate-700'); 
}

function onSubtaskDrop(e, taskId, targetStId) {
    e.preventDefault(); 
    e.currentTarget.classList.remove('bg-slate-200', 'dark:bg-slate-700');
    if (draggedSubtaskId === targetStId || draggedSubtaskParentId !== taskId) return;
    const t = state.data.tasks.find(x => x.id === taskId);
    if (!t || !t.subtasks) return;
    const draggedIdx = t.subtasks.findIndex(x => x.id === draggedSubtaskId);
    const targetIdx = t.subtasks.findIndex(x => x.id === targetStId);
    if(draggedIdx > -1 && targetIdx > -1) {
        const [item] = t.subtasks.splice(draggedIdx, 1);
        t.subtasks.splice(targetIdx, 0, item);
        AppData.triggerSave(); 
        render();
    }
}

function toggleSubtasksVisibility(taskId) {
    if (!state.ui.expandedTasks) state.ui.expandedTasks = {};
    state.ui.expandedTasks[taskId] = !state.ui.expandedTasks[taskId];
    render();
}

// Calcola e restituisce la progress bar grafica per le sottotask
function getSubtaskProgressHtml(task) {
    if (!task.subtasks || task.subtasks.length === 0) return '';
    const total = task.subtasks.length;
    const done = task.subtasks.filter(s => s.completed).length;
    const pct = Math.round((done / total) * 100);
    const colorClass = pct === 100 
        ? 'bg-emerald-500' 
        : pct >= 50 
            ? 'bg-blue-500' 
            : 'bg-amber-500';
    
    return `
        <div class="flex items-center gap-2 mt-1 w-full max-w-[220px]" title="${done}/${total} sottotask completate (${pct}%)">
            <div class="flex-1 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div class="${colorClass} h-full transition-all duration-300 rounded-full" style="width: ${pct}%;"></div>
            </div>
            <span class="text-[9px] font-bold text-slate-500 dark:text-slate-400 shrink-0">${done}/${total} (${pct}%)</span>
        </div>`;
}

// Subtask Togglers
function toggleSubtask(taskId, stId) { 
    const t = state.data.tasks.find(x => x.id === taskId); 
    if(!t || !t.subtasks) return;
    const st = t.subtasks.find(x => x.id === stId); 
    if(st) { 
        st.completed = !st.completed; 
        
        // Verifica se tutte le subtask sono completate e chiedi se completare anche la macro-task
        if (st.completed && t.subtasks.length > 0 && !t.completed) {
            const allDone = t.subtasks.every(s => s.completed);
            if (allDone) {
                if (confirm(`Tutte le ${t.subtasks.length} sottotask sono completate! Vuoi contrassegnare completata anche la macro-task "${t.title}"?`)) {
                    t.completed = true;
                    showToast("Macro-task completata!", "success");
                }
            }
        }
        
        AppData.triggerSave(); 
        render(); 
    } 
}

function updateSubtask(taskId, stId, val) { 
    const t = state.data.tasks.find(x => x.id === taskId); 
    const st = (t.subtasks||[]).find(x => x.id === stId); 
    if(st) { 
        st.title = val; 
        AppData.triggerSave(); 
        render(); 
    } 
}

function deleteSubtask(taskId, stId) { 
    const t = state.data.tasks.find(x => x.id === taskId); 
    if(t) { 
        t.subtasks = t.subtasks.filter(x => x.id !== stId); 
        AppData.triggerSave(); 
        render(); 
    } 
}

function addSubtask(taskId) { 
    const input = document.getElementById('newSt_' + taskId); 
    if(!input || !input.value.trim()) return; 
    const t = state.data.tasks.find(x => x.id === taskId); 
    if(t) { 
        if(!t.subtasks) t.subtasks = []; 
        t.subtasks.push({ id: 'st_'+Date.now(), title: input.value.trim(), completed: false }); 
        AppData.triggerSave(); 
        render(); 
    } 
}
