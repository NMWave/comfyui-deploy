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
  console.log("🔔 [API] Received machine-built callback");

  // Extract and verify JWT
  const authHeader = request.headers.get("Authorization");
  const secret = process.env.JWT_SECRET;

  console.log(`🔑 [API] Authorization Header: ${authHeader ? 'Present' : 'Missing'}`);

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    console.error("❌ [API] Missing or malformed Authorization header");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = authHeader.split(" ")[1];
  console.log("🔑 [API] Extracted JWT Token from Authorization header");

  // **Ensure 'secret' is defined**
  if (!secret) {
    console.error("❌ [API] JWT_SECRET environment variable is not set.");
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }

  let decoded: unknown;
  try {
    decoded = jwt.verify(token, secret);
    console.log("✅ [API] JWT verified successfully.");
  } catch (err) {
    console.error("❌ [API] JWT verification failed:", err);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log("🔍 [API] Decoding JWT payload with Zod schema");
  const parseJWT = MachineJWTSchema.safeParse(decoded);
  if (!parseJWT.success) {
    console.error("❌ [API] Invalid JWT payload:", parseJWT.error);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const jwtPayload: MachineJWT = parseJWT.data;
  console.log(`🌐 [API] Decoded JWT Payload: ${JSON.stringify(jwtPayload)}`);

  // Optionally, verify that the machine_id in JWT matches the request body after parsing
  // This can be uncommented if such verification is desired
  // const [data, error] = await parseDataSafe(RequestSchema, await request.json());
  // if (!data || error || jwtPayload.machine_id !== data.machine_id) {
  //   console.error("❌ [API] Machine ID mismatch between JWT and request body.");
  //   return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // }

  // Parse and validate the request body
  console.log("📄 [API] Parsing request body with Zod schema");
  const [data, error] = await parseDataSafe(RequestSchema, await request.json());
  if (!data || error) {
    console.error("❌ [API] Error parsing request data:", error);
    return NextResponse.json({ error: "Invalid request data" }, { status: 400 });
  }

  const { machine_id, endpoint, build_log } = data;
  console.log(`🛠️ [API] Processing machine_id: ${machine_id}`);
  console.log(`🔗 [API] Endpoint: ${endpoint ? endpoint : 'None provided'}`);
  console.log(`📝 [API] Build Log: ${build_log ? build_log.slice(0, 100) + '...' : 'No build log provided'}`);

  try {
    if (endpoint) {
      console.log(`🔄 [API] Updating machine_status to "ready" for machine_id: ${machine_id}`);
      await db
        .update(machinesTable)
        .set({
          status: "ready",
          endpoint: endpoint,
          build_log: build_log,
        })
        .where(eq(machinesTable.id, machine_id));
      console.log(`✅ [API] Machine ${machine_id} updated to ready status with endpoint: ${endpoint}`);
    } else {
      console.log(`🔄 [API] Updating machine_status to "error" for machine_id: ${machine_id}`);
      await db
        .update(machinesTable)
        .set({
          status: "error",
          build_log: build_log,
        })
        .where(eq(machinesTable.id, machine_id));
      console.log(`⚠️ [API] Machine ${machine_id} updated to error status`);
    }

    // Revalidate the machines page (optional)
    // revalidatePath("/machines");

    console.log("🎉 [API] Machine status updated successfully");
    return NextResponse.json({ message: "Machine status updated successfully" }, { status: 200 });
  } catch (error) {
    console.error("❌ [API] Error updating machine status:", error);
    return NextResponse.json({ error: "Failed to update machine status" }, { status: 500 });
  }
}