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
app.use("/uploads", express.static(path.join(__dirname, "public/uploads")));

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
  socket.on("join-room", (userId) => {
    socket.join(userId);
  });

  socket.on("join-owner-room", () => {
    socket.join("owner");
    console.log(`Admin ${socket.id} joined owner room`);
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

app.use("/auth", require("./routes/auth"));
app.use("/products", require("./routes/products"));
app.use("/sales", require("./routes/sales"));
app.use("/returns", require("./routes/returns"));
app.use("/archives", require("./routes/archives"));
app.use("/stockin", require("./routes/stockin"));
app.use("/shifts", require("./routes/shifts"));

// 6. DB connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.error("MongoDB connection error:", err));