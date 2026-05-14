// ==UserScript==
// @name         LEA Custom Filter (Stop)
// @namespace    le-tools
// @version      1.0.0
// @match        https://game.logistics-empire.com/*
// @description  Fügt einen Filter in der Gebäudeübersicht hinzu, um nur Gebäude mit gestoppter Produktionslinie anzuzeigen.
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // -----------------------------------------------------------------------
    // SELEKTOREN & KONSTANTEN
    // -----------------------------------------------------------------------
    const FILTER_BAR_SELECTOR = '.bb-filter-and-sort-bar';
    const INJECT_BTN_ID = 'lea-custom-stop-filter-btn';
    const BUILDING_CARD_SELECTOR = '.building-card';
    const STOP_ICON_SELECTOR = 'img[src*="icon_blocked"]';

    let isDropdownOpen = false;
    let activeFilters = {
        paused: false,
        fusion: false
    };

    // -----------------------------------------------------------------------
    // GLOBALER KLICK-LISTENER (für Dropdown)
    // -----------------------------------------------------------------------
    document.addEventListener('click', () => {
        if (isDropdownOpen) {
            isDropdownOpen = false;
            const container = document.getElementById(INJECT_BTN_ID);
            if (container) {
                container.remove();
                injectFilterButton();
            }
        }
    });

    // -----------------------------------------------------------------------
    // HILFSFUNKTIONEN
    // -----------------------------------------------------------------------
    function isBuildingOverviewOpen() {
        // Prüfen, ob wir die Filter-Leiste auf dem Bildschirm haben.
        // Das bedeutet, wir sind in einer Listen-Ansicht (Gebäude, Anfragen, etc.).
        // Wir aktivieren den Filter nur, wenn wir auch Gebäude-Karten finden.
        return !!document.querySelector(FILTER_BAR_SELECTOR);
    }

    function applyFilter() {
        if (!isBuildingOverviewOpen()) return;

        const buildings = Array.from(document.querySelectorAll(BUILDING_CARD_SELECTOR));

        for (let i = 0; i < buildings.length; i++) {
            const building = buildings[i];

            const hasAnyFilterActive = Object.values(activeFilters).some(v => v);

            if (!hasAnyFilterActive) {
                // Wenn kein Filter aktiv, zeige alle normal an
                building.style.opacity = '';
                building.style.pointerEvents = '';
                building.style.filter = '';
                building.style.boxShadow = 'none';
            } else {
                let shouldShow = false;

                // 1. Filter: Produktion pausiert
                if (activeFilters.paused) {
                    const hasStopSign = building.querySelector(STOP_ICON_SELECTOR);
                    if (hasStopSign) {
                        shouldShow = true;
                    }
                }

                // 2. Filter: Fusion im Gange
                if (activeFilters.fusion) {
                    const labels = building.querySelectorAll('.bb-label-container');
                    for (const label of labels) {
                        if (label.textContent.includes('Fusion im Gange')) {
                            shouldShow = true;
                            break;
                        }
                    }
                }

                if (shouldShow) {
                    // Gebäude erfüllt alle aktiven Filter -> Hervorheben
                    building.style.opacity = '1';
                    building.style.pointerEvents = 'auto';
                    building.style.filter = 'none';
                    // Optional: einen Rahmen setzen, um es noch besser hervorzuheben
                    building.style.boxShadow = '0 0 15px rgba(255, 0, 0, 0.8)';
                } else {
                    // Gebäude erfüllt nicht alle Filter -> "Ghosting" (stark abdunkeln, nicht klickbar)
                    building.style.opacity = '0.15';
                    building.style.pointerEvents = 'none';
                    building.style.filter = 'grayscale(100%)';
                    building.style.boxShadow = 'none';
                }
            }
        }
    }

    // -----------------------------------------------------------------------
    // UI: Filter-Button einfügen
    // -----------------------------------------------------------------------
    function injectFilterButton() {
        if (!isBuildingOverviewOpen()) {
            const existing = document.getElementById(INJECT_BTN_ID);
            if (existing) existing.remove();
            return;
        }

        if (document.getElementById(INJECT_BTN_ID)) {
            // Button ist bereits im DOM, kein Update nötig
            return;
        }

        const buildingTypeDiv = document.querySelector('[data-tutorial-id="filter_by_building_type"]');
        if (!buildingTypeDiv) return;

        // Container zu Flexbox machen, damit die Buttons nebeneinander liegen
        buildingTypeDiv.style.display = 'flex';
        buildingTypeDiv.style.alignItems = 'center';
        buildingTypeDiv.style.gap = '8px';

        // Wrapper-Container für Button und Dropdown
        const container = document.createElement('div');
        container.id = INJECT_BTN_ID;
        container.style.position = 'relative';

        // Haupt-Button-Element erstellen
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.title = 'Custom Filter Menü öffnen';

        // Basis-Styling und Klassen
        btn.className = 'bb-base-button size--md theme--light';
        btn.style.padding = '0 8px';

        const hasAnyFilterActive = Object.values(activeFilters).some(v => v);

        if (hasAnyFilterActive) {
            btn.classList.add('variant--normal');
            btn.style.border = '2px solid red';
            btn.style.backgroundColor = '#ffe6e6';
        } else {
            btn.classList.add('variant--neutral');
        }

        const inner = document.createElement('div');
        inner.className = 'relative flex size-full items-center justify-center';
        Object.assign(inner.style, {
            fontSize: '12px',
            fontWeight: 'bold',
            color: hasAnyFilterActive ? 'red' : 'inherit',
            whiteSpace: 'pre-line',
            textAlign: 'center',
            lineHeight: '1.1'
        });
        
        inner.textContent = 'Custom';
        
        // Pfeil-Icon hinzufügen für Dropdown-Indikator
        const arrow = document.createElement('span');
        arrow.textContent = ' ▼';
        arrow.style.fontSize = '9px';
        arrow.style.marginLeft = '4px';
        inner.appendChild(arrow);

        btn.appendChild(inner);
        container.appendChild(btn);

        // Dropdown-Menü erstellen (mit Game-Styling)
        const dropdown = document.createElement('div');
        dropdown.style.display = isDropdownOpen ? 'block' : 'none';
        dropdown.style.position = 'absolute';
        dropdown.style.top = '100%';
        dropdown.style.left = '0'; // Links-bündig zum Button
        dropdown.style.marginTop = '4px';
        dropdown.style.zIndex = '1001';
        dropdown.style.minWidth = '260px'; // Etwas breiter für die Toggle-Switches
        
        // Klassen vom Original-Dropdown (blaue Box)
        dropdown.className = 'p-popover p-component bb-filter-popover rounded-lg border-1 border-content-box-outline bg-container-bg-b bg-(image:--background-gradient-card-info) shadow-(--shadow-generic)';

        dropdown.addEventListener('click', (e) => {
            e.stopPropagation(); // Verhindert Schließen beim Klick ins Menü
        });

        const dropdownContent = document.createElement('div');
        dropdownContent.className = 'p-popover-content flex flex-col gap-md p-md';
        // Fallback-Padding/Gap falls die Tailwind-Klassen hier nicht komplett greifen:
        dropdownContent.style.padding = '12px';
        dropdownContent.style.gap = '12px';
        dropdownContent.style.color = 'white'; // Sichert weiße Schrift ab

        // --- Hilfsfunktion für Filter-Items ---
        function createFilterItem(id, labelText, emojiIcon, isActive, onClick) {
            const item = document.createElement('div');
            item.className = 'flex cursor-pointer items-center gap-1.5 select-none';
            
            const toggleBgClass = isActive ? 'bg-toggle-bg-on border-toggle-outline-on' : 'bg-toggle-bg-off border-toggle-outline-off';
            const toggleDotClass = isActive ? 'bg-toggle-on translate-x-[24px]' : 'bg-toggle-off translate-x-0';
            
            item.innerHTML = `
                <div class="size-9 shrink-0 flex items-center justify-center text-xl">${emojiIcon}</div>
                <span class="text-p1-500 flex-1">${labelText}</span>
                <div class="bg-content-box-bg relative h-[24px] w-[48px] rounded-full border transition duration-150 ease-in-out ${toggleBgClass}">
                    <div class="absolute top-[2px] left-[2px] aspect-square h-[18px] rounded-full transition duration-150 ease-in-out ${toggleDotClass}"></div>
                </div>
            `;
            
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                onClick();
            });
            
            return item;
        }

        // --- Hilfsfunktion für Divider ---
        function createDivider() {
            const div = document.createElement('div');
            div.className = 'w-full';
            div.innerHTML = `
                <div class="h-[1px] w-full bg-linear-to-r from-transparent via-white to-transparent opacity-30"></div>
                <div class="h-[1px] w-full bg-linear-to-r from-transparent via-black to-transparent opacity-50"></div>
            `;
            return div;
        }

        // 1. Option: Produktion pausiert
        const itemStop = createFilterItem('stop', 'Produktion pausiert', '🛑', activeFilters.paused, () => {
            activeFilters.paused = !activeFilters.paused;
            applyFilter();
            container.remove();
            injectFilterButton();
        });
        dropdownContent.appendChild(itemStop);

        // Trennlinie
        dropdownContent.appendChild(createDivider());

        // 2. Option: Fusion im Gange
        const itemFusion = createFilterItem('fusion', 'Fusion im Gange', '🔄', activeFilters.fusion, () => {
            activeFilters.fusion = !activeFilters.fusion;
            applyFilter();
            container.remove();
            injectFilterButton();
        });
        dropdownContent.appendChild(itemFusion);

        dropdown.appendChild(dropdownContent);
        container.appendChild(dropdown);

        // Klick-Logik für Hauptbutton (Menü auf/zu)
        btn.addEventListener('click', (e) => {
            e.stopPropagation();

            isDropdownOpen = !isDropdownOpen;

            // Container neu laden für frisches Styling
            container.remove();
            injectFilterButton();
        });

        // In das Div neben den anderen Button einfügen
        buildingTypeDiv.appendChild(container);
    }

    // -----------------------------------------------------------------------
    // INIT & OBSERVER
    // -----------------------------------------------------------------------
    function init() {
        console.log('[LEA Custom Filter] Initialisiert v1.0.0 (Stop-Schild Filter)');

        injectFilterButton();
        applyFilter();

        // MutationObserver fängt an, wenn sich das DOM ändert (z.B. durch Virtual Scrolling oder Menüwechsel)
        let isHandlingMutations = false;
        const observer = new MutationObserver(() => {
            if (!isHandlingMutations) {
                isHandlingMutations = true;
                requestAnimationFrame(() => {
                    injectFilterButton();
                    // Wenn ein Filter aktiv ist, müssen wir ihn auf neu aufgetauchte Gebäude anwenden
                    if (Object.values(activeFilters).some(v => v)) {
                        applyFilter();
                    }
                    isHandlingMutations = false;
                });
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
    }

    if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
