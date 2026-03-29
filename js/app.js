let editor = null;
let socket = null;
let currentRoomId = null;
let currentUser = null;
let cursors = new Map();
let participants = [];

// Initialize application
async function init() {
    await initMonaco();
    setupEventListeners();
    
    const urlParams = new URLSearchParams(window.location.search);
    const roomId = urlParams.get('room');
    
    if (roomId) {
        currentRoomId = roomId;
        showJoinModal();
    } else {
        createNewRoom();
    }
}

// Initialize Monaco Editor
function initMonaco() {
    return new Promise((resolve) => {
        require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs' } });
        require(['vs/editor/editor.main'], function () {
            editor = monaco.editor.create(document.getElementById('editor'), {
                value: getDefaultCode('javascript'),
                language: 'javascript',
                theme: 'vs-dark',
                fontSize: 14,
                fontFamily: 'Consolas, monospace',
                minimap: { enabled: false },
                automaticLayout: true,
                scrollBeyondLastLine: false,
                wordWrap: 'on'
            });
            
            editor.onDidChangeModelContent(() => {
                if (socket && currentRoomId && currentUser?.permission === 'edit' && socket.connected) {
                    const code = editor.getValue();
                    socket.emit('code-change', {
                        roomId: currentRoomId,
                        code: code,
                        language: document.getElementById('language-selector').value
                    });
                }
            });
            
            editor.onDidChangeCursorPosition((e) => {
                if (socket && currentRoomId && socket.connected) {
                    socket.emit('cursor-move', {
                        roomId: currentRoomId,
                        position: e.position
                    });
                }
            });
            
            resolve();
        });
    });
}

// Get default code for each language
function getDefaultCode(language) {
    const defaults = {
        javascript: `// Welcome to JavaScript Editor
// Write your JavaScript code here

console.log("Hello World!");

// Example function
function greet(name) {
    return "Hello, " + name + "!";
}

console.log(greet("Developer"));`,
        
        python: `# Welcome to Python Editor
# Write your Python code here

print("Hello World!")

# Example function
def greet(name):
    return f"Hello, {name}!"

print(greet("Developer"))`,
        
        java: `// Welcome to Java Editor
// Write your Java code here
// Note: Class name MUST be "Main"

public class Main {
    public static void main(String[] args) {
        System.out.println("Hello World!");
        
        // Example function
        System.out.println(greet("Developer"));
    }
    
    public static String greet(String name) {
        return "Hello, " + name + "!";
    }
}`,
        
        cpp: `// Welcome to C++ Editor
// Write your C++ code here

#include <iostream>
#include <string>
using namespace std;

string greet(string name) {
    return "Hello, " + name + "!";
}

int main() {
    cout << "Hello World!" << endl;
    cout << greet("Developer") << endl;
    return 0;
}`,
        
        html: `<!DOCTYPE html>
<html>
<head>
    <title>My Page</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }
        .container {
            text-align: center;
            margin-top: 50px;
        }
        button {
            padding: 10px 20px;
            font-size: 16px;
            cursor: pointer;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Hello World!</h1>
        <button onclick="alert('Hello from JavaScript!')">Click Me</button>
    </div>
    
    <script>
        console.log("Page loaded!");
    </script>
</body>
</html>`,
        
        css: `/* Welcome to CSS Editor */
/* Write your CSS styles here */

body {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    min-height: 100vh;
    display: flex;
    justify-content: center;
    align-items: center;
    margin: 0;
    padding: 20px;
}

.container {
    background: white;
    border-radius: 10px;
    padding: 30px;
    box-shadow: 0 10px 40px rgba(0,0,0,0.1);
    text-align: center;
    max-width: 500px;
}

h1 {
    color: #667eea;
    margin-bottom: 20px;
}

button {
    background: #667eea;
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: 5px;
    cursor: pointer;
    transition: transform 0.2s;
}

button:hover {
    transform: scale(1.05);
}`
    };
    
    return defaults[language] || defaults.javascript;
}

// Create new room
async function createNewRoom() {
    try {
        const response = await fetch('http://localhost:5000/api/create-room', {
            method: 'POST'
        });
        const data = await response.json();
        currentRoomId = data.roomId;
        window.history.pushState({}, '', `?room=${currentRoomId}`);
        showJoinModal();
    } catch (error) {
        console.error('Error creating room:', error);
        alert('Failed to create room. Please check if server is running.');
    }
}

// Show join modal
function showJoinModal() {
    document.getElementById('join-modal').style.display = 'block';
}

// Join session
async function joinSession() {
    const username = document.getElementById('username-input').value.trim();
    const permission = document.querySelector('input[name="permission"]:checked').value;
    
    if (!username) {
        alert('Please enter your name');
        return;
    }
    
    currentUser = { username, permission, id: generateId() };
    
    socket = io('http://localhost:5000', {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5
    });
    
    socket.on('connect', () => {
        console.log('Connected to server');
        updateConnectionStatus(true);
        
        socket.emit('join-room', {
            roomId: currentRoomId,
            username: username,
            permission: permission,
            userId: currentUser.id
        });
    });
    
    socket.on('disconnect', () => {
        console.log('Disconnected from server');
        updateConnectionStatus(false);
    });
    
    socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        updateConnectionStatus(false);
        alert('Failed to connect to server. Make sure backend is running on port 5000');
    });
    
    setupSocketEvents();
    
    document.getElementById('join-modal').style.display = 'none';
    updatePermissionBadge();
}

// Generate unique ID
function generateId() {
    return Math.random().toString(36).substr(2, 9);
}

// Update connection status
function updateConnectionStatus(connected) {
    const statusElement = document.getElementById('connection-status');
    if (connected) {
        statusElement.innerHTML = '<i class="fas fa-circle"></i> Connected';
        statusElement.className = 'status-connected';
    } else {
        statusElement.innerHTML = '<i class="fas fa-circle"></i> Disconnected';
        statusElement.className = 'status-disconnected';
    }
}

// Setup socket event listeners
function setupSocketEvents() {
    socket.on('code-update', (code) => {
        const currentCode = editor.getValue();
        if (currentCode !== code) {
            editor.setValue(code);
        }
    });
    
    socket.on('user-joined', ({ users, newUser }) => {
        console.log('User joined:', newUser);
        participants = users;
        updateParticipantsList(users);
        addChatMessage({
            username: 'System',
            message: `${newUser.username} joined the session`,
            timestamp: new Date(),
            isSystem: true
        });
    });
    
    socket.on('user-left', ({ users, username, userId }) => {
        console.log('User left:', username);
        participants = users;
        updateParticipantsList(users);
        addChatMessage({
            username: 'System',
            message: `${username} left the session`,
            timestamp: new Date(),
            isSystem: true
        });
        removeCursor(username);
    });
    
    socket.on('cursor-update', ({ userId, username, position }) => {
        showCursor(userId, username, position);
    });
    
    socket.on('new-message', (message) => {
        addChatMessage(message);
    });
    
    socket.on('chat-history', (messages) => {
        if (messages && messages.length > 0) {
            messages.forEach(msg => addChatMessage(msg));
        }
    });
    
    socket.on('permission-changed', ({ userId, newPermission, username }) => {
        if (userId === socket.id) {
            currentUser.permission = newPermission;
            updatePermissionBadge();
            addChatMessage({
                username: 'System',
                message: `Your permission changed to ${newPermission}`,
                timestamp: new Date(),
                isSystem: true
            });
        } else {
            addChatMessage({
                username: 'System',
                message: `${username} permission changed to ${newPermission}`,
                timestamp: new Date(),
                isSystem: true
            });
        }
        if (participants.length > 0) {
            updateParticipantsList(participants);
        }
    });
    
    socket.on('language-update', (language) => {
        const selector = document.getElementById('language-selector');
        selector.value = language;
        monaco.editor.setModelLanguage(editor.getModel(), language);
    });
    
    socket.on('room-state', (state) => {
        console.log('Room state received:', state);
        if (state.code) {
            editor.setValue(state.code);
        }
        if (state.language) {
            document.getElementById('language-selector').value = state.language;
            monaco.editor.setModelLanguage(editor.getModel(), state.language);
        }
        if (state.users) {
            participants = state.users;
            updateParticipantsList(state.users);
        }
        if (state.messages) {
            state.messages.forEach(msg => addChatMessage(msg));
        }
        if (state.yourPermission) {
            currentUser.permission = state.yourPermission;
            updatePermissionBadge();
        }
    });
}

// Update participants list
function updateParticipantsList(users) {
    const container = document.getElementById('participants-list');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (!users || users.length === 0) {
        container.innerHTML = '<div style="padding: 20px; text-align: center; color: #858585;">No participants yet</div>';
        return;
    }
    
    users.forEach(user => {
        const participantDiv = document.createElement('div');
        participantDiv.className = 'participant-item';
        const isCurrentUser = user.id === socket.id;
        
        participantDiv.innerHTML = `
            <div class="participant-info">
                <div class="participant-avatar" style="background: ${getAvatarColor(user.username)}">
                    ${user.username.charAt(0).toUpperCase()}
                </div>
                <div class="participant-details">
                    <div class="participant-name">
                        ${escapeHtml(user.username)}
                        ${isCurrentUser ? ' <span style="color: #2ea043; font-size: 10px;">(You)</span>' : ''}
                    </div>
                    <div class="participant-status">
                        ${user.permission === 'edit' ? '✏️ Can Edit' : '👁️ View Only'}
                    </div>
                </div>
            </div>
            <div class="permission-badge ${user.permission}">
                ${user.permission === 'edit' ? '<i class="fas fa-edit"></i>' : '<i class="fas fa-eye"></i>'}
            </div>
        `;
        
        if (participants[0]?.id === socket.id && user.id !== socket.id) {
            participantDiv.style.cursor = 'pointer';
            participantDiv.title = 'Click to change permission';
            participantDiv.onclick = () => togglePermission(user.id, user.permission);
        }
        
        container.appendChild(participantDiv);
    });
    
    const sidebarHeader = document.querySelector('.sidebar-header h3');
    if (sidebarHeader) {
        sidebarHeader.innerHTML = `<i class="fas fa-users"></i> Participants (${users.length})`;
    }
}

// Get avatar color
function getAvatarColor(username) {
    const colors = ['#667eea', '#764ba2', '#f093fb', '#4facfe', '#00f2fe', '#43e97b', '#38f9d7', '#fa709a', '#fee140', '#30cfd0'];
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
        hash = username.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
}

// Toggle user permission
function togglePermission(userId, currentPermission) {
    const newPermission = currentPermission === 'edit' ? 'view' : 'edit';
    socket.emit('change-permission', {
        roomId: currentRoomId,
        targetUserId: userId,
        newPermission: newPermission
    });
}

// Add chat message
function addChatMessage(message) {
    const container = document.getElementById('chat-messages');
    if (!container) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = 'chat-message';
    
    const time = new Date(message.timestamp).toLocaleTimeString();
    const isSystem = message.isSystem || message.username === 'System';
    
    messageDiv.innerHTML = `
        <strong style="color: ${isSystem ? '#ff9800' : '#569cd6'}">${escapeHtml(message.username)}</strong>
        <small style="color: #858585">${time}</small>
        <p style="${isSystem ? 'color: #ff9800; font-style: italic;' : ''}">${escapeHtml(message.message)}</p>
    `;
    
    container.appendChild(messageDiv);
    container.scrollTop = container.scrollHeight;
}

// Show cursor
function showCursor(userId, username, position) {
    if (userId === socket.id) return;
    
    removeCursor(username);
    
    const editorElement = document.getElementById('editor');
    const editorRect = editorElement.getBoundingClientRect();
    
    const cursorPosition = editor.getScrolledVisiblePosition(position);
    if (!cursorPosition) return;
    
    const cursorDiv = document.createElement('div');
    cursorDiv.className = 'cursor-indicator';
    cursorDiv.style.left = `${editorRect.left + cursorPosition.left}px`;
    cursorDiv.style.top = `${editorRect.top + cursorPosition.top}px`;
    cursorDiv.style.height = `${cursorPosition.height}px`;
    
    const labelDiv = document.createElement('div');
    labelDiv.className = 'cursor-label';
    labelDiv.textContent = username;
    labelDiv.style.backgroundColor = getAvatarColor(username);
    labelDiv.style.left = `${editorRect.left + cursorPosition.left}px`;
    labelDiv.style.top = `${editorRect.top + cursorPosition.top - 20}px`;
    
    document.body.appendChild(cursorDiv);
    document.body.appendChild(labelDiv);
    
    cursors.set(username, { cursor: cursorDiv, label: labelDiv });
}

// Remove cursor
function removeCursor(username) {
    const cursorElements = cursors.get(username);
    if (cursorElements) {
        cursorElements.cursor.remove();
        cursorElements.label.remove();
        cursors.delete(username);
    }
}

// Update permission badge
function updatePermissionBadge() {
    const badge = document.getElementById('user-permission-badge');
    if (!badge) return;
    
    if (currentUser.permission === 'edit') {
        badge.innerHTML = '<i class="fas fa-edit"></i> Edit Mode';
        badge.style.background = '#0e639c';
    } else {
        badge.innerHTML = '<i class="fas fa-eye"></i> View Only';
        badge.style.background = '#6a6a6a';
    }
}

// Save file to local storage
function saveFile() {
    const code = editor.getValue();
    const language = document.getElementById('language-selector').value;
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const filename = `code_${language}_${timestamp}.${getFileExtension(language)}`;
    
    const savedFiles = JSON.parse(localStorage.getItem('savedFiles') || '[]');
    savedFiles.unshift({
        id: Date.now(),
        name: filename,
        code: code,
        language: language,
        timestamp: new Date().toISOString()
    });
    localStorage.setItem('savedFiles', JSON.stringify(savedFiles.slice(0, 50)));
    
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    
    showNotification('File saved successfully!', 'success');
}

// Get file extension
function getFileExtension(language) {
    const extensions = {
        javascript: 'js',
        python: 'py',
        java: 'java',
        cpp: 'cpp',
        html: 'html',
        css: 'css'
    };
    return extensions[language] || 'txt';
}

// Open file
function openFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.js,.py,.java,.cpp,.html,.css,.txt';
    
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                editor.setValue(e.target.result);
                showNotification(`File "${file.name}" opened successfully!`, 'success');
                
                const extension = file.name.split('.').pop();
                const languageMap = {
                    js: 'javascript',
                    py: 'python',
                    java: 'java',
                    cpp: 'cpp',
                    html: 'html',
                    css: 'css'
                };
                if (languageMap[extension]) {
                    document.getElementById('language-selector').value = languageMap[extension];
                    monaco.editor.setModelLanguage(editor.getModel(), languageMap[extension]);
                }
            };
            reader.readAsText(file);
        }
    };
    input.click();
}

// Show recent files
function showRecentFiles() {
    const savedFiles = JSON.parse(localStorage.getItem('savedFiles') || '[]');
    
    if (savedFiles.length === 0) {
        showNotification('No saved files found', 'info');
        return;
    }
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'block';
    modal.innerHTML = `
        <div class="modal-content" style="width: 600px; max-width: 90%;">
            <h2>Recent Files</h2>
            <div style="max-height: 400px; overflow-y: auto;">
                ${savedFiles.map(file => `
                    <div class="file-item" data-id="${file.id}" style="padding: 12px; border-bottom: 1px solid #3e3e42; cursor: pointer;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <strong>${escapeHtml(file.name)}</strong>
                                <div style="font-size: 12px; color: #858585;">${new Date(file.timestamp).toLocaleString()}</div>
                            </div>
                            <button class="delete-file" data-id="${file.id}" style="background: #f85149; padding: 4px 8px;">Delete</button>
                        </div>
                    </div>
                `).join('')}
            </div>
            <button class="close-modal" style="margin-top: 16px;">Close</button>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    savedFiles.forEach(file => {
        const fileItem = modal.querySelector(`.file-item[data-id="${file.id}"]`);
        if (fileItem) {
            fileItem.onclick = (e) => {
                if (!e.target.classList.contains('delete-file')) {
                    editor.setValue(file.code);
                    document.getElementById('language-selector').value = file.language;
                    monaco.editor.setModelLanguage(editor.getModel(), file.language);
                    showNotification(`Loaded ${file.name}`, 'success');
                    modal.remove();
                }
            };
        }
        
        const deleteBtn = modal.querySelector(`.delete-file[data-id="${file.id}"]`);
        if (deleteBtn) {
            deleteBtn.onclick = (e) => {
                e.stopPropagation();
                const updatedFiles = savedFiles.filter(f => f.id !== file.id);
                localStorage.setItem('savedFiles', JSON.stringify(updatedFiles));
                modal.remove();
                showRecentFiles();
                showNotification('File deleted', 'info');
            };
        }
    });
    
    const closeBtn = modal.querySelector('.close-modal');
    closeBtn.onclick = () => modal.remove();
    
    modal.onclick = (e) => {
        if (e.target === modal) modal.remove();
    };
}

// Show notification
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.innerHTML = `
        <div style="background: ${type === 'success' ? '#2ea043' : type === 'error' ? '#f85149' : '#0e639c'}; 
                    color: white; padding: 12px 20px; border-radius: 8px; 
                    position: fixed; bottom: 20px; right: 20px; z-index: 10000;
                    animation: slideIn 0.3s ease;">
            ${escapeHtml(message)}
        </div>
    `;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
}

// New file
function newFile() {
    const language = document.getElementById('language-selector').value;
    editor.setValue(getDefaultCode(language));
    showNotification('New file created', 'success');
}

// Main execute function - LOCAL EXECUTION FOR ALL LANGUAGES
async function runCode() {
    const code = editor.getValue();
    const language = document.getElementById('language-selector').value;
    
    const outputDiv = document.getElementById('output');
    const outputContent = document.getElementById('output-content');
    
    outputDiv.style.display = 'flex';
    outputContent.innerHTML = '<span style="color: #ffd700;">⏳ Executing code locally...</span>';
    
    // For HTML/CSS, handle in browser
    if (language === 'html') {
        executeHTML(code, outputContent);
        return;
    }
    
    if (language === 'css') {
        executeCSS(code, outputContent);
        return;
    }
    
    // For all other languages, use local execution via backend
    await executeLocally(code, language, outputContent);
}

// Execute code locally using backend
async function executeLocally(code, language, outputContent) {
    try {
        const response = await fetch('http://localhost:5000/api/execute-local', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, language })
        });
        
        const data = await response.json();
        
        if (data.success) {
            outputContent.innerHTML = `
                <div style="background: #1e1e1e; padding: 12px; border-radius: 4px;">
                    <span style="color: #4ec9b0;">✅ ${language.toUpperCase()} Output:</span>
                    <pre style="margin-top: 8px; margin-bottom: 0; overflow-x: auto;">${escapeHtml(data.output)}</pre>
                </div>
            `;
        } else {
            // Check if it's an installation error
            const isInstallError = data.error.includes('not installed') || 
                                  data.error.includes('not recognized');
            
            if (isInstallError) {
                outputContent.innerHTML = `
                    <div style="background: #2d2d30; padding: 16px; border-radius: 8px;">
                        <span style="color: #ffd700;">⚠️ ${language.toUpperCase()} Not Installed</span>
                        
                        <div style="margin-top: 12px;">
                            <strong style="color: #4ec9b0;">💡 To run ${language.toUpperCase()} code locally:</strong>
                            
                            <div style="margin-top: 12px; padding: 12px; background: #1e1e1e; border-radius: 4px;">
                                <strong>Step 1: Install ${language.toUpperCase()}</strong>
                                <br>
                                ${getInstallInstructions(language)}
                            </div>
                            
                            <div style="margin-top: 12px; padding: 12px; background: #1e1e1e; border-radius: 4px;">
                                <strong>Step 2: Restart the backend server</strong>
                                <br>
                                After installation, restart the server with Ctrl+C then npm run dev
                            </div>
                            
                            <div style="margin-top: 12px; padding: 12px; background: #1e1e1e; border-radius: 4px;">
                                <strong>📝 Your Code:</strong>
                                <pre style="margin-top: 8px; max-height: 200px; overflow-y: auto;">${escapeHtml(code)}</pre>
                            </div>
                        </div>
                    </div>
                `;
            } else {
                outputContent.innerHTML = `
                    <div style="background: #2d2d30; padding: 16px; border-radius: 8px;">
                        <span style="color: #f48771;">❌ ${language.toUpperCase()} Execution Error:</span>
                        <pre style="margin-top: 12px; background: #1e1e1e; padding: 12px; border-radius: 4px; overflow-x: auto; color: #f48771;">${escapeHtml(data.error)}</pre>
                        
                        <div style="margin-top: 12px;">
                            <strong>💡 Troubleshooting:</strong>
                            <br>
                            • Check your code syntax
                            • Make sure all required files are saved
                            • For Java: Ensure class name matches filename
                            • For C++: Ensure you have a main() function
                        </div>
                    </div>
                `;
            }
        }
    } catch (error) {
        outputContent.innerHTML = `
            <div style="background: #2d2d30; padding: 16px; border-radius: 8px;">
                <span style="color: #f48771;">❌ Connection Error:</span>
                <pre style="margin-top: 12px;">Cannot connect to backend server. Make sure it's running on port 5000.</pre>
            </div>
        `;
    }
}

// Get installation instructions for each language
function getInstallInstructions(language) {
    const instructions = {
        python: `
            • Download from: <a href="https://python.org/downloads" target="_blank">python.org</a>
            • During installation, check "Add Python to PATH"
            • Restart VS Code after installation
        `,
        javascript: `
            • Download from: <a href="https://nodejs.org" target="_blank">nodejs.org</a>
            • Install the LTS version
            • Node.js comes with npm automatically
        `,
        java: `
            • Download JDK from: <a href="https://adoptium.net" target="_blank">adoptium.net</a>
            • Install and set JAVA_HOME environment variable
            • Verify with: java -version and javac -version
        `,
        cpp: `
            • Windows: Install <a href="https://code.visualstudio.com/docs/cpp/config-mingw" target="_blank">MinGW</a>
            • Mac: Install Xcode Command Line Tools: xcode-select --install
            • Linux: sudo apt-get install g++ build-essential
        `
    };
    return instructions[language] || instructions.python;
}

// Execute HTML
function executeHTML(code, outputContent) {
    const iframe = document.createElement('iframe');
    iframe.style.width = '100%';
    iframe.style.height = '400px';
    iframe.style.border = '1px solid #3e3e42';
    iframe.style.background = 'white';
    iframe.srcdoc = code;
    
    outputContent.innerHTML = '';
    outputContent.appendChild(iframe);
}

// Execute CSS
function executeCSS(code, outputContent) {
    const html = `<!DOCTYPE html>
    <html>
    <head><style>${code}</style></head>
    <body>
        <div class="container">
            <h1>CSS Preview</h1>
            <button>Button</button>
            <p>This is a paragraph to test your CSS styles.</p>
            <div style="margin-top: 20px;">
                <input type="text" placeholder="Input field">
            </div>
        </div>
    </body>
    </html>`;
    
    const iframe = document.createElement('iframe');
    iframe.style.width = '100%';
    iframe.style.height = '400px';
    iframe.style.border = '1px solid #3e3e42';
    iframe.srcdoc = html;
    
    outputContent.innerHTML = '';
    outputContent.appendChild(iframe);
}

// Share link
function shareLink() {
    const modal = document.getElementById('share-modal');
    const linkInput = document.getElementById('share-link');
    const url = `${window.location.origin}${window.location.pathname}?room=${currentRoomId}`;
    linkInput.value = url;
    modal.style.display = 'block';
}

// Copy link
function copyLink() {
    const linkInput = document.getElementById('share-link');
    linkInput.select();
    document.execCommand('copy');
    showNotification('Link copied to clipboard!', 'success');
}

// Setup event listeners
function setupEventListeners() {
    document.getElementById('join-session').onclick = joinSession;
    document.getElementById('share-link-btn').onclick = shareLink;
    document.getElementById('copy-link').onclick = copyLink;
    document.getElementById('run-code-btn').onclick = runCode;
    document.getElementById('close-output').onclick = () => {
        document.getElementById('output').style.display = 'none';
    };
    
    document.getElementById('send-chat').onclick = () => {
        const input = document.getElementById('chat-input');
        const message = input.value.trim();
        if (message && socket && socket.connected) {
            socket.emit('send-message', {
                roomId: currentRoomId,
                message: message,
                timestamp: new Date()
            });
            input.value = '';
        }
    };
    
    document.getElementById('chat-input').onkeypress = (e) => {
        if (e.key === 'Enter') {
            document.getElementById('send-chat').click();
        }
    };
    
    document.getElementById('language-selector').onchange = (e) => {
        const language = e.target.value;
        editor.setValue(getDefaultCode(language));
        monaco.editor.setModelLanguage(editor.getModel(), language);
        if (socket && currentRoomId && socket.connected) {
            socket.emit('language-change', {
                roomId: currentRoomId,
                language: language
            });
        }
    };
    
    window.onclick = (event) => {
        if (event.target.classList.contains('modal')) {
            event.target.style.display = 'none';
        }
    };
    
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.onclick = () => {
            document.getElementById('share-modal').style.display = 'none';
        };
    });
}

// Helper function to escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Add notification styles
const notificationStyle = document.createElement('style');
notificationStyle.textContent = `
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
    .cursor-indicator {
        position: absolute;
        width: 2px;
        background: #569cd6;
        pointer-events: none;
        z-index: 100;
    }
    .cursor-label {
        position: absolute;
        background: #569cd6;
        color: white;
        font-size: 10px;
        padding: 2px 4px;
        border-radius: 2px;
        white-space: nowrap;
        pointer-events: none;
        z-index: 100;
    }
    .status-disconnected {
        color: #f85149;
    }
    .status-connected {
        color: #2ea043;
    }
    .file-item:hover {
        background: #2a2d2e;
    }
`;
document.head.appendChild(notificationStyle);

// Add File menu buttons to toolbar
const toolbarLeft = document.querySelector('.toolbar-left');
if (toolbarLeft) {
    const fileButtons = document.createElement('div');
    fileButtons.style.display = 'flex';
    fileButtons.style.gap = '8px';
    fileButtons.style.marginRight = '12px';
    fileButtons.innerHTML = `
        <button id="new-file-btn" title="New File"><i class="fas fa-file"></i> New</button>
        <button id="open-file-btn" title="Open File"><i class="fas fa-folder-open"></i> Open</button>
        <button id="save-file-btn" title="Save File"><i class="fas fa-save"></i> Save</button>
        <button id="recent-files-btn" title="Recent Files"><i class="fas fa-history"></i> Recent</button>
    `;
    toolbarLeft.insertBefore(fileButtons, toolbarLeft.firstChild);
    
    document.getElementById('new-file-btn').onclick = newFile;
    document.getElementById('open-file-btn').onclick = openFile;
    document.getElementById('save-file-btn').onclick = saveFile;
    document.getElementById('recent-files-btn').onclick = showRecentFiles;
}
// At the very end of app.js, before the init() call
// Initialize all features after app starts
setTimeout(() => {
    console.log('Initializing additional features...');
    
    if (typeof initVideoCall === 'function') {
        console.log('Initializing Video Call...');
        initVideoCall();
    } else {
        console.log('Video Call module not loaded');
    }
    
    if (typeof initAIAssistant === 'function') {
        console.log('Initializing AI Assistant...');
        initAIAssistant();
    } else {
        console.log('AI Assistant module not loaded');
    }
    
    if (typeof initGitHubIntegration === 'function') {
        console.log('Initializing GitHub Integration...');
        initGitHubIntegration();
    } else {
        console.log('GitHub module not loaded');
    }
}, 2000);

// Start the application
init();