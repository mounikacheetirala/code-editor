// GitHub Integration Module - Fixed Version
let githubToken = null;
let githubUser = null;

function initGitHubIntegration() {
    console.log('Initializing GitHub Integration...');
    
    if (document.getElementById('github-btn')) {
        console.log('GitHub button already exists');
        return;
    }
    
    const githubBtn = document.createElement('button');
    githubBtn.id = 'github-btn';
    githubBtn.innerHTML = '<i class="fab fa-github"></i> GitHub';
    githubBtn.onclick = showGitHubMenu;
    githubBtn.style.background = '#24292f';
    githubBtn.style.marginLeft = '8px';
    
    const toolbarRight = document.querySelector('.toolbar-right');
    if (toolbarRight) {
        toolbarRight.insertBefore(githubBtn, document.getElementById('share-link-btn'));
        console.log('GitHub button added to toolbar');
    }
    
    // Load saved token from localStorage
    const savedToken = localStorage.getItem('github_token');
    if (savedToken) {
        githubToken = savedToken;
        verifyGitHubToken();
    }
}

function showGitHubMenu() {
    // Remove existing modal if any
    const existingModal = document.querySelector('.github-modal');
    if (existingModal) existingModal.remove();
    
    const modal = document.createElement('div');
    modal.className = 'modal github-modal';
    modal.style.display = 'block';
    modal.innerHTML = `
        <div class="modal-content" style="width: 500px; max-width: 90%;">
            <h2><i class="fab fa-github"></i> GitHub Integration</h2>
            
            ${!githubToken ? `
                <div style="margin-bottom: 20px;">
                    <p style="margin-bottom: 10px;">Connect to GitHub to save your code as Gists</p>
                    <input type="password" id="github-token-input" placeholder="Enter GitHub Personal Access Token" style="width: 100%; padding: 10px; margin: 10px 0; background: #3c3c3c; border: 1px solid #3e3e42; color: white; border-radius: 4px;">
                    <button id="connect-github-btn" style="width: 100%; padding: 10px; background: #2ea043;">Connect to GitHub</button>
                    <p style="font-size: 12px; margin-top: 10px; color: #858585;">
                        <a href="https://github.com/settings/tokens/new?scopes=gist&description=Code+Editor" target="_blank" style="color: #4ec9b0;">Click here to get a token</a>
                        (Select only 'gist' scope)
                    </p>
                </div>
            ` : `
                <div style="margin-bottom: 20px; padding: 10px; background: #2d2d30; border-radius: 4px;">
                    <p>✅ Connected as: <strong style="color: #4ec9b0;">${githubUser?.login || 'GitHub User'}</strong></p>
                    <button id="disconnect-github-btn" style="width: 100%; padding: 8px; background: #f85149; margin-top: 8px;">Disconnect</button>
                </div>
            `}
            
            <div style="border-top: 1px solid #3e3e42; padding-top: 20px;">
                <h3 style="margin-bottom: 15px;">Save Current Code as Gist</h3>
                <input type="text" id="gist-filename" placeholder="Filename (e.g., main.js or Main.java)" style="width: 100%; padding: 10px; margin-bottom: 10px; background: #3c3c3c; border: 1px solid #3e3e42; color: white; border-radius: 4px;">
                <textarea id="gist-description" placeholder="Description (optional)" rows="2" style="width: 100%; margin-bottom: 10px; padding: 10px; background: #3c3c3c; border: 1px solid #3e3e42; color: white; border-radius: 4px;"></textarea>
                <button id="save-to-gist-btn" ${!githubToken ? 'disabled' : ''} style="width: 100%; padding: 10px; background: ${!githubToken ? '#6a6a6a' : '#0e639c'};">
                    <i class="fab fa-github"></i> Save Current Code as Gist
                </button>
            </div>
            
            <button class="close-modal" style="margin-top: 20px; width: 100%; padding: 8px; background: #3e3e42;">Close</button>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Add event listeners
    if (!githubToken) {
        const connectBtn = document.getElementById('connect-github-btn');
        if (connectBtn) {
            connectBtn.onclick = connectGitHub;
        }
    } else {
        const disconnectBtn = document.getElementById('disconnect-github-btn');
        if (disconnectBtn) {
            disconnectBtn.onclick = disconnectGitHub;
        }
    }
    
    const saveBtn = document.getElementById('save-to-gist-btn');
    if (saveBtn) {
        saveBtn.onclick = () => saveToGist(modal);
    }
    
    const closeBtn = modal.querySelector('.close-modal');
    if (closeBtn) {
        closeBtn.onclick = () => modal.remove();
    }
    
    modal.onclick = (e) => {
        if (e.target === modal) modal.remove();
    };
}

async function connectGitHub() {
    const tokenInput = document.getElementById('github-token-input');
    const token = tokenInput?.value.trim();
    
    if (!token) {
        showNotification('Please enter a GitHub token', 'error');
        return;
    }
    
    showNotification('Verifying token...', 'info');
    
    try {
        const response = await fetch(`http://localhost:5000/api/github/user?token=${token}`);
        const data = await response.json();
        
        if (data.success && data.user) {
            githubToken = token;
            githubUser = data.user;
            localStorage.setItem('github_token', token);
            showNotification(`✅ Connected as ${data.user.login}`, 'success');
            
            // Close modal and reopen to show connected state
            const modal = document.querySelector('.github-modal');
            if (modal) modal.remove();
            showGitHubMenu();
        } else {
            showNotification('❌ Invalid token. Please check and try again.', 'error');
        }
    } catch (error) {
        console.error('Connection error:', error);
        showNotification('Failed to connect to GitHub. Is backend running?', 'error');
    }
}

function disconnectGitHub() {
    githubToken = null;
    githubUser = null;
    localStorage.removeItem('github_token');
    showNotification('Disconnected from GitHub', 'info');
    
    const modal = document.querySelector('.github-modal');
    if (modal) modal.remove();
    showGitHubMenu();
}

async function verifyGitHubToken() {
    if (!githubToken) return;
    
    try {
        const response = await fetch(`http://localhost:5000/api/github/user?token=${githubToken}`);
        const data = await response.json();
        if (data.success && data.user) {
            githubUser = data.user;
            console.log('GitHub verified:', githubUser.login);
        } else {
            disconnectGitHub();
        }
    } catch (error) {
        console.error('Verification error:', error);
        disconnectGitHub();
    }
}

async function saveToGist(modal) {
    if (!githubToken) {
        showNotification('Please connect to GitHub first', 'error');
        return;
    }
    
    const filename = document.getElementById('gist-filename')?.value.trim();
    if (!filename) {
        showNotification('Please enter a filename', 'error');
        return;
    }
    
    // Get current code from editor
    const code = editor?.getValue();
    if (!code || code.trim() === '') {
        showNotification('No code to save. Write some code first!', 'error');
        return;
    }
    
    const description = document.getElementById('gist-description')?.value || `Code from Collaborative Editor - ${new Date().toLocaleString()}`;
    const language = document.getElementById('language-selector')?.value || 'javascript';
    
    // Add proper extension if not provided
    let finalFilename = filename;
    const extensions = {
        javascript: '.js',
        python: '.py',
        java: '.java',
        cpp: '.cpp',
        html: '.html',
        css: '.css'
    };
    
    if (!filename.includes('.')) {
        finalFilename = filename + (extensions[language] || '.txt');
    }
    
    showNotification('Saving to GitHub Gist...', 'info');
    
    try {
        const response = await fetch('http://localhost:5000/api/github/save-gist', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                code: code,
                filename: finalFilename,
                description: description,
                githubToken: githubToken
            })
        });
        
        const data = await response.json();
        console.log('GitHub response:', data);
        
        if (data.success) {
            showNotification('✅ Saved to GitHub Gist successfully!', 'success');
            if (modal) modal.remove();
            
            // Ask if user wants to open the gist
            setTimeout(() => {
                if (confirm('Gist created successfully! Open it in browser?')) {
                    window.open(data.url, '_blank');
                }
            }, 500);
        } else {
            showNotification(`❌ Failed to save: ${data.error || 'Unknown error'}`, 'error');
        }
    } catch (error) {
        console.error('Save error:', error);
        showNotification('Failed to save to GitHub. Check console for details.', 'error');
    }
}

// Helper function for notifications
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.innerHTML = `
        <div style="background: ${type === 'success' ? '#2ea043' : type === 'error' ? '#f85149' : '#0e639c'}; 
                    color: white; padding: 12px 20px; border-radius: 8px; 
                    position: fixed; bottom: 20px; right: 20px; z-index: 10000;
                    animation: slideIn 0.3s ease;">
            ${message}
        </div>
    `;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
}

// Add notification styles if not already present
if (!document.querySelector('#github-notification-styles')) {
    const style = document.createElement('style');
    style.id = 'github-notification-styles';
    style.textContent = `
        @keyframes slideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
    `;
    document.head.appendChild(style);
}

console.log('GitHub Integration module loaded');