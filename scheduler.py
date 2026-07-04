from database import get_db_connection

def is_compatible(lic1: str, lic2: str) -> bool:
    """
    Checks if two license classes can share a time slot (max 2 capacity).
    Rule:
    - B tự động only matches with B tự động.
    - B số sàn can match with B số sàn and C1.
    - C1 can match with C1 and B số sàn.
    """
    group_a = {"B số sàn", "C1"}
    if lic1 in group_a and lic2 in group_a:
        return True
    if lic1 == "B tự động" and lic2 == "B tự động":
        return True
    return False

def run_auto_schedule(week_start_date: str):
    """
    Auto-schedules lessons for the week starting at week_start_date (YYYY-MM-DD).
    Algorithm:
    1. Fetch all students who have submitted availability.
    2. Exclude students who have completed >= 3 lessons (lessons_completed >= 3).
    3. Sort students by flexibility (ascending).
    4. Match each student to exactly 1 slot (single-pass greedy):
       - Check student's preferred slots in order.
       - A slot can accept the student if:
         - The slot has 0 students.
         - OR the slot has 1 student whose license class is compatible with the candidate.
       - Max capacity is 2 students per slot.
    5. Return assignments and list of unscheduled students.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Fetch students who have availability entries
    # Note: We filter students in Python so we can list why they were skipped if needed, 
    # but excluding them directly in the query is cleaner. Let's select all and filter in Python
    # to be explicit, but only schedule those with lessons_completed < 3.
    cursor.execute("""
    SELECT DISTINCT s.id, s.name, s.phone, s.license_type, s.lessons_completed 
    FROM students s
    JOIN student_availability sa ON s.id = sa.student_id;
    """)
    all_students = [dict(row) for row in cursor.fetchall()]
    
    # Fetch all student availabilities
    cursor.execute("""
    SELECT student_id, day_of_week, slot_id 
    FROM student_availability;
    """)
    availabilities = cursor.fetchall()
    
    # Map student_id to their list of (day_of_week, slot_id)
    student_avail_map = {}
    for row in availabilities:
        sid = row['student_id']
        if sid not in student_avail_map:
            student_avail_map[sid] = []
        student_avail_map[sid].append((row['day_of_week'], row['slot_id']))
        
    conn.close()
    
    # Filter and build student scheduling list
    # Students with >= 3 lessons are completely excluded from scheduling
    scheduling_list = []
    for student in all_students:
        if student['lessons_completed'] >= 3:
            continue
            
        sid = student['id']
        student_slots = student_avail_map.get(sid, [])
        scheduling_list.append({
            "id": sid,
            "name": student['name'],
            "phone": student['phone'],
            "license_type": student['license_type'],
            "lessons_completed": student['lessons_completed'],
            "slots": student_slots,
            "flexibility": len(student_slots)
        })
        
    # Sort students by flexibility (least flexible first)
    scheduling_list = [s for s in scheduling_list if s["flexibility"] > 0]
    scheduling_list.sort(key=lambda x: x["flexibility"])
    
    # State tracking:
    # slot_students[(day, slot)] = list of student dicts currently in that slot (max length 2)
    slot_students = {}
    assignments = []
    unscheduled = []
    
    # Single-pass greedy matching with compatibility
    for student in scheduling_list:
        sid = student['id']
        sname = student['name']
        sphone = student['phone']
        slicense = student['license_type']
        
        matched = False
        for day, slot in student['slots']:
            slot_key = (day, slot)
            current_scheduled = slot_students.get(slot_key, [])
            
            # Check capacity and compatibility
            if len(current_scheduled) == 0:
                # Slot is empty, can place student
                slot_students[slot_key] = [student]
                assignments.append({
                    "student_id": sid,
                    "student_name": sname,
                    "student_phone": sphone,
                    "license_type": slicense,
                    "day_of_week": day,
                    "slot_id": slot
                })
                matched = True
                break
            elif len(current_scheduled) == 1:
                # Slot has 1 student, check compatibility
                existing_student = current_scheduled[0]
                if is_compatible(existing_student["license_type"], slicense):
                    slot_students[slot_key].append(student)
                    assignments.append({
                        "student_id": sid,
                        "student_name": sname,
                        "student_phone": sphone,
                        "license_type": slicense,
                        "day_of_week": day,
                        "slot_id": slot
                    })
                    matched = True
                    break
                    
        if not matched:
            unscheduled.append({
                "student_id": sid,
                "student_name": sname,
                "student_phone": sphone,
                "license_type": slicense,
                "reason": "Tất cả các ca rảnh đã hết chỗ hoặc không tương thích hạng xe"
            })
            
    return {
        "week_start_date": week_start_date,
        "assignments": assignments,
        "unscheduled": unscheduled
    }

if __name__ == "__main__":
    print("Scheduler with compatibility loaded.")
