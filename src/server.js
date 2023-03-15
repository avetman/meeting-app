import http from 'http';
import express from 'express';
const { Server } = require("socket.io");
const { instrument } = require("@socket.io/admin-ui");



const app = express();
app.set('view engine', 'pug');
app.set('views', __dirname + '/views');
app.use('/public', express.static(__dirname + "/public" ));
app.get('/', (_, res) => res.render('home'));
app.get('/*', (_,res) => res.redirect('/'));



const handleListen = () => console.log(`Listening on http://localhost:3000`)

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
      origin: ["https://admin.socket.io"],
      credentials: true
    }
  });
  
  instrument(io, {
    auth: false,
  });

const publicRooms = () => {
    const {
        sockets: {
            adapter: {sids, rooms}
        }
    } = io;
    const publicRooms = [];
    rooms.forEach((_, key) => {
       if(sids.get(key) === undefined) {
        publicRooms.push(key)
       }
    })
    return publicRooms
}
const countRoom = (roomName) => {
    return io.sockets.adapter.rooms.get(roomName)?.size;
}

io.on('connection', socket => {
    socket['nickname'] = 'Anonymous'
    socket.onAny(event => {
        console.log(`Socket Event: ${event}`)
    })
    socket.on('enter_room', ({roomName, nickName}, done) => {
        socket['nickname'] = nickName
        socket.join(roomName)
        done({roomName, nickName})
        socket.to(roomName).emit('welcome', nickName, countRoom(roomName));
        io.sockets.emit('room_change', publicRooms())
    })
    socket.on('disconnecting', () => {
        socket.rooms.forEach(room => socket.to(room).emit('bye', socket.nickname, countRoom(room) - 1));
    })
    socket.on('disconnect', () => {
        io.sockets.emit('room_change', publicRooms())
    })
    socket.on('new_message', (msg,room, done) => {
        socket.to(room).emit('new_message', `${socket.nickname}: ${msg}`, socket.nickname);
        done(socket.nickname)
    })
    socket.on('nickname', nickname => {
         socket['nickname'] = nickname
    })
    socket.on('offer', (offer, roomName) => {
        socket.to(roomName).emit('offer', offer)
    })
    socket.on('answer', (answer, roomName) => {
        socket.to(roomName).emit('answer', answer);
    })
    socket.on('ice', (ice, roomName) => {
        socket.to(roomName).emit('ice', ice)
    })
})



server.listen(3000, handleListen)