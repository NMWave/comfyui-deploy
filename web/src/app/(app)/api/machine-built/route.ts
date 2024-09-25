import jwt from 'jsonwebtoken';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { parseDataSafe } from '../../../../lib/parseDataSafe';
import { db } from '@/db/db';
import { machinesTable } from '@/db/schema';
import { eq } from 'drizzle-orm';

// Define Zod schema for request body
const RequestSchema = z.object({
  machine_id: z.string(),
  endpoint: z.string().optional(),
  build_log: z.string().optional(),
});

// Define Zod schema for JWT payload
const MachineJWTSchema = z.object({
  machine_id: z.string(),
  endpoint: z.string().optional(),
  iat: z.number(),
  // Add other expected fields if necessary
});

type MachineJWT = z.infer<typeof MachineJWTSchema>;

export async function POST(request: Request) {
  console.log("Received machine-built callback");
  
  // Extract and verify JWT
  const authHeader = request.headers.get("Authorization");
  const secret = process.env.JWT_SECRET;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    console.error("Missing or malformed Authorization header");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = authHeader.split(" ")[1];

  // **Ensure 'secret' is defined**
  if (!secret) {
    console.error("JWT_SECRET environment variable is not set.");
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }

  let decoded: unknown;
  try {
    decoded = jwt.verify(token, secret);
  } catch (err) {
    console.error("JWT verification failed:", err);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parseJWT = MachineJWTSchema.safeParse(decoded);
  if (!parseJWT.success) {
    console.error("Invalid JWT payload:", parseJWT.error);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const jwtPayload: MachineJWT = parseJWT.data;

  // Optionally, you can verify that the machine_id in JWT matches the request body
  // if (jwtPayload.machine_id !== data.machine_id) {
  //   return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // }

  const [data, error] = await parseDataSafe(RequestSchema, await request.json());
  if (!data || error) {
    console.error("Error parsing request data:", error);
    return NextResponse.json({ error: "Invalid request data" }, { status: 400 });
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

    // Revalidate the machines page (optional)
    // revalidatePath("/machines");

    return NextResponse.json({ message: "Machine status updated successfully" }, { status: 200 });
  } catch (error) {
    console.error("Error updating machine status:", error);
    return NextResponse.json({ error: "Failed to update machine status" }, { status: 500 });
  }
}