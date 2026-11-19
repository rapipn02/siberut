import { Timestamp } from "firebase-admin/firestore";
import { getAdmin, FCM_TOPIC } from "@/lib/firebaseAdmin";
import { operatorDariToken, tolakAkses } from "@/lib/authServer";

export async function POST(request: Request) {
  // Push ke HP seluruh warga — hanya operator yang login.
  const operator = await operatorDariToken(request);
  if (!operator) return tolakAkses();

  let body: { title?: string; message?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Body tidak valid" }, { status: 400 });
  }

  const title = (body.title ?? "").trim();
  const message = (body.message ?? "").trim();
  if (!title || !message) {
    return Response.json(
      { ok: false, error: "Judul & pesan wajib diisi" },
      { status: 400 },
    );
  }

  const admin = getAdmin();
  if (!admin) {
    return Response.json({ ok: true, mode: "mock", recipients: FCM_TOPIC });
  }

  try {
    const messageId = await admin.messaging.send({
      topic: FCM_TOPIC,
      notification: { title, body: message },
      android: { priority: "high" },
      data: { type: "broadcast_alert" },
    });

    await admin.db.collection("broadcast_notifications").add({
      title,
      message,
      target_topic: FCM_TOPIC,
      timestamp: Timestamp.now(),
      dibuat_oleh: operator.uid,
    });

    return Response.json({ ok: true, mode: "fcm", messageId, topic: FCM_TOPIC });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Gagal mengirim broadcast";
    console.error("Broadcast gagal:", detail);
    return Response.json({ ok: false, error: detail }, { status: 502 });
  }
}
