const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path"); // Added for file path handling
const { Server } = require("socket.io");
require("dotenv").config();

const app = express();

// 1. Middleware
app.use(cors());
app.use(express.json());

// ✅ NEW: Serve static files from the uploads folder
// This allows the frontend to access logos via: http://localhost:5000/uploads/logo/filename.png
app.use(express.static(path.join(__dirname, "public")));

// 2. Initialize Server & Socket.IO
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

const io = new Server(server, {
  cors: { origin: "*" }
});

// 3. Make IO available globally
app.set("io", io);

// 4. Socket.io Connection Logic
io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  // Allow users to join personal rooms or the owner room
  socket.on("join-room", (roomName) => {
    socket.join(roomName);
    console.log(`Socket ${socket.id} joined room: ${roomName}`);
  });

  socket.on("join-owner-room", () => {
    socket.join("owner");
    console.log(`Admin ${socket.id} joined owner room`);
  });

  socket.on("shift-closed", (data) => {
    console.log(`Notification: ${data.employeeName} closed shift.`);

    // Send it ONLY to the owner room
    io.to("owner").emit("adminShiftNotification", {
      employeeName: data.employeeName,
      time: data.time || new Date().toLocaleTimeString(),
      message: "Shift Closed"
    });
  });

  socket.on("join", (room) => {
    socket.join(room);
    console.log(`Socket ${socket.id} joined room: ${room}`);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected");
  });
});

// 5. Routes
// ✅ NEW: Setup and Activation Route
app.use("/api/setup", require("./routes/setup"));

app.use("/api/auth", require("./routes/auth"));
app.use("/api/products", require("./routes/products"));
app.use("/api/sales", require("./routes/sales"));
app.use("/api/returns", require("./routes/returns"));
app.use("/api/archives", require("./routes/archives"));
app.use("/api/stockin", require("./routes/stockin"));
app.use("/api/shifts", require("./routes/shifts"));

// 6. DB connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.error("MongoDB connection error:", err));