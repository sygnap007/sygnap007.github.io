// ============================================
// history.js - 운동 기록 조회 & 시각화 모듈
// ============================================
// 날짜별 운동 기록을 조회하고, Chart.js를 사용하여
// 운동별 진행 추이를 차트로 시각화합니다.
// ============================================

const History = (() => {
    // ---------- 상태 변수 ----------
    let currentDate = new Date().toISOString().split('T')[0]; // 현재 선택된 날짜
    let chart = null;  // Chart.js 인스턴스

    // ---- 날짜별 기록 렌더링 ----
    async function renderRecords(date) {
        currentDate = date || currentDate;

        // 날짜 입력 필드 업데이트
        document.getElementById('history-date').value = currentDate;

        // 해당 날짜의 기록 가져오기
        const records = await DB.getRecordsByDate(currentDate);
        const listEl = document.getElementById('history-list');

        // 기록이 없으면 빈 메시지 표시
        if (records.length === 0) {
            listEl.innerHTML = '<p class="empty-message">해당 날짜의 기록이 없습니다.</p>';
            document.getElementById('chart-container').style.display = 'none';
            return;
        }

        // 기록 카드 렌더링
        listEl.innerHTML = records.map((record) => {
            // 세트별 뱃지 생성
            const setBadges = record.sets.map((set, i) => `
                <span class="history-set-badge">
                    <strong>${i + 1}</strong> ${set.weight}kg × ${set.reps}회
                    ${set.completed ? '✓' : ''}
                </span>
            `).join('');

            return `
                <div class="history-card" data-id="${record.id}" data-exercise="${record.exerciseName}">
                    <div class="history-card-header">
                        <div class="history-exercise-info">
                            <span class="history-exercise-program" style="display:block; font-size:var(--font-size-xs); color:var(--accent-light); margin-bottom:2px;">
                                ${record.week || ''} ${record.day || ''}
                            </span>
                            <span class="history-exercise-name">${record.exerciseName}</span>
                        </div>
                        <div class="history-card-actions">
                            <span class="history-exercise-part">${record.bodyPart}</span>
                            <button class="btn-delete-record" title="기록 삭제" data-id="${record.id}">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                    <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z" />
                                    <path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z" />
                                </svg>
                            </button>
                        </div>
                    </div>
                    <div class="history-sets">${setBadges}</div>
                    ${record.memo ? `<div class="history-memo" style="margin-top:8px; font-size:var(--font-size-xs); color:var(--text-muted); padding:8px; background:rgba(255,255,255,0.03); border-radius:4px;">📝 ${record.memo}</div>` : ''}
                </div>
            `;
        }).join('');

        // 기록 카드 클릭 시 해당 운동의 추이 차트 표시 (삭제 버튼 제외)
        listEl.querySelectorAll('.history-card').forEach((card) => {
            card.addEventListener('click', (e) => {
                if (e.target.closest('.btn-delete-record')) return;
                renderChart(card.dataset.exercise);
            });
        });

        // 삭제 버튼 이벤트 바인딩
        listEl.querySelectorAll('.btn-delete-record').forEach((btn) => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                if (confirm('해당 운동 기록을 삭제하시겠습니까?')) {
                    await DB.deleteRecord(id);
                    if (window.App && App.showToast) App.showToast('기록이 삭제되었습니다.', 'success');
                    renderRecords(currentDate);
                    if (window.App && App.updateDashboard) App.updateDashboard();
                }
            });
        });
    }

    // ---- 운동별 추이 차트 렌더링 ----
    async function renderChart(exerciseName) {
        const records = await DB.getRecordsByExercise(exerciseName);

        if (records.length < 1) return;

        // 날짜순 정렬
        records.sort((a, b) => a.date.localeCompare(b.date));

        // 최근 20개 기록만 표시
        const recentRecords = records.slice(-20);

        // 각 기록에서 최대 중량 추출 (진행 추이 시각화)
        const labels = recentRecords.map((r) => {
            const d = new Date(r.date);
            return `${d.getMonth() + 1}/${d.getDate()}`;
        });

        const maxWeights = recentRecords.map((r) => {
            return Math.max(...r.sets.map((s) => s.weight));
        });

        const totalVolumes = recentRecords.map((r) => {
            return r.sets
                .filter(s => s.completed) // 완료된 세트만 볼륨에 포함
                .reduce((sum, s) => sum + (s.weight * s.reps), 0);
        });

        // 차트 컨테이너 표시
        const chartContainer = document.getElementById('chart-container');
        chartContainer.style.display = 'block';
        chartContainer.querySelector('.card-title').textContent = `📊 ${exerciseName} 추이`;

        // 이전 차트가 있으면 삭제
        if (chart) chart.destroy();

        // Chart.js로 차트 생성
        const ctx = document.getElementById('progress-chart').getContext('2d');
        chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: '최대 중량 (kg)',
                        data: maxWeights,
                        borderColor: '#6c63ff',
                        backgroundColor: 'rgba(108, 99, 255, 0.1)',
                        borderWidth: 2,
                        tension: 0.3,
                        fill: true,
                        pointBackgroundColor: '#6c63ff',
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2,
                        pointRadius: 4
                    },
                    {
                        label: '총 볼륨',
                        data: totalVolumes,
                        borderColor: '#00c853',
                        backgroundColor: 'rgba(0, 200, 83, 0.1)',
                        borderWidth: 2,
                        tension: 0.3,
                        fill: true,
                        pointBackgroundColor: '#00c853',
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2,
                        pointRadius: 4,
                        yAxisID: 'y1'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    legend: {
                        labels: { color: '#9e9eb8', font: { size: 11 } }
                    }
                },
                scales: {
                    x: {
                        ticks: { color: '#5a5a7a', font: { size: 10 } },
                        grid: { color: 'rgba(255,255,255,0.03)' }
                    },
                    y: {
                        position: 'left',
                        ticks: { color: '#6c63ff', font: { size: 10 } },
                        grid: { color: 'rgba(255,255,255,0.03)' },
                        title: { display: true, text: 'kg', color: '#6c63ff' }
                    },
                    y1: {
                        position: 'right',
                        ticks: { color: '#00c853', font: { size: 10 } },
                        grid: { drawOnChartArea: false },
                        title: { display: true, text: '볼륨', color: '#00c853' }
                    }
                }
            }
        });

        // 차트 위치로 스크롤
        chartContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // ---- 날짜 이동 (이전/다음) ----
    function changeDate(days) {
        const date = new Date(currentDate);
        date.setDate(date.getDate() + days);
        currentDate = date.toISOString().split('T')[0];
        renderRecords(currentDate);
    }

    // ---- 이벤트 바인딩 초기화 ----
    function init() {
        // 날짜 변경 이벤트
        document.getElementById('history-date').addEventListener('change', (e) => {
            renderRecords(e.target.value);
        });

        // 날짜별 전체 삭제 버튼
        document.getElementById('btn-delete-date').addEventListener('click', async () => {
            if (confirm(`[${currentDate}] 날짜의 모든 운동 기록을 삭제하시겠습니까?`)) {
                await DB.deleteRecordsByDate(currentDate);
                if (window.App && App.showToast) App.showToast(`${currentDate} 기록이 모두 삭제되었습니다.`, 'success');
                renderRecords(currentDate);
                if (window.App && App.updateDashboard) App.updateDashboard();
            }
        });

        // 이전/다음 날짜 버튼
        document.getElementById('btn-prev-date').addEventListener('click', () => changeDate(-1));
        document.getElementById('btn-next-date').addEventListener('click', () => changeDate(1));
    }

    // ---- 공개 API ----
    return {
        init,
        renderRecords
    };
})();
