document.addEventListener("DOMContentLoaded", () => {
    // 1. Authentication Check & Global Wrapper
    const token = localStorage.getItem("admin_token");
    if (!token) {
        window.location.href = "login.html";
        return;
    }

    // Global secure fetch wrapper to handle authorization and token expiration globally
    async function adminFetch(url, options = {}) {
        options.headers = {
            ...options.headers,
            "Authorization": "Bearer " + token,
            "Content-Type": "application/json"
        };
        
        try {
            const response = await fetch(url, options);
            if (response.status === 401) {
                // Secret token expired or invalid, clear session and redirect
                localStorage.removeItem("admin_token");
                window.location.href = "login.html";
                return null;
            }
            return response;
        } catch (error) {
            console.error("Network Fetch Error:", error);
            throw error;
        }
    }

    // State Variables
    let currentMonday = getMonday(new Date());
    let timeSlots = [];
    let studentSubmissions = [];
    let activeAssignments = [];
    let unscheduledStudents = [];
    
    // Operating Days: Monday to Saturday (exclude Sunday)
    const daysOfWeek = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];

    // DOM Elements
    const tabButtons = document.querySelectorAll(".tab-btn");
    const tabContents = document.querySelectorAll(".tab-content");
    const toast = document.getElementById("toast");
    const btnLogout = document.getElementById("btn-logout");

    // Schedule Tab Elements
    const displayWeekTitle = document.getElementById("display-week-title");
    const btnPrevWeek = document.getElementById("btn-prev-week");
    const btnNextWeek = document.getElementById("btn-next-week");
    const weekPicker = document.getElementById("week-picker");
    const btnReloadSchedule = document.getElementById("btn-reload-schedule");
    const btnExportPng = document.getElementById("btn-export-png");
    const btnAutoSchedule = document.getElementById("btn-auto-schedule");
    const btnSaveSchedule = document.getElementById("btn-save-schedule");
    const scheduleBody = document.getElementById("schedule-body");
    const unscheduledPanel = document.getElementById("unscheduled-panel");
    const unscheduledList = document.getElementById("unscheduled-list");
    const scheduleSearch = document.getElementById("schedule-search");
    const scheduleClassFilter = document.getElementById("schedule-class-filter");

    // Submissions Tab Elements
    const submissionsList = document.getElementById("submissions-list");
    const submissionSearch = document.getElementById("submission-search");
    const submissionClassFilter = document.getElementById("submission-class-filter");
    const btnAddStudent = document.getElementById("btn-add-student");

    // Manual Schedule Modal Elements
    const manualScheduleModal = document.getElementById("manual-schedule-modal");
    const manualScheduleForm = document.getElementById("manual-schedule-form");
    const btnCloseManualModal = document.getElementById("btn-close-manual-modal");
    const btnCancelManualModal = document.getElementById("btn-cancel-manual-modal");
    const manualStudentSelect = document.getElementById("manual-student-select");
    const manualSlotDisplay = document.getElementById("manual-slot-display");
    const manualDayInput = document.getElementById("manual-day");
    const manualSlotIdInput = document.getElementById("manual-slot-id");

    // Notify Modal Elements
    const notifyModal = document.getElementById("notify-modal");
    const btnCloseNotifyModal = document.getElementById("btn-close-notify-modal");
    const btnCancelNotifyModal = document.getElementById("btn-cancel-notify-modal");
    const notifyStudentName = document.getElementById("notify-student-name");
    const notifyStudentDetails = document.getElementById("notify-student-details");
    const notifyPreviewText = document.getElementById("notify-preview-text");
    const btnNotifyZalo = document.getElementById("btn-notify-zalo");
    const btnNotifyCopy = document.getElementById("btn-notify-copy");

    // Admin Student CRUD Modal Elements
    const studentModal = document.getElementById("student-modal");
    const btnCloseStudentModal = document.getElementById("btn-close-student-modal");
    const btnCancelStudentModal = document.getElementById("btn-cancel-student-modal");
    const studentModalForm = document.getElementById("student-modal-form");
    const studentModalTitle = document.getElementById("student-modal-title");
    const admStdName = document.getElementById("adm-std-name");
    const admStdPhone = document.getElementById("adm-std-phone");
    const admStdEmail = document.getElementById("adm-std-email");
    const admStdNotes = document.getElementById("adm-std-notes");
    const admStdCompleted = document.getElementById("adm-std-completed");
    const admTableHeaders = document.getElementById("adm-table-headers");
    const admTableBody = document.getElementById("adm-table-body");
    
    // Active states
    let activeNotifyData = null;
    let isStudentModalEditMode = false;

    // --- Helper Functions ---
    
    function getMonday(d) {
        d = new Date(d);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(d.setDate(diff));
        monday.setHours(0, 0, 0, 0);
        return monday;
    }

    function formatDateForAPI(date) {
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, "0");
        const dd = String(date.getDate()).padStart(2, "0");
        return `${yyyy}-${mm}-${dd}`;
    }

    function formatDateDisplay(date) {
        const dd = String(date.getDate()).padStart(2, "0");
        const mm = String(date.getMonth() + 1).padStart(2, "0");
        const yyyy = date.getFullYear();
        return `Thứ Hai, ngày ${dd}/${mm}/${yyyy}`;
    }

    function getSlotName(slotId) {
        const found = timeSlots.find(s => s.id === slotId);
        return found ? found.name.split(" ")[0] : slotId;
    }

    const showToast = (message, type = "success") => {
        toast.textContent = message;
        toast.className = `toast show ${type}`;
        setTimeout(() => {
            toast.className = "toast";
        }, 3500);
    };

    // --- Logout Trigger ---
    btnLogout.addEventListener("click", (e) => {
        e.preventDefault();
        if (confirm("Bạn có chắc chắn muốn đăng xuất khỏi bảng điều khiển?")) {
            localStorage.removeItem("admin_token");
            window.location.href = "login.html";
        }
    });

    // --- Tab Navigation ---
    tabButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            tabButtons.forEach(b => b.classList.remove("active"));
            tabContents.forEach(c => c.classList.remove("active"));
            
            btn.classList.add("active");
            const tabId = `tab-${btn.dataset.tab}`;
            document.getElementById(tabId).classList.add("active");
            
            if (btn.dataset.tab === "schedule") {
                loadWeeklySchedule();
            } else if (btn.dataset.tab === "submissions") {
                loadSubmissions();
            }
        });
    });

    // --- Date Navigation Events ---
    function updateWeekDisplay() {
        displayWeekTitle.textContent = `Tuần từ: ${formatDateDisplay(currentMonday)}`;
        weekPicker.value = formatDateForAPI(currentMonday);
    }

    btnPrevWeek.addEventListener("click", () => {
        currentMonday.setDate(currentMonday.getDate() - 7);
        updateWeekDisplay();
        loadWeeklySchedule();
    });

    btnNextWeek.addEventListener("click", () => {
        currentMonday.setDate(currentMonday.getDate() + 7);
        updateWeekDisplay();
        loadWeeklySchedule();
    });

    weekPicker.addEventListener("change", (e) => {
        if (e.target.value) {
            currentMonday = getMonday(new Date(e.target.value));
            updateWeekDisplay();
            loadWeeklySchedule();
        }
    });

    // --- Initialize Data ---
    async function initAdmin() {
        // First verify auth
        const authRes = await adminFetch("/api/admin/verify-auth");
        if (!authRes || !authRes.ok) return; // Stop if redirecting
        
        updateWeekDisplay();
        try {
            const slotRes = await fetch("/api/time-slots");
            if (!slotRes.ok) throw new Error("Không thể tải cấu hình ca học.");
            timeSlots = await slotRes.json();
            
            // Build availability checkbox headers for admin CRUD student modal
            renderStudentModalGridHeaders();

            await loadSubmissions();
            await loadWeeklySchedule();
        } catch (error) {
            console.error(error);
            showToast(error.message, "error");
        }
    }

    // --- API Data Loaders ---
    
    async function loadSubmissions() {
        try {
            const res = await adminFetch("/api/admin/submissions");
            if (!res) return;
            if (!res.ok) throw new Error("Không thể tải danh sách học viên đăng ký.");
            studentSubmissions = await res.json();
            
            renderSubmissions();
            updateStatistics();
        } catch (error) {
            showToast(error.message, "error");
        }
    }

    async function loadWeeklySchedule() {
        const formattedDate = formatDateForAPI(currentMonday);
        try {
            const res = await adminFetch(`/api/admin/schedule?week_start_date=${formattedDate}`);
            if (!res) return;
            if (!res.ok) throw new Error("Không thể tải lịch học tuần này.");
            activeAssignments = await res.json();
            
            unscheduledPanel.style.display = "none";
            renderScheduleGrid();
            updateStatistics();
        } catch (error) {
            showToast(error.message, "error");
        }
    }

    // --- Statistics Computations ---
    
    function updateStatistics() {
        const activeSubmissions = studentSubmissions.filter(s => s.lessons_completed < 3);
        const totalStudents = activeSubmissions.length;
        document.getElementById("stat-total-students").textContent = totalStudents;

        const totalScheduled = activeAssignments.length;
        document.getElementById("stat-scheduled-lessons").textContent = totalScheduled;

        const maxCapacity = 24;
        const fillRate = maxCapacity > 0 ? Math.round((totalScheduled / maxCapacity) * 100) : 0;
        document.getElementById("stat-fill-rate").textContent = `${fillRate}%`;

        const scheduledStudentIds = new Set(activeAssignments.map(a => a.student_id));
        let unscheduledCount = 0;
        activeSubmissions.forEach(sub => {
            if (!scheduledStudentIds.has(sub.id)) {
                unscheduledCount++;
            }
        });
        document.getElementById("stat-unscheduled").textContent = unscheduledCount;

        // Ratios (All students)
        let countBsan = 0, countBtudong = 0, countC1 = 0;
        studentSubmissions.forEach(sub => {
            if (sub.license_type === "B số sàn") countBsan++;
            else if (sub.license_type === "B tự động") countBtudong++;
            else if (sub.license_type === "C1") countC1++;
        });

        const totalReg = studentSubmissions.length;
        const pctBsan = totalReg > 0 ? Math.round((countBsan / totalReg) * 100) : 0;
        const pctBtudong = totalReg > 0 ? Math.round((countBtudong / totalReg) * 100) : 0;
        const pctC1 = totalReg > 0 ? Math.round((countC1 / totalReg) * 100) : 0;

        document.getElementById("ratio-val-bsan").textContent = `${countBsan} học viên (${pctBsan}%)`;
        document.getElementById("ratio-val-btudong").textContent = `${countBtudong} học viên (${pctBtudong}%)`;
        document.getElementById("ratio-val-c1").textContent = `${countC1} học viên (${pctC1}%)`;

        document.getElementById("ratio-fill-bsan").style.width = `${pctBsan}%`;
        document.getElementById("ratio-fill-btudong").style.width = `${pctBtudong}%`;
        document.getElementById("ratio-fill-c1").style.width = `${pctC1}%`;
    }

    // --- Rendering Functions ---

    // 1. Render Submissions
    function renderSubmissions() {
        submissionsList.innerHTML = "";
        
        const searchQuery = submissionSearch.value.trim().toLowerCase();
        const classFilter = submissionClassFilter.value;
        
        const filteredSubs = studentSubmissions.filter(sub => {
            const matchesSearch = sub.name.toLowerCase().includes(searchQuery) || sub.phone.includes(searchQuery);
            const matchesClass = classFilter === "all" || sub.license_type === classFilter;
            return matchesSearch && matchesClass;
        });

        if (filteredSubs.length === 0) {
            submissionsList.innerHTML = `
                <div style="text-align: center; padding: 3rem; color: var(--text-muted);">
                    <i class="fa-regular fa-user-graduate" style="font-size: 3rem; margin-bottom: 1rem; display: block;"></i>
                    Không tìm thấy thông tin đăng ký phù hợp bộ lọc.
                </div>
            `;
            return;
        }

        filteredSubs.forEach(sub => {
            const item = document.createElement("div");
            item.className = "submission-item";
            
            const badgesHtml = sub.availability.map(avail => 
                `<span class="avail-badge">${avail.day_of_week} - ${getSlotName(avail.slot_id)}</span>`
            ).join("");
            
            const formattedDate = new Date(sub.created_at).toLocaleString("vi-VN");
            
            let tagClass = "bsan";
            if (sub.license_type === "B tự động") tagClass = "btudong";
            else if (sub.license_type === "C1") tagClass = "c1";

            const isCompleted = sub.lessons_completed >= 3;
            const completedBadgeHtml = isCompleted 
                ? `<span class="license-tag" style="background: rgba(16, 185, 129, 0.15); color: var(--success); border: 1px solid rgba(16, 185, 129, 0.3); font-weight: bold;"><i class="fa-solid fa-circle-check"></i> Đã học ${sub.lessons_completed} buổi (Hoàn thành)</span>` 
                : `<span class="license-tag" style="background: rgba(245, 158, 11, 0.15); color: var(--warning); border: 1px solid rgba(245, 158, 11, 0.3);">Đã học ${sub.lessons_completed} buổi</span>`;

            item.innerHTML = `
                <div class="submission-info" style="flex: 1;">
                    <div style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
                        <h4 style="font-size: 1.15rem;">${sub.name}</h4>
                        <span class="license-tag ${tagClass}">${sub.license_type}</span>
                        ${completedBadgeHtml}
                    </div>
                    <p style="margin-top: 0.5rem;"><i class="fa-solid fa-phone" style="width: 16px;"></i> Điện thoại: <strong>${sub.phone}</strong></p>
                    ${sub.email ? `<p><i class="fa-solid fa-envelope" style="width: 16px;"></i> Email: ${sub.email}</p>` : ''}
                    ${sub.notes ? `<p><i class="fa-regular fa-comment" style="width: 16px;"></i> Ghi chú: <i>${sub.notes}</i></p>` : ''}
                    <p style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.5rem;">Đăng ký lúc: ${formattedDate}</p>
                    
                    <div style="margin-top: 1rem;">
                        <span style="font-size: 0.85rem; font-weight: 600; color: #fff;">Lịch rảnh đăng ký (${sub.availability.length}):</span>
                        <div class="submission-avail">
                            ${badgesHtml || '<span style="color: var(--danger); font-size: 0.8rem;">Không chọn ca rảnh nào</span>'}
                        </div>
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <button class="btn btn-secondary btn-sm edit-sub-btn" data-id="${sub.id}">
                        <i class="fa-regular fa-pen-to-square"></i> Sửa
                    </button>
                    <button class="btn btn-danger btn-sm delete-sub-btn" data-id="${sub.id}">
                        <i class="fa-regular fa-trash-can"></i> Xoá
                    </button>
                </div>
            `;

            // Bind CRUD buttons
            item.querySelector(".edit-sub-btn").addEventListener("click", () => openStudentModal(sub));
            item.querySelector(".delete-sub-btn").addEventListener("click", () => deleteSubmission(sub.id));
            submissionsList.appendChild(item);
        });
    }

    async function deleteSubmission(id) {
        if (!confirm("Bạn có chắc chắn muốn xoá đăng ký của học viên này?")) return;
        
        try {
            const res = await adminFetch(`/api/admin/submissions/${id}`, {
                method: "DELETE"
            });
            if (!res) return;
            const data = await res.json();
            if (res.ok) {
                showToast(data.message);
                await loadSubmissions();
                await loadWeeklySchedule(); // Ensure grid and stats update instantly
            } else {
                throw new Error(data.detail || "Không thể xoá thông tin đăng ký.");
            }
        } catch (error) {
            showToast(error.message, "error");
        }
    }

    // 2. Render Schedule Grid Table
    function renderScheduleGrid() {
        scheduleBody.innerHTML = "";
        
        const searchQuery = scheduleSearch.value.trim().toLowerCase();
        const classFilter = scheduleClassFilter.value;

        timeSlots.forEach(slot => {
            const tr = document.createElement("tr");
            
            const tdHeader = document.createElement("td");
            tdHeader.innerHTML = `<strong style="color: #fff;">${slot.name}</strong><br><small style="color: var(--text-muted); font-size:0.8rem;">${slot.start_time} - ${slot.end_time}</small>`;
            tr.appendChild(tdHeader);

            daysOfWeek.forEach(day => {
                const td = document.createElement("td");
                const cellDiv = document.createElement("div");
                cellDiv.className = "schedule-cell";

                const cellAssignments = activeAssignments.filter(a => 
                    a.day_of_week === day && a.slot_id === slot.id
                );

                cellAssignments.forEach(assign => {
                    const matchesSearch = !searchQuery || assign.student_name.toLowerCase().includes(searchQuery) || assign.student_phone.includes(searchQuery);
                    const matchesClass = classFilter === "all" || assign.license_type === classFilter;
                    
                    const assignCard = document.createElement("div");
                    assignCard.className = "assignment-card";
                    
                    if (searchQuery && matchesSearch) {
                        assignCard.classList.add("highlighted");
                    }
                    
                    if (!matchesClass || (searchQuery && !matchesSearch)) {
                        assignCard.style.opacity = "0.2";
                    }

                    let tagClass = "bsan";
                    if (assign.license_type === "B tự động") tagClass = "btudong";
                    else if (assign.license_type === "C1") tagClass = "c1";

                    assignCard.innerHTML = `
                        <div class="student-name">${assign.student_name}</div>
                        <span class="license-tag ${tagClass}">${assign.license_type}</span>
                        <button class="remove-btn" title="Hủy ca học này">&times;</button>
                    `;

                    assignCard.querySelector(".remove-btn").addEventListener("click", (e) => {
                        e.stopPropagation();
                        activeAssignments = activeAssignments.filter(a => 
                            !(a.student_id === assign.student_id && a.day_of_week === day && a.slot_id === slot.id)
                        );
                        renderScheduleGrid();
                        updateStatistics();
                    });

                    assignCard.addEventListener("click", () => {
                        openNotifyModal(assign);
                    });

                    cellDiv.appendChild(assignCard);
                });

                if (cellAssignments.length < 2) {
                    const addBtn = document.createElement("button");
                    addBtn.className = "empty-cell-btn";
                    addBtn.innerHTML = `<i class="fa-solid fa-plus"></i> Xếp`;
                    addBtn.addEventListener("click", () => openManualScheduleModal(day, slot));
                    cellDiv.appendChild(addBtn);
                }

                td.appendChild(cellDiv);
                tr.appendChild(td);
            });

            scheduleBody.appendChild(tr);
        });
    }

    // --- Search & Filter Listeners ---
    scheduleSearch.addEventListener("input", renderScheduleGrid);
    scheduleClassFilter.addEventListener("change", renderScheduleGrid);
    
    submissionSearch.addEventListener("input", renderSubmissions);
    submissionClassFilter.addEventListener("change", renderSubmissions);

    // --- Auto Schedule Action ---
    btnAutoSchedule.addEventListener("click", async () => {
        const formattedDate = formatDateForAPI(currentMonday);
        
        btnAutoSchedule.disabled = true;
        btnAutoSchedule.innerHTML = `<i class="fa-solid fa-wand-magic-sparkles fa-spin"></i> Đang xếp...`;

        try {
            const res = await adminFetch(`/api/admin/schedule/auto?week_start_date=${formattedDate}`, {
                method: "POST"
            });
            if (!res) return;
            const data = await res.json();
            
            if (res.ok) {
                activeAssignments = data.assignments;
                unscheduledStudents = data.unscheduled;
                
                renderScheduleGrid();
                renderUnscheduledList();
                updateStatistics();
                
                if (unscheduledStudents.length > 0) {
                    showToast(`Tự động xếp thành công ${activeAssignments.length} ca. Chưa xếp được ${unscheduledStudents.length} học viên.`, "error");
                } else {
                    showToast(`Tự động xếp thành công tất cả học viên rảnh (${activeAssignments.length} ca)!`);
                }
            } else {
                throw new Error(data.detail || "Không thể xếp lịch tự động.");
            }
        } catch (error) {
            showToast(error.message, "error");
        } finally {
            btnAutoSchedule.disabled = false;
            btnAutoSchedule.innerHTML = `<i class="fa-solid fa-wand-magic-sparkles"></i> Tự động xếp lịch`;
        }
    });

    function renderUnscheduledList() {
        unscheduledList.innerHTML = "";
        
        if (unscheduledStudents.length === 0) {
            unscheduledPanel.style.display = "none";
            return;
        }

        unscheduledPanel.style.display = "block";
        unscheduledStudents.forEach(student => {
            const badge = document.createElement("span");
            badge.className = "avail-badge";
            badge.style.backgroundColor = "rgba(239, 68, 68, 0.15)";
            badge.style.color = "var(--danger)";
            badge.style.borderColor = "rgba(239, 68, 68, 0.3)";
            badge.style.cursor = "help";
            badge.title = student.reason;
            badge.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> ${student.student_name} (${student.student_phone}) - Hạng ${student.license_type}`;
            unscheduledList.appendChild(badge);
        });
    }

    // --- Save Schedule Action ---
    btnSaveSchedule.addEventListener("click", async () => {
        const formattedDate = formatDateForAPI(currentMonday);
        
        const payload = {
            week_start_date: formattedDate,
            assignments: activeAssignments.map(a => ({
                student_id: a.student_id,
                day_of_week: a.day_of_week,
                slot_id: a.slot_id
            }))
        };

        btnSaveSchedule.disabled = true;
        btnSaveSchedule.innerHTML = `<i class="fa-solid fa-floppy-disk fa-spin"></i> Đang lưu...`;

        try {
            const res = await adminFetch("/api/admin/schedule/save", {
                method: "POST",
                body: JSON.stringify(payload)
            });
            if (!res) return;
            const data = await res.json();
            
            if (res.ok) {
                showToast(data.message);
                loadWeeklySchedule();
            } else {
                throw new Error(data.detail || "Không thể lưu lịch học.");
            }
        } catch (error) {
            showToast(error.message, "error");
        } finally {
            btnSaveSchedule.disabled = false;
            btnSaveSchedule.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Lưu lịch tuần này`;
        }
    });

    btnReloadSchedule.addEventListener("click", () => {
        loadWeeklySchedule();
        showToast("Đã cập nhật lại lịch học từ máy chủ.");
    });

    // --- HTML2Canvas PNG Export ---
    btnExportPng.addEventListener("click", () => {
        const schedulePanel = document.getElementById("schedule-card-panel");
        
        btnExportPng.disabled = true;
        btnExportPng.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Đang xuất ảnh...`;

        const opt = {
            backgroundColor: "#0f172a",
            scale: 2,
            useCORS: true,
            logging: false
        };

        html2canvas(schedulePanel, opt).then(canvas => {
            const link = document.createElement("a");
            const weekStr = formatDateForAPI(currentMonday);
            link.download = `Lich_Hoc_Lai_Xe_SmartDrive_Tuan_${weekStr}.png`;
            link.href = canvas.toDataURL("image/png");
            link.click();
            
            showToast("Xuất ảnh lịch học thành công!");
            btnExportPng.disabled = false;
            btnExportPng.innerHTML = `<i class="fa-solid fa-image"></i> Xuất ảnh lịch học`;
        }).catch(err => {
            console.error(err);
            showToast("Đã xảy ra lỗi khi xuất ảnh lịch học.", "error");
            btnExportPng.disabled = false;
            btnExportPng.innerHTML = `<i class="fa-solid fa-image"></i> Xuất ảnh lịch học`;
        });
    });

    // --- Manual Schedule Modal Functions ---
    
    function openManualScheduleModal(day, slot) {
        manualDayInput.value = day;
        manualSlotIdInput.value = slot.id;
        manualSlotDisplay.textContent = `${day} - ${slot.name} (${slot.start_time} - ${slot.end_time})`;
        
        const cellAssignments = activeAssignments.filter(a => a.day_of_week === day && a.slot_id === slot.id);
        let existingLic = null;
        if (cellAssignments.length === 1) {
            existingLic = cellAssignments[0].license_type;
        }

        manualStudentSelect.innerHTML = '<option value="">-- Chọn học viên --</option>';
        
        const activeSubmissions = studentSubmissions.filter(s => s.lessons_completed < 3);

        activeSubmissions.forEach(sub => {
            const isFree = sub.availability.some(avail => 
                avail.day_of_week === day && avail.slot_id === slot.id
            );
            
            const isBusyOnDay = activeAssignments.some(a => a.student_id === sub.id && a.day_of_week === day);
            const currentLessons = activeAssignments.filter(a => a.student_id === sub.id).length;
            
            let isClassIncompatible = false;
            if (existingLic) {
                const groupA = ["B số sàn", "C1"];
                if (groupA.includes(existingLic)) {
                    isClassIncompatible = !groupA.includes(sub.license_type);
                } else if (existingLic === "B tự động") {
                    isClassIncompatible = sub.license_type !== "B tự động";
                }
            }

            const statusLabel = isFree ? " (Rảnh)" : " (Bận/Không đăng ký)";
            const lessonsLabel = ` [Đã xếp ${currentLessons}/1 ca]`;
            const busyDayLabel = isBusyOnDay ? " *ĐÃ CÓ LỊCH NGÀY NÀY*" : "";
            const incompatibleLabel = isClassIncompatible ? ` (Không tương thích hạng ${existingLic})` : "";
            
            const option = document.createElement("option");
            option.value = sub.id;
            option.dataset.name = sub.name;
            option.dataset.phone = sub.phone;
            option.dataset.license = sub.license_type;
            option.textContent = `${sub.name} - ${sub.phone} - Hạng ${sub.license_type}${statusLabel}${lessonsLabel}${busyDayLabel}${incompatibleLabel}`;
            
            if (isClassIncompatible || isBusyOnDay) {
                option.disabled = true;
                option.style.color = "rgba(255, 255, 255, 0.2)";
            } else if (isFree) {
                option.style.color = "var(--success)";
                option.style.fontWeight = "bold";
            }
            
            manualStudentSelect.appendChild(option);
        });

        manualScheduleModal.classList.add("active");
    }

    function closeManualModal() {
        manualScheduleModal.classList.remove("active");
        manualScheduleForm.reset();
    }

    btnCancelManualModal.addEventListener("click", closeManualModal);
    btnCloseManualModal.addEventListener("click", closeManualModal);

    manualScheduleForm.addEventListener("submit", (e) => {
        e.preventDefault();
        
        const studentId = parseInt(manualStudentSelect.value);
        const day = manualDayInput.value;
        const slotId = manualSlotIdInput.value;
        const studentOpt = manualStudentSelect.options[manualStudentSelect.selectedIndex];

        const isStudentBusyOnDay = activeAssignments.some(a => 
            a.student_id === studentId && a.day_of_week === day
        );
        
        if (isStudentBusyOnDay) {
            showToast("Học viên này đã có ca học khác trong ngày hôm nay rồi!", "error");
            return;
        }

        activeAssignments.push({
            student_id: studentId,
            student_name: studentOpt.dataset.name,
            student_phone: studentOpt.dataset.phone,
            license_type: studentOpt.dataset.license,
            day_of_week: day,
            slot_id: slotId
        });

        renderScheduleGrid();
        updateStatistics();
        closeManualModal();
        showToast("Đã xếp lịch học thủ công thành công. Nhớ nhấn 'Lưu lịch' để xác nhận.");
    });

    // --- Quick Notify (Zalo / Copy) Modal ---
    
    function openNotifyModal(assign) {
        activeNotifyData = assign;
        
        notifyStudentName.textContent = assign.student_name;
        notifyStudentDetails.textContent = `Hạng xe: ${assign.license_type} | Số ĐT: ${assign.student_phone}`;
        
        const studentLessons = activeAssignments.filter(a => a.student_id === assign.student_id);
        studentLessons.sort((a, b) => {
            const daysOrder = {"Thứ 2": 1, "Thứ 3": 2, "Thứ 4": 3, "Thứ 5": 4, "Thứ 6": 5, "Thứ 7": 6};
            const slotsOrder = {"ca_sang": 1, "ca_chieu": 2};
            
            const dayA = daysOrder[a.day_of_week] || 7;
            const dayB = daysOrder[b.day_of_week] || 7;
            if (dayA !== dayB) return dayA - dayB;
            
            return (slotsOrder[a.slot_id] || 3) - (slotsOrder[b.slot_id] || 3);
        });

        let scheduleLines = "";
        studentLessons.forEach(l => {
            const timeRange = l.slot_id === "ca_sang" ? "08:30 - 11:30" : "14:00 - 17:00";
            const slotName = l.slot_id === "ca_sang" ? "Ca sáng" : "Ca chiều";
            scheduleLines += `- ${l.day_of_week} - ${slotName} (${timeRange})\n`;
        });

        const weekStr = formatDateForAPI(currentMonday);
        const msgText = `Chào bạn ${assign.student_name},
SmartDrive thông báo lịch học lái xe hạng ${assign.license_type} tuần tới (bắt đầu từ ${weekStr}) của bạn được xếp như sau:
${scheduleLines}
Bạn vui lòng phản hồi lại tin nhắn này để xác nhận lịch học nhé. Cảm ơn bạn!`;

        notifyPreviewText.textContent = msgText;
        notifyModal.classList.add("active");
    }

    function closeNotifyModal() {
        notifyModal.classList.remove("active");
        activeNotifyData = null;
    }

    btnCancelNotifyModal.addEventListener("click", closeNotifyModal);
    btnCloseNotifyModal.addEventListener("click", closeNotifyModal);

    btnNotifyZalo.addEventListener("click", () => {
        if (activeNotifyData) {
            const phone = activeNotifyData.student_phone;
            const cleanPhone = phone.replace(/[^0-9]/g, "");
            window.open(`https://zalo.me/${cleanPhone}`, "_blank");
        }
    });

    btnNotifyCopy.addEventListener("click", () => {
        const textToCopy = notifyPreviewText.textContent;
        navigator.clipboard.writeText(textToCopy).then(() => {
            showToast("Đã sao chép tin nhắn thông báo mẫu vào clipboard!");
        }).catch(err => {
            console.error("Lỗi khi sao chép:", err);
            showToast("Không thể sao chép tự động. Hãy bôi đen văn bản để copy.", "error");
        });
    });

    // --- Admin Student CRUD Modal Functions ---
    
    function renderStudentModalGridHeaders() {
        admTableHeaders.innerHTML = "<th>Ngày</th>";
        timeSlots.forEach(slot => {
            const th = document.createElement("th");
            th.innerHTML = `${slot.name.split(" ")[0]}<br><small style="font-weight: normal; font-size: 0.75rem;">${slot.start_time}-${slot.end_time}</small>`;
            admTableHeaders.appendChild(th);
        });
    }

    function renderStudentModalGrid(availabilityList = []) {
        admTableBody.innerHTML = "";
        
        daysOfWeek.forEach(day => {
            const tr = document.createElement("tr");
            
            const tdDay = document.createElement("td");
            tdDay.textContent = day;
            tdDay.style.fontWeight = "600";
            tr.appendChild(tdDay);
            
            timeSlots.forEach(slot => {
                const td = document.createElement("td");
                const checkboxId = `adm_chk_${day.replace(/\s+/g, '')}_${slot.id}`;
                
                // Check if this slot was selected
                const isChecked = availabilityList.some(a => a.day_of_week === day && a.slot_id === slot.id);
                
                const checkbox = document.createElement("input");
                checkbox.type = "checkbox";
                checkbox.id = checkboxId;
                checkbox.className = "cell-checkbox adm-cell-checkbox";
                checkbox.dataset.day = day;
                checkbox.dataset.slotId = slot.id;
                checkbox.checked = isChecked;
                
                const label = document.createElement("label");
                label.htmlFor = checkboxId;
                label.className = "cell-label";
                label.style.padding = "0.4rem 0.25rem";
                label.style.fontSize = "0.8rem";
                label.innerHTML = isChecked 
                    ? `<i class="fa-solid fa-square-check" style="margin-right: 0.2rem;"></i> Chọn`
                    : `<i class="fa-regular fa-square" style="margin-right: 0.2rem;"></i> Rảnh`;
                
                checkbox.addEventListener("change", () => {
                    if (checkbox.checked) {
                        label.innerHTML = `<i class="fa-solid fa-square-check" style="margin-right: 0.2rem;"></i> Chọn`;
                    } else {
                        label.innerHTML = `<i class="fa-regular fa-square" style="margin-right: 0.2rem;"></i> Rảnh`;
                    }
                });

                td.appendChild(checkbox);
                td.appendChild(label);
                tr.appendChild(td);
            });
            
            admTableBody.appendChild(tr);
        });
    }

    function openStudentModal(sub = null) {
        if (sub) {
            // Edit mode
            isStudentModalEditMode = true;
            studentModalTitle.textContent = "Chỉnh sửa thông tin học viên";
            
            admStdName.value = sub.name;
            admStdPhone.value = sub.phone;
            admStdPhone.readOnly = true; // Lock phone to avoid unique key breaks
            admStdEmail.value = sub.email || "";
            admStdNotes.value = sub.notes || "";
            admStdCompleted.value = sub.lessons_completed;
            
            // Check radio button
            const radio = document.querySelector(`input[name="adm_license_type"][value="${sub.license_type}"]`);
            if (radio) radio.checked = true;

            // Load student availabilities checkboxes
            renderStudentModalGrid(sub.availability);
        } else {
            // Add mode
            isStudentModalEditMode = false;
            studentModalTitle.textContent = "Thêm học viên mới";
            
            studentModalForm.reset();
            admStdPhone.readOnly = false;
            admStdCompleted.value = "0";
            document.getElementById("adm_lic_bsan").checked = true;

            // Load empty grid checkboxes
            renderStudentModalGrid([]);
        }
        studentModal.classList.add("active");
    }

    function closeStudentModal() {
        studentModal.classList.remove("active");
        studentModalForm.reset();
    }

    btnAddStudent.addEventListener("click", () => openStudentModal(null));
    btnCancelStudentModal.addEventListener("click", closeStudentModal);
    btnCloseStudentModal.addEventListener("click", closeStudentModal);

    // Submit Add/Edit Student Form
    studentModalForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        const name = admStdName.value.trim();
        const phone = admStdPhone.value.trim();
        const email = admStdEmail.value.trim() || null;
        const notes = admStdNotes.value.trim() || null;
        const licenseType = document.querySelector('input[name="adm_license_type"]:checked').value;
        const lessonsCompleted = parseInt(admStdCompleted.value);
        
        // Collect checked checkboxes
        const availability = [];
        const checkboxes = document.querySelectorAll(".adm-cell-checkbox:checked");
        
        checkboxes.forEach(cb => {
            availability.push({
                day_of_week: cb.dataset.day,
                slot_id: cb.dataset.slotId
            });
        });
        
        // Validation: availability is required if lessons completed < 3
        if (lessonsCompleted < 3 && availability.length === 0) {
            showToast("Vui lòng tích chọn ít nhất 1 ca rảnh cho học viên!", "error");
            return;
        }

        const payload = {
            name,
            phone,
            email,
            license_type: licenseType,
            lessons_completed: lessonsCompleted,
            notes,
            availability
        };

        try {
            const res = await adminFetch("/api/admin/students", {
                method: "POST",
                body: JSON.stringify(payload)
            });
            if (!res) return;
            const data = await res.json();
            
            if (res.ok) {
                showToast(data.message);
                closeStudentModal();
                // Reload both views to synchronize schedules and lists
                await loadSubmissions();
                await loadWeeklySchedule();
            } else {
                throw new Error(data.detail || "Đã xảy ra lỗi khi lưu thông tin học viên.");
            }
        } catch (error) {
            showToast(error.message, "error");
        }
    });

    initAdmin();
});
