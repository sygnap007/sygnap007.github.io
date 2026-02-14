import pandas as pd  # 데이터 처리를 위한 판다스 라이브러리
import sys        # 시스템 인자(파일 경로 등)를 다루기 위한 라이브러리
from typing import Optional  # 타입 힌트를 위한 도구

def inspect_excel(file_path: str) -> None:
    """
    지정한 경로의 엑셀 파일을 읽어서 시트 구성과 데이터의 일부를 화면에 출력합니다.
    
    Args:
        file_path (str): 분석할 엑셀 파일의 절대 경로 또는 상대 경로
    """
    try:
        # 1. 엑셀 파일 객체 생성 (전체 시트 정보를 확인하기 위함)
        xls: pd.ExcelFile = pd.ExcelFile(file_path)
        print(f"--- [시트 목록 확인] ---")
        print(xls.sheet_names)
        
        # 2. 각 시트별로 순회하며 데이터를 읽어옴
        for sheet_name in xls.sheet_names:
            print(f"\n>>> 시트명: {sheet_name}")
            
            # 해당 시트의 데이터를 데이터프레임(표 형식)으로 읽기
            df: pd.DataFrame = pd.read_excel(file_path, sheet_name=sheet_name)
            
            # 3. 데이터 전처리: '일자' 컬럼이 비어있을 경우 위쪽 값으로 채움 (Forward Fill)
            if '일자' in df.columns:
                df['일자'] = df['일자'].ffill()
            
            # 4. 출력할 필수 컬럼 정의 (파일에 해당 컬럼이 있는지 확인)
            required_columns: list[str] = ['일자', '운동명', '부위', '세트', '반복수', '중량']
            existing_cols: list[str] = [c for c in required_columns if c in df.columns]
            
            # 5. 데이터의 상위 10개 행만 출력하여 구조 확인
            print(df[existing_cols].head(10))
            
    except FileNotFoundError:
        print(f"오류: 파일을 찾을 수 없습니다. 경로가 맞는지 확인해주세요. ({file_path})")
    except Exception as e:
        print(f"작업 중 예상치 못한 오류가 발생했습니다: {e}")

if __name__ == "__main__":
    # 터미널에서 실행 시 파이썬 파일 뒤에 엑셀 경로를 인자로 받았는지 확인
    # 예: python inspect_excel.py workout_data.xlsx
    if len(sys.argv) > 1:
        target_file: str = sys.argv[1]
        inspect_excel(target_file)
    else:
        print("사용법: python inspect_excel.py <엑셀_파일_경로>")
