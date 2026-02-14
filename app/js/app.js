// ============================================
// app.js - 앱 메인 진입점 & 전체 관리
// ============================================
// 앱 초기화, 탭 네비게이션, 대시보드 통계,
// 엑셀 업로드, 데이터 관리 등 전체 흐름을 관리합니다.
// ============================================

const App = (() => {

    // ---- 앱 초기화 (페이지 로드 시 실행) ----
    async function init() {
        try {
            // 1. IndexedDB 초기화
            await DB.init();
            console.log('[App] DB 초기화 완료');

            // 2. 각 모듈 이벤트 바인딩
            Workout.init();
            History.init();

            // 3. 탭 네비게이션 설정
            setupTabNavigation();

            // 4. 설정 페이지 이벤트 바인딩
            setupSettings();

            // 5. 대시보드 업데이트
            await updateDashboard();

            // 6. Service Worker 등록 (PWA)
            registerServiceWorker();

            // 7. 홈 화면에서 "운동 시작" 버튼
            document.getElementById('btn-start-workout').addEventListener('click', () => {
                switchPage('workout');
            });

            console.log('[App] 초기화 완료 ✓');
        } catch (error) {
            console.error('[App] 초기화 실패:', error);
            showToast('앱 초기화에 실패했습니다: ' + error.message, 'error');
        }
    }

    // ---- 탭 네비게이션 설정 ----
    function setupTabNavigation() {
        document.querySelectorAll('.tab-item').forEach((tab) => {
            tab.addEventListener('click', () => {
                const page = tab.dataset.page;
                switchPage(page);
            });
        });
    }

    // ---- 페이지(탭) 전환 ----
    function switchPage(pageName) {
        // 모든 페이지 숨기기
        document.querySelectorAll('.page').forEach((p) => p.classList.remove('active'));

        // 선택된 페이지 표시
        const targetPage = document.getElementById(`page-${pageName}`);
        if (targetPage) targetPage.classList.add('active');

        // 탭 바 활성 상태 변경
        document.querySelectorAll('.tab-item').forEach((t) => t.classList.remove('active'));
        const activeTab = document.querySelector(`.tab-item[data-page="${pageName}"]`);
        if (activeTab) activeTab.classList.add('active');

        // 페이지별 데이터 로드
        switch (pageName) {
            case 'home':
                updateDashboard();
                break;
            case 'workout':
                Workout.renderExerciseList();
                break;
            case 'history':
                History.renderRecords();
                break;
            case 'settings':
                renderExerciseManageList();
                break;
        }
    }

    // ---- 대시보드(홈) 업데이트 ----
    async function updateDashboard() {
        // 오늘 날짜 표시
        const today = new Date();
        const dateStr = today.toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            weekday: 'long'
        });
        document.getElementById('today-date').textContent = dateStr;

        // 통계 계산
        const allRecords = await DB.getAllRecords();
        const exercises = await DB.getAllExercises();

        // 총 운동 일수 (고유 날짜 수)
        const uniqueDates = new Set(allRecords.map((r) => r.date));
        document.getElementById('stat-total').innerHTML = `${uniqueDates.size}<span class="unit">일</span>`;

        // 이번 주 운동 횟수
        const weekStart = getWeekStart(today);
        const weekRecords = allRecords.filter((r) => r.date >= weekStart);
        const weekDates = new Set(weekRecords.map((r) => r.date));
        document.getElementById('stat-weekly').innerHTML = `${weekDates.size}<span class="unit">일</span>`;

        // 등록된 운동 수
        document.getElementById('stat-exercises').innerHTML = `${exercises.length}<span class="unit">개</span>`;

        // 최근 기록 표시
        renderRecentRecords(allRecords);
    }

    // ---- 이번 주의 시작일 (월요일) 계산 ----
    function getWeekStart(date) {
        const d = new Date(date);
        const day = d.getDay();
        // 일요일(0)이면 6일 전, 그 외에는 (day-1)일 전이 월요일
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        d.setDate(diff);
        return d.toISOString().split('T')[0];
    }

    // ---- 최근 기록 미리보기 렌더링 ----
    function renderRecentRecords(allRecords) {
        const recentEl = document.getElementById('recent-records');

        if (allRecords.length === 0) {
            recentEl.innerHTML = '<p class="empty-message">아직 운동 기록이 없습니다.<br>운동을 시작해보세요!</p>';
            return;
        }

        // 날짜별로 그룹핑
        const dateGroups = {};
        allRecords.forEach((r) => {
            if (!dateGroups[r.date]) dateGroups[r.date] = [];
            dateGroups[r.date].push(r);
        });

        // 최근 5일만 표시
        const recentDates = Object.keys(dateGroups).sort().reverse().slice(0, 5);

        recentEl.innerHTML = recentDates.map((date) => {
            const records = dateGroups[date];
            const exerciseNames = records.map((r) => r.exerciseName).join(', ');
            const d = new Date(date);
            const dateLabel = d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', weekday: 'short' });

            return `
        <div class="recent-item">
          <span class="recent-date">${dateLabel}</span>
          <span class="recent-exercises">${exerciseNames}</span>
          <span class="recent-count">${records.length}종목</span>
        </div>
      `;
        }).join('');
    }

    // ---- 설정 페이지 이벤트 바인딩 ----
    function setupSettings() {
        // 엑셀 파일 업로드
        document.getElementById('excel-upload').addEventListener('change', handleExcelUpload);

        // 데이터 내보내기
        document.getElementById('btn-export-data').addEventListener('click', handleExportData);

        // 모든 데이터 삭제
        document.getElementById('btn-clear-data').addEventListener('click', handleClearData);
    }

    // ---- 엑셀 파일 업로드 처리 ----
    async function handleExcelUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        const statusEl = document.getElementById('upload-status');
        statusEl.textContent = '파일 처리 중...';
        statusEl.style.color = 'var(--warning)';

        try {
            // 엑셀 파싱
            const exercises = await Excel.parseFile(file);

            // IndexedDB에 저장
            await DB.saveExercises(exercises);

            statusEl.textContent = `✓ ${exercises.length}개 운동이 등록되었습니다!`;
            statusEl.style.color = 'var(--success)';

            showToast(`${exercises.length}개 운동이 등록되었습니다!`, 'success');

            // 관리 리스트 갱신
            renderExerciseManageList();
            updateDashboard();
        } catch (error) {
            statusEl.textContent = `✗ 오류: ${error.message}`;
            statusEl.style.color = 'var(--danger)';
            showToast(error.message, 'error');
        }

        // 같은 파일을 다시 선택할 수 있도록 초기화
        e.target.value = '';
    }

    // ---- 데이터 내보내기 (JSON 다운로드) ----
    async function handleExportData() {
        try {
            const data = await DB.exportData();
            const json = JSON.stringify(data, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);

            // 다운로드 링크 생성
            const a = document.createElement('a');
            a.href = url;
            a.download = `workout-data-${new Date().toISOString().split('T')[0]}.json`;
            a.click();

            URL.revokeObjectURL(url);
            showToast('데이터가 내보내기되었습니다!', 'success');
        } catch (error) {
            showToast('데이터 내보내기 실패: ' + error.message, 'error');
        }
    }

    // ---- 모든 데이터 삭제 ----
    async function handleClearData() {
        // 확인 대화상자 (실수 방지)
        const confirmed = confirm('정말로 모든 데이터를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.');
        if (!confirmed) return;

        try {
            await DB.clearAll();
            showToast('모든 데이터가 삭제되었습니다.', 'success');
            renderExerciseManageList();
            updateDashboard();
        } catch (error) {
            showToast('데이터 삭제 실패: ' + error.message, 'error');
        }
    }

    // ---- 설정 페이지: 등록된 운동 목록 렌더링 (시트/주차별 그룹핑) ----
    async function renderExerciseManageList() {
        const exercises = await DB.getAllExercises();
        const listEl = document.getElementById('exercise-manage-list');

        if (exercises.length === 0) {
            listEl.innerHTML = '<p class="empty-message">등록된 엑셀 리스트가 없습니다.<br>파일을 업로드해주세요.</p>';
            return;
        }

        // 시트(주차)별로 그룹핑
        const groups = {};
        exercises.forEach((ex) => {
            const week = ex.week || '기본';
            if (!groups[week]) groups[week] = [];
            groups[week].push(ex);
        });

        // 주차 순서(1주차, 2주차...)대로 정렬하여 렌더링
        let html = '<h3 class="section-title" style="margin-top:20px; font-size:var(--font-size-md);">📋 등록된 엑셀 리스트</h3>';

        Object.keys(groups).sort().forEach((week) => {
            html += `
                <div class="manage-group">
                    <div class="manage-group-title">${week}</div>
                    <div class="manage-group-content">
            `;

            groups[week].forEach((ex) => {
                const totalReps = ex.setSpecs.map(s => s.reps).join('/');
                html += `
                    <div class="exercise-manage-item">
                        <div class="manage-item-main">
                            <span class="manage-item-day">[${ex.day}]</span>
                            <span class="manage-item-name">${ex.name}</span>
                        </div>
                        <span class="manage-item-info">
                            ${ex.defaultSets}세트 / 목표: ${totalReps}회 / RPE: ${(ex.setSpecs && ex.setSpecs.length > 0) ? (ex.setSpecs[0].rpe || '-') : '-'}
                        </span>
                    </div>
                `;
            });

            html += `
                    </div>
                </div>
            `;
        });

        listEl.innerHTML = html;
    }

    // ---- 토스트 알림 표시 ----
    function showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        container.appendChild(toast);

        // 3초 후 자동 제거
        setTimeout(() => {
            toast.remove();
        }, 3000);
    }

    // ---- Service Worker 등록 (PWA) ----
    function registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js')
                .then((reg) => {
                    console.log('[App] Service Worker 등록 성공:', reg.scope);
                })
                .catch((err) => {
                    console.log('[App] Service Worker 등록 실패:', err);
                });
        }
    }

    // ---- 공개 API ----
    return {
        init,
        showToast,
        updateDashboard,
        switchPage
    };
})();

// ---- 앱 시작 ----
// DOM 로드 완료 후 앱을 초기화합니다.
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
