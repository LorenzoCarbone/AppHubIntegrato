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

// --- REGISTRAZIONE BLOTS PERSONALIZZATI PER QUILL 1.3.6 ---
if (typeof Quill !== 'undefined') {
    try {
        const Embed = Quill.import('blots/embed');
        const BlockEmbed = Quill.import('blots/block/embed');

        // Blot Pillole Interattive (Task, Contatti, Pagine Wiki)
        class NotePillBlot extends Embed {
            static create(value) {
                const node = super.create();
                node.setAttribute('contenteditable', 'false');
                const type = (value && value.type) ? value.type : 'task';
                node.setAttribute('class', `note-pill note-${type}-pill`);

                if (value.taskId) {
                    node.setAttribute('data-task-id', value.taskId);
                    const t = (state.data.tasks || []).find(x => x.id === value.taskId);
                    const isCompleted = t ? (t.completed || t.status === 'done') : false;
                    const taskTitle = t ? (t.title || t.text || 'Task') : (value.title || 'Task');
                    if (isCompleted) node.classList.add('is-completed');
                    node.setAttribute('title', `Task: ${taskTitle} (Clicca sul testo per dettagli)`);
                    node.innerHTML = `<input type="checkbox" class="note-task-chk" ${isCompleted ? 'checked' : ''} onclick="event.stopPropagation(); toggleTaskFromPill('${value.taskId}', this)"/><span class="note-task-title ${isCompleted ? 'line-through text-slate-400 dark:text-darkmuted opacity-60' : ''}">${escapeNoteHtml(taskTitle)}</span>`;
                } else if (value.contactId) {
                    node.setAttribute('data-contact-id', value.contactId);
                    node.setAttribute('title', `Contatto: ${value.name || value.title || ''}`);
                    node.innerHTML = `<i class="fas fa-user text-purple-500 mr-1"></i><span>${escapeNoteHtml(value.name || value.title || 'Contatto')}</span>`;
                } else if (value.pageId) {
                    node.setAttribute('data-page-id', value.pageId);
                    node.setAttribute('title', `Apri Pagina: ${value.title || ''}`);
                    node.innerHTML = `<i class="fas fa-file-alt text-purple-600 dark:text-purple-400 mr-1"></i><span>${escapeNoteHtml(value.title || 'Pagina')}</span>`;
                }
                return node;
            }

            static value(node) {
                const titleSpan = node.querySelector('.note-task-title');
                const rawTitle = titleSpan ? titleSpan.textContent : node.textContent;
                return {
                    taskId: node.getAttribute('data-task-id'),
                    contactId: node.getAttribute('data-contact-id'),
                    pageId: node.getAttribute('data-page-id'),
                    type: node.classList.contains('note-task-pill') ? 'task' : (node.classList.contains('note-contact-pill') ? 'contact' : 'page'),
                    title: rawTitle.trim()
                };
            }
        }
        NotePillBlot.blotName = 'note-pill';
        NotePillBlot.tagName = 'span';
        NotePillBlot.className = 'note-pill';
        Quill.register(NotePillBlot, true);

        // Blot Callout Notifiche / Idee / Avvisi
        class CalloutBlot extends BlockEmbed {
            static create(value) {
                const node = super.create();
                const type = (typeof value === 'object' && value.type) ? value.type : (value || 'idea');
                const text = (typeof value === 'object' && value.text) ? value.text : '';
                node.setAttribute('class', `note-callout note-callout-${type}`);
                node.setAttribute('data-callout-type', type);

                const titles = { idea: '💡 Idea:', info: 'ℹ️ Informazione:', warning: '⚠️ Attenzione:', success: '✅ Decisione:' };
                const label = titles[type] || 'Nota:';

                node.innerHTML = `<strong>${label}</strong> <span class="note-callout-text" contenteditable="true">${text || 'Scrivi qui la tua annotazione...'}</span>`;
                return node;
            }

            static value(node) {
                const textSpan = node.querySelector('.note-callout-text');
                return {
                    type: node.getAttribute('data-callout-type') || 'idea',
                    text: textSpan ? textSpan.innerHTML : ''
                };
            }
        }
        CalloutBlot.blotName = 'callout';
        CalloutBlot.tagName = 'div';
        CalloutBlot.className = 'note-callout';
        Quill.register(CalloutBlot, true);

        // Blot Divisore Orizzontale
        class DividerBlot extends BlockEmbed {
            static create() {
                const node = super.create();
                node.setAttribute('class', 'note-divider my-4 border-slate-200 dark:border-darkborder');
                return node;
            }
        }
        DividerBlot.blotName = 'divider';
        DividerBlot.tagName = 'hr';
        DividerBlot.className = 'note-divider';
        Quill.register(DividerBlot, true);
    } catch(err) {
        console.warn("Inizializzazione Blots Quill:", err);
    }
}

// --- STATO GLOBALE NOTEBOOK & AUTOCOMPLETE ---
let currentNotebookTab = 'active';
let activeSubpageId = null;
let lastActiveNotebookQuill = null;
let lastNotebookSelection = null;

const slashMenuState = {
    isOpen: false,
    startIndex: 0,
    length: 0,
    quill: null,
    filteredCommands: [],
    selectedIndex: 0
};

const wikiLinkState = {
    isOpen: false,
    startIndex: 0,
    length: 0,
    quill: null,
    filteredPages: [],
    selectedIndex: 0
};

// Comandi Slash Menu (Notion-style)
const slashCommands = [
    { id: 'h1', title: 'Titolo 1', desc: 'Intestazione principale grande', icon: 'fa-heading', category: 'Testo', action: (q, idx) => { q.formatLine(idx, 1, 'header', 1); } },
    { id: 'h2', title: 'Titolo 2', desc: 'Intestazione media di sezione', icon: 'fa-heading', category: 'Testo', action: (q, idx) => { q.formatLine(idx, 1, 'header', 2); } },
    { id: 'h3', title: 'Titolo 3', desc: 'Intestazione secondaria piccola', icon: 'fa-heading', category: 'Testo', action: (q, idx) => { q.formatLine(idx, 1, 'header', 3); } },
    { id: 'bullet', title: 'Elenco Puntato', desc: 'Lista con punti elenco', icon: 'fa-list-ul', category: 'Liste', action: (q, idx) => { q.formatLine(idx, 1, 'list', 'bullet'); } },
    { id: 'ordered', title: 'Elenco Numerato', desc: 'Lista sequenziale numerata', icon: 'fa-list-ol', category: 'Liste', action: (q, idx) => { q.formatLine(idx, 1, 'list', 'ordered'); } },
    { id: 'quote', title: 'Citazione', desc: 'Blocco citazione in rilievo', icon: 'fa-quote-left', category: 'Testo', action: (q, idx) => { q.formatLine(idx, 1, 'blockquote', true); } },
    { id: 'code', title: 'Blocco di Codice', desc: 'Frammento di codice formattato', icon: 'fa-code', category: 'Testo', action: (q, idx) => { q.formatLine(idx, 1, 'code-block', true); } },
    { id: 'divider', title: 'Linea Divisoria', desc: 'Separatore orizzontale visivo', icon: 'fa-minus', category: 'Testo', action: (q, idx) => { insertNoteDivider(); } },
    { id: 'callout-idea', title: 'Callout Idea 💡', desc: 'Riquadro per spunti e intuizioni', icon: 'fa-lightbulb', category: 'Callout', action: (q, idx) => { insertNoteCallout('idea'); } },
    { id: 'callout-info', title: 'Callout Info ℹ️', desc: 'Riquadro per informazioni chiave', icon: 'fa-info-circle', category: 'Callout', action: (q, idx) => { insertNoteCallout('info'); } },
    { id: 'callout-warning', title: 'Callout Avviso ⚠️', desc: 'Riquadro per avvertenze e rischi', icon: 'fa-exclamation-triangle', category: 'Callout', action: (q, idx) => { insertNoteCallout('warning'); } },
    { id: 'callout-success', title: 'Callout Decisione ✅', desc: 'Riquadro per decisioni prese', icon: 'fa-check-circle', category: 'Callout', action: (q, idx) => { insertNoteCallout('success'); } },
    { id: 'link-task', title: 'Collega Task', desc: 'Inserisci pillola interattiva task', icon: 'fa-tasks', category: 'Collegamenti', action: (q, idx) => { openNoteTaskPicker(); } },
    { id: 'mention-contact', title: 'Menziona Contatto', desc: 'Inserisci pillola interattiva contatto', icon: 'fa-user-tag', category: 'Collegamenti', action: (q, idx) => { openNoteContactPicker(); } },
    { id: 'link-page', title: 'Collega Sottopagina ([[)', desc: 'Collega un\'altra pagina di progetto (Wiki)', icon: 'fa-file-alt', category: 'Collegamenti', action: (q, idx) => { openNotePagePicker(); } }
];

function switchNotebookTab(tabName) {
    if (tabName === 'permanent') tabName = 'active';
    currentNotebookTab = tabName;
    ['active', 'pages'].forEach(t => {
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
    if (activeSubpageId) {
        const subEl = document.getElementById('quill-subpage-editor');
        if (subEl && subEl.__quill) return subEl.__quill;
    }
    const type = state.path.subprojId ? 'subproject' : (state.path.projId ? 'project' : null);
    if (!type) return lastActiveNotebookQuill || null;

    const el = document.getElementById(`quill-editor-${type}`);
    if (el && el.__quill) return el.__quill;

    return lastActiveNotebookQuill || null;
}

function saveActiveNotebookContent() {
    const q = getActiveNotebookQuill();
    if (!q) return;

    if (activeSubpageId) {
        const page = (state.data.pages || []).find(p => p.id === activeSubpageId);
        if (page) {
            page.content = q.root.innerHTML;
            page.updatedAt = getISODate(new Date());
            AppData.triggerSave();
            updateNotebookStats(q, 'subpage');
        }
        return;
    }

    const type = state.path.subprojId ? 'subproject' : (state.path.projId ? 'project' : null);
    const id = state.path.subprojId || state.path.projId;
    if (!type || !id) return;
    const entity = getEntity(type, id);
    if (!entity) return;

    entity.notes = q.root.innerHTML;
    AppData.triggerSave();
    updateNotebookStats(q, type);
}

function updateNotebookStats(quill, type) {
    if (!quill) return;
    const text = quill.getText() || '';
    const trimmed = text.trim();
    const charCount = trimmed ? trimmed.length : 0;
    const wordCount = trimmed ? trimmed.split(/\s+/).filter(Boolean).length : 0;

    const charEl = document.getElementById(type === 'subpage' ? 'subpage-notebook-chars' : `notebook-chars-${type}`);
    const wordEl = document.getElementById(type === 'subpage' ? 'subpage-notebook-words' : `notebook-words-${type}`);
    if (charEl) charEl.textContent = `${charCount} caratteri`;
    if (wordEl) wordEl.textContent = `${wordCount} parole`;
}

// Helper per ottenere il nome del contesto (Progetto/Sottoprogetto) per una pagina
function getPageContextName(contextId) {
    if (!contextId) return 'Generale';
    const sp = (state.data.subprojects || []).find(x => x.id === contextId);
    if (sp) {
        const p = (state.data.projects || []).find(x => x.id === sp.projectId);
        return `${p ? p.name : 'Progetto'} > ${sp.name}`;
    }
    const p = (state.data.projects || []).find(x => x.id === contextId);
    if (p) return p.name;
    const s = (state.data.spheres || []).find(x => x.id === contextId);
    if (s) return s.name;
    return 'Progetto';
}

// --- AUTOCOMPLETE: GESTIONE SLASH MENU E WIKI-LINK DROPDOWN ---
function attachQuillAutocomplete(quill) {
    if (!quill || quill.__autocompleteAttached) return;
    quill.__autocompleteAttached = true;

    quill.on('selection-change', function(range, oldRange, source) {
        if (range) {
            lastActiveNotebookQuill = quill;
            lastNotebookSelection = range;
        }
    });

    quill.root.addEventListener('keydown', function(e) {
        // Navigazione tastiera Slash Menu
        if (slashMenuState.isOpen) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                moveSlashMenuHighlight(1);
                return;
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                moveSlashMenuHighlight(-1);
                return;
            } else if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                selectHighlightedSlashCommand(quill);
                return;
            } else if (e.key === 'Escape') {
                closeSlashMenu();
                return;
            }
        }

        // Navigazione tastiera Wiki-Link Menu
        if (wikiLinkState.isOpen) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                moveWikiLinkHighlight(1);
                return;
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                moveWikiLinkHighlight(-1);
                return;
            } else if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                selectHighlightedWikiLink(quill);
                return;
            } else if (e.key === 'Escape') {
                closeWikiLinkDropdown();
                return;
            }
        }
    });

    quill.on('text-change', function(delta, oldDelta, source) {
        if (source !== 'user') return;
        const sel = quill.getSelection();
        if (!sel) {
            closeSlashMenu();
            closeWikiLinkDropdown();
            return;
        }

        const cursor = sel.index;
        const textBefore = quill.getText(Math.max(0, cursor - 60), Math.min(60, cursor));

        // 1. Rileva Wiki-link: [[...
        const wikiMatch = textBefore.match(/\[\[([^\]\n]*)$/);
        if (wikiMatch) {
            const query = wikiMatch[1];
            const startIndex = cursor - wikiMatch[0].length;
            wikiLinkState.isOpen = true;
            wikiLinkState.startIndex = startIndex;
            wikiLinkState.length = wikiMatch[0].length;
            wikiLinkState.quill = quill;
            showWikiLinkDropdown(quill, cursor, query);
            closeSlashMenu();
            return;
        } else {
            closeWikiLinkDropdown();
        }

        // 2. Rileva Slash command: /(comando)
        const slashMatch = textBefore.match(/(?:^|\s)\/([a-zA-Z0-9_-]*)$/);
        if (slashMatch) {
            const query = slashMatch[1];
            const matchedFull = slashMatch[0];
            const slashOffset = matchedFull.indexOf('/');
            const startIndex = cursor - (matchedFull.length - slashOffset);
            slashMenuState.isOpen = true;
            slashMenuState.startIndex = startIndex;
            slashMenuState.length = cursor - startIndex;
            slashMenuState.quill = quill;
            showSlashMenu(quill, cursor, query);
            return;
        } else {
            closeSlashMenu();
        }
    });
}

// --- SLASH COMMANDS LOGIC ---
function showSlashMenu(quill, cursor, query) {
    const menu = document.getElementById('quillSlashMenu');
    if (!menu) return;

    const bounds = quill.getBounds(cursor);
    const containerRect = quill.container.getBoundingClientRect();
    
    let top = containerRect.top + bounds.bottom + 6;
    let left = containerRect.left + bounds.left;

    if (left + 300 > window.innerWidth) left = window.innerWidth - 310;
    if (left < 10) left = 10;
    if (top + 340 > window.innerHeight) top = Math.max(10, containerRect.top + bounds.top - 340);

    menu.style.top = `${top}px`;
    menu.style.left = `${left}px`;

    const q = (query || '').toLowerCase().trim();
    const filtered = slashCommands.filter(c => {
        if (!q) return true;
        return c.id.toLowerCase().includes(q) ||
               c.title.toLowerCase().includes(q) ||
               c.desc.toLowerCase().includes(q) ||
               c.category.toLowerCase().includes(q);
    });

    slashMenuState.filteredCommands = filtered;
    if (slashMenuState.selectedIndex < 0 || slashMenuState.selectedIndex >= filtered.length) {
        slashMenuState.selectedIndex = 0;
    }

    if (filtered.length === 0) {
        menu.innerHTML = `<div class="p-3 text-xs text-slate-400 italic text-center">Nessun comando trovato</div>`;
        menu.classList.remove('hidden');
        return;
    }

    let html = '';
    let currentCategory = '';
    filtered.forEach((cmd, idx) => {
        if (cmd.category !== currentCategory) {
            currentCategory = cmd.category;
            html += `<div class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase px-2.5 pt-2 pb-1 tracking-wider">${currentCategory}</div>`;
        }
        const isSel = idx === slashMenuState.selectedIndex;
        html += `
            <div class="slash-item ${isSel ? 'selected' : ''}" data-index="${idx}" onmousedown="event.preventDefault(); selectSlashCommandByIndex(${idx})">
                <div class="slash-item-icon text-blue-500 dark:text-blue-400">
                    <i class="fas ${cmd.icon}"></i>
                </div>
                <div class="flex-1 min-w-0">
                    <div class="font-bold text-xs text-slate-800 dark:text-slate-200 truncate">${escapeNoteHtml(cmd.title)}</div>
                    <div class="text-[10px] text-slate-400 dark:text-slate-500 truncate">${escapeNoteHtml(cmd.desc)}</div>
                </div>
            </div>
        `;
    });

    menu.innerHTML = html;
    menu.classList.remove('hidden');

    const selEl = menu.querySelector('.slash-item.selected');
    if (selEl) selEl.scrollIntoView({ block: 'nearest' });
}

function closeSlashMenu() {
    slashMenuState.isOpen = false;
    const menu = document.getElementById('quillSlashMenu');
    if (menu) menu.classList.add('hidden');
}

function moveSlashMenuHighlight(direction) {
    if (!slashMenuState.filteredCommands || slashMenuState.filteredCommands.length === 0) return;
    const len = slashMenuState.filteredCommands.length;
    slashMenuState.selectedIndex = (slashMenuState.selectedIndex + direction + len) % len;
    
    const menu = document.getElementById('quillSlashMenu');
    if (!menu) return;
    const items = menu.querySelectorAll('.slash-item');
    items.forEach((item, idx) => {
        item.classList.toggle('selected', idx === slashMenuState.selectedIndex);
        if (idx === slashMenuState.selectedIndex) item.scrollIntoView({ block: 'nearest' });
    });
}

function selectHighlightedSlashCommand(quill) {
    if (slashMenuState.selectedIndex >= 0 && slashMenuState.filteredCommands.length > slashMenuState.selectedIndex) {
        selectSlashCommandByIndex(slashMenuState.selectedIndex);
    }
}

function selectSlashCommandByIndex(idx) {
    if (!slashMenuState.filteredCommands || !slashMenuState.filteredCommands[idx]) return;
    const cmd = slashMenuState.filteredCommands[idx];
    const q = slashMenuState.quill || getActiveNotebookQuill();
    if (!q) return;

    const start = slashMenuState.startIndex;
    const len = slashMenuState.length;
    closeSlashMenu();

    q.focus();
    if (len > 0) {
        q.deleteText(start, len);
    }
    cmd.action(q, start);
    saveActiveNotebookContent();
}

// --- WIKI-LINK DROPDOWN LOGIC ---
function showWikiLinkDropdown(quill, cursor, query) {
    const menu = document.getElementById('wikiLinkDropdown');
    if (!menu) return;

    const bounds = quill.getBounds(cursor);
    const containerRect = quill.container.getBoundingClientRect();
    
    let top = containerRect.top + bounds.bottom + 6;
    let left = containerRect.left + bounds.left;

    if (left + 330 > window.innerWidth) left = window.innerWidth - 340;
    if (left < 10) left = 10;
    if (top + 340 > window.innerHeight) top = Math.max(10, containerRect.top + bounds.top - 340);

    menu.style.top = `${top}px`;
    menu.style.left = `${left}px`;

    const q = (query || '').toLowerCase().trim();
    const allPages = state.data.pages || [];
    const currentEntityId = state.path.subprojId || state.path.projId;
    wikiLinkState.query = query ? query.trim() : '';

    let matchingPages = allPages.filter(p => {
        if (!q) return true;
        const parentName = getPageContextName(p.contextId);
        return (p.title && p.title.toLowerCase().includes(q)) ||
               (parentName && parentName.toLowerCase().includes(q));
    });

    const items = [];
    matchingPages.slice(0, 15).forEach(p => {
        items.push({ type: 'page', page: p });
    });

    // Se l'utente ha digitato del testo e non c'è una pagina esattamente identica, proponi "Crea nuova pagina"
    const hasExactMatch = matchingPages.some(p => (p.title || '').trim().toLowerCase() === q);
    if (q && !hasExactMatch) {
        items.push({ type: 'create', title: query.trim() });
    }

    wikiLinkState.items = items;
    if (wikiLinkState.selectedIndex < 0 || wikiLinkState.selectedIndex >= items.length) {
        wikiLinkState.selectedIndex = 0;
    }

    let html = `
        <div class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase px-2.5 pt-1.5 pb-1 tracking-wider flex justify-between items-center border-b border-slate-100 dark:border-slate-800 mb-1">
            <span><i class="fas fa-file-alt text-purple-500 mr-1"></i> Collega Pagina (Wiki)</span>
            <span class="text-[9px] font-mono">${matchingPages.length} pagine</span>
        </div>
    `;

    if (items.length === 0) {
        html += `<div class="p-3 text-xs text-slate-400 italic text-center">Nessuna pagina trovata</div>`;
    } else {
        items.forEach((item, idx) => {
            const isSel = idx === wikiLinkState.selectedIndex;
            if (item.type === 'page') {
                const p = item.page;
                const parentName = getPageContextName(p.contextId);
                const isCurrent = p.contextId === currentEntityId;
                html += `
                    <div class="wiki-item ${isSel ? 'selected' : ''}" data-index="${idx}" onmousedown="event.preventDefault(); selectWikiPageByIndex(${idx})">
                        <div class="w-7 h-7 rounded-lg bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300 flex items-center justify-center text-xs shrink-0 font-bold">
                            <i class="fas fa-file-alt"></i>
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="font-bold text-xs text-slate-800 dark:text-slate-200 truncate">${escapeNoteHtml(p.title)}</div>
                            <div class="text-[10px] text-slate-400 dark:text-slate-500 truncate flex items-center gap-1.5">
                                <span>${escapeNoteHtml(parentName)}</span>
                                ${isCurrent ? '<span class="text-[9px] bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 px-1 rounded font-bold">Questo progetto</span>' : ''}
                            </div>
                        </div>
                    </div>
                `;
            } else if (item.type === 'create') {
                html += `
                    <div class="border-t border-slate-200 dark:border-darkborder mt-1 pt-1">
                        <div class="wiki-item ${isSel ? 'selected' : ''} text-purple-600 dark:text-purple-400 font-bold" data-index="${idx}" onmousedown="event.preventDefault(); selectWikiPageByIndex(${idx})">
                            <div class="w-7 h-7 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-300 flex items-center justify-center text-xs shrink-0">
                                <i class="fas fa-plus"></i>
                            </div>
                            <div class="text-xs truncate">Crea nuova pagina "<strong>${escapeNoteHtml(item.title)}</strong>"</div>
                        </div>
                    </div>
                `;
            }
        });
    }

    menu.innerHTML = html;
    menu.classList.remove('hidden');

    const selEl = menu.querySelector('.wiki-item.selected');
    if (selEl) selEl.scrollIntoView({ block: 'nearest' });
}

function closeWikiLinkDropdown() {
    wikiLinkState.isOpen = false;
    const menu = document.getElementById('wikiLinkDropdown');
    if (menu) menu.classList.add('hidden');
}

function moveWikiLinkHighlight(direction) {
    if (!wikiLinkState.items || wikiLinkState.items.length === 0) return;
    const len = wikiLinkState.items.length;
    wikiLinkState.selectedIndex = (wikiLinkState.selectedIndex + direction + len) % len;
    
    const menu = document.getElementById('wikiLinkDropdown');
    if (!menu) return;
    const items = menu.querySelectorAll('.wiki-item');
    items.forEach((item, idx) => {
        item.classList.toggle('selected', idx === wikiLinkState.selectedIndex);
        if (idx === wikiLinkState.selectedIndex) item.scrollIntoView({ block: 'nearest' });
    });
}

function selectHighlightedWikiLink(quill) {
    if (wikiLinkState.items && wikiLinkState.items.length > 0 && wikiLinkState.selectedIndex >= 0 && wikiLinkState.items[wikiLinkState.selectedIndex]) {
        selectWikiPageByIndex(wikiLinkState.selectedIndex);
    } else if (wikiLinkState.query) {
        createAndLinkNewPage(wikiLinkState.query);
    }
}

function selectWikiPageByIndex(idx) {
    if (!wikiLinkState.items || !wikiLinkState.items[idx]) return;
    const item = wikiLinkState.items[idx];
    if (item.type === 'create') {
        createAndLinkNewPage(item.title);
    } else {
        const page = item.page;
        const q = wikiLinkState.quill || getActiveNotebookQuill();
        if (!q) return;

        const start = wikiLinkState.startIndex;
        const len = wikiLinkState.length;
        closeWikiLinkDropdown();

        q.focus();
        if (len > 0) {
            q.deleteText(start, len);
        }
        q.insertEmbed(start, 'note-pill', { type: 'page', pageId: page.id, title: page.title || 'Pagina' });
        q.insertText(start + 1, ' ');
        q.setSelection(start + 2);
        saveActiveNotebookContent();
    }
}

function createAndLinkNewPage(title) {
    const q = wikiLinkState.quill || getActiveNotebookQuill();
    const currentEntityId = state.path.subprojId || state.path.projId || (state.data.projects && state.data.projects[0] ? state.data.projects[0].id : null);

    const now = getISODate(new Date());
    const newPage = {
        id: 'page_' + Date.now(),
        contextId: currentEntityId,
        title: title || 'Nuova Pagina',
        content: '<p></p>',
        tags: [],
        createdAt: now,
        updatedAt: now
    };
    if (!state.data.pages) state.data.pages = [];
    state.data.pages.push(newPage);
    AppData.triggerSave();

    const start = wikiLinkState.startIndex;
    const len = wikiLinkState.length;
    closeWikiLinkDropdown();

    if (q) {
        q.focus();
        if (len > 0) {
            q.deleteText(start, len);
        }
        q.insertEmbed(start, 'note-pill', { type: 'page', pageId: newPage.id, title: newPage.title });
        q.insertText(start + 1, ' ');
        q.setSelection(start + 2);
        saveActiveNotebookContent();
    }
    showToast(`Pagina "${newPage.title}" creata e collegata`, "success");
}

// --- AZIONI DI INSERIMENTO ROBUSTE (QUILL API) ---
function insertNoteCallout(type) {
    const q = getActiveNotebookQuill();
    if (!q) {
        showToast("Editor non pronto o non visibile", "default");
        return;
    }
    q.focus();
    const sel = q.getSelection() || lastNotebookSelection || { index: q.getLength() - 1, length: 0 };
    const idx = sel.index;

    q.insertEmbed(idx, 'callout', { type: type, text: '' });
    q.insertText(idx + 1, '\n');
    q.setSelection(idx + 2);
    saveActiveNotebookContent();
    showToast("Callout inserito", "success");
}

function insertNoteQuote() {
    const q = getActiveNotebookQuill();
    if (!q) return;
    q.focus();
    const sel = q.getSelection() || lastNotebookSelection || { index: q.getLength() - 1, length: 0 };
    const format = q.getFormat(sel.index, 1);
    q.formatLine(sel.index, 1, 'blockquote', !format.blockquote);
    saveActiveNotebookContent();
}

function insertNoteDivider() {
    const q = getActiveNotebookQuill();
    if (!q) return;
    q.focus();
    const sel = q.getSelection() || lastNotebookSelection || { index: q.getLength() - 1, length: 0 };
    const idx = sel.index;
    q.insertEmbed(idx, 'divider', true);
    q.insertText(idx + 1, '\n');
    q.setSelection(idx + 2);
    saveActiveNotebookContent();
}

// Modal Selettore Task per Note
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

function createNewTaskAndInsertIntoNote(title) {
    const q = getActiveNotebookQuill();
    const currentEntityId = state.path.subprojId || state.path.projId || (state.data.projects && state.data.projects[0] ? state.data.projects[0].id : null);
    const taskTitle = (title || '').trim() || 'Nuova Task';

    const newTask = {
        id: 't_' + Date.now(),
        title: taskTitle,
        contextId: currentEntityId || null,
        priority: 0,
        status: 'todo',
        completed: false,
        createdAt: getISODate(new Date()),
        subtasks: []
    };

    if (!state.data.tasks) state.data.tasks = [];
    state.data.tasks.push(newTask);
    AppData.triggerSave();

    insertTaskIntoNote(newTask.id);
    showToast(`Task "${taskTitle}" creata e collegata`, "success");
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

    const createActionHtml = `
        <div onclick="createNewTaskAndInsertIntoNote(document.getElementById('noteTaskSearchInput')?.value)" class="p-2.5 rounded-xl border border-dashed border-blue-400 dark:border-blue-600 bg-blue-50/70 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-700 dark:text-blue-300 transition cursor-pointer flex items-center justify-between gap-2 mb-2 font-bold text-xs group active:scale-95">
            <div class="flex items-center gap-2 min-w-0">
                <i class="fas fa-plus-circle text-blue-500"></i>
                <span class="truncate">Crea "${q ? escapeNoteHtml(query.trim()) : 'nuova task'}" e inserisci</span>
            </div>
            <span class="text-[9px] bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200 px-1.5 py-0.5 rounded font-mono uppercase">Invio / Crea</span>
        </div>
    `;

    if (filtered.length === 0) {
        container.innerHTML = createActionHtml + `<p class="text-xs text-slate-400 italic py-3 text-center">Nessun altro task esistente trovato con questo nome.</p>`;
        return;
    }

    container.innerHTML = createActionHtml + filtered.slice(0, 30).map(t => {
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
    const q = getActiveNotebookQuill();
    if (!q) return;

    q.focus();
    const sel = lastNotebookSelection || q.getSelection() || { index: q.getLength() - 1, length: 0 };
    const idx = sel.index;
    q.insertEmbed(idx, 'note-pill', { type: 'task', taskId: task.id, title: task.title || task.text || 'Task' });
    q.insertText(idx + 1, ' ');
    q.setSelection(idx + 2);
    closeNoteTaskPicker();
    saveActiveNotebookContent();
    showToast("Task collegato", "success");
}

// Modal Selettore Contatti per Note
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
    const q = getActiveNotebookQuill();
    if (!q) return;

    q.focus();
    const sel = lastNotebookSelection || q.getSelection() || { index: q.getLength() - 1, length: 0 };
    const idx = sel.index;
    q.insertEmbed(idx, 'note-pill', { type: 'contact', contactId: contact.id, name: contact.name || 'Contatto' });
    q.insertText(idx + 1, ' ');
    q.setSelection(idx + 2);
    closeNoteContactPicker();
    saveActiveNotebookContent();
    showToast("Contatto menzionato", "success");
}

// Modal Selettore Pagine per Note (Wiki)
function openNotePagePicker() {
    const modal = document.getElementById('notePagePickerModal');
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    const input = document.getElementById('notePageSearchInput');
    if (input) {
        input.value = '';
        setTimeout(() => input.focus(), 50);
    }
    renderNotePagePickerList('');
}

function closeNotePagePicker() {
    const modal = document.getElementById('notePagePickerModal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

function renderNotePagePickerList(query = '') {
    const container = document.getElementById('notePagePickerList');
    if (!container) return;
    const q = (query || '').toLowerCase().trim();
    const pages = state.data.pages || [];
    const currentEntityId = state.path.subprojId || state.path.projId;

    let filtered = pages.filter(p => {
        if (!q) return true;
        const parentName = getPageContextName(p.contextId);
        return (p.title && p.title.toLowerCase().includes(q)) ||
               (parentName && parentName.toLowerCase().includes(q));
    });

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="py-6 text-center">
                <p class="text-xs text-slate-400 italic mb-2">Nessuna pagina trovata.</p>
                ${q ? `<button onclick="createAndInsertPage('${escapeNoteHtml(query)}')" class="text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline"><i class="fas fa-plus mr-1"></i> Crea nuova pagina "${escapeNoteHtml(query)}"</button>` : ''}
            </div>
        `;
        return;
    }

    container.innerHTML = filtered.slice(0, 30).map(p => {
        const parentName = getPageContextName(p.contextId);
        const isCurrent = p.contextId === currentEntityId;
        return `
            <div onclick="insertPageIntoNote('${p.id}')" class="p-2.5 rounded-xl border border-slate-200 dark:border-darkborder bg-slate-50 dark:bg-[#1a2333] hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:border-purple-300 dark:hover:border-purple-700 transition cursor-pointer flex items-center justify-between gap-2 group">
                <div class="flex items-center gap-2.5 min-w-0">
                    <div class="w-7 h-7 rounded-lg bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300 flex items-center justify-center text-xs shrink-0 font-bold">
                        <i class="fas fa-file-alt"></i>
                    </div>
                    <div class="min-w-0">
                        <p class="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">${escapeNoteHtml(p.title)}</p>
                        <p class="text-[10px] text-slate-400 truncate">${escapeNoteHtml(parentName)}</p>
                    </div>
                </div>
                <div class="flex items-center gap-1.5 shrink-0">
                    ${isCurrent ? '<span class="text-[9px] font-bold bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 px-1.5 py-0.5 rounded">Questo</span>' : ''}
                    <i class="fas fa-plus text-slate-400 group-hover:text-purple-500 text-xs"></i>
                </div>
            </div>
        `;
    }).join('');
}

function insertPageIntoNote(pageId) {
    const page = (state.data.pages || []).find(p => p.id === pageId);
    if (!page) return;
    const q = getActiveNotebookQuill();
    if (!q) return;

    q.focus();
    const sel = lastNotebookSelection || q.getSelection() || { index: q.getLength() - 1, length: 0 };
    const idx = sel.index;
    q.insertEmbed(idx, 'note-pill', { type: 'page', pageId: page.id, title: page.title || 'Pagina' });
    q.insertText(idx + 1, ' ');
    q.setSelection(idx + 2);
    closeNotePagePicker();
    saveActiveNotebookContent();
    showToast("Pagina collegata", "success");
}

function createAndInsertPage(title) {
    const currentEntityId = state.path.subprojId || state.path.projId;
    if (!currentEntityId) return;

    const now = getISODate(new Date());
    const newPage = {
        id: 'page_' + Date.now(),
        contextId: currentEntityId,
        title: title || 'Nuova Pagina',
        content: '<p></p>',
        createdAt: now,
        updatedAt: now
    };
    if (!state.data.pages) state.data.pages = [];
    state.data.pages.push(newPage);
    AppData.triggerSave();
    insertPageIntoNote(newPage.id);
}

// --- GESTIONE SOTTOPAGINE & NAVIGAZIONE CROCE-PROGETTO ---
function createNotebookSubpage(type, entityId) {
    const title = prompt("Titolo della nuova sottopagina:", "Nuova Pagina");
    if (!title || !title.trim()) return;
    const now = getISODate(new Date());
    const newPage = {
        id: 'page_' + Date.now(),
        contextId: entityId,
        title: title.trim(),
        content: '<p></p>',
        createdAt: now,
        updatedAt: now
    };
    if (!state.data.pages) state.data.pages = [];
    state.data.pages.push(newPage);
    activeSubpageId = newPage.id;
    currentNotebookTab = 'pages';
    AppData.triggerSave();
    render();
    showToast(`Pagina "${newPage.title}" creata`, "success");
}

function openNotebookSubpage(pageId) {
    activeSubpageId = pageId;
    currentNotebookTab = 'pages';
    render();
}

function closeSubpageEditor() {
    activeSubpageId = null;
    currentNotebookTab = 'pages';
    render();
}

function deleteNotebookSubpage(pageId) {
    const page = (state.data.pages || []).find(p => p.id === pageId);
    if (!page) return;
    if (!confirm(`Sei sicuro di voler eliminare la pagina "${page.title}"?`)) return;

    state.data.pages = state.data.pages.filter(p => p.id !== pageId);
    if (activeSubpageId === pageId) activeSubpageId = null;
    AppData.triggerSave();
    render();
    showToast("Pagina eliminata", "success");
}

function updateSubpageTitle(pageId, newTitle) {
    const page = (state.data.pages || []).find(p => p.id === pageId);
    if (page) {
        page.title = newTitle;
        page.updatedAt = getISODate(new Date());
        AppData.triggerSave();
    }
}

// Gestione Tag Pagine (Es. "verbale riunione", "scheda tecnica", "brief")
function addPageTag(pageId, tag) {
    if (!tag || !tag.trim()) return;
    const page = (state.data.pages || []).find(p => p.id === pageId);
    if (!page) return;
    if (!Array.isArray(page.tags)) page.tags = [];
    const clean = tag.trim().toLowerCase();
    if (!page.tags.includes(clean)) {
        page.tags.push(clean);
        page.updatedAt = getISODate(new Date());
        AppData.triggerSave();
        render();
    }
}

function removePageTag(pageId, tag) {
    const page = (state.data.pages || []).find(p => p.id === pageId);
    if (!page || !Array.isArray(page.tags)) return;
    page.tags = page.tags.filter(t => t !== tag);
    page.updatedAt = getISODate(new Date());
    AppData.triggerSave();
    render();
}

// Modalità Zen a schermo intero senza distrazioni
function toggleFocusMode(editorId) {
    const el = document.getElementById(editorId);
    if (!el) return;
    const container = el.closest('.project-notebook-card') || el.closest('.project-notebook-editor') || el.parentElement;
    if (!container) return;
    container.classList.toggle('zen-focus-mode');
    const isZen = container.classList.contains('zen-focus-mode');
    if (isZen) {
        showToast("Modalità Zen attiva. Premi Esc per uscire.", "default");
    }
}

if (typeof window !== 'undefined' && !window.__zenEscapeListenerAttached) {
    window.__zenEscapeListenerAttached = true;
    window.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            document.querySelectorAll('.zen-focus-mode').forEach(el => el.classList.remove('zen-focus-mode'));
        }
    });
}

// Navigazione Universale a una pagina Wiki (anche tra progetti diversi)
function navigateToNotebookPage(pageId) {
    const page = (state.data.pages || []).find(p => p.id === pageId);
    if (!page) {
        showToast("Pagina non trovata o rimossa.", "error");
        return;
    }
    const contextId = page.contextId;

    // Se appartiene a un sottoprogetto
    const sp = (state.data.subprojects || []).find(x => x.id === contextId);
    if (sp) {
        const p = (state.data.projects || []).find(x => x.id === sp.projectId);
        const sId = p ? p.sphereId : (state.data.spheres[0] ? state.data.spheres[0].id : 'sph_1');
        activeSubpageId = page.id;
        currentNotebookTab = 'pages';
        navigate('subproject', sId, sp.projectId, sp.id);
        showToast(`Aperta pagina "${page.title}"`, "success");
        return;
    }

    // Se appartiene a un progetto
    const p = (state.data.projects || []).find(x => x.id === contextId);
    if (p) {
        const sId = p.sphereId || (state.data.spheres[0] ? state.data.spheres[0].id : 'sph_1');
        activeSubpageId = page.id;
        currentNotebookTab = 'pages';
        navigate('project', sId, p.id);
        showToast(`Aperta pagina "${page.title}"`, "success");
        return;
    }

    // Se contesto corrente
    activeSubpageId = page.id;
    currentNotebookTab = 'pages';
    render();
    showToast(`Aperta pagina "${page.title}"`, "success");
}

// --- RENDERING QUADERNO DI LAVORO ---
function renderProjectNotebook(type, entityId, entity) {
    const allPages = (state.data.pages || []).filter(p => p.contextId === entityId);
    const pagesCount = allPages.length;
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
                        Quaderno di Lavoro & Documentazione
                    </h3>
                    <p class="text-[11px] text-slate-500 dark:text-slate-400">Workspace integrato per appunti, sottopagine e collegamenti wiki</p>
                </div>
            </div>

            <!-- TABS & ACTIONS -->
            <div class="flex items-center gap-2 overflow-x-auto no-scrollbar">
                <div class="flex bg-slate-200/70 dark:bg-slate-800/80 p-1 rounded-xl shrink-0">
                    <button id="notebook-tab-btn-active" onclick="switchNotebookTab('active')" class="notebook-tab-btn ${activeTab === 'active' ? 'active' : ''}">
                        <i class="fas fa-file-signature text-xs"></i> Documento Principale
                    </button>
                    <button id="notebook-tab-btn-pages" onclick="switchNotebookTab('pages')" class="notebook-tab-btn ${activeTab === 'pages' ? 'active' : ''}">
                        <i class="fas fa-layer-group text-xs"></i> Pagine & Schede <span class="text-[10px] px-1.5 py-0.5 rounded-full ${pagesCount > 0 ? 'bg-purple-500 text-white' : 'bg-slate-300 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}">${pagesCount}</span>
                    </button>
                </div>

                <div class="flex items-center gap-1.5 ml-auto md:ml-2 shrink-0">
                    <button onclick="createNotebookSubpage('${type}', '${entityId}')" class="text-xs font-bold bg-purple-50 dark:bg-purple-900/30 hover:bg-purple-100 dark:hover:bg-purple-900/50 text-purple-600 dark:text-purple-300 px-3 py-2 rounded-xl border border-purple-200 dark:border-purple-800 transition shadow-sm active:scale-95" title="Aggiungi una nuova sottopagina a questo progetto">
                        <i class="fas fa-plus text-xs mr-1"></i> <span>Nuova Pagina</span>
                    </button>
                    <button onclick="toggleFocusMode('quill-editor-${type}')" class="text-xs font-bold bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-3 py-2 rounded-xl border border-slate-200 dark:border-darkborder transition shadow-sm active:scale-95" title="Schermo intero senza distrazioni">
                        <i class="fas fa-expand text-xs"></i> <span class="hidden sm:inline ml-1">Zen</span>
                    </button>
                </div>
            </div>
        </div>

        <!-- TAB PANEL 1: DOCUMENTO PRINCIPALE -->
        <div id="notebook-tab-panel-active" class="${activeTab === 'active' ? 'block' : 'hidden'} p-4 md:p-6">
            <!-- QUICK INSERT TOOLBAR -->
            <div class="flex items-center gap-1.5 mb-3 overflow-x-auto no-scrollbar pb-1 text-xs">
                <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 shrink-0 mr-1 flex items-center gap-1">
                    <i class="fas fa-bolt text-amber-500"></i> Inserisci:
                </span>
                <button type="button" onclick="insertNoteCallout('idea')" class="px-2.5 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40 font-bold hover:bg-amber-100 transition shrink-0 flex items-center gap-1.5 active:scale-95">
                    💡 <span>Idea</span>
                </button>
                <button type="button" onclick="insertNoteCallout('info')" class="px-2.5 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/40 font-bold hover:bg-blue-100 transition shrink-0 flex items-center gap-1.5 active:scale-95">
                    ℹ️ <span>Info</span>
                </button>
                <button type="button" onclick="insertNoteCallout('warning')" class="px-2.5 py-1.5 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/40 font-bold hover:bg-red-100 transition shrink-0 flex items-center gap-1.5 active:scale-95">
                    ⚠️ <span>Avviso</span>
                </button>
                <button type="button" onclick="insertNoteCallout('success')" class="px-2.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40 font-bold hover:bg-emerald-100 transition shrink-0 flex items-center gap-1.5 active:scale-95">
                    ✅ <span>Decisione</span>
                </button>
                <button type="button" onclick="insertNoteQuote()" class="px-2.5 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/40 font-bold hover:bg-indigo-100 transition shrink-0 flex items-center gap-1.5 active:scale-95">
                    ❝ <span>Citazione</span>
                </button>
                <button type="button" onclick="insertNoteDivider()" class="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-bold hover:bg-slate-200 transition shrink-0 flex items-center gap-1 active:scale-95">
                    ➖ <span>Divisore</span>
                </button>
                <div class="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-1 shrink-0"></div>
                <button type="button" onclick="openNoteTaskPicker()" class="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/30 border border-slate-200 dark:border-slate-700 font-bold transition shrink-0 flex items-center gap-1.5 active:scale-95">
                    <i class="fas fa-link text-blue-500"></i> <span>Task</span>
                </button>
                <button type="button" onclick="openNoteContactPicker()" class="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-purple-50 hover:text-purple-600 dark:hover:bg-purple-900/30 border border-slate-200 dark:border-slate-700 font-bold transition shrink-0 flex items-center gap-1.5 active:scale-95">
                    <i class="fas fa-user-tag text-purple-500"></i> <span>Contatto</span>
                </button>
                <button type="button" onclick="openNotePagePicker()" class="px-2.5 py-1.5 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 hover:bg-purple-100 border border-purple-200 dark:border-purple-800/60 font-bold transition shrink-0 flex items-center gap-1.5 active:scale-95">
                    <i class="fas fa-file-alt text-purple-600"></i> <span>Pagina (Wiki)</span>
                </button>
                <div class="hidden lg:flex items-center gap-1.5 ml-auto text-[11px] text-slate-400">
                    <span class="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono border border-slate-200 dark:border-slate-700">/</span> comandi
                    <span class="mx-1">•</span>
                    <span class="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono border border-slate-200 dark:border-slate-700">[[</span> collegamenti
                </div>
            </div>

            <!-- MAIN QUILL EDITOR CONTAINER -->
            <div class="project-notebook-editor bg-white dark:bg-darkbg rounded-xl border border-slate-200 dark:border-darkborder shadow-inner focus-within:ring-2 focus-within:ring-blue-500/30 transition">
                <div id="quill-editor-${type}" class="min-h-[260px] text-sm"></div>
            </div>

            <!-- FOOTER STATUS & STATS -->
            <div class="flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 mt-2.5 px-1">
                <div class="flex items-center gap-2">
                    <span class="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>Salvataggio continuo attivo</span>
                </div>
                <div class="flex items-center gap-3 font-medium">
                    <span id="notebook-words-${type}">0 parole</span>
                    <span>•</span>
                    <span id="notebook-chars-${type}">0 caratteri</span>
                </div>
            </div>
        </div>

        <!-- TAB PANEL 2: PAGINE (SOTTOPAGINE & DOCUMENTI WIKI) -->
        <div id="notebook-tab-panel-pages" class="${activeTab === 'pages' ? 'block' : 'hidden'} p-4 md:p-6">
            ${activeSubpageId ? renderSubpageEditor(type, entityId) : renderProjectSubpagesList(type, entityId, allPages)}
        </div>
    </div>
    `;
}

// Rendering lista sottopagine del progetto
function renderProjectSubpagesList(type, entityId, pages) {
    if (!pages || pages.length === 0) {
        return `
            <div class="py-12 text-center text-slate-400 dark:text-slate-500">
                <div class="w-14 h-14 rounded-2xl bg-purple-50 dark:bg-purple-950/40 text-purple-500 mx-auto flex items-center justify-center text-xl mb-3">
                    <i class="fas fa-layer-group"></i>
                </div>
                <p class="text-sm font-bold text-slate-700 dark:text-slate-200">Nessuna sottopagina creata</p>
                <p class="text-xs text-slate-400 mt-1 max-w-md mx-auto mb-5 leading-relaxed">
                    Crea pagine dedicate per schede tecniche, verbali di riunione, brief o documentazione dettagliata. Puoi collegarle tra di loro digitando <code>[[</code> in qualsiasi nota.
                </p>
                <button onclick="createNotebookSubpage('${type}', '${entityId}')" class="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-md transition active:scale-95 inline-flex items-center gap-2">
                    <i class="fas fa-plus"></i> Crea Prima Pagina
                </button>
            </div>
        `;
    }

    return `
        <div class="space-y-4">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200 dark:border-darkborder">
                <div class="flex items-center gap-2">
                    <span class="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                        <i class="fas fa-layer-group text-purple-500 mr-1.5"></i> Sottopagine del Progetto
                    </span>
                    <span class="text-[10px] font-mono bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 px-2 py-0.5 rounded-full font-bold">${pages.length}</span>
                </div>
                <button onclick="createNotebookSubpage('${type}', '${entityId}')" class="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition shadow-sm active:scale-95 inline-flex items-center gap-1.5 self-start sm:self-auto">
                    <i class="fas fa-plus text-[10px]"></i> Nuova Pagina
                </button>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                ${pages.map(p => {
                    const plain = (p.content || '').replace(/<[^>]*>?/gm, '').trim();
                    let preview = plain.substring(0, 100);
                    if (plain.length > 100) preview += '...';
                    if (!preview) preview = 'Pagina vuota, clicca per scrivere...';
                    const tags = p.tags || [];
                    return `
                        <div class="subpage-card p-4 rounded-xl border border-slate-200 dark:border-darkborder bg-white dark:bg-darkpanel hover:border-purple-300 dark:hover:border-purple-700 transition flex flex-col justify-between group shadow-sm">
                            <div class="cursor-pointer" onclick="openNotebookSubpage('${p.id}')">
                                <div class="flex items-start justify-between gap-2 mb-2">
                                    <div class="flex items-center gap-2 min-w-0">
                                        <div class="w-7 h-7 rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300 flex items-center justify-center text-xs shrink-0 font-bold">
                                            <i class="fas fa-file-alt"></i>
                                        </div>
                                        <h4 class="text-xs font-bold text-slate-800 dark:text-slate-100 truncate group-hover:text-purple-600 dark:group-hover:text-purple-400 transition">${escapeNoteHtml(p.title)}</h4>
                                    </div>
                                </div>
                                ${tags.length > 0 ? `
                                    <div class="flex flex-wrap gap-1 mb-2">
                                        ${tags.map(t => `<span class="px-1.5 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/40 text-[9px] font-bold text-purple-600 dark:text-purple-300 border border-purple-200 dark:border-purple-800/40">#${escapeNoteHtml(t)}</span>`).join('')}
                                    </div>
                                ` : ''}
                                <p class="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed mb-3">${escapeNoteHtml(preview)}</p>
                            </div>
                            <div class="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400">
                                <span><i class="far fa-clock mr-1"></i> ${p.updatedAt || p.createdAt || 'Oggi'}</span>
                                <div class="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition">
                                    <button onclick="openNotebookSubpage('${p.id}')" class="p-1.5 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded" title="Modifica pagina">
                                        <i class="fas fa-edit"></i>
                                    </button>
                                    <button onclick="deleteNotebookSubpage('${p.id}')" class="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded" title="Elimina pagina">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
}

// Rendering editor della singola sottopagina attiva
function renderSubpageEditor(type, entityId) {
    const page = (state.data.pages || []).find(p => p.id === activeSubpageId);
    if (!page) {
        activeSubpageId = null;
        return renderProjectSubpagesList(type, entityId, (state.data.pages || []).filter(p => p.contextId === entityId));
    }

    return `
        <div class="space-y-3">
            <!-- TOP BAR SOTTOPAGINA -->
            <div class="flex items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-darkborder">
                <div class="flex items-center gap-3 min-w-0 flex-1">
                    <button onclick="closeSubpageEditor()" class="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 text-xs font-bold transition flex items-center gap-1.5 shrink-0 active:scale-95">
                        <i class="fas fa-arrow-left text-[11px]"></i> <span>Tutte le Pagine</span>
                    </button>
                    <div class="h-4 w-px bg-slate-300 dark:bg-slate-700"></div>
                    <div class="flex items-center gap-2 flex-1 min-w-0">
                        <i class="fas fa-file-alt text-purple-500 shrink-0"></i>
                        <input type="text" value="${escapeNoteHtml(page.title)}" onchange="updateSubpageTitle('${page.id}', this.value)" class="text-sm font-bold bg-transparent border-b border-dashed border-slate-300 dark:border-slate-700 focus:border-purple-500 focus:outline-none text-slate-900 dark:text-white flex-1 min-w-0" placeholder="Titolo della pagina...">
                    </div>
                </div>

                <div class="flex items-center gap-1.5 shrink-0">
                    <button onclick="toggleFocusMode('quill-subpage-editor')" class="text-xs font-bold bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-200 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-darkborder transition shadow-sm" title="Modalità Zen">
                        <i class="fas fa-expand text-xs"></i> <span class="hidden sm:inline ml-1">Zen</span>
                    </button>
                    <button onclick="deleteNotebookSubpage('${page.id}')" class="text-xs font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 p-2 rounded-xl transition" title="Elimina questa sottopagina">
                        <i class="fas fa-trash text-xs"></i>
                    </button>
                </div>
            </div>

            <!-- TAG MANAGEMENT SOTTOPAGINA -->
            <div class="flex flex-wrap items-center gap-1.5 py-1 text-xs">
                <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mr-1 flex items-center gap-1"><i class="fas fa-tags text-purple-500"></i> Tag:</span>
                ${(page.tags || []).map(tag => `
                    <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                        #${escapeNoteHtml(tag)}
                        <button type="button" onclick="removePageTag('${page.id}', '${escapeNoteHtml(tag)}')" class="hover:text-red-500 text-[10px] ml-0.5" title="Rimuovi tag"><i class="fas fa-times"></i></button>
                    </span>
                `).join('')}
                <div class="inline-flex items-center gap-1">
                    <input type="text" id="newPageTagInput_${page.id}" placeholder="+ nuovo tag..." onkeydown="if(event.key==='Enter'){event.preventDefault();addPageTag('${page.id}', this.value);}" class="text-[11px] px-2 py-0.5 rounded-full border border-dashed border-slate-300 dark:border-slate-600 bg-transparent text-slate-700 dark:text-slate-200 focus:outline-none focus:border-purple-500 w-28">
                    <button type="button" onclick="addPageTag('${page.id}', document.getElementById('newPageTagInput_${page.id}').value)" class="p-1 text-purple-600 hover:text-purple-800 text-xs font-bold" title="Aggiungi tag"><i class="fas fa-plus"></i></button>
                </div>
                <div class="hidden sm:flex items-center gap-1 text-[10px] text-slate-400 ml-2">
                    <span class="text-[9px]">Suggeriti:</span>
                    ${['verbale riunione', 'scheda tecnica', 'brief', 'appunti'].filter(t => !(page.tags || []).includes(t)).slice(0, 3).map(t => `
                        <button type="button" onclick="addPageTag('${page.id}', '${t}')" class="px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 hover:bg-purple-50 hover:text-purple-600 text-slate-500 dark:text-slate-400 transition">+ ${t}</button>
                    `).join('')}
                </div>
            </div>

            <!-- TOOLBAR DI INSERIMENTO RAPIDO PER SOTTOPAGINA -->
            <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 text-xs">
                <button type="button" onclick="insertNoteCallout('idea')" class="px-2.5 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40 font-bold hover:bg-amber-100 transition shrink-0 flex items-center gap-1 active:scale-95">💡 Idea</button>
                <button type="button" onclick="insertNoteCallout('info')" class="px-2.5 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/40 font-bold hover:bg-blue-100 transition shrink-0 flex items-center gap-1 active:scale-95">ℹ️ Info</button>
                <button type="button" onclick="insertNoteCallout('warning')" class="px-2.5 py-1.5 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/40 font-bold hover:bg-red-100 transition shrink-0 flex items-center gap-1 active:scale-95">⚠️ Avviso</button>
                <button type="button" onclick="insertNoteCallout('success')" class="px-2.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40 font-bold hover:bg-emerald-100 transition shrink-0 flex items-center gap-1 active:scale-95">✅ Decisione</button>
                <button type="button" onclick="insertNoteQuote()" class="px-2.5 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/40 font-bold hover:bg-indigo-100 transition shrink-0 flex items-center gap-1 active:scale-95">❝ Citazione</button>
                <button type="button" onclick="insertNoteDivider()" class="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-bold hover:bg-slate-200 transition shrink-0 active:scale-95">➖ Divisore</button>
                <div class="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-1 shrink-0"></div>
                <button type="button" onclick="openNoteTaskPicker()" class="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/30 border border-slate-200 dark:border-slate-700 font-bold transition shrink-0 flex items-center gap-1 active:scale-95"><i class="fas fa-link text-blue-500"></i> Task</button>
                <button type="button" onclick="openNoteContactPicker()" class="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-purple-50 hover:text-purple-600 dark:hover:bg-purple-900/30 border border-slate-200 dark:border-slate-700 font-bold transition shrink-0 flex items-center gap-1 active:scale-95"><i class="fas fa-user-tag text-purple-500"></i> Contatto</button>
                <button type="button" onclick="openNotePagePicker()" class="px-2.5 py-1.5 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 hover:bg-purple-100 border border-purple-200 dark:border-purple-800/60 font-bold transition shrink-0 flex items-center gap-1 active:scale-95"><i class="fas fa-file-alt text-purple-600"></i> Pagina (Wiki)</button>
            </div>

            <!-- CONTAINER EDITOR QUILL SOTTOPAGINA -->
            <div class="project-notebook-editor bg-white dark:bg-darkbg rounded-xl border border-slate-200 dark:border-darkborder shadow-inner focus-within:ring-2 focus-within:ring-purple-500/30 transition">
                <div id="quill-subpage-editor" class="min-h-[300px] text-sm"></div>
            </div>

            <!-- FOOTER STATUS & STATS SOTTOPAGINA -->
            <div class="flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 px-1">
                <div class="flex items-center gap-2">
                    <span class="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>Salvataggio continuo attivo</span>
                </div>
                <div class="flex items-center gap-3 font-medium">
                    <span id="subpage-notebook-words">0 parole</span>
                    <span>•</span>
                    <span id="subpage-notebook-chars">0 caratteri</span>
                </div>
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

function archiveNotes(type, entityId) {
    createNotebookSubpage(type, entityId);
}

function initQuillEditors() {
    const tOpts = [['bold', 'italic', 'underline', 'strike'], ['blockquote', 'code-block'], [{ 'list': 'ordered'}, { 'list': 'bullet' }], [{ 'color': [] }, { 'background': [] }], ['link'], ['clean']];
    
    // Inizializza eventuale editor sottopagina attiva
    if (activeSubpageId) {
        const subEl = document.getElementById('quill-subpage-editor');
        if (subEl) {
            // Rimuovi eventuale toolbar orfana duplicata
            const prev = subEl.previousElementSibling;
            if (prev && prev.classList.contains('ql-toolbar')) {
                prev.remove();
            }
            const page = (state.data.pages || []).find(p => p.id === activeSubpageId);
            if (page) {
                subEl.__quill = new Quill(subEl, {
                    theme: 'snow',
                    modules: { toolbar: tOpts },
                    placeholder: 'Inizia a scrivere in questa sottopagina... (digita / per i comandi o [[ per collegare)'
                });
                subEl.__quill.root.innerHTML = page.content || '';
                attachQuillAutocomplete(subEl.__quill);
                updateNotebookStats(subEl.__quill, 'subpage');
                subEl.__quill.on('text-change', function(delta, oldDelta, source) { 
                    if (source === 'user') {
                        page.content = subEl.__quill.root.innerHTML; 
                        page.updatedAt = getISODate(new Date());
                        AppData.triggerSave(); 
                        updateNotebookStats(subEl.__quill, 'subpage');
                    }
                });
            }
        }
    }

    ['sphere', 'project', 'subproject'].forEach(type => {
        const id = type === 'sphere' ? state.path.sphereId : (type === 'project' ? state.path.projId : state.path.subprojId);
        if (!id) return;
        const entity = getEntity(type, id);
        if(!entity) return;

        if (type !== 'sphere') {
            const el = document.getElementById(`quill-editor-${type}`);
            if (el) {
                // Rimuovi eventuale toolbar orfana duplicata
                const prev = el.previousElementSibling;
                if (prev && prev.classList.contains('ql-toolbar')) {
                    prev.remove();
                }
                el.__quill = new Quill(el, {
                    theme: 'snow',
                    modules: { toolbar: tOpts },
                    placeholder: 'Inizia a scrivere nel documento principale... (digita / per i comandi o [[ per collegare)'
                });
                el.__quill.root.innerHTML = entity.notes || '';
                attachQuillAutocomplete(el.__quill);
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
    });
}

// Click listener delegato universale per pillole task, contatti, pagine e chiusura dropdown
if (typeof window !== 'undefined' && !window.__notebookDelegatedListenerAttached) {
    window.__notebookDelegatedListenerAttached = true;
    document.addEventListener('click', function(e) {
        // Pillola Task
        const taskPill = e.target.closest('[data-task-id]');
        if (taskPill) {
            // Se il click è sulla casella checkbox, lascia che sia toggleTaskFromPill a gestirla!
            if (e.target.closest('.note-task-chk')) {
                return;
            }
            const taskId = taskPill.getAttribute('data-task-id');
            if (taskId) {
                e.stopPropagation();
                if (typeof openTaskModal === 'function') openTaskModal(taskId);
                else if (typeof editTask === 'function') editTask(taskId);
                return;
            }
        }

        // Pillola Contatto
        const contactPill = e.target.closest('[data-contact-id]');
        if (contactPill) {
            const contactId = contactPill.getAttribute('data-contact-id');
            if (contactId) {
                e.stopPropagation();
                if (typeof openContactModal === 'function') openContactModal(contactId);
                return;
            }
        }

        // Pillola Pagina (Wiki-link)
        const pagePill = e.target.closest('[data-page-id]');
        if (pagePill) {
            const pageId = pagePill.getAttribute('data-page-id');
            if (pageId) {
                e.stopPropagation();
                if (typeof navigateToNotebookPage === 'function') navigateToNotebookPage(pageId);
                return;
            }
        }

        // Chiusura automatica Slash Menu e Wiki-link Dropdown al click esterno
        if (!e.target.closest('#quillSlashMenu')) {
            closeSlashMenu();
        }
        if (!e.target.closest('#wikiLinkDropdown')) {
            closeWikiLinkDropdown();
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
