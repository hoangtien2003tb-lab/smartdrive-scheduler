from fastapi import FastAPI, HTTPException, Query, Header, Depends
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional
import os
import uvicorn
from database import init_db, get_db_connection
from scheduler import run_auto_schedule

app = FastAPI(title="SmartDrive Driving Scheduler API (Secured)")

# Enable CORS for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Admin static security token
ADMIN_SECRET_TOKEN = "smartdrive-admin-secret-session-token"
ADMIN_PASSWORD = "admin123"

# Pydantic Schemas
class AvailabilityItem(BaseModel):
    day_of_week: str
    slot_id: str

class StudentSubmit(BaseModel):
    name: str = Field(..., min_length=1)
    phone: str = Field(..., min_length=8)
    email: Optional[str] = None
    license_type: str = Field(..., description="B số sàn, B tự động, hoặc C1")
    lessons_completed: int = Field(0, ge=0, description="Số buổi học đã hoàn thành")
    notes: Optional[str] = None
    availability: List[AvailabilityItem]

class ScheduleAssignment(BaseModel):
    student_id: int
    day_of_week: str
    slot_id: str

class ScheduleSaveRequest(BaseModel):
    week_start_date: str
    assignments: List[ScheduleAssignment]

class LoginRequest(BaseModel):
    password: str

# Dependency to check admin token
def verify_admin(authorization: str = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Header Authorization không tồn tại.")
    
    # Expecting format: "Bearer smartdrive-admin-secret-session-token"
    parts = authorization.split(" ")
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(status_code=401, detail="Định dạng token Authorization không hợp lệ.")
        
    token = parts[1]
    if token != ADMIN_SECRET_TOKEN:
        raise HTTPException(status_code=401, detail="Token không chính xác hoặc đã hết hạn.")
    return True

@app.on_event("startup")
def startup_event():
    init_db()
    # If running on Vercel, auto-seed database so the demo looks pre-filled right away
    if os.environ.get("VERCEL") or os.environ.get("VERCEL_ENV"):
        try:
            from seed_submissions import seed_students
            seed_students()
            print("Auto-seeded database for Vercel demo.")
        except Exception as e:
            print("Auto-seeding skipped or failed:", e)

# --- Student/Public APIs (Unsecured) ---

@app.get("/api/time-slots")
def get_time_slots():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, start_time, end_time FROM time_slots ORDER BY display_order;")
    slots = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return slots

@app.post("/api/students")
def submit_student_availability(student_data: StudentSubmit):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # 1. Insert or update student (include lessons_completed)
        cursor.execute("SELECT id FROM students WHERE phone = ?;", (student_data.phone,))
        existing_student = cursor.fetchone()
        
        if existing_student:
            student_id = existing_student["id"]
            cursor.execute("""
            UPDATE students 
            SET name = ?, email = ?, license_type = ?, lessons_completed = ?, notes = ? 
            WHERE id = ?;
            """, (student_data.name, student_data.email, student_data.license_type, student_data.lessons_completed, student_data.notes, student_id))
            
            # Clear previous availability
            cursor.execute("DELETE FROM student_availability WHERE student_id = ?;", (student_id,))
        else:
            cursor.execute("""
            INSERT INTO students (name, phone, email, license_type, lessons_completed, notes) 
            VALUES (?, ?, ?, ?, ?, ?);
            """, (student_data.name, student_data.phone, student_data.email, student_data.license_type, student_data.lessons_completed, student_data.notes))
            student_id = cursor.lastrowid
            
        # 2. Insert availability
        for item in student_data.availability:
            cursor.execute("""
            INSERT OR IGNORE INTO student_availability (student_id, day_of_week, slot_id)
            VALUES (?, ?, ?);
            """, (student_id, item.day_of_week, item.slot_id))
            
        conn.commit()
        return {"status": "success", "student_id": student_id, "message": "Thông tin của bạn đã được ghi nhận!"}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@app.get("/api/student/schedule")
def get_student_personal_schedule(phone: str = Query(..., min_length=8)):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # 1. Find student
        cursor.execute("SELECT id, name, license_type, lessons_completed FROM students WHERE phone = ?;", (phone,))
        student = cursor.fetchone()
        if not student:
            return {"status": "not_found", "message": "Số điện thoại chưa được đăng ký trong hệ thống."}
            
        student_id = student["id"]
        student_name = student["name"]
        license_type = student["license_type"]
        lessons_completed = student["lessons_completed"]
        
        # Check if student already completed >= 3 sessions (no scheduling needed)
        if lessons_completed >= 3:
            return {
                "status": "completed",
                "student_name": student_name,
                "license_type": license_type,
                "lessons_completed": lessons_completed,
                "message": f"Bạn đã hoàn thành khóa học (Đã học: {lessons_completed} buổi). Trung tâm không xếp lịch học thêm cho bạn tuần này."
            }
        
        # 2. Get schedule
        cursor.execute("""
        SELECT s.week_start_date, s.day_of_week, s.slot_id, ts.name as slot_name, ts.start_time, ts.end_time
        FROM schedules s
        JOIN time_slots ts ON s.slot_id = ts.id
        WHERE s.student_id = ?
        ORDER BY s.week_start_date DESC;
        """, (student_id,))
        
        rows = cursor.fetchall()
        if not rows:
            return {
                "status": "pending",
                "student_name": student_name,
                "license_type": license_type,
                "lessons_completed": lessons_completed,
                "message": "Lịch học của bạn đang được ban quản trị sắp xếp hoặc chưa công bố. Vui lòng quay lại sau."
            }
            
        schedules = []
        for r in rows:
            schedules.append({
                "week_start_date": r["week_start_date"],
                "day_of_week": r["day_of_week"],
                "slot_id": r["slot_id"],
                "slot_name": r["slot_name"],
                "start_time": r["start_time"],
                "end_time": r["end_time"]
            })
            
        return {
            "status": "scheduled",
            "student_name": student_name,
            "license_type": license_type,
            "lessons_completed": lessons_completed,
            "schedules": schedules
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

# --- Auth APIs (Unsecured) ---

@app.post("/api/admin/login")
def admin_login(req: LoginRequest):
    if req.password == ADMIN_PASSWORD:
        return {"status": "success", "token": ADMIN_SECRET_TOKEN}
    else:
        raise HTTPException(status_code=401, detail="Mật khẩu Admin không chính xác!")

@app.get("/api/admin/verify-auth")
def verify_auth(authorized: bool = Depends(verify_admin)):
    return {"status": "ok"}

# --- Admin APIs (Secured) ---

@app.get("/api/admin/submissions")
def get_student_submissions(authorized: bool = Depends(verify_admin)):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Get all students (includes lessons_completed)
    cursor.execute("SELECT id, name, phone, email, license_type, lessons_completed, notes, created_at FROM students ORDER BY created_at DESC;")
    students = [dict(row) for row in cursor.fetchall()]
    
    # Get all availabilities
    cursor.execute("SELECT student_id, day_of_week, slot_id FROM student_availability;")
    avails = cursor.fetchall()
    
    # Map availabilities to students
    avail_map = {}
    for r in avails:
        sid = r["student_id"]
        if sid not in avail_map:
            avail_map[sid] = []
        avail_map[sid].append({"day_of_week": r["day_of_week"], "slot_id": r["slot_id"]})
        
    for student in students:
        student["availability"] = avail_map.get(student["id"], [])
        
    conn.close()
    return students

@app.delete("/api/admin/submissions/{student_id}")
def delete_student_submission(student_id: int, authorized: bool = Depends(verify_admin)):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("DELETE FROM students WHERE id = ?;", (student_id,))
        conn.commit()
        return {"status": "success", "message": "Đã xoá thông tin học viên."}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@app.post("/api/admin/students")
def admin_submit_student_availability(student_data: StudentSubmit, authorized: bool = Depends(verify_admin)):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT id FROM students WHERE phone = ?;", (student_data.phone,))
        existing_student = cursor.fetchone()
        
        if existing_student:
            student_id = existing_student["id"]
            cursor.execute("""
            UPDATE students 
            SET name = ?, email = ?, license_type = ?, lessons_completed = ?, notes = ? 
            WHERE id = ?;
            """, (student_data.name, student_data.email, student_data.license_type, student_data.lessons_completed, student_data.notes, student_id))
            
            cursor.execute("DELETE FROM student_availability WHERE student_id = ?;", (student_id,))
        else:
            cursor.execute("""
            INSERT INTO students (name, phone, email, license_type, lessons_completed, notes) 
            VALUES (?, ?, ?, ?, ?, ?);
            """, (student_data.name, student_data.phone, student_data.email, student_data.license_type, student_data.lessons_completed, student_data.notes))
            student_id = cursor.lastrowid
            
        for item in student_data.availability:
            cursor.execute("""
            INSERT OR IGNORE INTO student_availability (student_id, day_of_week, slot_id)
            VALUES (?, ?, ?);
            """, (student_id, item.day_of_week, item.slot_id))
            
        conn.commit()
        return {"status": "success", "student_id": student_id, "message": "Thông tin học viên đã được cập nhật thành công!"}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@app.get("/api/admin/schedule")
def get_schedule(week_start_date: str = Query(..., pattern=r"^\d{4}-\d{2}-\d{2}$"), authorized: bool = Depends(verify_admin)):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT s.id, s.week_start_date, s.student_id, st.name as student_name, st.phone as student_phone, st.license_type,
           s.day_of_week, s.slot_id
    FROM schedules s
    JOIN students st ON s.student_id = st.id
    WHERE s.week_start_date = ?;
    """, (week_start_date,))
    schedule = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return schedule

@app.post("/api/admin/schedule/auto")
def auto_schedule(week_start_date: str = Query(..., pattern=r"^\d{4}-\d{2}-\d{2}$"), authorized: bool = Depends(verify_admin)):
    res = run_auto_schedule(week_start_date)
    if "error" in res:
        raise HTTPException(status_code=400, detail=res["error"])
    return res

@app.post("/api/admin/schedule/save")
def save_schedule(req: ScheduleSaveRequest, authorized: bool = Depends(verify_admin)):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # Clear existing schedule for this week
        cursor.execute("DELETE FROM schedules WHERE week_start_date = ?;", (req.week_start_date,))
        
        # Insert new schedule assignments
        for assignment in req.assignments:
            cursor.execute("""
            INSERT OR IGNORE INTO schedules (week_start_date, student_id, day_of_week, slot_id)
            VALUES (?, ?, ?, ?);
            """, (req.week_start_date, assignment.student_id, assignment.day_of_week, assignment.slot_id))
            
        conn.commit()
        return {"status": "success", "message": "Đã lưu lịch học thành công!"}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

# --- Serve Static Files ---
static_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")
if not os.path.exists(static_dir):
    os.makedirs(static_dir)

app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")

if __name__ == "__main__":
    uvicorn.run("app:app", host="127.0.0.1", port=8000, reload=True)
