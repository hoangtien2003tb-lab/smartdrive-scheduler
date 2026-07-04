import sqlite3
import os

# Check if running in Vercel serverless environment
if os.environ.get("VERCEL") or os.environ.get("VERCEL_ENV"):
    DB_PATH = "/tmp/scheduler.db"
else:
    DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "scheduler.db")


def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Enable foreign keys
    cursor.execute("PRAGMA foreign_keys = ON;")
    
    # Create students table (with lessons_completed)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS students (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        email TEXT,
        license_type TEXT NOT NULL,       -- "B số sàn", "B tự động", "C1"
        lessons_completed INTEGER DEFAULT 0, -- Number of lessons completed
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    """)
    
    # Create student availability table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS student_availability (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL,
        day_of_week TEXT NOT NULL,
        slot_id TEXT NOT NULL,
        FOREIGN KEY (student_id) REFERENCES students (id) ON DELETE CASCADE,
        UNIQUE(student_id, day_of_week, slot_id)
    );
    """)
    
    # Create time slots table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS time_slots (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        display_order INTEGER
    );
    """)
    
    # Create schedules table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS schedules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        week_start_date TEXT NOT NULL, -- Format: YYYY-MM-DD (Monday of that week)
        student_id INTEGER NOT NULL,
        day_of_week TEXT NOT NULL,
        slot_id TEXT NOT NULL,
        FOREIGN KEY (student_id) REFERENCES students (id) ON DELETE CASCADE,
        UNIQUE(week_start_date, student_id)
    );
    """)
    
    # Seed default time slots if table is empty
    cursor.execute("SELECT COUNT(*) FROM time_slots;")
    if cursor.fetchone()[0] == 0:
        default_slots = [
            ("ca_sang", "Ca sáng (08:30 - 11:30)", "08:30", "11:30", 1),
            ("ca_chieu", "Ca chiều (14:00 - 17:00)", "14:00", "17:00", 2)
        ]
        cursor.executemany("""
        INSERT INTO time_slots (id, name, start_time, end_time, display_order)
        VALUES (?, ?, ?, ?, ?);
        """, default_slots)
        
    conn.commit()
    conn.close()

if __name__ == "__main__":
    init_db()
    print("Database initialized successfully at:", DB_PATH)
