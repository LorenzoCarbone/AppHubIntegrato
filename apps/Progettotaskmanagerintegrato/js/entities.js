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
            if(!confirm("Eliminare definitivamente? Verranno eliminati anche tutti i contenuti all'interno.")) return;
            const id = editState.id;
            if(editState.type === 'sphere') {
                state.data.spheres = state.data.spheres.filter(x => x.id !== id);
                const projs = state.data.projects.filter(x => x.sphereId === id).map(x=>x.id);
                state.data.projects = state.data.projects.filter(x => x.sphereId !== id);
                state.data.subprojects = state.data.subprojects.filter(x => !projs.includes(x.projectId));
                navigate('home');
            } else if(editState.type === 'project') {
                state.data.projects = state.data.projects.filter(x => x.id !== id);
                state.data.subprojects = state.data.subprojects.filter(x => x.projectId !== id);
                navigate('sphere', editState.sId || state.path.sphereId);
            } else {
                state.data.subprojects = state.data.subprojects.filter(x => x.id !== id);
                navigate('project', editState.sId || state.path.sphereId, editState.pId || state.path.projId);
            }
            showToast("Eliminato", "success");
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
                <div draggable="true" ondragstart="onDragStart(event, '${id}', '${type}', '${listType}')" ondragend="onDragEnd(event)" ondragover="onDragOver(event)" ondragleave="onDragLeave(event)" ondrop="onDrop(event, '${id}', '${type}', '${listType}')"
                     onclick="navigate('${type}', '${sId}', '${pId}', '${spId}')" class="panel panel-hover p-4 flex justify-between items-center relative group draggable mb-4 bg-white dark:bg-darkpanel border border-slate-200 dark:border-darkborder shadow-sm border-l-[5px]" style="border-left-color: ${colorHex}">
                    <div class="pl-1 word-wrap flex-1">
                        <h3 class="font-bold text-slate-800 dark:text-slate-100 text-sm flex items-center">
                            ${itemObj.pinned ? '<i class="fas fa-star text-amber-500 text-[10px] mr-1.5"></i>' : ''} <i class="fas ${icon} text-slate-400 dark:text-slate-500 mr-2 text-[13px]"></i> ${title}
                        </h3>
                        <p class="text-[10px] font-bold text-slate-500 mt-1.5 uppercase tracking-widest">${sub}</p>
                    </div>
                    <div class="flex gap-1.5 opacity-0 group-hover:opacity-100 transition items-center">
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

function handleNotesClick(type, id) {
            if (window.innerWidth < 768) openMobileNotes(type, id);
            else toggleNotes();
        }

        function toggleNotes() {
            const container = document.getElementById('notes-container');
            const btn = document.getElementById('toggle-notes-btn');
            if (container.classList.contains('hidden')) {
                container.classList.remove('hidden'); container.classList.add('flex');
                btn.innerHTML = '<i class="fas fa-chevron-up mr-1"></i> Nascondi Appunti';
            } else {
                container.classList.add('hidden'); container.classList.remove('flex');
                btn.innerHTML = '<i class="fas fa-chevron-down mr-1 hidden md:inline"></i> Mostra Appunti';
            }
        }

        let mobileNotesContext = { type: null, id: null, quill: null };
        function openMobileNotes(type, id) {
            const entity = getEntity(type, id);
            if(!entity) return;
            mobileNotesContext = { type, id };
            document.getElementById('mobileNotesTitle').innerHTML = `<i class="fas fa-pen-nib text-blue-500 mr-2"></i> Appunti - ${entity.name}`;
            document.getElementById('mobileNotesModal').classList.remove('hidden');
            document.getElementById('mobileNotesModal').classList.add('flex');
            
            if (!mobileNotesContext.quill) {
                const tOpts = [['bold', 'italic', 'underline', 'strike'], ['blockquote', 'code-block'], [{ 'list': 'ordered'}, { 'list': 'bullet' }], [{ 'color': [] }, { 'background': [] }], ['link'], ['clean']];
                mobileNotesContext.quill = new Quill('#quill-mobile-editor', { theme: 'snow', modules: { toolbar: tOpts }, placeholder: 'Inizia a scrivere...' });
            }
            mobileNotesContext.quill.root.innerHTML = entity.notes || '';
        }
        function closeMobileNotes() { 
            document.getElementById('mobileNotesModal').classList.add('hidden'); 
            document.getElementById('mobileNotesModal').classList.remove('flex');
            render(); 
        }
        function saveMobileNotes() {
            if(!mobileNotesContext.id) return;
            const entity = getEntity(mobileNotesContext.type, mobileNotesContext.id);
            if(entity) {
                entity.notes = mobileNotesContext.quill.root.innerHTML;
                AppData.triggerSave();
                showToast("Appunti salvati", "success");
            }
        }
        function archiveMobileNotes() {
            if(!mobileNotesContext.id) return;
            saveMobileNotes(); 
            archiveNotes(mobileNotesContext.type, mobileNotesContext.id);
            closeMobileNotes();
        }

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
            render();
            showToast("Foglio archiviato con successo", "success");
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
            if(!updates || updates.length === 0) return '';
            let html = `
                <div class="mt-8 pt-6 border-t border-slate-200 dark:border-darkborder">
                    <h3 class="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center mb-4"><i class="fas fa-history mr-2 text-sm"></i> Storico Appunti Archiviati</h3>
                    <div class="space-y-3">
            `;
            updates.forEach(u => {
                let preview = u.content.replace(/<[^>]*>?/gm, '').substring(0, 80) + '...';
                if(preview.trim() === '...') preview = 'Contenuto multimediale o formattato';
                html += `
                    <div class="flex justify-between items-center p-3 bg-slate-50 dark:bg-[#202938] border border-slate-200 dark:border-darkborder rounded-xl group hover:shadow-sm transition">
                        <div class="flex-1 min-w-0 cursor-pointer" onclick="openArchiveModal('${type}', '${entityId}', '${u.id}')">
                            <div class="text-[10px] font-bold text-slate-500 mb-1"><i class="far fa-calendar-alt mr-1"></i> ${u.date}</div>
                            <div class="text-xs text-slate-600 dark:text-slate-300 truncate">${preview}</div>
                        </div>
                        <div class="flex gap-1 ml-3 opacity-0 group-hover:opacity-100 transition">
                            <button onclick="openArchiveModal('${type}', '${entityId}', '${u.id}')" class="text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 p-2 rounded-lg transition"><i class="fas fa-expand-alt"></i></button>
                            <button onclick="deleteArchivedNote('${type}', '${entityId}', '${u.id}')" class="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded-lg transition"><i class="fas fa-trash"></i></button>
                        </div>
                    </div>
                `;
            });
            html += `</div></div>`;
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
                        el.__quill = new Quill(el, { theme: 'snow', modules: { toolbar: tOpts }, placeholder: 'Inizia a scrivere nel foglio libero...' });
                        el.__quill.root.innerHTML = entity.notes || '';
                        el.__quill.on('text-change', function(delta, oldDelta, source) { 
                            if (source === 'user') {
                                entity.notes = el.__quill.root.innerHTML; 
                                AppData.triggerSave(); 
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

        function togglePin(type, id) { 
            const e = getEntity(type, id);
            if(e) { e.pinned = !e.pinned; AppData.triggerSave(); render(); }
        }
        function toggleArchiveEntity(type, id) { 
            const e = getEntity(type, id);
            if(e) { e.archived = !e.archived; AppData.triggerSave(); render(); }
        }

        // --- TASKS ---
