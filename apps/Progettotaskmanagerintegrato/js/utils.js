// --- UTILITY GLOBALI & TEMI ---
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
    const container = document.getElementById(editorId).parentElement;
    container.classList.toggle('focus-mode-active');
    if(container.classList.contains('focus-mode-active')) {
        showToast("Zen Mode attivato. Premi Esc per uscire.", "success");
        const escHandler = function(e) {
            if(e.key === 'Escape') {
                container.classList.remove('focus-mode-active');
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);
    }
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
        'importModal', 'mobileQuickAddModal', 'shortcutsModal', 'contactModal'
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
        const isTyping = ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeTag) || (document.activeElement && document.activeElement.isContentEditable);

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
