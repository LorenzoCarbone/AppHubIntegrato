// --- UTILITY GLOBALI & TEMI ---
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function triggerHaptic(type = 'light') {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try {
            if (type === 'light') navigator.vibrate(12);
            else if (type === 'medium') navigator.vibrate(28);
            else if (type === 'success') navigator.vibrate([15, 30, 20]);
            else if (type === 'error') navigator.vibrate([40, 50, 40]);
        } catch(e) {}
    }
}

// --- UNDO MANAGER & STACK ---
const UndoManager = {
    stack: [],
    toastTimeout: null,
    push(action) {
        // action: { label: string, undo: Function }
        this.stack.push(action);
        if (this.stack.length > 25) this.stack.shift();
        this.showUndoToast(action.label);
    },
    popAndUndo() {
        if (this.stack.length === 0) {
            showToast("Nessuna azione da annullare", "default");
            return;
        }
        const action = this.stack.pop();
        try {
            action.undo();
            this.hideUndoToast();
            triggerHaptic('medium');
            showToast(`Azione annullata: ${action.label}`, "success");
            AppData.triggerSave();
            render();
        } catch (e) {
            console.error("Undo error:", e);
            showToast("Errore durante l'annullamento", "default");
        }
    },
    showUndoToast(label) {
        let toast = document.getElementById('globalUndoToast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'globalUndoToast';
            toast.className = 'fixed bottom-20 md:bottom-8 right-4 md:right-8 z-[100] bg-slate-900 text-white dark:bg-white dark:text-slate-900 px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-slate-700/50 dark:border-slate-200 transition-all transform translate-y-4 opacity-0 pointer-events-none text-xs font-semibold';
            document.body.appendChild(toast);
        }
        clearTimeout(this.toastTimeout);
        toast.innerHTML = `
            <div class="flex items-center gap-2">
                <i class="fas fa-undo text-amber-400 dark:text-amber-600"></i>
                <span class="max-w-[200px] truncate">${escapeHtml(label)}</span>
            </div>
            <button onclick="UndoManager.popAndUndo()" class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-xl font-bold transition active:scale-95 text-xs shadow">
                Annulla (Ctrl+Z)
            </button>
            <button onclick="UndoManager.hideUndoToast()" class="text-slate-400 hover:text-white dark:hover:text-slate-700 p-1">
                <i class="fas fa-times text-xs"></i>
            </button>
        `;
        toast.classList.remove('translate-y-4', 'opacity-0', 'pointer-events-none');
        toast.classList.add('translate-y-0', 'opacity-100', 'pointer-events-auto');

        this.toastTimeout = setTimeout(() => {
            this.hideUndoToast();
        }, 8000);
    },
    hideUndoToast() {
        const toast = document.getElementById('globalUndoToast');
        if (toast) {
            toast.classList.add('translate-y-4', 'opacity-0', 'pointer-events-none');
            toast.classList.remove('translate-y-0', 'opacity-100', 'pointer-events-auto');
        }
    }
};

// --- CESTINO DI RECUPERO (SOFT DELETE) ---
function moveToTrash(type, item, contextInfo = '') {
    if (!state.data.trash) state.data.trash = [];
    const trashEntry = {
        trashId: 'trash_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        type: type, // 'task' | 'project' | 'subproject' | 'block' | 'contact'
        data: JSON.parse(JSON.stringify(item)),
        contextInfo: contextInfo,
        deletedAt: new Date().toISOString()
    };
    state.data.trash.unshift(trashEntry);
    
    // Connetti all'UndoManager
    const labelTitle = item.title || item.name || item.text || type;
    UndoManager.push({
        label: `Eliminato ${type}: ${labelTitle}`,
        undo: () => restoreFromTrash(trashEntry.trashId)
    });
}

function restoreFromTrash(trashId) {
    if (!state.data.trash) return;
    const idx = state.data.trash.findIndex(t => t.trashId === trashId);
    if (idx === -1) return;
    const entry = state.data.trash[idx];
    state.data.trash.splice(idx, 1);
    
    if (entry.type === 'task') {
        state.data.tasks.push(entry.data);
    } else if (entry.type === 'project') {
        state.data.projects.push(entry.data);
    } else if (entry.type === 'subproject') {
        state.data.subprojects.push(entry.data);
    } else if (entry.type === 'block') {
        state.data.calendarBlocks.push(entry.data);
    } else if (entry.type === 'contact') {
        state.data.contacts.push(entry.data);
    }
    AppData.triggerSave();
    showToast(`Elemento ripristinato dal cestino`, "success");
    renderTrashModal();
    render();
}

function purgeTrashItem(trashId) {
    if (!state.data.trash) return;
    state.data.trash = state.data.trash.filter(t => t.trashId !== trashId);
    AppData.triggerSave();
    renderTrashModal();
    showToast("Elemento eliminato definitivamente", "default");
}

function emptyTrash() {
    if (!state.data.trash || state.data.trash.length === 0) return;
    if (confirm("Vuoi svuotare definitivamente il cestino? Tutti gli elementi saranno eliminati per sempre.")) {
        state.data.trash = [];
        AppData.triggerSave();
        renderTrashModal();
        showToast("Cestino svuotato", "success");
    }
}

function openTrashModal() {
    const modal = document.getElementById('trashModal');
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    renderTrashModal();
}

function closeTrashModal() {
    const modal = document.getElementById('trashModal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

function renderTrashModal() {
    const container = document.getElementById('trashItemsList');
    if (!container) return;
    const trash = state.data.trash || [];
    if (trash.length === 0) {
        container.innerHTML = `
            <div class="py-12 text-center text-slate-400 dark:text-slate-500">
                <i class="fas fa-trash-alt text-3xl mb-3 opacity-40"></i>
                <p class="text-sm font-bold text-slate-700 dark:text-slate-300">Il cestino è vuoto</p>
                <p class="text-xs text-slate-400 mt-1">Gli elementi eliminati (task, blocchi orari, progetti) appariranno qui e potranno essere ripristinati.</p>
            </div>
        `;
        return;
    }

    const typeIcons = {
        task: { icon: 'fa-tasks', color: 'text-blue-500 bg-blue-50 dark:bg-blue-900/30' },
        project: { icon: 'fa-folder', color: 'text-amber-500 bg-amber-50 dark:bg-amber-900/30' },
        subproject: { icon: 'fa-file-alt', color: 'text-purple-500 bg-purple-50 dark:bg-purple-900/30' },
        block: { icon: 'fa-clock', color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/30' },
        contact: { icon: 'fa-user', color: 'text-indigo-500 bg-indigo-50 dark:bg-indigo-900/30' }
    };

    container.innerHTML = trash.map(entry => {
        const item = entry.data || {};
        const title = item.title || item.name || item.text || 'Elemento senza titolo';
        const conf = typeIcons[entry.type] || { icon: 'fa-box', color: 'text-slate-500 bg-slate-100' };
        const dateStr = entry.deletedAt ? new Date(entry.deletedAt).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' }) : '';
        return `
            <div class="p-3 bg-slate-50 dark:bg-[#1a2333] border border-slate-200 dark:border-darkborder rounded-xl flex items-center justify-between gap-3 group">
                <div class="flex items-center gap-3 min-w-0">
                    <div class="w-8 h-8 rounded-lg ${conf.color} flex items-center justify-center shrink-0">
                        <i class="fas ${conf.icon} text-xs"></i>
                    </div>
                    <div class="min-w-0">
                        <p class="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">${escapeHtml(title)}</p>
                        <p class="text-[10px] text-slate-400">Tipo: <span class="uppercase font-mono">${entry.type}</span> • Eliminato: ${dateStr}</p>
                    </div>
                </div>
                <div class="flex items-center gap-1.5 shrink-0">
                    <button onclick="restoreFromTrash('${entry.trashId}')" class="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-300 rounded-lg text-xs font-bold transition flex items-center gap-1" title="Ripristina">
                        <i class="fas fa-undo text-[10px]"></i> <span class="hidden sm:inline">Ripristina</span>
                    </button>
                    <button onclick="purgeTrashItem('${entry.trashId}')" class="p-1.5 text-slate-400 hover:text-red-500 transition" title="Elimina definitivamente">
                        <i class="fas fa-times text-xs"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// --- COMMAND PALETTE GLOBALE (CTRL+K) ---
let commandPaletteSelectedIndex = 0;
let commandPaletteItems = [];

function openCommandPalette() {
    const modal = document.getElementById('commandPaletteModal');
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    const input = document.getElementById('commandPaletteInput');
    if (input) {
        input.value = '';
        setTimeout(() => input.focus(), 60);
    }
    filterCommandPalette('');
}

function closeCommandPalette() {
    const modal = document.getElementById('commandPaletteModal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

window.openCommandPalette = openCommandPalette;
window.closeCommandPalette = closeCommandPalette;

function filterCommandPalette(query = '') {
    const container = document.getElementById('commandPaletteResults');
    if (!container) return;
    const q = (query || '').toLowerCase().trim();
    commandPaletteSelectedIndex = 0;
    commandPaletteItems = [];

    // 1. Azioni Rapide
    const quickActions = [
        { type: 'action', title: 'Nuovo Task', icon: 'fa-plus text-blue-500', action: () => { closeCommandPalette(); if (typeof openMobileQuickAdd === 'function') openMobileQuickAdd(); } },
        { type: 'action', title: 'Nuovo Blocco Calendario', icon: 'fa-clock text-emerald-500', action: () => { closeCommandPalette(); if (typeof openBlockModal === 'function') openBlockModal(); } },
        { type: 'action', title: 'Vai a Calendario', icon: 'fa-calendar-alt text-emerald-500', action: () => { closeCommandPalette(); if (typeof navigate === 'function') navigate('global_calendar'); } },
        { type: 'action', title: 'Vai a Task Manager', icon: 'fa-check-double text-blue-500', action: () => { closeCommandPalette(); if (typeof navigate === 'function') navigate('global_tasks'); } },
        { type: 'action', title: 'Vai a Rubrica', icon: 'fa-address-book text-purple-500', action: () => { closeCommandPalette(); if (typeof navigate === 'function') navigate('global_contacts'); } },
        { type: 'action', title: 'Apri Cestino di Recupero', icon: 'fa-trash-alt text-rose-500', action: () => { closeCommandPalette(); openTrashModal(); } },
        { type: 'action', title: 'Esporta Backup JSON', icon: 'fa-file-export text-slate-500', action: () => { closeCommandPalette(); AppData.exportJSON(); } }
    ];

    quickActions.forEach(a => {
        if (!q || a.title.toLowerCase().includes(q)) {
            commandPaletteItems.push(a);
        }
    });

    // 2. Progetti e Sottoprogetti
    (state.data.projects || []).forEach(p => {
        if (!q || (p.name && p.name.toLowerCase().includes(q))) {
            commandPaletteItems.push({
                type: 'project',
                title: p.name,
                subtitle: 'Progetto',
                icon: `${p.icon || 'fa-folder'} text-blue-500`,
                action: () => { closeCommandPalette(); if (typeof navigate === 'function') navigate('project', p.sphereId, p.id); }
            });
        }
    });

    (state.data.subprojects || []).forEach(sp => {
        if (!q || (sp.name && sp.name.toLowerCase().includes(q))) {
            const parent = (state.data.projects || []).find(p => p.id === sp.projectId);
            commandPaletteItems.push({
                type: 'subproject',
                title: sp.name,
                subtitle: `Sottoprogetto di ${parent ? parent.name : ''}`,
                icon: `${sp.icon || 'fa-file-alt'} text-indigo-500`,
                action: () => { closeCommandPalette(); if (typeof navigate === 'function') navigate('subproject', parent ? parent.sphereId : null, sp.projectId, sp.id); }
            });
        }
    });

    // 3. Task attivi
    (state.data.tasks || []).forEach(t => {
        const title = t.title || t.text || '';
        if (!q || title.toLowerCase().includes(q)) {
            commandPaletteItems.push({
                type: 'task',
                title: title,
                subtitle: t.dueDate ? `Scadenza: ${formatDisplayDate(t.dueDate)}` : 'Task',
                icon: `${t.completed ? 'fa-check-circle text-emerald-500' : 'fa-circle text-slate-400'}`,
                action: () => { closeCommandPalette(); if (typeof editTask === 'function') editTask(t.id); }
            });
        }
    });

    // 4. Contatti
    (state.data.contacts || []).forEach(c => {
        if (!q || (c.name && c.name.toLowerCase().includes(q)) || (c.role && c.role.toLowerCase().includes(q))) {
            commandPaletteItems.push({
                type: 'contact',
                title: c.name,
                subtitle: c.role ? `${c.role} ${c.org ? '• ' + c.org : ''}` : 'Contatto',
                icon: 'fa-user text-purple-500',
                action: () => { closeCommandPalette(); if (typeof openContactModal === 'function') openContactModal(c.id); }
            });
        }
    });

    // 5. Pagine & Note
    (state.data.pages || []).forEach(p => {
        const title = p.title || 'Senza titolo';
        const cleanContent = (p.content || '').replace(/<[^>]*>?/gm, '').toLowerCase();
        if (!q || title.toLowerCase().includes(q) || cleanContent.includes(q) || (p.tags || []).some(t => t.toLowerCase().includes(q))) {
            commandPaletteItems.push({
                type: 'page',
                title: title,
                subtitle: `Pagina • ${p.tipologia || 'Riunione'} • ${p.date || 'Senza data'}`,
                icon: 'fa-file-lines text-indigo-500',
                action: () => {
                    closeCommandPalette();
                    if (typeof navigate === 'function') navigate('global_pages');
                    if (typeof openGlobalPageEditor === 'function') openGlobalPageEditor(p.id);
                }
            });
        }
    });

    if (commandPaletteItems.length === 0) {
        container.innerHTML = `<div class="p-8 text-center text-xs text-slate-400">Nessun risultato per "${escapeHtml(q)}"</div>`;
        return;
    }

    renderCommandPaletteItems();
}

function renderCommandPaletteItems() {
    const container = document.getElementById('commandPaletteResults');
    if (!container) return;

    container.innerHTML = commandPaletteItems.slice(0, 40).map((item, idx) => {
        const isSelected = idx === commandPaletteSelectedIndex;
        return `
            <div onclick="executeCommandPaletteItem(${idx})" 
                 class="p-2.5 rounded-xl cursor-pointer flex items-center justify-between gap-3 transition ${isSelected ? 'bg-blue-600 text-white shadow-xs' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'}">
                <div class="flex items-center gap-2.5 min-w-0">
                    <i class="fas ${item.icon} text-xs w-4 text-center shrink-0 ${isSelected ? '!text-white' : ''}"></i>
                    <div class="min-w-0">
                        <p class="text-xs font-semibold truncate leading-tight">${escapeHtml(item.title)}</p>
                        ${item.subtitle ? `<p class="text-[10px] ${isSelected ? 'text-blue-100' : 'text-slate-400'} truncate">${escapeHtml(item.subtitle)}</p>` : ''}
                    </div>
                </div>
                <i class="fas fa-arrow-turn-down-left text-[10px] opacity-40 shrink-0"></i>
            </div>
        `;
    }).join('');
}

function executeCommandPaletteItem(idx) {
    const item = commandPaletteItems[idx];
    if (item && typeof item.action === 'function') {
        closeCommandPalette();
        try {
            item.action();
        } catch(err) {
            console.error("Command palette error:", err);
        }
    }
}

window.executeCommandPaletteItem = executeCommandPaletteItem;

function handleCommandPaletteKeyDown(e) {
    if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (commandPaletteSelectedIndex < commandPaletteItems.length - 1) {
            commandPaletteSelectedIndex++;
            renderCommandPaletteItems();
        }
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (commandPaletteSelectedIndex > 0) {
            commandPaletteSelectedIndex--;
            renderCommandPaletteItems();
        }
    } else if (e.key === 'Enter') {
        e.preventDefault();
        executeCommandPaletteItem(commandPaletteSelectedIndex);
    } else if (e.key === 'Escape') {
        closeCommandPalette();
    }
}

// --- CALCOLO RICORRENZE TASK ---
function calculateNextRecurrenceDate(baseDateStr, recurrence) {
    let date = baseDateStr ? new Date(baseDateStr) : new Date();
    if (isNaN(date.getTime())) date = new Date();
    const interval = Math.max(1, parseInt(recurrence.interval) || 1);

    if (recurrence.frequency === 'daily') {
        date.setDate(date.getDate() + interval);
    } else if (recurrence.frequency === 'weekly') {
        date.setDate(date.getDate() + (7 * interval));
    } else if (recurrence.frequency === 'monthly') {
        date.setMonth(date.getMonth() + interval);
    } else if (recurrence.frequency === 'weekdays') {
        do {
            date.setDate(date.getDate() + 1);
        } while (date.getDay() === 0 || date.getDay() === 6);
    }
    return getISODate(date);
}

function showToast(message, type = 'default') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'} mr-2"></i> ${message}`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'toastOut 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.1) forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
window.alert = function(msg) { showToast(msg, 'error'); };

function toggleFocusMode(editorId) {
    let el = null;
    if (editorId) el = document.getElementById(editorId);
    if (!el && typeof getActiveNotebookQuill === 'function') {
        const q = getActiveNotebookQuill();
        if (q) el = q.container;
    }
    if (!el) {
        showToast("Editor non trovato per la modalità Zen", "default");
        return;
    }
    const container = el.classList.contains('project-notebook-editor') ? el : (el.closest('.project-notebook-editor') || el.parentElement);
    if (!container) return;

    if (container.classList.contains('focus-mode-active')) {
        exitFocusMode();
    } else {
        enterFocusMode(container);
    }
}

function enterFocusMode(container) {
    container.classList.add('focus-mode-active');
    
    // Rimuove eventuale barra precedente
    let bar = document.getElementById('zenFloatingBar');
    if (bar) bar.remove();

    bar = document.createElement('div');
    bar.id = 'zenFloatingBar';
    bar.className = 'zen-floating-bar flex items-center justify-between px-5 py-2.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-md fixed top-0 left-0 right-0 z-[10000]';
    bar.innerHTML = `
        <div class="flex items-center gap-2.5">
            <span class="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span class="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <i class="fas fa-expand text-blue-500"></i> Schermo Intero
            </span>
            <span class="text-[11px] text-slate-400 hidden sm:inline">• Ambiente di scrittura privo di distrazioni</span>
        </div>
        <button onclick="exitFocusMode()" class="px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-300 text-slate-700 dark:text-slate-200 text-xs font-bold border border-slate-200 dark:border-slate-700 transition flex items-center gap-2 shadow-sm active:scale-95">
            <i class="fas fa-compress text-xs"></i> <span>Riduci</span> <kbd class="hidden md:inline bg-white dark:bg-slate-700 px-1.5 py-0.5 rounded text-[10px] font-mono border border-slate-300 dark:border-slate-600">Esc</kbd>
        </button>
    `;
    document.body.appendChild(bar);

    showToast("Schermo intero attivo. Premi Esc o 'Riduci' per tornare.", "default");
}

function exitFocusMode() {
    let wasActive = false;
    document.querySelectorAll('.focus-mode-active').forEach(el => {
        el.classList.remove('focus-mode-active');
        wasActive = true;
    });
    const bar = document.getElementById('zenFloatingBar');
    if (bar) {
        bar.remove();
        wasActive = true;
    }
    
    if (wasActive) {
        showToast("Schermo intero chiuso", "default");
    }
}

// Intercetta il tasto "Indietro" del browser e gesture mobile per chiudere lo Zen senza cambiare schermata
if (typeof window !== 'undefined' && !window.__zenPopstateAttached) {
    window.__zenPopstateAttached = true;
    window.addEventListener('popstate', function(e) {
        const active = document.querySelector('.focus-mode-active');
        const bar = document.getElementById('zenFloatingBar');
        if (active || bar) {
            if (active) active.classList.remove('focus-mode-active');
            if (bar) bar.remove();
            showToast("Uscito dalla modalità Zen", "default");
        }
    });

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            const active = document.querySelector('.focus-mode-active');
            if (active) exitFocusMode();
        }
    });
}

function applyTheme() {
    if (localStorage.getItem('theme') === 'light') {
        document.documentElement.classList.remove('dark');
    } else {
        document.documentElement.classList.add('dark');
        localStorage.setItem('theme', 'dark');
    }
}

function toggleTheme() {
    if (document.documentElement.classList.contains('dark')) {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('theme', 'light');
    } else {
        document.documentElement.classList.add('dark');
        localStorage.setItem('theme', 'dark');
    }
    render(); 
}
applyTheme();

function getISODate(dateObj) {
    const offset = dateObj.getTimezoneOffset() * 60000;
    return new Date(dateObj.getTime() - offset).toISOString().split('T')[0];
}

function getDayNameShort(dateObj) {
    const days = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
    return days[dateObj.getDay()];
}

function formatDisplayDate(dateStr) {
    if(!dateStr) return '';
    const parts = dateStr.split('-');
    if(parts.length !== 3) return dateStr;
    const d = new Date(parts[0], parts[1]-1, parts[2]);
    const day = parts[2];
    const months = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
    const month = months[d.getMonth()];
    return `${day} ${month}`;
}

function mapColor(c) {
    if (!c) return '#94a3b8';
    if (c.startsWith('#')) return c;
    const map = {
        'red': '#ef4444', 'blue': '#3b82f6', 'emerald': '#10b981', 'amber': '#f59e0b',
        'purple': '#a855f7', 'indigo': '#6366f1', 'teal': '#14b8a6', 'orange': '#f97316', 'slate': '#64748b'
    };
    return map[c] || '#94a3b8';
}

// Calcolo e formattazione visiva scadenze task (Oggi, Domani, Ieri, Dopodomani + Colori Verde, Arancione, Rosso)
function getDueDateStatus(dueDateStr) {
    if (!dueDateStr) return null;
    const todayStr = getISODate(new Date());

    if (dueDateStr === todayStr) {
        return {
            label: 'Oggi',
            colorClass: 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300 border-red-300 dark:border-red-800 font-black',
            icon: 'fa-calendar-day',
            diffDays: 0,
            urgency: 'critical'
        };
    }

    const [y, m, d] = dueDateStr.split('-').map(Number);
    const [ty, tm, td] = todayStr.split('-').map(Number);
    const targetDate = new Date(y, m - 1, d);
    const todayDate = new Date(ty, tm - 1, td);
    const diffTime = targetDate.getTime() - todayDate.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === -1) {
        return {
            label: 'Ieri',
            colorClass: 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-200 border-red-300 dark:border-red-700 font-black',
            icon: 'fa-exclamation-triangle',
            diffDays,
            urgency: 'overdue'
        };
    }
    if (diffDays < -1) {
        return {
            label: `Scaduta (${formatDisplayDate(dueDateStr)})`,
            colorClass: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 border-red-200 dark:border-red-800 font-bold',
            icon: 'fa-exclamation-circle',
            diffDays,
            urgency: 'overdue'
        };
    }
    if (diffDays === 1) {
        return {
            label: 'Domani',
            colorClass: 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300 border-red-300 dark:border-red-800 font-extrabold',
            icon: 'fa-calendar-alt',
            diffDays,
            urgency: 'critical'
        };
    }
    if (diffDays === 2) {
        return {
            label: 'Dopodomani',
            colorClass: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800 font-bold',
            icon: 'fa-calendar-alt',
            diffDays,
            urgency: 'critical'
        };
    }
    if (diffDays <= 7) {
        // Entro una settimana: Giallo / Arancione
        return {
            label: `${getDayNameShort(targetDate)} ${formatDisplayDate(dueDateStr)} (tra ${diffDays} gg)`,
            colorClass: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200 border-amber-300 dark:border-amber-700 font-bold',
            icon: 'fa-calendar-week',
            diffDays,
            urgency: 'warning'
        };
    }
    if (diffDays <= 30) {
        // Entro un mese: Verde
        return {
            label: formatDisplayDate(dueDateStr),
            colorClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700 font-semibold',
            icon: 'fa-calendar-check',
            diffDays,
            urgency: 'normal'
        };
    }
    // Oltre un mese: neutro
    return {
        label: formatDisplayDate(dueDateStr),
        colorClass: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700',
        icon: 'fa-calendar',
        diffDays,
        urgency: 'future'
    };
}

// --- SCORCIATOIE DA TASTIERA GLOBALI (HOTKEYS) ---
function toggleShortcutsModal(forceOpen) {
    const modal = document.getElementById('shortcutsModal');
    if (!modal) return;
    const shouldOpen = (typeof forceOpen === 'boolean') ? forceOpen : modal.classList.contains('hidden');
    if (shouldOpen) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        modal.style.display = 'flex';
    } else {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        modal.style.display = 'none';
    }
}

function closeAllModals() {
    const modalIds = [
        'blockModal', 'entityModal', 'blockNotesModal', 'settingsModal', 
        'importModal', 'mobileQuickAddModal', 'shortcutsModal', 'contactModal',
        'trashModal', 'commandPaletteModal', 'noteTaskPickerModal', 'noteContactPickerModal'
    ];
    modalIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.classList.add('hidden');
            el.classList.remove('flex');
            el.style.display = 'none';
        }
    });
    if (typeof editingTaskId !== 'undefined' && editingTaskId) {
        editingTaskId = null;
        render();
    }
}

if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('keydown', function(e) {
        const activeTag = document.activeElement ? document.activeElement.tagName : '';
        const isContentEditable = document.activeElement && (document.activeElement.isContentEditable || document.activeElement.closest('.ql-editor'));
        const isTyping = ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeTag) || isContentEditable;

        // Command Palette (Ctrl+K / Cmd+K)
        if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
            e.preventDefault();
            if (typeof openCommandPalette === 'function') openCommandPalette();
            return;
        }

        // Global Undo (Ctrl+Z / Cmd+Z)
        if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z') && !e.shiftKey) {
            if (!isTyping && typeof UndoManager !== 'undefined' && UndoManager.stack.length > 0) {
                e.preventDefault();
                UndoManager.popAndUndo();
                return;
            }
        }

        if (e.key === 'Escape') {
            closeAllModals();
            return;
        }

        if (isTyping) return;

        if (e.key === '?' || (e.shiftKey && e.key === '/')) {
            e.preventDefault();
            toggleShortcutsModal();
        } else if (e.key === 'n' || e.key === 'N') {
            e.preventDefault();
            const globalInput = document.getElementById('gtIn');
            if (globalInput && state.view === 'global_tasks') {
                globalInput.focus();
            } else if (typeof openMobileQuickAdd === 'function') {
                openMobileQuickAdd();
            }
        } else if (e.key === 'b' || e.key === 'B') {
            e.preventDefault();
            if (typeof openBlockModal === 'function') {
                openBlockModal();
            }
        } else if (e.key === 't' || e.key === 'T') {
            e.preventDefault();
            if (typeof navigate === 'function') navigate('global_tasks');
        } else if (e.key === 'c' || e.key === 'C') {
            e.preventDefault();
            if (typeof navigate === 'function') navigate('global_calendar');
        } else if (e.key === 'h' || e.key === 'H') {
            e.preventDefault();
            if (typeof navigate === 'function') navigate('home');
        }
    });
}
