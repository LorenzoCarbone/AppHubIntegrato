// --- GESTIONE CALENDARIO & TIME BLOCKING ---

// Navigazione a scorrimento giorno per giorno (supporta swipe su mobile)
function stepCalDay(direction) {
    let curr = state.ui.calSelectedDate ? new Date(state.ui.calSelectedDate) : new Date();
    curr.setDate(curr.getDate() + direction);
    state.ui.calSelectedDate = getISODate(curr);
    
    // Controlla se la nuova data è all'interno della finestra di giorni caricata
    let baseDate = state.ui.calAnchorDate ? new Date(state.ui.calAnchorDate) : new Date();
    let minD = new Date(baseDate); minD.setDate(baseDate.getDate() - 1);
    let maxD = new Date(baseDate); maxD.setDate(baseDate.getDate() + 5);
    
    if (curr < minD || curr > maxD) {
        state.ui.calAnchorDate = state.ui.calSelectedDate;
    }
    render();
}

// Dialog modale/bottom-sheet per eventi ciclici (Modifica/Elimina istanza singola vs intera serie)
function openRecurringActionDialog({ title, message, isDelete = false, singleLabel, seriesLabel, onSingle, onSeries }) {
    const modal = document.getElementById('recurringChoiceModal');
    if (!modal) {
        if (confirm(`${title}\n\n${message}\n\nPremi OK per: ${singleLabel}\nPremi ANNULLA per: ${seriesLabel}`)) {
            if (typeof onSingle === 'function') onSingle();
        } else {
            if (typeof onSeries === 'function') onSeries();
        }
        return;
    }
    
    document.getElementById('rcmTitle').innerText = title || "Evento Ricorrente";
    document.getElementById('rcmMessage').innerText = message || "";
    document.getElementById('rcmSingleBtnText').innerText = singleLabel || "Solo per questa data";
    document.getElementById('rcmSeriesBtnText').innerText = seriesLabel || "Per tutta la serie";
    
    const iconEl = document.getElementById('rcmIcon');
    const iconCont = document.getElementById('rcmIconContainer');
    const singleBtn = document.getElementById('rcmSingleBtn');
    
    if (isDelete) {
        if (iconEl) iconEl.className = "fas fa-trash-alt text-base";
        if (iconCont) iconCont.className = "w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0";
        if (singleBtn) singleBtn.className = "w-full py-3 px-4 rounded-xl font-bold text-sm bg-red-600 hover:bg-red-700 text-white shadow-sm transition flex items-center justify-center gap-2 active:scale-98";
    } else {
        if (iconEl) iconEl.className = "fas fa-sync-alt text-base";
        if (iconCont) iconCont.className = "w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0";
        if (singleBtn) singleBtn.className = "w-full py-3 px-4 rounded-xl font-bold text-sm bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition flex items-center justify-center gap-2 active:scale-98";
    }
    
    if (singleBtn) {
        singleBtn.onclick = () => {
            closeRecurringChoiceModal();
            if (typeof onSingle === 'function') onSingle();
        };
    }
    const seriesBtn = document.getElementById('rcmSeriesBtn');
    if (seriesBtn) {
        seriesBtn.onclick = () => {
            closeRecurringChoiceModal();
            if (typeof onSeries === 'function') onSeries();
        };
    }
    
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function closeRecurringChoiceModal() {
    const modal = document.getElementById('recurringChoiceModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

// Drag & Drop Calendario tra giorni
let draggedCalBlockId = null;
let draggedCalBlockDate = null;

function onCalBlockDragStart(e, blockId, dateStr) {
    draggedCalBlockId = blockId;
    draggedCalBlockDate = dateStr;
    try {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', blockId);
        e.dataTransfer.setData('sourceDate', dateStr);
        setTimeout(() => {
            if(e.target) e.target.classList.add('opacity-40');
        }, 10);
    } catch(err) {}
}

function onCalBlockDragEnd(e) {
    if(e.target) e.target.classList.remove('opacity-40');
    document.querySelectorAll('.cal-day-over').forEach(el => el.classList.remove('cal-day-over'));
    draggedCalBlockId = null;
    draggedCalBlockDate = null;
}

function onCalDayDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    try {
        e.dataTransfer.dropEffect = 'move';
    } catch(err) {}
    const col = e.currentTarget.closest('.calendar-col') || e.currentTarget;
    if (col && !col.classList.contains('cal-day-over')) {
        col.classList.add('cal-day-over');
    }
}

function onCalDayDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    const col = e.currentTarget.closest('.calendar-col') || e.currentTarget;
    if (col && (!e.relatedTarget || !col.contains(e.relatedTarget))) {
        col.classList.remove('cal-day-over');
    }
}

function onCalDayDrop(e, targetDateStr) {
    e.preventDefault();
    e.stopPropagation();
    document.querySelectorAll('.cal-day-over').forEach(el => el.classList.remove('cal-day-over'));
    
    let blockId = draggedCalBlockId;
    let sourceDate = draggedCalBlockDate;
    try {
        if (!blockId && e.dataTransfer) blockId = e.dataTransfer.getData('text/plain');
        if (!sourceDate && e.dataTransfer) sourceDate = e.dataTransfer.getData('sourceDate');
    } catch(err) {}

    if (!blockId || !targetDateStr) return;
    if (sourceDate === targetDateStr) {
        showToast("Il blocco si trova già in questa data", "info");
        return;
    }

    const b = state.data.calendarBlocks.find(x => x.id === blockId);
    if (!b) return;

    if (b.isRecurring) {
        if (!confirm("Questo blocco è ciclico/ricorrente. Vuoi spostare la data di riferimento a " + formatDisplayDate(targetDateStr) + "?")) {
            return;
        }
    }

    b.date = targetDateStr;
    AppData.triggerSave();
    render();
    showToast("Blocco spostato al " + formatDisplayDate(targetDateStr), "success");
    
    draggedCalBlockId = null;
    draggedCalBlockDate = null;
}

function initBlockResize(e, blockId) {
    e.stopPropagation();
    e.preventDefault();
    const b = state.data.calendarBlocks.find(x => x.id === blockId);
    if (!b) return;

    const startY = e.clientY;
    const [startH, startM] = (b.endTime || b.startTime || '12:00').split(':').map(Number);
    const startTotalMins = (startH * 60) + (startM || 0);
    const [origStartH, origStartM] = (b.startTime || '09:00').split(':').map(Number);
    const origStartTotalMins = (origStartH * 60) + (origStartM || 0);

    const onMouseMove = (moveEv) => {
        const deltaPx = moveEv.clientY - startY;
        let newEndMins = startTotalMins + deltaPx;
        newEndMins = Math.round(newEndMins / 15) * 15;
        if (newEndMins <= origStartTotalMins + 15) newEndMins = origStartTotalMins + 15;
        if (newEndMins > 24 * 60) newEndMins = 24 * 60;

        const h = Math.floor(newEndMins / 60);
        const m = newEndMins % 60;
        b.endTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        render();
    };

    const onMouseUp = () => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        AppData.triggerSave();
        showToast(`Durata aggiornata: ${b.startTime} - ${b.endTime}`, "success");
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
}

// Modale Note del Blocco (Spazio ampio per appunti)
let currentBlockNotesId = null;

function openBlockNotesModal(blockId) {
    currentBlockNotesId = blockId;
    const b = state.data.calendarBlocks.find(x => x.id === blockId);
    if (!b) return;

    const titleEl = document.getElementById('bnmTitle');
    const subEl = document.getElementById('bnmSubtitle');
    const areaEl = document.getElementById('bnmNotesArea');
    const modal = document.getElementById('blockNotesModal');

    if (titleEl) titleEl.innerHTML = '<i class="fas fa-sticky-note text-amber-500 mr-2.5"></i> Note: ' + b.title;
    if (subEl) subEl.innerText = formatDisplayDate(b.date) + ' | ' + b.startTime + (b.endTime ? ' - ' + b.endTime : '');
    if (areaEl) areaEl.value = b.notes || '';
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        setTimeout(() => areaEl && areaEl.focus(), 100);
    }
}

function closeBlockNotesModal() {
    currentBlockNotesId = null;
    const modal = document.getElementById('blockNotesModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

function saveBlockNotesModal() {
    if (!currentBlockNotesId) return;
    const b = state.data.calendarBlocks.find(x => x.id === currentBlockNotesId);
    if (b) {
        const areaEl = document.getElementById('bnmNotesArea');
        b.notes = areaEl ? areaEl.value.trim() : '';
        AppData.triggerSave();
        render();
        showToast("Note del blocco salvate", "success");
    }
    closeBlockNotesModal();
}

// Navigazione settimane calendario
function changeCalWeek(offsetDays) {
    let curr = state.ui.calAnchorDate ? new Date(state.ui.calAnchorDate) : new Date();
    curr.setDate(curr.getDate() + offsetDays);
    state.ui.calAnchorDate = getISODate(curr);
    state.ui.calSelectedDate = state.ui.calAnchorDate;
    render();
}

function resetCalWeek() {
    state.ui.calAnchorDate = null;
    state.ui.calSelectedDate = getISODate(new Date());
    render();
}

// Impostazione rapida durata blocco (+15m, +30m, +1h, +2h)
function addBlockDuration(minutes) {
    const startEl = document.getElementById('bmStart');
    const endEl = document.getElementById('bmEnd');
    if (!startEl || !endEl) return;
    let base = startEl.value || '09:00';
    let parts = base.split(':').map(Number);
    let h = isNaN(parts[0]) ? 9 : parts[0];
    let m = isNaN(parts[1]) ? 0 : parts[1];
    let totalMins = h * 60 + m + minutes;
    let newH = Math.min(23, Math.floor(totalMins / 60));
    let newM = totalMins % 60;
    endEl.value = `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
}

// Rilevamento sovrapposizione tra blocchi nello stesso giorno
function getBlockOverlaps(block, dayBlocks) {
    if (!block || !block.startTime || !block.endTime) return [];
    return dayBlocks.filter(other => {
        if (!other || other.id === block.id) return false;
        if (!other.startTime || !other.endTime) return false;
        return (block.startTime < other.endTime && block.endTime > other.startTime);
    });
}

function isBlockOnDate(block, dateStr) {
    if (block.isGcal) return block.date === dateStr; 
    
    // Controlla se questa specifica data è stata esclusa / modificata singolarmente
    if (block.excludedDates && Array.isArray(block.excludedDates) && block.excludedDates.includes(dateStr)) {
        return false;
    }
    
    if (!block.isRecurring) {
        return block.date === dateStr;
    }
    // Recurring logic
    if (dateStr < block.date) return false; 
    
    const targetDate = new Date(dateStr);
    const startDate = new Date(block.date);

    if (block.recurrence.type === 'daily') return true;
    if (block.recurrence.type === 'weekly') {
        return block.recurrence.days.includes(targetDate.getDay());
    }
    if (block.recurrence.type === 'interval') {
        const diffTime = Math.abs(targetDate - startDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
        return diffDays % block.recurrence.interval === 0;
    }
    return false;
}

        function toggleBlockTypeFields() {
            const type = document.getElementById('bmType').value;
            if(type === 'simple') {
                document.getElementById('bmSimpleArea').classList.remove('hidden');
                document.getElementById('bmTaskArea').classList.add('hidden');
            } else {
                document.getElementById('bmSimpleArea').classList.add('hidden');
                document.getElementById('bmTaskArea').classList.remove('hidden');
            }
        }

        function toggleRecurrenceFields() {
            const isRec = document.getElementById('bmIsRecurring').checked;
            const area = document.getElementById('bmRecurrenceArea');
            if(isRec) area.classList.remove('hidden'); else area.classList.add('hidden');
        }

        function toggleRecurrenceDetails() {
            const rType = document.getElementById('bmRecType').value;
            document.getElementById('bmRecWeekly').classList.add('hidden');
            document.getElementById('bmRecInterval').classList.add('hidden');
            if(rType === 'weekly') document.getElementById('bmRecWeekly').classList.remove('hidden');
            if(rType === 'interval') document.getElementById('bmRecInterval').classList.remove('hidden');
        }

let currentBlockModalSelectedIds = new Set();

function updateBlockModalSelectedCount() {
    const el = document.getElementById('bmSelectedTasksCount');
    if (el) el.innerText = `${currentBlockModalSelectedIds.size} selezionate`;
}

function toggleBlockTaskSelection(taskId, isChecked) {
    if (isChecked) currentBlockModalSelectedIds.add(taskId);
    else currentBlockModalSelectedIds.delete(taskId);
    updateBlockModalSelectedCount();
}

function renderBlockModalTaskList(searchQuery = '') {
    const listEl = document.getElementById('bmTaskAreaList');
    if (!listEl) return;
    
    // Mostra solo task attive non completate (o quelle già selezionate in precedenza per questo blocco)
    let tasks = state.data.tasks.filter(t => !t.completed || currentBlockModalSelectedIds.has(t.id));
    
    if (searchQuery && searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        tasks = tasks.filter(t => {
            const titleMatch = t.title && t.title.toLowerCase().includes(q);
            const ctx = getContextInfo(t.contextId);
            const ctxMatch = ctx && ctx.name && ctx.name.toLowerCase().includes(q);
            return titleMatch || ctxMatch;
        });
    }

    if (tasks.length === 0) {
        listEl.innerHTML = `<p class="text-xs text-slate-400 italic p-3 text-center">Nessuna task attiva trovata ${searchQuery ? 'per "' + searchQuery + '"' : ''}.</p>`;
        updateBlockModalSelectedCount();
        return;
    }

    // Raggruppa ordinatamente per contesto
    const grouped = {};
    tasks.forEach(t => {
        const key = t.contextId || 'inbox';
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(t);
    });

    let html = '';
    for (const [key, groupTasks] of Object.entries(grouped)) {
        const ctx = getContextInfo(key === 'inbox' ? '' : key);
        html += `
            <div class="mb-2">
                <div class="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1 py-0.5 flex items-center gap-1.5 border-b border-slate-200 dark:border-slate-700 mb-1">
                    <i class="fas ${ctx.icon || 'fa-folder'}" style="color:${ctx.color || '#94a3b8'}"></i>
                    <span>${ctx.name || 'Posta in arrivo / Senza contesto'}</span>
                </div>
                <div class="space-y-1">`;
        groupTasks.forEach(t => {
            const isChecked = currentBlockModalSelectedIds.has(t.id);
            let priClass = 'border-slate-300 dark:border-slate-600';
            if (t.priority === 3) priClass = '!border-red-400 checked:!bg-red-500 text-red-500';
            else if (t.priority === 2) priClass = '!border-amber-400 checked:!bg-amber-500 text-amber-500';
            else if (t.priority === 1) priClass = '!border-blue-400 checked:!bg-blue-500 text-blue-500';

            html += `
                <label class="flex items-center gap-2.5 p-1.5 px-2 hover:bg-slate-100 dark:hover:bg-slate-700/60 rounded-lg cursor-pointer transition border border-transparent hover:border-slate-200 dark:hover:border-slate-600">
                    <input type="checkbox" class="bm-task-chk w-4 h-4 rounded ${priClass} focus:ring-blue-500 shrink-0" 
                           value="${t.id}" ${isChecked ? 'checked' : ''} 
                           onchange="toggleBlockTaskSelection('${t.id}', this.checked)">
                    <div class="flex-1 min-w-0">
                        <p class="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate leading-tight">${t.title}</p>
                        ${t.dueDate ? `<span class="text-[9px] text-slate-400 font-normal"><i class="far fa-calendar-alt text-[8px] mr-0.5"></i>${formatDisplayDate(t.dueDate)}</span>` : ''}
                    </div>
                </label>`;
        });
        html += `</div></div>`;
    }
    listEl.innerHTML = html;
    updateBlockModalSelectedCount();
    return html;
}

        function openBlockModal(id = null, dateStr = null) {
            blockEditId = id;
            blockEditDate = dateStr || getISODate(new Date());

            const modal = document.getElementById('blockModal');
            modal.classList.remove('hidden'); modal.classList.add('flex');

            const recNotice = document.getElementById('bmRecurringNotice');

            if (id) {
                const b = state.data.calendarBlocks.find(x => x.id === id);
                if(!b) return;
                currentBlockModalSelectedIds = new Set(b.taskIds || (b.taskId ? [b.taskId] : []));
                document.getElementById('bmTitle').innerHTML = '<i class="fas fa-edit text-blue-500 mr-2"></i> Modifica Blocco';
                document.getElementById('bmType').value = b.type;
                document.getElementById('bmCat').value = b.category || 'focus';
                document.getElementById('bmStart').value = b.startTime;
                document.getElementById('bmEnd').value = b.endTime;
                document.getElementById('bmDate').value = b.isRecurring ? blockEditDate : b.date; 
                document.getElementById('bmNotes').value = b.notes || '';
                
                if (b.type === 'simple') {
                    document.getElementById('bmTextTitle').value = b.title;
                }

                document.getElementById('bmIsRecurring').checked = b.isRecurring;
                if(b.isRecurring && b.recurrence) {
                    document.getElementById('bmRecType').value = b.recurrence.type;
                    if(b.recurrence.type === 'weekly') {
                        document.querySelectorAll('.bm-day-chk').forEach(chk => {
                            chk.checked = b.recurrence.days.includes(parseInt(chk.value));
                        });
                    }
                    if(b.recurrence.type === 'interval') document.getElementById('bmIntervalNum').value = b.recurrence.interval;
                }

                if (recNotice) {
                    if (b.isRecurring) {
                        recNotice.innerHTML = `
                            <div class="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs font-semibold flex items-center justify-between">
                                <span class="flex items-center gap-1.5"><i class="fas fa-sync-alt text-blue-500"></i> Evento ciclico — Data selezionata: <b>${formatDisplayDate(blockEditDate)}</b></span>
                            </div>`;
                        recNotice.classList.remove('hidden');
                    } else {
                        recNotice.classList.add('hidden');
                    }
                }

                document.getElementById('bmDeleteBtn').classList.remove('hidden');
                const dupBtn = document.getElementById('bmDuplicateBtn'); if (dupBtn) dupBtn.classList.remove('hidden');
            } else {
                currentBlockModalSelectedIds = new Set();
                document.getElementById('bmTitle').innerHTML = '<i class="fas fa-plus-circle text-blue-500 mr-2"></i> Nuovo Blocco';
                document.getElementById('bmType').value = 'simple';
                document.getElementById('bmCat').value = 'focus';
                document.getElementById('bmTextTitle').value = '';
                document.getElementById('bmNotes').value = '';
                document.getElementById('bmStart').value = '09:00';
                document.getElementById('bmEnd').value = '10:00';
                document.getElementById('bmDate').value = blockEditDate;
                
                document.getElementById('bmIsRecurring').checked = false;
                document.getElementById('bmRecType').value = 'daily';
                document.querySelectorAll('.bm-day-chk').forEach(c => c.checked = false);
                document.getElementById('bmIntervalNum').value = '2';
                
                if (recNotice) recNotice.classList.add('hidden');

                document.getElementById('bmDeleteBtn').classList.add('hidden');
                const dupBtn = document.getElementById('bmDuplicateBtn'); if (dupBtn) dupBtn.classList.add('hidden');
            }

            const sInput = document.getElementById('bmTaskSearch');
            if (sInput) sInput.value = '';
            renderBlockModalTaskList('');

            toggleBlockTypeFields();
            toggleRecurrenceFields();
            toggleRecurrenceDetails();
        }

        function closeBlockModal() {
            document.getElementById('blockModal').classList.add('hidden');
            document.getElementById('blockModal').classList.remove('flex');
        }

        function saveBlock() {
            const type = document.getElementById('bmType').value;
            const category = document.getElementById('bmCat').value;
            const start = document.getElementById('bmStart').value;
            const end = document.getElementById('bmEnd').value;
            const date = document.getElementById('bmDate').value;
            const isRec = document.getElementById('bmIsRecurring').checked;
            const notes = document.getElementById('bmNotes').value.trim();
            
            let title = "", taskIds = [];
            if(type === 'simple') {
                title = document.getElementById('bmTextTitle').value.trim();
                if(!title) { showToast("Inserisci cosa devi fare", "error"); return; }
            } else {
                taskIds = Array.from(currentBlockModalSelectedIds);
                if(taskIds.length === 0) { showToast("Seleziona almeno una task", "error"); return; }
                if (taskIds.length === 1) {
                    const t = state.data.tasks.find(x => x.id === taskIds[0]);
                    title = t ? t.title : 'Task sconosciuta';
                } else {
                    title = `${taskIds.length} Task collegate`;
                }
            }

            if(!start || !end || !date) { showToast("Compila orari e date", "error"); return; }
            if(start >= end) { showToast("L'orario di fine deve essere dopo l'inizio", "error"); return; }

            let recurrenceObj = null;
            if(isRec) {
                const rType = document.getElementById('bmRecType').value;
                recurrenceObj = { type: rType };
                if(rType === 'weekly') {
                    let days = [];
                    document.querySelectorAll('.bm-day-chk').forEach(c => { if(c.checked) days.push(parseInt(c.value)) });
                    if(days.length === 0) { showToast("Seleziona almeno un giorno per la ripetizione settimanale", "error"); return; }
                    recurrenceObj.days = days;
                } else if(rType === 'interval') {
                    const intv = parseInt(document.getElementById('bmIntervalNum').value);
                    if(intv < 1 || isNaN(intv)) { showToast("Intervallo non valido", "error"); return; }
                    recurrenceObj.interval = intv;
                }
            }

            const payload = { title, type, taskId: taskIds[0], taskIds, category, startTime: start, endTime: end, date, isRecurring: isRec, recurrence: recurrenceObj, notes };

            if(blockEditId) {
                let b = state.data.calendarBlocks.find(x => x.id === blockEditId);
                if(b) {
                    if (b.isRecurring) {
                        openRecurringActionDialog({
                            title: "Modifica Blocco Ciclico",
                            message: `Questo blocco si ripete nel calendario. Vuoi applicare le modifiche solo alla data del ${formatDisplayDate(blockEditDate)} oppure a tutte le date della serie ciclica?`,
                            singleLabel: `Solo per oggi (${formatDisplayDate(blockEditDate)})`,
                            seriesLabel: `Per tutta la serie ciclica`,
                            isDelete: false,
                            onSingle: () => {
                                if (!b.excludedDates) b.excludedDates = [];
                                if (!b.excludedDates.includes(blockEditDate)) {
                                    b.excludedDates.push(blockEditDate);
                                }
                                const singleBlock = {
                                    id: 'cb_' + Date.now(),
                                    ...payload,
                                    date: blockEditDate,
                                    isRecurring: false,
                                    recurrence: null,
                                    completedDates: [],
                                    excludedDates: []
                                };
                                state.data.calendarBlocks.push(singleBlock);
                                closeBlockModal();
                                AppData.triggerSave();
                                render();
                                showToast(`Occorrenza del ${formatDisplayDate(blockEditDate)} salvata come blocco singolo`, "success");
                            },
                            onSeries: () => {
                                Object.assign(b, payload);
                                closeBlockModal();
                                AppData.triggerSave();
                                render();
                                showToast("Intera serie ciclica modificata con successo", "success");
                            }
                        });
                        return;
                    } else {
                        Object.assign(b, payload);
                        showToast("Blocco modificato", "success");
                    }
                }
            } else {
                state.data.calendarBlocks.push({ id: 'cb_'+Date.now(), ...payload, completedDates: [], excludedDates: [] });
                showToast("Blocco aggiunto", "success");
            }

            closeBlockModal(); AppData.triggerSave(); render();
        }

let lastDeletedBlock = null;
let lastDeletedBlockIndex = -1;

function deleteBlock() {
    if(!blockEditId) return;
    const b = state.data.calendarBlocks.find(x => x.id === blockEditId);
    if (!b) return;

    if (b.isRecurring) {
        openRecurringActionDialog({
            title: "Elimina Blocco Ciclico",
            message: `Questo blocco fa parte di una serie ciclica. Vuoi eliminare solo l'occorrenza del ${formatDisplayDate(blockEditDate)} oppure eliminare l'intera serie ciclica?`,
            singleLabel: `Elimina solo per il ${formatDisplayDate(blockEditDate)}`,
            seriesLabel: `Elimina l'intera serie ciclica`,
            isDelete: true,
            onSingle: () => {
                if (!b.excludedDates) b.excludedDates = [];
                if (!b.excludedDates.includes(blockEditDate)) {
                    b.excludedDates.push(blockEditDate);
                }
                closeBlockModal();
                AppData.triggerSave();
                render();
                showToast(`Occorrenza del ${formatDisplayDate(blockEditDate)} rimossa dalla serie`, "info");
            },
            onSeries: () => {
                const idx = state.data.calendarBlocks.findIndex(x => x.id === blockEditId);
                if (idx !== -1) {
                    lastDeletedBlock = JSON.parse(JSON.stringify(state.data.calendarBlocks[idx]));
                    lastDeletedBlockIndex = idx;
                    if (typeof moveToTrash === 'function') moveToTrash('block', state.data.calendarBlocks[idx]);
                    state.data.calendarBlocks.splice(idx, 1);
                    closeBlockModal();
                    triggerHaptic('medium');
                    AppData.triggerSave();
                    render();
                }
            }
        });
        return;
    }

    const idx = state.data.calendarBlocks.findIndex(b => b.id === blockEditId);
    if (idx === -1) return;
    lastDeletedBlock = JSON.parse(JSON.stringify(state.data.calendarBlocks[idx]));
    lastDeletedBlockIndex = idx;

    if (typeof moveToTrash === 'function') moveToTrash('block', state.data.calendarBlocks[idx]);
    state.data.calendarBlocks.splice(idx, 1);
    closeBlockModal();
    triggerHaptic('medium');
    AppData.triggerSave();
    render();
}

function undoDeleteBlock() {
    if (!lastDeletedBlock) return;
    const blockToRestore = lastDeletedBlock;
    lastDeletedBlock = null;
    const insertAt = (lastDeletedBlockIndex >= 0 && lastDeletedBlockIndex <= state.data.calendarBlocks.length) ? lastDeletedBlockIndex : state.data.calendarBlocks.length;
    state.data.calendarBlocks.splice(insertAt, 0, blockToRestore);
    AppData.triggerSave();
    render();
    showToast("Blocco ripristinato con successo!", "success");
}

function duplicateBlock(id = null) {
    const targetId = id || blockEditId;
    if (!targetId) return;
    const b = state.data.calendarBlocks.find(x => x.id === targetId);
    if (!b) return;
    const clone = JSON.parse(JSON.stringify(b));
    clone.id = 'b_' + Date.now();
    clone.title = clone.title + ' (Copia)';
    state.data.calendarBlocks.push(clone);
    if (blockEditId) closeBlockModal();
    AppData.triggerSave();
    render();
    showToast("Blocco duplicato con successo", "success");
}

        function toggleBlockCompleted(id, dateStr) {
            // Check Google Calendar specifici
            if(id.startsWith('gcal_')) {
                if(!state.data.gcalCompleted) state.data.gcalCompleted = [];
                const key = id + '_' + dateStr;
                const idx = state.data.gcalCompleted.indexOf(key);
                if(idx > -1) state.data.gcalCompleted.splice(idx, 1);
                else state.data.gcalCompleted.push(key);
                AppData.triggerSave(); render();
                return;
            }

            const b = state.data.calendarBlocks.find(x => x.id === id);
            if(!b) return;
            
            if(!b.completedDates) b.completedDates = [];
            const idx = b.completedDates.indexOf(dateStr);
            if(idx > -1) {
                b.completedDates.splice(idx, 1);
            } else {
                b.completedDates.push(dateStr);
                // Completa tutte le task associate se non è ricorrente
                if(b.type === 'task' && !b.isRecurring) {
                    const tIds = b.taskIds || (b.taskId ? [b.taskId] : []);
                    let tasksCompleted = 0;
                    tIds.forEach(tid => {
                        const t = state.data.tasks.find(x => x.id === tid);
                        if(t && !t.completed) { t.completed = true; tasksCompleted++; }
                    });
                    if(tasksCompleted > 0) showToast(`${tasksCompleted} task marcate completate`, "success");
                }
            }
            AppData.triggerSave(); render();
        }

        function renderCalendar() {
            let daysArr = [];
            let baseDate = state.ui.calAnchorDate ? new Date(state.ui.calAnchorDate) : new Date();
            for(let i = -1; i <= 5; i++) {
                let d = new Date(baseDate);
                d.setDate(baseDate.getDate() + i);
                daysArr.push(getISODate(d));
            }

            if(!daysArr.includes(state.ui.calSelectedDate)) state.ui.calSelectedDate = daysArr[1]; 

            const realTodayStr = getISODate(new Date());
            const dStart = new Date(daysArr[0]);
            const dEnd = new Date(daysArr[6]);
            const monthList = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
            const startMonth = monthList[dStart.getMonth()];
            const endMonth = monthList[dEnd.getMonth()];
            const startYear = dStart.getFullYear();
            const endYear = dEnd.getFullYear();

            let weekRangeLabel = '';
            if (startMonth === endMonth && startYear === endYear) {
                weekRangeLabel = `${dStart.getDate()} - ${dEnd.getDate()} ${endMonth} ${endYear}`;
            } else if (startYear === endYear) {
                weekRangeLabel = `${dStart.getDate()} ${startMonth} - ${dEnd.getDate()} ${endMonth} ${endYear}`;
            } else {
                weekRangeLabel = `${dStart.getDate()} ${startMonth} ${startYear} - ${dEnd.getDate()} ${endMonth} ${endYear}`;
            }

            let mobileTabsHtml = `
                <div class="flex items-center justify-between px-3 py-2.5 md:hidden bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-darkborder rounded-t-xl mb-0 shadow-2xs">
                    <div class="flex items-center gap-0.5">
                        <button onclick="changeCalWeek(-7)" class="p-2 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition active:scale-95" title="Settimana precedente"><i class="fas fa-angles-left text-xs"></i></button>
                        <button onclick="stepCalDay(-1)" class="p-2 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition active:scale-95" title="Giorno precedente"><i class="fas fa-chevron-left text-xs"></i></button>
                    </div>
                    <div class="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                        <span>${weekRangeLabel}</span>
                        ${state.ui.calAnchorDate ? `<button onclick="resetCalWeek()" class="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800 ml-1">Oggi</button>` : ''}
                    </div>
                    <div class="flex items-center gap-0.5">
                        <button onclick="stepCalDay(1)" class="p-2 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition active:scale-95" title="Giorno successivo"><i class="fas fa-chevron-right text-xs"></i></button>
                        <button onclick="changeCalWeek(7)" class="p-2 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition active:scale-95" title="Settimana successiva"><i class="fas fa-angles-right text-xs"></i></button>
                    </div>
                </div>
                <div class="flex overflow-x-auto no-scrollbar gap-2 px-4 py-3 md:hidden border-x border-b border-slate-200 dark:border-darkborder bg-white dark:bg-slate-800 rounded-b-xl mb-3">`;
            daysArr.forEach(dStr => {
                const active = dStr === state.ui.calSelectedDate;
                const dObj = new Date(dStr);
                const dayName = getDayNameShort(dObj);
                const dayNum = dObj.getDate();
                const btnClass = active ? "bg-emerald-500 text-white shadow-md border-emerald-500" : "bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-300";
                
                let label = dayName;
                if(dStr === realTodayStr) label = "Oggi";

                mobileTabsHtml += `
                    <button onclick="state.ui.calSelectedDate='${dStr}'; render();" 
                            ondragover="onCalDayDragOver(event)" 
                            ondragleave="onCalDayDragLeave(event)" 
                            ondrop="onCalDayDrop(event, '${dStr}')"
                            class="flex flex-col items-center justify-center min-w-[70px] px-3 py-2 rounded-xl border transition-all ${btnClass}">
                        <span class="text-[10px] font-bold uppercase tracking-wider mb-0.5 opacity-80">${label}</span>
                        <span class="text-lg font-black leading-none">${dayNum}</span>
                    </button>`;
            });
            mobileTabsHtml += `</div>`;

            const renderDayColumn = (dateStr, isMobileTarget = false) => {
                const displayTitle = formatDisplayDate(dateStr);
                const viewMode = state.ui.calViewMode || 'normal';
                
                // Color Coding Gerarchico
                const dObj = new Date(dateStr);
                const isToday = dateStr === realTodayStr;
                const yDate = new Date(); yDate.setDate(yDate.getDate() - 1);
                const isYesterday = dateStr === getISODate(yDate);
                const tDate = new Date(); tDate.setDate(tDate.getDate() + 1);
                const isTomorrow = dateStr === getISODate(tDate);
                const isMonday = dObj.getDay() === 1;

                let colHeaderColor = 'text-slate-600 dark:text-slate-300';
                let colHeaderBg = 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700';
                let colContainerClass = 'calendar-col flex-col h-full pb-20 md:pb-0 transition-all';
                let innerContainerClass = 'flex-1 overflow-y-auto px-1 no-scrollbar';

                if (isToday) {
                    colHeaderColor = 'text-emerald-600 dark:text-emerald-400';
                    colHeaderBg = 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800';
                } else if (isTomorrow) {
                    colHeaderColor = 'text-orange-600 dark:text-orange-400';
                    colHeaderBg = 'bg-orange-50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-800';
                } else if (isYesterday) {
                    colContainerClass += ' border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-2xl opacity-60 p-1.5';
                    colHeaderBg = 'bg-transparent border-b border-dashed border-slate-300 dark:border-slate-600 mb-2';
                    innerContainerClass = 'flex-1 overflow-y-auto px-1 no-scrollbar mt-2';
                } else if (isMonday) {
                    colHeaderColor = 'text-purple-600 dark:text-purple-400';
                    colHeaderBg = 'bg-purple-50 dark:bg-purple-900/10 border-purple-200 dark:border-purple-800';
                }

                let blocks = state.data.calendarBlocks.filter(b => isBlockOnDate(b, dateStr));
                if(AppData.gcalCache && AppData.gcalCache.length > 0) {
                    let gEvents = AppData.gcalCache.filter(e => e.date === dateStr);
                    blocks.push(...gEvents);
                }
                
                // Filtro visualizzazione blocchi (Multi-select)
                blocks = blocks.filter(b => {
                    if (b.isGcal) return state.ui.calFilters.gcal;
                    if (b.type === 'task') return state.ui.calFilters.task;
                    if (b.category === 'focus') return state.ui.calFilters.focus;
                    if (b.category === 'routine') return state.ui.calFilters.routine;
                    if (b.category === 'break') return state.ui.calFilters.break;
                    return true;
                });
                
                blocks.sort((a,b) => a.startTime.localeCompare(b.startTime));

                const dueTasksToday = (state.data.tasks || []).filter(t => t.dueDate === dateStr && !t.completed);
                const allDayBlocks = blocks.filter(b => b.isAllDay || b.startTime === "Tutto il giorno");

                let allDayHtml = '';
                if (dueTasksToday.length > 0 || allDayBlocks.length > 0) {
                    allDayHtml = `
                        <div class="all-day-bar mb-3 p-2 bg-slate-100/90 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/80 text-xs shadow-2xs">
                            <div class="flex items-center justify-between text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5 px-1">
                                <span class="flex items-center gap-1.5"><i class="fas fa-calendar-day text-blue-500"></i> Tutto il Giorno</span>
                                <span class="text-[9px] bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300 px-1.5 py-0.2 rounded-full font-bold">${dueTasksToday.length + allDayBlocks.length}</span>
                            </div>
                            <div class="space-y-1">
                                ${allDayBlocks.map(b => `
                                    <div onclick="openBlockModal('${b.id}', '${dateStr}')" class="flex items-center justify-between gap-1.5 px-2 py-1 rounded-lg bg-white dark:bg-darkpanel border border-slate-200 dark:border-slate-700 cursor-pointer hover:border-blue-400 transition text-[11px] font-semibold text-slate-700 dark:text-slate-200 truncate">
                                        <span class="truncate flex items-center gap-1.5"><i class="fas fa-bookmark text-blue-500 text-[10px]"></i> ${escapeHtml(b.title)}</span>
                                        <span class="text-[9px] text-slate-400 font-normal shrink-0">Evento</span>
                                    </div>
                                `).join('')}
                                ${dueTasksToday.map(t => `
                                    <div class="flex items-center gap-2 px-2 py-1 rounded-lg bg-white dark:bg-darkpanel border border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                                        <input type="checkbox" onchange="toggleTask('${t.id}')" class="task-checkbox min-w-[12px] min-h-[12px] w-3 h-3 shrink-0">
                                        <span class="truncate cursor-pointer hover:text-blue-500 transition flex-1" onclick="editTask('${t.id}')">${escapeHtml(t.title)}</span>
                                        <span class="text-[9px] text-slate-400 font-normal shrink-0">Scadenza</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>`;
                }

                let blocksHtml = '';
                if(blocks.length === 0) {
                    blocksHtml = `<div class="text-center py-10 opacity-40 italic text-sm text-slate-500"><i class="fas fa-coffee text-2xl mb-2"></i><br>Niente in programma</div>`;
                } else {
                    if(viewMode === 'proportional') {
                        // Modalità Proporzionale (Inizia alle 7:00)
                        const startHour = 7;
                        const endHour = 24;
                        const hoursCount = endHour - startHour;
                        const containerHeight = hoursCount * 60;
                        const proportionalBlocks = blocks.filter(b => !b.isAllDay && b.startTime !== "Tutto il giorno");
                        
                        blocksHtml = `<div class="relative w-full bg-white dark:bg-darkpanel rounded-xl border border-slate-200 dark:border-darkborder shadow-sm mb-4" style="height: ${containerHeight}px;" ondragover="onCalDayDragOver(event)" ondragleave="onCalDayDragLeave(event)" ondrop="onCalDayDrop(event, '${dateStr}')">`;
                        for(let h = startHour; h < endHour; h++) {
                            blocksHtml += `<div class="absolute w-full border-t border-slate-100 dark:border-slate-700/50 flex" style="top: ${(h-startHour)*60}px; height: 60px;"><span class="text-[9px] text-slate-400 font-bold ml-1 bg-white dark:bg-darkpanel px-1" style="position:relative; top:-7px; height:max-content;">${String(h).padStart(2, '0')}:00</span></div>`;
                        }

                        proportionalBlocks.forEach(b => {
                            let isDone = b.isGcal ? (state.data.gcalCompleted && state.data.gcalCompleted.includes(b.id + '_' + dateStr)) : (b.completedDates && b.completedDates.includes(dateStr));
                            const catClass = b.isGcal ? '' : "block-" + (b.category || 'routine');
                            const gcalStyle = b.isGcal ? `border-left: 4px solid ${b.color}; background-color: ${b.color}15; color: ${b.color};` : '';
                            let icon = b.isGcal ? 'fab fa-google' : (b.type === 'task' ? 'fas fa-link' : (b.category === 'focus' ? 'fas fa-laptop-code' : (b.category === 'break' ? 'fas fa-mug-hot' : 'fas fa-list-ul')));
                            const onClickAction = b.isGcal ? (b.link ? `window.open('${b.link}', '_blank')` : '') : `openBlockModal('${b.id}', '${dateStr}')`;

                            const overlaps = getBlockOverlaps(b, blocks);
                            const hasOverlap = overlaps.length > 0;

                            const hasLinkedTasks = b.type === 'task' && b.taskIds && b.taskIds.length > 0;
                            const isNonTaskSimple = b.type === 'simple' && (b.category === 'break' || b.category === 'routine');
                            const hideMainCheckbox = b.isGcal || isNonTaskSimple || hasLinkedTasks;
                            const chkHtml = hideMainCheckbox ? '' : `<input type="checkbox" class="task-checkbox min-w-[12px] min-h-[12px] w-3 h-3 shrink-0 mt-0.5 border-current checked:!bg-current checked:!border-current" style="color:inherit" ${isDone ? 'checked' : ''} onclick="event.stopPropagation(); toggleBlockCompleted('${b.id}', '${dateStr}')">`;

                            const parseTime = (tStr) => {
                                if(!tStr || tStr === "Tutto il giorno") return null;
                                const [h,m] = tStr.split(':').map(Number);
                                return (h * 60) + (m || 0);
                            };
                            
                            let absStartMins = parseTime(b.startTime);
                            if(absStartMins === null && b.isGcal && b.isAllDay) {
                                 absStartMins = startHour * 60; 
                                 b.endTime = String(startHour+1).padStart(2, '0') + ":00";
                            }
                            
                            let sMins = (absStartMins || 0) - (startHour * 60);
                            let eMins = parseTime(b.endTime);
                            eMins = eMins !== null ? eMins - (startHour * 60) : sMins + 60;
                            
                            if (eMins <= sMins) eMins = sMins + 30; // Altezza minima
                            
                            if(sMins < 0) {
                                if(eMins <= 0) return;
                                sMins = 0; 
                            }

                            let extraHtml = '';
                            if (hasLinkedTasks) {
                                extraHtml += `<div class="mt-1 space-y-1 pl-1 border-l border-current opacity-90 overflow-y-auto max-h-full pb-1">`;
                                b.taskIds.forEach(tid => {
                                    const t = state.data.tasks.find(x => x.id === tid);
                                    if(t) {
                                        let cbTClass = "border-slate-300 dark:border-slate-500";
                                        if(t.priority === 3) cbTClass = "!border-red-400 checked:!bg-red-500 text-red-500";
                                        else if(t.priority === 2) cbTClass = "!border-amber-400 checked:!bg-amber-500 text-amber-500";
                                        else if(t.priority === 1) cbTClass = "!border-blue-400 checked:!bg-blue-500 text-blue-500";
                                        extraHtml += `<div class="text-[9px] flex items-center gap-1 font-medium" onclick="event.stopPropagation()">
                                            <input type="checkbox" class="task-checkbox min-w-[10px] min-h-[10px] w-2.5 h-2.5 ${cbTClass}" ${t.completed ? 'checked' : ''} onclick="toggleTask('${t.id}')">
                                            <span class="truncate ${t.completed?'line-through opacity-50':''}" onclick="toggleTask('${t.id}')">${t.title}</span>
                                        </div>`;
                                    }
                                });
                                extraHtml += `</div>`;
                            }

                            blocksHtml += `
                                <div class="absolute left-1.5 right-1.5 rounded-lg p-1.5 overflow-hidden border border-l-[4px] shadow-sm transition-all hover:z-20 cursor-pointer ${catClass} ${isDone ? 'opacity-50 grayscale' : ''}"
                                     style="top: ${sMins}px; height: ${eMins - sMins}px; min-height: 25px; ${gcalStyle}; z-index: 10;"
                                     ${b.isGcal ? '' : `draggable="true" ondragstart="onCalBlockDragStart(event, '${b.id}', '${dateStr}')" ondragend="onCalBlockDragEnd(event)"`}
                                     onclick="${onClickAction}">
                                    <div class="flex items-start gap-1.5 h-full flex-col">
                                        <div class="flex items-start gap-1.5 w-full">
                                            ${chkHtml}
                                            <div class="flex-1 min-w-0 flex flex-col justify-start">
                                                <div class="font-bold text-[11px] truncate flex items-center justify-between">
                                                    <span class="truncate"><i class="${icon} text-[9px] mr-1 opacity-80"></i>${b.title}</span>
                                                    ${hasOverlap ? `<i class="fas fa-exclamation-triangle text-amber-500 text-[10px] ml-1" title="Sovrapposizione oraria rilevata"></i>` : ''}
                                                </div>
                                                <div class="text-[9px] font-black uppercase tracking-wider opacity-70 mt-0.5 truncate">${b.startTime} - ${b.endTime}</div>
                                            </div>
                                        </div>
                                        ${extraHtml}
                                    </div>
                                    ${b.isGcal ? '' : `
                                        <div class="absolute bottom-0 left-0 right-0 h-2.5 cursor-ns-resize hover:bg-black/20 dark:hover:bg-white/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition z-30"
                                             onmousedown="initBlockResize(event, '${b.id}')"
                                             onclick="event.stopPropagation()"
                                             title="Trascina per ridimensionare durata">
                                            <span class="w-5 h-1 bg-current rounded-full opacity-60"></span>
                                        </div>
                                    `}
                                </div>`;
                        });
                        blocksHtml += `</div>`;
                    } else {
                        // Modalità Normale
                        blocksHtml += `<div class="space-y-2">`;
                        blocks.forEach(b => {
                            let isDone = b.isGcal ? (state.data.gcalCompleted && state.data.gcalCompleted.includes(b.id + '_' + dateStr)) : (b.completedDates && b.completedDates.includes(dateStr));
                            const catClass = b.isGcal ? '' : "block-" + (b.category || 'routine');
                            const gcalStyle = b.isGcal ? `border-left: 4px solid ${b.color}; background-color: ${b.color}15; color: ${b.color};` : '';
                            let icon = b.isGcal ? 'fab fa-google' : (b.type === 'task' ? 'fas fa-link' : (b.category === 'focus' ? 'fas fa-laptop-code' : (b.category === 'break' ? 'fas fa-mug-hot' : 'fas fa-list-ul')));
                            
                            const overlaps = getBlockOverlaps(b, blocks);
                            const hasOverlap = overlaps.length > 0;
                            const conflictGlow = hasOverlap ? 'calendar-conflict-glow ring-2 ring-amber-400 dark:ring-amber-500' : '';

                            const isBreak = !b.isGcal && b.category === 'break';
                            const isRoutine = !b.isGcal && b.category === 'routine';
                            const pClass = isBreak ? 'p-2 py-1.5' : 'p-3';
                            const titleSize = isBreak ? 'text-xs' : 'text-sm';
                            const headSize = isBreak ? 'text-[9px]' : 'text-[10px]';
                            
                            const hasLinkedTasks = b.type === 'task' && b.taskIds && b.taskIds.length > 0;
                            const isNonTaskSimple = b.type === 'simple' && (isBreak || isRoutine);
                            const hideMainCheckbox = b.isGcal || isNonTaskSimple || hasLinkedTasks;
                            const chkHtml = hideMainCheckbox ? '' : `<input type="checkbox" class="task-checkbox shrink-0 mt-0.5 mr-2 border-current checked:!bg-current checked:!border-current" style="color:inherit" ${isDone ? 'checked' : ''} onclick="event.stopPropagation(); toggleBlockCompleted('${b.id}', '${dateStr}')">`;

                            let extraHtml = '';
                            if(!isBreak) { 
                                if(hasLinkedTasks) {
                                    extraHtml += `<div class="mt-2 space-y-1.5 pl-1 border-l-2 border-slate-200 dark:border-slate-600/50">`;
                                    b.taskIds.forEach(tid => {
                                        const t = state.data.tasks.find(x => x.id === tid);
                                        if(t) {
                                            let cbTClass = "border-slate-300 dark:border-slate-500";
                                            if(t.priority === 3) cbTClass = "!border-red-400 checked:!bg-red-500 text-red-500";
                                            else if(t.priority === 2) cbTClass = "!border-amber-400 checked:!bg-amber-500 text-amber-500";
                                            else if(t.priority === 1) cbTClass = "!border-blue-400 checked:!bg-blue-500 text-blue-500";

                                            extraHtml += `<div class="text-[11px] flex items-center gap-2 opacity-95 text-slate-700 dark:text-slate-200" onclick="event.stopPropagation()">
                                                <input type="checkbox" class="task-checkbox min-w-[14px] min-h-[14px] w-3.5 h-3.5 ${cbTClass}" ${t.completed ? 'checked' : ''} onclick="toggleTask('${t.id}')">
                                                <span class="leading-tight ${t.completed?'line-through opacity-50':''} font-medium cursor-pointer" onclick="toggleTask('${t.id}')">${t.title}</span>
                                            </div>`;
                                        }
                                    });
                                    extraHtml += `</div>`;
                                }
                                if(b.notes) {
                                    extraHtml += `<div class="text-[10px] text-slate-600 dark:text-slate-400 opacity-90 mt-2 bg-slate-100/50 dark:bg-slate-800/30 p-1.5 rounded whitespace-pre-wrap leading-tight max-h-20 overflow-y-auto"><i class="fas fa-align-left mr-1.5 opacity-50"></i>${b.notes}</div>`;
                                }
                            }

                            const onClickAction = b.isGcal ? (b.link ? `window.open('${b.link}', '_blank')` : '') : `openBlockModal('${b.id}', '${dateStr}')`;
                            const cursorStyle = b.isGcal ? (b.link ? 'cursor:pointer' : 'cursor:default') : 'cursor:pointer';

                            blocksHtml += `
                                <div class="panel ${pClass} flex items-start transition-all relative group cursor-pointer ${catClass} ${conflictGlow} ${isDone ? 'opacity-50 grayscale' : ''}" 
                                     ${b.isGcal ? '' : `draggable="true" ondragstart="onCalBlockDragStart(event, '${b.id}', '${dateStr}')" ondragend="onCalBlockDragEnd(event)"`}
                                     style="${gcalStyle}"
                                     onclick="${onClickAction}">
                                    ${chkHtml}
                                    <div class="flex-1 min-w-0" style="${cursorStyle}">
                                        <div class="flex justify-between items-center mb-1">
                                            <span class="${headSize} font-black uppercase tracking-wider opacity-80">${b.startTime}${b.endTime ? ' - '+b.endTime : ''}</span>
                                            <div class="flex items-center gap-1.5">
                                                ${hasOverlap ? `<span class="text-[9px] bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 font-bold px-1.5 py-0.5 rounded flex items-center gap-1 border border-amber-200 dark:border-amber-800/60" title="Attenzione: sovrapposizione oraria rilevata"><i class="fas fa-exclamation-triangle"></i> Sovrapposto</span>` : ''}
                                                ${b.isRecurring ? `<i class="fas fa-sync-alt text-[9px] opacity-60"></i>` : ''}
                                            </div>
                                        </div>
                                        <p class="font-bold ${titleSize} leading-tight word-wrap ${isDone ? 'line-through opacity-70' : ''}"><i class="${icon} text-[10px] mr-1.5 opacity-80"></i>${b.title}</p>
                                        ${extraHtml}
                                    </div>
                                </div>`;
                        });
                        blocksHtml += `</div>`;
                    }
                }

                const mobileVisibility = isMobileTarget ? 'block md:flex' : 'hidden md:flex';
                return `
                    <div class="${colContainerClass} ${mobileVisibility}"
                         data-date="${dateStr}"
                         ondragover="onCalDayDragOver(event)" 
                         ondragleave="onCalDayDragLeave(event)" 
                         ondrop="onCalDayDrop(event, '${dateStr}')">
                        <div class="flex justify-between items-center p-3 mb-4 rounded-xl border shadow-sm ${colHeaderBg}">
                            <h3 class="font-bold text-sm ${colHeaderColor}">${displayTitle}</h3>
                            <button onclick="openBlockModal(null, '${dateStr}')" class="text-xs px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-xs transition flex items-center gap-1 active:scale-95" title="Aggiungi Blocco a ${displayTitle}"><i class="fas fa-plus"></i> <span class="text-[11px] font-semibold">Blocco</span></button>
                        </div>
                        <div class="${innerContainerClass}"
                             data-date="${dateStr}"
                             ondragover="onCalDayDragOver(event)" 
                             ondragleave="onCalDayDragLeave(event)" 
                             ondrop="onCalDayDrop(event, '${dateStr}')">
                            ${allDayHtml}
                            ${blocksHtml}
                            ${blocks.length === 0 ? `
                                <button onclick="openBlockModal(null, '${dateStr}')" class="w-full mt-2 py-3 px-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-slate-400 dark:text-slate-500 font-semibold text-xs hover:border-blue-500 hover:text-blue-500 transition flex items-center justify-center gap-1.5 active:scale-98">
                                    <i class="fas fa-plus text-[10px]"></i> Aggiungi primo blocco
                                </button>
                            ` : `
                                <button onclick="openBlockModal(null, '${dateStr}')" class="w-full mt-3 py-2.5 px-3 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-bold text-xs hover:border-blue-500 hover:text-blue-600 dark:hover:border-blue-400 dark:hover:text-blue-300 transition flex md:hidden items-center justify-center gap-2 active:scale-98">
                                    <i class="fas fa-plus-circle text-blue-500"></i> Aggiungi blocco
                                </button>
                            `}
                        </div>
                    </div>`;
            };

            let desktopColsHtml = `<div class="flex flex-row gap-5 md:gap-6 overflow-x-auto snap-x md:snap-none w-full h-[calc(100vh-250px)] md:h-[calc(100vh-160px)] px-4 md:px-0">`;
            daysArr.forEach(d => {
                desktopColsHtml += renderDayColumn(d, d === state.ui.calSelectedDate);
            });
            desktopColsHtml += `</div>`;

            return `
                <div class="flex flex-col h-full">
                    <div class="flex flex-wrap justify-between items-center gap-3 mb-4 md:mb-6 hidden md:flex">
                        <div class="flex items-center gap-4">
                            <h2 class="text-2xl font-bold flex items-center text-slate-800 dark:text-white tracking-tight"><i class="fas fa-calendar-alt text-emerald-500 mr-3"></i> Time Management</h2>
                            <div class="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
                                <button onclick="changeCalWeek(-7)" class="p-1.5 px-2.5 rounded-lg text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-700 transition active:scale-95" title="Settimana precedente"><i class="fas fa-chevron-left text-xs"></i></button>
                                <button onclick="resetCalWeek()" class="px-3 py-1 text-xs font-bold rounded-lg ${!state.ui.calAnchorDate ? 'bg-emerald-500 text-white shadow-2xs' : 'text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700'} transition active:scale-95" title="Torna alla data odierna">Oggi</button>
                                <button onclick="changeCalWeek(7)" class="p-1.5 px-2.5 rounded-lg text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-700 transition active:scale-95" title="Settimana successiva"><i class="fas fa-chevron-right text-xs"></i></button>
                                <span class="text-xs font-bold text-slate-600 dark:text-slate-300 px-2.5 border-l border-slate-300 dark:border-slate-600">${weekRangeLabel}</span>
                            </div>
                        </div>
                        <div class="flex items-center gap-3 bg-slate-200 dark:bg-slate-800 rounded-lg p-1">
                            <div class="flex flex-wrap items-center gap-1.5 p-1 rounded-lg">
                                <button onclick="toggleCalFilter('task')" class="px-2 py-1 rounded text-[10px] font-bold transition ${state.ui.calFilters.task ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 shadow-sm' : 'text-slate-500 hover:bg-slate-300 dark:hover:bg-slate-700'}"><i class="fas fa-link"></i> Task</button>
                                <button onclick="toggleCalFilter('focus')" class="px-2 py-1 rounded text-[10px] font-bold transition ${state.ui.calFilters.focus ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 shadow-sm' : 'text-slate-500 hover:bg-slate-300 dark:hover:bg-slate-700'}"><i class="fas fa-laptop-code"></i> Focus</button>
                                <button onclick="toggleCalFilter('routine')" class="px-2 py-1 rounded text-[10px] font-bold transition ${state.ui.calFilters.routine ? 'bg-slate-50 text-slate-700 dark:bg-slate-700 dark:text-slate-200 shadow-sm' : 'text-slate-500 hover:bg-slate-300 dark:hover:bg-slate-700'}"><i class="fas fa-redo"></i> Routine</button>
                                <button onclick="toggleCalFilter('break')" class="px-2 py-1 rounded text-[10px] font-bold transition ${state.ui.calFilters.break ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 shadow-sm' : 'text-slate-500 hover:bg-slate-300 dark:hover:bg-slate-700'}"><i class="fas fa-mug-hot"></i> Pausa</button>
                                <button onclick="toggleCalFilter('gcal')" class="px-2 py-1 rounded text-[10px] font-bold transition ${state.ui.calFilters.gcal ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 shadow-sm' : 'text-slate-500 hover:bg-slate-300 dark:hover:bg-slate-700'}"><i class="fab fa-google"></i> GCal</button>
                            </div>
                            <div class="w-px h-5 bg-slate-300 dark:bg-slate-600"></div>
                            <div class="flex">
                                <button onclick="state.ui.calViewMode='normal'; render();" class="px-3 py-1.5 text-xs font-bold rounded-md transition ${state.ui.calViewMode !== 'proportional' ? 'bg-white dark:bg-slate-700 shadow text-slate-800 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}"><i class="fas fa-list mr-1"></i> Lista</button>
                                <button onclick="state.ui.calViewMode='proportional'; render();" class="px-3 py-1.5 text-xs font-bold rounded-md transition ${state.ui.calViewMode === 'proportional' ? 'bg-white dark:bg-slate-700 shadow text-slate-800 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}"><i class="fas fa-ruler-vertical mr-1"></i> Proporzionale</button>
                            </div>
                        </div>
                    </div>
                    ${mobileTabsHtml}
                    <div class="mt-4 md:mt-0 flex-1">
                        ${desktopColsHtml}
                    </div>
                </div>
            `;
        }
