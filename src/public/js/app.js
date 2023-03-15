const socket = io();
const room = document.querySelector('#room');
const welcome = document.querySelector('#welcome');
const form = welcome.querySelector('form');
const myFace = document.querySelector('#myFace')
const muteBtn = document.querySelector('#mute');
const cameraBtn = document.querySelector('#camera')
const camerasSelect = document.querySelector('#cameras');
let myStream;
let myPeerConnection;
let muted = false;
let cameraOff = false;
let roomName;
room.hidden = true;

async function getCameras() {
    try{
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cameras = devices.filter(device => device.kind === 'videoinput')
        const currentCamera = myStream.getVideoTracks()[0];
        cameras.forEach(camera => {
            const option = document.createElement('option');
            option.value = camera.deviceId;
            option.innerText = camera.label;
            if(currentCamera.label === camera.label){
                option.selected = true
            }
            camerasSelect.appendChild(option)
        })
    }catch(e){
        console.log(e)
    }
}
async function getMedia(deviceId) {
    const initialConstrains = {
        audio: true, 
        video: {facingMode: 'user'}
    }
    const cameraConstrains = {
        audio: true,
        video: {deviceId: {exact: deviceId}}
    }
    try{
        myStream = await navigator.mediaDevices.getUserMedia(
            deviceId ? cameraConstrains : initialConstrains
        )
        myFace.srcObject = myStream
        if(!deviceId){
            await getCameras()
        }
       
    }catch(e) {
        console.log(e)
    }
}


function handleMuteClick() {
    myStream
    .getAudioTracks()
    .forEach(track => {
        track.enabled = !track.enabled
    })
    if(!muted){
        muteBtn.innerText = "volume_off"
        muted = true
    }else {
        muteBtn.innerText = "volume_up"
        muted = false
    }
}
function handleCameraClick() {
    myStream
    .getVideoTracks()
    .forEach(track => {
        track.enabled = !track.enabled
    })
    if(!cameraOff){
        cameraBtn.innerText = "videocam_off"
        cameraOff = true
    }else {
        cameraOff = false
        cameraBtn.innerText = "videocam"
    }
}
async function handleCameraChange() {
   await getMedia(camerasSelect.value)
   if(myPeerConnection) {
        const videoTrack = myStream.getVideoTracks()[0];
        const videoSender = myPeerConnection
        .getSenders()
        .find(sender => sender.track.kind === 'video');
        console.log(videoSender)
        videoSender.replaceTrack(videoTrack)
   }
}

function makeConnection() {
    myPeerConnection = new RTCPeerConnection({
        iceServers: [
            {
                urls: [
                "stun:stun.l.google.com:19302",
                "stun:stun1.l.google.com:19302",
                "stun:stun2.l.google.com:19302",
                "stun:stun3.l.google.com:19302",
                "stun:stun4.l.google.com:19302",
                ],
            },
        ],
    });
    myPeerConnection.addEventListener('icecandidate', handleIce)
    myPeerConnection.addEventListener('addstream', handleAddStream)
    myStream
        .getTracks()
        .forEach(track => myPeerConnection.addTrack(track, myStream))
}
function handleIce(data){
    console.log('send Candidate')
    socket.emit('ice', data.candidate, roomName)
   
}
function handleAddStream(data) {
    const peersStream = document.querySelector('#peersStream #peersFace')
    peersStream.srcObject = data.stream;
    console.log('Peer stream ', data.stream)
    console.log('my Stream', myStream)
}
async function startMedia() {
    await getMedia();
    makeConnection();
}
muteBtn.addEventListener('click', handleMuteClick)
cameraBtn.addEventListener('click', handleCameraClick)
camerasSelect.addEventListener('input', handleCameraChange)

function addMessage (message, nickname) {
    const ul = room.querySelector('ul');
    const li = document.createElement('li');
    li.className = 'message';
    if(nickname){
        li.className = 'response';
    }
   
    li.innerText = message;
    ul.appendChild(li);
}
const handleMessageSubmit = (e) => {
    e.preventDefault();
    const input = room.querySelector('#msg input');
    const value = input.value;
    socket.emit('new_message', input.value,roomName,() => {
        addMessage(`You ${value}`)
    });
    input.value = ""
}
function handleNicknameSubmit(e) {
    e.preventDefault();
    const input = room.querySelector('#name input');
    socket.emit('nickname', input.value)
}
const showRoom = ({roomName, nickName}) => {
    welcome.hidden = true;
    room.hidden = false;
    const roomh3 = room.querySelector('h3.room-name');
    const nickh3 = room.querySelector('h3.nickname');
    roomh3.innerText = `Room ${roomName}`
    nickh3.innerText = `Name ${nickName}`
    const msgForm = room.querySelector('#msg');
    const nameForm = room.querySelector('#name');
    msgForm.addEventListener('submit', handleMessageSubmit)
    nameForm.addEventListener('submit', handleNicknameSubmit)
}

const handleWelcomeSubmit = async (event) => {
    event.preventDefault()
    const roomInput = form.querySelector('#room_name');
    const nickInput = form.querySelector('#nick_name');
    await startMedia();
    socket.emit('enter_room', {roomName: roomInput.value, nickName: nickInput.value}, showRoom)
    roomName = roomInput.value
    roomInput.value = ""
}



form.addEventListener('submit', handleWelcomeSubmit)

socket.on('welcome', async (user, newCount) => {
    const roomh3 = room.querySelector('h3.room-name');
    roomh3.innerText = `Room ${roomName} (${newCount})`
    addMessage(`${user} Joined`)
    const offer = await myPeerConnection.createOffer();
    myPeerConnection.setLocalDescription(offer)
    socket.emit('offer', offer, roomName)
})

socket.on('bye', (left, newCount) => {
    const roomh3 = room.querySelector('h3.room-name');
    roomh3.innerText = `Room ${roomName} (${newCount})`
    addMessage(`${left} Left`)
})
socket.on('new_message', addMessage);

socket.on('room_change', rooms => {
    const roomList = welcome.querySelector('ul#available-rooms');
    roomList.innerHTML = ""
    if(rooms.length === 0) {
        return;
    }
    rooms.forEach(room => {
        const li = document.createElement('li');
        li.innerText = room;
        roomList.append(li)
    })
})

socket.on('offer', async (offer) => {
   myPeerConnection.setRemoteDescription(offer)
   const answer = await myPeerConnection.createAnswer();
   myPeerConnection.setLocalDescription(answer);
   socket.emit('answer', answer, roomName)
})

socket.on('answer', answer => {
    myPeerConnection.setRemoteDescription(answer)
})

socket.on('ice', ice => {
    console.log('recieved candidate`')
    myPeerConnection.addIceCandidate(ice)
})