# Pip 설치 패키지 목록 및 목적

이 문서는 `stay_health` 가상환경에 설치된 파이썬 패키지들과 그 용도를 기록합니다.

## 설치 일자: 2026-02-14

### 1. 주요 라이브러리
- **pandas**: 데이터 분석 및 조작을 위한 핵심 라이브러리입니다. 엑셀 데이터를 데이터프레임(DataFrame) 형식으로 읽고 처리하는 데 사용됩니다.
- **openpyxl**: 파이썬에서 .xlsx 엑셀 파일을 읽고 쓰기 위한 엔진입니다. pandas의 `read_excel` 기능과 연동됩니다.
- **pandas-stubs**: pandas 라이브러리의 타입 힌트 정보를 제공하여 정적 분석 도구(Pyre 등)가 코드를 올바르게 이해하도록 돕습니다.
- **types-openpyxl**: openpyxl 라이브러리의 타입 힌트 정보를 제공합니다.

### 2. 세부 설치 리스트 (pip list 결과)
- pandas: 데이터 처리
- openpyxl: 엑셀 파일 읽기/쓰기 엔진
- numpy: 수치 계산 지원 (pandas 의존성)
- python-dateutil: 날짜 처리 지원 (pandas 의존성)
- pytz: 시간대 처리 지원 (pandas 의존성)
- six: 호환성 라이브러리
- et-xmlfile: 엑셀 파일 처리를 위한 보조 라이브러리 (openpyxl 의존성)
- pandas-stubs: pandas 타입 힌트 (정적 분석용)
- types-openpyxl: openpyxl 타입 힌트 (정적 분석용)
