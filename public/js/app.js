document.addEventListener('DOMContentLoaded', function() {
    checkAuthStatus();
    loadRoundStatus();
    setupAdminButtons();
});

let accessToken = null;

async function getAccessToken() {
    if (accessToken) return accessToken;
    
    try {
        const response = await fetch('/api/access-token');
        const data = await response.json();
        accessToken = data.access_token;
        return accessToken;
    } catch (error) {
        return null;
    }
}

function setupAdminButtons() {
    document.getElementById('new-round-btn').addEventListener('click', async () => {
        try {
            const response = await fetch('/api/round/status');
            const data = await response.json();
            
            if (data.isActive) {
                showAdminMessage('Kolo je već aktivno!', 'error');
                return;
            }
            
            await adminAction('/api/new-round', 'Kolo je aktivirano!');
        } catch (error) {
            showAdminMessage('Greška pri provjeri statusa kola: ' + error.message, 'error');
        }
    });
    
    document.getElementById('close-round-btn').addEventListener('click', async () => {
        try {
            const response = await fetch('/api/round/status');
            const data = await response.json();
            
            if (!data.isActive) {
                showAdminMessage('Kolo je već zatvoreno!', 'error');
                return;
            }
            
            await adminAction('/api/close', 'Kolo je zatvoreno!');
        } catch (error) {
            showAdminMessage('Greška pri provjeri statusa kola: ' + error.message, 'error');
        }
    });
    
    document.getElementById('show-results-form-btn').addEventListener('click', async () => {
        try {
            const response = await fetch('/api/round/status');
            const data = await response.json();
            
            if (data.isActive) {
                showAdminMessage('Greška: Kolo je još uvijek aktivno. Prvo zatvorite kolo prije spremanja rezultata.', 'error');
                return;
            }
            
            if (!data.hasRound) {
                showAdminMessage('Greška: Nema aktivnog kola za spremanje rezultata.', 'error');
                return;
            }
            
            if (data.drawnNumbers && data.drawnNumbers.length > 0) {
                showAdminMessage('Greška: Brojevi su već izvučeni za ovo kolo.', 'error');
                return;
            }
            
            document.getElementById('results-form').style.display = 'block';
        } catch (error) {
            showAdminMessage('Greška pri provjeri statusa kola: ' + error.message, 'error');
        }
    });
    
    document.getElementById('cancel-results-btn').addEventListener('click', () => {
        document.getElementById('results-form').style.display = 'none';
        document.getElementById('store-results-form').reset();
    });
    
    document.getElementById('store-results-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const numbersInput = formData.get('numbers');
        const numberArray = numbersInput.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n));
        
        await adminAction('/api/store-results', 'Rezultati su spremljeni!', { numbers: numberArray });
        document.getElementById('results-form').style.display = 'none';
        e.target.reset();
    });
}

async function adminAction(endpoint, successMessage, data = null) {
    const token = await getAccessToken();
    if (!token) {
        showAdminMessage('Greška: Nije moguće dobiti access token', 'error');
        return;
    }
    
    try {
        const options = {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        };
        
        if (data) {
            options.body = JSON.stringify(data);
        }
        
        const response = await fetch(endpoint, options);
        
        if (response.status === 204) {
            showAdminMessage(successMessage, 'success');
            loadRoundStatus();
        } else {
            const errorText = await response.text();
            let errorMessage = 'Greška pri izvršavanju operacije';
            
            try {
                const errorData = JSON.parse(errorText);
                if (errorData.error) {
                    errorMessage = errorData.error;
                }
            } catch (e) {
                errorMessage = errorText || `HTTP ${response.status}`;
            }
            
            showAdminMessage(errorMessage, 'error');
        }
    } catch (error) {
        showAdminMessage('Greška pri komunikaciji sa serverom', 'error');
    }
}

function showAdminMessage(message, type) {
    const messageDiv = document.getElementById('admin-message');
    messageDiv.textContent = message;
    messageDiv.style.display = 'block';
    messageDiv.style.borderColor = type === 'success' ? '#000' : '#000';
    
    setTimeout(() => {
        messageDiv.style.display = 'none';
    }, 3000);
}

async function checkAuthStatus() {
    try {
        const response = await fetch('/auth/user');
        const data = await response.json();
        
        const loginSection = document.getElementById('login-section');
        const userSection = document.getElementById('user-section');
        const userName = document.getElementById('user-name');
        
        if (data.authenticated) {
            loginSection.style.display = 'none';
            userSection.style.display = 'flex';
            userName.textContent = data.user.name;
        } else {
            loginSection.style.display = 'block';
            userSection.style.display = 'none';
        }
    } catch (error) {
    }
}

async function loadRoundStatus() {
    try {
        const response = await fetch('/api/round/status');
        const data = await response.json();
        
        const roundStatus = document.getElementById('round-status');
        const ticketSection = document.getElementById('ticket-section');
        const resultsSection = document.getElementById('results-section');
        const drawnNumbers = document.getElementById('drawn-numbers');
        
        if (!data.hasRound) {
            roundStatus.innerHTML = '<p>Nema aktivnih kola</p>';
            ticketSection.style.display = 'none';
            resultsSection.style.display = 'none';
            return;
        }
        
        if (data.isActive) {
            roundStatus.innerHTML = `
                <p class="status-active">Kolo je aktivno</p>
                <p>Broj uplaćenih listića: <strong>${data.ticketCount}</strong></p>
            `;
            ticketSection.style.display = 'block';
            resultsSection.style.display = 'none';
        } else {
            roundStatus.innerHTML = `
                <p class="status-inactive">Kolo je zatvoreno</p>
                <p>Broj uplaćenih listića: <strong>${data.ticketCount}</strong></p>
            `;
            ticketSection.style.display = 'none';
        }
        
        if (data.drawnNumbers && data.drawnNumbers.length > 0) {
            resultsSection.style.display = 'block';
            drawnNumbers.innerHTML = `
                <h3>IZVUČENI BROJEVI:</h3>
                <div class="number-grid">
                    ${data.drawnNumbers.map(num => `<span class="number drawn">${num}</span>`).join('')}
                </div>
            `;
        } else {
            resultsSection.style.display = 'none';
        }
    } catch (error) {
        const roundStatus = document.getElementById('round-status');
        roundStatus.innerHTML = '<p>Greška pri učitavanju statusa kola</p>';
    }
}