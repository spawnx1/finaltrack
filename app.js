const express = require('express');
const app = express();
const path = require("path");

const http=require('http');//socket io need http server
const socketio=require('socket.io');// setting up socketio


const server = http.createServer(app);//main method(create server)


const io = socketio(server);// io variable is initiaalized 

app.set('view engine', 'ejs');//setup ejs (ejs=view engine)
app.use(express.static(path.join(__dirname, 'public')));//setup static files

// --- Role management ---
let adminSocketId = null;
let busSocketId = null;

io.on("connection", function (socket) {
  // Handle role selection
  socket.on("select-role", function(data) {
    if(data.role === 'admin' && !adminSocketId) {
      adminSocketId = socket.id;
    } else if(data.role === 'bus' && !busSocketId) {
      busSocketId = socket.id;
    }
    // Broadcast current role assignments to all
    io.emit('role-assignments', { adminId: adminSocketId, busId: busSocketId });
  });

  // Handle location sharing
  socket.on("send-Location", function(data){
    // Attach role to location data
    let role = null;
    if(socket.id === adminSocketId) role = 'admin';
    else if(socket.id === busSocketId) role = 'bus';
    io.emit("receive-location",{id:socket.id, ...data, role} );
  });

  // Handle disconnects
  socket.on("disconnect",function(){
    if(socket.id === adminSocketId) adminSocketId = null;
    if(socket.id === busSocketId) busSocketId = null;
    io.emit("user-disconnected", socket.id);
    // Broadcast updated role assignments
    io.emit('role-assignments', { adminId: adminSocketId, busId: busSocketId });
  });
});



app.get("/", (req, res) => {
    res.render("index");
});

server.listen(3000, () => {
    console.log("Server running on http://localhost:3000");
});
// everything is running on server for now server and socketio is connected

