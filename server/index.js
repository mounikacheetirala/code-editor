import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { v4 as uuidv4 } from 'uuid';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { promisify } from 'util';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const execPromise = promisify(exec);

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors());
app.use(express.json());
app.use(morgan('combined'));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use('/api/', limiter);

// Store rooms
const rooms = new Map();

// Create room
app.post('/api/create-room', (req, res) => {
  const roomId = uuidv4();
  rooms.set(roomId, {
    code: '// Welcome to the collaborative code editor\n// Start coding here...',
    language: 'javascript',
    users: new Map(),
    messages: []
  });
  res.json({ roomId });
});

// Get room info
app.get('/api/room/:roomId', (req, res) => {
  const room = rooms.get(req.params.roomId);
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }
  res.json({
    code: room.code,
    language: room.language,
    users: Array.from(room.users.values()),
    messages: room.messages
  });
});

// Local code execution endpoint
app.post('/api/execute-local', async (req, res) => {
    const { code, language } = req.body;
    const timestamp = Date.now();
    let filename = '';
    let command = '';
    
    try {
        switch(language) {
            case 'python':
                filename = `temp_${timestamp}.py`;
                fs.writeFileSync(filename, code);
                command = `python "${filename}"`;
                break;
                
            case 'javascript':
                filename = `temp_${timestamp}.js`;
                fs.writeFileSync(filename, code);
                command = `node "${filename}"`;
                break;
                
            case 'java':
                let className = 'Main';
                const classMatch = code.match(/public\s+class\s+(\w+)/);
                if (classMatch) {
                    className = classMatch[1];
                }
                filename = `${className}.java`;
                fs.writeFileSync(filename, code);
                command = `javac "${filename}" && java ${className}`;
                break;
                
            case 'cpp':
                filename = `temp_${timestamp}.cpp`;
                const outputFile = `temp_${timestamp}`;
                fs.writeFileSync(filename, code);
                if (process.platform === 'win32') {
                    command = `g++ "${filename}" -o ${outputFile}.exe && ${outputFile}.exe`;
                } else {
                    command = `g++ "${filename}" -o ${outputFile} && ./${outputFile}`;
                }
                break;
                
            default:
                throw new Error(`Language ${language} not supported for local execution`);
        }
        
        const { stdout, stderr } = await execPromise(command, { 
            timeout: 5000,
            shell: true
        });
        
        cleanupFiles(filename, language, timestamp);
        
        if (stderr) {
            res.json({ success: false, error: stderr, output: stdout });
        } else {
            res.json({ success: true, output: stdout || 'Code executed successfully (no output)', error: null });
        }
        
    } catch (error) {
        cleanupFiles(filename, language, timestamp);
        
        let errorMessage = error.message;
        if (error.message.includes('python is not recognized')) {
            errorMessage = 'Python is not installed. Please install Python from https://python.org';
        } else if (error.message.includes('node is not recognized')) {
            errorMessage = 'Node.js is not installed. Please install Node.js from https://nodejs.org';
        } else if (error.message.includes('javac is not recognized')) {
            errorMessage = 'Java JDK is not installed. Please install JDK from https://adoptium.net';
        } else if (error.message.includes('g++ is not recognized')) {
            errorMessage = 'G++ compiler is not installed. Please install MinGW or GCC';
        }
        
        res.json({ success: false, error: errorMessage, details: error.message });
    }
});

// Helper function to cleanup temporary files
function cleanupFiles(filename, language, timestamp) {
    try {
        if (filename && fs.existsSync(filename)) {
            fs.unlinkSync(filename);
        }
        
        if (language === 'cpp') {
            const exeFile = process.platform === 'win32' ? `temp_${timestamp}.exe` : `temp_${timestamp}`;
            if (fs.existsSync(exeFile)) {
                fs.unlinkSync(exeFile);
            }
        }
        
        if (language === 'java') {
            const classFile = filename.replace('.java', '.class');
            if (fs.existsSync(classFile)) {
                fs.unlinkSync(classFile);
            }
        }
    } catch(e) {
        console.log('Cleanup error:', e);
    }
}

// AI Chat endpoint
// AI Chat endpoint - Enhanced version
app.post('/api/ai-assist', async (req, res) => {
    const { prompt, code, language } = req.body;
    
    console.log('AI Request received:', { 
        prompt: prompt.substring(0, 50), 
        language,
        codeLength: code?.length || 0
    });
    
    // Generate intelligent response
    const response = generateSmartAIResponse(prompt, code, language);
    
    res.json({ success: true, response: response });
});

// Generate smart AI response
function generateSmartAIResponse(prompt, code, language) {
    const lowerPrompt = prompt.toLowerCase();
    const hasCode = code && code.length > 10 && !code.includes('// Welcome');
    
    // If no meaningful code
    if (!hasCode) {
        return getSampleCodeResponse(language, prompt);
    }
    
    // Analyze based on prompt
    if (lowerPrompt.includes('explain') || lowerPrompt.includes('what does')) {
        return explainCode(code, language);
    }
    
    if (lowerPrompt.includes('bug') || lowerPrompt.includes('fix') || lowerPrompt.includes('error')) {
        return analyzeBugs(code, language);
    }
    
    if (lowerPrompt.includes('optimize') || lowerPrompt.includes('improve') || lowerPrompt.includes('performance')) {
        return optimizeCode(code, language);
    }
    
    if (lowerPrompt.includes('palindrome') || lowerPrompt.includes('specific request')) {
        return handleSpecificRequest(lowerPrompt, language);
    }
    
    return generalHelp(prompt, code, language);
}

// Handle specific coding requests
function handleSpecificRequest(prompt, language) {
    if (prompt.includes('palindrome')) {
        return `🔤 **Palindrome Checker in ${language.toUpperCase()}**\n\n` +
               `Here's a working palindrome checker:\n\n` +
               getPalindromeCode(language) +
               `\n\n**How it works:**\n` +
               `• Reverses the string and compares with original\n` +
               `• Returns true if both are same (palindrome)\n` +
               `• Example: "racecar" reversed is "racecar" → true\n` +
               `• Example: "hello" reversed is "olleh" → false\n\n` +
               `**Try it with:** "madam", "12321", "A man, a plan, a canal: panama"`;
    }
    
    return null;
}

// Get palindrome code for different languages
function getPalindromeCode(language) {
    if (language === 'java') {
        return `public class Palindrome {
    public static boolean isPalindrome(String str) {
        String reversed = new StringBuilder(str).reverse().toString();
        return str.equals(reversed);
    }
    
    public static void main(String[] args) {
        String test = "racecar";
        System.out.println(test + " is palindrome: " + isPalindrome(test));
    }
}`;
    } else if (language === 'python') {
        return `def is_palindrome(s):
    return s == s[::-1]

# Test
print(is_palindrome("racecar"))  # True
print(is_palindrome("hello"))    # False`;
    } else if (language === 'javascript') {
        return `function isPalindrome(str) {
    return str === str.split('').reverse().join('');
}

console.log(isPalindrome("racecar")); // true
console.log(isPalindrome("hello"));   // false`;
    }
    return "// Palindrome function example";
}

// Explain code in detail
function explainCode(code, language) {
    const lines = code.split('\n').filter(l => l.trim() && !l.trim().startsWith('//') && !l.trim().startsWith('#'));
    
    let explanation = `📖 **Code Explanation (${language.toUpperCase()})**\n\n`;
    
    // Detect code patterns
    if (code.includes('class')) {
        explanation += `**Class Structure:**\n`;
        explanation += `• This is an object-oriented program using classes\n`;
        explanation += `• Classes bundle data and methods together\n\n`;
    }
    
    if (code.includes('main') || code.includes('main(')) {
        explanation += `**Main Method:**\n`;
        explanation += `• This is the entry point where program starts execution\n`;
        explanation += `• Code inside main() runs when you start the program\n\n`;
    }
    
    if (code.includes('if')) {
        explanation += `**Conditional Logic:**\n`;
        explanation += `• Uses if-statements for decision making\n`;
        explanation += `• Code takes different paths based on conditions\n\n`;
    }
    
    if (code.includes('for') || code.includes('while')) {
        explanation += `**Loops:**\n`;
        explanation += `• Repeats code multiple times\n`;
        explanation += `• Great for processing arrays or repetitive tasks\n\n`;
    }
    
    if (code.includes('System.out.println') || code.includes('print')) {
        explanation += `**Output:**\n`;
        explanation += `• Prints results to the console\n`;
        explanation += `• Shows what the program computes\n\n`;
    }
    
    explanation += `**Line-by-line breakdown:**\n`;
    const importantLines = lines.slice(0, 5);
    importantLines.forEach((line, i) => {
        if (line.includes('class')) explanation += `${i+1}. Defines a class named ${extractClassName(line)}\n`;
        else if (line.includes('main')) explanation += `${i+1}. Main method - program starts here\n`;
        else if (line.includes('if')) explanation += `${i+1}. Checks a condition\n`;
        else if (line.includes('for')) explanation += `${i+1}. Loop that repeats code\n`;
        else if (line.includes('return')) explanation += `${i+1}. Returns a value from function\n`;
        else if (line.trim() && !line.includes('{') && !line.includes('}')) {
            explanation += `${i+1}. ${line.trim().substring(0, 50)}${line.length > 50 ? '...' : ''}\n`;
        }
    });
    
    return explanation;
}

// Analyze for bugs
function analyzeBugs(code, language) {
    let analysis = `🐛 **Bug Analysis for ${language.toUpperCase()}**\n\n`;
    let issuesFound = false;
    
    if (language === 'java') {
        // Check for missing semicolons
        const lines = code.split('\n');
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line && !line.endsWith(';') && !line.endsWith('{') && !line.endsWith('}') && 
                !line.startsWith('//') && !line.startsWith('/*') && !line.startsWith('*') &&
                !line.includes('class') && !line.includes('main') && !line.includes('if') &&
                !line.includes('for') && !line.includes('while')) {
                analysis += `⚠️ **Line ${i+1}:** Missing semicolon ';'\n`;
                analysis += `   Fix: Add ';' at the end of: ${line}\n\n`;
                issuesFound = true;
            }
        }
        
        // Check for missing public static void main
        if (!code.includes('public static void main')) {
            analysis += `⚠️ **Missing Main Method:**\n`;
            analysis += `   Java programs need a main method to run\n`;
            analysis += `   Add: public static void main(String[] args) { ... }\n\n`;
            issuesFound = true;
        }
        
        // Check for class name mismatch
        const classMatch = code.match(/class\s+(\w+)/);
        if (classMatch && classMatch[1] !== 'Main') {
            analysis += `💡 **Note:** Class name is '${classMatch[1]}'\n`;
            analysis += `   File should be named ${classMatch[1]}.java\n\n`;
        }
    }
    
    if (language === 'python') {
        if (code.includes('print') && !code.includes('(')) {
            analysis += `⚠️ **Python 3 Syntax:** Use print() as a function\n`;
            analysis += `   Fix: Change 'print "text"' to 'print("text")'\n\n`;
            issuesFound = true;
        }
        
        if (code.includes('if') && !code.includes(':')) {
            analysis += `⚠️ **Missing Colon:** if statements need ':'\n`;
            analysis += `   Fix: Add ':' after if condition\n\n`;
            issuesFound = true;
        }
    }
    
    if (!issuesFound) {
        analysis += `✅ **No syntax errors detected!**\n\n`;
        analysis += `**Runtime things to check:**\n`;
        analysis += `• Logic errors: Test with different inputs\n`;
        analysis += `• Edge cases: Empty strings, null values, negative numbers\n`;
        analysis += `• Array bounds: Ensure indexes are within range\n`;
        analysis += `• Type safety: Verify data types match\n\n`;
    }
    
    analysis += `**Debugging Tips:**\n`;
    analysis += `• Add print statements to see variable values\n`;
    analysis += `• Test one small part at a time\n`;
    analysis += `• Use a debugger to step through code\n`;
    
    return analysis;
}

// Optimize code
function optimizeCode(code, language) {
    let optimization = `⚡ **Optimization Tips for ${language.toUpperCase()}**\n\n`;
    
    optimization += `**Performance Improvements:**\n`;
    
    if (code.includes('+') && language === 'java' && code.includes('String')) {
        optimization += `• Use StringBuilder instead of String concatenation in loops\n`;
        optimization += `  StringBuilder sb = new StringBuilder();\n`;
        optimization += `  sb.append("text");\n\n`;
    }
    
    if (code.includes('for') && code.includes('size()')) {
        optimization += `• Cache array/list size in variable before loop\n`;
        optimization += `  int size = list.size();\n`;
        optimization += `  for (int i = 0; i < size; i++)\n\n`;
    }
    
    optimization += `**Readability Improvements:**\n`;
    optimization += `• Use meaningful variable names (not 'a', 'b', 'temp')\n`;
    optimization += `• Break long methods into smaller focused methods\n`;
    optimization += `• Add comments explaining complex logic\n`;
    optimization += `• Consistent indentation and formatting\n\n`;
    
    optimization += `**Memory Optimization:**\n`;
    optimization += `• Close resources (files, database connections)\n`;
    optimization += `• Avoid creating unnecessary objects in loops\n`;
    optimization += `• Use primitive types instead of wrapper classes\n`;
    
    return optimization;
}

// General help
function generalHelp(prompt, code, language) {
    return `🤖 **AI Coding Assistant**\n\n` +
           `I can help you with your ${language.toUpperCase()} code!\n\n` +
           `**Current code stats:**\n` +
           `• Lines: ${code.split('\n').length}\n` +
           `• Characters: ${code.length}\n` +
           `• Language: ${language.toUpperCase()}\n\n` +
           `**Try these commands:**\n` +
           `• "Explain my code" - Get detailed explanation\n` +
           `• "Find bugs" - Analyze for errors\n` +
           `• "Optimize my code" - Get performance tips\n` +
           `• "Write a palindrome" - Get example code\n\n` +
           `**Your question:** "${prompt.substring(0, 100)}"\n\n` +
           `I'm ready to help! What would you like to know about your code?`;
}

// Sample code response when editor is empty
function getSampleCodeResponse(language, prompt) {
    if (prompt.toLowerCase().includes('palindrome')) {
        return handleSpecificRequest('palindrome', language);
    }
    
    return `📝 **Welcome to the Code Editor!**\n\n` +
           `I see your editor is empty. Let me help you get started with ${language.toUpperCase()}!\n\n` +
           `**Try this example code:**\n\n` +
           `\`\`\`${language}\n${getSampleCode(language)}\n\`\`\`\n\n` +
           `**Copy this code into the editor, then ask me:**\n` +
           `• "Explain my code" - Understand what it does\n` +
           `• "Find bugs" - Check for issues\n` +
           `• "Optimize my code" - Improve performance\n` +
           `• "Write a palindrome" - Get palindrome example\n\n` +
           `**Or write your own code and I'll help you!**`;
}

// Get sample code for each language
function getSampleCode(language) {
    if (language === 'java') {
        return `public class Main {
    public static void main(String[] args) {
        System.out.println("Hello World!");
        
        // Check if a word is palindrome
        String word = "racecar";
        if (isPalindrome(word)) {
            System.out.println(word + " is a palindrome!");
        }
    }
    
    public static boolean isPalindrome(String str) {
        String reversed = new StringBuilder(str).reverse().toString();
        return str.equals(reversed);
    }
}`;
    } else if (language === 'python') {
        return `def is_palindrome(s):
    return s == s[::-1]

def main():
    word = "racecar"
    if is_palindrome(word):
        print(f"{word} is a palindrome!")
    else:
        print(f"{word} is not a palindrome")

if __name__ == "__main__":
    main()`;
    } else if (language === 'javascript') {
        return `function isPalindrome(str) {
    return str === str.split('').reverse().join('');
}

const word = "racecar";
if (isPalindrome(word)) {
    console.log(word + " is a palindrome!");
}`;
    }
    return `// Write your ${language} code here\n// Then ask AI for help!`;
}

// Helper function to extract class name
function extractClassName(line) {
    const match = line.match(/class\s+(\w+)/);
    return match ? match[1] : 'Unknown';
}

// GitHub Gist endpoint
app.post('/api/github/save-gist', async (req, res) => {
    const { code, filename, description, githubToken } = req.body;
    
    if (!githubToken) {
        return res.status(401).json({ success: false, error: 'GitHub token required' });
    }
    
    try {
        const response = await fetch('https://api.github.com/gists', {
            method: 'POST',
            headers: {
                'Authorization': `token ${githubToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                description: description || 'Code from Collaborative Editor',
                public: false,
                files: {
                    [filename]: {
                        content: code
                    }
                }
            })
        });
        
        const data = await response.json();
        
        if (data.id) {
            res.json({ success: true, url: data.html_url, gistId: data.id });
        } else {
            res.json({ success: false, error: data.message || 'Failed to create gist' });
        }
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

app.get('/api/github/user', async (req, res) => {
    const { token } = req.query;
    
    if (!token) {
        return res.status(401).json({ success: false, error: 'Token required' });
    }
    
    try {
        const response = await fetch('https://api.github.com/user', {
            headers: { 'Authorization': `token ${token}` }
        });
        
        const data = await response.json();
        res.json({ success: true, user: data });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

// Socket.io events
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-room', ({ roomId, username, permission }) => {
    let room = rooms.get(roomId);
    
    if (!room) {
      room = {
        code: '// Welcome to the collaborative code editor\n// Start coding here...',
        language: 'javascript',
        users: new Map(),
        messages: []
      };
      rooms.set(roomId, room);
    }

    const user = {
      id: socket.id,
      username,
      permission,
      joinedAt: new Date()
    };

    room.users.set(socket.id, user);
    socket.join(roomId);
    socket.data = { roomId, username, permission };

    socket.emit('code-update', room.code);
    
    io.to(roomId).emit('user-joined', {
      users: Array.from(room.users.values()),
      newUser: user
    });

    socket.emit('chat-history', room.messages);
  });

  socket.on('code-change', ({ roomId, code, language }) => {
    const room = rooms.get(roomId);
    const user = room?.users.get(socket.id);
    
    if (room && user && user.permission === 'edit') {
      room.code = code;
      room.language = language;
      socket.to(roomId).emit('code-update', code);
    }
  });

  socket.on('cursor-move', ({ roomId, position }) => {
    const room = rooms.get(roomId);
    const user = room?.users.get(socket.id);
    if (user) {
      socket.to(roomId).emit('cursor-update', {
        userId: socket.id,
        username: user.username,
        position
      });
    }
  });

  socket.on('send-message', ({ roomId, message, timestamp }) => {
    const room = rooms.get(roomId);
    const user = room?.users.get(socket.id);
    
    if (room && user) {
      const chatMessage = {
        id: uuidv4(),
        username: user.username,
        message,
        timestamp,
        userId: socket.id
      };
      room.messages.push(chatMessage);
      if (room.messages.length > 100) {
        room.messages = room.messages.slice(-100);
      }
      io.to(roomId).emit('new-message', chatMessage);
    }
  });

  socket.on('change-permission', ({ roomId, userId, newPermission }) => {
    const room = rooms.get(roomId);
    const requester = room?.users.get(socket.id);
    const targetUser = room?.users.get(userId);
    
    if (requester && targetUser && Array.from(room.users.values())[0]?.id === requester.id) {
      targetUser.permission = newPermission;
      io.to(roomId).emit('permission-changed', {
        userId,
        newPermission,
        username: targetUser.username
      });
    }
  });

  socket.on('language-change', ({ roomId, language }) => {
    const room = rooms.get(roomId);
    if (room) {
      room.language = language;
      io.to(roomId).emit('language-update', language);
    }
  });

  // Video Call Signaling
  socket.on('join-video-room', ({ roomId, userId, username }) => {
      socket.join(`video_${roomId}`);
      socket.to(`video_${roomId}`).emit('user-joined-video', {
          userId,
          username,
          socketId: socket.id
      });
      
      if (!global.videoRooms) global.videoRooms = new Map();
      if (!global.videoRooms.get(roomId)) {
          global.videoRooms.set(roomId, new Map());
      }
      global.videoRooms.get(roomId).set(socket.id, { userId, username });
  });

  socket.on('video-offer', ({ offer, to, roomId }) => {
      socket.to(to).emit('video-offer', { offer, from: socket.id, roomId });
  });

  socket.on('video-answer', ({ answer, to, roomId }) => {
      socket.to(to).emit('video-answer', { answer, from: socket.id, roomId });
  });

  socket.on('ice-candidate', ({ candidate, to, roomId }) => {
      socket.to(to).emit('ice-candidate', { candidate, from: socket.id, roomId });
  });

  socket.on('leave-video-room', ({ roomId }) => {
      socket.leave(`video_${roomId}`);
      socket.to(`video_${roomId}`).emit('user-left-video', { socketId: socket.id });
      if (global.videoRooms?.get(roomId)) {
          global.videoRooms.get(roomId).delete(socket.id);
      }
  });

  socket.on('disconnect', () => {
        if (global.videoRooms) {
        for (const [roomId, users] of global.videoRooms.entries()) {
            if (users.has(socket.id)) {
                users.delete(socket.id);
                socket.to(`video_${roomId}`).emit('user-left-video', { socketId: socket.id });
                if (users.size === 0) {
                    global.videoRooms.delete(roomId);
                }
                break;
            }
        }
    }
    for (const [roomId, room] of rooms.entries()) {
      if (room.users.has(socket.id)) {
        const user = room.users.get(socket.id);
        room.users.delete(socket.id);
        
        io.to(roomId).emit('user-left', {
          userId: socket.id,
          username: user.username,
          users: Array.from(room.users.values())
        });
        
        if (room.users.size === 0) {
          rooms.delete(roomId);
        }
        break;
      }
    }
  });
});

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});