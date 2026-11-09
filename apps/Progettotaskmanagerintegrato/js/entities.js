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

const contactMentionState = {
    isOpen: false,
    startIndex: 0,
    length: 0,
    quill: null,
    contacts: [],
    selectedIndex: 0,
    query: ''
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

        // Navigazione tastiera Contact Mention Menu (@)
        if (contactMentionState.isOpen) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                moveContactMentionHighlight(1);
                return;
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                moveContactMentionHighlight(-1);
                return;
            } else if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                selectHighlightedContact(quill);
                return;
            } else if (e.key === 'Escape') {
                closeContactMentionMenu();
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
            closeContactMentionMenu();
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
            closeContactMentionMenu();
            return;
        } else {
            closeWikiLinkDropdown();
        }

        // 2. Rileva Contact Mention: @(nome)
        const contactMatch = textBefore.match(/(?:^|\s)@([a-zA-Z0-9_\u00C0-\u017F\s]*)$/);
        if (contactMatch) {
            const query = contactMatch[1];
            const matchedFull = contactMatch[0];
            const atOffset = matchedFull.indexOf('@');
            const startIndex = cursor - (matchedFull.length - atOffset);
            contactMentionState.isOpen = true;
            contactMentionState.startIndex = startIndex;
            contactMentionState.length = cursor - startIndex;
            contactMentionState.quill = quill;
            showContactMentionMenu(quill, cursor, query);
            closeSlashMenu();
            closeWikiLinkDropdown();
            return;
        } else {
            closeContactMentionMenu();
        }

        // 3. Rileva Slash command: /(comando)
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
            closeContactMentionMenu();
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

// --- AUTOCOMPLETE: GESTIONE CONTATTI MENU (@) ---
function showContactMentionMenu(quill, cursor, query) {
    const menu = document.getElementById('quillContactMenu');
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
    const allContacts = state.data.contacts || [];
    contactMentionState.query = query ? query.trim() : '';

    const matching = allContacts.filter(c => {
        if (!q) return true;
        const name = (c.name || '').toLowerCase();
        const role = (c.role || '').toLowerCase();
        const email = (c.email || '').toLowerCase();
        return name.includes(q) || role.includes(q) || email.includes(q);
    });

    contactMentionState.contacts = matching;
    contactMentionState.selectedIndex = 0;

    if (matching.length === 0) {
        menu.innerHTML = `<div class="p-3 text-xs text-slate-400 italic text-center">Nessun contatto trovato per "${escapeNoteHtml(query)}"</div>`;
        menu.classList.remove('hidden');
        return;
    }

    let html = `
        <div class="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-darkborder flex items-center justify-between">
            <span class="flex items-center gap-1.5"><i class="fas fa-users text-purple-500"></i> Menziona Contatto:</span>
            <span class="text-[9px] text-slate-400 font-normal lowercase">invio seleziona</span>
        </div>
        <div class="max-h-56 overflow-y-auto p-1 space-y-0.5">
    `;

    matching.slice(0, 20).forEach((c, idx) => {
        const isSel = idx === contactMentionState.selectedIndex;
        html += `
            <div class="wiki-item ${isSel ? 'selected' : ''}" data-index="${idx}" onmouseenter="contactMentionState.selectedIndex=${idx}; this.parentElement.querySelectorAll('.wiki-item').forEach((el,i)=>el.classList.toggle('selected', i===${idx}))" onmousedown="event.preventDefault(); selectContactByIndex(${idx})">
                <div class="w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300 flex items-center justify-center text-[10px] font-bold shrink-0">
                    <i class="fas fa-user"></i>
                </div>
                <div class="flex-1 min-w-0">
                    <div class="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">${escapeNoteHtml(c.name)}</div>
                    ${c.role ? `<div class="text-[10px] text-slate-400 truncate">${escapeNoteHtml(c.role)}</div>` : ''}
                </div>
            </div>
        `;
    });

    html += `</div>`;
    menu.innerHTML = html;
    menu.classList.remove('hidden');
}

function closeContactMentionMenu() {
    contactMentionState.isOpen = false;
    const menu = document.getElementById('quillContactMenu');
    if (menu) menu.classList.add('hidden');
}

function moveContactMentionHighlight(direction) {
    if (!contactMentionState.contacts || contactMentionState.contacts.length === 0) return;
    const len = contactMentionState.contacts.length;
    contactMentionState.selectedIndex = (contactMentionState.selectedIndex + direction + len) % len;
    
    const menu = document.getElementById('quillContactMenu');
    if (!menu) return;
    const items = menu.querySelectorAll('.wiki-item');
    items.forEach((item, idx) => {
        item.classList.toggle('selected', idx === contactMentionState.selectedIndex);
        if (idx === contactMentionState.selectedIndex) item.scrollIntoView({ block: 'nearest' });
    });
}

function selectHighlightedContact(quill) {
    if (contactMentionState.contacts && contactMentionState.contacts.length > 0 && contactMentionState.selectedIndex >= 0) {
        selectContactByIndex(contactMentionState.selectedIndex);
    }
}

function selectContactByIndex(idx) {
    if (!contactMentionState.contacts || !contactMentionState.contacts[idx]) return;
    const contact = contactMentionState.contacts[idx];
    const q = contactMentionState.quill || getActiveNotebookQuill();
    if (!q) return;

    const start = contactMentionState.startIndex;
    const len = contactMentionState.length;
    closeContactMentionMenu();

    q.focus();
    if (len > 0) {
        q.deleteText(start, len);
    }
    q.insertEmbed(start, 'note-pill', { type: 'contact', contactId: contact.id, name: contact.name || 'Contatto' });
    q.insertText(start + 1, ' ');
    q.setSelection(start + 2);
    saveActiveNotebookContent();
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
function createNotebookSubpage(type, entityId, initialTitle = null, initialTipologia = 'Riunione') {
    const title = initialTitle || prompt("Titolo della nuova pagina:", "Nuova Pagina");
    if (!title || !title.trim()) return null;
    const now = getISODate(new Date());

    let contextId = entityId || state.path.subprojId || state.path.projId || null;
    let sphereId = null;
    if (contextId) {
        const proj = (state.data.projects || []).find(p => p.id === contextId);
        if (proj) {
            sphereId = proj.sphereId;
        } else {
            const sub = (state.data.subprojects || []).find(sp => sp.id === contextId);
            if (sub) {
                const parentProj = (state.data.projects || []).find(p => p.id === sub.projectId);
                if (parentProj) sphereId = parentProj.sphereId;
            } else {
                const sph = (state.data.spheres || []).find(s => s.id === contextId);
                if (sph) sphereId = sph.id;
            }
        }
    }

    const newPage = {
        id: 'page_' + Date.now(),
        contextId: contextId,
        sphereId: sphereId,
        title: title.trim(),
        date: now,
        tipologia: initialTipologia || 'Riunione',
        tags: [],
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
    return newPage;
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

// --- RENDERING QUADERNO DI LAVORO (ARCHITETTURA UNIFICATA PAGINE & NOTE) ---


// --- GESTIONE TIPOLOGIE DOCUMENTI PERSONALIZZABILI ---
function getDocumentTypes() {
    if (!state.data.documentTypes || !Array.isArray(state.data.documentTypes) || state.data.documentTypes.length === 0) {
        state.data.documentTypes = [
            { id: 'riunione', name: 'Riunione', color: '#64748b' },
            { id: 'colloquio', name: 'Colloquio', color: '#10b981' },
            { id: 'call', name: 'Call', color: '#0ea5e9' },
            { id: 'appunti', name: 'Appunti', color: '#f59e0b' },
            { id: 'brief', name: 'Brief', color: '#8b5cf6' },
            { id: 'verbale', name: 'Verbale', color: '#14b8a6' },
            { id: 'altro', name: 'Altro', color: '#94a3b8' }
        ];
    }
    return state.data.documentTypes;
}

function saveDocumentTypes(types) {
    state.data.documentTypes = types;
    localStorage.setItem('hub_document_types', JSON.stringify(types));
    AppData.saveLocal();
    AppData.pushToCloud();
}

function openDocumentTypesModal() {
    renderDocumentTypesList();
    const modal = document.getElementById('documentTypesModal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
    }
}

function closeDocumentTypesModal() {
    const modal = document.getElementById('documentTypesModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
    }
    render();
}

let selectedNewTypeColor = '#64748b';

function selectDocTypeColor(color, btnEl) {
    selectedNewTypeColor = color;
    document.querySelectorAll('#docTypeColorPresets button').forEach(b => {
        b.classList.remove('ring-2', 'ring-indigo-500', 'scale-110');
    });
    if (btnEl) btnEl.classList.add('ring-2', 'ring-indigo-500', 'scale-110');
}

function renderDocumentTypesList() {
    const container = document.getElementById('documentTypesList');
    if (!container) return;
    const types = getDocumentTypes();
    
    container.innerHTML = types.map(t => `
        <div class="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
            <div class="flex items-center gap-2.5 flex-1 min-w-0">
                <span class="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs" style="background-color: ${t.color || '#64748b'};"></span>
                <input type="text" value="${escapeNoteHtml(t.name)}" onchange="updateDocumentTypeName('${t.id}', this.value)" class="text-xs font-bold bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 focus:outline-none flex-1 text-slate-800 dark:text-slate-100 py-0.5">
            </div>
            <div class="flex items-center gap-1.5 shrink-0">
                <input type="color" value="${t.color || '#64748b'}" onchange="updateDocumentTypeColor('${t.id}', this.value)" class="w-6 h-6 rounded cursor-pointer border-0 bg-transparent p-0" title="Cambia colore">
                ${types.length > 1 ? `
                    <button type="button" onclick="deleteDocumentType('${t.id}')" class="p-1.5 text-slate-400 hover:text-rose-500 rounded hover:bg-rose-50 dark:hover:bg-rose-950/30 transition text-xs" title="Elimina tipologia">
                        <i class="fas fa-trash"></i>
                    </button>
                ` : ''}
            </div>
        </div>
    `).join('');
}

function addNewDocTypeFromModal() {
    const input = document.getElementById('newDocTypeName');
    if (!input || !input.value.trim()) return;
    const name = input.value.trim();
    const types = getDocumentTypes();
    const id = name.toLowerCase().replace(/[^a-z0-9]/g, '') + '_' + Date.now();
    types.push({
        id: id,
        name: name,
        color: selectedNewTypeColor || '#64748b'
    });
    saveDocumentTypes(types);
    input.value = '';
    renderDocumentTypesList();
    showToast(`Tipologia "${name}" aggiunta!`, "success");
}

function updateDocumentTypeName(id, newName) {
    if (!newName || !newName.trim()) return;
    const types = getDocumentTypes();
    const item = types.find(t => t.id === id);
    if (item) {
        item.name = newName.trim();
        saveDocumentTypes(types);
    }
}

function updateDocumentTypeColor(id, newColor) {
    const types = getDocumentTypes();
    const item = types.find(t => t.id === id);
    if (item) {
        item.color = newColor;
        saveDocumentTypes(types);
        renderDocumentTypesList();
    }
}

function deleteDocumentType(id) {
    let types = getDocumentTypes();
    if (types.length <= 1) {
        showToast("Devi mantenere almeno una tipologia", "warning");
        return;
    }
    const item = types.find(t => t.id === id);
    if (!item) return;
    if (!confirm(`Sei sicuro di voler eliminare la tipologia "${item.name}"?`)) return;
    types = types.filter(t => t.id !== id);
    saveDocumentTypes(types);
    renderDocumentTypesList();
    showToast(`Tipologia "${item.name}" eliminata`, "info");
}

// Modal Esportazione Singola Pagina
function openPageExportModal(pageId) {
    const page = (state.data.pages || []).find(p => p.id === pageId);
    if (!page) return;
    const modal = document.getElementById('pageExportModal');
    if (!modal) return;
    const targetIdEl = document.getElementById('exportTargetPageId');
    if (targetIdEl) targetIdEl.value = page.id;
    const titleEl = document.getElementById('exportModalPageTitle');
    if (titleEl) titleEl.textContent = `Esporta: ${page.title || 'Documento'}`;
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
}

function closePageExportModal() {
    const modal = document.getElementById('pageExportModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
    }
}

function executeCleanExport(format) {
    const isBulk = document.getElementById('exportIsBulk')?.value === 'true';
    if (isBulk) {
        const targetIdsStr = document.getElementById('exportTargetPageId')?.value || '';
        const specificIds = targetIdsStr ? targetIdsStr.split(',').filter(Boolean) : null;
        const pkgType = document.querySelector('input[name="exportPackageType"]:checked')?.value || 'zip';
        if (typeof exportBulkPages === 'function') {
            exportBulkPages(format, specificIds, pkgType);
        }
    } else {
        const targetIdEl = document.getElementById('exportTargetPageId');
        const pageId = targetIdEl ? targetIdEl.value : null;
        if (!pageId) return;
        exportSinglePage(pageId, format);
    }
    closePageExportModal();
}

window.getDocumentTypes = getDocumentTypes;
window.saveDocumentTypes = saveDocumentTypes;
window.openDocumentTypesModal = openDocumentTypesModal;
window.closeDocumentTypesModal = closeDocumentTypesModal;
window.selectDocTypeColor = selectDocTypeColor;
window.addNewDocTypeFromModal = addNewDocTypeFromModal;
window.updateDocumentTypeName = updateDocumentTypeName;
window.updateDocumentTypeColor = updateDocumentTypeColor;
window.deleteDocumentType = deleteDocumentType;
window.openPageExportModal = openPageExportModal;
window.closePageExportModal = closePageExportModal;
window.executeCleanExport = executeCleanExport;


function renderProjectNotebook(type, entityId, entity) {
    const allPages = (state.data.pages || []).filter(p => p.contextId === entityId);
    const activeTab = state.ui.notebookActiveTab || 'notes';
    
    // Se c'è una pagina attiva aperta, mostra l'editor integrato
    if (activeSubpageId) {
        return `
            <div class="project-notebook-card p-4 md:p-6 bg-white dark:bg-darkpanel border-t border-slate-200 dark:border-darkborder transition-all">
                ${renderSubpageEditor(type, entityId)}
            </div>
        `;
    }

    return `
    <div class="project-notebook-card border-t border-slate-200 dark:border-darkborder overflow-hidden transition-all bg-white dark:bg-darkpanel">
        <div class="p-4 md:p-6 space-y-4">
            <!-- HEADER CON TABS: NOTE FISSE VS PAGINE & VERBALI -->
            <div class="flex items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-darkborder flex-wrap">
                <div class="flex items-center gap-2">
                    <button type="button" onclick="state.ui.notebookActiveTab = 'notes'; render();" class="px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${activeTab === 'notes' ? 'bg-purple-600 text-white shadow-xs' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'}">
                        <i class="fas fa-thumbtack text-[11px]"></i> Note Fisse
                    </button>
                    <button type="button" onclick="state.ui.notebookActiveTab = 'pages'; render();" class="px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${activeTab === 'pages' ? 'bg-purple-600 text-white shadow-xs' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'}">
                        <i class="far fa-file-alt text-[11px]"></i> Pagine & Verbali
                        <span class="px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === 'pages' ? 'bg-white/20 text-white' : 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300'} font-mono font-bold">${allPages.length}</span>
                    </button>
                </div>

                ${activeTab === 'pages' ? `
                    <button onclick="createNotebookSubpage('${type}', '${entityId}')" class="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-xs transition active:scale-95 flex items-center gap-1.5">
                        <i class="fas fa-plus text-xs"></i> Nuova Pagina
                    </button>
                ` : `
                    <div class="flex items-center gap-2">
                        <span id="notebookWordCount_${type}" class="text-[10px] font-mono text-slate-400">0 parole</span>
                        <button type="button" onclick="toggleZenMode('quill-editor-${type}')" class="p-1.5 rounded-lg text-slate-400 hover:text-purple-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition" title="Ingrandisci a schermo intero"><i class="fas fa-expand text-xs"></i></button>
                    </div>
                `}
            </div>

            <!-- CONTENUTO DEL TAB ATTIVO -->
            ${activeTab === 'notes' ? `
                <div class="space-y-3">
                    <div class="flex flex-wrap items-center justify-between gap-2 p-2 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-darkborder text-xs">
                        <div class="flex items-center gap-1.5 flex-wrap">
                            <button type="button" onclick="openNoteContactPicker('${type}')" class="px-2.5 py-1 rounded-lg bg-white dark:bg-darkpanel text-slate-700 dark:text-slate-200 hover:text-purple-600 border border-slate-200 dark:border-slate-700 font-bold transition flex items-center gap-1 shadow-2xs active:scale-95"><i class="fas fa-user-tag text-purple-500"></i> Contatto</button>
                            <button type="button" onclick="openNotePagePicker('${type}')" class="px-2.5 py-1 rounded-lg bg-white dark:bg-darkpanel text-purple-700 dark:text-purple-300 hover:bg-purple-50 border border-purple-200 dark:border-purple-800 font-bold transition flex items-center gap-1 shadow-2xs active:scale-95"><i class="fas fa-file-alt text-purple-600"></i> Pagina ([[)</button>
                            <button type="button" onclick="openNoteTaskPicker('${type}')" class="px-2.5 py-1 rounded-lg bg-white dark:bg-darkpanel text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 border border-emerald-200 dark:border-emerald-800 font-bold transition flex items-center gap-1 shadow-2xs active:scale-95"><i class="fas fa-check-square text-emerald-600"></i> Task</button>
                            <span class="text-[10px] text-slate-400 font-medium ml-1 hidden sm:inline"><kbd class="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 font-mono text-[9px]">/</kbd> comandi</span>
                        </div>
                    </div>
                    <div class="project-notebook-editor bg-white dark:bg-darkbg rounded-xl border border-slate-200 dark:border-darkborder shadow-inner focus-within:ring-2 focus-within:ring-purple-500/30 transition">
                        <div id="quill-editor-${type}" class="min-h-[200px]"></div>
                    </div>
                </div>
            ` : `
                ${renderProjectSubpagesList(type, entityId, allPages)}
            `}
        </div>
    </div>
    `;
}

// Rendering lista pagine all'interno del progetto
function renderProjectSubpagesList(type, entityId, pages) {
    if (!pages || pages.length === 0) {
        return `
            <div class="py-12 text-center text-slate-400 dark:text-slate-500">
                <div class="w-14 h-14 rounded-2xl bg-purple-50 dark:bg-purple-950/40 text-purple-500 mx-auto flex items-center justify-center text-xl mb-3">
                    <i class="fas fa-layer-group"></i>
                </div>
                <p class="text-sm font-bold text-slate-700 dark:text-slate-200">Nessuna pagina o verbale ancora creato</p>
                <p class="text-xs text-slate-400 mt-1 max-w-md mx-auto mb-5 leading-relaxed">
                    Crea la prima pagina per questo progetto: verbali di riunione, appunti di lavoro, schede tecniche o briefing.
                </p>
                <button onclick="createNotebookSubpage('${type}', '${entityId}')" class="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-md transition active:scale-95 inline-flex items-center gap-2">
                    <i class="fas fa-plus"></i> Crea Prima Pagina
                </button>
            </div>
        `;
    }

    return `
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            ${pages.map(p => {
                const plain = (p.content || '').replace(/<[^>]*>?/gm, '').trim();
                let preview = plain.substring(0, 110);
                if (plain.length > 110) preview += '...';
                if (!preview) preview = 'Pagina vuota, clicca per scrivere...';
                const tags = p.tags || [];

                return `
                    <div class="p-4 rounded-xl border border-slate-200 dark:border-darkborder bg-white dark:bg-darkpanel hover:border-purple-400 dark:hover:border-purple-600 transition flex flex-col justify-between group shadow-sm">
                        <div class="cursor-pointer" onclick="openNotebookSubpage('${p.id}')">
                            <div class="flex items-center justify-between gap-2 mb-2">
                                <span class="text-[10px] font-mono text-slate-400 font-semibold">${p.date || 'Senza data'}</span>
                                <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">${escapeNoteHtml(p.tipologia || 'Riunione')}</span>
                            </div>
                            
                            <h4 class="text-sm font-bold text-slate-800 dark:text-slate-100 truncate group-hover:text-purple-600 dark:group-hover:text-purple-400 transition mb-1.5 flex items-center gap-1.5">
                                <i class="far fa-file-alt text-purple-500 text-xs"></i>
                                ${escapeNoteHtml(p.title || 'Senza titolo')}
                            </h4>

                            ${tags.length > 0 ? `
                                <div class="flex flex-wrap gap-1 mb-2">
                                    ${tags.map(t => `<span class="px-1.5 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/40 text-[9px] font-bold text-purple-600 dark:text-purple-300 border border-purple-200 dark:border-purple-800/40">#${escapeNoteHtml(t)}</span>`).join('')}
                                </div>
                            ` : ''}

                            <p class="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed mb-3">${escapeNoteHtml(preview)}</p>
                        </div>

                        <div class="flex items-center justify-between pt-2.5 border-t border-slate-100 dark:border-slate-800 text-xs">
                            <button onclick="openNotebookSubpage('${p.id}')" class="text-xs font-bold text-purple-600 dark:text-purple-400 hover:text-purple-800 flex items-center gap-1">
                                <i class="fas fa-edit text-[11px]"></i> Apri
                            </button>
                            <div class="flex items-center gap-1">
                                <button type="button" onclick="event.stopPropagation(); openPageExportModal('${p.id}')" class="p-1.5 text-slate-400 hover:text-blue-500 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition" title="Esporta documento">
                                    <i class="fas fa-download text-xs"></i>
                                </button>
                                <button onclick="deleteNotebookSubpage('${p.id}')" class="p-1.5 text-slate-400 hover:text-rose-500 rounded hover:bg-rose-50 dark:hover:bg-rose-950/30 transition" title="Elimina pagina">
                                    <i class="fas fa-trash text-xs"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

// Rendering editor della singola pagina attiva
function renderSubpageEditor(type, entityId) {
    const page = (state.data.pages || []).find(p => p.id === activeSubpageId);
    if (!page) {
        activeSubpageId = null;
        return renderProjectSubpagesList(type, entityId, (state.data.pages || []).filter(p => p.contextId === entityId));
    }

    // Risoluzione Progetto e Sfera
    let currentCtxId = page.contextId || '';
    let currentSphere = null;
    if (page.sphereId) {
        currentSphere = getEntity('sphere', page.sphereId);
    }
    if (!currentSphere && currentCtxId) {
        const p = getEntity('project', currentCtxId);
        if (p) currentSphere = getEntity('sphere', p.sphereId);
        else {
            const sp = getEntity('subproject', currentCtxId);
            if (sp) {
                const pp = getEntity('project', sp.projectId);
                if (pp) currentSphere = getEntity('sphere', pp.sphereId);
            }
        }
    }
    const sphereName = currentSphere ? currentSphere.name : 'Nessun Ambito';
    const sphereColor = currentSphere ? (currentSphere.color || '#6366f1') : '#94a3b8';

    // Opzioni progetti & sottoprogetti
    let projOptionsHtml = '<option value="">Nessun Progetto (Generale)</option>';
    (state.data.projects || []).forEach(p => {
        const isSel = p.id === currentCtxId;
        projOptionsHtml += `<option value="${p.id}" ${isSel ? 'selected' : ''}>📁 ${escapeNoteHtml(p.name)}</option>`;
        (state.data.subprojects || []).filter(sp => sp.projectId === p.id).forEach(sp => {
            const isSubSel = sp.id === currentCtxId;
            projOptionsHtml += `<option value="${sp.id}" ${isSubSel ? 'selected' : ''}>  ↳ ${escapeNoteHtml(sp.name)}</option>`;
        });
    });

    const tipologie = getDocumentTypes();
    const currentTipologia = page.tipologia || 'Riunione';

    return `
        <div class="space-y-4">
            <!-- TOP BAR SOTTOPAGINA -->
            <div class="flex items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-darkborder">
                <div class="flex items-center gap-3 min-w-0 flex-1">
                    <button onclick="closeSubpageEditor()" class="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 text-xs font-bold transition flex items-center gap-1.5 shrink-0 active:scale-95">
                        <i class="fas fa-arrow-left text-[11px]"></i> <span>Torna alle Pagine</span>
                    </button>
                    <div class="h-4 w-px bg-slate-300 dark:bg-slate-700"></div>
                    <div class="flex items-center gap-2 flex-1 min-w-0">
                        <i class="fas fa-file-lines text-purple-500 shrink-0 text-sm"></i>
                        <input type="text" value="${escapeNoteHtml(page.title || '')}" onchange="updateSubpageProperty('${page.id}', 'title', this.value)" class="text-base font-black bg-transparent border-b border-transparent hover:border-slate-300 dark:hover:border-slate-700 focus:border-purple-500 focus:outline-none text-slate-900 dark:text-white flex-1 min-w-0 px-1 py-0.5 transition" placeholder="Titolo del documento / riunione...">
                    </div>
                </div>

                <div class="flex items-center gap-1.5 shrink-0">
                    <!-- Esporta Singola Pagina (MODAL DIRETTO PULITO) -->
                    <button type="button" onclick="openPageExportModal('${page.id}')" class="text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-darkborder transition flex items-center gap-1.5 shadow-xs" title="Esporta documento in formato pulito">
                        <i class="fas fa-download text-xs text-indigo-500"></i> <span class="hidden sm:inline">Esporta</span>
                    </button>

                    <!-- Schermo Intero (SOLO ICONA) -->
                    <button type="button" onclick="toggleFocusMode('quill-subpage-editor')" class="text-xs font-bold bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-200 p-2 rounded-xl border border-slate-200 dark:border-darkborder transition shadow-sm active:scale-95" title="Schermo intero senza distrazioni">
                        <i class="fas fa-expand text-xs"></i>
                    </button>
                    <button type="button" onclick="deleteNotebookSubpage('${page.id}')" class="text-xs font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 p-2 rounded-xl transition active:scale-95" title="Elimina questa pagina">
                        <i class="fas fa-trash text-xs"></i>
                    </button>
                </div>
            </div>

            <!-- PROPRIETÀ COMPATTE DELLA PAGINA (NOTION-STYLE) -->
            <div class="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200/80 dark:border-darkborder grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                <!-- 1. Data -->
                <div>
                    <label class="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                        <i class="far fa-calendar-alt text-indigo-500"></i> Data
                    </label>
                    <input type="date" value="${page.date || ''}" onchange="updateSubpageProperty('${page.id}', 'date', this.value)" class="input-base text-xs font-semibold py-1.5 w-full bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
                </div>

                <!-- 2. Progetto di riferimento -->
                <div>
                    <label class="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                        <i class="fas fa-arrow-up-right-from-square text-amber-500"></i> Progetto
                    </label>
                    <select onchange="updateSubpageContext('${page.id}', this.value)" class="input-base text-xs font-semibold py-1.5 w-full bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
                        ${projOptionsHtml}
                    </select>
                </div>

                <!-- 3. Tipologia Personalizzabile -->
                <div>
                    <div class="flex items-center justify-between mb-1">
                        <label class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                            <i class="far fa-dot-circle text-emerald-500"></i> Tipologia
                        </label>
                        <button type="button" onclick="openDocumentTypesModal()" class="text-[9px] font-bold text-indigo-500 hover:underline">⚙ Gestisci</button>
                    </div>
                    <select onchange="if(this.value === '__manage__'){ openDocumentTypesModal(); this.value = '${currentTipologia}'; } else { updateSubpageProperty('${page.id}', 'tipologia', this.value); }" class="input-base text-xs font-semibold py-1.5 w-full bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
                        ${tipologie.map(t => `<option value="${t.name}" ${currentTipologia === t.name ? 'selected' : ''}>${escapeNoteHtml(t.name)}</option>`).join('')}
                        <option value="__manage__" class="font-bold text-indigo-600">⚙ Gestisci tipologie...</option>
                    </select>
                </div>

                <!-- 4. Ambito (Sfera) -->
                <div>
                    <label class="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                        <i class="fas fa-layer-group text-purple-500"></i> Ambito
                    </label>
                    <div class="py-1 px-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-between min-h-[32px]">
                        <span class="inline-flex items-center gap-1.5 text-xs font-bold px-2 py-0.5 rounded-md" style="background-color: ${sphereColor}20; color: ${sphereColor};">
                            <i class="fas fa-circle text-[7px]"></i> ${escapeNoteHtml(sphereName)}
                        </span>
                        <span class="text-[9px] text-slate-400 lowercase">sfera</span>
                    </div>
                </div>
            </div>

            <!-- TAG DELLA PAGINA -->
            <div class="flex flex-wrap items-center gap-1.5 py-0.5 text-xs">
                <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-1 flex items-center gap-1"><i class="fas fa-tags text-purple-500"></i> Tag:</span>
                ${(page.tags || []).map(tag => `
                    <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                        #${escapeNoteHtml(tag)}
                        <button type="button" onclick="removePageTag('${page.id}', '${escapeNoteHtml(tag)}')" class="hover:text-red-500 text-[10px] ml-0.5"><i class="fas fa-times"></i></button>
                    </span>
                `).join('')}
                <div class="inline-flex items-center gap-1">
                    <input type="text" id="newPageTagInput_${page.id}" placeholder="+ tag..." onkeydown="if(event.key==='Enter'){event.preventDefault();addPageTag('${page.id}', this.value);}" class="text-[11px] px-2 py-0.5 rounded-full border border-dashed border-slate-300 dark:border-slate-600 bg-transparent text-slate-700 dark:text-slate-200 focus:outline-none focus:border-purple-500 w-24">
                </div>
            </div>

            <!-- TOOLBAR DI INSERIMENTO PULITA & SPAZIOSA -->
            <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 text-xs">
                <button type="button" onclick="insertNoteCallout('idea')" class="px-2.5 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40 font-bold hover:bg-amber-100 transition shrink-0 flex items-center gap-1 active:scale-95">💡 Idea</button>
                <button type="button" onclick="insertNoteCallout('info')" class="px-2.5 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/40 font-bold hover:bg-blue-100 transition shrink-0 flex items-center gap-1 active:scale-95">ℹ️ Info</button>
                <button type="button" onclick="insertNoteCallout('warning')" class="px-2.5 py-1.5 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/40 font-bold hover:bg-red-100 transition shrink-0 flex items-center gap-1 active:scale-95">⚠️ Avviso</button>
                <button type="button" onclick="insertNoteCallout('success')" class="px-2.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40 font-bold hover:bg-emerald-100 transition shrink-0 flex items-center gap-1 active:scale-95">✅ Decisione</button>
                <button type="button" onclick="insertNoteQuote()" class="px-2.5 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/40 font-bold hover:bg-indigo-100 transition shrink-0 flex items-center gap-1 active:scale-95">❝ Citazione</button>
                <button type="button" onclick="insertNoteDivider()" class="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-bold hover:bg-slate-200 transition shrink-0 active:scale-95">➖ Divisore</button>
                <div class="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-1 shrink-0"></div>
                <button type="button" onclick="openNoteTaskPicker()" class="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-blue-50 hover:text-blue-600 border border-slate-200 dark:border-slate-700 font-bold transition shrink-0 flex items-center gap-1 active:scale-95"><i class="fas fa-link text-blue-500"></i> Task</button>
                <button type="button" onclick="openNoteContactPicker()" class="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-purple-50 hover:text-purple-600 border border-slate-200 dark:border-slate-700 font-bold transition shrink-0 flex items-center gap-1 active:scale-95"><i class="fas fa-user-tag text-purple-500"></i> Contatto</button>
                <button type="button" onclick="openNotePagePicker()" class="px-2.5 py-1.5 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 hover:bg-purple-100 border border-purple-200 dark:border-purple-800/60 font-bold transition shrink-0 flex items-center gap-1 active:scale-95"><i class="fas fa-file-alt text-purple-600"></i> Pagina ([[)</button>
                <div class="hidden lg:flex items-center gap-1.5 ml-auto text-[11px] text-slate-400">
                    <span class="font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded border border-slate-200 dark:border-slate-700">/</span> comandi
                    <span class="mx-1">•</span>
                    <span class="font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded border border-slate-200 dark:border-slate-700">@</span> contatti
                    <span class="mx-1">•</span>
                    <span class="font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded border border-slate-200 dark:border-slate-700">[[</span> wiki
                </div>
            </div>

            <!-- CONTAINER EDITOR TESTO SPAZIOSO -->
            <div class="project-notebook-editor bg-white dark:bg-darkbg rounded-xl border border-slate-200 dark:border-darkborder shadow-inner focus-within:ring-2 focus-within:ring-purple-500/30 transition">
                <div id="quill-subpage-editor" class="min-h-[380px] text-sm"></div>
            </div>
        </div>
    `;
}

// Esportazione pulita singola pagina per condivisione esterna (Senza gergo di sfera o metadati interni)
function exportSinglePage(pageId, format) {
    const page = (state.data.pages || []).find(p => p.id === pageId);
    if (!page) return;

    const title = page.title || 'Senza Titolo';
    const cleanTitle = title.replace(/[^a-zA-Z0-9_\-\s]/g, '').trim() || 'documento';
    const date = page.date || page.createdAt || '';
    const projName = getPageContextName(page.contextId);

    // Formattazione data leggibile
    let formattedDate = date;
    if (date && date.includes('-')) {
        const parts = date.split('-');
        if (parts.length === 3) {
            const months = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
            const m = parseInt(parts[1], 10) - 1;
            if (months[m]) formattedDate = `${parts[2]} ${months[m]} ${parts[0]}`;
        }
    }

    if (format === 'print') {
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            showToast("Consenti i popup per stampare", "error");
            return;
        }
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>${escapeNoteHtml(title)}</title>
                <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; padding: 48px; color: #1e293b; line-height: 1.7; max-width: 820px; margin: 0 auto; background: #fff; }
                    h1 { margin-bottom: 6px; font-size: 28px; font-weight: 800; color: #0f172a; letter-spacing: -0.02em; }
                    .meta { font-size: 13px; color: #64748b; margin-bottom: 28px; padding-bottom: 14px; border-bottom: 1.5px solid #e2e8f0; display: flex; flex-wrap: wrap; gap: 20px; font-weight: 500; }
                    .content { font-size: 15px; color: #334155; }
                    blockquote { border-left: 3.5px solid #6366f1; margin: 16px 0; padding: 8px 14px; color: #475569; font-style: italic; background: #f8fafc; border-radius: 0 8px 8px 0; }
                    .note-task-pill, .note-contact-pill, .note-page-pill { font-weight: 600; padding: 2px 6px; border-radius: 4px; background: #f1f5f9; }
                    hr { border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0; }
                    @media print { body { padding: 20px; } }
                </style>
            </head>
            <body>
                <h1>${escapeNoteHtml(title)}</h1>
                <div class="meta">
                    ${formattedDate ? `<span>📅 Data: ${formattedDate}</span>` : ''}
                    ${projName ? `<span>📁 Progetto: ${escapeNoteHtml(projName)}</span>` : ''}
                </div>
                <div class="content">${page.content || '<p>Nessun contenuto.</p>'}</div>
                <script>window.onload = function() { window.print(); }<\/script>
            </body>
            </html>
        `);
        printWindow.document.close();
        return;
    }

    let fileContent = '';
    let mimeType = 'text/plain';
    let ext = 'txt';

    if (format === 'markdown') {
        ext = 'md';
        mimeType = 'text/markdown';
        let md = page.content || '';
        md = md.replace(/<h1>(.*?)<\/h1>/gi, '# $1\n\n')
               .replace(/<h2>(.*?)<\/h2>/gi, '## $1\n\n')
               .replace(/<h3>(.*?)<\/h3>/gi, '### $1\n\n')
               .replace(/<p>(.*?)<\/p>/gi, '$1\n\n')
               .replace(/<br\s*\/?>/gi, '\n')
               .replace(/<strong>(.*?)<\/strong>/gi, '**$1**')
               .replace(/<b>(.*?)<\/b>/gi, '**$1**')
               .replace(/<em>(.*?)<\/em>/gi, '*$1*')
               .replace(/<i>(.*?)<\/i>/gi, '*$1*')
               .replace(/<blockquote>(.*?)<\/blockquote>/gi, '> $1\n\n')
               .replace(/<li>(.*?)<\/li>/gi, '- $1\n')
               .replace(/<[^>]+>/g, '');

        // Esportazione pura del contenuto del corpo senza intestazioni interne
        fileContent = md.trim() + '\n';
    } else if (format === 'html') {
        ext = 'html';
        mimeType = 'text/html';
        fileContent = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeNoteHtml(title)}</title><style>body{font-family:sans-serif;max-width:800px;margin:40px auto;line-height:1.6;color:#1e293b;}</style></head><body>${page.content || ''}</body></html>`;
    } else {
        const plain = (page.content || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        fileContent = plain;
    }

    const blob = new Blob([fileContent], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${cleanTitle}_${date || 'documento'}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Documento esportato in .${ext}`, "success");
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
                placeholder: 'Inizia a scrivere nelle note fisse... (digita / per i comandi o [[ per collegare)'
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
