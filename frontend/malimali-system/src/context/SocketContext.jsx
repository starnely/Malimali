import { createContext, useContext, useEffect, useState, useCallback, useRef, startTransition } from "react";
import { io } from "socket.io-client";
import { API_BASE_URL } from '@/config/api'

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const [socket, setSocket]           = useState(null);
  const [userTrigger, setUserTrigger] = useState(0);
  const socketRef = useRef(null);

  const refreshSocket = useCallback(() => {
    setUserTrigger(prev => prev + 1);
  }, []);

  useEffect(() => {
    const userString = localStorage.getItem("pos_system_user");

    // No user — disconnect and clear
    if (!userString) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      startTransition(() => setSocket(null));
      return;
    }

    let currentUser;
    try {
      currentUser = JSON.parse(userString);
    } catch {
      return;
    }

    // Disconnect previous socket cleanly before creating new one
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    const newSocket = io(API_BASE_URL, {
      auth: { token: currentUser.token },
      reconnectionAttempts: 5,
      reconnectionDelay:    1000,
    });

    socketRef.current = newSocket;

    const joinRooms = () => {
      if (currentUser.role === "owner") {
        newSocket.emit("join-owner-room");
        newSocket.emit("join-room", "owner");
        const ownerId = currentUser._id || currentUser.id;
        if (ownerId) newSocket.emit("join-room", String(ownerId));
      } else {
        const roomId = currentUser._id || currentUser.id;
        if (roomId) newSocket.emit("join-room", String(roomId));
      }
    };

    newSocket.on("connect", () => {
      console.log("✅ Socket connected:", newSocket.id);
      joinRooms();
    });

    newSocket.on("reconnect", () => {
      console.log("🔄 Socket reconnected");
      joinRooms();
    });

    newSocket.on("disconnect", (reason) => {
      console.log("🔌 Socket disconnected:", reason);
    });

    newSocket.on("connect_error", (err) => {
      console.warn("⚠️ Socket connection error:", err.message);
    });

    // ── startTransition satisfies React 19's no-synchronous-setState
    // rule while avoiding the timing gap that setTimeout caused.
    startTransition(() => setSocket(newSocket));

    return () => {
      newSocket.off("connect");
      newSocket.off("reconnect");
      newSocket.off("disconnect");
      newSocket.off("connect_error");
      newSocket.disconnect();
      socketRef.current = null;
    };

  }, [userTrigger]);

  return (
    <SocketContext.Provider value={{ socket, refreshSocket }}>
      {children}
    </SocketContext.Provider>
  );
}

export const useSocket = () => {
  const context = useContext(SocketContext);
  return context ? context.socket : null;
};

export const useSocketActions = () => {
  const context = useContext(SocketContext);
  return { refreshSocket: context ? context.refreshSocket : () => {} };
};
