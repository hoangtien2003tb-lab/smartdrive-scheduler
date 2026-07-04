document.addEventListener("DOMContentLoaded", () => {
    // DOM Elements
    const studentForm = document.getElementById("student-form");
    const formContainer = document.getElementById("form-container");
    const successContainer = document.getElementById("success-container");
    const btnBack = document.getElementById("btn-back");
    const toast = document.getElementById("toast");
    
    // Tab switching elements
    const tabButtons = document.querySelectorAll(".tab-btn");
    const tabContents = document.querySelectorAll(".tab-content");
    const lookupForm = document.getElementById("lookup-form");
    const lookupPhone = document.getElementById("lookup-phone");
    const lookupResultContainer = document.getElementById("lookup-result-container");

    const daysOfWeek = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];
    let timeSlots = [];

    // Utility function to show toast notifications
    const showToast = (message, type = "success") => {
        toast.textContent = message;
        toast.className = `toast show ${type}`;
        setTimeout(() => {
            toast.className = "toast";
        }, 3500);
    };

    // --- Tab Switching Navigation ---
    tabButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            tabButtons.forEach(b => b.classList.remove("active"));
            tabContents.forEach(c => c.classList.remove("active"));
            
            btn.classList.add("active");
            const tabId = `tab-${btn.dataset.tab}`;
            document.getElementById(tabId).classList.add("active");
            
            // Scroll to top of window
            window.scrollTo({ top: 0, behavior: "smooth" });
        });
    });

    // --- Fetch Time Slots and Render Form Grid ---
    async function initPage() {
        try {
            const response = await fetch("/api/time-slots");
            if (!response.ok) throw new Error("Không thể tải cấu hình ca học.");
            
            timeSlots = await response.json();
            renderGrid(timeSlots);
        } catch (error) {
            console.error(error);
            showToast(error.message, "error");
        }
    }

    function renderGrid(slots) {
        const headerRow = document.getElementById("table-headers");
        const tableBody = document.getElementById("table-body");
        
        // Render headers
        slots.forEach(slot => {
            const th = document.createElement("th");
            th.innerHTML = `${slot.name}<br><small style="font-weight: normal; opacity: 0.7; font-size: 0.8rem;">${slot.start_time} - ${slot.end_time}</small>`;
            headerRow.appendChild(th);
        });

        // Render days (Monday - Saturday) and checkboxes
        daysOfWeek.forEach(day => {
            const tr = document.createElement("tr");
            
            // Day column
            const tdDay = document.createElement("td");
            tdDay.textContent = day;
            tr.appendChild(tdDay);
            
            // Checkbox columns
            slots.forEach(slot => {
                const td = document.createElement("td");
                const checkboxId = `chk_${day.replace(/\s+/g, '')}_${slot.id}`;
                
                const checkbox = document.createElement("input");
                checkbox.type = "checkbox";
                checkbox.id = checkboxId;
                checkbox.className = "cell-checkbox";
                checkbox.dataset.day = day;
                checkbox.dataset.slotId = slot.id;
                
                const label = document.createElement("label");
                label.htmlFor = checkboxId;
                label.className = "cell-label";
                label.innerHTML = `<i class="fa-regular fa-square" style="margin-right: 0.3rem;"></i> Rảnh`;
                
                checkbox.addEventListener("change", () => {
                    if (checkbox.checked) {
                        label.innerHTML = `<i class="fa-solid fa-square-check" style="margin-right: 0.3rem;"></i> Chọn`;
                    } else {
                        label.innerHTML = `<i class="fa-regular fa-square" style="margin-right: 0.3rem;"></i> Rảnh`;
                    }
                });

                td.appendChild(checkbox);
                td.appendChild(label);
                tr.appendChild(td);
            });
            
            tableBody.appendChild(tr);
        });
    }

    // --- Submit Availability Form ---
    studentForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        const name = document.getElementById("name").value.trim();
        const phone = document.getElementById("phone").value.trim();
        const email = document.getElementById("email").value.trim() || null;
        const notes = document.getElementById("notes").value.trim() || null;
        const licenseType = document.querySelector('input[name="license_type"]:checked').value;
        const lessonsCompleted = parseInt(document.getElementById("lessons-completed").value);
        
        // Collect checked availabilities
        const availability = [];
        const checkboxes = document.querySelectorAll(".cell-checkbox:checked");
        
        checkboxes.forEach(cb => {
            availability.push({
                day_of_week: cb.dataset.day,
                slot_id: cb.dataset.slotId
            });
        });
        
        // Only require availability check if completed lessons < 3 (student actually needs scheduling)
        if (lessonsCompleted < 3 && availability.length === 0) {
            showToast("Vui lòng chọn ít nhất 1 ca rảnh trong tuần để xếp lịch học!", "error");
            return;
        }

        const submitBtn = document.getElementById("submit-btn");
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Đang gửi...`;

        try {
            const response = await fetch("/api/students", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name,
                    phone,
                    email,
                    license_type: licenseType,
                    lessons_completed: lessonsCompleted,
                    availability
                })
            });

            const result = await response.json();
            
            if (response.ok) {
                formContainer.style.display = "none";
                successContainer.style.display = "block";
                window.scrollTo({ top: 0, behavior: "smooth" });
                studentForm.reset();
                
                // Reset checkboxes icons
                document.querySelectorAll(".cell-checkbox").forEach(cb => {
                    cb.checked = false;
                    const label = document.querySelector(`label[for="${cb.id}"]`);
                    if (label) {
                        label.innerHTML = `<i class="fa-regular fa-square" style="margin-right: 0.3rem;"></i> Rảnh`;
                    }
                });
            } else {
                throw new Error(result.detail || "Đã xảy ra lỗi khi gửi đăng ký.");
            }
        } catch (error) {
            console.error(error);
            showToast(error.message, "error");
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `<i class="fa-regular fa-paper-plane"></i> Gửi thông tin đăng ký`;
        }
    });

    btnBack.addEventListener("click", () => {
        successContainer.style.display = "none";
        formContainer.style.display = "block";
    });

    // --- Search Personal Schedule Lookup ---
    lookupForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        const phoneVal = lookupPhone.value.trim();
        if (!phoneVal) return;

        const lookupBtn = document.getElementById("lookup-btn");
        lookupBtn.disabled = true;
        lookupBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Đang tra...`;
        lookupResultContainer.style.display = "none";

        try {
            const response = await fetch(`/api/student/schedule?phone=${encodeURIComponent(phoneVal)}`);
            if (!response.ok) throw new Error("Lỗi khi kết nối với máy chủ tra cứu.");
            
            const data = await response.json();
            renderLookupResults(data);
        } catch (error) {
            console.error(error);
            showToast(error.message, "error");
        } finally {
            lookupBtn.disabled = false;
            lookupBtn.innerHTML = `<i class="fa-solid fa-magnifying-glass"></i> Tra cứu`;
        }
    });

    function renderLookupResults(data) {
        lookupResultContainer.innerHTML = "";
        lookupResultContainer.style.display = "block";

        if (data.status === "not_found") {
            lookupResultContainer.innerHTML = `
                <div style="border: 1px solid rgba(239, 68, 68, 0.3); background: rgba(239, 68, 68, 0.08); border-radius: 12px; padding: 1.5rem; color: #fff; text-align: center;">
                    <i class="fa-solid fa-circle-xmark" style="font-size: 2rem; color: var(--danger); margin-bottom: 0.75rem;"></i>
                    <h3 style="margin-bottom: 0.5rem;">Không tìm thấy đăng ký</h3>
                    <p style="color: var(--text-muted); font-size: 0.95rem;">${data.message}</p>
                </div>
            `;
            return;
        }

        let tagClass = "bsan";
        if (data.license_type === "B tự động") tagClass = "btudong";
        else if (data.license_type === "C1") tagClass = "c1";

        if (data.status === "completed") {
            lookupResultContainer.innerHTML = `
                <div style="border: 1px solid rgba(16, 185, 129, 0.3); background: rgba(16, 185, 129, 0.08); border-radius: 12px; padding: 1.5rem; color: #fff;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.75rem;">
                        <div>
                            <h3 style="font-size: 1.15rem;">Học viên: ${data.student_name}</h3>
                            <span style="font-size: 0.8rem; color: var(--text-muted); display: block; margin-top: 0.2rem;">SĐT: ${lookupPhone.value.trim()}</span>
                        </div>
                        <span class="license-tag ${tagClass}">${data.license_type}</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.75rem; color: var(--success);">
                        <div style="width: 38px; height: 38px; border-radius: 8px; background: rgba(16, 185, 129, 0.15); display: flex; align-items: center; justify-content: center; color: var(--success); font-size: 1.25rem;">
                            <i class="fa-solid fa-graduation-cap"></i>
                        </div>
                        <p style="font-size: 0.95rem; line-height: 1.4; color: #fff;"><strong>Khóa học hoàn thành!</strong><br><span style="color: var(--text-muted); font-size: 0.9rem;">${data.message}</span></p>
                    </div>
                </div>
            `;
            return;
        }

        if (data.status === "pending") {
            lookupResultContainer.innerHTML = `
                <div style="border: 1px solid rgba(245, 158, 11, 0.3); background: rgba(245, 158, 11, 0.08); border-radius: 12px; padding: 1.5rem; color: #fff;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.75rem;">
                        <div>
                            <h3 style="font-size: 1.15rem;">Học viên: ${data.student_name}</h3>
                            <span style="font-size: 0.8rem; color: var(--text-muted); display: block; margin-top: 0.2rem;">SĐT: ${lookupPhone.value.trim()}</span>
                        </div>
                        <span class="license-tag ${tagClass}">${data.license_type}</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.75rem; color: var(--warning);">
                        <i class="fa-solid fa-clock-rotate-left" style="font-size: 1.5rem;"></i>
                        <p style="font-size: 0.95rem; line-height: 1.4;">${data.message}</p>
                    </div>
                </div>
            `;
            return;
        }

        if (data.status === "scheduled") {
            let scheduleItemsHtml = "";
            
            data.schedules.forEach(s => {
                const isSang = s.slot_id === "ca_sang";
                const slotText = isSang ? "Ca sáng" : "Ca chiều";
                const icon = isSang ? "fa-sun" : "fa-cloud-sun";
                
                scheduleItemsHtml += `
                    <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid var(--border-color); border-radius: 10px; padding: 1rem; margin-top: 0.75rem; display: flex; align-items: center; justify-content: space-between;">
                        <div style="display: flex; align-items: center; gap: 0.75rem;">
                            <div style="width: 38px; height: 38px; border-radius: 8px; background: rgba(99, 102, 241, 0.15); display: flex; align-items: center; justify-content: center; color: var(--primary);">
                                <i class="fa-solid ${icon}"></i>
                            </div>
                            <div>
                                <strong style="color: #fff; display: block; font-size: 1rem;">${s.day_of_week} - ${slotText}</strong>
                                <span style="font-size: 0.85rem; color: var(--text-muted);">${s.start_time} - ${s.end_time}</span>
                            </div>
                        </div>
                        <span style="color: var(--success); font-weight: 600; font-size: 0.85rem;"><i class="fa-solid fa-circle-check"></i> Đã xếp lịch</span>
                    </div>
                `;
            });

            lookupResultContainer.innerHTML = `
                <div style="border: 1px solid rgba(16, 185, 129, 0.3); background: rgba(16, 185, 129, 0.08); border-radius: 16px; padding: 1.75rem; color: #fff;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.25rem; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 1rem;">
                        <div>
                            <h3 style="font-size: 1.25rem; color: #fff;">Lịch Học Của Bạn Tuần Này</h3>
                            <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.25rem;">Học viên: <strong>${data.student_name}</strong> | SĐT: ${lookupPhone.value.trim()}</p>
                        </div>
                        <span class="license-tag ${tagClass}">${data.license_type}</span>
                    </div>
                    
                    <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                        ${scheduleItemsHtml}
                    </div>
                </div>
            `;
        }
    }

    initPage();
});
