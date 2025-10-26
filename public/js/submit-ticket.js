document.addEventListener('DOMContentLoaded', function() {
    checkAuthStatus();
    setupForm();
});

async function checkAuthStatus() {
    try {
        const response = await fetch('/auth/user');
        const data = await response.json();
        
        const loginSection = document.getElementById('login-section');
        const userSection = document.getElementById('user-section');
        const userName = document.getElementById('user-name');
        const authRequired = document.getElementById('auth-required');
        const ticketFormSection = document.getElementById('ticket-form-section');
        
        if (data.authenticated) {
            loginSection.style.display = 'none';
            userSection.style.display = 'flex';
            userName.textContent = data.user.name;
            authRequired.style.display = 'none';
            ticketFormSection.style.display = 'block';
        } else {
            loginSection.style.display = 'block';
            userSection.style.display = 'none';
            authRequired.style.display = 'block';
            ticketFormSection.style.display = 'none';
        }
    } catch (error) {
        console.error('Error checking auth status:', error);
    }
}

function setupForm() {
    const form = document.getElementById('ticket-form');
    const successMessage = document.getElementById('success-message');
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const idNumber = document.getElementById('id-number').value.trim();
        const numbersInput = document.getElementById('numbers').value.trim();
        
        if (!idNumber) {
            showError('Molimo unesite broj osobne iskaznice');
            return;
        }
        
        if (idNumber.length > 20) {
            showError('Broj osobne iskaznice ne smije biti duži od 20 znakova');
            return;
        }
        
        if (!numbersInput) {
            showError('Molimo unesite brojeve');
            return;
        }
        
        const numbers = numbersInput.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n));
        
        if (numbers.length < 6 || numbers.length > 10) {
            showError('Morate unijeti između 6 i 10 brojeva');
            return;
        }
        
        const uniqueNumbers = [...new Set(numbers)];
        if (uniqueNumbers.length !== numbers.length) {
            showError('Duplikati brojeva nisu dozvoljeni');
            return;
        }
        
        for (const num of numbers) {
            if (num < 1 || num > 45) {
                showError('Svi brojevi moraju biti između 1 i 45');
                return;
            }
        }
        
        try {
            const response = await fetch('/api/tickets', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    idNumber: idNumber,
                    numbers: numbers
                })
            });
            
            if (response.ok) {
                const result = await response.json();
                
                if (result.success && result.qrCode) {
                    const qrContainer = document.getElementById('qr-code-container');
                    qrContainer.innerHTML = `<img src="${result.qrCode}" alt="QR Code" style="max-width: 300px; border: 3px solid #000;">`;
                    
                    form.style.display = 'none';
                    successMessage.style.display = 'block';
                } else {
                    showError('QR kod nije generiran - pokušajte ponovno');
                }
            } else {
                const errorData = await response.json();
                showError(errorData.error || 'Greška pri uplati listića');
            }
        } catch (error) {
            showError('Greška pri komunikaciji sa serverom');
        }
    });
}

function showError(message) {
    const errorMessage = document.getElementById('error-message');
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
    
    setTimeout(() => {
        errorMessage.style.display = 'none';
    }, 5000);
}