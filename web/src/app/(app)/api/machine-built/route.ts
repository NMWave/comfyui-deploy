import { parseDataSafe } from "../../../../lib/parseDataSafe";
import { db } from "@/db/db";
import { machinesTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { revalidatePath } from 'next/cache';

const Request = z.object({
  machine_id: z.string(),
  endpoint: z.string().optional(),
  build_log: z.string().optional(),
});

export async function POST(request: Request) {
  const [data, error] = await parseDataSafe(Request, request);
  if (!data || error) {
    console.error("Error parsing request data:", error);
    return new Response(JSON.stringify({ error: "Invalid request data" }), { status: 400 });
  }

  const { machine_id, endpoint, build_log } = data;

  try {
    if (endpoint) {
      await db
        .update(machinesTable)
        .set({
          status: "ready",
          endpoint: endpoint,
          build_log: build_log,
        })
        .where(eq(machinesTable.id, machine_id));
    } else {
      await db
        .update(machinesTable)
        .set({
          status: "error",
          build_log: build_log,
        })
        .where(eq(machinesTable.id, machine_id));
    }

    console.log(`Machine ${machine_id} status updated to ${endpoint ? 'ready' : 'error'}`);
    revalidatePath("/machines");

    return NextResponse.json(
      {
        message: "success",
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error updating machine status:", error);
    return new Response(JSON.stringify({ error: "Failed to update machine status" }), { status: 500 });
  }
}
