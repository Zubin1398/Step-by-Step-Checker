// ==UserScript==
// @name         Step-by-Step Checker [K]
// @namespace    http://tampermonkey.net/
// @version      3.2
// @description  Пошаговая проверка с надежным ожиданием результатов
// @author       [K]
// @match        https://foxkeys.io/checker
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    if (window.top !== window.self) return;
    if (document.getElementById('k-stepper-panel')) return;

    const HOTKEY = 'F2';

    // --- СОЗДАНИЕ GUI ---
    const panel = document.createElement('div');
    panel.id = 'k-stepper-panel';
    panel.style.cssText = `
        position: fixed; top: 20px; right: 20px; width: 350px;
        background: #1e1e1e; color: #fff; border: 1px solid #333;
        border-radius: 10px; padding: 15px; z-index: 2147483647;
        font-family: monospace; font-size: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.5);
        display: flex; flex-direction: column; gap: 10px;
    `;

    panel.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; cursor: grab;" id="drag-handle">
            <strong style="color: #4ade80;">[K] Stepper v3.2</strong>
            <button id="close-btn" style="background:none; border:none; color:#ef4444; cursor:pointer; font-weight:bold;">X</button>
        </div>

        <div style="font-size: 10px; color: #888;">Входные данные:</div>
        <textarea id="nick-list" placeholder="Вставьте текст (Ник | Привилегия)..." style="width: 100%; height: 80px; background: #2d2d2d; color: #fff; border: 1px solid #444; border-radius: 5px; padding: 5px; resize: vertical;"></textarea>

        <button id="next-btn" style="background: #3b82f6; color: white; border: none; padding: 10px; border-radius: 5px; cursor: pointer; font-weight: bold; transition: background 0.2s;">Вставить следующий (${HOTKEY})</button>

        <div style="font-size: 10px; color: #888; display: flex; justify-content: space-between; align-items: center;">
            <span>Успешные (редактируемо):</span>
            <button id="clear-out-btn" style="background: none; border: none; color: #ef4444; cursor: pointer; font-size: 10px;">Очистить</button>
        </div>
        <textarea id="output-list" placeholder="Здесь будут успешные строки..." style="width: 100%; height: 180px; background: #1a1a1a; color: #4ade80; border: 1px solid #444; border-radius: 5px; padding: 5px; resize: vertical; white-space: pre;"></textarea>

        <div style="font-size: 11px; color: #888; display: flex; justify-content: space-between;">
            <span>Прогресс: <span id="progress-text" style="color: #4ade80;">0/0</span></span>
            <button id="reset-btn" style="background: none; border: none; color: #fbbf24; cursor: pointer; text-decoration: underline;">Сброс</button>
        </div>
        <div style="font-size: 11px; color: #888;">Статус: <span id="current-text" style="color: #fff;">-</span></div>
    `;
    document.body.appendChild(panel);

    // --- ПЕРЕТАСКИВАНИЕ ---
    const dragHandle = document.getElementById('drag-handle');
    let isDragging = false;
    let startX, startY, initialLeft, initialTop;

    dragHandle.addEventListener('mousedown', (e) => {
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        const rect = panel.getBoundingClientRect();
        initialLeft = rect.left;
        initialTop = rect.top;
        panel.style.right = 'auto';
        panel.style.bottom = 'auto';
        dragHandle.style.cursor = 'grabbing';
        e.preventDefault();
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        panel.style.left = `${initialLeft + dx}px`;
        panel.style.top = `${initialTop + dy}px`;
    });

    window.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            dragHandle.style.cursor = 'grab';
        }
    });

    document.getElementById('close-btn').onclick = () => panel.remove();

    // --- ЛОГИКА ---
    let nickList = [];
    let currentIndex = 0;
    let isWaiting = false;

    const progressText = document.getElementById('progress-text');
    const currentText = document.getElementById('current-text');
    const nextBtn = document.getElementById('next-btn');
    const outputArea = document.getElementById('output-list');

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function setReactInputValue(input, value) {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        nativeInputValueSetter.call(input, value);
        input.focus();
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.dispatchEvent(new Event('blur', { bubbles: true }));
    }

    async function processResult(targetObj) {
        // 1. Ждем, пока кнопка "Проверить" снова станет активной
        let checkBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Проверить'));
        let checks = 0;
        while (checkBtn && checkBtn.disabled && checks < 100) {
            await sleep(100);
            checks++;
            checkBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Проверить'));
        }

        // 2. Умное ожидание результатов
        let successRows = [];
        let isNoMatch = false;
        let maxWait = 60; // 60 * 300ms = 18 секунд максимум
        let waited = 0;

        while (waited < maxWait) {
            await sleep(300);
            waited++;

            // Ищем все строки результатов, кроме BCRYPT
            successRows = Array.from(document.querySelectorAll('tr[style*="fkRow"]'))
                .filter(row => !row.innerText.includes('BCRYPT'));

            // Ищем блок "Совпадений не найдено"
            const noMatchEl = Array.from(document.querySelectorAll('div')).find(el => el.textContent.includes('Совпадений не найдено'));

            if (successRows.length > 0) {
                break; // Нашли результаты, выходим из цикла
            }

            if (noMatchEl) {
                // Если видим "не найдено", подождем еще полсекунды (вдруг строки рендерятся)
                await sleep(500);
                successRows = Array.from(document.querySelectorAll('tr[style*="fkRow"]'))
                    .filter(row => !row.innerText.includes('BCRYPT'));

                if (successRows.length === 0) {
                    isNoMatch = true;
                }
                break; // Выходим из цикла в любом случае
            }
        }

        // 3. Обработка того, что нашли
        if (isNoMatch || successRows.length === 0) {
            currentText.textContent = `Не найден/Игнор: ${targetObj.nick}`;
            finishStep();
            return;
        }

        let finalOutput = targetObj.original + '\n';
        let clickedCount = 0;

        for (const row of successRows) {
            const greenCode = row.querySelector('code.text-up');
            if (greenCode) {
                finalOutput += `${greenCode.innerText.trim()}\n`;
            }

            const decryptBtn = Array.from(row.querySelectorAll('button')).find(b => b.textContent.includes('расшифровать'));

            if (decryptBtn && clickedCount < 3) {
                currentText.textContent = `Расшифровка (${clickedCount + 1}/3)...`;
                decryptBtn.click();
                clickedCount++;
                await sleep(5000);
            }
        }

        if (clickedCount > 0) {
            currentText.textContent = `Ожидание паролей...`;
            await sleep(3000);

            const dock = document.getElementById('fk-jobs-dock');
            if (dock) {
                const foundPassBlocks = dock.querySelectorAll('.text-up');
                foundPassBlocks.forEach(block => {
                    const passInput = block.querySelector('input');
                    if (passInput && passInput.value) {
                        finalOutput += `  └─ ПАРОЛЬ: ${passInput.value}\n`;
                    }
                });

                const clearJobsBtn = Array.from(dock.querySelectorAll('button')).find(b => b.textContent.includes('Очистить завершённые'));
                if (clearJobsBtn) clearJobsBtn.click();
            }
        }

        outputArea.value += finalOutput + '\n';
        outputArea.scrollTop = outputArea.scrollHeight;
        currentText.textContent = `Успешно: ${targetObj.nick}`;
        finishStep();
    }

    function finishStep() {
        isWaiting = false;
        currentIndex++;
        progressText.textContent = `${currentIndex}/${nickList.length}`;
        nextBtn.style.background = "#3b82f6";
    }

    async function processNextNick() {
        if (isWaiting) return;

        if (nickList.length === 0) {
            const rawText = document.getElementById('nick-list').value;
            nickList = rawText.split('\n')
                .filter(line => line.trim().length > 0)
                .map(line => ({
                    original: line.trim(),
                    nick: line.split('|')[0].trim()
                }));

            if (nickList.length === 0) {
                alert("Список пуст или неверный формат!");
                return;
            }
            currentIndex = 0;
            progressText.textContent = `0/${nickList.length}`;
        }

        if (currentIndex >= nickList.length) {
            currentText.textContent = "Список закончен";
            nextBtn.style.background = "#555";
            return;
        }

        const targetObj = nickList[currentIndex];
        const inputField = document.querySelector('input[placeholder="Введите никнейм игрока…"]');
        const checkBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Проверить'));

        if (inputField && checkBtn) {
            isWaiting = true;
            currentText.textContent = `Отправка: ${targetObj.nick}...`;
            nextBtn.style.background = "#fbbf24";

            setReactInputValue(inputField, targetObj.nick);

            setTimeout(async () => {
                checkBtn.click();
                await processResult(targetObj);
            }, 100);
        } else {
            currentText.textContent = "Ошибка: Элементы не найдены!";
            nextBtn.style.background = "#ef4444";
        }
    }

    nextBtn.onclick = processNextNick;

    document.getElementById('reset-btn').onclick = () => {
        nickList = [];
        currentIndex = 0;
        isWaiting = false;
        progressText.textContent = "0/0";
        currentText.textContent = "-";
        nextBtn.style.background = "#3b82f6";
    };

    document.getElementById('clear-out-btn').onclick = () => {
        outputArea.value = "";
    };

    document.addEventListener('keydown', (e) => {
        if (e.key === HOTKEY) {
            e.preventDefault();
            processNextNick();
        }
    });

})();
