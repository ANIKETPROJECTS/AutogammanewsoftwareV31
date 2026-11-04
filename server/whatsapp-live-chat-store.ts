import mongoose from "mongoose";

export type LiveChatStatus = "OPEN" | "SENT" | "CLOSED";
export type LiveChatDirection = "INBOUND" | "OUTBOUND";

const conversationSchema = new mongoose.Schema({
  phone: { type: String, required: true, unique: true },
  contactName: { type: String, default: "" },
  status: { type: String, enum: ["OPEN", "SENT", "CLOSED"], default: "OPEN" },
  lastMessage: { type: String, default: "" },
  lastMessageAt: { type: String, default: "" },
  latestInboundAt: { type: String, default: "" },
  unreadCount: { type: Number, default: 0 },
}, { timestamps: true });

const messageSchema = new mongoose.Schema({
  whatsappMessageId: { type: String, required: true, unique: true },
  phone: { type: String, required: true, index: true },
  direction: { type: String, enum: ["INBOUND", "OUTBOUND"], required: true },
  type: { type: String, default: "text" },
  text: { type: String, default: "" },
  timestamp: { type: String, required: true },
  status: { type: String, default: "received" },
}, { timestamps: true });
messageSchema.index({ phone: 1, timestamp: 1 });

const Conversation = mongoose.models.WhatsAppChatConversation ||
  mongoose.model("WhatsAppChatConversation", conversationSchema);
const ChatMessage = mongoose.models.WhatsAppChatMessage ||
  mongoose.model("WhatsAppChatMessage", messageSchema);

export function normalizeChatPhone(value: string) {
  return String(value || "").replace(/\D/g, "");
}

export async function saveLiveChatMessage(input: {
  whatsappMessageId: string;
  phone: string;
  contactName?: string;
  direction: LiveChatDirection;
  type?: string;
  text: string;
  timestamp: string;
  status?: string;
}) {
  const phone = normalizeChatPhone(input.phone);
  if (!input.whatsappMessageId || !phone) return false;
  const result = await ChatMessage.updateOne(
    { whatsappMessageId: input.whatsappMessageId },
    { $setOnInsert: {
      ...input,
      phone,
      contactName: undefined,
      status: input.status || (input.direction === "INBOUND" ? "received" : "sent"),
    } },
    { upsert: true },
  );
  if (!result.upsertedCount) return false;

  const messageDate = new Date(input.timestamp);
  const timestamp = Number.isNaN(messageDate.getTime()) ? new Date().toISOString() : messageDate.toISOString();
  const update: Record<string, any> = {
    lastMessage: input.text || `[${input.type || "message"}]`,
    lastMessageAt: timestamp,
    ...(input.direction === "INBOUND"
      ? {
          contactName: input.contactName || `+${phone}`,
          latestInboundAt: timestamp,
          status: "OPEN",
          $inc: { unreadCount: 1 },
        }
      : { status: "SENT" }),
  };
  const { $inc, ...set } = update;
  await Conversation.updateOne(
    { phone },
    {
      $set: set,
      ...($inc ? { $inc } : {}),
      $setOnInsert: { phone, contactName: input.contactName || `+${phone}`, unreadCount: 0 },
    },
    { upsert: true },
  );
  return true;
}

export async function updateLiveChatDelivery(messageId: string, status: string) {
  await ChatMessage.updateOne({ whatsappMessageId: messageId }, { $set: { status } });
}

export async function getLiveChatConversations() {
  return Conversation.find().sort({ lastMessageAt: -1 }).limit(1000).lean();
}

export async function getLiveChatConversation(phoneValue: string) {
  return Conversation.findOne({ phone: normalizeChatPhone(phoneValue) }).lean();
}

export async function getLiveChatMessages(phoneValue: string) {
  const phone = normalizeChatPhone(phoneValue);
  return ChatMessage.find({ phone }).sort({ timestamp: -1 }).limit(200).lean().then(rows => rows.reverse());
}

export async function markLiveChatRead(phoneValue: string) {
  await Conversation.updateOne({ phone: normalizeChatPhone(phoneValue) }, { $set: { unreadCount: 0 } });
}

export async function setLiveChatStatus(phoneValue: string, status: LiveChatStatus) {
  return Conversation.findOneAndUpdate(
    { phone: normalizeChatPhone(phoneValue) },
    { $set: { status } },
    { new: true },
  ).lean();
}
