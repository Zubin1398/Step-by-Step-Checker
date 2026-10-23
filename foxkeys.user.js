// ==UserScript==
// @name         Step-by-Step Checker [K]
// @namespace    http://tampermonkey.net/
// @version      2.1
// @description  Пошаговая проверка ников по клику или хоткею
// @author       [K]
// @match        https://foxkeys.io/checker
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const HOTKEY = 'F2';

    const panel = document.createElement('div');
    panel.style.cssText = `
        position: fixed; top: 20px; right: 20px; width: 300px;
        background: #1e1e1e; color: #fff; border: 1px solid #333;
        border-radius: 10px; padding: 15px; z-index: 999999;
        font-family: monospace; font-size: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.5);
        display: flex; flex-direction: column; gap: 10px;
    `;

    panel.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; cursor: move;" id="drag-handle">
            <strong style="color: #4ade80;">[K] Stepper</strong>
            <button id="close-btn" style="background:none; border:none; color:#ef4444; cursor:pointer; font-weight:bold;">X</button>
        </div>
        <textarea id="nick-list" placeholder="Вставьте текст (Ник | Привилегия)..." style="width: 100%; height: 120px; background: #2d2d2d; color: #fff; border: 1px solid #444; border-radius: 5px; padding: 5px; resize: vertical;"></textarea>

        <button id="next-btn" style="background: #3b82f6; color: white; border: none; padding: 10px; border-radius: 5px; cursor: pointer; font-weight: bold; transition: background 0.2s;">Вставить следующий (${HOTKEY})</button>

        <div style="font-size: 11px; color: #888; display: flex; justify-content: space-between;">
            <span>Прогресс: <span id="progress-text" style="color: #4ade80;">0/0</span></span>
            <button id="reset-btn" style="background: none; border: none; color: #fbbf24; cursor: pointer; text-decoration: underline;">Сброс</button>
        </div>
        <div style="font-size: 11px; color: #888;">Текущий: <span id="current-text" style="color: #fff;">-</span></div>
    `;
    document.body.appendChild(panel);

    const dragHandle = document.getElementById('drag-handle');
    let isDragging = false, offsetX, offsetY;
    dragHandle.onmousedown = (e) => {
        isDragging = true;
        offsetX = e.clientX - panel.getBoundingClientRect().left;
        offsetY = e.clientY - panel.getBoundingClientRect().top;
    };
    document.onmousemove = (e) => {
        if (!isDragging) return;
        panel.style.left = (e.clientX - offsetX) + 'px';
        panel.style.top = (e.clientY - offsetY) + 'px';
        panel.style.right = 'auto';
    };
    document.onmouseup = () => isDragging = false;
    document.getElementById('close-btn').onclick = () => panel.remove();

    let nickList = [];
    let currentIndex = 0;

    const progressText = document.getElementById('progress-text');
    const currentText = document.getElementById('current-text');
    const nextBtn = document.getElementById('next-btn');

    function setReactInputValue(input, value) {
        // Нативный сеттер для React
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        nativeInputValueSetter.call(input, value);

        // Принудительный фокус и события
        input.focus();
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.dispatchEvent(new Event('blur', { bubbles: true }));
    }

    function processNextNick() {
        if (nickList.length === 0) {
            const rawText = document.getElementById('nick-list').value;
            nickList = rawText.split('\n')
                .map(line => line.split('|')[0].trim())
                .filter(nick => nick.length > 0);

            if (nickList.length === 0) {
                alert("Список пуст или неверный формат!");
                return;
            }
            currentIndex = 0;
        }

        if (currentIndex >= nickList.length) {
            currentText.textContent = "Список закончен";
            nextBtn.style.background = "#555";
            return;
        }

        const nick = nickList[currentIndex];
        const inputField = document.querySelector('input[placeholder="Введите никнейм игрока…"]');

        // Ищем кнопку по тексту, игнорируя вложенные SVG
        const checkBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Проверить'));

        if (inputField && checkBtn) {
            // 1. СНАЧАЛА ВСТАВЛЯЕМ ТЕКСТ
            setReactInputValue(inputField, nick);
            currentText.textContent = `Вставлен: ${nick}...`;

            // 2. ЖДЕМ 150мс, чтобы React/Vue разблокировал кнопку
            setTimeout(() => {
                // 3. ЖМЕМ
                checkBtn.click();
                currentIndex++;
                progressText.textContent = `${currentIndex}/${nickList.length}`;
                currentText.textContent = `Отправлен: ${nick}`;
                nextBtn.style.background = "#3b82f6";
            }, 150);

        } else {
            currentText.textContent = "Ошибка: Элементы не найдены!";
            nextBtn.style.background = "#ef4444";
        }
    }

    nextBtn.onclick = processNextNick;

    document.getElementById('reset-btn').onclick = () => {
        nickList = [];
        currentIndex = 0;
        progressText.textContent = "0/0";
        currentText.textContent = "-";
        nextBtn.style.background = "#3b82f6";
    };

    document.addEventListener('keydown', (e) => {
        if (e.key === HOTKEY) {
            e.preventDefault();
            processNextNick();
        }
    });

})();
