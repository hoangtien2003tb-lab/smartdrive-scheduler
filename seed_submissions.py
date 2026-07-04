import sqlite3
import os
import random
from database import get_db_connection, init_db

def seed_students():
    init_db() # Ensure db is initialized
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Check if we already have students
    cursor.execute("SELECT COUNT(*) FROM students;")
    if cursor.fetchone()[0] > 0:
        print("Database already has students. Skipping seeding.")
        conn.close()
        return
        
    mock_students = [
        # (name, phone, email, license_type, lessons_completed, notes)
        ("Nguyễn Hoàng Nam", "0901234567", "nam.nh@gmail.com", "B số sàn", 0, "Học từ cơ bản"),
        ("Trần Thị Mai", "0912345678", "mai.tt@gmail.com", "B tự động", 1, "Rảnh chiều Thứ 2, 4, 6"),
        ("Lê Minh Tuấn", "0987654321", "tuan.lm@gmail.com", "C1", 2, "Chạy xe tải hạng nặng"),
        ("Phạm Thanh Sơn", "0977778888", "son.pt@gmail.com", "B số sàn", 0, "Học cuối tuần"),
        ("Đỗ Thu Hà", "0934567890", "ha.dt@gmail.com", "B tự động", 3, "Đã học đủ 3 buổi - Khoá học hoàn thành"), # Completed (> 3)
        ("Vũ Hoàng Anh", "0955556666", "anh.vh@gmail.com", "C1", 1, "Rảnh nhiều ca"),
        ("Ngô Quốc Huy", "0922223333", None, "B số sàn", 4, "Đã học 4 buổi - Khoá học hoàn thành"), # Completed (> 3)
        ("Phan Ngọc Linh", "0966667777", "linh.pn@gmail.com", "B tự động", 1, "Chỉ học được chiều"),
        ("Đặng Hoàng Lâm", "0944445555", None, "C1", 2, "Học nhanh"),
        ("Bùi Phương Thảo", "0911112222", "thao.bp@gmail.com", "B số sàn", 0, "Học ngoài giờ hành chính")
    ]
    
    # Insert students
    student_ids = []
    for name, phone, email, license_type, lessons_completed, notes in mock_students:
        cursor.execute("""
        INSERT INTO students (name, phone, email, license_type, lessons_completed, notes)
        VALUES (?, ?, ?, ?, ?, ?);
        """, (name, phone, email, license_type, lessons_completed, notes))
        student_ids.append(cursor.lastrowid)
        
    days = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"]
    slots = ["ca_sang", "ca_chieu"]
    
    # Insert random availabilities for each student
    for sid in student_ids:
        # Give each student between 3 and 5 random available slots in the week
        num_slots = random.randint(3, 5)
        chosen_slots = set()
        
        while len(chosen_slots) < num_slots:
            day = random.choice(days)
            slot = random.choice(slots)
            chosen_slots.add((day, slot))
            
        for day, slot in chosen_slots:
            cursor.execute("""
            INSERT OR IGNORE INTO student_availability (student_id, day_of_week, slot_id)
            VALUES (?, ?, ?);
            """, (sid, day, slot))
            
    conn.commit()
    conn.close()
    print("Successfully seeded 10 mock students (some completed)!")

if __name__ == "__main__":
    seed_students()
