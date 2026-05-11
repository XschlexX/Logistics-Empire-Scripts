// ==UserScript==
// @name         LEA Auto Produktion Change
// @namespace    le-tools
// @version      1.0.0
// @match        https://game.logistics-empire.com/*
// @description  Aendert die Produktion in den Produktionslinien per Knopfdruck.
// @run-at       document-idle
// @grant        none
// @updateURL    https://raw.githubusercontent.com/XschlexX/Logistics-Empire-Scripts/refs/heads/main/lea-auto-produktion-change.js
// @downloadURL  https://raw.githubusercontent.com/XschlexX/Logistics-Empire-Scripts/refs/heads/main/lea-auto-produktion-change.js
// ==/UserScript==

(function () {
    'use strict';

    const INJECT_BTN_ID = 'lea-prod-change-btn';

    function injectProductionChangeButton() {
        const editBtn = document.querySelector('button[data-tutorial-id="manage-building-button"]');

        if (!editBtn) return; // Wenn der gelbe Button nicht gefunden wurde, abbrechen

        // Prüfen, ob es überhaupt ein Produktionsgebäude ist.
        // Ein Produktionsgebäude hat entweder Einstellungs-Buttons für Linien, freischaltbare Linien 
        // oder die Überschrift "Produktionslinien".
        const isProductionBuilding =
            document.querySelector('[data-tutorial-id="factory-line-settings-button"]') ||
            document.querySelector('[data-tutorial-id="factory-line-unlock"]') ||
            Array.from(document.querySelectorAll('.panel-header p')).some(p => p.textContent.includes('Produktionslinien'));

        if (!isProductionBuilding) {
            // Wenn der Button hier existiert (z.B. nach Tab-Wechsel in einem Lager), entfernen wir ihn zur Sicherheit
            const existingBtn = document.getElementById(INJECT_BTN_ID);
            if (existingBtn) existingBtn.remove();
            return;
        }

        if (document.getElementById(INJECT_BTN_ID)) return; // Button ist schon da

        const headerContainer = editBtn.parentNode;

        // Button erstellen (im gleichen Stil wie andere LEA Buttons)
        const btn = document.createElement('button');
        btn.id = INJECT_BTN_ID;
        btn.type = 'button';
        // Nutze aehnliche Klassen wie beim Upgrade-Script
        btn.className = 'bb-base-button variant--neutral size--md theme--light';
        btn.title = 'Produktion ändern';
        btn.style.marginRight = '8px';
        btn.style.padding = '0 12px';

        const inner = document.createElement('div');
        inner.className = 'relative flex size-full items-center justify-center';
        inner.style.fontSize = '12px';
        inner.style.fontWeight = 'bold';
        inner.style.whiteSpace = 'pre-line';
        inner.style.textAlign = 'center';
        inner.style.lineHeight = '1.1';
        inner.textContent = 'Prod.\nändern';
        btn.appendChild(inner);

        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            showProductionSelectionMenu(btn);
        });

        // Button vor dem Edit-Button einfügen
        headerContainer.insertBefore(btn, editBtn);
        console.log('[LEA Auto Prod Change] Button eingefügt.');
    }

    function showProductionSelectionMenu(anchorBtn) {
        // Schließe existierendes Menü, falls offen
        const existing = document.getElementById('lea-prod-change-menu');
        if (existing) {
            existing.remove();
            return;
        }

        const menu = document.createElement('div');
        menu.id = 'lea-prod-change-menu';

        // Styling für das Menü (angelehnt an das Spiel-Design)
        menu.style.position = 'absolute';
        menu.style.backgroundColor = '#1e2430'; // Dunkles Spiel-Blau/Grau
        menu.style.border = '1px solid #34495e';
        menu.style.borderRadius = '8px';
        menu.style.padding = '10px';
        menu.style.boxShadow = '0 4px 12px rgba(0,0,0,0.5)';
        menu.style.zIndex = '9999';
        menu.style.display = 'flex';
        menu.style.flexDirection = 'column';
        menu.style.gap = '8px';

        // Positioniere das Menü unter dem Button
        const rect = anchorBtn.getBoundingClientRect();
        menu.style.top = `${rect.bottom + window.scrollY + 10}px`;
        menu.style.left = `${rect.left + window.scrollX}px`;

        // Optionen: Stop, Prod 1, Prod 2, Prod 3, Verschiedene
        const options = [
            { label: 'Stop', action: 'stop' },
            { label: 'Produkt 1', action: 'prod1' },
            { label: 'Produkt 2', action: 'prod2' },
            { label: 'Produkt 3', action: 'prod3' },
            { label: 'Verschiedene', action: 'mix' }
        ];

        options.forEach(opt => {
            const optBtn = document.createElement('button');
            optBtn.textContent = opt.label;
            optBtn.className = 'bb-base-button variant--normal size--sm theme--light';
            optBtn.style.width = '100%';
            optBtn.style.textAlign = 'center';
            optBtn.style.padding = '8px 16px';

            // Wir belassen den gelben Button-Hintergrund des Spiels und ändern nur die Schriftfarbe
            let textColor = '#2980b9'; // Standard: Blau für Produkte
            if (opt.action === 'stop') textColor = '#c0392b'; // Rot für Stop
            if (opt.action === 'mix') textColor = '#27ae60'; // Grün für Verschiedene

            optBtn.style.setProperty('color', textColor, 'important');
            optBtn.style.fontWeight = 'bold';
            optBtn.style.borderRadius = '4px';
            optBtn.style.cursor = 'pointer';

            optBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                console.log(`[LEA Auto Prod Change] Option gewählt: ${opt.label}`);
                menu.remove();
                executeProductionChange(opt.action);
            });
            menu.appendChild(optBtn);
        });

        // Klick irgendwoanders schließt das Menü
        const closeMenu = (e) => {
            if (!menu.contains(e.target) && e.target !== anchorBtn) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        };
        // Kurze Verzögerung, damit der aktuelle Klick nicht sofort das Menü schließt
        setTimeout(() => document.addEventListener('click', closeMenu), 0);

        document.body.appendChild(menu);
    }

    async function executeProductionChange(mode) {
        console.log(`[LEA Auto Prod Change] Starte Änderung für Modus: ${mode}`);

        // Finde initial alle Linien, um die Anzahl zu wissen
        let settingsBtns = Array.from(document.querySelectorAll('button[data-tutorial-id="factory-line-settings-button"]'));
        const numLines = settingsBtns.length;

        if (numLines === 0) {
            console.warn('[LEA Auto Prod Change] Keine Produktionslinien gefunden.');
            return;
        }

        for (let i = 0; i < numLines; i++) {
            // Nach jedem Durchlauf das DOM neu lesen, da sich Elemente durch Navigation ändern
            settingsBtns = Array.from(document.querySelectorAll('button[data-tutorial-id="factory-line-settings-button"]'));
            if (!settingsBtns[i]) break; // Sicherheitshalber

            console.log(`[LEA Auto Prod Change] Bearbeite Linie ${i + 1}/${numLines}`);
            settingsBtns[i].click();

            // Warte bis das Einstellungsmenü offen ist
            await new Promise(r => setTimeout(r, 600));

            const stopBtn = document.querySelector('[data-tutorial-id="factory-line-configuration-stop-button"]');
            const resBtns = document.querySelectorAll('[data-tutorial-id="factory-line-configuration-resource-button"]');

            if (!stopBtn && resBtns.length === 0) {
                console.warn('[LEA Auto Prod Change] Menü hat keine Produkt-Buttons. Gehe zurück.');
                const backBtn = document.querySelector('.bottom-navigation button[show-divider]');
                if (backBtn) backBtn.click();
                await new Promise(r => setTimeout(r, 500));
                continue;
            }

            let targetBtn = null;
            if (mode === 'stop') targetBtn = stopBtn;
            else if (mode === 'prod1') targetBtn = resBtns[0];
            else if (mode === 'prod2') targetBtn = resBtns[1] || resBtns[0];
            else if (mode === 'prod3') targetBtn = resBtns[2] || resBtns[1] || resBtns[0];
            else if (mode === 'mix') targetBtn = resBtns[i % resBtns.length]; // Z.B. Linie 1->Prod 1, Linie 2->Prod 2, Linie 3->Prod 3

            if (targetBtn) {
                targetBtn.click();

                // Warte kurz, damit der Speichern-Button eventuell aktiviert wird
                await new Promise(r => setTimeout(r, 300));

                const saveBtn = document.querySelector('button[data-tutorial-id="factory-line-save-changes"]');
                if (saveBtn && !saveBtn.disabled) {
                    saveBtn.click();
                    console.log(`[LEA Auto Prod Change] Änderungen gespeichert für Linie ${i + 1}`);

                    // Warte kurz, bis der Bestätigungsdialog auftaucht
                    await new Promise(r => setTimeout(r, 500));

                    const dialog = document.querySelector('.bb-dialog-modal');
                    if (dialog) {
                        const okBtn = Array.from(dialog.querySelectorAll('button')).find(btn => btn.textContent.trim() === 'OK');
                        if (okBtn) {
                            console.log(`[LEA Auto Prod Change] Bestätigungsdialog gefunden, klicke OK.`);
                            okBtn.click();
                            await new Promise(r => setTimeout(r, 500)); // Warte kurz nach dem Klick
                        }
                    }

                    // Prüfe, ob wir noch im Einstellungsmenü sind, und gehe ggf. explizit zurück
                    if (document.querySelector('button[data-tutorial-id="factory-line-save-changes"]')) {
                        const backBtn = document.querySelector('.bottom-navigation button[show-divider]');
                        if (backBtn) backBtn.click();
                    }
                } else {
                    // Wenn nichts geändert wurde (ist schon aktiv), ist Speichern deaktiviert -> einfach Zurück klicken
                    console.log(`[LEA Auto Prod Change] Keine Änderung für Linie ${i + 1} (bereits ausgewählt). Gehe zurück.`);
                    const backBtn = document.querySelector('.bottom-navigation button[show-divider]');
                    if (backBtn) backBtn.click();
                }
            } else {
                const backBtn = document.querySelector('.bottom-navigation button[show-divider]');
                if (backBtn) backBtn.click();
            }

            // Warte bis wir wieder auf der Gebäude-Übersicht sind
            await new Promise(r => setTimeout(r, 700));
        }

        console.log('[LEA Auto Prod Change] Alle Linien abgearbeitet.');
    }

    function init() {
        console.log('[LEA Auto Prod Change] Initialisiert v1.0.0');

        injectProductionChangeButton();

        let isHandlingMutations = false;
        const observer = new MutationObserver(() => {
            if (!isHandlingMutations) {
                isHandlingMutations = true;
                requestAnimationFrame(() => {
                    injectProductionChangeButton();
                    isHandlingMutations = false;
                });
            }
        });

        // Wir überwachen DOM-Änderungen, damit der Button auftaucht, wenn man ein Gebäude öffnet
        observer.observe(document.body, { childList: true, subtree: true });
    }

    if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
