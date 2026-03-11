import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query  = searchParams.get("query");
  const photo  = searchParams.get("photo_reference");
  const apiKey = searchParams.get("key");

  if (!apiKey) return NextResponse.json({ error: "No API key" }, { status: 400 });

  // Photo proxy
  if (photo) {
    const url = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=600&photoreference=${photo}&key=${apiKey}`;
    const r = await fetch(url);
    if (!r.ok) return NextResponse.json({ error: "Photo fetch failed" }, { status: 502 });
    const buf = await r.arrayBuffer();
    return new NextResponse(buf, {
      headers: {
        "Content-Type": r.headers.get("Content-Type") || "image/jpeg",
        "Cache-Control": "public, max-age=86400",
      },
    });
  }

  // Text search
  if (!query) return NextResponse.json({ error: "No query" }, { status: 400 });
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&type=lodging&key=${apiKey}`;
  const r = await fetch(url);
  const d = await r.json();
  return NextResponse.json(d);
}
