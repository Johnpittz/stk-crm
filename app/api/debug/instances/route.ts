import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export async function GET() {
  const url = process.env.EVOLUTION_API_URL;
  const key = process.env.EVOLUTION_API_KEY;
  try {
    const resp = await fetch(`${url}/instance/fetchInstances`, {
      headers: { apikey: key || "" },
    });
    const data = await resp.json();
    return NextResponse.json({
      env_url: url,
      count: data.length,
      instances: data.map((i: any) => ({
        name: i.name,
        number: i.number,
        status: i.connectionStatus,
      })),
    });
  } catch (e: any) {
    return NextResponse.json({ env_url: url, error: e.message });
  }
}
