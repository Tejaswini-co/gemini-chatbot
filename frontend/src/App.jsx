import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import "./index.css";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "/api";

function App() {
  const [chats, setChats] = useState([
      {
        id: 1,
        title: "New chat",
        history: [],
        documentName: null,
        documentFile: null,
        imageName: null,
        imageFile: null,
        imagePreview: null,
      },
  ]);
  const [activeChatId, setActiveChatId] = useState(1);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState("Thinking...");
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem("gemini-chat-theme") === "dark";
  });
  const [copiedMessageIndex, setCopiedMessageIndex] = useState(null);
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);

  const activeChat = chats.find((chat) => chat.id === activeChatId);

  useEffect(() => {
    localStorage.setItem("gemini-chat-theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  useEffect(() => {
    if (!loading) return;

    const intervalId = setInterval(async () => {
      try {
        const response = await axios.get(
          `${API_BASE_URL}/chat/status/${encodeURIComponent(activeChatId)}`
        );
        if (response.data.status && response.data.status !== "Idle") {
          setLoadingStatus(response.data.status);
        }
      } catch (error) {
        console.error("Could not fetch status:", error);
      }
    }, 500);

    return () => clearInterval(intervalId);
  }, [activeChatId, loading]);

  const handleCopyMessage = async (content, index) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMessageIndex(index);
      setTimeout(() => setCopiedMessageIndex(null), 1400);
    } catch (error) {
      console.error("Could not copy message:", error);
    }
  };

  const handleNewChat = () => {
    const newChatId = chats.length > 0 ? Math.max(...chats.map(c => c.id)) + 1 : 1;
    setChats([
      ...chats,
      {
        id: newChatId,
        title: "New chat",
        history: [],
        documentName: null,
        documentFile: null,
        imageName: null,
        imageFile: null,
        imagePreview: null,
      },
    ]);
    setActiveChatId(newChatId);
  };

  const switchChat = (chatId) => {
    setActiveChatId(chatId);
  };

  const handleSendMessage = async () => {
    if (!message.trim() && !activeChat.imageName) return;

    const newUserMessage = { role: "user", content: message };
    const updatedHistory = [...activeChat.history, newUserMessage];
    updateChat(activeChatId, { history: updatedHistory });

    setLoading(true);
    setLoadingStatus(activeChat.documentFile ? "Processing document..." : "Thinking...");
    setMessage("");

    try {
      const formData = new FormData();
      formData.append("message", message);
      formData.append("chatId", activeChatId);
      
      // Send the selected files from chat state so they survive input resets.
      if (activeChat.documentFile) {
        formData.append("file", activeChat.documentFile);
      }
      
      if (activeChat.imageFile) {
        formData.append("image", activeChat.imageFile);
      }

      const response = await axios.post(`${API_BASE_URL}/chat/message`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      const botMessage = { role: "bot", content: response.data.message };
      const finalHistory = [...updatedHistory, botMessage];
      
      let chatTitle = activeChat.title;
      if (activeChat.history.length === 0 && message.trim()) {
        chatTitle = message.substring(0, 30);
      }

      updateChat(activeChatId, { history: finalHistory, title: chatTitle });

    } catch (error) {
      console.error("Error sending message:", error);
      const detail =
        error.response?.data?.message ||
        error.message ||
        "Sorry, something went wrong. Please try again.";
      const errorMessage = {
        role: "bot",
        content: detail,
      };
      updateChat(activeChatId, { history: [...updatedHistory, errorMessage] });
    } finally {
      setLoading(false);
      setLoadingStatus("Thinking...");
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  };

  const handleFileUpload = (event, fileType) => {
    const file = event.target.files[0];
    if (!file) return;

    if (fileType === "document") {
      updateChat(activeChatId, { documentName: file.name, documentFile: file });
    } else if (fileType === "image") {
      const reader = new FileReader();
      reader.onloadend = () => {
        updateChat(activeChatId, {
          imageName: file.name,
          imageFile: file,
          imagePreview: reader.result,
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const updateChat = (chatId, updates) => {
    setChats(
      chats.map((chat) =>
        chat.id === chatId ? { ...chat, ...updates } : chat
      )
    );
  };

  return (
    <div className={`app ${darkMode ? "dark-mode" : ""}`}>
      <aside className="sidebar">
        <h1>Gemini Chat</h1>
        <button
          className="theme-toggle-btn"
          onClick={() => setDarkMode((current) => !current)}
        >
          {darkMode ? "Light Mode" : "Dark Mode"}
        </button>
        <button className="new-chat-btn" onClick={handleNewChat}>
          New Chat
        </button>
        <div className="chat-history">
          {chats.map((chat) => (
            <div
              key={chat.id}
              className={`chat-history-item ${
                chat.id === activeChatId ? "active" : ""
              }`}
              onClick={() => switchChat(chat.id)}
            >
              <p>{chat.title}</p>
              <span>
                {chat.documentName ? `Doc: ${chat.documentName.substring(0,10)}...` : "No doc"} · {" "}
                {chat.imageName ? `Image: ${chat.imageName.substring(0,10)}...` : "No image"}
              </span>
            </div>
          ))}
        </div>
      </aside>

      <main className="main-content">
        <div className="active-chat-header">
          <h2>{activeChat?.title || "New chat"}</h2>
          <div className="file-info">
            <span>Document: {activeChat?.documentName || "None"}</span>
            <span>Image: {activeChat?.imageName || "None"}</span>
          </div>
        </div>

        <div className="chat-container">
          {activeChat?.history.length === 0 && !loading ? (
            <div className="initial-message">
              Upload a file or ask a question to get started.
            </div>
          ) : (
            activeChat?.history.map((msg, index) => (
              <div
                key={index}
                className={`chat-message ${
                  msg.role === "user" ? "user-message" : "bot-message"
                }`}
              >
                <span>{msg.content}</span>
                {msg.role === "bot" && (
                  <button
                    className="copy-message-btn"
                    onClick={() => handleCopyMessage(msg.content, index)}
                    title="Copy response"
                  >
                    {copiedMessageIndex === index ? "Copied" : "Copy"}
                  </button>
                )}
              </div>
            ))
          )}
          {loading && (
            <div className="chat-message bot-message loading-indicator">
              <span className="status-dot"></span>
              {loadingStatus}
            </div>
          )}
           {activeChat?.imagePreview && (
            <div className="user-message">
              <img src={activeChat.imagePreview} alt="preview" className="image-preview" />
            </div>
          )}
        </div>

        <div className="input-area">
          <div className="upload-buttons">
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: "none" }}
              onChange={(e) => handleFileUpload(e, "document")}
              accept=".pdf,.txt"
            />
            <button className="upload-btn" onClick={() => fileInputRef.current.click()}>
              Upload Document
            </button>
            <input
              type="file"
              ref={imageInputRef}
              style={{ display: "none" }}
              onChange={(e) => handleFileUpload(e, "image")}
              accept=".png,.jpg,.jpeg"
            />
            <button className="upload-btn" onClick={() => imageInputRef.current.click()}>
              Upload Image
            </button>
          </div>
          <div className="message-input-container">
            <input
              type="text"
              className="message-input"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
              placeholder="Type your message..."
            />
            <button className="send-btn" onClick={handleSendMessage} disabled={loading}>
              Send
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
