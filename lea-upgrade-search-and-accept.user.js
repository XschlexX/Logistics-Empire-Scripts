// ==UserScript==
// @name         LEA Upgrade Search and Accept
// @namespace    le-tools
// @version      1.2.3
// @match        https://game.logistics-empire.com/*
// @description  Sucht Gebaeude mit verfuegbaren Upgrades und klickt sie an. Bestaetigt Upgrade-Dialoge automatisch.
// @run-at       document-idle
// @grant        none
// @updateURL    https://raw.githubusercontent.com/XschlexX/Logistics-Empire-Scripts/main/lea-upgrade-search-and-accept.user.js
// @downloadURL  https://raw.githubusercontent.com/XschlexX/Logistics-Empire-Scripts/main/lea-upgrade-search-and-accept.user.js
// ==/UserScript==

(function () {
    'use strict';

    // -----------------------------------------------------------------------
    // SELEKTOREN & KONSTANTEN
    // -----------------------------------------------------------------------
    const AVAILABLE_STATUS_SRC = 'improvement_status_available_mini'; // Gelbes Upgrade-verfuegbar-Icon
    const ARROW_BTN_SRC = 'to_quest_objective';                // Blauer Pfeil rechts am Gebaeude
    const FILTER_BAR_SELECTOR = '.bb-filter-and-sort-bar';
    const INJECT_BTN_ID = 'lea-upgrade-scan-btn';

    // Dialog Auto-Accept
    const DIALOG_SELECTOR = '.bb-dialog';
    const TITLE_SELECTOR = '.text-h1';
    const BUCKS_SRC_PREFIX = 'https://game.logistics-empire.com/assets/cur_bucks-';
    const MARK_ATTR = 'data-lea-upgraded';

    // Prueft ob die UPGRADE-Uebersicht offen ist (nicht die allgemeine Gebaeudeübersicht!)
    // Erkennung: der Upgrades-Reiter (untere Leiste rechts) ist aktiv
    function isUpgradeOverviewOpen() {
        return !!document.querySelector('a[href="#/buildings/upgrades"].router-link-exact-active');
    }

    // -----------------------------------------------------------------------
    // SCHRITT 1: Gebaeude mit verfuegbarem Upgrade suchen und anklicken
    // -----------------------------------------------------------------------
    // Flag: wurde die Navigation zum Gebaeude vom Skript ausgeloest?
    // Nur dann darf clickBackWhenDone() automatisch zuruecknavigieren.
    // Bei manuell angeklickten Gebauden bleibt das Flag false → kein Auto-Zurueck!
    let scriptNavigatedToBuilding = false;

    function clickNextAvailableUpgrade() {
        const btnContainers = document.querySelectorAll('[data-tutorial-id="building-list-item-buttons"]');

        for (const container of btnContainers) {
            const card = container.closest('[class*="building-card"]');
            if (!card) continue;

            // Pruefen ob ein "Upgrade verfuegbar"-Icon vorhanden ist
            const hasAvailable = !!card.querySelector(`img[src*="${AVAILABLE_STATUS_SRC}"]`);
            if (!hasAvailable) continue;

            // Blauen Pfeil-Button finden und klicken
            const arrowBtn = container.querySelector(`img[src*="${ARROW_BTN_SRC}"]`)?.closest('button');
            if (arrowBtn && arrowBtn.offsetParent !== null) {
                console.log('[LEA Upgrade] Gebaeude mit verfuegbarem Upgrade gefunden, klicke Pfeil...');
                arrowBtn.click();
                scriptNavigatedToBuilding = true; // Skript hat navigiert
                return true;
            }
        }

        console.log('[LEA Upgrade] Kein Gebaeude mit verfuegbarem Upgrade gefunden.');
        return false;
    }

    // -----------------------------------------------------------------------
    // SCHRITT 2: Upgrade-Dialog automatisch bestaetigen
    // -----------------------------------------------------------------------
    function acceptUpgradeDialog(dialog) {
        if (!dialog || dialog.getAttribute(MARK_ATTR) === '1') return;

        const titleEl = dialog.querySelector(TITLE_SELECTOR);
        if (!titleEl) return;

        const titleText = (titleEl.textContent || '').trim();
        if (!/upgrade/i.test(titleText)) return;

        let targetBtn = null;
        dialog.querySelectorAll('button img').forEach(img => {
            const src = img.getAttribute('src') || img.src || '';
            if (src.startsWith(BUCKS_SRC_PREFIX) && !targetBtn) {
                targetBtn = img.closest('button');
            }
        });

        if (!targetBtn) return;

        dialog.setAttribute(MARK_ATTR, '1');
        console.log('[LEA Upgrade] Upgrade-Dialog erkannt, klicke Bestaetigen...');
        try {
            targetBtn.click();
        } catch (e) {
            console.error('[LEA Upgrade] Dialog-Klick fehlgeschlagen:', e);
        }
    }

    function scanDialogs() {
        document.querySelectorAll(DIALOG_SELECTOR).forEach(d => acceptUpgradeDialog(d));
    }

    // -----------------------------------------------------------------------
    // SCHRITT 1.5: Im Gebaeude-Detail den Zahnrad-Button mit Upgrade-Pfeil klicken
    // -----------------------------------------------------------------------
    const SETTINGS_BTN_SELECTOR = 'button[data-tutorial-id="factory-line-settings-button"]';
    const IMPROVEMENT_ARROW_SRC = 'improvement_arrow';
    let lastBuildingClickTime = 0;
    const BUILDING_CLICK_COOLDOWN_MS = 3000; // 3 Sekunden zwischen Klicks

    function clickUpgradeInBuilding() {
        // Cooldown pruefen
        if (Date.now() - lastBuildingClickTime < BUILDING_CLICK_COOLDOWN_MS) return;

        // Alle Zahnrad-Buttons auf der Seite suchen
        const settingsBtns = document.querySelectorAll(SETTINGS_BTN_SELECTOR);

        for (const btn of settingsBtns) {
            // Pruefen ob dieser Button den gruenen Upgrade-Pfeil als Overlay hat
            if (btn.querySelector(`img[src*="${IMPROVEMENT_ARROW_SRC}"]`)) {
                console.log('[LEA Upgrade] Zahnrad mit Upgrade-Pfeil gefunden, klicke...');
                btn.click();
                lastBuildingClickTime = Date.now();
                return; // Nur einen auf einmal klicken
            }
        }
    }

    // -----------------------------------------------------------------------
    // SCHRITT 2.5: Gelbe Verbesserungs-Buttons in der Linien-Konfiguration klicken
    // Nach dem Zahnrad-Klick oeffnet sich das Linien-Konfig-Fenster.
    // Dort gibt es gelbe Buttons mit improvement_arrow (z.B. Produktlager +100).
    // Es koennen mehrere sein – einen nach dem anderen klicken.
    // -----------------------------------------------------------------------
    let lastImprovementClickTime = 0;
    const IMPROVEMENT_CLICK_COOLDOWN_MS = 1500;

    function clickImprovementArrowButtons() {
        // Wenn gerade ein Dialog offen ist: warten – scanDialogs() uebernimmt
        if (document.querySelector(DIALOG_SELECTOR)) return;

        // Cooldown pruefen
        if (Date.now() - lastImprovementClickTime < IMPROVEMENT_CLICK_COOLDOWN_MS) return;

        // Gelbe Pfeil-Buttons in .improvements-entry suchen
        // Erkennnung: button nicht disabled, enthaelt improvement_arrow Bild
        const imgs = document.querySelectorAll(
            '.improvements-entry button:not([disabled]) img[src*="improvement_arrow"]'
        );

        for (const img of imgs) {
            const btn = img.closest('button');
            if (btn && btn.offsetParent !== null) {
                console.log('[LEA Upgrade] Gelber Verbesserungs-Button gefunden, klicke...');
                btn.click();
                lastImprovementClickTime = Date.now();
                return; // Einen nach dem anderen – naechsten nach Dialog-Bestaetigung
            }
        }
    }

    // -----------------------------------------------------------------------
    // SCHRITT 2.8: Globale Ausbauen-Buttons (z.B. "Parkplatz Ausbauen") klicken
    // -----------------------------------------------------------------------
    let lastExpandClickTime = 0;
    const EXPAND_CLICK_COOLDOWN_MS = 1500;

    function clickExpandButtons() {
        if (document.querySelector(DIALOG_SELECTOR)) return;
        if (Date.now() - lastExpandClickTime < EXPAND_CLICK_COOLDOWN_MS) return;

        const expandBtns = Array.from(document.querySelectorAll('button.variant--normal')).filter(btn => {
            const txt = btn.querySelector('.text-font-dark');
            return txt && txt.textContent.includes('Ausbauen') && btn.getAttribute('disabled') === null;
        });

        if (expandBtns.length > 0) {
            console.log('[LEA Upgrade] Ausbauen-Button gefunden, klicke...');
            expandBtns[0].click();
            lastExpandClickTime = Date.now();
        }
    }

    // -----------------------------------------------------------------------
    // SCHRITT 3: Zurueck-Button klicken wenn keine Upgrades mehr moeglich
    // Fall 1: Linien-Konfiguration offen, aber keine gelben Buttons mehr
    //         → Zurueck zur Gebaeude-Detailansicht
    // Fall 2: Gebaeude-Detailansicht offen, aber kein Zahnrad mit Upgrade-Pfeil
    //         → Zurueck zur Upgrade-Uebersicht (Liste)
    //
    // WICHTIG: Nur aktiv wenn das Skript selbst die Navigation ausgeloest hat
    //          (scriptNavigatedToBuilding = true). Manuell geoeffnete Gebaeude
    //          werden NICHT automatisch geschlossen!
    // -----------------------------------------------------------------------
    const BACK_BTN_SELECTOR = '.bottom-navigation button[show-divider]';
    let lastBackClickTime = 0;
    const BACK_CLICK_COOLDOWN_MS = 1500;

    function clickBackWhenDone() {
        // Nicht handeln wenn Dialog offen ist
        if (document.querySelector(DIALOG_SELECTOR)) return;

        // Nur aktiv wenn der Skript selbst zum Gebaeude navigiert hat
        // (verhindert Schliessen von manuell geoeffneten Gebaeuden)
        if (!scriptNavigatedToBuilding) return;

        // Cooldown pruefen
        if (Date.now() - lastBackClickTime < BACK_CLICK_COOLDOWN_MS) return;

        const backBtn = document.querySelector(BACK_BTN_SELECTOR);
        if (!backBtn || backBtn.offsetParent === null) return;

        // Fall 1: Linien-Konfigurationsansicht – keine klickbaren gelben Buttons mehr
        if (document.querySelector('.improvements-entry')) {
            const hasClickable = !!document.querySelector(
                '.improvements-entry button:not([disabled]) img[src*="improvement_arrow"]'
            );
            if (!hasClickable) {
                console.log('[LEA Upgrade] Linien-Konfiguration fertig, klicke Zurueck...');
                backBtn.click();
                lastBackClickTime = Date.now();
            }
            return;
        }

        // Fall 2: Gebaeude-Detailansicht – keine Upgrades mehr sichtbar
        const settingsBtns = document.querySelectorAll(SETTINGS_BTN_SELECTOR);
        const hasUpgradeGear = Array.from(settingsBtns).some(
            btn => btn.querySelector(`img[src*="${IMPROVEMENT_ARROW_SRC}"]`)
        );

        // NEU: Pruefen ob es noch einen aktiven "Ausbauen" Button gibt
        const expandBtns = Array.from(document.querySelectorAll('button.variant--normal')).filter(btn => {
            const txt = btn.querySelector('.text-font-dark');
            return txt && txt.textContent.includes('Ausbauen') && btn.getAttribute('disabled') === null;
        });

        if (!hasUpgradeGear && expandBtns.length === 0) {
            // Bevor wir Zurueck gehen, pruefen wir ob ein anderer Reiter (Lager, LKW) ein Upgrade hat
            const navTabsWithUpgrade = document.querySelectorAll('.bottom-navigation a button img[src*="improvement_arrow"]');

            for (const img of navTabsWithUpgrade) {
                const tabBtn = img.closest('button');
                // Nur inaktive Reiter anklicken, um Endlosschleifen im aktiven Reiter zu vermeiden
                if (tabBtn && tabBtn.getAttribute('active') !== 'true') {
                    console.log('[LEA Upgrade] Upgrade in anderem Reiter gefunden, wechsle Ansicht...');
                    tabBtn.click();
                    lastBackClickTime = Date.now();
                    return;
                }
            }

            // Weder hier noch in einem anderen Reiter gibt es was zu tun -> Zurueck zur Liste
            console.log('[LEA Upgrade] Kein weiteres Upgrade im Gebaeude, klicke Zurueck zur Liste...');
            backBtn.click();
            lastBackClickTime = Date.now();
            scriptNavigatedToBuilding = false; // Zurueck in der Liste: Flag zuruecksetzen
        }
    }

    function showToast(msg) {
        const existing = document.getElementById('lea-toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.id = 'lea-toast';
        toast.textContent = msg;
        toast.style.position = 'fixed';
        toast.style.top = '50%';
        toast.style.left = '50%';
        toast.style.transform = 'translate(-50%, -50%)';
        toast.style.backgroundColor = 'rgba(0, 0, 0, 0.85)';
        toast.style.color = '#fff';
        toast.style.padding = '20px 40px';
        toast.style.borderRadius = '12px';
        toast.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.5)';
        toast.style.zIndex = '9999';
        toast.style.fontSize = '20px';
        toast.style.fontWeight = 'bold';
        toast.style.textAlign = 'center';
        toast.style.pointerEvents = 'none';
        toast.style.transition = 'opacity 0.3s ease-in-out';

        document.body.appendChild(toast);

        setTimeout(() => {
            const el = document.getElementById('lea-toast');
            if (el) {
                el.style.opacity = '0';
                setTimeout(() => {
                    if (document.getElementById('lea-toast') === el) el.remove();
                }, 300);
            }
        }, 2000);
    }

    // -----------------------------------------------------------------------
    // UI: Scan-Button in die Toolbar der Upgrade-Uebersicht einfuegen
    // -----------------------------------------------------------------------
    function injectScanButton() {
        // Wenn wir nicht auf der Upgrade-Uebersicht sind: Button entfernen falls vorhanden
        if (!isUpgradeOverviewOpen()) {
            const existing = document.getElementById(INJECT_BTN_ID);
            if (existing) existing.remove();
            return;
        }
        if (document.getElementById(INJECT_BTN_ID)) return;

        const filterBar = document.querySelector(FILTER_BAR_SELECTOR);
        if (!filterBar) return;

        const toolbar = filterBar.querySelector('.flex.items-center.justify-between');
        if (!toolbar) return;

        // Such-Button als Referenzpunkt finden
        const searchBtn = toolbar.querySelector('[data-tutorial-id="filter_by_search"]');
        if (!searchBtn) return;

        const searchContainer = searchBtn.closest('.relative');
        if (!searchContainer) return;

        // Button erstellen (im gleichen Stil wie die anderen Toolbar-Buttons)
        const btn = document.createElement('button');
        btn.id = INJECT_BTN_ID;
        btn.type = 'button';
        btn.className = 'bb-base-button variant--neutral size--md theme--light';
        btn.title = 'Naechstes verfuegbares Upgrade anklicken';
        btn.style.marginRight = '8px';
        btn.style.padding = '0 12px';

        const inner = document.createElement('div');
        inner.className = 'relative flex size-full items-center justify-center';
        inner.style.fontSize = '12px';
        inner.style.fontWeight = 'bold';
        inner.style.whiteSpace = 'pre-line';
        inner.style.textAlign = 'center';
        inner.style.lineHeight = '1.1';
        inner.textContent = 'Auto\nUpgrade';
        btn.appendChild(inner);

        btn.addEventListener('click', (e) => {
            e.stopPropagation();

            // Finde eine sichtbare Gebaeude-Karte als Ankerpunkt
            const anchorCard = document.querySelector('[class*="building-card"]');
            if (anchorCard) {
                // Finde den scrollbaren Container, in dem die Karten liegen
                let scrollContainer = anchorCard.parentElement;
                while (scrollContainer && scrollContainer !== document.body) {
                    const style = window.getComputedStyle(scrollContainer);
                    if (style.overflowY === 'auto' || style.overflowY === 'scroll' || scrollContainer.classList.contains('scroll')) {
                        console.log('[LEA Upgrade] Scrolle Liste nach oben, um virtuelle Elemente zu laden...');
                        scrollContainer.scrollTop = 0;
                        break;
                    }
                    scrollContainer = scrollContainer.parentElement;
                }

                // 300ms warten, damit das Framework (Virtual Scrolling) die oberen HTML-Elemente rendern kann
                setTimeout(() => {
                    if (!clickNextAvailableUpgrade()) {
                        showToast('Kein weiteres Upgrade verfügbar!');
                    }
                }, 300);
            } else {
                // Fallback, falls gerade gar keine Karte gefunden wurde
                if (!clickNextAvailableUpgrade()) {
                    showToast('Keine Upgrades gefunden!');
                }
            }
        });

        // Button vor dem Such-Container einfuegen
        searchContainer.parentNode.insertBefore(btn, searchContainer);
        console.log('[LEA Upgrade] Scan-Button eingefuegt.');
    }

    // -----------------------------------------------------------------------
    // INIT
    // -----------------------------------------------------------------------
    function init() {
        console.log('[LEA Upgrade Search and Accept] Initialisiert v1.2.0 (mit MutationObserver)');

        // Einmaliger initialer Durchlauf beim Start
        injectScanButton();
        scanDialogs();
        clickUpgradeInBuilding();
        clickImprovementArrowButtons();
        clickExpandButtons();
        clickBackWhenDone();

        let isHandlingMutations = false;
        const observer = new MutationObserver(() => {
            if (!isHandlingMutations) {
                isHandlingMutations = true;
                requestAnimationFrame(() => {
                    injectScanButton();
                    scanDialogs();
                    clickUpgradeInBuilding();
                    clickImprovementArrowButtons();
                    clickExpandButtons();
                    clickBackWhenDone();
                    isHandlingMutations = false;
                });
            }
        });

        observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['style', 'class'] });
    }

    if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
