// --- GESTIONE SFERE, PROGETTI, SOTTO-PROGETTI, NOTE & CARD DRAG & DROP ---
function openEntityModal(mode, type, sId=null, pId=null, spId=null) {
            editState = { mode, type, id: (mode==='edit' ? (type==='sphere'?sId : (type==='project'?pId : spId)) : null), sId, pId };
            
            document.getElementById('emTitle').innerHTML = mode === 'create' ? `<i class="fas fa-plus-circle text-blue-500 mr-2"></i> Nuovo ${type}` : `<i class="fas fa-edit text-blue-500 mr-2"></i> Modifica ${type}`;
            document.getElementById('entityModal').classList.remove('hidden');
            document.getElementById('emDeleteBtn').classList.toggle('hidden', mode === 'create');
            
            const pFields = document.getElementById('emProjectFields');
            const reloArea = document.getElementById('emRelocationArea');
            pFields.classList.toggle('hidden', type === 'sphere');
            reloArea.classList.toggle('hidden', mode === 'create' || type === 'sphere');

            if(mode === 'create') {
                document.getElementById('emName').value = ''; document.getElementById('emIcon').value = type==='sphere' ? 'fa-folder' : (type==='project' ? 'fa-folder-open' : 'fa-file-alt');
                document.getElementById('emColor').value = type==='sphere' ? '#3b82f6' : '#94a3b8';
                if(type !== 'sphere') {
                    document.getElementById('emType').value = 'A termine'; document.getElementById('emStatus').value = 'Nuovo';
                    document.getElementById('emStartDate').value = ''; document.getElementById('emEndDate').value = '';
                }
            } else {
                const e = getEntity(type, editState.id);
                if(e) {
                    document.getElementById('emName').value = e.name; document.getElementById('emIcon').value = e.icon; document.getElementById('emColor').value = mapColor(e.color);
                    if(type !== 'sphere') {
                        document.getElementById('emType').value = e.type || 'A termine'; document.getElementById('emStatus').value = e.status || 'Attivo';
                        document.getElementById('emStartDate').value = e.startDate || ''; document.getElementById('emEndDate').value = e.endDate || '';
                        
                        const sel = document.getElementById('emParentSelect');
                        sel.innerHTML = '';
                        if(type === 'project') {
                            document.getElementById('emParentLabel').innerText = 'Sposta in Sfera:';
                            state.data.spheres.forEach(s => sel.innerHTML += `<option value="${s.id}" ${s.id===e.sphereId?'selected':''}>${s.name}</option>`);
                        } else if(type === 'subproject') {
                            document.getElementById('emParentLabel').innerText = 'Sposta in Progetto:';
                            state.data.projects.forEach(p => {
                                const ps = getEntity('sphere', p.sphereId);
                                sel.innerHTML += `<option value="${p.id}" ${p.id===e.projectId?'selected':''}>${ps ? ps.name : 'Orfano'} > ${p.name}</option>`;
                            });
                        }
                    }
                }
            }
        }
        function closeEntityModal() { document.getElementById('entityModal').classList.add('hidden'); }
        
        function saveEntityModal() {
            const name = document.getElementById('emName').value.trim();
            if(!name) { showToast("Inserisci un nome valido.", "error"); return; }
            
            const baseObj = { name, icon: document.getElementById('emIcon').value, color: document.getElementById('emColor').value };
            let extraObj = {};
            if(editState.type !== 'sphere') {
                extraObj = { type: document.getElementById('emType').value, status: document.getElementById('emStatus').value, startDate: document.getElementById('emStartDate').value, endDate: document.getElementById('emEndDate').value };
            }

            // Fallback robusti per gli ID genitore
            let currentSId = editState.sId || state.path.sphereId;
            let currentPId = editState.pId || state.path.projId;

            if(editState.mode === 'create') {
                const newId = editState.type.charAt(0) + '_' + Date.now();
                if(editState.type === 'sphere') {
                    state.data.spheres.push({ id: newId, ...baseObj, order: state.data.spheres.length, notes: '', permanentNotes: '', updates: [] });
                    navigate('sphere', newId);
                }
                else if(editState.type === 'project') {
                    if(!currentSId) { showToast("Errore: Impossibile determinare la Sfera madre.", "error"); return; }
                    state.data.projects.push({ id: newId, sphereId: currentSId, ...baseObj, ...extraObj, pinned: false, pinnedLevelId: null, archived: false, order: getChildren('sphere', currentSId).length, notes: '', permanentNotes: '', updates: [] });
                    navigate('project', currentSId, newId);
                }
                else {
                    if(!currentPId) { showToast("Errore: Impossibile determinare il Progetto madre.", "error"); return; }
                    state.data.subprojects.push({ id: newId, projectId: currentPId, ...baseObj, ...extraObj, pinned: false, pinnedLevelId: null, archived: false, order: getChildren('project', currentPId).length, notes: '', permanentNotes: '', updates: [] });
                    navigate('subproject', currentSId, currentPId, newId);
                }
                
                showToast("Creato con successo", "success");
            } else {
                const e = getEntity(editState.type, editState.id);
                if(e) {
                    Object.assign(e, baseObj, extraObj);
                    if(editState.type !== 'sphere') {
                        const newParent = document.getElementById('emParentSelect').value;
                        if(editState.type === 'project' && e.sphereId !== newParent) {
                            e.sphereId = newParent;
                            e.order = getChildren('sphere', newParent).length;
                            if(state.path.projId === e.id) navigate('project', newParent, e.id);
                        } else if(editState.type === 'subproject' && e.projectId !== newParent) {
                            e.projectId = newParent;
                            e.order = getChildren('project', newParent).length;
                            if(state.path.subprojId === e.id) {
                                const targetProj = getEntity('project', newParent);
                                if(targetProj) navigate('subproject', targetProj.sphereId, newParent, e.id);
                            }
                        }
                    }
                }
                showToast("Modifiche salvate", "success");
            }
            closeEntityModal(); AppData.triggerSave(); render();
        }

        function deleteCurrentEntity() {
            if(!confirm("Spostare nel cestino? Potrai ripristinarlo in qualsiasi momento.")) return;
            const id = editState.id;
            if(editState.type === 'sphere') {
                const s = state.data.spheres.find(x => x.id === id);
                if (s && typeof moveToTrash === 'function') moveToTrash('sphere', s);
                state.data.spheres = state.data.spheres.filter(x => x.id !== id);
                const projs = state.data.projects.filter(x => x.sphereId === id).map(x=>x.id);
                state.data.projects = state.data.projects.filter(x => x.sphereId !== id);
                state.data.subprojects = state.data.subprojects.filter(x => !projs.includes(x.projectId));
                navigate('home');
            } else if(editState.type === 'project') {
                const p = state.data.projects.find(x => x.id === id);
                if (p && typeof moveToTrash === 'function') moveToTrash('project', p);
                state.data.projects = state.data.projects.filter(x => x.id !== id);
                state.data.subprojects = state.data.subprojects.filter(x => x.projectId !== id);
                navigate('sphere', editState.sId || state.path.sphereId);
            } else {
                const sp = state.data.subprojects.find(x => x.id === id);
                if (sp && typeof moveToTrash === 'function') moveToTrash('subproject', sp);
                state.data.subprojects = state.data.subprojects.filter(x => x.id !== id);
                navigate('project', editState.sId || state.path.sphereId, editState.pId || state.path.projId);
            }
            triggerHaptic('medium');
            closeEntityModal(); AppData.triggerSave(); render();
        }

function onDragStart(e, id, type, listType) { 
            dragSource = { id, type, listType }; 
            e.dataTransfer.effectAllowed = 'move'; 
            document.body.classList.add('is-dragging');
            setTimeout(() => e.target.classList.add('opacity-40'), 0); 
        }
        function onDragEnd(e) { 
            e.target.classList.remove('opacity-40'); 
            document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over')); 
            document.body.classList.remove('is-dragging');
            dragSource = null; 
        }
        function onDragOver(e) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if(!e.currentTarget.classList.contains('drag-over')) e.currentTarget.classList.add('drag-over'); }
        function onDragLeave(e) { e.currentTarget.classList.remove('drag-over'); }
        
        function onDrop(e, targetId, targetType, listType) {
            e.preventDefault(); e.currentTarget.classList.remove('drag-over');
            document.body.classList.remove('is-dragging');
            if(!dragSource) return;
            
            const isPinnedDrag = dragSource.listType.startsWith('dashboard_pinned_') && listType.startsWith('dashboard_pinned_');
            if(!isPinnedDrag && dragSource.listType !== listType) return;
            
            const srcId = dragSource.id;
            if(srcId === targetId && dragSource.type === targetType) return;

            let list = [];
            const prop = (listType.startsWith('dashboard_pinned_')) ? 'pinnedOrder' : 'order';

            if(isPinnedDrag) {
                const targetLevelId = listType.replace('dashboard_pinned_', '');
                const draggedItem = getEntity(dragSource.type, srcId);
                if(draggedItem) draggedItem.pinnedLevelId = targetLevelId;

                list = [...state.data.projects.filter(p=>p.pinned && !p.archived && (p.pinnedLevelId === targetLevelId || (!p.pinnedLevelId && targetLevelId === 'pl_default'))),
                        ...state.data.subprojects.filter(sp=>sp.pinned && !sp.archived && (sp.pinnedLevelId === targetLevelId || (!sp.pinnedLevelId && targetLevelId === 'pl_default')))]
                        .sort((a,b) => (a.pinnedOrder||0) - (b.pinnedOrder||0));

                if(targetId) {
                    const targetIdx = list.findIndex(x => x.id === targetId);
                    const draggedIdx = list.findIndex(x => x.id === srcId);
                    if(draggedIdx !== -1) list.splice(draggedIdx, 1);
                    const newTargetIdx = list.findIndex(x => x.id === targetId);
                    list.splice(newTargetIdx !== -1 ? newTargetIdx : list.length, 0, draggedItem);
                } else {
                    const draggedIdx = list.findIndex(x => x.id === srcId);
                    if(draggedIdx !== -1) list.splice(draggedIdx, 1);
                    list.push(draggedItem);
                }
            }
            else if(listType === 'sphere_pinned') list = state.data.projects.filter(p => p.sphereId === state.path.sphereId && p.pinned && p.archived === state.ui.showArchived).sort((a,b) => (a.order||0) - (b.order||0));
            else if(listType === 'sphere_unpinned') list = state.data.projects.filter(p => p.sphereId === state.path.sphereId && !p.pinned && p.archived === state.ui.showArchived).sort((a,b) => (a.order||0) - (b.order||0));
            else if(listType === 'project_pinned') list = state.data.subprojects.filter(sp => sp.projectId === state.path.projId && sp.pinned && sp.archived === state.ui.showArchived).sort((a,b) => (a.order||0) - (b.order||0));
            else if(listType === 'project_unpinned') list = state.data.subprojects.filter(sp => sp.projectId === state.path.projId && !sp.pinned && sp.archived === state.ui.showArchived).sort((a,b) => (a.order||0) - (b.order||0));
            
            if(!isPinnedDrag) {
                const draggedIdx = list.findIndex(x => x.id === srcId), targetIdx = list.findIndex(x => x.id === targetId);
                if(draggedIdx === -1 || targetIdx === -1) return;
                const draggedObj = list.splice(draggedIdx, 1)[0];
                list.splice(targetIdx, 0, draggedObj);
            }

            list.forEach((item, index) => {
                if(item.projectId !== undefined) {
                    let obj = state.data.subprojects.find(x => x.id === item.id);
                    if(obj) obj[prop] = index;
                } else if(item.sphereId !== undefined) {
                    let obj = state.data.projects.find(x => x.id === item.id);
                    if(obj) obj[prop] = index;
                } else {
                    let obj = state.data.spheres.find(x => x.id === item.id);
                    if(obj) obj[prop] = index;
                }
            });
            AppData.triggerSave(); render();
        }

        function createDraggableCardHtml(title, sub, type, sId, pId, spId, colorHex, listType, itemObj) {
            const id = type === 'project' ? pId : spId;
            const icon = itemObj.icon || (type === 'project' ? 'fa-folder' : 'fa-file-alt');
            return `
                <div draggable="true" data-drag-card="true" ondragstart="onDragStart(event, '${id}', '${type}', '${listType}')" ondragend="onDragEnd(event)" ondragover="onDragOver(event)" ondragleave="onDragLeave(event)" ondrop="onDrop(event, '${id}', '${type}', '${listType}')"
                     onclick="navigate('${type}', '${sId}', '${pId}', '${spId}')" class="panel panel-hover p-4 flex justify-between items-center relative group draggable mb-4 bg-white dark:bg-darkpanel border border-slate-200 dark:border-darkborder shadow-sm border-l-[5px]" style="border-left-color: ${colorHex}">
                    <div class="pl-1 word-wrap flex-1">
                        <h3 class="font-bold text-slate-800 dark:text-slate-100 text-sm flex items-center">
                            ${itemObj.pinned ? '<i class="fas fa-star text-amber-500 text-[10px] mr-1.5"></i>' : ''} <i class="fas ${icon} text-slate-400 dark:text-slate-500 mr-2 text-[13px]"></i> ${title}
                        </h3>
                        <p class="text-[10px] font-bold text-slate-500 mt-1.5 uppercase tracking-widest">${sub}</p>
                    </div>
                    <div class="flex gap-1.5 opacity-60 md:opacity-0 group-hover:opacity-100 transition items-center">
                        <button onclick="event.stopPropagation(); toggleArchiveEntity('${type}', '${id}')" class="text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition" title="Archivia"><i class="fas fa-archive text-[11px]"></i></button>
                        <i class="fas fa-grip-lines text-slate-300 dark:text-slate-600 text-sm ml-1 cursor-grab p-1"></i>
                    </div>
                </div>`;
        }

        function addPinnedLevel() {
            const name = prompt("Nome del nuovo livello in evidenza:");
            if(name && name.trim()) {
                state.data.pinnedLevels.push({id: 'pl_'+Date.now(), name: name.trim()});
                AppData.triggerSave(); render();
            }
        }
        function renamePinnedLevel(id) {
            const lvl = state.data.pinnedLevels.find(l => l.id === id);
            if(!lvl) return;
            const name = prompt("Rinomina livello:", lvl.name);
            if(name && name.trim()) {
                lvl.name = name.trim();
                AppData.triggerSave(); render();
            }
        }
        function deletePinnedLevel(id) {
            if(id === 'pl_default') return; 
            if(confirm("Eliminare questo livello? Gli elementi torneranno nel livello predefinito.")) {
                state.data.pinnedLevels = state.data.pinnedLevels.filter(l => l.id !== id);
                state.data.projects.forEach(p => { if(p.pinnedLevelId === id) p.pinnedLevelId = 'pl_default'; });
                state.data.subprojects.forEach(sp => { if(sp.pinnedLevelId === id) sp.pinnedLevelId = 'pl_default'; });
                AppData.triggerSave(); render();
            }
        }

function escapeNoteHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

let currentNotebookTab = 'active';

function switchNotebookTab(tabName) {
    currentNotebookTab = tabName;
    ['active', 'permanent', 'archive'].forEach(t => {
        const panel = document.getElementById(`notebook-tab-panel-${t}`);
        const btn = document.getElementById(`notebook-tab-btn-${t}`);
        if (panel) {
            if (t === tabName) {
                panel.classList.remove('hidden');
                panel.classList.add('block');
            } else {
                panel.classList.add('hidden');
                panel.classList.remove('block');
            }
        }
        if (btn) {
            if (t === tabName) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        }
    });
}

function getActiveNotebookQuill() {
    const type = state.path.subprojId ? 'subproject' : (state.path.projId ? 'project' : null);
    if (!type) return null;
    const el = document.getElementById(`quill-editor-${type}`);
    return el && el.__quill ? el.__quill : null;
}

function updateNotebookStats(quill, type) {
    if (!quill || !type) return;
    const text = quill.getText() || '';
    const trimmed = text.trim();
    const charCount = trimmed ? trimmed.length : 0;
    const wordCount = trimmed ? trimmed.split(/\s+/).filter(Boolean).length : 0;
    const charEl = document.getElementById(`notebook-chars-${type}`);
    const wordEl = document.getElementById(`notebook-words-${type}`);
    if (charEl) charEl.textContent = `${charCount} caratteri`;
    if (wordEl) wordEl.textContent = `${wordCount} parole`;
}

function insertHtmlIntoNotebook(html) {
    const quill = getActiveNotebookQuill();
    if (!quill) {
        showToast("Editor non pronto o non visibile", "default");
        return;
    }
    const range = quill.getSelection(true) || { index: quill.getLength() - 1, length: 0 };
    quill.clipboard.dangerouslyPasteHTML(range.index, html);
    quill.setSelection(range.index + html.length);

    const type = state.path.subprojId ? 'subproject' : (state.path.projId ? 'project' : null);
    const id = state.path.subprojId || state.path.projId;
    const entity = getEntity(type, id);
    if (entity) {
        entity.notes = quill.root.innerHTML;
        AppData.triggerSave();
        updateNotebookStats(quill, type);
    }
}

function insertNoteCallout(type) {
    const labels = {
        idea: '💡 Idea:',
        info: 'ℹ️ Informazione:',
        warning: '⚠️ Attenzione:',
        success: '✅ Decisione:'
    };
    const title = labels[type] || 'Nota:';
    const html = `<div class="note-callout note-callout-${type}"><strong>${title}</strong> Scrivi qui...</div><p><br></p>`;
    insertHtmlIntoNotebook(html);
}

function insertNoteQuote() {
    const html = `<blockquote class="note-quote">“Inserisci qui la citazione o riferimento...”</blockquote><p><br></p>`;
    insertHtmlIntoNotebook(html);
}

function openNoteTaskPicker() {
    const modal = document.getElementById('noteTaskPickerModal');
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    const input = document.getElementById('noteTaskSearchInput');
    if (input) {
        input.value = '';
        setTimeout(() => input.focus(), 50);
    }
    renderNoteTaskPickerList('');
}

function closeNoteTaskPicker() {
    const modal = document.getElementById('noteTaskPickerModal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

function renderNoteTaskPickerList(query = '') {
    const container = document.getElementById('noteTaskPickerList');
    if (!container) return;
    const q = (query || '').toLowerCase().trim();
    const tasks = state.data.tasks || [];
    const currentProjId = state.path.projId;
    const currentSubprojId = state.path.subprojId;

    let filtered = tasks.filter(t => {
        if (!q) return true;
        return (t.title && t.title.toLowerCase().includes(q)) || 
               (t.text && t.text.toLowerCase().includes(q)) ||
               (t.tag && t.tag.toLowerCase().includes(q));
    });

    filtered.sort((a, b) => {
        const aContext = a.contextId || a.projId || a.subprojId;
        const bContext = b.contextId || b.projId || b.subprojId;
        const aCurrent = (aContext === currentSubprojId || aContext === currentProjId) ? 1 : 0;
        const bCurrent = (bContext === currentSubprojId || bContext === currentProjId) ? 1 : 0;
        if (aCurrent !== bCurrent) return bCurrent - aCurrent;
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        return 0;
    });

    if (filtered.length === 0) {
        container.innerHTML = `<p class="text-xs text-slate-400 italic py-4 text-center">Nessun task trovato.</p>`;
        return;
    }

    container.innerHTML = filtered.slice(0, 30).map(t => {
        const title = t.title || t.text || 'Task';
        const aContext = t.contextId || t.projId || t.subprojId;
        const isCurrent = (aContext === currentSubprojId || aContext === currentProjId);
        return `
            <div onclick="insertTaskIntoNote('${t.id}')" class="p-2.5 rounded-xl border border-slate-200 dark:border-darkborder bg-slate-50 dark:bg-[#1a2333] hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-300 dark:hover:border-blue-700 transition cursor-pointer flex items-center justify-between gap-2 group">
                <div class="flex items-center gap-2 min-w-0">
                    <i class="fas ${t.completed ? 'fa-check-circle text-emerald-500' : 'fa-circle text-slate-400 group-hover:text-blue-500'} text-xs shrink-0"></i>
                    <span class="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate ${t.completed ? 'line-through text-slate-400' : ''}">${escapeNoteHtml(title)}</span>
                </div>
                <div class="flex items-center gap-1.5 shrink-0">
                    ${isCurrent ? `<span class="text-[9px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 px-1.5 py-0.5 rounded">Progetto</span>` : ''}
                    <i class="fas fa-plus text-slate-400 group-hover:text-blue-500 text-xs"></i>
                </div>
            </div>
        `;
    }).join('');
}

function insertTaskIntoNote(taskId) {
    const task = (state.data.tasks || []).find(t => t.id === taskId);
    if (!task) return;
    const title = task.title || task.text || 'Task';
    const html = `<span class="note-pill note-task-pill" data-task-id="${task.id}" title="Apri Task: ${escapeNoteHtml(title)}"><i class="fas fa-check-circle"></i> ${escapeNoteHtml(title)}</span>&nbsp;`;
    insertHtmlIntoNotebook(html);
    closeNoteTaskPicker();
}

function openNoteContactPicker() {
    const modal = document.getElementById('noteContactPickerModal');
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    const input = document.getElementById('noteContactSearchInput');
    if (input) {
        input.value = '';
        setTimeout(() => input.focus(), 50);
    }
    renderNoteContactPickerList('');
}

function closeNoteContactPicker() {
    const modal = document.getElementById('noteContactPickerModal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

function renderNoteContactPickerList(query = '') {
    const container = document.getElementById('noteContactPickerList');
    if (!container) return;
    const q = (query || '').toLowerCase().trim();
    const contacts = state.data.contacts || [];

    let filtered = contacts.filter(c => {
        if (!q) return true;
        return (c.name && c.name.toLowerCase().includes(q)) ||
               (c.role && c.role.toLowerCase().includes(q)) ||
               (c.org && c.org.toLowerCase().includes(q)) ||
               (c.email && c.email.toLowerCase().includes(q));
    });

    if (filtered.length === 0) {
        container.innerHTML = `<p class="text-xs text-slate-400 italic py-4 text-center">Nessun contatto trovato.</p>`;
        return;
    }

    container.innerHTML = filtered.slice(0, 30).map(c => {
        return `
            <div onclick="insertContactIntoNote('${c.id}')" class="p-2.5 rounded-xl border border-slate-200 dark:border-darkborder bg-slate-50 dark:bg-[#1a2333] hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:border-purple-300 dark:hover:border-purple-700 transition cursor-pointer flex items-center justify-between gap-2 group">
                <div class="flex items-center gap-2.5 min-w-0">
                    <div class="w-7 h-7 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300 flex items-center justify-center text-xs shrink-0 font-bold">
                        ${c.name ? c.name.charAt(0).toUpperCase() : '<i class="fas fa-user"></i>'}
                    </div>
                    <div class="min-w-0">
                        <p class="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">${escapeNoteHtml(c.name)}</p>
                        <p class="text-[10px] text-slate-400 truncate">${escapeNoteHtml(c.role || c.org || c.email || '')}</p>
                    </div>
                </div>
                <i class="fas fa-plus text-slate-400 group-hover:text-purple-500 text-xs shrink-0"></i>
            </div>
        `;
    }).join('');
}

function insertContactIntoNote(contactId) {
    const contact = (state.data.contacts || []).find(c => c.id === contactId);
    if (!contact) return;
    const html = `<span class="note-pill note-contact-pill" data-contact-id="${contact.id}" title="Contatto: ${escapeNoteHtml(contact.name)}"><i class="fas fa-user"></i> ${escapeNoteHtml(contact.name)}</span>&nbsp;`;
    insertHtmlIntoNotebook(html);
    closeNoteContactPicker();
}

function renderProjectNotebook(type, entityId, entity) {
    const updates = entity.updates || [];
    const updatesCount = updates.length;
    const activeTab = currentNotebookTab || 'active';

    return `
    <div class="project-notebook-card border-t border-slate-200 dark:border-darkborder overflow-hidden transition-all">
        <!-- NOTEBOOK HEADER -->
        <div class="px-5 py-4 bg-slate-50/70 dark:bg-[#1a2333] border-b border-slate-200 dark:border-darkborder flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                    <i class="fas fa-book-open text-sm"></i>
                </div>
                <div>
                    <h3 class="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 uppercase tracking-wider">
                        Quaderno di Lavoro & Note
                    </h3>
                    <p class="text-[11px] text-slate-500 dark:text-slate-400">Workspace integrato per documentazione, appunti veloci e collegamenti</p>
                </div>
            </div>

            <!-- TABS & ACTIONS -->
            <div class="flex items-center gap-2 overflow-x-auto no-scrollbar">
                <div class="flex bg-slate-200/70 dark:bg-slate-800/80 p-1 rounded-xl shrink-0">
                    <button id="notebook-tab-btn-active" onclick="switchNotebookTab('active')" class="notebook-tab-btn ${activeTab === 'active' ? 'active' : ''}">
                        <i class="fas fa-edit text-xs"></i> Documento Attivo
                    </button>
                    <button id="notebook-tab-btn-permanent" onclick="switchNotebookTab('permanent')" class="notebook-tab-btn ${activeTab === 'permanent' ? 'active' : ''}">
                        <i class="fas fa-thumbtack text-xs"></i> Note Fisse
                    </button>
                    <button id="notebook-tab-btn-archive" onclick="switchNotebookTab('archive')" class="notebook-tab-btn ${activeTab === 'archive' ? 'active' : ''}">
                        <i class="fas fa-history text-xs"></i> Archivio <span class="text-[10px] px-1.5 py-0.5 rounded-full ${updatesCount > 0 ? 'bg-blue-500 text-white' : 'bg-slate-300 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}">${updatesCount}</span>
                    </button>
                </div>

                <div class="flex items-center gap-1.5 ml-auto md:ml-2 shrink-0">
                    <button onclick="toggleFocusMode('quill-editor-${type}')" class="text-xs font-bold bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-3 py-2 rounded-xl border border-slate-200 dark:border-darkborder transition shadow-sm" title="Schermo intero senza distrazioni">
                        <i class="fas fa-expand text-xs"></i> <span class="hidden sm:inline ml-1">Zen</span>
                    </button>
                    <button onclick="archiveNotes('${type}', '${entityId}')" class="text-xs font-bold bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-300 px-3 py-2 rounded-xl border border-blue-200 dark:border-blue-800 transition shadow-sm active:scale-95" title="Archivia la versione corrente nello storico">
                        <i class="fas fa-file-archive text-xs"></i> <span class="hidden sm:inline ml-1">Archivia</span>
                    </button>
                </div>
            </div>
        </div>

        <!-- TAB PANEL 1: DOCUMENTO ATTIVO -->
        <div id="notebook-tab-panel-active" class="${activeTab === 'active' ? 'block' : 'hidden'} p-4 md:p-6">
            <!-- QUICK INSERT TOOLBAR -->
            <div class="flex items-center gap-1.5 mb-3 overflow-x-auto no-scrollbar pb-1 text-xs">
                <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 shrink-0 mr-1 flex items-center gap-1">
                    <i class="fas fa-bolt text-amber-500"></i> Inserisci:
                </span>
                <button onclick="insertNoteCallout('idea')" class="px-2.5 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40 font-bold hover:bg-amber-100 transition shrink-0 flex items-center gap-1.5 active:scale-95">
                    💡 <span>Idea</span>
                </button>
                <button onclick="insertNoteCallout('info')" class="px-2.5 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/40 font-bold hover:bg-blue-100 transition shrink-0 flex items-center gap-1.5 active:scale-95">
                    ℹ️ <span>Info</span>
                </button>
                <button onclick="insertNoteCallout('warning')" class="px-2.5 py-1.5 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/40 font-bold hover:bg-red-100 transition shrink-0 flex items-center gap-1.5 active:scale-95">
                    ⚠️ <span>Avviso</span>
                </button>
                <button onclick="insertNoteCallout('success')" class="px-2.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40 font-bold hover:bg-emerald-100 transition shrink-0 flex items-center gap-1.5 active:scale-95">
                    ✅ <span>Decisione</span>
                </button>
                <button onclick="insertNoteQuote()" class="px-2.5 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/40 font-bold hover:bg-indigo-100 transition shrink-0 flex items-center gap-1.5 active:scale-95">
                    ❝ <span>Citazione</span>
                </button>
                <div class="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-1 shrink-0"></div>
                <button onclick="openNoteTaskPicker()" class="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/30 border border-slate-200 dark:border-slate-700 font-bold transition shrink-0 flex items-center gap-1.5 active:scale-95">
                    <i class="fas fa-link text-blue-500"></i> <span>Collega Task</span>
                </button>
                <button onclick="openNoteContactPicker()" class="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-purple-50 hover:text-purple-600 dark:hover:bg-purple-900/30 border border-slate-200 dark:border-slate-700 font-bold transition shrink-0 flex items-center gap-1.5 active:scale-95">
                    <i class="fas fa-user-tag text-purple-500"></i> <span>Menziona Contatto</span>
                </button>
            </div>

            <!-- MAIN QUILL EDITOR CONTAINER -->
            <div class="project-notebook-editor bg-white dark:bg-darkbg rounded-xl border border-slate-200 dark:border-darkborder shadow-inner focus-within:ring-2 focus-within:ring-blue-500/30 transition">
                <div id="quill-editor-${type}" class="min-h-[260px] text-sm"></div>
            </div>

            <!-- FOOTER STATUS & STATS -->
            <div class="flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 mt-2.5 px-1">
                <div class="flex items-center gap-2">
                    <span class="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>Salvataggio automatico continuo</span>
                </div>
                <div class="flex items-center gap-3 font-medium">
                    <span id="notebook-words-${type}">0 parole</span>
                    <span>•</span>
                    <span id="notebook-chars-${type}">0 caratteri</span>
                </div>
            </div>
        </div>

        <!-- TAB PANEL 2: NOTE FISSE E RIFERIMENTI -->
        <div id="notebook-tab-panel-permanent" class="${activeTab === 'permanent' ? 'block' : 'hidden'} p-4 md:p-6">
            <div class="mb-3 p-3 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 rounded-xl text-xs text-blue-800 dark:text-blue-300 flex items-start gap-2.5">
                <i class="fas fa-info-circle text-blue-500 mt-0.5 shrink-0 text-sm"></i>
                <div>
                    <strong>Informazioni Fisse di Riferimento:</strong> Usa questo spazio per appuntare credenziali, link alle risorse, scadenze contrattuali o regole chiave. Questo foglio rimane sempre fisso e non viene svuotato quando archivi il foglio di lavoro attivo.
                </div>
            </div>

            <div class="project-notebook-editor bg-slate-50 dark:bg-[#1f293d] rounded-xl border border-slate-200 dark:border-darkborder shadow-inner">
                <div id="quill-perm-editor-${type}" class="min-h-[160px] text-sm"></div>
            </div>
        </div>

        <!-- TAB PANEL 3: ARCHIVIO STORICO -->
        <div id="notebook-tab-panel-archive" class="${activeTab === 'archive' ? 'block' : 'hidden'} p-4 md:p-6">
            ${renderArchivedNotes(updates, type, entityId)}
        </div>
    </div>
    `;
}

function handleNotesClick(type, id) {
    switchNotebookTab('active');
    const el = document.getElementById(`quill-editor-${type}`);
    if (el && el.__quill) el.__quill.focus();
}

function toggleNotes() {
    switchNotebookTab('active');
}

let mobileNotesContext = { type: null, id: null, quill: null };
function openMobileNotes(type, id) { switchNotebookTab('active'); }
function closeMobileNotes() {}
function saveMobileNotes() {}
function archiveMobileNotes() {}

        // --- CALENDARIO / TIME MANAGEMENT LOGIC ---

function archiveNotes(type, entityId) {
            const e = getEntity(type, entityId);
            if(!e) return;
            const content = e.notes;
            if(!content || content.trim() === '' || content === '<p><br></p>') {
                showToast("Il foglio corrente è vuoto.", "default");
                return;
            }
            if(!e.updates) e.updates = [];
            e.updates.unshift({ id: 'upd_'+Date.now(), date: getISODate(new Date()), content: content });
            e.notes = ''; 
            AppData.triggerSave();
            currentNotebookTab = 'archive';
            render();
            showToast("Foglio archiviato nello storico", "success");
        }

        function deleteArchivedNote(type, entityId, updateId) {
            if(!confirm("Sei sicuro di voler eliminare questa nota archiviata?")) return;
            const e = getEntity(type, entityId);
            if(e && e.updates) {
                e.updates = e.updates.filter(u => u.id !== updateId);
                AppData.triggerSave();
                render();
                showToast("Nota eliminata", "success");
            }
        }

        function openArchiveModal(type, entityId, updateId) {
            const e = getEntity(type, entityId);
            if(!e || !e.updates) return;
            const upd = e.updates.find(u => u.id === updateId);
            if(!upd) return;

            currentArchiveEdit = { type, entityId, updateId };
            document.getElementById('archiveViewDate').innerText = "Data: " + upd.date;
            document.getElementById('archiveEditIndicator').classList.add('hidden');
            
            document.getElementById('archiveViewModal').classList.remove('hidden');
            document.getElementById('archiveViewModal').classList.add('flex');

            if(!archiveQuill) {
                const tOpts = [['bold', 'italic', 'underline', 'strike'], ['blockquote', 'code-block'], [{ 'list': 'ordered'}, { 'list': 'bullet' }], [{ 'color': [] }, { 'background': [] }], ['link'], ['clean']];
                archiveQuill = new Quill('#quill-archive-editor', { theme: 'snow', modules: { toolbar: tOpts } });
                archiveQuill.on('text-change', function(delta, oldDelta, source) {
                    if(source === 'user') document.getElementById('archiveEditIndicator').classList.remove('hidden');
                });
            }
            archiveQuill.root.innerHTML = upd.content;
        }

        function closeArchiveModal() {
            document.getElementById('archiveViewModal').classList.add('hidden');
            document.getElementById('archiveViewModal').classList.remove('flex');
            currentArchiveEdit = { type: null, entityId: null, updateId: null };
        }

        function saveArchiveEdit() {
            if(!currentArchiveEdit.entityId) return;
            const e = getEntity(currentArchiveEdit.type, currentArchiveEdit.entityId);
            if(e && e.updates) {
                const upd = e.updates.find(u => u.id === currentArchiveEdit.updateId);
                if(upd) {
                    upd.content = archiveQuill.root.innerHTML;
                    AppData.triggerSave();
                    document.getElementById('archiveEditIndicator').classList.add('hidden');
                    showToast("Archivio aggiornato", "success");
                    render();
                }
            }
        }

        function renderArchivedNotes(updates, type, entityId) {
    if(!updates || updates.length === 0) {
        return `
            <div class="py-10 text-center text-slate-400 dark:text-slate-500">
                <div class="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 mx-auto flex items-center justify-center text-slate-400 mb-3">
                    <i class="fas fa-file-archive text-lg"></i>
                </div>
                <p class="text-xs font-bold text-slate-700 dark:text-slate-300">Nessuna versione archiviata</p>
                <p class="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto">Quando completi una sessione di note o vuoi congelare lo stato, clicca su "Archivia" per salvare uno snapshot storico.</p>
            </div>
        `;
    }

    let html = `
        <div class="space-y-3">
            <div class="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider mb-2">
                <span><i class="fas fa-history mr-1.5 text-blue-500"></i> Versioni Salvate nello Storico</span>
                <span class="text-[11px] font-mono">${updates.length} snapshot</span>
            </div>
    `;
    updates.forEach(u => {
        let plainText = (u.content || '').replace(/<[^>]*>?/gm, '').trim();
        let preview = plainText.substring(0, 140);
        if(plainText.length > 140) preview += '...';
        if(!preview) preview = 'Contenuto formattato o multimediale';
        html += `
            <div class="p-4 bg-slate-50 dark:bg-[#202938] border border-slate-200 dark:border-darkborder rounded-xl group hover:shadow-sm transition">
                <div class="flex items-start justify-between gap-3">
                    <div class="flex-1 min-w-0 cursor-pointer" onclick="openArchiveModal('${type}', '${entityId}', '${u.id}')">
                        <div class="flex items-center gap-2 mb-1.5">
                            <span class="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                <i class="far fa-calendar-alt text-blue-500"></i> ${u.date}
                            </span>
                            <span class="text-[10px] text-slate-400 bg-slate-200/60 dark:bg-slate-700/60 px-2 py-0.5 rounded-md font-mono">
                                ${plainText.length} caratteri
                            </span>
                        </div>
                        <p class="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">${escapeNoteHtml(preview)}</p>
                    </div>
                    <div class="flex items-center gap-1 shrink-0">
                        <button onclick="openArchiveModal('${type}', '${entityId}', '${u.id}')" class="text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1" title="Visualizza / Modifica Snapshot">
                            <i class="fas fa-eye text-xs"></i> <span class="hidden sm:inline">Visualizza</span>
                        </button>
                        <button onclick="deleteArchivedNote('${type}', '${entityId}', '${u.id}')" class="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 p-2 rounded-lg transition" title="Elimina questo snapshot">
                            <i class="fas fa-trash text-xs"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    });
    html += `</div>`;
    return html;
}

function initQuillEditors() {
    const tOpts = [['bold', 'italic', 'underline', 'strike'], ['blockquote', 'code-block'], [{ 'list': 'ordered'}, { 'list': 'bullet' }], [{ 'color': [] }, { 'background': [] }], ['link'], ['clean']];
    
    ['sphere', 'project', 'subproject'].forEach(type => {
        const id = type === 'sphere' ? state.path.sphereId : (type === 'project' ? state.path.projId : state.path.subprojId);
        if (!id) return;
        const entity = getEntity(type, id);
        if(!entity) return;

        if (type !== 'sphere') {
            const el = document.getElementById(`quill-editor-${type}`);
            if (el) {
                el.__quill = new Quill(el, { theme: 'snow', modules: { toolbar: tOpts }, placeholder: 'Inizia a scrivere nel quaderno di lavoro...' });
                el.__quill.root.innerHTML = entity.notes || '';
                updateNotebookStats(el.__quill, type);
                el.__quill.on('text-change', function(delta, oldDelta, source) { 
                    if (source === 'user') {
                        entity.notes = el.__quill.root.innerHTML; 
                        AppData.triggerSave(); 
                        updateNotebookStats(el.__quill, type);
                    }
                });
            }
        }

        const permEl = document.getElementById(`quill-perm-editor-${type}`);
        if (permEl) {
            permEl.__quill = new Quill(permEl, { theme: 'snow', modules: { toolbar: tOpts }, placeholder: 'Scrivi qui le informazioni chiave permanenti...' });
            permEl.__quill.root.innerHTML = entity.permanentNotes || '';
            permEl.__quill.on('text-change', function(delta, oldDelta, source) { 
                if (source === 'user') {
                    entity.permanentNotes = permEl.__quill.root.innerHTML; 
                    AppData.triggerSave(); 
                }
            });
        }
    });
}

if (typeof window !== 'undefined' && !window.__notebookDelegatedListenerAttached) {
    window.__notebookDelegatedListenerAttached = true;
    document.addEventListener('click', function(e) {
        const taskPill = e.target.closest('[data-task-id]');
        if (taskPill) {
            const taskId = taskPill.getAttribute('data-task-id');
            if (taskId) {
                e.stopPropagation();
                if (typeof editTask === 'function') editTask(taskId);
                return;
            }
        }
        const contactPill = e.target.closest('[data-contact-id]');
        if (contactPill) {
            const contactId = contactPill.getAttribute('data-contact-id');
            if (contactId) {
                e.stopPropagation();
                if (typeof openContactModal === 'function') openContactModal(contactId);
                return;
            }
        }
    });
}

        function togglePin(type, id) { 
            const e = getEntity(type, id);
            if(e) { e.pinned = !e.pinned; AppData.triggerSave(); render(); }
        }
        function toggleArchiveEntity(type, id) { 
            const e = getEntity(type, id);
            if(e) { e.archived = !e.archived; AppData.triggerSave(); render(); }
        }

        // --- TASKS ---
