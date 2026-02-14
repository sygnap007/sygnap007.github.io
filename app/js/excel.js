// ============================================
// excel.js - 엑셀 파일 파싱 모듈
// ============================================
// SheetJS(xlsx) 라이브러리를 사용하여 엑셀 파일을 읽고,
// 운동 리스트 데이터로 변환합니다.
// ============================================

const Excel = (() => {

    // ---- 엑셀 파일 파싱 ----
    // 엑셀 파일을 읽어서 운동 리스트 배열로 변환합니다.
    // 반환 형식: [{ bodyPart, name, defaultSets, defaultReps, defaultWeight }]
    function parseFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });

                    // 데이터 행을 운동 객체로 변환
                    const allExercises = [];

                    // 숫자만 추출하는 헬퍼 함수
                    const parseNumber = (val) => {
                        if (val === undefined || val === null || val === '') return null;
                        if (typeof val === 'number') return val;
                        const match = String(val).match(/[\d.]+/);
                        return match ? parseFloat(match[0]) : null;
                    };

                    workbook.SheetNames.forEach(sheetName => {
                        const sheet = workbook.Sheets[sheetName];
                        const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

                        if (rawData.length < 1) return;

                        // 헤더 행 찾기 (상단 15줄까지 검색 범위를 넓힘)
                        let headerRowIndex = -1;
                        let columnMap = null;

                        for (let i = 0; i < Math.min(rawData.length, 15); i++) {
                            const row = rawData[i];
                            if (!row || row.length < 2) continue; // 데이터가 너무 적은 행은 패스

                            const potentialHeaders = row.map(h => String(h || '').trim());
                            const testMap = mapColumns(potentialHeaders);

                            // 최소한 '운동명'과 '반복수' 또는 '세트' 중 하나는 찾아야 헤더로 인정
                            if (testMap.name !== -1 && (testMap.reps !== -1 || testMap.sets !== -1)) {
                                headerRowIndex = i;
                                columnMap = testMap;
                                break;
                            }
                        }

                        // 헤더를 못 찾았으면 이 시트는 건너뜀
                        if (headerRowIndex === -1) {
                            console.warn(`[Excel] '${sheetName}' 시트에서 유효한 헤더를 찾을 수 없습니다. (최소 '운동명'과 '반복수' 또는 '세트' 필요)`);
                            return;
                        }

                        console.log(`[Excel] '${sheetName}' 시트 헤더 발견 (행번호: ${headerRowIndex + 1})`);

                        let currentDay = '';
                        let currentName = '';

                        // 헤더 다음 줄부터 데이터 읽기
                        for (let i = headerRowIndex + 1; i < rawData.length; i++) {
                            const row = rawData[i];
                            if (!row || row.length === 0) continue;

                            // '일자' ffill
                            if (columnMap.day >= 0 && row[columnMap.day]) {
                                currentDay = String(row[columnMap.day]).trim();
                            }

                            // '운동명' ffill (셀 병합 대응)
                            const nameInRow = row[columnMap.name] ? String(row[columnMap.name]).trim() : null;
                            if (nameInRow) {
                                currentName = nameInRow;
                            }

                            // 운동명도 없고, 반복수나 중량 같은 핵심 데이터도 없으면 진짜 빈 행임
                            const reps = parseNumber(row[columnMap.reps]);
                            const weight = parseNumber(row[columnMap.weight]);
                            const rpe = row[columnMap.rpe] !== undefined ? String(row[columnMap.rpe]).trim() : '';

                            if (!currentName || (reps === null && weight === null)) continue;

                            // 이전 운동과 같은 주차, 일자, 이름인지 확인하여 병합
                            const lastEx = allExercises[allExercises.length - 1];
                            if (lastEx && lastEx.week === sheetName && lastEx.day === currentDay && lastEx.name === currentName) {
                                lastEx.defaultSets += 1;
                                lastEx.setSpecs.push({ reps: reps || 10, weight: weight || 0, rpe });
                                // 첫 번째 유효한 값이 있다면 기본값으로 유지
                                if (lastEx.defaultReps === 0 && reps > 0) lastEx.defaultReps = reps;
                                if (lastEx.defaultWeight === 0 && weight > 0) lastEx.defaultWeight = weight;
                            } else {
                                allExercises.push({
                                    week: sheetName,
                                    day: currentDay || '1일차',
                                    bodyPart: columnMap.bodyPart >= 0 ? String(row[columnMap.bodyPart] || '기타').trim() : '기타',
                                    name: currentName,
                                    defaultSets: 1,
                                    defaultReps: reps || 0,
                                    defaultWeight: weight || 0,
                                    setSpecs: [{ reps: reps || 10, weight: weight || 0, rpe }],
                                    order: i
                                });
                            }
                        }
                    });

                    if (allExercises.length === 0) {
                        reject(new Error('유효한 운동 데이터를 찾을 수 없습니다. "운동명" 헤더가 포함된 시트가 필요합니다.'));
                        return;
                    }

                    console.log('[Excel] 파싱 완료:', allExercises.length, '개 운동');
                    resolve(allExercises);
                } catch (err) {
                    console.error('[Excel] 파싱 오류:', err);
                    reject(new Error('엑셀 파일을 읽는 중 오류가 발생했습니다: ' + err.message));
                }
            };

            reader.onerror = () => {
                reject(new Error('파일을 읽을 수 없습니다.'));
            };

            // 파일을 ArrayBuffer로 읽기
            reader.readAsArrayBuffer(file);
        });
    }

    // ---- 열 이름 매핑 ----
    // 다양한 헤더 이름에 대응할 수 있도록 유연하게 매핑합니다.
    // 예: "운동부위", "부위", "Body Part" 등을 모두 bodyPart로 인식
    function mapColumns(headers) {
        const map = {
            day: -1,
            bodyPart: -1,
            name: -1,
            sets: -1,
            reps: -1,
            weight: -1,
            rpe: -1
        };

        headers.forEach((header, index) => {
            if (!header) return;
            const h = String(header).toLowerCase().replace(/\s/g, ''); // 모든 공백 제거 후 비교

            // RPE 매핑
            if (h === 'rpe') {
                map.rpe = index;
            }
            // 일자 매핑
            else if (h.includes('일자') || h.includes('day') || h.includes('날짜') || h.includes('date')) {
                map.day = index;
            }
            // 부위 매핑
            else if (h.includes('부위') || h.includes('body') || h.includes('part') || h.includes('카테고리') || h.includes('category')) {
                map.bodyPart = index;
            }
            // 이름 매핑 (최대한 넓게)
            else if (h.includes('운동명') || h.includes('종목') || h.includes('품목') || h.includes('운동') || h.includes('이름') || h.includes('name') || h.includes('exercise')) {
                // 더 구체적인 이름이면 교체
                if (map.name === -1 || h.includes('명') || h.includes('이름')) {
                    map.name = index;
                }
            }
            // 세트 매핑 (강화)
            else if (h === '세트' || h === 'set' || h === 'sets' || (h.includes('세트') && !h.includes('수행'))) {
                map.sets = index;
            }
            // 회수/반복수 매핑 (강화)
            else if (h.includes('반복') || h.includes('회수') || h.includes('rep') || h.includes('횟수')) {
                // '수행반복수' 보다 '반복수'를 우선시하기 위해 체크
                if (map.reps === -1 || (!h.includes('수행') && h.includes('반복'))) {
                    map.reps = index;
                }
            }
            // 중량 매핑
            else if (h.includes('중량') || h.includes('무게') || h.includes('weight') || h.includes('kg')) {
                map.weight = index;
            }
        });

        console.log('[Excel] 컬럼 매핑 결과:', map);
        return map;
    }

    // ---- 공개 API ----
    return {
        parseFile
    };
})();
