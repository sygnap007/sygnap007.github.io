// ============================================
// workout.js - 운동 기록 입력 모듈
// ============================================
// 운동 선택, 세트별 회수/중량 입력, 기록 저장 기능을 관리합니다.
// ============================================

const Workout = (() => {
    // ---------- 상태 변수 ----------
    let currentExercise = null;  // 현재 선택된 운동 정보 (기존)
    let currentProgram = [];     // 현재 선택된 일자의 전체 운동 목록
    let currentWeek = '';
    let currentDay = '';
    let timerInterval = null; // 타이머 인터벌 변수

    // ---- 운동 리스트 렌더링 (주차/일자 기반) ----
    async function renderExerciseList() {
        const exercises = await DB.getAllExercises();
        const listEl = document.getElementById('exercise-list');
        const filterEl = document.getElementById('body-part-filters');

        if (exercises.length === 0) {
            filterEl.innerHTML = '';
            listEl.innerHTML = '<p class="empty-message">등록된 운동이 없습니다.<br>설정 탭에서 엑셀 파일을 업로드해주세요.</p>';
            return;
        }

        // 주차 및 일자 추출
        const weeks = [...new Set(exercises.map(e => e.week))];

        // 초기 선택 설정
        if (!currentWeek) currentWeek = weeks[0];

        const days = [...new Set(exercises.filter(e => e.week === currentWeek).map(e => e.day))];
        if (!currentDay) currentDay = days[0];

        // 필터 영역에 주차 및 일자 선택기 생성
        filterEl.innerHTML = `
      <div class="program-selectors">
        <select id="select-week" class="program-select">
          ${weeks.map(w => `<option value="${w}" ${w === currentWeek ? 'selected' : ''}>${w}</option>`).join('')}
        </select>
        <select id="select-day" class="program-select">
          ${days.map(d => `<option value="${d}" ${d === currentDay ? 'selected' : ''}>${d}</option>`).join('')}
        </select>
      </div>
    `;

        // 이벤트 바인딩
        document.getElementById('select-week').addEventListener('change', (e) => {
            currentWeek = e.target.value;
            currentDay = ''; // 주차가 바뀌면 첫 번째 날로 초기화
            renderExerciseList();
        });

        document.getElementById('select-day').addEventListener('change', (e) => {
            currentDay = e.target.value;
            renderExerciseList();
        });

        // 해당 주차/일자의 운동 필터링
        const filtered = exercises.filter(e => e.week === currentWeek && e.day === currentDay)
            .sort((a, b) => a.order - b.order);

        listEl.innerHTML = filtered.map((exercise) => `
      <div class="exercise-item" data-id="${exercise.id}">
        <div class="exercise-info">
          <div class="exercise-name">${exercise.name}</div>
          <div class="exercise-part">${exercise.bodyPart}</div>
          <div class="exercise-defaults">${exercise.defaultSets}세트 × ${exercise.defaultReps}회 × ${exercise.defaultWeight}kg</div>
        </div>
        <span class="exercise-arrow">›</span>
      </div>
    `).join('');

        // 클릭 이벤트
        listEl.querySelectorAll('.exercise-item').forEach((item) => {
            item.addEventListener('click', () => {
                const ex = exercises.find(e => e.id == item.dataset.id);
                selectExercise(ex);
            });
        });
    }

    // ---- 운동 선택 → 세트 입력 화면으로 전환 ----
    function selectExercise(exercise, pushHistory = true) {
        currentExercise = exercise;

        // 운동 정보 표시
        document.getElementById('current-exercise-name').textContent = currentExercise.name;
        document.getElementById('current-exercise-part').textContent = currentExercise.bodyPart;

        // 세트 입력 행 생성 (프리셋 정보 전달)
        renderSets(currentExercise.defaultSets, currentExercise.setSpecs);

        // 화면 전환
        document.getElementById('workout-select').style.display = 'none';
        const workoutInput = document.getElementById('workout-input');
        workoutInput.style.display = 'block';

        // 히스토리 추가 (뒤로가기 제스처 지원)
        if (pushHistory) {
            history.pushState({ page: 'workout', exerciseId: exercise.id }, '', '');
        }

        // 메모 필드 초기화
        if (!document.getElementById('workout-memo')) {
            const memoHTML = `
        <div class="memo-container" style="margin-top: 20px;">
          <label class="card-label">메모</label>
          <textarea id="workout-memo" class="set-input" style="text-align:left; height:80px; padding:10px;" placeholder="오늘 운동 컨디션이나 특이사항을 적어주세요"></textarea>
        </div>
      `;
            document.getElementById('btn-save-workout').insertAdjacentHTML('beforebegin', memoHTML);
        } else {
            document.getElementById('workout-memo').value = '';
        }
    }

    // ---- 세트 입력 행 렌더링 ----
    function renderSets(numSets, setSpecs) {
        const setsEl = document.getElementById('sets-list');
        setsEl.innerHTML = '';

        for (let i = 1; i <= numSets; i++) {
            const spec = (setSpecs && setSpecs[i - 1]) ? setSpecs[i - 1] : (setSpecs ? setSpecs[setSpecs.length - 1] : { weight: 0, reps: 0, rpe: '' });
            setsEl.innerHTML += createSetRow(i, spec.weight, spec.reps, spec.rpe);
        }

        bindCheckboxEvents();
    }

    // ---- 세트 행 HTML 생성 ----
    function createSetRow(setNumber, targetWeight, targetReps, rpe) {
        return `
      <div class="set-row" data-set="${setNumber}">
        <span class="set-number">${setNumber}</span>
        <span class="set-target">${targetReps}</span>
        <span class="set-rpe">${rpe}</span>
        <input type="number" class="set-input weight-input" value="${targetWeight}" 
               placeholder="kg" min="0" step="0.5" inputmode="decimal">
        <input type="number" class="set-input reps-input" value="${targetReps}" 
               placeholder="회" min="0" step="1" inputmode="numeric">
        <div class="set-check">
          <input type="checkbox" title="완료 체크">
          <span class="row-timer" style="display:none;">00:00</span>
        </div>
      </div>
    `;
    }

    // ---- 체크박스 이벤트: 완료 시 행 스타일 변경 ----
    function bindCheckboxEvents() {
        // 체크박스 클릭 이벤트
        document.querySelectorAll('.set-row input[type="checkbox"]').forEach((checkbox) => {
            checkbox.addEventListener('change', () => {
                const row = checkbox.closest('.set-row');
                if (checkbox.checked) {
                    row.classList.add('completed');
                    // 타이머 시작 (완료 체크 시에만)
                    startTimer(row);
                } else {
                    row.classList.remove('completed');
                    resetTimer(row);
                }
            });
        });
    }

    // ---- 타이머 시작 로직 ----
    function startTimer(row) {
        // 1. 설정값 또는 운동 이름에서 시간 추출
        const savedDuration = localStorage.getItem('restTimerDuration');
        const name = currentExercise.name;
        const match = name.match(/\d+/); // 이름에 숫자가 있는지 확인 (개별 설정 우선)

        let seconds = 60;
        if (match) {
            seconds = parseInt(match[0]);
        } else if (savedDuration) {
            seconds = parseInt(savedDuration);
        }

        // 2. 해당 행의 타이머 요소 찾기
        const timerEl = row.querySelector('.row-timer');
        if (!timerEl) return;

        // 3. 기존 타이머가 있으면 초기화
        resetTimer(row);

        timerEl.style.display = 'inline-block';
        updateTimerDisplay(timerEl, seconds);

        // 4. 카운트다운 시작
        // row에 타이머 ID 저장하여 개별 관리
        row.timerId = setInterval(() => {
            seconds--;
            updateTimerDisplay(timerEl, seconds);

            if (seconds <= 0) {
                clearInterval(row.timerId);
                row.timerId = null;
                playAlarm();
                timerEl.classList.add('timer-finished');
                setTimeout(() => {
                    timerEl.style.display = 'none';
                    timerEl.classList.remove('timer-finished');
                }, 5000); // 5초 뒤 숨김
            }
        }, 1000);
    }

    function resetTimer(row) {
        if (row.timerId) {
            clearInterval(row.timerId);
            row.timerId = null;
        }
        const timerEl = row.querySelector('.row-timer');
        if (timerEl) {
            timerEl.style.display = 'none';
            timerEl.classList.remove('timer-finished');
        }
    }

    function updateTimerDisplay(el, sec) {
        const min = Math.floor(sec / 60);
        const s = sec % 60;
        el.textContent = `${min.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }

    // ---- 알람음 발생 및 진동 (Web Audio & Vibration API) ----
    function playAlarm() {
        // 1. 진동 (모바일 지원 시)
        if ('vibrate' in navigator) {
            navigator.vibrate([200, 100, 200]); // 0.2초 진동, 0.1초 휴식, 0.2초 진동
        }

        // 2. 알람음
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime); // A5 음역
        gain.gain.setValueAtTime(0.5, ctx.currentTime);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        osc.stop(ctx.currentTime + 0.5); // 0.5초간 비프음
    }

    // ---- 세트 추가 ----
    function addSet() {
        const setsEl = document.getElementById('sets-list');
        const currentSets = setsEl.querySelectorAll('.set-row').length;
        const newSetNum = currentSets + 1;

        // 세트 추가 시 마지막 세트 정보 복사
        const lastRow = setsEl.querySelector('.set-row:last-child');
        const lastWeight = lastRow ? lastRow.querySelector('.weight-input').value : 0;
        const lastReps = lastRow ? lastRow.querySelector('.reps-input').value : 0;
        const lastRpe = lastRow ? lastRow.querySelector('.set-rpe').textContent : '';

        setsEl.insertAdjacentHTML('beforeend', createSetRow(newSetNum, lastWeight, lastReps, lastRpe));
        bindCheckboxEvents();
    }

    // ---- 운동 기록 저장 ----
    async function saveWorkout() {
        if (!currentExercise) return;

        // 모든 세트 데이터 수집
        const setRows = document.querySelectorAll('#sets-list .set-row');
        const sets = [];

        setRows.forEach((row) => {
            const weight = parseFloat(row.querySelector('.weight-input').value) || 0;
            const reps = parseInt(row.querySelector('.reps-input').value) || 0;
            const completed = row.querySelector('input[type="checkbox"]').checked;

            sets.push({ weight, reps, completed });
        });

        // 오늘 날짜 (YYYY-MM-DD 형식)
        const today = new Date().toISOString().split('T')[0];

        // 기록 객체 생성
        const record = {
            date: today,
            week: currentWeek,
            day: currentDay,
            exerciseName: currentExercise.name,
            bodyPart: currentExercise.bodyPart,
            sets: sets,
            memo: document.getElementById('workout-memo').value,
            timestamp: new Date().toISOString()
        };

        // IndexedDB에 저장
        await DB.saveRecord(record);

        // 운동 선택 화면으로 돌아가기
        backToList();

        return record;
    }

    // ---- 운동 선택 화면으로 돌아가기 ----
    function backToList(popHistory = true) {
        currentExercise = null;
        document.getElementById('workout-select').style.display = 'block';
        document.getElementById('workout-input').style.display = 'none';
    }

    // ---- 이벤트 바인딩 초기화 ----
    function init() {
        document.getElementById('btn-add-set').addEventListener('click', addSet);
        document.getElementById('btn-save-workout').addEventListener('click', async () => {
            const record = await saveWorkout();
            if (record) {
                App.showToast(`${record.exerciseName} 기록이 저장되었습니다!`, 'success');
                App.updateDashboard();  // 홈 화면 통계 갱신
            }
        });
        document.getElementById('btn-back-to-list').addEventListener('click', () => {
            // 버튼 클릭 시에는 히스토리를 한 단계 뒤로 보냄 (popstate 이벤트를 통해 backToList가 호출됨)
            history.back();
        });
    }

    // ---- 공개 API ----
    return {
        init,
        renderExerciseList,
        selectExercise,
        backToList
    };
})();
