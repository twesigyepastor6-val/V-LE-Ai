export interface ChatAttachment {
  name: string;
  type: string;
  size: number;
  content: string; // base64 or text content
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  /** Mirrors Python's `record=False` for welcome/system greeting bubbles */
  ephemeral?: boolean;
  attachment?: ChatAttachment;
}

export interface SavedSession {
  id: string;
  title: string;
  saved_at: string;
  messages: ChatMessage[];
}

export interface QuickAction {
  id: string;
  label: string;
  prompt: string;
}

export interface PythonBundle {
  pythonFilename: string;
  pythonCode: string;
  configFilename: string;
  configTemplate: string;
}
