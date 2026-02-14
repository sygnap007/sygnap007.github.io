// ============================================
// db.js - IndexedDB 데이터베이스 관리 모듈
// ============================================
// 앱의 모든 데이터(운동 리스트, 운동 기록)를 브라우저 내장
// IndexedDB에 저장하고 불러오는 함수들을 제공합니다.
// ============================================

const DB = (() => {
    // ---------- 상수 ----------
    const DB_NAME = 'WorkoutTrackerDB';    // 데이터베이스 이름
    const DB_VERSION = 1;                  // 스키마 버전 (구조 변경 시 올림)
    let db = null;                         // DB 연결 객체

    // ---------- 스토어(테이블) 이름 ----------
    const STORES = {
        EXERCISES: 'exercises',    // 등록된 운동 목록 (엑셀에서 불러옴)
        RECORDS: 'records'         // 운동 기록 (날짜별 운동 데이터)
    };

    // ---- 데이터베이스 초기화 (앱 시작 시 1회 호출) ----
    // IndexedDB를 열고, 필요 시 스토어(테이블)를 생성합니다.
    function init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            // DB 스키마 생성/업그레이드 (최초 실행 또는 버전 변경 시)
            request.onupgradeneeded = (event) => {
                const database = event.target.result;

                // exercises 스토어: 운동 목록
                // keyPath: 자동 증가 ID
                if (!database.objectStoreNames.contains(STORES.EXERCISES)) {
                    const exerciseStore = database.createObjectStore(STORES.EXERCISES, {
                        keyPath: 'id',
                        autoIncrement: true
                    });
                    // 부위별 검색을 위한 인덱스
                    exerciseStore.createIndex('bodyPart', 'bodyPart', { unique: false });
                    // 이름으로 검색을 위한 인덱스
                    exerciseStore.createIndex('name', 'name', { unique: false });
                }

                // records 스토어: 운동 기록
                // keyPath: 자동 증가 ID
                if (!database.objectStoreNames.contains(STORES.RECORDS)) {
                    const recordStore = database.createObjectStore(STORES.RECORDS, {
                        keyPath: 'id',
                        autoIncrement: true
                    });
                    // 날짜별 검색을 위한 인덱스
                    recordStore.createIndex('date', 'date', { unique: false });
                    // 운동별 검색을 위한 인덱스
                    recordStore.createIndex('exerciseName', 'exerciseName', { unique: false });
                }
            };

            request.onsuccess = (event) => {
                db = event.target.result;
                console.log('[DB] 데이터베이스 연결 성공');
                resolve(db);
            };

            request.onerror = (event) => {
                console.error('[DB] 데이터베이스 연결 실패:', event.target.error);
                reject(event.target.error);
            };
        });
    }

    // ---- 운동 목록 전체 가져오기 ----
    function getAllExercises() {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORES.EXERCISES, 'readonly');
            const store = transaction.objectStore(STORES.EXERCISES);
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // ---- 운동 목록 일괄 저장 (엑셀 업로드 시) ----
    // 기존 목록을 모두 지우고 새로 저장합니다.
    function saveExercises(exercises) {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORES.EXERCISES, 'readwrite');
            const store = transaction.objectStore(STORES.EXERCISES);

            // 기존 데이터 모두 삭제
            store.clear();

            // 새 데이터 추가
            exercises.forEach((exercise) => {
                store.add(exercise);
            });

            transaction.oncomplete = () => {
                console.log('[DB] 운동 목록 저장 완료:', exercises.length, '개');
                resolve();
            };
            transaction.onerror = () => reject(transaction.error);
        });
    }

    // ---- 운동 기록 저장 ----
    // 하나의 운동 기록을 저장합니다.
    // record 형식: { date, exerciseName, bodyPart, sets: [{weight, reps, completed}] }
    function saveRecord(record) {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORES.RECORDS, 'readwrite');
            const store = transaction.objectStore(STORES.RECORDS);
            const request = store.add(record);

            request.onsuccess = () => {
                console.log('[DB] 운동 기록 저장:', record.exerciseName);
                resolve(request.result);
            };
            request.onerror = () => reject(request.error);
        });
    }

    // ---- 특정 날짜의 운동 기록 가져오기 ----
    // date 형식: 'YYYY-MM-DD'
    function getRecordsByDate(date) {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORES.RECORDS, 'readonly');
            const store = transaction.objectStore(STORES.RECORDS);
            const index = store.index('date');
            const request = index.getAll(date);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // ---- 특정 운동의 모든 기록 가져오기 (차트용) ----
    function getRecordsByExercise(exerciseName) {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORES.RECORDS, 'readonly');
            const store = transaction.objectStore(STORES.RECORDS);
            const index = store.index('exerciseName');
            const request = index.getAll(exerciseName);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // ---- 모든 운동 기록 가져오기 ----
    function getAllRecords() {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORES.RECORDS, 'readonly');
            const store = transaction.objectStore(STORES.RECORDS);
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // ---- 특정 운동 기록 삭제 ----
    function deleteRecord(id) {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORES.RECORDS, 'readwrite');
            const store = transaction.objectStore(STORES.RECORDS);
            const request = store.delete(Number(id));

            request.onsuccess = () => {
                console.log('[DB] 기록 삭제 완료:', id);
                resolve();
            };
            request.onerror = () => reject(request.error);
        });
    }

    // ---- 특정 날짜의 모든 운동 기록 삭제 ----
    function deleteRecordsByDate(date) {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORES.RECORDS, 'readwrite');
            const store = transaction.objectStore(STORES.RECORDS);
            const index = store.index('date');
            const request = index.openCursor(IDBKeyRange.only(date));

            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    store.delete(cursor.primaryKey);
                    cursor.continue();
                } else {
                    console.log('[DB] 날짜별 기록 삭제 완료:', date);
                    resolve();
                }
            };
            request.onerror = () => reject(request.error);
        });
    }

    // ---- 모든 데이터 삭제 ----
    function clearAll() {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(
                [STORES.EXERCISES, STORES.RECORDS],
                'readwrite'
            );
            transaction.objectStore(STORES.EXERCISES).clear();
            transaction.objectStore(STORES.RECORDS).clear();

            transaction.oncomplete = () => {
                console.log('[DB] 모든 데이터 삭제 완료');
                resolve();
            };
            transaction.onerror = () => reject(transaction.error);
        });
    }

    // ---- 데이터 내보내기 (JSON 형식) ----
    async function exportData() {
        const exercises = await getAllExercises();
        const records = await getAllRecords();
        return { exercises, records, exportDate: new Date().toISOString() };
    }

    // ---- 공개 API ----
    return {
        init,
        getAllExercises,
        saveExercises,
        saveRecord,
        getRecordsByDate,
        getRecordsByExercise,
        getAllRecords,
        deleteRecord,
        deleteRecordsByDate, // 추가
        clearAll,
        exportData
    };
})();
