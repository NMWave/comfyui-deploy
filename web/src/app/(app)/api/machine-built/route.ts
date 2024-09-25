import { parseDataSafe } from "../../../../lib/parseDataSafe";
import { db } from "@/db/db";
import { machinesTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { revalidatePath } from 'next/cache';

import { parseDataSafe } from "../../../../lib/parseDataSafe";
import { db } from "@/db/db";
import { machinesTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { revalidatePath } from 'next/cache';
import { z } from "zod";

const RequestSchema = z.object({
  machine_id: z.string(),
  endpoint: z.string().optional(),
  build_log: z.string().optional(),
});

export async function POST(request: Request) {
  console.log("Received machine-built callback");
  
  const [data, error] = await parseDataSafe(RequestSchema, await request.json());
  if (!data || error) {
    console.error("Error parsing request data:", error);
    return new NextResponse(JSON.stringify({ error: "Invalid request data" }), { status: 400 });
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
      console.log(`Machine ${machine_id} updated to ready status with endpoint: ${endpoint}`);
    } else {
      await db
        .update(machinesTable)
        .set({
          status: "error",
          build_log: build_log,
        })
        .where(eq(machinesTable.id, machine_id));
      console.log(`Machine ${machine_id} updated to error status`);
    }

    revalidatePath("/machines");

    return NextResponse.json({ message: "Machine status updated successfully" }, { status: 200 });
  } catch (error) {
    console.error("Error updating machine status:", error);
    return NextResponse.json({ error: "Failed to update machine status" }, { status: 500 });
  }
}