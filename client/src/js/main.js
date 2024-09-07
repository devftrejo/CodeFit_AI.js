// OpenAI API & Express Server:

const chatMessages = document.getElementById("chatMessages");
const userInput = document.getElementById("userInput");
const sendButton = document.getElementById("sendButton");

function addMessage(content, isUser = false) {
  const messageElement = document.createElement("div");
  messageElement.classList.add("message");
  messageElement.classList.add(isUser ? "user-message" : "bot-message");
  messageElement.textContent = content;
  chatMessages.appendChild(messageElement);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return messageElement;
}

async function sendMessage() {
  const message = userInput.value.trim();
  const systemMessage =
    "You are a helpful coding assistant. Your name is 'Code Fit AI JS'. You will be provided with a piece of JavaScript code, and your task is to explain it in a concise way. Do not answer queries unrelated to code. Never break character.";
  if (message) {
    addMessage(message, true);
    userInput.value = "";

    const botMessageElement = addMessage("", false);

    try {
      const response = await fetch("http://localhost:3000/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message, systemMessage }),
      });

      if (!response.ok) {
        throw new Error("Network response was not ok");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let botReply = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const dataStr = line.slice(6);
            if (dataStr === "[DONE]") break;
            const data = JSON.parse(dataStr);
            botReply += data.content;
            botMessageElement.textContent = botReply;
            chatMessages.scrollTop = chatMessages.scrollHeight;
          }
        }
      }
    } catch (error) {
      console.error("Error:", error);
      addMessage("An error occurred while processing your request.");
    }
  }
}

sendButton.addEventListener("click", sendMessage);
userInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    sendMessage();
  }
});
