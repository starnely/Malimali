import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { io } from "socket.io-client";

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const [socket, setSocket] = useState(null);
  const [userTrigger, setUserTrigger] = useState(0);

  // Triggered manually after Login or Logout to reset the socket
  const refreshSocket = useCallback(() => {
    setUserTrigger(prev => prev + 1);
  }, []);

  useEffect(() => {
    const userString = localStorage.getItem("malimali_current_user");
    
    // If no user is logged in, kill any existing socket
    if (!userString) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      return;
    }

    const currentUser = JSON.parse(userString);
    
    // Initialize connection
    const newSocket = io("http://localhost:5000", {
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    newSocket.on("connect", () => {
      console.log("✅ Socket Connected. Role:", currentUser.role);
      
      // Auto-join appropriate rooms based on role
      if (currentUser.role === "owner" || currentUser.role === "admin") {
        console.log("📢 Joining owner room...");
        newSocket.emit("join-owner-room");
      } else {
        console.log(`📢 Joining user room: ${currentUser.id}`);
        newSocket.emit("join-room", currentUser.id);
      }
    });

    // Re-join rooms automatically if the server restarts
    newSocket.on("reconnect", () => {
      console.log("🔄 Socket Reconnected. Re-joining rooms...");
      if (currentUser.role === "owner" || currentUser.role === "admin") {
        newSocket.emit("join-owner-room");
      } else {
        newSocket.emit("join-room", currentUser.id);
      }
    });

    setSocket(newSocket);
    
    // Cleanup on unmount or trigger change
    return () => { 
      newSocket.off("connect");
      newSocket.off("reconnect");
      newSocket.disconnect(); 
    };
    // socket is excluded from dependencies to prevent infinite loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userTrigger]); 

  return (
    <SocketContext.Provider value={{ socket, refreshSocket }}>
      {children}
    </SocketContext.Provider>
  );
}

// Hook to get the actual socket instance
export const useSocket = () => {
  const context = useContext(SocketContext);
  return context ? context.socket : null;
};

// Hook to trigger a refresh (call this after login/logout)
export const useSocketActions = () => {
  const context = useContext(SocketContext);
  return {
    refreshSocket: context ? context.refreshSocket : () => {},
  };
};