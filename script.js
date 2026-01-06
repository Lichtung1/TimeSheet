// --- CONFIGURATION ---
let entries = [];
let projects = [];
const tokenKey = 'gh_token';
const gistKey = 'gh_gist_id';

// --- TIMER VARS ---
let timerInterval, startTime;
let isRunning = false;

// --- INIT ---
document.getElementById('date').valueAsDate = new Date();
const savedToken = localStorage.getItem(tokenKey);
const savedGistId = localStorage.getItem(gistKey);

if (savedToken && savedGistId) {
    document.getElementById('gh-token').value = savedToken;
    document.getElementById('gh-gist-id').value = savedGistId;
    fetchData(); 
} else {
    toggleConfig();
}

// --- PROJECT MANAGER LOGIC ---

function toggleProjects() {
    document.getElementById('project-panel').classList.toggle('hidden');
}

function renderProjectSelect() {
    const select = document.getElementById('project');
    const listDisplay = document.getElementById('project-list-display');
    const currentVal = select.value;

    select.innerHTML = '';
    listDisplay.innerHTML = '';

    // 1. Add Default "ALL" Option
    const allOpt = document.createElement('option');
    allOpt.value = "ALL";
    allOpt.innerText = "[ ALL PROJECTS ]";
    select.appendChild(allOpt);

    projects.forEach(p => {
        // Dropdown
        const option = document.createElement('option');
        option.value = p;
        option.innerText = p;
        select.appendChild(option);

        // Manager List
        const li = document.createElement('li');
        li.innerHTML = `<span>${p}</span> <button class="btn-del" onclick="removeProject('${p}')">X</button>`;
        listDisplay.appendChild(li);
    });

    // Attempt to restore selection
    if(projects.includes(currentVal) || currentVal === "ALL") {
        select.value = currentVal;
    } else {
        select.value = "ALL";
    }
}

async function addProject() {
    const input = document.getElementById('new-project-name');
    const name = input.value.trim();
    if(name && !projects.includes(name)) {
        projects.push(name);
        input.value = '';
        renderProjectSelect();
        await saveData();
    }
}

async function removeProject(name) {
    if(confirm(`Remove "${name}"? Logs stay.`)) {
        projects = projects.filter(p => p !== name);
        renderProjectSelect();
        await saveData();
    }
}

// --- EXPORT CSV LOGIC (NEW) ---
function exportCSV() {
    // 1. Get currently visible entries (filtered)
    // We re-use logic from renderTable, basically.
    const filter = document.getElementById('project').value;
    let dataToExport = entries;

    if (filter !== "ALL") {
        dataToExport = entries.filter(e => e.project === filter);
    }

    if(dataToExport.length === 0) {
        alert("No data to export!");
        return;
    }

    // 2. Build CSV Content
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Date,Project,Hours,Notes\n"; // Header

    dataToExport.forEach(e => {
        // Sanitize notes: remove commas and newlines so they don't break CSV format
        const cleanNotes = (e.notes || "").replace(/,/g, " ").replace(/\n/g, " ");
        csvContent += `${e.date},${e.project},${e.hours},${cleanNotes}\n`;
    });

    // 3. Trigger Download
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const filename = filter === "ALL" ? "timesheet_full.csv" : `timesheet_${filter.replace(/\s/g,'_')}.csv`;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}


// --- CORE FUNCTIONS ---

async function fetchData() {
    const token = localStorage.getItem(tokenKey);
    const gistId = localStorage.getItem(gistKey);
    const tbody = document.getElementById('log-body');

    try {
        const res = await fetch(`https://api.github.com/gists/${gistId}`, {
            headers: { 'Authorization': `token ${token}` }
        });
        const data = await res.json();
        
        const logContent = data.files['data.json'] ? data.files['data.json'].content : "[]";
        entries = JSON.parse(logContent || "[]");

        if(data.files['projects.json']) {
            projects = JSON.parse(data.files['projects.json'].content);
        } else {
            const unique = new Set(entries.map(e => e.project));
            if(unique.size === 0) unique.add("Main Job");
            projects = Array.from(unique);
        }

        renderProjectSelect(); // Fill dropdown
        renderTable();         // Fill table (respects "ALL" default)

    } catch (err) {
        console.error(err);
        tbody.innerHTML = '<tr><td colspan="5" style="color:#ff3333">CONNECTION FAILED</td></tr>';
    }
}

async function saveData() {
    const token = localStorage.getItem(tokenKey);
    const gistId = localStorage.getItem(gistKey);
    
    const body = {
        files: { 
            "data.json": { content: JSON.stringify(entries, null, 2) },
            "projects.json": { content: JSON.stringify(projects, null, 2) }
        }
    };

    try {
        await fetch(`https://api.github.com/gists/${gistId}`, {
            method: 'PATCH',
            headers: { 
                'Authorization': `token ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });
        console.log("Synced.");
    } catch (err) {
        alert("Sync error.");
    }
}

async function addEntry() {
    const date = document.getElementById('date').value;
    const projectSelect = document.getElementById('project');
    const project = projectSelect.value;
    const hours = parseFloat(document.getElementById('hours').value);
    const notes = document.getElementById('notes').value;

    if(project === "ALL") {
        alert("Please select a specific Project to log time.");
        return;
    }

    if (!date || !hours) return;
    
    // We add to local state immediately for speed
    const entry = { id: Date.now(), date, project, hours, notes };
    entries.unshift(entry);
    
    // Render immediately (so you see it)
    renderTable(); 
    
    // Then sync to cloud
    await saveData();
    
    document.getElementById('hours').value = '';
    document.getElementById('notes').value = '';
    document.getElementById('timer-display').innerText = "00:00:00";
}

async function deleteEntry(id) {
    if(confirm("Delete entry?")) {
        entries = entries.filter(e => e.id !== id);
        renderTable();
        await saveData();
    }
}

function renderTable() {
    const tbody = document.getElementById('log-body');
    const totalEl = document.getElementById('total-hours');
    const filter = document.getElementById('project').value; // Get Current Dropdown Selection
    
    tbody.innerHTML = '';
    let total = 0;

    // FILTER LOGIC
    const visibleEntries = filter === "ALL" 
        ? entries 
        : entries.filter(e => e.project === filter);

    visibleEntries.forEach(entry => {
        total += entry.hours;
        const row = `<tr><td>${entry.date}</td><td>${entry.project}</td><td>${entry.hours.toFixed(2)}</td><td>${entry.notes}</td><td><button class="btn-del" onclick="deleteEntry(${entry.id})">x</button></td></tr>`;
        tbody.innerHTML += row;
    });

    totalEl.innerText = total.toFixed(2);
}

// --- TIMER Logic (Unchanged) ---
function toggleTimer() {
    const btn = document.getElementById('btn-timer');
    const display = document.getElementById('timer-display');
    if (!isRunning) {
        isRunning = true;
        startTime = Date.now();
        btn.innerText = "STOP_SEQUENCE";
        btn.classList.add('active');
        timerInterval = setInterval(() => {
            display.innerText = formatTime(Date.now() - startTime);
        }, 1000);
    } else {
        isRunning = false;
        clearInterval(timerInterval);
        btn.innerText = "INIT_SEQUENCE";
        btn.classList.remove('active');
        const elapsed = Date.now() - startTime;
        let finalHours = (elapsed / 3600000).toFixed(2);
        if (finalHours === "0.00" && elapsed > 0) finalHours = "0.01";
        document.getElementById('hours').value = finalHours;
    }
}
function formatTime(ms) {
    const s = Math.floor(ms / 1000);
    return new Date(s * 1000).toISOString().substr(11, 8);
}
function toggleConfig() { document.getElementById('config-panel').classList.toggle('hidden'); }
function saveConfig() {
    const token = document.getElementById('gh-token').value;
    const gistId = document.getElementById('gh-gist-id').value;
    if(token && gistId) {
        localStorage.setItem(tokenKey, token);
        localStorage.setItem(gistKey, gistId);
        toggleConfig();
        fetchData();
    }
}
