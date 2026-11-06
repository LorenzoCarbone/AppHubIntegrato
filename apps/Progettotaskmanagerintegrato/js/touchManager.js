// --- TOUCH & DRAG MANAGER (Mobile-First Long Press & Gestures) ---
// Polyfill leggero e robusto per Drag & Drop HTML5 su dispositivi touch
// Risolve:
// 1. Spostamento accidentale delle card durante lo scrolling (richiede pressione di 500ms)
// 2. Click e modifica dei blocchi calendario su mobile
// 3. Swipe orizzontale tra i giorni nel calendario
(function() {
    'use strict';

    class MockDataTransfer {
        constructor() {
            this.data = {};
            this.effectAllowed = 'all';
            this.dropEffect = 'none';
            this.types = [];
        }
        setData(type, val) {
            this.data[type] = String(val);
            if (!this.types.includes(type)) this.types.push(type);
        }
        getData(type) {
            return this.data[type] || '';
        }
        clearData(type) {
            if (type) delete this.data[type];
            else { this.data = {}; this.types = []; }
        }
    }

    let holdTimer = null;
    let touchStartX = 0;
    let touchStartY = 0;
    let activeDraggable = null;
    let isDragging = false;
    let currentDataTransfer = null;
    let currentDropTarget = null;
    const HOLD_DELAY_MS = 500; // 500ms di pressione continua prima di attivare il drag
    const MOVE_THRESHOLD_PX = 9; // Più di 9px prima dei 500ms = normale scroll touch!

    // Swipe calendario
    let calSwipeStartX = 0;
    let calSwipeStartY = 0;

    function getClosestDraggable(el) {
        if (!el || !(el instanceof Element)) return null;
        return el.closest('[draggable="true"], .draggable, [data-drag-card]');
    }

    function dispatchDragEvt(target, eventType, clientX, clientY, dataTransfer) {
        if (!target) return false;
        const evt = new CustomEvent(eventType, { bubbles: true, cancelable: true });
        evt.clientX = clientX;
        evt.clientY = clientY;
        evt.pageX = clientX;
        evt.pageY = clientY;
        evt.dataTransfer = dataTransfer;
        return target.dispatchEvent(evt);
    }

    function onTouchStart(e) {
        if (e.touches.length !== 1) return;
        const touch = e.touches[0];
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;

        // Swipe calendario
        const calContainer = e.target.closest('#calDaysContainer, .calendar-col, .calendar-day-box');
        if (calContainer) {
            calSwipeStartX = touch.clientX;
            calSwipeStartY = touch.clientY;
        }

        const draggableEl = getClosestDraggable(e.target);
        if (!draggableEl) return;

        // Se il tap è su un bottone, input, checkbox, ecc., escludiamo il drag
        if (e.target.closest('button, input, textarea, select, a, .task-checkbox')) {
            return;
        }

        activeDraggable = draggableEl;
        isDragging = false;

        // Avvia il timer di 500ms
        holdTimer = setTimeout(() => {
            if (!activeDraggable) return;
            isDragging = true;
            currentDataTransfer = new MockDataTransfer();

            // Feedback aptico (vibrazione)
            if (navigator.vibrate) {
                try { navigator.vibrate(60); } catch(err) {}
            }

            // Feedback visivo immediato
            activeDraggable.classList.add('touch-drag-active');
            document.body.classList.add('is-dragging');

            dispatchDragEvt(activeDraggable, 'dragstart', touchStartX, touchStartY, currentDataTransfer);
        }, HOLD_DELAY_MS);
    }

    function onTouchMove(e) {
        if (e.touches.length !== 1) return;
        const touch = e.touches[0];
        const dx = Math.abs(touch.clientX - touchStartX);
        const dy = Math.abs(touch.clientY - touchStartY);

        // Se non abbiamo ancora raggiunto i 500ms:
        if (!isDragging) {
            // Se l'utente muove il dito, è uno SCROLL: annulla il timer
            if (dx > MOVE_THRESHOLD_PX || dy > MOVE_THRESHOLD_PX) {
                if (holdTimer) {
                    clearTimeout(holdTimer);
                    holdTimer = null;
                }
                activeDraggable = null;
            }
            return;
        }

        // Se il drag è attivo (dopo i 500ms):
        if (e.cancelable) e.preventDefault();

        const elUnderFinger = document.elementFromPoint(touch.clientX, touch.clientY);
        if (!elUnderFinger) return;

        if (elUnderFinger !== currentDropTarget) {
            if (currentDropTarget) {
                dispatchDragEvt(currentDropTarget, 'dragleave', touch.clientX, touch.clientY, currentDataTransfer);
            }
            currentDropTarget = elUnderFinger;
            dispatchDragEvt(currentDropTarget, 'dragenter', touch.clientX, touch.clientY, currentDataTransfer);
        }

        dispatchDragEvt(currentDropTarget, 'dragover', touch.clientX, touch.clientY, currentDataTransfer);
    }

    function onTouchEnd(e) {
        if (holdTimer) {
            clearTimeout(holdTimer);
            holdTimer = null;
        }

        if (isDragging) {
            isDragging = false;
            document.body.classList.remove('is-dragging');

            if (activeDraggable) {
                activeDraggable.classList.remove('touch-drag-active');
            }

            const touch = e.changedTouches ? e.changedTouches[0] : null;
            const clientX = touch ? touch.clientX : touchStartX;
            const clientY = touch ? touch.clientY : touchStartY;

            const dropTarget = document.elementFromPoint(clientX, clientY);
            if (dropTarget) {
                dispatchDragEvt(dropTarget, 'drop', clientX, clientY, currentDataTransfer);
            }

            if (activeDraggable) {
                dispatchDragEvt(activeDraggable, 'dragend', clientX, clientY, currentDataTransfer);
            }

            if (currentDropTarget) {
                dispatchDragEvt(currentDropTarget, 'dragleave', clientX, clientY, currentDataTransfer);
            }

            currentDropTarget = null;
            activeDraggable = null;
            currentDataTransfer = null;
            return;
        }

        // Gestione Swipe Calendario
        if (calSwipeStartX && e.changedTouches && e.changedTouches.length > 0) {
            const touch = e.changedTouches[0];
            const diffX = touch.clientX - calSwipeStartX;
            const diffY = touch.clientY - calSwipeStartY;
            if (Math.abs(diffX) > 60 && Math.abs(diffX) > Math.abs(diffY) * 1.4) {
                if (typeof stepCalDay === 'function' && window.innerWidth < 768 && state && state.view === 'global_calendar') {
                    if (diffX < 0) {
                        stepCalDay(1); // Swipe sinistra -> giorno successivo
                    } else {
                        stepCalDay(-1); // Swipe destra -> giorno precedente
                    }
                }
            }
            calSwipeStartX = 0;
            calSwipeStartY = 0;
        }

        activeDraggable = null;
    }

    function onTouchCancel(e) {
        if (holdTimer) {
            clearTimeout(holdTimer);
            holdTimer = null;
        }
        if (isDragging) {
            isDragging = false;
            document.body.classList.remove('is-dragging');
            if (activeDraggable) activeDraggable.classList.remove('touch-drag-active');
            if (currentDropTarget) {
                dispatchDragEvt(currentDropTarget, 'dragleave', 0, 0, currentDataTransfer);
            }
            if (activeDraggable) {
                dispatchDragEvt(activeDraggable, 'dragend', 0, 0, currentDataTransfer);
            }
        }
        activeDraggable = null;
        currentDropTarget = null;
        currentDataTransfer = null;
    }

    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd, { passive: true });
    document.addEventListener('touchcancel', onTouchCancel, { passive: true });

    window.TouchDragManager = {
        isHolding: () => isDragging
    };
})();
