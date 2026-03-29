// Video Call Module - Complete Working Version
let localStream = null;
let peerConnections = new Map(); // Store multiple peer connections
let videoRoomId = null;
let isVideoCallActive = false;

const configuration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' },
        {
            urls: 'turn:openrelay.metered.ca:80',
            username: 'openrelayproject',
            credential: 'openrelayproject'
        },
        {
            urls: 'turn:openrelay.metered.ca:443',
            username: 'openrelayproject',
            credential: 'openrelayproject'
        }
    ]
};

// Initialize video call UI
function initVideoCall() {
    if (document.getElementById('video-container')) return;
    
    const videoContainer = document.createElement('div');
    videoContainer.id = 'video-container';
    videoContainer.innerHTML = `
        <div class="video-header">
            <h3><i class="fas fa-video"></i> Video Call</h3>
        </div>
        <div id="video-grid" class="video-grid">
            <div id="local-video-container" class="video-container">
                <video id="local-video" autoplay muted playsinline></video>
                <div class="video-label">You (${currentUser?.username || 'You'})</div>
            </div>
        </div>
        <div id="video-controls" class="video-controls" style="display: none;">
            <button id="toggle-video-btn" class="video-control-btn">
                <i class="fas fa-video"></i>
            </button>
            <button id="toggle-audio-btn" class="video-control-btn">
                <i class="fas fa-microphone"></i>
            </button>
            <button id="screen-share-btn" class="video-control-btn">
                <i class="fas fa-desktop"></i>
            </button>
            <button id="end-call-btn" class="video-control-btn end-call">
                <i class="fas fa-phone-slash"></i>
            </button>
        </div>
        <button id="start-video-call" class="start-video-btn">
            <i class="fas fa-video"></i> Start Video Call
        </button>
    `;
    
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
        sidebar.insertBefore(videoContainer, sidebar.firstChild);
    }
    
    // Add event listeners
    document.getElementById('start-video-call')?.addEventListener('click', startVideoCall);
    document.getElementById('toggle-video-btn')?.addEventListener('click', toggleVideo);
    document.getElementById('toggle-audio-btn')?.addEventListener('click', toggleAudio);
    document.getElementById('screen-share-btn')?.addEventListener('click', shareScreen);
    document.getElementById('end-call-btn')?.addEventListener('click', endVideoCall);
}

// Start video call
async function startVideoCall() {
    if (!socket || !socket.connected) {
        showNotification('Please wait for connection...', 'error');
        return;
    }
    
    try {
        // Request camera and microphone access
        localStream = await navigator.mediaDevices.getUserMedia({ 
            video: true, 
            audio: true 
        });
        
        const localVideo = document.getElementById('local-video');
        if (localVideo) {
            localVideo.srcObject = localStream;
        }
        
        videoRoomId = currentRoomId;
        isVideoCallActive = true;
        
        // Join video room
        socket.emit('join-video-room', {
            roomId: videoRoomId,
            userId: socket.id,
            username: currentUser?.username || 'User'
        });
        
        // Update UI
        document.getElementById('start-video-call').style.display = 'none';
        document.getElementById('video-controls').style.display = 'flex';
        
        showNotification('Video call started! Waiting for others to join...', 'success');
        
        // Setup video socket listeners
        setupVideoSocketListeners();
        
    } catch (error) {
        console.error('Error starting video call:', error);
        showNotification('Could not access camera/microphone. Please check permissions.', 'error');
    }
}

// Setup WebRTC socket listeners
function setupVideoSocketListeners() {
    // Remove existing listeners to avoid duplicates
    socket.off('user-joined-video');
    socket.off('video-offer');
    socket.off('video-answer');
    socket.off('ice-candidate');
    socket.off('user-left-video');
    
    // When a new user joins the video room
    socket.on('user-joined-video', async ({ userId, username, socketId }) => {
        console.log('User joined video:', username, socketId);
        
        if (socketId !== socket.id && !peerConnections.has(socketId)) {
            // Create peer connection for this user
            await createPeerConnection(socketId, username, true);
        }
    });
    
    // Handle video offer
    socket.on('video-offer', async ({ offer, from }) => {
        console.log('Received video offer from:', from);
        
        if (!peerConnections.has(from)) {
            await createPeerConnection(from, 'Remote User', false);
        }
        
        const pc = peerConnections.get(from);
        if (pc && !pc.currentRemoteDescription) {
            await pc.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket.emit('video-answer', { answer, to: from, roomId: videoRoomId });
        }
    });
    
    // Handle video answer
    socket.on('video-answer', async ({ answer, from }) => {
        console.log('Received video answer from:', from);
        
        const pc = peerConnections.get(from);
        if (pc) {
            await pc.setRemoteDescription(new RTCSessionDescription(answer));
        }
    });
    
    // Handle ICE candidates
    socket.on('ice-candidate', async ({ candidate, from }) => {
        const pc = peerConnections.get(from);
        if (pc) {
            try {
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (error) {
                console.error('Error adding ICE candidate:', error);
            }
        }
    });
    
    // Handle user leaving video room
    socket.on('user-left-video', ({ socketId }) => {
        console.log('User left video:', socketId);
        removeRemoteVideo(socketId);
        
        const pc = peerConnections.get(socketId);
        if (pc) {
            pc.close();
            peerConnections.delete(socketId);
        }
    });
}

// Create peer connection for a remote user
async function createPeerConnection(remoteSocketId, username, isInitiator) {
    console.log('Creating peer connection for:', remoteSocketId, 'Initiator:', isInitiator);
    
    const pc = new RTCPeerConnection(configuration);
    peerConnections.set(remoteSocketId, pc);
    
    // Add local stream tracks
    if (localStream) {
        localStream.getTracks().forEach(track => {
            pc.addTrack(track, localStream);
        });
    }
    
    // Handle remote stream
    pc.ontrack = (event) => {
        console.log('Received remote stream from:', remoteSocketId);
        addRemoteVideo(remoteSocketId, username, event.streams[0]);
    };
    
    // Handle ICE candidates
    pc.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('ice-candidate', {
                candidate: event.candidate,
                to: remoteSocketId,
                roomId: videoRoomId
            });
        }
    };
    
    // Handle connection state changes
    pc.onconnectionstatechange = () => {
        console.log('Connection state:', pc.connectionState);
        if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
            removeRemoteVideo(remoteSocketId);
            peerConnections.delete(remoteSocketId);
        }
    };
    
    // If initiator, create and send offer
    if (isInitiator) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('video-offer', {
            offer: offer,
            to: remoteSocketId,
            roomId: videoRoomId
        });
    }
    
    return pc;
}

// Add remote video to grid
function addRemoteVideo(socketId, username, stream) {
    const videoGrid = document.getElementById('video-grid');
    if (!videoGrid) return;
    
    // Check if container already exists
    let container = document.getElementById(`remote-container-${socketId}`);
    if (!container) {
        container = document.createElement('div');
        container.id = `remote-container-${socketId}`;
        container.className = 'video-container';
        container.innerHTML = `
            <video id="remote-video-${socketId}" autoplay playsinline></video>
            <div class="video-label">${escapeHtml(username)}</div>
        `;
        videoGrid.appendChild(container);
    }
    
    const remoteVideo = document.getElementById(`remote-video-${socketId}`);
    if (remoteVideo && remoteVideo.srcObject !== stream) {
        remoteVideo.srcObject = stream;
    }
}

// Remove remote video
function removeRemoteVideo(socketId) {
    const container = document.getElementById(`remote-container-${socketId}`);
    if (container) {
        container.remove();
    }
}

// Toggle video
function toggleVideo() {
    if (localStream) {
        const videoTrack = localStream.getVideoTracks()[0];
        if (videoTrack) {
            videoTrack.enabled = !videoTrack.enabled;
            const btn = document.getElementById('toggle-video-btn');
            if (btn) {
                btn.innerHTML = videoTrack.enabled ? '<i class="fas fa-video"></i>' : '<i class="fas fa-video-slash"></i>';
            }
        }
    }
}

// Toggle audio
function toggleAudio() {
    if (localStream) {
        const audioTrack = localStream.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.enabled = !audioTrack.enabled;
            const btn = document.getElementById('toggle-audio-btn');
            if (btn) {
                btn.innerHTML = audioTrack.enabled ? '<i class="fas fa-microphone"></i>' : '<i class="fas fa-microphone-slash"></i>';
            }
        }
    }
}

// Share screen
async function shareScreen() {
    try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        
        // Replace video track with screen share
        const videoTrack = screenStream.getVideoTracks()[0];
        const sender = peerConnections.values().next().value?.getSenders().find(s => s.track?.kind === 'video');
        
        if (sender) {
            sender.replaceTrack(videoTrack);
        }
        
        // Update local video
        const localVideo = document.getElementById('local-video');
        if (localVideo) {
            localVideo.srcObject = screenStream;
        }
        
        videoTrack.onended = () => {
            // Switch back to camera when screen share ends
            if (localStream) {
                const cameraTrack = localStream.getVideoTracks()[0];
                if (sender) {
                    sender.replaceTrack(cameraTrack);
                }
                if (localVideo) {
                    localVideo.srcObject = localStream;
                }
            }
        };
        
        showNotification('Screen sharing started', 'success');
    } catch (error) {
        console.error('Screen sharing error:', error);
        showNotification('Screen sharing cancelled or failed', 'info');
    }
}

// End video call
function endVideoCall() {
    // Close all peer connections
    for (const [socketId, pc] of peerConnections.entries()) {
        pc.close();
        removeRemoteVideo(socketId);
    }
    peerConnections.clear();
    
    // Stop local stream
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    
    // Leave video room
    if (socket && videoRoomId) {
        socket.emit('leave-video-room', { roomId: videoRoomId });
    }
    
    // Reset UI
    const localVideo = document.getElementById('local-video');
    if (localVideo) {
        localVideo.srcObject = null;
    }
    
    document.getElementById('start-video-call').style.display = 'flex';
    document.getElementById('video-controls').style.display = 'none';
    
    isVideoCallActive = false;
    videoRoomId = null;
    
    showNotification('Video call ended', 'info');
}

// Clean up function for when user leaves room
function cleanupVideoCall() {
    if (isVideoCallActive) {
        endVideoCall();
    }
}