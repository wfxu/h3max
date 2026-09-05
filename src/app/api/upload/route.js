import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getFal, hasFalKey } from "@/lib/fal";

const MAX_BYTES = 30 * 1024 * 1024;
const MAX_INLINE_BYTES = 4 * 1024 * 1024;
const ALLOWED_TYPES = /^(image|video|audio)\//;

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Please sign in to upload files." }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }
    if (!ALLOWED_TYPES.test(file.type || "")) {
      return NextResponse.json({ error: "Only image, video and audio files are accepted." }, { status: 415 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "File is too large (max 30 MB)." }, { status: 413 });
    }

    if (!hasFalKey()) {
      // Mock mode: inline the file so the UI still works without fal.ai storage.
      if (file.size > MAX_INLINE_BYTES) {
        return NextResponse.json({ error: "Mock mode accepts files up to 4 MB." }, { status: 413 });
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      return NextResponse.json({ url: `data:${file.type};base64,${buffer.toString("base64")}` });
    }

    const url = await getFal().storage.upload(file);
    return NextResponse.json({ url });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: error.message || "Upload failed" }, { status: 500 });
  }
}
