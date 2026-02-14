import base64
import os

file_path = 'docs/sample.xlsx'
if os.path.exists(file_path):
    with open(file_path, 'rb') as f:
        encoded = base64.b64encode(f.read()).decode()
        
    js_code = f"""
async function simulateUpload() {{
    const base64 = "{encoded}";
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {{
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }}
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], {{ type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }});
    const file = new File([blob], 'sample.xlsx', {{ type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }});

    console.log('[Test] Simulating upload...');
    try {{
        const exercises = await Excel.parseFile(file);
        console.log('[Test] Parsed exercises:', exercises.length);
        await DB.saveExercises(exercises);
        console.log('[Test] Saved to DB');
        
        // Refresh UI components
        if (typeof App !== 'undefined' && App.init) {{
            await App.init();
            console.log('[Test] App Re-initialized');
        }}
        return "Success: " + exercises.length + " exercises uploaded.";
    }} catch (err) {{
        console.error('[Test] Simulation failed:', err);
        return "Error: " + err.message;
    }}
}}
simulateUpload();
"""
    with open('.tmp/sim_upload.js', 'w', encoding='utf-8') as f:
        f.write(js_code)
    print("JS snippet created at .tmp/sim_upload.js")
else:
    print("File not found")
