// --- CONFIGURATION ---
let entries = [];
const tokenKey = 'gh_token';
const gistKey = 'gh_gist_id';

// --- TIMER VARIABLES ---
let timerInterval;
let startTime;
let isRunning = false;

// --- INITIALIZATION ---
document.getElementById('date').valueAsDate = new Date();
const savedToken = localStorage.getItem(tokenKey);
const savedGistId = localStorage.getItem(gistKey);

if (savedToken && savedGistId) {
    document.getElementById('gh-token').value = savedToken;
    document.getElementById('gh-gist-id').value = savedGistId;
    fetchData(); // Load data on startup
} else {
    toggleConfig();
}

// --- TIMER LOGIC ---
function toggleTimer() {
    const btn = document.getElementById('btn-timer');
    const display = document.getElementById('timer-display');

    if (!isRunning) {
        // START
        isRunning = true;
        startTime = Date.now();
        btn.innerText = "STOP_SEQUENCE";
        btn.classList.add('active');
        
        timerInterval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            display.innerText = formatTime(elapsed);
        }, 1000);

    } else {
        // STOP
        isRunning = false;
        clearInterval(timerInterval);
        btn.innerText = "INIT_SEQUENCE";
        btn.classList.remove('active');

        // Calculate Hours
        const elapsed = Date.now() - startTime;
        const hoursDecimal = (elapsed / 3600000); // ms to hours
        
        // Populate Input (ensure at least 0.01 if extremely short test)
        let finalHours = hoursDecimal.toFixed(2);
        if (finalHours === "0.00" && elapsed > 0) finalHours = "0.01";
        
        document.getElementById('hours').value = finalHours;
        document.getElementById('notes').focus(); 
    }
}

function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const h = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
    const s = (totalSeconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
}

// --- GIST SYNC LOGIC ---

function toggleConfig() {
    document.getElementById('config-panel').classList.toggle('hidden');
}

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

// 1. GET (Read from GitHub)
async function fetchData() {
    const token = localStorage.getItem(tokenKey);
    const gistId = localStorage.getItem(gistKey);
    const tbody = document.getElementById('log-body');

    try {
        const res = await fetch(`https://api.github.com/gists/${gistId}`, {
            headers: { 'Authorization': `token ${token}` }
        });
        const data = await res.json();
        // If file is empty or new, default to []
        const content = data.files['data.json'] ? data.files['data.json'].content : "[]";
        entries = JSON.parse(content || "[]");
        renderTable();
    } catch (err) {
        console.error(err);
        tbody.innerHTML = '<tr><td colspan="5" style="color:#ff3333">CONNECTION FAILED</td></tr>';
    }
}

// 2. PUT (Write to GitHub)
async function saveData() {
    const token = localStorage.getItem(tokenKey);
    const gistId = localStorage.getItem(gistKey);
    
    // NOTE: We do NOT fetch here anymore. We trust 'entries' is correct.
    
    const body = {
        files: { "data.json": { content: JSON.stringify(entries, null, 2) } }
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
        console.log("Saved to GitHub");
    } catch (err) {
        alert("Sync error. Check console.");
    }
}

async function addEntry() {
    const date = document.getElementById('date').value;
    const project = document.getElementById('project').value;
    const hours = parseFloat(document.getElementById('hours').value);
    const notes = document.getElementById('notes').value;
    const btn = document.querySelector('.btn-primary'); // The button you clicked

    if (!date || !hours) return;

    btn.innerText = "UPLOADING...";
    
    // 1. Get latest from cloud first (to avoid overwriting other computer's work)
    await fetchData(); 

    // 2. Add our new item to the fresh list
    const entry = { id: Date.now(), date, project, hours, notes };
    entries.unshift(entry);
    
    // 3. Show it immediately
    renderTable();
    
    // 4. Save the updated list
    await saveData();

    btn.innerText = "COMMIT_ENTRY";
    
    // Reset UI
    document.getElementById('hours').value = '';
    document.getElementById('notes').value = '';
    document.getElementById('timer-display').innerText = "00:00:00";
}

async function deleteEntry(id) {
    if(confirm("Delete entry?")) {
        await fetchData(); // Sync first
        entries = entries.filter(e => e.id !== id); // Remove item
        renderTable();
        await saveData(); // Save changes
    }
}

function renderTable() {
    const tbody = document.getElementById('log-body');
    const totalEl = document.getElementById('total-hours');
    tbody.innerHTML = '';
    let total = 0;

    entries.forEach(entry => {
        total += entry.hours;
        const row = `
            <tr>
                <td>${entry.date}</td>
                <td>${entry.project}</td>
                <td>${entry.hours.toFixed(2)}</td>
                <td>${entry.notes}</td>
                <td><button class="btn-del" onclick="deleteEntry(${entry.id})">x</button></td>
            </tr>
        `;
        tbody.innerHTML += row;
    });
    totalEl.innerText = total.toFixed(2);
}
