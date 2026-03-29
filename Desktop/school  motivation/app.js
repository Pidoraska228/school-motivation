document.addEventListener('DOMContentLoaded', () => {
    // Если в URL есть '?', убираем его для чистоты
    if (window.location.search) {
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    let appData = {};
    let currentUser = JSON.parse(localStorage.getItem('currentUser')) || null;

    // --- КОНСТАНТЫ И КЛЮЧИ ХРАНИЛИЩА ---
    const MAX_POINTS = 100;
    
    // Ключи для localStorage, привязанные к пользователю/школе
    const getHWKey = () => currentUser ? `homework_${currentUser.school}` : 'global_homework';
    const getClassKey = () => currentUser ? `classmates_${currentUser.school}` : 'global_classmates';
    const getPointsKey = () => currentUser ? `points_${currentUser.name}_${currentUser.school}` : 'userPoints';

    let dynamicHomework = JSON.parse(localStorage.getItem(getHWKey())) || null;
    let dynamicClassmates = JSON.parse(localStorage.getItem(getClassKey())) || null;
    let currentPoints = parseInt(localStorage.getItem(getPointsKey())) || 0;

    // Отключаем кнопки до загрузки данных
    const addPointsBtn = document.getElementById('add-points-btn');
    if (addPointsBtn) {
        addPointsBtn.disabled = true;
    }

    // --- 1. ЗАГРУЗКА ДАННЫХ ИЗ JSON ---
    // 1. Сначала настраиваем навигацию и форму (чтобы preventDefault работал сразу)
    setupNavigation();
    setupAuth();

    // 2. Загружаем данные из JSON через async/await для лучшей читаемости
    async function loadInitialData() {
        try {
            const response = await fetch('db.json');
            if (!response.ok) throw new Error('Ошибка сети при загрузке данных');
            appData = await response.json();
            
            // Инициализируем задания из JSON, если в localStorage пусто
            if (!dynamicHomework) {
                dynamicHomework = appData.homework || [];
                localStorage.setItem(getHWKey(), JSON.stringify(dynamicHomework));
            }
            
            // Инициализируем список класса из JSON, если в localStorage пусто
            if (!dynamicClassmates) {
                dynamicClassmates = appData.classmates || [];
                localStorage.setItem(getClassKey(), JSON.stringify(dynamicClassmates));
            }

            // Инициализируем баллы только если их еще нет в памяти для этого пользователя
            if (localStorage.getItem(getPointsKey()) === null) {
                currentPoints = appData.student?.points || 0;
                localStorage.setItem(getPointsKey(), currentPoints);
            }
            
            if (currentUser) {
                showDashboard();
            } else {
                showPage('auth');
            }
            
            // Включаем кнопку после успешной загрузки
            if (addPointsBtn) {
                addPointsBtn.disabled = false;
            }
        } catch (err) {
            console.error("Ошибка загрузки данных:", err);
            
            // Показываем уведомление пользователю, если база данных недоступна
            const greeting = document.getElementById('student-greeting');
            if (greeting) greeting.textContent = "Ошибка загрузки данных. Используются локальные настройки.";

            // Если данные не загрузились, инициализируем пустые объекты, чтобы сайт не "падал"
            appData = appData || { student: {}, schedule: [], homework: [], classmates: [], chartData: [] };
            dynamicHomework = dynamicHomework || [];
            dynamicClassmates = dynamicClassmates || [];
            
            if (!currentUser) showPage('auth');
        }
    }

    loadInitialData();

    // Глобальный обработчик закрытия окон по Esc
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('#hw-details, #add-hw-modal').forEach(m => m.style.display = 'none');
        }
    });

    // --- 2. ЛОГИКА АВТОРИЗАЦИИ ---
    function setupAuth() {
        const regForm = document.getElementById('reg-form');
        const regionSelect = document.getElementById('reg-region');
        const schoolSelect = document.getElementById('reg-school');

        if (!regForm) return;

        // Имитация списка школ при выборе региона
        regionSelect.addEventListener('change', () => {
            const schools = {
                "77": ["Гимназия №1505", "Лицей №1533", "Школа №57"],
                "78": ["Лицей №239", "Гимназия №56"],
                "50": ["Школа №1 (Одинцово)", "Лицей №10 (Химки)"]
            };
            const selectedRegion = regionSelect.value;
            const list = schools[selectedRegion] || [];
            
            // Очищаем список школ и добавляем правильный плейсхолдер
            schoolSelect.innerHTML = '';
            const placeholder = document.createElement('option');
            placeholder.value = "";
            placeholder.textContent = selectedRegion ? "Выберите школу" : "Сначала выберите регион";
            placeholder.disabled = true;
            placeholder.selected = true;
            schoolSelect.appendChild(placeholder);

            list.forEach(s => {
                const option = document.createElement('option');
                option.value = s;
                option.textContent = s;
                schoolSelect.appendChild(option);
            });
        });

        regForm.onsubmit = (e) => {
            e.preventDefault();
            const name = document.getElementById('reg-name').value.trim();
            
            if (!name) {
                alert("Пожалуйста, введите ваше имя");
                return;
            }

            currentUser = {
                name: name,
                region: regionSelect.value,
                school: schoolSelect.value,
                role: document.getElementById('reg-role').value
            };
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            location.reload(); // Перезагружаем для правильной инициализации баллов нового юзера
        };

        document.getElementById('logout-btn').onclick = () => {
            localStorage.removeItem('currentUser');
            location.reload();
        };
    }

    function showDashboard() {
        document.getElementById('main-nav').style.display = 'flex';
        
        // Показываем только те кнопки навигации, которые соответствуют роли пользователя
        const navButtons = document.querySelectorAll('.nav-links button[data-page]');
        navButtons.forEach(btn => {
            const page = btn.dataset.page;
            if (page === 'home' || page === currentUser.role) {
                btn.style.display = 'inline-block';
            } else {
                btn.style.display = 'none';
            }
        });

        updateUI();
        showPage(currentUser.role); // Автоматически переходим в нужный кабинет
    }

    function setupNavigation() {
        document.querySelectorAll('.nav-links button[data-page]').forEach(btn => {
            btn.addEventListener('click', () => showPage(btn.dataset.page));
        });
        document.getElementById('logo-home').onclick = () => showPage('home');
        document.getElementById('add-points-btn').onclick = addPoints;

        // Обработка кнопок закрытия модальных окон
        document.getElementById('close-hw-details').onclick = () => {
            document.getElementById('hw-details').style.display = 'none';
        };
        document.getElementById('cancel-hw-btn').onclick = () => {
            document.getElementById('add-hw-modal').style.display = 'none';
        };

        // Делегирование событий для таблицы класса (начисление баллов)
        const classTable = document.getElementById('class-table');
        if (classTable) {
            classTable.addEventListener('click', (e) => {
                if (e.target.classList.contains('reward-btn')) {
                    const index = parseInt(e.target.getAttribute('data-index'));
                    rewardStudent(index);
                }
            });
        }

        // Обработка кнопок учителя
        const addHwBtn = document.getElementById('add-hw-btn');
        if (addHwBtn) {
            addHwBtn.onclick = () => document.getElementById('add-hw-modal').style.display = 'block';
        }

        const sendBonusBtn = document.getElementById('send-bonus-btn');
        if (sendBonusBtn) {
            sendBonusBtn.onclick = () => alert('Бонус отправлен! На телефон ребенка придет уведомление.');
        }

        const saveHwBtn = document.getElementById('save-hw-btn');
        if (saveHwBtn) {
            saveHwBtn.onclick = saveHomework;
        }
    }

    function showPage(pageId) {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

        // Управление активным состоянием кнопок навигации через классы
        document.querySelectorAll('.nav-links button').forEach(btn => {
            btn.classList.toggle('active-nav', btn.dataset.page === pageId);
        });

        const targetPage = document.getElementById(pageId);
        if (targetPage) targetPage.classList.add('active');
        
        window.scrollTo(0, 0); // Прокрутка вверх при смене страницы

        if (pageId === 'parent') initChart();
        if (pageId === 'student' || pageId === 'teacher') updateUI();
    }

    // --- 3. ОБНОВЛЕНИЕ ИНТЕРФЕЙСА ДАННЫМИ ---
    function updateUI() {
        if (!currentUser || Object.keys(appData).length === 0) return;
        
        document.getElementById('student-greeting').textContent = `Привет, ${currentUser.name}! 👋`;
        document.getElementById('points-text').textContent = currentPoints;
        document.getElementById('progress-bar').style.width = Math.min((currentPoints / MAX_POINTS) * 100, 100) + '%';

        // Расписание
        const scheduleTable = document.getElementById('schedule-table');
        if (scheduleTable && appData.schedule) {
            const fragment = document.createDocumentFragment();
            const header = document.createElement('tr');
            header.innerHTML = '<th>Урок</th><th>Время</th>';
            fragment.appendChild(header);

            appData.schedule.forEach(item => {
                const row = document.createElement('tr');
                row.innerHTML = `<td>${item.subject}</td><td>${item.time}</td>`;
                fragment.appendChild(row);
            });
            scheduleTable.replaceChildren(fragment);
        }

        // Домашка
        const hwList = document.getElementById('hw-list');
        if (hwList && dynamicHomework) {
            const fragment = document.createDocumentFragment();
            dynamicHomework.forEach(hw => {
                const div = document.createElement('div');
                div.className = 'hw-item';
                div.textContent = hw.subject;
                div.onclick = () => showHW(hw.subject, hw.description);
                fragment.appendChild(div);
            });
            hwList.replaceChildren(fragment);
        }

        // Оценки
        const gradesList = document.getElementById('grades-list');
        if (gradesList && appData.student?.grades) {
            gradesList.textContent = appData.student.grades.join(', ');
        }

        document.getElementById('teacher-class-name').textContent = `Класс: ${appData.student?.class || '...'} | ${currentUser.school}`;
        document.getElementById('parent-child-name').textContent = `Прогресс: ${currentUser.name}`;
        
        const classTable = document.getElementById('class-table');
        if (classTable && dynamicClassmates) {
            const fragment = document.createDocumentFragment();
            const header = document.createElement('tr');
            header.innerHTML = '<th>Ученик</th><th>Оценка</th><th>Баллы</th><th>Действие</th>';
            fragment.appendChild(header);

            dynamicClassmates.forEach((c, index) => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${c.name}</td>
                    <td>${c.grade}</td>
                    <td>${c.points}</td>
                    <td><button class="btn btn-green reward-btn" data-index="${index}" style="padding: 5px 10px; font-size: 0.8rem;">+10</button></td>`;
                fragment.appendChild(row);
            });
            classTable.replaceChildren(fragment);
        }
    }

    // --- 4.1 ЛОГИКА УЧИТЕЛЯ: НАГРАЖДЕНИЕ ---
    function rewardStudent(index) {
        const student = dynamicClassmates[index];
        student.points += 10;
        localStorage.setItem(getClassKey(), JSON.stringify(dynamicClassmates));

        // Синхронизация: если учитель наградил ТЕКУЩЕГО пользователя
        if (currentUser && student.name === currentUser.name) {
            currentPoints += 10;
            localStorage.setItem(getPointsKey(), currentPoints);
        }

        updateUI();
        
        // Если мы на странице родителя или учителя, обновляем график
        if (document.getElementById('parent').classList.contains('active')) {
            initChart();
        }
    }

    // --- 4. ЛОГИКА БАЛЛОВ ---
    function addPoints() {
        if (currentPoints < MAX_POINTS) {
            currentPoints += 10;
            localStorage.setItem(getPointsKey(), currentPoints);
            updateUI();
            if (currentPoints >= MAX_POINTS) alert("Ура! Ты настоящий отличник! 🏆");
        }
    }

    // --- 5. СОХРАНЕНИЕ ДОМАШКИ (для учителя) ---
    function saveHomework() {
        const subjectInput = document.getElementById('new-hw-subject');
        const textInput = document.getElementById('new-hw-text');
        const subject = subjectInput.value.trim();
        const text = textInput.value.trim();

        if (!subject || !text) {
            alert("Заполните все поля задания!");
            return;
        }

        dynamicHomework.unshift({ subject, description: text });
        localStorage.setItem(getHWKey(), JSON.stringify(dynamicHomework));
        
        document.getElementById('add-hw-modal').style.display = 'none';
        subjectInput.value = '';
        textInput.value = '';
        updateUI();
    }

    // --- 5. ДЕТАЛИ ДОМАШКИ ---
    function showHW(title, text) {
        const modal = document.getElementById('hw-details');
        if (modal) {
            document.getElementById('hw-title').textContent = title;
            document.getElementById('hw-text').textContent = text;
            modal.style.display = 'block';
        }
    }

    // --- 6. ГРАФИК ---
    let chartInstance = null;
    function initChart() {
        const ctx = document.getElementById('progressChart').getContext('2d');
        if (chartInstance) chartInstance.destroy();
        
        chartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт'],
                datasets: [{
                    label: 'Средний балл ребенка',
                    data: appData.chartData,
                    borderColor: '#3a86ff',
                    backgroundColor: 'rgba(58, 134, 255, 0.1)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                scales: { y: { min: 2, max: 5 } }
            }
        });
    }
});