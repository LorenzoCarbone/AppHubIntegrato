// --- GESTIONE RUBRICA CONTATTI & CRM LIGHT ---
function renderGlobalContacts() {
    let html = `
        <div class="flex justify-between items-center mb-8 pb-5 border-b border-slate-200 dark:border-darkborder">
            <div>
                <h2 class="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center tracking-tight">
                    <i class="fas fa-address-book text-purple-500 mr-3"></i> Rubrica Globale
                </h2>
                <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Gestione contatti, interazioni rapide, WhatsApp e collegamenti a progetti</p>
            </div>
            <button onclick="openContactModal()" class="bg-blue-600 hover:bg-blue-700 px-5 py-2.5 rounded-xl text-white text-sm font-bold shadow transition active:scale-95 flex items-center gap-2">
                <i class="fas fa-plus"></i> Nuovo Contatto
            </button>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">`;
    if(state.data.contacts.length===0) html += `<p class="text-sm text-slate-500 col-span-full italic">Rubrica vuota.</p>`;
    
    state.data.contacts.forEach(c => {
        const cleanPhone = c.phone ? c.phone.replace(/[^0-9+]/g, '') : '';
        const interactionsCount = (c.interactions || []).length;

        html += `
            <div class="panel p-6 flex flex-col gap-4 relative group bg-white dark:bg-darkpanel border border-slate-200 dark:border-darkborder shadow hover:shadow-md transition-shadow rounded-2xl">
                <button onclick="openContactModal('${c.id}')" class="absolute top-4 right-4 text-slate-400 hover:text-blue-500 opacity-0 group-hover:opacity-100 transition p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800" title="Modifica scheda"><i class="fas fa-edit"></i></button>
                <div class="flex items-center gap-4 cursor-pointer" onclick="openContactModal('${c.id}')">
                    <div class="w-14 h-14 rounded-2xl bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300 flex items-center justify-center text-xl font-bold shadow-inner border border-purple-200 dark:border-purple-800">
                        ${c.name ? c.name.charAt(0).toUpperCase() : '<i class="fas fa-user"></i>'}
                    </div>
                    <div class="min-w-0 flex-1">
                        <p class="text-lg font-bold text-slate-900 dark:text-slate-100 truncate">${escapeHtml(c.name)}</p>
                        <p class="text-[11px] text-slate-500 font-bold uppercase tracking-wider truncate mt-0.5">${escapeHtml(c.role || '')} ${c.org ? ` • ${escapeHtml(c.org)}` : ''}</p>
                        ${interactionsCount > 0 ? `<span class="inline-flex items-center gap-1 text-[10px] text-purple-600 dark:text-purple-400 font-bold mt-1"><i class="fas fa-comments text-[9px]"></i> ${interactionsCount} note registrate</span>` : ''}
                    </div>
                </div>
                
                <div class="text-xs font-medium text-slate-600 dark:text-slate-400 space-y-2 p-3.5 rounded-xl border border-slate-200 dark:border-darkborder bg-slate-50 dark:bg-[#202938]">
                    ${c.phone ? `<p class="flex items-center"><i class="fas fa-phone mr-2.5 text-slate-400 text-xs"></i> ${escapeHtml(c.phone)}</p>` : ''}
                    ${c.email ? `<p class="flex items-center truncate"><i class="fas fa-envelope mr-2.5 text-slate-400 text-xs"></i> <a href="mailto:${c.email}" class="hover:text-blue-500 transition truncate">${escapeHtml(c.email)}</a></p>` : ''}
                    ${!c.phone && !c.email ? '<p class="italic text-[10px] opacity-50">Nessun recapito disponibile.</p>' : ''}
                </div>

                <!-- PULSANTI ONE-TOUCH RAPIDI -->
                ${(c.phone || c.email) ? `
                <div class="flex items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                    ${cleanPhone ? `
                    <a href="https://wa.me/${cleanPhone.replace('+', '')}" target="_blank" onclick="event.stopPropagation()" class="flex-1 py-2 px-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 text-[11px] font-bold flex items-center justify-center gap-1.5 hover:bg-emerald-100 transition active:scale-95" title="Chat WhatsApp">
                        <i class="fab fa-whatsapp text-sm"></i> <span>WhatsApp</span>
                    </a>
                    <a href="tel:${cleanPhone}" onclick="event.stopPropagation()" class="py-2 px-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 text-[11px] font-bold flex items-center justify-center gap-1 hover:bg-blue-100 transition active:scale-95" title="Chiama">
                        <i class="fas fa-phone text-xs"></i>
                    </a>` : ''}
                    ${c.email ? `
                    <a href="mailto:${c.email}" onclick="event.stopPropagation()" class="py-2 px-3 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800 text-[11px] font-bold flex items-center justify-center gap-1 hover:bg-purple-100 transition active:scale-95" title="Invia Email">
                        <i class="fas fa-envelope text-xs"></i>
                    </a>` : ''}
                </div>` : ''}
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
                ${availableToLink.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}
            </select>
            <button onclick="linkExistingContact('${cId}')" class="bg-blue-600 hover:bg-blue-700 px-4 rounded-lg text-white text-[11px] font-bold shadow-sm transition active:scale-95"><i class="fas fa-link"></i></button>
        </div>
        <div class="space-y-3">`;
    if(contacts.length===0) html += `<p class="text-[11px] text-slate-500 italic">Nessun contatto collegato.</p>`;
    
    contacts.forEach(c => {
        const cleanPhone = c.phone ? c.phone.replace(/[^0-9+]/g, '') : '';
        html += `
            <div class="p-4 bg-slate-50 dark:bg-[#202938] border border-slate-200 dark:border-darkborder rounded-xl relative group shadow-sm transition-shadow hover:shadow-md">
                <div class="flex items-center gap-3 mb-3 cursor-pointer" onclick="openContactModal('${c.id}')">
                    <div class="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-500 shrink-0 border border-slate-300 dark:border-slate-700 font-bold text-xs">${c.name ? c.name.charAt(0).toUpperCase() : '<i class="fas fa-user"></i>'}</div>
                    <div class="flex-1 min-w-0">
                        <p class="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">${escapeHtml(c.name)}</p>
                        <p class="text-[10px] text-slate-500 font-bold truncate uppercase tracking-widest mt-0.5">${escapeHtml(c.role || '')}</p>
                    </div>
                </div>
                <div class="text-[11px] font-bold text-slate-500 mt-2 space-y-1.5">
                    ${c.phone ? `<div class="flex items-center"><i class="fas fa-phone mr-2 text-slate-400"></i> ${escapeHtml(c.phone)}</div>` : ''}
                    ${c.email ? `<div class="flex items-center"><i class="fas fa-envelope mr-2 text-slate-400"></i> <a href="mailto:${c.email}" class="hover:text-blue-500 transition" onclick="event.stopPropagation()">${escapeHtml(c.email)}</a></div>` : ''}
                </div>

                ${(c.phone || c.email) ? `
                <div class="flex items-center gap-2 mt-3 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                    ${cleanPhone ? `
                    <a href="https://wa.me/${cleanPhone.replace('+', '')}" target="_blank" onclick="event.stopPropagation()" class="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 text-[10px] font-bold flex items-center gap-1 hover:bg-emerald-100 transition active:scale-95" title="WhatsApp">
                        <i class="fab fa-whatsapp"></i> WA
                    </a>
                    <a href="tel:${cleanPhone}" onclick="event.stopPropagation()" class="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 text-[10px] font-bold flex items-center gap-1 hover:bg-blue-100 transition active:scale-95" title="Chiama">
                        <i class="fas fa-phone text-[9px]"></i> Chiama
                    </a>` : ''}
                    ${c.email ? `
                    <a href="mailto:${c.email}" onclick="event.stopPropagation()" class="px-2.5 py-1 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800 text-[10px] font-bold flex items-center gap-1 hover:bg-purple-100 transition active:scale-95" title="Email">
                        <i class="fas fa-envelope text-[9px]"></i> Email
                    </a>` : ''}
                </div>` : ''}

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
        renderContactInteractions(c);
    } else {
        document.getElementById('cmTitle').innerHTML = '<i class="fas fa-user-plus text-blue-500 mr-2"></i> Nuovo Contatto';
        ['cmName','cmRole','cmOrg','cmPhone','cmEmail'].forEach(id => document.getElementById(id).value = '');
        btnDel.classList.add('hidden');
        renderContactInteractions(null);
    }
    localStorage.setItem('temp_ctx_link', linkCtx || '');
}

function closeContactModal() { 
    document.getElementById('contactModal').classList.add('hidden'); 
    document.getElementById('contactModal').classList.remove('flex'); 
}

function renderContactInteractions(c) {
    const container = document.getElementById('cmInteractionsContainer');
    if (!container) return;
    if (!c) {
        container.classList.add('hidden');
        return;
    }
    container.classList.remove('hidden');
    const list = c.interactions || [];
    const listEl = document.getElementById('cmInteractionsList');
    if (listEl) {
        if (list.length === 0) {
            listEl.innerHTML = `<p class="text-xs text-slate-400 italic py-2">Nessuna interazione registrata.</p>`;
        } else {
            const icons = {
                call: 'fa-phone text-blue-500',
                whatsapp: 'fab fa-whatsapp text-emerald-500',
                email: 'fa-envelope text-purple-500',
                meeting: 'fa-handshake text-amber-500',
                note: 'fa-sticky-note text-slate-400'
            };
            listEl.innerHTML = list.map(item => `
                <div class="p-2.5 bg-slate-50 dark:bg-[#1a2333] border border-slate-200 dark:border-darkborder rounded-xl text-xs flex items-start justify-between gap-2">
                    <div class="flex items-start gap-2.5 min-w-0">
                        <i class="fas ${icons[item.type] || 'fa-comment'} mt-0.5 text-xs shrink-0"></i>
                        <div class="min-w-0">
                            <span class="text-[10px] text-slate-400 font-bold">${item.date || ''}</span>
                            <p class="text-slate-700 dark:text-slate-200 leading-snug break-words mt-0.5">${escapeHtml(item.text)}</p>
                        </div>
                    </div>
                    <button onclick="deleteContactInteraction('${c.id}', '${item.id}')" class="text-slate-400 hover:text-red-500 p-1"><i class="fas fa-times text-[10px]"></i></button>
                </div>
            `).join('');
        }
    }
}

function addContactInteraction() {
    const textInput = document.getElementById('newInteractionText');
    const typeSelect = document.getElementById('newInteractionType');
    if (!textInput || !textInput.value.trim()) return;
    const c = state.data.contacts.find(x => x.id === contactEditId);
    if (!c) return;
    if (!c.interactions) c.interactions = [];
    c.interactions.unshift({
        id: 'int_' + Date.now(),
        date: getISODate(new Date()),
        type: typeSelect ? typeSelect.value : 'note',
        text: textInput.value.trim()
    });
    textInput.value = '';
    AppData.triggerSave();
    renderContactInteractions(c);
    showToast("Interazione aggiunta", "success");
}

function deleteContactInteraction(cId, intId) {
    const c = state.data.contacts.find(x => x.id === cId);
    if (!c || !c.interactions) return;
    c.interactions = c.interactions.filter(i => i.id !== intId);
    AppData.triggerSave();
    renderContactInteractions(c);
}

function saveContact() {
    const name = document.getElementById('cmName').value.trim(); 
    if(!name) { showToast("Inserisci il nome", "error"); return; }
    const payload = { 
        name, 
        role: document.getElementById('cmRole').value, 
        org: document.getElementById('cmOrg').value, 
        phone: document.getElementById('cmPhone').value, 
        email: document.getElementById('cmEmail').value 
    };
    if(contactEditId) { 
        let obj = state.data.contacts.find(x => x.id === contactEditId);
        if(obj) Object.assign(obj, payload); 
        showToast("Contatto modificato", "success");
    } else {
        const ctxLink = localStorage.getItem('temp_ctx_link');
        state.data.contacts.push({ id: 'c_'+Date.now(), ...payload, contextIds: ctxLink ? [ctxLink] : [], interactions: [] });
        showToast("Contatto salvato", "success");
    }
    closeContactModal(); AppData.triggerSave(); render();
}

function deleteContact() { 
    const c = state.data.contacts.find(x => x.id === contactEditId);
    if(confirm("Spostare il contatto nel cestino?")) { 
        if (c && typeof moveToTrash === 'function') moveToTrash('contact', c);
        state.data.contacts = state.data.contacts.filter(x => x.id !== contactEditId); 
        closeContactModal(); 
        triggerHaptic('medium');
        AppData.triggerSave(); 
        render(); 
    } 
}
