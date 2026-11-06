// --- GESTIONE RUBRICA CONTATTI ---
// --- RUBRICA ---
        function renderGlobalContacts() {
            let html = `
                <div class="flex justify-between items-center mb-8 pb-5 border-b border-slate-200 dark:border-darkborder">
                    <h2 class="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center tracking-tight"><i class="fas fa-address-book text-slate-400 dark:text-slate-500 mr-3"></i> Rubrica Globale</h2>
                    <button onclick="openContactModal()" class="bg-blue-600 hover:bg-blue-700 px-5 py-2.5 rounded-lg text-white text-sm font-bold shadow transition active:scale-95"><i class="fas fa-plus mr-1.5"></i> Nuovo Contatto</button>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">`;
            if(state.data.contacts.length===0) html += `<p class="text-sm text-slate-500 col-span-full italic">Rubrica vuota.</p>`;
            state.data.contacts.forEach(c => {
                html += `
                    <div class="panel p-6 flex flex-col gap-4 relative group bg-white dark:bg-darkpanel border border-slate-200 dark:border-darkborder shadow hover:shadow-md transition-shadow">
                        <button onclick="openContactModal('${c.id}')" class="absolute top-4 right-4 text-slate-400 hover:text-blue-500 opacity-0 group-hover:opacity-100 transition p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"><i class="fas fa-edit"></i></button>
                        <div class="flex items-center gap-4">
                            <div class="w-14 h-14 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 text-2xl shadow-inner border border-slate-200 dark:border-slate-700"><i class="fas fa-user"></i></div>
                            <div class="min-w-0 flex-1">
                                <p class="text-lg font-bold text-slate-900 dark:text-slate-100 truncate">${c.name}</p>
                                <p class="text-[11px] text-slate-500 font-bold uppercase tracking-wider truncate mt-1">${c.role} ${c.org ? ` • ${c.org}` : ''}</p>
                            </div>
                        </div>
                        <div class="text-xs font-medium text-slate-600 dark:text-slate-400 space-y-2 p-4 rounded-xl border border-slate-200 dark:border-darkborder bg-slate-50 dark:bg-[#202938]">
                            ${c.phone ? `<p class="flex items-center"><i class="fas fa-phone mr-2.5 text-slate-400"></i> ${c.phone}</p>` : ''}
                            ${c.email ? `<p class="flex items-center"><i class="fas fa-envelope mr-2.5 text-slate-400"></i> <a href="mailto:${c.email}" class="hover:text-blue-500 transition">${c.email}</a></p>` : ''}
                            ${!c.phone && !c.email ? '<p class="italic text-[10px] opacity-50">Nessun recapito disponibile.</p>' : ''}
                        </div>
                    </div>`;
            });
            return html + `</div>`;
        }

        function renderContextContacts(cId) {
            const contacts = state.data.contacts.filter(c => c.contextIds && c.contextIds.includes(cId));
            const availableToLink = state.data.contacts.filter(c => !(c.contextIds && c.contextIds.includes(cId)));
            
            let html = `
                <div class="flex gap-2 mb-5">
                    <select id="linkContact_${cId}" class="input-base text-[11px] font-bold py-2 flex-1">
                        <option value="">Collega dalla rubrica...</option>
                        ${availableToLink.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
                    </select>
                    <button onclick="linkExistingContact('${cId}')" class="bg-blue-600 hover:bg-blue-700 px-4 rounded-lg text-white text-[11px] font-bold shadow-sm transition active:scale-95"><i class="fas fa-link"></i></button>
                </div>
                <div class="space-y-3">`;
            if(contacts.length===0) html += `<p class="text-[11px] text-slate-500 italic">Nessun contatto collegato.</p>`;
            
            contacts.forEach(c => {
                html += `
                    <div class="p-4 bg-slate-50 dark:bg-[#202938] border border-slate-200 dark:border-darkborder rounded-xl relative group shadow-sm transition-shadow hover:shadow-md">
                        <div class="flex items-center gap-3 mb-3 cursor-pointer" onclick="openContactModal('${c.id}')">
                            <div class="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-500 shrink-0 border border-slate-300 dark:border-slate-700"><i class="fas fa-user text-sm"></i></div>
                            <div class="flex-1 min-w-0">
                                <p class="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">${c.name}</p>
                                <p class="text-[10px] text-slate-500 font-bold truncate uppercase tracking-widest mt-0.5">${c.role}</p>
                            </div>
                        </div>
                        <div class="text-[11px] font-bold text-slate-500 mt-2 pl-12 space-y-1.5">
                            ${c.phone ? `<div class="flex items-center"><i class="fas fa-phone mr-2"></i> ${c.phone}</div>` : ''}
                            ${c.email ? `<div class="flex items-center"><i class="fas fa-envelope mr-2"></i> <a href="mailto:${c.email}" class="hover:text-blue-500 transition" onclick="event.stopPropagation()">${c.email}</a></div>` : ''}
                        </div>
                        <button onclick="unlinkContact('${c.id}', '${cId}')" class="absolute top-3 right-3 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700" title="Scollega dal progetto"><i class="fas fa-unlink text-[11px]"></i></button>
                    </div>`;
            });
            return html + `</div>`;
        }

        function linkExistingContact(cId) {
            const select = document.getElementById('linkContact_' + cId);
            if(!select.value) return;
            const c = state.data.contacts.find(x => x.id === select.value);
            if(c && (!c.contextIds || !c.contextIds.includes(cId))) {
                if(!c.contextIds) c.contextIds = [];
                c.contextIds.push(cId);
                showToast("Contatto collegato", "success");
                AppData.triggerSave(); render();
            }
        }
        function unlinkContact(contactId, cId) {
            const c = state.data.contacts.find(x => x.id === contactId);
            if(c) { c.contextIds = c.contextIds.filter(id => id !== cId); showToast("Contatto scollegato", "success"); AppData.triggerSave(); render(); }
        }

        function openContactModal(cId=null, linkCtx=null) {
            contactEditId = cId;
            document.getElementById('contactModal').classList.remove('hidden');
            document.getElementById('contactModal').classList.add('flex');
            const btnDel = document.getElementById('cmDeleteBtn');
            if(cId) {
                const c = state.data.contacts.find(x => x.id === cId);
                if(!c) return;
                document.getElementById('cmTitle').innerHTML = '<i class="fas fa-user-edit text-blue-500 mr-2"></i> Modifica Contatto';
                document.getElementById('cmName').value = c.name; document.getElementById('cmRole').value = c.role;
                document.getElementById('cmOrg').value = c.org || ''; document.getElementById('cmPhone').value = c.phone || ''; document.getElementById('cmEmail').value = c.email || '';
                btnDel.classList.remove('hidden');
            } else {
                document.getElementById('cmTitle').innerHTML = '<i class="fas fa-user-plus text-blue-500 mr-2"></i> Nuovo Contatto';
                ['cmName','cmRole','cmOrg','cmPhone','cmEmail'].forEach(id => document.getElementById(id).value = '');
                btnDel.classList.add('hidden');
            }
            localStorage.setItem('temp_ctx_link', linkCtx || '');
        }
        function closeContactModal() { 
            document.getElementById('contactModal').classList.add('hidden'); 
            document.getElementById('contactModal').classList.remove('flex'); 
        }
        function saveContact() {
            const name = document.getElementById('cmName').value.trim(); 
            if(!name) { showToast("Inserisci il nome", "error"); return; }
            const payload = { name, role: document.getElementById('cmRole').value, org: document.getElementById('cmOrg').value, phone: document.getElementById('cmPhone').value, email: document.getElementById('cmEmail').value };
            if(contactEditId) { 
                let obj = state.data.contacts.find(x => x.id === contactEditId);
                if(obj) Object.assign(obj, payload); 
                showToast("Contatto modificato", "success");
            } else {
                const ctxLink = localStorage.getItem('temp_ctx_link');
                state.data.contacts.push({ id: 'c_'+Date.now(), ...payload, contextIds: ctxLink ? [ctxLink] : [] });
                showToast("Contatto salvato", "success");
            }
            closeContactModal(); AppData.triggerSave(); render();
        }
        function deleteContact() { if(confirm("Eliminare definitivamente?")) { state.data.contacts = state.data.contacts.filter(x => x.id !== contactEditId); closeContactModal(); showToast("Contatto eliminato", "success"); AppData.triggerSave(); render(); } }
