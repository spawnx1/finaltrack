const express = require('express');
const app = express();
const path = require("path");

const http=require('http');//socket io need http server
const socketio=require('socket.io');// setting up socketio


const server = http.createServer(app);//main method(create server)


const io = socketio(server);// io variable is initiaalized 

app.set('view engine', 'ejs');//setup ejs (ejs=view engine)
app.use(express.static(path.join(__dirname, 'public')));//setup static files

io.on("connection", function (socket) {
  socket.on("send-Location", function(data){
    io.emit("receive-location",{id:socket.id, ...data} );// emit to all clients except sender(send to frontend)
  });
  socket.on("disconnect",function(){
    io.emit("user-disconnected", socket.id);// emit to all clients except sender(send to frontend)
  })
});



app.get("/", (req, res) => {
    res.render("index");
});

server.listen(3000, () => {
    console.log("Server running on http://localhost:3000");
});
// everything is running on server for now server and socketio is connected

