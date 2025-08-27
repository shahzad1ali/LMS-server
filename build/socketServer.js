"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initSocketServer = void 0;
const socket_io_1 = require("socket.io");
const initSocketServer = (server) => {
    const io = new socket_io_1.Server(server);
    io.on("connection", (socket) => {
        console.log("A User Connected");
        // Listen for 'notification' event from the frontend 
        socket.on("notification", (data) => {
            // Broadcast the notification to all connected clients (admin dashboard)
            io.emit("newNotification", data);
        });
        socket.on("disconnect", () => {
            console.log("A User Disconnected ");
        });
    });
};
exports.initSocketServer = initSocketServer;
