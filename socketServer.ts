import {Server as SocketIoServer } from "socket.io";
import http from "http";

export const initSocketServer = (server: http.Server) => {
    const io = new SocketIoServer(server);

    io.on("connection", (socket) => {
        console.log("A User Connected");

        // Listen for 'notification' event from the frontend 
        socket.on("notification", (data) => {
            // Broadcast the notification to all connected clients (admin dashboard)
            io.emit("newNotification", data);
        }) ;

        socket.on("disconnect", () => {
            console.log("A User Disconnected ");
            
        })
        
    })
}