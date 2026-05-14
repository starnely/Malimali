import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { io } from "socket.io-client";

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
    const [socket, setSocket] = useState(null);
    const [userTrigger, setUserTrigger] = useState(0);

    const refreshSocket = useCallback(() => {
        setUserTrigger(prev => prev + 1);
    }, []);

    useEffect(() => {
        // ✅ Matches the key used in your AppContext
        const userString = localStorage.getItem("pos_system_user");
        
        if (!userString) {
            if (socket) {
                socket.disconnect();
                setSocket(null);
            }
            return;
        }

        const currentUser = JSON.parse(userString);
        
        const newSocket = io("http://localhost:5000", {
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
        });

        newSocket.on("connect", () => {
            console.log("✅ Socket Connected. ID:", newSocket.id);
            
            if (currentUser.role === "owner" || currentUser.role === "admin") {
                console.log("📢 Joining owner room...");
                newSocket.emit("join-room", "owner");
            } else {
                console.log(`📢 Joining user room: ${currentUser.id}`);
                newSocket.emit("join-room", currentUser.id);
            }
        });

        newSocket.on("reconnect", () => {
            if (currentUser.role === "owner" || currentUser.role === "admin") {
                newSocket.emit("join-room", "owner");
            }
        });

        setSocket(newSocket);
        
        return () => { 
            newSocket.off("connect");
            newSocket.off("reconnect");
            newSocket.disconnect(); 
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