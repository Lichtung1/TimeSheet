let entries = [];
const tokenKey = 'gh_token';
const gistKey = 'gh_gist_id';

// Load credentials on startup
const savedToken = localStorage.getItem(tokenKey);
const savedGistId = localStorage.getItem(gistKey);

document.getElementById('date').valueAsDate = new Date();

if (savedToken && savedGistId) {
    document.getElementById('gh-token').value = savedToken;
    document.getElementById('gh-gist-id').value = savedGistId;
    fetchData(); // Auto-load if creds exist
} else {
    document.getElementById('config-panel').classList.remove('hidden');
    document.getElementById('log-body').innerHTML = '<tr><td colspan="5">Please configure GitHub keys.</td></tr>';
}

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
        fetchData(); // Load data immediately
    }
}

// 1. GET Data from GitHub
async function fetchData() {
    const token = localStorage.getItem(tokenKey);
    const gistId = localStorage.getItem(gistKey);

    try {
        const res = await fetch(`https://api.github.com/gists/${gistId}`, {
            headers: { 'Authorization': `token ${token}` }
        });
        const data = await res.json();
        const content = data.files['data.json'].content;
        entries = JSON.parse(content);
        renderTable();
    } catch (err) {
        console.error(err);
        alert("Error fetching Gist. Check Console/Keys.");
    }
}

// 2. PUSH Data to GitHub
async function saveData() {
    const token = localStorage.getItem(tokenKey);
    const gistId = localStorage.getItem(gistKey);
    
    // We fetch first to ensure we don't overwrite remote changes from another PC
    // (A primitive sync)
    await fetchData(); 

    // Add new entry locally *after* fetching latest state is complex without
    // passing the new entry around. simplified logic:
    // In this specific function, we assume 'entries' is updated in memory
    // But for safety, the addEntry function handles the flow.

    const body = {
        files: {
            "data.json": {
                content: JSON.stringify(entries, null, 2)
            }
        }
    };

    try {
        const res = await fetch(`https://api.github.com/gists/${gistId}`, {
            method: 'PATCH',
            headers: { 
                'Authorization': `token ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });
        
        if(res.ok) {
            console.log("Synced to GitHub");
        } else {
            alert("Sync failed.");
        }
    } catch (err) {
        alert("Network error.");
    }
}

// Wrapper to Fetch -> Append -> Save
async function addEntry() {
    const date = document.getElementById('date').value;
    const project = document.getElementById('project').value;
    const hours = parseFloat(document.getElementById('hours').value);
    const notes = document.getElementById('notes').value;

    if (!date || !hours) return;

    // 1. Get latest version from cloud to avoid conflicts
    await fetchData();

    // 2. Add new item
    const entry = { id: Date.now(), date, project, hours, notes };
    entries.unshift(entry); // Add to top

    // 3. Render immediately for UI snap
    renderTable();
    
    // 4. Save to Cloud
    await saveData();

    // Clear UI
    document.getElementById('hours').value = '';
    document.getElementById('notes').value = '';
}

async function deleteEntry(id) {
    if(confirm("Delete?")) {
        await fetchData(); // Sync first
        entries = entries.filter(e => e.id !== id);
        renderTable();
        await saveData();
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
                <td><button class="btn-del" onclick="deleteEntry(${entry.id})">X</button></td>
            </tr>
        `;
        tbody.innerHTML += row;
    });
    totalEl.innerText = total.toFixed(2);
}
