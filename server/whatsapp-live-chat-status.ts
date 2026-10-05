import mongoose from "mongoose";
import type { LiveChatReportStatus } from "./whatsapp-live-chat";

const statusSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  status: { type: String, enum: ["recorded", "failed"], required: true },
  reason: { type: String },
  at: { type: String, required: true },
}, { bufferCommands: false });

const StatusModel = mongoose.model("WhatsAppLiveChatStatus", statusSchema);

function connectionKey() {
  return JSON.stringify([
    process.env.AIRAVATA_API_BASE_URL?.trim().replace(/\/$/, "") || "",
    process.env.WHATSAPP_PHONE_NUMBER_ID?.trim() || "",
  ]);
}

export async function saveLiveChatReportStatus(report: LiveChatReportStatus) {
  // Compare timestamps atomically so concurrent requests cannot overwrite a newer result.
  const newer = { $gte: [report.at, { $ifNull: ["$at", ""] }] };
  await StatusModel.updateOne({ _id: connectionKey() }, [{
    $set: {
      status: { $cond: [newer, { $literal: report.status }, "$status"] },
      at: { $cond: [newer, { $literal: report.at }, "$at"] },
      reason: { $cond: [newer, { $literal: report.reason || null }, "$reason"] },
    },
  }], { upsert: true, updatePipeline: true, maxTimeMS: 4000 }).exec();
}

export async function loadLiveChatReportStatus(): Promise<LiveChatReportStatus | null> {
  const doc = await StatusModel.findById(connectionKey()).maxTimeMS(4000).lean().exec();
  if (!doc) return null;
  return {
    status: doc.status as LiveChatReportStatus["status"],
    at: doc.at,
    ...(doc.reason ? { reason: doc.reason } : {}),
  };
}
