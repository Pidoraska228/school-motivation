document.addEventListener('DOMContentLoaded', () => {
    // Если в URL есть '?', убираем его для чистоты
    if (window.location.search) {
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    let appData = {};
    let currentUser = JSON.parse(localStorage.getItem('currentUser')) || null;

    // Функция для получения ключа баллов конкретного пользователя
    const getPointsKey = () => currentUser ? `points_${currentUser.name}_${currentUser.school}` : 'userPoints';
    
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
            if (!currentUser) showPage('auth');
        }
    }

    loadInitialData();

    // --- 2. ЛОГИКА АВТОРИЗАЦИИ ---
    function setupAuth() {
        const regForm = document.getElementById('reg-form');
        const regionSelect = document.getElementById('reg-region');
        const schoolSelect = document.getElementById('reg-school');

        if (!regForm) return;

        // Имитация списка школ при выборе региона
        regionSelect.onchange = (e) => {
            const schools = {
                "77": ["Гимназия №1505", "Лицей №1533", "Школа №57"],
                "78": ["Лицей №239", "Гимназия №56"],
                "50": ["Школа №1 (Одинцово)", "Лицей №10 (Химки)"]
            };
            const list = schools[e.target.value] || [];
            schoolSelect.innerHTML = '<option value="">Выберите школу</option>';
            list.forEach(s => {
                const option = document.createElement('option');
                option.value = s;
                option.textContent = s;
                schoolSelect.appendChild(option);
            });
        };

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
    }

    function showPage(pageId) {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        const targetPage = document.getElementById(pageId);
        if (targetPage) targetPage.classList.add('active');
        
        if (pageId === 'parent') initChart();
        if (pageId === 'student' || pageId === 'teacher') updateUI();
    }

    // --- 3. ОБНОВЛЕНИЕ ИНТЕРФЕЙСА ДАННЫМИ ---
    function updateUI() {
        if (!currentUser || Object.keys(appData).length === 0) return;
        
        document.getElementById('student-greeting').textContent = `Привет, ${currentUser.name}! 👋`;
        document.getElementById('points-text').textContent = currentPoints;
        document.getElementById('progress-bar').style.width = Math.min(currentPoints, 100) + '%';

        // Расписание
        const scheduleTable = document.getElementById('schedule-table');
        if (scheduleTable && appData.schedule) {
            let tableHTML = '<tr><th>Урок</th><th>Время</th></tr>';
            appData.schedule.forEach(item => {
                tableHTML += `<tr><td>${item.subject}</td><td>${item.time}</td></tr>`;
            });
            scheduleTable.innerHTML = tableHTML;
        }

        // Домашка
        const hwList = document.getElementById('hw-list');
        if (hwList && appData.homework) {
            const fragment = document.createDocumentFragment();
            appData.homework.forEach(hw => {
                const div = document.createElement('div');
                div.className = 'hw-item';
                div.textContent = hw.subject;
                div.onclick = () => showHW(hw.subject, hw.description);
                fragment.appendChild(div);
            });
            hwList.innerHTML = '';
            hwList.appendChild(fragment);
        }

        document.getElementById('teacher-class-name').textContent = `Класс: ${appData.student?.class || '...'} | ${currentUser.school}`;
        document.getElementById('parent-child-name').textContent = `Прогресс: ${currentUser.name}`;
        
        const classTable = document.getElementById('class-table');
        if (classTable && appData.classmates) {
            let classHTML = '<tr><th>Ученик</th><th>Оценка</th><th>Баллы</th></tr>';
            appData.classmates.forEach(c => {
                classHTML += `<tr><td>${c.name}</td><td>${c.grade}</td><td>${c.points}</td></tr>`;
            });
            classTable.innerHTML = classHTML;
        }
    }

    // --- 4. ЛОГИКА БАЛЛОВ ---
    function addPoints() {
        if (currentPoints < 100) {
            currentPoints += 10;
            localStorage.setItem(getPointsKey(), currentPoints);
            updateUI();
            if (currentPoints >= 100) alert("Ура! Новый уровень достигнут!");
        }
    }

    // --- 5. ДЕТАЛИ ДОМАШКИ ---
    function showHW(title, text) {
        document.getElementById('hw-title').textContent = title;
        document.getElementById('hw-text').textContent = text;
        document.getElementById('hw-details').style.display = 'block';
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

function closeHW() {
    document.getElementById('hw-details').style.display = 'none';
}